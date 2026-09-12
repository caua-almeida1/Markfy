import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { getDatabase, ref, update } from "firebase/database";
import { initMercadoPago, CardPayment } from "@mercadopago/sdk-react";

import { useUserCompany } from "../../../../../../contexts/companyContext/UserCompanyContext";
import Toast from "../../../../../../components/toast/Toast";

const MERCADO_PAGO_PUBLIC_KEY =
    process.env.REACT_APP_MERCADOPAGO_PUBLIC_KEY;


const CardCreditScreen = ({ onBack }) => {

    const { company } = useUserCompany();

    const [saving, setSaving] = useState(false);

    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState("success");
    const [toastTitle, setToastTitle] = useState("");
    const [toastMessage, setToastMessage] = useState("");


    /* ================= INIT MERCADO PAGO ================= */

    useEffect(() => {

        if (!MERCADO_PAGO_PUBLIC_KEY) {

            console.error(
                "VITE_MERCADOPAGO_PUBLIC_KEY não configurada."
            );

            return;

        }

        initMercadoPago(
            MERCADO_PAGO_PUBLIC_KEY,
            {
                locale: "pt-BR"
            }
        );

    }, []);


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


    /* ================= SUBMIT ================= */

    const handleCardSubmit = async ({
        formData
    }) => {

        if (!company || saving) return;

        try {

            setSaving(true);

            console.log(
                "Dados recebidos do Mercado Pago:",
                formData
            );

            /*
             * IMPORTANTE:
             *
             * O formData contém o token do cartão.
             *
             * Não salve o cartão completo no Firebase.
             *
             * O próximo passo será enviar:
             *
             * formData.token
             *
             * para o backend.
             */


            openToast(
                "success",
                "Cartão validado",
                "O cartão foi tokenizado com sucesso."
            );

        } catch (error) {

            console.error(
                "Erro ao cadastrar cartão:",
                error
            );

            openToast(
                "error",
                "Erro",
                "Não foi possível cadastrar o cartão."
            );

        } finally {

            setSaving(false);

        }

    };


    /* ================= ERROR ================= */

    const handleCardError = (error) => {

        console.error(
            "Erro Mercado Pago:",
            error
        );

        openToast(
            "error",
            "Cartão inválido",
            "Verifique os dados informados e tente novamente."
        );

    };


    return (

        <div className="payment-screen">

            {/* ================= INFO ================= */}

            <div className="payment-info">

                <div className="payment-info-icon">

                    <Icon
                        icon="solar:card-outline"
                    />

                </div>

                <div className="payment-info-content">

                    <h3>
                        Cadastrar cartão
                    </h3>

                    <p>
                        Adicione o cartão que será utilizado
                        para receber pagamentos dos seus clientes.
                    </p>

                </div>

            </div>


            {/* ================= CARD ================= */}

            <div className="payment-methods-card">

                <div className="payment-card-form">

                    <CardPayment
                        initialization={{
                            amount: 1
                        }}

                        onSubmit={
                            handleCardSubmit
                        }

                        onError={
                            handleCardError
                        }

                        customization={{
                            visual: {
                                style: {
                                    theme: "default"
                                }
                            },

                            paymentMethods: {
                                maxInstallments: 1
                            }
                        }}
                    />

                </div>

            </div>


            {/* ================= SECURITY ================= */}

            <div className="payment-info">

                <div className="payment-info-icon">

                    <Icon
                        icon="solar:shield-check-outline"
                    />

                </div>

                <div className="payment-info-content">

                    <h3>
                        Seus dados estão protegidos
                    </h3>

                    <p>
                        Os dados do cartão são processados
                        diretamente pelo Mercado Pago. O Markfy
                        não armazena o número completo nem o
                        código de segurança do cartão.
                    </p>

                </div>

            </div>


            {/* ================= ACTIONS ================= */}

            <div className="payment-actions">

                <button
                    type="button"
                    className="payment-cancel"
                    onClick={onBack}
                    disabled={saving}
                >
                    Voltar
                </button>

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

export default CardCreditScreen;