/* Rodar: npm test (em functions-backend) */

const test = require("node:test");
const assert = require("node:assert/strict");

const core = require("../subscriptions-core");

const DAY = 24 * 60 * 60 * 1000;

/* 24/10/2026 12:00 em Brasília. */
const NOW = new Date("2026-10-24T12:00:00-03:00").getTime();

const PRODUCT = {
    name: "Plano Barba Ilimitada",
    type: "monthly",
    value: "R$ 1.299,90",
    discountedPrice: "R$ 99,90",
    monthlyPlan: {
        billingCycle: "monthly",
        unlimitedSessions: false,
        sessionsPerCycle: "4",
        autoRenew: true,
        trialDays: 0,
        loyaltyMonths: 0,
        cancellationNoticeDays: 0,
        price: "R$ 1.299,90"
    }
};

const VALID_BODY = {
    handle: "tkbarbearia",
    productId: "prodA",
    method: "card",
    cardTokenId: "ff8080814c11e237014c1ff593b57b4d",
    payerEmail: "  Cliente@Email.com ",
    userName: "Ana",
    clientId: "c0ffee00-1234-4abc-9def-001122334455",
    consent: { accepted: true, version: core.CONSENT_VERSION }
};


test("planOf lê o plano do banco, usa a promoção válida e entende milhar", () => {

    const plan = core.planOf(PRODUCT);

    assert.equal(plan.price, 99.9);
    assert.equal(plan.months, 1);
    assert.equal(plan.sessionsPerCycle, 4);
    assert.equal(plan.unlimitedSessions, false);

    assert.equal(core.planOf({ ...PRODUCT, discountedPrice: null }).price, 1299.9);
    assert.equal(core.planOf({ ...PRODUCT, type: "individual" }), null);
    assert.equal(core.planOf({ ...PRODUCT, monthlyPlan: { billingCycle: "x" } }).billingCycle, "monthly");
});

test("buildPreapprovalBody: cartão nasce autorizado, conta nasce pendente", () => {

    const plan = core.planOf(PRODUCT);

    const card = core.buildPreapprovalBody({
        productName: PRODUCT.name, plan, subscriptionId: "u1_prodA",
        payerEmail: "a@b.com", method: "card", cardTokenId: "tok123456", backUrl: "https://x", now: NOW
    });

    assert.equal(card.status, "authorized");
    assert.equal(card.card_token_id, "tok123456");
    assert.equal(card.external_reference, "u1_prodA");
    assert.deepEqual(card.auto_recurring, {
        frequency: 1, frequency_type: "months", transaction_amount: 99.9, currency_id: "BRL"
    });

    const account = core.buildPreapprovalBody({
        productName: PRODUCT.name, plan, subscriptionId: "u1_prodA",
        payerEmail: "a@b.com", method: "account", backUrl: "https://x", now: NOW
    });

    assert.equal(account.status, "pending");
    assert.equal(account.card_token_id, undefined);
});

test("buildPreapprovalBody: teste grátis e plano sem renovação automática", () => {

    const plan = { ...core.planOf(PRODUCT), trialDays: 7, autoRenew: false, months: 3 };

    const body = core.buildPreapprovalBody({
        productName: "X", plan, subscriptionId: "s", payerEmail: "a@b.com",
        method: "account", backUrl: "https://x", now: NOW
    });

    assert.deepEqual(body.auto_recurring.free_trial, { frequency: 7, frequency_type: "days" });

    /* Primeira cobrança em 31/10; o ciclo de 3 meses acaba em
       31/01; o fim é um dia antes, para a 2ª cobrança não vir. */
    const end = new Date(body.auto_recurring.end_date).getTime();
    assert.ok(end > NOW + 7 * DAY + 80 * DAY);
    assert.ok(end < NOW + 7 * DAY + 92 * DAY);
});

test("parseSubscribe exige aceite da versão atual, e-mail e token do cartão", () => {

    const ok = core.parseSubscribe(VALID_BODY);
    assert.equal(ok.error, undefined);
    assert.equal(ok.value.payerEmail, "cliente@email.com");
    assert.equal(ok.value.booking, null);

    assert.match(core.parseSubscribe({ ...VALID_BODY, consent: null }).error, /autorizar/);
    assert.match(core.parseSubscribe({ ...VALID_BODY, consent: { accepted: true, version: "2020-01-01" } }).error, /mudaram/);
    assert.match(core.parseSubscribe({ ...VALID_BODY, payerEmail: "sem-arroba" }).error, /e-mail/);
    assert.match(core.parseSubscribe({ ...VALID_BODY, cardTokenId: "" }).error, /cartão/);
    assert.match(core.parseSubscribe({ ...VALID_BODY, method: "pix" }).error, /como pagar/);

    /* Conta Mercado Pago não precisa de token. */
    assert.equal(core.parseSubscribe({ ...VALID_BODY, method: "account", cardTokenId: undefined }).error, undefined);
});

test("parseSubscribe valida o primeiro atendimento sem confiar em nada além das escolhas", () => {

    const withBooking = core.parseSubscribe({
        ...VALID_BODY,
        booking: { professionalId: "pro1", day: "30/10/2026", hour: "10:00", notes: "  oi\u0000 ", price: 1 }
    });

    assert.deepEqual(withBooking.value.booking, {
        professionalId: "pro1", day: "30/10/2026", hour: "10:00", dayLabel: null, notes: "oi"
    });

    assert.match(
        core.parseSubscribe({ ...VALID_BODY, booking: { professionalId: "pro1", day: "31/02/2026", hour: "10:00" } }).error,
        /horário/
    );
});

test("chargeOutcome: agendada não é atraso; recusada e em nova tentativa são", () => {

    assert.deepEqual(core.chargeOutcome({ status: "scheduled" }), { paid: false, failed: false, label: "scheduled" });
    assert.equal(core.chargeOutcome({ status: "processed", payment: { status: "approved" } }).paid, true);
    assert.equal(core.chargeOutcome({ status: "processed", payment: { status: "rejected" } }).failed, true);
    assert.equal(core.chargeOutcome({ status: "recycling", payment: { status: "rejected" } }).failed, true);
    assert.equal(core.chargeOutcome({ status: "processed", payment: { status: "in_process" } }).failed, false);
});

test("chargeRecord não guarda dado de cartão", () => {

    const record = core.chargeRecord({
        id: 77, status: "processed", transaction_amount: 99.9, debit_date: "2026-11-24T10:00:00.000-03:00",
        payment: { id: 123, status: "approved", card: { last_four_digits: "1234" } },
        payer_email: "x@y.com"
    }, NOW);

    assert.deepEqual(Object.keys(record).sort(), ["amount", "chargedAt", "failed", "paid", "paymentId", "retryAttempt", "status", "updatedAt"]);
    assert.equal(record.paymentId, "123");
    assert.equal(JSON.stringify(record).includes("1234"), false);
    assert.equal(JSON.stringify(record).includes("x@y.com"), false);
});

test("syncPatch: autoriza, marca atraso pela última cobrança e preserva o período pago ao cancelar lá fora", () => {

    const pending = { status: "pending", startedAt: null };

    const authorized = core.syncPatch(pending, { status: "authorized", next_payment_date: "2026-11-24T12:00:00.000-03:00" }, NOW);
    assert.equal(authorized.status, "authorized");
    assert.equal(authorized.startedAt, NOW);
    assert.equal(authorized.nextBillingAt, new Date("2026-11-24T12:00:00.000-03:00").getTime());

    const late = core.syncPatch(
        { status: "authorized", startedAt: NOW - 40 * DAY, charges: { a: { paid: true, chargedAt: NOW - 40 * DAY }, b: { failed: true, chargedAt: NOW - DAY } } },
        { status: "authorized" },
        NOW
    );
    assert.equal(late.status, "past_due");

    const recovered = core.syncPatch(
        { status: "past_due", startedAt: NOW - 40 * DAY, charges: { b: { failed: true, chargedAt: NOW - 2 * DAY }, c: { paid: true, chargedAt: NOW - DAY } } },
        { status: "authorized" },
        NOW
    );
    assert.equal(recovered.status, "authorized");

    const cancelledOutside = core.syncPatch(
        { status: "authorized", startedAt: NOW - 5 * DAY, nextBillingAt: NOW + 25 * DAY },
        { status: "cancelled" },
        NOW
    );
    assert.equal(cancelledOutside.status, "cancelled");
    assert.equal(cancelledOutside.cancelledBy, "mercadopago");
    assert.equal(cancelledOutside.accessUntil, NOW + 25 * DAY);

    const cancelledLate = core.syncPatch({ status: "past_due", startedAt: NOW - 40 * DAY }, { status: "cancelled" }, NOW);
    assert.equal(cancelledLate.accessUntil, NOW);
});

test("cancellationDecision: imediato com acesso até o fim do ciclo pago", () => {

    const sub = { status: "authorized", startedAt: NOW - 10 * DAY, nextBillingAt: NOW + 20 * DAY, billingCycle: "monthly" };

    assert.deepEqual(core.cancellationDecision(sub, { now: NOW }), { mode: "immediate", accessUntil: NOW + 20 * DAY });
});

test("cancellationDecision: fidelidade bloqueia o cliente, não a empresa", () => {

    const sub = { status: "authorized", startedAt: NOW - 10 * DAY, nextBillingAt: NOW + 20 * DAY, loyaltyMonths: 3 };

    const client = core.cancellationDecision(sub, { by: "client", now: NOW });
    assert.equal(client.blocked, "loyalty");
    assert.ok(client.loyaltyEndsAt > NOW);

    assert.equal(core.cancellationDecision(sub, { by: "company", now: NOW }).mode, "immediate");
});

test("cancellationDecision: aviso prévio que passa da próxima cobrança vira cancelamento agendado", () => {

    const sub = { status: "authorized", startedAt: NOW - 25 * DAY, nextBillingAt: NOW + 5 * DAY, cancellationNoticeDays: 15 };

    assert.deepEqual(core.cancellationDecision(sub, { now: NOW }), { mode: "scheduled", cancelAt: NOW + 15 * DAY });

    /* Aviso que cabe no ciclo pago: imediato. */
    assert.equal(core.cancellationDecision({ ...sub, cancellationNoticeDays: 3 }, { now: NOW }).mode, "immediate");
});

test("cancellationDecision: arrependimento só nos 7 dias e só pelo cliente", () => {

    const fresh = { status: "authorized", startedAt: NOW - 2 * DAY, nextBillingAt: NOW + 28 * DAY, loyaltyMonths: 12 };

    /* Fidelidade não vale contra o direito de arrependimento. */
    assert.deepEqual(core.cancellationDecision(fresh, { withdrawal: true, now: NOW }), { mode: "withdrawal", accessUntil: null });

    assert.match(core.cancellationDecision({ ...fresh, startedAt: NOW - 8 * DAY }, { withdrawal: true, now: NOW }).error, /7 dias/);
    assert.match(core.cancellationDecision(fresh, { by: "company", withdrawal: true, now: NOW }).error, /7 dias/);
});

test("cancellationDecision: pendente cancela sem acesso; cancelada não cancela de novo", () => {

    assert.deepEqual(core.cancellationDecision({ status: "pending" }, { now: NOW }), { mode: "immediate", accessUntil: null });
    assert.match(core.cancellationDecision({ status: "cancelled" }, { now: NOW }).error, /já foi cancelada/);
});

test("consentRecord guarda versão, data e termos — sem IP nem aparelho", () => {

    const record = core.consentRecord({ plan: core.planOf(PRODUCT), method: "card", now: NOW });

    assert.equal(record.version, core.CONSENT_VERSION);
    assert.equal(record.acceptedAt, NOW);
    assert.equal(record.terms.price, 99.9);
    assert.equal(record.terms.withdrawalDays, 7);
    assert.equal(JSON.stringify(record).includes("ip"), false);
});

test("explainRejection separa problema da conta da empresa de problema do cartão", () => {

    assert.equal(core.explainRejection("Payer and collector cannot be the same user").code, "SAME_ACCOUNT");
    assert.equal(core.explainRejection("Unauthorized use of live credentials").ownerAction, true);
    assert.equal(core.explainRejection("CC_VAL_433 Credit card validation has failed").code, "CARD_NOT_VALIDATED");
    assert.equal(core.explainRejection("").code, "MERCADO_PAGO_REJECTED");
});

test("publicView não expõe e-mail, aceite nem cobranças", () => {

    const view = core.publicView("u1_p", {
        status: "authorized", payerEmail: "a@b.com", consent: {}, charges: {}, uid: "u1",
        firstBooking: { status: "failed", code: "slot_taken", message: "Horário ocupado", request: { day: "x" } }
    });

    assert.equal(JSON.stringify(view).includes("a@b.com"), false);
    assert.equal(view.consent, undefined);
    assert.equal(view.firstBooking.request, undefined);
    assert.equal(view.firstBooking.code, "slot_taken");
});
