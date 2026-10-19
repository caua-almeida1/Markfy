import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDatabase, onValue, ref, get } from "firebase/database";

/* =========================================================
   ACESSO PÚBLICO DA EMPRESA

   publicAccess/{handle} = { bookings, studio, expiresAt }

   É o espelho PÚBLICO e mínimo da licença (sem nota, sem
   pedido, sem nada interno), para a página de agendamento e
   a tela Explorar saberem se a empresa pode receber clientes.
   Só a conta master e o backend gravam esse nó.

   Empresa sem registro, vencida ou suspensa = indisponível.
========================================================= */

const isOpen = (entry, now = Date.now()) =>
    Boolean(entry && entry.bookings === true && (!entry.expiresAt || Number(entry.expiresAt) > now));

export const usePublicAccess = (handle) => {

    const [state, setState] = useState({ handle: null, loading: true, open: false });

    useEffect(() => {

        if (!handle) return undefined;

        return onValue(
            ref(getDatabase(), `publicAccess/${handle}`),
            (snapshot) => setState({ handle, loading: false, open: isOpen(snapshot.val()) }),
            () => setState({ handle, loading: false, open: false })
        );
    }, [handle]);

    /* Valor de outra empresa ainda não vale: segue carregando. */
    return state.handle === handle ? state : { handle, loading: true, open: false };
};

/** Handles que podem receber clientes agora (para a tela Explorar). */
export const fetchOpenHandles = async () => {

    try {

        const snapshot = await get(ref(getDatabase(), "publicAccess"));
        const data = snapshot.val() || {};

        return new Set(Object.keys(data).filter((handle) => isOpen(data[handle])));

    } catch {

        return new Set();
    }
};

export function CompanyUnavailable() {

    const navigate = useNavigate();

    return (
        <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, textAlign: "center", fontFamily: "var(--mk-font, Poppins, system-ui, sans-serif)", color: "var(--mkf-text-primary, #17181c)", background: "var(--mkf-ui-background, #f8f9fb)" }}>
            <div style={{ maxWidth: 420 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: "-0.04em", margin: "0 0 10px" }}>Empresa indisponível</h1>
                <p style={{ margin: "0 0 22px", lineHeight: 1.6, color: "var(--mkf-text-secondary, #5f626b)" }}>
                    Esta empresa não está recebendo agendamentos pela Markfy no momento.
                </p>
                <button
                    type="button"
                    onClick={() => navigate("/central-user")}
                    style={{ height: 46, padding: "0 26px", border: 0, borderRadius: 99, fontWeight: 700, color: "#fff", background: "var(--mkf-ui-primary, #092af3)", cursor: "pointer" }}
                >
                    Ver outras empresas
                </button>
            </div>
        </div>
    );
}

/** Envolve uma página de empresa: só renderiza se ela está aberta. */
export function PublicAccessGate({ handle, children }) {

    const access = usePublicAccess(handle);

    if (!handle) return children;
    if (access.loading) return <div style={{ minHeight: "100vh" }} />;
    if (!access.open) return <CompanyUnavailable />;

    return <>{children}</>;
}
