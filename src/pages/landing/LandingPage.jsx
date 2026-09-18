import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import AgendaScene from "./AgendaScene";
import { PlatformDeck, BookingFlow, StepsRail } from "./scenes";
import { useInView, useScrollProgress } from "./hooks";

import "./landingPage.css";

/* =========================================================
   Bloco que se revela ao entrar na viewport.

   Reservado para as seções calmas — as três cenas presas
   têm animação própria comandada pelo scroll.
========================================================= */

const Reveal = ({ as: Tag = "div", delay = 0, className = "", children, ...rest }) => {
    const [ref, inView] = useInView();

    return (
        <Tag
            ref={ref}
            className={`mk-reveal ${inView ? "is-in" : ""} ${className}`.trim()}
            style={{ "--delay": `${delay}ms` }}
            {...rest}
        >
            {children}
        </Tag>
    );
};

const SEGMENTS = [
    "Barbearias",
    "Clínicas",
    "Salões",
    "Estúdios de tatuagem",
    "Nail designers",
    "Fisioterapeutas",
    "Pet shops",
    "Consultórios"
];

const LandingPage = () => {
    const navigate = useNavigate();

    const { progress, scrolled } = useScrollProgress();

    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        // O CSS de outras telas é global no CRA e trava
        // html/body em height:100%. A landing rola livre,
        // então marcamos os dois e devolvemos ao sair.
        document.body.classList.add("landing-active");
        document.documentElement.classList.add("landing-root");

        return () => {
            document.body.classList.remove("landing-active");
            document.documentElement.classList.remove("landing-root");
        };
    }, []);

    // Trava o scroll do fundo enquanto o menu mobile está aberto.
    useEffect(() => {
        document.body.classList.toggle("mk-locked", menuOpen);

        return () => document.body.classList.remove("mk-locked");
    }, [menuOpen]);

    const goToSection = (event, id) => {
        event.preventDefault();

        setMenuOpen(false);

        const target = document.getElementById(id);

        if (!target) return;

        const offset = target.getBoundingClientRect().top + window.scrollY - 88;

        window.scrollTo({
            top: offset,
            behavior: "smooth"
        });
    };

    const startSignup = () => navigate("/login");

    return (
        <main className="mk-landing">

            <a className="mk-skip" href="#hero">
                Ir para o conteúdo
            </a>

            <div
                className="mk-progress"
                style={{ transform: `scaleX(${progress})` }}
                aria-hidden="true"
            />


            {/* =====================================================
                CABEÇALHO
            ====================================================== */}

            <header className={`mk-header ${scrolled ? "is-scrolled" : ""}`}>

                <div className="mk-header__bar">

                    <a
                        className="mk-brand"
                        href="#hero"
                        onClick={(event) => goToSection(event, "hero")}
                    >
                        <img src="/markfy/logo.svg" alt="" aria-hidden="true" />
                        <span>Markfy</span>
                    </a>

                    <nav className="mk-nav" aria-label="Seções da página">
                        <a href="#plataforma" onClick={(e) => goToSection(e, "plataforma")}>
                            Plataforma
                        </a>
                        <a href="#recursos" onClick={(e) => goToSection(e, "recursos")}>
                            Como funciona
                        </a>
                        <a href="#comecar" onClick={(e) => goToSection(e, "comecar")}>
                            Como começar
                        </a>
                        <a href="#sobre" onClick={(e) => goToSection(e, "sobre")}>
                            Sobre
                        </a>
                    </nav>

                    <div className="mk-header__actions">
                        <button
                            type="button"
                            className="mk-btn mk-btn--quiet"
                            onClick={startSignup}
                        >
                            Entrar
                        </button>

                        <button
                            type="button"
                            className="mk-btn mk-btn--solid"
                            onClick={startSignup}
                        >
                            Criar minha empresa
                        </button>
                    </div>

                    <button
                        type="button"
                        className="mk-burger"
                        aria-expanded={menuOpen}
                        aria-controls="mk-mobile-menu"
                        aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
                        onClick={() => setMenuOpen((open) => !open)}
                    >
                        <Icon icon={menuOpen ? "solar:close-circle-linear" : "solar:hamburger-menu-linear"} />
                    </button>

                </div>

                <div
                    id="mk-mobile-menu"
                    className={`mk-mobile ${menuOpen ? "is-open" : ""}`}
                    hidden={!menuOpen}
                >
                    <a href="#plataforma" onClick={(e) => goToSection(e, "plataforma")}>Plataforma</a>
                    <a href="#recursos" onClick={(e) => goToSection(e, "recursos")}>Como funciona</a>
                    <a href="#comecar" onClick={(e) => goToSection(e, "comecar")}>Como começar</a>
                    <a href="#sobre" onClick={(e) => goToSection(e, "sobre")}>Sobre</a>

                    <button type="button" className="mk-btn mk-btn--solid" onClick={startSignup}>
                        Criar minha empresa
                    </button>
                </div>

            </header>


            {/* =====================================================
                HERO
            ====================================================== */}

            <section id="hero" className="mk-hero">

                <div className="mk-hero__depth" aria-hidden="true">
                    <span className="mk-hero__beam" />
                    <span className="mk-hero__floor" />
                </div>

                <div className="mk-shell mk-hero__shell">

                    <div className="mk-hero__copy">

                        <p className="mk-hero__kicker">
                            <span className="mk-dot" />
                            Agendamento para quem atende
                        </p>

                        <h1 className="mk-hero__title">
                            A agenda que trabalha
                            <br />
                            enquanto você atende.
                        </h1>

                        <p className="mk-hero__lede">
                            Seus clientes escolhem serviço, profissional e horário
                            sozinhos, a qualquer hora, direto no link da sua empresa.
                            Você só aparece para atender.
                        </p>

                        <div className="mk-hero__actions">
                            <button
                                type="button"
                                className="mk-btn mk-btn--solid mk-btn--lg"
                                onClick={startSignup}
                            >
                                Criar minha empresa
                                <Icon icon="solar:arrow-right-linear" />
                            </button>

                            <a
                                href="#plataforma"
                                className="mk-btn mk-btn--outline mk-btn--lg"
                                onClick={(e) => goToSection(e, "plataforma")}
                            >
                                Ver como funciona
                            </a>
                        </div>

                        <dl className="mk-hero__facts">
                            <div>
                                <dt>Sem mensalidade para começar</dt>
                                <dd>Configure e publique sua página hoje</dd>
                            </div>
                            <div>
                                <dt>Feito para o celular</dt>
                                <dd>É de onde a maioria dos clientes agenda</dd>
                            </div>
                        </dl>

                    </div>

                    <div className="mk-hero__visual">
                        <AgendaScene />
                    </div>

                </div>

                <p className="mk-hero__hint" aria-hidden="true">
                    <Icon icon="solar:mouse-linear" />
                    Role para ver funcionando
                </p>

            </section>


            {/* =====================================================
                SEGMENTOS
            ====================================================== */}

            <section className="mk-marquee" aria-label="Tipos de negócio atendidos">
                <div className="mk-marquee__track">
                    {[0, 1].map((copy) => (
                        <div className="mk-marquee__group" key={copy} aria-hidden={copy === 1}>
                            {SEGMENTS.map((item) => (
                                <span key={item}>
                                    {item}
                                    <i aria-hidden="true" />
                                </span>
                            ))}
                        </div>
                    ))}
                </div>
            </section>


            {/* =====================================================
                CENAS PRESAS — comandadas pelo scroll
            ====================================================== */}

            <PlatformDeck />

            <BookingFlow />

            <div className="mk-flow__after">
                <div className="mk-shell">
                    <button
                        type="button"
                        className="mk-btn mk-btn--light mk-btn--lg"
                        onClick={startSignup}
                    >
                        Garantir meu endereço
                        <Icon icon="solar:arrow-right-linear" />
                    </button>
                </div>
            </div>

            <StepsRail />


            {/* =====================================================
                SOBRE
            ====================================================== */}

            <section id="sobre" className="mk-section mk-about">

                <div className="mk-shell mk-about__shell">

                    <Reveal>
                        <h2>
                            Agendar não deveria
                            <br />
                            depender de alguém atender.
                        </h2>
                    </Reveal>

                    <Reveal delay={100} className="mk-about__text">
                        <p>
                            A Markfy nasceu de um problema comum: o cliente manda
                            mensagem às 22h, ninguém responde, e o horário some.
                            Do outro lado, quem atende perde o dia respondendo
                            "tem vaga amanhã?".
                        </p>

                        <p>
                            A plataforma resolve os dois lados com a mesma coisa —
                            uma agenda pública e sempre atualizada. Barbearia,
                            clínica, salão, estúdio ou consultório: se o seu
                            trabalho é medido em horários, ela se ajusta ao seu.
                        </p>

                        <p>
                            Funciona no celular e no computador, com a mesma
                            interface familiar das plataformas que seus clientes
                            já usam todo dia.
                        </p>
                    </Reveal>

                </div>

            </section>


            {/* =====================================================
                CTA FINAL
            ====================================================== */}

            <section className="mk-final">

                <div className="mk-shell">
                    <Reveal className="mk-final__box">
                        <h2>Sua próxima semana pode chegar cheia.</h2>

                        <p>
                            Crie a empresa, publique o link e deixe a agenda
                            trabalhar por você.
                        </p>

                        <div className="mk-final__actions">
                            <button
                                type="button"
                                className="mk-btn mk-btn--solid mk-btn--lg"
                                onClick={startSignup}
                            >
                                Criar minha empresa
                                <Icon icon="solar:arrow-right-linear" />
                            </button>

                            <a
                                href="#plataforma"
                                className="mk-btn mk-btn--outline mk-btn--lg"
                                onClick={(e) => goToSection(e, "plataforma")}
                            >
                                Rever a plataforma
                            </a>
                        </div>
                    </Reveal>
                </div>

            </section>


            {/* =====================================================
                RODAPÉ
            ====================================================== */}

            <footer className="mk-footer">

                <div className="mk-shell mk-footer__grid">

                    <div className="mk-footer__brand">
                        <a
                            className="mk-brand"
                            href="#hero"
                            onClick={(e) => goToSection(e, "hero")}
                        >
                            <img src="/markfy/logo.svg" alt="" aria-hidden="true" />
                            <span>Markfy</span>
                        </a>

                        <p>Agendamento simples, personalizável e do seu jeito.</p>
                    </div>

                    <nav aria-label="Plataforma">
                        <h3>Plataforma</h3>
                        <a href="#plataforma" onClick={(e) => goToSection(e, "plataforma")}>Recursos</a>
                        <a href="#recursos" onClick={(e) => goToSection(e, "recursos")}>Como funciona</a>
                        <a href="#comecar" onClick={(e) => goToSection(e, "comecar")}>Como começar</a>
                    </nav>

                    <nav aria-label="Acesso">
                        <h3>Acesso</h3>
                        <button type="button" onClick={startSignup}>Entrar</button>
                        <button type="button" onClick={startSignup}>Criar empresa</button>
                        <a href="/central-user">Central do usuário</a>
                    </nav>

                    <nav aria-label="Legal">
                        <h3>Legal</h3>
                        <a href="/privacidade">Privacidade</a>
                        <a href="/termos">Termos de uso</a>
                    </nav>

                </div>

                <div className="mk-shell mk-footer__base">
                    <span>© 2026 Markfy</span>
                    <span>Feito no Brasil</span>
                </div>

            </footer>

        </main>
    );
};

export default LandingPage;
