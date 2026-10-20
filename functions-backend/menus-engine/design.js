/* =========================================================
   APARÊNCIA DO CARDÁPIO — ESQUEMA E MODELOS

   Um modelo não é só uma paleta: cada um combina um TOPO,
   uma NAVEGAÇÃO entre categorias e uma APRESENTAÇÃO dos
   produtos diferentes, além de tipografia, cores, raios e
   densidade. A pessoa escolhe um modelo e depois ajusta peça
   por peça.

   Este arquivo é dado puro e também roda no backend: a
   publicação normaliza o rascunho com normalizeDesign(), que
   garante valores válidos e aplica o plano (modelos e
   ajustes avançados só entram se o plano incluir).
========================================================= */

import { clampInt, text } from "./util.js";

export const HEADERS = {
    hero: "Capa grande",
    split: "Capa ao lado",
    banner: "Faixa com cartão",
    centered: "Centralizado",
    compact: "Barra compacta",
    board: "Quadro"
};

export const NAVS = {
    chips: "Botões roláveis",
    tabs: "Abas fixas",
    sidebar: "Lista lateral",
    tiles: "Blocos com ícone",
    sections: "Seções em sequência"
};

export const PRODUCT_LAYOUTS = {
    list: "Lista com foto",
    cards: "Cartões",
    photo: "Foto em destaque",
    menu: "Cardápio clássico",
    compact: "Compacto",
    carousel: "Trilhos horizontais",
    buffet: "Por quilo / bufê"
};

export const IMAGE_RATIOS = { "1/1": "Quadrada", "4/3": "4:3", "3/2": "3:2", "16/9": "Panorâmica", "3/4": "Retrato" };

export const DENSITIES = { compact: "Compacta", cozy: "Confortável", airy: "Arejada" };

export const SHADOWS = { none: "Sem sombra", soft: "Suave", lift: "Elevada" };

export const MOTIONS = { none: "Sem animação", subtle: "Sutil", lively: "Viva" };

/* Famílias do Google Fonts (carregadas só no cardápio público). */
export const FONTS = {
    Poppins: { label: "Poppins", stack: "'Poppins', system-ui, sans-serif", weights: "400;500;600;700;800" },
    "DM Sans": { label: "DM Sans", stack: "'DM Sans', system-ui, sans-serif", weights: "400;500;700;800" },
    Manrope: { label: "Manrope", stack: "'Manrope', system-ui, sans-serif", weights: "400;500;600;700;800" },
    Nunito: { label: "Nunito", stack: "'Nunito', system-ui, sans-serif", weights: "400;600;700;800;900" },
    Rubik: { label: "Rubik", stack: "'Rubik', system-ui, sans-serif", weights: "400;500;600;700;800" },
    "Space Grotesk": { label: "Space Grotesk", stack: "'Space Grotesk', system-ui, sans-serif", weights: "400;500;600;700" },
    Archivo: { label: "Archivo", stack: "'Archivo', system-ui, sans-serif", weights: "400;500;600;700;800;900" },
    Oswald: { label: "Oswald", stack: "'Oswald', 'Arial Narrow', sans-serif", weights: "400;500;600;700" },
    "Bebas Neue": { label: "Bebas Neue", stack: "'Bebas Neue', 'Arial Narrow', sans-serif", weights: "400" },
    "Josefin Sans": { label: "Josefin Sans", stack: "'Josefin Sans', system-ui, sans-serif", weights: "400;600;700" },
    "Baloo 2": { label: "Baloo 2", stack: "'Baloo 2', system-ui, sans-serif", weights: "400;500;600;700;800" },
    "Playfair Display": { label: "Playfair Display", stack: "'Playfair Display', Georgia, serif", weights: "400;500;600;700;800" },
    "Cormorant Garamond": { label: "Cormorant Garamond", stack: "'Cormorant Garamond', Georgia, serif", weights: "400;500;600;700" },
    Lora: { label: "Lora", stack: "'Lora', Georgia, serif", weights: "400;500;600;700" },
    "Libre Baskerville": { label: "Libre Baskerville", stack: "'Libre Baskerville', Georgia, serif", weights: "400;700" },
    "DM Serif Display": { label: "DM Serif Display", stack: "'DM Serif Display', Georgia, serif", weights: "400" },
    Fraunces: { label: "Fraunces", stack: "'Fraunces', Georgia, serif", weights: "400;500;600;700;800" },
    Caveat: { label: "Caveat (manuscrita)", stack: "'Caveat', cursive", weights: "400;600;700" },
    Pacifico: { label: "Pacifico (letreiro)", stack: "'Pacifico', cursive", weights: "400" }
};

const COLOR = /^#[0-9a-f]{6}$/i;

/* ---------- MODELOS ---------- */

const T = (id, name, group, tier, description, layout, theme, content = {}) => ({ id, name, group, tier, description, layout, theme, content });

export const TEMPLATES = [
    T("moderno", "Moderno e minimalista", "Estilo", "basic",
        "Fundo claro, muito respiro e uma lista limpa com foto à direita.",
        { header: "compact", nav: "chips", products: "list", columns: 1, imageRatio: "1/1", search: "top" },
        { colors: { primary: "#111111", secondary: "#f2f2f2", accent: "#d9480f", background: "#ffffff", surface: "#ffffff", text: "#141414", muted: "#6b6b6b", border: "#ececec", buttonText: "#ffffff" },
            fonts: { heading: "DM Sans", body: "DM Sans" }, headingWeight: 700, bodySize: 15, lineHeight: 1.5, headingCase: "none", radius: 14, shadow: "none", density: "cozy", contentWidth: 960, motion: "subtle" }),

    T("tradicional", "Tradicional", "Estilo", "basic",
        "Cardápio clássico de papel: nomes à esquerda, preço à direita, pontilhado no meio.",
        { header: "centered", nav: "sections", products: "menu", columns: 1, imageRatio: "4/3", search: "hidden" },
        { colors: { primary: "#7a1f2b", secondary: "#efe4cf", accent: "#7a1f2b", background: "#fbf6ec", surface: "#fffaf0", text: "#2b1d14", muted: "#7a6a58", border: "#e3d5bb", buttonText: "#ffffff" },
            fonts: { heading: "Libre Baskerville", body: "Lora" }, headingWeight: 700, bodySize: 16, lineHeight: 1.55, headingCase: "upper", radius: 4, shadow: "none", density: "cozy", contentWidth: 820, motion: "subtle" }),

    T("elegante", "Elegante e sofisticado", "Estilo", "advanced",
        "Fundo escuro, serifas finas e dourado. Sem fotos, foco no texto.",
        { header: "centered", nav: "tabs", products: "menu", columns: 1, imageRatio: "4/3", search: "hidden" },
        { colors: { primary: "#c8a96a", secondary: "#1b1a17", accent: "#c8a96a", background: "#0f0e0c", surface: "#171613", text: "#f1eadb", muted: "#a59c8a", border: "#2c2a25", buttonText: "#0f0e0c" },
            fonts: { heading: "Cormorant Garamond", body: "Manrope" }, headingWeight: 600, bodySize: 15, lineHeight: 1.6, headingCase: "upper", radius: 2, shadow: "none", density: "airy", contentWidth: 820, motion: "subtle" },
        { showImages: false }),

    T("artesanal", "Artesanal", "Estilo", "advanced",
        "Tons de papel kraft, serifa calorosa e cartões com foto.",
        { header: "banner", nav: "chips", products: "cards", columns: 2, imageRatio: "4/3", search: "top" },
        { colors: { primary: "#b5532c", secondary: "#efe2cc", accent: "#556b2f", background: "#f4ead8", surface: "#fbf4e7", text: "#3a2a1c", muted: "#7c6750", border: "#e2d2b6", buttonText: "#ffffff" },
            fonts: { heading: "Fraunces", body: "Nunito" }, headingWeight: 700, bodySize: 15, lineHeight: 1.55, headingCase: "none", radius: 18, shadow: "soft", density: "cozy", contentWidth: 1080, motion: "subtle" }),

    T("industrial", "Industrial", "Estilo", "advanced",
        "Cantos retos, cinza concreto e um amarelo de sinalização. Navegação lateral.",
        { header: "split", nav: "sidebar", products: "compact", columns: 1, imageRatio: "1/1", search: "nav" },
        { colors: { primary: "#f5c400", secondary: "#2a2b2e", accent: "#f5c400", background: "#e9e9e6", surface: "#f6f6f4", text: "#18191b", muted: "#5d5f63", border: "#cfd0cc", buttonText: "#18191b" },
            fonts: { heading: "Archivo", body: "Space Grotesk" }, headingWeight: 800, bodySize: 15, lineHeight: 1.45, headingCase: "upper", radius: 0, shadow: "none", density: "compact", contentWidth: 1200, motion: "none" }),

    T("gourmet", "Gourmet", "Estilo", "advanced",
        "Fotos grandes em proporção 3:2, verde profundo e serifa de revista.",
        { header: "hero", nav: "tabs", products: "photo", columns: 2, imageRatio: "3/2", search: "nav" },
        { colors: { primary: "#1f4d3a", secondary: "#ece6d8", accent: "#b88a3b", background: "#f7f3ea", surface: "#ffffff", text: "#1b2420", muted: "#66706b", border: "#e3ddd0", buttonText: "#ffffff" },
            fonts: { heading: "DM Serif Display", body: "Manrope" }, headingWeight: 400, bodySize: 15, lineHeight: 1.6, headingCase: "none", radius: 10, shadow: "soft", density: "airy", contentWidth: 1160, motion: "subtle" }),

    T("familiar", "Familiar", "Estilo", "basic",
        "Acolhedor e direto: faixa com a logo e lista com fotos grandes.",
        { header: "banner", nav: "chips", products: "list", columns: 1, imageRatio: "1/1", search: "top" },
        { colors: { primary: "#e8590c", secondary: "#fff1e6", accent: "#2b8a3e", background: "#fffaf5", surface: "#ffffff", text: "#2d2018", muted: "#7a6a60", border: "#f1e2d6", buttonText: "#ffffff" },
            fonts: { heading: "Nunito", body: "Nunito" }, headingWeight: 800, bodySize: 16, lineHeight: 1.5, headingCase: "none", radius: 20, shadow: "soft", density: "cozy", contentWidth: 960, motion: "subtle" }),

    T("colorido", "Colorido e descontraído", "Estilo", "advanced",
        "Cores vivas, blocos de categoria com ícone e cartões quadrados.",
        { header: "hero", nav: "tiles", products: "cards", columns: 2, imageRatio: "1/1", search: "top" },
        { colors: { primary: "#d6336c", secondary: "#fff0f6", accent: "#0ca678", background: "#fff9db", surface: "#ffffff", text: "#2b1b33", muted: "#6e5f75", border: "#f3d9e5", buttonText: "#ffffff" },
            fonts: { heading: "Baloo 2", body: "Nunito" }, headingWeight: 800, bodySize: 16, lineHeight: 1.45, headingCase: "none", radius: 24, shadow: "lift", density: "cozy", contentWidth: 1080, motion: "lively" }),

    T("cafeteria", "Cafeteria", "Segmento", "advanced",
        "Marrom café e creme, cartões em três colunas para bebidas e doces.",
        { header: "split", nav: "chips", products: "cards", columns: 3, imageRatio: "1/1", search: "top" },
        { colors: { primary: "#6f4e37", secondary: "#f3ebe3", accent: "#c08552", background: "#faf6f1", surface: "#ffffff", text: "#2e2119", muted: "#7d6b5e", border: "#eadfd4", buttonText: "#ffffff" },
            fonts: { heading: "Josefin Sans", body: "Lora" }, headingWeight: 700, bodySize: 15, lineHeight: 1.55, headingCase: "upper", radius: 16, shadow: "soft", density: "cozy", contentWidth: 1120, motion: "subtle" }),

    T("pizzaria", "Pizzaria", "Segmento", "basic",
        "Capa com a pizza, abas fixas e destaque para tamanhos e sabores.",
        { header: "hero", nav: "tabs", products: "list", columns: 1, imageRatio: "1/1", search: "nav" },
        { colors: { primary: "#c92a2a", secondary: "#fff5f5", accent: "#2f9e44", background: "#fffdf8", surface: "#ffffff", text: "#24160f", muted: "#78665b", border: "#f0e4da", buttonText: "#ffffff" },
            fonts: { heading: "Oswald", body: "Rubik" }, headingWeight: 600, bodySize: 15, lineHeight: 1.5, headingCase: "upper", radius: 12, shadow: "soft", density: "cozy", contentWidth: 980, motion: "subtle" }),

    T("hamburgueria", "Hamburgueria", "Segmento", "advanced",
        "Escuro, letras condensadas e fotos panorâmicas que ocupam a largura.",
        { header: "hero", nav: "chips", products: "photo", columns: 1, imageRatio: "16/9", search: "top" },
        { colors: { primary: "#ff7a00", secondary: "#1d1d1f", accent: "#ffd43b", background: "#0d0d0e", surface: "#18181a", text: "#f5f5f5", muted: "#a3a3a8", border: "#2a2a2d", buttonText: "#111111" },
            fonts: { heading: "Bebas Neue", body: "Rubik" }, headingWeight: 400, bodySize: 15, lineHeight: 1.5, headingCase: "upper", radius: 14, shadow: "none", density: "cozy", contentWidth: 960, motion: "lively" }),

    T("quilo", "Restaurante por quilo", "Segmento", "advanced",
        "Preço por quilo em destaque, bufê do dia e itens à parte.",
        { header: "compact", nav: "sections", products: "buffet", columns: 2, imageRatio: "4/3", search: "hidden" },
        { colors: { primary: "#2b8a3e", secondary: "#ebfbee", accent: "#e67700", background: "#f8fbf6", surface: "#ffffff", text: "#1a2a1e", muted: "#5f6f63", border: "#dfeadf", buttonText: "#ffffff" },
            fonts: { heading: "DM Sans", body: "DM Sans" }, headingWeight: 800, bodySize: 16, lineHeight: 1.5, headingCase: "none", radius: 14, shadow: "soft", density: "cozy", contentWidth: 1040, motion: "subtle" }),

    T("bar", "Bar e bebidas", "Segmento", "advanced",
        "Azul noturno, ciano neon e lista compacta para cartas longas de drinks.",
        { header: "centered", nav: "tabs", products: "compact", columns: 1, imageRatio: "1/1", search: "nav" },
        { colors: { primary: "#22d3ee", secondary: "#111a2e", accent: "#f472b6", background: "#0a1020", surface: "#111a2e", text: "#e6edf7", muted: "#93a0b8", border: "#1f2a44", buttonText: "#0a1020" },
            fonts: { heading: "Oswald", body: "Manrope" }, headingWeight: 600, bodySize: 15, lineHeight: 1.5, headingCase: "upper", radius: 10, shadow: "none", density: "compact", contentWidth: 900, motion: "subtle" }),

    T("doceria", "Doceria e confeitaria", "Segmento", "advanced",
        "Tons pastel, letreiro manuscrito e fotos em retrato para bolos e doces.",
        { header: "banner", nav: "tiles", products: "cards", columns: 2, imageRatio: "3/4", search: "top" },
        { colors: { primary: "#d6457a", secondary: "#fdeef4", accent: "#8c6bd6", background: "#fff7fa", surface: "#ffffff", text: "#3d2330", muted: "#8a6b79", border: "#f6dbe6", buttonText: "#ffffff" },
            fonts: { heading: "Pacifico", body: "Nunito" }, headingWeight: 400, bodySize: 15, lineHeight: 1.55, headingCase: "none", radius: 22, shadow: "soft", density: "airy", contentWidth: 1040, motion: "lively" }),

    T("foodtruck", "Food truck", "Segmento", "advanced",
        "Quadro de giz no topo, amarelo e preto e trilhos horizontais por categoria.",
        { header: "board", nav: "chips", products: "carousel", columns: 1, imageRatio: "4/3", search: "hidden" },
        { colors: { primary: "#ffd400", secondary: "#1a1a1a", accent: "#ff3d00", background: "#fffbea", surface: "#ffffff", text: "#141414", muted: "#5c5c5c", border: "#efe6b8", buttonText: "#141414" },
            fonts: { heading: "Bebas Neue", body: "Space Grotesk" }, headingWeight: 400, bodySize: 15, lineHeight: 1.45, headingCase: "upper", radius: 16, shadow: "lift", density: "cozy", contentWidth: 1000, motion: "lively" }),

    T("marmitaria", "Marmitaria", "Segmento", "basic",
        "Cardápio do dia em abas, tamanhos de marmita e lista grande e legível.",
        { header: "compact", nav: "tabs", products: "list", columns: 1, imageRatio: "4/3", search: "hidden" },
        { colors: { primary: "#2f9e44", secondary: "#f1f8e9", accent: "#f08c00", background: "#fbfdf7", surface: "#ffffff", text: "#1d2a19", muted: "#62705d", border: "#e1ecd8", buttonText: "#ffffff" },
            fonts: { heading: "Rubik", body: "Rubik" }, headingWeight: 700, bodySize: 17, lineHeight: 1.5, headingCase: "none", radius: 14, shadow: "soft", density: "cozy", contentWidth: 900, motion: "subtle" })
];

export const TEMPLATE_IDS = TEMPLATES.map((template) => template.id);

export const getTemplate = (id) => TEMPLATES.find((template) => template.id === id) || TEMPLATES[0];

export const DEFAULT_CONTENT = {
    tagline: "",
    heroTitle: "",
    heroSubtitle: "",
    notice: "",
    footerNote: "",
    addLabel: "Adicionar",
    cartLabel: "Ver pedido",
    checkoutLabel: "Finalizar pedido",
    showSearch: true,
    showHours: true,
    showAddress: true,
    showSocials: true,
    showWhatsApp: true,
    showPrepTime: true,
    showAllergens: true,
    showFeatured: true,
    showDescriptions: true,
    showImages: true,
    showShare: true
};

const CONTENT_TEXT_LIMITS = {
    tagline: 120,
    heroTitle: 80,
    heroSubtitle: 200,
    notice: 200,
    footerNote: 400,
    addLabel: 20,
    cartLabel: 24,
    checkoutLabel: 28
};

const pick = (value, allowed, fallback) => (Object.prototype.hasOwnProperty.call(allowed, value) ? value : fallback);

const color = (value, fallback) => (COLOR.test(String(value || "")) ? String(value).toLowerCase() : fallback);

const url = (value) => {
    const textValue = String(value || "").trim();
    if (!textValue) return "";
    if (/^https:\/\//i.test(textValue) && textValue.length < 1500) return textValue;
    if (/^blob:|^data:image\//i.test(textValue)) return textValue;
    return "";
};

/**
 * Rascunho → aparência completa e válida.
 * advanced: false → só modelos básicos; cores (exceto a
 * principal), fontes e disposição voltam ao padrão do modelo.
 */
export const normalizeDesign = (raw, { advanced = true } = {}) => {
    const source = raw && typeof raw === "object" ? raw : {};

    let template = getTemplate(source.templateId);
    if (!advanced && template.tier !== "basic") template = TEMPLATES.find((item) => item.tier === "basic");

    const base = template.theme;
    const theme = advanced ? source.theme || {} : { colors: { primary: source.theme?.colors?.primary } };
    const layoutSource = advanced ? source.layout || {} : {};

    const colors = {};
    Object.keys(base.colors).forEach((key) => {
        colors[key] = color(theme.colors?.[key], base.colors[key]);
    });

    const fonts = {
        heading: Object.prototype.hasOwnProperty.call(FONTS, theme.fonts?.heading) ? theme.fonts.heading : base.fonts.heading,
        body: Object.prototype.hasOwnProperty.call(FONTS, theme.fonts?.body) ? theme.fonts.body : base.fonts.body
    };

    const layout = {
        header: pick(layoutSource.header, HEADERS, template.layout.header),
        nav: pick(layoutSource.nav, NAVS, template.layout.nav),
        products: pick(layoutSource.products, PRODUCT_LAYOUTS, template.layout.products),
        columns: clampInt(layoutSource.columns, 1, 4, template.layout.columns),
        imageRatio: pick(layoutSource.imageRatio, IMAGE_RATIOS, template.layout.imageRatio),
        search: ["top", "nav", "hidden"].includes(layoutSource.search) ? layoutSource.search : template.layout.search
    };

    const content = { ...DEFAULT_CONTENT, ...template.content };
    const sourceContent = source.content || {};
    Object.keys(DEFAULT_CONTENT).forEach((key) => {
        if (!(key in sourceContent)) return;
        if (typeof DEFAULT_CONTENT[key] === "boolean") content[key] = sourceContent[key] === true;
        else content[key] = text(sourceContent[key], CONTENT_TEXT_LIMITS[key] || 200) || (DEFAULT_CONTENT[key] || "");
    });

    return {
        templateId: template.id,
        layout,
        theme: {
            colors,
            fonts,
            headingWeight: clampInt(theme.headingWeight, 300, 900, base.headingWeight),
            bodySize: clampInt(theme.bodySize, 13, 19, base.bodySize),
            lineHeight: Math.min(1.9, Math.max(1.2, Number(theme.lineHeight) || base.lineHeight)),
            headingCase: theme.headingCase === "upper" || theme.headingCase === "none" ? theme.headingCase : base.headingCase,
            radius: clampInt(theme.radius, 0, 32, base.radius),
            shadow: pick(theme.shadow, SHADOWS, base.shadow),
            density: pick(theme.density, DENSITIES, base.density),
            contentWidth: clampInt(theme.contentWidth, 640, 1400, base.contentWidth),
            motion: pick(theme.motion, MOTIONS, base.motion)
        },
        content,
        images: {
            logo: url(source.images?.logo),
            cover: url(source.images?.cover),
            favicon: url(source.images?.favicon)
        }
    };
};

/** Aparência inicial a partir de um modelo. */
export const designFromTemplate = (templateId, keep = {}) => {
    const template = getTemplate(templateId);
    return normalizeDesign({ templateId: template.id, theme: template.theme, layout: template.layout, content: keep.content, images: keep.images });
};

/** O rascunho usa algo que o plano não inclui? */
export const designNeedsAdvanced = (raw) => {
    if (!raw) return false;
    const template = getTemplate(raw.templateId);
    if (template.tier !== "basic") return true;
    const full = normalizeDesign(raw, { advanced: true });
    const basic = normalizeDesign(raw, { advanced: false });
    return JSON.stringify(full.theme) !== JSON.stringify(basic.theme) || JSON.stringify(full.layout) !== JSON.stringify(basic.layout);
};

/* ---------- ENDEREÇO PÚBLICO ---------- */

export const RESERVED_SLUGS = ["demo", "admin", "api", "app", "login", "menus", "markfy", "painel", "pedido", "pedidos", "studio", "bookings", "planos", "suporte", "ajuda", "teste"];

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38})[a-z0-9]$/;

export const slugify = (value) =>
    String(value || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 40)
        .replace(/-+$/g, "");

/* O handle da própria empresa é dela (handles já são únicos),
   mesmo que seja uma palavra reservada como "markfy". */
export const slugProblem = (slug, ownHandle = null) => {
    if (!SLUG_PATTERN.test(slug || "")) return "Use de 3 a 40 letras minúsculas, números ou hífens.";
    const own = ownHandle && String(ownHandle).toLowerCase() === slug;
    if (!own && RESERVED_SLUGS.includes(slug)) return "Este endereço é reservado. Escolha outro.";
    if (slug.includes("--")) return "Evite hífens seguidos.";
    return null;
};

/** Sugestão de endereço que o próprio app aceita: nome da
    empresa, senão o handle, senão "nome-cardapio". */
export const suggestSlug = (name, handle) => {
    const candidates = [slugify(name), slugify(handle), `${slugify(name || handle)}-cardapio`.replace(/^-/, "")];
    return candidates.find((value) => value && !slugProblem(value, handle)) || candidates[candidates.length - 1];
};
