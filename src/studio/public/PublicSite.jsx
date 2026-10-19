import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import SiteRenderer from "../site/SiteRenderer";
import { normalizePage, resolveTheme } from "../site/schema";
import { getPublished, trackEvent } from "../data/studioApi";
import { loadCompanyBundle } from "../data/companyBundle";
import { useBodyClass } from "../../design-system/components";

import markfyLogo from "../../img/logo-markfy.svg";

import "./public-site.css";

/* =========================================================
   PÁGINA PUBLICADA — /s/{handle}

   Lê studioSites/{handle} (leitura pública) e os dados vivos
   da empresa, ajusta título, descrição e tags de
   compartilhamento, e conta a visita.
========================================================= */

const setMeta = (selector, attribute, value) => {
    if (!value) return;
    let node = document.head.querySelector(selector);
    if (!node) {
        node = document.createElement("meta");
        const [, key, name] = selector.match(/\[(\w+)="([^"]+)"\]/) || [];
        if (key) node.setAttribute(key, name);
        document.head.appendChild(node);
    }
    node.setAttribute(attribute, value);
};

const PublicSite = () => {
    useBodyClass("mk-bleed");

    const { handle } = useParams();
    const [state, setState] = useState({ status: "loading", page: null, bundle: null });

    useEffect(() => {
        let cancelled = false;

        Promise.all([getPublished(handle), loadCompanyBundle(handle).catch(() => null)])
            .then(([site, bundle]) => {
                if (cancelled) return;

                const page = normalizePage(site?.page);

                if (!page || !bundle) {
                    setState({ status: "missing", page: null, bundle });
                    return;
                }

                setState({ status: "ready", page, bundle });
                trackEvent(handle, "view");
            })
            .catch(() => !cancelled && setState({ status: "error", page: null, bundle: null }));

        return () => {
            cancelled = true;
        };
    }, [handle]);

    useEffect(() => {
        if (state.status !== "ready") return undefined;

        const { page, bundle } = state;
        const previousTitle = document.title;
        const title = page.seo.title || bundle.name;
        const description = page.seo.description || bundle.description?.slice(0, 160);

        document.title = title;
        setMeta('meta[name="description"]', "content", description);
        setMeta('meta[property="og:title"]', "content", title);
        setMeta('meta[property="og:description"]', "content", description);
        setMeta('meta[property="og:image"]', "content", page.seo.image || bundle.logo);
        setMeta('meta[property="og:type"]', "content", "website");
        setMeta('meta[name="theme-color"]', "content", resolveTheme(page.theme).colors.background);

        return () => {
            document.title = previousTitle;
        };
    }, [state]);

    if (state.status === "loading") {
        return (
            <div className="psite-state" role="status" aria-live="polite">
                <span className="psite-state__spinner" aria-hidden="true" />
            </div>
        );
    }

    if (state.status !== "ready") {
        return (
            <main className="psite-state">
                <img src={markfyLogo} alt="Markfy" className="psite-state__logo" />
                <h1>{state.status === "error" ? "Não foi possível abrir esta página" : "Esta página não está no ar"}</h1>
                <p>
                    {state.status === "error"
                        ? "Verifique sua conexão e tente de novo."
                        : "O endereço pode ter mudado ou a empresa tirou a página do ar por enquanto."}
                </p>
                {state.bundle ? (
                    <a href={`/central-user/${handle}`} className="psite-state__btn">Ver {state.bundle.name} na Markfy Bookings</a>
                ) : (
                    <a href="/central-user" className="psite-state__btn">Encontrar empresas na Markfy</a>
                )}
            </main>
        );
    }

    return <SiteRenderer page={state.page} bundle={state.bundle} mode="public" />;
};

export default PublicSite;
