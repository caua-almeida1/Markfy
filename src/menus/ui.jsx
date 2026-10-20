import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import { Badge, Button, EmptyState, Sheet, cx } from "../design-system/components";
import { centsToInput, formatBRL, toCents } from "./engine/money.js";
import { useMenus } from "./MenusContext.jsx";

/* =========================================================
   PEÇAS COMPARTILHADAS DO PAINEL DO MENUS

   Em cima do design system da rede (mk-*) e das classes de
   página do Studio (std-*): mesma linguagem, mesmas medidas.
========================================================= */

export const PageHead = ({ title, description, actions, eyebrow }) => (
    <div className="std-page__head">
        <div className="std-page__title">
            {eyebrow && <span className="mnu-eyebrow">{eyebrow}</span>}
            <h1 className="mk-title mk-title--md">{title}</h1>
            {description && <p>{description}</p>}
        </div>
        {actions && <div className="std-page__actions">{actions}</div>}
    </div>
);

export const Panel = ({ title, description, actions, children, className, flush }) => (
    <section className={cx("std-panel", flush && "std-panel--flush", className)}>
        {(title || actions) && (
            <div className="std-panel__head">
                <div>
                    {title && <h2>{title}</h2>}
                    {description && <p>{description}</p>}
                </div>
                {actions}
            </div>
        )}
        {children}
    </section>
);

export const Stat = ({ label, value, hint, icon, tone }) => (
    <div className={cx("std-stat", tone && `mnu-stat--${tone}`)}>
        <span className="std-stat__label">
            {icon && <Icon icon={icon} aria-hidden="true" />}
            {label}
        </span>
        <span className="std-stat__value">{value}</span>
        {hint && <span className="std-stat__hint">{hint}</span>}
    </div>
);

export const Money = ({ cents, className }) => <span className={cx("mnu-money", className)}>{formatBRL(cents)}</span>;

export const minutesSince = (millis, now = Date.now()) => Math.max(0, Math.floor((now - Number(millis || now)) / 60000));

export const durationLabel = (minutes) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

export const timeLabel = (millis) =>
    millis ? new Date(millis).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "";

export const dateTimeLabel = (millis) =>
    millis ? new Date(millis).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "";

/** Campo de dinheiro: digita "12,90", guarda centavos. */
export const MoneyInput = ({ value, onChange, placeholder = "0,00", allowEmpty = false, ...rest }) => {
    const [text, setText] = useState(value === null || value === undefined ? "" : centsToInput(value));

    useEffect(() => {
        const current = toCents(text);
        if (current !== (value ?? null)) setText(value === null || value === undefined ? "" : centsToInput(value));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    return (
        <div className="mnu-money-input">
            <span aria-hidden="true">R$</span>
            <input
                className="mk-input"
                inputMode="decimal"
                value={text}
                placeholder={placeholder}
                onChange={(event) => {
                    const next = event.target.value.replace(/[^\d,.]/g, "");
                    setText(next);
                    const cents = toCents(next);
                    onChange(cents === null ? (allowEmpty ? null : 0) : cents);
                }}
                onBlur={() => setText(value === null || value === undefined ? "" : centsToInput(value))}
                {...rest}
            />
        </div>
    );
};

/** Recurso fora do plano: explica o que é e leva ao upgrade, sem travar o resto. */
export const LockedFeature = ({ title, description, bullets = [], icon = "solar:lock-keyhole-minimalistic-linear" }) => {
    const navigate = useNavigate();
    const { path, demo, can } = useMenus();

    return (
        <div className="mnu-locked">
            <span className="mnu-locked__icon" aria-hidden="true"><Icon icon={icon} /></span>
            <Badge tone="warning">Não incluído no plano atual</Badge>
            <h2>{title}</h2>
            <p>{description}</p>
            {bullets.length > 0 && (
                <ul>
                    {bullets.map((item) => (
                        <li key={item}><Icon icon="solar:check-circle-linear" aria-hidden="true" /> {item}</li>
                    ))}
                </ul>
            )}
            <div className="mnu-locked__actions">
                {demo ? (
                    <p className="mk-muted">Na demonstração, troque o plano simulado no topo para ver este recurso.</p>
                ) : can("plan.manage") ? (
                    <Button variant="primary" icon="solar:cup-star-linear" onClick={() => navigate(path("plano"))}>Ver planos com este recurso</Button>
                ) : (
                    <p className="mk-muted">Fale com o proprietário da empresa para incluir este recurso no plano.</p>
                )}
            </div>
            <p className="mnu-locked__note">Tudo o que você já usa continua funcionando normalmente.</p>
        </div>
    );
};

export const Forbidden = ({ what = "esta área" }) => (
    <EmptyState icon="solar:shield-user-linear" title="Sem permissão">
        Seu perfil não tem acesso a {what}. Peça ao proprietário ou a um administrador para ajustar suas permissões.
    </EmptyState>
);

/** Pede um motivo antes de ações auditáveis (cancelar, estornar, desconto). */
export const ReasonDialog = ({ open, title, message, confirmLabel = "Confirmar", tone = "danger", onConfirm, onClose, extra }) => {
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (open) setReason("");
    }, [open]);

    return (
        <Sheet
            open={open}
            onClose={onClose}
            side="center"
            title={title}
            description={message}
            footer={(
                <>
                    <Button variant="ghost" onClick={onClose}>Voltar</Button>
                    <Button
                        variant={tone === "danger" ? "danger" : "primary"}
                        loading={busy}
                        disabled={reason.trim().length < 3}
                        onClick={async () => {
                            setBusy(true);
                            try {
                                await onConfirm(reason.trim());
                                onClose();
                            } catch {
                                /* o aviso de erro já foi mostrado */
                            } finally {
                                setBusy(false);
                            }
                        }}
                    >
                        {confirmLabel}
                    </Button>
                </>
            )}
        >
            <div className="mnu-form">
                {extra}
                <label className="mk-field">
                    <span className="mk-field__label">Motivo (fica registrado na auditoria)</span>
                    <textarea className="mk-textarea" value={reason} maxLength={140} onChange={(event) => setReason(event.target.value)} autoFocus />
                </label>
            </div>
        </Sheet>
    );
};

export const Toggle = ({ checked, onChange, label, hint, disabled }) => (
    <div className={cx("mnu-toggle", disabled && "is-disabled")}>
        <span>
            <b>{label}</b>
            {hint && <small>{hint}</small>}
        </span>
        <button
            type="button"
            role="switch"
            className="mk-switch"
            aria-checked={!!checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
        />
    </div>
);

export const Loading = ({ label = "Carregando" }) => (
    <div className="mnu-loading" role="status">
        <span className="mk-spinner" aria-hidden="true" /> {label}…
    </div>
);

/** Selo de demonstração em telas que mostram operação. */
export const DemoTag = () => {
    const { demo } = useMenus();
    return demo ? <Badge tone="info">Dados de demonstração</Badge> : null;
};

export const idemKey = (prefix = "op") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
