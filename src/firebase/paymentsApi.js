import { callApi, callBookings } from "./bookingsApi";

/* =========================================================
   PAGAMENTOS (Cloud Function paymentsApi)

   Conectar, testar e desconectar a conta Mercado Pago da
   empresa, e a tela de espera do pagamento antecipado.

   O navegador nunca vê token nenhum: connect devolve só o
   link de autorização do Mercado Pago; o resto (troca do
   código, renovação, guarda) é do backend. O que a tela
   mostra vem de companys/{handle}/paymentSettings/mercadoPago,
   que não tem credencial.
========================================================= */

const ENDPOINT = "paymentsApi";

/** Link para autorizar a Markfy no Mercado Pago (OAuth). */
export const startMercadoPagoConnection = (handle) =>
    callApi(ENDPOINT, "connect", { handle, origin: window.location.origin });

/** "Testar conexão": só leitura, não cobra nem cria nada. */
export const verifyPaymentConnection = (handle) =>
    callApi(ENDPOINT, "verify", { handle });

/**
 * Com assinaturas abertas o backend pede confirmação (409
 * has_open_subscriptions); `confirm` é a resposta da pessoa.
 */
export const disconnectPaymentAccount = (handle, { confirm = false } = {}) =>
    callApi(ENDPOINT, "disconnect", { handle, confirm });

/** Confere o pagamento antecipado direto no gateway. */
export const fetchPaymentOrderStatus = (handle, orderId) =>
    callApi(ENDPOINT, "orderStatus", { handle, orderId });

/**
 * Como este produto é pago: antecipado, mensalidade e se a
 * empresa está recebendo online (bookingsApi, público).
 */
export const fetchProductPaymentInfo = (handle, productId, options) =>
    callBookings("paymentInfo", { handle, productId }, options);


/* ---------------------------------------------------------
   TEXTOS DA TELA

   Códigos do backend → frases para quem não é técnico. Os
   mesmos em Pagamentos, no retorno do OAuth e na criação de
   produto.
--------------------------------------------------------- */

export const CONNECT_RETURN_MESSAGES = {
    connected: {
        tone: "success",
        title: "Mercado Pago conectado",
        message: "Pronto: seus clientes já podem pagar online."
    },
    denied: {
        tone: "warning",
        title: "Conexão cancelada",
        message: "A autorização foi recusada no Mercado Pago. Toque em Conectar para tentar de novo."
    },
    expired: {
        tone: "warning",
        title: "A conexão demorou demais",
        message: "O link de autorização vale 10 minutos. Toque em Conectar e conclua no Mercado Pago."
    },
    forbidden: {
        tone: "danger",
        title: "Sem permissão",
        message: "Só o administrador da empresa pode conectar a conta de recebimento."
    },
    network: {
        tone: "danger",
        title: "Mercado Pago sem resposta",
        message: "Não conseguimos falar com o Mercado Pago agora. Tente de novo em alguns minutos."
    },
    default: {
        tone: "danger",
        title: "Não foi possível conectar",
        message: "O Mercado Pago não concluiu a conexão. Tente de novo; se continuar, fale com o suporte da Markfy."
    }
};

/** Última recusa registrada pelo backend → o que a empresa faz. */
export const FAILURE_HINTS = {
    CARD_NOT_VALIDATED: {
        title: "Uma assinatura foi recusada na validação do cartão",
        message:
            "Ao assinar, o Mercado Pago faz uma cobrança de valor mínimo no cartão e devolve em seguida. " +
            "Ela é recusada quando: o cartão é de teste e a conta conectada é real; quem paga é o próprio " +
            "dono da conta que recebe; o cartão é de débito ou pré-pago; ou o antifraude bloqueou. Para testar " +
            "sem dinheiro de verdade, conecte uma conta de TESTE do Mercado Pago (veja Como testar)."
    },
    SAME_ACCOUNT: {
        title: "Alguém tentou pagar com a mesma conta que recebe",
        message: "O Mercado Pago não deixa uma conta pagar a si mesma. Use outro e-mail e outro cartão para testar."
    },
    MERCADO_PAGO_SUBSCRIPTION_NOT_ENABLED: {
        title: "A conta não aceitou criar assinaturas",
        message: "Toque em Testar conexão. Se o problema continuar, reconecte a conta ou fale com o suporte do Mercado Pago."
    },
    MERCADO_PAGO_PIX_SEM_CHAVE: {
        title: "Pix sem chave cadastrada",
        message: "Cadastre uma chave Pix no app do Mercado Pago da conta conectada. Enquanto isso, os clientes podem pagar com cartão."
    },
    MERCADO_PAGO_CONTA_NAO_VALIDADA: {
        title: "Conta com validação de identidade pendente",
        message: "Conclua a verificação de identidade no app do Mercado Pago para voltar a receber."
    },
    MERCADO_PAGO_SEM_PERMISSAO: {
        title: "A conta recusou um pagamento por permissão",
        message: "Desconecte e conecte a conta de novo para renovar as permissões da Markfy."
    }
};

export const CHECK_PROBLEMS = {
    reconnect_required: "O acesso da Markfy à sua conta expirou ou foi removido. Toque em Reconectar.",
    not_connected: "Nenhuma conta conectada.",
    account_unreachable: "O Mercado Pago não respondeu pela sua conta. Tente de novo em alguns minutos.",
    subscriptions_unreachable: "A conta respondeu, mas não liberou a parte de assinaturas. Reconecte a conta.",
    network: "O Mercado Pago não respondeu. Tente de novo em alguns minutos.",
    credentials_missing: "A Markfy está sem as credenciais do aplicativo. Avise o suporte da Markfy."
};
