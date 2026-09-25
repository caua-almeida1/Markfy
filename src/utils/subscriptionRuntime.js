import {
    get,
    getDatabase,
    onValue,
    ref,
    update
} from "firebase/database";

import { getBillingCycle, normalizeMonthlyPlan } from "./subscription";


/* =========================================================
   ASSINATURA EM USO

   `subscription.js` descreve o PLANO — o que o administrador
   configurou no produto. Este arquivo cuida do que acontece
   depois que alguém assina: quando cobra de novo, quantas
   sessões sobraram no ciclo, se ainda dá para marcar ou
   cancelar.

   ONDE FICA

       companys/{handle}/subscriptions/{uid}_{productId}

   A chave é uid + produto porque é isso que a regra é: uma
   assinatura ativa por pessoa por produto. Assinar duas
   vezes o mesmo plano não é um caso de uso, é um engano — e
   com essa chave ele nem chega a acontecer.

   Os agendamentos feitos dentro da assinatura continuam
   sendo agendamentos normais em `schedules`, só que com
   `subscriptionId` preenchido. Assim o painel, a agenda e o
   cancelamento seguem funcionando sem saber o que é
   assinatura.
   ========================================================= */


export const SUBSCRIPTION_STATUS = {
    /* Esperando o Mercado Pago autorizar o cartão. */
    PENDING: "pending",

    /* Ativa e cobrando. */
    ACTIVE: "authorized",

    /* Cobrança falhou; o Mercado Pago vai tentar de novo. */
    PAST_DUE: "past_due",

    /* Encerrada — pelo cliente ou por falta de pagamento. */
    CANCELLED: "cancelled"
};


export const buildSubscriptionId = (uid, productId) =>
    `${uid}_${productId}`;


const subscriptionRef = (handle, subscriptionId) =>
    ref(
        getDatabase(),
        `companys/${handle}/subscriptions/${subscriptionId}`
    );


/* ---------------------------------------------------------
   DATAS
--------------------------------------------------------- */

/**
 * Soma meses preservando o dia sempre que ele existir.
 *
 * Um plano assinado dia 31 não pode "pular" fevereiro: o
 * JavaScript transformaria 31/02 em 03/03 sozinho. Aqui ele
 * cai para o último dia do mês, que é o que qualquer
 * cobrança recorrente faz.
 */
export const addMonths = (date, months) => {

    const base = new Date(date);

    const diaDesejado = base.getDate();

    base.setDate(1);
    base.setMonth(base.getMonth() + months);

    const ultimoDiaDoMes =
        new Date(
            base.getFullYear(),
            base.getMonth() + 1,
            0
        ).getDate();

    base.setDate(
        Math.min(diaDesejado, ultimoDiaDoMes)
    );

    return base;

};


/**
 * Início e fim do ciclo em que a assinatura está agora.
 *
 * Avança a partir da data de início até alcançar hoje, em
 * vez de calcular por divisão: meses têm tamanhos
 * diferentes, e um erro de um dia aqui significa uma sessão
 * a mais ou a menos para o cliente.
 */
export const getCycleWindow = (subscription, reference = new Date()) => {

    const inicio =
        new Date(subscription?.startedAt || Date.now());

    const meses =
        getBillingCycle(subscription?.billingCycle).months;

    let cycleStart = new Date(inicio);
    let cycleEnd = addMonths(cycleStart, meses);

    /* Trava de segurança: uma assinatura muito antiga com
       data corrompida não pode prender o laço. */
    let voltas = 0;

    while (cycleEnd <= reference && voltas < 600) {
        cycleStart = cycleEnd;
        cycleEnd = addMonths(cycleStart, meses);
        voltas += 1;
    }

    return { cycleStart, cycleEnd };

};


export const getNextBillingDate = (subscription) => {

    /* O Mercado Pago é quem manda: se ele já informou a
       próxima cobrança, é essa a data — inclusive quando uma
       tentativa falhou e ele reagendou. */
    if (subscription?.nextBillingAt) {
        return new Date(subscription.nextBillingAt);
    }

    return getCycleWindow(subscription).cycleEnd;

};


/* ---------------------------------------------------------
   SESSÕES
--------------------------------------------------------- */

/**
 * Quantos atendimentos ainda cabem no ciclo atual.
 *
 * `null` quer dizer ilimitado — e null é de propósito, para
 * quem chama ser obrigado a tratar o caso em vez de receber
 * um número grande e comparar sem pensar.
 */
export const getSessionsRemaining = (subscription, schedules = []) => {

    if (subscription?.unlimitedSessions) {
        return null;
    }

    const total =
        Number(subscription?.sessionsPerCycle) || 0;

    return Math.max(0, total - countCycleSessions(subscription, schedules));

};


/**
 * Agendamentos desta assinatura dentro do ciclo atual.
 *
 * Cancelados não contam: se contassem, desmarcar gastaria a
 * sessão do mesmo jeito e ninguém desmarcaria nada.
 */
export const countCycleSessions = (subscription, schedules = []) => {

    const { cycleStart, cycleEnd } =
        getCycleWindow(subscription);

    return schedules.filter((schedule) => {

        if (schedule.subscriptionId !== subscription?.id) {
            return false;
        }

        if (
            schedule.status === "cancelados" ||
            schedule.status === "cancelled" ||
            schedule.status === "canceled"
        ) {
            return false;
        }

        const data = parseScheduleDate(schedule);

        if (!data) return false;

        return data >= cycleStart && data < cycleEnd;

    }).length;

};


/** "dd/mm/aaaa" + "HH:MM" → Date. */
export const parseScheduleDate = (schedule) => {

    if (!schedule?.day) return null;

    const [dia, mes, ano] =
        String(schedule.day).split("/").map(Number);

    const [hora, minuto] =
        String(schedule.hour || "00:00").split(":").map(Number);

    if (!dia || !mes || !ano) return null;

    return new Date(
        ano,
        mes - 1,
        dia,
        hora || 0,
        minuto || 0
    );

};


/* ---------------------------------------------------------
   REGRAS DE ANTECEDÊNCIA

   As mesmas que o administrador configurou no produto. Estão
   aqui, e não espalhadas pelas telas, porque marcar e
   desmarcar acontecem em lugares diferentes e precisam
   concordar sobre o que é permitido.
--------------------------------------------------------- */

export const advanceToMs = (advance) => {

    const { days = 0, hours = 0, minutes = 0 } = advance || {};

    return (
        (Number(days) || 0) * 86400000 +
        (Number(hours) || 0) * 3600000 +
        (Number(minutes) || 0) * 60000
    );

};


export const formatAdvance = (advance) => {

    const { days = 0, hours = 0, minutes = 0 } = advance || {};

    const partes = [];

    if (days) partes.push(`${days} ${days === 1 ? "dia" : "dias"}`);
    if (hours) partes.push(`${hours}h`);
    if (minutes) partes.push(`${minutes}min`);

    return partes.length
        ? partes.join(" e ")
        : "nenhuma antecedência";

};


/** Dá para marcar neste horário, respeitando a antecedência mínima? */
export const canBookAt = (date, product, now = new Date()) => {

    const minimo =
        advanceToMs(product?.bookingAdvance);

    return date.getTime() - now.getTime() >= minimo;

};


/** Dá para desmarcar este agendamento agora? */
export const canCancelAt = (date, product, now = new Date()) => {

    const minimo =
        advanceToMs(product?.cancellationAdvance);

    return date.getTime() - now.getTime() >= minimo;

};


/* ---------------------------------------------------------
   CANCELAMENTO DA ASSINATURA
--------------------------------------------------------- */

/**
 * A assinatura pode ser encerrada hoje?
 *
 * Duas travas do plano, e as duas precisam ser ditas ao
 * cliente ANTES de ele assinar — por isso devolvem o motivo
 * e a data, não só um booleano.
 */
export const getCancellationRules = (subscription, now = new Date()) => {

    const fidelidadeMeses =
        Number(subscription?.loyaltyMonths) || 0;

    const avisoDias =
        Number(subscription?.cancellationNoticeDays) || 0;

    const inicio =
        new Date(subscription?.startedAt || Date.now());

    const fimDaFidelidade =
        fidelidadeMeses
            ? addMonths(inicio, fidelidadeMeses)
            : null;

    const emFidelidade =
        fimDaFidelidade ? now < fimDaFidelidade : false;

    /* O aviso prévio não impede o pedido: ele adia o fim.
       Quem cancela hoje segue com acesso até lá — e segue
       pagando, o que é justamente o que precisa estar claro. */
    const encerraEm =
        new Date(now.getTime() + avisoDias * 86400000);

    return {
        podeCancelar: !emFidelidade,
        emFidelidade,
        fimDaFidelidade,
        avisoDias,
        encerraEm
    };

};


/* ---------------------------------------------------------
   LEITURA E ESCRITA
--------------------------------------------------------- */

export const watchCompanySubscriptions = (handle, callback) =>
    onValue(
        ref(getDatabase(), `companys/${handle}/subscriptions`),
        (snapshot) => {

            const dados = snapshot.val() || {};

            callback(
                Object.entries(dados)
                    .map(([id, item]) => ({ ...item, id }))
                    .sort(
                        (a, b) =>
                            (b.createdAt || 0) - (a.createdAt || 0)
                    )
            );

        }
    );


export const watchSubscription = (handle, subscriptionId, callback) =>
    onValue(
        subscriptionRef(handle, subscriptionId),
        (snapshot) =>
            callback(
                snapshot.exists()
                    ? { ...snapshot.val(), id: subscriptionId }
                    : null
            )
    );


/** A assinatura desta pessoa para este produto, se existir. */
export const getUserSubscription = async (handle, uid, productId) => {

    if (!handle || !uid || !productId) {
        return null;
    }

    const id = buildSubscriptionId(uid, productId);

    const snapshot = await get(
        subscriptionRef(handle, id)
    );

    if (!snapshot.exists()) {
        return null;
    }

    return { ...snapshot.val(), id };

};


export const isSubscriptionUsable = (subscription) =>
    subscription?.status === SUBSCRIPTION_STATUS.ACTIVE ||
    subscription?.status === SUBSCRIPTION_STATUS.PAST_DUE;


/** Marca a intenção de cancelar; quem encerra de fato é o backend. */
export const requestSubscriptionCancellation = async (
    handle,
    subscriptionId,
    encerraEm
) => {

    await update(
        subscriptionRef(handle, subscriptionId),
        {
            cancellationRequestedAt: Date.now(),
            cancelScheduledFor: encerraEm?.getTime?.() || Date.now(),
            updatedAt: Date.now()
        }
    );

};


/**
 * Resumo pronto para a tela: o que sobrou, quando cobra de
 * novo, o que trava o cancelamento.
 */
export const getSubscriptionSummary = (subscription, schedules = []) => {

    const { cycleStart, cycleEnd } =
        getCycleWindow(subscription);

    const usadas =
        countCycleSessions(subscription, schedules);

    return {
        cycleStart,
        cycleEnd,
        sessoesUsadas: usadas,
        sessoesRestantes: getSessionsRemaining(subscription, schedules),
        proximaCobranca: getNextBillingDate(subscription),
        cancelamento: getCancellationRules(subscription),
        ciclo: getBillingCycle(subscription?.billingCycle)
    };

};


/** Dados do plano do produto, no formato gravado na assinatura. */
export const planToSubscriptionFields = (product) => {

    const plan = normalizeMonthlyPlan(product);

    if (!plan) return null;

    return {
        billingCycle: plan.billingCycle,
        price: plan.price,
        currency: plan.currency,
        unlimitedSessions: plan.unlimitedSessions,
        sessionsPerCycle: plan.sessionsPerCycle,
        autoRenew: plan.autoRenew,
        trialDays: plan.trialDays,
        loyaltyMonths: plan.loyaltyMonths,
        cancellationNoticeDays: plan.cancellationNoticeDays
    };

};
