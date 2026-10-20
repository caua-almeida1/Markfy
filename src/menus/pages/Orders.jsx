import React, { useMemo, useState } from "react";
import { Icon } from "@iconify/react";

import { Badge, Button, EmptyState, Segmented, Sheet, cx } from "../../design-system/components";
import { formatBRL } from "../engine/money.js";
import { describeLine } from "../engine/pricing.js";
import { CHANNELS, flowFor, isLate, nextStatus, PAYMENT_METHODS, PAYMENT_STATUS, SOURCES, STATUS, TERMINAL } from "../engine/orders.js";
import { entries } from "../engine/util.js";
import { useMenus, useNode, useNow } from "../MenusContext.jsx";
import { useTeam } from "../data/team.js";
import { printOrder } from "../components/receipt.js";
import { DemoTag, PageHead, ReasonDialog, dateTimeLabel, durationLabel, minutesSince, timeLabel } from "../ui.jsx";

/* =========================================================
   PEDIDOS

   Quadro por status (arrastar não é preciso: cada cartão tem
   o botão da próxima etapa) ou lista com filtros por canal,
   origem, status e período, e busca por código, cliente ou
   mesa. Pedidos atrasados ficam marcados.
========================================================= */

const BOARD = ["received", "confirmed", "preparing", "ready", "dispatch"];
const BOARD_LABEL = { received: "Novos", confirmed: "Confirmados", preparing: "Em preparo", ready: "Prontos", dispatch: "Entrega / retirada" };

const columnOf = (order) => (["out_for_delivery", "awaiting_pickup"].includes(order.status) ? "dispatch" : order.status);

const OrderCard = ({ order, now, settings, onOpen, onAdvance, canAdvance }) => {
    const next = nextStatus(order, settings);
    const late = isLate(order, now, settings);
    const items = (order.items || []).filter((item) => item.status !== "cancelled");
    return (
        <article className={cx("mnu-ocard", late && "is-late", order.status === "cancelled" && "is-cancelled")}>
            <button type="button" className="mnu-ocard__hit" onClick={onOpen} aria-label={`Pedido ${order.code}, ver detalhes`} />
            <header>
                <b>#{order.code}</b>
                <span className="mnu-ocard__channel"><Icon icon={CHANNELS[order.channel]?.icon} aria-hidden="true" /> {order.tableLabel || CHANNELS[order.channel]?.label}</span>
                <span className={cx("mnu-ocard__time", late && "is-late")}><Icon icon="solar:clock-circle-linear" aria-hidden="true" /> {durationLabel(minutesSince(order.createdAt, now))}</span>
            </header>
            {order.customer?.name && <p className="mnu-ocard__who">{order.customer.name}{order.source !== "staff" ? ` · ${SOURCES[order.source]?.label}` : ""}</p>}
            <ul className="mnu-ocard__items">
                {items.slice(0, 4).map((item, index) => (
                    <li key={index}><b>{item.qty}×</b> {item.name}{item.sizeName ? ` (${item.sizeName.split(" ")[0]})` : ""}</li>
                ))}
                {items.length > 4 && <li className="mk-muted">+ {items.length - 4} item(ns)</li>}
            </ul>
            <footer>
                <span>
                    <b>{formatBRL(order.totals?.totalCents)}</b>
                    <Badge tone={PAYMENT_STATUS[order.payment?.status]?.tone} plain>{PAYMENT_STATUS[order.payment?.status]?.label || "—"}</Badge>
                </span>
                {next && canAdvance(order, next) && (
                    <Button size="sm" variant="primary" onClick={() => onAdvance(order, next)}>{next === "confirmed" ? "Confirmar" : STATUS[next].short}</Button>
                )}
            </footer>
        </article>
    );
};

export const OrderDetail = ({ order, onClose }) => {
    const { act, can, settings, notify } = useMenus();
    const team = useTeam();
    const [cancel, setCancel] = useState(false);
    const [refund, setRefund] = useState(false);
    const [publicReason, setPublicReason] = useState("");
    const [method, setMethod] = useState(order.payment?.method || "pix");

    const flow = flowFor(order.channel, settings);
    const history = entries(order.history).sort((a, b) => a.at - b.at);
    const items = order.items || [];
    const open = !TERMINAL.includes(order.status);

    return (
        <Sheet
            open
            onClose={onClose}
            title={`Pedido #${order.code}`}
            description={`${CHANNELS[order.channel]?.label}${order.tableLabel ? ` · ${order.tableLabel}` : ""} · ${SOURCES[order.source]?.label} · ${dateTimeLabel(order.createdAt)}`}
            footer={(
                <div className="mnu-detail-foot">
                    <Button variant="ghost" icon="solar:printer-minimalistic-linear" onClick={() => printOrder({ order, companyName: settings.profile?.name }) || notify("error", "Permita janelas pop-up para imprimir")}>Comprovante</Button>
                    <Button variant="ghost" icon="solar:chef-hat-linear" onClick={() => printOrder({ order, kitchen: true })}>Via da cozinha</Button>
                    {open && can("orders.cancel") && <Button variant="danger" onClick={() => setCancel(true)}>Cancelar pedido</Button>}
                </div>
            )}
        >
            <div className="mnu-detail">
                <ol className="mnu-flow" aria-label="Etapas">
                    {flow.map((status) => {
                        const index = flow.indexOf(status);
                        const current = flow.indexOf(order.status);
                        return (
                            <li key={status} className={cx(index < current && "is-done", index === current && "is-now")}>
                                <button
                                    type="button"
                                    disabled={!open || index === current || !can("orders.status") || (index < current - 1) || status === "received"}
                                    onClick={() => act("orders.status", { orderId: order.id, to: status }, { success: `#${order.code}: ${STATUS[status].label}` })}
                                >
                                    {STATUS[status].label}
                                </button>
                            </li>
                        );
                    })}
                    {order.status === "cancelled" && <li className="is-cancelled"><span>Cancelado</span></li>}
                </ol>

                {order.status === "cancelled" && (
                    <p className="mnu-alert is-bad">Cancelado por {order.cancel?.byName || "equipe"}: {order.cancel?.reason}{order.refundPending ? " · estorno do pagamento pendente" : ""}</p>
                )}

                <section>
                    <h3 className="mnu-h3">Itens</h3>
                    <ul className="mnu-oitems">
                        {items.map((item, index) => (
                            <li key={index} className={item.status === "cancelled" ? "is-cancelled" : ""}>
                                <span><b>{item.qty}× {item.name}</b>{describeLine(item) && <small>{describeLine(item)}</small>}{item.notes && <small className="mnu-note">Obs.: {item.notes}</small>}</span>
                                <b>{formatBRL(item.totalCents || item.unitCents * item.qty)}</b>
                            </li>
                        ))}
                    </ul>
                    {order.notes && <p className="mnu-note">Observação do pedido: {order.notes}</p>}
                    <dl className="mnu-totals">
                        <dt>Itens</dt><dd>{formatBRL(order.totals?.subtotalCents)}</dd>
                        {order.totals?.deliveryFeeCents > 0 && <><dt>Entrega</dt><dd>{formatBRL(order.totals.deliveryFeeCents)}</dd></>}
                        <dt className="is-total">Total</dt><dd className="is-total">{formatBRL(order.totals?.totalCents)}</dd>
                    </dl>
                </section>

                {(order.customer || order.fulfillment?.address) && (
                    <section>
                        <h3 className="mnu-h3">Cliente e entrega</h3>
                        <ul className="mnu-facts">
                            {order.customer?.name && <li><Icon icon="solar:user-linear" aria-hidden="true" /> {order.customer.name}</li>}
                            {order.customer?.phone && <li><Icon icon="solar:phone-linear" aria-hidden="true" /> <a href={`tel:+55${order.customer.phone}`}>{order.customer.phone}</a></li>}
                            {order.fulfillment?.address && <li><Icon icon="solar:map-point-linear" aria-hidden="true" /> {order.fulfillment.address}{order.fulfillment.zoneName ? ` · ${order.fulfillment.zoneName}` : ""}</li>}
                            {order.fulfillment?.etaMinutes && <li><Icon icon="solar:clock-circle-linear" aria-hidden="true" /> Prazo informado: ~{order.fulfillment.etaMinutes} min</li>}
                        </ul>
                    </section>
                )}

                <section>
                    <h3 className="mnu-h3">Pagamento</h3>
                    <p>
                        <Badge tone={PAYMENT_STATUS[order.payment?.status]?.tone}>{PAYMENT_STATUS[order.payment?.status]?.label}</Badge>
                        {" "}{PAYMENT_METHODS[order.payment?.method]?.label || ""}
                        {order.payment?.changeForCents ? ` · troco para ${formatBRL(order.payment.changeForCents)}` : ""}
                    </p>
                    {order.payment?.status === "pending" && order.status !== "cancelled" && can("orders.payment") && (
                        <div className="mnu-row">
                            <select className="mk-select" value={method} onChange={(event) => setMethod(event.target.value)} aria-label="Forma de pagamento recebida">
                                {Object.entries(PAYMENT_METHODS).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}
                            </select>
                            <Button variant="primary" onClick={() => act("orders.pay", { orderId: order.id, method }, { success: "Pagamento confirmado" })}>Confirmar recebimento</Button>
                        </div>
                    )}
                    {order.payment?.status === "pending" && <p className="mk-muted">Confirme só depois de receber de fato: o cliente pagar na entrega ou retirada.</p>}
                    {order.payment?.status === "paid" && can("tabs.refund") && (
                        <Button size="sm" variant="ghost" onClick={() => setRefund(true)}>Registrar estorno</Button>
                    )}
                </section>

                {open && can("orders.status") && (
                    <section>
                        <h3 className="mnu-h3">Responsável</h3>
                        <select className="mk-select" value={order.assigneeUid || ""} onChange={(event) => act("orders.assign", { orderId: order.id, uid: event.target.value, name: team.find((person) => person.uid === event.target.value)?.name || "" })} aria-label="Responsável pelo pedido">
                            <option value="">Ninguém</option>
                            {team.map((person) => <option key={person.uid} value={person.uid}>{person.name} · {person.roleLabel}</option>)}
                        </select>
                    </section>
                )}

                <section>
                    <h3 className="mnu-h3">Histórico</h3>
                    <ol className="mnu-history">
                        {history.map((entry) => (
                            <li key={entry.id}>
                                <span>{timeLabel(entry.at)}</span>
                                <span>{entry.from ? `${STATUS[entry.from]?.label || entry.from} → ` : ""}<b>{STATUS[entry.to]?.label || entry.to}</b>{entry.byName ? ` · ${entry.byName}` : ""}{entry.note ? ` · ${entry.note}` : ""}</span>
                            </li>
                        ))}
                    </ol>
                </section>
            </div>

            <ReasonDialog
                open={cancel}
                title={`Cancelar o pedido #${order.code}?`}
                message="A cozinha deixa de ver o pedido e o estoque baixado volta. Se o pedido já foi pago, registre o estorno depois."
                confirmLabel="Cancelar pedido"
                extra={order.source !== "staff" && (
                    <label className="mk-field">
                        <span className="mk-field__label">Mensagem para o cliente (opcional, aparece no acompanhamento)</span>
                        <input className="mk-input" value={publicReason} maxLength={140} onChange={(event) => setPublicReason(event.target.value)} placeholder="Ex.: acabou um ingrediente, ligamos para você" />
                    </label>
                )}
                onClose={() => setCancel(false)}
                onConfirm={(reason) => act("orders.cancel", { orderId: order.id, reason, publicReason }, { success: "Pedido cancelado" })}
            />

            <ReasonDialog
                open={refund}
                title="Registrar estorno"
                message="Marca o pagamento como estornado no sistema. A devolução do dinheiro ao cliente é feita por você, pelo mesmo meio."
                confirmLabel="Registrar estorno"
                onClose={() => setRefund(false)}
                onConfirm={(reason) => act("orders.refund", { orderId: order.id, reason }, { success: "Estorno registrado" })}
            />
        </Sheet>
    );
};

export default function Orders({ preset }) {
    const { orders, settings, can, act, source, handle, user, role } = useMenus();
    const now = useNow(20000);

    const [view, setView] = useState(preset === "delivery" ? "list" : "board");
    const [channel, setChannel] = useState(preset === "delivery" ? "dispatch" : "all");
    const [origin, setOrigin] = useState("all");
    const [status, setStatus] = useState("open");
    const [period, setPeriod] = useState("today");
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState(null);
    const [mine, setMine] = useState(false);

    /* 7 dias: consulta própria; o resto usa a janela viva do contexto. */
    const weekStart = Math.floor(now / 3600000) * 3600000 - 7 * 86400000;
    const week = useNode(source, period === "week" ? `menusOps/${handle}/orders` : null, { orderBy: "createdAt", startAt: weekStart });
    const pool = useMemo(() => (period === "week" ? week.value || {} : orders), [period, week.value, orders]);

    const list = useMemo(() => {
        const startToday = now - 24 * 3600000;
        return entries(pool)
            .filter((order) => (period === "today" ? order.createdAt >= startToday : true))
            .filter((order) => (channel === "all" ? true : channel === "dispatch" ? ["delivery", "pickup"].includes(order.channel) : order.channel === channel))
            .filter((order) => (origin === "all" ? true : order.source === origin))
            .filter((order) => (status === "all" ? true : status === "open" ? !TERMINAL.includes(order.status) : order.status === status))
            .filter((order) => (!mine ? true : order.assigneeUid === user?.uid))
            .filter((order) => (role === "delivery" ? order.channel === "delivery" : true))
            .filter((order) => {
                if (!query) return true;
                const text = `${order.code} ${order.customer?.name || ""} ${order.tableLabel || ""} ${order.customer?.phone || ""}`.toLowerCase();
                return text.includes(query.toLowerCase().replace(/^#/, ""));
            })
            .sort((a, b) => b.createdAt - a.createdAt);
    }, [pool, period, channel, origin, status, mine, query, now, role, user]);

    const current = selected ? entries(pool).find((order) => order.id === selected) || entries(orders).find((order) => order.id === selected) : null;

    const canAdvance = (order, next) =>
        can("orders.status") || (can("delivery.update") && order.channel === "delivery" && ["out_for_delivery", "completed"].includes(next));

    const advance = (order, next) => act("orders.status", { orderId: order.id, to: next }, { success: `#${order.code}: ${STATUS[next].label}` }).catch(() => null);

    const boardColumns = BOARD.map((id) => ({ id, label: BOARD_LABEL[id], orders: list.filter((order) => columnOf(order) === id) }));
    const lateCount = list.filter((order) => isLate(order, now, settings)).length;

    return (
        <div className="std-page">
            <PageHead
                title={preset === "delivery" ? "Delivery e retirada" : "Pedidos"}
                description={`${list.length} pedido(s) com os filtros atuais${lateCount ? ` · ${lateCount} atrasado(s)` : ""}. Pedidos são ilimitados em todos os planos.`}
                actions={<DemoTag />}
            />

            <div className="mnu-toolbar">
                <Segmented label="Visualização" value={view} onChange={setView} options={[{ value: "board", label: "Quadro", icon: "solar:widget-4-linear" }, { value: "list", label: "Lista", icon: "solar:list-linear" }]} />
                <label className="mk-input-group mnu-search">
                    <Icon icon="solar:magnifer-linear" aria-hidden="true" />
                    <input className="mk-input" type="search" placeholder="Código, cliente, mesa ou telefone" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar pedido" />
                </label>
                <select className="mk-select mnu-select" value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Período">
                    <option value="today">Últimas 24 horas</option>
                    <option value="window">Últimas 36 horas</option>
                    <option value="week">Últimos 7 dias</option>
                </select>
                <select className="mk-select mnu-select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Status">
                    <option value="open">Em andamento</option>
                    <option value="all">Todos</option>
                    {Object.entries(STATUS).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}
                </select>
                <select className="mk-select mnu-select" value={origin} onChange={(event) => setOrigin(event.target.value)} aria-label="Origem">
                    <option value="all">Todas as origens</option>
                    {Object.entries(SOURCES).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}
                </select>
            </div>

            <div className="mnu-chips" role="group" aria-label="Canal">
                {[["all", "Todos"], ["table", "Mesas"], ["counter", "Balcão"], ["pickup", "Retirada"], ["delivery", "Delivery"], ["dispatch", "Delivery + retirada"]].map(([id, label]) => (
                    <button key={id} type="button" className="mk-chip" aria-pressed={channel === id} onClick={() => setChannel(id)}>{label}</button>
                ))}
                <button type="button" className="mk-chip" aria-pressed={mine} onClick={() => setMine(!mine)}>Só os meus</button>
            </div>

            {!list.length ? (
                <div className="std-panel"><EmptyState icon="solar:clipboard-list-linear" title="Nenhum pedido aqui">Quando chegar um pedido do cardápio, do QR da mesa ou do balcão, ele aparece nesta tela na hora.</EmptyState></div>
            ) : view === "board" ? (
                <div className="mnu-board">
                    {boardColumns.map((column) => (
                        <section key={column.id} className="mnu-board__col" aria-label={column.label}>
                            <header><h2>{column.label}</h2><span>{column.orders.length}</span></header>
                            <div className="mnu-board__list">
                                {column.orders.map((order) => (
                                    <OrderCard key={order.id} order={order} now={now} settings={settings} onOpen={() => setSelected(order.id)} onAdvance={advance} canAdvance={canAdvance} />
                                ))}
                                {!column.orders.length && <p className="mnu-board__empty">Vazio</p>}
                            </div>
                        </section>
                    ))}
                    {status !== "open" && (
                        <section className="mnu-board__col" aria-label="Encerrados">
                            <header><h2>Encerrados</h2><span>{list.filter((order) => TERMINAL.includes(order.status)).length}</span></header>
                            <div className="mnu-board__list">
                                {list.filter((order) => TERMINAL.includes(order.status)).slice(0, 30).map((order) => (
                                    <OrderCard key={order.id} order={order} now={now} settings={settings} onOpen={() => setSelected(order.id)} onAdvance={advance} canAdvance={() => false} />
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            ) : (
                <div className="std-panel std-panel--flush">
                    <div className="mnu-table-wrap">
                        <table className="mnu-table">
                            <thead>
                                <tr>
                                    <th scope="col">Pedido</th>
                                    <th scope="col">Entrada</th>
                                    <th scope="col">Canal</th>
                                    <th scope="col">Cliente / mesa</th>
                                    <th scope="col">Status</th>
                                    <th scope="col">Pagamento</th>
                                    <th scope="col">Total</th>
                                    <th scope="col"><span className="mk-visually-hidden">Ações</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {list.map((order) => {
                                    const next = nextStatus(order, settings);
                                    const late = isLate(order, now, settings);
                                    return (
                                        <tr key={order.id} className={cx(late && "is-late")}>
                                            <th scope="row"><button type="button" className="mnu-link" onClick={() => setSelected(order.id)}>#{order.code}</button></th>
                                            <td>{timeLabel(order.createdAt)}<small> · {durationLabel(minutesSince(order.createdAt, now))}</small></td>
                                            <td><Icon icon={CHANNELS[order.channel]?.icon} aria-hidden="true" /> {CHANNELS[order.channel]?.label}<small> · {SOURCES[order.source]?.label}</small></td>
                                            <td>{order.tableLabel || order.customer?.name || "—"}</td>
                                            <td><Badge tone={STATUS[order.status]?.tone}>{STATUS[order.status]?.label}</Badge>{late && <Badge tone="danger">atrasado</Badge>}</td>
                                            <td>{PAYMENT_STATUS[order.payment?.status]?.label}</td>
                                            <td className="mnu-num">{formatBRL(order.totals?.totalCents)}</td>
                                            <td className="mnu-actions">{next && canAdvance(order, next) && <Button size="sm" onClick={() => advance(order, next)}>{STATUS[next].short}</Button>}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {current && <OrderDetail order={current} onClose={() => setSelected(null)} />}
        </div>
    );
}
