/* =====================================================
   MERCADO PAGO — PROVEDOR DE PAGAMENTO

   Tudo o que é específico do Mercado Pago mora aqui:
   endereços, formato dos pedidos e das respostas, OAuth e a
   assinatura dos webhooks. O resto do backend (mensalidade,
   pagamento antecipado, conexão da empresa) fala com estas
   funções e recebe objetos no formato da Markfy — é isso que
   permite somar outro gateway sem mexer nas regras de
   negócio (contrato em providers.js).

   Nada aqui toca o banco nem registra log: as chamadas
   devolvem { ok, status, data } e quem chama decide o que
   guardar. Resposta do Mercado Pago pode trazer e-mail e
   documento do pagador — não vai para o Cloud Logging.

   Referências (lidas em 31/10/2026):
     assinaturas sem plano   /developers/pt/docs/subscriptions/
                             integration-configuration/
                             subscription-no-associated-plan
     OAuth                   /developers/pt/docs/security/oauth
     webhooks                /developers/pt/docs/your-integrations/
                             notifications/webhooks
===================================================== */

const { WebhookSignatureValidator, InvalidWebhookSignatureError } = require("mercadopago");

const id = "mercadopago";

const API_URL = "https://api.mercadopago.com";
const AUTHORIZATION_URL = "https://auth.mercadopago.com/authorization";

/* Sem resposta em 15 s é falha de rede, não recusa: a função
   não pode ficar presa esperando até estourar o timeout. */
const TIMEOUT_MS = 15000;

const enc = encodeURIComponent;


/* -----------------------------------------------------
   CHAMADA À API
----------------------------------------------------- */

/**
 * Nunca lança por erro HTTP. Sem resposta nenhuma (rede, DNS,
 * tempo esgotado) devolve { ok: false, status: 0, network: true }
 * — quem chama trata como falha temporária, nunca como "o
 * Mercado Pago recusou".
 */
const request = async (token, path, { method = "GET", body, idempotencyKey, timeoutMs = TIMEOUT_MS } = {}) => {

    const headers = {};

    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (idempotencyKey) headers["X-Idempotency-Key"] = idempotencyKey;

    let response;

    try {
        response = await fetch(`${API_URL}${path}`, {
            method,
            headers,
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(timeoutMs)
        });
    } catch {
        return { ok: false, status: 0, network: true, data: {} };
    }

    const data = await response.json().catch(() => ({}));

    return { ok: response.ok, status: response.status, data: data || {} };
};

/** As causas que o Mercado Pago devolve, num texto só (diagnóstico). */
const reason = (data) =>
    (Array.isArray(data && data.cause)
        ? data.cause.map((item) => item && (item.description || item.code)).filter(Boolean).join("; ")
        : "") ||
    (data && (data.message || data.error_description || data.error)) ||
    "";

/** Token vencido ou revogado: vale renovar e tentar de novo. */
const credentialRefused = (result) =>
    Boolean(result) && (
        result.status === 401 ||
        /invalid.*(token|credential)|credential/i.test(reason(result.data))
    );


/* -----------------------------------------------------
   OAUTH (Authorization Code)

   A empresa autoriza a Markfy no site do Mercado Pago e
   volta com um `code` de uso único, válido por 10 minutos.
   O backend troca o code por tokens com o client_secret —
   que nunca sai do servidor.
----------------------------------------------------- */

const authorizationUrl = ({ clientId, redirectUri, state }) => {

    const url = new URL(AUTHORIZATION_URL);

    url.searchParams.set("client_id", clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("platform_id", "mp");
    url.searchParams.set("state", state);
    url.searchParams.set("redirect_uri", redirectUri);

    /* As permissões valem as configuradas na aplicação; o
       parâmetro fica porque as conexões atuais (com refresh
       token) nasceram com ele. */
    url.searchParams.set("scope", "offline_access write read");

    return url.toString();
};

const toTokens = (data, now) => {

    const expiresIn = Number(data.expires_in) || 0;

    return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || null,
        publicKey: data.public_key || null,
        userId: data.user_id !== undefined && data.user_id !== null ? data.user_id : null,
        scope: data.scope || null,
        liveMode: data.live_mode === true,
        expiresIn,
        expiresAt: now + expiresIn * 1000
    };
};

const oauthError = (result) => ({
    ok: false,
    status: result.status,
    network: Boolean(result.network),
    code: (result.data && result.data.error) || null,
    /* invalid_grant: code ou refresh token inválido, vencido
       ou revogado pelo vendedor. Insistir não adianta. */
    revoked: (result.data && result.data.error) === "invalid_grant"
});

const exchangeCode = async ({ clientId, clientSecret, code, redirectUri, now = Date.now() }) => {

    const result = await request(null, "/oauth/token", {
        method: "POST",
        body: {
            client_id: clientId,
            client_secret: clientSecret,
            code,
            grant_type: "authorization_code",
            redirect_uri: redirectUri
        }
    });

    if (!result.ok || !result.data.access_token) return oauthError(result);

    return { ok: true, tokens: toTokens(result.data, now) };
};

/** Cada renovação devolve um refresh token NOVO, que precisa ser guardado. */
const refreshTokens = async ({ clientId, clientSecret, refreshToken, now = Date.now() }) => {

    const result = await request(null, "/oauth/token", {
        method: "POST",
        body: {
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "refresh_token",
            refresh_token: refreshToken
        }
    });

    if (!result.ok || !result.data.access_token) return oauthError(result);

    return { ok: true, tokens: toTokens(result.data, now) };
};


/* -----------------------------------------------------
   CONTA CONECTADA

   GET /users/me (o mesmo endpoint do SDK oficial). Serve
   para mostrar à empresa QUAL conta está conectada e para
   saber se é conta de teste: contas de teste têm a tag
   "test_user" e usam credenciais APP_USR- como as reais —
   pelo prefixo da chave não dá para saber.

   O e-mail da conta não é guardado (minimização).
----------------------------------------------------- */

const getAccount = async (token) => {

    const result = await request(token, "/users/me");

    if (!result.ok || !result.data || result.data.id === undefined) {
        return { ok: false, status: result.status, network: Boolean(result.network) };
    }

    const tags = Array.isArray(result.data.tags) ? result.data.tags : [];

    return {
        ok: true,
        account: {
            id: String(result.data.id),
            nickname: typeof result.data.nickname === "string" ? result.data.nickname.slice(0, 80) : null,
            siteId: result.data.site_id || null,
            environment: tags.includes("test_user") ? "test" : "production"
        }
    };
};


/* -----------------------------------------------------
   ASSINATURAS (preapproval sem plano)

   status "authorized" + card_token_id
       o Mercado Pago valida o cartão com uma cobrança de
       valor mínimo (devolvida em seguida) e a primeira
       parcela cai em até ~1 hora. Se a validação falhar, a
       resposta é 400 CC_VAL_433.

   status "pending"
       sem meio de pagamento: a resposta traz init_point, a
       página do Mercado Pago onde a pessoa autoriza.

   Teste grátis: assinatura sem plano NÃO aceita free_trial
   (só planos aceitam — ver o tipo PreApprovalRequest do SDK
   oficial). O jeito documentado de adiar a primeira cobrança
   é auto_recurring.start_date.
----------------------------------------------------- */

const SUBSCRIPTION_STATUSES = ["pending", "authorized", "paused", "cancelled"];

const buildSubscription = ({ reason: title, externalReference, payerEmail, amount, frequencyMonths, startAt, endAt, backUrl, cardTokenId }) => {

    const recurring = {
        frequency: frequencyMonths,
        frequency_type: "months",
        transaction_amount: amount,
        currency_id: "BRL"
    };

    if (startAt) recurring.start_date = new Date(startAt).toISOString();
    if (endAt) recurring.end_date = new Date(endAt).toISOString();

    const body = {
        reason: title,
        external_reference: externalReference,
        payer_email: payerEmail,
        auto_recurring: recurring,
        back_url: backUrl,
        status: cardTokenId ? "authorized" : "pending"
    };

    if (cardTokenId) body.card_token_id = cardTokenId;

    return body;
};

const createSubscription = (token, body, idempotencyKey) =>
    request(token, "/preapproval", { method: "POST", body, idempotencyKey });

const getSubscription = (token, subscriptionId) =>
    request(token, `/preapproval/${enc(subscriptionId)}`);

/** Cancelar ("cancelled"), pausar ("paused") ou reativar ("authorized"). */
const setSubscriptionStatus = (token, subscriptionId, status) =>
    request(token, `/preapproval/${enc(subscriptionId)}`, { method: "PUT", body: { status } });

/** Só leitura: prova que o token alcança a API de assinaturas. */
const probeSubscriptions = (token) =>
    request(token, "/preapproval/search?limit=1");

const listCharges = async (token, subscriptionId) => {

    const result = await request(token, `/authorized_payments/search?preapproval_id=${enc(subscriptionId)}&limit=50`);

    return {
        ...result,
        charges: result.ok && Array.isArray(result.data.results) ? result.data.results.map(toCharge) : []
    };
};

const getCharge = async (token, chargeId) => {

    const result = await request(token, `/authorized_payments/${enc(chargeId)}`);

    return { ...result, charge: result.ok && result.data && result.data.id ? toCharge(result.data) : null };
};

/** Estado da assinatura no formato da Markfy. */
const toSubscription = (preapproval) => {

    const p = preapproval || {};
    const raw = String(p.status || "").toLowerCase();
    const status = raw === "canceled" ? "cancelled" : raw;
    const next = p.next_payment_date ? new Date(p.next_payment_date).getTime() : NaN;

    return {
        id: p.id ? String(p.id) : null,
        status: SUBSCRIPTION_STATUSES.includes(status) ? status : null,
        providerStatus: raw || null,
        nextBillingAt: Number.isFinite(next) ? next : null,
        externalReference: p.external_reference || null,
        authorizeUrl: p.init_point || p.sandbox_init_point || null
    };
};

/**
 * Cobrança de uma assinatura (authorized_payment):
 *
 *   status          scheduled | processed | recycling | cancelled
 *   payment.status  approved | rejected | in_process | ...
 *
 * "scheduled" é só a próxima cobrança agendada — não é
 * atraso. "recycling" é recusada com novas tentativas (até 4
 * em 10 dias); depois de 3 parcelas recusadas o Mercado Pago
 * cancela a assinatura sozinho.
 */
const toCharge = (invoice) => {

    const item = invoice || {};
    const paymentStatus = (item.payment && item.payment.status) || null;
    const status = item.status || null;

    const paid = paymentStatus === "approved";

    const failed =
        !paid &&
        (paymentStatus === "rejected" || paymentStatus === "cancelled" || status === "recycling");

    const when = item.debit_date || item.date_created || null;
    const chargedAt = when ? new Date(when).getTime() : NaN;

    return {
        id: item.id !== undefined && item.id !== null ? String(item.id) : null,
        subscriptionId: item.preapproval_id ? String(item.preapproval_id) : null,
        amount: Number(item.transaction_amount) || null,
        label: paymentStatus || status || "scheduled",
        paid,
        failed,
        paymentId: item.payment && item.payment.id ? String(item.payment.id) : null,
        retryAttempt: Number(item.retry_attempt) || 0,
        chargedAt: Number.isFinite(chargedAt) ? chargedAt : null
    };
};


/* -----------------------------------------------------
   PAGAMENTO ÚNICO (/v1/payments)
----------------------------------------------------- */

const createPayment = (token, body, idempotencyKey) =>
    request(token, "/v1/payments", { method: "POST", body, idempotencyKey });

const getPayment = (token, paymentId) =>
    request(token, `/v1/payments/${enc(paymentId)}`);

const refundPayment = (token, paymentId, idempotencyKey) =>
    request(token, `/v1/payments/${enc(paymentId)}/refunds`, { method: "POST", body: {}, idempotencyKey });

/** Pagamento no formato da Markfy (sem dados do pagador). */
const toPayment = (payment) => {

    const p = payment || {};
    const transaction = (p.point_of_interaction && p.point_of_interaction.transaction_data) || null;
    const approvedAt = p.date_approved ? new Date(p.date_approved).getTime() : NaN;

    return {
        id: p.id !== undefined && p.id !== null ? String(p.id) : null,
        status: p.status || null,
        statusDetail: p.status_detail || null,
        amount: Number(p.transaction_amount),
        currency: p.currency_id || null,
        externalReference: p.external_reference ? String(p.external_reference) : null,
        methodId: p.payment_method_id || null,
        approvedAt: Number.isFinite(approvedAt) ? approvedAt : null,
        recurring: p.operation_type === "recurring_payment",
        pix: transaction
            ? {
                qrCode: transaction.qr_code || null,
                qrCodeBase64: transaction.qr_code_base64 || null,
                ticketUrl: transaction.ticket_url || null,
                expiresAt: p.date_of_expiration || null
            }
            : null
    };
};


/* -----------------------------------------------------
   WEBHOOKS

   Assinatura: header x-signature "ts=...,v1=..." = HMAC
   SHA-256 de "id:{data.id};request-id:{x-request-id};ts:{ts};"
   com a assinatura secreta da aplicação (Suas integrações →
   Webhooks). Quem calcula é o validador do SDK oficial.

   A documentação pede o data.id alfanumérico em minúsculas:
   se a primeira conta não bater, tenta assim.
----------------------------------------------------- */

const header = (headers, name) => {
    const value = headers ? headers[name] : undefined;
    return Array.isArray(value) ? value[0] : value;
};

const verifyWebhookSignature = ({ headers, dataId, secret }) => {

    const xSignature = header(headers, "x-signature");

    if (!xSignature) return { signed: false, valid: false, reason: "MissingSignatureHeader" };
    if (!secret) return { signed: true, valid: false, reason: "SecretNotConfigured" };

    const xRequestId = header(headers, "x-request-id");
    let failure = null;

    const matches = (value) => {
        try {
            WebhookSignatureValidator.validate({ xSignature, xRequestId, dataId: value, secret });
            return true;
        } catch (error) {
            if (!(error instanceof InvalidWebhookSignatureError)) throw error;
            failure = error.reason;
            return false;
        }
    };

    const value = dataId === undefined || dataId === null ? undefined : String(dataId);

    if (matches(value)) return { signed: true, valid: true };

    if (value && value !== value.toLowerCase() && matches(value.toLowerCase())) {
        return { signed: true, valid: true };
    }

    return { signed: true, valid: false, reason: failure };
};

const TOPICS = {
    payment: "payment",
    payments: "payment",
    preapproval: "subscription",
    subscription_preapproval: "subscription",
    authorized_payment: "subscription_charge",
    subscription_authorized_payment: "subscription_charge",
    "mp-connect": "account"
};

const HANDLE = /^[a-z0-9._-]{1,60}$/i;

/**
 * Webhook manda type + data.id no corpo (e data.id na URL);
 * o IPN antigo manda topic + id só na URL. `company` é a
 * dica que a Markfy põe na notification_url dos pagamentos:
 * só escolhe com qual token conferir, nunca decide nada.
 */
const parseNotification = ({ body, query }) => {

    const b = body && typeof body === "object" ? body : {};
    const q = query || {};

    const type = String(b.type || q.type || q.topic || "").toLowerCase();
    const raw = (b.data && b.data.id) || q["data.id"] || q.id || null;

    return {
        provider: id,
        topic: TOPICS[type] || "other",
        type,
        action: typeof b.action === "string" ? b.action : null,
        id: raw !== null && raw !== undefined ? String(raw) : null,
        signedId: q["data.id"] !== undefined ? String(q["data.id"]) : (raw !== null && raw !== undefined ? String(raw) : null),
        sellerId: b.user_id !== undefined && b.user_id !== null ? String(b.user_id) : null,
        companyHint: typeof q.company === "string" && HANDLE.test(q.company) ? q.company : null
    };
};


module.exports = {
    id,
    label: "Mercado Pago",
    API_URL,
    request,
    reason,
    credentialRefused,
    authorizationUrl,
    exchangeCode,
    refreshTokens,
    getAccount,
    buildSubscription,
    createSubscription,
    getSubscription,
    setSubscriptionStatus,
    probeSubscriptions,
    listCharges,
    getCharge,
    toSubscription,
    toCharge,
    createPayment,
    getPayment,
    refundPayment,
    toPayment,
    verifyWebhookSignature,
    parseNotification
};
