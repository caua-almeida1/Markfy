const { setGlobalOptions } = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");

const admin = require("firebase-admin");
const crypto = require("crypto");

admin.initializeApp();

const db = admin.database();

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

    console.log("🔎 Procurando empresa para UID:", uid);

    const snapshot =
        await db.ref("companys").once("value");

    const companies =
        snapshot.val() || {};

    for (const [handle, company] of Object.entries(companies)) {

        console.log("🏢 Empresa:", handle);

        if (!company?.members) {
            console.log("⚠️ Sem members:", handle);
            continue;
        }

        console.log(
            "👥 UIDs cadastrados:",
            Object.keys(company.members)
        );

        const member =
            company.members[uid];

        if (!member) {
            continue;
        }

        console.log(
            "✅ EMPRESA ENCONTRADA:",
            handle
        );

        console.log(
            "👤 MEMBER:",
            member
        );

        return {
            handle,
            company,
            member
        };
    }

    console.log(
        "❌ NENHUMA EMPRESA ENCONTRADA PARA UID:",
        uid
    );

    return null;
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


            /* =========================================
               CONVERTER PREÇO
            ========================================= */

            function parseMoney(value) {

                if (typeof value === "number") {
                    return value;
                }

                if (typeof value !== "string") {
                    return null;
                }

                let normalized =
                    value
                        .trim()
                        .replace(/[^\d,.-]/g, "");

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

                const amount =
                    Number(normalized);

                return Number.isFinite(amount)
                    ? amount
                    : null;
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
                    );


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

                const isCredentialError =
                    mercadoPagoResponse.status === 401 ||
                    /credential/i.test(mercadoPagoMessage);

                return res.status(
                    isCredentialError ? 502 : 400
                ).json({

                    success: false,

                    code:
                        isCredentialError
                            ? "MERCADO_PAGO_AUTH_ERROR"
                            : "MERCADO_PAGO_REJECTED",

                    message:
                        isCredentialError
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

            const type =
                req.body?.type ||
                req.query?.type;

            const dataId =
                req.body?.data?.id ||
                req.query?.["data.id"];


            /*
             * Só processamos notificações
             * relacionadas a pagamentos.
             */

            if (
                type !== "payment" ||
                !dataId
            ) {

                return res
                    .status(200)
                    .send("OK");
            }


            const mercadoPagoPaymentId =
                String(dataId);


            /* =========================================
               BUSCAR PAYMENT ORDER
            ========================================= */

            const companiesSnapshot =
                await db
                    .ref("companys")
                    .once("value");

            const companies =
                companiesSnapshot.val() || {};

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
                    "Erro ao consultar pagamento Mercado Pago:",
                    paymentData
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
                    "PaymentOrder sem dados suficientes:",
                    freshPaymentOrder
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