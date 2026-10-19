import { createSection, PAGE_VERSION } from "./schema";

/* =========================================================
   MODELOS

   Cada modelo é uma composição de verdade diferente — ordem
   das seções, variações, paleta, tipografia e raio — e não
   a mesma página com outra cor. Todos começam com os dados
   reais da empresa (nome, descrição, fotos, serviços).

   `featured` = aparece de cara na galeria. Os demais ficam
   atrás de "Mostrar mais modelos" (o indicado para a
   empresa sempre aparece de cara).
========================================================= */

const S = createSection;

export const TEMPLATES = [
    {
        id: "navalha",
        name: "Navalha",
        audience: "Barbearias",
        description: "Escuro e direto, com foto em tela cheia e tabela de preços como um cardápio.",
        theme: { palette: "noite", font: "marcante", radius: "reto" },
        categories: ["barbearia", "cabeleireiro"],
        featured: true,
        build: (company) => [
            S("hero", company, { variant: "cover" }),
            S("services", company, { variant: "menu", props: { title: "Tabela de serviços" } }),
            S("team", company, { variant: "grid", props: { title: "Na cadeira" } }),
            S("gallery", company, { variant: "grid", props: { title: "Cortes recentes" } }),
            S("booking", company, { variant: "highlight", props: { title: "Garanta seu horário" } }),
            S("testimonials", company, { variant: "quote" }),
            S("contact", company, { variant: "map" }),
            S("cta", company, { variant: "band" })
        ]
    },
    {
        id: "cilios",
        name: "Cílios",
        audience: "Lash designers, sobrancelhas e maquiagem",
        description: "Delicado e feminino: rosa pétala, títulos em serif fina, antes e depois em mosaico e o passo a passo do atendimento.",
        theme: { palette: "petala", font: "delicada", radius: "redondo" },
        categories: ["cilios", "sobrancelhas", "maquiagem", "manicure-pedicure"],
        featured: true,
        build: (company) => [
            S("hero", company, {
                variant: "arch",
                props: { primary: { label: "Agendar meu horário", action: "booking", url: "" } }
            }),
            S("gallery", company, { variant: "mosaic", props: { title: "Antes e depois" } }),
            S("services", company, { variant: "cards", props: { title: "Procedimentos" } }),
            S("steps", company, {
                variant: "timeline",
                props: {
                    title: "Seu atendimento",
                    items: [
                        { title: "Escolha o procedimento", text: "Fio a fio, volume, lash lifting: veja valores e duração antes de marcar." },
                        { title: "Reserve o horário", text: "Os horários livres aparecem na hora. Sem troca de mensagens." },
                        { title: "Chegue e relaxe", text: "Venha sem maquiagem nos olhos. O resto é com a gente." }
                    ]
                }
            }),
            S("testimonials", company, { variant: "cards", props: { title: "O que as clientes dizem" } }),
            S("faq", company),
            S("booking", company, { variant: "list", props: { title: "Marque sua manutenção" } }),
            S("contact", company, { variant: "simple" })
        ]
    },
    {
        id: "atelier",
        name: "Atelier",
        audience: "Salões e estética",
        description: "Claro e elegante, com serif nos títulos, galeria em mosaico e serviços com foto.",
        theme: { palette: "rose", font: "classica", radius: "redondo" },
        categories: ["salao-beleza", "estetica", "spa", "massoterapia"],
        featured: true,
        build: (company) => [
            S("hero", company, { variant: "split" }),
            S("about", company, { variant: "image" }),
            S("services", company, { variant: "cards", props: { title: "Cuidados que oferecemos" } }),
            S("gallery", company, { variant: "mosaic", props: { title: "Resultados" } }),
            S("testimonials", company, { variant: "cards" }),
            S("booking", company, { variant: "list" }),
            S("faq", company),
            S("contact", company, { variant: "simple" })
        ]
    },
    {
        id: "clinica",
        name: "Clínica",
        audience: "Clínicas e consultórios",
        description: "Sóbrio e confiável: apresentação centralizada, equipe em lista e dúvidas respondidas.",
        theme: { palette: "clinica", font: "suave", radius: "suave" },
        categories: ["odontologia", "medicina", "fisioterapia", "nutricao", "psicologia"],
        featured: true,
        build: (company) => [
            S("hero", company, {
                variant: "center",
                props: { primary: { label: "Agendar consulta", action: "booking", url: "" } }
            }),
            S("about", company, { variant: "text", props: { title: "Sobre o atendimento" } }),
            S("services", company, { variant: "menu", props: { title: "Especialidades e procedimentos" } }),
            S("team", company, { variant: "row", props: { title: "Profissionais" } }),
            S("faq", company),
            S("form", company, { variant: "side", props: { title: "Tire sua dúvida" } }),
            S("contact", company, { variant: "map", props: { title: "Como chegar" } })
        ]
    },
    {
        id: "vitrine",
        name: "Vitrine",
        audience: "Lojas e e-commerce",
        description: "Loja de verdade: vitrine de produtos com preço e promoção, links para Mercado Livre e Shopee e compra pelo WhatsApp.",
        theme: { palette: "framboesa", font: "tecnica", radius: "suave" },
        categories: [],
        featured: true,
        build: (company) => [
            S("hero", company, {
                variant: "center",
                props: {
                    primary: { label: "Ver produtos", action: "anchor", url: "catalog" },
                    secondary: { label: "Comprar pelo WhatsApp", action: "whatsapp", url: "" }
                }
            }),
            S("catalog", company, { variant: "grid", props: { title: "Novidades", buttonLabel: "Comprar" } }),
            S("channels", company, { variant: "banner", props: { title: "Também estamos nos marketplaces" } }),
            S("steps", company, {
                variant: "row",
                props: {
                    title: "Como comprar",
                    items: [
                        { title: "Escolha o produto", text: "Toque em Comprar no item que você quer." },
                        { title: "Combine o pagamento", text: "A conversa abre no WhatsApp já com o nome do produto." },
                        { title: "Receba ou retire", text: "Entrega ou retirada, do jeito que for melhor para você." }
                    ]
                }
            }),
            S("faq", company, { props: { items: [] } }),
            S("social", company),
            S("cta", company, { variant: "band", props: { title: "Procurando algo que não está aqui?" } })
        ]
    },
    {
        id: "estudio",
        name: "Estúdio",
        audience: "Tatuagem, pilates e portfólios",
        description: "Para quem vende com imagem: o portfólio vem logo depois do banner, em carrossel.",
        theme: { palette: "tinta", font: "tecnica", radius: "reto" },
        categories: ["tatuagem", "design", "pilates", "yoga", "academia"],
        featured: true,
        build: (company) => [
            S("hero", company, { variant: "cover", props: { align: "center" } }),
            S("gallery", company, { variant: "carousel", props: { title: "Portfólio" } }),
            S("about", company, { variant: "text" }),
            S("booking", company, { variant: "highlight", props: { title: "Reserve uma sessão" } }),
            S("social", company),
            S("form", company, { variant: "stacked", props: { title: "Peça um orçamento" } })
        ]
    },

    /* ---------- "MOSTRAR MAIS" ---------- */

    {
        id: "lente",
        name: "Lente",
        audience: "Fotógrafos e filmmakers",
        description: "Foto ocupa tudo: portfólio em carrossel grande, pacotes de ensaio lado a lado e pedido de orçamento.",
        theme: { palette: "filme", font: "editorial", radius: "reto" },
        categories: ["fotografia", "eventos"],
        build: (company) => [
            S("hero", company, {
                variant: "cover",
                props: { primary: { label: "Pedir orçamento", action: "anchor", url: "form" }, secondary: { label: "Ver portfólio", action: "anchor", url: "gallery" } }
            }),
            S("gallery", company, { variant: "carousel", props: { title: "Trabalhos selecionados" } }),
            S("packages", company, { variant: "cards", props: { title: "Pacotes de ensaio", button: { label: "Quero este pacote", action: "whatsapp", url: "" } } }),
            S("steps", company, {
                variant: "timeline",
                props: {
                    title: "Do primeiro contato às fotos prontas",
                    items: [
                        { title: "Conversa", text: "Você conta a ideia, o lugar e a data." },
                        { title: "Ensaio", text: "No dia, a gente cuida da direção e da luz." },
                        { title: "Entrega", text: "Fotos tratadas em galeria online, no prazo combinado." }
                    ]
                }
            }),
            S("about", company, { variant: "image", props: { title: "Por trás da câmera" } }),
            S("testimonials", company, { variant: "quote" }),
            S("form", company, { variant: "side", props: { title: "Vamos marcar seu ensaio?" } }),
            S("social", company)
        ]
    },
    {
        id: "patinhas",
        name: "Patinhas",
        audience: "Pet shops, banho e tosa e clínicas veterinárias",
        description: "Alegre e acolhedor: verde hortelã com laranja, letras arredondadas e passo a passo do banho.",
        theme: { palette: "hortela", font: "divertida", radius: "redondo" },
        categories: ["pet-shop", "banho-tosa"],
        build: (company) => [
            S("hero", company, {
                variant: "split",
                props: { primary: { label: "Agendar banho ou consulta", action: "booking", url: "" } }
            }),
            S("services", company, { variant: "cards", props: { title: "Cuidados para o seu pet" } }),
            S("packages", company, { variant: "cards", props: { title: "Pacotes mensais" } }),
            S("steps", company, {
                variant: "row",
                props: {
                    title: "Como funciona",
                    items: [
                        { title: "Marque online", text: "Escolha o serviço e o horário que cabe na sua rotina." },
                        { title: "Traga seu pet", text: "Recebemos com carinho e sem pressa." },
                        { title: "Busque cheiroso", text: "Avisamos pelo WhatsApp quando estiver pronto." }
                    ]
                }
            }),
            S("team", company, { variant: "grid", props: { title: "Nossa equipe" } }),
            S("gallery", company, { variant: "grid", props: { title: "Clientes de quatro patas" } }),
            S("faq", company),
            S("contact", company, { variant: "map" })
        ]
    },
    {
        id: "endereco",
        name: "Endereço",
        audience: "Imobiliárias e corretores",
        description: "Sério e espaçoso: imóveis com quartos, área e vagas, filtro de venda ou aluguel e agendamento de visita.",
        theme: { palette: "concreto", font: "classica", radius: "suave" },
        categories: [],
        build: (company) => [
            S("hero", company, {
                variant: "cover",
                props: {
                    primary: { label: "Ver imóveis", action: "anchor", url: "properties" },
                    secondary: { label: "Falar com um corretor", action: "whatsapp", url: "" }
                }
            }),
            S("properties", company, { variant: "cards" }),
            S("steps", company, {
                variant: "row",
                props: {
                    title: "Do anúncio às chaves",
                    items: [
                        { title: "Conte o que procura", text: "Bairro, tamanho e faixa de preço." },
                        { title: "Visite com a gente", text: "Agendamos as visitas no horário que você puder." },
                        { title: "Feche com segurança", text: "Cuidamos da documentação do começo ao fim." }
                    ]
                }
            }),
            S("about", company, { variant: "image", props: { title: "Quem somos" } }),
            S("testimonials", company, { variant: "cards" }),
            S("form", company, { variant: "side", props: { title: "Quer vender ou alugar seu imóvel?" } }),
            S("contact", company, { variant: "map", props: { title: "Visite nosso escritório" } })
        ]
    },
    {
        id: "desapego",
        name: "Desapego",
        audience: "Brechós, seminovos e usados",
        description: "Produtos com selo de estado (novo, seminovo, usado), itens vendidos marcados e links para OLX e Enjoei.",
        theme: { palette: "musgo", font: "editorial", radius: "redondo" },
        categories: [],
        build: (company) => [
            S("hero", company, {
                variant: "split",
                props: {
                    primary: { label: "Ver peças", action: "anchor", url: "catalog" },
                    secondary: { label: "Quero vender o meu", action: "anchor", url: "form" }
                }
            }),
            S("catalog", company, { variant: "grid", props: { title: "Chegou agora", buttonLabel: "Reservar" } }),
            S("channels", company, { variant: "buttons", props: { title: "Também anunciamos em" } }),
            S("about", company, { variant: "text", props: { title: "Por que comprar usado" } }),
            S("faq", company, { props: { items: [] } }),
            S("form", company, { variant: "side", props: { title: "Tem algo para vender?", subtitle: "Conte o que é e mande um contato. Respondemos com uma proposta." } }),
            S("contact", company, { variant: "simple" })
        ]
    },
    {
        id: "cardapio",
        name: "Cardápio",
        audience: "Restaurantes, lanchonetes e delivery",
        description: "Faixa de pedidos com iFood, 99Food e Rappi logo no topo, cardápio em lista e rotas até a loja.",
        theme: { palette: "brasa", font: "marcante", radius: "suave" },
        categories: [],
        build: (company) => [
            S("hero", company, {
                variant: "cover",
                props: {
                    primary: { label: "Pedir agora", action: "anchor", url: "channels" },
                    secondary: { label: "Pedir pelo WhatsApp", action: "whatsapp", url: "" }
                }
            }),
            S("channels", company, { variant: "banner", props: { title: "Peça pelo seu app favorito" } }),
            S("catalog", company, { variant: "list", props: { title: "Cardápio", buttonLabel: "Pedir", showSold: false } }),
            S("gallery", company, { variant: "carousel", props: { title: "Da nossa cozinha" } }),
            S("contact", company, { variant: "map", props: { title: "Retire na loja" } }),
            S("cta", company, { variant: "band", props: { title: "Encomendas e festas", text: "Chame no WhatsApp para pedidos grandes." } })
        ]
    },
    {
        id: "aula",
        name: "Aula",
        audience: "Professores, cursos e personal trainers",
        description: "Didático: planos lado a lado, como funcionam as aulas, depoimentos de alunos e aula experimental.",
        theme: { palette: "lousa", font: "moderna", radius: "suave" },
        categories: ["educacao", "personal-trainer"],
        build: (company) => [
            S("hero", company, {
                variant: "split",
                props: { primary: { label: "Agendar aula experimental", action: "booking", url: "" } }
            }),
            S("packages", company, { variant: "cards", props: { title: "Planos" } }),
            S("steps", company, {
                variant: "timeline",
                props: {
                    title: "Como são as aulas",
                    items: [
                        { title: "Aula experimental", text: "Conheça o método antes de decidir." },
                        { title: "Plano sob medida", text: "Frequência e objetivos combinados com você." },
                        { title: "Acompanhamento", text: "Evolução registrada aula a aula." }
                    ]
                }
            }),
            S("about", company, { variant: "image", props: { title: "Prazer, eu sou" } }),
            S("testimonials", company, { variant: "cards", props: { title: "O que dizem os alunos" } }),
            S("booking", company, { variant: "highlight", props: { title: "Escolha seu horário" } }),
            S("faq", company)
        ]
    },
    {
        id: "autonomo",
        name: "Autônomo",
        audience: "Profissionais autônomos",
        description: "Pessoal e próximo: sua foto, sua história, serviços e um depoimento em destaque.",
        theme: { palette: "oliva", font: "editorial", radius: "redondo" },
        categories: ["consultoria"],
        build: (company) => [
            S("hero", company, { variant: "split" }),
            S("about", company, { variant: "image", props: { title: "Prazer, eu sou" } }),
            S("services", company, { variant: "cards", props: { title: "Como posso ajudar" } }),
            S("testimonials", company, { variant: "quote" }),
            S("cta", company, { variant: "card" }),
            S("form", company, { variant: "side" })
        ]
    },
    {
        id: "servicos",
        name: "Serviços",
        audience: "Prestadores de serviço",
        description: "Claro e objetivo: o que você faz, quanto custa, dúvidas e um formulário de orçamento.",
        theme: { palette: "markfy", font: "moderna", radius: "suave" },
        categories: ["automotivo", "marketing", "tecnologia"],
        build: (company) => [
            S("hero", company, { variant: "center" }),
            S("services", company, { variant: "cards" }),
            S("about", company, { variant: "image" }),
            S("faq", company),
            S("form", company, { variant: "side", props: { title: "Peça um orçamento" } }),
            S("contact", company, { variant: "simple" }),
            S("cta", company, { variant: "band" })
        ]
    }
];

export const getTemplate = (id) =>
    TEMPLATES.find((template) => template.id === id) || TEMPLATES.find((template) => template.id === "servicos");

/* Sugere o modelo pela categoria cadastrada na empresa. */
export const recommendTemplate = (categories = []) =>
    TEMPLATES.find((template) => template.categories.some((id) => categories.includes(id)))?.id || "servicos";

export const buildPage = (templateId, company) => {
    const template = getTemplate(templateId);

    return {
        v: PAGE_VERSION,
        template: template.id,
        theme: { ...template.theme, colors: {} },
        seo: {
            title: company?.name || "",
            description: (company?.description || "").replace(/\s+/g, " ").slice(0, 155),
            image: company?.photos?.[0] || ""
        },
        settings: { whatsappFloat: !!company?.whatsapp, showHeader: true },
        sections: template.build(company)
    };
};

/* Troca o visual sem perder o conteúdo já editado: mantém
   as seções e aplica paleta, fonte e raio do novo modelo. */
export const applyTemplateLook = (page, templateId) => {
    const template = getTemplate(templateId);

    return {
        ...page,
        template: template.id,
        theme: { ...template.theme, colors: {} }
    };
};
