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


                /* Só o status: a resposta traz o e-mail do cliente. */
                console.log(
                    "👤 Mercado Pago Customer:",
                    customerResponse.status
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


            /* Só o status: a resposta traz dados do cartão e do titular. */
            console.log(
                "💳 Mercado Pago Card:",
                cardResponse.status
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
 * Só para as rotas antigas, que não dizem a empresa (telas
 * publicadas antes da paymentsApi). As novas recebem o handle
 * e conferem o papel nele — com duas empresas, "a primeira"
 * podia ser a errada.
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


/* =====================================================
   PAGAMENTOS — MONTAGEM

   payments/providers.js         contrato e registro dos
                                 gateways (hoje: Mercado Pago)
   payments/mercadopago.js       o provedor Mercado Pago
   payments/connections.js       tokens da empresa (OAuth),
                                 renovação e "Testar conexão"
   payments/advance-payments.js  pagamento antecipado
   payments/payments-api.js      paymentsApi + OAuth
   subscriptions.js              mensalidade

   Os tokens da empresa nunca saem do backend nem vão para
   log: antes, a renovação registrava a resposta inteira do
   Mercado Pago — access e refresh token — no Cloud Logging.
===================================================== */

/* Assinatura secreta dos webhooks (Suas integrações →
   Webhooks → "Assinatura secreta"). */
const mercadoPagoWebhookSecret =
    defineSecret("MERCADOPAGO_WEBHOOK_SECRET");

const MERCADO_PAGO_WEBHOOK_URL =
    "https://us-central1-markfy-96942.cloudfunctions.net/mercadoPagoWebhook";

/* Origens que podem receber o retorno do OAuth. */
const ALLOWED_ORIGINS = [
    "https://markfy.vercel.app",
    "http://localhost:3000"
];

const bookings = require("./bookings");

const paymentProvider =
    require("./payments/providers").getProvider("mercadopago");

const appCredentials = () => ({
    clientId: mercadoPagoClientId.value(),
    clientSecret: mercadoPagoClientSecret.value()
});

const connections = require("./payments/connections")({
    db: () => admin.database(),
    provider: paymentProvider,
    credentials: appCredentials
});

/* Definido logo abaixo; o pagamento antecipado usa para
   atualizar a mensalidade quando o aviso chega como "payment". */
let subscriptions = null;

const advancePayments = require("./payments/advance-payments")({
    admin,
    connections,
    provider: paymentProvider,
    notificationUrl: MERCADO_PAGO_WEBHOOK_URL,
    onUnmatchedPayment: (handle, payment) =>
        payment.recurring && payment.externalReference
            ? subscriptions.syncByReference(handle, payment.externalReference)
            : null
});

const payments = require("./payments/payments-api")({
    admin,
    secrets: [mercadoPagoClientId, mercadoPagoClientSecret],
    connections,
    provider: paymentProvider,
    credentials: appCredentials,
    advance: advancePayments,
    redirectUri: MERCADO_PAGO_REDIRECT_URI,
    frontendUrl: MARKFY_FRONTEND_URL,
    allowedOrigins: ALLOWED_ORIGINS
});

subscriptions = require("./subscriptions")({
    admin,
    secrets: [mercadoPagoClientId, mercadoPagoClientSecret],
    connections,
    provider: paymentProvider,
    loadCompaniesChildren,
    /* Junto da sincronização das 06:00: renovar tokens que
       vencem em 30 dias, conferir pagamentos antecipados em
       aberto e limpar tentativas de OAuth abandonadas. */
    dailyTasks: [
        { name: "tokens", run: () => connections.refreshExpiring() },
        { name: "advancePayments", run: () => advancePayments.syncPending() },
        { name: "oauthStates", run: () => payments.cleanupStates() }
    ]
});

/*
 *   paymentsApi             connect | verify | disconnect | orderStatus
 *   subscriptionsApi        create | sync | cancel | pause | resume
 *   subscriptionsDailySync  todo dia às 06:00 (Brasília)
 *
 * O nó companys/{handle}/subscriptions/{uid}_{productId} é o
 * espelho local: o gateway é a fonte da verdade da cobrança,
 * e o nó é o que as telas leem.
 */
exports.paymentsApi = payments.paymentsApi;
exports.subscriptionsApi = subscriptions.subscriptionsApi;
exports.subscriptionsDailySync = subscriptions.subscriptionsDailySync;

const legacyCors = (req, res, methods) => {

    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.set("Access-Control-Allow-Methods", `${methods}, OPTIONS`);

    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return true;
    }

    return false;
};


/* =====================================================
   OAUTH — INICIAR

   A tela de Pagamentos usa paymentsApi.connect; esta rota
   fica para a tela antiga (Formas de Pagamento → Cartões)
   até o frontend novo ser publicado. Aceita ?handle= e só
   sem ele cai na "primeira empresa" do usuário.
===================================================== */

exports.mercadoPagoOAuthStart = onRequest(
    {
        secrets: [
            mercadoPagoClientId
        ]
    },

    async (req, res) => {

        try {

            if (legacyCors(req, res, "GET")) return;

            const user = await payments.resolveUser(req);

            const requested =
                typeof req.query.handle === "string"
                    ? req.query.handle.trim()
                    : "";

            const handle =
                requested ||
                (await findUserCompany(user.uid))?.handle;

            if (!handle) {
                return res.status(403).json({
                    success: false,
                    message: "Usuário não pertence a nenhuma empresa."
                });
            }

            await payments.requireManager(handle, user.uid);

            const allowedReturnUrls =
                ALLOWED_ORIGINS.map((origin) => `${origin}/central-adm`);

            const returnUrl =
                allowedReturnUrls.includes(req.query.returnUrl)
                    ? req.query.returnUrl
                    : `${MARKFY_FRONTEND_URL}/central-adm`;

            const authorizationUrl =
                await payments.startAuthorization({
                    handle,
                    uid: user.uid,
                    returnUrl
                });

            return res.status(200).json({
                success: true,
                authorizationUrl
            });

        } catch (error) {

            return payments.sendError(res, error, "mercadoPagoOAuthStart");
        }
    }
);


/* =====================================================
   OAUTH — CALLBACK

   É o redirect_uri registrado na aplicação do Mercado Pago:
   a URL não pode mudar. Troca o code por tokens (com o
   client_secret, só aqui), descobre qual conta conectou e
   volta para a tela de Pagamentos.
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

            const outcome =
                await payments.completeAuthorization(req.query);

            if (outcome.redirect) {
                return res.redirect(outcome.redirect);
            }

            return res
                .status(outcome.status || 400)
                .send(outcome.html);

        } catch (error) {

            console.error(
                "Erro no callback OAuth:",
                error && error.message
            );

            return res
                .status(500)
                .send(
                    "<!DOCTYPE html><html lang=\"pt-BR\"><meta charset=\"UTF-8\"><title>Markfy</title>" +
                    "<h1>Erro interno</h1><p>Não foi possível concluir a conexão com o Mercado Pago. " +
                    `<a href="${MARKFY_FRONTEND_URL}/central-adm?tab=perfil&amp;screen=payment">Voltar</a></p></html>`
                );
        }
    }
);


/* =====================================================
   MERCADO PAGO — PAGAMENTO ANTECIPADO

   Mesmo contrato de antes (o checkout não muda), com a regra
   nova em payments/advance-payments.js: valor calculado no
   servidor com a promoção e os extras que a tela mostra,
   horário conferido antes de cobrar e agendamento criado
   na hora quando o cartão é aprovado.
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

            if (legacyCors(req, res, "POST")) return;

            if (req.method !== "POST") {
                return res.status(405).json({
                    success: false,
                    message: "Método não permitido."
                });
            }

            if (!(await bookings.throttle(req, "paymentCreate"))) {
                return res.status(429).json({
                    success: false,
                    message: "Muitas tentativas seguidas. Aguarde um minuto."
                });
            }

            const user = await payments.resolveUser(req);

            const result =
                await advancePayments.create(req.body, user);

            return res.status(200).json({
                success: true,
                ...result
            });

        } catch (error) {

            return payments.sendError(res, error, "createMercadoPagoPayment");
        }
    }
);


/* =====================================================
   MERCADO PAGO — VERIFICAR ASSINATURAS (tela antiga)

   Antes criava uma assinatura "pending" de R$ 10 na conta do
   vendedor e cancelava. Uma assinatura pendente não valida
   cartão nenhum — a resposta era sempre "pronta", mesmo com
   toda assinatura real falhando na validação do cartão. E o
   "modo teste" vinha do prefixo TEST- da chave, que contas
   de teste conectadas por OAuth não têm.

   Agora é a mesma verificação só de leitura do "Testar
   conexão" (connections.verify), no formato antigo.
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

            if (legacyCors(req, res, "POST")) return;

            if (req.method !== "POST") {
                return res.status(405).json({
                    success: false,
                    message: "Método não permitido."
                });
            }

            const user = await payments.resolveUser(req);

            const userCompany =
                await findUserCompany(user.uid);

            if (!userCompany) {
                return res.status(403).json({
                    success: false,
                    message: "Usuário não pertence a nenhuma empresa."
                });
            }

            if (!(await connections.load(userCompany.handle))) {
                return res.status(400).json({
                    success: false,
                    code: "NOT_CONNECTED",
                    message:
                        "Conecte a conta do Mercado Pago antes de verificar."
                });
            }

            const check =
                await connections.verify(userCompany.handle);

            return res.status(200).json({
                success: true,
                ready: check.ok,
                mode: check.environment === "test" ? "test" : "production",
                details: check.problem || null
            });

        } catch (error) {

            return payments.sendError(res, error, "checkMercadoPagoSubscriptions");
        }
    }
);


/* =====================================================
   MERCADO PAGO — PUBLIC KEY
===================================================== */

exports.getMercadoPagoPublicKey = onRequest(
    async (req, res) => {

        try {

            if (legacyCors(req, res, "GET")) return;

            if (req.method !== "GET") {
                return res.status(405).json({
                    success: false,
                    message: "Método não permitido."
                });
            }

            const user = await payments.resolveUser(req);

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
                    await findUserCompany(user.uid);

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

            const connection =
                await connections.load(companyHandle);

            if (
                !connections.isUsable(connection) ||
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

            return payments.sendError(res, error, "getMercadoPagoPublicKey");
        }
    }
);


/* =====================================================
   MERCADO PAGO — WEBHOOK

   Uma URL para tudo (configurar em Suas integrações →
   Webhooks: Pagamentos, Planos e assinaturas e, se quiser,
   Vinculação de aplicações):

     payment                          pagamento antecipado
     subscription_preapproval         estado da mensalidade
     subscription_authorized_payment  cobrança da mensalidade
     mp-connect                       vendedor desvinculou a conta

   1. Assinatura (x-signature) conferida com a assinatura
      secreta. Assinada e inválida → 401. Sem assinatura
      (IPN antigo) segue, porque o passo 2 não confia nela.
   2. A notificação só diz "olhe de novo": o estado é lido do
      Mercado Pago com o token da empresa e aplicado de forma
      idempotente — aviso repetido não agenda nem cobra duas
      vezes.
   3. Falha passageira → 500, e o Mercado Pago reenvia (a
      cada 15 min). Antes era sempre 200: o aviso se perdia.
===================================================== */

const handleAccountNotification = async ({ sellerId }) => {

    /* O aviso não prova nada: confere se o token ainda vale
       (withSeller renova ou marca "reconectar"). */
    for (const handle of await connections.handlesForSeller(sellerId)) {
        await connections
            .withSeller(handle, (token) => paymentProvider.getAccount(token))
            .catch(() => null);
    }
};

exports.mercadoPagoWebhook = onRequest(
    {
        /* A sincronização pode precisar renovar o token da
           empresa. */
        secrets: [
            mercadoPagoClientId,
            mercadoPagoClientSecret,
            mercadoPagoWebhookSecret
        ]
    },
    async (req, res) => {

        if (
            req.method !== "POST" &&
            req.method !== "GET"
        ) {
            return res.status(405).send(
                "Method Not Allowed"
            );
        }

        const notification =
            paymentProvider.parseNotification({
                body: req.body,
                query: req.query
            });

        if (!notification.id) {
            return res.status(200).send("OK");
        }

        const signature =
            paymentProvider.verifyWebhookSignature({
                headers: req.headers,
                dataId: notification.signedId,
                secret: mercadoPagoWebhookSecret.value()
            });

        if (signature.signed && !signature.valid) {

            console.warn(
                "mercadoPagoWebhook: assinatura inválida",
                notification.type,
                signature.reason
            );

            return res.status(401).send("Invalid signature");
        }

        try {

            if (notification.topic === "payment") {

                await advancePayments.handleNotification(notification);

            } else if (
                notification.topic === "subscription" ||
                notification.topic === "subscription_charge"
            ) {

                await subscriptions.handleNotification(notification);

            } else if (notification.topic === "account") {

                await handleAccountNotification(notification);
            }

            return res.status(200).send("OK");

        } catch (error) {

            console.error(
                "❌ Erro mercadoPagoWebhook:",
                notification.topic,
                error && error.message
            );

            return res.status(500).send("Retry");
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
