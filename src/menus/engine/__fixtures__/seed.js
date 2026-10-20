import { createMemoryDb } from "../memoryDb.js";

/* Banco de teste com duas empresas (isolamento) e uma equipe
   com perfis diferentes. Horário fixo: sexta 16/10/2026 20:00
   em São Paulo (23:00 UTC). */

export const NOW = Date.UTC(2026, 9, 16, 23, 0, 0);

export const catalog = () => ({
    menus: { main: { name: "Principal", order: 0, active: true } },
    categories: { pizzas: { menuId: "main", name: "Pizzas", order: 0 }, drinks: { menuId: "main", name: "Bebidas", order: 1 } },
    products: {
        pizza: {
            name: "Pizza",
            categoryId: "pizzas",
            sizes: [{ id: "m", name: "Média", priceCents: 4000 }, { id: "g", name: "Grande", priceCents: 5500 }],
            optionGroupIds: ["flavors", "border"]
        },
        soda: { name: "Refrigerante", categoryId: "drinks", priceCents: 700 },
        juice: { name: "Suco", categoryId: "drinks", priceCents: 1200, promoPriceCents: 900 },
        off: { name: "Fora do ar", categoryId: "drinks", priceCents: 500, available: false },
        lunch: { name: "Executivo", categoryId: "drinks", priceCents: 3000, schedule: { days: [1, 2, 3, 4, 5], from: "11:00", to: "15:00" } }
    },
    optionGroups: {
        flavors: {
            name: "Sabores",
            kind: "flavor",
            min: 1,
            max: 2,
            flavorPricing: "highest",
            options: [
                { id: "cal", name: "Calabresa", priceBySize: { m: 4000, g: 5500 } },
                { id: "cam", name: "Camarão", priceBySize: { m: 6000, g: 7500 } }
            ]
        },
        border: { name: "Borda", kind: "addon", min: 0, max: 1, options: [{ id: "cat", name: "Catupiry", priceCents: 800 }] }
    }
});

export const settings = (extra = {}) => ({
    timezone: "America/Sao_Paulo",
    mode: "ordering",
    slug: "pizzaria-teste",
    hours: {
        friday: { enabled: true, ranges: [{ from: "18:00", to: "02:00" }] },
        saturday: { enabled: true, ranges: [{ from: "18:00", to: "02:00" }] }
    },
    fulfillment: {
        pickup: { enabled: true, etaMinutes: 30 },
        delivery: { enabled: true, feeCents: 600, minOrderCents: 2000, etaMinutes: 50, zones: [{ id: "centro", name: "Centro", feeCents: 500 }] },
        dineIn: { enabled: true }
    },
    payments: { cash: true, pix: true, credit: true },
    tables: { serviceFeePercent: 10, qrOrdering: true, qrCalls: true },
    ...extra
});

export const seed = ({ plan = "premium", product = "all", features = undefined, tables = 2 } = {}) => {
    const floorTables = {};
    for (let i = 1; i <= tables; i += 1) floorTables[`t${i}`] = { label: `Mesa ${i}`, seats: 4, areaId: "salao" };

    return createMemoryDb(
        {
            companys: {
                pizzaria: {
                    members: {
                        owner: { role: "master" },
                        admin: { role: "administrator" },
                        waiter: { role: "professional" },
                        cashier: { role: "professional" },
                        kitchen: { role: "professional" },
                        rider: { role: "professional" }
                    }
                },
                outra: { members: { stranger: { role: "master" } } }
            },
            menusStaff: {
                pizzaria: {
                    waiter: { role: "waiter" },
                    cashier: { role: "cashier" },
                    kitchen: { role: "kitchen" },
                    rider: { role: "delivery" }
                }
            },
            licenses: {
                pizzaria: { plan, product, status: "active", expiresAt: NOW + 30 * 86400000 },
                outra: { plan: "premium", product: "all", status: "active", expiresAt: NOW + 30 * 86400000 }
            },
            planCatalog: {
                basic: { name: "Básico", price: 29.9, ...(features && plan === "basic" ? { features } : {}) },
                standard: { name: "Comum", price: 59.9, limits: { menusMaxTables: 40 } },
                premium: { name: "Premium", price: 179.9, bundle: true, ...(features && plan === "premium" ? { features } : {}) }
            },
            menusCatalog: { pizzaria: catalog() },
            menusSettings: { pizzaria: settings() },
            menusFloor: { pizzaria: { areas: { salao: { name: "Salão" } }, tables: floorTables } },
            menusStock: { pizzaria: { soda: { track: true, qty: 3, min: 1 } } }
        },
        { now: () => NOW }
    );
};
