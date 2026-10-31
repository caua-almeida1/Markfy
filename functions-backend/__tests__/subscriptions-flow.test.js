/* =====================================================
   FLUXO COMPLETO DA MENSALIDADE

   subscriptionsApi + bookingsApi + webhook + sincronização
   diária, com o banco em memória e um Mercado Pago falso.
   Nada sai da máquina.
===================================================== */

const test = require("node:test");
const assert = require("node:assert/strict");

const admin = require("firebase-admin");
const { createFakeDb } = require("./helpers/fake-rtdb");

const DAY = 24 * 60 * 60 * 1000;

/* ---------- datas no formato do app (Brasília) ---------- */

const brDay = (ms) => {
    const d = new Date(ms - 3 * 60 * 60 * 1000);
    return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};

const IN_3_DAYS = brDay(Date.now() + 3 * DAY);
const IN_5_DAYS = brDay(Date.now() + 5 * DAY);
const IN_45_DAYS = brDay(Date.now() + 45 * DAY);


/* ---------- banco ---------- */

const seed = () => ({
    publicAccess: { tk: { bookings: true } },
    mercadoPagoConnections: {
        tk: { connected: true, accessToken: "SELLER_TOKEN", mercadoPagoUserId: 999, publicKey: "APP_USR-x" }
    },
    users: { pro1: { name: "Rafa" } },
    companys: {
        tk: {
            name: "Tk Barbearia",
            members: { pro1: { role: "professional" }, owner: { role: "master" } },
            products: {
                plano: {
                    name: "Barba ilimitada",
                    type: "monthly",
                    status: "ativos",
                    value: "R$ 99,90",
                    duration: 30,
                    relatedUsers: [{ id: "pro1", role: "professional" }],
                    monthlyPlan: { billingCycle: "monthly", unlimitedSessions: false, sessionsPerCycle: 4, autoRenew: true }
                },
                fiel: {
                    name: "Plano fidelidade",
                    type: "monthly",
                    status: "ativos",
                    value: "R$ 150,00",
                    duration: 30,
                    relatedUsers: [{ id: "pro1", role: "professional" }],
                    monthlyPlan: { billingCycle: "monthly", unlimitedSessions: true, loyaltyMonths: 6 }
                }
            }
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

/* bookings.js usa o firebase-admin de verdade: troca banco e auth. */
Object.defineProperty(admin, "database", { value: fakeAdmin.database, configurable: true, writable: true });
Object.defineProperty(admin, "auth", { value: fakeAdmin.auth, configurable: true, writable: true });


/* ---------- Mercado Pago falso ---------- */

const mp = { preapprovals: {}, invoices: {}, refunds: [], calls: [], nextId: 1, reject: null };

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

global.fetch = async (url, init = {}) => {

    const { pathname, searchParams } = new URL(url);
    const method = init.method || "GET";
    const body = init.body ? JSON.parse(init.body) : null;

    mp.calls.push({ method, pathname, body, auth: init.headers && init.headers.Authorization });

    if (pathname === "/preapproval" && method === "POST") {

        if (mp.reject) return json(400, { message: mp.reject, cause: [] });

        const id = `pre_${mp.nextId++}`;

        mp.preapprovals[id] = {
            id,
            status: body.status,
            external_reference: body.external_reference,
            payer_email: body.payer_email,
            next_payment_date: new Date(Date.now() + 30 * DAY).toISOString(),
            init_point: `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=${id}`
        };

        return json(201, mp.preapprovals[id]);
    }

    const pre = pathname.match(/^\/preapproval\/([^/]+)$/);

    if (pre) {
        const item = mp.preapprovals[pre[1]];
        if (!item) return json(404, { message: "not found" });
        if (method === "PUT") Object.assign(item, body);
        return json(200, item);
    }

    if (pathname === "/authorized_payments/search") {
        const id = searchParams.get("preapproval_id");
        return json(200, { results: Object.values(mp.invoices).filter((item) => item.preapproval_id === id) });
    }

    const invoice = pathname.match(/^\/authorized_payments\/([^/]+)$/);

    if (invoice) {
        return mp.invoices[invoice[1]] ? json(200, mp.invoices[invoice[1]]) : json(404, {});
    }

    const refund = pathname.match(/^\/v1\/payments\/([^/]+)\/refunds$/);

    if (refund) {
        mp.refunds.push(refund[1]);
        return json(201, { id: `ref_${refund[1]}` });
    }

    return json(404, { message: `rota falsa ausente: ${method} ${pathname}` });
};


/* ---------- módulos sob teste ---------- */

const bookings = require("../bookings");

const provider = require("../payments/providers").getProvider("mercadopago");

const connections = require("../payments/connections")({
    db: () => fakeDb,
    provider,
    credentials: () => ({ clientId: "APP_ID", clientSecret: "APP_SECRET" })
});

const subscriptions = require("../subscriptions")({
    admin: fakeAdmin,
    secrets: [],
    connections,
    provider,
    loadCompaniesChildren: async (children) => {
        const companies = fakeDb.get("companys") || {};
        return Object.fromEntries(Object.entries(companies).map(([handle, company]) => [
            handle,
            Object.fromEntries(children.filter((c) => company[c] !== undefined).map((c) => [c, company[c]]))
        ]));
    }
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
        headers: { authorization: uid ? `Bearer uid:${uid}` : "", "x-forwarded-for": `10.0.0.${ip}` },
        body,
        get() {}
    }, res);

    return res;
};

const api = (body, uid) => call(subscriptions.subscriptionsApi, body, uid);
const bookingsApi = (body, uid) => call(bookings.bookingsApi, body, uid);

const subscribeBody = (overrides = {}) => ({
    action: "create",
    handle: "tk",
    productId: "plano",
    method: "card",
    cardTokenId: "ff8080814c11e237014c1ff593b57b4d",
    payerEmail: "ana@mail.com",
    userName: "Ana",
    clientId: "c0ffee00-1234-4abc-9def-001122334455",
    consent: { accepted: true, version: subscriptions.core ? subscriptions.core.CONSENT_VERSION : require("../subscriptions-core").CONSENT_VERSION },
    booking: { professionalId: "pro1", day: IN_3_DAYS, hour: "10:00", dayLabel: "Terça" },
    ...overrides
});

const sub = (id) => fakeDb.get(`companys/tk/subscriptions/${id}`);
const schedules = () => Object.values(fakeDb.get("companys/tk/schedules") || {});


/* =====================================================
   CARTÃO
===================================================== */

test("cartão: assina, grava o aceite, indexa e já reserva o primeiro horário", async () => {

    const res = await api(subscribeBody(), "ana");

    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.result.status, "authorized");
    assert.equal(res.body.result.redirectUrl, null);
    assert.equal(res.body.result.firstBooking.status, "booked");

    /* Resposta sem e-mail. */
    assert.equal(JSON.stringify(res.body).includes("ana@mail.com"), false);

    const created = mp.calls.find((item) => item.pathname === "/preapproval" && item.method === "POST");
    assert.equal(created.auth, "Bearer SELLER_TOKEN");
    assert.equal(created.body.status, "authorized");
    assert.equal(created.body.auto_recurring.transaction_amount, 99.9);
    assert.equal(created.body.external_reference, "ana_plano");

    const saved = sub("ana_plano");
    assert.equal(saved.consent.version, require("../subscriptions-core").CONSENT_VERSION);
    assert.equal(saved.consent.terms.price, 99.9);
    assert.equal(saved.method, "card");
    assert.ok(saved.startedAt);

    assert.deepEqual(fakeDb.get(`subscriptionsIndex/${saved.mercadoPagoPreapprovalId}`).subscriptionId, "ana_plano");

    const booked = schedules().filter((item) => item.subscriptionId === "ana_plano");
    assert.equal(booked.length, 1);
    assert.equal(booked[0].day, IN_3_DAYS);
    assert.equal(booked[0].userId, "ana");
});

test("cartão: assinar de novo o mesmo plano é recusado", async () => {

    const res = await api(subscribeBody(), "ana");

    assert.equal(res.statusCode, 409);
    assert.equal(res.body.code, "already_active");
});

test("sem login, sem aceite ou com aceite antigo não assina", async () => {

    assert.equal((await api(subscribeBody(), null)).statusCode, 401);
    assert.equal((await api(subscribeBody({ consent: { accepted: false } }), "bia")).statusCode, 400);
    assert.equal((await api(subscribeBody({ consent: { accepted: true, version: "1999-01-01" } }), "bia")).statusCode, 400);
});

test("recusa do Mercado Pago vira mensagem que dá para resolver", async () => {

    mp.reject = "CC_VAL_433 Credit card validation has failed";

    const res = await api(subscribeBody(), "bia");

    mp.reject = null;

    assert.equal(res.statusCode, 400);
    assert.equal(res.body.code, "CARD_NOT_VALIDATED");
    assert.equal(sub("bia_plano"), null);
});

test("mensalidade em dia agenda pela bookingsApi (com a trava dos 30 minutos de sempre)", async () => {

    const booking = {
        action: "create",
        handle: "tk",
        productId: "plano",
        professionalId: "pro1",
        clientId: "c0ffee00-1234-4abc-9def-001122334455",
        day: IN_5_DAYS,
        hour: "15:00",
        userName: "Ana",
        subscriptionId: "ana_plano"
    };

    /* A primeira foi criada pela assinatura agora há pouco. */
    const tooSoon = await bookingsApi(booking, "ana");
    assert.equal(tooSoon.statusCode, 429);
    assert.equal(tooSoon.body.code, "recent_booking");

    const [firstId] = Object.entries(fakeDb.get("companys/tk/schedules")).find(([, item]) => item.subscriptionId === "ana_plano");
    fakeDb.put(`companys/tk/schedules/${firstId}/timestamp`, new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

    const ok = await bookingsApi(booking, "ana");
    assert.equal(ok.statusCode, 200, JSON.stringify(ok.body));
    assert.equal(ok.body.result.schedule.subscriptionId, "ana_plano");

    /* Sem assinatura, o mesmo plano é recusado. */
    const stranger = await bookingsApi({ ...booking, subscriptionId: undefined, hour: "17:00" }, "zeca");
    assert.equal(stranger.statusCode, 402);
    assert.equal(stranger.body.code, "subscription_required");
});


/* =====================================================
   COBRANÇAS (webhook)
===================================================== */

test("webhook: cobrança agendada não marca atraso; recusada marca; paga volta a ativa", async () => {

    const preapprovalId = sub("ana_plano").mercadoPagoPreapprovalId;

    mp.invoices.inv1 = { id: "inv1", preapproval_id: preapprovalId, status: "scheduled", transaction_amount: 99.9 };

    await subscriptions.handleNotification({ topic: "subscription_charge", id: "inv1", sellerId: "999" });
    assert.equal(sub("ana_plano").status, "authorized");

    Object.assign(mp.invoices.inv1, { status: "recycling", payment: { id: 501, status: "rejected" }, debit_date: new Date().toISOString() });

    await subscriptions.handleNotification({ topic: "subscription_charge", id: "inv1", sellerId: "999" });
    assert.equal(sub("ana_plano").status, "past_due");
    assert.equal(sub("ana_plano").charges.inv1.failed, true);

    Object.assign(mp.invoices.inv1, { status: "processed", payment: { id: 501, status: "approved" } });

    await subscriptions.handleNotification({ topic: "subscription_charge", id: "inv1", sellerId: "999" });
    assert.equal(sub("ana_plano").status, "authorized");
    assert.ok(sub("ana_plano").lastPaidAt);
});


/* =====================================================
   CONTA MERCADO PAGO
===================================================== */

test("conta Mercado Pago: nasce pendente, devolve o link e só reserva depois de autorizar", async () => {

    const res = await api(subscribeBody({ method: "account", cardTokenId: undefined, booking: { professionalId: "pro1", day: IN_3_DAYS, hour: "16:00" } }), "caio");

    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.result.status, "pending");
    assert.match(res.body.result.redirectUrl, /mercadopago\.com\.br\/subscriptions\/checkout/);
    assert.equal(schedules().filter((item) => item.subscriptionId === "caio_plano").length, 0);

    /* A pessoa autoriza no site do Mercado Pago e volta. */
    mp.preapprovals[sub("caio_plano").mercadoPagoPreapprovalId].status = "authorized";

    const synced = await api({ action: "sync", handle: "tk", subscriptionId: "caio_plano" }, "caio");

    assert.equal(synced.body.result.status, "authorized");
    assert.equal(synced.body.result.firstBooking.status, "booked");

    /* Webhook repetido não duplica o agendamento. */
    await subscriptions.handleNotification({ topic: "subscription", id: sub("caio_plano").mercadoPagoPreapprovalId });
    assert.equal(schedules().filter((item) => item.subscriptionId === "caio_plano").length, 1);
});

test("horário tomado antes da autorização: assinatura vale e a tela é avisada", async () => {

    const res = await api(subscribeBody({ method: "account", cardTokenId: undefined, booking: { professionalId: "pro1", day: IN_3_DAYS, hour: "16:00" } }), "duda");

    mp.preapprovals[sub("duda_plano").mercadoPagoPreapprovalId].status = "authorized";

    const synced = await api({ action: "sync", handle: "tk", subscriptionId: "duda_plano" }, "duda");

    assert.equal(res.statusCode, 200);
    assert.equal(synced.body.result.status, "authorized");
    assert.equal(synced.body.result.firstBooking.status, "failed");
    assert.equal(synced.body.result.firstBooking.code, "slot_taken");
});

test("só o dono ou a equipe sincroniza", async () => {

    assert.equal((await api({ action: "sync", handle: "tk", subscriptionId: "caio_plano" }, "intruso")).statusCode, 404);
    assert.equal((await api({ action: "sync", handle: "tk", subscriptionId: "caio_plano" }, "owner")).statusCode, 200);
});


/* =====================================================
   CANCELAMENTO
===================================================== */

test("cancelar: para no Mercado Pago, mantém o acesso pago e desmarca o que passa dele", async () => {

    /* Um horário depois do fim do período pago (45 dias). */
    fakeDb.put("companys/tk/schedules/futuro", {
        productId: "plano", subscriptionId: "caio_plano", userId: "caio", professionalId: "pro1",
        day: IN_45_DAYS, hour: "09:00", status: "pending"
    });

    const before = sub("caio_plano");

    const res = await api({ action: "cancel", handle: "tk", subscriptionId: "caio_plano" }, "caio");

    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(res.body.result.status, "cancelled");
    assert.equal(res.body.result.accessUntil, before.nextBillingAt);
    assert.equal(mp.preapprovals[before.mercadoPagoPreapprovalId].status, "cancelled");

    assert.equal(fakeDb.get("companys/tk/schedules/futuro/status"), "cancelados");
    assert.equal(schedules().find((item) => item.subscriptionId === "caio_plano" && item.day === IN_3_DAYS).status, "pending");

    /* Ainda dá para usar o que foi pago... */
    assert.equal(require("../bookings-core").isSubscriptionUsable(sub("caio_plano")), true);
    assert.equal(fakeDb.get(`subscriptionsIndex/${before.mercadoPagoPreapprovalId}/open`), false);
});

test("fidelidade: o cliente não cancela antes do prazo; a empresa pode", async () => {

    const created = await api(subscribeBody({ productId: "fiel", booking: undefined }), "eva");
    assert.equal(created.statusCode, 200, JSON.stringify(created.body));

    const blocked = await api({ action: "cancel", handle: "tk", subscriptionId: "eva_fiel" }, "eva");
    assert.equal(blocked.statusCode, 409);
    assert.equal(blocked.body.code, "loyalty");

    const byCompany = await api({ action: "cancel", handle: "tk", subscriptionId: "eva_fiel" }, "owner");
    assert.equal(byCompany.statusCode, 200);
    assert.equal(sub("eva_fiel").cancelledBy, "company");
});

test("arrependimento (7 dias): cancela, estorna a cobrança e desmarca os horários", async () => {

    const created = await api(subscribeBody({ productId: "fiel", booking: { professionalId: "pro1", day: IN_5_DAYS, hour: "11:00" } }), "fabi");
    assert.equal(created.statusCode, 200, JSON.stringify(created.body));

    const preapprovalId = sub("fabi_fiel").mercadoPagoPreapprovalId;

    mp.invoices.inv9 = {
        id: "inv9", preapproval_id: preapprovalId, status: "processed",
        transaction_amount: 150, debit_date: new Date().toISOString(), payment: { id: 900, status: "approved" }
    };

    const res = await api({ action: "cancel", handle: "tk", subscriptionId: "fabi_fiel", withdrawal: true }, "fabi");

    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.deepEqual(res.body.result.refund, { refunded: 150, failed: 0 });
    assert.deepEqual(mp.refunds, ["900"]);
    assert.equal(sub("fabi_fiel").accessUntil, undefined);
    assert.equal(require("../bookings-core").isSubscriptionUsable(sub("fabi_fiel")), false);
    assert.equal(schedules().find((item) => item.subscriptionId === "fabi_fiel").status, "cancelados");
});


/* =====================================================
   SINCRONIZAÇÃO DIÁRIA
===================================================== */

test("diária: apaga tentativa abandonada e executa cancelamento agendado", async () => {

    /* Tentativa pela conta MP feita há 3 dias e nunca concluída. */
    await api(subscribeBody({ method: "account", cardTokenId: undefined, booking: undefined }), "gil");
    fakeDb.put("companys/tk/subscriptions/gil_plano/createdAt", Date.now() - 3 * DAY);
    const abandoned = sub("gil_plano").mercadoPagoPreapprovalId;

    /* Assinatura com cancelamento agendado para ontem. */
    await api(subscribeBody({ booking: undefined }), "hugo");
    fakeDb.put("companys/tk/subscriptions/hugo_plano/cancelScheduledFor", Date.now() - DAY);
    const scheduled = sub("hugo_plano").mercadoPagoPreapprovalId;

    const summary = await subscriptions.runDailySync();

    assert.equal(sub("gil_plano"), null);
    assert.equal(fakeDb.get(`subscriptionsIndex/${abandoned}`), null);
    assert.equal(mp.preapprovals[abandoned].status, "cancelled");

    assert.equal(sub("hugo_plano").status, "cancelled");
    assert.equal(mp.preapprovals[scheduled].status, "cancelled");
    assert.ok(sub("hugo_plano").accessUntil > Date.now());

    assert.equal(summary.errors, 0);
    assert.ok(summary.expired >= 1 && summary.cancelled >= 1);
});

test("assinar de novo depois de cancelada guarda o histórico da anterior", async () => {

    const res = await api(subscribeBody({ booking: undefined }), "hugo");

    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    assert.equal(sub("hugo_plano").status, "authorized");

    const history = fakeDb.get("companys/tk/subscriptionHistory/hugo_plano");
    assert.equal(Object.values(history)[0].status, "cancelled");
});
