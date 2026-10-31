/* =====================================================
   MARKFY BOOKINGS — REGRAS PURAS DO AGENDAMENTO

   Tudo aqui é função pura (sem Firebase), para poder ser
   testado com `node --test` e reaproveitado pelo bookingsApi.

   Formatos que o app já grava em companys/{handle}/schedules:

     day   "dd/mm/aaaa"
     hour  "HH:MM"
     status "pending" | "confirmed" | "completed" |
            "cancelados" | "cancelled" | "canceled"

   O horário é sempre o de Brasília (UTC-3, sem horário de
   verão desde 2019): a função roda em UTC e o painel e o
   cliente estão no Brasil.
===================================================== */

const BR_OFFSET = "-03:00";

const DAY = /^(\d{2})\/(\d{2})\/(\d{4})$/;
const HOUR = /^([01]\d|2[0-3]):([0-5]\d)$/;
const HANDLE = /^[a-z0-9._-]{1,60}$/i;
const KEY = /^[A-Za-z0-9_-]{1,80}$/;

/* O clientId nasce de crypto.randomUUID() (ou do fallback
   base36 de utils/clientID.js). */
const CLIENT_ID = /^[A-Za-z0-9-]{8,64}$/;

const CANCELLED = ["cancelados", "cancelled", "canceled"];

const isCancelled = (status) => CANCELLED.includes(status);

const isHandle = (value) => typeof value === "string" && HANDLE.test(value);
const isKey = (value) => typeof value === "string" && KEY.test(value);
const isClientId = (value) => typeof value === "string" && CLIENT_ID.test(value);

/** "dd/mm/aaaa" + "HH:MM" → Date (Brasília), ou null. */
const toDate = (day, hour) => {

    const d = DAY.exec(String(day || ""));
    const h = HOUR.exec(String(hour || ""));

    if (!d || !h) return null;

    const date = new Date(`${d[3]}-${d[2]}-${d[1]}T${h[1]}:${h[2]}:00${BR_OFFSET}`);

    if (Number.isNaN(date.getTime())) return null;

    /* 31/02 vira 03/03 no Date: recusa em vez de aceitar. */
    const check = new Date(date.getTime() - 3 * 60 * 60 * 1000);

    if (
        check.getUTCDate() !== Number(d[1]) ||
        check.getUTCMonth() + 1 !== Number(d[2])
    ) {
        return null;
    }

    return date;
};

const toMinutes = (hour) => {
    const h = HOUR.exec(String(hour || ""));
    return h ? Number(h[1]) * 60 + Number(h[2]) : null;
};

/** {days, hours, minutes} → ms (mesmo cálculo da tela de reservas). */
const advanceToMs = (advance) => {

    if (!advance || typeof advance !== "object") return 0;

    const days = Number(advance.days) || 0;
    const hours = Number(advance.hours) || 0;
    const minutes = Number(advance.minutes) || 0;

    return Math.max(0, ((days * 24 + hours) * 60 + minutes) * 60 * 1000);
};

const text = (value, max) => {

    if (typeof value !== "string") return "";

    return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
};


/* -----------------------------------------------------
   PREÇO (mesma regra de src/utils/price.js)
----------------------------------------------------- */

const parsePrice = (value) => {

    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (!value) return 0;

    const clean = String(value)
        .replace(/[^\d,.-]/g, "")
        .replace(/\.(?=\d{3}(\D|$))/g, "")
        .replace(",", ".");

    const number = Number(clean);

    return Number.isFinite(number) ? number : 0;
};

const formatPrice = (value) =>
    Number(value || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });

const effectivePrice = (product) => {

    const normal = parsePrice(product && product.value);
    const promo = parsePrice(product && product.discountedPrice);

    return normal > 0 && promo > 0 && promo < normal ? promo : normal;
};

const effectivePriceLabel = (product) => {

    const normal = parsePrice(product && product.value);
    const promo = parsePrice(product && product.discountedPrice);

    if (normal > 0 && promo > 0 && promo < normal) return formatPrice(promo);

    /* Sem promoção, o texto gravado ("Sob consulta", por
       exemplo) vale como está. */
    const raw = String((product && product.value) || "").trim();

    return raw || formatPrice(0);
};


/* -----------------------------------------------------
   ACESSO PÚBLICO (espelho mínimo da licença)
----------------------------------------------------- */

const isBookingsOpen = (entry, now = Date.now()) =>
    Boolean(
        entry &&
        entry.bookings === true &&
        (!entry.expiresAt || Number(entry.expiresAt) > now)
    );


/* -----------------------------------------------------
   EQUIPE DO PRODUTO
----------------------------------------------------- */

const relatedIds = (product) => {

    const list = Array.isArray(product && product.relatedUsers)
        ? product.relatedUsers
        : Object.values((product && product.relatedUsers) || {});

    return list
        .map((item) => (item && typeof item === "object" ? item.id : item))
        .filter((id) => typeof id === "string" && id);
};


/* -----------------------------------------------------
   HORÁRIOS OCUPADOS

   Vêm dos próprios agendamentos (e não de
   users/{id}/scheduledTimes, que nunca era limpo quando
   alguém cancelava — o horário ficava preso para sempre).
   Só sai dia, hora e duração: nada que identifique cliente.
----------------------------------------------------- */

const busySlots = (schedules, professionalId, now = Date.now()) => {

    const startOfToday = now - 24 * 60 * 60 * 1000;

    return Object.values(schedules || {})
        .filter((item) =>
            item &&
            item.professionalId === professionalId &&
            !isCancelled(item.status)
        )
        .map((item) => {

            const date = toDate(item.day, item.hour);

            if (!date || date.getTime() < startOfToday) return null;

            const duration = Number(item.totalDuration || item.duration) || null;

            return duration
                ? { day: item.day, hour: item.hour, duration }
                : { day: item.day, hour: item.hour };
        })
        .filter(Boolean);
};

/** O intervalo [hour, hour+duration) cruza algum ocupado do dia? */
const hasConflict = (busy, day, hour, duration) => {

    const start = toMinutes(hour);

    if (start === null) return true;

    const end = start + Math.max(1, Number(duration) || 1);

    return busy.some((slot) => {

        if (slot.day !== day) return false;

        const otherStart = toMinutes(slot.hour);

        if (otherStart === null) return false;

        /* Sem duração conhecida, o ocupado dura o mesmo que o
           serviço pedido (mesma suposição da tela). */
        const otherEnd = otherStart + Math.max(1, Number(slot.duration) || Number(duration) || 1);

        return start < otherEnd && otherStart < end;
    });
};


/* -----------------------------------------------------
   ASSINATURA (ciclo, mesma regra de subscriptionRuntime)
----------------------------------------------------- */

const CYCLE_MONTHS = { monthly: 1, quarterly: 3, semiannual: 6, annual: 12, yearly: 12 };

const addMonths = (date, months) => {

    const base = new Date(date);
    const wanted = base.getUTCDate();

    base.setUTCDate(1);
    base.setUTCMonth(base.getUTCMonth() + months);

    const last = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();

    base.setUTCDate(Math.min(wanted, last));

    return base;
};

const cycleWindow = (subscription, reference = new Date()) => {

    const months = CYCLE_MONTHS[subscription && subscription.billingCycle] || 1;

    let start = new Date((subscription && subscription.startedAt) || Date.now());
    let end = addMonths(start, months);
    let turns = 0;

    while (end <= reference && turns < 600) {
        start = end;
        end = addMonths(start, months);
        turns += 1;
    }

    return { start, end };
};

/* Cancelada continua valendo até o fim do período já pago
   (accessUntil): quem cancela no dia 5 de um ciclo pago até
   o dia 30 não perde os atendimentos que pagou. */
const isSubscriptionUsable = (subscription, now = Date.now()) =>
    Boolean(subscription) && (
        subscription.status === "authorized" ||
        subscription.status === "past_due" ||
        (subscription.status === "cancelled" && Number(subscription.accessUntil) > now)
    );

/*
 * Pagamento antes de agendar. Vale o interruptor da empresa
 * ("todos os serviços", paymentSettings.receiveBeforeBooking)
 * ou o do produto (settings.prepayment) — antes só o da
 * empresa era conferido e o do produto era gravado à toa.
 * Mensalidade tem fluxo próprio e não entra aqui.
 */
const advancePaymentRequired = ({ companyFlag, productFlag, productType }) =>
    productType !== "monthly" && (companyFlag === true || productFlag === true);

/** Uma assinatura cancelada só cobre atendimentos antes do fim do acesso. */
const subscriptionCoversDate = (subscription, date) =>
    !(subscription && subscription.status === "cancelled") ||
    date.getTime() < Number(subscription.accessUntil || 0);

/** Sessões que ainda cabem no ciclo; null = ilimitado. */
const sessionsLeft = (subscription, schedules, now = new Date()) => {

    if (!subscription || subscription.unlimitedSessions) return null;

    const total = Number(subscription.sessionsPerCycle) || 0;
    const { start, end } = cycleWindow(subscription, now);

    const used = Object.values(schedules || {}).filter((item) => {

        if (!item || item.subscriptionId !== subscription.id || isCancelled(item.status)) return false;

        const date = toDate(item.day, item.hour);

        return date && date >= start && date < end;
    }).length;

    return Math.max(0, total - used);
};


/* -----------------------------------------------------
   PEDIDO DE AGENDAMENTO

   O navegador manda só escolhas (produto, profissional,
   dia, hora, extras, nome, recado). Preço, nome do serviço,
   duração e nome do profissional são lidos do banco.
----------------------------------------------------- */

const MAX_DAYS_AHEAD = 120;
const MAX_EXTRAS = 6;

const parseCreate = (body, now = Date.now()) => {

    const input = body && typeof body === "object" ? body : {};

    if (!isHandle(input.handle)) return { error: "Empresa inválida." };
    if (!isKey(input.productId)) return { error: "Serviço inválido." };
    if (!isKey(input.professionalId)) return { error: "Escolha o profissional." };
    if (!isClientId(input.clientId)) return { error: "Identificador do aparelho inválido." };

    const date = toDate(input.day, input.hour);

    if (!date) return { error: "Data ou horário inválido." };

    /* Cinco minutos de folga para o relógio do aparelho. */
    if (date.getTime() < now - 5 * 60 * 1000) {
        return { error: "Este horário já passou. Escolha outro." };
    }

    if (date.getTime() > now + MAX_DAYS_AHEAD * 24 * 60 * 60 * 1000) {
        return { error: "Escolha uma data mais próxima." };
    }

    const userName = text(input.userName, 80);

    if (!userName) return { error: "Informe seu nome." };

    const extras = Array.isArray(input.extraProductIds)
        ? [...new Set(input.extraProductIds.filter(isKey))]
            .filter((id) => id !== input.productId)
            .slice(0, MAX_EXTRAS)
        : [];

    return {
        value: {
            handle: input.handle,
            productId: input.productId,
            professionalId: input.professionalId,
            clientId: input.clientId,
            day: input.day,
            hour: input.hour,
            date,
            dayLabel: text(input.dayLabel, 80),
            userName,
            notes: text(input.notes, 500),
            source: /^[a-z0-9_-]{1,20}$/i.test(String(input.source || "")) ? input.source : null,
            subscriptionId: isKey(input.subscriptionId) ? input.subscriptionId : null,
            extraProductIds: extras
        }
    };
};

/** Monta o registro gravado em companys/{handle}/schedules/{id}. */
const buildSchedule = ({ request, product, extras, professionalName, uid, now = Date.now() }) => {

    const mainDuration = Number(product.duration) || 0;

    const extraServices = extras.map((item) => ({
        productId: item.id,
        name: text(item.name, 120),
        value: effectivePriceLabel(item),
        duration: Number(item.duration) || 0
    }));

    const record = {
        productId: request.productId,
        productName: text(product.name, 120),
        productPrice: effectivePriceLabel(product),
        professionalId: request.professionalId,
        professionalName: text(professionalName, 80) || "Profissional",
        day: request.day,
        dayLabel: request.dayLabel || request.day,
        hour: request.hour,
        userName: request.userName,
        status: "pending",
        clientId: request.clientId,
        timestamp: new Date(now).toISOString()
    };

    if (request.notes) record.notes = request.notes;
    if (uid) record.userId = uid;
    if (request.source) record.source = request.source;
    if (request.subscriptionId) record.subscriptionId = request.subscriptionId;

    /* Agendamento que nasceu de um pagamento antecipado
       aprovado: o painel mostra "pago" e de qual pagamento. */
    if (request.payment) {
        record.paymentStatus = "approved";
        record.paymentId = request.payment.paymentId;
        record.paymentOrderId = request.payment.orderId;
        record.paidAmount = request.payment.amount;
    }

    if (extraServices.length) {
        record.extraServices = extraServices;
        record.totalDuration = mainDuration + extraServices.reduce((sum, item) => sum + item.duration, 0);
        record.productPrice = formatPrice(
            effectivePrice(product) + extras.reduce((sum, item) => sum + effectivePrice(item), 0)
        );
    } else if (mainDuration) {
        record.totalDuration = mainDuration;
    }

    return record;
};

/** Mesmo id que o app já usava (timestamp ISO sem : e .). */
const scheduleIdFor = (now = Date.now()) =>
    new Date(now).toISOString().replace(/[:.]/g, "-");


/* -----------------------------------------------------
   DONO DO AGENDAMENTO E CANCELAMENTO
----------------------------------------------------- */

const ownsSchedule = (schedule, { uid, clientId }) =>
    Boolean(schedule) && Boolean(
        (uid && schedule.userId === uid) ||
        (clientId && schedule.clientId === clientId)
    );

/** null quando pode cancelar; senão o motivo. */
const cancelProblem = (schedule, cancellationAdvance, now = Date.now()) => {

    if (!schedule) return "Esta reserva não foi encontrada.";
    if (isCancelled(schedule.status)) return "Esta reserva já foi cancelada.";
    if (schedule.status === "completed") return "Esta reserva já foi concluída.";
    if (schedule.status !== "pending") return "Esta reserva não pode mais ser cancelada.";

    const date = toDate(schedule.day, schedule.hour);

    if (!date) return "Não foi possível identificar a data e hora da reserva.";

    if (now > date.getTime() - advanceToMs(cancellationAdvance)) {
        return "Esta reserva não pode mais ser cancelada pelo prazo de antecedência.";
    }

    return null;
};

/** Trinta minutos entre agendamentos do mesmo aparelho/conta na mesma empresa. */
const RECENT_WINDOW_MS = 30 * 60 * 1000;

const bookedRecently = (schedules, { uid, clientId }, now = Date.now()) =>
    Object.values(schedules || {}).some((item) => {

        if (!ownsSchedule(item, { uid, clientId }) || !item.timestamp) return false;

        const created = new Date(item.timestamp).getTime();

        return Number.isFinite(created) && now - created >= 0 && now - created < RECENT_WINDOW_MS;
    });


module.exports = {
    BR_OFFSET,
    MAX_DAYS_AHEAD,
    RECENT_WINDOW_MS,
    isCancelled,
    isHandle,
    isKey,
    isClientId,
    toDate,
    toMinutes,
    advanceToMs,
    text,
    parsePrice,
    formatPrice,
    effectivePrice,
    effectivePriceLabel,
    isBookingsOpen,
    relatedIds,
    busySlots,
    hasConflict,
    addMonths,
    cycleWindow,
    advancePaymentRequired,
    isSubscriptionUsable,
    subscriptionCoversDate,
    sessionsLeft,
    parseCreate,
    buildSchedule,
    scheduleIdFor,
    ownsSchedule,
    cancelProblem,
    bookedRecently
};
