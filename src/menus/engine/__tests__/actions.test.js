import { resolveContext, runAction, importExternalOrder } from "../actions.js";
import { computeTotals, splitEqual, splitByPerson } from "../tabs.js";
import { seed, NOW } from "../__fixtures__/seed.js";

const as = (db, uid, handle = "pizzaria") => resolveContext(db, { handle, uid, name: uid, now: NOW });

const tabOf = async (db, tabId) => db.get(`menusOps/pizzaria/tabs/${tabId}`);

const expectError = async (promise, code) => {
    await expect(promise).rejects.toMatchObject({ code });
};

describe("mesas e comandas", () => {
    test("dois aparelhos abrindo a mesma mesa ao mesmo tempo criam UMA comanda", async () => {
        const db = seed();
        const waiter = await as(db, "waiter");
        const results = await Promise.allSettled([
            runAction(db, waiter, "tables.open", { tableId: "t1", guests: 2 }),
            runAction(db, waiter, "tables.open", { tableId: "t1", guests: 4 })
        ]);
        expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
        const rejected = results.find((r) => r.status === "rejected");
        expect(rejected.reason.code).toBe("table_busy");
        expect(Object.keys((await db.get("menusOps/pizzaria/tabs")) || {})).toHaveLength(1);
    });

    test("fluxo completo: abrir, lançar, enviar, dividir, pagar e liberar", async () => {
        const db = seed();
        const waiter = await as(db, "waiter");
        const cashier = await as(db, "cashier");

        const { tabId } = await runAction(db, waiter, "tables.open", { tableId: "t1", guests: 2 });
        await runAction(db, waiter, "tabs.addItems", {
            tabId,
            lines: [
                { productId: "pizza", sizeId: "g", options: { flavors: ["cal"] }, qty: 1, person: "Ana" },
                { productId: "soda", qty: 2, person: "Bia" }
            ]
        });

        let tab = await tabOf(db, tabId);
        expect(computeTotals(tab).pendingCount).toBe(2);

        await expectError(runAction(db, cashier, "tabs.pay", { tabId, paymentId: "pay-000001", method: "pix", amountCents: 100 }), "pending_items");

        const sent = await runAction(db, waiter, "tabs.send", { tabId });
        expect(sent.sent).toBe(2);

        /* Item enviado não sai sem motivo. */
        const sentItemId = Object.keys(tab.items)[0];
        await expectError(runAction(db, waiter, "tabs.removePending", { tabId, itemId: sentItemId }), "item_sent");

        tab = await tabOf(db, tabId);
        expect(tab.totals.itemsCents).toBe(5500 + 1400);
        expect(tab.totals.serviceCents).toBe(690);
        expect(tab.totals.totalCents).toBe(7590);

        const people = splitByPerson(tab);
        expect(people.reduce((sum, row) => sum + row.dueCents, 0)).toBe(7590);

        const [first, second] = splitEqual(tab, 2);
        await runAction(db, cashier, "tabs.pay", { tabId, paymentId: "pay-000001", method: "pix", amountCents: first });

        /* Clique duplo / rede instável: mesmo id, um pagamento só. */
        const again = await runAction(db, cashier, "tabs.pay", { tabId, paymentId: "pay-000001", method: "pix", amountCents: first });
        expect(again.duplicate).toBe(true);

        await expectError(runAction(db, cashier, "tabs.pay", { tabId, paymentId: "pay-000002", method: "cash", amountCents: second + 1 }), "overpay");
        await expectError(runAction(db, cashier, "tabs.close", { tabId }), "balance");

        await runAction(db, cashier, "tabs.pay", { tabId, paymentId: "pay-000002", method: "cash", amountCents: second, receivedCents: 5000 });
        await runAction(db, cashier, "tabs.close", { tabId });

        expect(await db.get("menusOps/pizzaria/tableState/t1")).toBeNull();
        tab = await tabOf(db, tabId);
        expect(tab.status).toBe("closed");
        expect(tab.payments["pay-000002"].changeCents).toBe(5000 - second);

        const ledger = await db.get("menusLedger/pizzaria");
        expect(Object.values(ledger).reduce((sum, row) => sum + row.amountCents, 0)).toBe(7590);
    });

    test("desconto exige permissão e motivo, e fica auditado", async () => {
        const db = seed();
        const waiter = await as(db, "waiter");
        const owner = await as(db, "owner");
        const { tabId } = await runAction(db, waiter, "tables.open", { tableId: "t1" });
        await runAction(db, waiter, "tabs.addItems", { tabId, lines: [{ productId: "soda", qty: 2 }], send: true });

        await expectError(runAction(db, waiter, "tabs.adjust", { tabId, type: "discount", mode: "percent", value: 10, reason: "cortesia" }), "forbidden");
        await expectError(runAction(db, owner, "tabs.adjust", { tabId, type: "discount", mode: "percent", value: 10, reason: "" }), "reason");

        await runAction(db, owner, "tabs.adjust", { tabId, type: "discount", mode: "amount", value: 400, reason: "Cliente fiel" });
        const tab = await tabOf(db, tabId);
        expect(tab.totals.discountCents).toBe(400);
        expect(tab.totals.serviceCents).toBe(100);

        const audit = Object.values(await db.get("menusAudit/pizzaria"));
        expect(audit.map((entry) => entry.type)).toContain("tab.discount");
    });

    test("cancelar item enviado reflete no pedido da cozinha e devolve estoque", async () => {
        const db = seed();
        const waiter = await as(db, "waiter");
        const manager = await as(db, "admin");
        const { tabId } = await runAction(db, waiter, "tables.open", { tableId: "t1" });
        const { orderId } = await runAction(db, waiter, "tabs.addItems", { tabId, lines: [{ productId: "soda", qty: 2 }], send: true });

        expect((await db.get("menusStock/pizzaria/soda")).qty).toBe(1);

        await expectError(runAction(db, waiter, "tabs.cancelItem", { tabId, itemId: Object.keys((await tabOf(db, tabId)).items)[0], reason: "erro" }), "forbidden");

        const itemId = Object.keys((await tabOf(db, tabId)).items)[0];
        await runAction(db, manager, "tabs.cancelItem", { tabId, itemId, reason: "Cliente desistiu" });

        const order = await db.get(`menusOps/pizzaria/orders/${orderId}`);
        expect(order.status).toBe("cancelled");
        expect((await db.get("menusStock/pizzaria/soda")).qty).toBe(3);
        expect((await tabOf(db, tabId)).totals.totalCents).toBe(0);
    });

    test("transferir mesa e unir comandas", async () => {
        const db = seed({ tables: 3 });
        const waiter = await as(db, "waiter");
        const a = await runAction(db, waiter, "tables.open", { tableId: "t1", guests: 2 });
        const b = await runAction(db, waiter, "tables.open", { tableId: "t2", guests: 3 });
        await runAction(db, waiter, "tabs.addItems", { tabId: a.tabId, lines: [{ productId: "soda" }], send: true });
        await runAction(db, waiter, "tabs.addItems", { tabId: b.tabId, lines: [{ productId: "juice" }], send: true });

        await expectError(runAction(db, waiter, "tables.move", { tabId: a.tabId, toTableId: "t2" }), "table_busy");
        await runAction(db, waiter, "tables.move", { tabId: a.tabId, toTableId: "t3" });
        expect((await db.get("menusOps/pizzaria/tableState/t3")).tabId).toBe(a.tabId);
        expect(await db.get("menusOps/pizzaria/tableState/t1")).toBeNull();

        await runAction(db, waiter, "tables.merge", { fromTabId: b.tabId, intoTabId: a.tabId });
        const merged = await tabOf(db, a.tabId);
        expect(merged.guests).toBe(5);
        expect(merged.totals.itemsCents).toBe(700 + 900);
        expect((await tabOf(db, b.tabId)).status).toBe("merged");
        expect(await db.get("menusOps/pizzaria/tableState/t2")).toBeNull();
    });

    test("reabrir comanda exige motivo e permissão", async () => {
        const db = seed();
        const owner = await as(db, "owner");
        const cashier = await as(db, "cashier");
        const { tabId } = await runAction(db, owner, "tables.open", { tableId: "t1" });
        await runAction(db, owner, "tabs.close", { tabId });
        await expectError(runAction(db, cashier, "tabs.reopen", { tabId, reason: "erro" }), "forbidden");
        await runAction(db, owner, "tabs.reopen", { tabId, reason: "Faltou lançar a sobremesa" });
        expect((await tabOf(db, tabId)).status).toBe("open");
        expect((await db.get("menusOps/pizzaria/tableState/t1")).tabId).toBe(tabId);
    });
});

describe("pedidos", () => {
    const order = (extra = {}) => ({
        idempotencyKey: "carrinho-0001",
        lines: [{ productId: "soda", qty: 1 }, { productId: "pizza", sizeId: "m", options: { flavors: ["cal"] } }],
        fulfillment: { mode: "delivery", address: "Rua das Flores, 100", zoneId: "centro" },
        customer: { name: "Carla", phone: "(11) 98888-7777" },
        payment: { method: "pix" },
        ...extra
    });

    test("pedido público: preço do servidor, taxa da região e sem duplicar", async () => {
        const db = seed();
        const visitor = await as(db, null);
        const first = await runAction(db, visitor, "public.placeOrder", order());
        const second = await runAction(db, visitor, "public.placeOrder", order());
        expect(second.duplicate).toBe(true);
        expect(second.orderId).toBe(first.orderId);

        const saved = await db.get(`menusOps/pizzaria/orders/${first.orderId}`);
        expect(saved.totals).toMatchObject({ subtotalCents: 4700, deliveryFeeCents: 500, totalCents: 5200 });
        expect(saved.status).toBe("received");
        expect(saved.payment.status).toBe("pending");

        const track = await db.get(`menusTrack/pizzaria/${first.orderId}`);
        expect(track.code).toBe(saved.code);
        expect(track.customer).toBeUndefined();
    });

    test("estoque só baixa quando o pedido é confirmado, e volta se cancelar", async () => {
        const db = seed();
        const visitor = await as(db, null);
        const kitchen = await as(db, "kitchen");
        const owner = await as(db, "owner");
        const { orderId } = await runAction(db, visitor, "public.placeOrder", order());
        expect((await db.get("menusStock/pizzaria/soda")).qty).toBe(3);

        await runAction(db, kitchen, "orders.status", { orderId, to: "confirmed" });
        expect((await db.get("menusStock/pizzaria/soda")).qty).toBe(2);

        await expectError(runAction(db, kitchen, "orders.cancel", { orderId, reason: "sem massa" }), "forbidden");
        await runAction(db, owner, "orders.cancel", { orderId, reason: "Sem massa", publicReason: "Faltou ingrediente" });
        expect((await db.get("menusStock/pizzaria/soda")).qty).toBe(3);
        expect((await db.get(`menusTrack/pizzaria/${orderId}`)).cancelReason).toBe("Faltou ingrediente");
    });

    test("recusa pedido acima do estoque, fora da região mínima ou sem forma de pagamento", async () => {
        const db = seed();
        const visitor = await as(db, null);
        await expectError(runAction(db, visitor, "public.placeOrder", order({ lines: [{ productId: "soda", qty: 5 }], idempotencyKey: "carrinho-0002" })), "stock");
        await expectError(runAction(db, visitor, "public.placeOrder", order({ lines: [{ productId: "soda", qty: 1 }], idempotencyKey: "carrinho-0003" })), "checkout");
        await expectError(runAction(db, visitor, "public.placeOrder", order({ payment: { method: "voucher" }, idempotencyKey: "carrinho-0004" })), "checkout");
    });

    test("fluxo de status: avança, volta uma etapa, entregador só mexe na entrega", async () => {
        const db = seed();
        const visitor = await as(db, null);
        const kitchen = await as(db, "kitchen");
        const rider = await as(db, "rider");
        const { orderId } = await runAction(db, visitor, "public.placeOrder", order());

        await expectError(runAction(db, rider, "orders.status", { orderId, to: "confirmed" }), "forbidden");
        await runAction(db, kitchen, "orders.status", { orderId, to: "preparing" });
        await runAction(db, kitchen, "orders.status", { orderId, to: "confirmed" });
        await expectError(runAction(db, kitchen, "orders.status", { orderId, to: "received" }), "bad_transition");
        await runAction(db, kitchen, "orders.status", { orderId, to: "ready" });
        await runAction(db, rider, "orders.status", { orderId, to: "out_for_delivery" });
        await runAction(db, rider, "orders.status", { orderId, to: "completed" });
        expect((await db.get(`menusTrack/pizzaria/${orderId}`)).status).toBe("completed");
    });

    test("pedido pelo QR entra na comanda sem enviar o que o garçom deixou pendente", async () => {
        const db = seed();
        const waiter = await as(db, "waiter");
        const visitor = await as(db, null);
        const { tabId } = await runAction(db, waiter, "tables.open", { tableId: "t1" });
        await runAction(db, waiter, "tabs.addItems", { tabId, lines: [{ productId: "juice" }] });

        const qr = await runAction(db, visitor, "public.placeOrder", {
            idempotencyKey: "qr-mesa-0001",
            lines: [{ productId: "soda", qty: 1 }],
            fulfillment: { mode: "dine_in", tableId: "t1" },
            customer: { name: "Mesa 1" }
        });

        const tab = await tabOf(db, tabId);
        const statuses = Object.values(tab.items).map((item) => [item.name, item.status]);
        expect(statuses).toEqual(expect.arrayContaining([["Suco", "pending"], ["Refrigerante", "sent"]]));
        expect((await db.get(`menusOps/pizzaria/orders/${qr.orderId}`)).source).toBe("qr");
    });

    test("PDV: pagamento no ato só com permissão de caixa", async () => {
        const db = seed();
        const cashier = await as(db, "cashier");
        const waiter = await as(db, "waiter");
        await expectError(runAction(db, waiter, "orders.create", { channel: "counter", lines: [{ productId: "soda" }] }), "forbidden");
        const created = await runAction(db, cashier, "orders.create", { channel: "counter", idempotencyKey: "balcao-00001", lines: [{ productId: "soda" }], payment: { method: "cash", status: "paid" } });
        const saved = await db.get(`menusOps/pizzaria/orders/${created.orderId}`);
        expect(saved.payment.status).toBe("paid");
        expect(saved.status).toBe("confirmed");
    });

    test("importação de canal externo não duplica o mesmo pedido", async () => {
        const db = seed();
        const ctx = await as(db, null);
        const external = { id: "IF-123", channel: "delivery", items: [{ name: "Pizza", qty: 1, unitCents: 5000 }], customer: { name: "Cliente iFood" } };
        const first = await importExternalOrder(db, ctx, "ifood", external);
        const second = await importExternalOrder(db, ctx, "ifood", external);
        expect(second.duplicate).toBe(true);
        expect(second.orderId).toBe(first.orderId);
    });
});

describe("planos, permissões e isolamento", () => {
    test("empresa sem Menus no plano é recusada no servidor", async () => {
        const db = seed({ plan: "standard", product: "bookings" });
        const owner = await as(db, "owner");
        await expectError(runAction(db, owner, "tables.open", { tableId: "t1" }), "plan_required");
    });

    test("recurso fora do plano é recusado mesmo chamando a API direto", async () => {
        const db = seed({ plan: "basic", product: "menus" });
        const owner = await as(db, "owner");
        const visitor = await as(db, null);
        await expectError(runAction(db, owner, "tables.open", { tableId: "t1" }), "feature_locked");
        await expectError(runAction(db, visitor, "public.placeOrder", { lines: [{ productId: "soda" }] }), "feature_locked");
    });

    test("recurso desligado explicitamente na Master Dev vale mais que o padrão", async () => {
        const db = seed({ plan: "premium", product: "all", features: { menusTables: false } });
        const owner = await as(db, "owner");
        await expectError(runAction(db, owner, "tables.open", { tableId: "t1" }), "feature_locked");
    });

    test("membro de outra empresa não opera aqui", async () => {
        const db = seed();
        const stranger = await as(db, "stranger");
        expect(stranger.role).toBeNull();
        await expectError(runAction(db, stranger, "tables.open", { tableId: "t1" }), "forbidden");
    });

    test("limite de mesas do plano vale na planta", async () => {
        const db = seed({ plan: "standard", product: "menus" });
        const owner = await as(db, "owner");
        const tables = {};
        for (let i = 0; i < 41; i += 1) tables[`m${i}`] = { label: `Mesa ${i}`, seats: 4, areaId: "salao" };
        await expectError(runAction(db, owner, "floor.save", { areas: { salao: { name: "Salão" } }, tables }), "limit");
    });

    test("publicação no plano básico usa só o que o plano inclui", async () => {
        const db = seed({ plan: "basic", product: "menus" });
        const owner = await as(db, "owner");
        await db.set("menusDrafts/pizzaria", { design: { templateId: "gourmet", theme: { colors: { primary: "#123456", background: "#000000" } } }, updatedAt: NOW });
        const result = await runAction(db, owner, "design.publish", {});
        expect(result.downgraded).toBe(true);
        const site = await db.get("menusSites/pizzaria");
        expect(site.design.templateId).toBe("moderno");
        expect(site.design.theme.colors.primary).toBe("#123456");
        expect(site.design.theme.colors.background).toBe("#ffffff");
        expect(await db.get("menusSlugs/pizzaria-teste")).toBe("pizzaria");
    });

    test("endereço público de outra empresa não pode ser tomado", async () => {
        const db = seed();
        await db.set("menusSlugs/pizzaria-teste", "outra");
        await db.set("menusDrafts/pizzaria", { design: { templateId: "moderno" } });
        const owner = await as(db, "owner");
        await expectError(runAction(db, owner, "design.publish", {}), "slug_taken");
    });
});
