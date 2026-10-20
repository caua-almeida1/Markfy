import fs from "fs";
import path from "path";

import {
    bundleSavings,
    licenseProductFor,
    planFeature,
    planPriceFor,
    productIncludes,
    productKeyFor,
    publicAccessFor
} from "../licensing.js";
import { can, resolveRole, ROLES, ACTION_IDS } from "../permissions.js";
import { normalizeDesign, TEMPLATES, slugProblem, slugify } from "../design.js";

describe("produtos e planos", () => {
    test("valores de licença antigos continuam valendo", () => {
        expect(productIncludes("both", "bookings")).toBe(true);
        expect(productIncludes("both", "menus")).toBe(false);
        expect(productIncludes("all", "menus")).toBe(true);
        expect(productIncludes("menus", "studio")).toBe(false);
    });

    test("pacotes: Pro = Bookings + Studio; Premium = os três", () => {
        expect(licenseProductFor("pro", { bundle: true }, "menus")).toBe("both");
        expect(licenseProductFor("premium", { bundle: true }, null)).toBe("all");
        expect(licenseProductFor("standard", { bundle: false }, "menus")).toBe("menus");
        expect(licenseProductFor("standard", { bundle: false }, "hackeado")).toBeNull();
        expect(productKeyFor(["menus", "bookings"])).toBeNull();
    });

    test("preço individual do Menus segue a regra interna quando não há valor gravado", () => {
        expect(planPriceFor({ price: 59.9 }, "bookings")).toBe(59.9);
        expect(planPriceFor({ price: 59.9 }, "menus")).toBe(71.88);
        expect(planPriceFor({ price: 59.9, productPrices: { menus: 69.9 } }, "menus")).toBe(69.9);
        expect(planPriceFor({ price: 179.9, bundle: true }, "menus")).toBe(179.9);
    });

    test("economia do Premium vem dos preços reais configurados", () => {
        const catalog = [
            { id: "basic", name: "Básico", price: 29.9 },
            { id: "standard", name: "Comum", price: 59.9 },
            { id: "premium", name: "Premium", price: 179.9, bundle: true }
        ];
        const savings = bundleSavings("premium", catalog[2], catalog);
        expect(savings.separate).toBe(191.68);
        expect(savings.saving).toBe(11.78);
        expect(savings.percent).toBe(6);

        const expensive = bundleSavings("premium", { ...catalog[2], price: 250 }, catalog);
        expect(expensive.percent).toBe(0);
    });

    test("recurso ausente no catálogo publicado usa o padrão do plano", () => {
        expect(planFeature("premium", { features: {} }, "menusTables")).toBe(true);
        expect(planFeature("premium", { features: { menusTables: false } }, "menusTables")).toBe(false);
        expect(planFeature("basic", {}, "menusOrdering")).toBe(false);
    });

    test("espelho público inclui o Menus", () => {
        expect(publicAccessFor({ plan: "premium", product: "all", status: "active" })).toMatchObject({ bookings: true, studio: true, menus: true });
        expect(publicAccessFor({ plan: "basic", product: "menus", status: "suspended" }).menus).toBe(false);
    });
});

describe("permissões", () => {
    test("papel da Markfy vira perfil do Menus", () => {
        expect(resolveRole("master", null)).toBe("owner");
        expect(resolveRole("administrator", { role: "waiter" })).toBe("admin");
        expect(resolveRole("professional", { role: "kitchen" })).toBe("kitchen");
        expect(resolveRole("professional", { role: "owner" })).toBe("waiter");
        expect(resolveRole(null, { role: "manager" })).toBeNull();
    });

    test("garçom não altera preço nem vê financeiro; ajuste individual não dá poder de dono", () => {
        expect(can("waiter", "tables.open")).toBe(true);
        expect(can("waiter", "catalog.prices")).toBe(false);
        expect(can("waiter", "reports.financial")).toBe(false);
        expect(can("waiter", "tabs.payment", { "tabs.payment": true })).toBe(true);
        expect(can("waiter", "team.manage", { "team.manage": true })).toBe(false);
        expect(can("admin", "plan.manage")).toBe(false);
        expect(ACTION_IDS.every((id) => can("owner", id))).toBe(true);
        expect(Object.keys(ROLES)).toHaveLength(7);
    });
});

describe("aparência", () => {
    test("há 16 modelos com composições diferentes", () => {
        expect(TEMPLATES).toHaveLength(16);
        const compositions = new Set(TEMPLATES.map((t) => `${t.layout.header}/${t.layout.nav}/${t.layout.products}`));
        expect(compositions.size).toBeGreaterThanOrEqual(13);
    });

    test("normaliza valores inválidos", () => {
        const design = normalizeDesign({ templateId: "nao-existe", theme: { colors: { primary: "vermelho" }, radius: 999 }, images: { logo: "javascript:alert(1)" } });
        expect(design.templateId).toBe("moderno");
        expect(design.theme.colors.primary).toBe("#111111");
        expect(design.theme.radius).toBe(32);
        expect(design.images.logo).toBe("");
    });

    test("endereço público", () => {
        expect(slugify("Pizzaria do João & Cia")).toBe("pizzaria-do-joao-cia");
        expect(slugProblem("demo")).toMatch(/reservado/);
        expect(slugProblem("ok")).toBeTruthy();
        expect(slugProblem("pizzaria-do-joao")).toBeNull();
    });
});

describe("cópia do motor no backend", () => {
    test("functions-backend/menus-engine está igual a src/menus/engine", () => {
        const source = path.resolve(__dirname, "..");
        const target = path.resolve(__dirname, "../../../../functions-backend/menus-engine");
        const files = fs.readdirSync(source).filter((file) => file.endsWith(".js"));
        files.forEach((file) => {
            const a = fs.readFileSync(path.join(source, file), "utf8");
            const b = fs.existsSync(path.join(target, file)) ? fs.readFileSync(path.join(target, file), "utf8") : null;
            if (a !== b) throw new Error(`${file} desatualizado no backend: rode "node scripts/sync-menus-engine.js".`);
        });
    });
});
