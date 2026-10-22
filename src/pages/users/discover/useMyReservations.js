import { useCallback, useEffect, useState } from "react";

import { useAuth } from "../../../contexts/authContext";
import { fetchMyBookings } from "../../../firebase/bookingsApi";
import { getBookedCompanies, parseScheduleDate } from "../../../utils/bookingHistory";
import { isCancelled } from "../../../utils/scheduleStatus";

/* =========================================================
   MINHAS RESERVAS EM TODAS AS EMPRESAS

   Mesmo critério da aba Reservas de uma empresa: é minha a
   reserva desta conta (userId) OU deste aparelho (clientId).
   A diferença é que aqui a lista de empresas vem do
   histórico (utils/bookingHistory), não da URL.

   O clientId é lido sem ser criado: quem nunca agendou não
   ganha um identificador só por abrir a tela.
========================================================= */

const readClientId = () => {
    try {
        return localStorage.getItem("markfy-client-id");
    } catch {
        return null;
    }
};

export const useMyReservations = () => {
    const { currentUser } = useAuth();
    const uid = currentUser?.uid || null;

    const [state, setState] = useState({ loading: true, reservations: [], error: null });

    const load = useCallback(async () => {
        setState((current) => ({ ...current, loading: true }));

        try {
            const handles = await getBookedCompanies(uid);
            const clientId = readClientId();

            /* Uma chamada só para todas as empresas: o backend
               filtra por conta/aparelho e não devolve a agenda
               de outros clientes (que é privada). */
            const mine = handles.length && (uid || clientId)
                ? await fetchMyBookings({ handles, clientId })
                : [];

            const now = Date.now();

            const reservations = mine
                .map((item) => ({
                    ...item,
                    date: parseScheduleDate(item.day, item.hour)
                }))
                .sort((a, b) => (a.date?.getTime() || 0) - (b.date?.getTime() || 0))
                .map((item) => ({
                    ...item,
                    upcoming:
                        !!item.date &&
                        item.date.getTime() >= now - 60 * 60 * 1000 &&
                        !isCancelled(item.status) &&
                        item.status !== "completed"
                }));

            setState({ loading: false, reservations, error: null });
        } catch (error) {
            setState({ loading: false, reservations: [], error });
        }
    }, [uid]);

    useEffect(() => {
        load();
    }, [load]);

    return { ...state, reload: load };
};
