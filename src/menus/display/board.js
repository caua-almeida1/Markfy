import { entries } from "../engine/util.js";

/* =========================================================
   MONITOR DE RETIRADA — QUEM APARECE NA TELA

   Função pura: recebe os pedidos e as opções do painel e
   devolve as duas colunas da TV. A mesma regra serve para a
   TV, para a prévia e para as miniaturas da galeria.

     Preparando  recebido (opcional), confirmado, em preparo
     Pronto      pronto e aguardando retirada, até `readyMinutes`
                 depois de ficar pronto (passou disso, some:
                 a TV não vira um mural de pedidos esquecidos)

   Concluído e cancelado nunca aparecem.
========================================================= */

export const DISPLAY_DEFAULTS = {
    template: "markfy",
    orientation: "landscape",
    title: "Acompanhe seu pedido",
    preparingLabel: "Preparando",
    readyLabel: "Pronto! Pode retirar",
    message: "Obrigado pela preferência! Confira seu número e retire no balcão.",
    channels: { pickup: true, counter: true, table: false, delivery: false },
    showNames: true,
    showReceived: true,
    readyMinutes: 10,
    sound: true,
    voice: false,
    useBrandColor: false
};

export const withDisplayDefaults = (display) => ({
    ...DISPLAY_DEFAULTS,
    ...(display || {}),
    channels: { ...DISPLAY_DEFAULTS.channels, ...(display?.channels || {}) }
});

const PREPARING = ["confirmed", "preparing"];
const READY = ["ready", "awaiting_pickup"];

/** Só o primeiro nome, com no máximo 12 letras: a TV é pública. */
/* Nomes genéricos que o PDV usa quando não há cliente: na TV
   eles só ocupam espaço. */
const GENERIC_NAMES = ["balcao", "balcão", "cliente", "consumidor", "mesa", "retirada", "delivery", "avulso", "-"];

export const publicName = (name) => {
    const first = String(name || "").trim().split(/\s+/)[0] || "";
    if (!first || GENERIC_NAMES.includes(first.toLowerCase())) return "";
    const nice = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
    return nice.length > 12 ? `${nice.slice(0, 11)}…` : nice;
};

const readySince = (order) => Number(order.readyAt || order.awaiting_pickupAt || order.updatedAt || order.createdAt) || 0;

export const buildBoard = (orders, display, now = Date.now()) => {
    const options = withDisplayDefaults(display);
    const limit = Math.max(1, Number(options.readyMinutes) || 10) * 60000;

    const list = (Array.isArray(orders) ? orders : entries(orders))
        .filter((order) => order && order.code && options.channels[order.channel] === true);

    const toCard = (order) => ({
        id: order.id,
        code: String(order.code),
        name: options.showNames ? publicName(order.customer?.name) : "",
        status: order.status,
        since: order.status && READY.includes(order.status) ? readySince(order) : Number(order.createdAt) || 0
    });

    const preparing = list
        .filter((order) => PREPARING.includes(order.status) || (options.showReceived && order.status === "received"))
        .map(toCard)
        .sort((a, b) => a.since - b.since);

    const ready = list
        .filter((order) => READY.includes(order.status) && now - readySince(order) <= limit)
        .map(toCard)
        /* o mais recente primeiro: é ele que a pessoa procura */
        .sort((a, b) => b.since - a.since);

    return { preparing, ready, options };
};

/* Pedidos de exemplo para a galeria e para a prévia quando
   ainda não há pedidos de verdade. */
const SAMPLE_NAMES = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Felipe", "Gabi", "Heitor", "Isis", "João", "Lara", "Miguel"];

export const sampleOrders = (now = Date.now()) => {
    const list = [];
    const add = (n, status, minutesAgo, channel = "pickup") => {
        const at = now - minutesAgo * 60000;
        list.push({
            id: `sample-${n}`,
            code: String(n).padStart(3, "0"),
            channel,
            status,
            customer: { name: SAMPLE_NAMES[n % SAMPLE_NAMES.length] },
            createdAt: at - 600000,
            readyAt: READY.includes(status) ? at : undefined
        });
    };
    [41, 42, 44, 45, 47, 48, 49].forEach((n, i) => add(n, i < 2 ? "preparing" : "confirmed", 9 - i));
    add(50, "received", 1, "counter");
    add(40, "ready", 0.2);
    add(38, "awaiting_pickup", 2, "counter");
    add(39, "ready", 3);
    add(36, "awaiting_pickup", 5);
    add(35, "ready", 7, "counter");
    return list;
};
