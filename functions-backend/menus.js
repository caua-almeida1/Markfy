/* =====================================================
   MARKFY MENUS — API DE OPERAÇÃO

   Uma função só (menusApi) recebe { handle, action, payload }.
   Quem decide é o motor compartilhado (menus-engine, cópia de
   src/menus/engine gerada por scripts/sync-menus-engine.js):

     - quem é a pessoa: token do Firebase (nunca o corpo);
     - o que ela pode: papel na empresa + menusStaff;
     - o que o plano inclui: licenses + planCatalog;
     - preço, estoque, horário e regras: lidos do banco.

   O navegador não grava mesas, comandas, pedidos, pagamentos,
   estoque, planta nem publicação: as regras do banco deixam
   esses nós só para leitura, e tudo passa por aqui.

   Ações públicas (cliente final, sem login): fazer pedido
   pelo cardápio e chamar o garçom/pedir a conta pelo QR.
===================================================== */

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const crypto = require("crypto");

/* ESM carregado por require() (Node 22.12+). */
const engine = require("./menus-engine/index.js");

const db = () => admin.database();

/* Adaptador do Admin SDK para o motor. A transação é feita
   com um ouvinte ativo no caminho: assim a primeira chamada
   da função já recebe o valor real (e não o "null" que o SDK
   entrega quando não tem o dado em cache). */
const adapter = {
    kind: "admin",

    newKey: () => db().ref().push().key,

    get: async (path) => (await db().ref(path).once("value")).val(),

    set: (path, value) => db().ref(path).set(value === undefined ? null : value),

    update: (updates) => db().ref().update(updates),

    transaction: (path, fn) =>
        new Promise((resolve, reject) => {
            const ref = db().ref(path);
            let started = false;

            const onValue = () => {
                if (started) return;
                started = true;

                ref.transaction(fn, undefined, false)
                    .then((result) => {
                        ref.off("value", onValue);
                        resolve({ committed: result.committed, value: result.snapshot.val() });
                    })
                    .catch((error) => {
                        ref.off("value", onValue);
                        reject(error);
                    });
            };

            ref.on("value", onValue, (error) => {
                ref.off("value", onValue);
                reject(error);
            });
        })
};

const HANDLE = /^[a-z0-9._-]{1,60}$/i;
const ACTION = /^[a-z]+\.[a-zA-Z]+$/;

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

/* Freio simples para ações públicas: até 30 por minuto por
   IP e empresa. Não é um WAF; evita robô enchendo a cozinha. */
const throttle = async (req, handle) => {
    const ip = String(req.headers["x-forwarded-for"] || req.ip || "").split(",")[0].trim();
    const hash = crypto.createHash("sha256").update(ip + "|" + handle).digest("hex").slice(0, 24);
    const bucket = Math.floor(Date.now() / 60000);

    const result = await db().ref(`menusRate/${handle}/${hash}_${bucket}`).transaction((count) => (Number(count) || 0) + 1);

    return Number(result.snapshot.val()) <= 30;
};

exports.menusApi = onRequest({ maxInstances: 10 }, async (req, res) => {
    try {
        if (cors(req, res)) return;

        if (req.method !== "POST") {
            return res.status(405).json({ success: false, message: "Método não permitido." });
        }

        const { handle, action, payload } = req.body || {};

        if (typeof handle !== "string" || !HANDLE.test(handle) || typeof action !== "string" || !ACTION.test(action)) {
            return res.status(400).json({ success: false, message: "Dados inválidos." });
        }

        const isPublic = engine.PUBLIC_ACTIONS.includes(action);

        let uid = null;
        let name = null;

        const authorization = req.headers.authorization || "";

        if (authorization.startsWith("Bearer ")) {
            try {
                const decoded = await admin.auth().verifyIdToken(authorization.replace("Bearer ", ""));
                uid = decoded.uid;
                name = decoded.name || decoded.email || null;
            } catch (tokenError) {
                if (!isPublic) {
                    return res.status(401).json({ success: false, message: "Sessão inválida. Entre de novo." });
                }
            }
        } else if (!isPublic) {
            return res.status(401).json({ success: false, message: "Usuário não autenticado." });
        }

        if (isPublic && !(await throttle(req, handle))) {
            return res.status(429).json({ success: false, message: "Muitas tentativas seguidas. Aguarde um minuto." });
        }

        /* Ação pública roda como público mesmo com login: o
           cliente que tem conta não ganha poder de equipe. */
        const ctx = await engine.resolveContext(adapter, {
            handle,
            uid: isPublic ? null : uid,
            name,
            now: Date.now()
        });

        const result = await engine.runAction(adapter, ctx, action, payload && typeof payload === "object" ? payload : {});

        return res.status(200).json({ success: true, result: result || null });

    } catch (error) {

        if (error && error.name === "MenusError") {
            return res.status(error.status || 400).json({
                success: false,
                code: error.code,
                message: error.message,
                extra: error.extra || null
            });
        }

        console.error("Erro menusApi:", error);

        return res.status(500).json({ success: false, message: "Erro interno. Tente de novo." });
    }
});

/* Usado pela cobrança de planos (index.js). */
exports.menusLicensing = {
    licenseProductFor: engine.licenseProductFor,
    planPriceFor: engine.planPriceFor,
    publicAccessFor: engine.publicAccessFor,
    PRODUCT_IDS: engine.PRODUCT_IDS
};
