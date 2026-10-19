/* =========================================================
   MARKFY STUDIO — MODELO DA PÁGINA

   Uma página é JSON puro, salvo como está no RTDB:

     {
       v, template,
       theme:    { palette, colors{...}, font, radius },
       seo:      { title, description, image },
       settings: { whatsappFloat, showHeader },
       sections: [{ id, type, variant, hidden, props }]
     }

   Aqui ficam: as seções disponíveis (com os campos que o
   editor mostra), as paletas, as tipografias, os canais de
   venda/entrega e os ajudantes. Nenhum texto padrão afirma
   fatos sobre a empresa que a Markfy não sabe — depoimentos,
   números, produtos avulsos e imóveis começam vazios.
========================================================= */

export const PAGE_VERSION = 1;

/* ---------- TIPOGRAFIA DAS PÁGINAS ----------
   A interface da Markfy usa uma família só (Poppins). As
   páginas criadas são dos clientes e precisam de voz
   própria, por isso aqui há combinações. */

export const SITE_FONTS = {
    moderna: {
        label: "Moderna",
        sample: "Poppins",
        heading: '"Poppins", system-ui, sans-serif',
        body: '"Poppins", system-ui, sans-serif',
        google: ["Poppins:wght@400;500;600;700;800"],
        headingWeight: 700,
        headingCase: "none"
    },
    marcante: {
        label: "Marcante",
        sample: "Bebas Neue",
        heading: '"Bebas Neue", Impact, sans-serif',
        body: '"Manrope", system-ui, sans-serif',
        google: ["Bebas+Neue", "Manrope:wght@400;500;600;700"],
        headingWeight: 400,
        headingCase: "uppercase",
        headingTracking: "0.01em",
        headingScale: 1.18
    },
    classica: {
        label: "Clássica",
        sample: "Playfair Display",
        heading: '"Playfair Display", Georgia, serif',
        body: '"Manrope", system-ui, sans-serif',
        google: ["Playfair+Display:wght@500;600;700", "Manrope:wght@400;500;600;700"],
        headingWeight: 600,
        headingCase: "none"
    },
    delicada: {
        label: "Delicada",
        sample: "Cormorant Garamond",
        heading: '"Cormorant Garamond", Georgia, serif',
        body: '"Jost", system-ui, sans-serif',
        google: ["Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500", "Jost:wght@400;500;600"],
        headingWeight: 600,
        headingCase: "none",
        headingTracking: "-0.01em",
        headingScale: 1.14
    },
    editorial: {
        label: "Editorial",
        sample: "Fraunces",
        heading: '"Fraunces", Georgia, serif',
        body: '"Manrope", system-ui, sans-serif',
        google: ["Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700", "Manrope:wght@400;500;600;700"],
        headingWeight: 600,
        headingCase: "none"
    },
    tecnica: {
        label: "Técnica",
        sample: "Space Grotesk",
        heading: '"Space Grotesk", system-ui, sans-serif',
        body: '"Space Grotesk", system-ui, sans-serif',
        google: ["Space+Grotesk:wght@400;500;600;700"],
        headingWeight: 600,
        headingCase: "none"
    },
    divertida: {
        label: "Divertida",
        sample: "Baloo 2",
        heading: '"Baloo 2", system-ui, sans-serif',
        body: '"Nunito", system-ui, sans-serif',
        google: ["Baloo+2:wght@600;700;800", "Nunito:wght@400;600;700"],
        headingWeight: 800,
        headingCase: "none",
        headingTracking: "-0.015em"
    },
    suave: {
        label: "Suave",
        sample: "Manrope",
        heading: '"Manrope", system-ui, sans-serif',
        body: '"Manrope", system-ui, sans-serif',
        google: ["Manrope:wght@400;500;600;700;800"],
        headingWeight: 700,
        headingCase: "none"
    }
};

/* ---------- PALETAS ---------- */

export const PALETTES = {
    noite: {
        label: "Noite",
        colors: { background: "#0f0e0d", surface: "#1b1917", text: "#f3eee7", muted: "#a49c91", accent: "#c9a36a", onAccent: "#15120e" }
    },
    rose: {
        label: "Rosé",
        colors: { background: "#fbf6f6", surface: "#ffffff", text: "#2a1f24", muted: "#85737b", accent: "#a8426a", onAccent: "#ffffff" }
    },
    petala: {
        label: "Pétala",
        colors: { background: "#fdf3f4", surface: "#fffafa", text: "#3a1d29", muted: "#8e6874", accent: "#c4577e", onAccent: "#ffffff" }
    },
    clinica: {
        label: "Clínica",
        colors: { background: "#f4f8f9", surface: "#ffffff", text: "#10282e", muted: "#577078", accent: "#0c7581", onAccent: "#ffffff" }
    },
    tinta: {
        label: "Tinta",
        colors: { background: "#0c0c10", surface: "#17171d", text: "#ececf2", muted: "#8f8fa0", accent: "#8b7cff", onAccent: "#0c0c10" }
    },
    filme: {
        label: "Filme",
        colors: { background: "#121110", surface: "#1d1b19", text: "#f1ece4", muted: "#9d958a", accent: "#e3a93b", onAccent: "#121110" }
    },
    oliva: {
        label: "Oliva",
        colors: { background: "#f2f3ec", surface: "#fbfbf7", text: "#1f2419", muted: "#646b5a", accent: "#4a6a2c", onAccent: "#ffffff" }
    },
    hortela: {
        label: "Hortelã",
        colors: { background: "#eef7f2", surface: "#ffffff", text: "#173229", muted: "#5b7a6e", accent: "#f07b2a", onAccent: "#ffffff" }
    },
    concreto: {
        label: "Concreto",
        colors: { background: "#f6f6f4", surface: "#ffffff", text: "#18212b", muted: "#626d78", accent: "#1d5c86", onAccent: "#ffffff" }
    },
    framboesa: {
        label: "Framboesa",
        colors: { background: "#ffffff", surface: "#f5f4f7", text: "#151318", muted: "#6c6873", accent: "#e0315f", onAccent: "#ffffff" }
    },
    musgo: {
        label: "Musgo",
        colors: { background: "#eef0e8", surface: "#f8f9f4", text: "#22281f", muted: "#686f60", accent: "#2f6b4f", onAccent: "#ffffff" }
    },
    brasa: {
        label: "Brasa",
        colors: { background: "#17110e", surface: "#231a16", text: "#fbefe4", muted: "#b39d8d", accent: "#ff7a1a", onAccent: "#17110e" }
    },
    lousa: {
        label: "Lousa",
        colors: { background: "#f3f6fb", surface: "#ffffff", text: "#15233a", muted: "#5d6b82", accent: "#f2a900", onAccent: "#15233a" }
    },
    markfy: {
        label: "Markfy",
        colors: { background: "#f7f8fb", surface: "#ffffff", text: "#17181c", muted: "#5f626b", accent: "#092af3", onAccent: "#ffffff" }
    },
    grafite: {
        label: "Grafite",
        colors: { background: "#ffffff", surface: "#f3f3f4", text: "#111113", muted: "#6b6b72", accent: "#111113", onAccent: "#ffffff" }
    }
};

export const RADII = {
    reto: { label: "Reto", value: "3px" },
    suave: { label: "Suave", value: "14px" },
    redondo: { label: "Arredondado", value: "26px" }
};

/* ---------- CANAIS EXTERNOS ----------
   Apps de entrega, marketplaces e transporte. O link é o da
   própria empresa em cada plataforma (a Markfy não integra
   com essas plataformas: só leva o visitante até lá).
   `hosts` serve para avisar quando o link colado parece ser
   de outro lugar. */

export const CHANNELS = {
    ifood: { label: "iFood", group: "Entrega", icon: "simple-icons:ifood", color: "#ea1d2c", hosts: ["ifood.com.br"] },
    "99food": { label: "99Food", group: "Entrega", icon: "solar:bag-smile-bold", color: "#ffdd00", ink: "#1b1b1b", hosts: ["99app.com", "99food"] },
    rappi: { label: "Rappi", group: "Entrega", icon: "solar:bag-4-bold", color: "#ff441f", hosts: ["rappi.com"] },
    keeta: { label: "Keeta", group: "Entrega", icon: "solar:bag-heart-bold", color: "#ffd100", ink: "#1b1b1b", hosts: ["keeta"] },
    aiqfome: { label: "aiqfome", group: "Entrega", icon: "solar:bag-check-bold", color: "#7b1fa2", hosts: ["aiqfome.com"] },
    zedelivery: { label: "Zé Delivery", group: "Entrega", icon: "solar:bottle-bold", color: "#ffc700", ink: "#1b1b1b", hosts: ["ze.delivery"] },
    mercadolivre: { label: "Mercado Livre", group: "Lojas", icon: "solar:cart-large-2-bold", color: "#ffe600", ink: "#2d3277", hosts: ["mercadolivre.com", "mercadolibre.com"] },
    shopee: { label: "Shopee", group: "Lojas", icon: "simple-icons:shopee", color: "#ee4d2d", hosts: ["shopee.com"] },
    amazon: { label: "Amazon", group: "Lojas", icon: "simple-icons:amazon", color: "#131921", hosts: ["amazon.com"] },
    olx: { label: "OLX", group: "Lojas", icon: "simple-icons:olx", color: "#6e0ad6", hosts: ["olx.com"] },
    enjoei: { label: "Enjoei", group: "Lojas", icon: "solar:hanger-2-bold", color: "#f05a7e", hosts: ["enjoei.com"] },
    nuvemshop: { label: "Loja online", group: "Lojas", icon: "solar:shop-2-bold", color: "#1f2a44", hosts: [] },
    "99": { label: "99 (corrida)", group: "Transporte", icon: "solar:wheel-bold", color: "#ffdd00", ink: "#1b1b1b", hosts: ["99app.com"] },
    uber: { label: "Uber", group: "Transporte", icon: "simple-icons:uber", color: "#000000", hosts: ["uber.com"] },
    outro: { label: "Outro link", group: "Outros", icon: "solar:link-round-bold", color: "#5f626b", hosts: [] }
};

export const CHANNEL_OPTIONS = Object.entries(CHANNELS).map(([value, channel]) => ({
    value,
    label: `${channel.label} (${channel.group.toLowerCase()})`
}));

export const channelLooksWrong = (channelId, url) => {
    const channel = CHANNELS[channelId];
    if (!channel?.hosts?.length || !/^https?:\/\//i.test(url || "")) return false;
    return !channel.hosts.some((host) => url.toLowerCase().includes(host));
};

/* ---------- AÇÕES DE BOTÃO ---------- */

export const BUTTON_ACTIONS = [
    { value: "booking", label: "Agendar pela Markfy Bookings" },
    { value: "whatsapp", label: "Abrir conversa no WhatsApp" },
    { value: "channel", label: "Abrir app de entrega, loja ou transporte" },
    { value: "anchor", label: "Ir para uma seção da página" },
    { value: "url", label: "Abrir um link" }
];

/* ---------- SEÇÕES ---------- */

const textField = (key, label, extra = {}) => ({ key, label, type: "text", ...extra });
const areaField = (key, label, extra = {}) => ({ key, label, type: "textarea", ...extra });

/* Serviços reais da Bookings como ponto de partida para
   pacotes e catálogo: o dono só ajusta. */
const productsAsPackages = (company) =>
    (company?.products || []).slice(0, 3).map((product, index) => ({
        name: product.name,
        price: product.price,
        includes: [product.duration ? `${product.duration} min de atendimento` : "", product.description?.split("\n")[0]?.slice(0, 90)].filter(Boolean).join("\n"),
        highlight: index === 1
    }));

const productsAsCatalog = (company) =>
    (company?.products || []).slice(0, 8).map((product) => ({
        name: product.name,
        price: product.price,
        oldPrice: product.originalPrice || "",
        image: product.image || "",
        description: product.description?.slice(0, 140) || "",
        condition: "",
        link: "",
        sold: false
    }));

export const SECTION_TYPES = {
    hero: {
        label: "Banner principal",
        icon: "solar:star-shine-linear",
        description: "A primeira coisa que o visitante vê: nome, proposta e o botão principal.",
        group: "Apresentação",
        unique: true,
        variants: [
            { id: "cover", label: "Imagem de fundo" },
            { id: "split", label: "Texto e imagem" },
            { id: "center", label: "Centralizado" },
            { id: "arch", label: "Foto em arco" }
        ],
        defaults: (company) => ({
            title: company?.name || "Seu negócio",
            subtitle: firstLine(company?.description) || "Agende seu horário online em poucos toques.",
            image: company?.photos?.[0] || "",
            primary: { label: "Agendar horário", action: "booking", url: "" },
            secondary: { label: "Falar no WhatsApp", action: "whatsapp", url: "" },
            showLogo: true,
            align: "left"
        }),
        fields: [
            textField("title", "Título", { max: 80 }),
            areaField("subtitle", "Texto de apoio", { max: 220 }),
            { key: "image", label: "Imagem", type: "image" },
            { key: "primary", label: "Botão principal", type: "button" },
            { key: "secondary", label: "Botão secundário", type: "button", optional: true }
        ],
        advanced: [
            { key: "showLogo", label: "Mostrar logotipo", type: "toggle" },
            {
                key: "align",
                label: "Alinhamento do texto",
                type: "segmented",
                options: [
                    { value: "left", label: "Esquerda" },
                    { value: "center", label: "Centro" }
                ]
            }
        ]
    },

    about: {
        label: "Sobre",
        icon: "solar:user-speak-linear",
        description: "Quem vocês são, como trabalham e o que os diferencia.",
        group: "Apresentação",
        variants: [
            { id: "image", label: "Texto e imagem" },
            { id: "text", label: "Só texto" }
        ],
        defaults: (company) => ({
            title: `Conheça ${company?.name || "o nosso espaço"}`,
            text: company?.description || "",
            image: company?.photos?.[1] || company?.photos?.[0] || "",
            highlights: []
        }),
        fields: [
            textField("title", "Título", { max: 80 }),
            areaField("text", "Texto", { max: 1200, rows: 6 }),
            { key: "image", label: "Imagem", type: "image" }
        ],
        advanced: [
            {
                key: "highlights",
                label: "Destaques",
                type: "list",
                max: 4,
                itemLabel: "destaque",
                hint: "Números ou fatos reais do negócio, como “12 anos” de experiência.",
                fields: [textField("value", "Valor", { max: 16 }), textField("label", "Descrição", { max: 40 })],
                empty: { value: "", label: "" }
            }
        ]
    },

    steps: {
        label: "Como funciona",
        icon: "solar:list-check-linear",
        description: "O passo a passo do atendimento, da compra ou da visita.",
        group: "Apresentação",
        variants: [
            { id: "row", label: "Em linha" },
            { id: "timeline", label: "Linha do tempo" }
        ],
        defaults: () => ({
            title: "Como funciona",
            items: [
                { title: "Escolha o serviço", text: "Veja preços e duração de cada atendimento aqui na página." },
                { title: "Marque dia e horário", text: "Os horários livres aparecem na hora, direto na agenda." },
                { title: "Receba a confirmação", text: "Sua reserva fica salva em Reservas, na Markfy Bookings." }
            ]
        }),
        fields: [
            textField("title", "Título", { max: 60 }),
            {
                key: "items",
                label: "Etapas",
                type: "list",
                max: 6,
                itemLabel: "etapa",
                hint: "Revise o texto para que cada etapa descreva exatamente como você trabalha.",
                fields: [textField("title", "Etapa", { max: 50 }), areaField("text", "Explicação", { max: 160, rows: 2 })],
                empty: { title: "", text: "" }
            }
        ],
        advanced: []
    },

    services: {
        label: "Serviços e preços",
        icon: "solar:tag-price-linear",
        description: "Seus serviços com preço e duração, direto da Markfy Bookings.",
        group: "Serviços",
        variants: [
            { id: "menu", label: "Lista de preços" },
            { id: "cards", label: "Cartões com foto" }
        ],
        defaults: () => ({
            title: "Serviços",
            subtitle: "",
            source: "bookings",
            limit: 8,
            showPrices: true,
            showDuration: true,
            bookingButtons: true,
            items: []
        }),
        fields: [
            textField("title", "Título", { max: 60 }),
            areaField("subtitle", "Texto de apoio", { max: 200, optional: true }),
            {
                key: "source",
                label: "De onde vêm os serviços",
                type: "segmented",
                options: [
                    { value: "bookings", label: "Markfy Bookings" },
                    { value: "manual", label: "Escrever aqui" }
                ],
                hint: "Na Markfy Bookings, preço e duração ficam sempre iguais aos da sua agenda."
            },
            {
                key: "items",
                label: "Serviços",
                type: "list",
                max: 20,
                itemLabel: "serviço",
                showIf: (props) => props.source === "manual",
                fields: [
                    textField("name", "Nome", { max: 60 }),
                    textField("price", "Preço", { max: 20, placeholder: "R$ 50,00" }),
                    textField("duration", "Duração", { max: 20, placeholder: "45 min" }),
                    areaField("description", "Descrição", { max: 200, rows: 2 })
                ],
                empty: { name: "", price: "", duration: "", description: "" }
            }
        ],
        advanced: [
            { key: "showPrices", label: "Mostrar preços", type: "toggle" },
            { key: "showDuration", label: "Mostrar duração", type: "toggle" },
            { key: "bookingButtons", label: "Botão “Agendar” em cada serviço", type: "toggle", showIf: (props) => props.source === "bookings" },
            { key: "limit", label: "Quantidade máxima", type: "number", min: 1, max: 24 }
        ]
    },

    packages: {
        label: "Pacotes e planos",
        icon: "solar:box-linear",
        description: "Combos, pacotes de ensaio, planos mensais. Começa com seus serviços da Bookings.",
        group: "Serviços",
        variants: [
            { id: "cards", label: "Lado a lado" },
            { id: "stack", label: "Empilhados" }
        ],
        defaults: (company) => ({
            title: "Pacotes",
            subtitle: "",
            items: productsAsPackages(company),
            button: { label: "Quero este", action: "whatsapp", url: "" }
        }),
        fields: [
            textField("title", "Título", { max: 60 }),
            areaField("subtitle", "Texto de apoio", { max: 200, optional: true }),
            {
                key: "items",
                label: "Pacotes",
                type: "list",
                max: 6,
                itemLabel: "pacote",
                fields: [
                    textField("name", "Nome", { max: 50 }),
                    textField("price", "Preço", { max: 24, placeholder: "R$ 180,00" }),
                    areaField("includes", "O que inclui (um item por linha)", { max: 400, rows: 4 }),
                    { key: "highlight", label: "Destacar este pacote", type: "toggle" }
                ],
                empty: { name: "", price: "", includes: "", highlight: false }
            },
            { key: "button", label: "Botão de cada pacote", type: "button" }
        ],
        advanced: []
    },

    team: {
        label: "Profissionais",
        icon: "solar:users-group-rounded-linear",
        description: "A equipe que atende, com foto e função.",
        group: "Serviços",
        variants: [
            { id: "grid", label: "Grade" },
            { id: "row", label: "Lista" }
        ],
        defaults: () => ({
            title: "Quem vai te atender",
            subtitle: "",
            source: "bookings",
            items: []
        }),
        fields: [
            textField("title", "Título", { max: 60 }),
            areaField("subtitle", "Texto de apoio", { max: 200, optional: true }),
            {
                key: "source",
                label: "De onde vêm os profissionais",
                type: "segmented",
                options: [
                    { value: "bookings", label: "Equipe da empresa" },
                    { value: "manual", label: "Escrever aqui" }
                ]
            },
            {
                key: "items",
                label: "Profissionais",
                type: "list",
                max: 12,
                itemLabel: "profissional",
                showIf: (props) => props.source === "manual",
                fields: [
                    textField("name", "Nome", { max: 50 }),
                    textField("role", "Função", { max: 50 }),
                    { key: "photo", label: "Foto", type: "image" }
                ],
                empty: { name: "", role: "", photo: "" }
            }
        ],
        advanced: []
    },

    booking: {
        label: "Agendamento",
        icon: "solar:calendar-add-linear",
        description: "Serviços com botão de agendar e horário de funcionamento, ligados à Markfy Bookings.",
        group: "Serviços",
        unique: true,
        variants: [
            { id: "highlight", label: "Destaque" },
            { id: "list", label: "Lista" }
        ],
        defaults: () => ({
            title: "Agende seu horário",
            subtitle: "Escolha o serviço e veja os horários livres na hora.",
            limit: 4,
            showHours: true,
            buttonLabel: "Ver horários"
        }),
        fields: [
            textField("title", "Título", { max: 60 }),
            areaField("subtitle", "Texto de apoio", { max: 200, optional: true }),
            textField("buttonLabel", "Texto do botão", { max: 24 })
        ],
        advanced: [
            { key: "showHours", label: "Mostrar horário de funcionamento", type: "toggle" },
            { key: "limit", label: "Serviços em destaque", type: "number", min: 1, max: 12 }
        ]
    },

    catalog: {
        label: "Produtos à venda",
        icon: "solar:bag-4-linear",
        description: "Vitrine de produtos novos ou usados, com preço, estado e botão de compra.",
        group: "Vendas",
        variants: [
            { id: "grid", label: "Vitrine" },
            { id: "list", label: "Lista / cardápio" }
        ],
        defaults: (company) => ({
            title: "Produtos",
            subtitle: "",
            items: productsAsCatalog(company),
            buttonLabel: "Tenho interesse",
            showSold: true
        }),
        fields: [
            textField("title", "Título", { max: 60 }),
            areaField("subtitle", "Texto de apoio", { max: 200, optional: true }),
            {
                key: "items",
                label: "Produtos",
                type: "list",
                max: 40,
                itemLabel: "produto",
                hint: "Sem link próprio, o botão abre o WhatsApp já com o nome do produto.",
                fields: [
                    textField("name", "Nome", { max: 70 }),
                    textField("price", "Preço", { max: 24, placeholder: "R$ 89,90" }),
                    textField("oldPrice", "Preço antigo (opcional)", { max: 24 }),
                    {
                        key: "condition",
                        label: "Estado",
                        type: "select",
                        options: [
                            { value: "", label: "Não informar" },
                            { value: "novo", label: "Novo" },
                            { value: "seminovo", label: "Seminovo" },
                            { value: "usado", label: "Usado" }
                        ]
                    },
                    { key: "image", label: "Foto", type: "image" },
                    areaField("description", "Descrição", { max: 240, rows: 2 }),
                    { key: "link", label: "Link de compra (opcional)", type: "url" },
                    { key: "sold", label: "Já vendido", type: "toggle" }
                ],
                empty: { name: "", price: "", oldPrice: "", condition: "", image: "", description: "", link: "", sold: false }
            }
        ],
        advanced: [
            textField("buttonLabel", "Texto do botão", { max: 24 }),
            { key: "showSold", label: "Mostrar itens vendidos (com selo)", type: "toggle" }
        ]
    },

    properties: {
        label: "Imóveis",
        icon: "solar:buildings-2-linear",
        description: "Imóveis para venda ou aluguel, com quartos, área, vagas e botão para agendar visita.",
        group: "Vendas",
        variants: [
            { id: "cards", label: "Cartões" },
            { id: "wide", label: "Destaque largo" }
        ],
        defaults: () => ({
            title: "Imóveis disponíveis",
            subtitle: "",
            items: [],
            buttonLabel: "Agendar visita"
        }),
        fields: [
            textField("title", "Título", { max: 60 }),
            areaField("subtitle", "Texto de apoio", { max: 200, optional: true }),
            {
                key: "items",
                label: "Imóveis",
                type: "list",
                max: 30,
                itemLabel: "imóvel",
                fields: [
                    textField("title", "Título", { max: 70, placeholder: "Apartamento com varanda" }),
                    {
                        key: "purpose",
                        label: "Finalidade",
                        type: "select",
                        options: [
                            { value: "venda", label: "Venda" },
                            { value: "aluguel", label: "Aluguel" },
                            { value: "temporada", label: "Temporada" }
                        ]
                    },
                    textField("price", "Preço", { max: 30, placeholder: "R$ 450.000" }),
                    textField("place", "Bairro e cidade", { max: 60 }),
                    textField("bedrooms", "Quartos", { max: 3 }),
                    textField("bathrooms", "Banheiros", { max: 3 }),
                    textField("area", "Área (m²)", { max: 6 }),
                    textField("parking", "Vagas", { max: 3 }),
                    { key: "image", label: "Foto", type: "image" },
                    { key: "link", label: "Link do anúncio (opcional)", type: "url" }
                ],
                empty: { title: "", purpose: "venda", price: "", place: "", bedrooms: "", bathrooms: "", area: "", parking: "", image: "", link: "" }
            }
        ],
        advanced: [textField("buttonLabel", "Texto do botão", { max: 24 })]
    },

    channels: {
        label: "Peça também por",
        icon: "solar:delivery-linear",
        description: "Botões para iFood, 99Food, Rappi, Mercado Livre, Shopee, Uber e outros apps.",
        group: "Vendas",
        unique: true,
        variants: [
            { id: "buttons", label: "Botões" },
            { id: "banner", label: "Faixa" }
        ],
        defaults: () => ({
            title: "Peça também por",
            subtitle: "",
            items: []
        }),
        fields: [
            textField("title", "Título", { max: 60 }),
            areaField("subtitle", "Texto de apoio", { max: 200, optional: true }),
            {
                key: "items",
                label: "Canais",
                type: "list",
                max: 8,
                itemLabel: "canal",
                hint: "Cole o link da sua loja em cada plataforma. A Markfy só leva o visitante até lá.",
                fields: [
                    { key: "channel", label: "Plataforma", type: "select", options: CHANNEL_OPTIONS },
                    { key: "url", label: "Link da sua loja ou perfil", type: "url", channelKey: "channel" },
                    textField("label", "Texto do botão (opcional)", { max: 30 })
                ],
                empty: { channel: "ifood", url: "", label: "" }
            }
        ],
        advanced: []
    },

    gallery: {
        label: "Galeria",
        icon: "solar:gallery-wide-linear",
        description: "Fotos do espaço e do seu trabalho.",
        group: "Portfólio",
        variants: [
            { id: "grid", label: "Grade" },
            { id: "mosaic", label: "Mosaico" },
            { id: "carousel", label: "Carrossel" }
        ],
        defaults: (company) => ({
            title: "Nosso trabalho",
            subtitle: "",
            images: (company?.photos || []).slice(0, 8)
        }),
        fields: [
            textField("title", "Título", { max: 60 }),
            areaField("subtitle", "Texto de apoio", { max: 200, optional: true }),
            { key: "images", label: "Fotos", type: "images", max: 16 }
        ],
        advanced: []
    },

    testimonials: {
        label: "Depoimentos",
        icon: "solar:chat-round-like-linear",
        description: "O que clientes reais dizem. Só aparece na página quando houver depoimentos.",
        group: "Confiança",
        variants: [
            { id: "cards", label: "Cartões" },
            { id: "quote", label: "Citação em destaque" }
        ],
        defaults: () => ({
            title: "Quem já veio, recomenda",
            items: []
        }),
        fields: [
            textField("title", "Título", { max: 60 }),
            {
                key: "items",
                label: "Depoimentos",
                type: "list",
                max: 9,
                itemLabel: "depoimento",
                hint: "Use depoimentos verdadeiros, com autorização do cliente.",
                fields: [
                    areaField("text", "Depoimento", { max: 300, rows: 3 }),
                    textField("name", "Nome do cliente", { max: 50 }),
                    textField("detail", "Detalhe", { max: 50, placeholder: "Cliente desde 2022" })
                ],
                empty: { text: "", name: "", detail: "" }
            }
        ],
        advanced: []
    },

    faq: {
        label: "Perguntas frequentes",
        icon: "solar:question-circle-linear",
        description: "Respostas para as dúvidas que chegam toda semana.",
        group: "Confiança",
        variants: [{ id: "accordion", label: "Sanfona" }],
        defaults: () => ({
            title: "Perguntas frequentes",
            items: [
                {
                    q: "Como faço para agendar?",
                    a: "Toque em “Agendar”, escolha o serviço, o profissional e o horário. A reserva é feita pela Markfy Bookings e você acompanha tudo em Reservas."
                },
                {
                    q: "Preciso criar uma conta?",
                    a: "Não é obrigatório. Com uma conta Markfy, suas reservas ficam salvas em qualquer aparelho."
                }
            ]
        }),
        fields: [
            textField("title", "Título", { max: 60 }),
            {
                key: "items",
                label: "Perguntas",
                type: "list",
                max: 12,
                itemLabel: "pergunta",
                fields: [textField("q", "Pergunta", { max: 120 }), areaField("a", "Resposta", { max: 600, rows: 3 })],
                empty: { q: "", a: "" }
            }
        ],
        advanced: []
    },

    contact: {
        label: "Contato e localização",
        icon: "solar:map-point-linear",
        description: "Endereço, mapa, rotas, telefone, e-mail e horários.",
        group: "Contato",
        variants: [
            { id: "map", label: "Com mapa" },
            { id: "simple", label: "Simples" }
        ],
        defaults: () => ({
            title: "Onde estamos",
            showAddress: true,
            showDirections: true,
            showPhone: true,
            showEmail: true,
            showHours: true,
            showSocial: true
        }),
        fields: [textField("title", "Título", { max: 60 })],
        advanced: [
            { key: "showAddress", label: "Endereço", type: "toggle" },
            { key: "showDirections", label: "Botões de rota (Google Maps, Waze, Uber)", type: "toggle" },
            { key: "showPhone", label: "Telefone e WhatsApp", type: "toggle" },
            { key: "showEmail", label: "E-mail", type: "toggle" },
            { key: "showHours", label: "Horário de funcionamento", type: "toggle" },
            { key: "showSocial", label: "Redes sociais", type: "toggle" }
        ],
        note: "Os dados vêm de Minha empresa. Ao atualizar lá, a página acompanha."
    },

    form: {
        label: "Formulário de contato",
        icon: "solar:letter-linear",
        description: "Receba pedidos e dúvidas. Cada envio aparece em Contatos.",
        group: "Contato",
        unique: true,
        variants: [
            { id: "side", label: "Texto ao lado" },
            { id: "stacked", label: "Empilhado" }
        ],
        defaults: () => ({
            title: "Fale com a gente",
            subtitle: "Mande sua dúvida ou pedido de orçamento. Respondemos pelo contato que você deixar.",
            askPhone: true,
            askEmail: true,
            submitLabel: "Enviar mensagem",
            successMessage: "Mensagem enviada. Em breve entraremos em contato."
        }),
        fields: [
            textField("title", "Título", { max: 60 }),
            areaField("subtitle", "Texto de apoio", { max: 220 }),
            textField("submitLabel", "Texto do botão", { max: 30 })
        ],
        advanced: [
            { key: "askPhone", label: "Pedir telefone", type: "toggle" },
            { key: "askEmail", label: "Pedir e-mail", type: "toggle" },
            areaField("successMessage", "Mensagem após o envio", { max: 160, rows: 2 })
        ]
    },

    cta: {
        label: "Chamada para ação",
        icon: "solar:chat-round-call-linear",
        description: "Um bloco de destaque com um botão, como “Chame no WhatsApp”.",
        group: "Contato",
        variants: [
            { id: "band", label: "Faixa" },
            { id: "card", label: "Cartão" }
        ],
        defaults: () => ({
            title: "Ficou com alguma dúvida?",
            text: "Chame no WhatsApp e responda em poucos minutos.",
            button: { label: "Chamar no WhatsApp", action: "whatsapp", url: "" }
        }),
        fields: [
            textField("title", "Título", { max: 70 }),
            areaField("text", "Texto", { max: 200 }),
            { key: "button", label: "Botão", type: "button" }
        ],
        advanced: []
    },

    social: {
        label: "Redes sociais",
        icon: "solar:link-round-linear",
        description: "Links para Instagram, TikTok e outras redes cadastradas.",
        group: "Contato",
        unique: true,
        variants: [{ id: "row", label: "Linha" }],
        defaults: () => ({
            title: "Acompanhe nas redes",
            links: []
        }),
        fields: [
            textField("title", "Título", { max: 60 }),
            {
                key: "links",
                label: "Links extras",
                type: "list",
                max: 6,
                itemLabel: "link",
                hint: "As redes cadastradas em Minha empresa já aparecem sozinhas.",
                fields: [textField("label", "Nome", { max: 30 }), { key: "url", label: "Endereço", type: "url" }],
                empty: { label: "", url: "" }
            }
        ],
        advanced: []
    }
};

export const SECTION_GROUPS = ["Apresentação", "Serviços", "Vendas", "Portfólio", "Confiança", "Contato"];

/* ---------- AJUDANTES ---------- */

const firstLine = (text) =>
    String(text || "")
        .split("\n")
        .map((line) => line.trim())
        .find(Boolean)
        ?.slice(0, 200) || "";

let counter = 0;

export const newId = () => {
    counter += 1;
    return `s${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
};

export const createSection = (type, company, overrides = {}) => {
    const def = SECTION_TYPES[type];

    return {
        id: newId(),
        type,
        variant: overrides.variant || def.variants[0].id,
        hidden: false,
        props: { ...def.defaults(company), ...(overrides.props || {}) }
    };
};

export const resolveTheme = (theme = {}) => {
    const palette = PALETTES[theme.palette] || PALETTES.markfy;
    const colors = { ...palette.colors, ...(theme.colors || {}) };
    const font = SITE_FONTS[theme.font] || SITE_FONTS.moderna;
    const radius = (RADII[theme.radius] || RADII.suave).value;

    return { colors, font, radius };
};

/* Garante a forma da página vinda do banco (onde arrays
   vazios somem e campos novos ainda não existem). */
export const normalizePage = (page) => {
    if (!page || typeof page !== "object") return null;

    const sections = (Array.isArray(page.sections) ? page.sections : Object.values(page.sections || {}))
        .filter((section) => section && SECTION_TYPES[section.type])
        .map((section) => {
            const def = SECTION_TYPES[section.type];
            const defaults = def.defaults(null);
            const props = { ...defaults, ...(section.props || {}) };

            /* Lista ausente no banco = lista esvaziada pelo
               usuário (o RTDB apaga arrays vazios). Não pode
               voltar com o conteúdo padrão. */
            Object.keys(defaults).forEach((key) => {
                if (!Array.isArray(defaults[key])) return;

                const stored = section.props?.[key];

                props[key] = Array.isArray(stored)
                    ? stored.filter((item) => item !== null && item !== undefined)
                    : stored && typeof stored === "object"
                        ? Object.values(stored)
                        : [];
            });

            return {
                id: section.id || newId(),
                type: section.type,
                variant: def.variants.some((variant) => variant.id === section.variant)
                    ? section.variant
                    : def.variants[0].id,
                hidden: !!section.hidden,
                props
            };
        });

    return {
        v: PAGE_VERSION,
        template: page.template || "servicos",
        theme: {
            palette: page.theme?.palette || "markfy",
            colors: page.theme?.colors || {},
            font: page.theme?.font || "moderna",
            radius: page.theme?.radius || "suave"
        },
        seo: {
            title: page.seo?.title || "",
            description: page.seo?.description || "",
            image: page.seo?.image || ""
        },
        settings: {
            whatsappFloat: page.settings?.whatsappFloat !== false,
            showHeader: page.settings?.showHeader !== false
        },
        sections
    };
};
