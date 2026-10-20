import { FONTS } from "../engine/design.js";

/* Carrega do Google Fonts só as famílias que o cardápio usa.
   Fica no cardápio público e na prévia; o painel continua em
   Poppins (o tema da Markfy não muda com o tema do cliente). */

const loaded = new Set();

export const ensureFonts = (families) => {
    if (typeof document === "undefined") return;

    const wanted = [...new Set(families)].filter((family) => FONTS[family] && !loaded.has(family));
    if (!wanted.length) return;

    wanted.forEach((family) => loaded.add(family));

    const query = wanted
        .map((family) => `family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@${FONTS[family].weights}`)
        .join("&");

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
    link.dataset.menusFonts = wanted.join(",");
    document.head.appendChild(link);
};

/** Todas as fontes de uma vez (para a galeria de fontes do editor). */
export const ensureAllFonts = () => ensureFonts(Object.keys(FONTS));

export const fontStack = (family) => FONTS[family]?.stack || FONTS.Poppins.stack;
