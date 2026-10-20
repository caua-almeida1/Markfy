import {
    endAt,
    equalTo,
    get,
    getDatabase,
    limitToLast,
    onValue,
    orderByChild,
    push,
    query,
    ref,
    remove,
    set,
    startAt,
    update
} from "firebase/database";
import { getAuth } from "firebase/auth";
import imageCompression from "browser-image-compression";
import { getDownloadURL, getStorage, ref as storageRef, uploadBytes } from "firebase/storage";

import { clean } from "../engine/util.js";

/* =========================================================
   FONTE DE DADOS REAL (Firebase)

   O painel lê tudo em tempo real do Realtime Database e
   grava direto apenas o que as regras permitem para o papel
   da pessoa (catálogo, configurações, rascunho, equipe).
   Operação (mesas, comandas, pedidos, pagamentos, estoque,
   planta, publicação) vai para a Cloud Function menusApi.
========================================================= */

const FUNCTIONS_URL = "https://us-central1-markfy-96942.cloudfunctions.net";

const db = () => getDatabase();

const buildQuery = (path, options) => {
    const base = ref(db(), path);
    if (!options) return base;

    const parts = [];
    if (options.orderBy) parts.push(orderByChild(options.orderBy));
    if (options.equalTo !== undefined) parts.push(equalTo(options.equalTo));
    if (options.startAt !== undefined) parts.push(startAt(options.startAt));
    if (options.endAt !== undefined) parts.push(endAt(options.endAt));
    if (options.limitToLast) parts.push(limitToLast(options.limitToLast));

    return parts.length ? query(base, ...parts) : base;
};

export class MenusApiError extends Error {
    constructor(message, { code, status, extra } = {}) {
        super(message);
        this.name = "MenusApiError";
        this.code = code || "error";
        this.status = status || 0;
        this.extra = extra || null;
    }
}

export const callMenusApi = async (handle, action, payload, { auth = true } = {}) => {
    const headers = { "Content-Type": "application/json" };

    const user = getAuth().currentUser;
    if (auth && user) headers.Authorization = `Bearer ${await user.getIdToken()}`;

    /* Rede ruim de celular pode deixar o fetch pendurado; depois
       de 25 s desistimos (as ações usam chave de idempotência,
       então tentar de novo não duplica nada). */
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 25000) : null;

    let response;
    try {
        response = await fetch(`${FUNCTIONS_URL}/menusApi`, {
            method: "POST",
            headers,
            body: JSON.stringify({ handle, action, payload: clean(payload || {}) }),
            signal: controller?.signal
        });
    } catch (error) {
        throw new MenusApiError(
            error?.name === "AbortError"
                ? "O servidor demorou demais para responder. Confira a internet e tente de novo."
                : "Sem conexão com o servidor. Verifique a internet e tente de novo.",
            { code: error?.name === "AbortError" ? "timeout" : "network" }
        );
    } finally {
        clearTimeout(timer);
    }

    const data = await response.json().catch(() => null);

    if (!data) {
        /* Resposta que não é JSON: a função não existe nesse
           endereço (ainda não publicada) ou o servidor caiu. */
        throw new MenusApiError(
            response.status === 404
                ? "O serviço de operação do Markfy Menus ainda não foi publicado neste ambiente (Cloud Function menusApi)."
                : "O servidor não respondeu como esperado. Tente de novo em instantes.",
            { code: response.status === 404 ? "not_deployed" : "bad_response", status: response.status }
        );
    }

    if (!response.ok || !data.success) {
        throw new MenusApiError(data.message || "Não foi possível concluir a operação.", {
            code: data.code,
            status: response.status,
            extra: data.extra
        });
    }

    return data.result;
};

const IMAGE_TYPES = /^image\/(jpeg|png|webp|heic|heif)$/;

export const uploadMenusImage = async (handle, file, folder = "images") => {
    if (!file) throw new Error("Nenhum arquivo selecionado.");
    if (!IMAGE_TYPES.test(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
        throw new Error("Use uma imagem JPG, PNG ou WEBP.");
    }
    if (file.size > 15 * 1024 * 1024) throw new Error("A imagem passa de 15 MB. Escolha uma menor.");

    let blob = file;
    if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
        const heic2any = (await import("heic2any")).default;
        blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
    }

    const compressed = await imageCompression(blob, {
        maxSizeMB: folder === "logo" ? 0.25 : 0.5,
        maxWidthOrHeight: folder === "cover" ? 1920 : folder === "logo" ? 512 : 1200,
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.82
    });

    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const target = storageRef(getStorage(), `companys/${handle}/menus/${folder}/${id}.jpg`);
    await uploadBytes(target, compressed, { contentType: "image/jpeg", cacheControl: "public, max-age=31536000" });

    return getDownloadURL(target);
};

export const createFirebaseSource = (handle) => ({
    kind: "firebase",
    handle,
    demo: false,

    now: () => Date.now(),

    newKey: () => push(ref(db())).key,

    watch: (path, callback, options) =>
        onValue(
            buildQuery(path, options),
            (snapshot) => callback(snapshot.val(), null),
            (error) => callback(null, error)
        ),

    /* true/false conforme o socket do Realtime Database. */
    watchConnection: (callback) => onValue(ref(db(), ".info/connected"), (snapshot) => callback(snapshot.val() === true)),

    get: async (path) => (await get(ref(db(), path))).val(),

    set: (path, value) => set(ref(db(), path), clean(value)),

    update: (patch) => update(ref(db()), clean(patch)),

    remove: (path) => remove(ref(db(), path)),

    action: (name, payload) => callMenusApi(handle, name, payload),

    publicAction: (name, payload) => callMenusApi(handle, name, payload, { auth: false }),

    upload: (file, folder) => uploadMenusImage(handle, file, folder)
});

/** Leitura pública (cardápio /m/:slug), sem empresa no contexto. */
export const readPublic = async (path) => {
    try {
        return (await get(ref(db(), path))).val();
    } catch {
        return null;
    }
};
