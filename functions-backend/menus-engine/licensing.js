/* =========================================================
   PRODUTOS E PLANOS — REGRAS COMPARTILHADAS

   A licença da empresa (licenses/{handle}) continua com UM
   campo "product". Valores aceitos:

     "bookings" | "studio" | "menus"   um produto
     "both"                            Bookings + Studio (legado e plano Pro)
     "all"                             Bookings + Studio + Menus (Premium)

   Este arquivo é a ÚNICA definição de:
     - quais produtos cada valor libera;
     - quais produtos um plano em pacote reúne;
     - quanto custa um plano para cada produto;
     - quais recursos do Menus cada plano libera por padrão.

   Usado pelo front (src/plans/planDefaults.js) e pelo backend
   (cópia em functions-backend/menus-engine), então a tela de
   planos, a Home, o painel e a cobrança não divergem.
========================================================= */

export const PRODUCT_IDS = ["bookings", "studio", "menus"];

export const productsOf = (product) => {
    if (product === "all") return [...PRODUCT_IDS];
    if (product === "both") return ["bookings", "studio"];
    return PRODUCT_IDS.includes(product) ? [product] : [];
};

export const productIncludes = (product, wanted) => productsOf(product).includes(wanted);

/** Lista de produtos → valor gravado na licença (ou null se a combinação não existe). */
export const productKeyFor = (list) => {
    const set = new Set((list || []).filter((id) => PRODUCT_IDS.includes(id)));
    if (set.size === 3) return "all";
    if (set.size === 2 && set.has("bookings") && set.has("studio")) return "both";
    if (set.size === 1) return [...set][0];
    return null;
};

/* ---------- PACOTES ----------
   Planos com bundle: true reúnem produtos fixos. Catálogos
   publicados antes do Menus não têm "bundleProducts": vale
   o padrão do id do plano e, sem padrão, Bookings + Studio
   (o comportamento antigo). */

export const DEFAULT_BUNDLES = {
    pro: ["bookings", "studio"],
    premium: ["bookings", "studio", "menus"]
};

export const bundleProductsOf = (planId, plan) => {
    const raw = plan?.bundleProducts;
    const list = (Array.isArray(raw) ? raw : raw && typeof raw === "object" ? Object.values(raw) : [])
        .filter((id) => PRODUCT_IDS.includes(id));

    if (productKeyFor(list)) return list;
    return DEFAULT_BUNDLES[planId] || ["bookings", "studio"];
};

/** Produto final gravado na licença ao contratar `plan` escolhendo `chosen`. */
export const licenseProductFor = (planId, plan, chosen) =>
    plan?.bundle === true
        ? productKeyFor(bundleProductsOf(planId, plan))
        : PRODUCT_IDS.includes(chosen) ? chosen : null;

/* ---------- PREÇO POR PRODUTO ----------
   Planos individuais podem ter preço diferente por produto
   (plan.productPrices.{produto}). Sem valor gravado, o Menus
   segue a regra comercial interna da Markfy sobre o preço de
   referência do mesmo nível. A regra é interna: as telas só
   mostram o preço final. */

const MENUS_PRICE_FACTOR = 1.2;

const roundMoney = (value) => Math.round(Number(value) * 100) / 100;

export const defaultProductPrice = (basePrice, product) =>
    product === "menus" ? roundMoney(Number(basePrice || 0) * MENUS_PRICE_FACTOR) : roundMoney(basePrice || 0);

export const planPriceFor = (plan, product) => {
    if (!plan) return 0;
    if (plan.bundle === true) return roundMoney(plan.price || 0);

    const override = Number(plan.productPrices?.[product]);
    if (Number.isFinite(override) && override > 0) return roundMoney(override);

    return defaultProductPrice(plan.price, product);
};

/* ---------- RECURSOS DO MENUS ----------
   Matriz inicial (editável na Master Dev, por plano).
   Recurso ausente no catálogo publicado = vale o padrão do
   plano; recurso gravado como false continua false. */

export const MENUS_FEATURE_IDS = [
    "menusOrdering",
    "menusTables",
    "menusPos",
    "menusAdvancedDesign",
    "menusStock",
    "menusReports",
    "menusIntegrations",
    "menusCustomDomain"
];

export const MENUS_FEATURE_DEFAULTS = {
    basic: {
        menusOrdering: false,
        menusTables: false,
        menusPos: false,
        menusAdvancedDesign: false,
        menusStock: false,
        menusReports: false,
        menusIntegrations: false,
        menusCustomDomain: false
    },
    standard: {
        menusOrdering: true,
        menusTables: true,
        menusPos: true,
        menusAdvancedDesign: true,
        menusStock: false,
        menusReports: false,
        menusIntegrations: false,
        menusCustomDomain: false
    },
    pro: {},
    premium: {
        menusOrdering: true,
        menusTables: true,
        menusPos: true,
        menusAdvancedDesign: true,
        menusStock: true,
        menusReports: true,
        menusIntegrations: true,
        menusCustomDomain: true
    }
};

/* Limites do Menus para o catálogo padrão. Pedidos NÃO têm
   limite em nenhum plano: o que varia é a quantidade de mesas
   cadastradas. */
export const MENUS_LIMIT_DEFAULTS = {
    standard: { menusMaxTables: 40 }
};

export const planFeature = (planId, plan, feature) => {
    const raw = plan?.features?.[feature];
    if (raw === true || raw === false) return raw;
    return MENUS_FEATURE_DEFAULTS[planId]?.[feature] === true;
};

/** Limite numérico. Ausente ou vazio = ilimitado (mesma
    convenção dos outros limites do catálogo de planos). */
export const planLimit = (planId, plan, key) => {
    const raw = plan?.limits?.[key];
    if (raw === undefined || raw === null || raw === "") return null;
    const number = Number(raw);
    return Number.isFinite(number) && number >= 0 ? number : null;
};

/* ---------- LICENÇA ---------- */

export const licenseActive = (license, now = Date.now()) =>
    Boolean(
        license &&
        license.plan &&
        license.status !== "suspended" &&
        (!license.expiresAt || Number(license.expiresAt) > now)
    );

/** Espelho público mínimo (publicAccess/{handle}). */
export const publicAccessFor = (license, now = Date.now()) => {
    const active = Boolean(license) && license.status === "active" && (!license.expiresAt || Number(license.expiresAt) > now);
    return {
        bookings: active && productIncludes(license.product, "bookings"),
        studio: active && productIncludes(license.product, "studio"),
        menus: active && productIncludes(license.product, "menus"),
        expiresAt: license?.expiresAt || null
    };
};

/**
 * Economia de um pacote frente à contratação separada.
 * Referência: para cada produto do pacote, o plano individual
 * ATIVO mais completo (maior preço) daquele produto. Sem
 * referência para algum produto, não há comparação honesta.
 */
export const bundleSavings = (planId, plan, catalog) => {
    if (!plan || plan.bundle !== true) return null;

    const singles = (catalog || []).filter((item) => item && item.active !== false && item.bundle !== true);
    const products = bundleProductsOf(planId, plan);

    const parts = [];

    for (const product of products) {
        let best = null;
        singles.forEach((single) => {
            const price = planPriceFor(single, product);
            if (price > 0 && (!best || price > best.price)) best = { planId: single.id, planName: single.name, price };
        });
        if (!best) return null;
        parts.push({ product, ...best });
    }

    const separate = roundMoney(parts.reduce((sum, part) => sum + part.price, 0));
    const price = roundMoney(plan.price || 0);

    if (!(separate > price) || price <= 0) return { separate, price, saving: 0, percent: 0, parts };

    const saving = roundMoney(separate - price);

    return {
        separate,
        price,
        saving,
        percent: Math.floor((saving / separate) * 100),
        parts
    };
};
