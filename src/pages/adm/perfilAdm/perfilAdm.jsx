import React, { useState, useEffect } from "react";
import { Icon } from "@iconify/react";

import { getDatabase, ref, get } from "firebase/database";
import {
    getStorage,
    ref as storageRef,
    getDownloadURL
} from "firebase/storage";
import { getAuth, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";

import { useConsent } from "../../../contexts/consentContext/ConsentContext";
import QrLoginCard from "../../../qr/QrLoginCard";
import { useLicense } from "../../../plans/LicenseContext";
import { useTheme } from "../../../theme/ThemeContext";

import "./perfilAdm.css";

// ====== IMPORT DE CONFIGS ======
import ProfileScreen from "./screens/ProfileScreen";
import SettingsScreen from "./screens/SettingsScreen";
import SubscriptionScreen from "./screens/SubscriptionScreen";
import PreferencesScreen from "./screens/PreferencesScreen";
import PrivacyScreen from "./screens/PrivacyScreen";
import SupportScreen from "./screens/SupportScreen";

// ===== CONFIGS
import CompanyScreen from "./screens/settings/CompanyScreen";
import BrandingScreen from "./screens/settings/BrandingScreen";
import LocationScreen from "./screens/settings/LocationScreen";
import AmenitiesScreen from "./screens/settings/AmenitiesScreen";
import SocialMediaScreen from "./screens/settings/SocialMediaScreen";
import BusinessHoursScreen from "./screens/settings/BusinessHoursScreen";
import IntegrationsScreen from "./screens/settings/IntegrationsScreen";


import PaymentsScreen from "./screens/settings/payment/PaymentsScreen";
import { productLabel } from "../../../plans/planDefaults";

/* Telas antigas de pagamento (Cartões, Pix, cartão de crédito)
   viraram uma só. Os nomes continuam valendo para links já
   publicados (?tab=perfil&screen=payment-card). */
const PAYMENT_SCREENS = ["payment", "payment-card", "payment-pix", "payment-card-credit"];

const PerfilAdm = ({ initialScreen = "home", paymentReturn = null }) => {
    const { openPreferences: openConsentPreferences } = useConsent();

    const { isDark, toggleTheme } = useTheme();

    const [userData, setUserData] = useState(null);


    const navigate = useNavigate();
    const license = useLicense();

    const [screenStack, setScreenStack] = useState(
        initialScreen === "home"
            ? ["home"]
            : ["home", initialScreen]
    );
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

            navigate("/Login");
        } catch (err) {
            console.error(err);
        }
    };

    /*
     * O tema é do ThemeProvider: ele aplica no <html>,
     * grava no dispositivo e, para quem tem conta, em
     * users/{uid}/preferences/theme. Esta tela só lê e
     * alterna — nada de efeito local mexendo em classe.
     */

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

    const renderScreen = () => {

        if (PAYMENT_SCREENS.includes(screen)) {
            return <PaymentsScreen returnStatus={paymentReturn} />;
        }

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

            case "qr-login":
                return (
                    <div style={{ padding: "8px 16px 32px" }}>
                        <QrLoginCard />
                    </div>
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

            case "settings-amenities":
                return (
                    <AmenitiesScreen
                        user={userData}
                    />
                );

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
                            <div
                                className={`adm-perfil-plan ${license.active ? "is-active" : "is-inactive"}`}
                                style={license.plan ? { "--plan": license.plan.color } : undefined}
                            >

                                <span className="adm-perfil-plan__orb">
                                    <Icon icon={license.active ? "solar:cup-star-bold" : "solar:lock-keyhole-minimalistic-bold"} />
                                </span>

                                <div className="adm-perfil-plan__text">

                                    <small>Plano da empresa</small>

                                    <h3>
                                        {license.active && license.plan
                                            ? `Markfy ${license.plan.name}`
                                            : license.state === "expired"
                                                ? "Plano vencido"
                                                : license.state === "suspended"
                                                    ? "Plano suspenso"
                                                    : "Sem plano ativo"}
                                    </h3>

                                    <p>
                                        {license.active
                                            ? `${productLabel(license.product)}${license.license?.expiresAt ? ` · até ${new Date(license.license.expiresAt).toLocaleDateString("pt-BR")}` : ""}`
                                            : "Ative um plano para liberar o painel da empresa."}
                                    </p>

                                </div>

                                <button
                                    type="button"
                                    className="adm-perfil-plan__btn"
                                    onClick={() => openScreen("subscriptions")}
                                >

                                    {license.active ? "Gerenciar" : "Ver planos"}

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
                                                Pagamentos
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
                                        className={`toggle-switch ${isDark ? "active" : ""}`}
                                        onClick={toggleTheme}
                                        role="switch"
                                        aria-checked={isDark}
                                        aria-label="Tema escuro"
                                    >
                                        <div className="toggle-circle" />
                                    </div>

                                </div>

                            </div>

                            <div className="adm-perfil-info adm-perfil-company adm-perfil-section">

                                <div
                                    className="adm-perfil-row"
                                    onClick={() => navigate("/home")}
                                >

                                    <div className="adm-perfil-row-left">

                                        <Icon
                                            icon="solar:round-transfer-horizontal-linear"
                                            className="adm-perfil-row-icon"
                                        />

                                        <div className="adm-perfil-details">

                                            <p className="adm-perfil-name">
                                                Trocar de plataforma
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
                                    onClick={() => openScreen("qr-login")}
                                >

                                    <div className="adm-perfil-row-left">

                                        <Icon
                                            icon="solar:qr-code-linear"
                                            className="adm-perfil-row-icon"
                                        />

                                        <div className="adm-perfil-details">

                                            <p className="adm-perfil-name">
                                                Entrar em outro aparelho
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

                                {/* LGPD, Art. 8º, §5º — a revogação
                                    tem que estar sempre à mão. */}
                                <div
                                    className="adm-perfil-row"
                                    onClick={openConsentPreferences}
                                >

                                    <div className="adm-perfil-row-left">

                                        <Icon
                                            icon="mdi:cookie-outline"
                                            className="adm-perfil-row-icon"
                                        />

                                        <div className="adm-perfil-details">

                                            <p className="adm-perfil-name">
                                                Cookies e consentimento
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

                {/* Pilha de telas por CSS: o `key` remonta e a
                    animação de entrada reinicia. Sem saída, a tela
                    nova nunca fica esperando a anterior sumir. */}
                <div
                    key={screen}
                    className="perfil-content mkf-view-enter"
                    data-direction={direction > 0 ? "right" : "left"}
                >
                    {renderScreen()}
                </div>

            </div>
        </main >
    );
};

export default PerfilAdm;
