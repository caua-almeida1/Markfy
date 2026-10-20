import React, { useMemo, useState } from "react";
import { Icon } from "@iconify/react";

import { Button, Segmented } from "../../design-system/components";
import { formatBRL } from "../engine/money.js";
import { CHANNELS, PAYMENT_METHODS, SOURCES } from "../engine/orders.js";
import { DEFAULT_TZ, localParts } from "../engine/hours.js";
import { entries } from "../engine/util.js";
import { useMenus, useNode, useNow } from "../MenusContext.jsx";
import { byHour, downloadText, startOfDay, toCsv, topProducts } from "../data/selectors.js";
import { DemoTag, LockedFeature, PageHead, Panel, Stat, durationLabel } from "../ui.jsx";
import { LOCKED } from "../locked.js";

/* =========================================================
   RELATÓRIOS

   Tudo calculado a partir de pedidos, comandas e do livro de
   recebimentos, no fuso da empresa. Bruto, descontos, taxas,
   cancelamentos e líquido aparecem separados. "Recebido" é só
   o que foi registrado como pago; o resto é chamado de "a
   receber", nunca de faturado.
========================================================= */

const DAY = 86400000;

/** Meia-noite de "aaaa-mm-dd" no fuso da empresa. */
const zonedStart = (dateText, tz) => {
    const [y, m, d] = dateText.split("-").map(Number);
    const utc = Date.UTC(y, m - 1, d);
    const parts = localParts(utc, tz);
    const key = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    return parts.dayKey === key ? utc - parts.minutes * 60000 : utc + (1440 - parts.minutes) * 60000;
};

const dateInput = (millis, tz) => localParts(millis, tz).dayKey;

export default function Reports() {
    const { source, handle, settings, features, can, catalog, demo } = useMenus();
    const now = useNow(60000);
    const tz = settings.timezone || DEFAULT_TZ;
    const advanced = Boolean(features.menusReports);

    const [preset, setPreset] = useState("7d");
    const [from, setFrom] = useState(dateInput(now - 6 * DAY, tz));
    const [to, setTo] = useState(dateInput(now, tz));
    const [channel, setChannel] = useState("all");

    const range = useMemo(() => {
        const today = startOfDay(Math.floor(now / 60000) * 60000, tz);
        if (preset === "today") return { start: today, end: today + DAY };
        if (preset === "yesterday") return { start: today - DAY, end: today };
        if (preset === "7d") return { start: today - 6 * DAY, end: today + DAY };
        if (preset === "30d") return { start: today - 29 * DAY, end: today + DAY };
        return { start: zonedStart(from, tz), end: zonedStart(to, tz) + DAY };
    }, [preset, from, to, now, tz]);

    const ordersNode = useNode(source, handle && `menusOps/${handle}/orders`, { orderBy: "createdAt", startAt: range.start, endAt: range.end });
    const tabsNode = useNode(source, handle && `menusOps/${handle}/tabs`, { orderBy: "closedAt", startAt: range.start, endAt: range.end });
    const ledgerNode = useNode(source, can("reports.financial") || can("tabs.payment") ? `menusLedger/${handle}` : null, { orderBy: "at", startAt: range.start, endAt: range.end });

    const data = useMemo(() => {
        const orders = entries(ordersNode.value).filter((order) => channel === "all" || order.channel === channel);
        const valid = orders.filter((order) => order.status !== "cancelled");
        const cancelled = orders.filter((order) => order.status === "cancelled");
        const tabs = entries(tabsNode.value).filter((tab) => tab.status === "closed");
        const ledger = entries(ledgerNode.value);

        const gross = valid.reduce((sum, order) => sum + (order.totals?.subtotalCents || 0), 0);
        const delivery = valid.reduce((sum, order) => sum + (order.totals?.deliveryFeeCents || 0), 0);
        const includeTabs = channel === "all" || channel === "table" || channel === "counter";
        const discounts = includeTabs ? tabs.reduce((sum, tab) => sum + (tab.totals?.discountCents || 0), 0) : 0;
        const service = includeTabs ? tabs.reduce((sum, tab) => sum + (tab.totals?.serviceCents || 0), 0) : 0;
        const net = gross - discounts + service + delivery;

        const visits = valid.filter((order) => !order.tabId).length + (includeTabs ? tabs.length : 0);

        const receivedRows = ledger.filter((row) => row.kind === "payment");
        const refundRows = ledger.filter((row) => row.kind === "refund");
        const received = receivedRows.reduce((sum, row) => sum + row.amountCents, 0);
        const refunded = refundRows.reduce((sum, row) => sum + row.amountCents, 0);

        const methods = {};
        ledger.forEach((row) => {
            methods[row.method || "other"] = (methods[row.method || "other"] || 0) + row.amountCents;
        });

        const channels = {};
        valid.forEach((order) => {
            const key = order.channel;
            channels[key] = channels[key] || { count: 0, cents: 0 };
            channels[key].count += 1;
            channels[key].cents += (order.totals?.subtotalCents || 0) + (order.totals?.deliveryFeeCents || 0);
        });

        const sources = {};
        valid.forEach((order) => {
            sources[order.source] = (sources[order.source] || 0) + 1;
        });

        const categories = {};
        topProducts(valid, 200).forEach((row) => {
            const id = row.categoryId || "outros";
            categories[id] = categories[id] || { qty: 0, cents: 0 };
            categories[id].qty += row.qty;
            categories[id].cents += row.cents;
        });

        const occupancy = tabs.filter((tab) => tab.openedAt && tab.closedAt && tab.tableId);
        const avgStay = occupancy.length ? Math.round(occupancy.reduce((sum, tab) => sum + (tab.closedAt - tab.openedAt), 0) / occupancy.length / 60000) : 0;
        const avgGuests = occupancy.length ? (occupancy.reduce((sum, tab) => sum + (tab.guests || 0), 0) / occupancy.length) : 0;

        const prepared = valid.filter((order) => order.readyAt && (order.preparingAt || order.confirmedAt || order.createdAt));
        const avgPrep = prepared.length
            ? Math.round(prepared.reduce((sum, order) => sum + (order.readyAt - (order.preparingAt || order.confirmedAt || order.createdAt)), 0) / prepared.length / 60000)
            : 0;

        return {
            orders,
            valid,
            cancelled,
            tabs,
            gross,
            delivery,
            discounts,
            service,
            net,
            visits,
            ticket: visits ? Math.round(net / visits) : 0,
            received,
            refunded,
            pending: valid.filter((order) => order.payment?.status === "pending").reduce((sum, order) => sum + (order.totals?.totalCents || 0), 0),
            methods,
            channels,
            sources,
            categories,
            top: topProducts(valid, 10),
            hours: byHour(valid, tz),
            avgStay,
            avgGuests,
            avgPrep,
            ledgerAvailable: !ledgerNode.error && ledgerNode.value !== undefined
        };
    }, [ordersNode.value, tabsNode.value, ledgerNode.value, ledgerNode.error, channel, tz]);

    const loading = ordersNode.loading || tabsNode.loading;
    const maxHour = Math.max(1, ...data.hours.map((row) => row.count));
    const catName = (id) => catalog.categories?.[id]?.name || "Outros";

    const exportCsv = () => {
        const rows = [["Pedido", "Data", "Canal", "Origem", "Status", "Cliente/Mesa", "Itens (R$)", "Entrega (R$)", "Total (R$)", "Pagamento", "Situação do pagamento"]];
        data.orders.sort((a, b) => a.createdAt - b.createdAt).forEach((order) => {
            rows.push([
                order.code,
                new Date(order.createdAt).toLocaleString("pt-BR", { timeZone: tz }),
                CHANNELS[order.channel]?.label || order.channel,
                SOURCES[order.source]?.label || order.source,
                order.status,
                order.tableLabel || order.customer?.name || "",
                ((order.totals?.subtotalCents || 0) / 100).toFixed(2).replace(".", ","),
                ((order.totals?.deliveryFeeCents || 0) / 100).toFixed(2).replace(".", ","),
                ((order.totals?.totalCents || 0) / 100).toFixed(2).replace(".", ","),
                PAYMENT_METHODS[order.payment?.method]?.label || "",
                order.payment?.status || ""
            ]);
        });
        downloadText(`markfy-menus-pedidos-${dateInput(range.start, tz)}-a-${dateInput(range.end - 1, tz)}.csv`, toCsv(rows));
    };

    return (
        <div className="std-page">
            <PageHead
                title="Relatórios"
                description={`De ${new Date(range.start).toLocaleDateString("pt-BR", { timeZone: tz })} a ${new Date(range.end - 1).toLocaleDateString("pt-BR", { timeZone: tz })} · fuso ${tz.replace("_", " ")}`}
                actions={(
                    <>
                        <DemoTag />
                        {advanced && can("reports.export") && <Button icon="solar:download-minimalistic-linear" onClick={exportCsv} disabled={!data.orders.length}>Exportar CSV</Button>}
                    </>
                )}
            />

            <div className="mnu-toolbar">
                <Segmented label="Período" value={preset} onChange={setPreset} options={[{ value: "today", label: "Hoje" }, { value: "yesterday", label: "Ontem" }, { value: "7d", label: "7 dias" }, { value: "30d", label: "30 dias" }, { value: "custom", label: "Escolher" }]} />
                {preset === "custom" && (
                    <span className="mnu-row">
                        <input className="mk-input" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} aria-label="Data inicial" />
                        <input className="mk-input" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} aria-label="Data final" />
                    </span>
                )}
                <select className="mk-select mnu-select" value={channel} onChange={(event) => setChannel(event.target.value)} aria-label="Canal">
                    <option value="all">Todos os canais</option>
                    {Object.entries(CHANNELS).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}
                </select>
            </div>

            {loading ? (
                <p className="mk-muted">Calculando…</p>
            ) : (
                <>
                    <div className="std-stats mnu-stats">
                        <Stat label="Faturamento bruto (itens)" icon="solar:wallet-money-linear" value={formatBRL(data.gross)} hint={`${data.valid.length} pedido(s) não cancelados`} />
                        <Stat label="Líquido" icon="solar:calculator-linear" value={formatBRL(data.net)} hint="bruto − descontos + taxas" />
                        <Stat label="Ticket médio" icon="solar:tag-price-linear" value={formatBRL(data.ticket)} hint={`${data.visits} atendimento(s)`} />
                        <Stat label="Cancelados" icon="solar:close-circle-linear" value={data.cancelled.length} tone={data.cancelled.length ? "warning" : undefined} hint={formatBRL(data.cancelled.reduce((sum, order) => sum + (order.totals?.totalCents || 0), 0))} />
                    </div>

                    <div className="std-grid std-grid--2">
                        <Panel title="Composição do faturamento" description="Separado para não confundir valores.">
                            <dl className="mnu-breakdown">
                                <dt>Itens vendidos (bruto)</dt><dd>{formatBRL(data.gross)}</dd>
                                <dt>Descontos concedidos</dt><dd>− {formatBRL(data.discounts)}</dd>
                                <dt>Taxa de serviço</dt><dd>+ {formatBRL(data.service)}</dd>
                                <dt>Taxas de entrega</dt><dd>+ {formatBRL(data.delivery)}</dd>
                                <dt className="is-total">Líquido</dt><dd className="is-total">{formatBRL(data.net)}</dd>
                            </dl>
                            {data.ledgerAvailable && ledgerNode.value !== null ? (
                                <dl className="mnu-breakdown">
                                    <dt>Recebido (registrado)</dt><dd>{formatBRL(data.received)}</dd>
                                    <dt>Estornos</dt><dd>{formatBRL(data.refunded)}</dd>
                                    <dt>A receber (pedidos com pagamento pendente)</dt><dd>{formatBRL(data.pending)}</dd>
                                </dl>
                            ) : (
                                <p className="mk-muted">Recebimentos por forma de pagamento ficam visíveis para dono, gerente e caixa.</p>
                            )}
                            <p className="mk-muted">Comandas de mesa entram no período pela data de fechamento; pedidos, pela data de entrada.</p>
                        </Panel>

                        <Panel title="Mesas e cozinha">
                            <div className="mnu-kpis">
                                <span><small>Comandas fechadas</small><b>{data.tabs.length}</b></span>
                                <span><small>Tempo médio de mesa</small><b>{data.avgStay ? durationLabel(data.avgStay) : "—"}</b></span>
                                <span><small>Pessoas por mesa</small><b>{data.avgGuests ? data.avgGuests.toFixed(1).replace(".", ",") : "—"}</b></span>
                                <span><small>Tempo médio de preparo</small><b>{data.avgPrep ? `${data.avgPrep} min` : "—"}</b></span>
                            </div>
                            <p className="mk-muted">Preparo: do início do preparo (ou da confirmação) até “Pronto”.</p>
                        </Panel>
                    </div>

                    {advanced ? (
                        <>
                            <div className="std-grid std-grid--2">
                                <Panel title="Produtos mais vendidos">
                                    <ol className="mnu-rank">
                                        {data.top.map((row, index) => (
                                            <li key={row.key}>
                                                <span className="mnu-rank__pos">{index + 1}</span>
                                                <span className="mnu-rank__name">{row.name}</span>
                                                <span className="mnu-rank__value">{row.qty}× · {formatBRL(row.cents)}</span>
                                            </li>
                                        ))}
                                        {!data.top.length && <li className="mk-muted">Sem vendas no período.</li>}
                                    </ol>
                                </Panel>
                                <Panel title="Categorias">
                                    <ul className="mnu-bars">
                                        {Object.entries(data.categories).sort(([, a], [, b]) => b.cents - a.cents).map(([id, row]) => (
                                            <li key={id}>
                                                <span>{catName(id)}</span>
                                                <i style={{ "--w": `${Math.max(4, (row.cents / Math.max(1, data.gross)) * 100)}%` }} />
                                                <b>{formatBRL(row.cents)}</b>
                                            </li>
                                        ))}
                                    </ul>
                                </Panel>
                            </div>

                            <Panel title="Horários de maior movimento" description="Pedidos por hora do dia, no fuso da empresa.">
                                <div className="mnu-hours" role="img" aria-label="Pedidos por hora">
                                    {data.hours.map((row) => (
                                        <span key={row.hour} className="mnu-hours__col" title={`${row.hour}h: ${row.count} pedido(s)`}>
                                            <i style={{ height: `${(row.count / maxHour) * 100}%` }} />
                                            <small>{row.hour % 3 === 0 ? `${row.hour}h` : ""}</small>
                                        </span>
                                    ))}
                                </div>
                            </Panel>

                            <div className="std-grid std-grid--2">
                                <Panel title="Pedidos por canal">
                                    <ul className="mnu-bars">
                                        {Object.entries(data.channels).map(([id, row]) => (
                                            <li key={id}>
                                                <span><Icon icon={CHANNELS[id]?.icon} aria-hidden="true" /> {CHANNELS[id]?.label}</span>
                                                <i style={{ "--w": `${Math.max(4, (row.count / Math.max(1, data.valid.length)) * 100)}%` }} />
                                                <b>{row.count} · {formatBRL(row.cents)}</b>
                                            </li>
                                        ))}
                                    </ul>
                                    <p className="mk-muted">Origem: {Object.entries(data.sources).map(([id, count]) => `${SOURCES[id]?.label || id} ${count}`).join(" · ") || "—"}</p>
                                </Panel>
                                <Panel title="Formas de pagamento" description="Recebimentos registrados, já com estornos.">
                                    {data.ledgerAvailable && Object.keys(data.methods).length ? (
                                        <ul className="mnu-bars">
                                            {Object.entries(data.methods).sort(([, a], [, b]) => b - a).map(([id, cents]) => (
                                                <li key={id}>
                                                    <span><Icon icon={PAYMENT_METHODS[id]?.icon || "solar:wallet-linear"} aria-hidden="true" /> {PAYMENT_METHODS[id]?.label || "Outro"}</span>
                                                    <i style={{ "--w": `${Math.max(4, (cents / Math.max(1, data.received)) * 100)}%` }} />
                                                    <b>{formatBRL(cents)}</b>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="mk-muted">Sem recebimentos registrados no período.</p>
                                    )}
                                </Panel>
                            </div>
                        </>
                    ) : (
                        <LockedFeature {...LOCKED.menusReports} />
                    )}

                    {demo && <p className="mk-muted">Na demonstração, os números vêm de duas semanas de pedidos fictícios gerados pelo mesmo motor do servidor.</p>}
                </>
            )}
        </div>
    );
}
