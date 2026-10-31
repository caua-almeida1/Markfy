import { callApi } from "./bookingsApi";

/* =========================================================
   MENSALIDADE (Cloud Function subscriptionsApi)

   Assinar, conferir o estado no Mercado Pago e cancelar
   passam todos pelo backend: é ele quem lê o preço do
   plano, guarda o aceite e fala com o Mercado Pago com o
   token da empresa. O navegador manda só as escolhas.

   Exige conta logada (o token vai junto em callApi).
========================================================= */

const ENDPOINT = "subscriptionsApi";

/**
 * method: "card" (cardTokenId do Card Payment Brick) ou
 * "account" (devolve redirectUrl para o Mercado Pago).
 */
export const subscribe = (payload) =>
    callApi(ENDPOINT, "create", payload);

export const syncSubscription = (handle, subscriptionId) =>
    callApi(ENDPOINT, "sync", { handle, subscriptionId });

/** withdrawal: arrependimento nos 7 primeiros dias (estorno). */
export const cancelSubscription = (handle, subscriptionId, { withdrawal = false } = {}) =>
    callApi(ENDPOINT, "cancel", { handle, subscriptionId, withdrawal });

/** Só o administrador da empresa: para de cobrar até reativar. */
export const pauseSubscription = (handle, subscriptionId) =>
    callApi(ENDPOINT, "pause", { handle, subscriptionId });

export const resumeSubscription = (handle, subscriptionId) =>
    callApi(ENDPOINT, "resume", { handle, subscriptionId });


/* ---------------------------------------------------------
   TENTATIVA PELA CONTA MERCADO PAGO

   A pessoa sai do Markfy para autorizar no site do Mercado
   Pago e volta em /assinatura/retorno. Isto é o que a tela
   de retorno precisa para saber qual assinatura conferir.
   Só identificadores — nada de e-mail ou nome.
--------------------------------------------------------- */

const PENDING_KEY = "markfy-pending-subscription";

export const rememberPendingSubscription = (entry) => {
    try {
        localStorage.setItem(PENDING_KEY, JSON.stringify({ ...entry, savedAt: Date.now() }));
    } catch {
        /* Navegação privada: a tela de retorno procura pela conta. */
    }
};

export const readPendingSubscription = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(PENDING_KEY) || "null");
        /* Depois de 48 h o backend já apagou a tentativa. */
        return saved && Date.now() - (saved.savedAt || 0) < 48 * 60 * 60 * 1000 ? saved : null;
    } catch {
        return null;
    }
};

export const forgetPendingSubscription = () => {
    try {
        localStorage.removeItem(PENDING_KEY);
    } catch {
        /* nada a fazer */
    }
};
