import React, { useEffect, useState } from "react";
import { ref, get, onValue } from "firebase/database";
import { Icon } from "@iconify/react";

import { getDatabase } from "firebase/database";

import "./payment-result.css";

const PaymentResult = () => {

    const [status, setStatus] = useState("checking");
    const [paymentData, setPaymentData] = useState(null);

    const checkPayment = async () => {

        try {

            const params =
                new URLSearchParams(
                    window.location.search
                );

            /*
             * O Mercado Pago pode retornar
             * a referência externa.
             */

            const externalReference =
                params.get("external_reference");

            /*
             * Também verificamos o pagamento
             * salvo localmente antes do checkout.
             */

            const localPayment =
                localStorage.getItem(
                    "markfy-pending-payment"
                );

            let pendingPayment = null;

            if (localPayment) {

                try {
                    pendingPayment =
                        JSON.parse(localPayment);
                } catch {
                    pendingPayment = null;
                }

            }

            const paymentId =
                externalReference ||
                pendingPayment?.paymentId;

            const companyHandle =
                pendingPayment?.companyHandle;

            if (
                !paymentId ||
                !companyHandle
            ) {

                setStatus("error");

                return;
            }

            const db =
                getDatabase();

            const paymentRef =
                ref(
                    db,
                    `companys/${companyHandle}/paymentOrders/${paymentId}`
                );

            /*
             * Verificação inicial
             */

            const snapshot =
                await get(paymentRef);

            if (snapshot.exists()) {

                const data =
                    snapshot.val();

                setPaymentData(data);

                if (
                    data.status === "paid" ||
                    data.scheduleCreated === true
                ) {

                    setStatus("success");

                    localStorage.removeItem(
                        "markfy-pending-payment"
                    );

                    return;
                }

                if (
                    data.status === "rejected" ||
                    data.status === "cancelled"
                ) {

                    setStatus("error");

                    return;
                }

            }

            /*
             * O webhook pode ainda estar processando.
             *
             * Por isso observamos o paymentOrder
             * em tempo real.
             */

            const unsubscribe =
                onValue(
                    paymentRef,
                    (snapshot) => {

                        if (!snapshot.exists()) {
                            return;
                        }

                        const data =
                            snapshot.val();

                        setPaymentData(data);

                        /*
                         * PAGAMENTO CONFIRMADO
                         */

                        if (
                            data.status === "paid" ||
                            data.scheduleCreated === true
                        ) {

                            setStatus("success");

                            localStorage.removeItem(
                                "markfy-pending-payment"
                            );

                            unsubscribe();

                            return;
                        }

                        /*
                         * PAGAMENTO RECUSADO
                         */

                        if (
                            data.status === "rejected" ||
                            data.status === "cancelled"
                        ) {

                            setStatus("error");

                            unsubscribe();

                            return;
                        }

                        /*
                         * Continua aguardando
                         */

                        setStatus("checking");
                    }
                );

            /*
             * Evita deixar o usuário esperando
             * indefinidamente.
             */

            setTimeout(() => {

                unsubscribe();

                setStatus((currentStatus) => {

                    if (
                        currentStatus === "checking"
                    ) {
                        return "timeout";
                    }

                    return currentStatus;

                });

            }, 60000);

        } catch (error) {

            console.error(
                "Erro ao verificar pagamento:",
                error
            );

            setStatus("error");
        }
    };

    useEffect(() => {

        checkPayment();

    }, []);

    /*
     * ==========================================
     * REDIRECIONAR PARA O AGENDAMENTO
     * ==========================================
     */

    const handleViewAppointment = () => {

        /*
         * Guardamos os dados para que a aplicação
         * principal possa utilizá-los.
         */

        try {

            if (paymentData) {

                localStorage.setItem(
                    "markfy-last-agendamento",
                    JSON.stringify({
                        ...paymentData,

                        status: "pending"
                    })
                );

            }

        } catch (error) {

            console.error(
                "Erro ao salvar agendamento:",
                error
            );

        }

        window.dispatchEvent(
            new Event(
                "markfy:go-to-reservations"
            )
        );

        window.location.href = "/";
    };

    const handleClose = () => {

        window.location.href = "/";
    };

    /*
     * ==========================================
     * RENDER
     * ==========================================
     */

    return (
        <div className="payment-result">

            <div className="payment-result-card">

                {status === "checking" && (
                    <div className="payment-result-content">

                        <div className="payment-result-icon loading">
                            <Icon
                                icon="svg-spinners:ring-resize"
                            />
                        </div>

                        <h1>
                            Confirmando seu pagamento
                        </h1>

                        <p>
                            Estamos verificando o pagamento
                            e preparando seu agendamento.
                        </p>

                        <span className="payment-result-hint">
                            Isso pode levar alguns segundos.
                        </span>

                    </div>
                )}

                {status === "success" && (
                    <div className="payment-result-content">

                        <div className="payment-result-icon success">
                            <Icon
                                icon="mdi:check-circle"
                            />
                        </div>

                        <h1>
                            Pagamento confirmado!
                        </h1>

                        <p>
                            Seu agendamento foi realizado
                            com sucesso.
                        </p>

                        <div className="payment-result-actions">

                            <button
                                type="button"
                                className="payment-result-btn primary"
                                onClick={
                                    handleViewAppointment
                                }
                            >
                                Ver Agendamento
                            </button>

                            <button
                                type="button"
                                className="payment-result-btn secondary"
                                onClick={handleClose}
                            >
                                Fechar
                            </button>

                        </div>

                    </div>
                )}

                {(status === "error" ||
                    status === "timeout") && (
                        <div className="payment-result-content">

                            <div className="payment-result-icon error">
                                <Icon
                                    icon="mdi:alert-circle"
                                />
                            </div>

                            <h1>
                                Não conseguimos confirmar
                                o pagamento
                            </h1>

                            <p>
                                O pagamento ainda não foi
                                confirmado. Se você concluiu
                                o pagamento, aguarde alguns
                                instantes e tente novamente.
                            </p>

                            <div className="payment-result-actions">

                                <button
                                    type="button"
                                    className="payment-result-btn primary"
                                    onClick={checkPayment}
                                >
                                    Tentar novamente
                                </button>

                                <button
                                    type="button"
                                    className="payment-result-btn secondary"
                                    onClick={handleClose}
                                >
                                    Voltar
                                </button>

                            </div>

                        </div>
                    )}

            </div>

        </div>
    );
};

export default PaymentResult;