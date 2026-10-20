import { resolveContext, runAction } from "../engine/actions.js";
import { MENUS_FEATURE_DEFAULTS } from "../engine/licensing.js";
import { createDemoDb, DEMO_HANDLE, DEMO_TEAM } from "./demoData.js";

/* =========================================================
   FONTE DE DADOS DA DEMONSTRAÇÃO

   Mesma interface da fonte real (firebaseSource.js), mas tudo
   acontece num banco em memória. As ações rodam o MESMO motor
   do servidor, com a pessoa escolhida em "Ver como" e o plano
   escolhido em "Simular plano" — dá para sentir as permissões
   e os bloqueios de verdade, sem nada sair do navegador.
========================================================= */

const filterQuery = (value, options) => {
    if (!options || !value || typeof value !== "object") return value;

    let rows = Object.entries(value);
    const key = options.orderBy;

    if (key) {
        rows = rows.filter(([, item]) => item && item[key] !== undefined && item[key] !== null);
        if (options.equalTo !== undefined) rows = rows.filter(([, item]) => item[key] === options.equalTo);
        if (options.startAt !== undefined) rows = rows.filter(([, item]) => item[key] >= options.startAt);
        if (options.endAt !== undefined) rows = rows.filter(([, item]) => item[key] <= options.endAt);
        rows.sort(([, a], [, b]) => (a[key] > b[key] ? 1 : a[key] < b[key] ? -1 : 0));
    }

    if (options.limitToLast) rows = rows.slice(-options.limitToLast);

    return rows.length ? Object.fromEntries(rows) : null;
};

export const createDemoSource = async ({ plan = "premium" } = {}) => {
    const { db, handle } = await createDemoDb({ plan });

    let actingAs = "demo-owner";

    const source = {
        kind: "demo",
        handle,
        demo: true,

        now: () => Date.now(),

        newKey: () => db.newKey(),

        watch: (path, callback, options) => db.on(path, (value) => callback(filterQuery(value, options), null)),

        get: (path) => db.get(path),

        set: (path, value) => db.set(path, value),

        update: (patch) => db.update(patch),

        remove: (path) => db.set(path, null),

        action: async (name, payload) => {
            const ctx = await resolveContext(db, { handle, uid: actingAs, name: DEMO_TEAM[actingAs]?.name, now: Date.now() });
            return runAction(db, ctx, name, payload);
        },

        publicAction: async (name, payload) => {
            const ctx = await resolveContext(db, { handle, uid: null, now: Date.now() });
            return runAction(db, ctx, name, payload);
        },

        /* Imagem só desta aba: some ao recarregar. */
        upload: async (file) => URL.createObjectURL(file),

        /* ----- controles exclusivos da demonstração ----- */

        actingAs: () => actingAs,

        setActingAs: (uid) => {
            if (DEMO_TEAM[uid]) actingAs = uid;
        },

        setPlan: async (planId) => {
            const features = MENUS_FEATURE_DEFAULTS[planId] || MENUS_FEATURE_DEFAULTS.premium;
            await db.update({
                [`licenses/${handle}/plan`]: planId,
                [`licenses/${handle}/product`]: planId === "premium" ? "all" : "menus",
                [`planCatalog/${planId}`]: { name: planId, features, limits: planId === "standard" ? { menusMaxTables: 40 } : {} }
            });
        }
    };

    return source;
};

export { DEMO_HANDLE, DEMO_TEAM };
