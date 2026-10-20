/* =========================================================
   MONITOR DE RETIRADA — MODELOS

   Cada modelo é só dado: fontes, cores (variáveis CSS) e qual
   arte desenhar (display/art.jsx). O layout é o mesmo em
   todos, então trocar de modelo nunca esconde informação.

   `accentVar` diz qual cor recebe a cor do cardápio quando a
   empresa liga "Usar a cor do meu cardápio".
========================================================= */

export const DISPLAY_TEMPLATES = [
    {
        id: "markfy",
        name: "Markfy",
        mood: "Moderno",
        description: "Escuro, com o laranja da Markfy e um sino que brilha a cada pedido pronto.",
        fonts: { heading: "Poppins", body: "Poppins" },
        accentVar: "--d-accent",
        vars: {
            "--d-bg": "#101118",
            "--d-bg-2": "#1b1d29",
            "--d-ink": "#f6f6fa",
            "--d-muted": "#9a9db3",
            "--d-panel": "rgba(255,255,255,0.05)",
            "--d-panel-line": "rgba(255,255,255,0.09)",
            "--d-ready-panel": "rgba(242,97,15,0.10)",
            "--d-chip": "rgba(255,255,255,0.07)",
            "--d-chip-ink": "#f6f6fa",
            "--d-ready-chip": "#f2610f",
            "--d-ready-chip-ink": "#ffffff",
            "--d-accent": "#f2610f",
            "--d-accent-ink": "#ffffff",
            "--d-radius": "28px"
        }
    },
    {
        id: "festa",
        name: "Doce festa",
        mood: "Divertido",
        description: "Vermelho vibrante, painéis arredondados e um sorvetinho mascote. Para sorveteria, açaí e doceria.",
        fonts: { heading: "Baloo 2", body: "Baloo 2" },
        accentVar: "--d-accent",
        vars: {
            "--d-bg": "#e8202a",
            "--d-bg-2": "#ff4d4f",
            "--d-ink": "#ffffff",
            "--d-muted": "rgba(255,255,255,0.82)",
            "--d-panel": "#fff7f2",
            "--d-panel-line": "transparent",
            "--d-panel-ink": "#3a1416",
            "--d-ready-panel": "#ffffff",
            "--d-chip": "#ffe6dc",
            "--d-chip-ink": "#3a1416",
            "--d-ready-chip": "#ffd23f",
            "--d-ready-chip-ink": "#3a1416",
            "--d-accent": "#e8202a",
            "--d-accent-ink": "#ffffff",
            "--d-radius": "44px"
        }
    },
    {
        id: "fast",
        name: "Lanchonete",
        mood: "Fast food",
        description: "Creme, faixas fortes em vinho e laranja e números enormes. Leitura de longe, do jeito das grandes redes.",
        fonts: { heading: "Archivo", body: "Archivo" },
        accentVar: "--d-ready-head",
        vars: {
            "--d-bg": "#fff4e4",
            "--d-bg-2": "#ffe9cc",
            "--d-ink": "#4a1a0c",
            "--d-muted": "#8a5a3c",
            "--d-panel": "#ffffff",
            "--d-panel-line": "#f1dcc0",
            "--d-panel-ink": "#4a1a0c",
            "--d-ready-panel": "#ffffff",
            "--d-chip": "transparent",
            "--d-chip-ink": "#c8102e",
            "--d-ready-chip": "transparent",
            "--d-ready-chip-ink": "#2f8f3a",
            "--d-prep-head": "#7b1e12",
            "--d-ready-head": "#f58220",
            "--d-accent": "#f58220",
            "--d-accent-ink": "#ffffff",
            "--d-radius": "26px"
        }
    },
    {
        id: "bistro",
        name: "Bistrô",
        mood: "Elegante",
        description: "Preto profundo, dourado e serifas finas. Discreto, para restaurantes e casas mais sofisticadas.",
        fonts: { heading: "Cormorant Garamond", body: "Manrope" },
        accentVar: "--d-accent",
        vars: {
            "--d-bg": "#0b0a09",
            "--d-bg-2": "#17140f",
            "--d-ink": "#f4ecdc",
            "--d-muted": "#a8997d",
            "--d-panel": "rgba(201,164,92,0.04)",
            "--d-panel-line": "rgba(201,164,92,0.35)",
            "--d-ready-panel": "rgba(201,164,92,0.08)",
            "--d-chip": "transparent",
            "--d-chip-ink": "#f4ecdc",
            "--d-ready-chip": "transparent",
            "--d-ready-chip-ink": "#e2c27f",
            "--d-accent": "#c9a45c",
            "--d-accent-ink": "#0b0a09",
            "--d-radius": "4px"
        }
    },
    {
        id: "brasa",
        name: "Brasa",
        mood: "Rústico",
        description: "Madeira escura, letreiro em neon e brasa acesa. Para hamburgueria, churrascaria e steakhouse.",
        fonts: { heading: "Bebas Neue", body: "Oswald" },
        accentVar: "--d-neon",
        vars: {
            "--d-bg": "#1c120c",
            "--d-bg-2": "#2b1b11",
            "--d-ink": "#fbe9d4",
            "--d-muted": "#c49a76",
            "--d-panel": "rgba(0,0,0,0.32)",
            "--d-panel-line": "rgba(255,170,90,0.20)",
            "--d-ready-panel": "rgba(0,0,0,0.42)",
            "--d-chip": "rgba(255,255,255,0.05)",
            "--d-chip-ink": "#fbe9d4",
            "--d-ready-chip": "#ffb547",
            "--d-ready-chip-ink": "#24140a",
            "--d-neon": "#ff3b2f",
            "--d-accent": "#ffb547",
            "--d-accent-ink": "#24140a",
            "--d-radius": "14px"
        }
    },
    {
        id: "cafe",
        name: "Cafeteria",
        mood: "Aconchegante",
        description: "Papel kraft, letra manuscrita e uma xícara fumegante. Para cafés, padarias e confeitarias.",
        fonts: { heading: "Caveat", body: "DM Sans" },
        accentVar: "--d-accent",
        vars: {
            "--d-bg": "#f2e8d8",
            "--d-bg-2": "#e9dbc3",
            "--d-ink": "#3b2a1e",
            "--d-muted": "#7d6450",
            "--d-panel": "#fbf6ee",
            "--d-panel-line": "#dccbb0",
            "--d-panel-ink": "#3b2a1e",
            "--d-ready-panel": "#fffdf8",
            "--d-chip": "#f1e6d4",
            "--d-chip-ink": "#3b2a1e",
            "--d-ready-chip": "#6b8f5a",
            "--d-ready-chip-ink": "#ffffff",
            "--d-accent": "#8a5a36",
            "--d-accent-ink": "#ffffff",
            "--d-radius": "22px"
        }
    },
    {
        id: "classico",
        name: "Clássico",
        mood: "Sério",
        description: "Branco, preto e verde, sem enfeites. Máximo contraste e leitura a vários metros.",
        fonts: { heading: "Space Grotesk", body: "Space Grotesk" },
        accentVar: "--d-ready-chip",
        vars: {
            "--d-bg": "#ffffff",
            "--d-bg-2": "#ffffff",
            "--d-ink": "#0d0d0f",
            "--d-muted": "#5f6170",
            "--d-panel": "#f4f5f7",
            "--d-panel-line": "#e3e5ea",
            "--d-panel-ink": "#0d0d0f",
            "--d-ready-panel": "#effaf2",
            "--d-chip": "#ffffff",
            "--d-chip-ink": "#0d0d0f",
            "--d-ready-chip": "#12893c",
            "--d-ready-chip-ink": "#ffffff",
            "--d-accent": "#12893c",
            "--d-accent-ink": "#ffffff",
            "--d-radius": "12px"
        }
    }
];

export const getDisplayTemplate = (id) => DISPLAY_TEMPLATES.find((template) => template.id === id) || DISPLAY_TEMPLATES[0];

const INK_FOR = { "--d-accent": "--d-accent-ink", "--d-ready-chip": "--d-ready-chip-ink" };

const luminance = (hex) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    return 0.299 * r + 0.587 * g + 0.114 * b;
};

/** Variáveis do modelo, com a cor do cardápio no lugar certo. */
export const templateStyle = (template, brandColor) => {
    const vars = { ...template.vars, "--d-font-h": `'${template.fonts.heading}'`, "--d-font-b": `'${template.fonts.body}'` };
    if (brandColor && /^#[0-9a-f]{6}$/i.test(brandColor)) {
        vars[template.accentVar] = brandColor;
        /* Texto sobre a cor do cliente: claro ou escuro conforme
           o brilho dela, para nunca sumir (amarelo + branco). */
        const ink = INK_FOR[template.accentVar];
        if (ink) vars[ink] = luminance(brandColor) > 0.55 ? "#1a1208" : "#ffffff";
    }
    return vars;
};
