import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";

import { useAuth } from "../../contexts/authContext";
import { useUserCompany } from "../../contexts/companyContext/UserCompanyContext";
import { prefetchCompaniesIndex } from "../../firebase/useCompaniesIndex";

import RouteTransition from "../../components/route-transition/RouteTransition";
import { Button, useBodyClass } from "../../design-system/components";

import markfyLogo from "../../img/logo-markfy.svg";

import "./markfy-home.css";

/* =========================================================
   /home — PORTA DE ENTRADA DA REDE MARKFY

   Passo 1: qual produto (Bookings ou Studio).
   Passo 2 (/home/bookings): qual jeito de usar a Bookings —
   cuidar do próprio negócio ou encontrar onde agendar.

   A escolha passa por uma transição que espera trabalho de
   verdade (pré-carregar empresas, baixar o Studio, aguardar
   a empresa da conta) antes de trocar de rota.
========================================================= */

/* O Studio é um pedaço separado do bundle (lazy em App.js).
   Baixar durante a transição deixa a abertura instantânea. */
const preloadStudio = () => import("../../studio/StudioApp");

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

const MarkfyHome = () => {
    useBodyClass("mk-bleed");

    const { step } = useParams();
    const navigate = useNavigate();

    const { currentUser } = useAuth();
    const companyState = useUserCompany();

    /* A transição consulta o estado mais recente da empresa
       sem ficar presa ao valor do render que a disparou. */
    const companyRef = useRef(companyState);
    companyRef.current = companyState;

    const [transition, setTransition] = useState(null);

    const isBookingsStep = step === "bookings";

    useEffect(() => {
        window.scrollTo({ top: 0 });

        document.title = isBookingsStep
            ? "Markfy Bookings — como você quer começar"
            : "Markfy — Bookings e Studio";
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
        setTransition({
            tone: "studio",
            title: "Abrindo o Markfy Studio",
            subtitle: currentUser ? "Carregando seu espaço de criação" : "Quase lá",
            task: preloadStudio,
            to: () => ({ path: "/studio" })
        });
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
                                        Por onde você quer começar?
                                    </h1>
                                    <p className="mk-lead">
                                        Dois produtos, uma conta só. Agende e seja agendado com a
                                        Bookings, ou crie a página do seu negócio com o Studio.
                                    </p>
                                </div>

                                <div className="mkh-products">
                                    <button
                                        type="button"
                                        className="mkh-product mkh-product--bookings mk-enter"
                                        onClick={() => navigate("/home/bookings")}
                                        style={{ "--i": 1 }}
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
                                                <em>Novo</em>
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
        </div>
    );
};

export default MarkfyHome;
