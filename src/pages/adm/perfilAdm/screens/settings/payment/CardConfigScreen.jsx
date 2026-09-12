import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { getAuth } from "firebase/auth";
import { getDatabase, ref, update } from "firebase/database";

import { useUserCompany } from "../../../../../../contexts/companyContext/UserCompanyContext";
import Toast from "../../../../../../components/toast/Toast";


/* =====================================================
   MERCADO PAGO — OAUTH
===================================================== */

const MERCADO_PAGO_OAUTH_START =
    "https://us-central1-markfy-96942.cloudfunctions.net/mercadoPagoOAuthStart";


const CardConfigScreen = ({ onBack }) => {

    const { company } = useUserCompany();


    /* =====================================================
       STATES
    ===================================================== */

    const [cardsEnabled, setCardsEnabled] =
        useState(false);

    const [mercadoPagoConnected, setMercadoPagoConnected] =
        useState(false);

    const [saving, setSaving] =
        useState(false);

    const [connectingMercadoPago, setConnectingMercadoPago] =
        useState(false);


    /* =====================================================
       TOAST
    ===================================================== */

    const [showToast, setShowToast] =
        useState(false);

    const [toastType, setToastType] =
        useState("success");

    const [toastTitle, setToastTitle] =
        useState("");

    const [toastMessage, setToastMessage] =
        useState("");


    /* =====================================================
       TOAST
    ===================================================== */

    const openToast = (
        type,
        title,
        message
    ) => {

        setToastType(type);
        setToastTitle(title);
        setToastMessage(message);
        setShowToast(true);

    };


    /* =====================================================
       LOAD
    ===================================================== */

    useEffect(() => {

        if (!company) return;


        const settings =
            company.paymentSettings || {};


        /*
         * Aqui verificamos se a empresa já possui
         * uma conexão com o Mercado Pago.
         *
         * Por enquanto usamos os dados disponíveis
         * no objeto da empresa.
         */

        const mercadoPago =
            company.mercadoPago ||
            company.paymentSettings?.mercadoPago ||
            {};


        setCardsEnabled(
            settings.cardsEnabled === true
        );


        setMercadoPagoConnected(
            mercadoPago.connected === true
        );

    }, [company]);


    /* =====================================================
       ATIVAR / DESATIVAR CARTÕES
    ===================================================== */

    const handleCardsToggle = async () => {

        if (!company || saving) return;


        const newValue =
            !cardsEnabled;


        setCardsEnabled(newValue);


        try {

            setSaving(true);


            const db =
                getDatabase();


            await update(

                ref(
                    db,
                    `companys/${company.handle}/paymentSettings`
                ),

                {
                    cardsEnabled:
                        newValue
                }

            );


        } catch (error) {

            console.error(
                "Erro ao atualizar cartões:",
                error
            );


            setCardsEnabled(
                !newValue
            );


            openToast(
                "error",
                "Erro",
                "Não foi possível atualizar essa configuração."
            );


        } finally {

            setSaving(false);

        }

    };


    /* =====================================================
       CONECTAR MERCADO PAGO
    ===================================================== */

    const handleConnectMercadoPago = async () => {

        if (
            connectingMercadoPago ||
            !company
        ) {
            return;
        }


        try {

            setConnectingMercadoPago(true);


            /* =========================================
               USUÁRIO AUTENTICADO
            ========================================= */

            const auth =
                getAuth();


            const user = auth.currentUser;

            console.log("🔥 Firebase Auth UID:", user?.uid);
            console.log("🔥 Firebase Auth email:", user?.email);
            console.log("🔥 Empresa atual:", company?.handle);

            if (!user) {

                openToast(
                    "error",
                    "Sessão expirada",
                    "Faça login novamente para conectar o Mercado Pago."
                );

                return;
            }


            /* =========================================
               FIREBASE ID TOKEN
            ========================================= */

            const idToken =
                await user.getIdToken(true);

            const frontendUrl =
                window.location.origin;
            /* =========================================
               INICIAR OAUTH
            ========================================= */

            const response =
                await fetch(
                    `${MERCADO_PAGO_OAUTH_START}?returnUrl=${encodeURIComponent(
                        frontendUrl + "/central-adm"
                    )}`,
                    {
                        method: "GET",

                        headers: {
                            Authorization:
                                `Bearer ${idToken}`
                        }
                    }
                );

            const data =
                await response.json();


            /* =========================================
               ERRO
            ========================================= */

            if (
                !response.ok ||
                !data.success
            ) {

                throw new Error(
                    data.message ||
                    "Não foi possível iniciar a conexão com o Mercado Pago."
                );

            }


            /* =========================================
               URL DO MERCADO PAGO
            ========================================= */

            if (!data.authorizationUrl) {

                throw new Error(
                    "O Mercado Pago não retornou a URL de autorização."
                );

            }


            /*
             * Redireciona o usuário para o Mercado Pago.
             */

            window.location.href =
                data.authorizationUrl;


        } catch (error) {

            console.error(
                "Erro ao conectar Mercado Pago:",
                error
            );


            openToast(
                "error",
                "Não foi possível conectar",
                error.message ||
                "Tente novamente."
            );


        } finally {

            setConnectingMercadoPago(false);

        }

    };


    /* =====================================================
       RENDER
    ===================================================== */

    return (

        <div className="payment-screen">


            {/* =================================================
                INFO
            ================================================= */}

            <div className="payment-info">

                <div className="payment-info-icon">

                    <Icon
                        icon="solar:card-outline"
                    />

                </div>


                <div className="payment-info-content">

                    <h3>
                        Cartões
                    </h3>

                    <p>
                        Permita que seus clientes paguem
                        com cartão através do Mercado Pago.
                    </p>

                </div>

            </div>


            {/* =================================================
                ACEITAR CARTÕES
            ================================================= */}

            <div className="payment-methods-card">

                <div className="payment-config-toggle">


                    <div className="payment-config-toggle-left">

                        <div className="payment-method-icon">

                            <Icon
                                icon="solar:card-outline"
                            />

                        </div>


                        <div>

                            <h3>
                                Aceitar cartões
                            </h3>

                            <p>
                                Crédito e débito
                            </p>

                        </div>

                    </div>


                    <button
                        type="button"
                        className={`toggle-switch ${cardsEnabled
                            ? "active"
                            : ""
                            }`}
                        disabled={saving}
                        onClick={
                            handleCardsToggle
                        }
                        aria-label={
                            cardsEnabled
                                ? "Desativar cartões"
                                : "Ativar cartões"
                        }
                    >

                        <span className="toggle-circle" />

                    </button>

                </div>

            </div>


            {/* =================================================
                CONTA DE RECEBIMENTO
            ================================================= */}

            <div
                className={`payment-section ${!cardsEnabled
                    ? "payment-section-disabled"
                    : ""
                    }`}
            >

                <h3 className="payment-section-title">
                    Recebimento
                </h3>


                <div className="payment-methods-card">


                    <button
                        type="button"
                        className="payment-method"
                        disabled={
                            !cardsEnabled ||
                            connectingMercadoPago
                        }
                        onClick={
                            handleConnectMercadoPago
                        }
                    >


                        <div className="payment-method-left">


                            <div
                                className={`payment-method-icon ${mercadoPagoConnected
                                    ? "payment-method-icon-connected"
                                    : ""
                                    }`}
                            >

                                <Icon
                                    icon={
                                        mercadoPagoConnected
                                            ? "solar:check-circle-outline"
                                            : "solar:wallet-outline"
                                    }
                                />

                            </div>


                            <div className="payment-method-content">

                                <h3>
                                    {mercadoPagoConnected
                                        ? "Mercado Pago conectado"
                                        : "Conta Mercado Pago"
                                    }
                                </h3>

                                <p>
                                    {mercadoPagoConnected
                                        ? "Conta ativa e pronta para receber pagamentos"
                                        : "Conecte a conta que receberá os pagamentos"
                                    }
                                </p>

                            </div>

                        </div>


                        {connectingMercadoPago ? (

                            <Icon
                                icon="svg-spinners:90-ring-with-bg"
                                className="payment-method-arrow"
                            />

                        ) : mercadoPagoConnected ? (

                            <span className="payment-connected-badge">
                                <Icon icon="solar:check-circle-outline" />
                                Conectado
                            </span>

                        ) : (

                            <Icon
                                icon="iconamoon:arrow-right-2"
                                className="payment-method-arrow"
                            />

                        )}

                    </button>


                </div>

            </div>


            {/* =================================================
                SEGURANÇA
            ================================================= */}

            <div className="payment-info">

                <div className="payment-info-icon">

                    <Icon
                        icon="solar:shield-check-outline"
                    />

                </div>


                <div className="payment-info-content">

                    <h3>
                        Pagamentos seguros
                    </h3>

                    <p>
                        Os pagamentos são processados
                        pelo Mercado Pago. A Markfy não
                        armazena dados de cartão.
                    </p>

                </div>

            </div>


            {/* =================================================
                VOLTAR
            ================================================= */}

            <div className="payment-actions">

                <button
                    type="button"
                    className="payment-cancel"
                    disabled={
                        saving ||
                        connectingMercadoPago
                    }
                    onClick={onBack}
                >
                    Voltar
                </button>

            </div>


            {/* =================================================
                TOAST
            ================================================= */}

            <Toast
                show={showToast}
                type={toastType}
                title={toastTitle}
                message={toastMessage}
                onClose={() =>
                    setShowToast(false)
                }
            />


        </div>

    );

};


export default CardConfigScreen;