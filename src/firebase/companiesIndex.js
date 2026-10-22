import {
    getDatabase,
    ref,
    get,
    set,
    update,
    remove
} from "firebase/database";

/*
============================================================
ÍNDICE PÚBLICO DE EMPRESAS
============================================================

companiesIndex/{handle} guarda apenas o que a tela Explorar
precisa para montar o card:

    handle, name, description, category, categories,
    coordinates, logoUrl, location

location entra porque a aba "Perto de você" geocodifica o
endereço da empresa; sem ele a distância para de funcionar.
É o endereço comercial, não dado pessoal.

O nó "companys" continua sendo a fonte da verdade. O índice
existe só para a listagem não precisar baixar produtos,
agendamentos e pedidos de todas as empresas.

ATENÇÃO:

O índice é de leitura pública, então NUNCA pode receber
document (CPF/CNPJ), email ou phone.
============================================================
*/

/*
 * Só aceita logo hospedada no Firebase Storage.
 *
 * Empresas que ainda guardam a logo em base64 ficam sem
 * logo no índice (o card já tem fallback).
 */

export const sanitizeLogoUrl = (logo) => {

    if (typeof logo !== "string") return null;

    const value = logo.trim();

    if (!value) return null;

    if (!/^https?:\/\//i.test(value)) return null;

    return value;

};

/*
 * Normaliza as categorias para um array de strings.
 */

export const sanitizeCategories = (categories, category) => {

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

/*
 * Aceita coordinates soltas na empresa ou dentro de location.
 */

export const sanitizeCoordinates = (company) => {

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

/*
 * Endereço comercial usado para calcular a distância.
 *
 * Nunca copia document, email ou phone.
 */

export const sanitizeLocation = (location) => {

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

/*
 * Monta a entrada completa do índice a partir da empresa.
 */

export const buildCompanyIndexEntry = (handle, company) => {

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
 * Aplica um patch parcial no índice.
 *
 * Nunca deixa a sincronização do índice derrubar a operação
 * principal: o "companys" já foi gravado quando chegamos aqui.
 */

export const updateCompanyIndex = async (handle, patch) => {

    if (!handle) return;

    try {

        const db = getDatabase();

        await update(
            ref(db, `companiesIndex/${handle}`),
            patch
        );

    } catch (error) {

        console.warn(
            "Não foi possível atualizar o índice de empresas:",
            error
        );

    }

};

/*
 * Grava a entrada completa (criação da empresa e backfill).
 */

export const syncCompanyIndex = async (handle, company) => {

    await updateCompanyIndex(
        handle,
        buildCompanyIndexEntry(handle, company)
    );

};

/*
 * Repara a entrada do índice quando ela falta ou está sem
 * nome (empresas antigas, ou só com logoUrl gravado pela
 * migração da logo). Chamado quando um membro abre o painel:
 * só membros podem gravar no índice.
 *
 * Uma vez por empresa por sessão, e nunca apaga a logoUrl que
 * já está lá (o nó da empresa pode não ter a URL).
 */
const repairedIndexes = new Set();

export const repairCompanyIndex = async (handle, company) => {

    if (!handle || !company?.name || repairedIndexes.has(handle)) return;

    repairedIndexes.add(handle);

    try {

        const current = await get(
            ref(getDatabase(), `companiesIndex/${handle}/name`)
        );

        if (current.exists()) return;

        const patch = buildCompanyIndexEntry(handle, company);

        if (!patch.logoUrl) delete patch.logoUrl;

        await updateCompanyIndex(handle, patch);

    } catch (error) {

        console.warn(
            "Não foi possível reparar o índice da empresa:",
            error
        );

    }

};

/*
 * Remove a entrada do índice.
 */

export const removeCompanyIndex = async (handle) => {

    if (!handle) return;

    try {

        const db = getDatabase();

        await remove(
            ref(db, `companiesIndex/${handle}`)
        );

    } catch (error) {

        console.warn(
            "Não foi possível remover o índice da empresa:",
            error
        );

    }

};

/*
============================================================
ÍNDICE DE DOCUMENTOS
============================================================

documentsIndex/{documento} = handle

Serve só para detectar CPF/CNPJ duplicado sem precisar ler
o nó "companys" inteiro.

Este nó NÃO é público: as regras liberam a leitura de uma
chave específica para usuário autenticado, nunca do nó pai.
Quem consulta já precisa conhecer o documento, então não dá
para enumerar a base.
============================================================
*/

export const normalizeDocument = (document) =>
    String(document || "").replace(/\D/g, "");

/*
 * Devolve o handle da empresa dona do documento, ou null.
 */

export const getDocumentOwner = async (document) => {

    const normalized = normalizeDocument(document);

    if (!normalized) return null;

    const db = getDatabase();

    const snapshot = await get(
        ref(db, `documentsIndex/${normalized}`)
    );

    return snapshot.exists()
        ? snapshot.val()
        : null;

};

/*
 * Registra o documento e remove a chave anterior quando o
 * documento da empresa mudou.
 */

export const setDocumentOwner = async (
    document,
    handle,
    previousDocument
) => {

    const normalized = normalizeDocument(document);

    const previous = normalizeDocument(previousDocument);

    try {

        const db = getDatabase();

        if (previous && previous !== normalized) {

            await remove(
                ref(db, `documentsIndex/${previous}`)
            );

        }

        if (normalized && handle) {

            await set(
                ref(db, `documentsIndex/${normalized}`),
                handle
            );

        }

    } catch (error) {

        console.warn(
            "Não foi possível atualizar o índice de documentos:",
            error
        );

    }

};

/*
============================================================
FALLBACK DA TELA EXPLORAR
============================================================

Empresas criadas antes de companiesIndex existir não têm
entrada no índice — e uma empresa fora do índice simplesmente
não aparece em "Explorar".

Este fallback monta as mesmas entradas lendo companys/, mas
SEM baixar o nó inteiro: lista os handles com uma consulta
rasa e depois lê campo a campo, só o que o card usa. São
poucos bytes por empresa, contra megabytes de produtos,
agendamentos e pedidos.

Roda apenas quando o índice vem vazio. Assim que o backfill
(scripts/backfill-companies-index.js) for executado, ou as
empresas salvarem os dados pelo painel, o índice passa a
responder e este caminho deixa de ser usado.

ATENÇÃO — ESTE FALLBACK É PROVISÓRIO:

Ele depende de "companys" continuar legível. As regras
propostas em database.rules.proposta.json fecham esse nó
(companys/.read = false) e deixam público apenas
companiesIndex. Antes de publicar aquelas regras, rode o
backfill — senão a tela Explorar volta a ficar vazia, agora
sem rede de segurança. Quando a leitura for negada, esta
função devolve [] em vez de quebrar a tela.
============================================================
*/

/*
 * Campos do nó da empresa que alimentam o card.
 *
 * Nunca inclui document, email ou phone — a mesma restrição
 * que vale para o índice vale aqui.
 */
const INDEX_SOURCE_FIELDS = [
    "name",
    "description",
    "category",
    "categories",
    "coordinates",
    "location",
    "logoPreview"
];


/*
 * Lista os handles de "companys" sem baixar o conteúdo.
 *
 * O token é anexado quando existe usuário logado; sem
 * usuário, a consulta depende das regras permitirem a
 * leitura pública do nó (que é o caso da listagem pública
 * de empresas).
 */
export const fetchCompanyHandles = async (authToken) => {

    const db = getDatabase();

    const databaseURL = db.app?.options?.databaseURL;

    if (!databaseURL) return [];

    try {

        const url =
            `${databaseURL.replace(/\/+$/, "")}` +
            `/companys.json?shallow=true` +
            (authToken ? `&auth=${authToken}` : "");

        const response = await fetch(url);

        if (!response.ok) return [];

        const data = await response.json();

        return data ? Object.keys(data) : [];

    } catch (error) {

        console.warn(
            "Não foi possível listar as empresas:",
            error
        );

        return [];

    }

};


/*
 * Lê os campos do card de uma empresa, um a um.
 */
const fetchCompanyCardFields = async (handle) => {

    const db = getDatabase();

    const values = await Promise.all(
        INDEX_SOURCE_FIELDS.map(async (field) => {

            try {

                const snapshot = await get(
                    ref(db, `companys/${handle}/${field}`)
                );

                return snapshot.exists()
                    ? snapshot.val()
                    : null;

            } catch (error) {

                return null;

            }

        })
    );

    return Object.fromEntries(
        INDEX_SOURCE_FIELDS.map(
            (field, position) => [field, values[position]]
        )
    );

};


/**
 * Lista pública de empresas (Explorar e central do usuário).
 *
 * POR QUE AS EMPRESAS SUMIRAM (2026-10-20)
 *
 * O índice tinha 1 entrada para 3 empresas — e essa entrada
 * só com `logoUrl`, gravada pela migração da logo
 * (companyLogo.js). Entradas sem `name` eram descartadas; com
 * o índice "vazio", as telas caíam no fallback por
 * companys/?shallow=true, que as regras publicadas em
 * 2026-10-20 passaram a negar para quem não é master. Lista
 * vazia, sem erro na tela.
 *
 * Agora:
 *   - entrada incompleta é completada com os campos públicos
 *     da própria empresa (nome, descrição, categorias...),
 *     que as regras liberam campo a campo;
 *   - empresa sem entrada nenhuma só aparece depois do
 *     backfill (scripts/backfill-companies-index.js) ou de
 *     alguém da equipe abrir o painel (UserCompanyContext
 *     repara o índice);
 *   - erro de rede/permissão vira exceção, para a tela
 *     mostrar "não deu para carregar" em vez de "nenhuma
 *     empresa".
 */
export const loadPublicCompanyList = async ({ authToken, handles = [] } = {}) => {

    const snapshot = await get(
        ref(getDatabase(), "companiesIndex")
    );

    const data = { ...(snapshot.val() || {}) };

    /*
     * `handles`: empresas que sabemos ser públicas (as
     * elegíveis de publicAccess). As que faltam no índice
     * entram como entrada vazia e são completadas abaixo —
     * assim uma empresa com plano ativo nunca some só porque
     * o índice está atrasado.
     */
    handles
        .filter((handle) => typeof handle === "string" && handle && !data[handle])
        .forEach((handle) => {
            data[handle] = { handle };
        });

    const entries = await Promise.all(
        Object.entries(data).map(async ([handle, entry]) => {

            const base = {
                ...(entry || {}),
                handle: entry?.handle || handle
            };

            if (base.name) return base;

            const company =
                await fetchCompanyCardFields(base.handle);

            if (!company?.name) return null;

            const built =
                buildCompanyIndexEntry(base.handle, company);

            return {
                ...built,
                logoUrl: base.logoUrl || built.logoUrl
            };

        })
    );

    const list = entries.filter(Boolean);

    if (list.length) return list;

    /* Índice vazio: o caminho antigo ainda serve à conta
       master (as regras negam a consulta rasa aos demais). */
    return fetchCompaniesFromSource(authToken);

};


/**
 * Entradas de índice montadas direto de "companys".
 *
 * Mesma forma que companiesIndex/{handle}, para a tela
 * Explorar não precisar saber de onde os dados vieram.
 */
export const fetchCompaniesFromSource = async (authToken) => {

    const handles = await fetchCompanyHandles(authToken);

    if (!handles.length) {
        return [];
    }

    const entries = await Promise.all(
        handles.map(async (handle) => {

            const company =
                await fetchCompanyCardFields(handle);

            if (!company?.name) {
                return null;
            }

            return buildCompanyIndexEntry(
                handle,
                company
            );

        })
    );

    return entries.filter(Boolean);

};
