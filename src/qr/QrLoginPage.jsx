import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuth, signInWithCustomToken } from "firebase/auth";
import { Icon } from "@iconify/react";

import { callQr } from "./qrApi";
import markfyLogo from "../img/logo-markfy.svg";
import "./qr.css";

/* Rota /qr-login#CODIGO — destino do QR Code de "Entrar em outro
   aparelho". O código vai no fragmento (#), que o navegador não
   envia ao servidor nem a outros sites. */

export default function QrLoginPage() {

    const navigate = useNavigate();
    const [state, setState] = useState({ status: "working", message: "" });
    const ran = useRef(false);

    useEffect(() => {

        if (ran.current) return;
        ran.current = true;

        const code = window.location.hash.replace(/^#/, "");

        /* Tira o código da barra de endereço e do histórico. */
        window.history.replaceState(null, "", window.location.pathname);

        if (!code) {
            setState({ status: "error", message: "Este link não tem um código. Leia o QR Code de novo." });
            return;
        }

        (async () => {
            try {
                const data = await callQr("redeemQrLogin", { code }, { auth: false });
                await signInWithCustomToken(getAuth(), data.customToken);
                setState({ status: "ok", message: "" });
                setTimeout(() => navigate("/home", { replace: true }), 900);
            } catch (error) {
                setState({ status: "error", message: error.message || "Não foi possível entrar." });
            }
        })();

    }, [navigate]);

    return (
        <main className="qr-page">
            <div className="qr-page__card">
                <img className="qr-page__logo" src={markfyLogo} alt="Markfy" />

                {state.status === "working" && (
                    <>
                        <span className="qr-spin qr-spin--lg" />
                        <h1>Conectando sua conta…</h1>
                        <p>Só um instante.</p>
                    </>
                )}

                {state.status === "ok" && (
                    <>
                        <span className="qr-ok"><Icon icon="solar:check-circle-bold" /></span>
                        <h1>Pronto, você entrou!</h1>
                        <p>Abrindo a Markfy…</p>
                    </>
                )}

                {state.status === "error" && (
                    <>
                        <span className="qr-ok is-bad"><Icon icon="solar:danger-triangle-bold" /></span>
                        <h1>Não foi possível entrar</h1>
                        <p>{state.message}</p>
                        <button type="button" className="qr-btn" onClick={() => navigate("/login")}>Entrar com e-mail e senha</button>
                    </>
                )}
            </div>
        </main>
    );
}
