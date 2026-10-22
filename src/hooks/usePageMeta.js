import { useEffect } from "react";

import {
    DEFAULT_DESCRIPTION,
    DEFAULT_TITLE,
    OG_IMAGE,
    SITE_NAME,
    SITE_URL
} from "../config/site";

/* =========================================================
   METADADOS POR PÁGINA (SPA)

   O index.html traz os metadados da página inicial (o que
   robôs sem JavaScript e prévias de link enxergam). Ao trocar
   de rota, este hook ajusta título, descrição, canonical,
   robots e Open Graph — o Google executa JavaScript e lê os
   valores atualizados.

   Páginas privadas (login, painel, checkout) passam
   `noindex: true`: elas não devem aparecer na busca, e o
   robots.txt sozinho não impede indexação.

   Ao sair da página, volta aos valores padrão, para uma rota
   sem o hook não herdar o título da anterior.
========================================================= */

const setMeta = (selector, attribute, key, value) => {

    let element = document.head.querySelector(selector);

    if (!value) {
        if (element) element.remove();
        return;
    }

    if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
    }

    element.setAttribute("content", value);
};

const setCanonical = (href) => {

    let link = document.head.querySelector('link[rel="canonical"]');

    if (!href) {
        if (link) link.remove();
        return;
    }

    if (!link) {
        link = document.createElement("link");
        link.setAttribute("rel", "canonical");
        document.head.appendChild(link);
    }

    link.setAttribute("href", href);
};

const apply = ({ title, description, path, noindex, image }) => {

    const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
    const text = description || DEFAULT_DESCRIPTION;
    const url = path === undefined ? null : `${SITE_URL}${path}`;

    document.title = fullTitle;

    setMeta('meta[name="description"]', "name", "description", text);
    setMeta('meta[name="robots"]', "name", "robots", noindex ? "noindex, nofollow" : null);

    setMeta('meta[property="og:title"]', "property", "og:title", fullTitle);
    setMeta('meta[property="og:description"]', "property", "og:description", text);
    setMeta('meta[property="og:url"]', "property", "og:url", url || SITE_URL);
    setMeta('meta[property="og:image"]', "property", "og:image", image || OG_IMAGE);
    setMeta('meta[name="twitter:title"]', "name", "twitter:title", fullTitle);
    setMeta('meta[name="twitter:description"]', "name", "twitter:description", text);

    setCanonical(noindex ? null : url);
};

/**
 * @param {{ title?: string, description?: string, path?: string,
 *           noindex?: boolean, image?: string }} meta
 *   path: caminho canônico ("/termos"). Sem path, sem canonical.
 */
export const usePageMeta = ({ title, description, path, noindex = false, image } = {}) => {

    useEffect(() => {

        apply({ title, description, path, noindex, image });

        return () => apply({});

    }, [title, description, path, noindex, image]);
};

export default usePageMeta;
