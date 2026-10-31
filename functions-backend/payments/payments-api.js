/* =====================================================
   PAGAMENTOS — API DO PAINEL E OAUTH

   paymentsApi recebe { action, ... } (mesmo contrato da
   bookingsApi):

     connect      devolve o link de autorização do Mercado
                  Pago (OAuth, Authorization Code + state)
     verify       "Testar conexão": conta conectada, acesso a
                  pagamentos e assinaturas, ambiente
     disconnect   apaga os tokens da empresa
     orderStatus  tela de espera do pagamento antecipado:
                  confere o pagamento no gateway

   E as duas pontas do OAuth, usadas por index.js:

     startAuthorization     cria o state e o link
     completeAuthorization  o retorno do Mercado Pago
                            (mercadoPagoOAuthCallback)

   QUEM PODE

   A empresa vem no pedido e é conferida aqui: membro com
   papel de administrador DESSA empresa. Antes o backend
   escolhia "a primeira empresa do usuário" — quem participa
   de duas conectava a conta na empresa errada. E aceitava
   "administrador", mas o app grava "administrator": quem
   entrou por convite como administrador não conseguia
   conectar.
===================================================== */

const crypto = require("crypto");
const { onRequest } = require("firebase-functions/v2/https");

const bookings = require("../bookings");
const { ConnectionError } = require("./connections");
const { PaymentError } = require("./advance-payments");

const core = bookings.bookingsCore;

const MANAGER_ROLES = ["master", "administrator", "administrador"];

/* O state do OAuth vale 10 minutos — o mesmo prazo do code. */
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

const OPEN_SUBSCRIPTION = ["pending", "authorized", "past_due", "paused"];

class ApiError extends Error {
    constructor(status, message, code, extra) {
        super(message);
        this.status = status;
        this.code = code || null;
        this.extra = extra || null;
    }
}

const fail = (status, message, code, extra) => {
    throw new ApiError(status, message, code, extra);
};

const canManagePayments = (role) => MANAGER_ROLES.includes(role);


module.exports = ({ admin, secrets, connections, provider, credentials, advance, redirectUri, frontendUrl, allowedOrigins }) => {

    const db = () => admin.database();

    const read = async (path) => (await db().ref(path).once("value")).val();

    const stateRef = (state) => db().ref(`mercadoPagoOAuthStates/${state}`);

    const requireManager = async (handle, uid) => {

        if (!core.isHandle(handle)) fail(400, "Empresa inválida.", "invalid");

        const role = await read(`companys/${handle}/members/${uid}/role`);

        /* Mesma resposta para "não existe" e "não é sua". */
        if (!role) fail(404, "Empresa não encontrada.", "not_found");

        if (!canManagePayments(role)) {
            fail(403, "Só o administrador da empresa pode mexer nos pagamentos.", "forbidden");
        }

        return role;
    };

    const returnUrlFor = (origin) =>
        `${allowedOrigins.includes(origin) ? origin : frontendUrl}/central-adm`;


    /* =================================================
       OAUTH
    ================================================= */

    const startAuthorization = async ({ handle, uid, returnUrl }) => {

        const { clientId } = credentials();

        if (!clientId) throw new ConnectionError("credentials_missing");

        const state = crypto.randomBytes(32).toString("hex");

        await stateRef(state).set({ uid, companyHandle: handle, returnUrl, createdAt: Date.now() });

        return provider.authorizationUrl({ clientId, redirectUri, state });
    };

    const page = (title, message) => `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Markfy</title></head>
<body style="font-family:system-ui,sans-serif;max-width:520px;margin:48px auto;padding:0 16px;color:#1d1d1f">
<h1 style="font-size:22px">${title}</h1>
<p>${message}</p>
<p><a href="${frontendUrl}/central-adm?tab=perfil&amp;screen=payment">Voltar para Pagamentos</a></p>
</body>
</html>`;

    /**
     * Retorno do Mercado Pago. Devolve { redirect } ou
     * { status, html }. Erros conhecidos voltam para a tela
     * de Pagamentos com ?mercadoPago=error&reason=..., que
     * explica o que fazer.
     */
    const completeAuthorization = async (query) => {

        const { code, state, error } = query || {};

        if (typeof state !== "string" || !/^[a-f0-9]{64}$/.test(state)) {
            return { status: 400, html: page("Conexão inválida", "O Mercado Pago não devolveu os dados da conexão. Volte ao Markfy e toque em Conectar de novo.") };
        }

        const stateData = (await stateRef(state).once("value")).val();

        if (!stateData) {
            return { status: 400, html: page("Conexão expirada", "Esta conexão já foi usada ou expirou. Volte ao Markfy e toque em Conectar de novo.") };
        }

        /* Uso único. */
        await stateRef(state).remove();

        const back = (status, reasonCode) =>
            `${stateData.returnUrl}?mercadoPago=${status}${reasonCode ? `&reason=${reasonCode}` : ""}`;

        if (Date.now() - Number(stateData.createdAt) > STATE_MAX_AGE_MS) return { redirect: back("error", "expired") };

        if (error) return { redirect: back("error", error === "access_denied" ? "denied" : "refused") };

        if (typeof code !== "string" || !code) return { redirect: back("error", "missing_code") };

        const handle = stateData.companyHandle;

        /* Ainda é administrador dessa empresa? */
        const role = await read(`companys/${handle}/members/${stateData.uid}/role`);

        if (!canManagePayments(role)) return { redirect: back("error", "forbidden") };

        const { clientId, clientSecret } = credentials();

        const exchanged = await provider.exchangeCode({ clientId, clientSecret, code, redirectUri });

        if (!exchanged.ok) {
            console.error("payments: troca do code recusada", handle, exchanged.status, exchanged.code);
            return { redirect: back("error", exchanged.network ? "network" : "exchange_failed") };
        }

        if (!exchanged.tokens.refreshToken || exchanged.tokens.userId === null) {
            console.error("payments: OAuth sem refresh token ou sem conta", handle);
            return { redirect: back("error", "incomplete") };
        }

        const account = await provider.getAccount(exchanged.tokens.accessToken);

        await connections.save(handle, {
            tokens: exchanged.tokens,
            account: account.ok ? account.account : null,
            uid: stateData.uid
        });

        return { redirect: back("connected") };
    };

    /** Tentativas que ninguém concluiu (chamado pela rotina diária). */
    const cleanupStates = async (now = Date.now()) => {

        const all = (await db().ref("mercadoPagoOAuthStates").once("value")).val() || {};
        const stale = Object.keys(all).filter((key) => now - Number((all[key] || {}).createdAt || 0) > STATE_MAX_AGE_MS);

        await Promise.all(stale.map((key) => stateRef(key).remove()));

        return stale.length;
    };


    /* =================================================
       AÇÕES
    ================================================= */

    const connect = async (body, user) => {

        await requireManager(body.handle, user.uid);

        const authorizationUrl = await startAuthorization({
            handle: body.handle,
            uid: user.uid,
            returnUrl: returnUrlFor(body.origin)
        });

        return { authorizationUrl };
    };

    const verify = async (body, user) => {

        await requireManager(body.handle, user.uid);

        if (!(await connections.load(body.handle))) {
            fail(400, "Conecte a conta do Mercado Pago antes de testar.", "not_connected");
        }

        return connections.verify(body.handle);
    };

    const openSubscriptions = async (handle) => {

        const all = (await read(`companys/${handle}/subscriptions`)) || {};

        return Object.values(all).filter((item) => item && OPEN_SUBSCRIPTION.includes(item.status)).length;
    };

    const disconnect = async (body, user) => {

        await requireManager(body.handle, user.uid);

        const open = await openSubscriptions(body.handle);

        if (open > 0 && body.confirm !== true) {
            fail(
                409,
                `Há ${open} ${open === 1 ? "assinatura aberta" : "assinaturas abertas"} nesta conta. ` +
                "O Mercado Pago continua cobrando, mas a Markfy deixa de acompanhar e de conseguir cancelar até você reconectar a mesma conta.",
                "has_open_subscriptions",
                { openSubscriptions: open }
            );
        }

        await connections.disconnect(body.handle, user.uid);

        return { disconnected: true, openSubscriptions: open };
    };

    const orderStatus = async (body, user) =>
        advance.sync(body.handle, body.orderId, user.uid);

    const ACTIONS = {
        connect: { run: connect, limit: "paymentsConnect" },
        verify: { run: verify, limit: "paymentsVerify" },
        disconnect: { run: disconnect, limit: "paymentsDisconnect" },
        orderStatus: { run: orderStatus, limit: "paymentStatus" }
    };

    const resolveUser = async (req) => {

        const authorization = req.headers.authorization || "";

        if (!authorization.startsWith("Bearer ")) fail(401, "Entre na sua conta para continuar.", "login_required");

        try {
            return await admin.auth().verifyIdToken(authorization.replace("Bearer ", ""));
        } catch {
            fail(401, "Sessão inválida. Entre de novo.", "login_required");
        }

        return null;
    };

    /** Erro conhecido → resposta; o resto vira 500 sem detalhe. */
    const sendError = (res, error, label) => {

        if (error instanceof ApiError || error instanceof PaymentError || error instanceof bookings.BookingError) {
            return res.status(error.status).json({
                success: false,
                code: error.code,
                message: error.message,
                ...(error.extra || {})
            });
        }

        if (error instanceof ConnectionError) {
            const reconnect = error.code === "reconnect_required" || error.code === "not_connected";
            return res.status(reconnect ? 409 : 502).json({
                success: false,
                code: error.code,
                ownerAction: true,
                message: reconnect
                    ? "A conta Mercado Pago desta empresa precisa ser conectada novamente."
                    : "Não foi possível falar com o Mercado Pago agora. Tente de novo."
            });
        }

        /* Só a mensagem: o corpo tem e-mail e nome. */
        console.error(`Erro ${label}:`, error && error.message);

        return res.status(500).json({ success: false, message: "Erro interno. Tente de novo." });
    };

    const paymentsApi = onRequest({ secrets, maxInstances: 10 }, async (req, res) => {

        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");

        if (req.method === "OPTIONS") return res.status(204).send("");

        if (req.method !== "POST") {
            return res.status(405).json({ success: false, message: "Método não permitido." });
        }

        try {

            const body = req.body && typeof req.body === "object" ? req.body : {};
            const action = ACTIONS[body.action];

            if (!action) return res.status(400).json({ success: false, message: "Ação inválida." });

            if (!(await bookings.throttle(req, action.limit))) {
                return res.status(429).json({ success: false, message: "Muitas tentativas seguidas. Aguarde um minuto." });
            }

            const user = await resolveUser(req);

            return res.status(200).json({ success: true, result: await action.run(body, user) });

        } catch (error) {
            return sendError(res, error, "paymentsApi");
        }
    });

    return {
        paymentsApi,
        startAuthorization,
        completeAuthorization,
        cleanupStates,
        requireManager,
        sendError,
        resolveUser
    };
};

module.exports.canManagePayments = canManagePayments;
module.exports.MANAGER_ROLES = MANAGER_ROLES;
module.exports.ApiError = ApiError;
