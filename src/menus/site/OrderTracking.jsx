import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react";

import { formatBRL } from "../engine/money.js";
import { flowFor, PAYMENT_METHODS, PAYMENT_STATUS, STATUS } from "../engine/orders.js";

/* =========================================================
   ACOMPANHAMENTO DO PEDIDO (cliente)

   Lê menusTrack/{handle}/{pedido} — um espelho sem dados
   pessoais, gravado pelo servidor a cada mudança de status.
   Atualiza sozinho; nada aqui é simulado.
========================================================= */

export default function OrderTracking({ watch }) {
    const [state, setState] = useState({ loading: true, track: null });

    useEffect(() => watch((track) => setState({ loading: false, track })), [watch]);

    if (state.loading) return <p className="mnr-muted" role="status">Carregando o andamento…</p>;
    if (!state.track) return <p className="mnr-muted">Não encontramos este pedido. Confira o link com o estabelecimento.</p>;

    const { track } = state;
    const flow = flowFor(track.channel, {});
    const current = flow.indexOf(track.status);
    const cancelled = track.status === "cancelled";

    return (
        <div className="mnr-track" aria-live="polite">
            <div className="mnr-track__head">
                <span>Pedido</span>
                <b>#{track.code}</b>
                <span className={`mnr-track__status ${cancelled ? "is-bad" : track.status === "completed" ? "is-ok" : ""}`}>
                    {STATUS[track.status]?.label || track.status}
                </span>
            </div>

            {cancelled ? (
                <p className="mnr-warn">Este pedido foi cancelado pelo estabelecimento{track.cancelReason ? `: ${track.cancelReason}` : "."}</p>
            ) : (
                <ol className="mnr-steps">
                    {flow.map((status, index) => (
                        <li key={status} className={index < current ? "is-done" : index === current ? "is-now" : ""}>
                            <span className="mnr-steps__dot" aria-hidden="true">
                                {index < current ? <Icon icon="solar:check-read-linear" /> : index + 1}
                            </span>
                            <span>{STATUS[status].label}</span>
                        </li>
                    ))}
                </ol>
            )}

            {track.etaMinutes && !cancelled && track.status !== "completed" && (
                <p className="mnr-muted"><Icon icon="solar:clock-circle-linear" aria-hidden="true" /> Tempo estimado informado pelo estabelecimento: ~{track.etaMinutes} min.</p>
            )}

            <ul className="mnr-track__items">
                {(track.items || []).map((item, index) => (
                    <li key={index}>{item.qty}× {item.name}{item.sizeName ? ` (${item.sizeName})` : ""}</li>
                ))}
            </ul>

            <dl className="mnr-totals">
                <dt>Total</dt>
                <dd>{formatBRL(track.totalCents)}</dd>
                {track.paymentStatus && track.paymentStatus !== "tab" && (
                    <>
                        <dt>Pagamento</dt>
                        <dd>
                            {track.paymentMethod ? `${PAYMENT_METHODS[track.paymentMethod]?.label || ""} · ` : ""}
                            {PAYMENT_STATUS[track.paymentStatus]?.label}
                        </dd>
                    </>
                )}
            </dl>
        </div>
    );
}
