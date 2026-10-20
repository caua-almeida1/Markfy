/* =========================================================
   MARKFY MASTER DEV — CONFIGURAÇÃO

   Este arquivo só descreve o QUE existe: a rota secreta,
   a conta dona do painel, os produtos e os planos.

   A senha da conta master NÃO mora aqui nem em lugar
   nenhum do código: ela vive só no Firebase Authentication.
   O que o painel faz é tentar entrar com e-mail + a senha
   digitada; quem confere é o Firebase.
========================================================= */

export const MASTER_ROUTE = "/markfy-master-dev";

/* Contas que entram no painel. A SENHA nunca fica aqui: vive só no
   Firebase Authentication.

   forcePasswordChange: na primeira entrada a pessoa precisa trocar a
   senha provisória por uma escolhida por ela. */
export const MASTER_ACCOUNTS = [
    { email: "caua.master@markfy.com", forcePasswordChange: false },
    { email: "marcelo.master@markfy.com", forcePasswordChange: true }
];

export const MASTER_EMAIL = MASTER_ACCOUNTS[0].email;

export const getMasterAccount = (email) =>
    MASTER_ACCOUNTS.find(
        (account) => account.email === String(email || "").trim().toLowerCase()
    ) || null;


/* ---------- PRODUTOS ----------
   A cor de cada produto é a mesma em toda a tela: azul =
   Bookings, rosa = Studio, laranja = Menus, pacotes = roxo,
   cinza = nada. Os valores são os mesmos gravados em
   licenses/{handle}.product (ver src/menus/engine/licensing.js). */

export const PRODUCTS = [
    {
        id: "none",
        label: "Sem acesso",
        short: "Nenhum",
        hint: "Não entra em nenhum produto Markfy.",
        icon: "solar:lock-keyhole-minimalistic-bold",
        color: "#7b7f93"
    },
    {
        id: "bookings",
        label: "Markfy Bookings",
        short: "Bookings",
        hint: "Agenda, catálogo e pagamentos.",
        icon: "solar:calendar-bold",
        color: "#38bdf8"
    },
    {
        id: "studio",
        label: "Markfy Studio",
        short: "Studio",
        hint: "Editor de páginas e site público.",
        icon: "solar:pallete-2-bold",
        color: "#f472b6"
    },
    {
        id: "menus",
        label: "Markfy Menus",
        short: "Menus",
        hint: "Cardápio digital, pedidos, mesas e comandas.",
        icon: "solar:chef-hat-bold",
        color: "#fb923c"
    },
    {
        id: "both",
        label: "Bookings + Studio",
        short: "Bookings + Studio",
        hint: "Pacote com os dois produtos (plano Pro).",
        icon: "solar:crown-star-bold",
        color: "#a78bfa"
    },
    {
        id: "all",
        label: "Bookings + Studio + Menus",
        short: "Os três",
        hint: "Acesso completo à rede Markfy (Premium).",
        icon: "solar:crown-star-bold",
        color: "#c084fc"
    }
];

/* Produtos que um plano individual pode liberar. */
export const SINGLE_PRODUCTS = PRODUCTS.filter((product) => ["bookings", "studio", "menus"].includes(product.id));

export const getProduct = (id) =>
    PRODUCTS.find((product) => product.id === id) || PRODUCTS[0];



/* Os planos vivem em planCatalog (editáveis na aba Planos).
   Os padrões ficam em src/plans/planDefaults.js. */

/* ---------- SITUAÇÃO DA LICENÇA ---------- */

export const LICENSE_STATUS = [
    { id: "active", label: "Ativa", color: "#4ade80" },
    { id: "suspended", label: "Suspensa", color: "#f87171" }
];


/* ---------- PAPÉIS ---------- */

export const ROLE_KINDS = {
    owner: {
        id: "owner",
        label: "Dono",
        long: "Dono / administrador principal",
        color: "#ffb020",
        icon: "solar:crown-bold"
    },
    employee: {
        id: "employee",
        label: "Funcionário",
        long: "Funcionário de empresa",
        color: "#2dd4bf",
        icon: "solar:user-id-bold"
    },
    user: {
        id: "user",
        label: "Sem empresa",
        long: "Usuário sem empresa",
        color: "#94a3b8",
        icon: "solar:user-bold"
    }
};
