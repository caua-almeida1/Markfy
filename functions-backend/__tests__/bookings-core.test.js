/* Rodar: node --test functions-backend/__tests__ */

const test = require("node:test");
const assert = require("node:assert/strict");

const core = require("../bookings-core");

/* 21/10/2026 12:00 em Brasília. */
const NOW = new Date("2026-10-21T12:00:00-03:00").getTime();

const PRODUCT = {
    name: "Corte",
    value: "R$ 35,00",
    discountedPrice: "R$ 25,00",
    duration: 30,
    status: "ativos",
    relatedUsers: [{ id: "pro1", role: "professional" }]
};

test("toDate lê dd/mm/aaaa HH:MM no horário de Brasília", () => {
    const date = core.toDate("21/10/2026", "14:30");
    assert.equal(date.toISOString(), "2026-10-21T17:30:00.000Z");
});

test("toDate recusa datas e horas impossíveis", () => {
    assert.equal(core.toDate("31/02/2026", "10:00"), null);
    assert.equal(core.toDate("21/10/2026", "24:00"), null);
    assert.equal(core.toDate("2026-10-21", "10:00"), null);
    assert.equal(core.toDate(undefined, "10:00"), null);
});

test("preço efetivo segue a promoção válida", () => {
    assert.equal(core.effectivePrice(PRODUCT), 25);
    assert.match(core.effectivePriceLabel(PRODUCT), /25,00/);
    assert.equal(core.effectivePriceLabel({ value: "Sob consulta" }), "Sob consulta");
    /* Promoção maior que o normal não é promoção. */
    assert.equal(core.effectivePrice({ value: "R$ 20,00", discountedPrice: "R$ 30,00" }), 20);
    assert.equal(core.parsePrice("R$ 1.234,56"), 1234.56);
});

test("isBookingsOpen respeita plano e vencimento", () => {
    assert.equal(core.isBookingsOpen({ bookings: true }, NOW), true);
    assert.equal(core.isBookingsOpen({ bookings: true, expiresAt: NOW - 1 }, NOW), false);
    assert.equal(core.isBookingsOpen({ bookings: false }, NOW), false);
    assert.equal(core.isBookingsOpen(null, NOW), false);
});

test("relatedIds aceita lista ou objeto", () => {
    assert.deepEqual(core.relatedIds(PRODUCT), ["pro1"]);
    assert.deepEqual(core.relatedIds({ relatedUsers: { a: { id: "x" }, b: "y" } }), ["x", "y"]);
    assert.deepEqual(core.relatedIds({}), []);
});

test("busySlots ignora cancelados, outros profissionais e o passado, e não expõe cliente", () => {
    const schedules = {
        a: { professionalId: "pro1", day: "22/10/2026", hour: "10:00", status: "pending", userName: "Ana", clientId: "c1", totalDuration: 60 },
        b: { professionalId: "pro1", day: "22/10/2026", hour: "11:00", status: "cancelados" },
        c: { professionalId: "pro2", day: "22/10/2026", hour: "12:00", status: "pending" },
        d: { professionalId: "pro1", day: "01/01/2026", hour: "09:00", status: "pending" },
        e: { professionalId: "pro1", day: "23/10/2026", hour: "15:00", status: "confirmed" }
    };

    const busy = core.busySlots(schedules, "pro1", NOW);

    assert.deepEqual(busy, [
        { day: "22/10/2026", hour: "10:00", duration: 60 },
        { day: "23/10/2026", hour: "15:00" }
    ]);
    assert.ok(busy.every((slot) => !("clientId" in slot) && !("userName" in slot)));
});

test("hasConflict detecta sobreposição pela duração", () => {
    const busy = [{ day: "22/10/2026", hour: "10:00", duration: 60 }];

    assert.equal(core.hasConflict(busy, "22/10/2026", "10:30", 30), true);
    assert.equal(core.hasConflict(busy, "22/10/2026", "09:30", 30), false);
    assert.equal(core.hasConflict(busy, "22/10/2026", "09:45", 30), true);
    assert.equal(core.hasConflict(busy, "22/10/2026", "11:00", 30), false);
    assert.equal(core.hasConflict(busy, "23/10/2026", "10:00", 30), false);
    /* Ocupado sem duração dura o mesmo que o serviço pedido. */
    assert.equal(core.hasConflict([{ day: "22/10/2026", hour: "10:00" }], "22/10/2026", "10:40", 45), true);
});

test("parseCreate valida o pedido e limpa os textos", () => {
    const ok = core.parseCreate({
        handle: "tkbarbearia",
        productId: "LGfVU66by7oK",
        professionalId: "pro1",
        clientId: "6f1c2a3b-1111-2222-3333-444455556666",
        day: "22/10/2026",
        hour: "10:00",
        userName: "  Maria\u0000 ",
        notes: "x".repeat(900),
        extraProductIds: ["e1", "e1", "LGfVU66by7oK", "../bad"]
    }, NOW);

    assert.equal(ok.error, undefined);
    assert.equal(ok.value.userName, "Maria");
    assert.equal(ok.value.notes.length, 500);
    assert.deepEqual(ok.value.extraProductIds, ["e1"]);

    const base = { handle: "h", productId: "p", professionalId: "pro1", clientId: "abcdefgh1", userName: "A" };

    assert.ok(core.parseCreate({ ...base, day: "20/10/2026", hour: "10:00" }, NOW).error, "data passada");
    assert.ok(core.parseCreate({ ...base, day: "22/10/2027", hour: "10:00" }, NOW).error, "longe demais");
    assert.ok(core.parseCreate({ ...base, handle: "a/b", day: "22/10/2026", hour: "10:00" }, NOW).error);
    assert.ok(core.parseCreate({ ...base, userName: " ", day: "22/10/2026", hour: "10:00" }, NOW).error);
    assert.ok(core.parseCreate({ ...base, clientId: "x", day: "22/10/2026", hour: "10:00" }, NOW).error);
});

test("buildSchedule usa preço, duração e nome vindos do banco", () => {
    const request = core.parseCreate({
        handle: "h",
        productId: "p1",
        professionalId: "pro1",
        clientId: "abcdefgh1",
        day: "22/10/2026",
        hour: "10:00",
        userName: "Maria",
        extraProductIds: ["p2"]
    }, NOW).value;

    const schedule = core.buildSchedule({
        request,
        product: PRODUCT,
        extras: [{ id: "p2", name: "Barba", value: "R$ 15,00", duration: 20 }],
        professionalName: "João",
        uid: "u1",
        now: NOW
    });

    assert.equal(schedule.status, "pending");
    assert.equal(schedule.userId, "u1");
    assert.equal(schedule.professionalName, "João");
    assert.equal(schedule.totalDuration, 50);
    assert.match(schedule.productPrice, /40,00/);
    assert.equal(schedule.extraServices[0].name, "Barba");
    assert.equal(schedule.timestamp, new Date(NOW).toISOString());
    assert.equal("source" in schedule, false);
});

test("scheduleIdFor mantém o formato antigo", () => {
    assert.equal(core.scheduleIdFor(NOW), "2026-10-21T15-00-00-000Z");
});

test("ownsSchedule exige conta ou aparelho", () => {
    const schedule = { userId: "u1", clientId: "c1" };
    assert.equal(core.ownsSchedule(schedule, { uid: "u1" }), true);
    assert.equal(core.ownsSchedule(schedule, { clientId: "c1" }), true);
    assert.equal(core.ownsSchedule(schedule, { uid: "u2", clientId: "c2" }), false);
    assert.equal(core.ownsSchedule(schedule, {}), false);
    assert.equal(core.ownsSchedule(null, { uid: "u1" }), false);
});

test("cancelProblem respeita status e antecedência", () => {
    const pending = { status: "pending", day: "22/10/2026", hour: "10:00" };

    assert.equal(core.cancelProblem(pending, null, NOW), null);
    assert.ok(core.cancelProblem(pending, { days: 1 }, NOW), "faltam menos de 24h");
    assert.equal(core.cancelProblem(pending, { hours: 2 }, NOW), null);
    assert.ok(core.cancelProblem({ ...pending, status: "cancelados" }, null, NOW));
    assert.ok(core.cancelProblem({ ...pending, status: "completed" }, null, NOW));
    assert.ok(core.cancelProblem(null, null, NOW));
});

test("bookedRecently bloqueia 30 minutos", () => {
    const schedules = {
        a: { clientId: "c1", timestamp: new Date(NOW - 10 * 60 * 1000).toISOString() },
        b: { clientId: "c2", timestamp: new Date(NOW - 40 * 60 * 1000).toISOString() }
    };

    assert.equal(core.bookedRecently(schedules, { clientId: "c1" }, NOW), true);
    assert.equal(core.bookedRecently(schedules, { clientId: "c2" }, NOW), false);
    assert.equal(core.bookedRecently(schedules, { uid: "u9" }, NOW), false);
});

test("sessionsLeft conta só o ciclo atual e ignora cancelados", () => {
    const subscription = {
        id: "u1_p1",
        status: "authorized",
        startedAt: "2026-10-01T12:00:00.000Z",
        billingCycle: "monthly",
        sessionsPerCycle: 4
    };

    const schedules = {
        a: { subscriptionId: "u1_p1", status: "pending", day: "05/10/2026", hour: "10:00" },
        b: { subscriptionId: "u1_p1", status: "cancelados", day: "06/10/2026", hour: "10:00" },
        c: { subscriptionId: "u1_p1", status: "completed", day: "20/09/2026", hour: "10:00" },
        d: { subscriptionId: "outra", status: "pending", day: "07/10/2026", hour: "10:00" }
    };

    assert.equal(core.sessionsLeft(subscription, schedules, new Date(NOW)), 3);
    assert.equal(core.sessionsLeft({ ...subscription, unlimitedSessions: true }, schedules, new Date(NOW)), null);
    assert.equal(core.isSubscriptionUsable(subscription), true);
    assert.equal(core.isSubscriptionUsable({ status: "cancelled" }), false);
});
