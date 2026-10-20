import React, { useMemo, useState } from "react";
import { Icon } from "@iconify/react";

import { Button, cx } from "../../design-system/components";
import { formatBRL } from "../engine/money.js";
import { describeLine, effectivePriceCents, fromPriceCents, groupsOf, hasVariablePrice, optionsOf, productAvailability, quoteLine, sizesOf } from "../engine/pricing.js";
import { useMenus } from "../MenusContext.jsx";
import { listCategories, listMenus, listProducts } from "../data/selectors.js";
import { Thumb } from "../catalog/ProductEditor.jsx";

/* =========================================================
   SELETOR DE PRODUTOS DA EQUIPE (mesa e PDV)

   Grade grande para toque, busca por nome ou código e, para
   produtos com escolhas, uma tela de opções com as mesmas
   regras do cardápio público (mínimo, máximo, sabores por
   tamanho). Itens indisponíveis aparecem, mas não entram.
========================================================= */

const normalize = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const needsOptions = (product, groups) =>
    sizesOf(product).length > 0 || groupsOf(product, groups).length > 0;

export const OptionPicker = ({ product, groups, onConfirm, onCancel, withPerson = false, tz }) => {
    const sizes = sizesOf(product);
    const productGroups = groupsOf(product, groups);
    const [sizeId, setSizeId] = useState(sizes.length === 1 ? sizes[0].id : null);
    const [picked, setPicked] = useState({});
    const [qty, setQty] = useState(1);
    const [notes, setNotes] = useState("");
    const [person, setPerson] = useState("");
    const [tried, setTried] = useState(false);

    const quote = useMemo(() => quoteLine(product, groups, { sizeId, options: picked, qty, notes }, { tz }), [product, groups, sizeId, picked, qty, notes, tz]);

    const toggle = (group, id) =>
        setPicked((current) => {
            const list = current[group.id] || [];
            const max = Number(group.max) || 0;
            if (max === 1) return { ...current, [group.id]: list[0] === id && !Number(group.min) ? [] : [id] };
            if (list.includes(id)) return { ...current, [group.id]: list.filter((value) => value !== id) };
            if (max && list.length >= max) return current;
            return { ...current, [group.id]: [...list, id] };
        });

    return (
        <div className="mnu-opick">
            <div className="mnu-opick__head">
                <Button size="sm" variant="ghost" icon="solar:arrow-left-linear" onClick={onCancel}>Voltar</Button>
                <div>
                    <b>{product.name}</b>
                    <small>{formatBRL(quote.unitCents)} cada</small>
                </div>
            </div>

            {sizes.length > 0 && (
                <fieldset className="mnu-opick__group">
                    <legend>Tamanho <em className={tried && !sizeId ? "is-error" : ""}>obrigatório</em></legend>
                    <div className="mnu-opick__options">
                        {sizes.map((size) => (
                            <button key={size.id} type="button" className={cx("mnu-opt", sizeId === size.id && "is-on")} aria-pressed={sizeId === size.id} disabled={size.available === false} onClick={() => setSizeId(size.id)}>
                                <span>{size.name}</span>
                                <small>{formatBRL(size.priceCents)}</small>
                            </button>
                        ))}
                    </div>
                </fieldset>
            )}

            {productGroups.map((group) => {
                const list = picked[group.id] || [];
                const min = Number(group.min) || 0;
                const max = Number(group.max) || 0;
                return (
                    <fieldset key={group.id} className="mnu-opick__group">
                        <legend>
                            {group.name}
                            <em className={tried && list.length < min ? "is-error" : ""}>
                                {min ? `mín. ${min}` : "opcional"}{max ? ` · máx. ${max}` : ""}{group.kind === "flavor" && max > 1 ? (group.flavorPricing === "average" ? " · média" : " · maior valor") : ""}
                            </em>
                        </legend>
                        <div className="mnu-opick__options">
                            {optionsOf(group).map((option) => {
                                const on = list.includes(option.id);
                                const bySize = option.priceBySize && sizeId ? option.priceBySize[sizeId] : undefined;
                                const price = Number(bySize ?? option.priceCents) || 0;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        className={cx("mnu-opt", on && "is-on")}
                                        aria-pressed={on}
                                        disabled={option.available === false || (!on && max > 1 && list.length >= max)}
                                        onClick={() => toggle(group, option.id)}
                                    >
                                        <span>{option.name}</span>
                                        {price > 0 && <small>{group.kind === "flavor" ? formatBRL(price) : `+${formatBRL(price)}`}</small>}
                                        {option.available === false && <small>indisponível</small>}
                                    </button>
                                );
                            })}
                        </div>
                    </fieldset>
                );
            })}

            <div className="mnu-grid-2">
                <label className="mk-field">
                    <span className="mk-field__label">Observação para a cozinha</span>
                    <input className="mk-input" value={notes} maxLength={140} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: sem cebola" />
                </label>
                {withPerson && (
                    <label className="mk-field">
                        <span className="mk-field__label">Pessoa (para dividir a conta)</span>
                        <input className="mk-input" value={person} maxLength={30} onChange={(event) => setPerson(event.target.value)} placeholder="Ex.: Ana, Cadeira 2" />
                    </label>
                )}
            </div>

            {tried && !quote.ok && <p className="mnu-alert is-bad" role="alert">{quote.errors[0]}</p>}

            <div className="mnu-opick__foot">
                <div className="mnu-qty">
                    <Button size="sm" variant="ghost" icon="solar:minus-circle-linear" aria-label="Diminuir" disabled={qty <= 1} onClick={() => setQty(qty - 1)} />
                    <output aria-live="polite">{qty}</output>
                    <Button size="sm" variant="ghost" icon="solar:add-circle-linear" aria-label="Aumentar" onClick={() => setQty(Math.min(99, qty + 1))} />
                </div>
                <Button
                    variant="primary"
                    block
                    onClick={() => {
                        setTried(true);
                        if (!quote.ok) return;
                        onConfirm({ productId: product.id, sizeId, options: picked, qty, notes: notes.trim() || undefined, person: person.trim() || undefined }, quote);
                    }}
                >
                    Adicionar · {formatBRL(quote.totalCents)}
                </Button>
            </div>
        </div>
    );
};

export default function ItemPicker({ onAdd, withPerson = false, dense = false }) {
    const { catalog, settings } = useMenus();
    const tz = settings.timezone;
    const groups = catalog.optionGroups || {};
    const menus = listMenus(catalog).filter((menu) => menu.active !== false);
    const [menuId, setMenuId] = useState(menus[0]?.id || null);
    const categories = listCategories(catalog, menuId || menus[0]?.id).filter((category) => category.active !== false);
    const [categoryId, setCategoryId] = useState(null);
    const [query, setQuery] = useState("");
    const [choosing, setChoosing] = useState(null);

    const all = listProducts(catalog).filter((product) => product.published !== false);
    const list = query
        ? all.filter((product) => normalize(`${product.name} ${product.sku}`).includes(normalize(query)))
        : all.filter((product) => product.categoryId === (categoryId || categories[0]?.id));

    if (choosing) {
        return (
            <OptionPicker
                product={choosing}
                groups={groups}
                tz={tz}
                withPerson={withPerson}
                onCancel={() => setChoosing(null)}
                onConfirm={(selection, quote) => {
                    onAdd(selection, quote);
                    setChoosing(null);
                }}
            />
        );
    }

    return (
        <div className={cx("mnu-picker", dense && "is-dense")}>
            <label className="mk-input-group">
                <Icon icon="solar:magnifer-linear" aria-hidden="true" />
                <input className="mk-input" type="search" placeholder="Buscar por nome ou código" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar produto" />
            </label>

            {!query && menus.length > 1 && (
                <div className="mnu-chips">
                    {menus.map((menu) => (
                        <button key={menu.id} type="button" className="mk-chip" aria-pressed={(menuId || menus[0]?.id) === menu.id} onClick={() => { setMenuId(menu.id); setCategoryId(null); }}>{menu.name}</button>
                    ))}
                </div>
            )}

            {!query && (
                <div className="mnu-chips mnu-chips--scroll" role="group" aria-label="Categorias">
                    {categories.map((category) => (
                        <button key={category.id} type="button" className="mk-chip" aria-pressed={(categoryId || categories[0]?.id) === category.id} onClick={() => setCategoryId(category.id)}>
                            {category.icon && <span aria-hidden="true">{category.icon}</span>} {category.name}
                        </button>
                    ))}
                </div>
            )}

            <ul className="mnu-pgrid">
                {list.map((product) => {
                    const availability = productAvailability(product, { tz });
                    const variable = hasVariablePrice(product, groups);
                    return (
                        <li key={product.id}>
                            <button
                                type="button"
                                className={cx("mnu-pcard", !availability.ok && "is-off")}
                                disabled={!availability.ok}
                                onClick={() => {
                                    if (needsOptions(product, groups)) setChoosing(product);
                                    else {
                                        const quote = quoteLine(product, groups, { qty: 1 }, { tz });
                                        if (quote.ok) onAdd({ productId: product.id, qty: 1, options: {} }, quote);
                                    }
                                }}
                            >
                                <Thumb src={product.image} name={product.name} />
                                <span className="mnu-pcard__name">{product.name}</span>
                                <small>
                                    {availability.ok
                                        ? `${variable ? "a partir de " : ""}${formatBRL(variable ? fromPriceCents(product, groups) : effectivePriceCents(product))}`
                                        : availability.reason}
                                </small>
                                {needsOptions(product, groups) && availability.ok && <Icon className="mnu-pcard__more" icon="solar:tuning-2-linear" aria-label="Tem opções" />}
                            </button>
                        </li>
                    );
                })}
                {!list.length && <li className="mk-muted">Nada encontrado.</li>}
            </ul>
        </div>
    );
}

export { describeLine };
