/* =========================================================
   ESTOQUE (estrutura inicial: por produto)

     menusStock/{handle}/{productId}
       { track, qty, min, unit, updatedAt }

     menusStockMoves/{handle}/{id}
       { productId, delta, after, type, reason, orderId, by, at }

   Tipos de movimento:
     sale     baixa por pedido CONFIRMADO
     return   devolução por cancelamento de pedido que já tinha baixado
     entry    entrada (compra, produção)
     loss     perda/quebra
     adjust   contagem (acerto para um valor)

   Produto com controle ligado e quantidade ≤ 0 vira
   "esgotado" no cardápio (soldOut) automaticamente, e volta
   quando entra estoque. Ingredientes e fichas técnicas ainda
   não fazem parte desta versão: nenhuma baixa é inventada
   para o que não está cadastrado.
========================================================= */

import { asList } from "./util.js";

export const MOVE_TYPES = {
    sale: { label: "Venda", sign: -1 },
    return: { label: "Devolução (cancelamento)", sign: 1 },
    entry: { label: "Entrada", sign: 1 },
    loss: { label: "Perda", sign: -1 },
    adjust: { label: "Acerto de contagem", sign: 0 }
};

/** Quantidade necessária por produto em um conjunto de itens. */
export const stockNeeds = (items) => {
    const needs = {};
    asList(items).forEach((item) => {
        if (!item || item.status === "cancelled" || !item.productId) return;
        needs[item.productId] = (needs[item.productId] || 0) + (Number(item.qty) || 0);
    });
    return needs;
};

export const isLow = (entry) =>
    Boolean(entry?.track) && Number(entry.qty) > 0 && Number(entry.min) > 0 && Number(entry.qty) <= Number(entry.min);

export const isOut = (entry) => Boolean(entry?.track) && Number(entry.qty) <= 0;
