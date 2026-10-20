/* =========================================================
   HORÁRIOS E FUSO

   Horário semanal:
     { sunday: { enabled, ranges: [{ from: "11:00", to: "15:00" }] }, ... }

   "to" menor que "from" atravessa a meia-noite (18:00 → 02:00).

   Tudo é calculado no FUSO DA EMPRESA (padrão
   America/Sao_Paulo), não no fuso de quem abre a página:
   um cliente viajando não pode ver a loja "fechada" porque
   o celular dele está em outro fuso, e o relatório "de hoje"
   do restaurante começa à meia-noite do restaurante.
========================================================= */

export const DEFAULT_TZ = "America/Sao_Paulo";

export const DAY_IDS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export const DAY_LABELS = {
    sunday: "Domingo",
    monday: "Segunda",
    tuesday: "Terça",
    wednesday: "Quarta",
    thursday: "Quinta",
    friday: "Sexta",
    saturday: "Sábado"
};

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const isTime = (value) => TIME.test(String(value || ""));

export const toMinutes = (value) => {
    const match = TIME.exec(String(value || ""));
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
};

const formatterCache = new Map();

const formatterFor = (tz) => {
    if (!formatterCache.has(tz)) {
        let formatter;
        try {
            formatter = new Intl.DateTimeFormat("en-US", {
                timeZone: tz,
                hourCycle: "h23",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                weekday: "short"
            });
        } catch {
            formatter = new Intl.DateTimeFormat("en-US", {
                timeZone: DEFAULT_TZ,
                hourCycle: "h23",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                weekday: "short"
            });
        }
        formatterCache.set(tz, formatter);
    }
    return formatterCache.get(tz);
};

const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Data, hora e dia da semana no fuso da empresa. */
export const localParts = (millis, tz = DEFAULT_TZ) => {
    const parts = {};
    formatterFor(tz || DEFAULT_TZ)
        .formatToParts(new Date(millis))
        .forEach((part) => {
            parts[part.type] = part.value;
        });

    const hour = Number(parts.hour) % 24;

    return {
        year: Number(parts.year),
        month: Number(parts.month),
        day: Number(parts.day),
        hour,
        minute: Number(parts.minute),
        weekday: WEEKDAY_INDEX[parts.weekday] ?? 0,
        minutes: hour * 60 + Number(parts.minute),
        dayKey: `${parts.year}-${parts.month}-${parts.day}`
    };
};

/** "aaaa-mm-dd" no fuso da empresa. */
export const dayKey = (millis, tz = DEFAULT_TZ) => localParts(millis, tz).dayKey;

/** Faixas válidas de um dia, normalizadas. */
export const dayRanges = (day) => {
    if (!day || day.enabled === false) return [];
    const list = Array.isArray(day.ranges) ? day.ranges : day.ranges && typeof day.ranges === "object" ? Object.values(day.ranges) : [];
    return list
        .map((range) => ({ from: toMinutes(range?.from), to: toMinutes(range?.to) }))
        .filter((range) => range.from !== null && range.to !== null && range.from !== range.to);
};

/**
 * A empresa está aberta neste instante?
 * Sem horário configurado: considera aberta (quem ainda não
 * preencheu não deve ver o cardápio travado), mas o painel
 * avisa que falta configurar.
 */
export const isOpenAt = (hours, millis, tz = DEFAULT_TZ) => {
    if (!hours || typeof hours !== "object" || !DAY_IDS.some((id) => hours[id])) {
        return { open: true, configured: false };
    }

    const now = localParts(millis, tz);
    const today = DAY_IDS[now.weekday];
    const yesterday = DAY_IDS[(now.weekday + 6) % 7];

    const inToday = dayRanges(hours[today]).some((range) =>
        range.to > range.from
            ? now.minutes >= range.from && now.minutes < range.to
            : now.minutes >= range.from
    );

    const fromYesterday = dayRanges(hours[yesterday]).some((range) =>
        range.to < range.from && now.minutes < range.to
    );

    return { open: inToday || fromYesterday, configured: true };
};

const pad = (number) => String(number).padStart(2, "0");

export const minutesToTime = (minutes) => `${pad(Math.floor(minutes / 60) % 24)}:${pad(minutes % 60)}`;

/** Próxima abertura, como texto: "hoje às 18:00", "amanhã às 11:00", "sexta às 11:00". */
export const nextOpeningLabel = (hours, millis, tz = DEFAULT_TZ) => {
    if (!hours) return "";
    const now = localParts(millis, tz);

    for (let offset = 0; offset < 8; offset += 1) {
        const index = (now.weekday + offset) % 7;
        const ranges = dayRanges(hours[DAY_IDS[index]])
            .filter((range) => offset > 0 || range.from > now.minutes)
            .sort((a, b) => a.from - b.from);

        if (ranges.length) {
            const when = offset === 0 ? "hoje" : offset === 1 ? "amanhã" : DAY_LABELS[DAY_IDS[index]].toLowerCase();
            return `${when} às ${minutesToTime(ranges[0].from)}`;
        }
    }

    return "";
};

/** Texto de um dia: "11:00–15:00 · 18:00–23:00" ou "Fechado". */
export const dayLabel = (day) => {
    const ranges = dayRanges(day);
    if (!ranges.length) return "Fechado";
    return ranges.map((range) => `${minutesToTime(range.from)}–${minutesToTime(range.to)}`).join(" · ");
};

/**
 * Converte o horário da Bookings (companys/{h}/businessHours:
 * { monday: { enabled, open, close, intervals: [{ open, close }] } })
 * para faixas do Menus, descontando as pausas.
 */
export const fromBookingsHours = (businessHours) => {
    if (!businessHours || typeof businessHours !== "object") return null;

    const result = {};
    let any = false;

    DAY_IDS.forEach((id) => {
        const day = businessHours[id];
        if (!day) {
            result[id] = { enabled: false, ranges: [] };
            return;
        }

        const open = toMinutes(day.open);
        const close = toMinutes(day.close);

        if (day.enabled === false || open === null || close === null) {
            result[id] = { enabled: false, ranges: [] };
            return;
        }

        const breaks = (Array.isArray(day.intervals) ? day.intervals : Object.values(day.intervals || {}))
            .map((item) => ({ from: toMinutes(item?.open), to: toMinutes(item?.close) }))
            .filter((item) => item.from !== null && item.to !== null && item.to > item.from && item.from > open && item.to < close)
            .sort((a, b) => a.from - b.from);

        const ranges = [];
        let cursor = open;
        breaks.forEach((pause) => {
            if (pause.from > cursor) ranges.push({ from: minutesToTime(cursor), to: minutesToTime(pause.from) });
            cursor = Math.max(cursor, pause.to);
        });
        ranges.push({ from: minutesToTime(cursor), to: minutesToTime(close) });

        result[id] = { enabled: true, ranges };
        any = true;
    });

    return any ? result : null;
};

/**
 * Disponibilidade por horário de um produto:
 * { days: [0..6], from: "11:00", to: "15:00" } ou nada (sempre).
 */
export const productScheduleOpen = (schedule, millis, tz = DEFAULT_TZ) => {
    if (!schedule || typeof schedule !== "object") return true;

    const days = (Array.isArray(schedule.days) ? schedule.days : Object.values(schedule.days || {})).map(Number);
    const from = toMinutes(schedule.from);
    const to = toMinutes(schedule.to);

    const now = localParts(millis, tz);

    if (days.length && !days.includes(now.weekday)) return false;
    if (from === null || to === null || from === to) return true;

    return to > from ? now.minutes >= from && now.minutes < to : now.minutes >= from || now.minutes < to;
};

export const scheduleLabel = (schedule) => {
    if (!schedule) return "";
    const days = (Array.isArray(schedule.days) ? schedule.days : Object.values(schedule.days || {})).map(Number);
    const dayText = days.length && days.length < 7
        ? days.sort().map((index) => DAY_LABELS[DAY_IDS[index]].slice(0, 3)).join(", ")
        : "Todos os dias";
    const timeText = isTime(schedule.from) && isTime(schedule.to) ? `${schedule.from}–${schedule.to}` : "";
    return [dayText, timeText].filter(Boolean).join(" · ");
};
