/* =====================================================
   PROVEDORES DE PAGAMENTO

   Cada gateway é um módulo com o mesmo contrato do
   mercadopago.js. As regras de negócio (subscriptions.js,
   advance-payments.js, connections.js) só usam estas funções
   e os objetos normalizados — nunca endereços ou campos do
   gateway:

     conexão      authorizationUrl, exchangeCode,
                  refreshTokens, getAccount, credentialRefused
     assinatura   buildSubscription, createSubscription,
                  getSubscription, setSubscriptionStatus,
                  probeSubscriptions, listCharges, getCharge,
                  toSubscription, toCharge
     pagamento    createPayment, getPayment, refundPayment,
                  toPayment
     webhook      verifyWebhookSignature, parseNotification

   Formatos normalizados:

     assinatura   { id, status: pending|authorized|paused|
                    cancelled|null, providerStatus,
                    nextBillingAt, externalReference,
                    authorizeUrl }
     cobrança     { id, subscriptionId, amount, label, paid,
                    failed, paymentId, retryAttempt, chargedAt }
     pagamento    { id, status, statusDetail, amount, currency,
                    externalReference, methodId, approvedAt,
                    recurring, pix }

   ASAAS (investigado em 31/10/2026, docs.asaas.com)

   Não está registrado, de propósito. A API de assinaturas
   do Asaas cobre o que a mensalidade precisa (POST
   /v3/subscriptions com cartão, cobranças geradas a cada
   ciclo, webhooks com token no header asaas-access-token),
   mas o Asaas não tem OAuth: para o dinheiro cair na conta
   de cada empresa, ou a empresa entrega a própria chave de
   API (credencial privada — o que este projeto proíbe), ou
   a Markfy vira conta-pai (CNPJ) e cria subcontas, com
   período de avaliação regulatória (10 subcontas, R$ 2.000
   por subconta, até 60 dias) e habilitação pelo gerente de
   conta. Não há limitação comprovada do Mercado Pago que
   justifique essa troca hoje. Detalhes e o que faltaria em
   docs/PAGAMENTOS.md.
===================================================== */

const mercadopago = require("./mercadopago");

const PROVIDERS = {
    [mercadopago.id]: mercadopago
};

const DEFAULT_PROVIDER = mercadopago.id;

const getProvider = (providerId = DEFAULT_PROVIDER) => {

    const provider = PROVIDERS[providerId];

    if (!provider) {
        const error = new Error(`Provedor de pagamento não suportado: ${providerId}`);
        error.code = "unsupported_provider";
        throw error;
    }

    return provider;
};

module.exports = { getProvider, PROVIDERS, DEFAULT_PROVIDER };
