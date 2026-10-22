/* =====================================================
   MARKFY BOOKINGS — API DE AGENDAMENTO

   Uma função só (bookingsApi) recebe { action, ... }:

     availability  horários ocupados de um profissional
                   (só dia/hora/duração, nada de cliente)
     create        cria o agendamento
     mine          agendamentos desta conta/deste aparelho
     cancel        cancelamento pelo cliente

   POR QUE EXISTE

   As regras do banco publicadas em 2026-10-20 fecharam
   users/{uid} e a escrita em companys/{handle} para quem não
   é membro — o que é certo: antes, qualquer pessoa lia
   nome e telefone de todos os clientes de uma empresa. Mas o
   navegador do cliente lia e gravava exatamente esses nós
   para agendar, e o agendamento parou.

   Agora o navegador manda só as escolhas; quem lê a agenda,
   confere conflito, preço, plano e assinatura é o backend,
   com o Admin SDK. As regras continuam fechadas.

   ATENÇÃO: o Admin SDK ignora as regras do banco. Toda
   autorização desta função está no código abaixo.
===================================================== */

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

const core = require("./bookings-core");

const db = () => admin.database();

const read = async (path) => (await db().ref(path).once("value")).val();

const cors = (req, res) => {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");

    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return true;
    }

    return false;
};

class BookingError extends Error {
    constructor(status, message, code) {
        super(message);
        this.status = status;
        this.code = code || null;
    }
}

const fail = (status, message, code) => {
    throw new BookingError(status, message, code);
};


/* -----------------------------------------------------
   FREIO POR IP

   Buckets de um minuto em bookingRate/{minuto}/{hash}; o
   minuto de dois atrás é apagado a cada chamada, então o nó
   nunca cresce. Não é um WAF: segura robô e clique repetido.
----------------------------------------------------- */

const RATE_LIMITS = { availability: 60, create: 8, mine: 30, cancel: 10 };

const throttle = async (req, action) => {

    const ip = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
    const hash = crypto.createHash("sha256").update(ip + "|" + action).digest("hex").slice(0, 24);
    const bucket = Math.floor(Date.now() / 60000);

    db().ref(`bookingRate/${bucket - 2}`).remove().catch(() => {});

    const result = await db()
        .ref(`bookingRate/${bucket}/${hash}`)
        .transaction((count) => (Number(count) || 0) + 1);

    return Number(result.snapshot.val()) <= (RATE_LIMITS[action] || 20);
};


/* -----------------------------------------------------
   QUEM CHAMA

   O uid vem só do token. userId no corpo é ignorado.
----------------------------------------------------- */

const resolveUid = async (req) => {

    const authorization = req.headers.authorization || "";

    if (!authorization.startsWith("Bearer ")) return null;

    try {
        const decoded = await admin.auth().verifyIdToken(authorization.replace("Bearer ", ""));
        return decoded.uid;
    } catch {
        fail(401, "Sessão inválida. Entre de novo.");
    }

    return null;
};


/* -----------------------------------------------------
   LEITURAS PEQUENAS

   Produto lido campo a campo: há produtos antigos com
   imagens em base64 dentro do banco (mais de 1 MB num só),
   e ler o nó inteiro baixaria isso a cada agendamento.
----------------------------------------------------- */

const PRODUCT_FIELDS = [
    "name",
    "value",
    "discountedPrice",
    "duration",
    "status",
    "type",
    "relatedUsers",
    "cancellationAdvance",
    "bookingAdvance"
];

const readProduct = async (handle, productId) => {

    const values = await Promise.all(
        PRODUCT_FIELDS.map((field) => read(`companys/${handle}/products/${productId}/${field}`))
    );

    if (values.every((value) => value === null)) return null;

    const product = { id: productId };

    PRODUCT_FIELDS.forEach((field, index) => {
        if (values[index] !== null) product[field] = values[index];
    });

    return product;
};

const schedulesRef = (handle) => db().ref(`companys/${handle}/schedules`);

const schedulesWhere = async (handle, child, value) =>
    (await schedulesRef(handle).orderByChild(child).equalTo(value).once("value")).val() || {};

const assertOpen = async (handle) => {

    const access = await read(`publicAccess/${handle}`);

    if (!core.isBookingsOpen(access)) {
        fail(403, "Esta empresa não está recebendo agendamentos pela Markfy no momento.", "company_unavailable");
    }
};


/* -----------------------------------------------------
   TRAVA POR PROFISSIONAL E DIA

   Dois clientes no mesmo horário ao mesmo tempo: só um
   passa. A trava dura no máximo 15 s (se a função morrer no
   meio, ela expira sozinha).
----------------------------------------------------- */

const LOCK_TTL_MS = 15000;

const withDayLock = async (handle, professionalId, day, fn) => {

    const key = day.split("/").reverse().join("");
    const lockRef = db().ref(`bookingLocks/${handle}/${professionalId}/${key}`);
    const owner = crypto.randomBytes(8).toString("hex");

    for (let attempt = 0; attempt < 6; attempt += 1) {

        const now = Date.now();

        const result = await lockRef.transaction((current) => {
            if (current && Number(current.at) > now - LOCK_TTL_MS) return undefined;
            return { at: now, owner };
        });

        if (result.committed && result.snapshot.val()?.owner === owner) {
            try {
                return await fn();
            } finally {
                await lockRef.remove().catch(() => {});
            }
        }

        await new Promise((resolve) => setTimeout(resolve, 250 + attempt * 250));
    }

    fail(409, "Muita gente agendando agora. Tente de novo em alguns segundos.", "busy");
    return null;
};


/* =====================================================
   AÇÕES
===================================================== */

const availability = async (body) => {

    const { handle, professionalId } = body;

    if (!core.isHandle(handle) || !core.isKey(professionalId)) fail(400, "Dados inválidos.");

    const schedules = await schedulesWhere(handle, "professionalId", professionalId);

    return { busy: core.busySlots(schedules, professionalId) };
};


const create = async (body, uid) => {

    const parsed = core.parseCreate(body);

    if (parsed.error) fail(400, parsed.error, "invalid");

    const request = parsed.value;
    const { handle } = request;

    await assertOpen(handle);

    const [product, isMember, professionalName, paymentSettings] = await Promise.all([
        readProduct(handle, request.productId),
        read(`companys/${handle}/members/${request.professionalId}`),
        read(`users/${request.professionalId}/name`),
        read(`companys/${handle}/paymentSettings/receiveBeforeBooking`)
    ]);

    if (!product || product.status === "arquivados") fail(404, "Este serviço não está mais disponível.", "product_unavailable");

    if (!isMember || !core.relatedIds(product).includes(request.professionalId)) {
        fail(400, "Este profissional não atende este serviço.", "professional_invalid");
    }

    const bookingAdvanceMs = core.advanceToMs(product.bookingAdvance);

    if (bookingAdvanceMs && request.date.getTime() < Date.now() + bookingAdvanceMs - 5 * 60 * 1000) {
        fail(400, "Este horário precisa ser reservado com mais antecedência.", "too_soon");
    }

    /* Mensalidade: a assinatura precisa ser desta conta e estar em dia. */
    let subscription = null;

    if (request.subscriptionId || product.type === "monthly") {

        if (!uid) fail(401, "Entre na sua conta para usar a mensalidade.", "login_required");

        const subscriptionId = `${uid}_${request.productId}`;

        if (request.subscriptionId && request.subscriptionId !== subscriptionId) {
            fail(403, "Esta assinatura não é sua.", "subscription_invalid");
        }

        const stored = await read(`companys/${handle}/subscriptions/${subscriptionId}`);

        subscription = stored ? { ...stored, id: subscriptionId } : null;

        if (!core.isSubscriptionUsable(subscription)) {
            fail(402, "Assine o plano mensal para agendar este serviço.", "subscription_required");
        }

        request.subscriptionId = subscriptionId;
    }

    /* Pagamento antes de agendar: o agendamento nasce no
       webhook, depois do pagamento confirmado. Sem esta
       checagem, bastava chamar a API para pular a cobrança. */
    if (paymentSettings === true && !subscription) {
        fail(402, "Esta empresa pede o pagamento antes de confirmar o horário.", "payment_required");
    }

    const extras = (await Promise.all(
        request.extraProductIds.map((id) => readProduct(handle, id))
    )).filter((item) =>
        item &&
        item.status !== "arquivados" &&
        item.type !== "monthly" &&
        item.type !== "combo" &&
        Number(item.duration) > 0 &&
        core.relatedIds(item).includes(request.professionalId)
    );

    const now = Date.now();

    const schedule = core.buildSchedule({ request, product, extras, professionalName, uid, now });

    return withDayLock(handle, request.professionalId, request.day, async () => {

        const [sameDay, byClient, byUser] = await Promise.all([
            schedulesWhere(handle, "day", request.day),
            schedulesWhere(handle, "clientId", request.clientId),
            uid ? schedulesWhere(handle, "userId", uid) : Promise.resolve({})
        ]);

        if (core.bookedRecently({ ...byClient, ...byUser }, { uid, clientId: request.clientId }, now)) {
            fail(429, "Você já realizou um agendamento recentemente. Tente novamente em 30 minutos.", "recent_booking");
        }

        if (subscription) {
            const left = core.sessionsLeft(subscription, byUser);
            if (left !== null && left <= 0) {
                fail(402, "As sessões deste ciclo da sua mensalidade acabaram.", "subscription_exhausted");
            }
        }

        const busy = core.busySlots(sameDay, request.professionalId, now);

        if (core.hasConflict(busy, request.day, request.hour, schedule.totalDuration || Number(product.duration) || 30)) {
            fail(409, "Este horário acabou de ser reservado. Escolha outro.", "slot_taken");
        }

        let scheduleId = core.scheduleIdFor(now);

        if (await read(`companys/${handle}/schedules/${scheduleId}`)) {
            scheduleId += "-" + crypto.randomBytes(3).toString("hex");
        }

        await schedulesRef(handle).child(scheduleId).set(schedule);

        /* Contador de popularidade do produto: falhar aqui não
           desfaz o agendamento. */
        db()
            .ref(`companys/${handle}/products/${request.productId}/orders`)
            .transaction((count) => (Number(count) || 0) + 1)
            .catch((error) => console.warn("bookingsApi: contador do produto", error.message));

        return { scheduleId, schedule };
    });
};


const MAX_HANDLES = 30;

const mine = async (body, uid) => {

    const clientId = core.isClientId(body.clientId) ? body.clientId : null;

    if (!uid && !clientId) return { reservations: [] };

    const handles = [...new Set(Array.isArray(body.handles) ? body.handles : [body.handle])]
        .filter(core.isHandle)
        .slice(0, MAX_HANDLES);

    const subscriptionId = core.isKey(body.subscriptionId) ? body.subscriptionId : null;

    const perCompany = await Promise.all(handles.map(async (handle) => {

        const [byUser, byClient, name] = await Promise.all([
            uid ? schedulesWhere(handle, "userId", uid) : Promise.resolve({}),
            clientId ? schedulesWhere(handle, "clientId", clientId) : Promise.resolve({}),
            read(`companys/${handle}/name`)
        ]);

        return Object.entries({ ...byClient, ...byUser })
            .filter(([, item]) => core.ownsSchedule(item, { uid, clientId }))
            .filter(([, item]) => !subscriptionId || item.subscriptionId === subscriptionId)
            .map(([id, item]) => ({ ...item, id, handle, companyName: name || handle }));
    }));

    return { reservations: perCompany.flat() };
};


const cancel = async (body, uid) => {

    const { handle, scheduleId } = body;
    const clientId = core.isClientId(body.clientId) ? body.clientId : null;

    if (!core.isHandle(handle) || !core.isKey(scheduleId)) fail(400, "Dados inválidos.");

    const ref = schedulesRef(handle).child(scheduleId);
    const schedule = (await ref.once("value")).val();

    /* Mesma resposta para "não existe" e "não é seu": não
       dá para descobrir ids de agendamentos alheios. */
    if (!core.ownsSchedule(schedule, { uid, clientId })) fail(404, "Esta reserva não foi encontrada.", "not_found");

    const advance = schedule.productId
        ? await read(`companys/${handle}/products/${schedule.productId}/cancellationAdvance`)
        : null;

    const problem = core.cancelProblem(schedule, advance);

    if (problem) fail(409, problem, "not_cancellable");

    const patch = {
        status: "cancelados",
        cancelledAt: new Date().toISOString(),
        cancelledBy: "client"
    };

    await ref.update(patch);

    return { scheduleId, ...patch };
};


const ACTIONS = { availability, create, mine, cancel };

exports.bookingsApi = onRequest({ maxInstances: 10 }, async (req, res) => {

    try {

        if (cors(req, res)) return;

        if (req.method !== "POST") {
            return res.status(405).json({ success: false, message: "Método não permitido." });
        }

        const body = req.body && typeof req.body === "object" ? req.body : {};
        const handler = ACTIONS[body.action];

        if (!handler) {
            return res.status(400).json({ success: false, message: "Ação inválida." });
        }

        if (!(await throttle(req, body.action))) {
            return res.status(429).json({ success: false, message: "Muitas tentativas seguidas. Aguarde um minuto." });
        }

        const uid = await resolveUid(req);

        const result = await handler(body, uid);

        return res.status(200).json({ success: true, result });

    } catch (error) {

        if (error instanceof BookingError) {
            return res.status(error.status).json({ success: false, code: error.code, message: error.message });
        }

        /* Só a mensagem: o corpo pode ter nome e recado do cliente. */
        console.error("Erro bookingsApi:", error && error.message);

        return res.status(500).json({ success: false, message: "Erro interno. Tente de novo." });
    }
});

exports.bookingsCore = core;
