import React, { useState } from "react";
import { Icon } from "@iconify/react";

import { Button, Segmented, Sheet, Switch, useMediaQuery } from "../../design-system/components";
import { formatBRL } from "../engine/money.js";
import { describeLine } from "../engine/pricing.js";
import { PAYMENT_METHODS } from "../engine/orders.js";
import { useMenus } from "../MenusContext.jsx";
import ItemPicker from "../components/ItemPicker.jsx";
import { printOrder } from "../components/receipt.js";
import { DemoTag, MoneyInput, PageHead, idemKey } from "../ui.jsx";

/* =========================================================
   PDV / BALCÃO

   Lançamento rápido para balcão, retirada e delivery por
   telefone. O pedido é gravado pelo servidor com uma chave
   de operação: clicar duas vezes em "Lançar" cria um pedido
   só. "Pago agora" só aparece para quem pode confirmar
   pagamento (caixa, gerente, dono).
========================================================= */

export default function Pos() {
    const { act, can, settings, source, handle } = useMenus();
    const phone = useMediaQuery("(max-width: 959px)");

    const [lines, setLines] = useState([]);
    const [channel, setChannel] = useState("counter");
    const [customer, setCustomer] = useState({ name: "", phone: "" });
    const [address, setAddress] = useState("");
    const [fee, setFee] = useState(settings.fulfillment?.delivery?.feeCents || 0);
    const [method, setMethod] = useState("pix");
    const [paidNow, setPaidNow] = useState(can("orders.payment"));
    const [notes, setNotes] = useState("");
    const [busy, setBusy] = useState(false);
    const [key, setKey] = useState(() => idemKey("pdv"));
    const [ticketOpen, setTicketOpen] = useState(false);
    const [last, setLast] = useState(null);

    const subtotal = lines.reduce((sum, line) => sum + line.quote.totalCents, 0);
    const total = subtotal + (channel === "delivery" ? fee : 0);
    const count = lines.reduce((sum, line) => sum + line.selection.qty, 0);

    const submit = async () => {
        setBusy(true);
        try {
            const result = await act(
                "orders.create",
                {
                    idempotencyKey: key,
                    channel,
                    lines: lines.map((line) => line.selection),
                    customer,
                    fulfillment: { address, deliveryFeeCents: fee },
                    payment: { method, status: paidNow && can("orders.payment") ? "paid" : "pending" },
                    notes
                },
                { success: "Pedido lançado" }
            );
            setLast(result);
            setLines([]);
            setCustomer({ name: "", phone: "" });
            setAddress("");
            setNotes("");
            setKey(idemKey("pdv"));
            setTicketOpen(false);
        } catch {
            /* a mesma chave é reaproveitada: tentar de novo não duplica */
        } finally {
            setBusy(false);
        }
    };

    const printLast = async () => {
        if (!last?.orderId) return;
        const order = await source.get(`menusOps/${handle}/orders/${last.orderId}`);
        if (order) printOrder({ order: { ...order, id: last.orderId }, companyName: settings.profile?.name });
    };

    const ticket = (
        <div className="mnu-ticket">
            <Segmented
                label="Canal"
                value={channel}
                onChange={setChannel}
                options={[
                    { value: "counter", label: "Balcão", icon: "solar:shop-linear" },
                    { value: "pickup", label: "Retirada", icon: "solar:bag-4-linear" },
                    { value: "delivery", label: "Delivery", icon: "solar:scooter-linear" }
                ]}
            />

            {!lines.length ? (
                <p className="mk-muted mnu-ticket__empty">Escolha os produtos ao lado.</p>
            ) : (
                <ul className="mnu-basket">
                    {lines.map((line, index) => (
                        <li key={index}>
                            <span>
                                <b>{line.selection.qty}× {line.quote.line.name}</b>
                                {(describeLine(line.quote.line) || line.selection.notes) && <small>{[describeLine(line.quote.line), line.selection.notes && `Obs.: ${line.selection.notes}`].filter(Boolean).join(" · ")}</small>}
                            </span>
                            <b>{formatBRL(line.quote.totalCents)}</b>
                            <Button size="sm" variant="ghost" icon="solar:trash-bin-minimalistic-linear" aria-label="Remover" onClick={() => setLines(lines.filter((_, i) => i !== index))} />
                        </li>
                    ))}
                </ul>
            )}

            <div className="mnu-form">
                <div className="mnu-grid-2">
                    <label className="mk-field">
                        <span className="mk-field__label">Cliente {channel === "counter" ? "(opcional)" : ""}</span>
                        <input className="mk-input" value={customer.name} maxLength={80} onChange={(event) => setCustomer({ ...customer, name: event.target.value })} />
                    </label>
                    <label className="mk-field">
                        <span className="mk-field__label">Telefone</span>
                        <input className="mk-input" inputMode="tel" value={customer.phone} onChange={(event) => setCustomer({ ...customer, phone: event.target.value })} />
                    </label>
                </div>
                {channel === "delivery" && (
                    <div className="mnu-grid-2">
                        <label className="mk-field">
                            <span className="mk-field__label">Endereço</span>
                            <input className="mk-input" value={address} maxLength={240} onChange={(event) => setAddress(event.target.value)} />
                        </label>
                        <label className="mk-field">
                            <span className="mk-field__label">Taxa de entrega</span>
                            <MoneyInput value={fee} onChange={setFee} />
                        </label>
                    </div>
                )}
                <label className="mk-field">
                    <span className="mk-field__label">Observação</span>
                    <input className="mk-input" value={notes} maxLength={280} onChange={(event) => setNotes(event.target.value)} />
                </label>
                <div className="mnu-methods" role="radiogroup" aria-label="Forma de pagamento">
                    {["pix", "credit", "debit", "cash", "voucher"].map((id) => (
                        <button key={id} type="button" role="radio" aria-checked={method === id} className={`mnu-method ${method === id ? "is-on" : ""}`} onClick={() => setMethod(id)}>
                            <Icon icon={PAYMENT_METHODS[id].icon} aria-hidden="true" /> {PAYMENT_METHODS[id].label}
                        </button>
                    ))}
                </div>
                {can("orders.payment") && (
                    <div className="mnu-toggle">
                        <span><b>Pagamento recebido agora</b><small>Desligue se o cliente vai pagar na entrega ou retirada.</small></span>
                        <Switch checked={paidNow} onChange={setPaidNow} label="Pagamento recebido agora" />
                    </div>
                )}
            </div>

            <dl className="mnu-totals">
                <dt>Itens ({count})</dt><dd>{formatBRL(subtotal)}</dd>
                {channel === "delivery" && <><dt>Entrega</dt><dd>{formatBRL(fee)}</dd></>}
                <dt className="is-total">Total</dt><dd className="is-total">{formatBRL(total)}</dd>
            </dl>

            <Button variant="primary" size="lg" block loading={busy} disabled={!lines.length || (channel !== "counter" && customer.name.trim().length < 2) || (channel === "delivery" && address.trim().length < 5)} onClick={submit}>
                Lançar pedido · {formatBRL(total)}
            </Button>
            {last && (
                <p className="mnu-alert is-ok">
                    <Icon icon="solar:check-circle-linear" aria-hidden="true" /> Pedido #{last.code} lançado e enviado para a cozinha.
                    <Button size="sm" variant="ghost" icon="solar:printer-minimalistic-linear" onClick={printLast}>Imprimir</Button>
                </p>
            )}
        </div>
    );

    const addLine = (selection, quote) => setLines((current) => [...current, { selection, quote }]);

    return (
        <div className="std-page">
            <PageHead title="PDV / Balcão" description="Pedidos de balcão, retirada e delivery por telefone. Entram direto como confirmados na cozinha." actions={<DemoTag />} />

            <div className="mnu-pos">
                <div className="std-panel mnu-pos__products">
                    <ItemPicker onAdd={addLine} dense />
                </div>
                {!phone && <aside className="std-panel mnu-pos__ticket" aria-label="Pedido em montagem">{ticket}</aside>}
            </div>

            {phone && (
                <>
                    <div className="mnu-pos__fab">
                        <Button variant="primary" size="lg" block icon="solar:cart-large-4-bold" onClick={() => setTicketOpen(true)}>
                            {count ? `${count} item(ns) · ${formatBRL(total)}` : "Ver pedido"}
                        </Button>
                    </div>
                    <Sheet open={ticketOpen} onClose={() => setTicketOpen(false)} title="Pedido">{ticket}</Sheet>
                </>
            )}
        </div>
    );
}

