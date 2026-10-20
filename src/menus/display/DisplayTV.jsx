import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import { nextStatus } from "../engine/orders.js";
import { groupsOf, sizesOf } from "../engine/pricing.js";
import { entries } from "../engine/util.js";
import { useMenus } from "../MenusContext.jsx";
import { ensureFonts } from "../site/fonts.js";
import { buildBoard, withDisplayDefaults } from "./board.js";
import DisplayBoard, { Stage } from "./DisplayBoard.jsx";
import { getDisplayTemplate } from "./templates.js";
import { announce, chime, unlockAudio } from "./sound.js";

/* =========================================================
   MONITOR DE RETIRADA — TELA DA TV (/menus/senhas/tv)

   Fica aberta o dia todo numa TV (navegador da TV, Fire TV,
   Chromecast com navegador ou um computador no HDMI):
     - tela cheia e tela sempre acesa (Wake Lock), quando o
       aparelho permite;
     - som e voz ao chegar um pedido pronto (navegadores só
       liberam áudio depois de um toque, daí o "Iniciar");
     - cursor some sozinho; os controles voltam ao mexer o mouse;
     - na demonstração, os pedidos andam sozinhos.
========================================================= */

const FRESH_MS = 9000;

const requestFullscreen = () => {
    const node = document.documentElement;
    const fn = node.requestFullscreen || node.webkitRequestFullscreen;
    try {
        const result = fn?.call(node);
        if (result?.catch) result.catch(() => {});
    } catch {
        /* TV sem tela cheia por script: segue em janela */
    }
};

const useWakeLock = (active) => {
    useEffect(() => {
        if (!active || !navigator.wakeLock?.request) return undefined;
        let lock = null;
        let stopped = false;

        const acquire = async () => {
            try {
                lock = await navigator.wakeLock.request("screen");
            } catch {
                lock = null;
            }
        };
        const onVisible = () => {
            if (!stopped && document.visibilityState === "visible") acquire();
        };

        acquire();
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            stopped = true;
            document.removeEventListener("visibilitychange", onVisible);
            lock?.release?.().catch?.(() => {});
        };
    }, [active]);
};

const DEMO_NAMES = ["Ana", "Bruno", "Carla", "Diego", "Elisa", "Felipe", "Gabi", "Heitor", "Isis", "João", "Lara", "Miguel", "Nina", "Otávio"];

/* Produto simples (sem tamanho nem escolha obrigatória) para
   a demonstração criar pedidos sem precisar de formulário. */
const simpleProducts = (catalog) =>
    entries(catalog?.products).filter((product) =>
        product.available !== false &&
        !sizesOf(product).length &&
        !groupsOf(product, catalog?.optionGroups).some((group) => Number(group.min) > 0)
    );

/* Demonstração: a cada poucos segundos um pedido anda uma
   etapa (e, se a fila esvaziar, chega um pedido novo no
   balcão), para dar para ver o destaque e o som funcionando. */
const useDemoTraffic = (enabled, orders, settings, display, act, catalog) => {
    const latest = useRef({ orders, settings, display, act, catalog });
    latest.current = { orders, settings, display, act, catalog };

    useEffect(() => {
        if (!enabled) return undefined;
        const id = setInterval(() => {
            const { orders: current, settings: s, display: d, act: run } = latest.current;
            const list = entries(current)
                .filter((order) => d.channels[order.channel] && ["received", "confirmed", "preparing", "ready", "awaiting_pickup"].includes(order.status))
                .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
            const ready = list.filter((order) => ["ready", "awaiting_pickup"].includes(order.status));
            const waiting = list.length - ready.length;

            if (waiting < 4 && d.channels.counter) {
                const products = simpleProducts(latest.current.catalog);
                const product = products[Math.floor(Math.random() * products.length)];
                if (product) {
                    run("orders.create", {
                        idempotencyKey: `demo-tv-${Date.now()}`,
                        channel: "counter",
                        lines: [{ productId: product.id, qty: 1 + Math.floor(Math.random() * 2) }],
                        customer: { name: DEMO_NAMES[Math.floor(Math.random() * DEMO_NAMES.length)] },
                        payment: { method: "pix", status: "pending" }
                    }, { quiet: true }).catch(() => {});
                    return;
                }
            }

            /* muitos prontos na tela: um deles é retirado */
            const order = ready.length > 4 ? ready[0] : list.find((item) => !["ready", "awaiting_pickup"].includes(item.status)) || ready[0];
            const to = order && nextStatus(order, s);
            if (to) run("orders.status", { orderId: order.id, to }, { quiet: true }).catch(() => {});
        }, 6500);
        return () => clearInterval(id);
    }, [enabled]);
};

export default function DisplayTV() {
    const navigate = useNavigate();
    const { orders, settings, draft, site, demo, online, act, path, catalog } = useMenus();
    const display = useMemo(() => withDisplayDefaults(settings.display), [settings.display]);
    const template = getDisplayTemplate(display.template);

    const [now, setNow] = useState(Date.now());
    const [started, setStarted] = useState(false);
    const [controls, setControls] = useState(true);
    const [fresh, setFresh] = useState([]);
    const seen = useRef(null);
    const hideTimer = useRef(null);

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 5000);
        document.body.classList.add("mdb-tv-body");
        return () => {
            clearInterval(id);
            document.body.classList.remove("mdb-tv-body");
        };
    }, []);

    useEffect(() => {
        ensureFonts([template.fonts.heading, template.fonts.body, "Poppins"]);
    }, [template]);

    useWakeLock(started);
    useDemoTraffic(demo && started, orders, settings, display, act, catalog);

    const board = useMemo(() => buildBoard(orders, display, now), [orders, display, now]);

    /* Pedido que acabou de ficar pronto: destaca, toca e fala. */
    useEffect(() => {
        const ids = board.ready.map((card) => card.id);
        if (seen.current === null) {
            seen.current = new Set(ids);
            return undefined;
        }
        const arrived = board.ready.filter((card) => !seen.current.has(card.id));
        ids.forEach((id) => seen.current.add(id));
        if (!arrived.length) return undefined;

        setFresh((current) => [...current, ...arrived.map((card) => card.id)]);
        if (started && display.sound) chime();
        if (started && display.voice) arrived.slice(0, 3).forEach((card) => announce(card));

        const timer = setTimeout(() => setFresh((current) => current.filter((id) => !arrived.some((card) => card.id === id))), FRESH_MS);
        return () => clearTimeout(timer);
    }, [board.ready, started, display.sound, display.voice]);

    const wake = useCallback(() => {
        setControls(true);
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setControls(false), 3500);
    }, []);

    useEffect(() => {
        wake();
        return () => clearTimeout(hideTimer.current);
    }, [wake]);

    const start = () => {
        unlockAudio();
        requestFullscreen();
        setStarted(true);
        wake();
    };

    const company = {
        name: settings.profile?.name || "",
        logo: site?.design?.images?.logo || draft?.design?.images?.logo || null
    };
    const brandColor = site?.design?.theme?.colors?.primary || draft?.design?.theme?.colors?.primary || null;

    return (
        <div className={`mdb-tv${controls ? "" : " is-idle"}`} onMouseMove={wake} onTouchStart={wake} onKeyDown={wake} role="presentation">
            <Stage orientation={display.orientation}>
                <DisplayBoard board={board} company={company} now={now} fresh={fresh} brandColor={brandColor} offline={!online} />
            </Stage>

            <div className="mdb-tv__bar" aria-hidden={!controls}>
                <button type="button" onClick={() => navigate(path("senhas"))}><Icon icon="solar:arrow-left-linear" aria-hidden="true" /> Sair</button>
                {demo && <span className="mdb-tv__demo">Demonstração · os pedidos andam sozinhos</span>}
                <button type="button" onClick={requestFullscreen}><Icon icon="solar:full-screen-linear" aria-hidden="true" /> Tela cheia</button>
            </div>

            {!started && (
                <div className="mdb-tv__start">
                    <div>
                        <span className="mdb-tv__start-icon"><Icon icon="solar:tv-linear" aria-hidden="true" /></span>
                        <h1>Monitor de retirada</h1>
                        <p>
                            Toque para começar. A tela fica cheia{display.sound || display.voice ? ", com som ao chamar cada pedido" : ""} e
                            se atualiza sozinha.
                        </p>
                        <button type="button" className="mdb-tv__go" onClick={start} autoFocus>
                            <Icon icon="solar:play-bold" aria-hidden="true" /> Iniciar monitor
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
