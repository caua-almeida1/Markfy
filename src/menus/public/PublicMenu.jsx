import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getDatabase, onValue, ref } from "firebase/database";
import { Icon } from "@iconify/react";

import { callMenusApi } from "../data/firebaseSource.js";
import MenuRenderer, { themeVars } from "../site/MenuRenderer.jsx";
import OrderTracking from "../site/OrderTracking.jsx";
import { normalizeDesign } from "../engine/design.js";
import { ensureFonts } from "../site/fonts.js";

import "../site/menu-renderer.css";
import "./public-menu.css";

/* =========================================================
   CARDÁPIO PÚBLICO — /m/{endereço}

     /m/{endereço}                     cardápio
     /m/{endereço}?mesa={id}           cardápio da mesa (QR)
     /m/{endereço}/pedido/{id}         acompanhamento do pedido

   Sem login. Lê só o que as regras liberam para o público
   (aparência publicada, configurações públicas, catálogo e o
   espelho do pedido, que não tem dados pessoais). Pedido e
   chamado de garçom vão para a Cloud Function, que recalcula
   tudo no servidor.
========================================================= */

const db = () => getDatabase();

const watch = (path, callback) =>
    onValue(ref(db(), path), (snapshot) => callback(snapshot.val()), () => callback(null));

/* Leitura que falhou (sem permissão, sem rede) não é "não
   existe": vira LOAD_ERROR e a tela oferece tentar de novo. */
const LOAD_ERROR = Symbol("load-error");

const useLive = (path, attempt) => {
    const [state, setState] = useState({ path: null, value: undefined });
    useEffect(() => {
        if (!path) return undefined;
        return onValue(
            ref(db(), path),
            (snapshot) => setState({ path, value: snapshot.val() }),
            () => setState({ path, value: LOAD_ERROR })
        );
    }, [path, attempt]);
    return state.path === path ? state.value : undefined;
};

/* Sem rede o Realtime Database não chama erro: só fica
   esperando. Depois de alguns segundos avisamos a pessoa. */
const useStalled = (loading, attempt, ms = 12000) => {
    const [stalled, setStalled] = useState(false);
    useEffect(() => {
        setStalled(false);
        if (!loading) return undefined;
        const timer = setTimeout(() => setStalled(true), ms);
        return () => clearTimeout(timer);
    }, [loading, attempt, ms]);
    return stalled;
};

const Unavailable = ({ title = "Cardápio indisponível", text = "Este cardápio não está publicado no momento. Fale com o estabelecimento.", onRetry }) => (
    <div className="mpm-state">
        <Icon icon={onRetry ? "solar:danger-circle-linear" : "solar:document-text-linear"} aria-hidden="true" />
        <h1>{title}</h1>
        <p>{text}</p>
        {onRetry ? (
            <button type="button" className="mpm-retry" onClick={onRetry}>Tentar de novo</button>
        ) : (
            <Link to="/">Conheça a Markfy</Link>
        )}
    </div>
);

const ConnectionProblem = ({ onRetry }) => (
    <Unavailable
        title="Não conseguimos carregar o cardápio"
        text="Verifique sua conexão com a internet e tente de novo."
        onRetry={onRetry}
    />
);

const Loading = () => (
    <div className="mpm-state" role="status">
        <span className="mpm-spinner" aria-hidden="true" />
        <p>Carregando o cardápio…</p>
    </div>
);

const useSlug = (slug, attempt) => {
    const value = useLive(slug ? `menusSlugs/${slug}` : null, attempt);
    if (!slug) return { loading: false, failed: false, handle: null };
    if (value === undefined) return { loading: true, failed: false, handle: null };
    if (value === LOAD_ERROR) return { loading: false, failed: true, handle: null };
    return { loading: false, failed: false, handle: value || null };
};

/* Caracteres que o Realtime Database não aceita em caminho
   (. # $ [ ]): o ref() lançaria erro e a página ficaria branca. */
const safeKey = (value) => (value && !/[.#$[\]/]/.test(value) ? value : null);

export default function PublicMenu() {
    const routeParams = useParams();
    const slug = safeKey(routeParams.slug);
    const orderId = safeKey(routeParams.orderId);
    const [params] = useSearchParams();
    const tableId = safeKey(params.get("mesa"));

    const [attempt, setAttempt] = useState(0);
    const retry = useCallback(() => setAttempt((value) => value + 1), []);

    const { loading: resolving, failed, handle } = useSlug(slug, attempt);

    const access = useLive(handle ? `publicAccess/${handle}` : null, attempt);
    const site = useLive(handle ? `menusSites/${handle}` : null, attempt);
    const settings = useLive(handle ? `menusSettings/${handle}` : null, attempt);
    const catalog = useLive(handle ? `menusCatalog/${handle}` : null, attempt);
    const floorRaw = useLive(handle && tableId ? `menusFloor/${handle}` : null, attempt);
    const floor = floorRaw === LOAD_ERROR ? null : floorRaw;

    const loadFailed = failed || [access, site, settings, catalog].includes(LOAD_ERROR);
    const loading = resolving || (Boolean(handle) && [access, site, settings, catalog].includes(undefined));
    const stalled = useStalled(loading && !loadFailed, attempt);

    const design = useMemo(() => (site && site !== LOAD_ERROR && site.design ? normalizeDesign(site.design) : null), [site]);

    useEffect(() => {
        document.body.classList.add("mk-bleed", "mpm-body");
        return () => document.body.classList.remove("mk-bleed", "mpm-body");
    }, []);

    /* Título, cor do navegador e ícone da aba do estabelecimento. */
    useEffect(() => {
        if (!design || !settings) return undefined;
        const previous = document.title;
        document.title = orderId ? `Pedido · ${settings.profile?.name || "Cardápio"}` : `${settings.profile?.name || "Cardápio"} · Cardápio`;

        const meta = document.querySelector('meta[name="theme-color"]');
        const previousColor = meta?.getAttribute("content");
        if (meta) meta.setAttribute("content", design.theme.colors.primary);

        let icon = null;
        if (design.images.favicon || design.images.logo) {
            icon = document.createElement("link");
            icon.rel = "icon";
            icon.href = design.images.favicon || design.images.logo;
            icon.dataset.menus = "1";
            document.head.appendChild(icon);
        }

        return () => {
            document.title = previous;
            if (meta && previousColor) meta.setAttribute("content", previousColor);
            icon?.remove();
        };
    }, [design, settings, orderId]);

    useEffect(() => {
        if (design) ensureFonts([design.theme.fonts.heading, design.theme.fonts.body]);
    }, [design]);

    const actions = useMemo(() => ({
        placeOrder: (payload) => callMenusApi(handle, "public.placeOrder", payload, { auth: false }),
        call: (type) => callMenusApi(handle, "public.call", { tableId, type }, { auth: false })
    }), [handle, tableId]);

    const watchTrack = useCallback((callback) => watch(`menusTrack/${handle}/${orderId}`, callback), [handle, orderId]);

    if (loadFailed || stalled) return <ConnectionProblem onRetry={retry} />;
    if (resolving) return <Loading />;
    if (!handle) return <Unavailable title="Cardápio não encontrado" text="Confira o endereço com o estabelecimento." />;
    if (loading) return <Loading />;
    if (!access?.menus || !site?.publishedAt || !design) return <Unavailable />;

    if (orderId) {
        return (
            <div className="mnr mpm-track" style={themeVars(design)}>
                <div className="mnr-wrap mpm-track__inner">
                    <Link className="mpm-back" to={`/m/${slug}`}><Icon icon="solar:arrow-left-linear" aria-hidden="true" /> Voltar ao cardápio</Link>
                    <h1 className="mnr-title">{settings?.profile?.name}</h1>
                    <OrderTracking watch={watchTrack} />
                    <p className="mnr-muted">Esta página se atualiza sozinha. Guarde o link para acompanhar o pedido.</p>
                </div>
            </div>
        );
    }

    return (
        <MenuRenderer
            design={design}
            settings={settings || {}}
            catalog={catalog || {}}
            floor={floor || {}}
            features={site.features || { menusOrdering: true, menusTables: true }}
            mode="public"
            handle={handle}
            tableId={tableId && floor?.tables?.[tableId] ? tableId : null}
            actions={actions}
            trackingLink={(id) => `/m/${slug}/pedido/${id}`}
        />
    );
}
