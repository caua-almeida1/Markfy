const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp({
    /* Explícito: sem isto o Admin SDK deduz a URL e, se errar, o banco
       recusa a credencial e a função trava até estourar o timeout. */
    databaseURL: "https://markfy-96942-default-rtdb.firebaseio.com"
});

const db = admin.database();

const DATABASE_URL = "https://markfy-96942-default-rtdb.firebaseio.com";


/* =====================================================
   LEITURA PARCIAL DE companys

   Webhooks e assinaturas precisavam "varrer as empresas" e
   faziam isso com db.ref("companys").once("value"): cada
   chamada baixava TODAS as empresas inteiras — agenda,
   produtos (alguns com imagens base64 de mais de 1 MB),
   pedidos. Download do Realtime Database é cobrado por byte,
   e o Mercado Pago manda várias notificações por pagamento.

   Agora: lista os handles com consulta rasa (só as chaves) e
   lê, de cada empresa, só o filho que interessa. Se a
   consulta rasa falhar, volta à leitura completa — mais
   cara, mas nunca pior do que antes.
===================================================== */

async function listCompanyHandles() {

    try {

        const credential = admin.app().options.credential;
        const { access_token: accessToken } = await credential.getAccessToken();

        const response = await fetch(`${DATABASE_URL}/companys.json?shallow=true`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        return Object.keys((await response.json()) || {});

    } catch (error) {

        console.warn("Consulta rasa de companys indisponível; lendo completo:", error.message);

        return Object.keys((await db.ref("companys").once("value")).val() || {});
    }
}

/** { handle: { filho: valor } } só com os filhos pedidos. */
async function loadCompaniesChildren(children) {

    const handles = await listCompanyHandles();

    const entries = await Promise.all(handles.map(async (handle) => {

        const values = await Promise.all(
            children.map((child) => db.ref(`companys/${handle}/${child}`).once("value"))
        );

        const company = {};

        children.forEach((child, index) => {
            if (values[index].exists()) company[child] = values[index].val();
        });

        return [handle, company];
    }));

    return Object.fromEntries(entries);
}


/* =====================================================
   CONVERTER PREÇO

   Os preços são gravados como texto ("R$ 1.234,56"), que é
   o formato que as telas mostram. `Number()` nesse texto dá
   NaN — foi assim que a assinatura passou a recusar todo
   plano com "O plano possui um valor inválido": ela lia
   `Number(plan.price)` em vez de converter.

   Esta função vivia dentro de createMercadoPagoPayment, onde
   só ela enxergava. No escopo do módulo, todo endpoint que
   lida com dinheiro usa a mesma conversão.
===================================================== */

function parseMoney(value) {

    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== "string") {
        return null;
    }

    let normalized =
        value
            .trim()
            .replace(/[^\d,.-]/g, "");

    /* Com ponto E vírgula, o ponto é separador de milhar. */
    if (
        normalized.includes(",") &&
        normalized.includes(".")
    ) {

        normalized =
            normalized
                .replace(/\./g, "")
                .replace(",", ".");

    } else if (
        normalized.includes(",")
    ) {

        normalized =
            normalized.replace(",", ".");
    }

    /*
     * Texto sem dígito nenhum não é zero, é ausência.
     *
     * `Number("")` devolve 0, e com isso um preço vazio
     * passaria como válido — pior, quebraria o encadeamento
     * `parseMoney(plan.price) ?? parseMoney(product.value)`,
     * já que 0 não aciona o `??`.
     */
    if (!normalized || !/\d/.test(normalized)) {
        return null;
    }

    const amount = Number(normalized);

    return Number.isFinite(amount)
        ? amount
        : null;

}

setGlobalOptions({
    maxInstances: 10
});


/* =====================================================
   MERCADO PAGO — SECRETS
===================================================== */

const mercadoPagoClientId =
    defineSecret("MERCADOPAGO_CLIENT_ID");

const mercadoPagoClientSecret =
    defineSecret("MERCADOPAGO_CLIENT_SECRET");


/* =====================================================
   CONFIGURAÇÕES
===================================================== */

const MERCADO_PAGO_REDIRECT_URI =
    "https://us-central1-markfy-96942.cloudfunctions.net/mercadoPagoOAuthCallback";

const MARKFY_FRONTEND_URL =
    "https://markfy.vercel.app";

/* =====================================================
   MERCADO PAGO — CONFIGURAÇÃO DO MARKFY
===================================================== */

const mercadoPagoMarkfyAccessToken =
    defineSecret("MERCADOPAGO_MARKFY_ACCESS_TOKEN");

/* =====================================================
MERCADO PAGO — SALVAR CARTÃO DO CLIENTE
===================================================== */

exports.saveMercadoPagoCard = onRequest(
    {
        secrets: [
            mercadoPagoMarkfyAccessToken
        ]
    },

    async (req, res) => {

        try {

            /* =========================================
               CORS
            ========================================= */

            res.set(
                "Access-Control-Allow-Origin",
                "*"
            );

            res.set(
                "Access-Control-Allow-Headers",
                "Authorization, Content-Type"
            );

            if (req.method === "OPTIONS") {
                return res.status(204).send("");
            }

            if (req.method !== "POST") {

                return res.status(405).json({
                    success: false,
                    message: "Método não permitido."
                });

            }


            /* =========================================
               FIREBASE AUTH
            ========================================= */

            const authorization =
                req.headers.authorization || "";

            if (
                !authorization.startsWith("Bearer ")
            ) {

                return res.status(401).json({
                    success: false,
                    message:
                        "Usuário não autenticado."
                });

            }

            const idToken =
                authorization.replace(
                    "Bearer ",
                    ""
                );

            const decodedToken =
                await admin
                    .auth()
                    .verifyIdToken(idToken);

            const uid =
                decodedToken.uid;


            /* =========================================
               DADOS DO CLIENTE
            ========================================= */

            const {
                token,
                email,
                firstName,
                lastName
            } = req.body || {};


            if (!token) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Token do cartão não informado."
                });

            }


            const customerEmail =
                email ||
                decodedToken.email;


            if (!customerEmail) {

                return res.status(400).json({
                    success: false,
                    message:
                        "E-mail do cliente não informado."
                });

            }


            /* =========================================
               ACCESS TOKEN DO MARKFY
            ========================================= */

            const accessToken =
                mercadoPagoMarkfyAccessToken.value();


            if (!accessToken) {

                throw new Error(
                    "MERCADOPAGO_MARKFY_ACCESS_TOKEN não configurado."
                );

            }


            /* =========================================
               CUSTOMER EXISTENTE
            ========================================= */

            const customerRef =
                db.ref(
                    `paymentCustomers/${uid}`
                );

            const customerSnapshot =
                await customerRef.once("value");

            let customerData =
                customerSnapshot.val();


            let customerId =
                customerData?.mercadoPagoCustomerId ||
                null;


            /* =========================================
               CRIAR CUSTOMER
            ========================================= */

            if (!customerId) {

                const customerResponse =
                    await fetch(
                        "https://api.mercadopago.com/v1/customers",
                        {

                            method: "POST",

                            headers: {

                                "Content-Type":
                                    "application/json",

                                "Authorization":
                                    `Bearer ${accessToken}`

                            },

                            body:
                                JSON.stringify({

                                    email:
                                        customerEmail,

                                    first_name:
                                        firstName ||
                                        "Cliente",

                                    last_name:
                                        lastName ||
                                        "Markfy"

                                })

                        }
                    );


                const customerResponseText =
                    await customerResponse.text();


                let customerResult;

                try {

                    customerResult =
                        JSON.parse(
                            customerResponseText
                        );

                } catch {

                    customerResult = {
                        raw:
                            customerResponseText
                    };

                }


                console.log(
                    "👤 Mercado Pago Customer:",
                    {
                        status:
                            customerResponse.status,

                        response:
                            customerResult
                    }
                );


                if (!customerResponse.ok) {

                    return res.status(
                        customerResponse.status
                    ).json({

                        success: false,

                        message:
                            customerResult?.message ||
                            "Não foi possível criar o cliente Mercado Pago.",

                        details:
                            customerResult

                    });

                }


                customerId =
                    customerResult.id;


                customerData = {

                    mercadoPagoCustomerId:
                        customerId,

                    email:
                        customerEmail,

                    createdAt:
                        Date.now(),

                    updatedAt:
                        Date.now()

                };


                await customerRef.set(
                    customerData
                );

            }


            /* =========================================
               SALVAR CARTÃO
            ========================================= */

            const cardResponse =
                await fetch(
                    `https://api.mercadopago.com/v1/customers/${customerId}/cards`,
                    {

                        method: "POST",

                        headers: {

                            "Content-Type":
                                "application/json",

                            "Authorization":
                                `Bearer ${accessToken}`,

                            "X-Idempotency-Key":
                                crypto.randomUUID()

                        },

                        body:
                            JSON.stringify({

                                token

                            })

                    }
                );


            const cardResponseText =
                await cardResponse.text();


            let cardData;

            try {

                cardData =
                    JSON.parse(
                        cardResponseText
                    );

            } catch {

                cardData = {
                    raw:
                        cardResponseText
                };

            }


            console.log(
                "💳 Mercado Pago Card:",
                {
                    status:
                        cardResponse.status,

                    response:
                        cardData
                }
            );


            if (!cardResponse.ok) {

                return res.status(
                    cardResponse.status
                ).json({

                    success: false,

                    message:
                        cardData?.message ||
                        "Não foi possível salvar o cartão.",

                    details:
                        cardData

                });

            }


            /* =========================================
               SALVAR SOMENTE REFERÊNCIA SEGURA
               NO FIREBASE
            ========================================= */

            const savedCardRef =
                db.ref(
                    `paymentCards/${uid}/${cardData.id}`
                );


            await savedCardRef.set({

                cardId:
                    cardData.id,

                customerId,

                paymentMethodId:
                    cardData.payment_method?.id ||
                    null,

                firstSixDigits:
                    cardData.first_six_digits ||
                    null,

                lastFourDigits:
                    cardData.last_four_digits ||
                    null,

                expirationMonth:
                    cardData.expiration_month ||
                    null,

                expirationYear:
                    cardData.expiration_year ||
                    null,

                savedAt:
                    Date.now()

            });


            /* =========================================
               SUCESSO
            ========================================= */

            return res.status(200).json({

                success: true,

                customerId,

                card: {

                    id:
                        cardData.id,

                    paymentMethodId:
                        cardData.payment_method?.id ||
                        null,

                    lastFourDigits:
                        cardData.last_four_digits ||
                        null,

                    expirationMonth:
                        cardData.expiration_month ||
                        null,

                    expirationYear:
                        cardData.expiration_year ||
                        null

                }

            });

        } catch (error) {

            console.error(
                "❌ Erro saveMercadoPagoCard:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Não foi possível salvar o cartão."

            });

        }

    }
);
/* =====================================================
   FUNÇÕES AUXILIARES
===================================================== */


/**
 * Procura em qual empresa o usuário está cadastrado.
 *
 * Estrutura:
 *
 * companys/
 *   empresa/
 *     members/
 *       UID/
 *         role: "master"
 */
async function findUserCompany(uid) {

    /*
     * Primeiro as empresas que o próprio usuário aponta
     * (companyHandle e o índice users/{uid}/companies); só
     * se nenhuma servir, confere members/{uid} empresa a
     * empresa — lendo apenas esse nó, nunca a empresa toda.
     *
     * Não registra nada sobre os membros no log: era dado
     * pessoal indo para o Cloud Logging a cada chamada.
     */

    const [currentHandle, indexed] = await Promise.all([
        db.ref(`users/${uid}/companyHandle`).once("value").then((snap) => snap.val()),
        db.ref(`users/${uid}/companies`).once("value").then((snap) => Object.keys(snap.val() || {}))
    ]);

    const tryHandles = async (handles) => {

        for (const handle of handles) {

            if (typeof handle !== "string" || !handle) continue;

            const member = (await db.ref(`companys/${handle}/members/${uid}`).once("value")).val();

            if (member) return { handle, member };
        }

        return null;
    };

    const direct = await tryHandles([...new Set([currentHandle, ...indexed])]);

    if (direct) return direct;

    return tryHandles(await listCompanyHandles());
}

/**
 * Verifica se o usuário possui permissão
 * para conectar o Mercado Pago.
 */
function hasMercadoPagoPermission(role) {

    return (
        role === "master" ||
        role === "administrador"
    );
}
async function refreshMercadoPagoAccessToken(
    companyHandle,
    connection
) {

    if (!connection?.refreshToken) {

        throw new Error(
            "Refresh token do Mercado Pago não encontrado."
        );

    }

    console.log(
        "========================================"
    );

    console.log(
        "🔄 INICIANDO RENOVAÇÃO MERCADO PAGO"
    );

    console.log(
        "🏢 Empresa:",
        companyHandle
    );

    console.log(
        "👤 Mercado Pago User ID:",
        connection.mercadoPagoUserId
    );

    console.log(
        "🔑 Possui Access Token:",
        Boolean(connection.accessToken)
    );

    console.log(
        "🔄 Possui Refresh Token:",
        Boolean(connection.refreshToken)
    );

    console.log(
        "📅 Expires At:",
        connection.expiresAt
            ? new Date(connection.expiresAt).toISOString()
            : null
    );

    console.log(
        "📋 Scope:",
        connection.scope
    );

    console.log(
        "========================================"
    );


    const clientId =
        mercadoPagoClientId.value();

    const clientSecret =
        mercadoPagoClientSecret.value();


    if (!clientId) {

        throw new Error(
            "MERCADOPAGO_CLIENT_ID não configurado."
        );

    }

    if (!clientSecret) {

        throw new Error(
            "MERCADOPAGO_CLIENT_SECRET não configurado."
        );

    }


    const response =
        await fetch(
            "https://api.mercadopago.com/oauth/token",
            {

                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    client_id:
                        clientId,

                    client_secret:
                        clientSecret,

                    grant_type:
                        "refresh_token",

                    refresh_token:
                        connection.refreshToken

                })

            }
        );


    /*
     * O corpo só pode ser lido uma vez: lemos como texto e
     * convertemos depois, para não quebrar se vier algo
     * que não seja JSON.
     */
    const responseText =
        await response.text();

    let data;

    try {

        data =
            JSON.parse(responseText);

    } catch {

        data = {
            raw: responseText
        };

    }


    console.log(
        "========================================"
    );

    console.log(
        "🔄 RESPOSTA REFRESH MERCADO PAGO"
    );

    console.log(
        "HTTP:",
        response.status
    );

    console.log(
        "Resposta:",
        data
    );

    console.log(
        "========================================"
    );


    if (!response.ok) {

        throw new Error(
            `Mercado Pago refresh ${response.status}: ${data?.message ||
            data?.error_description ||
            data?.error ||
            "erro desconhecido"
            }`
        );

    }


    if (!data.access_token) {

        throw new Error(
            "Mercado Pago não retornou um novo Access Token."
        );

    }


    const expiresInSeconds =
        Number(data.expires_in) || 0;


    const expiresAt =
        Date.now() +
        expiresInSeconds * 1000;


    const updatedConnection = {

        ...connection,

        accessToken:
            data.access_token,

        refreshToken:
            data.refresh_token ||
            connection.refreshToken,

        expiresIn:
            expiresInSeconds,

        expiresAt,

        publicKey:
            data.public_key ||
            connection.publicKey,

        updatedAt:
            Date.now()

    };


    await db
        .ref(
            `mercadoPagoConnections/${companyHandle}`
        )
        .update({

            accessToken:
                updatedConnection.accessToken,

            refreshToken:
                updatedConnection.refreshToken,

            expiresIn:
                updatedConnection.expiresIn,

            expiresAt:
                updatedConnection.expiresAt,

            publicKey:
                updatedConnection.publicKey,

            updatedAt:
                updatedConnection.updatedAt

        });


    console.log(
        "✅ ACCESS TOKEN RENOVADO COM SUCESSO"
    );


    return updatedConnection;

}


/* =====================================================
   OAUTH — INICIAR
===================================================== */

exports.mercadoPagoOAuthStart = onRequest(
    {
        secrets: [
            mercadoPagoClientId
        ]
    },

    async (req, res) => {

        try {

            /* =========================================
               CORS
            ========================================= */

            res.set(
                "Access-Control-Allow-Origin",
                "*"
            );

            res.set(
                "Access-Control-Allow-Headers",
                "Authorization, Content-Type"
            );

            if (req.method === "OPTIONS") {

                return res.status(204).send("");
            }


            /* =========================================
               TOKEN DO FIREBASE
            ========================================= */

            const authorization =
                req.headers.authorization || "";

            if (!authorization.startsWith("Bearer ")) {

                return res.status(401).json({
                    success: false,
                    message:
                        "Usuário não autenticado."
                });
            }


            const idToken =
                authorization.replace(
                    "Bearer ",
                    ""
                );

            /* =========================================
               VALIDAR FIREBASE AUTH
            ========================================= */

            const decodedToken =
                await admin
                    .auth()
                    .verifyIdToken(idToken);

            const uid =
                decodedToken.uid;

            console.log("=================================");
            console.log("🔥 MERCADO PAGO OAUTH START");
            console.log("🔥 Firebase UID:", uid);
            console.log("🔥 Email:", decodedToken.email);
            console.log("=================================");

            /* =========================================
               ENCONTRAR EMPRESA
            ========================================= */

            const userCompany =
                await findUserCompany(uid);

            if (!userCompany) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Usuário não pertence a nenhuma empresa."
                });
            }


            const {
                handle,
                member
            } = userCompany;


            /* =========================================
               VERIFICAR ROLE
            ========================================= */

            const role =
                member.role;


            if (!hasMercadoPagoPermission(role)) {

                return res.status(403).json({
                    success: false,
                    message:
                        "Você não possui permissão para conectar o Mercado Pago."
                });
            }

            /* =========================================
               URL DE RETORNO
            ========================================= */

            const allowedReturnUrls = [
                "https://markfy.vercel.app/central-adm",
                "http://localhost:3000/central-adm"
            ];

            const returnUrl =
                req.query.returnUrl;

            const safeReturnUrl =
                allowedReturnUrls.includes(returnUrl)
                    ? returnUrl
                    : "https://markfy.vercel.app/central-adm";

            /* =========================================
               GERAR STATE
            ========================================= */

            const state =
                crypto.randomBytes(32).toString("hex");


            /* =========================================
               SALVAR STATE
            ========================================= */

            await db
                .ref(
                    `mercadoPagoOAuthStates/${state}`
                )
                .set({

                    uid,

                    companyHandle:
                        handle,

                    returnUrl:
                        safeReturnUrl,

                    createdAt:
                        Date.now()

                });

            /* =========================================
               URL DO MERCADO PAGO
            ========================================= */

            const clientId =
                mercadoPagoClientId.value();


            const authorizationUrl =
                new URL(
                    "https://auth.mercadopago.com/authorization"
                );


            authorizationUrl.searchParams.set(
                "client_id",
                clientId
            );

            authorizationUrl.searchParams.set(
                "response_type",
                "code"
            );

            authorizationUrl.searchParams.set(
                "platform_id",
                "mp"
            );

            authorizationUrl.searchParams.set(
                "state",
                state
            );

            authorizationUrl.searchParams.set(
                "redirect_uri",
                MERCADO_PAGO_REDIRECT_URI
            );

            authorizationUrl.searchParams.set(
                "scope",
                "offline_access write read"
            );
            /* =========================================
               RETORNAR URL
            ========================================= */

            return res.status(200).json({

                success: true,

                authorizationUrl:
                    authorizationUrl.toString()

            });

        } catch (error) {

            console.error(
                "Erro ao iniciar OAuth Mercado Pago:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Não foi possível iniciar a conexão com o Mercado Pago."

            });
        }
    }
);


/* =====================================================
   OAUTH — CALLBACK
===================================================== */

exports.mercadoPagoOAuthCallback = onRequest(
    {
        secrets: [
            mercadoPagoClientId,
            mercadoPagoClientSecret
        ]
    },

    async (req, res) => {

        try {

            const {
                code,
                state,
                error,
                error_description
            } = req.query;


            /* =========================================
               USUÁRIO NEGOU
            ========================================= */

            if (error) {

                console.error(
                    "Mercado Pago OAuth recusado:",
                    error,
                    error_description
                );

                return res
                    .status(400)
                    .send(`
                        <!DOCTYPE html>

                        <html lang="pt-BR">

                        <head>
                            <meta charset="UTF-8">
                            <title>Markfy</title>
                        </head>

                        <body>

                            <h1>Conexão cancelada</h1>

                            <p>
                                A conexão com o Mercado Pago
                                não foi autorizada.
                            </p>

                        </body>

                        </html>
                    `);
            }


            /* =========================================
               VALIDAR CODE
            ========================================= */

            if (!code || !state) {

                return res
                    .status(400)
                    .send(`
                        <h1>Erro na conexão</h1>
                        <p>
                            O Mercado Pago não retornou
                            os dados necessários.
                        </p>
                    `);
            }


            /* =========================================
               BUSCAR STATE
            ========================================= */

            const stateRef =
                db.ref(
                    `mercadoPagoOAuthStates/${state}`
                );

            const stateSnapshot =
                await stateRef.once("value");

            const stateData =
                stateSnapshot.val();


            if (!stateData) {

                return res
                    .status(400)
                    .send(`
                        <h1>Conexão inválida</h1>
                        <p>
                            A solicitação de conexão
                            não é válida ou já expirou.
                        </p>
                    `);
            }


            /* =========================================
               EXPIRAÇÃO DO STATE
            ========================================= */

            const STATE_MAX_AGE =
                10 * 60 * 1000;


            const stateExpired =
                Date.now() -
                stateData.createdAt >
                STATE_MAX_AGE;


            if (stateExpired) {

                await stateRef.remove();

                return res
                    .status(400)
                    .send(`
                        <h1>Solicitação expirada</h1>
                        <p>
                            Inicie novamente a conexão
                            com o Mercado Pago.
                        </p>
                    `);
            }


            /* =========================================
               REMOVER STATE
               Evita reutilização
            ========================================= */

            await stateRef.remove();


            /* =========================================
               TROCAR CODE POR TOKEN
            ========================================= */

            const response =
                await fetch(
                    "https://api.mercadopago.com/oauth/token",
                    {

                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            client_id:
                                mercadoPagoClientId.value(),

                            client_secret:
                                mercadoPagoClientSecret.value(),

                            code,

                            grant_type:
                                "authorization_code",

                            redirect_uri:
                                MERCADO_PAGO_REDIRECT_URI

                        })

                    }
                );


            const tokenData =
                await response.json();


            if (!response.ok) {

                console.error(
                    "Erro Mercado Pago OAuth:",
                    tokenData
                );

                return res
                    .status(response.status)
                    .send(`
                        <h1>Erro ao conectar</h1>
                        <p>
                            Não foi possível concluir
                            a conexão com o Mercado Pago.
                        </p>
                    `);
            }


            /* =========================================
               DADOS RECEBIDOS
            ========================================= */

            const {
                access_token,
                refresh_token,
                user_id,
                public_key,
                expires_in,
                scope,
                live_mode
            } = tokenData;


            if (
                !access_token ||
                !refresh_token ||
                !user_id
            ) {

                console.error(
                    "Resposta OAuth incompleta:",
                    tokenData
                );

                return res
                    .status(500)
                    .send(`
                        <h1>Erro ao conectar</h1>
                        <p>
                            O Mercado Pago não retornou
                            todas as credenciais necessárias.
                        </p>
                    `);
            }


            /* =========================================
               SALVAR CONEXÃO
            ========================================= */

            const expiresInSeconds =
                Number(expires_in) || 0;

            const expiresAt =
                Date.now() +
                (expiresInSeconds * 1000);

            await db
                .ref(
                    `mercadoPagoConnections/${stateData.companyHandle}`
                )
                .set({

                    connected: true,

                    mercadoPagoUserId:
                        user_id,

                    publicKey:
                        public_key || null,

                    accessToken:
                        access_token,

                    refreshToken:
                        refresh_token,

                    expiresIn:
                        expiresInSeconds,

                    expiresAt,

                    connectedAt:
                        Date.now(),

                    scope:
                        scope || null,

                    liveMode:
                        live_mode === true,

                    connectedBy:
                        stateData.uid

                });

            await db
                .ref(
                    `companys/${stateData.companyHandle}/paymentSettings/mercadoPago`
                )
                .update({
                    connected: true,
                    mercadoPagoUserId: user_id,
                    connectedAt: Date.now()
                });

            return res.redirect(
                `${stateData.returnUrl}?mercadoPago=connected`
            );
        } catch (error) {

            console.error(
                "Erro no callback OAuth:",
                error
            );

            return res
                .status(500)
                .send(`
                    <h1>Erro interno</h1>

                    <p>
                        Não foi possível concluir
                        a conexão com o Mercado Pago.
                    </p>
                `);
        }
    }
);

/* =====================================================
   MERCADO PAGO — CRIAR PAGAMENTO
===================================================== */

exports.createMercadoPagoPayment = onRequest(
    {
        /*
         * Sem declarar os secrets aqui a função não consegue
         * lê-los, e a renovação do token falha com
         * "MERCADOPAGO_CLIENT_ID não configurado".
         */
        secrets: [
            mercadoPagoClientId,
            mercadoPagoClientSecret
        ]
    },
    async (req, res) => {

        try {

            /* =========================================
               CORS
            ========================================= */

            res.set(
                "Access-Control-Allow-Origin",
                "*"
            );

            res.set(
                "Access-Control-Allow-Headers",
                "Authorization, Content-Type"
            );

            if (req.method === "OPTIONS") {
                return res.status(204).send("");
            }

            if (req.method !== "POST") {
                return res.status(405).json({
                    success: false,
                    message: "Método não permitido."
                });
            }


            /* =========================================
               FIREBASE AUTH
            ========================================= */

            const authorization =
                req.headers.authorization || "";

            if (!authorization.startsWith("Bearer ")) {

                return res.status(401).json({
                    success: false,
                    message: "Usuário não autenticado."
                });
            }

            const idToken =
                authorization.replace("Bearer ", "");

            const decodedToken =
                await admin
                    .auth()
                    .verifyIdToken(idToken);

            const uid =
                decodedToken.uid;


            /* =========================================
               DADOS RECEBIDOS
            ========================================= */

            const {
                companyHandle,
                productId,
                professionalId,
                professionalName,
                day,
                dayLabel,
                hour,
                userName,
                clientId,
                notes,

                paymentMethodId,
                token,
                issuerId,
                installments,
                payer
            } = req.body || {};


            if (
                !companyHandle ||
                !productId ||
                !professionalId ||
                !day ||
                !hour ||
                !userName ||
                !clientId
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Dados insuficientes para criar o pagamento."
                });
            }


            /* =========================================
               VERIFICAR EMPRESA
            ========================================= */

            const companySnapshot =
                await db
                    .ref(`companys/${companyHandle}`)
                    .once("value");

            const company =
                companySnapshot.val();

            if (!company) {

                return res.status(404).json({
                    success: false,
                    message: "Empresa não encontrada."
                });
            }


            /* =========================================
               PRODUTO
            ========================================= */

            const productSnapshot =
                await db
                    .ref(
                        `companys/${companyHandle}/products/${productId}`
                    )
                    .once("value");

            const product =
                productSnapshot.val();

            if (!product) {

                return res.status(404).json({
                    success: false,
                    message: "Produto não encontrado."
                });
            }


            const amount =
                parseMoney(product.value);


            if (
                amount === null ||
                amount <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "O produto possui um valor inválido."
                });
            }


            /* =========================================
               CONEXÃO MERCADO PAGO
            ========================================= */

            const connectionSnapshot =
                await db
                    .ref(
                        `mercadoPagoConnections/${companyHandle}`
                    )
                    .once("value");

            const connection =
                connectionSnapshot.val();


            if (
                !connection ||
                !connection.connected ||
                !connection.accessToken
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "O Mercado Pago ainda não está conectado para esta empresa."
                });
            }


            /* =========================================
               ID DO PAGAMENTO
            ========================================= */

            const paymentRef =
                db
                    .ref(
                        `companys/${companyHandle}/paymentOrders`
                    )
                    .push();

            const paymentId =
                paymentRef.key;

            /* =========================================
               CRIAR PAYMENT ORDER
            ========================================= */

            await paymentRef.set({

                id:
                    paymentId,

                status:
                    "pending",

                companyHandle,

                userId:
                    uid,

                clientId,

                productId,

                productName:
                    product.name || null,

                productPrice:
                    amount,

                professionalId,

                professionalName:
                    professionalName || null,

                day,

                dayLabel:
                    dayLabel || null,

                hour,

                userName,

                /* Recado do cliente. Fica aqui porque o
                   agendamento só nasce quando o pagamento é
                   aprovado, lá no webhook. */
                notes:
                    (typeof notes === "string" && notes.trim())
                        ? notes.trim().slice(0, 300)
                        : null,

                createdAt:
                    Date.now()

            });


            /* =========================================
               DADOS DO PAGAMENTO
            ========================================= */

            const paymentData = {

                transaction_amount:
                    Number(amount.toFixed(2)),

                description:
                    product.name ||
                    "Agendamento Markfy",

                payment_method_id:
                    paymentMethodId,

                external_reference:
                    paymentId,

                notification_url:
                    "https://us-central1-markfy-96942.cloudfunctions.net/mercadoPagoWebhook",

                payer:
                    payer || {},

                metadata: {

                    companyHandle,

                    productId,

                    professionalId,

                    professionalName:
                        professionalName || null,

                    day,

                    dayLabel:
                        dayLabel || null,

                    hour,

                    userName,

                    clientId,

                    userId:
                        uid
                }
            };


            /* =========================================
               CARTÃO
            ========================================= */

            if (token) {

                paymentData.token =
                    token;

            }

            if (issuerId) {

                paymentData.issuer_id =
                    issuerId;

            }

            if (
                installments &&
                Number(installments) > 0
            ) {

                paymentData.installments =
                    Number(installments);

            }


            /* =========================================
               VALIDAR MÉTODO
            ========================================= */

            if (!paymentMethodId) {

                await paymentRef.update({

                    status:
                        "error",

                    error:
                        "Método de pagamento não informado.",

                    updatedAt:
                        Date.now()

                });

                return res.status(400).json({

                    success: false,

                    message:
                        "Método de pagamento não informado."

                });

            }


            /* =========================================
               CRIAR PAGAMENTO NO MERCADO PAGO
            ========================================= */

            let mercadoPagoResponse =
                await fetch(
                    "https://api.mercadopago.com/v1/payments",
                    {

                        method: "POST",

                        headers: {

                            "Content-Type":
                                "application/json",

                            "Authorization":
                                `Bearer ${connection.accessToken}`,

                            "X-Idempotency-Key":
                                paymentId

                        },

                        body:
                            JSON.stringify(
                                paymentData
                            )

                    }
                );
            let mercadoPagoData =
                await mercadoPagoResponse.json();

            console.log(
                "========================================"
            );

            console.log(
                "💳 RESPOSTA INICIAL MERCADO PAGO"
            );

            console.log(
                "HTTP:",
                mercadoPagoResponse.status
            );

            console.log(
                "Resposta:",
                mercadoPagoData
            );

            console.log(
                "========================================"
            );

            /* =====================================================
               RENOVAR TOKEN SE CREDENCIAL ESTIVER INVÁLIDA
            ===================================================== */

            if (
                mercadoPagoResponse.status === 401 ||
                (
                    mercadoPagoResponse.status === 400 &&
                    (
                        mercadoPagoData?.message
                            ?.toLowerCase()
                            ?.includes("credential")
                        ||
                        mercadoPagoData?.error
                            ?.toLowerCase()
                            ?.includes("credential")
                    )
                )
            ) {

                console.warn(
                    "⚠️ Access Token Mercado Pago inválido. Renovando..."
                );


                try {

                    const refreshedConnection =
                        await refreshMercadoPagoAccessToken(
                            companyHandle,
                            connection
                        );


                    mercadoPagoResponse =
                        await fetch(
                            "https://api.mercadopago.com/v1/payments",
                            {

                                method: "POST",

                                headers: {

                                    "Content-Type":
                                        "application/json",

                                    "Authorization":
                                        `Bearer ${refreshedConnection.accessToken}`,

                                    /*
                                     * Chave nova: com a mesma chave o
                                     * Mercado Pago pode devolver a
                                     * resposta já registrada da
                                     * tentativa que falhou.
                                     */
                                    "X-Idempotency-Key":
                                        `${paymentId}-retry`

                                },

                                body:
                                    JSON.stringify(
                                        paymentData
                                    )

                            }
                        );


                    mercadoPagoData =
                        await mercadoPagoResponse.json();


                } catch (refreshError) {

                    console.error(
                        "❌ Não foi possível renovar o token:",
                        refreshError
                    )

                    await paymentRef.update({

                        status:
                            "error",

                        error:
                            refreshError.message,

                        updatedAt:
                            Date.now()

                    });


                    return res.status(401).json({

                        success: false,

                        message:
                            "Não foi possível autenticar a conta Mercado Pago.",

                        code:
                            "MERCADO_PAGO_AUTH_ERROR",

                        details:
                            refreshError.message

                    });

                }

            }

            /* =========================================
               MERCADO PAGO RECUSOU A REQUISIÇÃO
            =========================================

               Sem esta checagem a função devolvia
               success:true com um id "undefined" e o
               erro real sumia.
            ========================================= */

            if (
                !mercadoPagoResponse.ok ||
                !mercadoPagoData?.id
            ) {

                const causeDescription =
                    Array.isArray(mercadoPagoData?.cause)
                        ? mercadoPagoData.cause
                            .map((cause) =>
                                cause?.description
                            )
                            .filter(Boolean)
                            .join("; ")
                        : null;

                const mercadoPagoMessage =
                    causeDescription ||
                    mercadoPagoData?.message ||
                    mercadoPagoData?.error ||
                    "Erro desconhecido do Mercado Pago.";

                console.error(
                    "❌ Mercado Pago recusou o pagamento:",
                    mercadoPagoResponse.status,
                    mercadoPagoMessage
                );

                await paymentRef.update({

                    status:
                        "error",

                    error:
                        mercadoPagoMessage,

                    mercadoPagoHttpStatus:
                        mercadoPagoResponse.status,

                    updatedAt:
                        Date.now()

                });

                /* =========================================
                   DE QUEM É O PROBLEMA

                   Nem toda recusa é do cliente. Boa parte
                   vem da conta que RECEBE: Pix sem chave
                   cadastrada, conta sem validação de
                   identidade, conta sem permissão para
                   cobrar de terceiros.

                   Tratar tudo como "confira os dados" manda
                   o cliente tentar de novo para sempre num
                   pagamento que nunca vai passar, e o dono
                   da empresa nunca descobre que a pendência
                   é dele. Aqui cada caso vira uma frase que
                   diz o que fazer, e `ownerAction` marca as
                   que só o dono resolve.
                ========================================= */

                const problemasDaConta = [

                    {
                        teste: /without key enabled for QR render|key.*not.*found|pix.*key/i,
                        codigo: "MERCADO_PAGO_PIX_SEM_CHAVE",
                        mensagem:
                            "O Pix ainda não está liberado na conta Mercado Pago desta empresa. " +
                            "O responsável precisa cadastrar uma chave Pix no app do Mercado Pago. " +
                            "Enquanto isso, pague com cartão."
                    },

                    {
                        teste: /identity|identification.*validat|documenta[cç][aã]o|compliance|kyc/i,
                        codigo: "MERCADO_PAGO_CONTA_NAO_VALIDADA",
                        mensagem:
                            "A conta Mercado Pago desta empresa está com a validação de identidade " +
                            "pendente e por isso não pode receber. O responsável precisa concluir a " +
                            "verificação no Mercado Pago."
                    },

                    {
                        teste: /not authorized|unauthorized|forbidden|operator/i,
                        codigo: "MERCADO_PAGO_SEM_PERMISSAO",
                        mensagem:
                            "A conta Mercado Pago desta empresa não tem permissão para receber este " +
                            "pagamento. O responsável precisa reconectar a conta em Perfil → Pagamentos."
                    },

                    {
                        teste: /invalid users involved/i,
                        codigo: "MERCADO_PAGO_MESMA_CONTA",
                        mensagem:
                            "Não dá para pagar com a mesma conta Mercado Pago que recebe. " +
                            "Use outro e-mail ou outro cartão."
                    }

                ];

                const problemaDaConta =
                    problemasDaConta.find(
                        (item) =>
                            item.teste.test(mercadoPagoMessage)
                    ) || null;

                const isCredentialError =
                    mercadoPagoResponse.status === 401 ||
                    /credential/i.test(mercadoPagoMessage);

                if (problemaDaConta || isCredentialError) {

                    console.error(
                        "⚠️ Recusa ligada à CONTA DE RECEBIMENTO de",
                        companyHandle,
                        "->",
                        mercadoPagoMessage
                    );

                }

                return res.status(
                    (isCredentialError || problemaDaConta) ? 502 : 400
                ).json({

                    success: false,

                    code:
                        problemaDaConta
                            ? problemaDaConta.codigo
                            : isCredentialError
                                ? "MERCADO_PAGO_AUTH_ERROR"
                                : "MERCADO_PAGO_REJECTED",

                    /* Marca as recusas que o cliente não tem
                       como resolver sozinho. */
                    ownerAction:
                        Boolean(problemaDaConta) ||
                        isCredentialError,

                    message:
                        problemaDaConta
                            ? problemaDaConta.mensagem
                            : isCredentialError
                                ? "A conta Mercado Pago desta empresa precisa ser conectada novamente."
                                : "O Mercado Pago não aceitou o pagamento. Confira os dados e tente de novo.",

                    details:
                        mercadoPagoMessage

                });
            }


            /* =========================================
               PIX — DADOS PARA O CLIENTE PAGAR
            ========================================= */

            const transactionData =
                mercadoPagoData
                    ?.point_of_interaction
                    ?.transaction_data || null;

            const pix =
                transactionData
                    ? {

                        qrCode:
                            transactionData.qr_code ||
                            null,

                        qrCodeBase64:
                            transactionData.qr_code_base64 ||
                            null,

                        ticketUrl:
                            transactionData.ticket_url ||
                            null,

                        expiresAt:
                            mercadoPagoData.date_of_expiration ||
                            null

                    }
                    : null;


            /* =========================================
               SALVAR DADOS DO MERCADO PAGO
            ========================================= */

            await paymentRef.update({

                mercadoPagoPaymentId:
                    String(mercadoPagoData.id),

                mercadoPagoStatus:
                    mercadoPagoData.status ||
                    "pending",

                paymentStatusDetail:
                    mercadoPagoData.status_detail ||
                    null,

                paymentMethodId:
                    mercadoPagoData.payment_method_id ||
                    paymentMethodId,

                updatedAt:
                    Date.now()

            });


            /* =========================================
               RETORNAR RESULTADO
            ========================================= */

            return res.status(200).json({

                success: true,

                paymentId,

                mercadoPagoPaymentId:
                    String(mercadoPagoData.id),

                status:
                    mercadoPagoData.status,

                statusDetail:
                    mercadoPagoData.status_detail ||

                    null,

                paymentMethodId:
                    mercadoPagoData.payment_method_id ||

                    paymentMethodId,

                pix

            });

        } catch (error) {

            console.error(
                "Erro createMercadoPagoPayment:",
                error
            );

            return res.status(500).json({

                success: false,

                message:
                    "Erro interno ao criar pagamento."

            });
        }
    }
);

/* =====================================================
   ASSINATURAS — MERCADO PAGO (PREAPPROVAL)

   Cobrança recorrente não passa por /v1/payments (que cobra
   uma vez): é /preapproval, que guarda a autorização e cobra
   sozinha a cada ciclo, na conta da empresa.

   Tudo de mensalidade mora em subscriptions.js (endpoints,
   webhook, sincronização diária) e subscriptions-core.js
   (regras puras, com testes). Aqui fica só a ligação com o
   que é deste arquivo: os secrets e a renovação do token.

     subscriptionsApi        create | sync | cancel
     subscriptionsDailySync  todo dia às 06:00 (Brasília)

   O nó companys/{handle}/subscriptions/{uid}_{productId} é
   o espelho local: o Mercado Pago é a fonte da verdade da
   cobrança, e o nó é o que as telas leem.
===================================================== */

const carregarConexao = async (companyHandle) => {

    const connection =
        (await db.ref(`mercadoPagoConnections/${companyHandle}`).once("value")).val();

    if (
        !connection ||
        !connection.connected ||
        !connection.accessToken
    ) {
        return null;
    }

    return connection;

};

const subscriptions = require("./subscriptions")({
    admin,
    secrets: [mercadoPagoClientId, mercadoPagoClientSecret],
    refreshAccessToken: (handle, connection) =>
        refreshMercadoPagoAccessToken(handle, connection),
    loadCompaniesChildren
});

exports.subscriptionsApi = subscriptions.subscriptionsApi;
exports.subscriptionsDailySync = subscriptions.subscriptionsDailySync;


/* =====================================================
   MERCADO PAGO — VERIFICAR ASSINATURAS

   O Mercado Pago libera assinaturas por conta, e essa
   liberação não pode ser feita por aqui. O que dá para fazer
   é descobrir se a conta já pode: cria uma assinatura
   "pending" (sem cartão, portanto sem cobrança nenhuma) e a
   cancela em seguida.
===================================================== */

exports.checkMercadoPagoSubscriptions = onRequest(
    {
        secrets: [
            mercadoPagoClientId,
            mercadoPagoClientSecret
        ]
    },
    async (req, res) => {

        try {

            res.set("Access-Control-Allow-Origin", "*");
            res.set(
                "Access-Control-Allow-Headers",
                "Authorization, Content-Type"
            );

            if (req.method === "OPTIONS") {
                return res.status(204).send("");
            }

            if (req.method !== "POST") {
                return res.status(405).json({
                    success: false,
                    message: "Método não permitido."
                });
            }

            const authorization =
                req.headers.authorization || "";

            if (!authorization.startsWith("Bearer ")) {
                return res.status(401).json({
                    success: false,
                    message: "Usuário não autenticado."
                });
            }

            const decodedToken =
                await admin
                    .auth()
                    .verifyIdToken(
                        authorization.replace("Bearer ", "")
                    );

            const userCompany =
                await findUserCompany(decodedToken.uid);

            if (!userCompany) {
                return res.status(403).json({
                    success: false,
                    message: "Usuário não pertence a nenhuma empresa."
                });
            }

            const companyHandle = userCompany.handle;

            const connection =
                await carregarConexao(companyHandle);

            if (!connection) {
                return res.status(400).json({
                    success: false,
                    code: "NOT_CONNECTED",
                    message:
                        "Conecte a conta do Mercado Pago antes de verificar."
                });
            }

            /* Teste ou produção, pelo prefixo da chave. */
            const mode =
                String(connection.publicKey || "").startsWith("TEST-")
                    ? "test"
                    : "production";

            const corpo = {
                reason: "Verificação Markfy",
                payer_email:
                    decodedToken.email || "markfy.suporte@gmail.com" /* markfy.app é domínio de outra empresa */,
                status: "pending",
                auto_recurring: {
                    frequency: 1,
                    frequency_type: "months",
                    transaction_amount: 10,
                    currency_id: "BRL"
                },
                back_url:
                    "https://markfy.vercel.app/central-adm"
            };

            const criar = (token) =>
                fetch(
                    "https://api.mercadopago.com/preapproval",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`
                        },
                        body: JSON.stringify(corpo)
                    }
                );

            let accessToken = connection.accessToken;

            let resposta = await criar(accessToken);
            let dados = await resposta.json().catch(() => ({}));

            /* Token vencido: renova e tenta uma vez. */
            if (
                resposta.status === 401 ||
                /credential/i.test(dados?.message || "")
            ) {

                const renovada =
                    await refreshMercadoPagoAccessToken(
                        companyHandle,
                        connection
                    );

                accessToken = renovada.accessToken;

                resposta = await criar(accessToken);
                dados = await resposta.json().catch(() => ({}));
            }

            if (resposta.ok && dados?.id) {

                /* Não deixa a assinatura de teste pendurada. */
                const cancelou = await fetch(
                    `https://api.mercadopago.com/preapproval/${dados.id}`,
                    {
                        method: "PUT",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${accessToken}`
                        },
                        body: JSON.stringify({ status: "cancelled" })
                    }
                ).catch(() => null);

                if (!cancelou?.ok) {
                    console.error(
                        "⚠️ Assinatura de verificação não cancelada:",
                        dados.id
                    );
                }

                return res.status(200).json({
                    success: true,
                    ready: true,
                    mode
                });
            }

            const motivo =
                (Array.isArray(dados?.cause)
                    ? dados.cause
                        .map(c => c?.description)
                        .filter(Boolean)
                        .join("; ")
                    : null) ||
                dados?.message ||
                "O Mercado Pago não aceitou a verificação.";

            console.error(
                "❌ Verificação de assinaturas recusada:",
                resposta.status,
                motivo
            );

            return res.status(200).json({
                success: true,
                ready: false,
                mode,
                details: motivo
            });

        } catch (error) {

            console.error(
                "Erro checkMercadoPagoSubscriptions:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Não foi possível verificar agora."
            });
        }
    }
);


/* =====================================================
   MERCADO PAGO — PUBLIC KEY
===================================================== */

exports.getMercadoPagoPublicKey = onRequest(
    async (req, res) => {

        try {

            res.set(
                "Access-Control-Allow-Origin",
                "*"
            );

            res.set(
                "Access-Control-Allow-Headers",
                "Authorization, Content-Type"
            );

            if (req.method === "OPTIONS") {
                return res.status(204).send("");
            }

            if (req.method !== "GET") {
                return res.status(405).json({
                    success: false,
                    message: "Método não permitido."
                });
            }

            const authorization =
                req.headers.authorization || "";

            if (!authorization.startsWith("Bearer ")) {
                return res.status(401).json({
                    success: false,
                    message: "Usuário não autenticado."
                });
            }

            const idToken =
                authorization.replace("Bearer ", "");

            const decodedToken =
                await admin
                    .auth()
                    .verifyIdToken(idToken);

            const uid =
                decodedToken.uid;

            /*
             * No checkout quem chama é o CLIENTE, que não é
             * membro da empresa: ele informa de qual empresa
             * vai comprar. A public key é pública por
             * definição (vai para o navegador), então liberar
             * a leitura não expõe nada sensível.
             *
             * Sem o parâmetro, mantém o comportamento antigo:
             * a empresa do próprio usuário (painel admin).
             */
            let companyHandle =
                typeof req.query?.companyHandle === "string"
                    ? req.query.companyHandle.trim()
                    : "";

            if (!companyHandle) {

                const userCompany =
                    await findUserCompany(uid);

                if (!userCompany) {
                    return res.status(403).json({
                        success: false,
                        message: "Usuário não pertence a nenhuma empresa."
                    });
                }

                companyHandle =
                    userCompany.handle;
            }

            // O handle vira caminho no banco: só aceita um
            // segmento simples, sem "/" nem caracteres especiais.
            if (!/^[A-Za-z0-9_-]{1,100}$/.test(companyHandle)) {
                return res.status(400).json({
                    success: false,
                    message: "Empresa inválida."
                });
            }

            const connectionSnapshot =
                await db
                    .ref(
                        `mercadoPagoConnections/${companyHandle}`
                    )
                    .once("value");

            const connection =
                connectionSnapshot.val();

            if (
                !connection ||
                !connection.connected ||
                !connection.publicKey
            ) {
                return res.status(400).json({
                    success: false,
                    message:
                        "Mercado Pago não está conectado para esta empresa."
                });
            }

            return res.status(200).json({
                success: true,
                publicKey: connection.publicKey
            });

        } catch (error) {

            console.error(
                "Erro getMercadoPagoPublicKey:",
                error
            );

            return res.status(500).json({
                success: false,
                message:
                    "Não foi possível obter a configuração do pagamento."
            });
        }
    }
);

/* =====================================================
   MERCADO PAGO — WEBHOOK
===================================================== */

exports.mercadoPagoWebhook = onRequest(
    {
        /* A sincronização de assinaturas pode precisar renovar
           o token da empresa. */
        secrets: [
            mercadoPagoClientId,
            mercadoPagoClientSecret
        ]
    },
    async (req, res) => {

        try {

            /* =========================================
               CORS
            ========================================= */

            res.set(
                "Access-Control-Allow-Origin",
                "*"
            );

            if (req.method === "OPTIONS") {
                return res.status(204).send("");
            }

            if (
                req.method !== "POST" &&
                req.method !== "GET"
            ) {
                return res.status(405).send(
                    "Method Not Allowed"
                );
            }


            /* =========================================
               DADOS DA NOTIFICAÇÃO
            ========================================= */

            /* Webhook manda type + data.id no corpo; o IPN antigo
               manda topic + id na URL. */
            const type =
                req.body?.type ||
                req.query?.type ||
                req.query?.topic;

            const dataId =
                req.body?.data?.id ||
                req.query?.["data.id"] ||
                req.query?.id;


            if (!dataId) {
                return res.status(200).send("OK");
            }


            /* =========================================
               ASSINATURAS

                 subscription_preapproval   mudou o estado
                 subscription_authorized_payment
                                            cobrança agendada,
                                            paga ou recusada

               Ver subscriptions.js. `user_id` é a conta
               Mercado Pago da empresa: diz de quem é a
               cobrança sem varrer todas as conexões.
            ========================================= */

            if (
                type === "preapproval" ||
                type === "subscription_preapproval" ||
                type === "subscription_authorized_payment" ||
                type === "authorized_payment"
            ) {

                await subscriptions.handleNotification({
                    type,
                    id: String(dataId),
                    collectorId: req.body?.user_id || null
                });

                return res.status(200).send("OK");

            }

            if (type !== "payment") {

                return res
                    .status(200)
                    .send("OK");
            }


            const mercadoPagoPaymentId =
                String(dataId);


            /* =========================================
               BUSCAR PAYMENT ORDER
            ========================================= */

            /* Só paymentOrders de cada empresa (ver
               loadCompaniesChildren). */
            const companies =
                await loadCompaniesChildren(["paymentOrders"]);

            let paymentOrder = null;
            let companyHandle = null;
            let paymentOrderKey = null;


            /*
             * O pagamento foi criado com:
             *
             * external_reference = paymentId
             *
             * Portanto, primeiro consultamos o
             * pagamento diretamente no Mercado Pago
             * para descobrir essa referência.
             */

            for (
                const [handle, company]
                of Object.entries(companies)
            ) {

                if (
                    !company ||
                    !company.paymentOrders
                ) {
                    continue;
                }


                const connectionSnapshot =
                    await db
                        .ref(
                            `mercadoPagoConnections/${handle}`
                        )
                        .once("value");

                const connection =
                    connectionSnapshot.val();


                if (
                    !connection ||
                    !connection.accessToken
                ) {
                    continue;
                }


                /*
                 * Verificamos somente orders que
                 * ainda não possuem o ID do Mercado Pago.
                 *
                 * Isso evita consultas desnecessárias.
                 */

                const pendingOrders =
                    Object.entries(
                        company.paymentOrders
                    ).filter(
                        ([, order]) =>
                            order &&
                            !order.mercadoPagoPaymentId
                    );


                if (
                    pendingOrders.length === 0
                ) {
                    continue;
                }


                const paymentResponse =
                    await fetch(
                        `https://api.mercadopago.com/v1/payments/${mercadoPagoPaymentId}`,
                        {
                            headers: {
                                "Authorization":
                                    `Bearer ${connection.accessToken}`
                            }
                        }
                    );


                if (
                    !paymentResponse.ok
                ) {
                    continue;
                }


                const mercadoPagoData =
                    await paymentResponse.json();


                /*
                 * external_reference contém
                 * o ID interno da nossa paymentOrder.
                 */

                const externalReference =
                    mercadoPagoData.external_reference;


                if (!externalReference) {
                    continue;
                }


                const matchingOrder =
                    company.paymentOrders[
                    externalReference
                    ];


                if (!matchingOrder) {
                    continue;
                }


                paymentOrder =
                    matchingOrder;

                companyHandle =
                    handle;

                paymentOrderKey =
                    externalReference;

                break;
            }


            /* =========================================
               FALLBACK — ID JÁ SALVO
            ========================================= */

            if (!paymentOrder) {

                for (
                    const [handle, company]
                    of Object.entries(companies)
                ) {

                    if (
                        !company ||
                        !company.paymentOrders
                    ) {
                        continue;
                    }


                    for (
                        const [key, order]
                        of Object.entries(
                            company.paymentOrders
                        )
                    ) {

                        if (
                            order?.mercadoPagoPaymentId &&
                            String(
                                order.mercadoPagoPaymentId
                            ) ===
                            mercadoPagoPaymentId
                        ) {

                            paymentOrder =
                                order;

                            companyHandle =
                                handle;

                            paymentOrderKey =
                                key;

                            break;
                        }
                    }


                    if (paymentOrder) {
                        break;
                    }
                }
            }


            /* =========================================
               PAGAMENTO NÃO ENCONTRADO
            ========================================= */

            if (
                !paymentOrder ||
                !companyHandle ||
                !paymentOrderKey
            ) {

                console.warn(
                    "PaymentOrder não encontrada para pagamento:",
                    mercadoPagoPaymentId
                );

                return res
                    .status(200)
                    .send("OK");
            }


            /* =========================================
               CONEXÃO DA EMPRESA
            ========================================= */

            const connectionSnapshot =
                await db
                    .ref(
                        `mercadoPagoConnections/${companyHandle}`
                    )
                    .once("value");

            const connection =
                connectionSnapshot.val();


            if (
                !connection ||
                !connection.accessToken
            ) {

                console.error(
                    "Conexão Mercado Pago não encontrada:",
                    companyHandle
                );

                return res
                    .status(200)
                    .send("OK");
            }


            /* =========================================
               CONSULTAR PAGAMENTO REAL
            ========================================= */

            const paymentResponse =
                await fetch(
                    `https://api.mercadopago.com/v1/payments/${mercadoPagoPaymentId}`,
                    {
                        headers: {
                            "Authorization":
                                `Bearer ${connection.accessToken}`
                        }
                    }
                );


            const paymentData =
                await paymentResponse.json();


            if (!paymentResponse.ok) {

                console.error(
                    /* Sem o corpo: ele traz os dados do pagador. */
                    "Erro ao consultar pagamento Mercado Pago:",
                    paymentResponse.status,
                    paymentData?.message || null
                );

                return res
                    .status(200)
                    .send("OK");
            }


            /* =========================================
               VALIDAR EXTERNAL REFERENCE
            ========================================= */

            if (
                String(
                    paymentData.external_reference || ""
                ) !==
                String(paymentOrderKey)
            ) {

                console.error(
                    "external_reference incompatível:",
                    {
                        paymentId:
                            mercadoPagoPaymentId,

                        externalReference:
                            paymentData.external_reference,

                        paymentOrderKey
                    }
                );

                return res
                    .status(200)
                    .send("OK");
            }


            /* =========================================
               STATUS
            ========================================= */

            const paymentStatus =
                paymentData.status;


            console.log(
                "💳 Status Mercado Pago:",
                {
                    paymentId:
                        mercadoPagoPaymentId,

                    status:
                        paymentStatus,

                    detail:
                        paymentData.status_detail
                }
            );


            /* =========================================
               ATUALIZAR PAYMENT ORDER
            ========================================= */

            const paymentOrderRef =
                db.ref(
                    `companys/${companyHandle}/paymentOrders/${paymentOrderKey}`
                );


            await paymentOrderRef.update({

                status:
                    paymentStatus,

                mercadoPagoPaymentId:
                    mercadoPagoPaymentId,

                mercadoPagoStatus:
                    paymentStatus,

                paymentStatusDetail:
                    paymentData.status_detail ||
                    null,

                updatedAt:
                    Date.now()

            });


            /* =========================================
               PAGAMENTO NÃO APROVADO
            ========================================= */

            if (
                paymentStatus !== "approved"
            ) {

                /*
                 * pending:
                 * ainda aguardando processamento.
                 *
                 * rejected:
                 * pagamento recusado.
                 *
                 * cancelled:
                 * pagamento cancelado.
                 *
                 * Não criamos agendamento
                 * em nenhum desses casos.
                 */

                return res
                    .status(200)
                    .send("OK");
            }


            /* =========================================
               RECARREGAR ORDER ATUALIZADA
            ========================================= */

            const freshOrderSnapshot =
                await paymentOrderRef.once(
                    "value"
                );

            const freshPaymentOrder =
                freshOrderSnapshot.val();


            if (!freshPaymentOrder) {

                console.error(
                    "PaymentOrder desapareceu:",
                    paymentOrderKey
                );

                return res
                    .status(200)
                    .send("OK");
            }


            /* =========================================
               EVITAR DUPLICAÇÃO
            ========================================= */

            if (
                freshPaymentOrder.scheduleCreated === true
            ) {

                return res
                    .status(200)
                    .send("OK");
            }


            /* =========================================
               DADOS DO AGENDAMENTO
            ========================================= */

            const {
                productId,
                productName,
                productPrice,
                professionalId,
                professionalName,
                day,
                dayLabel,
                hour,
                userName,
                clientId,
                userId
            } = freshPaymentOrder;


            if (
                !productId ||
                !professionalId ||
                !day ||
                !hour ||
                !clientId
            ) {

                console.error(
                    /* Só a chave: o pedido tem nome e telefone. */
                    "PaymentOrder sem dados suficientes:",
                    paymentOrderKey
                );

                return res
                    .status(200)
                    .send("OK");
            }


            /* =========================================
               VERIFICAR AGENDAMENTO EXISTENTE
            ========================================= */

            const schedulesSnapshot =
                await db
                    .ref(
                        `companys/${companyHandle}/schedules`
                    )
                    .once("value");

            const schedules =
                schedulesSnapshot.val() || {};


            const scheduleAlreadyExists =
                Object.values(
                    schedules
                ).some(
                    schedule =>
                        schedule &&
                        schedule.clientId === clientId &&
                        schedule.productId === productId &&
                        schedule.professionalId === professionalId &&
                        schedule.day === day &&
                        schedule.hour === hour
                );


            if (
                scheduleAlreadyExists
            ) {

                await paymentOrderRef.update({

                    status:
                        "paid",

                    scheduleCreated:
                        true,

                    updatedAt:
                        Date.now()

                });

                return res
                    .status(200)
                    .send("OK");
            }


            /* =========================================
               CRIAR AGENDAMENTO
            ========================================= */

            const scheduleRef =
                db
                    .ref(
                        `companys/${companyHandle}/schedules`
                    )
                    .push();


            const scheduleId =
                scheduleRef.key;


            const agendamento = {

                id:
                    scheduleId,

                productId,

                productName,

                productPrice,

                professionalId,

                professionalName,

                day,

                dayLabel,

                hour,

                userName,

                clientId,

                userId:
                    userId || null,

                /* O recado que o cliente deixou no
                   agendamento; o painel mostra no pedido. */
                notes:
                    paymentOrder.notes || null,

                status:
                    "pending",

                paymentStatus:
                    "approved",

                paymentId:
                    mercadoPagoPaymentId,

                paymentOrderId:
                    paymentOrderKey,

                timestamp:
                    new Date().toISOString()

            };


            await scheduleRef.set(
                agendamento
            );


            /* =========================================
               ATUALIZAR HORÁRIOS DO PROFISSIONAL
            ========================================= */

            const professionalRef =
                db.ref(
                    `users/${professionalId}/scheduledTimes`
                );


            const professionalSnapshot =
                await professionalRef.once(
                    "value"
                );


            const scheduledTimes =
                professionalSnapshot.val() || {};


            const scheduledTimesArray =
                Array.isArray(
                    scheduledTimes
                )
                    ? scheduledTimes
                    : Object.values(
                        scheduledTimes
                    );


            scheduledTimesArray.push({

                day,

                hour,

                clientId,

                productId,

                scheduleId

            });


            await professionalRef.set(
                scheduledTimesArray
            );


            /* =========================================
               PAYMENT ORDER → PAGO
            ========================================= */

            await paymentOrderRef.update({

                status:
                    "paid",

                scheduleCreated:
                    true,

                scheduleId,

                paidAt:
                    Date.now(),

                updatedAt:
                    Date.now()

            });


            /* =========================================
               ATUALIZAR ORDERS DO PRODUTO
            ========================================= */

            const productRef =
                db
                    .ref(
                        `companys/${companyHandle}/products/${productId}/orders`
                    );


            const productOrdersSnapshot =
                await productRef.once(
                    "value"
                );


            const currentOrders =
                Number(
                    productOrdersSnapshot.val()
                ) || 0;


            await productRef.set(
                currentOrders + 1
            );


            /* =========================================
               FINALIZADO
            ========================================= */

            console.log(
                "✅ Pagamento aprovado e agendamento criado:",
                {
                    companyHandle,

                    mercadoPagoPaymentId,

                    paymentOrderKey,

                    scheduleId
                }
            );


            return res
                .status(200)
                .send("OK");

        } catch (error) {

            console.error(
                "❌ Erro mercadoPagoWebhook:",
                error
            );

            return res
                .status(200)
                .send("OK");
        }
    }
);

/* =====================================================
   PLANOS MARKFY — ASSINATURA DA EMPRESA

   O plano é da EMPRESA (licenses/{handle}). Ninguém além da
   conta master e deste backend grava esse nó: o navegador
   nunca decide que um pagamento aconteceu.

   Fluxo:
     1. createMarkfyPlanCheckout
        - confere o login (token do Firebase);
        - confere que quem pede é o ADMINISTRADOR PRINCIPAL
          (role "master") da empresa;
        - lê o preço em planCatalog (nunca do navegador);
        - cria o pedido em planOrders e a preferência de
          pagamento no Mercado Pago da MARKFY.
     2. markfyPlanWebhook
        - recebe o aviso do Mercado Pago, mas NÃO confia nele:
          busca o pagamento no Mercado Pago com o token da
          Markfy, confere status, valor e referência;
        - só então grava a licença (uma única vez por pedido).

   Cobrança por período (periodDays), sem renovação
   automática: para continuar, a empresa paga de novo e o
   período novo soma ao que ainda restava.
===================================================== */

const MARKFY_FUNCTIONS_URL =
    "https://us-central1-markfy-96942.cloudfunctions.net";

/* Produtos, pacotes e preço por produto vêm do motor
   compartilhado do Menus (mesma regra da tela de planos). */
const menus = require("./menus");
const { licenseProductFor, planPriceFor, publicAccessFor } = menus.menusLicensing;

exports.menusApi = menus.menusApi;

/* Agendamento pelo cliente final (ver bookings.js). */
exports.bookingsApi = require("./bookings").bookingsApi;

const planCors = (req, res) => {

    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");

    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return true;
    }

    return false;
};

exports.createMarkfyPlanCheckout = onRequest(
    {
        secrets: [
            mercadoPagoMarkfyAccessToken
        ]
    },

    async (req, res) => {

        try {

            if (planCors(req, res)) return;

            if (req.method !== "POST") {
                return res.status(405).json({ success: false, message: "Método não permitido." });
            }

            const authorization = req.headers.authorization || "";

            if (!authorization.startsWith("Bearer ")) {
                return res.status(401).json({ success: false, message: "Usuário não autenticado." });
            }

            let decoded;

            try {
                decoded = await admin.auth().verifyIdToken(authorization.replace("Bearer ", ""));
            } catch (tokenError) {
                return res.status(401).json({ success: false, message: "Sessão inválida. Entre de novo." });
            }

            const { handle, planId, product } = req.body || {};

            if (
                typeof handle !== "string" || !/^[a-z0-9._-]{1,60}$/i.test(handle) ||
                typeof planId !== "string" || !/^[a-z0-9_-]{1,40}$/i.test(planId)
            ) {
                return res.status(400).json({ success: false, message: "Dados inválidos." });
            }

            /* ---- só o administrador principal da empresa ---- */

            const memberSnapshot = await db.ref("companys/" + handle + "/members/" + decoded.uid).once("value");

            if (!memberSnapshot.exists() || memberSnapshot.val().role !== "master") {
                return res.status(403).json({
                    success: false,
                    message: "Só o administrador principal da empresa pode alterar o plano."
                });
            }

            /* ---- empresa suspensa pela Markfy não compra o acesso de volta ---- */

            const currentLicense = (await db.ref("licenses/" + handle).once("value")).val();

            if (currentLicense && currentLicense.status === "suspended") {
                return res.status(403).json({
                    success: false,
                    message: "O plano desta empresa foi suspenso. Fale com o suporte da Markfy."
                });
            }

            /* ---- plano e preço vêm do catálogo, não do navegador ---- */

            const planSnapshot = await db.ref("planCatalog/" + planId).once("value");
            const plan = planSnapshot.val();

            if (!plan || plan.active === false) {
                return res.status(404).json({ success: false, message: "Esse plano não está disponível." });
            }

            /* Plano em pacote libera os produtos dele; os demais
               liberam só o produto escolhido (com o preço daquele
               produto, que pode ser diferente do preço base). */
            const finalProduct = licenseProductFor(planId, plan, product);

            if (!finalProduct) {
                return res.status(400).json({ success: false, message: "Escolha Bookings, Studio ou Menus." });
            }

            const price = planPriceFor(plan, finalProduct);

            if (!Number.isFinite(price) || price < 1) {
                return res.status(400).json({
                    success: false,
                    message: "Esse plano ainda não tem um valor configurado. Fale com a Markfy."
                });
            }

            const periodDays = Math.max(1, Math.round(Number(plan.periodDays) || 30));

            const accessToken = mercadoPagoMarkfyAccessToken.value();

            if (!accessToken) {
                return res.status(500).json({ success: false, message: "Pagamento da Markfy não configurado." });
            }

            /* ---- pedido ---- */

            const orderRef = db.ref("planOrders").push();
            const orderId = orderRef.key;

            await orderRef.set({
                handle,
                planId,
                product: finalProduct,
                amount: price,
                periodDays,
                uid: decoded.uid,
                status: "pending",
                createdAt: admin.database.ServerValue.TIMESTAMP
            });

            const companyName = (await db.ref("companys/" + handle + "/name").once("value")).val() || handle;

            const returnBase = MARKFY_FRONTEND_URL + "/planos";

            const preference = await fetch("https://api.mercadopago.com/checkout/preferences", {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + accessToken,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    items: [{
                        id: planId,
                        title: "Markfy " + (plan.name || planId) + " - " + companyName,
                        description: "Plano " + (plan.name || planId) + " por " + periodDays + " dias",
                        quantity: 1,
                        currency_id: "BRL",
                        unit_price: price
                    }],
                    external_reference: "markfy-plan:" + orderId,
                    notification_url: MARKFY_FUNCTIONS_URL + "/markfyPlanWebhook",
                    back_urls: {
                        success: returnBase + "?checkout=success",
                        pending: returnBase + "?checkout=pending",
                        failure: returnBase + "?checkout=failure"
                    },
                    auto_return: "approved",
                    statement_descriptor: "MARKFY"
                })
            });

            const preferenceData = await preference.json();

            if (!preference.ok || !preferenceData || !preferenceData.init_point) {
                console.error("Erro ao criar preferência Markfy:", preferenceData);
                await orderRef.update({ status: "error" });
                return res.status(502).json({
                    success: false,
                    message: "Não foi possível iniciar o pagamento. Tente de novo."
                });
            }

            await orderRef.update({ preferenceId: preferenceData.id || null });

            return res.status(200).json({
                success: true,
                orderId,
                checkoutUrl: preferenceData.init_point
            });

        } catch (error) {

            console.error("Erro createMarkfyPlanCheckout:", error);

            return res.status(500).json({ success: false, message: "Erro interno." });
        }
    }
);


exports.markfyPlanWebhook = onRequest(
    {
        secrets: [
            mercadoPagoMarkfyAccessToken
        ]
    },

    async (req, res) => {

        /* O Mercado Pago só precisa de um 200; erros reais ficam no log. */
        try {

            const body = req.body || {};

            const paymentId =
                (body.data && body.data.id) ||
                req.query["data.id"] ||
                (req.query.topic === "payment" ? req.query.id : null);

            const type = body.type || req.query.type || req.query.topic;

            if (!paymentId || (type && type !== "payment")) {
                return res.status(200).send("OK");
            }

            if (!/^\d{3,20}$/.test(String(paymentId))) {
                return res.status(200).send("OK");
            }

            /* A verdade vem do Mercado Pago, consultado com o
               token da Markfy — um aviso forjado não passa daqui. */
            const paymentResponse = await fetch(
                "https://api.mercadopago.com/v1/payments/" + paymentId,
                { headers: { Authorization: "Bearer " + mercadoPagoMarkfyAccessToken.value() } }
            );

            if (!paymentResponse.ok) {
                return res.status(200).send("OK");
            }

            const payment = await paymentResponse.json();

            const reference = String(payment.external_reference || "");

            if (reference.indexOf("markfy-plan:") !== 0 || payment.status !== "approved") {
                return res.status(200).send("OK");
            }

            const orderId = reference.slice("markfy-plan:".length);

            if (!/^[A-Za-z0-9_-]{10,40}$/.test(orderId)) {
                return res.status(200).send("OK");
            }

            const orderRef = db.ref("planOrders/" + orderId);

            /* Transação: o mesmo pedido nunca ativa duas vezes,
               mesmo que o aviso chegue repetido. */
            const claim = await orderRef.transaction((order) => {

                /* Primeira chamada vem com null: devolver null faz o banco
                   buscar o valor real e chamar de novo. */
                if (order === null) return order;

                if (order.status !== "pending") return;

                if (
                    payment.currency_id !== "BRL" ||
                    Number(payment.transaction_amount) + 0.001 < Number(order.amount)
                ) {
                    return;
                }

                return Object.assign({}, order, {
                    status: "paid",
                    paymentId: String(paymentId),
                    paidAt: admin.database.ServerValue.TIMESTAMP
                });
            });

            if (!claim.committed || !claim.snapshot.exists()) {
                return res.status(200).send("OK");
            }

            const order = claim.snapshot.val();
            const periodMs = Number(order.periodDays) * 24 * 60 * 60 * 1000;

            await db.ref("licenses/" + order.handle).transaction((current) => {

                const now = Date.now();

                /* Suspensão da Markfy vence o pagamento: o pedido fica
                   pago no histórico, mas a licença não muda. */
                if (current && current.status === "suspended") return current;

                /* Renovando o MESMO plano e produto: soma ao que
                   ainda resta. Trocando, o período novo começa agora. */
                const sameOffer =
                    current &&
                    current.plan === order.planId &&
                    current.product === order.product &&
                    current.status === "active" &&
                    Number(current.expiresAt) > now;

                const base = sameOffer ? Number(current.expiresAt) : now;

                return {
                    plan: order.planId,
                    product: order.product,
                    status: "active",
                    expiresAt: base + periodMs,
                    source: "checkout",
                    orderId: orderId,
                    note: (current && current.note) || "",
                    updatedAt: admin.database.ServerValue.TIMESTAMP,
                    updatedBy: "markfy-checkout"
                };
            });

            const finalLicense = (await db.ref("licenses/" + order.handle).once("value")).val();

            if (finalLicense) {
                await db.ref("publicAccess/" + order.handle).set(publicAccessFor(finalLicense));
            }

            return res.status(200).send("OK");

        } catch (error) {

            console.error("Erro markfyPlanWebhook:", error);

            return res.status(200).send("OK");
        }
    }
);


/* =====================================================
   QR CODE — LOGIN EM OUTRO APARELHO E ENTRADA NA EQUIPE

   Nada daqui confia no navegador:

   LOGIN POR QR
     createQrLogin  quem já está logado gera um código de uso
                    único, válido por 90 segundos (qrLogins/).
     redeemQrLogin  o aparelho novo troca o código por um custom
                    token do Firebase. O código é consumido numa
                    transação: não vale duas vezes.

   ENTRADA NA EQUIPE
     createQrInvite    administrador gera um convite com a função
                       já definida (qrInvites/), válido por tempo
                       curto e de uso único.
     getQrInvite       dados públicos mínimos para a tela de
                       cadastro (empresa e função).
     joinCompanyByQr   a pessoa (já com conta criada) entra na
                       empresa. O backend confere convite, plano
                       ativo da empresa e limite de equipe e só
                       então grava o vínculo.
===================================================== */

const qrCors = (req, res) => {

    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");

    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return true;
    }

    if (req.method !== "POST") {
        res.status(405).json({ success: false, message: "Método não permitido." });
        return true;
    }

    return false;
};

const qrAuth = async (req, res) => {

    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) {
        res.status(401).json({ success: false, message: "Usuário não autenticado." });
        return null;
    }

    try {
        return await admin.auth().verifyIdToken(authorization.replace("Bearer ", ""));
    } catch (tokenError) {
        res.status(401).json({ success: false, message: "Sessão inválida. Entre de novo." });
        return null;
    }
};

const qrToken = () => crypto.randomBytes(32).toString("base64url");

/* Versão do código de QR. Muda o hash da função e força o deploy a
   trocar a revisão em produção (um deploy que falhou no build deixa o
   hash "novo" registrado e a CLI passa a pular a função). */
const QR_BACKEND_VERSION = "2026-10-19-transacao-null-v2";

const QR_LOGIN_TTL_MS = 90 * 1000;
const QR_INVITE_TTLS = [15 * 60 * 1000, 60 * 60 * 1000, 24 * 60 * 60 * 1000];
const QR_INVITE_ROLES = ["administrator", "professional"];

exports.createQrLogin = onRequest(async (req, res) => {

    try {

        if (qrCors(req, res)) return;

        const decoded = await qrAuth(req, res);
        if (!decoded) return;

        const code = qrToken();

        /* Um código por pessoa: gerar outro invalida o anterior. */
        const previous = (await db.ref("qrLoginByUser/" + decoded.uid).once("value")).val();

        if (previous) {
            await db.ref("qrLogins/" + previous).remove();
        }

        await db.ref("qrLogins/" + code).set({
            uid: decoded.uid,
            used: false,
            expiresAt: Date.now() + QR_LOGIN_TTL_MS
        });

        await db.ref("qrLoginByUser/" + decoded.uid).set(code);

        return res.status(200).json({
            success: true,
            code,
            expiresAt: Date.now() + QR_LOGIN_TTL_MS
        });

    } catch (error) {

        console.error("Erro createQrLogin:", error);

        return res.status(500).json({ success: false, message: "Erro interno." });
    }
});

exports.redeemQrLogin = onRequest(async (req, res) => {

    try {

        if (qrCors(req, res)) return;

        const code = (req.body || {}).code;

        console.log("redeemQrLogin", QR_BACKEND_VERSION, "codigo recebido:", typeof code === "string" ? code.length + " caracteres" : typeof code);

        if (typeof code !== "string" || !/^[A-Za-z0-9_-]{40,60}$/.test(code)) {
            return res.status(400).json({ success: false, message: "Código inválido." });
        }

        const claim = await db.ref("qrLogins/" + code).transaction((entry) => {

            /* O Realtime Database chama esta função primeiro com null (valor ainda
               não conferido com o servidor). Devolver null faz ele buscar o valor
               real e chamar de novo; abortar aqui recusaria um código válido. */
            if (entry === null) return entry;

            if (entry.used || Number(entry.expiresAt) < Date.now()) return;

            return Object.assign({}, entry, { used: true, usedAt: Date.now() });
        });

        if (!claim.committed || !claim.snapshot.exists()) {
            return res.status(410).json({
                success: false,
                message: "Este QR Code expirou ou já foi usado. Gere outro no aparelho conectado."
            });
        }

        const uid = claim.snapshot.val().uid;

        const record = await admin.auth().getUser(uid);

        if (record.disabled) {
            return res.status(403).json({ success: false, message: "Esta conta foi desativada." });
        }

        const customToken = await admin.auth().createCustomToken(uid);

        /* Código gasto não precisa ficar guardado. */
        await db.ref("qrLogins/" + code).remove();

        const byUser = (await db.ref("qrLoginByUser/" + uid).once("value")).val();

        if (byUser === code) {
            await db.ref("qrLoginByUser/" + uid).remove();
        }

        return res.status(200).json({ success: true, customToken });

    } catch (error) {

        console.error("Erro redeemQrLogin:", error);

        return res.status(500).json({ success: false, message: "Erro interno." });
    }
});

exports.createQrInvite = onRequest(async (req, res) => {

    try {

        if (qrCors(req, res)) return;

        const decoded = await qrAuth(req, res);
        if (!decoded) return;

        const { handle, role, ttlIndex } = req.body || {};

        if (typeof handle !== "string" || !/^[a-z0-9._-]{1,60}$/i.test(handle)) {
            return res.status(400).json({ success: false, message: "Empresa inválida." });
        }

        if (!QR_INVITE_ROLES.includes(role)) {
            return res.status(400).json({ success: false, message: "Escolha a função da pessoa." });
        }

        const ttl = QR_INVITE_TTLS[Number(ttlIndex)] || QR_INVITE_TTLS[0];

        const member = (await db.ref("companys/" + handle + "/members/" + decoded.uid).once("value")).val();

        if (!member || (member.role !== "master" && member.role !== "administrator")) {
            return res.status(403).json({
                success: false,
                message: "Só administradores podem convidar pessoas."
            });
        }

        const companyName = (await db.ref("companys/" + handle + "/name").once("value")).val() || handle;

        const inviteId = qrToken();
        const expiresAt = Date.now() + ttl;

        await db.ref("qrInvites/" + inviteId).set({
            handle,
            companyName,
            role,
            inviterUid: decoded.uid,
            status: "pending",
            createdAt: Date.now(),
            expiresAt
        });

        return res.status(200).json({ success: true, inviteId, expiresAt });

    } catch (error) {

        console.error("Erro createQrInvite:", error);

        return res.status(500).json({ success: false, message: "Erro interno." });
    }
});

exports.getQrInvite = onRequest(async (req, res) => {

    try {

        if (qrCors(req, res)) return;

        const inviteId = (req.body || {}).inviteId;

        if (typeof inviteId !== "string" || !/^[A-Za-z0-9_-]{40,60}$/.test(inviteId)) {
            return res.status(200).json({ success: true, valid: false });
        }

        const invite = (await db.ref("qrInvites/" + inviteId).once("value")).val();

        if (!invite || invite.status !== "pending" || Number(invite.expiresAt) < Date.now()) {
            return res.status(200).json({ success: true, valid: false });
        }

        return res.status(200).json({
            success: true,
            valid: true,
            companyName: invite.companyName,
            role: invite.role,
            expiresAt: invite.expiresAt
        });

    } catch (error) {

        console.error("Erro getQrInvite:", error);

        return res.status(500).json({ success: false, message: "Erro interno." });
    }
});

exports.joinCompanyByQr = onRequest(async (req, res) => {

    try {

        if (qrCors(req, res)) return;

        const decoded = await qrAuth(req, res);
        if (!decoded) return;

        const inviteId = (req.body || {}).inviteId;

        if (typeof inviteId !== "string" || !/^[A-Za-z0-9_-]{40,60}$/.test(inviteId)) {
            return res.status(400).json({ success: false, message: "Convite inválido." });
        }

        const invite = (await db.ref("qrInvites/" + inviteId).once("value")).val();

        if (!invite || invite.status !== "pending" || Number(invite.expiresAt) < Date.now()) {
            return res.status(410).json({ success: false, message: "Este convite expirou ou já foi usado." });
        }

        const handle = invite.handle;

        /* ---- a empresa precisa ter plano ativo, com vaga na equipe ---- */

        const license = (await db.ref("licenses/" + handle).once("value")).val();

        const active =
            license &&
            license.status === "active" &&
            (!license.expiresAt || Number(license.expiresAt) > Date.now());

        if (!active) {
            return res.status(403).json({
                success: false,
                message: "A empresa está sem plano ativo e não pode receber novos membros."
            });
        }

        const plan = (await db.ref("planCatalog/" + license.plan).once("value")).val() || {};
        const maxMembers = plan.limits && plan.limits.maxMembers;

        const members = (await db.ref("companys/" + handle + "/members").once("value")).val() || {};

        if (members[decoded.uid]) {
            await db.ref("qrInvites/" + inviteId).update({ status: "used", usedBy: decoded.uid, usedAt: Date.now() });
            return res.status(200).json({ success: true, already: true, handle });
        }

        if (typeof maxMembers === "number" && Object.keys(members).length >= maxMembers) {
            return res.status(403).json({
                success: false,
                message: "A equipe da empresa já atingiu o limite do plano. Peça ao administrador principal para mudar de plano."
            });
        }

        /* ---- consome o convite: uso único ---- */

        const claim = await db.ref("qrInvites/" + inviteId).transaction((entry) => {

            /* O Realtime Database chama esta função primeiro com null (valor ainda
               não conferido com o servidor). Devolver null faz ele buscar o valor
               real e chamar de novo; abortar aqui recusaria um código válido. */
            if (entry === null) return entry;

            if (entry.status !== "pending" || Number(entry.expiresAt) < Date.now()) return;

            return Object.assign({}, entry, { status: "used", usedBy: decoded.uid, usedAt: Date.now() });
        });

        if (!claim.committed || !claim.snapshot.exists()) {
            return res.status(410).json({ success: false, message: "Este convite expirou ou já foi usado." });
        }

        await db.ref("companys/" + handle + "/members/" + decoded.uid).set({
            role: invite.role,
            joinedAt: Date.now(),
            invitedBy: invite.inviterUid,
            via: "qr"
        });

        await db.ref("users/" + decoded.uid).update({
            companyHandle: handle,
            userType: "admin",
            initial: false
        });

        await db.ref("users/" + decoded.uid + "/companies/" + handle).set(true);

        return res.status(200).json({ success: true, handle });

    } catch (error) {

        console.error("Erro joinCompanyByQr:", error);

        return res.status(500).json({ success: false, message: "Erro interno." });
    }
});
