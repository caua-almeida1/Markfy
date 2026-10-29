/* =====================================================
   MARKFY — MENSALIDADES (MERCADO PAGO PREAPPROVAL)

   subscriptionsApi recebe { action, ... }:

     create  assina (cartão ou conta Mercado Pago)
     sync    lê o estado no Mercado Pago e atualiza o espelho
     cancel  encerra (respeita fidelidade, aviso prévio e o
             direito de arrependimento de 7 dias)

   Mais duas entradas sem navegador:

     handleNotification   chamada pelo mercadoPagoWebhook
     subscriptionsDailySync  todo dia: sincroniza, executa
                          cancelamentos agendados e apaga
                          tentativas abandonadas

   O webhook é o caminho rápido; a sincronização diária e o
   `sync` da tela de retorno são a garantia. Se a URL de
   notificação não estiver configurada no Mercado Pago, as
   telas continuam corretas — só demoram mais a perceber.

   ATENÇÃO: o Admin SDK ignora as regras do banco. Toda
   autorização está aqui.

   Regras de negócio puras: subscriptions-core.js.
===================================================== */

const { onRequest } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const crypto = require("crypto");

const core = require("./subscriptions-core");
const bookings = require("./bookings");

const bookingsCore = bookings.bookingsCore;

const MP_API = "https://api.mercadopago.com";
const FRONTEND_URL = "https://markfy.vercel.app";

class SubscriptionError extends Error {
    constructor(status, message, code, extra) {
        super(message);
        this.status = status;
        this.code = code || null;
        this.extra = extra || null;
    }
}

const fail = (status, message, code, extra) => {
    throw new SubscriptionError(status, message, code, extra);
};


module.exports = ({ admin, secrets, refreshAccessToken, loadCompaniesChildren }) => {

    const db = () => admin.database();

    const read = async (path) => (await db().ref(path).once("value")).val();

    const subscriptionRef = (handle, id) => db().ref(`companys/${handle}/subscriptions/${id}`);

    const indexRef = (preapprovalId) => db().ref(`subscriptionsIndex/${preapprovalId}`);


    /* -------------------------------------------------
       MERCADO PAGO
    ------------------------------------------------- */

    const mpFetch = async (token, path, { method = "GET", body, idempotency } = {}) => {

        const headers = { Authorization: `Bearer ${token}` };

        if (body) headers["Content-Type"] = "application/json";
        if (idempotency) headers["X-Idempotency-Key"] = idempotency;

        const response = await fetch(`${MP_API}${path}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : undefined
        });

        const data = await response.json().catch(() => ({}));

        return { ok: response.ok, status: response.status, data };
    };

    const loadConnection = async (handle) => {

        const connection = await read(`mercadoPagoConnections/${handle}`);

        return connection && connection.connected && connection.accessToken ? connection : null;
    };

    const credentialRefused = (result) =>
        result.status === 401 || /invalid.*(token|credential)|credential/i.test((result.data && result.data.message) || "");

    /**
     * Chama o Mercado Pago com o token da empresa. Renova antes
     * se o token já venceu, e uma vez depois se for recusado.
     */
    const asSeller = async (handle, call, connection = null) => {

        let current = connection || await loadConnection(handle);

        if (!current) fail(400, "Esta empresa ainda não conectou o Mercado Pago.", "not_connected");

        if (current.refreshToken && Number(current.expiresAt) && Number(current.expiresAt) < Date.now() + 60000) {
            current = await refreshAccessToken(handle, current).catch(() => current);
        }

        let result = await call(current.accessToken);

        if (credentialRefused(result) && current.refreshToken) {
            current = await refreshAccessToken(handle, current);
            result = await call(current.accessToken);
        }

        return result;
    };


    /* -------------------------------------------------
       QUEM CHAMA
    ------------------------------------------------- */

    const resolveUser = async (req) => {

        const authorization = req.headers.authorization || "";

        if (!authorization.startsWith("Bearer ")) {
            fail(401, "Entre na sua conta para continuar.", "login_required");
        }

        try {
            return await admin.auth().verifyIdToken(authorization.replace("Bearer ", ""));
        } catch {
            fail(401, "Sessão inválida. Entre de novo.", "login_required");
        }

        return null;
    };

    /** Dono da assinatura, ou alguém da equipe da empresa. */
    const loadOwned = async (handle, subscriptionId, uid) => {

        if (!bookingsCore.isHandle(handle) || !bookingsCore.isKey(subscriptionId)) {
            fail(400, "Dados inválidos.", "invalid");
        }

        const [subscription, member] = await Promise.all([
            read(`companys/${handle}/subscriptions/${subscriptionId}`),
            read(`companys/${handle}/members/${uid}`)
        ]);

        /* Mesma resposta para "não existe" e "não é sua". */
        if (!subscription || (subscription.uid !== uid && !member)) {
            fail(404, "Assinatura não encontrada.", "not_found");
        }

        return { subscription, by: subscription.uid === uid ? "client" : "company" };
    };


    /* -------------------------------------------------
       ÍNDICE preapproval → assinatura

       Sem ele, o webhook precisava varrer todas as empresas
       para achar de quem era uma notificação. Assinaturas
       antigas (sem índice) caem na varredura e entram no
       índice na primeira vez.
    ------------------------------------------------- */

    const writeIndex = (preapprovalId, handle, subscriptionId, status) =>
        indexRef(preapprovalId).set({
            handle,
            subscriptionId,
            open: status !== core.STATUS.CANCELLED,
            updatedAt: Date.now()
        });

    const findByPreapproval = async (preapprovalId) => {

        const indexed = await read(`subscriptionsIndex/${preapprovalId}`);

        if (indexed && indexed.handle && indexed.subscriptionId) {
            const subscription = await read(`companys/${indexed.handle}/subscriptions/${indexed.subscriptionId}`);
            if (subscription) return { handle: indexed.handle, id: indexed.subscriptionId, subscription };
        }

        const companies = await loadCompaniesChildren(["subscriptions"]);

        for (const [handle, company] of Object.entries(companies)) {
            for (const [id, subscription] of Object.entries((company && company.subscriptions) || {})) {
                if (subscription && String(subscription.mercadoPagoPreapprovalId) === String(preapprovalId)) {
                    await writeIndex(preapprovalId, handle, id, subscription.status).catch(() => {});
                    return { handle, id, subscription };
                }
            }
        }

        return null;
    };


    /* -------------------------------------------------
       PRIMEIRO ATENDIMENTO

       O horário escolhido antes de pagar vira agendamento só
       com a assinatura autorizada — e uma vez só: o webhook,
       a resposta da criação e a tela de retorno podem chegar
       juntos, e só quem tirar "waiting" numa transação cria.
       Quem confere horário livre, profissional e antecedência
       é a mesma bookingsApi de sempre.
    ------------------------------------------------- */

    const activateFirstBooking = async (handle, subscriptionId) => {

        const ref = subscriptionRef(handle, subscriptionId);

        let claimed = false;

        await ref.child("firstBooking/status").transaction((status) => {
            if (status !== "waiting") return undefined;
            claimed = true;
            return "processing";
        });

        if (!claimed) return null;

        const subscription = (await ref.once("value")).val() || {};
        const request = (subscription.firstBooking && subscription.firstBooking.request) || {};

        try {

            const result = await bookings.createBooking(
                {
                    handle,
                    productId: subscription.productId,
                    professionalId: request.professionalId,
                    clientId: bookingsCore.isClientId(subscription.clientId)
                        ? subscription.clientId
                        : crypto.randomUUID(),
                    day: request.day,
                    hour: request.hour,
                    dayLabel: request.dayLabel || undefined,
                    userName: subscription.userName,
                    notes: request.notes || undefined,
                    subscriptionId,
                    source: "subscription"
                },
                subscription.uid,
                { fromSubscription: true }
            );

            await ref.child("firstBooking").update({
                status: "booked",
                scheduleId: result.scheduleId,
                code: null,
                message: null,
                at: Date.now()
            });

            return result.scheduleId;

        } catch (error) {

            /* A assinatura continua valendo; a pessoa só precisa
               escolher outro horário (a tela avisa). */
            await ref.child("firstBooking").update({
                status: "failed",
                code: error.code || "booking_failed",
                message: error.message || "Não foi possível reservar o horário escolhido.",
                at: Date.now()
            });

            return null;
        }
    };


    /* -------------------------------------------------
       COBRANÇAS (authorized_payments)
    ------------------------------------------------- */

    /** Lê as cobranças da assinatura no Mercado Pago e grava no espelho. */
    const recordCharges = async (handle, subscriptionId, preapprovalId, token, invoices = null) => {

        let list = invoices;

        if (!list) {

            const result = await mpFetch(
                token,
                `/authorized_payments/search?preapproval_id=${encodeURIComponent(preapprovalId)}&limit=50`
            );

            list = result.ok && Array.isArray(result.data.results) ? result.data.results : [];
        }

        const patch = {};
        const now = Date.now();

        list.forEach((invoice) => {
            if (invoice && invoice.id) patch[String(invoice.id)] = core.chargeRecord(invoice, now);
        });

        if (Object.keys(patch).length) {
            await subscriptionRef(handle, subscriptionId).child("charges").update(patch);
        }

        return patch;
    };


    /* -------------------------------------------------
       SINCRONIZAR
    ------------------------------------------------- */

    const syncOne = async (handle, subscriptionId, { invoices = null } = {}) => {

        const ref = subscriptionRef(handle, subscriptionId);
        const local = (await ref.once("value")).val();

        if (!local || !local.mercadoPagoPreapprovalId) return local;

        const preapprovalId = String(local.mercadoPagoPreapprovalId);

        let token = null;

        const lido = await asSeller(handle, async (accessToken) => {
            token = accessToken;
            return mpFetch(accessToken, `/preapproval/${encodeURIComponent(preapprovalId)}`);
        });

        if (!lido.ok) {
            console.warn("subscriptions: preapproval ilegível", handle, lido.status);
            return local;
        }

        const charges = await recordCharges(handle, subscriptionId, preapprovalId, token, invoices)
            .catch(() => ({}));

        const merged = { ...local, charges: { ...(local.charges || {}), ...charges } };

        const patch = core.syncPatch(merged, lido.data);

        const last = core.latestSettledCharge(merged.charges);

        if (last) {
            patch.lastChargeStatus = last.status;
            patch.lastChargeAt = last.chargedAt || null;
            if (last.paid) patch.lastPaidAt = last.chargedAt || Date.now();
        }

        await ref.update(patch);
        await writeIndex(preapprovalId, handle, subscriptionId, patch.status || local.status).catch(() => {});

        if (patch.status === core.STATUS.ACTIVE || patch.status === core.STATUS.PAST_DUE) {
            await activateFirstBooking(handle, subscriptionId);
        }

        return (await ref.once("value")).val();
    };


    /* -------------------------------------------------
       AGENDAMENTOS QUE A ASSINATURA NÃO COBRE MAIS

       Depois de cancelar, os horários marcados para depois do
       fim do acesso são desmarcados — senão o profissional
       guardaria um horário que ninguém pagou.
    ------------------------------------------------- */

    const cancelBookingsFrom = async (handle, uid, subscriptionId, fromMs) => {

        const schedules = await bookings.schedulesWhere(handle, "userId", uid);
        const updates = {};
        const at = new Date().toISOString();

        Object.entries(schedules).forEach(([id, item]) => {

            if (!item || item.subscriptionId !== subscriptionId) return;
            if (bookingsCore.isCancelled(item.status) || item.status === "completed") return;

            const date = bookingsCore.toDate(item.day, item.hour);

            if (date && date.getTime() >= fromMs) {
                updates[`${id}/status`] = "cancelados";
                updates[`${id}/cancelledAt`] = at;
                updates[`${id}/cancelledBy`] = "subscription";
            }
        });

        if (Object.keys(updates).length) {
            await db().ref(`companys/${handle}/schedules`).update(updates);
        }

        return Object.keys(updates).length / 3;
    };

    const cancelAtMercadoPago = async (handle, preapprovalId) => {

        if (!preapprovalId) return { ok: true };

        return asSeller(handle, (token) =>
            mpFetch(token, `/preapproval/${encodeURIComponent(preapprovalId)}`, {
                method: "PUT",
                body: { status: "cancelled" }
            })
        );
    };

    /** Estorna as cobranças aprovadas dos últimos 7 dias (arrependimento). */
    const refundWithdrawal = async (handle, subscription) => {

        const preapprovalId = String(subscription.mercadoPagoPreapprovalId || "");
        const since = Number(subscription.startedAt) - core.DAY_MS;

        let refunded = 0;
        let failed = 0;

        await asSeller(handle, async (token) => {

            const result = await mpFetch(
                token,
                `/authorized_payments/search?preapproval_id=${encodeURIComponent(preapprovalId)}&limit=50`
            );

            if (result.status === 401) return result;

            const invoices = result.ok && Array.isArray(result.data.results) ? result.data.results : [];

            for (const invoice of invoices) {

                const record = core.chargeRecord(invoice);

                if (!record.paid || !record.paymentId || (record.chargedAt && record.chargedAt < since)) continue;

                const refund = await mpFetch(token, `/v1/payments/${encodeURIComponent(record.paymentId)}/refunds`, {
                    method: "POST",
                    body: {},
                    idempotency: core.idempotencyKey("withdrawal", record.paymentId)
                });

                if (refund.ok) refunded += record.amount || 0;
                else failed += 1;
            }

            return result;
        });

        return { refunded: Math.round(refunded * 100) / 100, failed };
    };


    /* =================================================
       AÇÕES
    ================================================= */

    const LOCK_TTL_MS = 30000;

    const create = async (body, user, req) => {

        const parsed = core.parseSubscribe(body);

        if (parsed.error) fail(400, parsed.error, "invalid");

        const request = parsed.value;
        const { handle, productId } = request;
        const uid = user.uid;

        const access = await read(`publicAccess/${handle}`);

        if (!bookingsCore.isBookingsOpen(access)) {
            fail(403, "Esta empresa não está recebendo assinaturas pela Markfy no momento.", "company_unavailable");
        }

        /* Produto lido campo a campo (há produtos com imagem
           base64 de mais de 1 MB dentro do banco). */
        const [name, type, status, value, discountedPrice, monthlyPlan, relatedUsers] = await Promise.all(
            ["name", "type", "status", "value", "discountedPrice", "monthlyPlan", "relatedUsers"]
                .map((field) => read(`companys/${handle}/products/${productId}/${field}`))
        );

        const product = { name, type, status, value, discountedPrice, monthlyPlan, relatedUsers };

        if (!type || status === "arquivados") fail(404, "Este plano não está mais disponível.", "product_unavailable");

        const plan = core.planOf(product);

        if (!plan) fail(400, "Este produto não é uma mensalidade.", "not_monthly");
        if (!(plan.price > 0)) fail(400, "Este plano está sem valor. Avise a empresa.", "invalid_price");

        if (request.booking && !bookingsCore.relatedIds(product).includes(request.booking.professionalId)) {
            fail(400, "Este profissional não atende este plano. Escolha outro.", "professional_invalid");
        }

        const connection = await loadConnection(handle);

        if (!connection) {
            fail(400, "Esta empresa ainda não ativou pagamentos online pelo Mercado Pago.", "not_connected", { ownerAction: true });
        }

        const subscriptionId = `${uid}_${productId}`;
        const ref = subscriptionRef(handle, subscriptionId);

        /* Dois cliques (ou duas abas) não criam duas cobranças. */
        const lockRef = db().ref(`subscriptionLocks/${handle}/${subscriptionId}`);
        const owner = crypto.randomBytes(8).toString("hex");
        const lockAt = Date.now();

        const lock = await lockRef.transaction((current) => {
            if (current && Number(current.at) > lockAt - LOCK_TTL_MS) return undefined;
            return { at: lockAt, owner };
        });

        if (!lock.committed || (lock.snapshot.val() || {}).owner !== owner) {
            fail(409, "Sua assinatura já está sendo processada. Aguarde alguns segundos.", "busy");
        }

        try {

            const existing = (await ref.once("value")).val();

            if (existing && bookingsCore.isSubscriptionUsable(existing) && existing.status !== core.STATUS.CANCELLED) {
                fail(409, "Você já assina este plano.", "already_active");
            }

            if (existing && existing.status === core.STATUS.PAUSED) {
                fail(409, "Sua assinatura deste plano está pausada no Mercado Pago. Reative por lá ou cancele antes de assinar de novo.", "paused");
            }

            /* Tentativa anterior que ficou pela metade: encerra lá
               antes de abrir outra. */
            if (existing && existing.status === core.STATUS.PENDING && existing.mercadoPagoPreapprovalId) {
                await cancelAtMercadoPago(handle, existing.mercadoPagoPreapprovalId).catch(() => null);
                await indexRef(existing.mercadoPagoPreapprovalId).remove().catch(() => {});
            }

            /* Assinatura antiga já encerrada: o histórico (aceite e
               cobranças) é registro fiscal e prova do contrato, e
               não pode sumir ao assinar de novo. */
            if (existing && existing.status === core.STATUS.CANCELLED) {
                await db()
                    .ref(`companys/${handle}/subscriptionHistory/${subscriptionId}/${Number(existing.createdAt) || Date.now()}`)
                    .set(existing);
            }

            const now = Date.now();

            const preapproval = core.buildPreapprovalBody({
                productName: name,
                plan,
                subscriptionId,
                payerEmail: request.payerEmail,
                method: request.method,
                cardTokenId: request.cardTokenId,
                backUrl: `${FRONTEND_URL}/assinatura/retorno?empresa=${encodeURIComponent(handle)}`,
                now
            });

            let token = connection.accessToken;

            const result = await asSeller(handle, (accessToken) => {
                token = accessToken;
                return mpFetch(accessToken, "/preapproval", {
                    method: "POST",
                    body: preapproval,
                    idempotency: core.idempotencyKey("preapproval", subscriptionId, request.method, request.cardTokenId || now)
                });
            }, connection);

            if (!result.ok || !result.data || !result.data.id) {

                const reason = core.mercadoPagoReason(result.data);
                const explained = core.explainRejection(reason, JSON.stringify((result.data && result.data.cause) || ""));

                /* Só status e motivo: a resposta inteira pode trazer o
                   e-mail do pagador. */
                console.error("subscriptions: preapproval recusada", handle, result.status, explained.code, reason.slice(0, 300));

                fail(explained.ownerAction ? 502 : 400, explained.message, explained.code, {
                    ownerAction: explained.ownerAction
                });
            }

            const mp = result.data;
            const mpStatus = mp.status === core.STATUS.ACTIVE ? core.STATUS.ACTIVE : core.STATUS.PENDING;

            const record = {
                id: subscriptionId,
                uid,
                clientId: request.clientId,
                companyHandle: handle,
                productId,
                productName: bookingsCore.text(name, 120) || null,
                userName: request.userName,
                payerEmail: request.payerEmail,
                method: request.method,

                mercadoPagoPreapprovalId: String(mp.id),
                status: mpStatus,

                price: plan.price,
                currency: plan.currency,
                billingCycle: plan.billingCycle,
                unlimitedSessions: plan.unlimitedSessions,
                sessionsPerCycle: plan.sessionsPerCycle,
                autoRenew: plan.autoRenew,
                trialDays: plan.trialDays,
                loyaltyMonths: plan.loyaltyMonths,
                cancellationNoticeDays: plan.cancellationNoticeDays,

                consent: core.consentRecord({ plan, method: request.method, now }),

                firstBooking: request.booking
                    ? { status: "waiting", request: request.booking }
                    : null,

                startedAt: mpStatus === core.STATUS.ACTIVE ? now : null,
                nextBillingAt: mp.next_payment_date
                    ? new Date(mp.next_payment_date).getTime() || core.firstChargeAt(plan, now)
                    : core.firstChargeAt(plan, now),

                accessUntil: null,
                cancelScheduledFor: null,
                charges: null,

                createdAt: now,
                updatedAt: now
            };

            await ref.set(record);
            await writeIndex(String(mp.id), handle, subscriptionId, mpStatus);

            if (mpStatus === core.STATUS.ACTIVE) {
                await activateFirstBooking(handle, subscriptionId);
            }

            const saved = (await ref.once("value")).val();

            return {
                ...core.publicView(subscriptionId, saved),
                redirectUrl: mpStatus === core.STATUS.PENDING
                    ? mp.init_point || mp.sandbox_init_point || null
                    : null
            };

        } finally {
            await lockRef.remove().catch(() => {});
        }
    };


    const sync = async (body, user) => {

        const { handle, subscriptionId } = body;

        await loadOwned(handle, subscriptionId, user.uid);

        const updated = await syncOne(handle, subscriptionId);

        return core.publicView(subscriptionId, updated);
    };


    const cancel = async (body, user) => {

        const { handle, subscriptionId } = body;
        const withdrawal = body.withdrawal === true;

        const { subscription, by } = await loadOwned(handle, subscriptionId, user.uid);
        const ref = subscriptionRef(handle, subscriptionId);
        const now = Date.now();

        const decision = core.cancellationDecision(subscription, { by, withdrawal, now });

        if (decision.error) fail(409, decision.error, "not_cancellable");

        if (decision.blocked === "loyalty") {
            fail(
                409,
                `Este plano tem permanência mínima até ${new Date(decision.loyaltyEndsAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}. Fale com a empresa se precisar sair antes.`,
                "loyalty",
                { loyaltyEndsAt: decision.loyaltyEndsAt }
            );
        }

        /* Aviso prévio que passa da próxima cobrança: ela ainda
           acontece, e a sincronização diária cancela na data. */
        if (decision.mode === "scheduled") {

            await ref.update({
                cancelScheduledFor: decision.cancelAt,
                cancellationRequestedAt: now,
                cancellationRequestedBy: by,
                updatedAt: now
            });

            return core.publicView(subscriptionId, (await ref.once("value")).val());
        }

        const result = await cancelAtMercadoPago(handle, subscription.mercadoPagoPreapprovalId);

        /* Nunca "cancelado" aqui com a cobrança seguindo lá. */
        if (!result.ok && !/cancel/i.test(core.mercadoPagoReason(result.data))) {
            console.error("subscriptions: cancelamento recusado", handle, result.status);
            fail(502, "O Mercado Pago não confirmou o cancelamento. Tente de novo em instantes.", "mp_cancel_failed");
        }

        const patch = {
            status: core.STATUS.CANCELLED,
            cancelledAt: now,
            cancelledBy: by,
            accessUntil: decision.accessUntil,
            cancelScheduledFor: null,
            updatedAt: now
        };

        let refund = null;

        if (decision.mode === "withdrawal") {

            refund = await refundWithdrawal(handle, subscription).catch((error) => {
                console.error("subscriptions: estorno do arrependimento falhou", handle, error.message);
                return { refunded: 0, failed: 1 };
            });

            patch.withdrawal = {
                requestedAt: now,
                refunded: refund.refunded,
                refundFailed: refund.failed > 0
            };
        }

        await ref.update(patch);

        if (subscription.mercadoPagoPreapprovalId) {
            await indexRef(String(subscription.mercadoPagoPreapprovalId))
                .update({ open: false, updatedAt: now })
                .catch(() => {});
        }

        const unbooked = await cancelBookingsFrom(handle, subscription.uid, subscriptionId, decision.accessUntil || now)
            .catch(() => 0);

        return {
            ...core.publicView(subscriptionId, (await ref.once("value")).val()),
            refund,
            unbooked
        };
    };


    const ACTIONS = {
        create: { run: create, limit: "subscribe" },
        sync: { run: sync, limit: "subscriptionSync" },
        cancel: { run: cancel, limit: "subscriptionCancel" }
    };

    const subscriptionsApi = onRequest({ secrets, maxInstances: 10 }, async (req, res) => {

        res.set("Access-Control-Allow-Origin", "*");
        res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
        res.set("Access-Control-Allow-Methods", "POST, OPTIONS");

        if (req.method === "OPTIONS") return res.status(204).send("");

        if (req.method !== "POST") {
            return res.status(405).json({ success: false, message: "Método não permitido." });
        }

        try {

            const body = req.body && typeof req.body === "object" ? req.body : {};
            const action = ACTIONS[body.action];

            if (!action) return res.status(400).json({ success: false, message: "Ação inválida." });

            if (!(await bookings.throttle(req, action.limit))) {
                return res.status(429).json({ success: false, message: "Muitas tentativas seguidas. Aguarde um minuto." });
            }

            const user = await resolveUser(req);

            const result = await action.run(body, user, req);

            return res.status(200).json({ success: true, result });

        } catch (error) {

            if (error instanceof SubscriptionError || error instanceof bookings.BookingError) {
                return res.status(error.status).json({
                    success: false,
                    code: error.code,
                    message: error.message,
                    ...(error.extra || {})
                });
            }

            /* Só a mensagem: o corpo tem e-mail e nome. */
            console.error("Erro subscriptionsApi:", error && error.message);

            return res.status(500).json({ success: false, message: "Erro interno. Tente de novo." });
        }
    });


    /* =================================================
       WEBHOOK

       O Mercado Pago avisa:

         subscription_preapproval / preapproval
           mudou o estado da assinatura;

         subscription_authorized_payment
           uma cobrança foi agendada, paga ou recusada.

       Nada do corpo é levado a sério: a notificação só diz
       "olhe de novo", e quem diz o estado é a API do Mercado
       Pago, lida com o token da empresa.
    ================================================= */

    /** Empresa dona da conta Mercado Pago `user_id` (vem na notificação). */
    const handleForCollector = async (collectorId) => {

        if (!collectorId) return null;

        for (const value of [Number(collectorId), String(collectorId)]) {

            const found = (await db()
                .ref("mercadoPagoConnections")
                .orderByChild("mercadoPagoUserId")
                .equalTo(value)
                .limitToFirst(1)
                .once("value")).val();

            if (found) return Object.keys(found)[0];
        }

        return null;
    };

    const handleInvoice = async (invoiceId, collectorId) => {

        const tryHandle = async (handle) => {

            let invoice = null;

            const result = await asSeller(handle, async (token) => {
                const lido = await mpFetch(token, `/authorized_payments/${encodeURIComponent(invoiceId)}`);
                if (lido.ok) invoice = lido.data;
                return lido;
            }).catch(() => ({ ok: false }));

            if (!result.ok || !invoice || !invoice.preapproval_id) return false;

            const found = await findByPreapproval(invoice.preapproval_id);

            if (!found) return false;

            await syncOne(found.handle, found.id, { invoices: [invoice] });

            return true;
        };

        const owner = await handleForCollector(collectorId).catch(() => null);

        if (owner && await tryHandle(owner)) return;

        /* Sem user_id (IPN antigo) ou conexão não achada: tenta
           cada empresa conectada. Raro. */
        const connections = (await db().ref("mercadoPagoConnections").once("value")).val() || {};

        for (const handle of Object.keys(connections)) {
            if (handle !== owner && connections[handle] && connections[handle].connected && await tryHandle(handle)) return;
        }

        console.warn("subscriptions: cobrança sem assinatura conhecida", invoiceId);
    };

    const handleNotification = async ({ type, id, collectorId }) => {

        if (!id) return;

        if (type === "preapproval" || type === "subscription_preapproval") {

            const found = await findByPreapproval(String(id));

            if (!found) {
                console.warn("subscriptions: preapproval desconhecida", id);
                return;
            }

            await syncOne(found.handle, found.id);
            return;
        }

        if (type === "subscription_authorized_payment" || type === "authorized_payment") {
            await handleInvoice(String(id), collectorId);
        }
    };


    /* =================================================
       SINCRONIZAÇÃO DIÁRIA

       - atualiza estado e cobranças de toda assinatura aberta;
       - executa os cancelamentos agendados (aviso prévio);
       - cancela e APAGA tentativas pela conta Mercado Pago
         que ninguém concluiu em 48 h (não houve contrato).
    ================================================= */

    const runDailySync = async () => {

        const open = (await db()
            .ref("subscriptionsIndex")
            .orderByChild("open")
            .equalTo(true)
            .once("value")).val() || {};

        const now = Date.now();
        const summary = { synced: 0, cancelled: 0, expired: 0, errors: 0 };

        for (const [preapprovalId, entry] of Object.entries(open)) {

            try {

                const { handle, subscriptionId } = entry || {};
                const ref = subscriptionRef(handle, subscriptionId);
                const local = (await ref.once("value")).val();

                if (!local) {
                    await indexRef(preapprovalId).remove();
                    continue;
                }

                if (local.status === core.STATUS.PENDING && now - Number(local.createdAt || 0) > core.PENDING_TTL_MS) {

                    const updated = await syncOne(handle, subscriptionId);

                    if (updated && updated.status === core.STATUS.PENDING) {
                        await cancelAtMercadoPago(handle, preapprovalId).catch(() => null);
                        await ref.remove();
                        await indexRef(preapprovalId).remove();
                        summary.expired += 1;
                    }

                    continue;
                }

                const updated = await syncOne(handle, subscriptionId);
                summary.synced += 1;

                if (updated && updated.cancelScheduledFor && Number(updated.cancelScheduledFor) <= now &&
                    updated.status !== core.STATUS.CANCELLED) {

                    const result = await cancelAtMercadoPago(handle, preapprovalId);

                    if (result.ok) {

                        const accessUntil = updated.status === core.STATUS.ACTIVE
                            ? core.paidUntil(updated, now)
                            : now;

                        await ref.update({
                            status: core.STATUS.CANCELLED,
                            cancelledAt: now,
                            cancelledBy: updated.cancellationRequestedBy || "client",
                            accessUntil,
                            cancelScheduledFor: null,
                            updatedAt: now
                        });

                        await indexRef(preapprovalId).update({ open: false, updatedAt: now });
                        await cancelBookingsFrom(handle, updated.uid, subscriptionId, accessUntil).catch(() => 0);

                        summary.cancelled += 1;
                    }
                }

            } catch (error) {
                summary.errors += 1;
                console.error("subscriptions: sincronização falhou", preapprovalId, error.message);
            }
        }

        console.log("subscriptions: sincronização diária", JSON.stringify(summary));

        return summary;
    };

    const subscriptionsDailySync = onSchedule(
        { schedule: "every day 06:00", timeZone: "America/Sao_Paulo", secrets, timeoutSeconds: 540 },
        async () => { await runDailySync(); }
    );


    return {
        subscriptionsApi,
        subscriptionsDailySync,
        handleNotification,
        runDailySync
    };
};

module.exports.core = core;
