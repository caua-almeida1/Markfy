import { getAuth } from "firebase/auth";

/* =========================================================
   AGENDAMENTO PELO CLIENTE (Cloud Function bookingsApi)

   O navegador do cliente não lê mais a agenda da empresa
   nem grava nela: as regras do banco fecham
   companys/{handle}/schedules (nome e telefone de outros
   clientes) e users/{uid}. Quem confere conflito, preço,
   plano e assinatura é o backend.

   O token vai junto quando a pessoa está logada; sem login,
   o clientId do aparelho identifica os agendamentos dela.
========================================================= */

const FUNCTIONS_URL = "https://us-central1-markfy-96942.cloudfunctions.net";

/* Mensagem genérica para falha de rede: a da função, quando
   existe, já vem pronta para a pessoa ler. */
const NETWORK_MESSAGE =
    "Sem conexão com o servidor. Confira a internet e tente de novo.";

export const callBookings = async (action, body = {}, { signal } = {}) => {

    const headers = { "Content-Type": "application/json" };

    const user = getAuth().currentUser;

    if (user) {
        try {
            headers.Authorization = `Bearer ${await user.getIdToken()}`;
        } catch {
            /* Sem token segue como visitante. */
        }
    }

    let response;

    try {
        response = await fetch(`${FUNCTIONS_URL}/bookingsApi`, {
            method: "POST",
            headers,
            body: JSON.stringify({ ...body, action }),
            signal
        });
    } catch (error) {
        if (error?.name === "AbortError") throw error;

        const networkError = new Error(NETWORK_MESSAGE);
        networkError.code = "network";
        throw networkError;
    }

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
        const error = new Error(data.message || "Não foi possível concluir. Tente de novo.");
        error.status = response.status;
        error.code = data.code || null;
        throw error;
    }

    return data.result;
};

/** Horários ocupados ({ day, hour, duration? }) de um profissional. */
export const fetchBusySlots = async (handle, professionalId, options) =>
    (await callBookings("availability", { handle, professionalId }, options))?.busy || [];

export const createBooking = (payload) => callBookings("create", payload);

/** Agendamentos desta conta/deste aparelho nas empresas indicadas. */
export const fetchMyBookings = async ({ handles, clientId, subscriptionId }, options) =>
    (await callBookings("mine", { handles, clientId, subscriptionId }, options))?.reservations || [];

export const cancelMyBooking = (handle, scheduleId, clientId) =>
    callBookings("cancel", { handle, scheduleId, clientId });
