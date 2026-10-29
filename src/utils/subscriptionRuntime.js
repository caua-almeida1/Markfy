import {
    equalTo,
    get,
    getDatabase,
    onValue,
    orderByChild,
    query,
    ref
} from "firebase/database";

import { getBillingCycle } from "./subscription";


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

   Quem grava este nó é só o backend (subscriptionsApi). As
   regras de cancelamento daqui espelham as de
   functions-backend/subscriptions-core.js: a tela mostra o
   que vai acontecer, o backend decide.
   ========================================================= */


export const SUBSCRIPTION_STATUS = {
    /* Esperando a pessoa autorizar (conta Mercado Pago). */
    PENDING: "pending",

    /* Ativa e cobrando. */
    ACTIVE: "authorized",

    /* Cobrança falhou; o Mercado Pago vai tentar de novo. */
    PAST_DUE: "past_due",

    /* Pausada no Mercado Pago. */
    PAUSED: "paused",

    /* Encerrada — pode valer até accessUntil. */
    CANCELLED: "cancelled"
};


/* Versão do texto de autorização (subscriptions-core.js).
   Mudou o texto do checkout, muda aqui e lá. */
export const CONSENT_VERSION = "2026-10-24";

/* Direito de arrependimento (CDC, art. 49). */
export const WITHDRAWAL_DAYS = 7;

const DAY_MS = 86400000;


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
 * O que acontece se a assinatura for cancelada hoje.
 *
 * As travas do plano precisam ser ditas ao cliente ANTES de
 * ele confirmar — por isso devolvem o motivo e as datas, não
 * só um booleano.
 *
 *   emFidelidade   não dá para cancelar ainda (só arrependimento)
 *   agendado       o aviso prévio passa da próxima cobrança:
 *                  ela ainda acontece, e o fim é em `encerraEm`
 *   acessoAte      até quando os atendimentos continuam valendo
 *   arrependimento ainda dentro dos 7 dias: dá para desistir
 *                  com estorno integral
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

    /* Ainda não autorizada: nada começou, nada a cumprir. */
    const naoComecou =
        !subscription?.startedAt ||
        subscription?.status === SUBSCRIPTION_STATUS.PENDING;

    const emFidelidade =
        !naoComecou &&
        (fimDaFidelidade ? now < fimDaFidelidade : false);

    const arrependimento =
        Boolean(subscription?.startedAt) &&
        now.getTime() - Number(subscription.startedAt) <= WITHDRAWAL_DAYS * DAY_MS;

    const prazoArrependimento =
        subscription?.startedAt
            ? new Date(Number(subscription.startedAt) + WITHDRAWAL_DAYS * DAY_MS)
            : null;

    /* O aviso prévio não impede o pedido: ele adia o fim. */
    const encerraEm =
        new Date(now.getTime() + avisoDias * DAY_MS);

    /* Em dia: vale até o fim do período pago. Em atraso: não
       há período pago a preservar. */
    const fimDoPago =
        subscription?.status === SUBSCRIPTION_STATUS.ACTIVE
            ? getNextBillingDate(subscription)
            : now;

    const agendado = !naoComecou && encerraEm > fimDoPago;

    return {
        podeCancelar: !emFidelidade,
        emFidelidade,
        fimDaFidelidade,
        avisoDias,
        encerraEm,
        agendado,
        acessoAte: agendado ? null : fimDoPago,
        arrependimento,
        prazoArrependimento
    };

};


/**
 * Rótulo, tom e explicação do estado — o mesmo nas telas do
 * cliente e do painel.
 */
export const getSubscriptionStatusInfo = (subscription, now = Date.now()) => {

    const data = (ms) => new Date(Number(ms)).toLocaleDateString("pt-BR");

    switch (subscription?.status) {

        case SUBSCRIPTION_STATUS.PENDING:
            return {
                label: "Aguardando confirmação",
                tone: "pending",
                description: "Estamos esperando o Mercado Pago confirmar a autorização."
            };

        case SUBSCRIPTION_STATUS.PAST_DUE:
            return {
                label: "Pagamento pendente",
                tone: "late",
                description: "A última cobrança não passou. O Mercado Pago tenta de novo nos próximos dias; se não der certo, a assinatura é encerrada."
            };

        case SUBSCRIPTION_STATUS.PAUSED:
            return {
                label: "Pausada",
                tone: "late",
                description: "A assinatura está pausada no Mercado Pago. Nada é cobrado enquanto isso."
            };

        case SUBSCRIPTION_STATUS.CANCELLED:
            return Number(subscription.accessUntil) > now
                ? {
                    label: `Cancelada · vale até ${data(subscription.accessUntil)}`,
                    tone: "ending",
                    description: `Não haverá novas cobranças. Seus atendimentos continuam valendo até ${data(subscription.accessUntil)}.`
                }
                : {
                    label: "Encerrada",
                    tone: "ended",
                    description: "Esta assinatura foi encerrada e não gera mais cobranças."
                };

        case SUBSCRIPTION_STATUS.ACTIVE:
            return subscription.cancelScheduledFor
                ? {
                    label: `Cancelamento em ${data(subscription.cancelScheduledFor)}`,
                    tone: "ending",
                    description: `Pelo aviso prévio do plano, a assinatura é encerrada em ${data(subscription.cancelScheduledFor)}.`
                }
                : {
                    label: "Ativa",
                    tone: "active",
                    description: "Cobrança automática em dia."
                };

        default:
            return { label: "—", tone: "ended", description: "" };
    }

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


/**
 * Só as assinaturas desta pessoa na empresa.
 *
 * O cliente não pode ler companys/{handle}/subscriptions
 * inteiro (são os planos de todos os clientes); as regras
 * liberam exatamente esta consulta: orderByChild("uid")
 * igual ao próprio uid.
 */
export const watchMySubscriptions = (handle, uid, callback) =>
    onValue(
        query(
            ref(getDatabase(), `companys/${handle}/subscriptions`),
            orderByChild("uid"),
            equalTo(uid)
        ),
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

        },
        () => callback([])
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


/* Cancelada continua valendo até o fim do período já pago
   (mesma regra de bookings-core.js no backend). */
export const isSubscriptionUsable = (subscription, now = Date.now()) =>
    subscription?.status === SUBSCRIPTION_STATUS.ACTIVE ||
    subscription?.status === SUBSCRIPTION_STATUS.PAST_DUE ||
    (
        subscription?.status === SUBSCRIPTION_STATUS.CANCELLED &&
        Number(subscription.accessUntil) > now
    );


/** Aparece para o cliente: usável, esperando confirmação ou pausada. */
export const isSubscriptionVisible = (subscription, now = Date.now()) =>
    isSubscriptionUsable(subscription, now) ||
    subscription?.status === SUBSCRIPTION_STATUS.PENDING ||
    subscription?.status === SUBSCRIPTION_STATUS.PAUSED;


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
        ciclo: getBillingCycle(subscription?.billingCycle),
        estado: getSubscriptionStatusInfo(subscription),

        /* Cobranças já registradas, da mais recente para a
           mais antiga (sem dado de cartão nenhum). */
        cobrancas: Object.entries(subscription?.charges || {})
            .map(([id, item]) => ({ ...item, id }))
            .sort((a, b) => (b.chargedAt || 0) - (a.chargedAt || 0))
    };

};
