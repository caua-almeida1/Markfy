/* =====================================================
   PAGAMENTO ANTECIPADO

   O cliente paga uma vez, antes do atendimento. Fluxo:

     1. create      o navegador manda só as escolhas (serviço,
                    extras, profissional, dia, hora) e o meio
                    de pagamento (token do cartão do Brick ou
                    Pix). O valor é calculado AQUI, com o mesmo
                    preço que a tela mostra (promoção válida +
                    serviços extras) — antes era product.value
                    cheio, sem promoção e sem extras.
     2. o gateway   aprova na hora (cartão), deixa pendente
                    (Pix, análise) ou recusa.
     3. confirm     roda com o pagamento LIDO DO GATEWAY (nunca
                    com o que o navegador ou a notificação
                    dizem): confere referência e valor, grava o
                    estado e, aprovado, cria o agendamento uma
                    vez só, pela mesma bookingsApi de sempre
                    (com a trava de conflito de horário).

   Quem chama o confirm: a resposta da criação (cartão
   aprovado na hora), o webhook e a tela de espera do cliente
   (sync). Os três podem chegar juntos — a reserva do
   agendamento é uma transação.

   companys/{handle}/paymentOrders/{orderId}

     status   pending | in_process | approved | paid |
              needs_attention | rejected | cancelled |
              refunded | charged_back | error
              ("paid" = aprovado E agendado; "needs_attention"
              = aprovado, mas o horário não pôde ser reservado
              ou o valor não confere: a empresa precisa
              reagendar ou estornar)
===================================================== */

const crypto = require("crypto");

const bookings = require("../bookings");

const core = bookings.bookingsCore;

const PAYMENT_METHOD = /^[a-z_]{2,40}$/;
const CARD_TOKEN = /^[A-Za-z0-9]{8,64}$/;
const DIGITS = /^\d{1,30}$/;

class PaymentError extends Error {
    constructor(status, message, code, extra) {
        super(message);
        this.status = status;
        this.code = code || null;
        this.extra = extra || null;
    }
}

const fail = (status, message, code, extra) => {
    throw new PaymentError(status, message, code, extra);
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Pagador: só os campos que o gateway precisa, nada além. */
const sanitizePayer = (payer) => {

    const input = payer && typeof payer === "object" ? payer : {};
    const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";

    const out = {};

    if (email && email.length <= 254 && EMAIL.test(email)) out.email = email;

    const first = core.text(input.first_name, 60);
    const last = core.text(input.last_name, 60);

    if (first) out.first_name = first;
    if (last) out.last_name = last;

    const identification = input.identification && typeof input.identification === "object" ? input.identification : null;

    if (identification) {
        const type = String(identification.type || "").toUpperCase();
        const number = String(identification.number || "").replace(/\D/g, "");
        if ((type === "CPF" && number.length === 11) || (type === "CNPJ" && number.length === 14)) {
            out.identification = { type, number };
        }
    }

    return out;
};

/*
 * Recusas que não são do cliente. Boa parte vem da conta que
 * RECEBE (Pix sem chave, conta sem validação, sem permissão),
 * e mandar o cliente "conferir os dados" para sempre não
 * resolve: `ownerAction` marca o que só a empresa resolve.
 */
const REJECTIONS = [
    {
        test: /without key enabled for QR render|key.*not.*found|pix.*key/i,
        code: "MERCADO_PAGO_PIX_SEM_CHAVE",
        ownerAction: true,
        message:
            "O Pix ainda não está liberado na conta Mercado Pago desta empresa. " +
            "O responsável precisa cadastrar uma chave Pix no app do Mercado Pago. " +
            "Enquanto isso, pague com cartão."
    },
    {
        test: /identity|identification.*validat|documenta[cç][aã]o|compliance|kyc/i,
        code: "MERCADO_PAGO_CONTA_NAO_VALIDADA",
        ownerAction: true,
        message:
            "A conta Mercado Pago desta empresa está com a validação de identidade " +
            "pendente e por isso não pode receber. O responsável precisa concluir a " +
            "verificação no Mercado Pago."
    },
    {
        test: /financial identity/i,
        code: "MERCADO_PAGO_PAGADOR_RECUSADO",
        ownerAction: false,
        message:
            "O Mercado Pago não aceitou os dados de quem está pagando. Confira o CPF e o " +
            "nome do titular, ou pague com outro cartão."
    },
    {
        test: /not authorized|unauthorized|forbidden|operator/i,
        code: "MERCADO_PAGO_SEM_PERMISSAO",
        ownerAction: true,
        message:
            "A conta Mercado Pago desta empresa não tem permissão para receber este " +
            "pagamento. O responsável precisa reconectar a conta em Configurações → Pagamentos."
    },
    {
        test: /invalid users involved/i,
        code: "MERCADO_PAGO_MESMA_CONTA",
        ownerAction: false,
        message:
            "Não dá para pagar com a mesma conta Mercado Pago que recebe. " +
            "Use outro e-mail ou outro cartão."
    }
];

const explainPaymentRejection = (reasonText) =>
    REJECTIONS.find((item) => item.test.test(reasonText || "")) || {
        code: "MERCADO_PAGO_REJECTED",
        ownerAction: false,
        message: "O Mercado Pago não aceitou o pagamento. Confira os dados e tente de novo."
    };

/** Estados do gateway → estados do pedido. */
const orderStatusFor = (paymentStatus) => {
    switch (paymentStatus) {
        case "approved":
        case "authorized":
            return "approved";
        case "in_process":
        case "in_mediation":
            return "in_process";
        case "rejected":
        case "cancelled":
        case "refunded":
        case "charged_back":
            return paymentStatus;
        default:
            return "pending";
    }
};

const SETTLED_BACK = ["refunded", "charged_back", "cancelled"];

const BOOKING_CLAIM_TTL_MS = 60000;


/*
 * onUnmatchedPayment(handle, payment): pagamento achado na
 * conta da empresa sem pedido nosso — em geral a cobrança de
 * uma mensalidade. index.js liga isto à sincronização da
 * assinatura, para o aviso "payment" também atualizá-la.
 */
module.exports = ({ admin, connections, provider, notificationUrl, onUnmatchedPayment = null }) => {

    const db = () => admin.database();

    const read = async (path) => (await db().ref(path).once("value")).val();

    const orderRef = (handle, orderId) => db().ref(`companys/${handle}/paymentOrders/${orderId}`);


    /* =================================================
       1. CRIAR
    ================================================= */

    const parseCreate = (body) => {

        const input = body && typeof body === "object" ? body : {};

        if (!core.isHandle(input.companyHandle)) return { error: "Empresa inválida." };
        if (!core.isKey(input.productId)) return { error: "Serviço inválido." };
        if (!core.isKey(input.professionalId)) return { error: "Escolha o profissional." };
        if (!core.isClientId(input.clientId)) return { error: "Identificador do aparelho inválido." };
        if (!core.toDate(input.day, input.hour)) return { error: "Data ou horário inválido." };

        const userName = core.text(input.userName, 80);

        if (!userName) return { error: "Informe seu nome." };

        if (typeof input.paymentMethodId !== "string" || !PAYMENT_METHOD.test(input.paymentMethodId)) {
            return { error: "Método de pagamento não informado." };
        }

        const token = typeof input.token === "string" && input.token ? input.token : null;

        if (token && !CARD_TOKEN.test(token)) return { error: "Os dados do cartão não chegaram. Digite de novo." };

        const installments = Number.parseInt(input.installments, 10);

        const extras = Array.isArray(input.extraProductIds)
            ? [...new Set(input.extraProductIds.filter(core.isKey))].filter((id) => id !== input.productId).slice(0, 6)
            : [];

        return {
            value: {
                handle: input.companyHandle,
                productId: input.productId,
                professionalId: input.professionalId,
                clientId: input.clientId,
                day: input.day,
                hour: input.hour,
                dayLabel: core.text(input.dayLabel, 80) || null,
                userName,
                notes: core.text(input.notes, 300) || null,
                paymentMethodId: input.paymentMethodId,
                token,
                issuerId: input.issuerId !== undefined && input.issuerId !== null && DIGITS.test(String(input.issuerId))
                    ? String(input.issuerId)
                    : null,
                installments: Number.isFinite(installments) && installments >= 1 && installments <= 12 ? installments : 1,
                payer: sanitizePayer(input.payer),
                extraProductIds: extras
            }
        };
    };

    const create = async (body, user) => {

        const parsed = parseCreate(body);

        if (parsed.error) fail(400, parsed.error, "invalid");

        const request = parsed.value;
        const { handle } = request;

        if (!request.payer.email && user.email) request.payer.email = String(user.email).toLowerCase();

        if (!request.payer.email) fail(400, "Informe o e-mail de quem vai pagar.", "payer_email_required");

        await bookings.assertOpen(handle);

        const product = await bookings.readProduct(handle, request.productId);

        if (!product || product.status === "arquivados") fail(404, "Este serviço não está mais disponível.", "product_unavailable");

        if (product.type === "monthly") fail(400, "Mensalidade se assina pelo checkout da assinatura.", "monthly_product");

        if (!core.relatedIds(product).includes(request.professionalId)) {
            fail(400, "Este profissional não atende este serviço.", "professional_invalid");
        }

        const extras = (await Promise.all(request.extraProductIds.map((id) => bookings.readProduct(handle, id))))
            .filter((item) =>
                item &&
                item.status !== "arquivados" &&
                item.type !== "monthly" &&
                item.type !== "combo" &&
                Number(item.duration) > 0 &&
                core.relatedIds(item).includes(request.professionalId)
            );

        /* O mesmo total que a tela mostra (ProductDetails →
           Checkout): promoção válida + extras. */
        const amount = Math.round(
            (core.effectivePrice(product) + extras.reduce((sum, item) => sum + core.effectivePrice(item), 0)) * 100
        ) / 100;

        if (!(amount > 0)) fail(400, "Este serviço está sem valor. Avise a empresa.", "invalid_price");

        const connection = await connections.load(handle);

        if (!connections.isUsable(connection)) {
            fail(400, "Esta empresa ainda não ativou pagamentos online pelo Mercado Pago.", "not_connected", { ownerAction: true });
        }

        /* Antes de cobrar: horário tomado não vira pagamento. */
        const duration = (Number(product.duration) || 30) + extras.reduce((sum, item) => sum + (Number(item.duration) || 0), 0);

        if (!(await bookings.slotFree(handle, { professionalId: request.professionalId, day: request.day, hour: request.hour, duration }))) {
            fail(409, "Este horário acabou de ser reservado. Escolha outro.", "slot_taken");
        }

        const ref = db().ref(`companys/${handle}/paymentOrders`).push();
        const orderId = ref.key;
        const now = Date.now();

        await ref.set({
            id: orderId,
            provider: provider.id,
            status: "pending",
            companyHandle: handle,
            userId: user.uid,
            clientId: request.clientId,
            productId: request.productId,
            productName: core.text(product.name, 120) || null,
            productPrice: amount,
            amount,
            extraProductIds: extras.length ? extras.map((item) => item.id) : null,
            professionalId: request.professionalId,
            professionalName: core.text(body.professionalName, 80) || null,
            day: request.day,
            dayLabel: request.dayLabel,
            hour: request.hour,
            userName: request.userName,
            /* Recado do cliente: fica aqui porque o agendamento
               só nasce quando o pagamento é aprovado. */
            notes: request.notes,
            paymentMethodId: request.paymentMethodId,
            createdAt: now
        });

        const paymentBody = {
            transaction_amount: amount,
            description: core.text(product.name, 120) || "Agendamento Markfy",
            payment_method_id: request.paymentMethodId,
            external_reference: orderId,
            /* source_news=webhooks: só Webhooks (assinados), sem
               o IPN antigo. `company` só diz com qual token
               conferir. */
            notification_url: `${notificationUrl}?source_news=webhooks&company=${encodeURIComponent(handle)}`,
            payer: request.payer,
            /* Nada de nome, telefone ou recado do cliente aqui:
               metadata vai para o Mercado Pago. */
            metadata: { company_handle: handle, order_id: orderId, product_id: request.productId }
        };

        if (request.token) paymentBody.token = request.token;
        if (request.issuerId) paymentBody.issuer_id = request.issuerId;
        if (request.token) paymentBody.installments = request.installments;

        let result;

        try {
            result = await connections.withSeller(handle, (token) =>
                provider.createPayment(token, paymentBody, orderId), { connection });
        } catch (error) {
            await ref.update({ status: "error", error: error.code || "connection_error", updatedAt: Date.now() });
            if (error.code === "reconnect_required" || error.code === "not_connected") {
                fail(502, "A conta Mercado Pago desta empresa precisa ser conectada novamente.", "MERCADO_PAGO_AUTH_ERROR", { ownerAction: true });
            }
            throw error;
        }

        if (result.network) {
            await ref.update({ status: "error", error: "network", updatedAt: Date.now() });
            fail(503, "Não foi possível falar com o Mercado Pago agora. Nada foi cobrado. Tente de novo.", "network");
        }

        if (!result.ok || !result.data || !result.data.id) {

            const reasonText = provider.reason(result.data);
            const explained = explainPaymentRejection(reasonText);

            await ref.update({
                status: "error",
                error: reasonText.slice(0, 300) || explained.code,
                mercadoPagoHttpStatus: result.status,
                updatedAt: Date.now()
            });

            /* Só status e código: o corpo pode trazer dados do pagador. */
            console.error("payments: pagamento recusado", handle, result.status, explained.code);

            if (explained.ownerAction) {
                await connections.recordFailure(handle, { kind: "payment", code: explained.code });
            }

            /* `details`: o texto do próprio Mercado Pago, que o
               checkout mostra quando a recusa é do cliente. */
            fail(explained.ownerAction ? 502 : 400, explained.message, explained.code, {
                ownerAction: explained.ownerAction,
                details: reasonText.slice(0, 200) || null
            });
        }

        const payment = provider.toPayment(result.data);

        await ref.update({
            mercadoPagoPaymentId: payment.id,
            mercadoPagoStatus: payment.status || "pending",
            paymentStatusDetail: payment.statusDetail,
            paymentMethodId: payment.methodId || request.paymentMethodId,
            updatedAt: Date.now()
        });

        /* Cartão aprovado na hora: agenda já, sem depender do
           webhook chegar. Se algo falhar aqui, o pagamento já
           existe — nunca devolver erro ao cliente que pagou:
           o webhook e a tela de espera terminam o agendamento. */
        const confirmed = await confirm(handle, orderId, payment).catch((error) => {
            console.error("payments: confirmação adiada para o webhook", handle, orderId, error.message);
            return { status: orderStatusFor(payment.status), booking: null };
        });

        return {
            paymentId: orderId,
            mercadoPagoPaymentId: payment.id,
            status: payment.status,
            statusDetail: payment.statusDetail,
            paymentMethodId: payment.methodId || request.paymentMethodId,
            pix: payment.pix,
            orderStatus: confirmed.status,
            booking: confirmed.booking || null
        };
    };


    /* =================================================
       2. CONFIRMAR (idempotente)
    ================================================= */

    const claimBooking = async (handle, orderId, now) => {

        const result = await orderRef(handle, orderId).child("booking").transaction((current) => {
            if (current && (current.status === "booked" || current.status === "failed")) return undefined;
            if (current && current.status === "processing" && Number(current.at) > now - BOOKING_CLAIM_TTL_MS) return undefined;
            return { status: "processing", at: now };
        });

        return result.committed && (result.snapshot.val() || {}).at === now;
    };

    const bookOnce = async (handle, orderId, order, payment) => {

        const now = Date.now();

        /* Pedido antigo, agendado pelo webhook anterior. */
        if (order.scheduleCreated === true) return { status: "booked", scheduleId: order.scheduleId || null };

        if (!(await claimBooking(handle, orderId, now))) {
            return (await read(`companys/${handle}/paymentOrders/${orderId}/booking`)) || { status: "processing" };
        }

        try {

            const created = await bookings.createBooking(
                {
                    handle,
                    productId: order.productId,
                    professionalId: order.professionalId,
                    clientId: core.isClientId(order.clientId) ? order.clientId : crypto.randomUUID(),
                    day: order.day,
                    hour: order.hour,
                    dayLabel: order.dayLabel || undefined,
                    userName: order.userName,
                    notes: order.notes || undefined,
                    extraProductIds: order.extraProductIds || undefined,
                    source: "payment"
                },
                order.userId || null,
                { payment: { orderId, paymentId: payment.id, amount: payment.amount } }
            );

            const booking = { status: "booked", scheduleId: created.scheduleId, at: Date.now() };

            await orderRef(handle, orderId).update({
                status: "paid",
                scheduleCreated: true,
                scheduleId: created.scheduleId,
                booking,
                updatedAt: Date.now()
            });

            return booking;

        } catch (error) {

            if (!(error instanceof bookings.BookingError)) {
                /* Falha passageira: libera para o próximo aviso tentar. */
                await orderRef(handle, orderId).child("booking").set({ status: "retry", at: Date.now() });
                throw error;
            }

            /* Pago, mas sem horário: a empresa precisa agir. */
            const booking = {
                status: "failed",
                code: error.code || "booking_failed",
                message: error.message || "Não foi possível reservar o horário escolhido.",
                at: Date.now()
            };

            await orderRef(handle, orderId).update({ status: "needs_attention", booking, updatedAt: Date.now() });

            console.error("payments: pago e sem agendamento", handle, orderId, booking.code);

            return booking;
        }
    };

    /**
     * Aplica o estado de um pagamento lido do gateway. Pode
     * rodar quantas vezes for: só avança o que ainda não
     * aconteceu.
     */
    const confirm = async (handle, orderId, payment) => {

        const ref = orderRef(handle, orderId);
        const order = (await ref.once("value")).val();

        if (!order) return { status: "unknown_order" };

        /* Nunca aplica o pagamento de outro pedido. */
        if (payment.externalReference !== orderId) {
            console.error("payments: referência não confere", handle, orderId);
            return { status: "mismatch" };
        }

        const now = Date.now();
        const next = orderStatusFor(payment.status);

        const patch = {
            mercadoPagoPaymentId: payment.id,
            mercadoPagoStatus: payment.status,
            paymentStatusDetail: payment.statusDetail || null,
            updatedAt: now
        };

        if (payment.methodId) patch.paymentMethodId = payment.methodId;

        if (next !== "approved") {

            /* "paid" só sai por estorno, chargeback ou cancelamento. */
            if (!(order.status === "paid" || order.status === "needs_attention") || SETTLED_BACK.includes(next)) {
                patch.status = next;
            }

            await ref.update(patch);

            if (order.scheduleId && SETTLED_BACK.includes(next)) {
                await db().ref(`companys/${handle}/schedules/${order.scheduleId}`).update({
                    paymentStatus: next,
                    paymentUpdatedAt: now
                });
            }

            return { status: patch.status || order.status, booking: order.booking || null };
        }

        /* Valor diferente do pedido: não agenda. */
        const expected = Number(order.amount !== undefined && order.amount !== null ? order.amount : order.productPrice);

        if (!(Math.abs(Number(payment.amount) - expected) < 0.01) || (payment.currency && payment.currency !== "BRL")) {

            await ref.update({ ...patch, status: "needs_attention", problem: { code: "amount_mismatch", at: now } });

            console.error("payments: valor não confere", handle, orderId);

            return { status: "needs_attention", problem: "amount_mismatch" };
        }

        if (!order.paidAt) patch.paidAt = payment.approvedAt || now;
        if (order.status !== "paid" && order.status !== "needs_attention") patch.status = "approved";

        await ref.update(patch);

        const booking = await bookOnce(handle, orderId, order, payment);

        return {
            status: booking.status === "booked" ? "paid" : booking.status === "failed" ? "needs_attention" : "approved",
            booking
        };
    };


    /* =================================================
       3. AVISOS DO GATEWAY (webhook) E TELA DE ESPERA
    ================================================= */

    /**
     * true quando o pagamento era desta empresa (achou ou não
     * pedido); false quando o token desta empresa não enxerga
     * o pagamento (é de outra conta).
     */
    const tryCompany = async (handle, paymentId) => {

        let result;

        try {
            result = await connections.withSeller(handle, (token) => provider.getPayment(token, paymentId));
        } catch (error) {
            if (error.code === "not_connected" || error.code === "reconnect_required") return false;
            throw error;
        }

        if (result.network) throw new Error("Mercado Pago sem resposta");
        if (!result.ok) return false;

        const payment = provider.toPayment(result.data);

        const order = payment.externalReference && core.isKey(payment.externalReference)
            ? await read(`companys/${handle}/paymentOrders/${payment.externalReference}/id`)
            : null;

        if (order) {
            await confirm(handle, payment.externalReference, payment);
        } else if (onUnmatchedPayment) {
            await onUnmatchedPayment(handle, payment);
        }

        /* Achou na conta desta empresa: é dela, com ou sem
           pedido (cobrança de mensalidade, venda de fora). */
        return true;
    };

    const handleNotification = async ({ id, sellerId, companyHint }) => {

        if (!id) return false;

        const tried = new Set();

        const candidates = [
            companyHint,
            ...(await connections.handlesForSeller(sellerId))
        ].filter((handle) => handle && core.isHandle(handle));

        for (const handle of candidates) {
            if (tried.has(handle)) continue;
            tried.add(handle);
            if (await tryCompany(handle, id)) return true;
        }

        /* Aviso sem dica (antigo): confere com cada empresa conectada. */
        for (const handle of await connections.connectedHandles()) {
            if (tried.has(handle)) continue;
            tried.add(handle);
            if (await tryCompany(handle, id)) return true;
        }

        console.warn("payments: pagamento sem empresa conhecida", id);
        return false;
    };

    /** Tela de espera do cliente: pergunta ao gateway em vez de só esperar o webhook. */
    const sync = async (handle, orderId, uid) => {

        if (!core.isHandle(handle) || !core.isKey(orderId)) fail(400, "Dados inválidos.", "invalid");

        const order = await read(`companys/${handle}/paymentOrders/${orderId}`);
        const member = uid ? await read(`companys/${handle}/members/${uid}`) : null;

        /* Mesma resposta para "não existe" e "não é seu". */
        if (!order || (order.userId !== uid && !member)) fail(404, "Pagamento não encontrado.", "not_found");

        const view = (current) => ({
            paymentId: orderId,
            status: current.status,
            booking: current.booking
                ? { status: current.booking.status, scheduleId: current.booking.scheduleId || null, code: current.booking.code || null, message: current.booking.message || null }
                : null
        });

        if (!order.mercadoPagoPaymentId || ["paid", "needs_attention", "refunded", "charged_back"].includes(order.status)) {
            return view(order);
        }

        try {

            const result = await connections.withSeller(handle, (token) => provider.getPayment(token, order.mercadoPagoPaymentId));

            if (result.ok) await confirm(handle, orderId, provider.toPayment(result.data));

        } catch (error) {
            if (error.code !== "not_connected" && error.code !== "reconnect_required") throw error;
        }

        return view(await read(`companys/${handle}/paymentOrders/${orderId}`));
    };

    /*
     * Rotina diária: pedidos ainda em aberto dos últimos dias
     * são conferidos no gateway. É a garantia para quando o
     * webhook não chega (URL não configurada, assinatura
     * secreta errada) e a pessoa fechou a tela do Pix.
     */
    const OPEN_ORDER = ["pending", "in_process", "approved"];

    const syncPending = async ({ maxAgeMs = 3 * 24 * 60 * 60 * 1000, now = Date.now() } = {}) => {

        const summary = { checked: 0, confirmed: 0, errors: 0 };

        for (const handle of await connections.connectedHandles()) {

            const orders = (await db()
                .ref(`companys/${handle}/paymentOrders`)
                .orderByChild("createdAt")
                .startAt(now - maxAgeMs)
                .once("value")).val() || {};

            for (const [orderId, order] of Object.entries(orders)) {

                if (!order || !order.mercadoPagoPaymentId || !OPEN_ORDER.includes(order.status)) continue;

                try {
                    summary.checked += 1;
                    const result = await connections.withSeller(handle, (token) => provider.getPayment(token, order.mercadoPagoPaymentId));
                    if (!result.ok) continue;
                    const outcome = await confirm(handle, orderId, provider.toPayment(result.data));
                    if (outcome.status === "paid") summary.confirmed += 1;
                } catch (error) {
                    summary.errors += 1;
                    console.error("payments: conferência diária falhou", handle, orderId, error.code || error.message);
                }
            }
        }

        return summary;
    };


    return { create, confirm, handleNotification, sync, syncPending, parseCreate };
};

module.exports.PaymentError = PaymentError;
module.exports.explainPaymentRejection = explainPaymentRejection;
module.exports.orderStatusFor = orderStatusFor;
module.exports.sanitizePayer = sanitizePayer;
