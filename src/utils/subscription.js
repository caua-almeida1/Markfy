/* =========================================================
   ASSINATURAS — PLANO DE MENSALIDADE

   Fonte única de verdade para o formato do `monthlyPlan`
   gravado em `companys/{handle}/products/{id}`.

   O wizard de criação grava; a gestão do produto, a home e
   os detalhes do produto leem. Manter a normalização aqui
   evita que cada tela invente o próprio formato.
========================================================= */


/**
 * Ciclos de cobrança aceitos.
 *
 * `months` é usado para derivar o valor equivalente mensal,
 * e `unitLabel` para montar sufixos do tipo "R$ 90,00 /mês".
 */
export const BILLING_CYCLES = [
    {
        id: "monthly",
        label: "Mensal",
        unitLabel: "mês",
        periodLabel: "Todo mês",
        months: 1
    },
    {
        id: "quarterly",
        label: "Trimestral",
        unitLabel: "trimestre",
        periodLabel: "A cada 3 meses",
        months: 3
    },
    {
        id: "semiannual",
        label: "Semestral",
        unitLabel: "semestre",
        periodLabel: "A cada 6 meses",
        months: 6
    },
    {
        id: "annual",
        label: "Anual",
        unitLabel: "ano",
        periodLabel: "Uma vez por ano",
        months: 12
    }
];


const DEFAULT_CYCLE = BILLING_CYCLES[0];


/**
 * Retorna a definição do ciclo, caindo para "Mensal" quando
 * o valor gravado for desconhecido ou estiver ausente.
 */
export const getBillingCycle = (cycleId) => {

    return (
        BILLING_CYCLES.find(
            (cycle) => cycle.id === cycleId
        ) || DEFAULT_CYCLE
    );

};


const toPositiveInt = (value) => {

    const parsed = parseInt(value, 10);

    if (Number.isNaN(parsed) || parsed < 0) {
        return 0;
    }

    return parsed;

};


/**
 * Monta o objeto que vai para o Realtime Database a partir
 * dos estados brutos do wizard (todos podem vir como string
 * vazia, já que são inputs controlados).
 *
 * Nenhum campo pode ficar `undefined`: o Realtime Database
 * rejeita a escrita inteira quando encontra um.
 */
export const buildMonthlyPlan = ({
    billingCycle,
    unlimitedSessions,
    sessionsPerCycle,
    autoRenew,
    trialDays,
    loyaltyMonths,
    cancellationNoticeDays,
    price = null,
    currency = null
} = {}) => {

    const cycle = getBillingCycle(billingCycle);

    const isUnlimited = unlimitedSessions !== false;

    return {

        billingCycle:
            cycle.id,

        billingCycleLabel:
            cycle.label,

        /* "A cada 3 meses" em vez de "Trimestral".
           Para descrever uma cobrança que se repete, dizer o
           intervalo é mais claro do que nomear o ciclo. */
        billingCyclePeriodLabel:
            cycle.periodLabel,

        unlimitedSessions:
            isUnlimited,

        sessionsPerCycle:
            isUnlimited
                ? null
                : toPositiveInt(sessionsPerCycle),

        autoRenew:
            autoRenew !== false,

        trialDays:
            toPositiveInt(trialDays),

        loyaltyMonths:
            toPositiveInt(loyaltyMonths),

        cancellationNoticeDays:
            toPositiveInt(cancellationNoticeDays),

        price:
            price || null,

        currency:
            currency || null

    };

};


/**
 * `true` quando o produto é uma assinatura recorrente.
 */
export const isSubscriptionProduct = (product) => {

    return product?.type === "monthly";

};


/**
 * Lê o plano de um produto já salvo e devolve sempre a mesma
 * forma, mesmo para produtos antigos gravados antes de todos
 * os campos existirem. Retorna `null` para produtos avulsos.
 */
export const normalizeMonthlyPlan = (product) => {

    if (!isSubscriptionProduct(product)) {
        return null;
    }

    const stored = product?.monthlyPlan || {};

    return buildMonthlyPlan({

        billingCycle:
            stored.billingCycle,

        unlimitedSessions:
            stored.unlimitedSessions,

        sessionsPerCycle:
            stored.sessionsPerCycle,

        autoRenew:
            stored.autoRenew,

        trialDays:
            stored.trialDays,

        loyaltyMonths:
            stored.loyaltyMonths,

        cancellationNoticeDays:
            stored.cancellationNoticeDays,

        price:
            stored.price || product?.value || null,

        currency:
            stored.currency || product?.currency || null

    });

};


/**
 * Sufixo curto do preço — "/mês", "/trimestre", ...
 */
export const getPlanPriceSuffix = (plan) => {

    return `/${getBillingCycle(plan?.billingCycle).unitLabel}`;

};


/**
 * Rótulo do que está incluso no ciclo.
 */
export const getPlanSessionsLabel = (plan) => {

    if (!plan || plan.unlimitedSessions) {
        return "Atendimentos ilimitados";
    }

    const sessions = toPositiveInt(plan.sessionsPerCycle);

    if (sessions === 0) {
        return "Sem atendimentos inclusos";
    }

    return `${sessions} ${sessions === 1 ? "atendimento" : "atendimentos"} por ciclo`;

};


const pluralizeDays = (days) =>
    `${days} ${days === 1 ? "dia" : "dias"}`;


const pluralizeMonths = (months) =>
    `${months} ${months === 1 ? "mês" : "meses"}`;


/**
 * Itens prontos para renderizar em lista/grade.
 *
 * Campos zerados (sem teste grátis, sem fidelidade) são
 * omitidos para não poluir a tela do cliente — exceto
 * quando `includeEmpty` é pedido pela tela da gestão, onde
 * o admin precisa ver que o campo existe e está zerado.
 */
export const getPlanHighlights = (
    plan,
    { includeEmpty = false } = {}
) => {

    if (!plan) {
        return [];
    }

    const cycle = getBillingCycle(plan.billingCycle);

    const highlights = [

        {
            id: "cycle",
            icon: "solar:refresh-circle-linear",
            label: "Cobrança",
            value: cycle.periodLabel
        },

        {
            id: "sessions",
            icon: "solar:ticket-outline",
            label: "Incluso no ciclo",
            value: getPlanSessionsLabel(plan)
        },

        {
            id: "autoRenew",
            icon: "solar:restart-circle-linear",
            label: "Renovação automática",
            value: plan.autoRenew
                ? "Renova sozinho a cada ciclo"
                : "Precisa ser renovada manualmente"
        }

    ];

    if (plan.trialDays > 0 || includeEmpty) {

        highlights.push({
            id: "trial",
            icon: "solar:gift-outline",
            label: "Teste gratuito",
            value: plan.trialDays > 0
                ? `${pluralizeDays(plan.trialDays)} grátis antes da 1ª cobrança`
                : "Sem período de teste"
        });

    }

    if (plan.loyaltyMonths > 0 || includeEmpty) {

        highlights.push({
            id: "loyalty",
            icon: "solar:lock-keyhole-minimalistic-outline",
            label: "Permanência mínima",
            value: plan.loyaltyMonths > 0
                ? pluralizeMonths(plan.loyaltyMonths)
                : "Sem fidelidade"
        });

    }

    if (plan.cancellationNoticeDays > 0 || includeEmpty) {

        highlights.push({
            id: "cancellation",
            icon: "solar:calendar-mark-outline",
            label: "Aviso de cancelamento",
            value: plan.cancellationNoticeDays > 0
                ? `${pluralizeDays(plan.cancellationNoticeDays)} de antecedência`
                : "Pode cancelar a qualquer momento"
        });

    }

    return highlights;

};


/**
 * Frase única para cartões e listas compactas.
 */
export const getPlanSummary = (plan) => {

    if (!plan) {
        return "";
    }

    const cycle = getBillingCycle(plan.billingCycle);

    const parts = [
        `Cobrança ${cycle.label.toLowerCase()}`,
        getPlanSessionsLabel(plan).toLowerCase()
    ];

    if (plan.trialDays > 0) {
        parts.push(`${pluralizeDays(plan.trialDays)} de teste grátis`);
    }

    return parts.join(" • ");

};
