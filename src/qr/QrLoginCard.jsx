import React, { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";

import QrImage from "./QrImage";
import { callQr } from "./qrApi";
import "./qr.css";

/* =========================================================
   ENTRAR EM OUTRO APARELHO

   Mostra um QR Code de uso único (90 s, renovado sozinho por
   até 5 minutos). Quem aponta a câmera do celular abre
   /qr-login e entra na MESMA conta, sem digitar nada.

   Só mostre este cartão para quem está logado: o código dá
   acesso à conta de quem o gerou.
========================================================= */

const MAX_SESSION_MS = 5 * 60 * 1000;

export default function QrLoginCard() {

    const [state, setState] = useState({ status: "idle", code: "", expiresAt: 0, error: "" });
    const [now, setNow] = useState(Date.now());
    const startedAt = useRef(0);

    const generate = useCallback(async (fresh) => {

        if (fresh) startedAt.current = Date.now();

        setState((old) => ({ ...old, status: old.code ? "ready" : "loading", error: "" }));

        try {
            const data = await callQr("createQrLogin");
            setState({ status: "ready", code: data.code, expiresAt: data.expiresAt, error: "" });
        } catch (error) {
            setState({ status: "error", code: "", expiresAt: 0, error: error.message });
        }
    }, []);

    /* Relógio e renovação automática. */
    useEffect(() => {

        if (state.status !== "ready") return undefined;

        const tick = setInterval(() => {

            const current = Date.now();
            setNow(current);

            if (current >= state.expiresAt - 8000) {

                if (current - startedAt.current > MAX_SESSION_MS) {
                    setState({ status: "expired", code: "", expiresAt: 0, error: "" });
                } else {
                    generate(false);
                }
            }
        }, 1000);

        return () => clearInterval(tick);
    }, [state.status, state.expiresAt, generate]);

    const seconds = Math.max(0, Math.round((state.expiresAt - now) / 1000));
    const url = state.code ? `${window.location.origin}/qr-login#${state.code}` : "";

    return (
        <section className="qr-card">

            <header>
                <span className="qr-card__icon"><Icon icon="solar:smartphone-2-bold" /></span>
                <div>
                    <h3>Entrar em outro aparelho</h3>
                    <p>Aponte a câmera do celular para o QR Code e a conta abre lá, sem digitar senha.</p>
                </div>
            </header>

            {(state.status === "idle" || state.status === "expired" || state.status === "error") && (
                <div className="qr-card__start">
                    {state.status === "expired" && <p className="qr-note">O QR Code expirou por segurança.</p>}
                    {state.status === "error" && <p className="qr-note is-bad" role="alert">{state.error}</p>}
                    <button type="button" className="qr-btn" onClick={() => generate(true)}>
                        <Icon icon="solar:qr-code-bold" /> {state.status === "idle" ? "Mostrar QR Code" : "Gerar novo QR Code"}
                    </button>
                </div>
            )}

            {state.status === "loading" && <div className="qr-loading"><span className="qr-spin" /></div>}

            {state.status === "ready" && (
                <div className="qr-card__show">
                    <QrImage value={url} size={208} />

                    <div className="qr-timer" aria-live="off">
                        <span style={{ width: `${Math.min(100, (seconds / 90) * 100)}%` }} />
                    </div>

                    <p className="qr-note">
                        Válido por mais {seconds}s e só funciona uma vez. Não mostre este código a ninguém que você não conhece.
                    </p>
                </div>
            )}
        </section>
    );
}
