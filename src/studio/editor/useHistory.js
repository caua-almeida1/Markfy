import { useCallback, useRef, useState } from "react";

/* =========================================================
   HISTÓRICO DO EDITOR (desfazer / refazer)

   Digitar num campo gera uma mudança por tecla. Mudanças
   seguidas com a mesma `key` em menos de 900ms viram um
   passo só: desfazer volta a frase, não a letra.
========================================================= */

const LIMIT = 80;
const COALESCE_MS = 900;

export const useHistory = (initial) => {
    const [state, setState] = useState({ past: [], present: initial, future: [] });
    const last = useRef({ key: null, at: 0 });

    const reset = useCallback((value) => {
        last.current = { key: null, at: 0 };
        setState({ past: [], present: value, future: [] });
    }, []);

    const commit = useCallback((updater, key) => {
        setState((current) => {
            const next = typeof updater === "function" ? updater(current.present) : updater;

            if (next === current.present) return current;

            const now = Date.now();
            const merge = key && last.current.key === key && now - last.current.at < COALESCE_MS;

            last.current = { key: key || null, at: now };

            return {
                past: merge ? current.past : [...current.past, current.present].slice(-LIMIT),
                present: next,
                future: []
            };
        });
    }, []);

    const undo = useCallback(() => {
        last.current = { key: null, at: 0 };
        setState((current) =>
            current.past.length
                ? {
                    past: current.past.slice(0, -1),
                    present: current.past[current.past.length - 1],
                    future: [current.present, ...current.future]
                }
                : current
        );
    }, []);

    const redo = useCallback(() => {
        last.current = { key: null, at: 0 };
        setState((current) =>
            current.future.length
                ? {
                    past: [...current.past, current.present],
                    present: current.future[0],
                    future: current.future.slice(1)
                }
                : current
        );
    }, []);

    return {
        value: state.present,
        commit,
        undo,
        redo,
        reset,
        canUndo: state.past.length > 0,
        canRedo: state.future.length > 0
    };
};
