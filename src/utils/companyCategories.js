/* =========================================================
   CATEGORIAS DE EMPRESA

   Uma lista só, usada pela tela Explorar do app e pela
   exploração da configuração inicial. Estavam declaradas
   dentro de Explore.jsx; duas telas mostrando categorias
   diferentes seria questão de tempo.

   `COMPANY_CATEGORIES` é a lista plana — é o `id` que fica
   gravado em companys/{handle}/categories.

   `CATEGORY_GROUPS` junta essas categorias nos grupos que
   aparecem para quem está procurando ("Beleza", "Saúde"...),
   que é como as pessoas pensam, e não uma a uma.
   ========================================================= */

export const COMPANY_CATEGORIES = [
    { id: 'barbearia', name: 'Barbearia', icon: 'solar:scissors-outline' },
    { id: 'salao-beleza', name: 'Salão de beleza', icon: 'solar:mirror-outline' },
    { id: 'cabeleireiro', name: 'Cabeleireiro', icon: 'solar:scissors-outline' },
    { id: 'manicure-pedicure', name: 'Manicure e pedicure', icon: 'solar:hand-stars-outline' },
    { id: 'sobrancelhas', name: 'Design de sobrancelhas', icon: 'solar:eye-outline' },
    { id: 'cilios', name: 'Extensão de cílios', icon: 'solar:eye-scan-outline' },
    { id: 'maquiagem', name: 'Maquiagem', icon: 'solar:palette-outline' },
    { id: 'tatuagem', name: 'Estúdio de tatuagem', icon: 'solar:pen-new-square-outline' },
    { id: 'fotografia', name: 'Estúdio de fotografia', icon: 'solar:camera-outline' },
    { id: 'estetica', name: 'Clínica de estética', icon: 'solar:heart-pulse-outline' },
    { id: 'massoterapia', name: 'Massoterapia', icon: 'solar:hand-heart-outline' },
    { id: 'spa', name: 'Spa e bem-estar', icon: 'solar:leaf-outline' },
    { id: 'odontologia', name: 'Clínica odontológica', icon: 'solar:medical-kit-outline' },
    { id: 'medicina', name: 'Consultório médico', icon: 'solar:stethoscope-outline' },
    { id: 'fisioterapia', name: 'Fisioterapia', icon: 'solar:health-outline' },
    { id: 'nutricao', name: 'Nutrição', icon: 'solar:chef-hat-outline' },
    { id: 'psicologia', name: 'Psicologia', icon: 'solar:brain-outline' },
    { id: 'personal-trainer', name: 'Personal trainer', icon: 'solar:running-outline' },
    { id: 'academia', name: 'Academia', icon: 'solar:dumbbell-outline' },
    { id: 'pilates', name: 'Pilates', icon: 'solar:body-outline' },
    { id: 'yoga', name: 'Yoga', icon: 'solar:meditation-outline' },
    { id: 'pet-shop', name: 'Pet shop', icon: 'solar:cat-outline' },
    { id: 'banho-tosa', name: 'Banho e tosa', icon: 'solar:scissors-square-outline' },
    { id: 'eventos', name: 'Fotografia e eventos', icon: 'solar:gallery-outline' },
    { id: 'design', name: 'Agência de design', icon: 'solar:pen-2-outline' },
    { id: 'marketing', name: 'Marketing e publicidade', icon: 'solar:graph-up-outline' },
    { id: 'tecnologia', name: 'Tecnologia e desenvolvimento', icon: 'solar:code-outline' },
    { id: 'consultoria', name: 'Consultoria', icon: 'solar:case-outline' },
    { id: 'educacao', name: 'Educação e cursos', icon: 'solar:book-2-outline' },
    { id: 'automotivo', name: 'Serviços automotivos', icon: 'solar:wheel-outline' }
];

export const CATEGORY_GROUPS = [
    {
        id: "beauty",
        name: "Beleza",
        description: "Cuidados, estética e visual",
        icon: "solar:magic-stick-3-linear",

        categories: [
            "barbearia",
            "salao-beleza",
            "cabeleireiro",
            "manicure-pedicure",
            "sobrancelhas",
            "cilios",
            "maquiagem",
            "tatuagem",
            "estetica"
        ]
    },

    {
        id: "health",
        name: "Saúde",
        description: "Profissionais e cuidados",
        icon: "solar:health-linear",

        categories: [
            "odontologia",
            "medicina",
            "fisioterapia",
            "nutricao",
            "psicologia"
        ]
    },

    {
        id: "movement",
        name: "Movimento",
        description: "Treino, corpo e performance",
        icon: "solar:running-2-linear",

        categories: [
            "personal-trainer",
            "academia",
            "pilates",
            "yoga"
        ]
    },

    {
        id: "wellness",
        name: "Bem-estar",
        description: "Relaxamento e autocuidado",
        icon: "solar:leaf-linear",

        categories: [
            "massoterapia",
            "spa"
        ]
    },

    {
        id: "pets",
        name: "Pets",
        description: "Cuidados para seu pet",
        icon: "solar:paw-linear",

        categories: [
            "pet-shop",
            "banho-tosa"
        ]
    },

    {
        id: "services",
        name: "Serviços",
        description: "Profissionais e negócios",
        icon: "solar:case-linear",

        categories: [
            "fotografia",
            "eventos",
            "design",
            "marketing",
            "tecnologia",
            "consultoria",
            "educacao",
            "automotivo"
        ]
    }
];

/* id da categoria -> nome legível. */
export const getCategoryLabel = (id) =>
    COMPANY_CATEGORIES.find(item => item.id === id)?.name || id;


/* As categorias de uma empresa, sempre como array: o campo
   antigo era `category` (uma só) e o novo é `categories`. */
export const getCompanyCategories = (company) => {

    if (Array.isArray(company?.categories)) {
        return company.categories;
    }

    return company?.category
        ? [company.category]
        : [];

};
