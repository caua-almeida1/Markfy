/*
============================================================
MEDIDOR DE CONSUMO DO REALTIME DATABASE
============================================================

FERRAMENTA DE DESENVOLVIMENTO. Não sobe para produção.

------------------------------------------------------------
COMO FUNCIONA
------------------------------------------------------------

O Realtime Database não expõe o consumo para o cliente: o
número de "Downloads" do console vem do faturamento, não do
banco. Então o jeito de saber quanto cada tela gasta é medir
o que passa no fio.

Este módulo envolve o WebSocket do navegador ANTES do
Firebase abrir a conexão e conta os bytes reais de cada
quadro, já com o caminho que o servidor mandou.

Vantagens de medir no WebSocket em vez de instrumentar cada
chamada:

    - não precisa alterar nenhuma tela
    - conta os bytes de verdade, não uma estimativa
    - os deltas do onValue entram com o tamanho real, e não
      com o tamanho do nó inteiro

------------------------------------------------------------
CUSTO
------------------------------------------------------------

Zero. O dado já chegou no navegador quando medimos, e nada
é gravado nem lido do banco. Tudo fica em memória.
============================================================
*/

/*
 * Limites para o medidor não virar um vazamento de memória
 * numa sessão longa.
 */

const MAX_PATHS = 600;
const MAX_EVENTS = 400;

/*
 * Intervalo mínimo entre avisos à interface, para não
 * renderizar a cada quadro recebido.
 */

const NOTIFY_INTERVAL = 250;

const createState = () => ({

    startedAt: Date.now(),

    totalDown: 0,
    totalUp: 0,

    framesDown: 0,
    framesUp: 0,

    /*
     * Bytes que chegaram antes de conseguirmos identificar
     * o caminho (handshake, autenticação, keep-alive).
     */
    overheadDown: 0,

    byPath: new Map(),
    byRoute: new Map(),

    events: [],

    truncatedPaths: false

});

/*
============================================================
PERSISTÊNCIA NA ABA
============================================================

Digitar /dev/rtdb na barra de endereço recarrega a página, e
um contexto JS novo perderia tudo que foi medido até ali.

O sessionStorage sobrevive ao reload, é por aba e nunca sai
do navegador — continua sem custo nenhum no banco.
============================================================
*/

const STORAGE_KEY = "__rtdbMeter_v1";

const MAX_STORED_EVENTS = 120;

const serializeState = (value) => ({

    startedAt: value.startedAt,

    totalDown: value.totalDown,
    totalUp: value.totalUp,

    framesDown: value.framesDown,
    framesUp: value.framesUp,

    overheadDown: value.overheadDown,

    truncatedPaths: value.truncatedPaths,

    byPath: Array.from(value.byPath.values()).map(entry => ({
        ...entry,
        kinds: Array.from(entry.kinds.entries())
    })),

    byRoute: Array.from(value.byRoute.values()).map(entry => ({
        ...entry,
        paths: Array.from(entry.paths)
    })),

    events: value.events.slice(-MAX_STORED_EVENTS)

});

const deserializeState = (raw) => {

    const restored = createState();

    restored.startedAt = raw.startedAt ?? Date.now();

    restored.totalDown = raw.totalDown || 0;
    restored.totalUp = raw.totalUp || 0;

    restored.framesDown = raw.framesDown || 0;
    restored.framesUp = raw.framesUp || 0;

    restored.overheadDown = raw.overheadDown || 0;

    restored.truncatedPaths = Boolean(raw.truncatedPaths);

    (raw.byPath || []).forEach((entry) => {

        restored.byPath.set(entry.path, {
            ...entry,
            kinds: new Map(entry.kinds || [])
        });

    });

    (raw.byRoute || []).forEach((entry) => {

        restored.byRoute.set(entry.route, {
            ...entry,
            paths: new Set(entry.paths || [])
        });

    });

    restored.events = raw.events || [];

    return restored;

};

const loadState = () => {

    try {

        const raw = window.sessionStorage.getItem(STORAGE_KEY);

        if (!raw) return null;

        return deserializeState(JSON.parse(raw));

    } catch (error) {

        return null;

    }

};

const persistState = () => {

    try {

        window.sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(serializeState(state))
        );

    } catch (error) {

        /*
         * Aba anônima, cota cheia ou storage bloqueado:
         * o medidor continua funcionando em memória.
         */

    }

};

let state =
    (typeof window !== "undefined" && loadState()) ||
    createState();

let installed = false;

const listeners = new Set();

let notifyTimer = null;

const notify = () => {

    if (notifyTimer) return;

    notifyTimer = setTimeout(() => {

        notifyTimer = null;

        persistState();

        listeners.forEach(listener => {

            try {

                listener();

            } catch (error) {

                console.warn("[rtdbMeter] listener falhou:", error);

            }

        });

    }, NOTIFY_INTERVAL);

};

/*
============================================================
UTILIDADES
============================================================
*/

const encoder =
    typeof TextEncoder !== "undefined"
        ? new TextEncoder()
        : null;

const byteLength = (data) => {

    if (data == null) return 0;

    if (typeof data === "string") {

        return encoder
            ? encoder.encode(data).length
            : data.length;

    }

    if (data.byteLength != null) return data.byteLength;

    if (data.size != null) return data.size;

    return 0;

};

/*
 * Agrupa identificadores para o relatório não virar uma
 * lista de milhares de caminhos únicos.
 *
 * companys/tk/products/gZtAAwsarFMB -> companys/tk/products/$id
 *
 * O critério é o nó PAI, não o formato do segmento: pelo
 * formato não dá para separar "gZtAAwsarFMB" de
 * "paymentOrders", e os ids deste projeto têm 12 caracteres.
 *
 * Os filhos de "companys" e "companiesIndex" são handles de
 * empresa, que são justamente o que queremos ver separado,
 * então esses pais ficam de fora da lista.
 */

const ID_PARENTS = new Set([
    "products",
    "members",
    "paymentOrders",
    "schedules",
    "photos",
    "orders",
    "invites",
    "users",
    "relatedUsers",
    "images",

    /*
     * As chaves aqui são CPF/CNPJ. Agrupar também evita
     * exibir documento na tela de diagnóstico.
     */
    "documentsIndex"
]);

/*
 * Push id do Firebase e uid do Auth, para caminhos que
 * não estejam na lista acima.
 */

const looksLikeGeneratedId = (segment) => {

    if (!segment) return false;

    if (segment.startsWith("-") && segment.length >= 15) return true;

    if (
        segment.length >= 20 &&
        /[a-z]/.test(segment) &&
        /[A-Z0-9]/.test(segment)
    ) {
        return true;
    }

    return false;

};

const normalizePath = (path) => {

    const clean = String(path || "")
        .replace(/^\/+/, "")
        .replace(/\/+$/, "");

    if (!clean) return "/";

    const segments = clean.split("/");

    return segments
        .map((segment, index) => {

            const parent = index > 0 ? segments[index - 1] : null;

            if (parent && ID_PARENTS.has(parent)) return "$id";

            if (looksLikeGeneratedId(segment)) return "$id";

            return segment;

        })
        .join("/");

};

const currentRoute = () => {

    try {

        return window.location.pathname || "/";

    } catch (error) {

        return "/";

    }

};

/*
============================================================
CONTABILIDADE
============================================================
*/

const record = ({ path, bytes, direction, kind }) => {

    const route = currentRoute();

    if (direction === "down") {

        state.totalDown += bytes;
        state.framesDown += 1;

    } else {

        state.totalUp += bytes;
        state.framesUp += 1;

    }

    if (!path) {

        if (direction === "down") {

            state.overheadDown += bytes;

        }

        notify();

        return;

    }

    const key = normalizePath(path);

    let entry = state.byPath.get(key);

    if (!entry) {

        if (state.byPath.size >= MAX_PATHS) {

            state.truncatedPaths = true;

            notify();

            return;

        }

        entry = {
            path: key,
            down: 0,
            up: 0,
            count: 0,
            firstRoute: route,
            kinds: new Map()
        };

        state.byPath.set(key, entry);

    }

    entry[direction] += bytes;
    entry.count += 1;

    entry.kinds.set(
        kind,
        (entry.kinds.get(kind) || 0) + bytes
    );

    let routeEntry = state.byRoute.get(route);

    if (!routeEntry) {

        routeEntry = {
            route,
            down: 0,
            up: 0,
            count: 0,
            paths: new Set()
        };

        state.byRoute.set(route, routeEntry);

    }

    routeEntry[direction] += bytes;
    routeEntry.count += 1;
    routeEntry.paths.add(key);

    if (direction === "down" && bytes > 0) {

        state.events.push({
            at: Date.now(),
            path: key,
            bytes,
            kind,
            route
        });

        if (state.events.length > MAX_EVENTS) {

            state.events.splice(
                0,
                state.events.length - MAX_EVENTS
            );

        }

    }

    notify();

};

/*
============================================================
PROTOCOLO DO REALTIME DATABASE
============================================================

Os quadros são JSON em texto. Quadros grandes vêm partidos:
o servidor manda primeiro um número (a quantidade de pedaços)
e depois os pedaços, que precisam ser remontados.

Formato relevante:

    {"t":"d","d":{ ... }}

        a = ação  ("d" sobrescreve, "m" mescla,
                   "q" escuta,      "g" get)
        r = número do pedido
        b.p = caminho
============================================================
*/

const createReassembler = () => {

    let pending = 0;
    let buffer = "";

    return (text) => {

        if (pending > 0) {

            buffer += text;
            pending -= 1;

            if (pending > 0) return null;

            const complete = buffer;
            buffer = "";

            return complete;

        }

        /*
         * Um quadro só de dígitos anuncia quantos pedaços
         * vêm a seguir.
         */

        if (/^\d{1,9}$/.test(text)) {

            const count = Number(text);

            if (count > 0) {

                pending = count;
                buffer = "";

                return null;

            }

        }

        return text;

    };

};

const safeParse = (text) => {

    try {

        return JSON.parse(text);

    } catch (error) {

        return null;

    }

};

/*
============================================================
INSTALAÇÃO
============================================================
*/

export const installRtdbMeter = () => {

    if (installed) return;

    if (typeof window === "undefined") return;

    const NativeWebSocket = window.WebSocket;

    if (typeof NativeWebSocket !== "function") return;

    const isFirebaseSocket = (url) =>
        /firebaseio\.com|firebasedatabase\.app/i.test(String(url));

    function MeteredWebSocket(url, protocols) {

        const socket =
            protocols === undefined
                ? new NativeWebSocket(url)
                : new NativeWebSocket(url, protocols);

        if (!isFirebaseSocket(url)) return socket;

        /*
         * Pedidos em aberto: número do pedido -> caminho.
         *
         * Serve para atribuir a resposta do servidor ao
         * caminho que foi pedido.
         */

        const pendingRequests = new Map();

        const reassembleIn = createReassembler();

        socket.addEventListener("message", (event) => {

            const bytes = byteLength(event.data);

            if (typeof event.data !== "string") {

                record({
                    path: null,
                    bytes,
                    direction: "down",
                    kind: "binário"
                });

                return;

            }

            const complete = reassembleIn(event.data);

            if (complete === null) {

                /*
                 * Pedaço de um quadro maior: conta os bytes
                 * agora e atribui o caminho quando o quadro
                 * terminar de chegar.
                 */

                state.totalDown += bytes;
                state.framesDown += 1;
                state.overheadDown += bytes;

                notify();

                return;

            }

            const frame = safeParse(complete);

            const body = frame?.d;

            if (!body) {

                record({
                    path: null,
                    bytes,
                    direction: "down",
                    kind: "controle"
                });

                return;

            }

            /*
             * Envio espontâneo do servidor (listener ativo).
             */

            if (body.a === "d" || body.a === "m") {

                record({
                    path: body.b?.p,
                    bytes,
                    direction: "down",
                    kind:
                        body.a === "d"
                            ? "sincronização"
                            : "delta"
                });

                return;

            }

            /*
             * Resposta a um pedido nosso.
             */

            if (body.r != null && pendingRequests.has(body.r)) {

                const request = pendingRequests.get(body.r);

                /*
                 * O get responde uma vez. O listen continua
                 * recebendo por caminho, então o pedido
                 * pode sair da lista nos dois casos.
                 */

                pendingRequests.delete(body.r);

                record({
                    path: request.path,
                    bytes,
                    direction: "down",
                    kind:
                        request.action === "g"
                            ? "get"
                            : "resposta do listen"
                });

                return;

            }

            record({
                path: null,
                bytes,
                direction: "down",
                kind: "controle"
            });

        });

        const nativeSend = socket.send.bind(socket);

        const reassembleOut = createReassembler();

        socket.send = (data) => {

            const bytes = byteLength(data);

            try {

                if (typeof data === "string") {

                    const complete = reassembleOut(data);

                    if (complete !== null) {

                        const frame = safeParse(complete);

                        const body = frame?.d;

                        const path = body?.b?.p;

                        if (body?.r != null && path) {

                            pendingRequests.set(body.r, {
                                path,
                                action: body.a
                            });

                        }

                        record({
                            path,
                            bytes,
                            direction: "up",
                            kind: body?.a || "controle"
                        });

                    } else {

                        state.totalUp += bytes;
                        state.framesUp += 1;

                        notify();

                    }

                } else {

                    record({
                        path: null,
                        bytes,
                        direction: "up",
                        kind: "binário"
                    });

                }

            } catch (error) {

                /*
                 * Medir nunca pode quebrar o app.
                 */

                console.warn("[rtdbMeter] falha ao medir envio:", error);

            }

            return nativeSend(data);

        };

        return socket;

    }

    MeteredWebSocket.prototype = NativeWebSocket.prototype;

    MeteredWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
    MeteredWebSocket.OPEN = NativeWebSocket.OPEN;
    MeteredWebSocket.CLOSING = NativeWebSocket.CLOSING;
    MeteredWebSocket.CLOSED = NativeWebSocket.CLOSED;

    window.WebSocket = MeteredWebSocket;

    installed = true;

    /*
     * Atalho para inspecionar pelo console do navegador,
     * sem precisar sair da tela que está sendo investigada.
     */

    window.__rtdbMeter = {
        snapshot: getMeterSnapshot,
        reset: resetMeter
    };

    console.info(
        "%c[rtdbMeter]%c medindo o Realtime Database. " +
        "Abra /dev/rtdb ou use window.__rtdbMeter.snapshot().",
        "color:#2a78d6;font-weight:bold",
        "color:inherit"
    );

};

/*
============================================================
API PARA A INTERFACE
============================================================
*/

export const isMeterInstalled = () => installed;

export const subscribeToMeter = (listener) => {

    listeners.add(listener);

    return () => listeners.delete(listener);

};

export const resetMeter = () => {

    state = createState();

    try {

        window.sessionStorage.removeItem(STORAGE_KEY);

    } catch (error) {

        /* storage indisponível: nada a limpar */

    }

    notify();

};

export const getMeterSnapshot = () => {

    const paths = Array.from(state.byPath.values())
        .map(entry => ({
            path: entry.path,
            down: entry.down,
            up: entry.up,
            count: entry.count,
            firstRoute: entry.firstRoute,
            kinds: Array.from(entry.kinds.entries())
                .sort((a, b) => b[1] - a[1])
        }))
        .sort((a, b) => b.down - a.down);

    const routes = Array.from(state.byRoute.values())
        .map(entry => ({
            route: entry.route,
            down: entry.down,
            up: entry.up,
            count: entry.count,
            pathCount: entry.paths.size
        }))
        .sort((a, b) => b.down - a.down);

    return {

        startedAt: state.startedAt,

        elapsedMs: Date.now() - state.startedAt,

        totalDown: state.totalDown,
        totalUp: state.totalUp,

        framesDown: state.framesDown,
        framesUp: state.framesUp,

        overheadDown: state.overheadDown,

        truncatedPaths: state.truncatedPaths,

        paths,
        routes,

        events: state.events.slice().reverse()

    };

};
