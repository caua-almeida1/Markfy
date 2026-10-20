/* =========================================================
   MARKFY MENUS — MOTOR: UTILITÁRIOS

   O motor (src/menus/engine) é JavaScript puro, sem React,
   sem Firebase e sem APIs do navegador. Ele roda em três
   lugares com o MESMO código:

     - no backend (functions-backend/menus-engine, cópia
       gerada por scripts/sync-menus-engine.js);
     - no modo de demonstração, em memória;
     - nos testes.

   Por isso: imports relativos sempre com extensão ".js" e
   nada que dependa de window, document ou Node.
========================================================= */

/** Lista a partir de array ou objeto (o RTDB devolve os dois). */
export const asList = (value) => {
    if (Array.isArray(value)) return value.filter((item) => item !== null && item !== undefined);
    if (value && typeof value === "object") return Object.values(value).filter((item) => item !== null && item !== undefined);
    return [];
};

/** Objeto { id: item } a partir de array com .id ou objeto. */
export const asMap = (value) => {
    if (Array.isArray(value)) {
        const map = {};
        value.forEach((item) => {
            if (item && item.id) map[item.id] = item;
        });
        return map;
    }
    return value && typeof value === "object" ? value : {};
};

/** Entradas { id, ...valor } de um nó do RTDB. */
export const entries = (value) =>
    Object.entries(asMap(value))
        .filter(([, item]) => item && typeof item === "object")
        .map(([id, item]) => ({ ...item, id: item.id || id }));

export const byOrder = (a, b) =>
    (Number(a.order) || 0) - (Number(b.order) || 0) || String(a.name || "").localeCompare(String(b.name || ""));

/** Remove undefined (o RTDB recusa) e funções. */
export const clean = (value) => (value === undefined ? null : JSON.parse(JSON.stringify(value)));

export const text = (value, max = 200) => String(value === null || value === undefined ? "" : value).trim().slice(0, max);

export const clampInt = (value, min, max, fallback = min) => {
    const number = Math.round(Number(value));
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
};

/* Identificadores no formato das chaves do RTDB (ordenáveis
   pelo tempo, com parte aleatória). O backend usa as chaves
   do próprio push(); isto vale para o modo demonstração. */
const PUSH_CHARS = "-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz";
let lastPushTime = 0;
let lastRandom = [];

export const pushId = (now = Date.now()) => {
    const duplicate = now === lastPushTime;
    lastPushTime = now;

    const timeChars = new Array(8);
    let time = now;
    for (let i = 7; i >= 0; i -= 1) {
        timeChars[i] = PUSH_CHARS.charAt(time % 64);
        time = Math.floor(time / 64);
    }

    if (!duplicate) {
        lastRandom = [];
        for (let i = 0; i < 12; i += 1) lastRandom[i] = Math.floor(Math.random() * 64);
    } else {
        let i = 11;
        for (; i >= 0 && lastRandom[i] === 63; i -= 1) lastRandom[i] = 0;
        if (i >= 0) lastRandom[i] += 1;
    }

    return timeChars.join("") + lastRandom.map((n) => PUSH_CHARS.charAt(n)).join("");
};

export const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export const isId = (value) => typeof value === "string" && ID_PATTERN.test(value);

/** Erro de regra de negócio: vira resposta 4xx com mensagem legível. */
export class MenusError extends Error {
    constructor(code, message, status = 400, extra = null) {
        super(message);
        this.name = "MenusError";
        this.code = code;
        this.status = status;
        this.extra = extra;
    }
}

export const fail = (code, message, status = 400, extra = null) => {
    throw new MenusError(code, message, status, extra);
};
