/* =========================================================
   PERFIS E PERMISSÕES DO MENUS

   O vínculo com a empresa continua sendo o da Markfy
   (companys/{handle}/members/{uid}.role):

     master         → owner  (administrador principal)
     administrator  → admin
     professional   → o perfil do Menus definido em
                      menusStaff/{handle}/{uid}.role
                      (sem definição: garçom)

   Cada perfil tem uma lista de ações. Ajustes individuais
   ficam em menusStaff/{handle}/{uid}.grants ({ ação: bool })
   e só valem para quem não é owner/admin.

   O backend usa ESTA tabela para autorizar cada operação; o
   painel usa a mesma para mostrar ou esconder ações. Esconder
   botão não é segurança — a recusa acontece no servidor.
========================================================= */

export const ACTIONS = {
    "catalog.view": { module: "Cardápio", label: "Ver cardápio e produtos" },
    "catalog.edit": { module: "Cardápio", label: "Criar e editar produtos e categorias" },
    "catalog.prices": { module: "Cardápio", label: "Alterar preços" },
    "catalog.availability": { module: "Cardápio", label: "Marcar produto como esgotado/disponível" },
    "design.edit": { module: "Aparência", label: "Editar aparência do cardápio" },
    "design.publish": { module: "Aparência", label: "Publicar alterações" },
    "tables.view": { module: "Mesas e comandas", label: "Ver mesas e comandas" },
    "tables.open": { module: "Mesas e comandas", label: "Abrir mesa" },
    "tables.order": { module: "Mesas e comandas", label: "Lançar itens e enviar para a cozinha" },
    "tables.removePending": { module: "Mesas e comandas", label: "Remover item ainda não enviado" },
    "tables.transfer": { module: "Mesas e comandas", label: "Transferir e unir mesas" },
    "tables.layout": { module: "Mesas e comandas", label: "Editar mesas e a planta" },
    "tabs.cancelItem": { module: "Mesas e comandas", label: "Cancelar item já enviado" },
    "tabs.discount": { module: "Mesas e comandas", label: "Conceder desconto" },
    "tabs.serviceFee": { module: "Mesas e comandas", label: "Retirar ou ajustar taxa de serviço" },
    "tabs.payment": { module: "Caixa", label: "Registrar pagamento" },
    "tabs.refund": { module: "Caixa", label: "Estornar pagamento" },
    "tabs.close": { module: "Caixa", label: "Fechar comanda" },
    "tabs.reopen": { module: "Caixa", label: "Reabrir comanda fechada" },
    "orders.view": { module: "Pedidos", label: "Ver pedidos" },
    "orders.create": { module: "Pedidos", label: "Lançar pedido no balcão (PDV)" },
    "orders.status": { module: "Pedidos", label: "Atualizar status do pedido" },
    "orders.cancel": { module: "Pedidos", label: "Cancelar pedido" },
    "orders.payment": { module: "Caixa", label: "Confirmar pagamento de pedido" },
    "kitchen.view": { module: "Cozinha", label: "Usar a tela da cozinha" },
    "delivery.view": { module: "Entrega", label: "Ver entregas" },
    "delivery.update": { module: "Entrega", label: "Atualizar entrega" },
    "stock.view": { module: "Estoque", label: "Ver estoque" },
    "stock.edit": { module: "Estoque", label: "Movimentar estoque" },
    "reports.view": { module: "Relatórios", label: "Ver resumo de vendas" },
    "reports.financial": { module: "Relatórios", label: "Ver relatórios financeiros completos" },
    "reports.export": { module: "Relatórios", label: "Exportar relatórios" },
    "customers.view": { module: "Gestão", label: "Ver clientes" },
    "team.manage": { module: "Gestão", label: "Gerenciar equipe e permissões" },
    "settings.edit": { module: "Configurações", label: "Alterar configurações da empresa" },
    "audit.view": { module: "Gestão", label: "Ver registro de auditoria" },
    "plan.manage": { module: "Configurações", label: "Assinar ou trocar o plano" }
};

export const ACTION_IDS = Object.keys(ACTIONS);

const ALL_BUT = (...excluded) => ACTION_IDS.filter((id) => !excluded.includes(id));

export const ROLES = {
    owner: {
        label: "Proprietário",
        description: "Acesso total, inclusive plano e equipe.",
        actions: ACTION_IDS
    },
    admin: {
        label: "Administrador",
        description: "Tudo, exceto assinar ou trocar o plano.",
        actions: ALL_BUT("plan.manage")
    },
    manager: {
        label: "Gerente",
        description: "Operação, cardápio, descontos, estornos e relatórios.",
        actions: ALL_BUT("plan.manage", "team.manage", "settings.edit")
    },
    waiter: {
        label: "Garçom",
        description: "Abre mesas, lança pedidos e acompanha comandas.",
        actions: [
            "catalog.view",
            "tables.view",
            "tables.open",
            "tables.order",
            "tables.removePending",
            "tables.transfer",
            "orders.view",
            "orders.status"
        ]
    },
    cashier: {
        label: "Caixa",
        description: "Recebe pagamentos, fecha comandas e lança pedidos no balcão.",
        actions: [
            "catalog.view",
            "tables.view",
            "tables.open",
            "tables.order",
            "tables.removePending",
            "tabs.serviceFee",
            "tabs.payment",
            "tabs.close",
            "orders.view",
            "orders.create",
            "orders.status",
            "orders.payment",
            "reports.view",
            "customers.view"
        ]
    },
    kitchen: {
        label: "Cozinha",
        description: "Vê os pedidos de preparo e marca como pronto.",
        actions: ["kitchen.view", "orders.view", "orders.status", "catalog.availability", "stock.view"]
    },
    delivery: {
        label: "Entregador",
        description: "Vê as entregas e marca como entregue.",
        actions: ["delivery.view", "delivery.update", "orders.view"]
    }
};

export const ROLE_IDS = Object.keys(ROLES);

/** Perfis que o administrador pode atribuir a um profissional. */
export const ASSIGNABLE_ROLES = ["manager", "waiter", "cashier", "kitchen", "delivery"];

export const resolveRole = (memberRole, staff) => {
    if (memberRole === "master") return "owner";
    if (memberRole === "administrator") return "admin";
    if (!memberRole) return null;
    return ASSIGNABLE_ROLES.includes(staff?.role) ? staff.role : "waiter";
};

export const can = (role, action, grants = null) => {
    if (!role || !ROLES[role]) return false;
    if (role === "owner") return true;

    if (role !== "admin" && grants && typeof grants === "object" && typeof grants[action] === "boolean") {
        /* Ajuste individual nunca concede o que é exclusivo do dono. */
        if (action === "plan.manage" || action === "team.manage") return false;
        return grants[action];
    }

    return ROLES[role].actions.includes(action);
};

/** Ações que precisam de recurso do plano além da permissão. */
export const ACTION_FEATURE = {
    "tables.view": "menusTables",
    "tables.open": "menusTables",
    "tables.order": "menusTables",
    "tables.removePending": "menusTables",
    "tables.transfer": "menusTables",
    "tables.layout": "menusTables",
    "tabs.cancelItem": "menusTables",
    "tabs.discount": "menusTables",
    "tabs.serviceFee": "menusTables",
    "tabs.payment": "menusTables",
    "tabs.refund": "menusTables",
    "tabs.close": "menusTables",
    "tabs.reopen": "menusTables",
    "orders.create": "menusPos",
    "kitchen.view": "menusPos",
    "stock.edit": "menusStock",
    "reports.financial": "menusReports",
    "reports.export": "menusReports"
};
