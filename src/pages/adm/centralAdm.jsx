import React, { useState, useEffect } from "react";
import TabBarAdm from "../../components/tabbarADM/";
import Dashboard from "./dashboardAdm/dashboard";
import Orders from "./ordersAdm/orders";
import Products from "./productsAdm/productsAdm";
import Schedules from "./schedulesAdm/schedulesAdm";
import PerfilAdm from "./perfilAdm/perfilAdm";

import { useUserCompany } from "../../contexts/companyContext/UserCompanyContext"; // 🟢 importa o contexto

import markfyLogo from "../../img/logo-markfy.svg";

import "./centralAdm.css";

const CentralAdm = () => {
    const { user, company, loading } = useUserCompany(); // 🟢 obtém dados do usuário logado e empresa
    const tabs = ["home", "pedidos", "produtos", "horarios", "perfil"];
    const [activeTab, setActiveTab] = useState("home");
    const [prevTab, setPrevTab] = useState("home");

    const [openProductsModal, setOpenProductsModal] = useState(false);
    const [profileInitialScreen, setProfileInitialScreen] = useState("home");

    useEffect(() => {
        const shouldReload = sessionStorage.getItem("forceAdminReload");

        if (shouldReload) {
            sessionStorage.removeItem("forceAdminReload");
            window.location.reload();
        }
    }, []);


    useEffect(() => {

        const params =
            new URLSearchParams(
                window.location.search
            );

        if (
            params.get("mercadoPago") === "connected"
        ) {

            setProfileInitialScreen("payment-card");
            setActiveTab("perfil");

            params.delete("mercadoPago");

            const cleanUrl =
                window.location.pathname +
                (
                    params.toString()
                        ? `?${params.toString()}`
                        : ""
                );

            window.history.replaceState(
                {},
                document.title,
                cleanUrl
            );

        }

    }, []);

    const handleTabChange = (tab, options = {}) => {

        setPrevTab(activeTab);

        if (tab === "perfil") {

            setProfileInitialScreen(
                options.initialScreen || "home"
            );

        }

        setActiveTab(tab);

        if (
            tab === "produtos" &&
            options.openModal
        ) {

            setOpenProductsModal(true);

        } else {

            setOpenProductsModal(false);

        }
    };

    const getDirection = () => {
        const activeIndex = tabs.indexOf(activeTab);
        const prevIndex = tabs.indexOf(prevTab);
        return activeIndex > prevIndex ? "right" : "left";
    };

    if (loading) {
        return (
            <div className="central-adm-loading">

                {/* A espera aqui não é instantânea: o contexto
                    precisa achar a empresa da pessoa, ler o
                    cargo e só então liberar o painel. Uma linha
                    de texto parada nesse tempo parece travada —
                    o pulso da logo é o que diz que algo está
                    acontecendo. */}

                <div className="central-adm-loading__mark">

                    <span className="central-adm-loading__pulse" />
                    <span className="central-adm-loading__pulse central-adm-loading__pulse--delayed" />

                    <img
                        src={markfyLogo}
                        alt=""
                        aria-hidden="true"
                    />

                </div>

                <div className="central-adm-loading__text">

                    <strong>Buscando sua empresa</strong>

                    <p>Só um instante, estamos preparando seu painel.</p>

                </div>

                <div
                    className="central-adm-loading__bar"
                    role="status"
                    aria-live="polite"
                    aria-label="Carregando dados da empresa"
                >
                    <span />
                </div>

            </div>
        );
    }

    if (!company) {
        return (
            <main className="central-adm-no-company">

                <div className="central-adm-no-company__background">
                    <span className="central-adm-no-company__orb central-adm-no-company__orb--one" />
                    <span className="central-adm-no-company__orb central-adm-no-company__orb--two" />
                </div>

                <section className="central-adm-no-company__card">

                    {/* ==========================================
                    ÁREA VISUAL
                ========================================== */}

                    <div className="central-adm-no-company__visual">

                        <div className="central-adm-no-company__visual-logo">
                            <img
                                src={markfyLogo}
                                alt="Markfy"
                            />
                        </div>

                        <div className="central-adm-no-company__illustration">

                            <div className="central-adm-no-company__illustration-glow" />

                            <div className="central-adm-no-company__building">

                                <div className="central-adm-no-company__building-roof" />

                                <div className="central-adm-no-company__building-body">

                                    <div className="central-adm-no-company__building-window" />
                                    <div className="central-adm-no-company__building-window" />
                                    <div className="central-adm-no-company__building-window" />

                                    <div className="central-adm-no-company__building-door" />

                                </div>

                            </div>

                            <div className="central-adm-no-company__illustration-card central-adm-no-company__illustration-card--top">
                                <span />
                                <span />
                                <span />
                            </div>

                            <div className="central-adm-no-company__illustration-card central-adm-no-company__illustration-card--bottom">
                                <div />
                                <div />
                            </div>

                        </div>

                        <div className="central-adm-no-company__visual-text">

                            <span>
                                Espaço de trabalho
                            </span>

                            <strong>
                                Sua empresa começa aqui.
                            </strong>

                            <p>
                                Gerencie seus serviços, clientes e
                                agendamentos em um só lugar.
                            </p>

                        </div>

                    </div>


                    {/* ==========================================
                    CONTEÚDO
                ========================================== */}

                    <div className="central-adm-no-company__content">

                        <div className="central-adm-no-company__icon">

                            <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                aria-hidden="true"
                            >
                                <path
                                    d="M3 21h18"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinecap="round"
                                />

                                <path
                                    d="M5 21V8.5L12 4l7 4.5V21"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinejoin="round"
                                />

                                <path
                                    d="M9 21v-5h6v5"
                                    stroke="currentColor"
                                    strokeWidth="1.8"
                                    strokeLinejoin="round"
                                />

                                <path
                                    d="M9 10h.01M15 10h.01M9 13h.01M15 13h.01"
                                    stroke="currentColor"
                                    strokeWidth="2.4"
                                    strokeLinecap="round"
                                />
                            </svg>

                        </div>


                        <div className="central-adm-no-company__heading">

                            <span className="central-adm-no-company__eyebrow">
                                Nenhuma empresa encontrada
                            </span>

                            <h1>
                                Vamos configurar seu espaço?
                            </h1>

                            <p>
                                Sua conta ainda não está vinculada a uma
                                empresa. Você pode criar uma nova empresa
                                ou entrar em contato com o responsável
                                para receber um convite.
                            </p>

                        </div>


                        {/* ==========================================
                        AÇÕES PRINCIPAIS
                    ========================================== */}

                        <div className="central-adm-no-company__actions">

                            <button
                                type="button"
                                className="central-adm-no-company__action central-adm-no-company__action--primary"
                                onClick={() => {
                                    // coloque aqui a navegação
                                    // para criação da empresa
                                }}
                            >
                                <span className="central-adm-no-company__action-icon">
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        aria-hidden="true"
                                    >
                                        <path
                                            d="M12 5v14M5 12h14"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                </span>

                                <span className="central-adm-no-company__action-content">
                                    <strong>
                                        Criar uma empresa
                                    </strong>

                                    <small>
                                        Comece seu espaço no Markfy
                                    </small>
                                </span>

                                <svg
                                    className="central-adm-no-company__action-arrow"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    aria-hidden="true"
                                >
                                    <path
                                        d="M5 12h14M13 6l6 6-6 6"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                    />
                                </svg>

                            </button>

                            <button
                                type="button"
                                className="central-adm-no-company__action central-adm-no-company__action--secondary"
                                onClick={() => {
                                    window.location.href = "/login";
                                }}
                            >
                                <span className="central-adm-no-company__action-icon">
                                    <svg
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        aria-hidden="true"
                                    >
                                        <path
                                            d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                        />

                                        <path
                                            d="M10 17l5-5-5-5"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                        />

                                        <path
                                            d="M15 12H3"
                                            stroke="currentColor"
                                            strokeWidth="1.8"
                                            strokeLinecap="round"
                                        />
                                    </svg>
                                </span>

                                <span className="central-adm-no-company__action-content">
                                    <strong>
                                        Entrar novamente
                                    </strong>

                                    <small>
                                        Faça login para tentar novamente
                                    </small>
                                </span>
                            </button>

                        </div>


                        {/* ==========================================
                        AJUDA
                    ========================================== */}

                        <div className="central-adm-no-company__help">

                            <div className="central-adm-no-company__help-icon">
                                <svg
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    aria-hidden="true"
                                >
                                    <circle
                                        cx="12"
                                        cy="12"
                                        r="9"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                    />

                                    <path
                                        d="M9.8 9a2.3 2.3 0 1 1 3.7 1.8c-.9.7-1.5 1.1-1.5 2.2"
                                        stroke="currentColor"
                                        strokeWidth="1.8"
                                        strokeLinecap="round"
                                    />

                                    <path
                                        d="M12 16h.01"
                                        stroke="currentColor"
                                        strokeWidth="2.5"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </div>

                            <div className="central-adm-no-company__help-content">

                                <strong>
                                    Já deveria ter acesso a uma empresa?
                                </strong>

                                <p>
                                    Peça ao administrador da empresa para
                                    adicionar seu e-mail como membro.
                                </p>

                            </div>

                        </div>


                        {/* ==========================================
                        FOOTER
                    ========================================== */}

                        <div className="central-adm-no-company__footer">

                            <span>
                                Markfy
                            </span>

                            <span className="central-adm-no-company__footer-separator">
                                •
                            </span>

                            <span>
                                Agendamento simples para o seu negócio
                            </span>

                        </div>

                    </div>

                </section>

            </main>
        );
    }
    const renderContent = () => {
        switch (activeTab) {
            case "home":
                return <Dashboard setActiveTab={handleTabChange} company={company} />;
            case "pedidos":
                return (
                    <Orders
                        company={company}
                        initialOrder={activeTab?.params?.openOrder}
                    />
                );
            case "produtos":
                return (
                    <Products
                        company={company}
                        shouldOpenModal={openProductsModal}
                        setOpenProductsModal={setOpenProductsModal}
                    />
                );
            case "horarios":
                return <Schedules company={company} />;
            case "perfil":
                return (
                    <PerfilAdm
                        initialScreen={profileInitialScreen}
                    />
                );
            default:
                return <Dashboard setActiveTab={handleTabChange} company={company} />;
        }
    };

    return (
        <div className="central-adm">
            <div className="content">
                {/* Troca de aba por CSS: o `key` remonta o bloco e
                    a animação de entrada reinicia sozinha. Sem
                    animação de saída, nada fica preso esperando
                    ela terminar. */}
                <div
                    key={activeTab}
                    className="mkf-view-enter"
                    data-direction={getDirection()}
                >
                    {renderContent()}
                </div>
            </div>

            <TabBarAdm activeTab={activeTab} setActiveTab={handleTabChange} />
        </div>
    );
};

export default CentralAdm;
