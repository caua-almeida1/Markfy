import { useCallback, useEffect, useMemo, useState } from "react";

import { quoteLines } from "../engine/pricing.js";
import { pushId } from "../engine/util.js";

/* =========================================================
   SACOLA DO CLIENTE

   Guarda só as ESCOLHAS (produto, tamanho, opções, quantidade,
   observação). Preço e disponibilidade são recalculados a cada
   render contra o catálogo atual — se o restaurante mudar um
   preço ou esgotar um item, a sacola mostra na hora. O valor
   final é recalculado de novo no servidor.

   No cardápio público a sacola sobrevive a recarregar a página
   (localStorage por estabelecimento). A chave de idempotência
   nasce com a sacola e só é trocada depois de um pedido aceito:
   clicar duas vezes em "Finalizar" nunca cria dois pedidos.
========================================================= */

const read = (key) => {
    if (!key) return null;
    try {
        return JSON.parse(window.localStorage.getItem(key) || "null");
    } catch {
        return null;
    }
};

const write = (key, value) => {
    if (!key) return;
    try {
        if (value) window.localStorage.setItem(key, JSON.stringify(value));
        else window.localStorage.removeItem(key);
    } catch {
        /* navegação privada: a sacola vale só nesta aba */
    }
};

const freshKey = () => `cart-${pushId()}`.replace(/[^A-Za-z0-9_-]/g, "");

const sameChoice = (a, b) =>
    a.productId === b.productId &&
    (a.sizeId || null) === (b.sizeId || null) &&
    JSON.stringify(a.options || {}) === JSON.stringify(b.options || {}) &&
    (a.notes || "") === (b.notes || "");

export const useCart = ({ storageKey, catalog, now, tz }) => {
    const [state, setState] = useState(() => {
        const saved = read(storageKey);
        return saved && Array.isArray(saved.lines) ? saved : { lines: [], key: freshKey() };
    });

    useEffect(() => {
        write(storageKey, state.lines.length ? state : null);
    }, [storageKey, state]);

    const add = useCallback((selection) => {
        setState((current) => {
            const lines = [...current.lines];
            const index = lines.findIndex((line) => sameChoice(line, selection));
            if (index >= 0) {
                lines[index] = { ...lines[index], qty: Math.min(99, lines[index].qty + (selection.qty || 1)) };
            } else {
                lines.push({ ...selection, id: pushId(), qty: selection.qty || 1 });
            }
            return { ...current, lines };
        });
    }, []);

    const setQty = useCallback((id, qty) => {
        setState((current) => ({
            ...current,
            lines: qty <= 0 ? current.lines.filter((line) => line.id !== id) : current.lines.map((line) => (line.id === id ? { ...line, qty: Math.min(99, qty) } : line))
        }));
    }, []);

    const remove = useCallback((id) => setState((current) => ({ ...current, lines: current.lines.filter((line) => line.id !== id) })), []);

    const clear = useCallback(() => setState({ lines: [], key: freshKey() }), []);

    const quote = useMemo(() => {
        const result = quoteLines(catalog, state.lines, { now, tz });
        return {
            ...result,
            lines: result.lines.map((item, index) => ({ ...item, id: state.lines[index].id }))
        };
    }, [catalog, state.lines, now, tz]);

    const count = state.lines.reduce((sum, line) => sum + (line.qty || 0), 0);

    return {
        lines: state.lines,
        idempotencyKey: state.key,
        quote,
        count,
        add,
        setQty,
        remove,
        clear
    };
};
