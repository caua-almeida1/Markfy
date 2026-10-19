import { useCallback, useEffect, useState } from "react";
import { getDatabase, ref, get } from "firebase/database";

import { useAuth } from "../../../contexts/authContext";
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
            const db = getDatabase();

            const perCompany = await Promise.all(
                handles.map(async (handle) => {
                    try {
                        const [schedules, name] = await Promise.all([
                            get(ref(db, `companys/${handle}/schedules`)),
                            get(ref(db, `companys/${handle}/name`))
                        ]);

                        return Object.entries(schedules.val() || {})
                            .map(([id, item]) => ({ id, ...item }))
                            .filter((item) =>
                                (uid && item.userId === uid) ||
                                (clientId && item.clientId === clientId)
                            )
                            .map((item) => ({
                                ...item,
                                handle,
                                companyName: name.val() || handle,
                                date: parseScheduleDate(item.day, item.hour)
                            }));
                    } catch {
                        return [];
                    }
                })
            );

            const now = Date.now();

            const reservations = perCompany
                .flat()
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
