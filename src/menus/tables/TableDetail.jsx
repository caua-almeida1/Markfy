import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import { Badge, Button, ConfirmDialog, Sheet, cx } from "../../design-system/components";
import { formatBRL } from "../engine/money.js";
import { describeLine } from "../engine/pricing.js";
import { PAYMENT_METHODS, STATUS } from "../engine/orders.js";
import { computeTotals, ITEM_STATUS } from "../engine/tabs.js";
import { entries } from "../engine/util.js";
import { useMenus, useNode, useNow } from "../MenusContext.jsx";
import { useTeam } from "../data/team.js";
import { deriveTable, listTables, TABLE_STATUS } from "../data/selectors.js";
import ItemPicker from "../components/ItemPicker.jsx";
import { printTab } from "../components/receipt.js";
import QrImage from "../../qr/QrImage";
import PaymentSheet from "./PaymentSheet.jsx";
import { MoneyInput, ReasonDialog, durationLabel, minutesSince, timeLabel } from "../ui.jsx";

/* =========================================================
   DETALHE DA MESA / COMANDA

   Tudo do atendimento num lugar: itens por estado (pendente,
   na cozinha, pronto, cancelado), totais, pagamentos e as
   ações rápidas. Item enviado só sai por cancelamento com
   motivo; pagamento só sai por estorno com motivo. Nada é
   apagado em silêncio.
========================================================= */

const selectionOf = (item) => {
    const options = {};
    (item.options || []).forEach((option) => {
        (options[option.groupId] = options[option.groupId] || []).push(option.optionId);
    });
    return { productId: item.productId, sizeId: item.sizeId || null, options, qty: item.qty, notes: item.notes || undefined, person: item.person || undefined };
};

const itemState = (item, orders) => {
    if (item.status === "cancelled") return { label: "Cancelado", tone: "danger" };
    if (item.status === "pending") return { label: ITEM_STATUS.pending.label, tone: "warning" };
    const order = orders[item.orderId];
    if (!order) return { label: "Enviado", tone: "info" };
    if (order.status === "completed") return { label: "Entregue", tone: undefined };
    return { label: STATUS[order.status]?.label || "Enviado", tone: STATUS[order.status]?.tone };
};

const AddItemsSheet = ({ open, onClose, tab, tabId }) => {
    const { act } = useMenus();
    const [basket, setBasket] = useState([]);
    const [busy, setBusy] = useState(null);

    const total = basket.reduce((sum, row) => sum + row.quote.totalCents, 0);

    const submit = async (send) => {
        setBusy(send ? "send" : "add");
        try {
            await act(
                "tabs.addItems",
                { tabId, lines: basket.map((row) => row.selection), send },
                { success: send ? "Itens enviados para a cozinha" : "Itens lançados (ainda não enviados)" }
            );
            setBasket([]);
            onClose();
        } catch {
            /* aviso já mostrado */
        } finally {
            setBusy(null);
        }
    };

    return (
        <Sheet
            open={open}
            onClose={onClose}
            title={`Lançar itens · ${tab?.label || ""}`}
            description="Toque nos produtos. Itens com opções abrem a escolha antes de entrar."
            footer={(
                <>
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button disabled={!basket.length} loading={busy === "add"} onClick={() => submit(false)}>Só lançar</Button>
                    <Button variant="primary" disabled={!basket.length} loading={busy === "send"} onClick={() => submit(true)}>Lançar e enviar · {formatBRL(total)}</Button>
                </>
            )}
        >
            {basket.length > 0 && (
                <ul className="mnu-basket" aria-label="Itens a lançar">
                    {basket.map((row, index) => (
                        <li key={index}>
                            <span>
                                <b>{row.selection.qty}× {row.quote.line.name}</b>
                                {(describeLine(row.quote.line) || row.selection.notes || row.selection.person) && (
                                    <small>{[describeLine(row.quote.line), row.selection.notes && `Obs.: ${row.selection.notes}`, row.selection.person].filter(Boolean).join(" · ")}</small>
                                )}
                            </span>
                            <b>{formatBRL(row.quote.totalCents)}</b>
                            <Button size="sm" variant="ghost" icon="solar:close-circle-linear" aria-label="Tirar da lista" onClick={() => setBasket(basket.filter((_, i) => i !== index))} />
                        </li>
                    ))}
                </ul>
            )}
            <ItemPicker withPerson onAdd={(selection, quote) => setBasket((current) => [...current, { selection, quote }])} />
        </Sheet>
    );
};

export default function TableDetail({ tabId, tableId, onClose }) {
    const { source, handle, orders, floor, tableState, openTabs, calls, can, act, settings, site, demo, notify, path } = useMenus();
    const navigate = useNavigate();
    const team = useTeam();
    const now = useNow(30000);
    const live = useNode(source, tabId && `menusOps/${handle}/tabs/${tabId}`);
    const tab = live.value ? { ...live.value, id: tabId } : null;

    const [adding, setAdding] = useState(false);
    const [paying, setPaying] = useState(false);
    const [reason, setReason] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [adjust, setAdjust] = useState(null);
    const [transfer, setTransfer] = useState(false);
    const [editing, setEditing] = useState(false);
    const [qrOpen, setQrOpen] = useState(false);

    const table = tableId ? floor.tables?.[tableId] : tab?.tableId ? floor.tables?.[tab.tableId] : null;
    const tabOrders = useMemo(() => entries(orders).filter((order) => order.tabId === tabId), [orders, tabId]);
    const ordersMap = useMemo(() => Object.fromEntries(tabOrders.map((order) => [order.id, order])), [tabOrders]);
    const tableCalls = entries(calls).filter((call) => call.tableId === (tab?.tableId || tableId));

    if (!tab) {
        return (
            <Sheet open onClose={onClose} title="Comanda">
                <p className="mk-muted">{live.loading ? "Carregando…" : "Esta comanda não foi encontrada."}</p>
            </Sheet>
        );
    }

    const totals = tab.totals || computeTotals(tab);
    const items = entries(tab.items).sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
    const pending = items.filter((item) => item.status === "pending");
    const sent = items.filter((item) => item.status === "sent");
    const cancelled = items.filter((item) => item.status === "cancelled");
    const payments = entries(tab.payments).sort((a, b) => (a.at || 0) - (b.at || 0));
    const adjustments = entries(tab.adjustments).filter((adj) => !adj.voided);
    const open = tab.status === "open";

    const view = deriveTable({ table, state: tableState[tab.tableId], tab, orders: tabOrders, calls: tableCalls, now });
    const meta = TABLE_STATUS[view.status] || TABLE_STATUS.occupied;

    const groupedSent = {};
    sent.forEach((item) => {
        (groupedSent[item.orderId || "x"] = groupedSent[item.orderId || "x"] || []).push(item);
    });

    const otherTabs = entries(openTabs).filter((other) => other.id !== tabId);
    const freeTables = listTables(floor).filter((other) => !other.disabled && !tableState[other.id]?.tabId);

    const qrLink = table && site?.slug ? `${window.location.origin}/m/${site.slug}?mesa=${tab.tableId}` : null;

    const ItemRow = ({ item }) => {
        const state = itemState(item, ordersMap);
        return (
            <li className={cx("mnu-titem", item.status === "cancelled" && "is-cancelled")}>
                <span className="mnu-titem__qty">{item.qty}×</span>
                <span className="mnu-titem__body">
                    <b>{item.name}</b>
                    {describeLine(item) && <small>{describeLine(item)}</small>}
                    {item.notes && <small className="mnu-note">Obs.: {item.notes}</small>}
                    <small className="mk-muted">
                        {item.person ? `${item.person} · ` : ""}
                        {timeLabel(item.addedAt)}{item.addedByName ? ` · ${item.addedByName}` : ""}
                        {item.cancel?.reason ? ` · motivo: ${item.cancel.reason}` : ""}
                        {item.movedFrom ? " · transferido" : ""}
                    </small>
                </span>
                <span className="mnu-titem__side">
                    <b>{formatBRL(item.unitCents * item.qty)}</b>
                    <Badge tone={state.tone}>{state.label}</Badge>
                    {open && (
                        <span className="mnu-row">
                            {item.status !== "cancelled" && can("tables.order") && (
                                <Button size="sm" variant="ghost" icon="solar:repeat-linear" aria-label={`Repetir ${item.name}`} title="Repetir" onClick={() => act("tabs.addItems", { tabId, lines: [selectionOf(item)] }, { success: "Item repetido (aguardando envio)" })} />
                            )}
                            {item.status === "pending" && can("tables.removePending") && (
                                <Button size="sm" variant="ghost" icon="solar:trash-bin-minimalistic-linear" aria-label={`Remover ${item.name}`} onClick={() => act("tabs.removePending", { tabId, itemId: item.id })} />
                            )}
                            {item.status === "sent" && can("tabs.cancelItem") && (
                                <Button size="sm" variant="ghost" icon="solar:close-circle-linear" aria-label={`Cancelar ${item.name}`} onClick={() => setReason({ title: `Cancelar ${item.qty}× ${item.name}?`, message: "O item sai da conta e a cozinha é avisada. Fica registrado quem cancelou e por quê.", run: (why) => act("tabs.cancelItem", { tabId, itemId: item.id, reason: why }, { success: "Item cancelado" }) })} />
                            )}
                        </span>
                    )}
                </span>
            </li>
        );
    };

    return (
        <>
            <Sheet
                open
                onClose={onClose}
                title={tab.label || "Comanda"}
                description={
                    open
                        ? `${meta.label} · aberta há ${durationLabel(minutesSince(tab.openedAt, now))}${tab.guests ? ` · ${tab.guests} pessoa(s)` : ""}${tab.waiterName ? ` · ${tab.waiterName}` : ""}`
                        : tab.status === "closed" ? `Fechada às ${timeLabel(tab.closedAt)}` : tab.status === "merged" ? "Unida a outra mesa" : "Comanda encerrada"
                }
                footer={open && (
                    <div className="mnu-detail-foot">
                        {can("tables.order") && <Button icon="solar:add-circle-linear" onClick={() => setAdding(true)}>Lançar itens</Button>}
                        {pending.length > 0 && can("tables.order") && (
                            <Button variant="primary" icon="solar:plain-3-linear" onClick={() => act("tabs.send", { tabId }, { success: "Enviado para a cozinha" })}>Enviar {pending.length} para a cozinha</Button>
                        )}
                        {pending.length === 0 && totals.balanceCents > 0 && can("tabs.payment") && (
                            <Button variant="primary" icon="solar:wallet-money-linear" onClick={() => setPaying(true)}>Receber {formatBRL(totals.balanceCents)}</Button>
                        )}
                        {pending.length === 0 && totals.balanceCents === 0 && can("tabs.close") && (
                            <Button
                                variant="primary"
                                icon="solar:check-circle-linear"
                                onClick={() => setConfirm({ title: `Fechar ${tab.label}?`, message: "A comanda é encerrada e a mesa fica livre.", label: "Fechar e liberar", run: () => act("tabs.close", { tabId }, { success: `${tab.label} liberada` }).then(onClose) })}
                            >
                                Fechar e liberar mesa
                            </Button>
                        )}
                        {totals.balanceCents > 0 && !can("tabs.payment") && !tab.billRequested && (
                            <Button icon="solar:bill-list-linear" onClick={() => act("tabs.requestBill", { tabId }, { success: "Conta solicitada ao caixa" })}>Pedir a conta</Button>
                        )}
                    </div>
                )}
            >
                <div className="mnu-detail">
                    {tableCalls.length > 0 && (
                        <div className="mnu-alert is-warn">
                            <Icon icon="solar:hand-shake-linear" aria-hidden="true" />
                            {tableCalls.map((call) => (call.type === "bill" ? "Pediu a conta" : "Chamou o garçom")).join(" · ")} há {durationLabel(minutesSince(tableCalls[0].at, now))}
                            <Button size="sm" onClick={() => tableCalls.forEach((call) => act("calls.resolve", { callId: call.id }))}>Atendido</Button>
                        </div>
                    )}

                    {demo && <Badge tone="info">Comanda de demonstração</Badge>}

                    <div className="mnu-detail__head">
                        <span className={`mnu-status mnu-status--${view.status}`}><Icon icon={meta.icon} aria-hidden="true" /> {meta.label}</span>
                        {tab.customerName && <span><Icon icon="solar:user-linear" aria-hidden="true" /> {tab.customerName}</span>}
                        {tab.notes && <span><Icon icon="solar:notes-linear" aria-hidden="true" /> {tab.notes}</span>}
                        {open && (
                            <span className="mnu-row">
                                {can("tables.open") && <Button size="sm" variant="ghost" icon="solar:pen-linear" onClick={() => setEditing(true)}>Atendimento</Button>}
                                {can("tables.transfer") && <Button size="sm" variant="ghost" icon="solar:transfer-horizontal-linear" onClick={() => setTransfer(true)}>Transferir / unir</Button>}
                                <Button size="sm" variant="ghost" icon="solar:printer-minimalistic-linear" onClick={() => printTab({ tab, companyName: settings.profile?.name }) || notify("error", "Permita janelas pop-up para imprimir")}>Imprimir conta</Button>
                                {qrLink && <Button size="sm" variant="ghost" icon="solar:qr-code-linear" onClick={() => setQrOpen(true)}>QR da mesa</Button>}
                            </span>
                        )}
                    </div>

                    <section aria-labelledby="mnu-items-title">
                        <h3 id="mnu-items-title" className="mnu-h3">Itens</h3>
                        {!items.length && <p className="mk-muted">Nenhum item lançado ainda.</p>}

                        {pending.length > 0 && (
                            <div className="mnu-igroup is-pending">
                                <p className="mnu-igroup__title"><Icon icon="solar:clock-circle-linear" aria-hidden="true" /> Aguardando envio para a cozinha</p>
                                <ul>{pending.map((item) => <ItemRow key={item.id} item={item} />)}</ul>
                            </div>
                        )}

                        {Object.entries(groupedSent).map(([orderId, list]) => {
                            const order = ordersMap[orderId];
                            return (
                                <div key={orderId} className="mnu-igroup">
                                    <p className="mnu-igroup__title">
                                        <Icon icon="solar:chef-hat-linear" aria-hidden="true" />
                                        {order ? `Pedido #${order.code} · ${STATUS[order.status]?.label} · ${timeLabel(order.createdAt)}` : "Enviado"}
                                        {order?.source === "qr" && <Badge tone="info" plain>pelo QR</Badge>}
                                    </p>
                                    <ul>{list.map((item) => <ItemRow key={item.id} item={item} />)}</ul>
                                </div>
                            );
                        })}

                        {cancelled.length > 0 && (
                            <details className="mnu-details">
                                <summary><span><b>{cancelled.length} item(ns) cancelado(s)</b><small>Ficam no histórico com motivo</small></span><Icon icon="solar:alt-arrow-down-linear" aria-hidden="true" /></summary>
                                <ul className="mnu-details__body">{cancelled.map((item) => <ItemRow key={item.id} item={item} />)}</ul>
                            </details>
                        )}
                    </section>

                    <section className="mnu-totalbox" aria-label="Totais">
                        <dl>
                            <dt>Itens</dt><dd>{formatBRL(totals.itemsCents)}</dd>
                            {adjustments.map((adj) => (
                                <React.Fragment key={adj.id}>
                                    <dt>
                                        {adj.type === "discount" ? "Desconto" : "Taxa de serviço"} {adj.mode === "percent" ? `(${String(adj.value).replace(".", ",")}%)` : ""}
                                        {adj.reason && adj.type === "discount" ? <small> · {adj.reason}</small> : null}
                                        {open && can(adj.type === "discount" ? "tabs.discount" : "tabs.serviceFee") && (
                                            <button type="button" className="mnu-link" onClick={() => setReason({ title: `Retirar ${adj.type === "discount" ? "o desconto" : "a taxa de serviço"}?`, message: "Fica registrado no histórico.", tone: "primary", label: "Retirar", run: (why) => act("tabs.voidAdjustment", { tabId, adjustmentId: adj.id, type: adj.type, reason: why }) })}>retirar</button>
                                        )}
                                    </dt>
                                    <dd>{adj.type === "discount" ? "−" : "+"} {formatBRL(adj.type === "discount" ? totals.discountCents : totals.serviceCents)}</dd>
                                </React.Fragment>
                            ))}
                            <dt className="is-total">Total</dt><dd className="is-total">{formatBRL(totals.totalCents)}</dd>
                            {totals.paidCents > 0 && <><dt>Pago</dt><dd>{formatBRL(totals.paidCents)}</dd></>}
                            <dt className="is-strong">Saldo</dt><dd className="is-strong">{formatBRL(totals.balanceCents)}</dd>
                        </dl>
                        {tab.guests > 1 && totals.totalCents > 0 && <p className="mk-muted">{formatBRL(Math.ceil(totals.totalCents / tab.guests))} por pessoa ({tab.guests} pessoas)</p>}
                        {open && (
                            <div className="mnu-row">
                                {can("tabs.discount") && <Button size="sm" variant="outline" icon="solar:sale-linear" onClick={() => setAdjust({ type: "discount", mode: "percent", value: 10 })}>Desconto</Button>}
                                {can("tabs.serviceFee") && !adjustments.some((adj) => adj.type === "service") && <Button size="sm" variant="outline" icon="solar:hand-money-linear" onClick={() => setAdjust({ type: "service", mode: "percent", value: settings.tables?.serviceFeePercent || 10 })}>Taxa de serviço</Button>}
                            </div>
                        )}
                    </section>

                    {payments.length > 0 && (
                        <section aria-labelledby="mnu-pay-title">
                            <h3 id="mnu-pay-title" className="mnu-h3">Pagamentos</h3>
                            <ul className="std-list">
                                {payments.map((payment) => (
                                    <li key={payment.id}>
                                        <div className={cx("std-row", payment.status === "refunded" && "is-refunded")}>
                                            <span className="std-row__icon"><Icon icon={PAYMENT_METHODS[payment.method]?.icon || "solar:wallet-linear"} /></span>
                                            <span className="std-row__body">
                                                <span className="std-row__title">{PAYMENT_METHODS[payment.method]?.label}{payment.person ? ` · ${payment.person}` : ""}</span>
                                                <span className="std-row__meta">
                                                    {timeLabel(payment.at)}{payment.byName ? ` · ${payment.byName}` : ""}
                                                    {payment.changeCents ? ` · troco ${formatBRL(payment.changeCents)}` : ""}
                                                    {payment.status === "refunded" ? ` · estornado: ${payment.refund?.reason || ""}` : ""}
                                                </span>
                                            </span>
                                            <span className="std-row__aside"><strong>{formatBRL(payment.amountCents)}</strong></span>
                                            {open && payment.status === "confirmed" && can("tabs.refund") && (
                                                <Button size="sm" variant="ghost" onClick={() => setReason({ title: `Estornar ${formatBRL(payment.amountCents)}?`, message: "O valor volta a ficar em aberto na conta. A devolução do dinheiro ao cliente é feita por você, pelo meio usado.", label: "Estornar", run: (why) => act("tabs.refund", { tabId, paymentId: payment.id, reason: why }, { success: "Estorno registrado" }) })}>Estornar</Button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    )}

                    {!open && tab.status === "closed" && can("tabs.reopen") && (
                        <Button variant="outline" icon="solar:restart-linear" onClick={() => setReason({ title: "Reabrir comanda?", message: "Use só para corrigir algo. Fica registrado quem reabriu e por quê.", tone: "primary", label: "Reabrir", run: (why) => act("tabs.reopen", { tabId, reason: why }, { success: "Comanda reaberta" }) })}>
                            Reabrir comanda
                        </Button>
                    )}
                </div>
            </Sheet>

            <AddItemsSheet open={adding} onClose={() => setAdding(false)} tab={tab} tabId={tabId} />
            <PaymentSheet open={paying} tab={tab} tabId={tabId} onClose={() => setPaying(false)} />

            <ReasonDialog
                open={Boolean(reason)}
                title={reason?.title}
                message={reason?.message}
                tone={reason?.tone || "danger"}
                confirmLabel={reason?.label || "Confirmar"}
                onClose={() => setReason(null)}
                onConfirm={(why) => reason.run(why)}
            />

            <ConfirmDialog
                open={Boolean(confirm)}
                title={confirm?.title}
                message={confirm?.message}
                confirmLabel={confirm?.label}
                tone="primary"
                onClose={() => setConfirm(null)}
                onConfirm={async () => {
                    try {
                        await confirm.run();
                    } finally {
                        setConfirm(null);
                    }
                }}
            />

            <Sheet
                open={Boolean(adjust)}
                onClose={() => setAdjust(null)}
                side="center"
                title={adjust?.type === "discount" ? "Conceder desconto" : "Taxa de serviço"}
                description={adjust?.type === "discount" ? "Fica registrado com o motivo e quem concedeu." : "Aplicada sobre os itens, depois dos descontos."}
                footer={adjust && (
                    <>
                        <Button variant="ghost" onClick={() => setAdjust(null)}>Cancelar</Button>
                        <Button
                            variant="primary"
                            disabled={adjust.type === "discount" && (adjust.reason || "").trim().length < 3}
                            onClick={async () => {
                                try {
                                    await act("tabs.adjust", { tabId, type: adjust.type, mode: adjust.mode, value: adjust.value, reason: adjust.reason || "" }, { success: "Ajuste aplicado" });
                                    setAdjust(null);
                                } catch {
                                    /* aviso já exibido */
                                }
                            }}
                        >
                            Aplicar
                        </Button>
                    </>
                )}
            >
                {adjust && (
                    <div className="mnu-form">
                        <div className="mnu-row">
                            <button type="button" className="mk-chip" aria-pressed={adjust.mode === "percent"} onClick={() => setAdjust({ ...adjust, mode: "percent", value: 10 })}>Percentual</button>
                            <button type="button" className="mk-chip" aria-pressed={adjust.mode === "amount"} onClick={() => setAdjust({ ...adjust, mode: "amount", value: 0 })}>Valor</button>
                        </div>
                        {adjust.mode === "percent" ? (
                            <label className="mk-field">
                                <span className="mk-field__label">Percentual (%)</span>
                                <input className="mk-input" type="number" min="0.5" max={adjust.type === "service" ? 30 : 100} step="0.5" value={adjust.value} onChange={(event) => setAdjust({ ...adjust, value: Number(event.target.value) })} />
                            </label>
                        ) : (
                            <label className="mk-field">
                                <span className="mk-field__label">Valor</span>
                                <MoneyInput value={adjust.value} onChange={(value) => setAdjust({ ...adjust, value })} />
                            </label>
                        )}
                        {adjust.type === "discount" && (
                            <label className="mk-field">
                                <span className="mk-field__label">Motivo (obrigatório)</span>
                                <input className="mk-input" value={adjust.reason || ""} maxLength={140} onChange={(event) => setAdjust({ ...adjust, reason: event.target.value })} placeholder="Ex.: cortesia da casa, item demorou" />
                            </label>
                        )}
                    </div>
                )}
            </Sheet>

            <TransferSheet open={transfer} onClose={() => setTransfer(false)} tab={tab} tabId={tabId} items={items.filter((item) => item.status !== "cancelled")} otherTabs={otherTabs} freeTables={freeTables} />

            <EditService open={editing} onClose={() => setEditing(false)} tab={tab} tabId={tabId} team={team} />

            <Sheet open={qrOpen} onClose={() => setQrOpen(false)} side="center" title={`QR Code · ${tab.label}`} description="O cliente aponta a câmera e abre o cardápio desta mesa.">
                <div className="mnu-qr">
                    {qrLink && <QrImage value={qrLink} size={220} />}
                    <small className="mk-muted">{qrLink}</small>
                    <Button variant="outline" icon="solar:qr-code-linear" onClick={() => navigate(path("publicar"))}>QR de todas as mesas</Button>
                </div>
            </Sheet>
        </>
    );
}

const TransferSheet = ({ open, onClose, tab, tabId, items, otherTabs, freeTables }) => {
    const { act } = useMenus();
    const [mode, setMode] = useState("move");
    const [target, setTarget] = useState("");
    const [selected, setSelected] = useState([]);
    const [busy, setBusy] = useState(false);

    const run = async () => {
        setBusy(true);
        try {
            if (mode === "move") await act("tables.move", { tabId, toTableId: target }, { success: "Mesa transferida" });
            if (mode === "merge") await act("tables.merge", { fromTabId: tabId, intoTabId: target }, { success: "Mesas unidas" });
            if (mode === "items") await act("tabs.transferItems", { fromTabId: tabId, toTabId: target, itemIds: selected }, { success: "Itens transferidos" });
            onClose();
        } catch {
            /* aviso já exibido */
        } finally {
            setBusy(false);
        }
    };

    return (
        <Sheet
            open={open}
            onClose={onClose}
            title="Transferir ou unir"
            footer={(
                <>
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button variant="primary" loading={busy} disabled={!target || (mode === "items" && !selected.length)} onClick={run}>Confirmar</Button>
                </>
            )}
        >
            <div className="mnu-form">
                <div className="mnu-chips">
                    <button type="button" className="mk-chip" aria-pressed={mode === "move"} onClick={() => { setMode("move"); setTarget(""); }}>Mudar de mesa</button>
                    <button type="button" className="mk-chip" aria-pressed={mode === "merge"} onClick={() => { setMode("merge"); setTarget(""); }}>Unir com outra mesa</button>
                    <button type="button" className="mk-chip" aria-pressed={mode === "items"} onClick={() => { setMode("items"); setTarget(""); }}>Transferir itens</button>
                </div>

                {mode === "move" && (
                    <label className="mk-field">
                        <span className="mk-field__label">Mesa livre de destino</span>
                        <select className="mk-select" value={target} onChange={(event) => setTarget(event.target.value)}>
                            <option value="">Escolha…</option>
                            {freeTables.map((table) => <option key={table.id} value={table.id}>{table.label}</option>)}
                        </select>
                    </label>
                )}

                {(mode === "merge" || mode === "items") && (
                    <label className="mk-field">
                        <span className="mk-field__label">{mode === "merge" ? "Esta comanda entra em" : "Para a comanda"}</span>
                        <select className="mk-select" value={target} onChange={(event) => setTarget(event.target.value)}>
                            <option value="">Escolha…</option>
                            {otherTabs.map((other) => <option key={other.id} value={other.id}>{other.label} · {formatBRL(other.totals?.totalCents)}</option>)}
                        </select>
                    </label>
                )}

                {mode === "merge" && <p className="mk-muted">Todos os itens de {tab.label} vão para a comanda escolhida, e {tab.label} fica livre. Não é possível unir uma comanda que já recebeu pagamento.</p>}

                {mode === "items" && (
                    <ul className="mnu-pick-items">
                        {items.map((item) => (
                            <li key={item.id}>
                                <label className="mnu-check">
                                    <input type="checkbox" checked={selected.includes(item.id)} onChange={() => setSelected(selected.includes(item.id) ? selected.filter((id) => id !== item.id) : [...selected, item.id])} />
                                    <span><b>{item.qty}× {item.name}</b><small>{formatBRL(item.unitCents * item.qty)} · {item.status === "pending" ? "pendente" : "enviado"}</small></span>
                                </label>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </Sheet>
    );
};

const EditService = ({ open, onClose, tab, tabId, team }) => {
    const { act } = useMenus();
    const [form, setForm] = useState({ guests: tab.guests || 0, customerName: tab.customerName || "", waiterUid: tab.waiterUid || "", notes: tab.notes || "" });

    return (
        <Sheet
            open={open}
            onClose={onClose}
            side="center"
            title="Dados do atendimento"
            footer={(
                <>
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button
                        variant="primary"
                        onClick={async () => {
                            const waiter = team.find((person) => person.uid === form.waiterUid);
                            try {
                                await act("tabs.update", { tabId, ...form, waiterName: waiter?.name || "" }, { success: "Atendimento atualizado" });
                                onClose();
                            } catch {
                                /* aviso já exibido */
                            }
                        }}
                    >
                        Salvar
                    </Button>
                </>
            )}
        >
            <div className="mnu-form">
                <label className="mk-field"><span className="mk-field__label">Pessoas na mesa</span><input className="mk-input" type="number" min="0" max="99" value={form.guests} onChange={(event) => setForm({ ...form, guests: Number(event.target.value) })} /></label>
                <label className="mk-field"><span className="mk-field__label">Cliente (opcional)</span><input className="mk-input" value={form.customerName} maxLength={80} onChange={(event) => setForm({ ...form, customerName: event.target.value })} /></label>
                <label className="mk-field">
                    <span className="mk-field__label">Responsável</span>
                    <select className="mk-select" value={form.waiterUid} onChange={(event) => setForm({ ...form, waiterUid: event.target.value })}>
                        <option value="">Ninguém</option>
                        {team.map((person) => <option key={person.uid} value={person.uid}>{person.name} · {person.roleLabel}</option>)}
                    </select>
                </label>
                <label className="mk-field"><span className="mk-field__label">Observações</span><textarea className="mk-textarea" value={form.notes} maxLength={280} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
            </div>
        </Sheet>
    );
};
