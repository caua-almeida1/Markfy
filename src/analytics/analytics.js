import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { hasConsent, subscribeConsent } from "../utils/consent";

/* =========================================================
   GOOGLE ANALYTICS 4 — SÓ COM CONSENTIMENTO

   Desligado por padrão. Só carrega quando as DUAS coisas
   acontecem:

     1. existe REACT_APP_GA_MEASUREMENT_ID no ambiente de
        build (Vercel → Environment Variables), e
     2. a pessoa aceitou "Estatísticas" no aviso de cookies.

   Sem ID, nada é baixado nem enviado. Sem aceite, o script do
   Google nem é inserido na página. Ao revogar, o envio para,
   os cookies _ga são apagados e o script deixa de mandar
   dados (ga-disable).

   Uma propriedade GA4 para a rede toda (o domínio é um só):
   cada evento leva `markfy_product` = bookings | studio |
   menus | markfy, para segmentar por produto nos relatórios.

   PRIVACIDADE
   - page_view manda só o CAMINHO, sem query string (convites,
     pagamentos e buscas podem carregar ids e textos).
   - IDs em caminhos (/invite/xxx, /m/slug/pedido/xxx) viram
     ":id". Handle de empresa fica: é nome comercial público.
   - Parâmetros de evento passam por lista branca; nome,
     e-mail, telefone, termo digitado e dados de agendamento
     NUNCA saem daqui.
   - Google Signals e personalização de anúncios desligados.
========================================================= */

const MEASUREMENT_ID = (process.env.REACT_APP_GA_MEASUREMENT_ID || "").trim();

export const ANALYTICS_ENABLED = /^G-[A-Z0-9]+$/.test(MEASUREMENT_ID);

const ALLOWED_PARAMS = new Set([
    "markfy_product",
    "method",
    "company_handle",
    "plan_id",
    "result_count",
    "value",
    "currency",
    "status"
]);

let loaded = false;

const productFor = (path) => {
    if (path.startsWith("/studio") || path.startsWith("/s/")) return "studio";
    if (path.startsWith("/menus") || path.startsWith("/m/")) return "menus";
    if (path.startsWith("/central-user") || path.startsWith("/central-adm") || path.startsWith("/checkout")) return "bookings";
    return "markfy";
};

/** Caminho sem query, com ids trocados por ":id". */
export const sanitizePath = (pathname = "/") =>
    String(pathname)
        .split("?")[0]
        .replace(/^\/(invite|entrar-equipe|newcompany(?:\/previewcompany)?)\/[^/]+/, "/$1/:id")
        .replace(/^\/m\/([^/]+)\/pedido\/[^/]+/, "/m/$1/pedido/:id")
        || "/";

const sanitizeParams = (params = {}) =>
    Object.fromEntries(
        Object.entries(params).filter(([key, value]) =>
            ALLOWED_PARAMS.has(key) &&
            (typeof value === "number" || (typeof value === "string" && value.length <= 100))
        )
    );

const gtag = (...args) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(args);
};

const deleteGaCookies = () => {
    document.cookie.split(";").forEach((pair) => {
        const name = pair.split("=")[0].trim();
        if (!name.startsWith("_ga")) return;
        const host = window.location.hostname;
        [`; path=/`, `; path=/; domain=${host}`, `; path=/; domain=.${host}`].forEach((suffix) => {
            document.cookie = `${name}=; max-age=0${suffix}`;
        });
    });
};

const load = () => {

    if (loaded || !ANALYTICS_ENABLED) return;

    loaded = true;

    window[`ga-disable-${MEASUREMENT_ID}`] = false;

    gtag("consent", "default", {
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied"
    });

    gtag("js", new Date());

    gtag("config", MEASUREMENT_ID, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false
    });

    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
    document.head.appendChild(script);
};

const stop = () => {

    if (!ANALYTICS_ENABLED) return;

    window[`ga-disable-${MEASUREMENT_ID}`] = true;

    if (loaded) {
        gtag("consent", "update", { analytics_storage: "denied" });
    }

    deleteGaCookies();
};

const canSend = () => ANALYTICS_ENABLED && loaded && hasConsent("analytics");

/** Evento de produto. Parâmetros fora da lista branca são descartados. */
export const trackEvent = (name, params = {}) => {

    if (!canSend() || !/^[a-z][a-z0-9_]{0,39}$/.test(name)) return;

    gtag("event", name, {
        markfy_product: productFor(window.location.pathname),
        ...sanitizeParams(params)
    });
};

/**
 * Liga o Analytics conforme o consentimento e manda um
 * page_view por troca de rota (uma vez só por caminho, mesmo
 * no Strict Mode, que monta efeitos duas vezes em dev).
 */
const sendPageView = (pathname) => {

    if (!canSend()) return;

    const path = sanitizePath(pathname);

    if (window.__markfyLastPageView === path) return;

    window.__markfyLastPageView = path;

    gtag("event", "page_view", {
        page_path: path,
        page_location: `${window.location.origin}${path}`,
        page_title: document.title,
        markfy_product: productFor(path)
    });
};

export const useAnalytics = () => {

    const location = useLocation();

    useEffect(() => {

        if (!ANALYTICS_ENABLED) return undefined;

        const sync = () => {
            if (hasConsent("analytics")) {
                load();
                /* Aceitou agora: a página atual também conta. */
                sendPageView(window.location.pathname);
            } else {
                stop();
                window.__markfyLastPageView = null;
            }
        };

        sync();

        return subscribeConsent(sync);
    }, []);

    useEffect(() => {
        sendPageView(location.pathname);
    }, [location.pathname]);
};
