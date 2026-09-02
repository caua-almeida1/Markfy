import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TabBarAdm from "../../components/tabbarADM/";
import Dashboard from "./dashboardAdm/dashboard";
import Orders from "./ordersAdm/orders";
import Products from "./productsAdm/productsAdm";
import Schedules from "./schedulesAdm/schedulesAdm";
import PerfilAdm from "./perfilAdm/perfilAdm";

import { useUserCompany } from "../../contexts/companyContext/UserCompanyContext"; // 🟢 importa o contexto

import "./centralAdm.css";

const CentralAdm = () => {
    useEffect(() => {
        const shouldReload = sessionStorage.getItem("forceAdminReload");

        if (shouldReload) {
            sessionStorage.removeItem("forceAdminReload");
            window.location.reload();
        }
    }, []);
    const { user, company, loading } = useUserCompany(); // 🟢 obtém dados do usuário logado e empresa
    const tabs = ["home", "pedidos", "produtos", "horarios", "perfil"];
    const [activeTab, setActiveTab] = useState("home");
    const [prevTab, setPrevTab] = useState("home");

    const [openProductsModal, setOpenProductsModal] = useState(false);
    const [profileInitialScreen, setProfileInitialScreen] = useState("home");

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

    const variants = {
        initial: (direction) => ({
            x: direction === "right" ? "100%" : "-100%",
            opacity: 0,
        }),
        animate: { x: 0, opacity: 1 },
        exit: (direction) => ({
            x: direction === "right" ? "-100%" : "100%",
            opacity: 0,
        }),
    };

    if (loading) {
        return (
            <div className="central-adm-loading">
                <p>Carregando dados da empresa...</p>
            </div>
        );
    }

    if (!company) {
        return (
            <div className="central-adm-no-company">
                <h2>Nenhuma empresa associada à sua conta.</h2>
                <p>Crie uma empresa ou aguarde ser adicionado como membro.</p>
            </div>
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
                <AnimatePresence mode="wait" custom={getDirection()}>
                    <motion.div
                        key={activeTab}
                        custom={getDirection()}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        variants={variants}
                        transition={{ duration: 0.3 }}
                    >
                        {renderContent()}
                    </motion.div>
                </AnimatePresence>
            </div>

            <TabBarAdm activeTab={activeTab} setActiveTab={handleTabChange} />
        </div>
    );
};

export default CentralAdm;
