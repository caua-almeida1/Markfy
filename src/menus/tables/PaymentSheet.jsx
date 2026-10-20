import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";

import { Button, Segmented, Sheet, cx } from "../../design-system/components";
import { formatBRL, splitEqually } from "../engine/money.js";
import { PAYMENT_METHODS } from "../engine/orders.js";
import { amountForItems, computeTotals, splitByPerson } from "../engine/tabs.js";
import { entries } from "../engine/util.js";
import { describeLine } from "../engine/pricing.js";
import { useMenus } from "../MenusContext.jsx";
import { MoneyInput, idemKey } from "../ui.jsx";

/* =========================================================
   RECEBER PAGAMENTO DA COMANDA

   Modos: valor total, dividir igualmente, por pessoa, por
   itens ou valor livre. Cada recebimento é um pagamento
   registrado no servidor com um identificador próprio:
   clique duplo, rede lenta ou dois aparelhos ao mesmo tempo
   nunca cobram duas vezes — o servidor reconhece o mesmo id.
   O servidor também recusa valor acima do saldo.
========================================================= */

const METHODS = ["pix", "credit", "debit", "cash", "voucher", "other"];

export default function PaymentSheet({ open, tab, tabId, onClose }) {
    const { act } = useMenus();
    const totals = tab ? tab.totals || computeTotals(tab) : null;

    const [mode, setMode] = useState("total");
    const [method, setMethod] = useState("pix");
    const [custom, setCustom] = useState(0);
    const [people, setPeople] = useState(Math.max(2, tab?.guests || 2));
    const [received, setReceived] = useState(null);
    const [selected, setSelected] = useState([]);
    const [busy, setBusy] = useState(null);
    const [paymentId, setPaymentId] = useState(idemKey("pay"));

    useEffect(() => {
        if (open) {
            setPaymentId(idemKey("pay"));
            setReceived(null);
            setSelected([]);
        }
    }, [open]);

    const balance = totals?.balanceCents || 0;
    const parts = useMemo(() => splitEqually(balance, people), [balance, people]);
    const byPerson = useMemo(() => (tab ? splitByPerson(tab) : []), [tab]);
    const items = tab ? entries(tab.items).filter((item) => item.status !== "cancelled") : [];
    const itemsAmount = tab && selected.length ? amountForItems(tab, selected) : 0;

    if (!tab) return null;

    const pay = async (amountCents, person, key = "main") => {
        if (!amountCents || amountCents <= 0) return;
        setBusy(key);
        try {
            await act(
                "tabs.pay",
                { tabId, paymentId, method, amountCents, receivedCents: method === "cash" && received ? received : undefined, person },
                { success: `Pagamento de ${formatBRL(amountCents)} registrado` }
            );
            setPaymentId(idemKey("pay"));
            setReceived(null);
            setSelected([]);
            /* Conta quitada: volta para a mesa, onde está o
               "Fechar e liberar mesa". */
            if (amountCents >= balance) onClose();
        } catch {
            /* o id continua o mesmo: tentar de novo não duplica */
        } finally {
            setBusy(null);
        }
    };

    const amount = mode === "total" ? balance : mode === "custom" ? Math.min(custom, balance) : mode === "items" ? itemsAmount : 0;
    const change = method === "cash" && received && amount ? received - amount : null;

    const MethodPicker = (
        <div className="mnu-methods" role="radiogroup" aria-label="Forma de pagamento">
            {METHODS.map((id) => (
                <button key={id} type="button" role="radio" aria-checked={method === id} className={cx("mnu-method", method === id && "is-on")} onClick={() => setMethod(id)}>
                    <Icon icon={PAYMENT_METHODS[id].icon} aria-hidden="true" />
                    {PAYMENT_METHODS[id].label}
                </button>
            ))}
        </div>
    );

    return (
        <Sheet
            open={open}
            onClose={onClose}
            title={`Receber · ${tab.label || "Comanda"}`}
            description={`Total ${formatBRL(totals.totalCents)} · pago ${formatBRL(totals.paidCents)} · saldo ${formatBRL(balance)}`}
            footer={["total", "custom", "items"].includes(mode) && balance > 0 && (
                <>
                    <Button variant="ghost" onClick={onClose}>Fechar</Button>
                    <Button variant="primary" loading={busy === "main"} disabled={!amount || amount > balance || (change !== null && change < 0)} onClick={() => pay(amount, null)}>
                        Registrar {formatBRL(amount)}
                    </Button>
                </>
            )}
        >
            <div className="mnu-form">
                {totals.pendingCount > 0 && (
                    <p className="mnu-alert is-warn">Há {totals.pendingCount} item(ns) ainda não enviado(s). Envie ou remova antes de receber.</p>
                )}

                {balance <= 0 ? (
                    <div className="mnu-alert is-ok">
                        <Icon icon="solar:check-circle-linear" aria-hidden="true" /> Conta quitada. Feche a comanda para liberar a mesa.
                    </div>
                ) : (
                    <>
                        <Segmented
                            label="Como dividir"
                            value={mode}
                            onChange={setMode}
                            options={[
                                { value: "total", label: "Total" },
                                { value: "equal", label: "Igual" },
                                { value: "person", label: "Por pessoa" },
                                { value: "items", label: "Por itens" },
                                { value: "custom", label: "Valor" }
                            ]}
                        />

                        <p className="mnu-label">Forma de pagamento</p>
                        {MethodPicker}

                        {method === "cash" && ["total", "custom", "items"].includes(mode) && (
                            <div className="mnu-grid-2">
                                <label className="mk-field">
                                    <span className="mk-field__label">Valor entregue pelo cliente</span>
                                    <MoneyInput value={received} allowEmpty onChange={setReceived} />
                                </label>
                                <div className="mnu-change" aria-live="polite">
                                    <small>Troco</small>
                                    <b className={change !== null && change < 0 ? "is-bad" : ""}>{change === null ? "—" : change < 0 ? "Valor insuficiente" : formatBRL(change)}</b>
                                </div>
                            </div>
                        )}

                        {mode === "total" && <p className="mnu-big">{formatBRL(balance)}</p>}

                        {mode === "custom" && (
                            <label className="mk-field">
                                <span className="mk-field__label">Valor a registrar (até {formatBRL(balance)})</span>
                                <MoneyInput value={custom} onChange={setCustom} />
                            </label>
                        )}

                        {mode === "equal" && (
                            <>
                                <div className="mnu-row">
                                    <span className="mnu-label">Dividir entre</span>
                                    <div className="mnu-qty">
                                        <Button size="sm" variant="ghost" icon="solar:minus-circle-linear" aria-label="Menos pessoas" disabled={people <= 2} onClick={() => setPeople(people - 1)} />
                                        <output aria-live="polite">{people}</output>
                                        <Button size="sm" variant="ghost" icon="solar:add-circle-linear" aria-label="Mais pessoas" onClick={() => setPeople(Math.min(30, people + 1))} />
                                    </div>
                                    <span className="mk-muted">pessoas</span>
                                </div>
                                <p className="mk-muted">Os centavos que sobram vão para as primeiras partes, para a soma fechar exatamente.</p>
                                <ul className="mnu-parts">
                                    {parts.map((value, index) => (
                                        <li key={index}>
                                            <span>Parte {index + 1}</span>
                                            <b>{formatBRL(value)}</b>
                                            <Button size="sm" variant="primary" loading={busy === `part-${index}`} disabled={Boolean(busy) || totals.pendingCount > 0} onClick={() => pay(value, `Parte ${index + 1}/${people}`, `part-${index}`)}>Receber</Button>
                                        </li>
                                    ))}
                                </ul>
                                <p className="mk-muted">Depois de cada recebimento, as partes são recalculadas sobre o saldo restante.</p>
                            </>
                        )}

                        {mode === "person" && (
                            <>
                                {byPerson.length <= 1 && !byPerson[0]?.person ? (
                                    <p className="mk-muted">Nenhum item foi marcado com o nome de uma pessoa. Ao lançar itens, preencha “Pessoa” para dividir assim — ou use “Igual” ou “Por itens”.</p>
                                ) : (
                                    <ul className="mnu-parts">
                                        {byPerson.map((row) => (
                                            <li key={row.person || "geral"}>
                                                <span>{row.person || "Sem pessoa definida"}<small> · consumiu {formatBRL(row.itemsCents)}</small></span>
                                                <b>{formatBRL(row.remainingCents)}</b>
                                                <Button size="sm" variant="primary" loading={busy === `p-${row.person}`} disabled={!row.remainingCents || Boolean(busy) || totals.pendingCount > 0} onClick={() => pay(Math.min(row.remainingCents, balance), row.person || "Geral", `p-${row.person}`)}>Receber</Button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <p className="mk-muted">Taxa de serviço e descontos são rateados na proporção do consumo de cada pessoa.</p>
                            </>
                        )}

                        {mode === "items" && (
                            <>
                                <ul className="mnu-pick-items">
                                    {items.map((item) => (
                                        <li key={item.id}>
                                            <label className="mnu-check">
                                                <input type="checkbox" checked={selected.includes(item.id)} onChange={() => setSelected(selected.includes(item.id) ? selected.filter((id) => id !== item.id) : [...selected, item.id])} />
                                                <span>
                                                    <b>{item.qty}× {item.name}</b>
                                                    <small>{describeLine(item) || "—"} · {formatBRL(item.unitCents * item.qty)}</small>
                                                </span>
                                            </label>
                                        </li>
                                    ))}
                                </ul>
                                <p className="mk-muted">O valor inclui a parte proporcional da taxa de serviço e dos descontos.</p>
                                <p className="mnu-big">{formatBRL(itemsAmount)}</p>
                            </>
                        )}
                    </>
                )}
            </div>
        </Sheet>
    );
}
