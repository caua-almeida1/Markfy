/* =========================================================
   SEGMENTOS DO CADASTRO DE EMPRESA

   Escolher o ramo preenche, como SUGESTÃO editável:
     - as categorias (ids de utils/companyCategories, que é o
       que o Explorar filtra);
     - um texto inicial de descrição.

   `services` são só ideias mostradas no fim do cadastro e no
   painel — nenhum serviço, preço ou horário é criado sem a
   empresa cadastrar. Para adicionar um ramo, basta uma
   entrada nova aqui.
========================================================= */

export const COMPANY_SEGMENTS = [
    {
        id: "barbearia",
        name: "Barbearia",
        icon: "solar:scissors-outline",
        categories: ["barbearia"],
        description: "Cortes, barba e acabamento com hora marcada. Escolha o profissional e agende online.",
        services: ["Corte masculino (30 min)", "Barba (30 min)", "Corte + barba (60 min)"]
    },
    {
        id: "salao",
        name: "Salão de beleza",
        icon: "solar:mirror-outline",
        categories: ["salao-beleza", "cabeleireiro"],
        description: "Corte, coloração, escova e tratamentos para o cabelo. Agende seu horário online.",
        services: ["Corte feminino (60 min)", "Escova (45 min)", "Coloração (120 min)"]
    },
    {
        id: "estetica",
        name: "Estética",
        icon: "solar:heart-pulse-outline",
        categories: ["estetica", "sobrancelhas", "cilios"],
        description: "Procedimentos estéticos faciais e corporais com atendimento agendado.",
        services: ["Limpeza de pele (60 min)", "Design de sobrancelhas (30 min)", "Extensão de cílios (90 min)"]
    },
    {
        id: "unhas",
        name: "Manicure e pedicure",
        icon: "solar:hand-stars-outline",
        categories: ["manicure-pedicure"],
        description: "Manicure, pedicure e alongamento de unhas com hora marcada.",
        services: ["Manicure (40 min)", "Pedicure (40 min)", "Pé e mão (80 min)"]
    },
    {
        id: "clinica",
        name: "Clínica ou consultório",
        icon: "solar:stethoscope-outline",
        categories: ["medicina"],
        description: "Consultas e atendimentos com agendamento online.",
        services: ["Consulta (30 min)", "Retorno (20 min)"]
    },
    {
        id: "bem-estar",
        name: "Massagem e bem-estar",
        icon: "solar:leaf-outline",
        categories: ["massoterapia", "spa"],
        description: "Massagens e terapias de relaxamento com horário marcado.",
        services: ["Massagem relaxante (60 min)", "Drenagem linfática (60 min)"]
    },
    {
        id: "personal",
        name: "Personal trainer",
        icon: "solar:running-outline",
        categories: ["personal-trainer"],
        description: "Treinos individuais e acompanhamento com horário marcado.",
        services: ["Aula individual (60 min)", "Avaliação física (45 min)"]
    },
    {
        id: "pet",
        name: "Pet shop",
        icon: "solar:cat-outline",
        categories: ["pet-shop", "banho-tosa"],
        description: "Banho, tosa e cuidados para o seu pet, com horário agendado.",
        services: ["Banho (60 min)", "Banho e tosa (90 min)"]
    },
    {
        id: "tatuagem",
        name: "Estúdio de tatuagem",
        icon: "solar:pen-new-square-outline",
        categories: ["tatuagem"],
        description: "Tatuagens e orçamentos com hora marcada.",
        services: ["Orçamento (30 min)", "Sessão (120 min)"]
    },
    {
        id: "assistencia",
        name: "Assistência técnica",
        icon: "solar:smartphone-outline",
        categories: ["tecnologia"],
        description: "Diagnóstico e reparo com atendimento agendado.",
        services: ["Diagnóstico (30 min)", "Reparo (60 min)"]
    },
    {
        id: "profissional",
        name: "Serviços profissionais",
        icon: "solar:case-outline",
        categories: ["consultoria"],
        description: "Atendimentos e consultorias com horário marcado.",
        services: ["Reunião inicial (30 min)", "Atendimento (60 min)"]
    },
    {
        id: "outro",
        name: "Outro tipo de serviço",
        icon: "solar:widget-5-outline",
        categories: [],
        description: "",
        services: []
    }
];

export const getSegment = (id) =>
    COMPANY_SEGMENTS.find((segment) => segment.id === id) || null;

const normalize = (value) =>
    String(value || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();

export const searchSegments = (term) => {
    const query = normalize(term).trim();
    if (!query) return COMPANY_SEGMENTS;
    return COMPANY_SEGMENTS.filter((segment) => normalize(segment.name).includes(query));
};
