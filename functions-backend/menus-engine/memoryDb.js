/* =========================================================
   BANCO EM MEMÓRIA

   Mesmo contrato do adaptador do Admin SDK (actions.js), mais
   assinaturas para a interface reagir. Usado pelo modo de
   demonstração — nada sai do navegador nem toca o banco real
   — e pelos testes do motor.

   Semântica copiada do Realtime Database:
     - gravar null remove o nó;
     - objetos vazios somem;
     - transaction(fn) é atômica (aqui, síncrona);
     - quem assina um caminho é avisado quando ele, um pai ou
       um filho muda.
========================================================= */

import { clean, pushId } from "./util.js";

const split = (path) => String(path || "").split("/").filter(Boolean);

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const prune = (value) => {
    if (Array.isArray(value)) {
        const list = value.map(prune);
        return list.every((item) => item === null) ? null : list;
    }
    if (!isObject(value)) return value === undefined ? null : value;
    const result = {};
    Object.entries(value).forEach(([key, child]) => {
        const next = prune(child);
        if (next !== null) result[key] = next;
    });
    return Object.keys(result).length ? result : null;
};

export const createMemoryDb = (initial = {}, { now = () => Date.now() } = {}) => {
    let root = prune(clean(initial)) || {};
    const listeners = new Map();

    const read = (path) => {
        let node = root;
        for (const key of split(path)) {
            if (!node || typeof node !== "object") return null;
            node = node[key];
        }
        return node === undefined ? null : node;
    };

    /* Cópia só do caminho alterado (o resto da árvore é
       compartilhado): gravar continua barato com milhares de
       pedidos na memória. */
    const writeRaw = (path, value) => {
        const keys = split(path);
        const next = prune(clean(value));

        if (!keys.length) {
            root = isObject(next) ? next : {};
            return;
        }

        const draft = isObject(root) ? { ...root } : {};
        const trail = [];
        let cursor = draft;
        for (let i = 0; i < keys.length - 1; i += 1) {
            const key = keys[i];
            cursor[key] = isObject(cursor[key]) ? { ...cursor[key] } : {};
            trail.push([cursor, key]);
            cursor = cursor[key];
        }

        const last = keys[keys.length - 1];
        if (next === null) delete cursor[last];
        else cursor[last] = next;

        for (let i = trail.length - 1; i >= 0; i -= 1) {
            const [parent, key] = trail[i];
            if (Object.keys(parent[key]).length) break;
            delete parent[key];
        }

        root = draft;
    };

    const notify = (changed) => {
        const changedKeys = changed.map(split);
        listeners.forEach((set, path) => {
            const keys = split(path);
            const hit = changedKeys.some((target) => {
                const len = Math.min(keys.length, target.length);
                for (let i = 0; i < len; i += 1) if (keys[i] !== target[i]) return false;
                return true;
            });
            if (hit) {
                const value = clean(read(path));
                set.forEach((callback) => {
                    try {
                        callback(value);
                    } catch (error) {
                        /* Um ouvinte com erro não derruba os outros. */
                        // eslint-disable-next-line no-console
                        console.error(error);
                    }
                });
            }
        });
    };

    /* Avisos em lote no próximo tique, como o SDK faz. */
    let pending = new Set();
    let scheduled = false;
    const schedule = (path) => {
        pending.add(path);
        if (scheduled) return;
        scheduled = true;
        Promise.resolve().then(() => {
            const paths = [...pending];
            pending = new Set();
            scheduled = false;
            notify(paths);
        });
    };

    const api = {
        kind: "memory",

        now,

        newKey: () => pushId(now()),

        get: async (path) => clean(read(path)),

        set: async (path, value) => {
            writeRaw(path, value);
            schedule(path);
        },

        update: async (updates) => {
            Object.entries(updates || {}).forEach(([path, value]) => {
                writeRaw(path, value);
                schedule(path);
            });
        },

        transaction: async (path, fn) => {
            const current = clean(read(path));
            const next = fn(current);
            if (next === undefined) return { committed: false, value: current };
            writeRaw(path, next);
            schedule(path);
            return { committed: true, value: clean(read(path)) };
        },

        /** Assina um caminho. Chama já com o valor atual. */
        on: (path, callback) => {
            const key = split(path).join("/");
            if (!listeners.has(key)) listeners.set(key, new Set());
            listeners.get(key).add(callback);
            Promise.resolve().then(() => {
                if (listeners.get(key)?.has(callback)) callback(clean(read(key)));
            });
            return () => {
                listeners.get(key)?.delete(callback);
            };
        },

        snapshot: () => clean(root),

        reset: (value) => {
            root = prune(clean(value)) || {};
            notify([""]);
        }
    };

    return api;
};
