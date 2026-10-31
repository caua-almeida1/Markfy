/* =====================================================
   MARKFY — MENSALIDADES (REGRAS PURAS)

   Tudo aqui é função pura (sem Firebase nem rede), para ser
   testado com `node --test` e usado pela subscriptionsApi.

   COMO A COBRANÇA FUNCIONA

   A cobrança recorrente é uma "preapproval" (assinatura) do
   Mercado Pago, criada na conta da EMPRESA (token do OAuth).
   O Mercado Pago guarda a autorização e cobra sozinho a cada
   ciclo; a Markfy só espelha o estado em

       companys/{handle}/subscriptions/{uid}_{productId}

   Dois jeitos de pagar:

     card     cartão de crédito digitado no Markfy (Card
              Payment Brick gera um token; o número nunca
              passa por aqui). A assinatura nasce autorizada.

     account  conta Mercado Pago: a assinatura nasce
              "pending" e a pessoa autoriza no site do
              Mercado Pago, com saldo ou cartão salvo lá.
              Volta para /assinatura/retorno.

   STATUS LOCAIS (os do Mercado Pago, mais past_due)

     pending     esperando a pessoa autorizar
     authorized  ativa, cobrando
     past_due    a última cobrança falhou; o Mercado Pago
                 tenta de novo sozinho
     paused      pausada no Mercado Pago
     cancelled   encerrada (pode valer até accessUntil)

   SITUAÇÃO DO PAGAMENTO (paymentStatus), separada do status
   da assinatura — "autorizada" não quer dizer "paga":

     awaiting_authorization  a pessoa ainda não autorizou
     trial                   teste grátis, sem cobrança ainda
     processing              autorizada, 1ª cobrança a caminho
                             (o Mercado Pago cobra em até ~1 h)
     paid                    a cobrança mais recente foi paga
     failed                  a cobrança mais recente foi recusada

   O gateway entra por payments/providers.js: aqui só chegam
   objetos normalizados (assinatura e cobrança).
===================================================== */

const crypto = require("crypto");

const bookingsCore = require("./bookings-core");

const DAY_MS = 24 * 60 * 60 * 1000;

/* Versão do texto de autorização mostrado ao cliente
   (src/components/subscription-checkout). Mudou o texto,
   muda a versão: o aceite gravado aponta para o que a pessoa
   leu de fato. */
const CONSENT_VERSION = "2026-10-24";

/* Direito de arrependimento (CDC, art. 49): sete dias a
   partir da contratação. */
const WITHDRAWAL_DAYS = 7;

/* Tentativa de assinar pela conta Mercado Pago que ninguém
   concluiu: depois disso é cancelada e apagada (LGPD, art.
   16 — não há contrato, não há por que guardar o e-mail). */
const PENDING_TTL_MS = 2 * DAY_MS;

const METHODS = ["card", "account"];

const STATUS = {
    PENDING: "pending",
    ACTIVE: "authorized",
    PAST_DUE: "past_due",
    PAUSED: "paused",
    CANCELLED: "cancelled"
};

const CYCLES = {
    monthly: { months: 1, label: "todo mês" },
    quarterly: { months: 3, label: "a cada 3 meses" },
    semiannual: { months: 6, label: "a cada 6 meses" },
    annual: { months: 12, label: "uma vez por ano" }
};

const cycleOf = (id) =>
    CYCLES[id]
        ? { id, ...CYCLES[id] }
        : { id: "monthly", ...CYCLES.monthly };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const normalizeEmail = (value) => {

    const email = typeof value === "string" ? value.trim().toLowerCase() : "";

    return email.length <= 254 && EMAIL.test(email) ? email : null;
};

const toCount = (value) => {

    const number = parseInt(value, 10);

    return Number.isFinite(number) && number > 0 ? number : 0;
};


/* -----------------------------------------------------
   PLANO

   Lido do produto no banco — nunca do navegador. O preço é
   o que o cliente viu: o promocional, quando é menor.
----------------------------------------------------- */

const planOf = (product) => {

    if (!product || product.type !== "monthly") return null;

    const stored = product.monthlyPlan || {};
    const cycle = cycleOf(stored.billingCycle);

    const normal =
        bookingsCore.parsePrice(stored.price) ||
        bookingsCore.parsePrice(product.value);

    const promo = bookingsCore.parsePrice(product.discountedPrice);

    const price = normal > 0 && promo > 0 && promo < normal ? promo : normal;

    const unlimitedSessions = stored.unlimitedSessions !== false;

    return {
        billingCycle: cycle.id,
        months: cycle.months,
        cycleLabel: cycle.label,
        price: Math.round(price * 100) / 100,
        currency: "BRL",
        unlimitedSessions,
        sessionsPerCycle: unlimitedSessions ? 0 : toCount(stored.sessionsPerCycle),
        autoRenew: stored.autoRenew !== false,
        trialDays: toCount(stored.trialDays),
        loyaltyMonths: toCount(stored.loyaltyMonths),
        cancellationNoticeDays: toCount(stored.cancellationNoticeDays)
    };
};


/* -----------------------------------------------------
   CALENDÁRIO DA COBRANÇA
----------------------------------------------------- */

/** Data da primeira cobrança: hoje, ou depois do teste grátis. */
const firstChargeAt = (plan, now = Date.now()) =>
    now + (plan.trialDays || 0) * DAY_MS;

/**
 * Quando cobrar, no formato que o provedor entende:
 *
 *   startAt  só com teste grátis: a primeira cobrança fica
 *            para o fim do teste. (Assinatura sem plano não
 *            aceita free_trial — mandado assim, o teste era
 *            ignorado e a pessoa era cobrada na hora.)
 *   endAt    só sem renovação automática: um ciclo e acabou.
 *            Fica um dia antes da segunda cobrança, para ela
 *            nunca acontecer.
 */
const billingSchedule = (plan, now = Date.now()) => {

    const first = firstChargeAt(plan, now);

    const endAt = plan.autoRenew
        ? null
        : bookingsCore.addMonths(new Date(first), plan.months).getTime() - DAY_MS;

    return {
        firstChargeAt: first,
        startAt: plan.trialDays > 0 ? first : null,
        endAt,
        trialEndsAt: plan.trialDays > 0 ? first : null
    };
};


/* -----------------------------------------------------
   PEDIDO DO NAVEGADOR
----------------------------------------------------- */

const parseSubscribe = (body, consentVersion = CONSENT_VERSION) => {

    const input = body && typeof body === "object" ? body : {};

    if (!bookingsCore.isHandle(input.handle)) return { error: "Empresa inválida." };
    if (!bookingsCore.isKey(input.productId)) return { error: "Plano inválido." };
    if (!METHODS.includes(input.method)) return { error: "Escolha como pagar." };

    const payerEmail = normalizeEmail(input.payerEmail);

    if (!payerEmail) return { error: "Informe um e-mail válido." };

    if (input.method === "card" && (typeof input.cardTokenId !== "string" || !/^[A-Za-z0-9]{8,64}$/.test(input.cardTokenId))) {
        return { error: "Os dados do cartão não chegaram. Digite de novo." };
    }

    /* O aceite precisa ser explícito e da versão atual do texto:
       um navegador com a página antiga não assina por termos
       que a pessoa não leu. */
    if (!input.consent || input.consent.accepted !== true) {
        return { error: "É preciso autorizar a cobrança recorrente para assinar." };
    }

    if (input.consent.version !== consentVersion) {
        return { error: "Os termos da assinatura mudaram. Atualize a página e leia de novo." };
    }

    const userName = bookingsCore.text(input.userName, 80);

    if (!userName) return { error: "Informe seu nome." };

    /* Primeiro atendimento (opcional): só as escolhas. Quem
       confere horário, profissional e antecedência é a
       bookingsApi, na hora em que a assinatura é autorizada. */
    let booking = null;

    if (input.booking && typeof input.booking === "object") {

        const b = input.booking;

        if (!bookingsCore.isKey(b.professionalId) || !bookingsCore.toDate(b.day, b.hour)) {
            return { error: "O horário escolhido é inválido. Escolha de novo." };
        }

        booking = {
            professionalId: b.professionalId,
            day: b.day,
            hour: b.hour,
            dayLabel: bookingsCore.text(b.dayLabel, 80) || null,
            notes: bookingsCore.text(b.notes, 300) || null
        };
    }

    return {
        value: {
            handle: input.handle,
            productId: input.productId,
            method: input.method,
            cardTokenId: input.method === "card" ? input.cardTokenId : null,
            payerEmail,
            userName,
            clientId: bookingsCore.isClientId(input.clientId) ? input.clientId : null,
            booking
        }
    };
};


/* -----------------------------------------------------
   ESTADO VINDO DO GATEWAY

   `state` e `charge` chegam normalizados pelo provedor
   (toSubscription / toCharge em payments/mercadopago.js).
----------------------------------------------------- */

const PROVIDER_STATUSES = ["pending", "authorized", "paused", "cancelled"];

/**
 * Registro gravado em subscriptions/{id}/charges/{chargeId}:
 * valor, data, situação e o id do pagamento. Nada de cartão.
 */
const chargeRecord = (charge, now = Date.now()) => ({
    amount: charge.amount || null,
    status: charge.label || "scheduled",
    paid: Boolean(charge.paid),
    failed: Boolean(charge.failed),
    paymentId: charge.paymentId || null,
    retryAttempt: Number(charge.retryAttempt) || 0,
    chargedAt: charge.chargedAt || null,
    updatedAt: now
});

/** A cobrança mais recente que já teve resultado (paga ou recusada). */
const latestSettledCharge = (charges) =>
    Object.values(charges || {})
        .filter((item) => item && (item.paid || item.failed))
        .sort((a, b) => (b.chargedAt || 0) - (a.chargedAt || 0))[0] || null;


/** Fim do período já pago: a próxima cobrança, ou o fim do ciclo atual. */
const paidUntil = (subscription, now = Date.now()) => {

    const next = Number(subscription && subscription.nextBillingAt);

    if (next > now) return next;

    return bookingsCore.cycleWindow(subscription, new Date(now)).end.getTime();
};

/**
 * Situação do pagamento, separada do status da assinatura:
 * só "paid" quando o gateway diz que a cobrança mais recente
 * foi aprovada. Ser redirecionado para a página de sucesso,
 * ou a assinatura estar "authorized", não é pagamento.
 */
const paymentStatusOf = (subscription, now = Date.now()) => {

    const s = subscription || {};

    if (s.status === STATUS.PENDING) return "awaiting_authorization";

    const last = latestSettledCharge(s.charges);

    if (last && last.failed) return "failed";
    if (last && last.paid) return "paid";

    if (Number(s.trialEndsAt) > now) return "trial";

    return "processing";
};

/**
 * Novo estado local a partir da assinatura lida do gateway
 * (e das cobranças já registradas). Devolve só o que muda —
 * o chamador faz o update.
 */
const syncPatch = (local, state, now = Date.now()) => {

    const current = local || {};
    const mpStatus = PROVIDER_STATUSES.includes(state && state.status)
        ? state.status
        : current.status || STATUS.PENDING;

    const patch = { lastSyncAt: now, updatedAt: now };

    /* Status que a Markfy não conhece fica registrado (para
       diagnóstico), sem mudar o estado local. */
    if (state && state.providerStatus) patch.providerStatus = state.providerStatus;

    if (state && state.nextBillingAt) patch.nextBillingAt = state.nextBillingAt;

    if (mpStatus === STATUS.ACTIVE) {

        const last = latestSettledCharge(current.charges);

        patch.status = last && last.failed ? STATUS.PAST_DUE : STATUS.ACTIVE;

        /* O ciclo conta da autorização, não da criação: na
           conta Mercado Pago a pessoa pode autorizar horas
           depois. */
        if (!current.startedAt) patch.startedAt = now;

    } else if (mpStatus === STATUS.CANCELLED) {

        patch.status = STATUS.CANCELLED;

        /* Cancelada lá fora (pela pessoa no app do Mercado Pago,
           ou por falta de pagamento): mantém o que já foi pago. */
        if (current.status !== STATUS.CANCELLED) {
            patch.cancelledAt = now;
            patch.cancelledBy = current.cancelledBy || "mercadopago";
            patch.accessUntil =
                current.status === STATUS.ACTIVE && current.startedAt
                    ? paidUntil({ ...current, ...patch }, now)
                    : now;
        }

    } else {

        patch.status = mpStatus;
    }

    patch.paymentStatus = paymentStatusOf({ ...current, ...patch }, now);

    return patch;
};


/* -----------------------------------------------------
   PAUSAR E REATIVAR (só a empresa)

   Pausada, o gateway não cobra e a pessoa não agenda pela
   mensalidade. Reativar volta a cobrar no ciclo seguinte.
----------------------------------------------------- */

const pauseDecision = (subscription) => {

    if (!subscription) return { error: "Assinatura não encontrada." };

    if (subscription.status !== STATUS.ACTIVE && subscription.status !== STATUS.PAST_DUE) {
        return { error: "Só dá para pausar uma assinatura ativa." };
    }

    if (subscription.cancelScheduledFor) {
        return { error: "Esta assinatura já tem cancelamento agendado." };
    }

    return { ok: true };
};

const resumeDecision = (subscription) =>
    subscription && subscription.status === STATUS.PAUSED
        ? { ok: true }
        : { error: "Só dá para reativar uma assinatura pausada." };


/* -----------------------------------------------------
   CANCELAMENTO
----------------------------------------------------- */

/** Dentro dos sete dias do arrependimento? */
const withinWithdrawal = (subscription, now = Date.now()) =>
    Boolean(subscription && subscription.startedAt) &&
    now - Number(subscription.startedAt) <= WITHDRAWAL_DAYS * DAY_MS;

/**
 * O que acontece se a assinatura for cancelada agora.
 *
 *   blocked      fidelidade ainda não acabou (só para o cliente)
 *   immediate    o Mercado Pago para de cobrar já; o acesso
 *                vai até accessUntil
 *   scheduled    o aviso prévio passa da próxima cobrança: ela
 *                ainda acontece e o cancelamento é feito na
 *                data cancelAt (pela sincronização diária)
 *   withdrawal   arrependimento: cancela já, sem acesso, e as
 *                cobranças dos sete dias são estornadas
 */
const cancellationDecision = (subscription, { by = "client", withdrawal = false, now = Date.now() } = {}) => {

    if (!subscription) return { error: "Assinatura não encontrada." };

    if (subscription.status === STATUS.CANCELLED) return { error: "Esta assinatura já foi cancelada." };

    if (subscription.status === STATUS.PENDING || !subscription.startedAt) {
        return { mode: "immediate", accessUntil: null };
    }

    if (withdrawal) {

        if (by !== "client" || !withinWithdrawal(subscription, now)) {
            return { error: "O prazo de arrependimento (7 dias) já passou." };
        }

        return { mode: "withdrawal", accessUntil: null };
    }

    const loyaltyMonths = Number(subscription.loyaltyMonths) || 0;

    if (by === "client" && loyaltyMonths > 0) {

        const loyaltyEndsAt =
            bookingsCore.addMonths(new Date(Number(subscription.startedAt)), loyaltyMonths).getTime();

        if (now < loyaltyEndsAt) {
            return { blocked: "loyalty", loyaltyEndsAt };
        }
    }

    const noticeDays = by === "client" ? Number(subscription.cancellationNoticeDays) || 0 : 0;
    const effectiveAt = now + noticeDays * DAY_MS;

    /* Em atraso, não há período pago a preservar. */
    const until = subscription.status === STATUS.ACTIVE ? paidUntil(subscription, now) : now;

    if (effectiveAt <= until) {
        return { mode: "immediate", accessUntil: until };
    }

    return { mode: "scheduled", cancelAt: effectiveAt };
};


/* -----------------------------------------------------
   ACEITE (prova do consentimento, LGPD art. 8º, §2º)

   Guarda o que foi aceito, quando, por qual conta e com
   qual texto. Nada de IP ou aparelho: a conta logada e o
   token já identificam quem aceitou (minimização, art. 6º).
----------------------------------------------------- */

const consentRecord = ({ plan, method, version = CONSENT_VERSION, now = Date.now() }) => ({
    version,
    acceptedAt: now,
    method,
    terms: {
        price: plan.price,
        currency: plan.currency,
        billingCycle: plan.billingCycle,
        autoRenew: plan.autoRenew,
        trialDays: plan.trialDays,
        loyaltyMonths: plan.loyaltyMonths,
        cancellationNoticeDays: plan.cancellationNoticeDays,
        withdrawalDays: WITHDRAWAL_DAYS
    }
});


/* -----------------------------------------------------
   O QUE O NAVEGADOR RECEBE
----------------------------------------------------- */

const publicView = (id, subscription) => {

    const s = subscription || {};

    return {
        id,
        status: s.status || null,
        paymentStatus: s.paymentStatus || paymentStatusOf(s),
        method: s.method || null,
        productId: s.productId || null,
        productName: s.productName || null,
        price: s.price || null,
        billingCycle: s.billingCycle || null,
        startedAt: s.startedAt || null,
        trialEndsAt: s.trialEndsAt || null,
        nextBillingAt: s.nextBillingAt || null,
        lastPaidAt: s.lastPaidAt || null,
        pausedAt: s.pausedAt || null,
        accessUntil: s.accessUntil || null,
        cancelScheduledFor: s.cancelScheduledFor || null,
        firstBooking: s.firstBooking
            ? {
                status: s.firstBooking.status || null,
                scheduleId: s.firstBooking.scheduleId || null,
                code: s.firstBooking.code || null,
                message: s.firstBooking.message || null
            }
            : null
    };
};


/* -----------------------------------------------------
   MENSAGENS DE RECUSA

   O texto do Mercado Pago vira algo que a pessoa consegue
   resolver. `ownerAction` = o problema é da conta da empresa,
   não do cartão de quem paga.
----------------------------------------------------- */

const explainRejection = (reason, raw = "") => {

    const all = `${reason || ""} ${raw || ""}`;

    if (/same user|cannot pay yourself|collector.*payer|payer.*collector|between same/i.test(all)) {
        return {
            code: "SAME_ACCOUNT",
            ownerAction: false,
            message:
                "Este e-mail é da mesma conta Mercado Pago que recebe os pagamentos da empresa. " +
                "Use o e-mail e o cartão de quem vai pagar."
        };
    }

    if (/not authorized|unauthorized|forbidden|preapproval.*not.*enabled|not allowed to create/i.test(all)) {
        return {
            code: "MERCADO_PAGO_SUBSCRIPTION_NOT_ENABLED",
            ownerAction: true,
            message:
                "A conta Mercado Pago desta empresa ainda não pode receber assinaturas. " +
                "Avise a empresa: o responsável precisa liberar Assinaturas no Mercado Pago."
        };
    }

    /* Ao autorizar, o Mercado Pago faz uma cobrança de valor
       mínimo no cartão (e devolve). CC_VAL_433 é essa cobrança
       recusada: cartão de teste numa conta real, cartão do
       próprio dono da conta que recebe, débito/pré-pago ou
       antifraude. A tela de Pagamentos explica isso à empresa
       (lastFailure). */
    if (/CC_VAL_433|card validation/i.test(all)) {
        return {
            code: "CARD_NOT_VALIDATED",
            ownerAction: false,
            message:
                "O Mercado Pago não conseguiu validar este cartão para cobrança automática. " +
                "Use um cartão de crédito em seu nome (débito e pré-pago não servem) ou pague pela sua conta Mercado Pago."
        };
    }

    if (/card_token|token.*(invalid|expired|not found)/i.test(all)) {
        return {
            code: "CARD_TOKEN_INVALID",
            ownerAction: false,
            message: "Os dados do cartão expiraram. Digite o cartão de novo."
        };
    }

    if (/payer_email|email/i.test(all)) {
        return {
            code: "PAYER_EMAIL_INVALID",
            ownerAction: false,
            message: "O Mercado Pago não aceitou este e-mail. Confira o endereço e tente de novo."
        };
    }

    return {
        code: "MERCADO_PAGO_REJECTED",
        ownerAction: false,
        message: "O Mercado Pago não autorizou a assinatura. Confira os dados e tente de novo."
    };
};

/** Junta as causas que o Mercado Pago devolve num texto só (para log e diagnóstico). */
const mercadoPagoReason = (data) =>
    (Array.isArray(data && data.cause)
        ? data.cause.map((item) => item && (item.description || item.code)).filter(Boolean).join("; ")
        : "") ||
    (data && data.message) ||
    "";

const idempotencyKey = (...parts) =>
    crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 40);


module.exports = {
    DAY_MS,
    CONSENT_VERSION,
    WITHDRAWAL_DAYS,
    PENDING_TTL_MS,
    METHODS,
    STATUS,
    cycleOf,
    normalizeEmail,
    planOf,
    firstChargeAt,
    billingSchedule,
    parseSubscribe,
    chargeRecord,
    latestSettledCharge,
    paidUntil,
    paymentStatusOf,
    syncPatch,
    pauseDecision,
    resumeDecision,
    withinWithdrawal,
    cancellationDecision,
    consentRecord,
    publicView,
    explainRejection,
    mercadoPagoReason,
    idempotencyKey
};
