#!/usr/bin/env node

/*
============================================================
BACKFILL DO ÍNDICE DE EMPRESAS
============================================================

Preenche companiesIndex/{handle} e documentsIndex/{documento}
a partir das empresas já existentes em companys/.

O índice público recebe somente:

    handle, name, description, category, categories,
    coordinates, location, logoUrl

Nunca document, email ou phone.

------------------------------------------------------------
USO
------------------------------------------------------------

    # apenas mostra o que seria gravado
    node scripts/backfill-companies-index.js --dry-run

    # grava de verdade
    node scripts/backfill-companies-index.js --commit

O modo padrão é --dry-run. Sem --commit o script nunca
escreve no banco.

------------------------------------------------------------
CREDENCIAIS
------------------------------------------------------------

Aponte para a chave de serviço antes de rodar:

    export GOOGLE_APPLICATION_CREDENTIALS=/caminho/chave.json

Opcionais:

    MARKFY_DATABASE_URL   (padrão: banco do projeto markfy)
    MARKFY_PROJECT_ID     (padrão: markfy-96942)
============================================================
*/

const path = require("path");

/*
 * O firebase-admin vive em functions-backend/node_modules.
 */

let admin;

try {

    admin = require("firebase-admin");

} catch (error) {

    admin = require(
        path.join(
            __dirname,
            "..",
            "functions-backend",
            "node_modules",
            "firebase-admin"
        )
    );

}

const PROJECT_ID =
    process.env.MARKFY_PROJECT_ID ||
    "markfy-96942";

const DATABASE_URL =
    process.env.MARKFY_DATABASE_URL ||
    "https://markfy-96942-default-rtdb.firebaseio.com";

const args = process.argv.slice(2);

const commit = args.includes("--commit");

const dryRun = !commit;

if (
    args.includes("--help") ||
    args.includes("-h")
) {

    console.log(
        "Uso: node scripts/backfill-companies-index.js [--dry-run | --commit]"
    );

    process.exit(0);

}

/*
============================================================
SANITIZAÇÃO
============================================================

Mesmas regras de src/firebase/companiesIndex.js.
============================================================
*/

const sanitizeLogoUrl = (logo) => {

    if (typeof logo !== "string") return null;

    const value = logo.trim();

    if (!value) return null;

    if (!/^https?:\/\//i.test(value)) return null;

    return value;

};

const sanitizeCategories = (categories, category) => {

    const list =
        Array.isArray(categories)
            ? categories
            : categories
                ? Object.values(categories)
                : category
                    ? [category]
                    : [];

    const cleaned = list
        .map(item => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean);

    return cleaned.length ? cleaned : null;

};

const sanitizeCoordinates = (company) => {

    const coordinates =
        company?.coordinates ||
        company?.location?.coordinates ||
        null;

    if (!coordinates) return null;

    const latitude = Number(coordinates.latitude);
    const longitude = Number(coordinates.longitude);

    if (
        Number.isNaN(latitude) ||
        Number.isNaN(longitude)
    ) {
        return null;
    }

    return {
        latitude,
        longitude
    };

};

const sanitizeLocation = (location) => {

    if (!location || typeof location !== "object") return null;

    const allowed = [
        "street",
        "number",
        "neighborhood",
        "city",
        "state",
        "zipCode",
        "country"
    ];

    const cleaned = {};

    allowed.forEach((field) => {

        const value = location[field];

        if (typeof value === "string" && value.trim()) {

            cleaned[field] = value.trim();

        }

    });

    return Object.keys(cleaned).length ? cleaned : null;

};

const normalizeDocument = (document) =>
    String(document || "").replace(/\D/g, "");

const buildCompanyIndexEntry = (handle, company) => {

    const categories = sanitizeCategories(
        company?.categories,
        company?.category
    );

    return {

        handle:
            company?.handle || handle,

        name:
            company?.name || "",

        description:
            company?.description || "",

        category:
            company?.category ||
            (categories ? categories[0] : null),

        categories,

        coordinates:
            sanitizeCoordinates(company),

        location:
            sanitizeLocation(company?.location),

        logoUrl:
            sanitizeLogoUrl(company?.logoPreview)

    };

};

/*
============================================================
CONSULTA RASA (REST)
============================================================

Devolve as chaves do nó, ou null se a consulta falhar.
============================================================
*/

const fetchShallowKeys = async (nodePath) => {

    try {

        const token =
            await admin
                .app()
                .options
                .credential
                .getAccessToken();

        const url =
            `${DATABASE_URL.replace(/\/+$/, "")}` +
            `/${nodePath}.json?shallow=true` +
            `&access_token=${token.access_token}`;

        const response = await fetch(url);

        if (!response.ok) return null;

        const data = await response.json();

        return data ? Object.keys(data) : [];

    } catch (error) {

        return null;

    }

};

/*
============================================================
EXECUÇÃO
============================================================
*/

const run = async () => {

    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        databaseURL: DATABASE_URL,
        projectId: PROJECT_ID
    });

    const db = admin.database();

    console.log(
        `\nProjeto: ${PROJECT_ID}`
    );

    console.log(
        `Banco:   ${DATABASE_URL}`
    );

    console.log(
        `Modo:    ${dryRun ? "DRY RUN (nada será gravado)" : "COMMIT (vai gravar)"}\n`
    );

    /*
     * Lista rasa: só as chaves, sem baixar as empresas.
     *
     * O SDK admin não expõe ?shallow=true, então usamos a
     * REST API com o token da conta de serviço.
     */

    let handles = await fetchShallowKeys("companys");

    if (handles === null) {

        /*
         * Se a REST falhar, cai para a leitura completa.
         * Aceitável num script pontual, rodado à mão.
         */

        console.warn(
            "Consulta rasa indisponível. Lendo companys por completo.\n"
        );

        const allSnapshot = await db.ref("companys").once("value");

        handles = allSnapshot.exists()
            ? Object.keys(allSnapshot.val() || {})
            : [];

    }

    if (!handles.length) {

        console.log("Nenhuma empresa encontrada.\n");

        await admin.app().delete();

        return;

    }

    console.log(
        `${handles.length} empresa(s) encontrada(s).\n`
    );

    const companiesIndexUpdates = {};
    const documentsIndexUpdates = {};

    let semLogo = 0;

    for (const handle of handles) {

        /*
         * Lê só os campos necessários, um por vez, para
         * não baixar products/schedules/paymentOrders.
         */

        const fields = [
            "handle",
            "name",
            "description",
            "category",
            "categories",
            "coordinates",
            "location",
            "logoPreview",
            "document"
        ];

        const values = await Promise.all(
            fields.map(field =>
                db.ref(`companys/${handle}/${field}`).once("value")
            )
        );

        const company = {};

        fields.forEach((field, i) => {

            if (values[i].exists()) {

                company[field] = values[i].val();

            }

        });

        const entry = buildCompanyIndexEntry(handle, company);

        /*
         * A update() abaixo substitui companiesIndex/{handle}
         * inteiro. Se o nó da empresa não tem a URL da logo
         * (logo já migrada para o Storage), preserva a que o
         * índice já tem em vez de apagá-la.
         */
        if (!entry.logoUrl) {

            const existingLogo = (
                await db.ref(`companiesIndex/${handle}/logoUrl`).once("value")
            ).val();

            if (typeof existingLogo === "string" && existingLogo.startsWith("http")) {
                entry.logoUrl = existingLogo;
            }

        }

        companiesIndexUpdates[handle] = entry;

        const document = normalizeDocument(company.document);

        if (document) {

            documentsIndexUpdates[document] = handle;

        }

        if (!entry.logoUrl) {

            semLogo += 1;

        }

        console.log(
            `companiesIndex/${handle}`
        );

        console.log(
            JSON.stringify(entry, null, 4)
        );

        /* CPF/CNPJ não vai para o terminal: só os 4 últimos dígitos. */
        console.log(
            document
                ? `documentsIndex/***${document.slice(-4)} = ${handle}`
                : "documentsIndex: (empresa sem documento)"
        );

        console.log("");

    }

    if (semLogo) {

        console.log(
            `Aviso: ${semLogo} empresa(s) ficarão sem logo no ` +
            "índice porque a logo não está no Storage " +
            "(provavelmente base64). O card usa o fallback.\n"
        );

    }

    if (dryRun) {

        console.log(
            "DRY RUN: nada foi gravado. " +
            "Rode com --commit para aplicar.\n"
        );

        await admin.app().delete();

        return;

    }

    await db.ref("companiesIndex").update(companiesIndexUpdates);

    if (Object.keys(documentsIndexUpdates).length) {

        await db.ref("documentsIndex").update(documentsIndexUpdates);

    }

    console.log(
        `Gravado: ${Object.keys(companiesIndexUpdates).length} ` +
        "entrada(s) em companiesIndex e " +
        `${Object.keys(documentsIndexUpdates).length} em documentsIndex.\n`
    );

    await admin.app().delete();

};

run().catch((error) => {

    console.error("\nFalha no backfill:", error);

    process.exit(1);

});
