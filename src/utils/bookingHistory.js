import { getDatabase, ref, get, update } from "firebase/database";

/* =========================================================
   HISTÓRICO DO CLIENTE ENTRE EMPRESAS

   Os agendamentos moram dentro de cada empresa
   (companys/{handle}/schedules). Para a central do usuário
   SEM empresa na URL mostrar "minhas reservas", é preciso
   saber em quais empresas a pessoa já agendou.

   Três fontes, somadas:

     - users/{uid}/bookedCompanies/{handle} = timestamp
       (gravado a cada agendamento de quem está logado);
     - localStorage "markfy:booked-companies" (o mesmo, para
       quem agenda sem conta neste aparelho);
     - "markfy-last-agendamento", que o app já gravava antes
       deste índice existir.

   Também guarda, só neste aparelho, empresas visitadas e
   salvas — nada disso sai do navegador.
========================================================= */

const BOOKED_KEY = "markfy:booked-companies";
const RECENT_KEY = "markfy:recent-companies";
const SAVED_KEY = "markfy:saved-companies";

const readList = (key) => {
    try {
        const value = JSON.parse(localStorage.getItem(key) || "[]");
        return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
    } catch {
        return [];
    }
};

const writeList = (key, list) => {
    try {
        localStorage.setItem(key, JSON.stringify(list.slice(0, 30)));
    } catch {
        /* Sem storage: a lista vale só nesta visita. */
    }
};

const pushFront = (key, handle) => {
    if (!handle) return;
    writeList(key, [handle, ...readList(key).filter((item) => item !== handle)]);
};

/* Chamado logo depois de um agendamento dar certo. */
export const recordBookedCompany = async (handle, uid) => {
    if (!handle) return;

    pushFront(BOOKED_KEY, handle);

    if (!uid) return;

    try {
        await update(ref(getDatabase(), `users/${uid}/bookedCompanies`), {
            [handle]: Date.now()
        });
    } catch (error) {
        console.warn("Não foi possível registrar a empresa no histórico:", error);
    }
};

export const getBookedCompanies = async (uid) => {
    const handles = new Set(readList(BOOKED_KEY));

    try {
        const last = JSON.parse(localStorage.getItem("markfy-last-agendamento") || "null");
        if (last?.companyHandle) handles.add(last.companyHandle);
    } catch {
        /* ignora */
    }

    if (uid) {
        try {
            const snapshot = await get(ref(getDatabase(), `users/${uid}/bookedCompanies`));
            Object.keys(snapshot.val() || {}).forEach((handle) => handles.add(handle));
        } catch {
            /* Sem permissão ou offline: fica com o que há no aparelho. */
        }
    }

    return [...handles];
};

export const recordRecentCompany = (handle) => pushFront(RECENT_KEY, handle);
export const getRecentCompanies = () => readList(RECENT_KEY);

export const getSavedCompanies = () => readList(SAVED_KEY);

export const toggleSavedCompany = (handle) => {
    const list = readList(SAVED_KEY);
    const saved = list.includes(handle);

    writeList(SAVED_KEY, saved ? list.filter((item) => item !== handle) : [handle, ...list]);

    return !saved;
};

/* =========================================================
   ORIGEM DO AGENDAMENTO

   Quando a pessoa clica em "Agendar" numa página do Studio,
   a origem fica marcada por 2 horas nesta aba. O agendamento
   criado nesse intervalo, na mesma empresa, sai com
   source: "studio" — é assim que o Studio conta conversões
   sem adivinhar.
========================================================= */

const SOURCE_KEY = "markfy:booking-source";

export const markBookingSource = (handle, source = "studio") => {
    try {
        sessionStorage.setItem(SOURCE_KEY, JSON.stringify({ handle, source, at: Date.now() }));
    } catch {
        /* ignora */
    }
};

export const readBookingSource = (handle) => {
    try {
        const value = JSON.parse(sessionStorage.getItem(SOURCE_KEY) || "null");
        if (value?.handle === handle && Date.now() - value.at < 2 * 60 * 60 * 1000) {
            return value.source;
        }
    } catch {
        /* ignora */
    }
    return null;
};

/* "dd/mm/aaaa" + "HH:MM" → Date (ou null). */
export const parseScheduleDate = (day, hour) => {
    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(day || "");
    if (!match) return null;

    const [hh, mm] = String(hour || "00:00").split(":").map(Number);
    const date = new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), hh || 0, mm || 0);

    return Number.isNaN(date.getTime()) ? null : date;
};
