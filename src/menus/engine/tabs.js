/* =========================================================
   COMANDAS

   Funções PURAS: recebem a comanda atual e devolvem a nova
   (ou lançam MenusError). Quem grava é actions.js, dentro
   de uma transação — então duas pessoas mexendo na mesma
   comanda ao mesmo tempo nunca sobrescrevem uma à outra.

   Comanda:
     { tableId, label, status: "open" | "closed" | "cancelled" | "merged",
       guests, customerName, waiterUid, waiterName, notes,
       openedAt, openedBy,
       items:       { id: { ...linha, status, orderId, person, addedAt, addedBy } },
       adjustments: { id: { type: "discount" | "service", mode: "percent" | "amount",
                            value, reason, by, at, voided } },
       payments:    { id: { method, amountCents, receivedCents, changeCents,
                            person, by, at, status: "confirmed" | "refunded" } },
       billRequested, closedAt, closedBy, version }

   Estados de item:
     pending    lançado, ainda não foi para a cozinha (pode remover)
     sent       enviado (só sai por cancelamento com motivo)
     cancelled  cancelado, com motivo e responsável
   O andamento do preparo vem do pedido (orderId).

   Valores nunca são apagados: desconto anulado fica com
   voided; pagamento estornado fica com status "refunded".
========================================================= */

import { asList, entries, fail, text } from "./util.js";
import { cents, percentOf, splitEqually } from "./money.js";

export const ITEM_STATUS = {
    pending: { label: "Aguardando envio", tone: "warning" },
    sent: { label: "Enviado", tone: "info" },
    cancelled: { label: "Cancelado", tone: "danger" }
};

const activeItems = (tab) => entries(tab?.items).filter((item) => item.status !== "cancelled");

export const computeTotals = (tab) => {
    const itemsCents = activeItems(tab).reduce((sum, item) => sum + cents(item.unitCents) * (Number(item.qty) || 0), 0);

    const adjustments = entries(tab?.adjustments).filter((adj) => !adj.voided);

    let discountCents = 0;
    adjustments
        .filter((adj) => adj.type === "discount")
        .forEach((adj) => {
            discountCents += adj.mode === "percent" ? percentOf(itemsCents, adj.value) : cents(adj.value);
        });
    discountCents = Math.min(discountCents, itemsCents);

    const base = itemsCents - discountCents;

    let serviceCents = 0;
    adjustments
        .filter((adj) => adj.type === "service")
        .forEach((adj) => {
            serviceCents += adj.mode === "percent" ? percentOf(base, adj.value) : cents(adj.value);
        });

    const totalCents = base + serviceCents;

    const paidCents = entries(tab?.payments)
        .filter((payment) => payment.status === "confirmed")
        .reduce((sum, payment) => sum + cents(payment.amountCents), 0);

    const refundedCents = entries(tab?.payments)
        .filter((payment) => payment.status === "refunded")
        .reduce((sum, payment) => sum + cents(payment.amountCents), 0);

    const pendingCount = activeItems(tab).filter((item) => item.status === "pending").length;

    return {
        itemsCents,
        discountCents,
        serviceCents,
        totalCents,
        paidCents,
        refundedCents,
        balanceCents: totalCents - paidCents,
        itemCount: activeItems(tab).reduce((sum, item) => sum + (Number(item.qty) || 0), 0),
        pendingCount
    };
};

const ensureOpen = (tab) => {
    if (!tab) fail("tab_not_found", "Comanda não encontrada.", 404);
    if (tab.status !== "open") fail("tab_closed", "Esta comanda já foi fechada.", 409);
};

const withTotals = (tab, now) => {
    const next = { ...tab, updatedAt: now, version: (Number(tab.version) || 0) + 1 };
    next.totals = computeTotals(next);
    return next;
};

export const createTab = ({ id, tableId, label, guests, customerName, waiterUid, waiterName, notes, serviceFeePercent, actor, now }) => {
    const tab = {
        id,
        tableId: tableId || null,
        label: text(label, 40) || null,
        status: "open",
        guests: Math.max(0, Math.min(99, Math.round(Number(guests) || 0))),
        customerName: text(customerName, 80) || null,
        waiterUid: waiterUid || null,
        waiterName: text(waiterName, 80) || null,
        notes: text(notes, 280) || null,
        openedAt: now,
        openedBy: actor?.uid || null,
        items: {},
        adjustments: {},
        payments: {},
        billRequested: false,
        version: 0
    };

    const fee = Number(serviceFeePercent);
    if (Number.isFinite(fee) && fee > 0 && fee <= 30) {
        tab.adjustments.service = {
            type: "service",
            mode: "percent",
            value: Math.round(fee * 100) / 100,
            reason: "Taxa de serviço",
            by: "system",
            at: now,
            voided: false
        };
    }

    return withTotals(tab, now);
};

/** Acrescenta linhas já calculadas (quoteLines().lines[].line). */
export const addItems = (tab, lines, { ids, actor, now, person }) => {
    ensureOpen(tab);
    if (!lines.length) fail("empty", "Nenhum item para lançar.");

    const items = { ...(tab.items || {}) };
    lines.forEach((line, index) => {
        items[ids[index]] = {
            ...line,
            person: text(line.person || person, 30) || null,
            status: "pending",
            orderId: null,
            addedAt: now,
            addedBy: actor?.uid || null,
            addedByName: text(actor?.name, 80) || null
        };
    });

    return withTotals({ ...tab, items, billRequested: false }, now);
};

export const removePendingItem = (tab, itemId, { now }) => {
    ensureOpen(tab);
    const item = tab.items?.[itemId];
    if (!item) fail("item_not_found", "Item não encontrado.", 404);
    if (item.status !== "pending") {
        fail("item_sent", "Este item já foi enviado para a cozinha. Use cancelar, informando o motivo.", 409);
    }
    const items = { ...tab.items };
    delete items[itemId];
    return withTotals({ ...tab, items }, now);
};

/** Marca os itens pendentes como enviados e devolve quais foram. */
export const sendPending = (tab, { orderId, now }) => {
    ensureOpen(tab);
    const pending = entries(tab.items).filter((item) => item.status === "pending");
    if (!pending.length) fail("nothing_pending", "Não há itens aguardando envio.", 409);

    const items = { ...tab.items };
    pending.forEach((item) => {
        items[item.id] = { ...items[item.id], status: "sent", orderId, sentAt: now };
    });

    return { tab: withTotals({ ...tab, items }, now), sent: pending };
};

export const cancelItem = (tab, itemId, { reason, actor, now }) => {
    ensureOpen(tab);
    const item = tab.items?.[itemId];
    if (!item) fail("item_not_found", "Item não encontrado.", 404);
    if (item.status === "cancelled") fail("already", "Este item já foi cancelado.", 409);
    const why = text(reason, 140);
    if (why.length < 3) fail("reason", "Informe o motivo do cancelamento.");

    const items = {
        ...tab.items,
        [itemId]: { ...item, status: "cancelled", cancel: { reason: why, by: actor?.uid || null, byName: text(actor?.name, 80) || null, at: now, wasStatus: item.status } }
    };

    return withTotals({ ...tab, items }, now);
};

export const applyAdjustment = (tab, { id, type, mode, value, reason, actor, now }) => {
    ensureOpen(tab);
    if (!["discount", "service"].includes(type)) fail("type", "Tipo de ajuste inválido.");
    if (!["percent", "amount"].includes(mode)) fail("mode", "Use percentual ou valor.");

    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) fail("value", "Informe um valor maior que zero.");

    if (mode === "percent" && number > (type === "service" ? 30 : 100)) fail("value", "Percentual acima do permitido.");

    const totals = computeTotals(tab);
    if (mode === "amount" && type === "discount" && Math.round(number) > totals.itemsCents - totals.discountCents) {
        fail("value", "O desconto é maior que o valor dos itens.");
    }

    const why = text(reason, 140);
    if (type === "discount" && why.length < 3) fail("reason", "Informe o motivo do desconto.");

    const adjustments = {
        ...(tab.adjustments || {}),
        [id]: {
            type,
            mode,
            value: mode === "percent" ? Math.round(number * 100) / 100 : Math.round(number),
            reason: why || (type === "service" ? "Taxa de serviço" : ""),
            by: actor?.uid || null,
            byName: text(actor?.name, 80) || null,
            at: now,
            voided: false
        }
    };

    const next = withTotals({ ...tab, adjustments }, now);
    if (next.totals.balanceCents < 0) fail("overpaid", "Com esse ajuste o valor pago passaria do total da conta.", 409);
    return next;
};

export const voidAdjustment = (tab, adjustmentId, { reason, actor, now }) => {
    ensureOpen(tab);
    const adj = tab.adjustments?.[adjustmentId];
    if (!adj || adj.voided) fail("adjustment_not_found", "Ajuste não encontrado.", 404);

    const adjustments = {
        ...tab.adjustments,
        [adjustmentId]: { ...adj, voided: true, voidReason: text(reason, 140) || null, voidedBy: actor?.uid || null, voidedAt: now }
    };

    const next = withTotals({ ...tab, adjustments }, now);
    if (next.totals.balanceCents < 0) fail("overpaid", "Retirar este ajuste deixaria o valor pago acima do total.", 409);
    return next;
};

/**
 * Registra um pagamento. IDEMPOTENTE: o mesmo paymentId
 * enviado duas vezes (clique duplo, rede instável, dois
 * aparelhos) grava uma vez só e devolve `duplicate: true`.
 */
export const registerPayment = (tab, { paymentId, method, amountCents, receivedCents, person, actor, now }) => {
    if (!tab) fail("tab_not_found", "Comanda não encontrada.", 404);

    const existing = tab.payments?.[paymentId];
    if (existing) return { tab, duplicate: true, payment: existing };

    ensureOpen(tab);

    const amount = Math.round(Number(amountCents));
    if (!Number.isInteger(amount) || amount <= 0) fail("amount", "Informe o valor recebido.");

    const totals = computeTotals(tab);
    if (totals.pendingCount > 0) fail("pending_items", "Envie ou remova os itens pendentes antes de receber.", 409);
    if (amount > totals.balanceCents) fail("overpay", "O valor é maior que o saldo da conta.", 409);

    let received = null;
    let change = null;
    if (method === "cash" && receivedCents !== undefined && receivedCents !== null && receivedCents !== "") {
        received = Math.round(Number(receivedCents));
        if (!Number.isInteger(received) || received < amount) fail("received", "O valor entregue é menor que o pagamento.");
        change = received - amount;
    }

    const payment = {
        method,
        amountCents: amount,
        receivedCents: received,
        changeCents: change,
        person: text(person, 30) || null,
        by: actor?.uid || null,
        byName: text(actor?.name, 80) || null,
        at: now,
        status: "confirmed"
    };

    return {
        tab: withTotals({ ...tab, payments: { ...(tab.payments || {}), [paymentId]: payment } }, now),
        duplicate: false,
        payment
    };
};

export const refundPayment = (tab, paymentId, { reason, actor, now }) => {
    if (!tab) fail("tab_not_found", "Comanda não encontrada.", 404);
    if (tab.status !== "open") fail("tab_closed", "Reabra a comanda antes de estornar.", 409);
    const payment = tab.payments?.[paymentId];
    if (!payment) fail("payment_not_found", "Pagamento não encontrado.", 404);
    if (payment.status === "refunded") return { tab, duplicate: true };
    const why = text(reason, 140);
    if (why.length < 3) fail("reason", "Informe o motivo do estorno.");

    const payments = {
        ...tab.payments,
        [paymentId]: { ...payment, status: "refunded", refund: { reason: why, by: actor?.uid || null, byName: text(actor?.name, 80) || null, at: now } }
    };

    return { tab: withTotals({ ...tab, payments }, now), duplicate: false };
};

export const closeTab = (tab, { actor, now }) => {
    ensureOpen(tab);
    const totals = computeTotals(tab);
    if (totals.pendingCount > 0) fail("pending_items", "Há itens que ainda não foram enviados. Envie ou remova antes de fechar.", 409);
    if (totals.balanceCents !== 0) {
        fail("balance", totals.balanceCents > 0 ? "Ainda há saldo a receber nesta comanda." : "O valor pago passa do total.", 409, { balanceCents: totals.balanceCents });
    }
    return withTotals({ ...tab, status: "closed", closedAt: now, closedBy: actor?.uid || null, billRequested: false }, now);
};

export const reopenTab = (tab, { reason, actor, now }) => {
    if (!tab) fail("tab_not_found", "Comanda não encontrada.", 404);
    if (tab.status !== "closed") fail("not_closed", "Só é possível reabrir uma comanda fechada.", 409);
    const why = text(reason, 140);
    if (why.length < 3) fail("reason", "Informe o motivo da reabertura.");
    return withTotals({ ...tab, status: "open", reopened: { reason: why, by: actor?.uid || null, at: now }, closedAt: null, closedBy: null }, now);
};

/* ---------- DIVISÃO DA CONTA ----------
   Só calcula; cada parte vira um pagamento registrado
   normalmente (com `person`). */

export const splitEqual = (tab, people) => {
    const totals = computeTotals(tab);
    return splitEqually(totals.balanceCents, people);
};

/** Quanto cada pessoa consumiu (itens marcados com `person`). */
export const splitByPerson = (tab) => {
    const totals = computeTotals(tab);
    const byPerson = {};

    activeItems(tab).forEach((item) => {
        const key = item.person || "";
        byPerson[key] = (byPerson[key] || 0) + cents(item.unitCents) * (Number(item.qty) || 0);
    });

    const itemsCents = totals.itemsCents || 1;
    const extra = totals.serviceCents - totals.discountCents;

    const paidBy = {};
    entries(tab?.payments)
        .filter((payment) => payment.status === "confirmed")
        .forEach((payment) => {
            const key = payment.person || "";
            paidBy[key] = (paidBy[key] || 0) + cents(payment.amountCents);
        });

    /* Taxa e desconto rateados na proporção do consumo; a
       última pessoa absorve o arredondamento para fechar. */
    const keys = Object.keys(byPerson);
    let distributed = 0;

    return keys.map((key, index) => {
        const share = index === keys.length - 1 ? extra - distributed : Math.round((byPerson[key] / itemsCents) * extra);
        distributed += share;
        const due = byPerson[key] + share;
        return {
            person: key || null,
            itemsCents: byPerson[key],
            dueCents: due,
            paidCents: paidBy[key] || 0,
            remainingCents: Math.max(0, due - (paidBy[key] || 0))
        };
    });
};

/** Valor de um conjunto de itens com taxa/desconto proporcionais. */
export const amountForItems = (tab, itemIds) => {
    const totals = computeTotals(tab);
    const chosen = activeItems(tab).filter((item) => asList(itemIds).includes(item.id));
    const sum = chosen.reduce((total, item) => total + cents(item.unitCents) * (Number(item.qty) || 0), 0);
    if (!totals.itemsCents) return 0;
    const extra = totals.serviceCents - totals.discountCents;
    return Math.min(totals.balanceCents, sum + Math.round((sum / totals.itemsCents) * extra));
};

/** Move itens entre comandas (sem alterar o estado de preparo). */
export const takeItems = (tab, itemIds, { now, toTabId }) => {
    ensureOpen(tab);
    const ids = asList(itemIds);
    const taken = [];
    const items = { ...(tab.items || {}) };

    ids.forEach((id) => {
        const item = items[id];
        if (item && item.status !== "cancelled") {
            taken.push({ id, ...item });
            delete items[id];
        }
    });

    if (!taken.length) fail("no_items", "Escolha os itens a transferir.");

    const next = withTotals({ ...tab, items, transfers: { ...(tab.transfers || {}), [String(now)]: { to: toTabId, items: taken.map((item) => item.id) } } }, now);
    if (next.totals.balanceCents < 0) fail("overpaid", "A comanda de origem ficaria com pagamento acima do total.", 409);

    return { tab: next, taken };
};

export const putItems = (tab, taken, { now, fromTabId }) => {
    ensureOpen(tab);
    const items = { ...(tab.items || {}) };
    taken.forEach(({ id, ...item }) => {
        items[id] = { ...item, movedFrom: fromTabId, movedAt: now };
    });
    return withTotals({ ...tab, items }, now);
};
