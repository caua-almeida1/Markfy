/* =========================================================
   GERA public/sitemap.xml (roda antes do build: "prebuild")

   Entram só URLs públicas, canônicas e indexáveis:
     - páginas fixas (início, produtos, central, legais, demo);
     - página de cada empresa ELEGÍVEL (publicAccess.bookings
       ativo): /central-user/{handle};
     - site do Studio publicado: /s/{handle}.

   Lê apenas nós de leitura pública (companiesIndex,
   publicAccess, studioSites/{handle}) pela API REST, sem
   credencial. Se a rede falhar, grava só as páginas fixas —
   o build nunca quebra por causa do sitemap.

   Fora do sitemap, de propósito: login, painel, checkout,
   convites, resultados de busca e qualquer rota com sessão.
========================================================= */

const fs = require("fs");
const path = require("path");

const SITE_URL = (process.env.REACT_APP_SITE_URL || "https://markfy.vercel.app").replace(/\/+$/, "");
const DATABASE_URL = (process.env.MARKFY_DATABASE_URL || "https://markfy-96942-default-rtdb.firebaseio.com").replace(/\/+$/, "");
const TARGET = path.join(__dirname, "..", "public", "sitemap.xml");

const STATIC_PATHS = ["/", "/home", "/central-user", "/menus/demo", "/privacidade", "/termos"];

const HANDLE = /^[a-z0-9._-]{1,60}$/i;

const getJson = async (route) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
        const response = await fetch(`${DATABASE_URL}/${route}.json`, { signal: controller.signal });
        return response.ok ? response.json() : null;
    } finally {
        clearTimeout(timer);
    }
};

const isOpen = (entry, now) =>
    Boolean(entry && entry.bookings === true && (!entry.expiresAt || Number(entry.expiresAt) > now));

const escapeXml = (value) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const companyPaths = async () => {

    const now = Date.now();

    const [index, access] = await Promise.all([getJson("companiesIndex"), getJson("publicAccess")]);

    /* Elegível = publicAccess aberto (o índice pode estar atrasado). */
    const handles = [...new Set([...Object.keys(access || {}), ...Object.keys(index || {})])]
        .filter((handle) => HANDLE.test(handle) && isOpen((access || {})[handle], now))
        .sort();

    const studio = await Promise.all(
        handles
            .filter((handle) => access[handle].studio === true)
            .map(async (handle) => ((await getJson(`studioSites/${handle}/publishedAt`).catch(() => null)) !== null ? handle : null))
    );

    return [
        ...handles.map((handle) => `/central-user/${handle}`),
        ...studio.filter(Boolean).map((handle) => `/s/${handle}`)
    ];
};

(async () => {

    let dynamic = [];

    try {
        dynamic = await companyPaths();
    } catch (error) {
        console.warn(`sitemap: empresas não incluídas (${error.message}); seguindo só com as páginas fixas.`);
    }

    const urls = [...STATIC_PATHS, ...dynamic]
        .map((route) => `  <url><loc>${escapeXml(SITE_URL + route)}</loc></url>`)
        .join("\n");

    fs.writeFileSync(
        TARGET,
        `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
    );

    console.log(`sitemap: ${STATIC_PATHS.length + dynamic.length} URLs em public/sitemap.xml`);

})().catch((error) => {
    console.warn("sitemap: não gerado:", error.message);
});
