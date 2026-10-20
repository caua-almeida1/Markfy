import { createMemoryDb } from "../engine/memoryDb.js";
import { resolveContext, runAction } from "../engine/actions.js";
import { designFromTemplate } from "../engine/design.js";
import { MENUS_FEATURE_DEFAULTS } from "../engine/licensing.js";
import { coverArt, foodArt, logoArt } from "./art.js";

/* =========================================================
   EMPRESA DE DEMONSTRAÇÃO — "Cantina Aurora" (fictícia)

   Tudo aqui vive só na memória do navegador. Pedidos,
   pagamentos e alterações feitos na demonstração somem ao
   recarregar e nunca tocam o banco real. A operação inicial
   (mesas ocupadas, pedidos na cozinha, duas semanas de
   vendas) é criada rodando as MESMAS ações do servidor, então
   os números do painel são calculados de verdade.
========================================================= */

export const DEMO_HANDLE = "demo-cantina-aurora";

export const DEMO_TEAM = {
    "demo-owner": { name: "Você (proprietário)", memberRole: "master" },
    "demo-ana": { name: "Ana Souza", memberRole: "professional", role: "waiter" },
    "demo-bruno": { name: "Bruno Lima", memberRole: "professional", role: "waiter" },
    "demo-carla": { name: "Carla Mendes", memberRole: "professional", role: "cashier" },
    "demo-diego": { name: "Diego Rocha", memberRole: "professional", role: "kitchen" },
    "demo-eva": { name: "Eva Martins", memberRole: "professional", role: "delivery" },
    "demo-fabio": { name: "Fábio Nunes", memberRole: "professional", role: "manager" }
};

const ORANGE = ["#ffc078", "#e8590c"];
const RED = ["#ffa8a8", "#c92a2a"];
const GREEN = ["#b2f2bb", "#2b8a3e"];
const BROWN = ["#e9c8a8", "#7a4a2a"];
const BLUE = ["#a5d8ff", "#1c7ed6"];
const PINK = ["#fcc2d7", "#c2255c"];
const YELLOW = ["#ffe066", "#f08c00"];

const product = (id, data) => [id, { published: true, available: true, order: 0, ...data }];

export const demoCatalog = () => {
    const products = Object.fromEntries([
        product("bruschetta", { categoryId: "entradas", order: 0, name: "Bruschetta de tomate", description: "Pão de fermentação natural, tomate confitado, manjericão e azeite.", priceCents: 2490, image: foodArt("🥖", ...ORANGE), prepMinutes: 10, allergens: ["Glúten"], dietTags: ["vegetarian"], sku: "ENT-01" }),
        product("batata", { categoryId: "entradas", order: 1, name: "Batata rústica", description: "Batatas com casca, alecrim e alho assado. Porção para dois.", priceCents: 2290, image: foodArt("🍟", ...YELLOW), prepMinutes: 15, optionGroupIds: ["extrasBatata"], dietTags: ["vegan", "gluten_free"], sku: "ENT-02" }),
        product("bolinho", { categoryId: "entradas", order: 2, name: "Bolinho de bacalhau", description: "Seis unidades, com aioli da casa.", priceCents: 3290, image: foodArt("🧆", ...BROWN), prepMinutes: 15, allergens: ["Peixe", "Ovo", "Glúten"], sku: "ENT-03" }),

        product("pizza", { categoryId: "pizzas", order: 0, name: "Pizza da casa", description: "Massa de longa fermentação assada no forno a lenha. Escolha até 2 sabores.", sizes: [{ id: "m", name: "Média (6 fatias)", priceCents: 4990 }, { id: "g", name: "Grande (8 fatias)", priceCents: 6490 }, { id: "gg", name: "Gigante (12 fatias)", priceCents: 7990 }], optionGroupIds: ["sabores", "borda"], image: foodArt("🍕", ...RED), prepMinutes: 25, tags: { featured: true }, allergens: ["Glúten", "Lactose"], sku: "PIZ-01" }),
        product("calzone", { categoryId: "pizzas", order: 1, name: "Calzone de presunto e queijo", description: "Massa fechada, presunto, muçarela e orégano.", priceCents: 4490, image: foodArt("🥟", ...ORANGE), prepMinutes: 20, allergens: ["Glúten", "Lactose"], sku: "PIZ-02" }),

        product("classico", { categoryId: "burgers", order: 0, name: "Burger clássico", description: "Blend de 160 g, queijo prato, alface, tomate e molho da casa no pão brioche.", priceCents: 3290, image: foodArt("🍔", ...ORANGE), prepMinutes: 18, optionGroupIds: ["ponto", "extrasBurger"], tags: { featured: true }, allergens: ["Glúten", "Lactose", "Ovo"], sku: "BUR-01" }),
        product("duplo", { categoryId: "burgers", order: 1, name: "Duplo cheddar", description: "Dois blends de 120 g, cheddar cremoso e cebola caramelizada.", priceCents: 3990, image: foodArt("🍔", ...YELLOW), prepMinutes: 20, optionGroupIds: ["ponto", "extrasBurger"], allergens: ["Glúten", "Lactose"], sku: "BUR-02" }),
        product("vegano", { categoryId: "burgers", order: 2, name: "Burger de grão-de-bico", description: "Hambúrguer vegetal, picles, rúcula e maionese de ervas.", priceCents: 3490, image: foodArt("🥬", ...GREEN), prepMinutes: 16, dietTags: ["vegan"], tags: { new: true }, allergens: ["Glúten"], sku: "BUR-03" }),

        product("parmegiana", { categoryId: "pratos", order: 0, name: "Filé à parmegiana", description: "Filé empanado, molho de tomate, muçarela gratinada, arroz e fritas. Serve 2.", priceCents: 8990, image: foodArt("🍝", ...RED), prepMinutes: 30, allergens: ["Glúten", "Lactose", "Ovo"], sku: "PRA-01" }),
        product("risoto", { categoryId: "pratos", order: 1, name: "Risoto de cogumelos", description: "Arbóreo, mix de cogumelos frescos e parmesão.", priceCents: 5290, image: foodArt("🍄", ...BROWN), prepMinutes: 25, dietTags: ["vegetarian", "gluten_free"], allergens: ["Lactose"], sku: "PRA-02" }),
        product("salmao", { categoryId: "pratos", order: 2, name: "Salmão grelhado", description: "Com legumes na manteiga e purê de batata-baroa.", priceCents: 6890, image: foodArt("🐟", ...BLUE), prepMinutes: 25, dietTags: ["gluten_free"], allergens: ["Peixe", "Lactose"], sku: "PRA-03" }),

        product("refri", { categoryId: "bebidas", order: 0, name: "Refrigerante lata", description: "350 ml.", priceCents: 700, image: foodArt("🥤", ...RED), optionGroupIds: ["sabRefri"], sku: "BEB-01" }),
        product("suco", { categoryId: "bebidas", order: 1, name: "Suco natural", description: "500 ml, feito na hora.", priceCents: 1200, image: foodArt("🍹", ...YELLOW), optionGroupIds: ["fruta", "acucar"], dietTags: ["vegan"], sku: "BEB-02" }),
        product("agua", { categoryId: "bebidas", order: 2, name: "Água mineral", description: "500 ml, com ou sem gás.", priceCents: 500, image: foodArt("💧", ...BLUE), sku: "BEB-03" }),
        product("cerveja", { categoryId: "bebidas", order: 3, name: "Cerveja long neck", description: "355 ml. Venda proibida para menores de 18 anos.", priceCents: 1290, image: foodArt("🍺", ...YELLOW), sku: "BEB-04" }),
        product("caipirinha", { categoryId: "bebidas", order: 4, name: "Caipirinha", description: "Limão, cachaça artesanal e açúcar. Peça a sua de fruta da estação.", priceCents: 2490, image: foodArt("🍸", ...GREEN), sku: "BEB-05" }),

        product("petit", { categoryId: "sobremesas", order: 0, name: "Petit gâteau", description: "Com sorvete de creme.", priceCents: 2690, image: foodArt("🍫", ...BROWN), prepMinutes: 12, allergens: ["Glúten", "Lactose", "Ovo"], sku: "SOB-01" }),
        product("pudim", { categoryId: "sobremesas", order: 1, name: "Pudim de leite", description: "A receita da avó, com calda de caramelo.", priceCents: 1490, image: foodArt("🍮", ...YELLOW), allergens: ["Lactose", "Ovo"], sku: "SOB-02" }),
        product("tiramisu", { categoryId: "sobremesas", order: 2, name: "Tiramisù", description: "Mascarpone, café e cacau.", priceCents: 2290, image: foodArt("🍰", ...PINK), tags: { new: true }, allergens: ["Glúten", "Lactose", "Ovo"], sku: "SOB-03" }),

        product("executivo", { categoryId: "executivos", order: 0, name: "Executivo do dia", description: "Arroz, feijão, salada e a proteína que você escolher.", priceCents: 3290, image: foodArt("🍛", ...ORANGE), prepMinutes: 15, optionGroupIds: ["proteina"], schedule: { days: [1, 2, 3, 4, 5], from: "11:00", to: "15:00" }, sku: "EXE-01" }),
        product("salada", { categoryId: "executivos", order: 1, name: "Salada completa", description: "Folhas, grãos, legumes assados e molho de iogurte.", priceCents: 2890, image: foodArt("🥗", ...GREEN), dietTags: ["vegetarian"], allergens: ["Lactose"], sku: "EXE-02" })
    ]);

    return {
        menus: {
            principal: { name: "Cardápio principal", description: "Todos os dias", order: 0, active: true },
            almoco: { name: "Almoço executivo", description: "Segunda a sexta, 11h às 15h", order: 1, active: true }
        },
        categories: {
            entradas: { menuId: "principal", name: "Entradas", order: 0, icon: "🥖" },
            pizzas: { menuId: "principal", name: "Pizzas", description: "Forno a lenha, até dois sabores", order: 1, icon: "🍕" },
            burgers: { menuId: "principal", name: "Hambúrgueres", order: 2, icon: "🍔" },
            pratos: { menuId: "principal", name: "Pratos", order: 3, icon: "🍝" },
            bebidas: { menuId: "principal", name: "Bebidas", order: 4, icon: "🥤" },
            sobremesas: { menuId: "principal", name: "Sobremesas", order: 5, icon: "🍰" },
            executivos: { menuId: "almoco", name: "Executivos", order: 0, icon: "🍛" }
        },
        products,
        optionGroups: {
            sabores: {
                name: "Sabores",
                kind: "flavor",
                min: 1,
                max: 2,
                flavorPricing: "highest",
                options: [
                    { id: "marg", name: "Margherita", priceBySize: { m: 4990, g: 6490, gg: 7990 } },
                    { id: "cala", name: "Calabresa", priceBySize: { m: 4990, g: 6490, gg: 7990 } },
                    { id: "port", name: "Portuguesa", priceBySize: { m: 5490, g: 6990, gg: 8490 } },
                    { id: "quatro", name: "Quatro queijos", priceBySize: { m: 5690, g: 7290, gg: 8790 } },
                    { id: "frango", name: "Frango com catupiry", priceBySize: { m: 5490, g: 6990, gg: 8490 } },
                    { id: "camarao", name: "Camarão", priceBySize: { m: 6990, g: 8990, gg: 10990 } }
                ]
            },
            borda: {
                name: "Borda recheada",
                kind: "addon",
                min: 0,
                max: 1,
                options: [
                    { id: "cat", name: "Catupiry", priceCents: 900 },
                    { id: "ched", name: "Cheddar", priceCents: 900 },
                    { id: "choc", name: "Chocolate", priceCents: 1200 }
                ]
            },
            ponto: {
                name: "Ponto da carne",
                kind: "choice",
                min: 1,
                max: 1,
                options: [
                    { id: "mal", name: "Mal passado", priceCents: 0 },
                    { id: "ponto", name: "Ao ponto", priceCents: 0 },
                    { id: "bem", name: "Bem passado", priceCents: 0 }
                ]
            },
            extrasBurger: {
                name: "Adicionais",
                kind: "addon",
                min: 0,
                max: 4,
                options: [
                    { id: "bacon", name: "Bacon", priceCents: 600 },
                    { id: "queijo", name: "Queijo extra", priceCents: 400 },
                    { id: "ovo", name: "Ovo", priceCents: 300 },
                    { id: "cebola", name: "Cebola crispy", priceCents: 400 }
                ]
            },
            extrasBatata: {
                name: "Cobertura",
                kind: "addon",
                min: 0,
                max: 2,
                options: [
                    { id: "cheddar", name: "Cheddar", priceCents: 600 },
                    { id: "bacon", name: "Bacon", priceCents: 700 }
                ]
            },
            sabRefri: {
                name: "Sabor",
                kind: "choice",
                min: 1,
                max: 1,
                options: [
                    { id: "cola", name: "Cola", priceCents: 0 },
                    { id: "zero", name: "Cola sem açúcar", priceCents: 0 },
                    { id: "guarana", name: "Guaraná", priceCents: 0 }
                ]
            },
            fruta: {
                name: "Fruta",
                kind: "choice",
                min: 1,
                max: 1,
                options: [
                    { id: "laranja", name: "Laranja", priceCents: 0 },
                    { id: "abacaxi", name: "Abacaxi com hortelã", priceCents: 0 },
                    { id: "morango", name: "Morango", priceCents: 300 }
                ]
            },
            acucar: {
                name: "Açúcar",
                kind: "choice",
                min: 0,
                max: 1,
                options: [{ id: "sem", name: "Sem açúcar", priceCents: 0 }]
            },
            proteina: {
                name: "Proteína",
                kind: "choice",
                min: 1,
                max: 1,
                options: [
                    { id: "frango", name: "Frango grelhado", priceCents: 0 },
                    { id: "carne", name: "Bife acebolado", priceCents: 0 },
                    { id: "peixe", name: "Peixe do dia", priceCents: 500 }
                ]
            }
        }
    };
};

const allDay = { enabled: true, ranges: [{ from: "00:00", to: "23:59" }] };

export const demoSettings = () => ({
    profile: {
        name: "Cantina Aurora",
        description: "Cozinha caseira, forno a lenha e um balcão para encontrar os amigos. Empresa fictícia, criada para a demonstração do Markfy Menus."
    },
    contact: { whatsapp: "", phone: "", instagram: "cantina.aurora.demo" },
    address: { text: "Rua das Laranjeiras, 120 · Centro (endereço fictício)" },
    timezone: "America/Sao_Paulo",
    hours: { sunday: allDay, monday: allDay, tuesday: allDay, wednesday: allDay, thursday: allDay, friday: allDay, saturday: allDay },
    mode: "ordering",
    slug: "cantina-aurora-demo",
    fulfillment: {
        pickup: { enabled: true, etaMinutes: 25 },
        delivery: {
            enabled: true,
            feeCents: 600,
            minOrderCents: 3000,
            etaMinutes: 45,
            zones: [
                { id: "centro", name: "Centro", feeCents: 500 },
                { id: "jardins", name: "Jardins", feeCents: 800 },
                { id: "vilanova", name: "Vila Nova", feeCents: 1000 }
            ]
        },
        dineIn: { enabled: true }
    },
    payments: { cash: true, credit: true, debit: true, pix: true, voucher: false, pixKey: "chave-pix-de-demonstracao" },
    ordering: { autoConfirm: false, useAwaitingPickup: true, lateAfterMinutes: 30 },
    tables: { serviceFeePercent: 10, qrOrdering: true, qrCalls: true },
    externalLinks: {},
    onboarding: { completedAt: 1 }
});

const tableRow = (prefix, count, areaId, startX, y, shape, extra = {}) => {
    const tables = {};
    for (let i = 1; i <= count; i += 1) {
        tables[`${areaId}-${i}`] = {
            label: `${prefix}${i}`,
            seats: shape === "bar" ? 2 : shape === "round" ? 2 : i % 3 === 0 ? 6 : 4,
            areaId,
            shape,
            x: startX + ((i - 1) % 4) * 150,
            y: y + Math.floor((i - 1) / 4) * 150,
            w: shape === "rect" ? 130 : 96,
            h: 96,
            order: i,
            ...extra
        };
    }
    return tables;
};

export const demoFloor = () => ({
    areas: {
        salao: { name: "Salão", order: 0 },
        varanda: { name: "Varanda", order: 1 },
        balcao: { name: "Balcão", order: 2 }
    },
    tables: {
        ...tableRow("Mesa ", 8, "salao", 40, 40, "square"),
        ...tableRow("Varanda ", 4, "varanda", 40, 40, "round"),
        ...tableRow("Balcão ", 3, "balcao", 40, 40, "bar")
    },
    version: 1
});

/* Gerador previsível: a demonstração é igual para todos. */
const seeded = (seed) => () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
};

const pick = (random, list) => list[Math.floor(random() * list.length)];

const LINES = [
    [{ productId: "pizza", sizeId: "g", options: { sabores: ["marg", "cala"] } }, { productId: "refri", qty: 2, options: { sabRefri: ["cola"] } }],
    [{ productId: "classico", options: { ponto: ["ponto"], extrasBurger: ["bacon"] } }, { productId: "batata" }, { productId: "cerveja", qty: 2 }],
    [{ productId: "parmegiana" }, { productId: "suco", options: { fruta: ["laranja"] } }],
    [{ productId: "risoto" }, { productId: "agua" }, { productId: "tiramisu" }],
    [{ productId: "duplo", options: { ponto: ["bem"] } }, { productId: "refri", options: { sabRefri: ["guarana"] } }],
    [{ productId: "salmao" }, { productId: "caipirinha" }, { productId: "pudim" }],
    [{ productId: "pizza", sizeId: "gg", options: { sabores: ["camarao", "quatro"], borda: ["cat"] } }, { productId: "cerveja", qty: 4 }]
];

/**
 * Cria o banco em memória já com operação em andamento.
 * Devolve { db, handle }.
 */
export const createDemoDb = async ({ plan = "premium" } = {}) => {
    const now = Date.now();
    const members = {};
    const staff = {};

    Object.entries(DEMO_TEAM).forEach(([uid, person]) => {
        members[uid] = { role: person.memberRole };
        staff[uid] = { name: person.name, ...(person.role ? { role: person.role } : {}) };
    });

    const features = MENUS_FEATURE_DEFAULTS[plan] || MENUS_FEATURE_DEFAULTS.premium;

    const design = designFromTemplate("artesanal", {
        images: { logo: logoArt("A"), cover: coverArt() },
        content: { tagline: "Forno a lenha, cozinha caseira e drinks no balcão", footerNote: "Empresa e preços fictícios — demonstração do Markfy Menus." }
    });

    const db = createMemoryDb({
        companys: { [DEMO_HANDLE]: { name: "Cantina Aurora", members } },
        menusStaff: { [DEMO_HANDLE]: staff },
        licenses: { [DEMO_HANDLE]: { plan, product: plan === "premium" ? "all" : "menus", status: "active", expiresAt: now + 365 * 86400000 } },
        planCatalog: { [plan]: { name: plan, features, limits: plan === "standard" ? { menusMaxTables: 40 } : {} } },
        menusCatalog: { [DEMO_HANDLE]: demoCatalog() },
        menusSettings: { [DEMO_HANDLE]: demoSettings() },
        menusFloor: { [DEMO_HANDLE]: demoFloor() },
        menusDrafts: { [DEMO_HANDLE]: { design, updatedAt: now - 3600000 } },
        menusSites: { [DEMO_HANDLE]: { handle: DEMO_HANDLE, slug: "cantina-aurora-demo", design, publishedAt: now - 3600000 } },
        menusSlugs: { "cantina-aurora-demo": DEMO_HANDLE }
    });

    await seedHistory(db, now);

    /* Estoque entra depois do histórico: as vendas antigas não
       devem zerar os produtos controlados da demonstração. */
    await db.set(`menusStock/${DEMO_HANDLE}`, {
        petit: { track: true, qty: 7, min: 3 },
        bolinho: { track: true, qty: 4, min: 5 },
        tiramisu: { track: true, qty: 12, min: 4 },
        salmao: { track: true, qty: 9, min: 3 }
    });

    await seedLive(db, now);

    return { db, handle: DEMO_HANDLE };
};

const ctxAt = async (db, uid, now) => resolveContext(db, { handle: DEMO_HANDLE, uid, name: uid ? DEMO_TEAM[uid]?.name : null, now });

/* Duas semanas de vendas: mesas fechadas e pedidos online
   concluídos, para relatórios e painel terem o que mostrar. */
const seedHistory = async (db, now) => {
    const random = seeded(42);
    const day = 86400000;
    const tables = Object.keys(demoFloor().tables);

    for (let d = 14; d >= 1; d -= 1) {
        const base = now - d * day;
        const date = new Date(base);
        date.setHours(11, 30, 0, 0);
        const opening = date.getTime();

        const visits = 5 + Math.floor(random() * 6);
        for (let v = 0; v < visits; v += 1) {
            const openedAt = opening + Math.floor(random() * 10 * 3600000);
            const waiter = pick(random, ["demo-ana", "demo-bruno"]);
            const ctx = await ctxAt(db, waiter, openedAt);
            const tableId = tables[(v * 3 + d) % tables.length];
            try {
                const { tabId } = await runAction(db, ctx, "tables.open", { tableId, guests: 1 + Math.floor(random() * 5) });
                await runAction(db, ctx, "tabs.addItems", { tabId, lines: pick(random, LINES), send: true });

                const later = await ctxAt(db, "demo-diego", openedAt + 20 * 60000);
                const tab = await db.get(`menusOps/${DEMO_HANDLE}/tabs/${tabId}`);
                const orderIds = [...new Set(Object.values(tab.items || {}).map((item) => item.orderId).filter(Boolean))];
                for (const orderId of orderIds) {
                    await runAction(db, later, "orders.status", { orderId, to: "completed" });
                }

                const cashier = await ctxAt(db, "demo-carla", openedAt + (55 + Math.floor(random() * 50)) * 60000);
                const fresh = await db.get(`menusOps/${DEMO_HANDLE}/tabs/${tabId}`);
                await runAction(db, cashier, "tabs.pay", {
                    tabId,
                    paymentId: db.newKey(),
                    method: pick(random, ["credit", "debit", "pix", "pix", "cash"]),
                    amountCents: fresh.totals.balanceCents
                });
                await runAction(db, cashier, "tabs.close", { tabId });
            } catch {
                /* Mesa ainda ocupada por outra visita do mesmo dia: pula. */
            }
        }

        const online = 3 + Math.floor(random() * 5);
        for (let o = 0; o < online; o += 1) {
            const at = opening + Math.floor(random() * 11 * 3600000);
            const visitor = await ctxAt(db, null, at);
            const delivery = random() > 0.45;
            try {
                const { orderId } = await runAction(db, visitor, "public.placeOrder", {
                    idempotencyKey: `demo-hist-${d}-${o}`,
                    lines: pick(random, LINES),
                    fulfillment: delivery ? { mode: "delivery", address: "Endereço de demonstração, 100", zoneId: pick(random, ["centro", "jardins", "vilanova"]) } : { mode: "pickup" },
                    customer: { name: pick(random, ["Marina", "Rafael", "Juliana", "Pedro", "Luana", "Tiago"]), phone: "11900000000" },
                    payment: { method: pick(random, ["pix", "credit", "cash"]) }
                });
                const staffCtx = await ctxAt(db, "demo-carla", at + 3 * 60000);
                const cancel = random() < 0.06;
                if (cancel) {
                    const owner = await ctxAt(db, "demo-owner", at + 5 * 60000);
                    await runAction(db, owner, "orders.cancel", { orderId, reason: "Cliente pediu para cancelar" });
                } else {
                    await runAction(db, staffCtx, "orders.status", { orderId, to: "completed" });
                    const order = await db.get(`menusOps/${DEMO_HANDLE}/orders/${orderId}`);
                    await runAction(db, staffCtx, "orders.pay", { orderId, method: order.payment.method || "pix" });
                }
            } catch {
                /* ignora */
            }
        }
    }
};

/* O salão agora: mesas em vários estados, pedidos na cozinha,
   uma conta pedida, um chamado de garçom e pedidos online.
   Cada cena é independente: se uma falhar, as outras seguem. */
const seedLive = async (db, now) => {
    for (const scene of buildScenes(db, now)) {
        try {
            await scene();
        } catch (error) {
            // eslint-disable-next-line no-console
            console.warn("Demonstração: cena ignorada", error?.message);
        }
    }
};

const buildScenes = (db, now) => {
    const min = 60000;
    const at = (uid, offset) => ctxAt(db, uid, now - offset * min);

    const open = async (uid, offset, tableId, guests, lines, send = true) => {
        const ctx = await at(uid, offset);
        const { tabId } = await runAction(db, ctx, "tables.open", { tableId, guests });
        if (lines) await runAction(db, ctx, "tabs.addItems", { tabId, lines, send });
        return tabId;
    };

    const orderOf = async (tabId) => {
        const tab = await db.get(`menusOps/${DEMO_HANDLE}/tabs/${tabId}`);
        return Object.values(tab.items || {}).map((item) => item.orderId).filter(Boolean)[0];
    };

    return [
        async () => {
            /* Mesa 1: comendo, pedido pronto. */
            const tabId = await open("demo-ana", 38, "salao-1", 4, LINES[0]);
            await runAction(db, await at("demo-diego", 20), "orders.status", { orderId: await orderOf(tabId), to: "ready" });
        },
        async () => {
            /* Mesa 2: pedido em preparo. */
            const tabId = await open("demo-bruno", 16, "salao-2", 2, LINES[1]);
            await runAction(db, await at("demo-diego", 9), "orders.status", { orderId: await orderOf(tabId), to: "preparing" });
        },
        async () => {
            /* Mesa 3: pediu a conta. */
            const tabId = await open("demo-ana", 74, "salao-3", 5, LINES[6]);
            await runAction(db, await at("demo-diego", 40), "orders.status", { orderId: await orderOf(tabId), to: "completed" });
            await runAction(db, await at("demo-ana", 3), "tabs.requestBill", { tabId });
        },
        async () => {
            /* Mesa 5: acabou de sentar, itens ainda não enviados. */
            await open("demo-bruno", 4, "salao-5", 3, [{ productId: "agua", qty: 2 }, { productId: "bruschetta" }], false);
        },
        async () => {
            /* Mesa 6: chamou o garçom pelo QR. */
            await open("demo-ana", 25, "salao-6", 2, LINES[3]);
            await runAction(db, await at(null, 2), "public.call", { tableId: "salao-6", type: "waiter" });
        },
        async () => {
            /* Varanda 2: enviado, aguardando cozinha. */
            await open("demo-bruno", 7, "varanda-2", 2, LINES[4]);
        },
        async () => {
            /* Mesa 7 reservada; Mesa 8 em manutenção. */
            await runAction(db, await at("demo-carla", 30), "tables.reserve", { tableId: "salao-7", reservation: { name: "Família Prado", time: "20:30" } });
            await db.update({ [`menusFloor/${DEMO_HANDLE}/tables/salao-8/disabled`]: true });
        },
        async () => {
            /* Pedido online novo, aguardando confirmação. */
            await runAction(db, await at(null, 3), "public.placeOrder", {
                idempotencyKey: "demo-live-1",
                lines: [{ productId: "pizza", sizeId: "m", options: { sabores: ["frango"] } }, { productId: "refri", options: { sabRefri: ["zero"] } }],
                fulfillment: { mode: "delivery", address: "Rua de Exemplo, 45 · ap. 12", zoneId: "jardins" },
                customer: { name: "Helena", phone: "11900000000" },
                payment: { method: "pix" },
                notes: "Sem cebola, por favor"
            });
        },
        async () => {
            /* Retirada em preparo. */
            const order = await runAction(db, await at(null, 22), "public.placeOrder", {
                idempotencyKey: "demo-live-2",
                lines: [{ productId: "classico", options: { ponto: ["mal"] } }, { productId: "batata", options: { extrasBatata: ["cheddar"] } }],
                fulfillment: { mode: "pickup" },
                customer: { name: "Otávio", phone: "11900000000" },
                payment: { method: "credit" }
            });
            await runAction(db, await at("demo-carla", 20), "orders.status", { orderId: order.orderId, to: "preparing" });
        },
        async () => {
            /* Entrega a caminho. */
            const order = await runAction(db, await at(null, 48), "public.placeOrder", {
                idempotencyKey: "demo-live-3",
                lines: [{ productId: "parmegiana" }, { productId: "suco", options: { fruta: ["morango"] } }],
                fulfillment: { mode: "delivery", address: "Avenida Fictícia, 900", zoneId: "centro" },
                customer: { name: "Sofia", phone: "11900000000" },
                payment: { method: "cash" }
            });
            await runAction(db, await at("demo-carla", 45), "orders.status", { orderId: order.orderId, to: "ready" });
            await runAction(db, await at("demo-eva", 10), "orders.status", { orderId: order.orderId, to: "out_for_delivery" });
        },
        async () => {
            /* Balcão: pedido pronto para entregar. */
            const order = await runAction(db, await at("demo-carla", 12), "orders.create", {
                channel: "counter",
                idempotencyKey: "demo-live-4",
                lines: [{ productId: "duplo", options: { ponto: ["ponto"] } }, { productId: "cerveja" }],
                customer: { name: "Balcão" },
                payment: { method: "debit", status: "paid" }
            });
            await runAction(db, await at("demo-diego", 2), "orders.status", { orderId: order.orderId, to: "ready" });
        }
    ];
};
