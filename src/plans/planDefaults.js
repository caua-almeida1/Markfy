/* =========================================================
   PLANOS MARKFY — MODELO E PADRÕES

   Dois nós no Realtime Database:

     planCatalog/{planId}   o que cada plano oferece (leitura
                            pública; só a conta master grava,
                            pela tela Master Dev)
     licenses/{handle}      o plano de UMA EMPRESA (só a conta
                            master e o backend gravam)

   O plano é da EMPRESA, nunca da pessoa. Quem troca é o
   administrador principal (papel "master" em
   companys/{handle}/members) — e mesmo ele só chega ao
   pagamento: quem grava a licença é a Cloud Function que
   confirma o pagamento no Mercado Pago, ou a conta master.

   Este arquivo tem o catálogo PADRÃO. Enquanto o catálogo
   não existir no banco, a tela mostra estes valores; a
   Master Dev publica o catálogo no primeiro acesso, e a
   partir daí tudo (preço, limites, recursos) é editável lá.

   ATENÇÃO: os preços abaixo são marcadores. Ajuste-os na
   Master Dev antes de abrir a cobrança.

   Produtos, pacotes, preço por produto e os recursos do
   Markfy Menus vêm de src/menus/engine/licensing.js — a
   MESMA regra que o backend usa para cobrar e liberar.
========================================================= */

import {
    bundleProductsOf,
    bundleSavings as engineBundleSavings,
    licenseProductFor,
    MENUS_FEATURE_DEFAULTS,
    MENUS_LIMIT_DEFAULTS,
    planFeature,
    planPriceFor,
    productIncludes,
    productsOf,
    PRODUCT_IDS
} from "../menus/engine/licensing.js";

export { productsOf, licenseProductFor, PRODUCT_IDS };

/* ---------- PRODUTOS ---------- */

export const PRODUCT_LABELS = {
    bookings: "Markfy Bookings",
    studio: "Markfy Studio",
    menus: "Markfy Menus",
    both: "Bookings + Studio",
    all: "Bookings + Studio + Menus"
};

export const PRODUCT_SHORT = { bookings: "Bookings", studio: "Studio", menus: "Menus" };

export const PRODUCT_ICONS = {
    bookings: "solar:calendar-bold",
    studio: "solar:pallete-2-bold",
    menus: "solar:chef-hat-bold"
};

/** "Bookings + Studio + Menus" a partir de qualquer valor de licença. */
export const productLabel = (product) =>
    PRODUCT_LABELS[product] || productsOf(product).map((id) => PRODUCT_SHORT[id]).join(" + ") || "";

/* ---------- RECURSOS (liga/desliga por plano) ----------
   Só entra aqui o que o app de fato bloqueia. */

export const FEATURES = [
    {
        id: "onlinePayments",
        label: "Pagamentos online (Pix e cartão)",
        hint: "Conectar o Mercado Pago e cobrar pelo agendamento.",
        product: "bookings"
    },
    {
        id: "monthlyPlans",
        label: "Mensalidades e assinaturas",
        hint: "Criar produtos de cobrança recorrente para clientes.",
        product: "bookings"
    },
    {
        id: "studioAnalytics",
        label: "Analytics do Studio",
        hint: "Visitas, cliques e conversão da página publicada.",
        product: "studio"
    },
    {
        id: "menusOrdering",
        label: "Pedidos pelo cardápio digital",
        hint: "Retirada, entrega e pedidos pelo QR da mesa. Pedidos ilimitados.",
        product: "menus"
    },
    {
        id: "menusTables",
        label: "Mesas e comandas",
        hint: "Mapa do salão, comandas, divisão de conta e fechamento.",
        product: "menus"
    },
    {
        id: "menusPos",
        label: "PDV, cozinha e painel de pedidos",
        hint: "Balcão, tela da cozinha e quadro de pedidos por status.",
        product: "menus"
    },
    {
        id: "menusAdvancedDesign",
        label: "Todos os modelos e personalização avançada",
        hint: "Os 16 modelos, fontes, cores e disposição livres.",
        product: "menus"
    },
    {
        id: "menusStock",
        label: "Controle de estoque",
        hint: "Quantidade, estoque mínimo e baixa automática por pedido.",
        product: "menus"
    },
    {
        id: "menusReports",
        label: "Relatórios avançados",
        hint: "Produtos, horários, canais, pagamentos e exportação.",
        product: "menus"
    },
    {
        id: "menusIntegrations",
        label: "Integrações com canais de venda",
        hint: "Conectores com iFood, 99Food, Keeta e outros, à medida que forem liberados.",
        product: "menus"
    },
    {
        id: "menusCustomDomain",
        label: "Domínio próprio",
        hint: "Cardápio no endereço da sua marca (configuração assistida).",
        product: "menus"
    }
];

const MENUS_FEATURES = new Set(Object.keys(MENUS_FEATURE_DEFAULTS.premium));

/* ---------- LIMITES (número, ou vazio = ilimitado) ---------- */

export const LIMITS = [
    {
        id: "maxMembers",
        label: "Pessoas na equipe",
        hint: "Administrador principal + profissionais.",
        unit: "pessoas",
        product: "bookings"
    },
    {
        id: "maxProducts",
        label: "Serviços e produtos no catálogo",
        hint: "Itens ativos no catálogo da empresa.",
        unit: "itens",
        product: "bookings"
    },
    {
        id: "menusMaxTables",
        label: "Mesas cadastradas",
        hint: "Mesas na planta do Markfy Menus. Pedidos são sempre ilimitados.",
        unit: "mesas",
        product: "menus"
    }
];

export const PLAN_COLORS = ["#fb923c", "#22d3ee", "#4160ff", "#c084fc", "#34d399", "#f472b6"];

/* ---------- CATÁLOGO PADRÃO ---------- */

export const DEFAULT_PLANS = {
    basic: {
        name: "Básico",
        tier: "Nível 1",
        tagline: "O essencial para começar a agendar.",
        price: 29.9,
        periodDays: 30,
        bundle: false,
        highlight: false,
        active: true,
        order: 1,
        color: "#fb923c",
        limits: { maxMembers: 2, maxProducts: 10 },
        features: { onlinePayments: false, monthlyPlans: false, studioAnalytics: false, ...MENUS_FEATURE_DEFAULTS.basic }
    },
    standard: {
        name: "Comum",
        tier: "Nível 2",
        tagline: "Para quem atende todo dia com equipe pequena.",
        price: 59.9,
        periodDays: 30,
        bundle: false,
        highlight: false,
        active: true,
        order: 2,
        color: "#22d3ee",
        limits: { maxMembers: 5, maxProducts: 40, ...MENUS_LIMIT_DEFAULTS.standard },
        features: { onlinePayments: true, monthlyPlans: false, studioAnalytics: false, ...MENUS_FEATURE_DEFAULTS.standard }
    },
    pro: {
        name: "Pro",
        tier: "Nível 3",
        tagline: "Bookings e Studio juntos, num único pacote.",
        price: 99.9,
        periodDays: 30,
        bundle: true,
        bundleProducts: ["bookings", "studio"],
        highlight: false,
        active: true,
        order: 3,
        color: "#4160ff",
        limits: { maxMembers: 15, maxProducts: 150 },
        features: { onlinePayments: true, monthlyPlans: true, studioAnalytics: true }
    },
    premium: {
        name: "Premium",
        tier: "Nível 4",
        tagline: "Studio, Bookings e Menus juntos, com tudo liberado.",
        price: 179.9,
        periodDays: 30,
        bundle: true,
        bundleProducts: ["bookings", "studio", "menus"],
        highlight: true,
        active: true,
        order: 4,
        color: "#c084fc",
        limits: { maxMembers: 50, maxProducts: 500 },
        features: { onlinePayments: true, monthlyPlans: true, studioAnalytics: true, ...MENUS_FEATURE_DEFAULTS.premium }
    }
};


/* ---------- NORMALIZAÇÃO ---------- */

const toNumberOrNull = (value) => {
    /* Number(null) e Number("") dão 0: sem esta guarda, "ilimitado"
       (campo ausente) virava "0 pessoas" / "0 itens". */
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
};

/** Devolve um plano completo e seguro a partir do que veio do banco. */
export const normalizePlan = (id, raw) => {

    const source = raw || {};
    const features = {};

    FEATURES.forEach((feature) => {
        /* Recursos do Menus ausentes num catálogo publicado antes
           dele valem o padrão do plano (mesma regra do backend). */
        features[feature.id] = MENUS_FEATURES.has(feature.id)
            ? planFeature(id, source, feature.id)
            : source.features?.[feature.id] === true;
    });

    const limits = {};

    LIMITS.forEach((limit) => {
        const value = toNumberOrNull(source.limits?.[limit.id]);

        /* Limite 0 nunca é intencional (equipe de 0 pessoas?): é dado
           ruim. Cai no valor padrão do plano, quando há um. */
        limits[limit.id] = value === 0
            ? (DEFAULT_PLANS[id]?.limits?.[limit.id] ?? null)
            : value;
    });

    return {
        id,
        name: String(source.name || id),
        tier: String(source.tier || ""),
        tagline: String(source.tagline || ""),
        price: toNumberOrNull(source.price) ?? 0,
        periodDays: Math.max(1, Math.round(toNumberOrNull(source.periodDays) ?? 30)),
        bundle: source.bundle === true,
        bundleProducts: source.bundle === true ? bundleProductsOf(id, source) : [],
        productPrices: {
            menus: toNumberOrNull(source.productPrices?.menus)
        },
        highlight: source.highlight === true,
        active: source.active !== false,
        order: toNumberOrNull(source.order) ?? 99,
        color: /^#[0-9a-f]{6}$/i.test(source.color || "") ? source.color : "#4160ff",
        limits,
        features
    };
};

/** Catálogo (objeto do banco ou null) → lista ordenada de planos. */
export const buildCatalog = (raw) => {

    const source = raw && Object.keys(raw).length ? raw : DEFAULT_PLANS;

    return Object.entries(source)
        .map(([id, plan]) => normalizePlan(id, plan))
        .sort((a, b) => a.order - b.order);
};

/** Formato gravado no banco (sem undefined, sem campos vazios). */
export const serializePlan = (plan) => {

    const limits = {};

    LIMITS.forEach((limit) => {
        const value = toNumberOrNull(plan.limits?.[limit.id]);
        if (value !== null) limits[limit.id] = value;
    });

    const features = {};

    FEATURES.forEach((feature) => {
        features[feature.id] = plan.features?.[feature.id] === true;
    });

    return {
        name: plan.name.trim().slice(0, 40),
        tier: (plan.tier || "").trim().slice(0, 30),
        tagline: (plan.tagline || "").trim().slice(0, 140),
        price: Math.round((toNumberOrNull(plan.price) ?? 0) * 100) / 100,
        periodDays: Math.max(1, Math.round(toNumberOrNull(plan.periodDays) ?? 30)),
        bundle: plan.bundle === true,
        ...(plan.bundle === true ? { bundleProducts: bundleProductsOf(plan.id, plan) } : {}),
        ...(toNumberOrNull(plan.productPrices?.menus)
            ? { productPrices: { menus: Math.round(toNumberOrNull(plan.productPrices.menus) * 100) / 100 } }
            : {}),
        highlight: plan.highlight === true,
        active: plan.active !== false,
        order: toNumberOrNull(plan.order) ?? 99,
        color: plan.color,
        limits,
        features
    };
};

export const formatPrice = (value) =>
    Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const describeLimit = (limit, value) =>
    value === null || value === undefined
        ? `${limit.label}: ilimitado`
        : `Até ${value} ${limit.unit}`;


/* ---------- LICENÇA ----------

   Estados: "none" (sem licença), "suspended", "expired", "active".
   Só "active" libera alguma coisa. */

export const licenseState = (license, now = Date.now()) => {

    if (!license || !license.plan) return "none";
    if (license.status === "suspended") return "suspended";
    if (license.expiresAt && Number(license.expiresAt) < now) return "expired";

    return "active";
};

export const productAllows = (product, wanted) => productIncludes(product, wanted);

/** Produtos que um plano libera (pacote) ou pode liberar (individual). */
export const planProducts = (plan) => (plan?.bundle ? bundleProductsOf(plan.id, plan) : PRODUCT_IDS);

/** Preço do plano para o produto escolhido (individual) ou do pacote. */
export const priceFor = (plan, product) => planPriceFor(plan, product);

/** Economia real do pacote frente aos planos individuais do catálogo. */
export const bundleSavings = (plan, catalog) => engineBundleSavings(plan?.id, plan, catalog);

/** Recursos e limites que fazem sentido para um conjunto de produtos. */
export const featuresFor = (products) => FEATURES.filter((feature) => products.includes(feature.product));

export const limitsFor = (products) =>
    LIMITS.filter((limit) => products.includes(limit.product) || limit.id === "maxMembers");
