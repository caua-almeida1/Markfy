import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import { Badge, Button, EmptyState } from "../../design-system/components";
import { formatBRL } from "../engine/money.js";
import { PAYMENT_METHODS, TERMINAL } from "../engine/orders.js";
import { entries } from "../engine/util.js";
import { useMenus, useNode, useNow } from "../MenusContext.jsx";
import { isToday } from "../data/selectors.js";
import TableDetail from "../tables/TableDetail.jsx";
import { OrderDetail } from "./Orders.jsx";
import { DemoTag, PageHead, Panel, Stat, durationLabel, minutesSince, timeLabel } from "../ui.jsx";

/* =========================================================
   CAIXA

   O que entrou hoje por forma de pagamento (do livro de
   recebimentos gravado pelo servidor), contas aguardando
   pagamento, pedidos com pagamento pendente e comandas
   fechadas — com reabertura para quem tem permissão.
   "Recebido" é só o que foi registrado: nada é estimado.
========================================================= */

export default function Cashier() {
    const navigate = useNavigate();
    const { source, handle, settings, openTabs, orders, can, features, path } = useMenus();
    const now = useNow(30000);
    const tz = settings.timezone;

    const since = Math.floor(now / 3600000) * 3600000 - 26 * 3600000;
    const ledger = useNode(source, handle && `menusLedger/${handle}`, { orderBy: "at", startAt: since });
    const closed = useNode(source, handle && `menusOps/${handle}/tabs`, { orderBy: "closedAt", startAt: since });

    const [tabId, setTabId] = useState(null);
    const [orderId, setOrderId] = useState(null);

    const today = useMemo(() => entries(ledger.value).filter((row) => isToday(row.at, tz, now)), [ledger.value, tz, now]);
    const byMethod = {};
    today.forEach((row) => {
        byMethod[row.method || "other"] = (byMethod[row.method || "other"] || 0) + (Number(row.amountCents) || 0);
    });
    const received = today.filter((row) => row.kind === "payment").reduce((sum, row) => sum + row.amountCents, 0);
    const refunds = today.filter((row) => row.kind === "refund").reduce((sum, row) => sum + row.amountCents, 0);

    const waitingTabs = entries(openTabs).filter((tab) => (tab.totals?.balanceCents || 0) > 0).sort((a, b) => Number(b.billRequested || 0) - Number(a.billRequested || 0) || a.openedAt - b.openedAt);
    const pendingOrders = entries(orders).filter((order) => order.payment?.status === "pending" && order.status !== "cancelled").sort((a, b) => a.createdAt - b.createdAt);
    const refundDue = entries(orders).filter((order) => order.refundPending);
    const closedToday = entries(closed.value).filter((tab) => tab.status === "closed" && isToday(tab.closedAt, tz, now)).sort((a, b) => b.closedAt - a.closedAt);

    const currentOrder = orderId ? { ...orders[orderId], id: orderId } : null;

    return (
        <div className="std-page">
            <PageHead
                title="Caixa"
                description="Recebimentos registrados hoje, contas abertas e pagamentos pendentes."
                actions={<><DemoTag />{can("reports.view") && <Button variant="outline" icon="solar:chart-2-linear" onClick={() => navigate(path("relatorios"))}>Relatórios</Button>}</>}
            />

            {ledger.error ? (
                <Panel><p className="mk-muted">Seu perfil não tem acesso ao livro de recebimentos.</p></Panel>
            ) : (
                <div className="std-stats mnu-stats">
                    <Stat label="Recebido hoje" icon="solar:wallet-money-linear" value={formatBRL(received)} hint={`${today.filter((row) => row.kind === "payment").length} recebimento(s)`} />
                    <Stat label="Estornos" icon="solar:undo-left-round-linear" value={formatBRL(Math.abs(refunds))} tone={refunds ? "warning" : undefined} />
                    <Stat label="Saldo do dia" icon="solar:calculator-linear" value={formatBRL(received + refunds)} hint="recebido menos estornos" />
                    <Stat label="Em aberto nas mesas" icon="solar:bill-list-linear" value={formatBRL(waitingTabs.reduce((sum, tab) => sum + (tab.totals?.balanceCents || 0), 0))} hint={`${waitingTabs.length} comanda(s)`} />
                </div>
            )}

            <div className="std-grid std-grid--main">
                <div className="std-grid">
                    {features.menusTables && (
                        <Panel title="Contas aguardando pagamento" description="As que pediram a conta aparecem primeiro.">
                            {!waitingTabs.length ? (
                                <EmptyState icon="solar:check-circle-linear" title="Nenhuma conta em aberto" />
                            ) : (
                                <ul className="std-list">
                                    {waitingTabs.map((tab) => (
                                        <li key={tab.id}>
                                            <button type="button" className="std-row" onClick={() => setTabId(tab.id)}>
                                                <span className={`std-row__icon ${tab.billRequested ? "mnu-tone--warn" : ""}`}><Icon icon={tab.billRequested ? "solar:bill-list-bold" : "solar:bill-list-linear"} /></span>
                                                <span className="std-row__body">
                                                    <span className="std-row__title">{tab.label}{tab.billRequested && <> · <Badge tone="warning">pediu a conta</Badge></>}</span>
                                                    <span className="std-row__meta">aberta há {durationLabel(minutesSince(tab.openedAt, now))}{tab.guests ? ` · ${tab.guests} pessoa(s)` : ""}{tab.totals?.paidCents ? ` · já pago ${formatBRL(tab.totals.paidCents)}` : ""}</span>
                                                </span>
                                                <span className="std-row__aside"><strong>{formatBRL(tab.totals?.balanceCents)}</strong>saldo</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Panel>
                    )}

                    <Panel title="Pedidos com pagamento pendente" description="Confirme só quando o dinheiro, o cartão ou o Pix forem recebidos.">
                        {!pendingOrders.length ? (
                            <p className="mk-muted">Nenhum pagamento pendente.</p>
                        ) : (
                            <ul className="std-list">
                                {pendingOrders.map((order) => (
                                    <li key={order.id}>
                                        <button type="button" className="std-row" onClick={() => setOrderId(order.id)}>
                                            <span className="std-row__icon"><Icon icon={PAYMENT_METHODS[order.payment?.method]?.icon || "solar:wallet-linear"} /></span>
                                            <span className="std-row__body">
                                                <span className="std-row__title">#{order.code} · {order.customer?.name || order.channel}</span>
                                                <span className="std-row__meta">{PAYMENT_METHODS[order.payment?.method]?.label || "Forma não informada"} · {TERMINAL.includes(order.status) ? "pedido concluído" : "em andamento"} · {timeLabel(order.createdAt)}</span>
                                            </span>
                                            <span className="std-row__aside"><strong>{formatBRL(order.totals?.totalCents)}</strong></span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        {refundDue.length > 0 && (
                            <p className="mnu-alert is-warn">{refundDue.length} pedido(s) cancelado(s) já pago(s) aguardando registro de estorno.</p>
                        )}
                    </Panel>
                </div>

                <div className="std-grid">
                    {!ledger.error && (
                        <Panel title="Por forma de pagamento" description="Hoje, já descontados os estornos.">
                            {!Object.keys(byMethod).length ? (
                                <p className="mk-muted">Nenhum recebimento hoje.</p>
                            ) : (
                                <ul className="mnu-bars">
                                    {Object.entries(byMethod).sort(([, a], [, b]) => b - a).map(([method, value]) => (
                                        <li key={method}>
                                            <span><Icon icon={PAYMENT_METHODS[method]?.icon || "solar:wallet-linear"} aria-hidden="true" /> {PAYMENT_METHODS[method]?.label || "Outro"}</span>
                                            <i style={{ "--w": `${Math.max(4, (value / Math.max(1, received)) * 100)}%` }} />
                                            <b>{formatBRL(value)}</b>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Panel>
                    )}

                    {features.menusTables && (
                        <Panel title="Comandas fechadas hoje">
                            {!closedToday.length ? (
                                <p className="mk-muted">Nenhuma comanda fechada hoje.</p>
                            ) : (
                                <ul className="std-list">
                                    {closedToday.slice(0, 30).map((tab) => (
                                        <li key={tab.id}>
                                            <button type="button" className="std-row" onClick={() => setTabId(tab.id)}>
                                                <span className="std-row__body">
                                                    <span className="std-row__title">{tab.label}</span>
                                                    <span className="std-row__meta">fechada às {timeLabel(tab.closedAt)}{tab.reopened ? " · já foi reaberta" : ""}</span>
                                                </span>
                                                <span className="std-row__aside"><strong>{formatBRL(tab.totals?.totalCents)}</strong></span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Panel>
                    )}
                </div>
            </div>

            {tabId && <TableDetail tabId={tabId} onClose={() => setTabId(null)} />}
            {currentOrder?.code && <OrderDetail order={currentOrder} onClose={() => setOrderId(null)} />}
        </div>
    );
}
