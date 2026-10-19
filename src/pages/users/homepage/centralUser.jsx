import React, { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { Icon } from "@iconify/react";

import TabBar, { DEFAULT_USER_TABS } from "../../../components/tabbar";

import HomePage from "../homepage";
import Reservations from "./Reservations/reservartions";
import Catalog from "./Catalog/Catalog";
import CompanyPage from "./CompanyPage/CompanyPage";
import Explore from "./Explore/Explore";
import Profile from "./Profile/Profile";
import DiscoverHome from "../discover/DiscoverHome";
import DiscoverReservations from "../discover/DiscoverReservations";

import { recordRecentCompany } from "../../../utils/bookingHistory";

import { useCompanyTheme } from "../../../theme/useCompanyTheme";

import { PublicAccessGate } from "../../../plans/publicAccess";
import "./centralUser.css";


const CentralUserInner = () => {

    const location = useLocation();

    const navigate = useNavigate();

    const { handle } = useParams();

    /* A empresa da rota define a paleta da página pública.
       O hook escreve data-company-theme no <html>, então
       vale também para os modais em portal. */
    useCompanyTheme(handle);

    /*
     * Sem empresa na URL (/central-user), a central vira a
     * vitrine da Markfy Bookings: feed de empresas, reservas
     * de todas as empresas, Explorar e Perfil. Não há
     * "Catálogo" porque não há empresa escolhida.
     */
    const isDiscover = !handle;

    useEffect(() => {

        if (handle) {
            recordRecentCompany(handle);
        }

    }, [handle]);


    /*
    ============================================================
    TABS
    ============================================================
    */

    const tabBarTabs = isDiscover
        ? DEFAULT_USER_TABS.filter(
            (tab) => tab.id !== "catalog"
        )
        : DEFAULT_USER_TABS;

    const tabs = tabBarTabs.map(
        (tab) => tab.id
    );


    /*
    ============================================================
    TAB VINDO DA URL
    ============================================================
    */

    const getUrlTab = () => {

        const params =
            new URLSearchParams(
                location.search
            );

        const tab =
            params.get("tab");


        if (
            tabs.includes(tab)
        ) {

            return tab;

        }


        return "home";

    };


    /*
    ============================================================
    STATES
    ============================================================
    */

    const [
        activeTab,
        setActiveTab
    ] = useState(
        getUrlTab
    );


    const [
        prevTab,
        setPrevTab
    ] = useState(
        getUrlTab
    );


    /*
    ============================================================
    URL → TAB
    ============================================================
    */

    useEffect(() => {

        const requestedTab =
            getUrlTab();


        if (
            requestedTab !== activeTab
        ) {

            setPrevTab(
                activeTab
            );

            setActiveTab(
                requestedTab
            );

        }

    }, [location.search]);


    /*
    ============================================================
    BODY
    ============================================================
    */

    useEffect(() => {

        document.body.classList.add(
            "light-mode"
        );


        return () => {

            document.body.classList.remove(
                "light-mode"
            );

        };

    }, []);


    /*
    ============================================================
    TROCA DE TAB
    ============================================================
    */

    /*
     * A URL é a fonte de verdade da aba.
     *
     * Antes, trocar de aba só mexia no estado e deixava o
     * `?tab=` antigo na URL. Bastava alguém escrever na
     * query — abrir um produto na home escreve
     * `?product=` preservando os parâmetros — para o efeito
     * "URL → TAB" ler o `tab` velho e puxar a aba de volta.
     *
     * Era isso que jogava o usuário de volta ao catálogo com
     * o produto aberto, em ciclo: o CompanyInfoModal leva
     * para `?tab=catalog`, a pessoa vai para Início, abre um
     * produto e a URL ainda dizia `tab=catalog`.
     *
     * `product` também sai fora na troca de aba, senão a
     * aba de destino reabriria o modal do produto anterior.
     */
    const handleTabChange = (
        tab
    ) => {

        if (
            tab === activeTab
        ) {

            return;

        }


        setPrevTab(
            activeTab
        );

        setActiveTab(
            tab
        );


        const params =
            new URLSearchParams(
                location.search
            );

        params.set("tab", tab);

        params.delete("product");


        navigate(
            `${location.pathname}?${params.toString()}`,
            {
                replace: true
            }
        );

    };


    /*
    ============================================================
    DIREÇÃO
    ============================================================
    */

    const getDirection = () => {

        const activeIndex =
            tabs.indexOf(
                activeTab
            );


        const prevIndex =
            tabs.indexOf(
                prevTab
            );


        if (
            activeIndex === -1 ||
            prevIndex === -1
        ) {

            return "right";

        }


        return activeIndex > prevIndex
            ? "right"
            : "left";

    };


    /*
    ============================================================
    ANIMAÇÕES
    ============================================================
    */



    /*
    ============================================================
    COMING SOON
    ============================================================
    */

    const renderComingSoon = () => {

        return (

            <div className="coming-soon-container">

                <Icon
                    icon="mdi:tools"
                    style={{
                        fontSize: "60px",
                        opacity: 0.6
                    }}
                />

                <h2>
                    Página em desenvolvimento
                </h2>

                <p>
                    Estamos preparando novidades.
                    Volte em breve 🚀
                </p>

            </div>

        );

    };


    /*
    ============================================================
    CONTEÚDO
    ============================================================
    */

    const renderContent = () => {

        switch (
        activeTab
        ) {

            case "home":

                return isDiscover
                    ? (
                        <DiscoverHome
                            onOpenTab={handleTabChange}
                        />
                    )
                    : (
                        <HomePage />
                    );


            case "reservas":

                return isDiscover
                    ? (
                        <DiscoverReservations
                            onOpenTab={handleTabChange}
                        />
                    )
                    : (
                        <Reservations />
                    );


            case "catalog":

                return (
                    <Catalog />
                );


            case "explorar":

                return (
                    <Explore />
                );


            case "perfil":

                return (
                    <Profile />
                );

            case "company":

                return (
                    <CompanyPage />
                );


            default:

                return (
                    <HomePage />
                );

        }

    };


    /*
    ============================================================
    EVENTO → RESERVAS
    ============================================================
    */

    useEffect(() => {

        const handleGoToReservations =
            () => {

                /* Pelo handleTabChange, para a URL
                   acompanhar a aba. */
                handleTabChange("reservas");

            };


        window.addEventListener(
            "markfy:go-to-reservations",
            handleGoToReservations
        );


        return () => {

            window.removeEventListener(
                "markfy:go-to-reservations",
                handleGoToReservations
            );

        };

    }, [activeTab]);


    /*
    ============================================================
    EVENTO → CATÁLOGO
    ============================================================
    */

    useEffect(() => {

        const handleGoToCatalog =
            () => {

                /* Pelo handleTabChange, para a URL
                   acompanhar a aba. */
                handleTabChange("catalog");

            };


        window.addEventListener(
            "markfy:go-to-catalog",
            handleGoToCatalog
        );


        return () => {

            window.removeEventListener(
                "markfy:go-to-catalog",
                handleGoToCatalog
            );

        };

    }, [activeTab]);


    /*
    ============================================================
    RENDER
    ============================================================
    */

    return (

        <div className="central-user">

            <div className="content">

                {/*
                    Troca de aba por CSS, sem AnimatePresence.

                    O `key` faz o React remontar o bloco, e a
                    animação de entrada do CSS reinicia sozinha.
                    Não existe animação de saída de propósito: era
                    ela que obrigava o AnimatePresence a segurar a
                    aba antiga montada — e quando a animação não
                    rodava, a aba nova nunca aparecia.
                */}
                <div
                    key={activeTab}
                    className="mkf-view-enter"
                    data-direction={getDirection()}
                >

                    {renderContent()}

                </div>

            </div>


            <TabBar
                tabs={
                    tabBarTabs
                }

                activeTab={
                    activeTab
                }

                setActiveTab={
                    handleTabChange
                }
            />

        </div>

    );

};


const CentralUser = () => {

    const { handle } = useParams();

    return (
        <PublicAccessGate handle={handle}>
            <CentralUserInner />
        </PublicAccessGate>
    );
};

export default CentralUser;