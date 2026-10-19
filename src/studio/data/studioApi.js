import {
    getDatabase,
    ref,
    get,
    set,
    update,
    push,
    remove,
    onValue,
    increment,
    serverTimestamp
} from "firebase/database";

/* =========================================================
   MARKFY STUDIO — DADOS

   Tudo no Realtime Database, ao lado do que a Bookings já
   usa. Cada nó é isolado por empresa (handle):

     studioDrafts/{handle}     rascunho do editor (só membros)
     studioSites/{handle}      página publicada (leitura pública)
     studioLeads/{handle}/{id} contatos do formulário
     studioAnalytics/{handle}/{aaaa-mm-dd}/{evento} contadores

   As regras propostas para esses nós estão em
   database.rules.proposta.json.
========================================================= */

const db = () => getDatabase();

/* O RTDB não aceita `undefined`; arrays vazios somem.
   Uma passada por JSON limpa os dois casos de uma vez. */
export const clean = (value) => JSON.parse(JSON.stringify(value ?? null));

/* ---------- RASCUNHO ---------- */

export const watchDraft = (handle, callback) =>
    onValue(
        ref(db(), `studioDrafts/${handle}`),
        (snapshot) => callback(snapshot.val()),
        () => callback(null)
    );

export const saveDraft = (handle, page, uid) =>
    update(ref(db(), `studioDrafts/${handle}`), {
        page: clean(page),
        updatedAt: serverTimestamp(),
        updatedBy: uid || null
    });

export const createDraft = (handle, page, uid) =>
    set(ref(db(), `studioDrafts/${handle}`), {
        page: clean(page),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: uid || null
    });

export const deleteDraft = (handle) => remove(ref(db(), `studioDrafts/${handle}`));

/* ---------- PUBLICAÇÃO ---------- */

export const watchPublished = (handle, callback) =>
    onValue(
        ref(db(), `studioSites/${handle}`),
        (snapshot) => callback(snapshot.val()),
        () => callback(null)
    );

export const getPublished = async (handle) => {
    const snapshot = await get(ref(db(), `studioSites/${handle}`));
    return snapshot.val();
};

export const publishSite = async (handle, page, uid, companyName) => {
    await set(ref(db(), `studioSites/${handle}`), {
        handle,
        companyName: companyName || handle,
        page: clean(page),
        publishedAt: serverTimestamp(),
        publishedBy: uid || null
    });

    await update(ref(db(), `studioDrafts/${handle}`), {
        lastPublishedAt: serverTimestamp()
    });
};

export const unpublishSite = (handle) => remove(ref(db(), `studioSites/${handle}`));

/* ---------- CONTATOS ---------- */

export const LEAD_STATUS = {
    new: { label: "Novo", tone: "info" },
    contacted: { label: "Em atendimento", tone: "warning" },
    done: { label: "Concluído", tone: "success" },
    archived: { label: "Arquivado", tone: undefined }
};

export const submitLead = (handle, lead) =>
    push(ref(db(), `studioLeads/${handle}`), {
        name: String(lead.name || "").trim().slice(0, 120),
        phone: String(lead.phone || "").trim().slice(0, 40),
        email: String(lead.email || "").trim().slice(0, 160),
        message: String(lead.message || "").trim().slice(0, 2000),
        status: "new",
        source: "site",
        createdAt: serverTimestamp()
    });

export const watchLeads = (handle, callback) =>
    onValue(
        ref(db(), `studioLeads/${handle}`),
        (snapshot) => {
            const value = snapshot.val() || {};
            callback(
                Object.entries(value)
                    .map(([id, lead]) => ({ id, ...lead }))
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            );
        },
        () => callback([])
    );

export const updateLead = (handle, id, patch) =>
    update(ref(db(), `studioLeads/${handle}/${id}`), {
        ...patch,
        updatedAt: serverTimestamp()
    });

export const deleteLead = (handle, id) => remove(ref(db(), `studioLeads/${handle}/${id}`));

/* ---------- ANALYTICS ---------- */

export const ANALYTICS_EVENTS = {
    view: "Visitas",
    booking_click: "Cliques em agendar",
    whatsapp_click: "Cliques no WhatsApp",
    social_click: "Cliques em redes e links",
    channel_click: "Cliques em apps, lojas e rotas",
    lead: "Contatos enviados"
};

export const dayKey = (date = new Date()) => {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 10);
};

/* Contador do dia. Visitas contam uma vez por sessão do
   navegador, para recarregar a página não inflar o número. */
export const trackEvent = (handle, event) => {
    if (!handle || !ANALYTICS_EVENTS[event]) return;

    if (event === "view") {
        const key = `markfy:studio-view:${handle}`;
        try {
            if (sessionStorage.getItem(key)) return;
            sessionStorage.setItem(key, "1");
        } catch {
            /* sem storage: conta normalmente */
        }
    }

    update(ref(db(), `studioAnalytics/${handle}/${dayKey()}`), {
        [event]: increment(1)
    }).catch(() => {
        /* Métrica nunca derruba a página pública. */
    });
};

export const getAnalytics = async (handle) => {
    const snapshot = await get(ref(db(), `studioAnalytics/${handle}`));
    return snapshot.val() || {};
};

/* ---------- AGENDAMENTOS DA EMPRESA ---------- */

export const getSchedules = async (handle) => {
    const snapshot = await get(ref(db(), `companys/${handle}/schedules`));
    return Object.entries(snapshot.val() || {}).map(([id, item]) => ({ id, ...item }));
};

/* ---------- EMPRESA ---------- */

export const updateCompany = (handle, patch) =>
    update(ref(db(), `companys/${handle}`), clean(patch));
