/* =========================================================
   PEDIDOS

   Um pedido tem um CANAL (como é entregue) e uma ORIGEM
   (por onde entrou):

     canal   table | counter | pickup | delivery
     origem  staff (equipe) | menu (cardápio digital) |
             qr (QR da mesa) | integration (canal externo)

   Fluxo padrão por canal (as etapas opcionais podem ser
   desligadas em Configurações → Pedidos):

     delivery  Recebido → Confirmado → Em preparo → Pronto → Saiu para entrega → Concluído
     pickup    Recebido → Confirmado → Em preparo → Pronto → Aguardando retirada → Concluído
     table     Recebido → Confirmado → Em preparo → Pronto → Concluído
     counter   Recebido → Confirmado → Em preparo → Pronto → Concluído

   Pedido lançado pela equipe já nasce Confirmado. Pedido do
   cardápio digital ou do QR da mesa nasce Recebido (alguém
   da equipe confirma), a não ser que a empresa ligue a
   confirmação automática.
========================================================= */

import { asList, clampInt, text } from "./util.js";
import { cents } from "./money.js";
import { isOpenAt, DEFAULT_TZ } from "./hours.js";

export const STATUS = {
    received: { label: "Recebido", short: "Novo", tone: "info", icon: "solar:inbox-in-linear" },
    confirmed: { label: "Confirmado", short: "Confirmado", tone: "info", icon: "solar:check-read-linear" },
    preparing: { label: "Em preparo", short: "Preparo", tone: "warning", icon: "solar:chef-hat-linear" },
    ready: { label: "Pronto", short: "Pronto", tone: "success", icon: "solar:bell-bing-linear" },
    out_for_delivery: { label: "Saiu para entrega", short: "Em rota", tone: "info", icon: "solar:scooter-linear" },
    awaiting_pickup: { label: "Aguardando retirada", short: "Retirada", tone: "info", icon: "solar:bag-check-linear" },
    completed: { label: "Concluído", short: "Concluído", tone: "success", icon: "solar:check-circle-linear" },
    cancelled: { label: "Cancelado", short: "Cancelado", tone: "danger", icon: "solar:close-circle-linear" }
};

export const CHANNELS = {
    table: { label: "Mesa", icon: "solar:armchair-2-linear" },
    counter: { label: "Balcão", icon: "solar:shop-linear" },
    pickup: { label: "Retirada", icon: "solar:bag-4-linear" },
    delivery: { label: "Delivery", icon: "solar:scooter-linear" }
};

export const SOURCES = {
    staff: { label: "Equipe" },
    menu: { label: "Cardápio digital" },
    qr: { label: "QR da mesa" },
    integration: { label: "Canal integrado" }
};

export const TERMINAL = ["completed", "cancelled"];

export const KITCHEN_STATUSES = ["confirmed", "preparing", "ready"];

export const PAYMENT_METHODS = {
    cash: { label: "Dinheiro", icon: "solar:wad-of-money-linear" },
    credit: { label: "Cartão de crédito", icon: "solar:card-linear" },
    debit: { label: "Cartão de débito", icon: "solar:card-2-linear" },
    pix: { label: "Pix", icon: "ic:baseline-pix" },
    voucher: { label: "Vale-refeição", icon: "solar:ticket-linear" },
    other: { label: "Outro", icon: "solar:wallet-linear" }
};

export const PAYMENT_STATUS = {
    pending: { label: "Pagamento pendente", tone: "warning" },
    paid: { label: "Pago", tone: "success" },
    refunded: { label: "Estornado", tone: "danger" },
    tab: { label: "Na comanda", tone: undefined }
};

export const flowFor = (channel, settings) => {
    const ordering = settings?.ordering || {};
    const flows = {
        delivery: ["received", "confirmed", "preparing", "ready", "out_for_delivery", "completed"],
        pickup: ["received", "confirmed", "preparing", "ready", "awaiting_pickup", "completed"],
        table: ["received", "confirmed", "preparing", "ready", "completed"],
        counter: ["received", "confirmed", "preparing", "ready", "completed"]
    };
    let flow = flows[channel] || flows.counter;
    if (ordering.useAwaitingPickup === false) flow = flow.filter((status) => status !== "awaiting_pickup");
    if (ordering.skipPreparing === true) flow = flow.filter((status) => status !== "preparing");
    return flow;
};

export const initialStatus = (channel, source, settings) => {
    if (source === "staff") return "confirmed";
    return settings?.ordering?.autoConfirm === true ? "confirmed" : "received";
};

/** Próxima etapa do fluxo (ou null no fim). */
export const nextStatus = (order, settings) => {
    if (!order || TERMINAL.includes(order.status)) return null;
    const flow = flowFor(order.channel, settings);
    const index = flow.indexOf(order.status);
    return index >= 0 && index < flow.length - 1 ? flow[index + 1] : null;
};

/**
 * Pode ir de `from` para `to`? Avançar qualquer número de
 * etapas, ou voltar UMA (correção de clique errado), nunca
 * para "Recebido".
 * Cancelamento é ação separada.
 */
export const canMove = (order, to, settings) => {
    if (!order || TERMINAL.includes(order.status)) return false;
    const flow = flowFor(order.channel, settings);
    const from = flow.indexOf(order.status);
    const target = flow.indexOf(to);
    if (from < 0 || target < 0 || target === from) return false;
    /* Confirmado não volta a "Recebido": a confirmação já
       baixou estoque e avisou o cliente. */
    if (to === "received") return false;
    return target > from || target === from - 1;
};

export const isLate = (order, now, settings) => {
    if (!order || TERMINAL.includes(order.status)) return false;
    const limit = clampInt(settings?.ordering?.lateAfterMinutes, 5, 240, 30);
    const started = Number(order.createdAt) || now;
    return now - started > limit * 60000 && ["received", "confirmed", "preparing"].includes(order.status);
};

/* ---------- CHECKOUT DO CARDÁPIO DIGITAL ---------- */

export const FULFILLMENT_LABELS = {
    pickup: "Retirar no local",
    delivery: "Entrega",
    dine_in: "Consumir no local"
};

export const enabledFulfillments = (settings) => {
    const f = settings?.fulfillment || {};
    const list = [];
    if (f.pickup?.enabled) list.push("pickup");
    if (f.delivery?.enabled) list.push("delivery");
    if (f.dineIn?.enabled && settings?.tables?.qrOrdering) list.push("dine_in");
    return list;
};

export const enabledPaymentMethods = (settings) => {
    const p = settings?.payments || {};
    return Object.keys(PAYMENT_METHODS).filter((id) => id !== "other" && p[id] === true);
};

const digits = (value) => String(value || "").replace(/\D/g, "");

export const deliveryFeeCents = (settings, zoneId, subtotalCents) => {
    const delivery = settings?.fulfillment?.delivery || {};
    const zones = asList(delivery.zones).filter((zone) => zone && zone.id && zone.name);
    let fee = cents(delivery.feeCents);
    let zone = null;

    if (zones.length) {
        zone = zones.find((item) => item.id === zoneId) || null;
        if (zone) fee = cents(zone.feeCents);
    }

    const freeAbove = cents(delivery.freeAboveCents);
    if (freeAbove > 0 && subtotalCents >= freeAbove) fee = 0;

    return { fee, zone, zones };
};

/**
 * Valida o checkout. `quote` vem de quoteLines(). Devolve
 * { ok, errors, status, fulfillment, totals, payment }.
 */
export const validateCheckout = (settings, quote, input, ctx = {}) => {
    const errors = [...(quote?.errors || [])];
    const now = ctx.now || Date.now();
    const tz = settings?.timezone || DEFAULT_TZ;

    if (settings?.mode !== "ordering") errors.push("Este cardápio não está recebendo pedidos online.");
    if (ctx.orderingAllowed === false) errors.push("Pedidos online não estão disponíveis para este estabelecimento.");

    const hours = isOpenAt(settings?.hours, now, tz);
    if (!hours.open && settings?.ordering?.acceptWhenClosed !== true) {
        errors.push("O estabelecimento está fechado agora.");
    }

    const mode = input?.fulfillment?.mode;
    const allowed = enabledFulfillments(settings);

    if (!allowed.includes(mode)) errors.push("Escolha uma forma de entrega disponível.");

    const name = text(input?.customer?.name, 80);
    const phone = digits(input?.customer?.phone).slice(0, 13);

    if (name.length < 2) errors.push("Informe seu nome.");
    if (mode !== "dine_in" && (phone.length < 10 || phone.length > 13)) errors.push("Informe um telefone com DDD.");

    const subtotal = cents(quote?.subtotalCents);
    let fee = 0;
    let zoneName = null;
    let eta = null;
    let address = null;

    if (mode === "delivery") {
        const delivery = settings?.fulfillment?.delivery || {};
        address = text(input?.fulfillment?.address, 240);
        if (address.length < 8) errors.push("Informe o endereço de entrega completo.");

        const result = deliveryFeeCents(settings, input?.fulfillment?.zoneId, subtotal);
        if (result.zones.length && !result.zone) errors.push("Escolha o bairro ou região de entrega.");
        fee = result.fee;
        zoneName = result.zone?.name || null;

        const min = cents(delivery.minOrderCents);
        if (min > 0 && subtotal < min) errors.push("O pedido mínimo para entrega não foi atingido.");

        eta = clampInt(delivery.etaMinutes, 0, 600, 0) || null;
    }

    if (mode === "pickup") eta = clampInt(settings?.fulfillment?.pickup?.etaMinutes, 0, 600, 0) || null;

    let tableId = null;
    if (mode === "dine_in") {
        tableId = String(input?.fulfillment?.tableId || "");
        if (!tableId) errors.push("Abra o cardápio pelo QR Code da mesa para pedir no local.");
    }

    const methods = enabledPaymentMethods(settings);
    const method = input?.payment?.method;

    if (mode !== "dine_in") {
        if (!methods.length) errors.push("O estabelecimento ainda não configurou formas de pagamento.");
        else if (!methods.includes(method)) errors.push("Escolha uma forma de pagamento.");
    }

    let changeForCents = null;
    if (method === "cash" && input?.payment?.changeForCents) {
        const value = cents(input.payment.changeForCents);
        if (value > 0 && value < subtotal + fee) errors.push("O valor para troco precisa ser maior que o total.");
        changeForCents = value > 0 ? value : null;
    }

    return {
        ok: errors.length === 0,
        errors: [...new Set(errors)],
        channel: mode === "delivery" ? "delivery" : mode === "pickup" ? "pickup" : "table",
        fulfillment: { mode, address, zoneName, etaMinutes: eta, tableId },
        customer: { name, phone: phone || null },
        totals: { subtotalCents: subtotal, deliveryFeeCents: fee, discountCents: 0, totalCents: subtotal + fee },
        payment: mode === "dine_in"
            ? { method: null, status: "tab", paidCents: 0 }
            : { method, status: "pending", paidCents: 0, changeForCents }
    };
};

/** Resumo sem dados pessoais, para a página de acompanhamento. */
export const trackingView = (order) => ({
    code: order.code,
    status: order.status,
    channel: order.channel,
    etaMinutes: order.fulfillment?.etaMinutes || null,
    totalCents: order.totals?.totalCents || 0,
    paymentStatus: order.payment?.status || null,
    paymentMethod: order.payment?.method || null,
    items: asList(order.items).map((item) => ({ name: item.name, qty: item.qty, sizeName: item.sizeName || null })),
    cancelReason: order.status === "cancelled" ? text(order.cancel?.publicReason || "", 140) || null : null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt || order.createdAt
});

export const formatCode = (sequence) => String(sequence).padStart(3, "0");
