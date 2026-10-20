/* =========================================================
   CATÁLOGO E PREÇOS

   Estrutura (menusCatalog/{handle}):

     menus/{id}         { name, description, order, active, schedule }
     categories/{id}    { menuId, name, description, order, active }
     products/{id}      { categoryId, name, description, image,
                          priceCents, promoPriceCents, sku,
                          available, soldOut, schedule, prepMinutes,
                          sizes: [{ id, name, priceCents, available }],
                          optionGroupIds: [..], allergens: [..],
                          tags: { featured, new, bestseller },
                          published, order }
     optionGroups/{id}  { name, kind: "addon" | "choice" | "flavor",
                          min, max, flavorPricing: "highest" | "average",
                          options: [{ id, name, priceCents,
                                      priceBySize: { sizeId: cents },
                                      available }] }

   Regras de preço de uma linha do pedido:

     base   = preço do tamanho escolhido, ou preço do produto
              (promocional, quando o dono cadastrou um menor);
     sabores (grupo "flavor"): se os sabores têm preço, a base
              passa a ser o MAIOR deles ou a MÉDIA, conforme o
              grupo (pizza meio a meio);
     extras  (grupos "addon"/"choice"): somam o preço de cada
              opção (por tamanho, quando houver);
     total  = (base + extras) × quantidade.

   O servidor recalcula tudo a partir do catálogo gravado;
   o preço que vem do navegador é ignorado.
========================================================= */

import { asList, asMap, clampInt, text } from "./util.js";
import { cents } from "./money.js";
import { productScheduleOpen, DEFAULT_TZ } from "./hours.js";

export const GROUP_KINDS = {
    addon: "Adicionais",
    choice: "Escolha",
    flavor: "Sabores"
};

export const effectivePriceCents = (product) => {
    const price = cents(product?.priceCents);
    const promo = cents(product?.promoPriceCents);
    return promo > 0 && promo < price ? promo : price;
};

export const hasPromo = (product) => {
    const price = cents(product?.priceCents);
    const promo = cents(product?.promoPriceCents);
    return promo > 0 && promo < price && !asList(product?.sizes).length;
};

export const sizesOf = (product) => asList(product?.sizes).filter((size) => size && size.id && size.name);

export const groupsOf = (product, groupsById) =>
    asList(product?.optionGroupIds)
        .map((id) => ({ ...asMap(groupsById)[id], id }))
        .filter((group) => group && group.name);

export const optionsOf = (group) => asList(group?.options).filter((option) => option && option.id && option.name);

const optionPrice = (option, sizeId) => {
    const bySize = option?.priceBySize && sizeId ? option.priceBySize[sizeId] : undefined;
    return cents(bySize !== undefined && bySize !== null ? bySize : option?.priceCents);
};

/** "A partir de" para vitrine. */
export const fromPriceCents = (product, groupsById) => {
    const sizes = sizesOf(product).filter((size) => size.available !== false);
    let base = sizes.length ? Math.min(...sizes.map((size) => cents(size.priceCents))) : effectivePriceCents(product);

    const flavor = groupsOf(product, groupsById).find((group) => group.kind === "flavor");
    if (flavor) {
        const smallest = sizes.length ? sizes.reduce((a, b) => (cents(a.priceCents) <= cents(b.priceCents) ? a : b)) : null;
        const prices = optionsOf(flavor)
            .filter((option) => option.available !== false)
            .map((option) => optionPrice(option, smallest?.id))
            .filter((value) => value > 0);
        if (prices.length) base = Math.min(...prices);
    }

    return base;
};

export const hasVariablePrice = (product, groupsById) =>
    sizesOf(product).length > 1 ||
    groupsOf(product, groupsById).some((group) => group.kind === "flavor" || optionsOf(group).some((option) => cents(option.priceCents) > 0));

/** O produto pode ser pedido agora? Devolve o motivo quando não. */
export const productAvailability = (product, { now = Date.now(), tz = DEFAULT_TZ } = {}) => {
    if (!product || !product.name) return { ok: false, reason: "Produto não encontrado." };
    if (product.published === false) return { ok: false, reason: "Produto não publicado." };
    if (product.available === false) return { ok: false, reason: "Indisponível no momento." };
    if (product.soldOut === true) return { ok: false, reason: "Esgotado." };
    if (!productScheduleOpen(product.schedule, now, tz)) return { ok: false, reason: "Disponível em outro horário." };
    return { ok: true, reason: "" };
};

/**
 * Calcula UMA linha do pedido.
 *
 * selection = { qty, sizeId, options: { [groupId]: [optionId, ...] }, notes }
 *
 * Devolve { ok, errors, unitCents, totalCents, line } — `line`
 * é o retrato gravado no pedido (nome, opções e preços da
 * hora da venda), para que mudar o cardápio depois não
 * altere pedidos antigos.
 */
export const quoteLine = (product, groupsById, selection, ctx = {}) => {
    const errors = [];

    const availability = productAvailability(product, ctx);
    if (!availability.ok) errors.push(`${product?.name || "Produto"}: ${availability.reason}`);

    const qty = clampInt(selection?.qty, 1, 99, 1);

    const sizes = sizesOf(product);
    let size = null;

    if (sizes.length) {
        size = sizes.find((item) => item.id === selection?.sizeId) || null;
        if (!size) errors.push(`Escolha o tamanho de ${product?.name || "produto"}.`);
        else if (size.available === false) errors.push(`O tamanho ${size.name} está indisponível.`);
    }

    let base = size ? cents(size.priceCents) : effectivePriceCents(product);
    let extras = 0;

    const chosenOptions = [];
    const groups = groupsOf(product, groupsById);
    const picked = selection?.options && typeof selection.options === "object" ? selection.options : {};

    groups.forEach((group) => {
        const ids = [...new Set(asList(picked[group.id]).map(String))];
        const options = optionsOf(group);
        const min = clampInt(group.min, 0, 50, 0);
        const max = clampInt(group.max, 0, 50, 0);

        if (ids.length < min) {
            errors.push(min === 1 ? `Escolha uma opção em "${group.name}".` : `Escolha pelo menos ${min} em "${group.name}".`);
        }
        if (max > 0 && ids.length > max) {
            errors.push(`Escolha no máximo ${max} em "${group.name}".`);
        }

        const selected = [];

        ids.forEach((id) => {
            const option = options.find((item) => item.id === id);
            if (!option) {
                errors.push(`Uma opção de "${group.name}" não existe mais.`);
                return;
            }
            if (option.available === false) {
                errors.push(`"${option.name}" está indisponível.`);
                return;
            }
            selected.push(option);
        });

        if (group.kind === "flavor" && selected.length) {
            const prices = selected.map((option) => optionPrice(option, size?.id));
            if (prices.some((value) => value > 0)) {
                const known = prices.map((value) => (value > 0 ? value : base));
                base = group.flavorPricing === "average"
                    ? Math.round(known.reduce((sum, value) => sum + value, 0) / known.length)
                    : Math.max(...known);
            }
            selected.forEach((option) => {
                chosenOptions.push({
                    groupId: group.id,
                    groupName: text(group.name, 60),
                    kind: "flavor",
                    optionId: option.id,
                    name: text(option.name, 80),
                    priceCents: 0,
                    fraction: `1/${selected.length}`
                });
            });
            return;
        }

        selected.forEach((option) => {
            const price = optionPrice(option, size?.id);
            extras += price;
            chosenOptions.push({
                groupId: group.id,
                groupName: text(group.name, 60),
                kind: group.kind || "addon",
                optionId: option.id,
                name: text(option.name, 80),
                priceCents: price
            });
        });
    });

    /* Grupos que o produto não usa são ignorados (não somam). */

    const unitCents = base + extras;
    const notes = text(selection?.notes, 140);

    return {
        ok: errors.length === 0,
        errors,
        unitCents,
        totalCents: unitCents * qty,
        line: {
            productId: product?.id || selection?.productId || null,
            name: text(product?.name, 80),
            sku: text(product?.sku, 30) || null,
            categoryId: product?.categoryId || null,
            sizeId: size?.id || null,
            sizeName: size ? text(size.name, 40) : null,
            options: chosenOptions,
            qty,
            unitCents,
            totalCents: unitCents * qty,
            notes: notes || null,
            prepMinutes: clampInt(product?.prepMinutes, 0, 600, 0) || null
        }
    };
};

/** Várias linhas contra o catálogo. */
export const quoteLines = (catalog, lines, ctx = {}) => {
    const products = asMap(catalog?.products);
    const groups = asMap(catalog?.optionGroups);

    const quoted = asList(lines).slice(0, 60).map((selection) => {
        const id = String(selection?.productId || "");
        const product = products[id] ? { ...products[id], id } : null;
        if (!product) {
            return { ok: false, errors: ["Um produto do pedido não existe mais."], unitCents: 0, totalCents: 0, line: null, selection };
        }
        return { ...quoteLine(product, groups, selection, ctx), selection };
    });

    const errors = quoted.flatMap((item) => item.errors);

    return {
        ok: quoted.length > 0 && errors.length === 0,
        errors: quoted.length ? errors : ["O pedido está vazio."],
        lines: quoted,
        subtotalCents: quoted.reduce((sum, item) => sum + (item.ok ? item.totalCents : 0), 0)
    };
};

/** Descrição curta das opções: "Grande · ½ Calabresa, ½ Marguerita · Borda de catupiry". */
export const describeLine = (line) => {
    if (!line) return "";
    const flavors = asList(line.options).filter((option) => option.kind === "flavor");
    const others = asList(line.options).filter((option) => option.kind !== "flavor");
    const parts = [];
    if (line.sizeName) parts.push(line.sizeName);
    if (flavors.length) {
        parts.push(flavors.map((option) => (flavors.length > 1 ? `${option.fraction} ${option.name}` : option.name)).join(", "));
    }
    if (others.length) parts.push(others.map((option) => option.name).join(", "));
    return parts.join(" · ");
};
