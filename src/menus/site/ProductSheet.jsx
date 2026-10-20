import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";

import { formatBRL } from "../engine/money.js";
import { scheduleLabel } from "../engine/hours.js";
import { groupsOf, optionsOf, productAvailability, quoteLine, sizesOf } from "../engine/pricing.js";

/* =========================================================
   DETALHE DO PRODUTO

   Tamanho, sabores, adicionais e observação, com o total
   recalculado a cada escolha pelo MESMO cálculo do servidor.
   O botão diz exatamente o que falta ("Escolha o tamanho")
   em vez de só ficar desabilitado.
========================================================= */

const optionPrice = (option, sizeId) => {
    const bySize = option.priceBySize && sizeId ? option.priceBySize[sizeId] : undefined;
    return Number(bySize !== undefined && bySize !== null ? bySize : option.priceCents) || 0;
};

export const useDialog = (onClose) => {
    const panelRef = useRef(null);
    useEffect(() => {
        const previous = document.activeElement;
        const onKey = (event) => {
            if (event.key === "Escape") onClose();
            if (event.key === "Tab" && panelRef.current) {
                const focusable = panelRef.current.querySelectorAll("button:not(:disabled), input, textarea, select, a[href]");
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };
        window.addEventListener("keydown", onKey);
        requestAnimationFrame(() => panelRef.current?.focus());
        return () => {
            window.removeEventListener("keydown", onKey);
            if (previous?.focus) previous.focus();
        };
    }, [onClose]);
    return panelRef;
};

export default function ProductSheet({ product, groups, content, canOrder, now, tz, onClose, onAdd }) {
    const panelRef = useDialog(onClose);

    const sizes = sizesOf(product);
    const productGroups = groupsOf(product, groups);

    const [sizeId, setSizeId] = useState(sizes.length === 1 ? sizes[0].id : null);
    const [picked, setPicked] = useState({});
    const [qty, setQty] = useState(1);
    const [notes, setNotes] = useState("");
    const [tried, setTried] = useState(false);

    const quote = useMemo(
        () => quoteLine(product, groups, { qty, sizeId, options: picked, notes }, { now, tz }),
        [product, groups, qty, sizeId, picked, notes, now, tz]
    );

    const availability = productAvailability(product, { now, tz });

    const toggle = (group, optionId) => {
        setPicked((current) => {
            const list = current[group.id] || [];
            const max = Number(group.max) || 0;
            if (max === 1) return { ...current, [group.id]: list[0] === optionId && Number(group.min) === 0 ? [] : [optionId] };
            if (list.includes(optionId)) return { ...current, [group.id]: list.filter((id) => id !== optionId) };
            if (max > 0 && list.length >= max) return current;
            return { ...current, [group.id]: [...list, optionId] };
        });
    };

    const submit = () => {
        setTried(true);
        if (!quote.ok) return;
        onAdd({ productId: product.id, sizeId, options: picked, qty, notes: notes.trim() || undefined });
    };

    const allergens = Array.isArray(product.allergens) ? product.allergens.filter(Boolean) : [];

    return (
        <div className="mnr-sheet" role="dialog" aria-modal="true" aria-labelledby="mnr-product-title">
            <button type="button" className="mnr-sheet__veil" onClick={onClose} aria-label="Fechar" tabIndex={-1} />
            <div className="mnr-sheet__panel mnr-product" ref={panelRef} tabIndex={-1}>
                <button type="button" className="mnr-icon mnr-product__close" onClick={onClose} aria-label="Fechar">
                    <Icon icon="solar:close-circle-bold" />
                </button>

                <div className="mnr-sheet__body">
                    {content.showImages && product.image && (
                        <div className="mnr-product__media"><img src={product.image} alt="" /></div>
                    )}

                    <h2 id="mnr-product-title" className="mnr-product__name">{product.name}</h2>
                    {product.description && <p className="mnr-product__desc">{product.description}</p>}

                    <div className="mnr-product__meta">
                        {content.showPrepTime && product.prepMinutes ? <span><Icon icon="solar:clock-circle-linear" aria-hidden="true" /> Preparo ~{product.prepMinutes} min</span> : null}
                        {product.schedule && <span><Icon icon="solar:calendar-linear" aria-hidden="true" /> {scheduleLabel(product.schedule)}</span>}
                        {product.sku && <span className="mnr-muted">Cód. {product.sku}</span>}
                    </div>

                    {content.showAllergens && allergens.length > 0 && (
                        <p className="mnr-allergens"><Icon icon="solar:danger-triangle-linear" aria-hidden="true" /> Contém: {allergens.join(", ")}</p>
                    )}

                    {!availability.ok && <p className="mnr-unavailable is-block">{availability.reason}</p>}

                    {sizes.length > 0 && (
                        <fieldset className="mnr-group">
                            <legend>
                                <span>Tamanho</span>
                                <em className={tried && !sizeId ? "is-error" : ""}>Obrigatório</em>
                            </legend>
                            {sizes.map((size) => (
                                <label key={size.id} className={`mnr-opt ${size.available === false ? "is-off" : ""}`}>
                                    <input type="radio" name="mnr-size" checked={sizeId === size.id} disabled={size.available === false} onChange={() => setSizeId(size.id)} />
                                    <span className="mnr-opt__name">{size.name}</span>
                                    <span className="mnr-opt__price">{formatBRL(size.priceCents)}</span>
                                </label>
                            ))}
                        </fieldset>
                    )}

                    {productGroups.map((group) => {
                        const list = picked[group.id] || [];
                        const min = Number(group.min) || 0;
                        const max = Number(group.max) || 0;
                        const single = max === 1;
                        const hint = group.kind === "flavor"
                            ? `Até ${max || "vários"} sabor${max === 1 ? "" : "es"}${group.flavorPricing === "average" ? " · cobra a média" : max > 1 ? " · cobra o maior valor" : ""}`
                            : min && max && min === max ? `Escolha ${min}` : min ? `Mínimo ${min}${max ? `, máximo ${max}` : ""}` : max ? `Até ${max}` : "Opcional";
                        const missing = tried && list.length < min;

                        return (
                            <fieldset key={group.id} className="mnr-group">
                                <legend>
                                    <span>{group.name}</span>
                                    <em className={missing ? "is-error" : ""}>{min ? "Obrigatório · " : ""}{hint}</em>
                                </legend>
                                {optionsOf(group).map((option) => {
                                    const checked = list.includes(option.id);
                                    const price = optionPrice(option, sizeId);
                                    const disabled = option.available === false || (!checked && !single && max > 0 && list.length >= max);
                                    return (
                                        <label key={option.id} className={`mnr-opt ${option.available === false ? "is-off" : ""}`}>
                                            <input
                                                type={single ? "radio" : "checkbox"}
                                                name={`mnr-g-${group.id}`}
                                                checked={checked}
                                                disabled={disabled}
                                                onChange={() => toggle(group, option.id)}
                                                onClick={() => single && checked && min === 0 && toggle(group, option.id)}
                                            />
                                            <span className="mnr-opt__name">
                                                {option.name}
                                                {option.available === false && <small> · indisponível</small>}
                                            </span>
                                            {price > 0 && (
                                                <span className="mnr-opt__price">
                                                    {group.kind === "flavor" ? formatBRL(price) : `+ ${formatBRL(price)}`}
                                                </span>
                                            )}
                                        </label>
                                    );
                                })}
                            </fieldset>
                        );
                    })}

                    {canOrder && availability.ok && (
                        <label className="mnr-notes">
                            <span>Alguma observação?</span>
                            <textarea value={notes} maxLength={140} rows={2} placeholder="Ex.: sem cebola, ponto da carne…" onChange={(event) => setNotes(event.target.value)} />
                            <small>{notes.length}/140</small>
                        </label>
                    )}

                    {tried && !quote.ok && (
                        <ul className="mnr-errors" role="alert">
                            {quote.errors.map((error) => <li key={error}>{error}</li>)}
                        </ul>
                    )}
                </div>

                {canOrder && availability.ok ? (
                    <div className="mnr-sheet__foot">
                        <div className="mnr-qty" role="group" aria-label="Quantidade">
                            <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Diminuir" disabled={qty <= 1}><Icon icon="solar:minus-circle-linear" /></button>
                            <output aria-live="polite">{qty}</output>
                            <button type="button" onClick={() => setQty(Math.min(99, qty + 1))} aria-label="Aumentar"><Icon icon="solar:add-circle-linear" /></button>
                        </div>
                        <button type="button" className="mnr-btn mnr-btn--block" onClick={submit}>
                            <span>{quote.ok || !tried ? content.addLabel : quote.errors[0]}</span>
                            {quote.unitCents > 0 && (!sizes.length || sizeId) && <b>{formatBRL(quote.totalCents)}</b>}
                        </button>
                    </div>
                ) : (
                    <div className="mnr-sheet__foot">
                        <p className="mnr-muted">
                            {availability.ok ? "Este cardápio é só para consulta. Peça no balcão ou com a equipe." : "Este item não pode ser pedido agora."}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
