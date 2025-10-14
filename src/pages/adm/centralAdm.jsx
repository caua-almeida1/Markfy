import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TabBarAdm from "../../components/tabbarADM/";
import Dashboard from "./dashboardAdm/dashboard";
import Orders from "./ordersAdm/orders";
import Products from "./productsAdm/productsAdm";
import Schedules from "./schedulesAdm/schedulesAdm";

import "./centralAdm.css";

const CentralAdm = () => {
    const tabs = ["home", "pedidos", "produtos", "horarios"];
    const [activeTab, setActiveTab] = useState("home");
    const [prevTab, setPrevTab] = useState("home");

    const [openProductsModal, setOpenProductsModal] = useState(false);

    const renderContent = () => {
        switch (activeTab) {
            case "home":
                return <Dashboard setActiveTab={handleTabChange} />;
            case "pedidos":
                return <Orders />;
            case "produtos":
                return <Products shouldOpenModal={openProductsModal} setOpenProductsModal={setOpenProductsModal} />;
            case "horarios":
                return <Schedules />;
            default:
                return <Dashboard setActiveTab={handleTabChange} />;
        }
    };

    const handleTabChange = (tab, options = {}) => {
        setPrevTab(activeTab);
        setActiveTab(tab);
        if (tab === "produtos" && options.openModal) {
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
