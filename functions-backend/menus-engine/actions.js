/* =========================================================
   AÇÕES DO MARKFY MENUS (lado do servidor)

   Toda operação que mexe em mesa, comanda, pedido, dinheiro
   ou estoque passa por aqui — nunca é gravada direto pelo
   navegador. As regras do banco (database.rules.proposta.json)
   deixam esses nós SOMENTE LEITURA para o cliente.

   O mesmo código roda:
     - na Cloud Function menusApi (adaptador do Admin SDK);
     - no modo de demonstração (banco em memória);
     - nos testes.

   O "db" é um adaptador com:
     get(path)                  → valor ou null
     transaction(path, fn)      → { committed, value }
                                  fn(atual) devolve o novo valor,
                                  ou undefined para desistir
     update({ caminho: valor }) → gravação atômica em vários nós
     set(path, value)
     newKey()                   → id novo (push)

   Cada transação trata o primeiro "null" do RTDB: o Admin
   SDK pode chamar a função com null antes de ler o valor
   real; devolver null nesse caso faz o banco tentar de novo
   com o dado verdadeiro.
========================================================= */

import { asList, clean, entries, fail, isId, MenusError, text } from "./util.js";
import { cents } from "./money.js";
import { dayKey, DEFAULT_TZ } from "./hours.js";
import { quoteLines } from "./pricing.js";
import {
    canMove,
    flowFor,
    formatCode,
    initialStatus,
    PAYMENT_METHODS,
    TERMINAL,
    trackingView,
    validateCheckout
} from "./orders.js";
import {
    addItems,
    applyAdjustment,
    computeTotals,
    cancelItem,
    closeTab,
    createTab,
    putItems,
    refundPayment,
    registerPayment,
    removePendingItem,
    reopenTab,
    sendPending,
    takeItems,
    voidAdjustment
} from "./tabs.js";
import { stockNeeds } from "./stock.js";
import { normalizeDesign, slugProblem } from "./design.js";
import { ACTION_FEATURE, can, resolveRole } from "./permissions.js";
import {
    licenseActive,
    MENUS_FEATURE_IDS,
    planFeature,
    planLimit,
    productIncludes
} from "./licensing.js";

/* ---------- CAMINHOS ---------- */

export const paths = (h) => ({
    catalog: `menusCatalog/${h}`,
    product: (id) => `menusCatalog/${h}/products/${id}`,
    settings: `menusSettings/${h}`,
    floor: `menusFloor/${h}`,
    floorTable: (id) => `menusFloor/${h}/tables/${id}`,
    ops: `menusOps/${h}`,
    tableState: (id) => `menusOps/${h}/tableState/${id}`,
    tab: (id) => `menusOps/${h}/tabs/${id}`,
    order: (id) => `menusOps/${h}/orders/${id}`,
    call: (id) => `menusOps/${h}/calls/${id}`,
    calls: `menusOps/${h}/calls`,
    seq: (day) => `menusOps/${h}/seq/${day}`,
    idem: (key) => `menusOps/${h}/idem/${key}`,
    external: (key) => `menusOps/${h}/external/${key}`,
    track: (id) => `menusTrack/${h}/${id}`,
    audit: (id) => `menusAudit/${h}/${id}`,
    ledger: (id) => `menusLedger/${h}/${id}`,
    stock: (id) => `menusStock/${h}/${id}`,
    stockMove: (id) => `menusStockMoves/${h}/${id}`,
    staff: (uid) => `menusStaff/${h}/${uid}`,
    draft: `menusDrafts/${h}`,
    site: `menusSites/${h}`,
    slug: (slug) => `menusSlugs/${slug}`,
    member: (uid) => `companys/${h}/members/${uid}`,
    license: `licenses/${h}`
});

/* ---------- CONTEXTO ----------
   Descobre papel, recursos do plano e licença a partir do
   próprio banco: o navegador não informa nada disso. */

export const resolveContext = async (db, { handle, uid = null, name = null, now = Date.now() }) => {
    const p = paths(handle);

    const [member, staff, license] = await Promise.all([
        uid ? db.get(p.member(uid)) : null,
        uid ? db.get(p.staff(uid)) : null,
        db.get(p.license)
    ]);

    const plan = license?.plan ? await db.get(`planCatalog/${license.plan}`) : null;

    const active = licenseActive(license, now);
    const menusEnabled = active && productIncludes(license?.product, "menus");

    const features = {};
    MENUS_FEATURE_IDS.forEach((feature) => {
        features[feature] = menusEnabled && planFeature(license?.plan, plan, feature);
    });

    const role = member ? resolveRole(member.role, staff) : null;

    return {
        handle,
        now,
        actor: uid ? { uid, name: text(name || staff?.name || "", 80) || null } : null,
        role,
        grants: role && role !== "owner" && role !== "admin" ? staff?.grants || null : null,
        menusEnabled,
        features,
        limits: {
            menusMaxTables: planLimit(license?.plan, plan, "menusMaxTables")
        }
    };
};

/* ---------- APOIO ---------- */

/** Transação que lança o erro de dentro da função (sem gravar nada). */
const tx = async (db, path, fn) => {
    let problem = null;

    const result = await db.transaction(path, (current) => {
        problem = null;
        try {
            return fn(current);
        } catch (error) {
            problem = error;
            return undefined;
        }
    });

    if (problem) throw problem;
    return result;
};

/** Transação sobre um nó que PRECISA existir. */
const txExisting = (db, path, fn, notFound) =>
    tx(db, path, (current) => {
        if (current === null || current === undefined) return null;
        return fn(current);
    }).then((result) => {
        if (!result.committed || result.value === null || result.value === undefined) {
            fail("not_found", notFound || "Registro não encontrado.", 404);
        }
        return result;
    });

const auditEntry = (ctx, type, details) => ({
    type,
    at: ctx.now,
    by: ctx.actor?.uid || null,
    byName: ctx.actor?.name || null,
    role: ctx.role || "public",
    details: clean(details)
});

const audit = (db, ctx, type, details) => db.set(paths(ctx.handle).audit(db.newKey()), auditEntry(ctx, type, details));

const ledger = (db, ctx, entry) =>
    db.set(paths(ctx.handle).ledger(entry.id || db.newKey()), clean({
        ...entry,
        at: ctx.now,
        dayKey: dayKey(ctx.now, ctx.tz || DEFAULT_TZ),
        by: ctx.actor?.uid || null,
        byName: ctx.actor?.name || null
    }));

const loadSettings = async (db, ctx) => {
    const settings = (await db.get(paths(ctx.handle).settings)) || {};
    ctx.tz = settings.timezone || DEFAULT_TZ;
    return settings;
};

const loadCatalog = async (db, ctx) => (await db.get(paths(ctx.handle).catalog)) || {};

const requireId = (value, label = "Identificador") => {
    if (!isId(value)) fail("bad_request", `${label} inválido.`);
    return value;
};

const quoteOrFail = (catalog, lines, ctx) => {
    const quote = quoteLines(catalog, lines, { now: ctx.now, tz: ctx.tz });
    if (!quote.ok) fail("invalid_items", quote.errors[0] || "Itens inválidos.", 422, { errors: quote.errors });
    return quote;
};

/* ---------- PEDIDOS ---------- */

const nextCode = async (db, ctx) => {
    const day = dayKey(ctx.now, ctx.tz || DEFAULT_TZ);
    const result = await tx(db, paths(ctx.handle).seq(day), (current) => (Number(current) || 0) + 1);
    return { code: formatCode(result.value), dayKey: day };
};

const trackPatch = (ctx, orderId, order) => ({
    [paths(ctx.handle).track(orderId)]: clean(trackingView(order))
});

const createOrder = async (db, ctx, settings, data) => {
    const orderId = data.orderId || db.newKey();
    const { code, dayKey: day } = await nextCode(db, ctx);

    const status = data.status || initialStatus(data.channel, data.source, settings);

    const order = clean({
        code,
        dayKey: day,
        channel: data.channel,
        source: data.source,
        status,
        tabId: data.tabId || null,
        tableId: data.tableId || null,
        tableLabel: data.tableLabel || null,
        items: data.items,
        customer: data.customer || null,
        fulfillment: data.fulfillment || null,
        totals: data.totals,
        payment: data.payment,
        notes: text(data.notes, 280) || null,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        createdBy: ctx.actor?.uid || null,
        createdByName: ctx.actor?.name || null,
        idempotencyKey: data.idempotencyKey || null,
        external: data.external || null,
        stockApplied: false,
        history: {
            [db.newKey()]: { at: ctx.now, to: status, by: ctx.actor?.uid || null, byName: ctx.actor?.name || (data.source === "staff" ? null : "Cliente") }
        }
    });

    await db.update({
        [paths(ctx.handle).order(orderId)]: order,
        ...trackPatch(ctx, orderId, order)
    });

    if (status !== "received") await applyStock(db, ctx, orderId, -1);

    return { orderId, order };
};

/**
 * Baixa (sign -1) ou devolve (sign +1) o estoque de um pedido.
 *
 * A baixa grava no pedido o que saiu (stockLines). A devolução
 * devolve exatamente isso — inteiro (cancelamento do pedido) ou
 * só a parte de um item (`only` = { productId, qty }) — e nunca
 * devolve mais do que saiu, mesmo chamada duas vezes.
 */
const applyStock = async (db, ctx, orderId, sign, only = null) => {
    const p = paths(ctx.handle);
    let moves = null;

    const result = await db.transaction(p.order(orderId), (order) => {
        moves = null;
        if (order === null) return null;

        if (sign < 0) {
            if (order.stockApplied) return undefined;
            const needs = stockNeeds(order.items);
            moves = needs;
            return { ...order, stockApplied: true, stockLines: needs };
        }

        if (!order.stockApplied) return undefined;
        const lines = { ...(order.stockLines || {}) };

        if (only) {
            const available = Number(lines[only.productId]) || 0;
            const qty = Math.min(available, Number(only.qty) || 0);
            if (!qty) return undefined;
            moves = { [only.productId]: qty };
            lines[only.productId] = available - qty;
            if (!lines[only.productId]) delete lines[only.productId];
            return { ...order, stockLines: Object.keys(lines).length ? lines : null };
        }

        moves = lines;
        return { ...order, stockApplied: false, stockLines: null };
    });

    if (!result.committed || !result.value || !moves) return;

    const order = result.value;

    for (const [productId, qty] of Object.entries(moves)) {
        if (!isId(productId) || !qty) continue;
        let after = null;
        const changed = await db.transaction(p.stock(productId), (entry) => {
            if (entry === null) return null;
            if (entry.track !== true) return undefined;
            const next = Math.round((Number(entry.qty) || 0) + sign * qty);
            after = next;
            return { ...entry, qty: next, updatedAt: ctx.now };
        });

        if (!changed.committed || !changed.value) continue;

        await db.set(p.stockMove(db.newKey()), {
            productId,
            delta: sign * qty,
            after,
            type: sign < 0 ? "sale" : "return",
            orderId,
            reason: sign < 0 ? `Pedido #${order.code}` : `Cancelamento no pedido #${order.code}`,
            by: ctx.actor?.uid || null,
            at: ctx.now
        });

        await syncSoldOut(db, ctx, productId, after);
    }
};

const syncSoldOut = async (db, ctx, productId, qty) => {
    const p = paths(ctx.handle);
    const product = await db.get(p.product(productId));
    if (!product) return;
    const soldOut = Number(qty) <= 0;
    if (Boolean(product.soldOut) !== soldOut) {
        await db.update({ [`${p.product(productId)}/soldOut`]: soldOut });
    }
};

/* ---------- IDEMPOTÊNCIA ----------
   Pedido público e pedido de balcão carregam uma chave
   gerada no navegador. A mesma chave nunca cria dois pedidos:
   a segunda chamada recebe o resultado da primeira. */

const IDEM_KEY = /^[A-Za-z0-9_-]{8,64}$/;

const withIdempotency = async (db, ctx, key, run) => {
    if (!key) return run();
    if (!IDEM_KEY.test(String(key))) fail("bad_request", "Chave de operação inválida.");

    const path = paths(ctx.handle).idem(key);
    let existing = null;

    const claim = await db.transaction(path, (current) => {
        /* "processing" esquecido (função caiu no meio) expira em 2 min. */
        if (current && !(current.status === "processing" && ctx.now - Number(current.at || 0) > 120000)) {
            existing = current;
            return undefined;
        }
        existing = null;
        return { status: "processing", at: ctx.now };
    });

    if (!claim.committed) {
        if (existing?.status === "done") return { ...existing.result, duplicate: true };
        fail("in_progress", "Esta operação já está sendo processada. Aguarde um instante.", 409);
    }

    try {
        const result = await run();
        await db.set(path, { status: "done", at: ctx.now, result: clean(result) });
        return result;
    } catch (error) {
        await db.set(path, null);
        throw error;
    }
};

/* ---------- MESAS ---------- */

const loadTable = async (db, ctx, tableId) => {
    requireId(tableId, "Mesa");
    const table = await db.get(paths(ctx.handle).floorTable(tableId));
    if (!table) fail("table_not_found", "Mesa não encontrada.", 404);
    return { ...table, id: tableId };
};

const openTab = async (db, ctx, payload) => {
    const p = paths(ctx.handle);
    const settings = await loadSettings(db, ctx);

    const tabId = db.newKey();
    let table = null;

    if (payload.tableId) {
        table = await loadTable(db, ctx, payload.tableId);
        if (table.disabled) fail("table_disabled", "Esta mesa está marcada como indisponível.", 409);

        let busyTab = null;

        const claim = await db.transaction(p.tableState(table.id), (current) => {
            if (current && current.tabId) {
                busyTab = current.tabId;
                return undefined;
            }
            busyTab = null;
            return {
                tabId,
                openedAt: ctx.now,
                guests: Math.max(0, Math.min(99, Math.round(Number(payload.guests) || 0))),
                waiterUid: payload.waiterUid || ctx.actor?.uid || null,
                waiterName: text(payload.waiterName || ctx.actor?.name, 80) || null,
                billRequested: false,
                reservation: null
            };
        });

        if (!claim.committed) {
            fail("table_busy", "Esta mesa já foi aberta por outra pessoa.", 409, { tabId: busyTab });
        }
    }

    const tab = createTab({
        id: tabId,
        tableId: table?.id || null,
        label: table ? table.label : text(payload.label, 40) || null,
        guests: payload.guests,
        customerName: payload.customerName,
        waiterUid: payload.waiterUid || ctx.actor?.uid || null,
        waiterName: payload.waiterName || ctx.actor?.name || null,
        notes: payload.notes,
        serviceFeePercent: settings?.tables?.serviceFeePercent,
        actor: ctx.actor,
        now: ctx.now
    });

    if (!table && !tab.label) {
        if (table === null && payload.tableId) fail("bad_request", "Mesa inválida.");
        fail("bad_request", "Dê um nome ou número para a comanda.");
    }

    try {
        await db.set(p.tab(tabId), clean(tab));
    } catch (error) {
        if (table) {
            await db.transaction(p.tableState(table.id), (current) => (current && current.tabId === tabId ? null : undefined));
        }
        throw error;
    }

    return { tabId, tableId: table?.id || null };
};

const loadTab = async (db, ctx, tabId) => {
    requireId(tabId, "Comanda");
    const tab = await db.get(paths(ctx.handle).tab(tabId));
    if (!tab) fail("tab_not_found", "Comanda não encontrada.", 404);
    return tab;
};

const mutateTab = async (db, ctx, tabId, fn) => {
    requireId(tabId, "Comanda");
    let extra = null;
    const result = await txExisting(
        db,
        paths(ctx.handle).tab(tabId),
        (current) => {
            const output = fn(current);
            if (output && output.tab) {
                extra = output;
                return clean(output.tab);
            }
            extra = null;
            return clean(output);
        },
        "Comanda não encontrada."
    );
    return { tab: result.value, extra };
};

/** Cria pedidos para itens "enviados" cujo pedido não chegou a ser gravado. */
const repairTabOrders = async (db, ctx, tabId, settings) => {
    const tab = await loadTab(db, ctx, tabId);
    const groups = {};
    entries(tab.items)
        .filter((item) => item.status === "sent" && item.orderId)
        .forEach((item) => {
            (groups[item.orderId] = groups[item.orderId] || []).push(item);
        });

    for (const [orderId, items] of Object.entries(groups)) {
        const exists = await db.get(paths(ctx.handle).order(orderId));
        if (!exists) await createTableOrder(db, ctx, settings, tab, orderId, items, "staff");
    }
};

const createTableOrder = (db, ctx, settings, tab, orderId, items, source) => {
    const subtotal = items.reduce((sum, item) => sum + cents(item.unitCents) * (Number(item.qty) || 0), 0);
    return createOrder(db, ctx, settings, {
        orderId,
        channel: tab.tableId ? "table" : "counter",
        source,
        tabId: tab.id || null,
        tableId: tab.tableId || null,
        tableLabel: tab.label || null,
        items: items.map(({ status, orderId: _o, addedAt, addedBy, sentAt, ...line }) => ({ ...line, tabItemId: line.id })),
        customer: tab.customerName ? { name: tab.customerName } : null,
        totals: { subtotalCents: subtotal, deliveryFeeCents: 0, discountCents: 0, totalCents: subtotal },
        payment: { method: null, status: "tab", paidCents: 0 }
    });
};

const sendTab = async (db, ctx, tabId, source = "staff") => {
    const settings = await loadSettings(db, ctx);
    await repairTabOrders(db, ctx, tabId, settings);

    const orderId = db.newKey();
    const { tab, extra } = await mutateTab(db, ctx, tabId, (current) => sendPending({ ...current, id: tabId }, { orderId, now: ctx.now }));
    const { order } = await createTableOrder(db, ctx, settings, { ...tab, id: tabId }, orderId, extra.sent, source);

    return { orderId, code: order.code, sent: extra.sent.length };
};

const releaseTable = (db, ctx, tableId, tabId) =>
    tableId
        ? db.transaction(paths(ctx.handle).tableState(tableId), (current) => {
            if (current === null) return null;
            return current.tabId === tabId ? null : undefined;
        })
        : Promise.resolve();

const resolveCallsFor = async (db, ctx, tableId) => {
    if (!tableId) return;
    const calls = entries(await db.get(paths(ctx.handle).calls)).filter((call) => call.tableId === tableId && call.status === "open");
    if (!calls.length) return;
    const patch = {};
    calls.forEach((call) => {
        patch[`${paths(ctx.handle).call(call.id)}/status`] = "resolved";
        patch[`${paths(ctx.handle).call(call.id)}/resolvedAt`] = ctx.now;
    });
    await db.update(patch);
};

/* ---------- AÇÕES ---------- */

/* Permissão exigida (uma lista = basta ter qualquer uma). */
const permissionsFor = (action, payload) => {
    if (action === "tabs.adjust" || action === "tabs.voidAdjustment") {
        return [payload?.type === "service" ? "tabs.serviceFee" : "tabs.discount"];
    }
    const value = ACTIONS[action]?.permission;
    return Array.isArray(value) ? value : value ? [value] : [];
};

export const ACTIONS = {
    "tables.open": {
        permission: "tables.open",
        run: (db, ctx, payload) => openTab(db, ctx, payload)
    },

    "tables.reserve": {
        permission: "tables.open",
        run: async (db, ctx, { tableId, reservation }) => {
            await loadTable(db, ctx, tableId);
            const value = reservation
                ? { name: text(reservation.name, 60) || "Reserva", time: text(reservation.time, 20) || null, notes: text(reservation.notes, 140) || null, by: ctx.actor?.uid || null, at: ctx.now }
                : null;
            await tx(db, paths(ctx.handle).tableState(tableId), (current) => {
                if (current && current.tabId) fail("table_busy", "A mesa está ocupada.", 409);
                if (!value) return null;
                return { ...(current || {}), reservation: value };
            });
            return { ok: true };
        }
    },

    "tabs.addItems": {
        permission: "tables.order",
        run: async (db, ctx, { tabId, lines, send, person }) => {
            await loadSettings(db, ctx);
            const catalog = await loadCatalog(db, ctx);
            const quote = quoteOrFail(catalog, lines, ctx);
            const ids = quote.lines.map(() => db.newKey());

            await mutateTab(db, ctx, tabId, (current) =>
                addItems(current, quote.lines.map((item) => ({ ...item.line, person: item.selection?.person || null })), { ids, actor: ctx.actor, now: ctx.now, person })
            );

            if (send) {
                const sent = await sendTab(db, ctx, tabId);
                return { itemIds: ids, ...sent };
            }

            return { itemIds: ids };
        }
    },

    "tabs.send": {
        permission: "tables.order",
        run: (db, ctx, { tabId }) => sendTab(db, ctx, tabId)
    },

    "tabs.removePending": {
        permission: "tables.removePending",
        run: async (db, ctx, { tabId, itemId }) => {
            requireId(itemId, "Item");
            await mutateTab(db, ctx, tabId, (current) => removePendingItem(current, itemId, { now: ctx.now }));
            return { ok: true };
        }
    },

    "tabs.cancelItem": {
        permission: "tabs.cancelItem",
        run: async (db, ctx, { tabId, itemId, reason }) => {
            requireId(itemId, "Item");
            const before = await loadTab(db, ctx, tabId);
            const item = before.items?.[itemId];
            const { tab } = await mutateTab(db, ctx, tabId, (current) => cancelItem(current, itemId, { reason, actor: ctx.actor, now: ctx.now }));

            /* Reflete no pedido da cozinha. */
            if (item?.orderId) {
                const p = paths(ctx.handle);
                let allCancelled = false;
                const result = await db.transaction(p.order(item.orderId), (order) => {
                    if (order === null) return null;
                    const items = asList(order.items).map((line) =>
                        line.tabItemId === itemId ? { ...line, status: "cancelled", cancelReason: text(reason, 140) } : line
                    );
                    allCancelled = items.every((line) => line.status === "cancelled");
                    return clean({
                        ...order,
                        items,
                        status: allCancelled && !TERMINAL.includes(order.status) ? "cancelled" : order.status,
                        cancel: allCancelled ? { reason: "Todos os itens cancelados na comanda", by: ctx.actor?.uid || null, at: ctx.now } : order.cancel || null,
                        updatedAt: ctx.now
                    });
                });
                if (result.committed && result.value) {
                    await db.update(trackPatch(ctx, item.orderId, result.value));
                    await applyStock(db, ctx, item.orderId, 1, { productId: item.productId, qty: item.qty });
                }
            }

            await audit(db, ctx, "tab.item_cancelled", {
                tabId,
                tableLabel: tab.label,
                itemId,
                item: item ? { name: item.name, qty: item.qty, unitCents: item.unitCents, wasStatus: item.status } : null,
                reason: text(reason, 140)
            });

            return { ok: true };
        }
    },

    "tabs.adjust": {
        run: async (db, ctx, { tabId, type, mode, value, reason }) => {
            const id = db.newKey();
            const { tab } = await mutateTab(db, ctx, tabId, (current) =>
                applyAdjustment(current, { id, type, mode, value, reason, actor: ctx.actor, now: ctx.now })
            );
            await audit(db, ctx, type === "discount" ? "tab.discount" : "tab.service_fee", {
                tabId,
                tableLabel: tab.label,
                adjustmentId: id,
                mode,
                value,
                reason: text(reason, 140),
                totalCents: tab.totals?.totalCents
            });
            return { adjustmentId: id };
        }
    },

    "tabs.voidAdjustment": {
        run: async (db, ctx, { tabId, adjustmentId, reason }) => {
            requireId(adjustmentId, "Ajuste");
            const before = await loadTab(db, ctx, tabId);
            const adjustment = before.adjustments?.[adjustmentId];
            const { tab } = await mutateTab(db, ctx, tabId, (current) => voidAdjustment(current, adjustmentId, { reason, actor: ctx.actor, now: ctx.now }));
            await audit(db, ctx, "tab.adjustment_voided", { tabId, tableLabel: tab.label, adjustmentId, adjustment, reason: text(reason, 140) });
            return { ok: true };
        }
    },

    "tabs.pay": {
        permission: "tabs.payment",
        run: async (db, ctx, { tabId, paymentId, method, amountCents, receivedCents, person }) => {
            requireId(paymentId, "Pagamento");
            if (!PAYMENT_METHODS[method]) fail("method", "Forma de pagamento inválida.");
            const { tab, extra } = await mutateTab(db, ctx, tabId, (current) =>
                registerPayment(current, { paymentId, method, amountCents, receivedCents, person, actor: ctx.actor, now: ctx.now })
            );
            if (!extra.duplicate) {
                await ledger(db, ctx, { id: paymentId, kind: "payment", source: "tab", refId: tabId, label: tab.label, method, amountCents: cents(amountCents) });
            }
            return { paymentId, duplicate: Boolean(extra.duplicate), balanceCents: tab.totals?.balanceCents };
        }
    },

    "tabs.refund": {
        permission: "tabs.refund",
        run: async (db, ctx, { tabId, paymentId, reason }) => {
            requireId(paymentId, "Pagamento");
            const { tab, extra } = await mutateTab(db, ctx, tabId, (current) => refundPayment(current, paymentId, { reason, actor: ctx.actor, now: ctx.now }));
            if (!extra.duplicate) {
                const payment = tab.payments?.[paymentId];
                await ledger(db, ctx, { id: `refund_${paymentId}`, kind: "refund", source: "tab", refId: tabId, label: tab.label, method: payment?.method, amountCents: -cents(payment?.amountCents) });
                await audit(db, ctx, "tab.refund", { tabId, tableLabel: tab.label, paymentId, amountCents: payment?.amountCents, method: payment?.method, reason: text(reason, 140) });
            }
            return { ok: true };
        }
    },

    "tabs.requestBill": {
        permission: "tables.view",
        run: async (db, ctx, { tabId }) => {
            const { tab } = await mutateTab(db, ctx, tabId, (current) => {
                if (current.status !== "open") fail("tab_closed", "Comanda fechada.", 409);
                return { ...current, billRequested: true, updatedAt: ctx.now };
            });
            if (tab.tableId) {
                await db.transaction(paths(ctx.handle).tableState(tab.tableId), (current) => {
                    if (current === null) return null;
                    return current.tabId === tabId ? { ...current, billRequested: true } : undefined;
                });
            }
            return { ok: true };
        }
    },

    "tabs.close": {
        permission: "tabs.close",
        run: async (db, ctx, { tabId }) => {
            const { tab } = await mutateTab(db, ctx, tabId, (current) => closeTab(current, { actor: ctx.actor, now: ctx.now }));
            await releaseTable(db, ctx, tab.tableId, tabId);
            await resolveCallsFor(db, ctx, tab.tableId);
            return { ok: true, totalCents: tab.totals?.totalCents };
        }
    },

    "tabs.reopen": {
        permission: "tabs.reopen",
        run: async (db, ctx, { tabId, reason }) => {
            const before = await loadTab(db, ctx, tabId);
            if (before.tableId) {
                await tx(db, paths(ctx.handle).tableState(before.tableId), (current) => {
                    if (current && current.tabId && current.tabId !== tabId) {
                        fail("table_busy", "A mesa já tem outra comanda aberta. Feche-a ou transfira antes de reabrir.", 409);
                    }
                    return {
                        tabId,
                        openedAt: before.openedAt,
                        guests: before.guests || 0,
                        waiterUid: before.waiterUid || null,
                        waiterName: before.waiterName || null,
                        billRequested: false,
                        reservation: null
                    };
                });
            }
            const { tab } = await mutateTab(db, ctx, tabId, (current) => reopenTab(current, { reason, actor: ctx.actor, now: ctx.now }));
            await audit(db, ctx, "tab.reopened", { tabId, tableLabel: tab.label, reason: text(reason, 140) });
            return { ok: true };
        }
    },

    "tabs.update": {
        permission: "tables.open",
        run: async (db, ctx, { tabId, guests, customerName, waiterUid, waiterName, notes }) => {
            const { tab } = await mutateTab(db, ctx, tabId, (current) => {
                if (current.status !== "open") fail("tab_closed", "Comanda fechada.", 409);
                return {
                    ...current,
                    guests: guests === undefined ? current.guests : Math.max(0, Math.min(99, Math.round(Number(guests) || 0))),
                    customerName: customerName === undefined ? current.customerName : text(customerName, 80) || null,
                    waiterUid: waiterUid === undefined ? current.waiterUid : waiterUid || null,
                    waiterName: waiterName === undefined ? current.waiterName : text(waiterName, 80) || null,
                    notes: notes === undefined ? current.notes : text(notes, 280) || null,
                    updatedAt: ctx.now
                };
            });
            if (tab.tableId) {
                await db.transaction(paths(ctx.handle).tableState(tab.tableId), (current) => {
                    if (current === null) return null;
                    if (current.tabId !== tabId) return undefined;
                    return { ...current, guests: tab.guests || 0, waiterUid: tab.waiterUid || null, waiterName: tab.waiterName || null };
                });
            }
            return { ok: true };
        }
    },

    "tabs.transferItems": {
        permission: "tables.transfer",
        run: async (db, ctx, { fromTabId, toTabId, itemIds }) => {
            requireId(toTabId, "Comanda de destino");
            if (fromTabId === toTabId) fail("same_tab", "Escolha outra comanda de destino.");
            const target = await loadTab(db, ctx, toTabId);
            if (target.status !== "open") fail("tab_closed", "A comanda de destino está fechada.", 409);

            const { extra } = await mutateTab(db, ctx, fromTabId, (current) => takeItems(current, itemIds, { now: ctx.now, toTabId }));

            try {
                await mutateTab(db, ctx, toTabId, (current) => putItems(current, extra.taken, { now: ctx.now, fromTabId }));
            } catch (error) {
                /* Devolve à origem: nada se perde no meio do caminho. */
                await mutateTab(db, ctx, fromTabId, (current) => ({ tab: putItems(current, extra.taken, { now: ctx.now, fromTabId: toTabId }) }));
                throw error;
            }

            await audit(db, ctx, "tab.items_transferred", { fromTabId, toTabId, items: extra.taken.map((item) => ({ id: item.id, name: item.name, qty: item.qty })) });
            return { moved: extra.taken.length };
        }
    },

    "tables.move": {
        permission: "tables.transfer",
        run: async (db, ctx, { tabId, toTableId }) => {
            const tab = await loadTab(db, ctx, tabId);
            if (tab.status !== "open") fail("tab_closed", "Comanda fechada.", 409);
            const table = await loadTable(db, ctx, toTableId);
            if (table.disabled) fail("table_disabled", "A mesa de destino está indisponível.", 409);
            if (tab.tableId === table.id) fail("same_table", "A comanda já está nessa mesa.");

            await tx(db, paths(ctx.handle).tableState(table.id), (current) => {
                if (current && current.tabId) fail("table_busy", "A mesa de destino está ocupada. Use “Unir mesas”.", 409);
                return {
                    tabId,
                    openedAt: tab.openedAt,
                    guests: tab.guests || 0,
                    waiterUid: tab.waiterUid || null,
                    waiterName: tab.waiterName || null,
                    billRequested: Boolean(tab.billRequested),
                    reservation: null
                };
            });

            await releaseTable(db, ctx, tab.tableId, tabId);
            await mutateTab(db, ctx, tabId, (current) => ({ ...current, tableId: table.id, label: table.label, updatedAt: ctx.now }));
            await audit(db, ctx, "tab.table_moved", { tabId, from: tab.label, to: table.label });
            return { ok: true };
        }
    },

    "tables.merge": {
        permission: "tables.transfer",
        run: async (db, ctx, { fromTabId, intoTabId }) => {
            requireId(intoTabId, "Comanda");
            if (fromTabId === intoTabId) fail("same_tab", "Escolha outra mesa.");
            const from = await loadTab(db, ctx, fromTabId);
            const into = await loadTab(db, ctx, intoTabId);
            if (from.status !== "open" || into.status !== "open") fail("tab_closed", "As duas comandas precisam estar abertas.", 409);
            if (entries(from.payments).some((payment) => payment.status === "confirmed")) {
                fail("has_payments", "A mesa de origem já tem pagamentos. Feche-a separadamente.", 409);
            }

            const ids = entries(from.items).filter((item) => item.status !== "cancelled").map((item) => item.id);
            let taken = [];

            if (ids.length) {
                const moved = await mutateTab(db, ctx, fromTabId, (current) => takeItems(current, ids, { now: ctx.now, toTabId: intoTabId }));
                taken = moved.extra.taken;
                await mutateTab(db, ctx, intoTabId, (current) => putItems(current, taken, { now: ctx.now, fromTabId }));
            }

            const guests = (Number(from.guests) || 0) + (Number(into.guests) || 0);

            await mutateTab(db, ctx, intoTabId, (current) => ({ ...current, guests, updatedAt: ctx.now, mergedFrom: { ...(current.mergedFrom || {}), [fromTabId]: from.label || fromTabId } }));
            await mutateTab(db, ctx, fromTabId, (current) => ({ ...current, status: "merged", mergedInto: intoTabId, closedAt: ctx.now, closedBy: ctx.actor?.uid || null, updatedAt: ctx.now }));
            await releaseTable(db, ctx, from.tableId, fromTabId);

            if (into.tableId) {
                await db.transaction(paths(ctx.handle).tableState(into.tableId), (current) => {
                    if (current === null) return null;
                    return current.tabId === intoTabId ? { ...current, guests } : undefined;
                });
            }

            await audit(db, ctx, "tab.merged", { fromTabId, intoTabId, from: from.label, into: into.label, items: taken.length });
            return { ok: true };
        }
    },

    "calls.resolve": {
        permission: "tables.view",
        run: async (db, ctx, { callId }) => {
            requireId(callId, "Chamado");
            await db.update({
                [`${paths(ctx.handle).call(callId)}/status`]: "resolved",
                [`${paths(ctx.handle).call(callId)}/resolvedAt`]: ctx.now,
                [`${paths(ctx.handle).call(callId)}/resolvedBy`]: ctx.actor?.uid || null
            });
            return { ok: true };
        }
    },

    /* ---------- PEDIDOS ---------- */

    "orders.create": {
        permission: "orders.create",
        idempotent: true,
        run: async (db, ctx, payload) => {
            const settings = await loadSettings(db, ctx);
            const catalog = await loadCatalog(db, ctx);
            const quote = quoteOrFail(catalog, payload.lines, ctx);

            const channel = ["counter", "pickup", "delivery"].includes(payload.channel) ? payload.channel : "counter";
            const method = payload.payment?.method || null;
            if (method && !PAYMENT_METHODS[method]) fail("method", "Forma de pagamento inválida.");

            const paidNow = payload.payment?.status === "paid";
            if (paidNow && !can(ctx.role, "orders.payment", ctx.grants)) fail("forbidden", "Você não tem permissão para confirmar pagamentos.", 403);
            if (paidNow && !method) fail("method", "Informe a forma de pagamento.");

            let fee = 0;
            let address = null;
            if (channel === "delivery") {
                address = text(payload.fulfillment?.address, 240);
                if (address.length < 5) fail("address", "Informe o endereço de entrega.");
                fee = Math.max(0, cents(payload.fulfillment?.deliveryFeeCents ?? settings?.fulfillment?.delivery?.feeCents));
            }

            const name = text(payload.customer?.name, 80);
            if ((channel === "pickup" || channel === "delivery") && name.length < 2) fail("customer", "Informe o nome do cliente.");

            const subtotal = quote.subtotalCents;
            const total = subtotal + fee;

            const { orderId, order } = await createOrder(db, ctx, settings, {
                channel,
                source: "staff",
                items: quote.lines.map((item) => ({ ...item.line, id: db.newKey() })),
                customer: name || payload.customer?.phone ? { name: name || null, phone: String(payload.customer?.phone || "").replace(/\D/g, "").slice(0, 13) || null } : null,
                fulfillment: { mode: channel, address, etaMinutes: null },
                totals: { subtotalCents: subtotal, deliveryFeeCents: fee, discountCents: 0, totalCents: total },
                payment: paidNow
                    ? { method, status: "paid", paidCents: total, paidAt: ctx.now, by: ctx.actor?.uid || null }
                    : { method, status: "pending", paidCents: 0 },
                notes: payload.notes,
                idempotencyKey: payload.idempotencyKey
            });

            if (paidNow) {
                await ledger(db, ctx, { id: `order_${orderId}`, kind: "payment", source: "order", refId: orderId, label: `#${order.code}`, method, amountCents: total });
            }

            return { orderId, code: order.code };
        }
    },

    "orders.status": {
        permission: ["orders.status", "delivery.update"],
        run: async (db, ctx, { orderId, to }) => {
            requireId(orderId, "Pedido");
            const settings = await loadSettings(db, ctx);
            let from = null;

            const result = await txExisting(db, paths(ctx.handle).order(orderId), (order) => {
                from = order.status;
                if (TERMINAL.includes(order.status)) fail("finished", "Este pedido já foi encerrado.", 409);
                if (!can(ctx.role, "orders.status", ctx.grants)) {
                    /* Só com permissão de entrega: pedido de delivery, a partir de "Pronto". */
                    if (order.channel !== "delivery" || !["out_for_delivery", "completed"].includes(to)) {
                        fail("forbidden", "Seu perfil só atualiza pedidos de entrega.", 403);
                    }
                }
                if (!canMove(order, to, settings)) {
                    fail("bad_transition", `Não é possível ir de "${order.status}" para "${to}".`, 409, { flow: flowFor(order.channel, settings) });
                }
                return clean({
                    ...order,
                    status: to,
                    updatedAt: ctx.now,
                    [`${to}At`]: ctx.now,
                    history: { ...(order.history || {}), [db.newKey()]: { at: ctx.now, from: order.status, to, by: ctx.actor?.uid || null, byName: ctx.actor?.name || null } }
                });
            }, "Pedido não encontrado.");

            await db.update(trackPatch(ctx, orderId, result.value));

            if (from === "received" && to !== "received") await applyStock(db, ctx, orderId, -1);

            return { status: to };
        }
    },

    "orders.cancel": {
        permission: "orders.cancel",
        run: async (db, ctx, { orderId, reason, publicReason }) => {
            requireId(orderId, "Pedido");
            const why = text(reason, 140);
            if (why.length < 3) fail("reason", "Informe o motivo do cancelamento.");

            const result = await txExisting(db, paths(ctx.handle).order(orderId), (order) => {
                if (TERMINAL.includes(order.status)) fail("finished", "Este pedido já foi encerrado.", 409);
                return clean({
                    ...order,
                    status: "cancelled",
                    updatedAt: ctx.now,
                    cancelledAt: ctx.now,
                    cancel: { reason: why, publicReason: text(publicReason, 140) || null, by: ctx.actor?.uid || null, byName: ctx.actor?.name || null, at: ctx.now, fromStatus: order.status },
                    refundPending: order.payment?.status === "paid",
                    history: { ...(order.history || {}), [db.newKey()]: { at: ctx.now, from: order.status, to: "cancelled", by: ctx.actor?.uid || null, byName: ctx.actor?.name || null, note: why } }
                });
            }, "Pedido não encontrado.");

            const order = result.value;
            await db.update(trackPatch(ctx, orderId, order));
            await applyStock(db, ctx, orderId, 1);

            /* Itens de comanda: cancelados também na conta. */
            if (order.tabId) {
                try {
                    await mutateTab(db, ctx, order.tabId, (tab) => {
                        const items = { ...(tab.items || {}) };
                        Object.keys(items).forEach((id) => {
                            if (items[id].orderId === orderId && items[id].status !== "cancelled") {
                                items[id] = { ...items[id], status: "cancelled", cancel: { reason: why, by: ctx.actor?.uid || null, at: ctx.now, wasStatus: items[id].status, viaOrder: orderId } };
                            }
                        });
                        if (tab.status !== "open") return tab;
                        const next = cancelledTotals({ ...tab, items }, ctx.now);
                        return next;
                    });
                } catch (error) {
                    if (!(error instanceof MenusError)) throw error;
                }
            }

            await audit(db, ctx, "order.cancelled", { orderId, code: order.code, channel: order.channel, totalCents: order.totals?.totalCents, reason: why, paid: order.payment?.status === "paid" });

            return { ok: true, refundPending: Boolean(order.refundPending) };
        }
    },

    "orders.pay": {
        permission: "orders.payment",
        run: async (db, ctx, { orderId, method }) => {
            requireId(orderId, "Pedido");
            if (!PAYMENT_METHODS[method]) fail("method", "Forma de pagamento inválida.");
            let duplicate = false;
            const result = await txExisting(db, paths(ctx.handle).order(orderId), (order) => {
                if (order.payment?.status === "paid") {
                    duplicate = true;
                    return order;
                }
                duplicate = false;
                if (order.payment?.status === "tab") fail("tab_payment", "Este pedido é pago na comanda da mesa.", 409);
                if (order.status === "cancelled") fail("cancelled", "Pedido cancelado.", 409);
                return clean({
                    ...order,
                    payment: { ...(order.payment || {}), method, status: "paid", paidCents: order.totals?.totalCents || 0, paidAt: ctx.now, by: ctx.actor?.uid || null, byName: ctx.actor?.name || null },
                    updatedAt: ctx.now
                });
            }, "Pedido não encontrado.");

            const order = result.value;
            if (!duplicate) {
                await db.update(trackPatch(ctx, orderId, order));
                await ledger(db, ctx, { id: `order_${orderId}`, kind: "payment", source: "order", refId: orderId, label: `#${order.code}`, method, amountCents: order.totals?.totalCents || 0 });
            }
            return { ok: true, duplicate };
        }
    },

    "orders.refund": {
        permission: "tabs.refund",
        run: async (db, ctx, { orderId, reason }) => {
            requireId(orderId, "Pedido");
            const why = text(reason, 140);
            if (why.length < 3) fail("reason", "Informe o motivo do estorno.");
            let duplicate = false;
            const result = await txExisting(db, paths(ctx.handle).order(orderId), (order) => {
                if (order.payment?.status === "refunded") {
                    duplicate = true;
                    return order;
                }
                duplicate = false;
                if (order.payment?.status !== "paid") fail("not_paid", "Este pedido não tem pagamento confirmado.", 409);
                return clean({
                    ...order,
                    payment: { ...order.payment, status: "refunded", refund: { reason: why, by: ctx.actor?.uid || null, at: ctx.now } },
                    refundPending: false,
                    updatedAt: ctx.now
                });
            }, "Pedido não encontrado.");

            const order = result.value;
            if (!duplicate) {
                await db.update(trackPatch(ctx, orderId, order));
                await ledger(db, ctx, { id: `refund_order_${orderId}`, kind: "refund", source: "order", refId: orderId, label: `#${order.code}`, method: order.payment?.method, amountCents: -(order.payment?.paidCents || 0) });
                await audit(db, ctx, "order.refund", { orderId, code: order.code, amountCents: order.payment?.paidCents, reason: why });
            }
            return { ok: true, duplicate };
        }
    },

    "orders.assign": {
        permission: "orders.status",
        run: async (db, ctx, { orderId, uid, name }) => {
            requireId(orderId, "Pedido");
            await txExisting(db, paths(ctx.handle).order(orderId), (order) => ({
                ...order,
                assigneeUid: uid || null,
                assigneeName: text(name, 80) || null,
                updatedAt: ctx.now
            }), "Pedido não encontrado.");
            return { ok: true };
        }
    },

    /* ---------- ESTOQUE ---------- */

    "stock.set": {
        permission: "stock.edit",
        run: async (db, ctx, { productId, track, qty, min }) => {
            requireId(productId, "Produto");
            const product = await db.get(paths(ctx.handle).product(productId));
            if (!product) fail("product_not_found", "Produto não encontrado.", 404);

            let before = null;
            const result = await tx(db, paths(ctx.handle).stock(productId), (current) => {
                before = current;
                return {
                    track: track === undefined ? Boolean(current?.track) : Boolean(track),
                    qty: qty === undefined ? Number(current?.qty) || 0 : Math.round(Number(qty) || 0),
                    min: min === undefined ? Number(current?.min) || 0 : Math.max(0, Math.round(Number(min) || 0)),
                    updatedAt: ctx.now
                };
            });

            const entry = result.value;
            if (qty !== undefined && Math.round(Number(qty) || 0) !== (Number(before?.qty) || 0)) {
                await db.set(paths(ctx.handle).stockMove(db.newKey()), {
                    productId,
                    delta: entry.qty - (Number(before?.qty) || 0),
                    after: entry.qty,
                    type: "adjust",
                    reason: "Contagem",
                    by: ctx.actor?.uid || null,
                    at: ctx.now
                });
            }

            await db.update({ [`${paths(ctx.handle).product(productId)}/soldOut`]: entry.track ? entry.qty <= 0 : false });
            return { qty: entry.qty };
        }
    },

    "stock.move": {
        permission: "stock.edit",
        run: async (db, ctx, { productId, delta, type, reason }) => {
            requireId(productId, "Produto");
            if (!["entry", "loss"].includes(type)) fail("type", "Tipo de movimento inválido.");
            const amount = Math.abs(Math.round(Number(delta) || 0));
            if (!amount) fail("delta", "Informe a quantidade.");
            const signed = type === "loss" ? -amount : amount;

            const result = await txExisting(db, paths(ctx.handle).stock(productId), (entry) => {
                if (!entry.track) fail("not_tracked", "Ligue o controle de estoque deste produto primeiro.", 409);
                return { ...entry, qty: (Number(entry.qty) || 0) + signed, updatedAt: ctx.now };
            }, "Controle de estoque não configurado para este produto.");

            await db.set(paths(ctx.handle).stockMove(db.newKey()), {
                productId,
                delta: signed,
                after: result.value.qty,
                type,
                reason: text(reason, 140) || null,
                by: ctx.actor?.uid || null,
                at: ctx.now
            });

            await syncSoldOut(db, ctx, productId, result.value.qty);
            return { qty: result.value.qty };
        }
    },

    /* ---------- PLANTA E PUBLICAÇÃO ----------
       Passam pelo servidor para valer o limite de mesas do
       plano e os modelos/ajustes que o plano inclui. */

    "floor.save": {
        permission: "tables.layout",
        run: async (db, ctx, { areas, tables, baseVersion }) => {
            const p = paths(ctx.handle);
            const areaList = entries(areas).slice(0, 30);
            const tableList = entries(tables);

            const max = ctx.limits?.menusMaxTables;
            if (max !== null && max !== undefined && tableList.length > max) {
                fail("limit", `O plano atual permite até ${max} mesas.`, 403, { limit: max });
            }
            if (tableList.length > 500) fail("limit", "Limite técnico de 500 mesas por planta.");

            const areaIds = new Set(areaList.map((area) => area.id));
            const cleanAreas = {};
            areaList.forEach((area, index) => {
                requireId(area.id, "Ambiente");
                cleanAreas[area.id] = { name: text(area.name, 40) || "Ambiente", order: Number(area.order) || index };
            });

            const cleanTables = {};
            tableList.forEach((table, index) => {
                requireId(table.id, "Mesa");
                const label = text(table.label, 24);
                if (!label) fail("label", "Toda mesa precisa de um identificador.");
                cleanTables[table.id] = {
                    label,
                    nickname: text(table.nickname, 40) || null,
                    seats: Math.max(1, Math.min(60, Math.round(Number(table.seats) || 4))),
                    areaId: areaIds.has(table.areaId) ? table.areaId : areaList[0]?.id || null,
                    shape: ["square", "round", "rect", "bar"].includes(table.shape) ? table.shape : "square",
                    x: Math.max(0, Math.min(3000, Math.round(Number(table.x) || 0))),
                    y: Math.max(0, Math.min(3000, Math.round(Number(table.y) || 0))),
                    w: Math.max(40, Math.min(600, Math.round(Number(table.w) || 90))),
                    h: Math.max(40, Math.min(600, Math.round(Number(table.h) || 90))),
                    rotation: [0, 45, 90].includes(Number(table.rotation)) ? Number(table.rotation) : 0,
                    disabled: table.disabled === true,
                    order: Number(table.order) || index
                };
            });

            const labels = Object.values(cleanTables).map((table) => table.label.toLowerCase());
            const repeated = labels.find((label, index) => labels.indexOf(label) !== index);
            if (repeated) fail("duplicate_label", `Há duas mesas chamadas "${repeated}". Use identificadores diferentes.`);

            const states = (await db.get(`${p.ops}/tableState`)) || {};
            const current = (await db.get(p.floor)) || {};
            Object.keys(current.tables || {}).forEach((id) => {
                if (!cleanTables[id] && states[id]?.tabId) {
                    fail("table_in_use", `A mesa ${current.tables[id].label} está aberta e não pode ser removida agora.`, 409);
                }
            });

            const result = await tx(db, p.floor, (floor) => {
                const version = Number(floor?.version) || 0;
                if (baseVersion !== undefined && baseVersion !== null && Number(baseVersion) !== version) {
                    fail("conflict", "A planta foi alterada em outro aparelho. Recarregue para ver a versão atual.", 409);
                }
                return { areas: cleanAreas, tables: cleanTables, version: version + 1, updatedAt: ctx.now, updatedBy: ctx.actor?.uid || null };
            });

            return { version: result.value.version };
        }
    },

    "design.publish": {
        permission: "design.publish",
        run: async (db, ctx) => {
            const p = paths(ctx.handle);
            const [draft, settings] = await Promise.all([db.get(p.draft), loadSettings(db, ctx)]);
            if (!draft?.design) fail("no_draft", "Salve a aparência antes de publicar.", 409);

            const design = normalizeDesign(draft.design, { advanced: ctx.features.menusAdvancedDesign });
            const downgraded = draft.design.templateId && draft.design.templateId !== design.templateId;

            const slug = String(settings?.slug || "").toLowerCase();
            const problem = slugProblem(slug, ctx.handle);
            if (problem) fail("slug", `Endereço público: ${problem}`, 422);

            const claim = await db.transaction(p.slug(slug), (current) => {
                if (current && current !== ctx.handle) return undefined;
                return ctx.handle;
            });
            if (!claim.committed) fail("slug_taken", "Este endereço já é usado por outro estabelecimento.", 409);

            const previous = await db.get(p.site);
            const patch = {
                [p.site]: clean({
                    handle: ctx.handle,
                    slug,
                    design,
                    /* O que o cardápio público pode oferecer (o servidor
                       confere de novo a cada pedido). */
                    features: {
                        menusOrdering: Boolean(ctx.features.menusOrdering),
                        menusTables: Boolean(ctx.features.menusTables)
                    },
                    publishedAt: ctx.now,
                    publishedBy: ctx.actor?.uid || null,
                    draftUpdatedAt: draft.updatedAt || null
                }),
                [`${p.draft}/lastPublishedAt`]: ctx.now
            };
            if (previous?.slug && previous.slug !== slug) patch[p.slug(previous.slug)] = null;

            await db.update(patch);
            return { slug, publishedAt: ctx.now, downgraded: Boolean(downgraded) };
        }
    },

    "design.unpublish": {
        permission: "design.publish",
        run: async (db, ctx) => {
            const p = paths(ctx.handle);
            const site = await db.get(p.site);
            const patch = { [p.site]: null };
            if (site?.slug) patch[p.slug(site.slug)] = null;
            await db.update(patch);
            return { ok: true };
        }
    },

    /* ---------- PÚBLICO (cliente final, sem login) ---------- */

    "public.placeOrder": {
        public: true,
        feature: "menusOrdering",
        idempotent: true,
        run: async (db, ctx, payload) => {
            const settings = await loadSettings(db, ctx);
            const catalog = await loadCatalog(db, ctx);
            const quote = quoteLines(catalog, payload.lines, { now: ctx.now, tz: ctx.tz });

            const checkout = validateCheckout(settings, quote, payload, { now: ctx.now, orderingAllowed: ctx.features.menusOrdering });
            if (!checkout.ok) fail("checkout", checkout.errors[0], 422, { errors: checkout.errors });

            /* Estoque: não aceita mais do que existe. */
            const needs = stockNeeds(quote.lines.map((item) => item.line));
            for (const [productId, qty] of Object.entries(needs)) {
                const entry = await db.get(paths(ctx.handle).stock(productId));
                if (entry?.track && Number(entry.qty) < qty) {
                    const name = quote.lines.find((item) => item.line.productId === productId)?.line?.name || "Um produto";
                    fail("stock", `${name}: só restam ${Math.max(0, Number(entry.qty) || 0)} unidade(s).`, 409);
                }
            }

            if (checkout.fulfillment.mode === "dine_in") {
                return placeTableOrder(db, ctx, settings, quote, checkout, payload);
            }

            const { orderId, order } = await createOrder(db, ctx, settings, {
                channel: checkout.channel,
                source: "menu",
                items: quote.lines.map((item) => ({ ...item.line, id: db.newKey() })),
                customer: checkout.customer,
                fulfillment: checkout.fulfillment,
                totals: checkout.totals,
                payment: checkout.payment,
                notes: payload.notes,
                idempotencyKey: payload.idempotencyKey
            });

            return { orderId, code: order.code, status: order.status };
        }
    },

    "public.call": {
        public: true,
        feature: "menusTables",
        run: async (db, ctx, { tableId, type }) => {
            const settings = await loadSettings(db, ctx);
            if (settings?.tables?.qrCalls !== true) fail("disabled", "Chamados pelo QR não estão ativos neste estabelecimento.", 403);
            if (!["waiter", "bill"].includes(type)) fail("type", "Chamado inválido.");
            const table = await loadTable(db, ctx, tableId);

            const open = entries(await db.get(paths(ctx.handle).calls)).find((call) => call.tableId === table.id && call.type === type && call.status === "open");
            if (open) return { callId: open.id, duplicate: true };

            const state = await db.get(paths(ctx.handle).tableState(table.id));
            if (type === "bill" && !state?.tabId) fail("no_tab", "A mesa ainda não tem uma conta aberta.", 409);

            const callId = db.newKey();
            await db.set(paths(ctx.handle).call(callId), { tableId: table.id, tableLabel: table.label, type, status: "open", at: ctx.now });

            if (type === "bill" && state?.tabId) {
                await db.transaction(paths(ctx.handle).tableState(table.id), (current) => (current === null ? null : current.tabId === state.tabId ? { ...current, billRequested: true } : undefined));
            }

            return { callId };
        }
    }
};

/* Recalcula sem validar saldo: cancelamento vindo do pedido
   pode deixar pagamento acima do total — vira estorno a fazer. */
const cancelledTotals = (tab, now) => {
    const next = { ...tab, updatedAt: now, version: (Number(tab.version) || 0) + 1 };
    next.totals = computeTotals(next);
    return { tab: next };
};

/** Pedido feito pelo QR da mesa: entra na comanda aberta da mesa.
    Só os itens do cliente vão para a cozinha — o que o garçom
    deixou pendente na comanda continua pendente. */
const placeTableOrder = async (db, ctx, settings, quote, checkout, payload) => {
    if (!ctx.features.menusTables) fail("feature_locked", "Pedidos pela mesa não estão disponíveis.", 403);
    if (settings?.tables?.qrOrdering !== true) fail("disabled", "Pedidos pelo QR da mesa não estão ativos.", 403);

    const tableId = requireId(checkout.fulfillment.tableId, "Mesa");
    const table = await loadTable(db, ctx, tableId);
    const state = await db.get(paths(ctx.handle).tableState(tableId));

    if (!state?.tabId) {
        fail("table_closed", "Esta mesa ainda não foi aberta. Chame um atendente para abrir a mesa.", 409);
    }

    const ids = quote.lines.map(() => db.newKey());
    const orderId = db.newKey();
    const customer = checkout.customer.name ? `${checkout.customer.name} (QR)` : "Cliente (QR)";

    const { tab } = await mutateTab(db, ctx, state.tabId, (current) => {
        const added = addItems(current, quote.lines.map((item) => item.line), {
            ids,
            actor: { uid: null, name: customer },
            now: ctx.now
        });
        ids.forEach((id) => {
            added.items[id] = { ...added.items[id], status: "sent", orderId, sentAt: ctx.now };
        });
        added.totals = computeTotals(added);
        return added;
    });

    const items = ids.map((id) => ({ ...tab.items[id], id }));
    const { order } = await createTableOrder(db, ctx, settings, { ...tab, id: state.tabId }, orderId, items, "qr");

    return { orderId, code: order.code, status: order.status, table: table.label };
};

/* ---------- PEDIDOS DE CANAIS EXTERNOS ----------
   Estrutura pronta para conectores (iFood, 99Food, Keeta…).
   Nenhum conector está ativo: esta função só é chamada por
   um adaptador real, depois de validar a assinatura do
   provedor. A chave externa impede pedido duplicado. */

export const importExternalOrder = async (db, ctx, provider, external) => {
    const providerId = String(provider || "").replace(/[^a-z0-9]/gi, "").slice(0, 20);
    const externalId = String(external?.id || "").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
    if (!providerId || !externalId) fail("bad_request", "Pedido externo sem identificação.");

    const key = `${providerId}_${externalId}`;
    let existing = null;

    const claim = await db.transaction(paths(ctx.handle).external(key), (current) => {
        if (current) {
            existing = current;
            return undefined;
        }
        existing = null;
        return { status: "importing", at: ctx.now };
    });

    if (!claim.committed) return { orderId: existing?.orderId || null, duplicate: true };

    const settings = await loadSettings(db, ctx);
    const items = asList(external.items).map((item) => ({
        id: db.newKey(),
        productId: item.productId || null,
        name: text(item.name, 80),
        qty: Math.max(1, Math.round(Number(item.qty) || 1)),
        unitCents: cents(item.unitCents),
        totalCents: cents(item.unitCents) * Math.max(1, Math.round(Number(item.qty) || 1)),
        options: asList(item.options).map((option) => ({ name: text(option.name, 80), priceCents: cents(option.priceCents), kind: "addon" })),
        notes: text(item.notes, 140) || null
    }));

    const subtotal = items.reduce((sum, item) => sum + item.totalCents, 0);
    const fee = cents(external.deliveryFeeCents);

    const { orderId } = await createOrder(db, ctx, settings, {
        channel: external.channel === "pickup" ? "pickup" : "delivery",
        source: "integration",
        items,
        customer: { name: text(external.customer?.name, 80) || null, phone: null },
        fulfillment: { mode: external.channel === "pickup" ? "pickup" : "delivery", address: text(external.address, 240) || null },
        totals: { subtotalCents: subtotal, deliveryFeeCents: fee, discountCents: cents(external.discountCents), totalCents: subtotal + fee - cents(external.discountCents) },
        payment: { method: external.paidOnline ? "other" : null, status: external.paidOnline ? "paid" : "pending", paidCents: external.paidOnline ? subtotal + fee : 0 },
        external: { provider: providerId, id: externalId }
    });

    await db.set(paths(ctx.handle).external(key), { status: "imported", orderId, at: ctx.now });
    return { orderId, duplicate: false };
};

/* ---------- ENTRADA ÚNICA ---------- */

export const runAction = async (db, ctx, name, payload = {}) => {
    const def = ACTIONS[name];
    if (!def) fail("unknown_action", "Operação desconhecida.", 404);

    if (!ctx.menusEnabled) {
        fail("plan_required", "O plano desta empresa não inclui o Markfy Menus.", 403);
    }

    if (!def.public) {
        if (!ctx.actor || !ctx.role) fail("forbidden", "Você não faz parte da equipe desta empresa.", 403);

        const required = permissionsFor(name, payload);
        const permission = required.find((id) => can(ctx.role, id, ctx.grants));
        if (!permission) {
            fail("forbidden", "Seu perfil não tem permissão para esta ação.", 403, { permission: required[0] });
        }

        const feature = def.feature || ACTION_FEATURE[permission];
        if (feature && !ctx.features[feature]) {
            fail("feature_locked", "Este recurso não está incluído no plano atual.", 403, { feature });
        }
    } else if (def.feature && !ctx.features[def.feature]) {
        fail("feature_locked", "Este recurso não está disponível para este estabelecimento.", 403, { feature: def.feature });
    }

    const run = () => def.run(db, ctx, payload || {});

    return def.idempotent ? withIdempotency(db, ctx, payload?.idempotencyKey, run) : run();
};

export const PUBLIC_ACTIONS = Object.keys(ACTIONS).filter((name) => ACTIONS[name].public);


