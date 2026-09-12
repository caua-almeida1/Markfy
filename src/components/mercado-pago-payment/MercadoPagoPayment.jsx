import React, {
    useEffect,
    useState
} from "react";

import {
    initMercadoPago,
    Payment
} from "@mercadopago/sdk-react";

import {
    getAuth
} from "firebase/auth";

import {
    Icon
} from "@iconify/react";

import "./MercadoPagoPayment.css";


const MERCADO_PAGO_PUBLIC_KEY =
    process.env.REACT_APP_MERCADOPAGO_PUBLIC_KEY;


const MercadoPagoPayment = ({
    amount,
    companyHandle,
    productId,
    professionalId,
    professionalName,
    day,
    dayLabel,
    hour,
    userName,
    clientId,
    onSuccess,
    onError,
    onBack
}) => {

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState("");


    /* =====================================================
       INICIALIZAR MERCADO PAGO
    ===================================================== */

    useEffect(() => {

        try {

            setLoading(true);
            setError("");


            if (!MERCADO_PAGO_PUBLIC_KEY) {

                throw new Error(
                    "A chave pública do Mercado Pago não está configurada."
                );

            }


            initMercadoPago(
                MERCADO_PAGO_PUBLIC_KEY,
                {
                    locale: "pt-BR"
                }
            );


            setLoading(false);

        } catch (err) {

            console.error(
                "Erro ao inicializar Mercado Pago:",
                err
            );


            const message =
                err?.message ||
                "Não foi possível carregar o pagamento.";


            setError(message);

            setLoading(false);

            onError?.(err);

        }

    }, [onError]);


    /* =====================================================
       ENVIAR PAGAMENTO
    ===================================================== */

    const handleSubmit = async ({
        selectedPaymentMethod,
        formData
    }) => {

        try {

            setError("");


            const auth =
                getAuth();


            const currentUser =
                auth.currentUser;


            if (!currentUser) {

                throw new Error(
                    "Usuário não autenticado."
                );

            }


            const idToken =
                await currentUser.getIdToken();


            /* =============================================
               MÉTODO DE PAGAMENTO
            ============================================= */

            const paymentMethodId =
                formData?.payment_method_id ||
                selectedPaymentMethod?.id ||
                null;


            if (!paymentMethodId) {

                throw new Error(
                    "Método de pagamento não identificado."
                );

            }


            /* =============================================
               PAYER
            ============================================= */

            const payerData =
                formData?.payer || {};


            const payer = {

                ...(payerData.email
                    ? {
                        email:
                            payerData.email
                    }
                    : {}
                ),

                ...(payerData.identification
                    ? {
                        identification: {

                            type:
                                payerData
                                    .identification
                                    .type,

                            number:
                                payerData
                                    .identification
                                    .number

                        }
                    }
                    : {}
                )

            };


            /* =============================================
               DADOS DO PAGAMENTO
            ============================================= */

            const paymentData = {

                companyHandle,

                productId,

                professionalId,

                professionalName,

                day,

                dayLabel,

                hour,

                userName,

                clientId,

                userId:
                    currentUser.uid,

                paymentMethodId,

                token:
                    formData?.token ||
                    null,

                issuerId:
                    formData?.issuer_id ||
                    null,

                installments:
                    Number(
                        formData?.installments
                    ) > 0
                        ? Number(
                            formData.installments
                        )
                        : 1,

                payer

            };


            console.log(
                "💳 Enviando pagamento ao servidor..."
            );


            /* =============================================
               CLOUD FUNCTION
            ============================================= */

            const response =
                await fetch(
                    "https://us-central1-markfy-96942.cloudfunctions.net/createMercadoPagoPayment",
                    {

                        method: "POST",

                        headers: {

                            "Content-Type":
                                "application/json",

                            "Authorization":
                                `Bearer ${idToken}`

                        },

                        body:
                            JSON.stringify(
                                paymentData
                            )

                    }
                );


            const data =
                await response.json();


            /* =============================================
               VALIDAR RESPOSTA
            ============================================= */

            if (
                !response.ok ||
                !data.success
            ) {

                throw new Error(
                    data.message ||
                    "Não foi possível processar o pagamento."
                );

            }


            console.log(
                "✅ Pagamento criado:",
                data
            );


            /* =============================================
               SALVAR PAGAMENTO PENDENTE
            ============================================= */

            if (data.paymentId) {

                localStorage.setItem(
                    "markfy-pending-payment",
                    JSON.stringify({

                        paymentId:
                            data.paymentId,

                        companyHandle,

                        productId,

                        day,

                        hour

                    })
                );

            }


            /* =============================================
               SUCESSO
            ============================================= */

            onSuccess?.(
                data
            );


        } catch (err) {

            console.error(
                "❌ Erro ao processar pagamento:",
                err
            );


            const message =
                err?.message ||
                "Não foi possível processar o pagamento.";


            setError(
                message
            );


            onError?.(
                err
            );

        }

    };


    /* =====================================================
       LOADING
    ===================================================== */

    if (loading) {

        return (

            <div className="mercado-pago-payment-loading">

                <div className="mercado-pago-payment-spinner" />

                <p>
                    Preparando pagamento...
                </p>

            </div>

        );

    }


    /* =====================================================
       ERRO DE INICIALIZAÇÃO
    ===================================================== */

    if (
        error &&
        !MERCADO_PAGO_PUBLIC_KEY
    ) {

        return (

            <div className="mercado-pago-payment-error">

                <Icon
                    icon="mdi:alert-circle-outline"
                />

                <h3>
                    Não foi possível carregar o pagamento
                </h3>

                <p>
                    {error}
                </p>

                <button
                    type="button"
                    onClick={onBack}
                >
                    Voltar
                </button>

            </div>

        );

    }


    /* =====================================================
       RENDER
    ===================================================== */

    return (

        <div className="mercado-pago-payment">

            <div className="mercado-pago-payment-content">

                <div className="mercado-pago-payment-amount">

                    <span>
                        Total
                    </span>

                    <strong>
                        {Number(amount || 0).toLocaleString(
                            "pt-BR",
                            {
                                style: "currency",
                                currency: "BRL"
                            }
                        )}
                    </strong>

                </div>


                {error && (

                    <div className="mercado-pago-payment-inline-error">

                        {error}

                    </div>

                )}


                <Payment

                    initialization={{
                        amount:
                            Number(amount) || 0
                    }}

                    customization={{

                        paymentMethods: {

                            creditCard:
                                "all",

                            debitCard:
                                "all",

                            bankTransfer:
                                "all"

                        }

                    }}

                    onSubmit={
                        handleSubmit
                    }

                    onError={
                        (brickError) => {

                            console.error(
                                "Erro Payment Brick:",
                                brickError
                            );


                            const error =
                                new Error(
                                    "Não foi possível carregar ou processar o pagamento."
                                );


                            setError(
                                error.message
                            );


                            onError?.(
                                error
                            );

                        }
                    }

                />

            </div>

        </div>

    );

};


export default MercadoPagoPayment;