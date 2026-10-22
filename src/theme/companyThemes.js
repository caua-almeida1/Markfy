/* =========================================================
   TEMAS DE EMPRESA

   A empresa escolhe uma paleta em Identidade Visual, e ela
   pinta a página pública — a que o cliente abre pelo handle
   da rota (/central-user/:handle).

   COMO CONVIVE COM O TEMA CLARO/ESCURO DO VISITANTE
   -------------------------------------------------

   O tema de empresa NÃO substitui o claro/escuro pessoal:
   ele troca a família de acento e um leve tom de fundo, e
   cada paleta tem versão clara e escura. Assim uma empresa
   com paleta rosa não cega quem navega no escuro à noite.

   A exceção é "Noturno", que é escuro por definição —
   é uma escolha de marca, então força o escuro na página
   pública daquela empresa (`forceDark`).

   ONDE FICA
   ---------

   companys/{handle}/theme  ->  "markfy" | "grafite" | ...

   Um campo de texto curto no nó que as telas públicas já
   leem. Nada de nó novo, nada de leitura extra.

   COMO É APLICADO
   ---------------

   Atributo `data-company-theme` no <html> (ver
   useCompanyTheme). Precisa ser no <html>, e não num
   wrapper: ProductDetails, CompanyInfoModal e o aviso de
   cookies renderizam em portal no <body>, fora da árvore
   da página — um wrapper não os alcançaria.
========================================================= */

export const DEFAULT_COMPANY_THEME = "markfy";


/*
 * Cada tema define só o que muda: a família do acento e um
 * tom de fundo. O resto continua vindo dos tokens globais,
 * então tudo que já respeita o tema continua respeitando.
 */
export const COMPANY_THEMES = [

    {
        id: "markfy",
        name: "Markfy",
        description: "O azul original da plataforma.",
        swatch: ["#092af3", "#e9edff", "#f8f9fb"],
        light: {
            primary: "#092af3",
            primaryHover: "#0b33ff",
            primaryLight: "#e9edff",
            primaryLighter: "#f5f7ff",
            background: "#f8f9fb",
            surfaceSoft: "#f4f5f7",
            link: "#4a6bdf"
        },
        dark: {
            primary: "#4160ff",
            primaryHover: "#5570ff",
            primaryLight: "#1e2547",
            primaryLighter: "#171a2e",
            background: "#111214",
            surfaceSoft: "#222329",
            link: "#8fa3ff"
        }
    },

    {
        id: "grafite",
        name: "Grafite",
        description: "Cinza sóbrio, sem cor dominante.",
        swatch: ["#3f4149", "#e7e8ea", "#f7f7f8"],
        light: {
            primary: "#3f4149",
            primaryHover: "#2f3138",
            primaryLight: "#e7e8ea",
            primaryLighter: "#f4f4f6",
            background: "#f7f7f8",
            surfaceSoft: "#f1f1f3",
            link: "#52555f"
        },
        dark: {
            primary: "#b9bcc6",
            primaryHover: "#cfd2da",
            primaryLight: "#2b2d34",
            primaryLighter: "#202127",
            background: "#121316",
            surfaceSoft: "#212328",
            link: "#c9ccd4"
        }
    },

    {
        id: "oceano",
        name: "Oceano",
        description: "Azul-petróleo calmo, com ar de cuidado.",
        swatch: ["#0e7490", "#dbf1f6", "#f4fafb"],
        light: {
            primary: "#0e7490",
            primaryHover: "#0b5e75",
            primaryLight: "#dbf1f6",
            primaryLighter: "#f0f9fb",
            background: "#f4fafb",
            surfaceSoft: "#eaf5f8",
            link: "#0e7490"
        },
        dark: {
            primary: "#3fb6cf",
            primaryHover: "#5ac6dc",
            primaryLight: "#123038",
            primaryLighter: "#0e2429",
            background: "#0f1416",
            surfaceSoft: "#1a2326",
            link: "#6fcfe3"
        }
    },

    {
        id: "rose",
        name: "Rosé",
        description: "Rosa suave, delicado sem ser infantil.",
        swatch: ["#be5a78", "#fbe6ec", "#fdf7f9"],
        light: {
            primary: "#be5a78",
            primaryHover: "#a84765",
            primaryLight: "#fbe6ec",
            primaryLighter: "#fdf4f7",
            background: "#fdf7f9",
            surfaceSoft: "#faeef2",
            link: "#b04f6d"
        },
        dark: {
            primary: "#e894ac",
            primaryHover: "#f0a8bd",
            primaryLight: "#3a2029",
            primaryLighter: "#2b1820",
            background: "#161114",
            surfaceSoft: "#241a1e",
            link: "#f0a8bd"
        }
    },

    {
        id: "areia",
        name: "Areia",
        description: "Tom terroso e quente, discreto.",
        swatch: ["#a07d4f", "#f3e9d8", "#fbf8f2"],
        light: {
            primary: "#a07d4f",
            primaryHover: "#8a6a40",
            primaryLight: "#f3e9d8",
            primaryLighter: "#faf5ec",
            background: "#fbf8f2",
            surfaceSoft: "#f5efe3",
            link: "#8a6a40"
        },
        dark: {
            primary: "#d4b483",
            primaryHover: "#e2c699",
            primaryLight: "#352c1d",
            primaryLighter: "#272016",
            background: "#151310",
            surfaceSoft: "#231f18",
            link: "#e2c699"
        }
    },

    {
        id: "noturno",
        name: "Noturno",
        description:
            "Escuro sempre, para quem quer a página assim de dia e de noite.",
        swatch: ["#8b7bff", "#211d3a", "#101017"],
        forceDark: true,
        light: {
            primary: "#8b7bff",
            primaryHover: "#9d8fff",
            primaryLight: "#211d3a",
            primaryLighter: "#191628",
            background: "#101017",
            surfaceSoft: "#1e1d2b",
            link: "#a99dff"
        },
        dark: {
            primary: "#8b7bff",
            primaryHover: "#9d8fff",
            primaryLight: "#211d3a",
            primaryLighter: "#191628",
            background: "#101017",
            surfaceSoft: "#1e1d2b",
            link: "#a99dff"
        }
    },

    {
        id: "floresta",
        name: "Floresta",
        description: "Verde profundo, natural e confiável.",
        swatch: ["#2f7d4f", "#dcefe3", "#f5faf7"],
        light: {
            primary: "#2f7d4f",
            primaryHover: "#276941",
            primaryLight: "#dcefe3",
            primaryLighter: "#f0f8f3",
            background: "#f5faf7",
            surfaceSoft: "#e9f4ee",
            link: "#2a7048"
        },
        dark: {
            primary: "#6fcf97",
            primaryHover: "#8fdcb0",
            primaryLight: "#16301f",
            primaryLighter: "#102319",
            background: "#0f1512",
            surfaceSoft: "#1b251f",
            link: "#9fe3bb"
        }
    },

    {
        id: "lavanda",
        name: "Lavanda",
        description: "Lilás leve, calmo e elegante.",
        swatch: ["#7c5cc4", "#ece5fa", "#f9f7fd"],
        light: {
            primary: "#7c5cc4",
            primaryHover: "#6a49b0",
            primaryLight: "#ece5fa",
            primaryLighter: "#f6f2fd",
            background: "#f9f7fd",
            surfaceSoft: "#f1ecfa",
            link: "#6a49b0"
        },
        dark: {
            primary: "#b49cf0",
            primaryHover: "#c6b4f5",
            primaryLight: "#2a2142",
            primaryLighter: "#201933",
            background: "#131018",
            surfaceSoft: "#211c2b",
            link: "#c6b4f5"
        }
    },

    {
        id: "por-do-sol",
        name: "Pôr do sol",
        description: "Laranja quente, cheio de energia.",
        swatch: ["#e0662a", "#fde8dc", "#fffaf6"],
        light: {
            primary: "#e0662a",
            primaryHover: "#c7561e",
            primaryLight: "#fde8dc",
            primaryLighter: "#fef4ee",
            background: "#fffaf6",
            surfaceSoft: "#fdf0e8",
            link: "#c7561e"
        },
        dark: {
            primary: "#ff9a62",
            primaryHover: "#ffb48a",
            primaryLight: "#40240f",
            primaryLighter: "#2f1a0b",
            background: "#171009",
            surfaceSoft: "#271c14",
            link: "#ffb48a"
        }
    },

    {
        id: "vinho",
        name: "Vinho",
        description: "Bordô intenso, sofisticado.",
        swatch: ["#8e2f4a", "#f6dfe6", "#fcf6f8"],
        light: {
            primary: "#8e2f4a",
            primaryHover: "#762640",
            primaryLight: "#f6dfe6",
            primaryLighter: "#fbf0f3",
            background: "#fcf6f8",
            surfaceSoft: "#f7e9ee",
            link: "#8e2f4a"
        },
        dark: {
            primary: "#e07a98",
            primaryHover: "#eb9bb2",
            primaryLight: "#3b1824",
            primaryLighter: "#2c111b",
            background: "#160d10",
            surfaceSoft: "#251a1e",
            link: "#eb9bb2"
        }
    },

    {
        id: "menta",
        name: "Menta",
        description: "Verde-água fresco e leve.",
        swatch: ["#1f9d8a", "#d9f4ee", "#f3fbf9"],
        light: {
            primary: "#1f9d8a",
            primaryHover: "#17836f",
            primaryLight: "#d9f4ee",
            primaryLighter: "#eefaf7",
            background: "#f3fbf9",
            surfaceSoft: "#e6f6f2",
            link: "#17836f"
        },
        dark: {
            primary: "#4fd1bb",
            primaryHover: "#7de0cf",
            primaryLight: "#10332d",
            primaryLighter: "#0c2622",
            background: "#0e1514",
            surfaceSoft: "#192422",
            link: "#7de0cf"
        }
    },

    {
        id: "indigo",
        name: "Índigo",
        description: "Azul-arroxeado moderno e marcante.",
        swatch: ["#4338ca", "#e4e2fb", "#f7f7fd"],
        light: {
            primary: "#4338ca",
            primaryHover: "#372fa8",
            primaryLight: "#e4e2fb",
            primaryLighter: "#f2f1fd",
            background: "#f7f7fd",
            surfaceSoft: "#ecebfa",
            link: "#372fa8"
        },
        dark: {
            primary: "#8b84f5",
            primaryHover: "#a9a4f8",
            primaryLight: "#1f1c4a",
            primaryLighter: "#171538",
            background: "#101018",
            surfaceSoft: "#1d1d2b",
            link: "#a9a4f8"
        }
    }

];


export const getCompanyTheme = (id) =>
    COMPANY_THEMES.find((theme) => theme.id === id) ||
    COMPANY_THEMES[0];


export const isValidCompanyTheme = (id) =>
    COMPANY_THEMES.some((theme) => theme.id === id);
