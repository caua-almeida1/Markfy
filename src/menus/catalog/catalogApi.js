import { clean } from "../engine/util.js";

/* =========================================================
   GRAVAÇÃO DO CATÁLOGO

   Catálogo é gravado direto pelo painel (as regras liberam
   para dono, administrador e gerente; a cozinha só mexe na
   disponibilidade). Toda mudança de preço deixa um registro
   na auditoria — o servidor nunca confia no preço do
   navegador na hora de cobrar, mas o histórico mostra quem
   mudou o quê.
========================================================= */

const priceSignature = (product) =>
    JSON.stringify({
        priceCents: product?.priceCents ?? null,
        promoPriceCents: product?.promoPriceCents ?? null,
        sizes: (product?.sizes || []).map((size) => [size.id, size.priceCents])
    });

export const catalogApi = (source, actor) => {
    const h = source.handle;
    const base = `menusCatalog/${h}`;

    const audit = (type, details) =>
        source.set(`menusAudit/${h}/${source.newKey()}`, {
            type,
            at: Date.now(),
            by: actor?.uid || null,
            byName: actor?.name || null,
            details: clean(details)
        }).catch(() => null);

    return {
        newId: () => source.newKey(),

        saveProduct: async (id, data, previous) => {
            const value = clean({ ...data, updatedAt: Date.now() });
            await source.set(`${base}/products/${id}`, value);
            if (previous && priceSignature(previous) !== priceSignature(value)) {
                await audit("catalog.price_changed", {
                    productId: id,
                    name: value.name,
                    from: JSON.parse(priceSignature(previous)),
                    to: JSON.parse(priceSignature(value))
                });
            }
            return id;
        },

        patchProduct: (id, patch) =>
            source.update(Object.fromEntries(Object.entries(patch).map(([key, value]) => [`${base}/products/${id}/${key}`, value]))),

        setAvailable: (id, available) => source.update({ [`${base}/products/${id}/available`]: Boolean(available) }),

        deleteProduct: async (id, product) => {
            await source.remove(`${base}/products/${id}`);
            await audit("catalog.product_deleted", { productId: id, name: product?.name || null });
        },

        saveCategory: (id, data) => source.set(`${base}/categories/${id}`, clean(data)),

        deleteCategory: (id) => source.remove(`${base}/categories/${id}`),

        saveMenu: (id, data) => source.set(`${base}/menus/${id}`, clean(data)),

        deleteMenu: (id) => source.remove(`${base}/menus/${id}`),

        saveGroup: (id, data) => source.set(`${base}/optionGroups/${id}`, clean(data)),

        deleteGroup: async (id, products) => {
            const patch = { [`${base}/optionGroups/${id}`]: null };
            products
                .filter((product) => (product.optionGroupIds || []).includes(id))
                .forEach((product) => {
                    patch[`${base}/products/${product.id}/optionGroupIds`] = product.optionGroupIds.filter((value) => value !== id);
                });
            await source.update(patch);
        },

        /** Grava a nova ordem de uma lista (categorias, produtos ou cardápios). */
        reorder: (kind, ids) =>
            source.update(Object.fromEntries(ids.map((id, index) => [`${base}/${kind}/${id}/order`, index]))),

        moveProducts: (ids, categoryId) =>
            source.update(Object.fromEntries(ids.map((id) => [`${base}/products/${id}/categoryId`, categoryId])))
    };
};

/** Move um item numa lista (para arrastar e para os botões ↑ ↓). */
export const moveInList = (list, from, to) => {
    const next = [...list];
    const [item] = next.splice(from, 1);
    next.splice(Math.max(0, Math.min(next.length, to)), 0, item);
    return next;
};
