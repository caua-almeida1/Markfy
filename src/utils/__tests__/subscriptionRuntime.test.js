import {
    CONSENT_VERSION,
    getCancellationRules,
    getSubscriptionStatusInfo,
    isSubscriptionUsable,
    isSubscriptionVisible
} from "../subscriptionRuntime";

/* As regras da tela espelham functions-backend/subscriptions-core.js:
   o que o cliente lê antes de cancelar tem que ser o que o backend faz. */

const DAY = 86400000;
const NOW = new Date("2026-10-24T12:00:00-03:00");

describe("mensalidade — regras mostradas ao cliente", () => {

    it("usa a mesma versão de aceite do backend", () => {
        // eslint-disable-next-line global-require
        const core = require("../../../functions-backend/subscriptions-core");
        expect(CONSENT_VERSION).toBe(core.CONSENT_VERSION);
    });

    it("cancelada vale até o fim do período pago; pendente não vale", () => {
        const now = NOW.getTime();

        expect(isSubscriptionUsable({ status: "authorized" }, now)).toBe(true);
        expect(isSubscriptionUsable({ status: "past_due" }, now)).toBe(true);
        expect(isSubscriptionUsable({ status: "cancelled", accessUntil: now + DAY }, now)).toBe(true);
        expect(isSubscriptionUsable({ status: "cancelled", accessUntil: now - 1 }, now)).toBe(false);
        expect(isSubscriptionUsable({ status: "pending" }, now)).toBe(false);

        expect(isSubscriptionVisible({ status: "pending" }, now)).toBe(true);
        expect(isSubscriptionVisible({ status: "cancelled" }, now)).toBe(false);
    });

    it("cancelamento comum: imediato, com acesso até a próxima cobrança", () => {
        const regras = getCancellationRules(
            { status: "authorized", startedAt: NOW.getTime() - 20 * DAY, nextBillingAt: NOW.getTime() + 10 * DAY },
            NOW
        );

        expect(regras.agendado).toBe(false);
        expect(regras.acessoAte.getTime()).toBe(NOW.getTime() + 10 * DAY);
        expect(regras.arrependimento).toBe(false);
    });

    it("aviso prévio maior que o período pago vira cancelamento agendado", () => {
        const regras = getCancellationRules(
            { status: "authorized", startedAt: NOW.getTime() - 25 * DAY, nextBillingAt: NOW.getTime() + 5 * DAY, cancellationNoticeDays: 15 },
            NOW
        );

        expect(regras.agendado).toBe(true);
        expect(regras.acessoAte).toBe(null);
    });

    it("fidelidade bloqueia, mas o arrependimento dos 7 dias continua disponível", () => {
        const regras = getCancellationRules(
            { status: "authorized", startedAt: NOW.getTime() - 2 * DAY, loyaltyMonths: 6 },
            NOW
        );

        expect(regras.emFidelidade).toBe(true);
        expect(regras.arrependimento).toBe(true);
    });

    it("tentativa pendente não tem fidelidade nem aviso prévio", () => {
        const regras = getCancellationRules({ status: "pending", loyaltyMonths: 6, cancellationNoticeDays: 30 }, NOW);

        expect(regras.emFidelidade).toBe(false);
        expect(regras.agendado).toBe(false);
    });

    it("rótulos de estado", () => {
        const now = NOW.getTime();

        expect(getSubscriptionStatusInfo({ status: "authorized" }, now).tone).toBe("active");
        expect(getSubscriptionStatusInfo({ status: "authorized", cancelScheduledFor: now + DAY }, now).tone).toBe("ending");
        expect(getSubscriptionStatusInfo({ status: "pending" }, now).label).toBe("Aguardando confirmação");
        expect(getSubscriptionStatusInfo({ status: "past_due" }, now).tone).toBe("late");
        expect(getSubscriptionStatusInfo({ status: "cancelled", accessUntil: now + DAY }, now).tone).toBe("ending");
        expect(getSubscriptionStatusInfo({ status: "cancelled", accessUntil: now - DAY }, now).label).toBe("Encerrada");
    });
});
