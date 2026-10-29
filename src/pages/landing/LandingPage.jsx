import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { v4 as uuidv4 } from "uuid";

import { HeroFan, HowToScene, SHOWCASES } from "./visuals";
import { useInView, useScrollProgress, useScrollScene } from "./hooks";
import {
    CLIENT_STEPS,
    FACTS,
    FAQ,
    HERO_AUDIENCE,
    HOW_TO_STEPS,
    PRODUCTS,
    SEGMENTS
} from "./landingContent";

import { useAuth } from "../../contexts/authContext";
import { useUserCompany } from "../../contexts/companyContext/UserCompanyContext";
import { useConsent } from "../../contexts/consentContext/ConsentContext";
import { usePlanCatalog } from "../../plans/LicenseContext";
import {
    describeLimit,
    featuresFor,
    formatPrice,
    limitsFor,
    planProducts,
    priceFor,
    PRODUCT_SHORT
} from "../../plans/planDefaults";

import { usePageMeta } from "../../hooks/usePageMeta";
import { CONTACT_EMAIL, SITE_URL, whatsappUrl } from "../../config/site";

import "./landingPage.css";

/* =========================================================
   DADOS ESTRUTURADOS DA LANDING

   FAQPage e HowTo saem do MESMO conteúdo que está na tela
   (landingContent.js). É o que buscadores e assistentes de
   IA usam para responder "como criar agenda online" ou "o
   que é a Markfy" citando a página. O script é removido ao
   sair da rota.
========================================================= */

const useLandingSchema = () => {
    useEffect(() => {
        const schema = {
            "@context": "https://schema.org",
            "@graph": [
                {
                    "@type": "FAQPage",
                    "@id": `${SITE_URL}/#faq`,
                    inLanguage: "pt-BR",
                    mainEntity: FAQ.map((item) => ({
                        "@type": "Question",
                        name: item.q,
                        acceptedAnswer: { "@type": "Answer", text: item.a }
                    }))
                },
                {
                    "@type": "HowTo",
                    "@id": `${SITE_URL}/#como-usar`,
                    name: "Como criar a agenda online da sua empresa na Markfy",
                    inLanguage: "pt-BR",
                    step: HOW_TO_STEPS.map((item, index) => ({
                        "@type": "HowToStep",
                        position: index + 1,
                        name: item.title,
                        text: item.text,
                        url: `${SITE_URL}/#como-usar`
                    }))
                },
                ...PRODUCTS.map((product) => ({
                    "@type": "SoftwareApplication",
                    "@id": `${SITE_URL}/#${product.id}`,
                    name: product.name,
                    applicationCategory: "BusinessApplication",
                    operatingSystem: "Web",
                    inLanguage: "pt-BR",
                    description: `${product.title}. ${product.lede}`,
                    featureList: product.points,
                    url: `${SITE_URL}/#${product.id}`,
                    publisher: { "@id": `${SITE_URL}/#organization` }
                }))
            ]
        };

        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.dataset.landing = "true";
        script.textContent = JSON.stringify(schema);
        document.head.appendChild(script);

        return () => script.remove();
    }, []);
};

/* =========================================================
   ENTRADA DA EMPRESA

   O mesmo botão "Criar minha empresa" serve a três pessoas:
     - sem login: abre o modal que pede conta;
     - com login e sem empresa (inclusive primeiro acesso):
       vai direto para a criação (/newcompany/<id>);
     - com empresa: vai para o painel central (/home).
========================================================= */

const useCompanyEntry = () => {
    const navigate = useNavigate();
    const { userLoggedIn } = useAuth();
    const { company, companies, loading } = useUserCompany();

    const [askAccount, setAskAccount] = useState(false);

    const hasCompany = Boolean(company) || (companies?.length || 0) > 0;

    const startCompany = useCallback(() => {
        if (!userLoggedIn) {
            setAskAccount(true);
            return;
        }

        /* Ainda descobrindo as empresas da conta: o painel
           central resolve sozinho. */
        if (loading || hasCompany) {
            navigate("/home");
            return;
        }

        navigate(`/newcompany/${uuidv4()}`);
    }, [userLoggedIn, loading, hasCompany, navigate]);

    const openPlans = useCallback(() => {
        if (userLoggedIn && hasCompany) {
            navigate("/planos");
            return;
        }

        startCompany();
    }, [userLoggedIn, hasCompany, navigate, startCompany]);

    const goToAuth = useCallback((mode) => {
        /* Depois da conta, a pessoa cai direto na criação. */
        const redirect = encodeURIComponent(`/newcompany/${uuidv4()}`);

        navigate(`/${mode === "register" ? "register" : "login"}?redirect=${redirect}`);
    }, [navigate]);

    return {
        userLoggedIn,
        hasCompany,
        startLabel: userLoggedIn && hasCompany ? "Abrir meu painel" : "Criar minha empresa",
        startCompany,
        openPlans,
        askAccount,
        closeAsk: () => setAskAccount(false),
        goToAuth
    };
};

/* =========================================================
   MODAL "PRECISA DE CONTA" — vidro líquido
========================================================= */

const AccountModal = ({ open, onClose, onChoose }) => {
    const dialogRef = useRef(null);

    useEffect(() => {
        if (!open) return undefined;

        const previous = document.activeElement;
        const node = dialogRef.current;

        node?.querySelector("[data-autofocus]")?.focus();

        const onKey = (event) => {
            if (event.key === "Escape") {
                onClose();
                return;
            }

            /* Foco preso dentro do modal. */
            if (event.key === "Tab" && node) {
                const items = node.querySelectorAll("button, a[href]");
                const first = items[0];
                const last = items[items.length - 1];

                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        };

        document.addEventListener("keydown", onKey);
        document.body.classList.add("mk-locked");

        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.classList.remove("mk-locked");
            previous?.focus?.();
        };
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div className="mkmodal" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
            <div
                className="mkmodal__card mk-glass"
                role="dialog"
                aria-modal="true"
                aria-labelledby="mkmodal-title"
                aria-describedby="mkmodal-text"
                ref={dialogRef}
            >
                <button type="button" className="mkmodal__close" onClick={onClose} aria-label="Fechar">
                    <Icon icon="solar:close-circle-linear" />
                </button>

                <span className="mkmodal__icon" aria-hidden="true">
                    <img src="/markfy/logo.svg" alt="" />
                </span>

                <h2 id="mkmodal-title">Para criar sua empresa, entre na sua conta</h2>

                <p id="mkmodal-text">
                    A empresa fica ligada a uma conta Markfy: é com ela que você
                    administra a agenda, a equipe e o plano. Criar a conta é
                    gratuito e leva menos de um minuto.
                </p>

                <div className="mkmodal__actions">
                    <button
                        type="button"
                        className="mkl-btn mkl-btn--solid mkl-btn--lg"
                        onClick={() => onChoose("register")}
                        data-autofocus
                    >
                        Criar conta grátis
                    </button>

                    <button
                        type="button"
                        className="mkl-btn mkl-btn--ghost mkl-btn--lg"
                        onClick={() => onChoose("login")}
                    >
                        Já tenho conta, entrar
                    </button>
                </div>

                <small className="mkmodal__note">
                    Depois do cadastro você segue direto para a criação da empresa.
                </small>
            </div>
        </div>
    );
};

/* =========================================================
   PEQUENOS BLOCOS
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

const RotatingWord = ({ words }) => {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => setIndex((value) => (value + 1) % words.length), 2400);

        return () => clearInterval(timer);
    }, [words.length]);

    return (
        <span className="mkrot">
            {/* Todas as palavras ficam no HTML (busca e leitores
                de tela leem a lista); só uma aparece. */}
            <span className="mk-sr">{words.join(", ")}</span>
            <span className="mkrot__track" aria-hidden="true">
                {words.map((word, i) => (
                    <span key={word} className={i === index ? "is-on" : ""}>{word}</span>
                ))}
            </span>
        </span>
    );
};

/* Palavra gigante que se abre com o scroll. */
const Wordmark = () => {
    const { trackRef, stageRef } = useScrollScene({ steps: 1 });

    return (
        <div className="mkword__track" ref={trackRef}>
            <div className="mkword__stage" ref={stageRef}>
                <p className="mkword__text" aria-hidden="true">
                    {"Markfy".split("").map((letter, index) => (
                        <span key={index} style={{ "--i": index }}>{letter}</span>
                    ))}
                </p>
                <p className="mkword__caption">
                    Agenda, site e cardápio. Uma conta, um painel.
                </p>
            </div>
        </div>
    );
};

/* =========================================================
   PLANOS — catálogo publicado (planCatalog, leitura pública)
========================================================= */

const PLAN_PRODUCTS = ["bookings", "studio", "menus"];

const Plans = ({ onChoose, chooseLabel }) => {
    const { catalog, loading } = usePlanCatalog();
    const [product, setProduct] = useState("bookings");

    const plans = useMemo(() => catalog.filter((plan) => plan.active), [catalog]);
    const singles = plans.filter((plan) => !plan.bundle);
    const bundles = plans.filter((plan) => plan.bundle);

    const renderPlan = (plan, products) => {
        const price = priceFor(plan, products.length === 1 ? products[0] : product);
        const features = featuresFor(products);
        const limits = limitsFor(products);

        return (
            <article
                key={plan.id}
                className={`mkplan ${plan.highlight ? "mkplan--star" : ""} ${plan.bundle ? "mkplan--bundle" : ""}`}
                style={{ "--plan": plan.color }}
            >
                <header>
                    <span className="mkplan__tier">{plan.tier}</span>
                    <h3>{plan.name}</h3>
                    <p>{plan.tagline}</p>
                </header>

                <p className="mkplan__price">
                    <strong>{formatPrice(price)}</strong>
                    <span>a cada {plan.periodDays} dias</span>
                </p>

                <p className="mkplan__products">
                    {products.map((id) => (
                        <span key={id}>{PRODUCT_SHORT[id]}</span>
                    ))}
                </p>

                <ul>
                    {limits.map((limit) => (
                        <li key={limit.id}>
                            <Icon icon="solar:check-circle-bold" />
                            {describeLimit(limit, plan.limits[limit.id])}
                            {plan.limits[limit.id] !== null && plan.limits[limit.id] !== undefined
                                ? ` (${limit.label.toLowerCase()})`
                                : ""}
                        </li>
                    ))}
                    {features.map((feature) => (
                        <li key={feature.id} className={plan.features[feature.id] ? "" : "is-off"}>
                            <Icon icon={plan.features[feature.id] ? "solar:check-circle-bold" : "solar:minus-circle-linear"} />
                            {feature.label}
                        </li>
                    ))}
                </ul>

                <button
                    type="button"
                    className={`mkl-btn mkl-btn--lg ${plan.highlight ? "mkl-btn--solid" : "mkl-btn--ghost"}`}
                    onClick={onChoose}
                >
                    {chooseLabel(plan)}
                </button>
            </article>
        );
    };

    return (
        <div className={`mkplans ${loading ? "is-loading" : ""}`}>
            {singles.length > 0 && (
                <>
                    <div className="mkplans__head">
                        <h3>Um produto</h3>

                        <div className="mkseg mk-glass" role="radiogroup" aria-label="Produto do plano individual">
                            {PLAN_PRODUCTS.map((id) => (
                                <button
                                    key={id}
                                    type="button"
                                    role="radio"
                                    aria-checked={product === id}
                                    className={product === id ? "is-on" : ""}
                                    onClick={() => setProduct(id)}
                                >
                                    {PRODUCT_SHORT[id]}
                                </button>
                            ))}
                            <span
                                className="mkseg__thumb"
                                style={{ "--x": PLAN_PRODUCTS.indexOf(product) }}
                                aria-hidden="true"
                            />
                        </div>
                    </div>

                    <div className="mkplans__grid">
                        {singles.map((plan) => renderPlan(plan, [product]))}
                    </div>
                </>
            )}

            {bundles.length > 0 && (
                <>
                    <div className="mkplans__head">
                        <h3>Pacotes</h3>
                        <p>Mais de um produto no mesmo plano, por um preço só.</p>
                    </div>

                    <div className="mkplans__grid mkplans__grid--bundles">
                        {bundles.map((plan) => renderPlan(plan, planProducts(plan)))}
                    </div>
                </>
            )}
        </div>
    );
};

/* =========================================================
   FAQ — acordeão. As respostas ficam sempre no HTML
   (colapsadas por altura, não removidas).
========================================================= */

const Faq = () => {
    const [open, setOpen] = useState(0);

    return (
        <div className="mkfaq">
            {FAQ.map((item, index) => {
                const isOpen = open === index;
                const id = `mkfaq-${index}`;

                return (
                    <div key={item.q} className={`mkfaq__item ${isOpen ? "is-open" : ""}`}>
                        <h3>
                            <button
                                type="button"
                                aria-expanded={isOpen}
                                aria-controls={id}
                                onClick={() => setOpen(isOpen ? -1 : index)}
                            >
                                {item.q}
                                <span className="mkfaq__icon" aria-hidden="true" />
                            </button>
                        </h3>
                        <div className="mkfaq__body" id={id} role="region">
                            <div>
                                <p>{item.a}</p>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

/* =========================================================
   PÁGINA
========================================================= */

const NAV = [
    { id: "produtos", label: "Produtos" },
    { id: "como-usar", label: "Como usar" },
    { id: "planos", label: "Planos" },
    { id: "perguntas", label: "Perguntas" }
];

const LandingPage = () => {
    const navigate = useNavigate();

    /* Título e descrição padrão (config/site.js) + canonical. */
    usePageMeta({ path: "/" });
    useLandingSchema();

    const { openPreferences: openConsentPreferences } = useConsent();
    const { progress, scrolled } = useScrollProgress();

    const entry = useCompanyEntry();

    const [menuOpen, setMenuOpen] = useState(false);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        // O CSS de outras telas é global no CRA e trava
        // html/body em height:100%. A landing rola livre,
        // então marcamos os dois e devolvemos ao sair.
        document.body.classList.add("landing-active");
        document.documentElement.classList.add("landing-root");

        /* Dispara a sequência de entrada do hero no próximo
           frame, depois do primeiro paint. */
        const frame = requestAnimationFrame(() => setLoaded(true));

        return () => {
            cancelAnimationFrame(frame);
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

        const offset = target.getBoundingClientRect().top + window.scrollY - 84;

        window.scrollTo({ top: offset, behavior: "smooth" });
        window.history.replaceState(null, "", `#${id}`);
    };

    const runAction = (item) => {
        if (item.action === "create") {
            entry.startCompany();
            return;
        }

        navigate(item.href);
    };

    const startCompany = () => {
        setMenuOpen(false);
        entry.startCompany();
    };

    return (
        <main className={`mk-landing ${loaded ? "is-loaded" : ""}`}>

            <a className="mk-skip" href="#inicio">Ir para o conteúdo</a>

            <div
                className="mk-progress"
                style={{ transform: `scaleX(${progress})` }}
                aria-hidden="true"
            />

            {/* =====================================================
                CABEÇALHO — pílula de vidro flutuante
            ====================================================== */}

            <header className={`mk-header ${scrolled ? "is-scrolled" : ""} ${menuOpen ? "is-open" : ""}`}>
                <div className="mk-header__bar mk-glass">

                    <a className="mk-brand" href="#inicio" onClick={(event) => goToSection(event, "inicio")}>
                        <img src="/markfy/logo.svg" alt="" aria-hidden="true" />
                        <span>Markfy</span>
                    </a>

                    <nav className="mk-nav" aria-label="Seções da página">
                        {NAV.map((item) => (
                            <a key={item.id} href={`#${item.id}`} onClick={(event) => goToSection(event, item.id)}>
                                {item.label}
                            </a>
                        ))}
                    </nav>

                    <div className="mk-header__actions">
                        {entry.userLoggedIn ? (
                            <button type="button" className="mkl-btn mkl-btn--quiet" onClick={() => navigate("/home")}>
                                Minha conta
                            </button>
                        ) : (
                            <button type="button" className="mkl-btn mkl-btn--quiet" onClick={() => navigate("/login")}>
                                Entrar
                            </button>
                        )}

                        <button type="button" className="mkl-btn mkl-btn--solid" onClick={startCompany}>
                            {entry.startLabel}
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
                        <span /><span />
                    </button>
                </div>

                <div id="mk-mobile-menu" className="mk-mobile mk-glass" hidden={!menuOpen}>
                    {NAV.map((item, index) => (
                        <a
                            key={item.id}
                            href={`#${item.id}`}
                            onClick={(event) => goToSection(event, item.id)}
                            style={{ "--i": index }}
                        >
                            {item.label}
                        </a>
                    ))}

                    <div className="mk-mobile__actions">
                        <button
                            type="button"
                            className="mkl-btn mkl-btn--ghost mkl-btn--lg"
                            onClick={() => navigate(entry.userLoggedIn ? "/home" : "/login")}
                        >
                            {entry.userLoggedIn ? "Minha conta" : "Entrar"}
                        </button>
                        <button type="button" className="mkl-btn mkl-btn--solid mkl-btn--lg" onClick={startCompany}>
                            {entry.startLabel}
                        </button>
                    </div>
                </div>
            </header>

            {/* =====================================================
                HERO — céu Markfy com anéis e arco de cartões
            ====================================================== */}

            <section id="inicio" className="mk-hero" aria-labelledby="mk-hero-title">

                <div className="mk-hero__sky" aria-hidden="true">
                    <span className="mk-hero__ring mk-hero__ring--1" />
                    <span className="mk-hero__ring mk-hero__ring--2" />
                    <span className="mk-hero__ring mk-hero__ring--3" />
                    <span className="mk-hero__cloud mk-hero__cloud--1" />
                    <span className="mk-hero__cloud mk-hero__cloud--2" />
                    <span className="mk-hero__grain" />
                </div>

                <div className="mk-shell mk-hero__copy">

                    <p className="mk-hero__badge mk-glass">
                        <span className="mk-hero__badge-dot" aria-hidden="true" />
                        Feito para <RotatingWord words={HERO_AUDIENCE} />
                    </p>

                    <h1 className="mk-hero__title" id="mk-hero-title">
                        <span className="mk-hero__line">Agenda online, site</span>
                        <span className="mk-hero__line">
                            e cardápio
                            <span className="mk-hero__switch" aria-hidden="true"><i /></span>
                            digital
                        </span>
                        <span className="mk-hero__line mk-hero__line--soft">para o seu negócio.</span>
                    </h1>

                    <p className="mk-hero__lede">
                        A Markfy coloca sua empresa na internet num link só: o cliente
                        agenda, faz o pedido ou conhece o seu trabalho sem ligar e sem
                        instalar nada. Você acompanha tudo de um painel.
                    </p>

                    <div className="mk-hero__actions">
                        <button type="button" className="mkl-btn mkl-btn--light mkl-btn--xl" onClick={startCompany}>
                            {entry.startLabel}
                            <span className="mkl-btn__orb" aria-hidden="true">
                                <Icon icon="solar:arrow-right-up-linear" />
                            </span>
                        </button>

                        <a
                            href="#como-usar"
                            className="mkl-btn mkl-btn--glass mkl-btn--xl"
                            onClick={(event) => goToSection(event, "como-usar")}
                        >
                            Ver como funciona
                        </a>
                    </div>

                    <p className="mk-hero__note">
                        Criar a conta e a empresa é gratuito. O plano só entra quando você for atender.
                    </p>
                </div>

                <HeroFan />
            </section>

            {/* =====================================================
                SEGMENTOS
            ====================================================== */}

            <section className="mk-marquee" aria-label="Tipos de negócio atendidos">
                <div className="mk-marquee__track">
                    {[0, 1].map((copy) => (
                        <ul className="mk-marquee__group" key={copy} aria-hidden={copy === 1}>
                            {SEGMENTS.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    ))}
                </div>
            </section>

            {/* =====================================================
                O QUE É
            ====================================================== */}

            <section id="o-que-e" className="mk-section mk-about" aria-labelledby="mk-about-title">
                <div className="mk-shell">
                    <Reveal as="h2" className="mk-about__title" id="mk-about-title">
                        A Markfy é a plataforma brasileira que
                        <span className="mk-inline-icon mk-inline-icon--blue" aria-hidden="true">
                            <Icon icon="solar:calendar-mark-bold" />
                        </span>
                        agenda, publica
                        <span className="mk-inline-icon mk-inline-icon--ice" aria-hidden="true">
                            <Icon icon="solar:pallete-2-bold" />
                        </span>
                        e vende
                        <span className="mk-inline-icon mk-inline-icon--signal" aria-hidden="true">
                            <Icon icon="solar:chef-hat-bold" />
                        </span>
                        <span className="mk-about__soft">para pequenos negócios.</span>
                    </Reveal>

                    <div className="mk-bento">
                        <Reveal className="mk-bento__card mk-bento__card--sky">
                            <span className="mk-bento__glass mk-glass">
                                <strong>{FACTS[0].value}</strong>
                                <span>{FACTS[0].label}</span>
                            </span>
                        </Reveal>

                        <Reveal delay={80} className="mk-bento__card mk-bento__card--paper">
                            <strong>{FACTS[1].value}</strong>
                            <span>{FACTS[1].label}</span>
                            <ol className="mk-bento__client" aria-label="Como o cliente agenda">
                                {CLIENT_STEPS.map((item) => (
                                    <li key={item.text}>
                                        <Icon icon={item.icon} aria-hidden="true" />
                                        {item.text}
                                    </li>
                                ))}
                            </ol>
                        </Reveal>

                        <Reveal delay={160} className="mk-bento__card mk-bento__card--signal">
                            <strong>{FACTS[2].value}</strong>
                            <span>{FACTS[2].label}: tudo abre no navegador do celular.</span>
                        </Reveal>

                        <Reveal delay={220} className="mk-bento__card mk-bento__card--ink">
                            <span>{FACTS[3].label}</span>
                            <strong>{FACTS[3].value}</strong>
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* =====================================================
                PRODUTOS
            ====================================================== */}

            <section id="produtos" className="mk-section mk-products" aria-labelledby="mk-products-title">
                <div className="mk-shell mk-products__intro">
                    <div>
                        <h2 className="mk-h2" id="mk-products-title">Três produtos, uma conta</h2>
                        <p className="mk-lede">
                            Comece pelo que o seu negócio precisa hoje e ative os outros quando quiser.
                            A empresa, a equipe e os dados são os mesmos nos três.
                        </p>
                    </div>

                    <div className="mk-capsules" aria-hidden="true">
                        {[...PRODUCTS.map((product) => product.name), "Um painel só"].map((label, index) => (
                            <span key={label} className="mk-capsule" style={{ "--i": index }}>
                                <em>{label}</em>
                            </span>
                        ))}
                    </div>
                </div>

                {PRODUCTS.map((product, index) => {
                    const Showcase = SHOWCASES[product.id];

                    return (
                        <article
                            key={product.id}
                            id={product.id}
                            className={`mk-product mk-product--${product.id} ${index % 2 ? "is-flipped" : ""}`}
                            aria-labelledby={`mk-${product.id}-title`}
                        >
                            <div className="mk-shell mk-product__grid">
                                <Reveal className="mk-product__copy">
                                    <p className="mk-product__name">
                                        <Icon icon={product.icon} aria-hidden="true" />
                                        {product.name}
                                    </p>
                                    <h3 className="mk-product__title" id={`mk-${product.id}-title`}>
                                        {product.title}
                                    </h3>
                                    <p className="mk-product__lede">{product.lede}</p>

                                    <ul className="mk-product__points">
                                        {product.points.map((point) => (
                                            <li key={point}>
                                                <Icon icon="solar:check-circle-bold" aria-hidden="true" />
                                                {point}
                                            </li>
                                        ))}
                                    </ul>

                                    <div className="mk-product__actions">
                                        <button
                                            type="button"
                                            className="mkl-btn mkl-btn--solid mkl-btn--lg"
                                            onClick={() => runAction(product.cta)}
                                        >
                                            {product.cta.action === "create" && entry.hasCompany && entry.userLoggedIn
                                                ? entry.startLabel
                                                : product.cta.label}
                                        </button>
                                        {product.secondary && (
                                            <a className="mkl-btn mkl-btn--ghost mkl-btn--lg" href={product.secondary.href}>
                                                {product.secondary.label}
                                            </a>
                                        )}
                                    </div>
                                </Reveal>

                                <Reveal delay={120} className="mk-product__visual">
                                    <Showcase />
                                </Reveal>
                            </div>
                        </article>
                    );
                })}
            </section>

            {/* =====================================================
                COMO USAR — cena presa ao scroll
            ====================================================== */}

            <section id="como-usar" className="mk-how" aria-labelledby="como-usar-titulo">
                <HowToScene />
            </section>

            <Wordmark />

            {/* =====================================================
                PLANOS
            ====================================================== */}

            <section id="planos" className="mk-section mk-pricing" aria-labelledby="mk-pricing-title">
                <div className="mk-shell">
                    <div className="mk-pricing__head">
                        <h2 className="mk-h2" id="mk-pricing-title">Planos da Markfy</h2>
                        <p className="mk-lede">
                            O plano é da empresa e renova a cada período. Criar a conta e cadastrar a empresa
                            não custa nada: você escolhe o plano quando estiver pronto para atender.
                        </p>
                    </div>

                    <Plans
                        onChoose={entry.openPlans}
                        chooseLabel={(plan) => (entry.userLoggedIn && entry.hasCompany ? `Assinar ${plan.name}` : `Começar com o ${plan.name}`)}
                    />
                </div>
            </section>

            {/* =====================================================
                PERGUNTAS FREQUENTES
            ====================================================== */}

            <section id="perguntas" className="mk-section mk-faq-section" aria-labelledby="mk-faq-title">
                <div className="mk-shell mk-faq-grid">
                    <div className="mk-faq-aside">
                        <h2 className="mk-h2" id="mk-faq-title">Perguntas frequentes</h2>
                        <p className="mk-lede">
                            Não achou a resposta? Escreva para{" "}
                            <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
                        </p>
                    </div>
                    <Faq />
                </div>
            </section>

            {/* =====================================================
                CTA FINAL
            ====================================================== */}

            <section className="mk-final" aria-labelledby="mk-final-title">
                <div className="mk-shell">
                    <div className="mk-final__box">
                        <span className="mk-final__rings" aria-hidden="true"><i /><i /><i /></span>

                        <h2 id="mk-final-title">Sua empresa pode estar no ar hoje.</h2>
                        <p>Crie a conta, cadastre a empresa e compartilhe o link. A agenda trabalha enquanto você atende.</p>

                        <div className="mk-final__actions">
                            <button type="button" className="mkl-btn mkl-btn--light mkl-btn--xl" onClick={startCompany}>
                                {entry.startLabel}
                                <span className="mkl-btn__orb" aria-hidden="true">
                                    <Icon icon="solar:arrow-right-up-linear" />
                                </span>
                            </button>
                            <a className="mkl-btn mkl-btn--glass mkl-btn--xl" href="/central-user">
                                Encontrar empresas
                            </a>
                        </div>
                    </div>
                </div>
            </section>

            {/* =====================================================
                RODAPÉ
            ====================================================== */}

            <footer className="mk-footer">
                <div className="mk-shell mk-footer__grid">

                    <div className="mk-footer__brand">
                        <a className="mk-brand" href="#inicio" onClick={(event) => goToSection(event, "inicio")}>
                            <img src="/markfy/logo.svg" alt="" aria-hidden="true" />
                            <span>Markfy</span>
                        </a>
                        <p>Agenda online, site e cardápio digital para pequenos negócios.</p>
                    </div>

                    <nav aria-label="Produtos">
                        <h3>Produtos</h3>
                        <a href="#bookings" onClick={(event) => goToSection(event, "bookings")}>Markfy Bookings</a>
                        <a href="#studio" onClick={(event) => goToSection(event, "studio")}>Markfy Studio</a>
                        <a href="#menus" onClick={(event) => goToSection(event, "menus")}>Markfy Menus</a>
                        <a href="/menus/demo">Demonstração do cardápio</a>
                    </nav>

                    <nav aria-label="Acesso">
                        <h3>Acesso</h3>
                        <a href="/login">Entrar</a>
                        <button type="button" onClick={startCompany}>{entry.startLabel}</button>
                        <a href="/central-user">Encontrar empresas</a>
                        <a href="/home">Painel central</a>
                    </nav>

                    <nav aria-label="Contato">
                        <h3>Contato</h3>
                        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                        {/* Só com número oficial configurado
                            (REACT_APP_WHATSAPP_NUMBER). */}
                        {whatsappUrl() && (
                            <a
                                href={whatsappUrl("Olá! Vim pelo site da Markfy e quero saber mais.")}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                WhatsApp
                            </a>
                        )}
                    </nav>

                    <nav aria-label="Legal">
                        <h3>Legal</h3>
                        <a href="/privacidade">Privacidade</a>
                        <a href="/termos">Termos de uso</a>
                        {/* LGPD, Art. 8º, §5º: a escolha de cookies
                            tem que continuar acessível depois de
                            feita. */}
                        <button type="button" onClick={openConsentPreferences}>
                            Preferências de cookies
                        </button>
                    </nav>
                </div>

                <div className="mk-shell mk-footer__base">
                    <span>© {new Date().getFullYear()} Markfy</span>
                    <span>Feito no Brasil</span>
                </div>
            </footer>

            <AccountModal
                open={entry.askAccount}
                onClose={entry.closeAsk}
                onChoose={(mode) => {
                    entry.closeAsk();
                    entry.goToAuth(mode);
                }}
            />
        </main>
    );
};

export default LandingPage;
