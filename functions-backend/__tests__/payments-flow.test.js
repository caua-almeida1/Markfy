/* =====================================================
   PAGAMENTOS — FLUXOS COMPLETOS

   Pagamento antecipado, webhook, conexão OAuth (troca do
   code, renovação, revogação), "Testar conexão",
   desconectar, isolamento entre empresas e as ações novas
   da mensalidade (pausar, reativar, teste grátis).

   Banco em memória e Mercado Pago falso: nada sai da
   máquina. O que só um ambiente de teste REAL do Mercado
   Pago confirma está listado em docs/PAGAMENTOS.md.
===================================================== */

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");

const admin = require("firebase-admin");
const { createFakeDb } = require("./helpers/fake-rtdb");
const { createFakeMercadoPago } = require("./helpers/fake-mercadopago");

const DAY = 24 * 60 * 60 * 1000;

const brDay = (ms) => {
    const d = new Date(ms - 3 * 60 * 60 * 1000);
    return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};

const IN_3_DAYS = brDay(Date.now() + 3 * DAY);
const IN_6_DAYS = brDay(Date.now() + 6 * DAY);

const CLIENT = "c0ffee00-1234-4abc-9def-001122334455";

const SELLER_CONNECTION = {
    connected: true,
    status: "active",
    accessToken: "SELLER_TOKEN",
    refreshToken: "REFRESH_OK",
    expiresAt: Date.now() + 100 * DAY,
    mercadoPagoUserId: 999,
    publicKey: "APP_USR-pub"
};

const seed = () => ({
    publicAccess: { tk: { bookings: true }, outra: { bookings: true } },
    mercadoPagoConnections: { tk: { ...SELLER_CONNECTION } },
    users: { pro1: { name: "Rafa" } },
    companys: {
        tk: {
            name: "Tk Barbearia",
            members: {
                owner: { role: "master" },
                gerente: { role: "administrator" },
                pro1: { role: "professional" }
            },
            paymentSettings: { receiveBeforeBooking: true, mercadoPago: { connected: true } },
            products: {
                corte: {
                    name: "Corte", type: "individual", status: "ativos",
                    value: "R$ 50,00", discountedPrice: "R$ 40,00", duration: 30,
                    relatedUsers: [{ id: "pro1", role: "professional" }]
                },
                barba: {
                    name: "Barba", type: "individual", status: "ativos",
                    value: "R$ 20,00", duration: 15,
                    relatedUsers: [{ id: "pro1", role: "professional" }]
                },
                plano: {
                    name: "Barba ilimitada", type: "monthly", status: "ativos",
                    value: "R$ 99,90", duration: 30,
                    relatedUsers: [{ id: "pro1", role: "professional" }],
                    monthlyPlan: { billingCycle: "monthly", unlimitedSessions: true, autoRenew: true }
                },
                teste: {
                    name: "Plano com teste grátis", type: "monthly", status: "ativos",
                    value: "R$ 79,90", duration: 30,
                    relatedUsers: [{ id: "pro1", role: "professional" }],
                    monthlyPlan: { billingCycle: "monthly", unlimitedSessions: true, autoRenew: true, trialDays: 7 }
                }
            }
        },
        outra: {
            name: "Outra empresa",
            members: { dono2: { role: "master" } },
            products: {}
        }
    }
});

let fakeDb = createFakeDb(seed());

const fakeAdmin = {
    database: () => fakeDb,
    auth: () => ({
        verifyIdToken: async (token) => {
            if (!token.startsWith("uid:")) throw new Error("bad token");
            return { uid: token.slice(4), email: `${token.slice(4)}@mail.com` };
        }
    })
};

Object.defineProperty(admin, "database", { value: fakeAdmin.database, configurable: true, writable: true });
Object.defineProperty(admin, "auth", { value: fakeAdmin.auth, configurable: true, writable: true });

const mp = createFakeMercadoPago();

global.fetch = mp.fetch;


/* ---------- módulos sob teste ---------- */

const bookings = require("../bookings");
const provider = require("../payments/providers").getProvider("mercadopago");

const credentials = () => ({ clientId: "APP_ID", clientSecret: "APP_SECRET" });

const connections = require("../payments/connections")({ db: () => fakeDb, provider, credentials });

let subscriptions = null;

const advance = require("../payments/advance-payments")({
    admin: fakeAdmin,
    connections,
    provider,
    notificationUrl: "https://functions.test/mercadoPagoWebhook",
    onUnmatchedPayment: (handle, payment) =>
        payment.recurring && payment.externalReference
            ? subscriptions.syncByReference(handle, payment.externalReference)
            : null
});

const payments = require("../payments/payments-api")({
    admin: fakeAdmin,
    secrets: [],
    connections,
    provider,
    credentials,
    advance,
    redirectUri: "https://functions.test/mercadoPagoOAuthCallback",
    frontendUrl: "https://markfy.vercel.app",
    allowedOrigins: ["https://markfy.vercel.app", "http://localhost:3000"]
});

subscriptions = require("../subscriptions")({
    admin: fakeAdmin,
    secrets: [],
    connections,
    provider,
    loadCompaniesChildren: async () => ({})
});

let ip = 0;

const call = async (fn, body, uid) => {

    const res = {
        statusCode: 0,
        body: null,
        status(code) { this.statusCode = code; return this; },
        json(payload) { this.body = payload; return this; },
        send(payload) { this.body = payload; return this; },
        set() {}, setHeader() {}, getHeader() {}, end() {}, on() {}
    };

    ip += 1;

    await fn({
        method: "POST",
        headers: { authorization: uid ? `Bearer uid:${uid}` : "", "x-forwarded-for": `10.1.0.${ip}` },
        body,
        get() {}
    }, res);

    return res;
};

const paymentsApi = (body, uid) => call(payments.paymentsApi, body, uid);
const subscriptionsApi = (body, uid) => call(subscriptions.subscriptionsApi, body, uid);
const bookingsApi = (body, uid) => call(bookings.bookingsApi, body, uid);

const USER = { uid: "ana", email: "ana@mail.com" };

const paymentBody = (overrides = {}) => ({
    companyHandle: "tk",
    productId: "corte",
    professionalId: "pro1",
    professionalName: "Rafa",
    day: IN_3_DAYS,
    hour: "10:00",
    dayLabel: "Terça",
    userName: "Ana",
    clientId: CLIENT,
    paymentMethodId: "master",
    token: "ff8080814c11e237014c1ff593b57b4d",
    installments: 1,
    payer: { email: "ana@mail.com", identification: { type: "CPF", number: "123.456.789-09" }, phone: { number: "999" } },
    ...overrides
});

const order = (id) => fakeDb.get(`companys/tk/paymentOrders/${id}`);
const schedulesOf = (orderId) =>
    Object.values(fakeDb.get("companys/tk/schedules") || {}).filter((item) => item.paymentOrderId === orderId);

const expectError = async (promise, status, code) => {
    await assert.rejects(promise, (error) => {
        assert.equal(error.status, status, `${error.status} ${error.code} ${error.message}`);
        if (code) assert.equal(error.code, code);
        return true;
    });
};


/* =====================================================
   PAGAMENTO ANTECIPADO
===================================================== */

let cardOrder = null;

test("cartão aprovado na hora: cobra promoção + extras (calculado no servidor) e já agenda", async () => {

    const result = await advance.create(paymentBody({ extraProductIds: ["barba"], amount: 1 }), USER);

    assert.equal(result.status, "approved");
    assert.equal(result.orderStatus, "paid");
    assert.equal(result.booking.status, "booked");

    const sent = mp.state.calls.find((item) => item.pathname === "/v1/payments" && item.method === "POST");

    /* R$ 40 (promoção do corte) + R$ 20 (barba). O "amount: 1"
       mandado pelo navegador é ignorado. Antes: R$ 50, sem
       promoção e sem extra. */
    assert.equal(sent.body.transaction_amount, 60);
    assert.equal(sent.idempotency, result.paymentId);
    assert.equal(sent.auth, "Bearer SELLER_TOKEN");
    assert.match(sent.body.notification_url, /source_news=webhooks&company=tk$/);

    /* Pagador só com o necessário; nada de nome/recado no metadata. */
    assert.deepEqual(sent.body.payer, { email: "ana@mail.com", identification: { type: "CPF", number: "12345678909" } });
    assert.equal(JSON.stringify(sent.body.metadata).includes("Ana"), false);

    const saved = order(result.paymentId);
    assert.equal(saved.status, "paid");
    assert.equal(saved.amount, 60);
    assert.equal(saved.userId, "ana");

    const [schedule] = schedulesOf(result.paymentId);
    assert.equal(schedule.paymentStatus, "approved");
    assert.equal(schedule.paidAmount, 60);
    assert.equal(schedule.extraServices.length, 1);
    assert.equal(schedule.userId, "ana");

    cardOrder = { id: result.paymentId, mpId: result.mercadoPagoPaymentId };
});

test("aviso repetido (webhook duas vezes + tela de espera) não agenda de novo", async () => {

    await advance.handleNotification({ id: cardOrder.mpId, sellerId: "999", companyHint: "tk" });
    await advance.handleNotification({ id: cardOrder.mpId, sellerId: "999", companyHint: "tk" });
    await advance.sync("tk", cardOrder.id, "ana");

    assert.equal(schedulesOf(cardOrder.id).length, 1);
    assert.equal(order(cardOrder.id).status, "paid");
});

test("Pix: fica pendente até o gateway aprovar; aviso antigo (sem dica) acha a empresa e agenda", async () => {

    const result = await advance.create(paymentBody({ paymentMethodId: "pix", token: undefined, hour: "14:00" }), USER);

    assert.equal(result.status, "pending");
    assert.equal(result.pix.qrCode, "000201PIX");
    assert.equal(schedulesOf(result.paymentId).length, 0);

    Object.assign(mp.state.payments[result.mercadoPagoPaymentId], { status: "approved", date_approved: new Date().toISOString() });

    const handled = await advance.handleNotification({ id: result.mercadoPagoPaymentId, sellerId: null, companyHint: null });

    assert.equal(handled, true);
    assert.equal(order(result.paymentId).status, "paid");
    assert.equal(schedulesOf(result.paymentId).length, 1);
});

test("valor aprovado diferente do pedido não agenda", async () => {

    const result = await advance.create(paymentBody({ paymentMethodId: "pix", token: undefined, hour: "15:00" }), USER);

    Object.assign(mp.state.payments[result.mercadoPagoPaymentId], { status: "approved", transaction_amount: 1 });

    await advance.handleNotification({ id: result.mercadoPagoPaymentId, sellerId: "999" });

    const saved = order(result.paymentId);
    assert.equal(saved.status, "needs_attention");
    assert.equal(saved.problem.code, "amount_mismatch");
    assert.equal(schedulesOf(result.paymentId).length, 0);
});

test("horário tomado entre o Pix e a aprovação: pago, sem horário, a empresa vê", async () => {

    const result = await advance.create(paymentBody({ paymentMethodId: "pix", token: undefined, hour: "16:00" }), USER);

    fakeDb.put("companys/tk/schedules/outro", {
        productId: "corte", professionalId: "pro1", day: IN_3_DAYS, hour: "16:00", status: "pending", totalDuration: 30
    });

    Object.assign(mp.state.payments[result.mercadoPagoPaymentId], { status: "approved" });

    const synced = await advance.sync("tk", result.paymentId, "ana");

    assert.equal(synced.status, "needs_attention");
    assert.equal(synced.booking.status, "failed");
    assert.equal(synced.booking.code, "slot_taken");
    assert.equal(schedulesOf(result.paymentId).length, 0);
});

test("horário já ocupado antes de pagar: nem chega a cobrar", async () => {

    const before = mp.state.calls.filter((item) => item.pathname === "/v1/payments").length;

    await expectError(advance.create(paymentBody({ hour: "16:00" }), USER), 409, "slot_taken");

    assert.equal(mp.state.calls.filter((item) => item.pathname === "/v1/payments").length, before);
});

test("estorno depois de pago: pedido e agendamento ficam marcados", async () => {

    Object.assign(mp.state.payments[cardOrder.mpId], { status: "refunded" });

    await advance.handleNotification({ id: cardOrder.mpId, sellerId: "999", companyHint: "tk" });

    assert.equal(order(cardOrder.id).status, "refunded");
    assert.equal(schedulesOf(cardOrder.id)[0].paymentStatus, "refunded");
});

test("recusa da conta da empresa e gateway fora do ar nunca viram sucesso", async () => {

    mp.state.rejectPayment = { status: 400, message: "Collector user without key enabled for QR render" };

    await expectError(advance.create(paymentBody({ paymentMethodId: "pix", token: undefined, hour: "17:00" }), USER), 502, "MERCADO_PAGO_PIX_SEM_CHAVE");

    mp.state.rejectPayment = null;

    assert.equal(fakeDb.get("companys/tk/paymentSettings/mercadoPago/lastFailure/code"), "MERCADO_PAGO_PIX_SEM_CHAVE");

    mp.state.offline = true;

    await expectError(advance.create(paymentBody({ hour: "17:30" }), USER), 503, "network");

    mp.state.offline = false;

    const failed = Object.values(fakeDb.get("companys/tk/paymentOrders")).filter((item) => item.hour === "17:30");
    assert.equal(failed[0].status, "error");
});

test("tela de espera: só quem pagou (ou a equipe) consulta o pedido", async () => {

    await expectError(advance.sync("tk", cardOrder.id, "intruso"), 404, "not_found");

    const res = await paymentsApi({ action: "orderStatus", handle: "tk", orderId: cardOrder.id }, "ana");
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.result.status, "refunded");
});


/* =====================================================
   PAGAMENTO ANTECIPADO POR PRODUTO
===================================================== */

test("pagamento antecipado ligado no produto passa a valer (antes era gravado e ignorado)", async () => {

    fakeDb.put("companys/tk/paymentSettings/receiveBeforeBooking", false);

    const free = await bookingsApi({ action: "paymentInfo", handle: "tk", productId: "barba" });
    assert.deepEqual(free.body.result, { advancePayment: false, monthly: false, onlinePayments: true });

    const booking = {
        action: "create", handle: "tk", productId: "barba", professionalId: "pro1",
        clientId: "d00dfeed-1234-4abc-9def-001122334455", day: IN_6_DAYS, hour: "09:00", userName: "Bia"
    };

    assert.equal((await bookingsApi(booking, "bia")).statusCode, 200);

    fakeDb.put("companys/tk/products/barba/settings/prepayment", true);

    const info = await bookingsApi({ action: "paymentInfo", handle: "tk", productId: "barba" });
    assert.equal(info.body.result.advancePayment, true);

    const refused = await bookingsApi({ ...booking, hour: "11:00", clientId: "d00dfeed-9999-4abc-9def-001122334455" }, "cris");
    assert.equal(refused.statusCode, 402);
    assert.equal(refused.body.code, "payment_required");

    fakeDb.put("companys/tk/paymentSettings/receiveBeforeBooking", true);
});


/* =====================================================
   WEBHOOK
===================================================== */

test("assinatura do webhook: confere o HMAC, aceita o id em minúsculas e separa aviso sem assinatura", () => {

    const secret = "s3cr3t";
    const sign = (id, requestId, ts) =>
        crypto.createHmac("sha256", secret).update(`id:${id};request-id:${requestId};ts:${ts};`).digest("hex");

    const headers = { "x-signature": `ts=1704908010,v1=${sign("123", "req-1", "1704908010")}`, "x-request-id": "req-1" };

    assert.deepEqual(provider.verifyWebhookSignature({ headers, dataId: "123", secret }), { signed: true, valid: true });

    const forged = provider.verifyWebhookSignature({ headers, dataId: "124", secret });
    assert.equal(forged.valid, false);
    assert.equal(forged.reason, "SignatureMismatch");

    const wrongSecret = provider.verifyWebhookSignature({ headers, dataId: "123", secret: "outra" });
    assert.equal(wrongSecret.valid, false);

    const upper = { "x-signature": `ts=1,v1=${sign("abc9", "r", "1")}`, "x-request-id": "r" };
    assert.equal(provider.verifyWebhookSignature({ headers: upper, dataId: "ABC9", secret }).valid, true);

    assert.deepEqual(provider.verifyWebhookSignature({ headers: {}, dataId: "123", secret }), {
        signed: false, valid: false, reason: "MissingSignatureHeader"
    });

    const parsed = provider.parseNotification({
        body: { type: "payment", data: { id: "123" }, user_id: 999, action: "payment.updated" },
        query: { "data.id": "123", type: "payment", company: "tk" }
    });

    assert.equal(parsed.topic, "payment");
    assert.equal(parsed.sellerId, "999");
    assert.equal(parsed.companyHint, "tk");
    assert.equal(provider.parseNotification({ query: { topic: "payment", id: "5", company: "../x" } }).companyHint, null);
    assert.equal(provider.parseNotification({ body: { type: "subscription_authorized_payment", data: { id: "9" } } }).topic, "subscription_charge");
});


/* =====================================================
   MENSALIDADE: TESTE GRÁTIS, PAUSAR, REATIVAR
===================================================== */

const subscribeBody = (overrides = {}) => ({
    action: "create",
    handle: "tk",
    productId: "plano",
    method: "card",
    cardTokenId: "ff8080814c11e237014c1ff593b57b4d",
    payerEmail: "lia@mail.com",
    userName: "Lia",
    clientId: CLIENT,
    consent: { accepted: true, version: require("../subscriptions-core").CONSENT_VERSION },
    ...overrides
});

const sub = (id) => fakeDb.get(`companys/tk/subscriptions/${id}`);

test("teste grátis: a 1ª cobrança vai para start_date e a assinatura nasce em 'teste grátis'", async () => {

    const res = await subscriptionsApi(subscribeBody({ productId: "teste" }), "lia");

    assert.equal(res.statusCode, 200, JSON.stringify(res.body));

    const sent = mp.state.calls.filter((item) => item.pathname === "/preapproval" && item.method === "POST").pop();

    assert.equal(sent.body.auto_recurring.free_trial, undefined);

    const start = new Date(sent.body.auto_recurring.start_date).getTime();
    assert.ok(Math.abs(start - (Date.now() + 7 * DAY)) < 60 * 1000);

    assert.equal(res.body.result.paymentStatus, "trial");
    assert.ok(sub("lia_teste").trialEndsAt > Date.now() + 6 * DAY);
});

test("pausar e reativar: só o administrador da empresa; pausada não agenda", async () => {

    const created = await subscriptionsApi(subscribeBody(), "lia");
    assert.equal(created.statusCode, 200, JSON.stringify(created.body));
    assert.equal(created.body.result.paymentStatus, "processing");

    const preapprovalId = sub("lia_plano").mercadoPagoPreapprovalId;

    assert.equal((await subscriptionsApi({ action: "pause", handle: "tk", subscriptionId: "lia_plano" }, "lia")).statusCode, 403);
    assert.equal((await subscriptionsApi({ action: "pause", handle: "tk", subscriptionId: "lia_plano" }, "pro1")).statusCode, 403);

    const paused = await subscriptionsApi({ action: "pause", handle: "tk", subscriptionId: "lia_plano" }, "gerente");
    assert.equal(paused.statusCode, 200, JSON.stringify(paused.body));
    assert.equal(paused.body.result.status, "paused");
    assert.equal(mp.state.preapprovals[preapprovalId].status, "paused");

    const booking = await bookingsApi({
        action: "create", handle: "tk", productId: "plano", professionalId: "pro1",
        clientId: CLIENT, day: IN_6_DAYS, hour: "13:00", userName: "Lia", subscriptionId: "lia_plano"
    }, "lia");
    assert.equal(booking.statusCode, 402);
    assert.equal(booking.body.code, "subscription_required");

    const resumed = await subscriptionsApi({ action: "resume", handle: "tk", subscriptionId: "lia_plano" }, "owner");
    assert.equal(resumed.statusCode, 200, JSON.stringify(resumed.body));
    assert.equal(resumed.body.result.status, "authorized");
    assert.equal(mp.state.preapprovals[preapprovalId].status, "authorized");
});

test("cobrança da mensalidade que chega como aviso 'payment' também atualiza a assinatura", async () => {

    const preapprovalId = sub("lia_plano").mercadoPagoPreapprovalId;

    mp.state.invoices.inv1 = {
        id: "inv1", preapproval_id: preapprovalId, status: "processed", transaction_amount: 99.9,
        debit_date: new Date().toISOString(), payment: { id: 8800, status: "approved" }
    };

    mp.state.payments["8800"] = {
        id: 8800, collector_id: 999, status: "approved", transaction_amount: 99.9,
        external_reference: "lia_plano", operation_type: "recurring_payment"
    };

    await advance.handleNotification({ id: "8800", sellerId: "999" });

    assert.equal(sub("lia_plano").paymentStatus, "paid");
    assert.ok(sub("lia_plano").lastPaidAt);
});

test("gateway fora do ar ao assinar: 503, nada gravado", async () => {

    mp.state.offline = true;

    const res = await subscriptionsApi(subscribeBody({ productId: "plano" }), "zeca");

    mp.state.offline = false;

    assert.equal(res.statusCode, 503);
    assert.equal(res.body.code, "network");
    assert.equal(sub("zeca_plano"), null);
});


/* =====================================================
   CONEXÃO: PAPÉIS, OAUTH, RENOVAÇÃO, REVOGAÇÃO
===================================================== */

test("conectar: administrador (administrator) pode; profissional e outra empresa não", async () => {

    const ok = await paymentsApi({ action: "connect", handle: "tk", origin: "http://localhost:3000" }, "gerente");

    assert.equal(ok.statusCode, 200, JSON.stringify(ok.body));

    const url = new URL(ok.body.result.authorizationUrl);
    assert.equal(url.origin + url.pathname, "https://auth.mercadopago.com/authorization");
    assert.equal(url.searchParams.get("client_id"), "APP_ID");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.match(url.searchParams.get("state"), /^[a-f0-9]{64}$/);

    const stored = fakeDb.get(`mercadoPagoOAuthStates/${url.searchParams.get("state")}`);
    assert.equal(stored.companyHandle, "tk");
    assert.equal(stored.returnUrl, "http://localhost:3000/central-adm");

    assert.equal((await paymentsApi({ action: "connect", handle: "tk" }, "pro1")).statusCode, 403);

    /* Dono de outra empresa: não descobre nem mexe. */
    assert.equal((await paymentsApi({ action: "connect", handle: "tk" }, "dono2")).statusCode, 404);
    assert.equal((await paymentsApi({ action: "verify", handle: "tk" }, "dono2")).statusCode, 404);
    assert.equal((await paymentsApi({ action: "disconnect", handle: "tk", confirm: true }, "dono2")).statusCode, 404);
    assert.equal((await paymentsApi({ action: "connect", handle: "tk" }, null)).statusCode, 401);

    /* Origem desconhecida volta para o site oficial. */
    const odd = await paymentsApi({ action: "connect", handle: "tk", origin: "https://evil.example" }, "owner");
    const oddState = new URL(odd.body.result.authorizationUrl).searchParams.get("state");
    assert.equal(fakeDb.get(`mercadoPagoOAuthStates/${oddState}`).returnUrl, "https://markfy.vercel.app/central-adm");
});

test("OAuth: troca o code, tokens só no nó privado, mostra conta e ambiente; state de uso único", async () => {

    const start = await paymentsApi({ action: "connect", handle: "tk", origin: "http://localhost:3000" }, "gerente");
    const state = new URL(start.body.result.authorizationUrl).searchParams.get("state");

    mp.state.codes.CODE1 = { userId: 4242, nickname: "TESTUSER4242", tags: ["normal", "test_user"] };

    const outcome = await payments.completeAuthorization({ code: "CODE1", state });
    assert.equal(outcome.redirect, "http://localhost:3000/central-adm?mercadoPago=connected");

    const secret = fakeDb.get("mercadoPagoConnections/tk");
    assert.match(secret.accessToken, /^ACCESS_4242_/);
    assert.equal(secret.environment, "test");
    assert.equal(secret.accountNickname, "TESTUSER4242");
    assert.equal(secret.connectedBy, "gerente");

    const mirror = fakeDb.get("companys/tk/paymentSettings/mercadoPago");
    assert.equal(mirror.connected, true);
    assert.equal(mirror.environment, "test");
    assert.equal(mirror.accountLabel, "TESTUSER4242");
    assert.equal(JSON.stringify(mirror).includes("ACCESS_"), false);
    assert.equal(JSON.stringify(mirror).includes("REFRESH_"), false);

    /* O mesmo state de novo: recusado. */
    assert.equal((await payments.completeAuthorization({ code: "CODE1", state })).status, 400);

    /* Recusado no Mercado Pago e state vencido voltam explicados. */
    const again = await paymentsApi({ action: "connect", handle: "tk", origin: "http://localhost:3000" }, "gerente");
    const deniedState = new URL(again.body.result.authorizationUrl).searchParams.get("state");
    assert.equal(
        (await payments.completeAuthorization({ error: "access_denied", state: deniedState })).redirect,
        "http://localhost:3000/central-adm?mercadoPago=error&reason=denied"
    );

    const late = await paymentsApi({ action: "connect", handle: "tk", origin: "http://localhost:3000" }, "gerente");
    const lateState = new URL(late.body.result.authorizationUrl).searchParams.get("state");
    fakeDb.put(`mercadoPagoOAuthStates/${lateState}/createdAt`, Date.now() - 11 * 60 * 1000);
    assert.equal(
        (await payments.completeAuthorization({ code: "X", state: lateState })).redirect,
        "http://localhost:3000/central-adm?mercadoPago=error&reason=expired"
    );

    /* Volta a conta original para os próximos testes. */
    fakeDb.put("mercadoPagoConnections/tk", { ...SELLER_CONNECTION });
    fakeDb.put("companys/tk/paymentSettings/mercadoPago", { connected: true });
});

test("Testar conexão: só leitura (nada de assinatura de mentira) e diz o ambiente", async () => {

    const before = mp.state.calls.length;

    const res = await paymentsApi({ action: "verify", handle: "tk" }, "owner");

    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.result.ok, true);
    assert.equal(res.body.result.environment, "production");
    assert.equal(res.body.result.subscriptions, true);

    const made = mp.state.calls.slice(before);
    assert.equal(made.some((item) => item.method !== "GET"), false);

    assert.equal(fakeDb.get("companys/tk/paymentSettings/mercadoPago/lastCheck/ok"), true);
});

test("token: renova antes de vencer; recusado renova e repete; refresh revogado pede reconexão", async () => {

    /* Vence em 2 dias: renova antes de chamar. */
    fakeDb.put("mercadoPagoConnections/tk/expiresAt", Date.now() + 2 * DAY);

    const renewed = await paymentsApi({ action: "verify", handle: "tk" }, "owner");
    assert.equal(renewed.body.result.ok, true);

    const afterRefresh = fakeDb.get("mercadoPagoConnections/tk");
    assert.match(afterRefresh.accessToken, /^ACCESS_999_/);
    assert.match(afterRefresh.refreshToken, /^REFRESH_999_/);
    assert.ok(afterRefresh.expiresAt > Date.now() + 100 * DAY);

    /* Token recusado (revogado do lado do Mercado Pago): renova e repete. */
    delete mp.state.tokens[afterRefresh.accessToken];

    const retried = await paymentsApi({ action: "verify", handle: "tk" }, "owner");
    assert.equal(retried.body.result.ok, true);
    assert.notEqual(fakeDb.get("mercadoPagoConnections/tk/accessToken"), afterRefresh.accessToken);

    /* Vendedor desvinculou: token e refresh mortos. */
    mp.state.tokens = {};
    mp.state.refreshTokens = {};

    const revoked = await paymentsApi({ action: "verify", handle: "tk" }, "owner");
    assert.equal(revoked.body.result.ok, false);
    assert.equal(revoked.body.result.problem, "reconnect_required");

    const mirror = fakeDb.get("companys/tk/paymentSettings/mercadoPago");
    assert.equal(mirror.connected, false);
    assert.equal(mirror.status, "reconnect_required");

    /* Com a conexão quebrada, assinar explica em vez de falhar calado. */
    const res = await subscriptionsApi(subscribeBody({ productId: "plano" }), "rui");
    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, "not_connected");
    assert.equal(res.body.ownerAction, true);

    /* Restaura. */
    mp.state.tokens = { SELLER_TOKEN: 999 };
    mp.state.refreshTokens = { REFRESH_OK: 999 };
    fakeDb.put("mercadoPagoConnections/tk", { ...SELLER_CONNECTION });
});

test("rotina diária renova o que vence em 30 dias e limpa tentativas de OAuth abandonadas", async () => {

    fakeDb.put("mercadoPagoConnections/tk/expiresAt", Date.now() + 20 * DAY);
    fakeDb.put("mercadoPagoOAuthStates/" + "a".repeat(64), { uid: "x", companyHandle: "tk", createdAt: Date.now() - DAY });

    assert.deepEqual(await connections.refreshExpiring(), { refreshed: 1, reconnect: 0, errors: 0 });

    /* Só a abandonada (as dos testes acima ainda estão no prazo). */
    assert.equal(await payments.cleanupStates(), 1);
    assert.equal(fakeDb.get("mercadoPagoOAuthStates/" + "a".repeat(64)), null);

    fakeDb.put("mercadoPagoConnections/tk", { ...SELLER_CONNECTION });
    mp.state.tokens.SELLER_TOKEN = 999;
});

test("desconectar: com assinatura aberta pede confirmação; confirmado, apaga os tokens", async () => {

    const blocked = await paymentsApi({ action: "disconnect", handle: "tk" }, "gerente");

    assert.equal(blocked.statusCode, 409);
    assert.equal(blocked.body.code, "has_open_subscriptions");
    assert.ok(blocked.body.openSubscriptions >= 1);
    assert.ok(fakeDb.get("mercadoPagoConnections/tk"));

    const done = await paymentsApi({ action: "disconnect", handle: "tk", confirm: true }, "gerente");

    assert.equal(done.statusCode, 200, JSON.stringify(done.body));
    assert.equal(fakeDb.get("mercadoPagoConnections/tk"), null);

    const mirror = fakeDb.get("companys/tk/paymentSettings/mercadoPago");
    assert.equal(mirror.connected, false);
    assert.equal(mirror.status, "disconnected");
    assert.equal(mirror.previousAccount.mercadoPagoUserId, 999);

    /* Desconectado: pagar explica que a empresa não recebe online. */
    await expectError(advance.create(paymentBody({ hour: "18:00" }), USER), 400, "not_connected");
});
