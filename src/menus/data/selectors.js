import { asList, byOrder, entries } from "../engine/util.js";
import { computeTotals } from "../engine/tabs.js";
import { isLate, TERMINAL } from "../engine/orders.js";
import { DEFAULT_TZ, localParts } from "../engine/hours.js";

/* =========================================================
   LEITURAS DERIVADAS (sem gravar nada)

   Estado visual das mesas, pedidos por comanda e agregações
   de vendas. Tudo a partir dos dados vivos do contexto.
========================================================= */

export const TABLE_STATUS = {
    free: { label: "Livre", icon: "solar:check-circle-linear" },
    awaiting_order: { label: "Aguardando pedido", icon: "solar:notebook-minimalistic-linear" },
    sent: { label: "Pedido enviado", icon: "solar:plain-3-linear" },
    preparing: { label: "Em preparo", icon: "solar:chef-hat-linear" },
    occupied: { label: "Ocupada", icon: "solar:users-group-rounded-linear" },
    awaiting_payment: { label: "Aguardando pagamento", icon: "solar:bill-list-linear" },
    reserved: { label: "Reservada", icon: "solar:calendar-mark-linear" },
    unavailable: { label: "Indisponível", icon: "solar:forbidden-circle-linear" }
};

export const listMenus = (catalog) => entries(catalog?.menus).sort(byOrder);

export const listCategories = (catalog, menuId) =>
    entries(catalog?.categories)
        .filter((category) => !menuId || category.menuId === menuId)
        .sort(byOrder);

export const listProducts = (catalog, categoryId) =>
    entries(catalog?.products)
        .filter((product) => !categoryId || product.categoryId === categoryId)
        .sort(byOrder);

export const listGroups = (catalog) => entries(catalog?.optionGroups).sort((a, b) => String(a.name).localeCompare(String(b.name)));

export const listAreas = (floor) => entries(floor?.areas).sort(byOrder);

/* Por ambiente (na ordem dos ambientes), depois pela ordem da mesa. */
export const listTables = (floor) => {
    const areaOrder = Object.fromEntries(listAreas(floor).map((area, index) => [area.id, index]));
    return entries(floor?.tables).sort(
        (a, b) =>
            (areaOrder[a.areaId] ?? 99) - (areaOrder[b.areaId] ?? 99) ||
            (Number(a.order) || 0) - (Number(b.order) || 0) ||
            String(a.label).localeCompare(String(b.label), "pt-BR", { numeric: true })
    );
};

export const ordersByTab = (orders) => {
    const map = {};
    entries(orders).forEach((order) => {
        if (!order.tabId) return;
        (map[order.tabId] = map[order.tabId] || []).push(order);
    });
    return map;
};

export const callsByTable = (calls) => {
    const map = {};
    entries(calls).forEach((call) => {
        (map[call.tableId] = map[call.tableId] || []).push(call);
    });
    return map;
};

/** Situação de uma mesa para a tela (cor, ícone e texto). */
export const deriveTable = ({ table, state, tab, orders = [], calls = [], now = Date.now() }) => {
    const base = { table, state, tab, calls, attention: calls.length > 0, guests: 0, elapsed: 0, totalCents: 0, pendingCount: 0, readyCount: 0, preparingCount: 0 };

    if (table?.disabled) return { ...base, status: "unavailable" };
    if (!state?.tabId || !tab) return { ...base, status: state?.reservation ? "reserved" : "free", reservation: state?.reservation || null };

    const totals = tab.totals || computeTotals(tab);
    const live = orders.filter((order) => !TERMINAL.includes(order.status));

    const preparingCount = live.filter((order) => order.status === "preparing").length;
    const sentCount = live.filter((order) => ["received", "confirmed"].includes(order.status)).length;
    const readyCount = live.filter((order) => order.status === "ready").length;

    let status = "occupied";
    if (tab.billRequested || state.billRequested) status = "awaiting_payment";
    else if (preparingCount) status = "preparing";
    else if (sentCount) status = "sent";
    else if (totals.pendingCount > 0 || !totals.itemCount) status = "awaiting_order";

    return {
        ...base,
        status,
        guests: tab.guests || state.guests || 0,
        elapsed: Math.max(0, Math.floor((now - Number(tab.openedAt || state.openedAt || now)) / 60000)),
        totalCents: totals.totalCents,
        balanceCents: totals.balanceCents,
        paidCents: totals.paidCents,
        pendingCount: totals.pendingCount,
        readyCount,
        preparingCount,
        lateCount: live.filter((order) => isLate(order, now, {})).length,
        waiterName: tab.waiterName || state.waiterName || ""
    };
};

/* ---------- PERÍODOS NO FUSO DA EMPRESA ---------- */

/** Início do dia (meia-noite local da empresa) em milissegundos. */
export const startOfDay = (millis, tz = DEFAULT_TZ) => {
    const parts = localParts(millis, tz);
    return millis - (parts.hour * 3600000 + parts.minute * 60000) - (new Date(millis).getSeconds() * 1000 + new Date(millis).getMilliseconds());
};

export const isToday = (millis, tz = DEFAULT_TZ, now = Date.now()) => localParts(millis, tz).dayKey === localParts(now, tz).dayKey;

/* ---------- AGREGAÇÕES ---------- */

export const liveOrders = (orders) => entries(orders).filter((order) => !TERMINAL.includes(order.status));

export const summarizeOrders = (orderList) => {
    const valid = orderList.filter((order) => order.status !== "cancelled");
    const cancelled = orderList.filter((order) => order.status === "cancelled");

    const itemsCents = valid.reduce((sum, order) => sum + (Number(order.totals?.subtotalCents) || 0), 0);
    const deliveryCents = valid.reduce((sum, order) => sum + (Number(order.totals?.deliveryFeeCents) || 0), 0);

    return {
        count: valid.length,
        itemsCents,
        deliveryCents,
        cancelledCount: cancelled.length,
        cancelledCents: cancelled.reduce((sum, order) => sum + (Number(order.totals?.totalCents) || 0), 0)
    };
};

export const topProducts = (orderList, limit = 8) => {
    const map = {};
    orderList
        .filter((order) => order.status !== "cancelled")
        .forEach((order) => {
            asList(order.items).forEach((item) => {
                if (item.status === "cancelled") return;
                const key = item.productId || item.name;
                const row = (map[key] = map[key] || { key, name: item.name, categoryId: item.categoryId || null, qty: 0, cents: 0 });
                row.qty += Number(item.qty) || 0;
                row.cents += Number(item.totalCents) || (Number(item.unitCents) || 0) * (Number(item.qty) || 0);
            });
        });
    return Object.values(map).sort((a, b) => b.qty - a.qty || b.cents - a.cents).slice(0, limit);
};

export const byHour = (orderList, tz = DEFAULT_TZ) => {
    const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    orderList
        .filter((order) => order.status !== "cancelled")
        .forEach((order) => {
            hours[localParts(order.createdAt, tz).hour].count += 1;
        });
    return hours;
};

export const toCsv = (rows) =>
    rows
        .map((row) =>
            row
                .map((cell) => {
                    const value = cell === null || cell === undefined ? "" : String(cell);
                    return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
                })
                .join(";")
        )
        .join("\n");

export const downloadText = (filename, content, type = "text/csv;charset=utf-8") => {
    const blob = new Blob(["﻿", content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
