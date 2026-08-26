import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";
import { getDatabase, ref, update } from "firebase/database";
import { useUserCompany } from "../../../../contexts/companyContext/UserCompanyContext";
import Toast from "../../../../components/toast/Toast";

import "./PaymentScreen.css";

const PaymentScreen = ({ openScreen }) => {

    const { company } = useUserCompany();

    const [receiveAfterService, setReceiveAfterService] = useState(false);
    const [receiveBeforeBooking, setReceiveBeforeBooking] = useState(false);

    const [saving, setSaving] = useState(false);

    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState("success");
    const [toastTitle, setToastTitle] = useState("");
    const [toastMessage, setToastMessage] = useState("");


    /* ================= LOAD ================= */

    useEffect(() => {

        if (!company) return;

        const settings =
            company.paymentSettings || {};

        setReceiveAfterService(
            settings.receiveAfterService === true
        );

        setReceiveBeforeBooking(
            settings.receiveBeforeBooking === true
        );

    }, [company]);


    /* ================= TOAST ================= */

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


    /* ================= SAVE ================= */

    const handlePaymentChange = async (
        field,
        value
    ) => {

        if (!company || saving) return;

        const newSettings = {

            receiveAfterService:
                field === "receiveAfterService"
                    ? value
                    : receiveAfterService,

            receiveBeforeBooking:
                field === "receiveBeforeBooking"
                    ? value
                    : receiveBeforeBooking

        };


        /* Atualiza imediatamente a interface */

        setReceiveAfterService(
            newSettings.receiveAfterService
        );

        setReceiveBeforeBooking(
            newSettings.receiveBeforeBooking
        );


        try {

            setSaving(true);

            const db = getDatabase();

            await update(

                ref(
                    db,
                    `companys/${company.handle}/paymentSettings`
                ),

                newSettings

            );


            openToast(
                "success",
                "Alterações salvas",
                "As configurações de pagamento foram atualizadas."
            );


        } catch (error) {

            console.error(
                "Erro ao salvar pagamento:",
                error
            );


            /*
             * Caso dê erro, recarrega
             * o estado original do banco.
             */

            const settings =
                company.paymentSettings || {};


            setReceiveAfterService(
                settings.receiveAfterService === true
            );

            setReceiveBeforeBooking(
                settings.receiveBeforeBooking === true
            );


            openToast(
                "error",
                "Erro",
                "Não foi possível salvar as configurações."
            );


        } finally {

            setSaving(false);

        }

    };


    /* ================= GENERIC ROW ================= */

    const PaymentToggleRow = ({
        icon,
        title,
        description,
        checked,
        onChange
    }) => {

        return (

            <div className="payment-config-toggle">

                <div className="payment-config-toggle-left">

                    <div className="payment-method-icon">

                        <Icon icon={icon} />

                    </div>

                    <div>

                        <h3>
                            {title}
                        </h3>

                        <p>
                            {description}
                        </p>

                    </div>

                </div>


                <button
                    type="button"
                    className={`toggle-switch ${checked
                            ? "active"
                            : ""
                        }`}
                    disabled={saving}
                    onClick={onChange}
                    aria-label={
                        checked
                            ? `Desativar ${title}`
                            : `Ativar ${title}`
                    }
                >

                    <span className="toggle-circle" />

                </button>

            </div>

        );

    };


    return (

        <div className="payment-screen">


            {/* ================= INFO ================= */}

            <div className="payment-info">

                <div className="payment-info-icon">

                    <Icon
                        icon="solar:wallet-money-outline"
                    />

                </div>


                <div className="payment-info-content">

                    <h3>
                        Formas de pagamento
                    </h3>

                    <p>
                        Defina quando seus clientes deverão
                        realizar o pagamento e configure os
                        métodos disponíveis.
                    </p>

                </div>

            </div>


            {/* ================= RECEBIMENTO ================= */}

            <div className="payment-section">

                <h3 className="payment-section-title">
                    Recebimento
                </h3>


                <div className="payment-methods-card">

                    <PaymentToggleRow

                        icon="solar:shop-2-outline"

                        title="Receber presencialmente"

                        description="O cliente paga no local após o atendimento."

                        checked={receiveAfterService}

                        onChange={() =>
                            handlePaymentChange(
                                "receiveAfterService",
                                !receiveAfterService
                            )
                        }

                    />


                    <PaymentToggleRow

                        icon="solar:card-outline"

                        title="Receber antes do agendamento"

                        description="O pagamento é realizado antes da confirmação do horário."

                        checked={receiveBeforeBooking}

                        onChange={() =>
                            handlePaymentChange(
                                "receiveBeforeBooking",
                                !receiveBeforeBooking
                            )
                        }

                    />

                </div>

            </div>


            {/* ================= MÉTODOS ================= */}

            <div
                className={`payment-section ${!receiveBeforeBooking
                        ? "payment-section-disabled"
                        : ""
                    }`}
            >

                <h3 className="payment-section-title">
                    Métodos de pagamento
                </h3>


                <div className="payment-methods-card">


                    {/* PIX */}

                    <button
                        type="button"
                        className="payment-method"
                        disabled={
                            !receiveBeforeBooking ||
                            saving
                        }
                        onClick={() =>
                            openScreen("payment-pix")
                        }
                    >

                        <div className="payment-method-left">

                            <div className="payment-method-icon">

                                <Icon
                                    icon="solar:qr-code-outline"
                                />

                            </div>


                            <div>

                                <h3>
                                    Pix
                                </h3>

                                <p>
                                    Configure sua chave Pix
                                </p>

                            </div>

                        </div>


                        <Icon
                            icon="iconamoon:arrow-right-2"
                            className="payment-method-arrow"
                        />

                    </button>


                    {/* CARTÕES */}

                    <button
                        type="button"
                        className="payment-method"
                        disabled={
                            !receiveBeforeBooking ||
                            saving
                        }
                        onClick={() =>
                            openScreen("payment-card")
                        }
                    >

                        <div className="payment-method-left">

                            <div className="payment-method-icon">

                                <Icon
                                    icon="solar:card-outline"
                                />

                            </div>


                            <div>

                                <h3>
                                    Cartões
                                </h3>

                                <p>
                                    Crédito e débito
                                </p>

                            </div>

                        </div>


                        <Icon
                            icon="iconamoon:arrow-right-2"
                            className="payment-method-arrow"
                        />

                    </button>

                </div>

            </div>


            {/* ================= TOAST ================= */}

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

export default PaymentScreen;