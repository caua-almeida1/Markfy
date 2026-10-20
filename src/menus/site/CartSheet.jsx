import React, { useMemo, useState } from "react";
import { Icon } from "@iconify/react";

import { formatBRL, toCents } from "../engine/money.js";
import { describeLine } from "../engine/pricing.js";
import {
    deliveryFeeCents,
    enabledFulfillments,
    enabledPaymentMethods,
    FULFILLMENT_LABELS,
    PAYMENT_METHODS,
    validateCheckout
} from "../engine/orders.js";
import { useDialog } from "./ProductSheet.jsx";
import OrderTracking from "./OrderTracking.jsx";

/* =========================================================
   SACOLA E FINALIZAÇÃO

   Mostra só o que a empresa habilitou: formas de entrega,
   regiões e taxas, pedido mínimo e formas de pagamento. O
   pagamento acontece na entrega/retirada (ou na conta da
   mesa) — nada aqui finge cobrar online. O pedido só aparece
   como recebido depois que o servidor confirma a gravação.
========================================================= */

const phoneMask = (value) => {
    const digits = String(value || "").replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export default function CartSheet({ cart, settings, design, features, mode, table, status, actions, trackingLink, onClose }) {
    const panelRef = useDialog(onClose);
    const { content } = design;

    const modes = table ? ["dine_in"] : enabledFulfillments(settings).filter((item) => item !== "dine_in");
    const methods = enabledPaymentMethods(settings);

    const [step, setStep] = useState("cart");
    const [fulfillment, setFulfillment] = useState(modes[0] || null);
    const [address, setAddress] = useState("");
    const [zoneId, setZoneId] = useState("");
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [method, setMethod] = useState(methods[0] || null);
    const [changeFor, setChangeFor] = useState("");
    const [notes, setNotes] = useState("");
    const [busy, setBusy] = useState(false);
    const [errors, setErrors] = useState([]);
    const [done, setDone] = useState(null);

    const payload = {
        idempotencyKey: cart.idempotencyKey,
        lines: cart.lines.map(({ productId, sizeId, options, qty, notes: lineNotes }) => ({ productId, sizeId, options, qty, notes: lineNotes })),
        fulfillment: { mode: fulfillment, address, zoneId, tableId: table?.id || null },
        customer: { name, phone },
        payment: { method: fulfillment === "dine_in" ? null : method, changeForCents: method === "cash" ? toCents(changeFor) : null },
        notes
    };

    const check = useMemo(
        () => validateCheckout(settings, cart.quote, payload, { now: Date.now(), orderingAllowed: features.menusOrdering !== false }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [settings, cart.quote, fulfillment, address, zoneId, name, phone, method, changeFor, table, features.menusOrdering]
    );

    const fee = fulfillment === "delivery" ? deliveryFeeCents(settings, zoneId, cart.quote.subtotalCents) : null;
    const total = cart.quote.subtotalCents + (fee?.fee || 0);
    const delivery = settings.fulfillment?.delivery || {};
    const minOrder = fulfillment === "delivery" ? Number(delivery.minOrderCents) || 0 : 0;

    const submit = async () => {
        if (!check.ok) {
            setErrors(check.errors);
            return;
        }
        setBusy(true);
        setErrors([]);
        try {
            const result = await actions.placeOrder(payload);
            cart.clear();
            setDone(result);
            setStep("done");
        } catch (error) {
            setErrors(error.extra?.errors?.length ? error.extra.errors : [error.message || "Não foi possível enviar o pedido."]);
        } finally {
            setBusy(false);
        }
    };

    const preview = mode === "preview";

    return (
        <div className="mnr-sheet" role="dialog" aria-modal="true" aria-labelledby="mnr-cart-title">
            <button type="button" className="mnr-sheet__veil" onClick={onClose} aria-label="Fechar" tabIndex={-1} />
            <div className="mnr-sheet__panel" ref={panelRef} tabIndex={-1}>
                <div className="mnr-sheet__head">
                    {step === "checkout" && (
                        <button type="button" className="mnr-icon" onClick={() => setStep("cart")} aria-label="Voltar para a sacola">
                            <Icon icon="solar:arrow-left-linear" />
                        </button>
                    )}
                    <h2 id="mnr-cart-title">
                        {step === "cart" ? "Seu pedido" : step === "checkout" ? content.checkoutLabel : "Pedido enviado"}
                    </h2>
                    <button type="button" className="mnr-icon" onClick={onClose} aria-label="Fechar"><Icon icon="solar:close-circle-linear" /></button>
                </div>

                {step === "cart" && (
                    <>
                        <div className="mnr-sheet__body">
                            {!cart.lines.length && <p className="mnr-muted">Sua sacola está vazia.</p>}
                            <ul className="mnr-cart">
                                {cart.quote.lines.map((item) => {
                                    const line = cart.lines.find((entry) => entry.id === item.id);
                                    return (
                                        <li key={item.id} className={item.ok ? "" : "is-error"}>
                                            <div className="mnr-cart__text">
                                                <b>{item.line?.name || "Produto indisponível"}</b>
                                                {item.line && describeLine(item.line) && <small>{describeLine(item.line)}</small>}
                                                {line?.notes && <small>Obs.: {line.notes}</small>}
                                                {!item.ok && <small className="mnr-unavailable">{item.errors[0]}</small>}
                                            </div>
                                            <div className="mnr-cart__side">
                                                <b>{formatBRL(item.totalCents)}</b>
                                                <div className="mnr-qty is-small" role="group" aria-label={`Quantidade de ${item.line?.name || "item"}`}>
                                                    <button type="button" onClick={() => cart.setQty(item.id, (line?.qty || 1) - 1)} aria-label="Diminuir">
                                                        <Icon icon={(line?.qty || 1) <= 1 ? "solar:trash-bin-minimalistic-linear" : "solar:minus-circle-linear"} />
                                                    </button>
                                                    <output>{line?.qty}</output>
                                                    <button type="button" onClick={() => cart.setQty(item.id, (line?.qty || 1) + 1)} aria-label="Aumentar"><Icon icon="solar:add-circle-linear" /></button>
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                            <dl className="mnr-totals">
                                <dt>Subtotal</dt>
                                <dd>{formatBRL(cart.quote.subtotalCents)}</dd>
                            </dl>
                            {!status.open && settings.ordering?.acceptWhenClosed !== true && (
                                <p className="mnr-warn"><Icon icon="solar:clock-circle-linear" aria-hidden="true" /> Estamos fechados agora{status.next ? ` — abrimos ${status.next}` : ""}. Você pode montar o pedido, mas o envio fica disponível quando abrirmos.</p>
                            )}
                        </div>
                        <div className="mnr-sheet__foot">
                            <button type="button" className="mnr-btn mnr-btn--block" disabled={!cart.lines.length || cart.quote.lines.some((item) => !item.ok)} onClick={() => setStep("checkout")}>
                                <span>Continuar</span>
                                <b>{formatBRL(cart.quote.subtotalCents)}</b>
                            </button>
                        </div>
                    </>
                )}

                {step === "checkout" && (
                    <>
                        <div className="mnr-sheet__body">
                            {table ? (
                                <p className="mnr-note"><Icon icon="solar:armchair-2-linear" aria-hidden="true" /> Pedido para a <b>{table.label}</b>. Ele entra na conta da mesa; o pagamento é feito no fechamento.</p>
                            ) : (
                                <fieldset className="mnr-group">
                                    <legend><span>Como você quer receber?</span></legend>
                                    {!modes.length && <p className="mnr-muted">O estabelecimento ainda não ativou retirada nem entrega.</p>}
                                    {modes.map((item) => (
                                        <label key={item} className="mnr-opt">
                                            <input type="radio" name="mnr-fulfillment" checked={fulfillment === item} onChange={() => setFulfillment(item)} />
                                            <span className="mnr-opt__name">
                                                {FULFILLMENT_LABELS[item]}
                                                <small>
                                                    {item === "pickup" && (settings.fulfillment?.pickup?.etaMinutes ? `Pronto em ~${settings.fulfillment.pickup.etaMinutes} min` : "Retire no endereço do estabelecimento")}
                                                    {item === "delivery" && (delivery.etaMinutes ? `Chega em ~${delivery.etaMinutes} min` : "Entregamos no seu endereço")}
                                                </small>
                                            </span>
                                        </label>
                                    ))}
                                </fieldset>
                            )}

                            {fulfillment === "delivery" && (
                                <div className="mnr-fields">
                                    {fee?.zones?.length > 0 && (
                                        <label className="mnr-field">
                                            <span>Bairro ou região</span>
                                            <select value={zoneId} onChange={(event) => setZoneId(event.target.value)}>
                                                <option value="">Escolha…</option>
                                                {fee.zones.map((zone) => (
                                                    <option key={zone.id} value={zone.id}>{zone.name} · {Number(zone.feeCents) ? formatBRL(zone.feeCents) : "grátis"}</option>
                                                ))}
                                            </select>
                                        </label>
                                    )}
                                    <label className="mnr-field">
                                        <span>Endereço de entrega</span>
                                        <textarea rows={2} value={address} maxLength={240} placeholder="Rua, número, complemento e referência" onChange={(event) => setAddress(event.target.value)} autoComplete="street-address" />
                                    </label>
                                    {minOrder > 0 && cart.quote.subtotalCents < minOrder && (
                                        <p className="mnr-warn">Pedido mínimo para entrega: {formatBRL(minOrder)}.</p>
                                    )}
                                </div>
                            )}

                            <div className="mnr-fields">
                                <label className="mnr-field">
                                    <span>Seu nome</span>
                                    <input value={name} maxLength={80} onChange={(event) => setName(event.target.value)} autoComplete="name" />
                                </label>
                                {!table && (
                                    <label className="mnr-field">
                                        <span>Telefone (com DDD)</span>
                                        <input value={phone} inputMode="tel" onChange={(event) => setPhone(phoneMask(event.target.value))} autoComplete="tel" placeholder="(11) 90000-0000" />
                                        <small>Usado só para falar sobre este pedido.</small>
                                    </label>
                                )}
                            </div>

                            {!table && (
                                <fieldset className="mnr-group">
                                    <legend><span>Pagamento</span><em>Na {fulfillment === "delivery" ? "entrega" : "retirada"}</em></legend>
                                    {!methods.length && <p className="mnr-muted">O estabelecimento ainda não configurou formas de pagamento.</p>}
                                    {methods.map((id) => (
                                        <label key={id} className="mnr-opt">
                                            <input type="radio" name="mnr-pay" checked={method === id} onChange={() => setMethod(id)} />
                                            <span className="mnr-opt__name">{PAYMENT_METHODS[id].label}</span>
                                        </label>
                                    ))}
                                    {method === "cash" && (
                                        <label className="mnr-field">
                                            <span>Troco para (opcional)</span>
                                            <input inputMode="decimal" value={changeFor} placeholder="Ex.: 100,00" onChange={(event) => setChangeFor(event.target.value)} />
                                        </label>
                                    )}
                                    {method === "pix" && settings.payments?.pixKey && (
                                        <p className="mnr-note">Chave Pix do estabelecimento: <b>{settings.payments.pixKey}</b>. Confirme o valor com a equipe antes de pagar.</p>
                                    )}
                                </fieldset>
                            )}

                            <label className="mnr-field">
                                <span>Observações para o estabelecimento (opcional)</span>
                                <textarea rows={2} value={notes} maxLength={280} onChange={(event) => setNotes(event.target.value)} />
                            </label>

                            <dl className="mnr-totals">
                                <dt>Subtotal</dt>
                                <dd>{formatBRL(cart.quote.subtotalCents)}</dd>
                                {fulfillment === "delivery" && (
                                    <>
                                        <dt>Taxa de entrega</dt>
                                        <dd>{fee?.zones?.length && !zoneId ? "escolha a região" : fee?.fee ? formatBRL(fee.fee) : "grátis"}</dd>
                                    </>
                                )}
                                <dt className="is-total">Total</dt>
                                <dd className="is-total">{formatBRL(total)}</dd>
                            </dl>

                            {errors.length > 0 && (
                                <ul className="mnr-errors" role="alert">
                                    {errors.map((error) => <li key={error}>{error}</li>)}
                                </ul>
                            )}

                            {preview && <p className="mnr-note">Pré-visualização: o envio de pedidos fica desligado no editor.</p>}
                            {mode === "demo" && <p className="mnr-note"><Icon icon="solar:test-tube-linear" aria-hidden="true" /> Demonstração: o pedido vai para o painel de exemplo e não é real.</p>}
                        </div>
                        <div className="mnr-sheet__foot">
                            <button type="button" className="mnr-btn mnr-btn--block" disabled={busy || preview || !actions.placeOrder} onClick={submit} aria-busy={busy || undefined}>
                                <span>{busy ? "Enviando…" : "Enviar pedido"}</span>
                                <b>{formatBRL(total)}</b>
                            </button>
                        </div>
                    </>
                )}

                {step === "done" && done && (
                    <div className="mnr-sheet__body">
                        <div className="mnr-done">
                            <span className="mnr-done__icon"><Icon icon="solar:check-circle-bold" aria-hidden="true" /></span>
                            <h3>Pedido #{done.code} recebido pelo estabelecimento</h3>
                            <p>Ele será confirmado pela equipe. {table ? "Os itens entram na conta da mesa." : "O pagamento é feito na entrega ou retirada."}</p>
                            {trackingLink && done.orderId && (
                                <a className="mnr-btn" href={trackingLink(done.orderId)}>Acompanhar pedido</a>
                            )}
                        </div>
                        {!trackingLink && actions.watchTrack && done.orderId && (
                            <OrderTracking watch={(callback) => actions.watchTrack(done.orderId, callback)} />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
