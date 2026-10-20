import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import { cx } from "../../design-system/components";
import { describeLine } from "../engine/pricing.js";
import { CHANNELS, STATUS } from "../engine/orders.js";
import { entries } from "../engine/util.js";
import { useMenus, useNow } from "../MenusContext.jsx";
import { durationLabel, minutesSince } from "../ui.jsx";

/* =========================================================
   TELA DA COZINHA

   Alto contraste, letras grandes e só o que importa para
   preparar: número, mesa ou canal, tempo, itens, opções e
   observações. Um toque por etapa. Sem preços, sem dados do
   cliente, sem configurações.

   Pedidos ainda "Recebidos" (não confirmados pela equipe)
   não aparecem aqui — só o aviso de quantos estão na fila.
========================================================= */

const LANES = [
    { id: "confirmed", label: "A preparar", action: "preparing", actionLabel: "Iniciar" },
    { id: "preparing", label: "Em preparo", action: "ready", actionLabel: "Pronto" },
    { id: "ready", label: "Prontos", action: null, actionLabel: "" }
];

const finishFor = (order, settings) =>
    ["table", "counter"].includes(order.channel)
        ? "completed"
        : order.channel === "pickup"
            ? settings?.ordering?.useAwaitingPickup === false ? "completed" : "awaiting_pickup"
            : null;

export default function Kitchen() {
    const navigate = useNavigate();
    const { orders, settings, act, path, soundOn, toggleSound, demo } = useMenus();
    const now = useNow(15000);
    const [clock, setClock] = useState(new Date());
    const [busy, setBusy] = useState(null);

    useEffect(() => {
        const id = setInterval(() => setClock(new Date()), 30000);
        document.body.classList.add("mnu-kds-body");
        return () => {
            clearInterval(id);
            document.body.classList.remove("mnu-kds-body");
        };
    }, []);

    const list = useMemo(() => entries(orders).filter((order) => ["confirmed", "preparing", "ready"].includes(order.status)).sort((a, b) => a.createdAt - b.createdAt), [orders]);
    const waiting = entries(orders).filter((order) => order.status === "received").length;
    const late = Number(settings.ordering?.lateAfterMinutes) || 30;

    const move = async (order, to) => {
        setBusy(order.id);
        try {
            await act("orders.status", { orderId: order.id, to });
        } catch {
            /* aviso já exibido */
        } finally {
            setBusy(null);
        }
    };

    return (
        <div className="mk-root mnu mnu-kds">
            <header className="mnu-kds__top">
                <button type="button" className="mnu-kds__back" onClick={() => navigate(path(""))}><Icon icon="solar:arrow-left-linear" aria-hidden="true" /> Sair</button>
                <h1>Cozinha{demo ? " · demonstração" : ""}</h1>
                {waiting > 0 && <span className="mnu-kds__queue"><Icon icon="solar:inbox-in-bold" aria-hidden="true" /> {waiting} aguardando confirmação no salão</span>}
                <button type="button" className="mnu-kds__sound" aria-pressed={soundOn} onClick={toggleSound}>
                    <Icon icon={soundOn ? "solar:volume-loud-bold" : "solar:volume-cross-bold"} aria-hidden="true" /> {soundOn ? "Som ligado" : "Som desligado"}
                </button>
                <time className="mnu-kds__clock">{clock.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>
            </header>

            <div className="mnu-kds__lanes">
                {LANES.map((lane) => {
                    const laneOrders = list.filter((order) => order.status === lane.id);
                    return (
                        <section key={lane.id} className={`mnu-kds__lane is-${lane.id}`} aria-label={lane.label}>
                            <h2>{lane.label} <span>{laneOrders.length}</span></h2>
                            <div className="mnu-kds__cards">
                                {laneOrders.map((order) => {
                                    const minutes = minutesSince(order.preparingAt || order.confirmedAt || order.createdAt, now);
                                    const isLate = minutesSince(order.createdAt, now) > late && lane.id !== "ready";
                                    const items = (order.items || []).filter((item) => item.status !== "cancelled");
                                    const cancelledItems = (order.items || []).filter((item) => item.status === "cancelled");
                                    const finish = finishFor(order, settings);
                                    return (
                                        <article key={order.id} className={cx("mnu-kcard", isLate && "is-late")}>
                                            <header>
                                                <b>#{order.code}</b>
                                                <span><Icon icon={CHANNELS[order.channel]?.icon} aria-hidden="true" /> {order.tableLabel || CHANNELS[order.channel]?.label}</span>
                                                <span className="mnu-kcard__time">{durationLabel(minutes)}{isLate ? " · atrasado" : ""}</span>
                                            </header>
                                            <ul>
                                                {items.map((item, index) => (
                                                    <li key={index}>
                                                        <b>{item.qty}×</b>
                                                        <span>
                                                            {item.name}
                                                            {describeLine(item) && <small>{describeLine(item)}</small>}
                                                            {item.notes && <em>⚠ {item.notes}</em>}
                                                        </span>
                                                    </li>
                                                ))}
                                                {cancelledItems.map((item, index) => (
                                                    <li key={`x${index}`} className="is-cancelled"><b>{item.qty}×</b><span>{item.name} <small>CANCELADO</small></span></li>
                                                ))}
                                            </ul>
                                            {order.notes && <p className="mnu-kcard__note">⚠ {order.notes}</p>}
                                            <footer>
                                                {lane.action && (
                                                    <button type="button" className="mnu-kbtn" disabled={busy === order.id} onClick={() => move(order, lane.action)}>
                                                        {lane.actionLabel}
                                                    </button>
                                                )}
                                                {lane.id === "ready" && finish && (
                                                    <button type="button" className="mnu-kbtn is-done" disabled={busy === order.id} onClick={() => move(order, finish)}>
                                                        {finish === "completed" ? "Entregue" : "Aguardando retirada"}
                                                    </button>
                                                )}
                                                {lane.id === "ready" && !finish && <span className="mnu-kcard__wait">Aguardando entregador</span>}
                                                {lane.id !== "confirmed" && (
                                                    <button type="button" className="mnu-kbtn is-ghost" disabled={busy === order.id} onClick={() => move(order, lane.id === "preparing" ? "confirmed" : "preparing")} aria-label={`Voltar ${order.code} para ${lane.id === "preparing" ? STATUS.confirmed.label : STATUS.preparing.label}`}>
                                                        <Icon icon="solar:undo-left-linear" aria-hidden="true" />
                                                    </button>
                                                )}
                                            </footer>
                                        </article>
                                    );
                                })}
                                {!laneOrders.length && <p className="mnu-kds__empty">Nada aqui.</p>}
                            </div>
                        </section>
                    );
                })}
            </div>
        </div>
    );
}
