/* =====================================================
   REALTIME DATABASE FALSO (só para testes)

   O pedaço do Admin SDK que bookings.js e subscriptions.js
   usam: ref/child, once("value"), set, update (com caminhos
   "a/b"), remove, transaction e orderByChild().equalTo().
   Mesma semântica do RTDB: null remove, objeto vazio some.
===================================================== */

const split = (path) => String(path || "").split("/").filter(Boolean);

const clone = (value) => (value === undefined ? null : JSON.parse(JSON.stringify(value)));

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const prune = (value) => {
    if (!isObject(value)) return value === undefined ? null : value;
    const out = {};
    for (const [key, child] of Object.entries(value)) {
        const next = prune(child);
        if (next !== null) out[key] = next;
    }
    return Object.keys(out).length ? out : null;
};

const createFakeDb = (initial = {}) => {

    let root = prune(clone(initial)) || {};

    const get = (path) => {
        let node = root;
        for (const key of split(path)) {
            if (!isObject(node) || !(key in node)) return null;
            node = node[key];
        }
        return clone(node);
    };

    const put = (path, value) => {
        const keys = split(path);
        if (!keys.length) {
            root = prune(clone(value)) || {};
            return;
        }
        const next = { ...root };
        let node = next;
        keys.slice(0, -1).forEach((key) => {
            node[key] = isObject(node[key]) ? { ...node[key] } : {};
            node = node[key];
        });
        node[keys[keys.length - 1]] = clone(value);
        root = prune(next) || {};
    };

    const snapshot = (value, key) => ({
        key,
        val: () => clone(value),
        exists: () => value !== null && value !== undefined
    });

    const makeQuery = (path, filter = {}) => ({
        orderByChild: (child) => makeQuery(path, { ...filter, child }),
        equalTo: (value) => makeQuery(path, { ...filter, value, hasValue: true }),
        limitToFirst: (limit) => makeQuery(path, { ...filter, limit }),
        once: async () => {
            const all = get(path) || {};
            let entries = Object.entries(all);
            if (filter.child && filter.hasValue) {
                entries = entries.filter(([, item]) => isObject(item) && item[filter.child] === filter.value);
            }
            if (filter.limit) entries = entries.slice(0, filter.limit);
            return snapshot(entries.length ? Object.fromEntries(entries) : null);
        }
    });

    const ref = (path = "") => {

        const normalized = split(path).join("/");

        /* A consulta vem antes: o once() do próprio nó vence o da query. */
        return {
            ...makeQuery(normalized),
            key: split(normalized).pop() || null,
            child: (sub) => ref(`${normalized}/${sub}`),
            once: async () => snapshot(get(normalized), split(normalized).pop()),
            set: async (value) => put(normalized, value),
            remove: async () => put(normalized, null),
            update: async (values) => {
                Object.entries(values).forEach(([key, value]) => put(`${normalized}/${key}`, value));
            },
            transaction: async (fn) => {
                const result = fn(get(normalized));
                if (result === undefined) return { committed: false, snapshot: snapshot(get(normalized)) };
                put(normalized, result);
                return { committed: true, snapshot: snapshot(get(normalized)) };
            },
            push: () => ref(`${normalized}/${Math.random().toString(36).slice(2, 12)}`)
        };
    };

    return { ref, get, put, dump: () => clone(root) };
};

module.exports = { createFakeDb };
