import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { useToast } from "../design-system/components";
import { ACTION_FEATURE, can as canRole, resolveRole } from "./engine/permissions.js";
import { licenseActive, MENUS_FEATURE_IDS, planFeature, planLimit, productIncludes } from "./engine/licensing.js";
import { entries } from "./engine/util.js";

/* =========================================================
   CONTEXTO DO MARKFY MENUS

   Junta, para todas as telas, a FONTE de dados (Firebase real
   ou demonstração em memória), a empresa, o papel da pessoa,
   os recursos do plano e os dados vivos da operação.

   Papel e plano são calculados com as MESMAS funções que o
   servidor usa (src/menus/engine), a partir dos mesmos nós
   do banco. Assim o painel só mostra o que o servidor aceitaria
   — e, se alguém forçar, o servidor recusa.
========================================================= */

const MenusContext = createContext(null);

/** Assina um caminho da fonte. */
export const useNode = (source, path, options) => {
    const key = path ? `${path}|${options ? JSON.stringify(options) : ""}` : null;
    const [state, setState] = useState({ key: null, value: null, loading: true, error: null });

    useEffect(() => {
        if (!source || !path) {
            setState({ key, value: null, loading: false, error: null });
            return undefined;
        }

        setState((current) => (current.key === key ? current : { key, value: null, loading: true, error: null }));

        return source.watch(
            path,
            (value, error) => setState({ key, value: value ?? null, loading: false, error: error || null }),
            options
        );
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [source, key]);

    return state.key === key ? state : { key, value: null, loading: true, error: null };
};

/** Relógio que avança a cada `ms` (tempo de mesa, atraso). */
export const useNow = (ms = 30000) => {
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), ms);
        return () => clearInterval(id);
    }, [ms]);
    return now;
};

const HOUR = 3600000;

/* Conexão com o banco. Começa como "online" e só acusa queda
   depois de alguns segundos sem socket, para não piscar aviso
   enquanto a página ainda está conectando. */
const useConnection = (source) => {
    const [online, setOnline] = useState(true);

    useEffect(() => {
        if (!source?.watchConnection) return undefined;

        let timer = null;
        const stop = source.watchConnection((connected) => {
            clearTimeout(timer);
            if (connected) setOnline(true);
            else timer = setTimeout(() => setOnline(false), 4000);
        });

        return () => {
            clearTimeout(timer);
            stop?.();
        };
    }, [source]);

    return online;
};

export const MenusProvider = ({ source, base, user, children }) => {
    const notify = useToast();
    const handle = source?.handle || null;
    const uid = user?.uid || null;

    const [windowStart] = useState(() => Date.now() - 36 * HOUR);

    const license = useNode(source, handle && `licenses/${handle}`);
    const planId = license.value?.plan || null;
    const plan = useNode(source, planId && `planCatalog/${planId}`);
    const member = useNode(source, handle && uid && `companys/${handle}/members/${uid}`);
    const staffMe = useNode(source, handle && uid && `menusStaff/${handle}/${uid}`);

    const catalog = useNode(source, handle && `menusCatalog/${handle}`);
    const settings = useNode(source, handle && `menusSettings/${handle}`);
    const floor = useNode(source, handle && `menusFloor/${handle}`);
    const staff = useNode(source, handle && `menusStaff/${handle}`);
    const draft = useNode(source, handle && `menusDrafts/${handle}`);
    const site = useNode(source, handle && `menusSites/${handle}`);
    const stock = useNode(source, handle && `menusStock/${handle}`);

    const tableState = useNode(source, handle && `menusOps/${handle}/tableState`);
    const openTabs = useNode(source, handle && `menusOps/${handle}/tabs`, { orderBy: "status", equalTo: "open" });
    const orders = useNode(source, handle && `menusOps/${handle}/orders`, { orderBy: "createdAt", startAt: windowStart });
    const calls = useNode(source, handle && `menusOps/${handle}/calls`, { orderBy: "status", equalTo: "open" });

    const online = useConnection(source);

    /* Pedido novo chegando: aviso e (opcional) som. */
    const seen = useRef(null);
    const [soundOn, setSoundOn] = useState(() => {
        try {
            return window.localStorage.getItem("markfy:menus:sound") === "1";
        } catch {
            return false;
        }
    });

    const toggleSound = useCallback(() => {
        setSoundOn((value) => {
            const next = !value;
            try {
                window.localStorage.setItem("markfy:menus:sound", next ? "1" : "0");
            } catch {
                /* sem armazenamento: vale só nesta aba */
            }
            return next;
        });
    }, []);

    useEffect(() => {
        if (orders.loading) return;
        const list = entries(orders.value);
        const received = list.filter((order) => order.status === "received").map((order) => order.id);

        if (seen.current === null) {
            seen.current = new Set(received);
            return;
        }

        const fresh = list.filter((order) => order.status === "received" && !seen.current.has(order.id));
        received.forEach((id) => seen.current.add(id));

        if (fresh.length) {
            const first = fresh[0];
            notify("info", fresh.length > 1 ? `${fresh.length} pedidos novos` : `Novo pedido #${first.code}`, first.customer?.name || "Confira no painel de pedidos.");
            if (soundOn) beep();
        }
    }, [orders.loading, orders.value, notify, soundOn]);

    const value = useMemo(() => {
        const now = Date.now();
        const active = licenseActive(license.value, now);
        const menusEnabled = active && productIncludes(license.value?.product, "menus");

        const features = {};
        MENUS_FEATURE_IDS.forEach((feature) => {
            features[feature] = menusEnabled && planFeature(planId, plan.value, feature);
        });

        const role = member.value ? resolveRole(member.value.role, staffMe.value) : null;
        const grants = role && role !== "owner" && role !== "admin" ? staffMe.value?.grants || null : null;

        const can = (action) => canRole(role, action, grants);
        const allowed = (action) => can(action) && (!ACTION_FEATURE[action] || features[ACTION_FEATURE[action]]);

        const act = async (name, payload, { success, quiet } = {}) => {
            try {
                const result = await source.action(name, payload);
                if (success) notify("success", success);
                return result;
            } catch (error) {
                if (!quiet) notify("error", "Não deu certo", error.message || "Tente de novo.");
                throw error;
            }
        };

        return {
            source,
            handle,
            base,
            demo: Boolean(source?.demo),
            user,
            loading: license.loading || member.loading || catalog.loading || settings.loading,
            /* Falha ao ler o básico (sem permissão ou sem rede): sem
               isso o painel concluiria "sem plano" ou "fora da equipe". */
            loadError: license.error || member.error || catalog.error || settings.error || null,
            online,
            license: license.value,
            planId,
            menusEnabled,
            features,
            feature: (id) => Boolean(features[id]),
            maxTables: planLimit(planId, plan.value, "menusMaxTables"),
            role,
            can,
            allowed,
            act,
            notify,
            catalog: catalog.value || {},
            settings: settings.value || {},
            floor: floor.value || {},
            staff: staff.value || {},
            draft: draft.value,
            draftLoading: draft.loading,
            site: site.value,
            stock: stock.value || {},
            tableState: tableState.value || {},
            openTabs: openTabs.value || {},
            orders: orders.value || {},
            ordersLoading: orders.loading,
            calls: calls.value || {},
            soundOn,
            toggleSound,
            path: (to = "") => `${base}${to ? `/${to.replace(/^\//, "")}` : ""}`
        };
    }, [source, handle, base, user, license, planId, plan, member, staffMe, catalog, settings, floor, staff, draft, site, stock, tableState, openTabs, orders, calls, notify, soundOn, toggleSound, online]);

    return <MenusContext.Provider value={value}>{children}</MenusContext.Provider>;
};

export const useMenus = () => {
    const value = useContext(MenusContext);
    if (!value) throw new Error("useMenus precisa estar dentro de <MenusProvider>.");
    return value;
};

/* Aviso sonoro curto, gerado no navegador (sem arquivo). */
let audioContext = null;

export const beep = () => {
    try {
        const AudioCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtor) return;
        audioContext = audioContext || new AudioCtor();
        const ctx = audioContext;
        [0, 0.18].forEach((delay, index) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = index ? 1046 : 784;
            gain.gain.setValueAtTime(0.0001, ctx.currentTime + delay);
            gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + delay + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + delay + 0.16);
            osc.connect(gain).connect(ctx.destination);
            osc.start(ctx.currentTime + delay);
            osc.stop(ctx.currentTime + delay + 0.18);
        });
    } catch {
        /* sem áudio */
    }
};
