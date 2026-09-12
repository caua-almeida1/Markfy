import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";

import {
    motion,
    AnimatePresence
} from "framer-motion";

import { Icon } from "@iconify/react";

import TabBar from "../../../components/tabbar";

import HomePage from "../homepage";
import Reservations from "./Reservations/reservartions";
import Catalog from "./Catalog/Catalog";
import CompanyPage from "./CompanyPage/CompanyPage";
import Explore from "./Explore/Explore";
import Profile from "./Profile/Profile";

import "./centralUser.css";


const CentralUser = () => {

    const location = useLocation();


    /*
    ============================================================
    TABS
    ============================================================
    */

    const tabs = [
        "home",
        "reservas",
        "catalog",
        "explorar",
        "perfil"
    ];


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

    const variants = {

        initial: (
            direction
        ) => ({

            x:
                direction === "right"
                    ? "100%"
                    : "-100%",

            opacity: 0

        }),


        animate: {

            x: 0,

            opacity: 1

        },


        exit: (
            direction
        ) => ({

            x:
                direction === "right"
                    ? "-100%"
                    : "100%",

            opacity: 0

        })

    };


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

                return (
                    <HomePage />
                );


            case "reservas":

                return (
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

                setPrevTab(
                    activeTab
                );

                setActiveTab(
                    "reservas"
                );

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

                setPrevTab(
                    activeTab
                );

                setActiveTab(
                    "catalog"
                );

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

                <AnimatePresence
                    mode="wait"
                    custom={
                        getDirection()
                    }
                >

                    <motion.div
                        key={activeTab}

                        custom={
                            getDirection()
                        }

                        initial="initial"

                        animate="animate"

                        exit="exit"

                        variants={
                            variants
                        }

                        transition={{
                            duration: 0.3
                        }}
                    >

                        {renderContent()}

                    </motion.div>

                </AnimatePresence>

            </div>


            <TabBar
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


export default CentralUser;