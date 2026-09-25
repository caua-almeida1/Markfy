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
    }

];


export const getCompanyTheme = (id) =>
    COMPANY_THEMES.find((theme) => theme.id === id) ||
    COMPANY_THEMES[0];


export const isValidCompanyTheme = (id) =>
    COMPANY_THEMES.some((theme) => theme.id === id);
