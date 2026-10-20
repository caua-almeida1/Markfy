import { quoteLine, quoteLines, fromPriceCents, describeLine } from "../pricing.js";
import { splitEqually, toCents, formatBRL } from "../money.js";
import { isOpenAt, fromBookingsHours, productScheduleOpen, dayKey } from "../hours.js";
import { catalog, NOW } from "../__fixtures__/seed.js";

const ctx = { now: NOW, tz: "America/Sao_Paulo" };

describe("preços", () => {
    const data = catalog();
    const pizza = { ...data.products.pizza, id: "pizza" };

    test("meio a meio cobra o sabor mais caro do tamanho e soma a borda", () => {
        const quote = quoteLine(pizza, data.optionGroups, { sizeId: "g", options: { flavors: ["cal", "cam"], border: ["cat"] }, qty: 2 }, ctx);
        expect(quote.ok).toBe(true);
        expect(quote.unitCents).toBe(7500 + 800);
        expect(quote.totalCents).toBe((7500 + 800) * 2);
        expect(describeLine(quote.line)).toBe("Grande · 1/2 Calabresa, 1/2 Camarão · Catupiry");
    });

    test("regra de média arredonda ao centavo", () => {
        const groups = { ...data.optionGroups, flavors: { ...data.optionGroups.flavors, flavorPricing: "average" } };
        const quote = quoteLine(pizza, groups, { sizeId: "m", options: { flavors: ["cal", "cam"] } }, ctx);
        expect(quote.unitCents).toBe(5000);
    });

    test("valida tamanho, mínimo e máximo de opções", () => {
        expect(quoteLine(pizza, data.optionGroups, { options: { flavors: ["cal"] } }, ctx).errors[0]).toMatch(/tamanho/);
        expect(quoteLine(pizza, data.optionGroups, { sizeId: "m", options: {} }, ctx).errors[0]).toMatch(/Escolha uma opção/);
        const many = { ...data.optionGroups, flavors: { ...data.optionGroups.flavors, max: 1 } };
        expect(quoteLine(pizza, many, { sizeId: "m", options: { flavors: ["cal", "cam"] } }, ctx).errors[0]).toMatch(/no máximo 1/);
    });

    test("preço promocional só vale quando é menor que o normal", () => {
        const juice = { ...data.products.juice, id: "juice" };
        expect(quoteLine(juice, {}, { qty: 1 }, ctx).unitCents).toBe(900);
        expect(quoteLine({ ...juice, promoPriceCents: 1500 }, {}, { qty: 1 }, ctx).unitCents).toBe(1200);
    });

    test("produto indisponível e fora do horário não entram", () => {
        const result = quoteLines(data, [{ productId: "off" }, { productId: "lunch" }], ctx);
        expect(result.ok).toBe(false);
        expect(result.errors.join(" ")).toMatch(/Indisponível/);
        expect(result.errors.join(" ")).toMatch(/outro horário/);
    });

    test("ignora preço enviado pelo navegador", () => {
        const result = quoteLines(data, [{ productId: "soda", qty: 2, unitCents: 1 }], ctx);
        expect(result.subtotalCents).toBe(1400);
    });

    test("a partir de: menor preço disponível", () => {
        expect(fromPriceCents(pizza, data.optionGroups)).toBe(4000);
    });
});

describe("dinheiro", () => {
    test("divisão igualitária fecha exatamente o total", () => {
        expect(splitEqually(10000, 3)).toEqual([3334, 3333, 3333]);
        expect(splitEqually(10000, 3).reduce((a, b) => a + b, 0)).toBe(10000);
    });

    test("converte texto brasileiro", () => {
        expect(toCents("R$ 1.234,56")).toBe(123456);
        expect(toCents("")).toBeNull();
        expect(formatBRL(123456).replace(/\s/g, " ")).toMatch(/1\.234,56/);
    });
});

describe("horários no fuso da empresa", () => {
    const hours = { friday: { enabled: true, ranges: [{ from: "18:00", to: "02:00" }] } };

    test("sexta 20h em São Paulo está aberto", () => {
        expect(isOpenAt(hours, NOW, "America/Sao_Paulo").open).toBe(true);
    });

    test("faixa que atravessa a meia-noite vale no dia seguinte", () => {
        const saturday0130 = NOW + (5 * 60 + 30) * 60000;
        expect(isOpenAt(hours, saturday0130, "America/Sao_Paulo").open).toBe(true);
        expect(isOpenAt(hours, saturday0130 + 60 * 60000, "America/Sao_Paulo").open).toBe(false);
    });

    test("o dia do relatório é o do restaurante, não UTC", () => {
        expect(dayKey(NOW, "America/Sao_Paulo")).toBe("2026-10-16");
        expect(dayKey(NOW + 2 * 3600000, "UTC")).toBe("2026-10-17");
    });

    test("importa o horário da Bookings descontando pausas", () => {
        const converted = fromBookingsHours({ monday: { enabled: true, open: "08:00", close: "18:00", intervals: [{ open: "12:00", close: "13:00" }] } });
        expect(converted.monday.ranges).toEqual([{ from: "08:00", to: "12:00" }, { from: "13:00", to: "18:00" }]);
    });

    test("horário do produto respeita dias da semana", () => {
        expect(productScheduleOpen({ days: [1, 2, 3, 4, 5], from: "11:00", to: "15:00" }, NOW, "America/Sao_Paulo")).toBe(false);
    });
});
