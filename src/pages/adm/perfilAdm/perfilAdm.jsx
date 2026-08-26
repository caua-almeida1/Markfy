import React, { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { AnimatePresence, motion } from "framer-motion";

import { getDatabase, ref, get } from "firebase/database";
import {
    getStorage,
    ref as storageRef,
    getDownloadURL
} from "firebase/storage";
import { getAuth, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import "./perfilAdm.css";

// ====== IMPORT DE CONFIGS ======
import ProfileScreen from "./screens/ProfileScreen";
import SettingsScreen from "./screens/SettingsScreen";
import SubscriptionScreen from "./screens/SubscriptionScreen";
import PaymentScreen from "./screens/PaymentScreen";
import PreferencesScreen from "./screens/PreferencesScreen";
import PrivacyScreen from "./screens/PrivacyScreen";
import SupportScreen from "./screens/SupportScreen";

// ===== CONFIGS
import CompanyScreen from "./screens/settings/CompanyScreen";
import BrandingScreen from "./screens/settings/BrandingScreen";
import LocationScreen from "./screens/settings/LocationScreen";
import SocialMediaScreen from "./screens/settings/SocialMediaScreen";
import BusinessHoursScreen from "./screens/settings/BusinessHoursScreen";
import IntegrationsScreen from "./screens/settings/IntegrationsScreen";


import PixConfigScreen from "./screens/settings/payment/PixConfigScreen";
import CardConfigScreen from "./screens/settings/payment/CardConfigScreen";
import CardCreditScreen from "./screens/settings/payment/CardCreditScreen";

const PerfilAdm = () => {
    const [userData, setUserData] = useState(null);

    const [darkMode, setDarkMode] = useState(false);

    const navigate = useNavigate();

    const [screenStack, setScreenStack] = useState(["home"]);
    const screen = screenStack[screenStack.length - 1];

    useEffect(() => {

        const loadUser = async () => {

            try {

                const auth = getAuth();
                const currentUser = auth.currentUser;

                if (!currentUser) return;

                const db = getDatabase();

                // ==========================================
                // DADOS DO USUÁRIO
                // ==========================================

                const userRef = ref(
                    db,
                    `users/${currentUser.uid}`
                );

                const snapshot =
                    await get(userRef);

                let user = {};

                if (snapshot.exists()) {
                    user = snapshot.val();
                }

                // ==========================================
                // FOTO DE PERFIL
                // storage/users/{uid}/profileImg
                // ==========================================

                let profileImg = "";

                try {

                    const storage = getStorage();

                    const profileImageRef = storageRef(
                        storage,
                        `users/${currentUser.uid}/profileImg`
                    );

                    profileImg =
                        await getDownloadURL(
                            profileImageRef
                        );

                } catch (imageError) {

                    // Caso não exista foto no Storage,
                    // continua normalmente com placeholder.

                    console.log(
                        "Usuário sem foto de perfil.",
                        imageError
                    );

                }

                setUserData({
                    ...user,
                    uid: currentUser.uid,
                    profileImg
                });

            } catch (err) {

                console.error(
                    "Erro ao carregar usuário:",
                    err
                );

            }

        };

        loadUser();

    }, []);

    const handleLogout = async () => {
        try {
            localStorage.removeItem("authUser");

            await signOut(getAuth());

            navigate("/");
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        const saved = localStorage.getItem("darkMode");
        if (saved === "true") setDarkMode(true);
    }, []);

    useEffect(() => {
        const root = document.documentElement;
        if (darkMode) {
            root.classList.add("dark-mode");
        } else {
            root.classList.remove("dark-mode");
        }
        localStorage.setItem("darkMode", darkMode);
    }, [darkMode]);

    const toggleDarkMode = () => {
        setDarkMode((prev) => !prev);
    };

    const [direction, setDirection] = useState(1);
    const openScreen = (name) => {
        setDirection(1);
        setScreenStack(prev => [...prev, name]);
    };

    const goBack = () => {
        if (screenStack.length === 1) return;
        setDirection(-1);
        setScreenStack(prev => prev.slice(0, -1));
    };

    const variants = {

        initial: (direction) => ({
            x: direction > 0 ? 70 : -70,
            opacity: 0
        }),

        animate: {
            x: 0,
            opacity: 1
        },

        exit: (direction) => ({
            x: direction > 0 ? -70 : 70,
            opacity: 0
        })

    };

    const renderScreen = () => {
        switch (screen) {
            case "profile":
                return <ProfileScreen user={userData} />;
            case "settings":
                return (
                    <SettingsScreen
                        user={userData}
                        openScreen={openScreen}
                    />
                );
            case "subscriptions":
                return <SubscriptionScreen />;

            case "payment":
                return (
                    <PaymentScreen
                        openScreen={openScreen}
                    />
                );

            case "payment-pix":
                return (
                    <PixConfigScreen
                        onBack={goBack}
                    />
                );

            case "payment-card":
                return (
                    <CardConfigScreen
                        openScreen={openScreen}
                        onBack={goBack}
                    />
                );

            case "payment-card-credit":
                return (
                    <CardCreditScreen
                        onBack={goBack}
                    />
                );

            case "preferences":
                return <PreferencesScreen />;

            case "privacy":
                return <PrivacyScreen />;

            case "support":
                return <SupportScreen />;

            case "settings-company":
                return <CompanyScreen />;

            case "settings-branding":
                return <BrandingScreen />;

            case "settings-location":
                return <LocationScreen />;

            case "settings-social":
                return <SocialMediaScreen />;

            case "settings-hours":
                return <BusinessHoursScreen />;

            case "settings-integrations":
                return <IntegrationsScreen />;

            default:
                return (
                    <>
                        <div className="adm-perfil-content">
                            <div
                                className="adm-perfil-info"
                                onClick={() => openScreen("profile")}
                            >

                                {userData?.profileImg ? (

                                    <img
                                        src={userData.profileImg}
                                        alt="Foto do usuário"
                                        className="adm-perfil-img"
                                    />

                                ) : (

                                    <div className="adm-perfil-img adm-perfil-img-placeholder">

                                        {(userData?.name || "U")
                                            .trim()
                                            .charAt(0)
                                            .toUpperCase()}

                                    </div>

                                )}

                                <div className="adm-perfil-details">
                                    <p className="adm-perfil-name">
                                        {userData?.name || "Usuário"}
                                    </p>

                                    <p className="adm-perfil-email">
                                        {userData?.email}
                                    </p>
                                </div>

                                <Icon
                                    icon="iconamoon:arrow-right-2"
                                    className="adm-perfil-arrow"
                                />
                            </div>
                            <div className="adm-perfil-pro">

                                <div className="adm-perfil-pro-left">
                                    <Icon icon="bi:stars" className="icon" />
                                    <div className="adm-perfil-pro-text">

                                        <h3>Seja Markfy Premium</h3>

                                        <p>
                                            Desbloqueie recursos exclusivos e ferramentas para impulsionar seu negócio.
                                        </p>

                                    </div>

                                </div>

                                <button className="adm-perfil-pro-btn">

                                    Upgrade

                                    <Icon icon="iconamoon:arrow-right-2" />

                                </button>

                            </div>
                            <div className="adm-perfil-info adm-perfil-company">

                                <div
                                    className="adm-perfil-row"
                                    onClick={() => openScreen("settings")}
                                >

                                    <div className="adm-perfil-row-left">

                                        <Icon
                                            icon="solar:settings-outline"
                                            className="adm-perfil-row-icon"
                                        />

                                        <div className="adm-perfil-details">

                                            <p className="adm-perfil-name">
                                                Configurações
                                            </p>

                                        </div>

                                    </div>

                                    <Icon
                                        icon="iconamoon:arrow-right-2"
                                        className="adm-perfil-arrow"
                                    />

                                </div>

                                <div
                                    className="adm-perfil-row"
                                    onClick={() => openScreen("subscriptions")}
                                >

                                    <div className="adm-perfil-row-left">

                                        <Icon
                                            icon="fluent:payment-16-regular"
                                            className="adm-perfil-row-icon"
                                        />

                                        <div className="adm-perfil-details">

                                            <p className="adm-perfil-name">
                                                Planos e Assinaturas
                                            </p>

                                        </div>

                                    </div>

                                    <Icon
                                        icon="iconamoon:arrow-right-2"
                                        className="adm-perfil-arrow"
                                    />

                                </div>

                                <div
                                    className="adm-perfil-row"
                                    onClick={() => openScreen("payment")}
                                >

                                    <div className="adm-perfil-row-left">

                                        <Icon
                                            icon="hugeicons:payment-02"
                                            className="adm-perfil-row-icon"
                                        />

                                        <div className="adm-perfil-details">

                                            <p className="adm-perfil-name">
                                                Formas de Pagamento
                                            </p>

                                        </div>

                                    </div>

                                    <Icon
                                        icon="iconamoon:arrow-right-2"
                                        className="adm-perfil-arrow"
                                    />

                                </div>

                                <div className="adm-perfil-row">

                                    <div className="adm-perfil-row-left">

                                        <Icon
                                            icon="solar:moon-line-duotone"
                                            className="adm-perfil-row-icon"
                                        />

                                        <div className="adm-perfil-details">

                                            <p className="adm-perfil-name">
                                                Tema escuro
                                            </p>

                                        </div>

                                    </div>

                                    <div
                                        className={`toggle-switch ${darkMode ? "active" : ""}`}
                                        onClick={toggleDarkMode}
                                    >
                                        <div className="toggle-circle" />
                                    </div>

                                </div>

                            </div>

                            <div className="adm-perfil-info adm-perfil-company adm-perfil-section">

                                <div
                                    className="adm-perfil-row"
                                    onClick={() => openScreen("preferences")}
                                >

                                    <div className="adm-perfil-row-left">

                                        <Icon
                                            icon="hugeicons:preference-horizontal"
                                            className="adm-perfil-row-icon"
                                        />

                                        <div className="adm-perfil-details">

                                            <p className="adm-perfil-name">
                                                Preferências
                                            </p>

                                        </div>

                                    </div>

                                    <Icon
                                        icon="iconamoon:arrow-right-2"
                                        className="adm-perfil-arrow"
                                    />

                                </div>

                                <div
                                    className="adm-perfil-row"
                                    onClick={() => openScreen("privacy")}
                                >

                                    <div className="adm-perfil-row-left">

                                        <Icon
                                            icon="solar:shield-check-outline"
                                            className="adm-perfil-row-icon"
                                        />

                                        <div className="adm-perfil-details">

                                            <p className="adm-perfil-name">
                                                Política e Privacidade
                                            </p>

                                        </div>

                                    </div>

                                    <Icon
                                        icon="iconamoon:arrow-right-2"
                                        className="adm-perfil-arrow"
                                    />

                                </div>

                                <div
                                    className="adm-perfil-row"
                                    onClick={() => openScreen("support")}
                                >
                                    <div className="adm-perfil-row-left">

                                        <Icon
                                            icon="solar:question-circle-outline"
                                            className="adm-perfil-row-icon"
                                        />

                                        <div className="adm-perfil-details">

                                            <p className="adm-perfil-name">
                                                Ajuda e Suporte
                                            </p>

                                        </div>

                                    </div>

                                    <Icon
                                        icon="iconamoon:arrow-right-2"
                                        className="adm-perfil-arrow"
                                    />

                                </div>

                            </div>
                        </div>
                    </>
                );
        }
    };
    return (
        <main className="perfil-adm-page">
            <div className="perfil-adm-container">
                <div className="perfil-header">

                    <button
                        className={`perfil-back ${screen === "home" ? "hidden" : ""}`}
                        onClick={goBack}
                    >
                        <Icon icon="solar:arrow-left-linear" />
                    </button>

                    <h1 className="perfil-title">
                        Perfil
                    </h1>

                </div>

                <AnimatePresence
                    mode="wait"
                    custom={direction}
                >

                    <motion.div
                        key={screen}
                        custom={direction}
                        variants={variants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={{
                            duration: .28,
                            ease: [0.22, 1, 0.36, 1]
                        }}
                        className="perfil-content"
                    >
                        {renderScreen()}
                    </motion.div>

                </AnimatePresence>

            </div>
        </main >
    );
};

export default PerfilAdm;
