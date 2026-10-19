import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react";

import QrImage from "./QrImage";
import { callQr, ROLE_LABELS } from "./qrApi";
import { useLicense } from "../plans/LicenseContext";
import { useUserCompany } from "../contexts/companyContext/UserCompanyContext";
import "./qr.css";

/* =========================================================
   CONVITE POR QR CODE

   O administrador escolhe a FUNÇÃO antes; a pessoa aponta a
   câmera, preenche o cadastro essencial e já entra na equipe
   com essa função. O convite é de uso único e expira.

   Quem confere função, plano da empresa e limite da equipe é
   o backend — este painel só pede e mostra.
========================================================= */

const TTL_OPTIONS = [
    { index: 0, label: "15 minutos" },
    { index: 1, label: "1 hora" },
    { index: 2, label: "24 horas" }
];

export default function TeamQrInvite() {

    const { companyHandle, members } = useUserCompany();
    const license = useLicense();

    const [role, setRole] = useState("professional");
    const [ttl, setTtl] = useState(0);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [invite, setInvite] = useState(null);
    const [now, setNow] = useState(Date.now());
    const [copied, setCopied] = useState(false);

    const limit = license.limit("maxMembers");
    const full = (members?.length || 0) >= limit;

    useEffect(() => {

        if (!invite) return undefined;

        const id = setInterval(() => setNow(Date.now()), 1000);

        return () => clearInterval(id);
    }, [invite]);

    const expired = invite && now >= invite.expiresAt;
    const url = invite ? `${window.location.origin}/entrar-equipe/${invite.inviteId}` : "";

    const generate = async () => {

        setBusy(true);
        setError("");

        try {
            const data = await callQr("createQrInvite", { handle: companyHandle, role, ttlIndex: ttl });
            setInvite({ inviteId: data.inviteId, expiresAt: data.expiresAt, role });
            setNow(Date.now());
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            setError("Não foi possível copiar o link.");
        }
    };

    const remaining = invite ? Math.max(0, Math.round((invite.expiresAt - now) / 1000)) : 0;
    const clock = `${String(Math.floor(remaining / 3600)).padStart(2, "0")}:${String(Math.floor((remaining % 3600) / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;

    return (
        <section className="qr-card qr-card--team">

            <header>
                <span className="qr-card__icon"><Icon icon="solar:qr-code-bold" /></span>
                <div>
                    <h3>Convidar por QR Code</h3>
                    <p>Escolha a função, mostre o QR Code e a pessoa se cadastra pelo celular.</p>
                </div>
            </header>

            {full && (
                <p className="qr-note is-warn">
                    <Icon icon="solar:danger-triangle-bold" />
                    A equipe já está no limite do plano ({Number.isFinite(limit) ? limit : "—"} pessoas). Para convidar mais gente, o administrador principal precisa mudar de plano.
                </p>
            )}

            <div className="qr-field">
                <span>Função da pessoa</span>
                <div className="qr-seg" role="radiogroup" aria-label="Função">
                    {Object.entries(ROLE_LABELS).map(([id, label]) => (
                        <button
                            key={id}
                            type="button"
                            role="radio"
                            aria-checked={role === id}
                            className={role === id ? "is-on" : ""}
                            onClick={() => setRole(id)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="qr-field">
                <span>O QR Code vale por</span>
                <div className="qr-seg">
                    {TTL_OPTIONS.map((option) => (
                        <button
                            key={option.index}
                            type="button"
                            className={ttl === option.index ? "is-on" : ""}
                            onClick={() => setTtl(option.index)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {error && <p className="qr-note is-bad" role="alert"><Icon icon="solar:danger-triangle-bold" /> {error}</p>}

            {(!invite || expired) && (
                <button type="button" className="qr-btn" disabled={busy || !companyHandle} onClick={generate}>
                    {busy ? <span className="qr-spin" /> : <Icon icon="solar:qr-code-bold" />}
                    {expired ? "Gerar novo QR Code" : "Gerar QR Code"}
                </button>
            )}

            {invite && !expired && (
                <div className="qr-card__show">
                    <QrImage value={url} size={216} />

                    <p className="qr-role">
                        Entra como <b>{ROLE_LABELS[invite.role]}</b> · expira em <b>{clock}</b>
                    </p>

                    <div className="qr-actions">
                        <button type="button" className="qr-btn qr-btn--ghost" onClick={copy}>
                            <Icon icon={copied ? "solar:check-circle-bold" : "solar:copy-linear"} /> {copied ? "Copiado" : "Copiar link"}
                        </button>
                        <button type="button" className="qr-btn qr-btn--ghost" onClick={generate} disabled={busy}>
                            <Icon icon="solar:refresh-bold" /> Novo código
                        </button>
                    </div>

                    <p className="qr-note">Uso único: assim que alguém se cadastrar, este QR Code deixa de funcionar.</p>
                </div>
            )}
        </section>
    );
}
