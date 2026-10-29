import { Icon } from "@iconify/react";

import { SITE_HOST } from "../../config/site";
import { usePointerTilt, useScrollScene } from "./hooks";
import { HOW_TO_STEPS } from "./landingContent";

/* =========================================================
   PEÇAS VISUAIS DA LANDING

   Tudo desenhado em HTML/CSS (nenhuma imagem pesada): as
   telas são ilustrações do produto, com dados de exemplo,
   e ficam fora da árvore de acessibilidade (aria-hidden).
   O texto que importa está nas seções, não aqui.
========================================================= */

/* ---------- Mini QR decorativo (não é um código válido) ---------- */

/* Três "olhos" nos cantos + ruído determinístico no meio:
   lembra um QR sem ser um código de verdade. */
const isFinder = (x, y) => {
    const corners = [[0, 0], [14, 0], [0, 14]];

    return corners.some(([cx, cy]) => {
        const dx = x - cx;
        const dy = y - cy;

        if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return false;

        const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3));

        return ring !== 2;
    });
};

const nearFinder = (x, y) => (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12);

const QR_CELLS = [];

for (let y = 0; y < 21; y += 1) {
    for (let x = 0; x < 21; x += 1) {
        const noise = ((x * 73 + y * 151 + x * y * 17) % 7) < 3;

        if (nearFinder(x, y) ? isFinder(x, y) : noise) QR_CELLS.push([x, y]);
    }
}

const QrGlyph = () => (
    <svg viewBox="0 0 21 21" className="mkq" shapeRendering="crispEdges">
        {QR_CELLS.map(([x, y]) => (
            <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />
        ))}
    </svg>
);

/* =========================================================
   HERO — arco de cartões flutuando no céu

   Cada cartão recebe --o (deslocamento a partir do centro)
   e --a (o mesmo, em módulo). O CSS posiciona o arco em 3D
   e o contêiner gira levemente com o ponteiro.
========================================================= */

const FanCard = ({ offset, className = "", children }) => (
    <div
        className={`mkfan__card ${Math.abs(offset) === 3 ? "is-edge" : ""} ${className}`.trim()}
        style={{ "--o": offset, "--a": Math.abs(offset) }}
    >
        <div className="mkfan__float">{children}</div>
    </div>
);

export const HeroFan = () => {
    const tiltRef = usePointerTilt({ max: 6 });

    return (
        <div className="mkfan" ref={tiltRef} aria-hidden="true">
            <div className="mkfan__stage">

                <FanCard offset={-3} className="mkfan__card--qr">
                    <span className="mkc-label">Mesa 4</span>
                    <QrGlyph />
                    <small>Aponte a câmera</small>
                </FanCard>

                <FanCard offset={-2} className="mkfan__card--pay">
                    <span className="mkc-label">Pix recebido</span>
                    <strong className="mkc-big">R$ 85,00</strong>
                    <svg viewBox="0 0 120 40" className="mkc-spark">
                        <path d="M0 32 L18 28 L34 30 L50 18 L68 22 L84 10 L102 14 L120 4" />
                    </svg>
                    <small>Corte + barba · hoje</small>
                </FanCard>

                <FanCard offset={-1} className="mkfan__card--site">
                    <span className="mkc-url">{SITE_HOST}/s/studio-aurora</span>
                    <span className="mkc-hero" />
                    <span className="mkc-line" />
                    <span className="mkc-line mkc-line--short" />
                    <span className="mkc-chip">Agendar</span>
                </FanCard>

                <FanCard offset={0} className="mkfan__card--main">
                    <div className="mkc-head">
                        <span className="mkc-avatar">BA</span>
                        <div>
                            <strong>Barbearia Aurora</strong>
                            <small>Escolha um horário</small>
                        </div>
                    </div>
                    <div className="mkc-days">
                        {["Seg", "Ter", "Qua", "Qui", "Sex"].map((day, index) => (
                            <span key={day} className={index === 2 ? "is-on" : ""}>
                                <small>{day}</small>
                                {14 + index}
                            </span>
                        ))}
                    </div>
                    <div className="mkc-slots">
                        {["09:00", "10:30", "14:30", "16:00", "17:30", "19:00"].map((slot) => (
                            <span key={slot} className={slot === "14:30" ? "is-on" : ""}>{slot}</span>
                        ))}
                    </div>
                    <span className="mkc-confirm">
                        <Icon icon="solar:check-circle-bold" />
                        Reserva confirmada
                    </span>
                </FanCard>

                <FanCard offset={1} className="mkfan__card--order">
                    <span className="mkc-label">Pedido #128</span>
                    <ul className="mkc-items">
                        <li><b>2×</b> Smash burger</li>
                        <li><b>1×</b> Fritas rústicas</li>
                        <li><b>2×</b> Limonada</li>
                    </ul>
                    <span className="mkc-status">Na cozinha</span>
                </FanCard>

                <FanCard offset={2} className="mkfan__card--team">
                    <span className="mkc-label">Equipe hoje</span>
                    <div className="mkc-team">
                        {["Lu", "Rafa", "Ana"].map((name, index) => (
                            <span key={name} style={{ "--h": index }}>{name.slice(0, 2)}</span>
                        ))}
                    </div>
                    <strong className="mkc-big">12 reservas</strong>
                </FanCard>

                <FanCard offset={3} className="mkfan__card--dish">
                    <span className="mkc-dish" />
                    <strong>Bowl de açaí</strong>
                    <small>R$ 24,90</small>
                    <span className="mkc-chip">Adicionar</span>
                </FanCard>

            </div>
        </div>
    );
};

/* =========================================================
   VITRINES DOS PRODUTOS
========================================================= */

const Phone = ({ children, className = "" }) => (
    <div className={`mkphone ${className}`.trim()}>
        <span className="mkphone__island" />
        <div className="mkphone__screen">{children}</div>
    </div>
);

export const BookingsShowcase = () => (
    <div className="mkshow mkshow--bookings" aria-hidden="true">
        <span className="mkshow__ring" />

        <Phone>
            <div className="mkp-cover" />
            <div className="mkp-company">
                <span className="mkc-avatar mkc-avatar--lg">BA</span>
                <strong>Barbearia Aurora</strong>
                <small>Aberto agora · fecha às 20h</small>
            </div>
            <div className="mkp-list">
                {[
                    ["Corte masculino", "40 min", "R$ 45"],
                    ["Corte + barba", "1h", "R$ 85"],
                    ["Barba completa", "30 min", "R$ 40"]
                ].map(([name, time, price], index) => (
                    <div key={name} className={`mkp-row ${index === 1 ? "is-on" : ""}`}>
                        <div>
                            <strong>{name}</strong>
                            <small>{time}</small>
                        </div>
                        <span>{price}</span>
                    </div>
                ))}
            </div>
            <span className="mkp-cta">Escolher horário</span>
        </Phone>

        <div className="mkbubble mkbubble--a">
            <Icon icon="solar:calendar-add-bold" />
            <div>
                <strong>Nova reserva</strong>
                <small>Ana · Corte + barba · 14:30</small>
            </div>
        </div>

        <div className="mkbubble mkbubble--b">
            <Icon icon="solar:wallet-money-bold" />
            <div>
                <strong>Pix aprovado</strong>
                <small>R$ 85,00</small>
            </div>
        </div>

        <div className="mkbubble mkbubble--c">
            <Icon icon="solar:users-group-rounded-bold" />
            <div>
                <strong>3 profissionais</strong>
                <small>agenda de cada um</small>
            </div>
        </div>
    </div>
);

export const StudioShowcase = () => {
    const tiltRef = usePointerTilt({ max: 5 });

    return (
        <div className="mkshow mkshow--studio" aria-hidden="true" ref={tiltRef}>
            <div className="mkbrowser">
                <div className="mkbrowser__bar">
                    <i /><i /><i />
                    <span>{SITE_HOST}/s/studio-aurora</span>
                </div>
                <div className="mkbrowser__page">
                    <div className="mkb-hero">
                        <span className="mkb-title" />
                        <span className="mkb-sub" />
                        <span className="mkb-btn">Agendar agora</span>
                    </div>
                    <div className="mkb-grid">
                        <span /><span /><span />
                    </div>
                    <div className="mkb-row">
                        <span className="mkb-map" />
                        <div>
                            <span className="mkb-line" />
                            <span className="mkb-line mkb-line--short" />
                            <span className="mkb-line" />
                        </div>
                    </div>
                </div>
            </div>

            <div className="mkbubble mkbubble--a">
                <Icon icon="solar:upload-square-bold" />
                <div>
                    <strong>Site publicado</strong>
                    <small>/s/studio-aurora</small>
                </div>
            </div>

            <div className="mkbubble mkbubble--b">
                <Icon icon="solar:chart-2-bold" />
                <div>
                    <strong>Visitas da semana</strong>
                    <small className="mkbars"><i /><i /><i /><i /><i /><i /><i /></small>
                </div>
            </div>
        </div>
    );
};

export const MenusShowcase = () => (
    <div className="mkshow mkshow--menus" aria-hidden="true">
        <span className="mkshow__ring" />

        <Phone>
            <div className="mkp-menu-head">
                <strong>Casa Brasa</strong>
                <small>Mesa 4 · pedido pelo QR</small>
                <div className="mkp-tabs">
                    <span className="is-on">Burgers</span>
                    <span>Porções</span>
                    <span>Bebidas</span>
                </div>
            </div>
            <div className="mkp-dishes">
                {[
                    ["Smash duplo", "R$ 32,00", 0],
                    ["Burger da casa", "R$ 36,00", 1],
                    ["Veggie grelhado", "R$ 30,00", 2]
                ].map(([name, price, hue]) => (
                    <div key={name} className="mkp-dish">
                        <span className="mkp-dish__img" style={{ "--h": hue }} />
                        <div>
                            <strong>{name}</strong>
                            <small>{price}</small>
                        </div>
                        <span className="mkp-add">+</span>
                    </div>
                ))}
            </div>
            <span className="mkp-cta">Ver pedido · 3 itens</span>
        </Phone>

        <div className="mkticket">
            <div className="mkticket__head">
                <strong>Cozinha</strong>
                <span>Mesa 4</span>
            </div>
            <ul>
                <li><b>2×</b> Smash duplo</li>
                <li><b>1×</b> Burger da casa</li>
            </ul>
            <span className="mkticket__status">Preparando</span>
        </div>

        <div className="mkbubble mkbubble--c">
            <span className="mkbubble__qr"><QrGlyph /></span>
            <div>
                <strong>QR da mesa</strong>
                <small>pedido direto do celular</small>
            </div>
        </div>
    </div>
);

export const SHOWCASES = {
    bookings: BookingsShowcase,
    studio: StudioShowcase,
    menus: MenusShowcase
};

/* =========================================================
   COMO USAR — cena presa ao scroll

   O trilho alto segura a tela; cada faixa do scroll acende
   um passo e troca a tela do celular. O texto de todos os
   passos está sempre no HTML (lista ordenada), só o destaque
   muda.
========================================================= */

const HowScreen = ({ screen }) => {
    switch (screen) {
        case "account":
            return (
                <div className="mkhs mkhs--account">
                    <span className="mkhs-logo"><img src="/markfy/logo.svg" alt="" /></span>
                    <strong>Criar conta</strong>
                    <span className="mkhs-field">Seu nome</span>
                    <span className="mkhs-field">voce@email.com</span>
                    <span className="mkhs-field">••••••••</span>
                    <span className="mkhs-btn">Continuar</span>
                    <span className="mkhs-google"><Icon icon="logos:google-icon" /> Entrar com Google</span>
                </div>
            );
        case "company":
            return (
                <div className="mkhs mkhs--company">
                    <small>Etapa 1 de 4</small>
                    <strong>Sua empresa</strong>
                    <span className="mkhs-field is-filled">Barbearia Aurora</span>
                    <span className="mkhs-field is-filled">@barbearia-aurora</span>
                    <div className="mkhs-seg">
                        {["Barbearia", "Salão", "Clínica", "Outro"].map((item, index) => (
                            <span key={item} className={index === 0 ? "is-on" : ""}>{item}</span>
                        ))}
                    </div>
                    <span className="mkhs-btn">Próxima etapa</span>
                </div>
            );
        case "services":
            return (
                <div className="mkhs mkhs--services">
                    <strong>Serviços</strong>
                    {[
                        ["Corte masculino", "40 min · R$ 45"],
                        ["Corte + barba", "1h · R$ 85"],
                        ["Sobrancelha", "15 min · R$ 20"]
                    ].map(([name, meta]) => (
                        <span key={name} className="mkhs-item">
                            <b>{name}</b>
                            <small>{meta}</small>
                        </span>
                    ))}
                    <strong className="mkhs-sub">Equipe</strong>
                    <div className="mkhs-team">
                        <span>Lu</span><span>Ra</span><span>An</span><span className="is-add">+</span>
                    </div>
                </div>
            );
        case "plan":
            return (
                <div className="mkhs mkhs--plan">
                    <strong>Escolha o plano</strong>
                    {["Bookings", "Bookings + Studio", "Studio + Bookings + Menus"].map((item, index) => (
                        <span key={item} className={`mkhs-plan ${index === 1 ? "is-on" : ""}`}>
                            <i />
                            {item}
                        </span>
                    ))}
                    <span className="mkhs-btn">Ativar plano</span>
                </div>
            );
        default:
            return (
                <div className="mkhs mkhs--share">
                    <span className="mkhs-qr"><QrGlyph /></span>
                    <strong>Sua página está no ar</strong>
                    <span className="mkhs-link">{SITE_HOST}/central-user/barbearia-aurora</span>
                    <div className="mkhs-share">
                        <span><Icon icon="logos:whatsapp-icon" /></span>
                        <span><Icon icon="skill-icons:instagram" /></span>
                        <span><Icon icon="solar:copy-bold" /></span>
                    </div>
                    <span className="mkhs-toast"><Icon icon="solar:check-circle-bold" /> Primeira reserva chegou</span>
                </div>
            );
    }
};

export const HowToScene = () => {
    const steps = HOW_TO_STEPS.length;
    const { trackRef, stageRef, step } = useScrollScene({ steps });

    return (
        <div className="mkhow__track" ref={trackRef} style={{ "--steps": steps }}>
            <div className="mkhow__stage" ref={stageRef}>
                <div className="mk-shell mkhow__grid">

                    <div className="mkhow__copy">
                        <h2 className="mk-h2" id="como-usar-titulo">Como usar a Markfy</h2>
                        <p className="mk-lede">
                            Do cadastro à primeira reserva, sem instalar nada.
                        </p>

                        <ol className="mkhow__steps">
                            {HOW_TO_STEPS.map((item, index) => (
                                <li
                                    key={item.title}
                                    className={index === step ? "is-on" : index < step ? "is-done" : ""}
                                >
                                    <span className="mkhow__num">{index + 1}</span>
                                    <div>
                                        <h3>{item.title}</h3>
                                        <p>{item.text}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>

                        <div className="mkhow__bar" aria-hidden="true">
                            <span />
                        </div>
                    </div>

                    <div className="mkhow__visual" aria-hidden="true">
                        <span className="mkhow__halo" />
                        <Phone className="mkphone--how">
                            {HOW_TO_STEPS.map((item, index) => (
                                <div
                                    key={item.screen}
                                    className={`mkhow__screen ${index === step ? "is-on" : index < step ? "is-past" : ""}`}
                                >
                                    <HowScreen screen={item.screen} />
                                </div>
                            ))}
                        </Phone>
                    </div>

                </div>
            </div>
        </div>
    );
};
