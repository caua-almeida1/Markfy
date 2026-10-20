import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";

import { useAuth } from "../../contexts/authContext";
import { useUserCompany } from "../../contexts/companyContext/UserCompanyContext";
import { prefetchCompaniesIndex } from "../../firebase/useCompaniesIndex";
import { useLicense } from "../../plans/LicenseContext";
import { productLabel } from "../../plans/planDefaults";
import CompanyPicker from "../../components/company-picker/CompanyPicker";

import RouteTransition from "../../components/route-transition/RouteTransition";
import { Badge, Button, useBodyClass } from "../../design-system/components";

import markfyLogo from "../../img/logo-markfy.svg";

import "./markfy-home.css";
import "./markfy-home-menus.css";

/* =========================================================
   /home — PORTA DE ENTRADA DA REDE MARKFY

   Passo 1: qual produto (Studio, Bookings ou Menus).
   Passo 2 (/home/bookings): qual jeito de usar a Bookings —
   cuidar do próprio negócio ou encontrar onde agendar.

   Com login e empresa, o topo vira o PAINEL CENTRAL: empresa
   aberta (com troca), plano, o que está liberado em cada
   produto e o atalho para continuar de onde parou. Nada de
   outra empresa aparece aqui: tudo vem do contexto da empresa
   escolhida e da licença dela.

   A escolha passa por uma transição que espera trabalho de
   verdade (pré-carregar empresas, baixar o app, aguardar
   a empresa da conta) antes de trocar de rota.
========================================================= */

/* Studio e Menus são pedaços separados do bundle (lazy em
   App.js). Baixar durante a transição deixa a abertura
   instantânea. */
const preloadStudio = () => import("../../studio/StudioApp");
const preloadMenus = () => import("../../menus/MenusApp");

const LAST_APP_KEY = "markfy:lastApp";

const readLastApp = () => {
    try {
        return window.localStorage.getItem(LAST_APP_KEY);
    } catch {
        return null;
    }
};

const rememberApp = (app) => {
    try {
        window.localStorage.setItem(LAST_APP_KEY, app);
    } catch {
        /* Navegação privada: só não lembra. */
    }
};

const APPS = {
    studio: { name: "Markfy Studio", short: "Studio", icon: "solar:pallete-2-bold-duotone", path: "/studio" },
    bookings: { name: "Markfy Bookings", short: "Bookings", icon: "solar:calendar-mark-bold-duotone", path: "/central-adm" },
    menus: { name: "Markfy Menus", short: "Menus", icon: "solar:chef-hat-bold-duotone", path: "/menus" }
};

const BookingsScene = () => (
    <div className="mkh-scene mkh-scene--bookings" aria-hidden="true">
        <div className="mkh-agenda">
            <div className="mkh-agenda__head">
                <span className="mkh-agenda__avatar">TK</span>
                <div>
                    <strong>Corte e barba</strong>
                    <small>45 min</small>
                </div>
            </div>
            <div className="mkh-agenda__days">
                {["Seg", "Ter", "Qua", "Qui", "Sex"].map((day, index) => (
                    <span key={day} className={index === 2 ? "is-active" : ""}>
                        <small>{day}</small>
                        {12 + index}
                    </span>
                ))}
            </div>
            <div className="mkh-agenda__slots">
                {["09:00", "10:30", "14:00", "16:30"].map((slot, index) => (
                    <span key={slot} className="mkh-slot" style={{ "--i": index }}>
                        <span className="mkh-slot__time">{slot}</span>
                        <span className="mkh-slot__done">
                            <Icon icon="solar:check-circle-bold" /> Reservado
                        </span>
                    </span>
                ))}
            </div>
        </div>
    </div>
);

const StudioScene = () => (
    <div className="mkh-scene mkh-scene--studio" aria-hidden="true">
        <div className="mkh-browser">
            <div className="mkh-browser__bar">
                <i /><i /><i />
                <span>markfy.app/s/seu-negocio</span>
            </div>
            <div className="mkh-browser__page">
                <div className="mkh-block mkh-block--hero">
                    <span className="mkh-line mkh-line--title" />
                    <span className="mkh-line mkh-line--sub" />
                    <span className="mkh-pill" />
                </div>
                <div className="mkh-block mkh-block--grid">
                    <span /><span /><span />
                </div>
                <div className="mkh-block mkh-block--drop">
                    <span className="mkh-line" />
                    <span className="mkh-line mkh-line--short" />
                </div>
            </div>
            <span className="mkh-cursor">
                <Icon icon="ph:cursor-fill" />
            </span>
        </div>
    </div>
);

/* Cardápio no celular: um item vai para a sacola e a mesa
   muda de estado no painel ao lado — o produto em um gesto. */
const MenusScene = () => (
    <div className="mkh-scene mkh-scene--menus" aria-hidden="true">
        <div className="mkh-phone">
            <div className="mkh-phone__cover">
                <span className="mkh-phone__logo">B</span>
                <span className="mkh-line mkh-line--title" />
            </div>
            <div className="mkh-phone__chips">
                <i className="is-on" /><i /><i />
            </div>
            {["Burger da casa", "Fritas rústicas", "Limonada"].map((name, index) => (
                <div key={name} className="mkh-dish" style={{ "--i": index }}>
                    <span className="mkh-dish__img" />
                    <span className="mkh-dish__text">
                        <b>{name}</b>
                        <small>R$ {[32, 18, 9][index]},90</small>
                    </span>
                    <span className="mkh-dish__add"><Icon icon="solar:add-circle-bold" /></span>
                </div>
            ))}
            <div className="mkh-phone__bag">
                <Icon icon="solar:bag-4-bold" /> Ver pedido · <b>1</b>
            </div>
        </div>
        <div className="mkh-tables">
            {["1", "2", "3", "4"].map((label, index) => (
                <span key={label} className={`mkh-table mkh-table--${index}`}>
                    <b>{label}</b>
                    <small>{["Livre", "Ocupada", "Preparo", "Conta"][index]}</small>
                </span>
            ))}
        </div>
    </div>
);

/* ---------- PAINEL CENTRAL ---------- */

const CentralPanel = ({ companyState, license, onOpen, lastApp, onPick }) => {
    const navigate = useNavigate();
    const company = companyState.company;
    const canSwitch = (companyState.companies?.length || 0) > 1;

    const status = license.loading
        ? { tone: undefined, label: "Verificando plano…" }
        : license.active
            ? { tone: "success", label: `${license.plan?.name || "Plano"} ativo` }
            : license.state === "expired"
                ? { tone: "warning", label: "Plano vencido" }
                : license.state === "suspended"
                    ? { tone: "danger", label: "Plano suspenso" }
                    : { tone: "warning", label: "Sem plano ativo" };

    const continueApp = lastApp && APPS[lastApp] && license.hasProduct(lastApp) ? lastApp : null;

    return (
        <section className="mkh-central mk-enter" style={{ "--i": 1 }} aria-label="Painel da empresa">
            <div className="mkh-central__company">
                <span className="mkh-central__logo" aria-hidden="true">
                    {company?.logoPreview && /^https?:/.test(company.logoPreview)
                        ? <img src={company.logoPreview} alt="" />
                        : (company?.name || "M").charAt(0).toUpperCase()}
                </span>
                <div>
                    <small>Empresa aberta</small>
                    <strong>{company?.name || companyState.companyHandle}</strong>
                    <span className="mkh-central__plan">
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {license.active && license.product && <em>{productLabel(license.product)}</em>}
                    </span>
                </div>
                {canSwitch && (
                    <Button variant="outline" size="sm" icon="solar:sort-vertical-linear" onClick={onPick}>
                        Trocar
                    </Button>
                )}
            </div>

            <ul className="mkh-central__apps">
                {Object.entries(APPS).map(([id, app]) => {
                    const allowed = license.hasProduct(id);
                    return (
                        <li key={id} className={allowed ? "is-on" : "is-off"}>
                            <Icon icon={app.icon} aria-hidden="true" />
                            <span>
                                <b>{app.short}</b>
                                <small>{license.loading ? "…" : allowed ? "Liberado no plano" : "Não incluído"}</small>
                            </span>
                            {!license.loading && (
                                allowed ? (
                                    <button type="button" onClick={() => onOpen(id)} aria-label={`Abrir ${app.name}`}>
                                        Abrir <Icon icon="solar:arrow-right-linear" />
                                    </button>
                                ) : (
                                    <button type="button" className="is-ghost" onClick={() => navigate(`/planos?produto=${id}`)}>
                                        Ver planos
                                    </button>
                                )
                            )}
                        </li>
                    );
                })}
            </ul>

            <div className="mkh-central__actions">
                {continueApp && (
                    <Button variant="primary" iconRight="solar:arrow-right-linear" onClick={() => onOpen(continueApp)}>
                        Continuar no {APPS[continueApp].short}
                    </Button>
                )}
                <Button variant="ghost" icon="solar:cup-star-linear" onClick={() => navigate("/planos")}>
                    Plano e assinatura
                </Button>
            </div>
        </section>
    );
};

const MarkfyHome = () => {
    useBodyClass("mk-bleed");

    const { step } = useParams();
    const navigate = useNavigate();

    const { currentUser } = useAuth();
    const companyState = useUserCompany();
    const license = useLicense();

    /* A transição consulta o estado mais recente da empresa
       sem ficar presa ao valor do render que a disparou. */
    const companyRef = useRef(companyState);
    companyRef.current = companyState;

    const [transition, setTransition] = useState(null);
    const [pickerOpen, setPickerOpen] = useState(false);
    const [lastApp] = useState(readLastApp);

    const isBookingsStep = step === "bookings";

    useEffect(() => {
        window.scrollTo({ top: 0 });

        document.title = isBookingsStep
            ? "Markfy Bookings — como você quer começar"
            : "Markfy — Studio, Bookings e Menus";
    }, [isBookingsStep]);

    const firstName = (currentUser?.displayName || "").split(" ")[0];

    /* Espera o contexto terminar de descobrir a empresa da
       conta (sem travar: no máximo 8s). */
    const waitForCompany = () =>
        new Promise((resolve) => {
            const started = Date.now();

            const check = () => {
                if (!companyRef.current?.loading || Date.now() - started > 8000) {
                    resolve(companyRef.current);
                    return;
                }
                setTimeout(check, 120);
            };

            check();
        });

    const goManage = () => {
        if (!currentUser) {
            navigate("/login?redirect=/central-adm");
            return;
        }

        rememberApp("bookings");

        setTransition({
            tone: "bookings",
            title: "Abrindo o painel da sua empresa",
            subtitle: "Agenda, serviços e equipe num só lugar",
            task: waitForCompany,
            to: () => {
                const state = companyRef.current;

                if (!state?.company && !state?.companies?.length) {
                    return {
                        path: "/initial-setup",
                        state: {
                            name: currentUser.displayName || "",
                            email: currentUser.email || "",
                            id: currentUser.uid
                        }
                    };
                }

                return { path: "/central-adm" };
            }
        });
    };

    const goExplore = () => {
        setTransition({
            tone: "bookings",
            title: "Preparando suas descobertas",
            subtitle: "Buscando empresas na Markfy Bookings",
            task: prefetchCompaniesIndex,
            to: () => ({ path: "/central-user" })
        });
    };

    const goStudio = () => {
        rememberApp("studio");
        setTransition({
            tone: "studio",
            title: "Abrindo o Markfy Studio",
            subtitle: currentUser ? "Carregando seu espaço de criação" : "Quase lá",
            task: preloadStudio,
            to: () => ({ path: "/studio" })
        });
    };

    const goMenus = (path = "/menus") => {
        if (path === "/menus") rememberApp("menus");
        setTransition({
            tone: "menus",
            title: path === "/menus" ? "Abrindo o Markfy Menus" : "Preparando a demonstração",
            subtitle: path === "/menus" ? "Cardápio, pedidos e mesas" : "Um restaurante de exemplo, sem cadastro",
            task: preloadMenus,
            to: () => ({ path })
        });
    };

    const openApp = (id) => {
        if (id === "studio") goStudio();
        else if (id === "menus") goMenus();
        else goManage();
    };

    const finishTransition = () => {
        const target = transition?.to?.();

        if (target) navigate(target.path, target.state ? { state: target.state } : undefined);
    };

    const manageHint = !currentUser
        ? "Entre na sua conta para continuar"
        : companyState.company?.name
            ? `Abrir ${companyState.company.name}`
            : companyState.companies?.length
                ? "Escolher entre suas empresas"
                : "Criar minha empresa";

    const showCentral = Boolean(currentUser && companyState.companyHandle && !companyState.loading && !companyState.needsCompanySelection);

    return (
        <div className="mk-root mkh">
            <header className="mkh-header">
                <a className="mkh-brand" href="/" aria-label="Markfy, página inicial">
                    <img src={markfyLogo} alt="" />
                    <span>Markfy</span>
                </a>

                {currentUser ? (
                    <span className="mkh-user">
                        <span className="mkh-user__avatar" aria-hidden="true">
                            {(firstName || currentUser.email || "M").charAt(0).toUpperCase()}
                        </span>
                        <span className="mkh-user__name">
                            {firstName ? `Olá, ${firstName}` : currentUser.email}
                        </span>
                    </span>
                ) : (
                    <Button variant="outline" size="sm" onClick={() => navigate("/login?redirect=/home")}>
                        Entrar
                    </Button>
                )}
            </header>

            <main className="mkh-main">
                {!isBookingsStep ? (
                    <section
                        key="products"
                        className="mkh-step"
                        aria-labelledby="mkh-title"
                    >
                        <div className="mkh-intro mk-enter" style={{ "--i": 0 }}>
                            <h1 id="mkh-title" className="mk-title mk-title--xl">
                                {showCentral ? "O que vamos fazer hoje?" : "Por onde você quer começar?"}
                            </h1>
                            <p className="mk-lead">
                                Três produtos, uma conta só. Crie a página do seu negócio com o Studio,
                                agende e seja agendado com a Bookings, ou monte seu cardápio digital e
                                organize pedidos e mesas com o Menus.
                            </p>
                        </div>

                        {showCentral && (
                            <CentralPanel
                                companyState={companyState}
                                license={license}
                                onOpen={openApp}
                                lastApp={lastApp}
                                onPick={() => setPickerOpen(true)}
                            />
                        )}

                        <div className="mkh-products">
                            <button
                                type="button"
                                className="mkh-product mkh-product--studio mk-enter"
                                onClick={goStudio}
                                onMouseEnter={preloadStudio}
                                onFocus={preloadStudio}
                                style={{ "--i": 2 }}
                            >
                                <StudioScene />

                                <div className="mkh-product__body">
                                    <span className="mkh-product__chip">
                                        <Icon icon="solar:pallete-2-bold-duotone" />
                                        Markfy Studio
                                    </span>
                                    <h2>A página profissional do seu negócio, pronta em minutos</h2>
                                    <p>
                                        Escolha um modelo, personalize sem código, publique e
                                        acompanhe visitas, contatos e agendamentos.
                                    </p>
                                    <span className="mkh-product__cta">
                                        Abrir o Studio
                                        <Icon icon="solar:arrow-right-linear" />
                                    </span>
                                </div>
                            </button>

                            <button
                                type="button"
                                className="mkh-product mkh-product--bookings mk-enter"
                                onClick={() => navigate("/home/bookings")}
                                style={{ "--i": 3 }}
                            >
                                <BookingsScene />

                                <div className="mkh-product__body">
                                    <span className="mkh-product__chip">
                                        <Icon icon="solar:calendar-mark-bold-duotone" />
                                        Markfy Bookings
                                    </span>
                                    <h2>Agenda online e um jeito simples de encontrar onde agendar</h2>
                                    <p>
                                        Para quem atende com hora marcada e para quem procura um
                                        horário perto de casa.
                                    </p>
                                    <span className="mkh-product__cta">
                                        Entrar na Bookings
                                        <Icon icon="solar:arrow-right-linear" />
                                    </span>
                                </div>
                            </button>

                            <div
                                className="mkh-product mkh-product--menus mk-enter"
                                style={{ "--i": 4 }}
                            >
                                <button
                                    type="button"
                                    className="mkh-product__hit"
                                    onClick={() => goMenus()}
                                    onMouseEnter={preloadMenus}
                                    onFocus={preloadMenus}
                                    aria-label="Abrir o Markfy Menus"
                                />
                                <MenusScene />

                                <div className="mkh-product__body">
                                    <span className="mkh-product__chip">
                                        <Icon icon="solar:chef-hat-bold-duotone" />
                                        Markfy Menus
                                        <em>Novo</em>
                                    </span>
                                    <h2>Cardápio digital, pedidos, mesas e comandas no mesmo lugar</h2>
                                    <p>
                                        Para restaurantes, bares, cafeterias e food trucks: publique um
                                        cardápio bonito e, se quiser, receba pedidos e gerencie o salão.
                                    </p>
                                    <span className="mkh-product__ctas">
                                        <span className="mkh-product__cta">
                                            Abrir o Menus
                                            <Icon icon="solar:arrow-right-linear" />
                                        </span>
                                        <button
                                            type="button"
                                            className="mkh-product__demo"
                                            onClick={() => goMenus("/menus/demo")}
                                        >
                                            <Icon icon="solar:play-circle-linear" />
                                            Experimentar sem cadastro
                                        </button>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>
                ) : (
                    <section
                        key="bookings"
                        className="mkh-step mkh-step--choice"
                        aria-labelledby="mkh-choice-title"
                    >
                        <div className="mkh-choice-head mk-enter" style={{ "--i": 0 }}>
                            <Button
                                variant="ghost"
                                size="sm"
                                icon="solar:arrow-left-linear"
                                onClick={() => navigate("/home")}
                            >
                                Voltar
                            </Button>

                            <span className="mkh-product__chip">
                                <Icon icon="solar:calendar-mark-bold-duotone" />
                                Markfy Bookings
                            </span>

                            <h1 id="mkh-choice-title" className="mk-title mk-title--lg">
                                Como você quer usar a Bookings?
                            </h1>
                        </div>

                        <div className="mkh-choices">
                            <button
                                type="button"
                                className="mkh-choice mk-enter"
                                onClick={goManage}
                                style={{ "--i": 1 }}
                            >
                                <span className="mkh-choice__icon">
                                    <Icon icon="solar:shop-2-bold-duotone" />
                                </span>
                                <span className="mkh-choice__text">
                                    <strong>Tenho um negócio</strong>
                                    <span>
                                        Gerencie agenda, serviços, equipe e pagamentos, ou crie sua
                                        empresa em poucos passos.
                                    </span>
                                </span>
                                <span className="mkh-choice__meta">
                                    {manageHint}
                                    <Icon icon="solar:arrow-right-linear" />
                                </span>
                            </button>

                            <button
                                type="button"
                                className="mkh-choice mk-enter"
                                onClick={goExplore}
                                onMouseEnter={prefetchCompaniesIndex}
                                style={{ "--i": 2 }}
                            >
                                <span className="mkh-choice__icon">
                                    <Icon icon="solar:compass-big-bold-duotone" />
                                </span>
                                <span className="mkh-choice__text">
                                    <strong>Quero agendar um serviço</strong>
                                    <span>
                                        Descubra empresas perto de você, veja serviços e preços e
                                        reserve seu horário.
                                    </span>
                                </span>
                                <span className="mkh-choice__meta">
                                    Explorar a Markfy Bookings
                                    <Icon icon="solar:arrow-right-linear" />
                                </span>
                            </button>
                        </div>
                    </section>
                )}
            </main>

            <RouteTransition
                active={!!transition}
                tone={transition?.tone}
                title={transition?.title}
                subtitle={transition?.subtitle}
                task={transition?.task}
                onDone={finishTransition}
            />

            {pickerOpen && <CompanyPicker variant="modal" onClose={() => setPickerOpen(false)} />}
        </div>
    );
};

export default MarkfyHome;
