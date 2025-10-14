import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import TabBar from "../../../components/tabbar";
import HomePage from "../homepage";
import Reservations from "./reservations/reservations";
import Products from "./products/products";
import Cart from "./cart/cart";
import CompanyPage from "./CompanyPage/CompanyPage";

import "./centralUser.css";

const CentralUser = () => {
    const tabs = ["home", "reservas", "produtos", "carrinho"];
    const [activeTab, setActiveTab] = useState("home");
    const [prevTab, setPrevTab] = useState("home");

    useEffect(() => {
        document.body.classList.add("light-mode");
        return () => {
            document.body.classList.remove("light-mode");
        };
    }, []);
    
    const renderContent = () => {
        switch (activeTab) {
            case "home":
                return <HomePage />;
            case "company":
                return <CompanyPage />;
            case "reservas":
                return <Reservations />;
            case "produtos":
                return <Products />;
            case "carrinho":
                return <Cart />;
            default:
                return <HomePage />;
        }
    };

    const handleTabChange = (tab) => {
        setPrevTab(activeTab);
        setActiveTab(tab);
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
        <div className="central-user">
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
            <TabBar activeTab={activeTab} setActiveTab={handleTabChange} />
        </div>
    );
};

export default CentralUser;
