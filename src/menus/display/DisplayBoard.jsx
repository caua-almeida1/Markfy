import React, { useLayoutEffect, useRef, useState } from "react";

import { DISPLAY_ART } from "./art.jsx";
import { getDisplayTemplate, templateStyle } from "./templates.js";

import "./display.css";

/* =========================================================
   MONITOR DE RETIRADA — A TELA

   Desenhada numa resolução fixa (1920×1080, ou 1080×1920 na
   TV em pé) e reduzida por escala para caber em qualquer tela.
   Assim a TV, a prévia e as miniaturas mostram exatamente a
   mesma coisa, e TVs com navegador antigo (sem container
   queries) recebem o mesmo layout.
========================================================= */

const SIZE = {
    landscape: { width: 1920, height: 1080, preparing: 15, ready: 6 },
    portrait: { width: 1080, height: 1920, preparing: 20, ready: 6 }
};

/** Reduz o conteúdo (de tamanho fixo) para caber no pai. */
export const Stage = ({ orientation = "landscape", className, children }) => {
    const ref = useRef(null);
    const [box, setBox] = useState({ w: 0, h: 0 });
    const size = SIZE[orientation] || SIZE.landscape;

    useLayoutEffect(() => {
        const node = ref.current;
        if (!node) return undefined;
        const update = () => setBox({ w: node.clientWidth, h: node.clientHeight });
        update();
        if (typeof ResizeObserver === "undefined") {
            window.addEventListener("resize", update);
            return () => window.removeEventListener("resize", update);
        }
        const observer = new ResizeObserver(update);
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    const scale = box.w && box.h ? Math.min(box.w / size.width, box.h / size.height) : 0;

    return (
        <div ref={ref} className={`mdb-stage${className ? ` ${className}` : ""}`}>
            {scale > 0 && (
                <div
                    className="mdb-stage__canvas"
                    style={{
                        width: size.width,
                        height: size.height,
                        transform: `translate(-50%, -50%) scale(${scale})`
                    }}
                >
                    {children}
                </div>
            )}
        </div>
    );
};

const clockLabel = (now) => new Date(now).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const Monogram = ({ name }) => <span className="mdb-logo mdb-logo--text">{String(name || "M").trim().charAt(0).toUpperCase()}</span>;

const Ticket = ({ card, ready, fresh }) => (
    <li className={`mdb-ticket${ready ? " is-ready" : ""}${fresh ? " is-fresh" : ""}${card.status === "received" ? " is-received" : ""}`}>
        <b>{card.code}</b>
        {card.name && <span>{card.name}</span>}
    </li>
);

export default function DisplayBoard({ board, company = {}, now = Date.now(), fresh = [], brandColor = null, offline = false }) {
    const { preparing, ready, options } = board;
    const orientation = options.orientation === "portrait" ? "portrait" : "landscape";
    const size = SIZE[orientation];
    const template = getDisplayTemplate(options.template);
    const art = DISPLAY_ART[template.id] || {};
    const { Scene, Badge, Divider } = art;

    const [spotlight, ...restReady] = ready;
    const readyShown = restReady.slice(0, size.ready);
    const readyMore = restReady.length - readyShown.length;
    const prepShown = preparing.slice(0, preparing.length > size.preparing ? size.preparing - 1 : size.preparing);
    const prepMore = preparing.length - prepShown.length;
    const freshSet = new Set(fresh);

    return (
        <div
            className={`mdb mdb--${template.id} is-${orientation}`}
            style={{ ...templateStyle(template, options.useBrandColor ? brandColor : null), width: size.width, height: size.height }}
        >
            {Scene && <Scene />}

            <header className="mdb-head">
                <div className="mdb-brand">
                    {company.logo ? <img className="mdb-logo" src={company.logo} alt="" /> : <Monogram name={company.name} />}
                    <span>{company.name || "Seu restaurante"}</span>
                </div>
                <div className="mdb-title">
                    {Divider && <Divider className="mdb-divider" />}
                    <h1>{options.title}</h1>
                </div>
                <div className="mdb-clock">
                    {offline && <i className="mdb-offline" title="Sem conexão" />}
                    <time>{clockLabel(now)}</time>
                </div>
            </header>

            <main className="mdb-body">
                <section className="mdb-panel mdb-panel--preparing" aria-label={options.preparingLabel}>
                    <h2 className="mdb-panel__head">
                        <span className="mdb-dots" aria-hidden="true"><i /><i /><i /></span>
                        {options.preparingLabel}
                        <em>{preparing.length}</em>
                    </h2>
                    {prepShown.length ? (
                        <ul className="mdb-grid mdb-grid--preparing">
                            {prepShown.map((card) => <Ticket key={card.id} card={card} />)}
                            {prepMore > 0 && <li className="mdb-ticket mdb-ticket--more"><b>+{prepMore}</b><span>na fila</span></li>}
                        </ul>
                    ) : (
                        <p className="mdb-empty">Nenhum pedido em preparo agora.</p>
                    )}
                </section>

                <section className="mdb-panel mdb-panel--ready" aria-label={options.readyLabel}>
                    <h2 className="mdb-panel__head">
                        {Badge && <Badge className="mdb-badge" />}
                        {options.readyLabel}
                    </h2>

                    {spotlight ? (
                        <div key={spotlight.id} className={`mdb-spot${freshSet.has(spotlight.id) ? " is-fresh" : ""}`}>
                            <span className="mdb-spot__label">Chegou a sua vez!</span>
                            <b className="mdb-spot__code">{spotlight.code}</b>
                            {spotlight.name && <span className="mdb-spot__name">{spotlight.name}</span>}
                        </div>
                    ) : (
                        <p className="mdb-empty mdb-empty--ready">Quando o seu pedido ficar pronto, o número aparece aqui.</p>
                    )}

                    {readyShown.length > 0 && (
                        <ul className="mdb-grid mdb-grid--ready">
                            {readyShown.map((card) => <Ticket key={card.id} card={card} ready fresh={freshSet.has(card.id)} />)}
                            {readyMore > 0 && <li className="mdb-ticket mdb-ticket--more is-ready"><b>+{readyMore}</b><span>prontos</span></li>}
                        </ul>
                    )}
                </section>
            </main>

            <footer className="mdb-foot">
                <div className="mdb-ticker" aria-hidden={!options.message}>
                    {options.message && (
                        <div className="mdb-ticker__track">
                            <span>{options.message}</span>
                            <span aria-hidden="true">{options.message}</span>
                        </div>
                    )}
                </div>
                <span className="mdb-powered">Markfy <b>Menus</b></span>
            </footer>
        </div>
    );
}
