import { buildBoard, publicName, sampleOrders, withDisplayDefaults } from "../board.js";

const NOW = 1_800_000_000_000;
const min = (n) => n * 60000;

const order = (id, status, extra = {}) => ({
    id,
    code: id.padStart(3, "0"),
    channel: "pickup",
    status,
    customer: { name: "maria clara souza" },
    createdAt: NOW - min(20),
    ...extra
});

describe("monitor de retirada: quem aparece na TV", () => {
    test("separa preparo e prontos; concluído e cancelado nunca aparecem", () => {
        const board = buildBoard([
            order("1", "confirmed"),
            order("2", "preparing"),
            order("3", "ready", { readyAt: NOW - min(1) }),
            order("4", "awaiting_pickup", { readyAt: NOW - min(2) }),
            order("5", "completed"),
            order("6", "cancelled")
        ], {}, NOW);

        expect(board.preparing.map((card) => card.id)).toEqual(["1", "2"]);
        expect(board.ready.map((card) => card.id)).toEqual(["3", "4"]);
    });

    test("pronto mais recente vem primeiro (é o destaque)", () => {
        const board = buildBoard([
            order("1", "ready", { readyAt: NOW - min(5) }),
            order("2", "ready", { readyAt: NOW - min(1) })
        ], {}, NOW);
        expect(board.ready[0].id).toBe("2");
    });

    test("pronto some depois de readyMinutes", () => {
        const list = [order("1", "ready", { readyAt: NOW - min(12) }), order("2", "ready", { readyAt: NOW - min(3) })];
        expect(buildBoard(list, { readyMinutes: 10 }, NOW).ready.map((card) => card.id)).toEqual(["2"]);
        expect(buildBoard(list, { readyMinutes: 15 }, NOW).ready).toHaveLength(2);
    });

    test("respeita os canais escolhidos", () => {
        const list = [order("1", "preparing"), order("2", "preparing", { channel: "table" }), order("3", "preparing", { channel: "delivery" })];
        expect(buildBoard(list, {}, NOW).preparing.map((card) => card.id)).toEqual(["1"]);
        expect(buildBoard(list, { channels: { table: true } }, NOW).preparing.map((card) => card.id)).toEqual(["1", "2"]);
    });

    test("recebido (não confirmado) só aparece se a empresa quiser", () => {
        const list = [order("1", "received")];
        expect(buildBoard(list, {}, NOW).preparing).toHaveLength(1);
        expect(buildBoard(list, { showReceived: false }, NOW).preparing).toHaveLength(0);
    });

    test("só o primeiro nome, e nenhum quando desligado", () => {
        expect(buildBoard([order("1", "preparing")], {}, NOW).preparing[0].name).toBe("Maria");
        expect(buildBoard([order("1", "preparing")], { showNames: false }, NOW).preparing[0].name).toBe("");
    });

    test("nomes genéricos do PDV não vão para a TV", () => {
        expect(publicName("Balcão")).toBe("");
        expect(publicName("cliente avulso")).toBe("");
        expect(publicName("  JOÃO  pedro ")).toBe("João");
        expect(publicName("Maximilianoooo")).toBe("Maximiliano…");
    });

    test("pedidos sem número são ignorados", () => {
        expect(buildBoard([{ ...order("1", "preparing"), code: "" }], {}, NOW).preparing).toHaveLength(0);
    });

    test("padrões preenchem só o que falta", () => {
        const options = withDisplayDefaults({ template: "brasa", channels: { delivery: true } });
        expect(options.template).toBe("brasa");
        expect(options.channels).toEqual({ pickup: true, counter: true, table: false, delivery: true });
        expect(options.readyMinutes).toBe(10);
    });

    test("pedidos de exemplo enchem as duas colunas", () => {
        const board = buildBoard(sampleOrders(NOW), {}, NOW);
        expect(board.preparing.length).toBeGreaterThan(4);
        expect(board.ready.length).toBeGreaterThan(2);
    });
});
