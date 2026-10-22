/* =========================================================
   CONTEÚDO DA LANDING

   Texto num lugar só: a página, o FAQ e os dados
   estruturados (FAQPage / HowTo) leem daqui, então o que o
   Google e os assistentes de IA recebem é exatamente o que
   a pessoa vê na tela. Nada exclusivo para robôs.

   Só fatos do produto: sem número de clientes, avaliação
   ou depoimento inventado.
========================================================= */

export const SEGMENTS = [
    "Barbearias",
    "Salões de beleza",
    "Clínicas",
    "Estética",
    "Estúdios de tatuagem",
    "Nail designers",
    "Fisioterapeutas",
    "Pet shops",
    "Consultórios",
    "Restaurantes",
    "Lanchonetes",
    "Cafeterias"
];

/* Palavras que giram no topo do hero. */
export const HERO_AUDIENCE = ["barbearias", "clínicas", "salões", "restaurantes", "estúdios"];

export const PRODUCTS = [
    {
        id: "bookings",
        name: "Markfy Bookings",
        icon: "solar:calendar-mark-bold-duotone",
        title: "Agenda online que o cliente usa sozinho",
        lede:
            "Sua empresa ganha uma página pública com serviços, profissionais e horários livres. " +
            "O cliente escolhe, confirma e pronto: a reserva aparece no seu painel na hora.",
        points: [
            "Página da empresa com endereço próprio na Markfy",
            "Escolha de serviço, profissional e horário pelo celular",
            "Equipe com acesso próprio e papéis de administrador",
            "Pagamento online por Pix e cartão, via Mercado Pago",
            "Mensalidades e assinaturas para clientes recorrentes",
            "Lista de reservas do cliente, sem precisar instalar app"
        ],
        cta: { label: "Criar minha agenda", action: "create" },
        secondary: { label: "Ver empresas na Markfy", href: "/central-user" }
    },
    {
        id: "studio",
        name: "Markfy Studio",
        icon: "solar:pallete-2-bold-duotone",
        title: "O site da sua empresa, montado com o que você já cadastrou",
        lede:
            "O Studio aproveita nome, fotos, serviços e horários da sua empresa para montar um site " +
            "pronto para publicar. Você ajusta blocos, cores e textos e coloca no ar com um clique.",
        points: [
            "Editor visual por blocos, sem código",
            "Dados da empresa puxados automaticamente",
            "Publicação em um endereço público da Markfy",
            "Botão de agendar ligado direto ao Bookings",
            "Analytics com visitas, cliques e conversão"
        ],
        cta: { label: "Abrir o Studio", href: "/studio" },
        secondary: null
    },
    {
        id: "menus",
        name: "Markfy Menus",
        icon: "solar:chef-hat-bold-duotone",
        title: "Cardápio digital com pedidos, mesas e cozinha",
        lede:
            "Para restaurantes, lanchonetes e cafeterias: o cliente abre o cardápio pelo link ou pelo " +
            "QR da mesa e faz o pedido. O pedido cai na cozinha e no painel, com status em tempo real.",
        points: [
            "Pedidos para retirada, entrega e pelo QR da mesa",
            "Mesas, comandas, divisão de conta e fechamento",
            "PDV de balcão, tela da cozinha e quadro de pedidos",
            "16 modelos de cardápio com fontes e cores livres",
            "Controle de estoque com baixa automática",
            "Relatórios por produto, horário, canal e pagamento"
        ],
        cta: { label: "Testar o cardápio de demonstração", href: "/menus/demo" },
        secondary: { label: "Abrir o Menus", href: "/menus" }
    }
];

/* Passo a passo real do produto (é a mesma ordem das telas). */
export const HOW_TO_STEPS = [
    {
        title: "Crie sua conta",
        text: "Cadastre-se com e-mail ou Google. Criar a conta e a empresa não custa nada.",
        screen: "account"
    },
    {
        title: "Cadastre a empresa",
        text: "Informe nome, segmento, endereço e o @ da sua página. A Markfy guia cada etapa.",
        screen: "company"
    },
    {
        title: "Adicione serviços e equipe",
        text: "Monte o catálogo com preço e duração, defina o horário de funcionamento e convide os profissionais.",
        screen: "services"
    },
    {
        title: "Escolha o plano",
        text: "Ative Bookings, Studio, Menus ou um pacote. O plano é da empresa, não da pessoa.",
        screen: "plan"
    },
    {
        title: "Compartilhe o link",
        text: "Coloque o link na bio, no WhatsApp ou no QR do balcão. As reservas e pedidos chegam no painel.",
        screen: "share"
    }
];

/* Para quem agenda: três passos, sem conta obrigatória. */
export const CLIENT_STEPS = [
    { icon: "solar:magnifer-linear", text: "Abre o link da empresa ou encontra pela busca da Markfy" },
    { icon: "solar:calendar-linear", text: "Escolhe serviço, profissional, dia e horário livre" },
    { icon: "solar:check-circle-linear", text: "Confirma e acompanha a reserva pelo celular" }
];

export const FACTS = [
    { value: "3", label: "produtos em uma conta: agenda, site e cardápio" },
    { value: "24h", label: "por dia a sua agenda fica aberta para reservas" },
    { value: "0", label: "apps para o seu cliente instalar" },
    { value: "16", label: "modelos de cardápio digital no Menus" }
];

export const FAQ = [
    {
        q: "O que é a Markfy?",
        a: "A Markfy é uma plataforma brasileira para pequenos negócios de serviço e de alimentação. Ela reúne três produtos: Markfy Bookings (agenda online com página pública), Markfy Studio (site da empresa) e Markfy Menus (cardápio digital com pedidos, mesas e cozinha)."
    },
    {
        q: "Como criar minha empresa na Markfy?",
        a: "Crie uma conta, clique em Criar minha empresa e preencha nome, segmento, endereço e o @ da página. Depois cadastre serviços, horários e equipe, escolha um plano e compartilhe o link com seus clientes."
    },
    {
        q: "Quanto custa a Markfy?",
        a: "Criar a conta e cadastrar a empresa é gratuito. Para receber clientes, a empresa ativa um plano mensal: há planos individuais para cada produto e pacotes que juntam Bookings, Studio e Menus. Os valores atuais estão na seção de planos desta página."
    },
    {
        q: "Meu cliente precisa baixar algum aplicativo?",
        a: "Não. Tudo funciona no navegador do celular ou do computador. O cliente abre o link da empresa, escolhe o serviço e o horário e confirma a reserva."
    },
    {
        q: "Qual a diferença entre Bookings, Studio e Menus?",
        a: "Bookings é a agenda online para quem atende com horário marcado. Studio é o site da empresa, montado com os dados já cadastrados. Menus é o cardápio digital para restaurantes e lanchonetes, com pedidos, mesas, PDV e tela da cozinha."
    },
    {
        q: "Dá para receber pagamento online?",
        a: "Sim. Nos planos que incluem pagamentos online, a empresa conecta a conta do Mercado Pago e pode cobrar por Pix e cartão no agendamento, além de criar mensalidades para clientes recorrentes."
    },
    {
        q: "Posso usar com a minha equipe?",
        a: "Sim. O administrador principal convida profissionais por link ou QR Code. Cada pessoa tem o próprio acesso, e o limite de pessoas depende do plano."
    },
    {
        q: "A Markfy serve para restaurante?",
        a: "Sim, pelo Markfy Menus: cardápio digital pelo link ou QR da mesa, pedidos para retirada e entrega, comandas, divisão de conta, controle de estoque e relatórios."
    },
    {
        q: "Como a Markfy trata os meus dados?",
        a: "A Markfy segue a LGPD: os dados são usados para operar a agenda e os pedidos, cookies não essenciais dependem de consentimento e as preferências podem ser alteradas a qualquer momento no rodapé do site."
    }
];
