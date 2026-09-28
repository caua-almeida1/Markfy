import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import MercadoPagoPayment from "../../../components/mercado-pago-payment/MercadoPagoPayment";
import { releaseScrollLock } from "../../../components/modal/Modal";

import "./Checkout.css";


const Checkout = () => {

    const navigate = useNavigate();
    const location = useLocation();

    const checkoutData =
        location.state?.checkoutData || null;


    const [showPayment, setShowPayment] =
        useState(false);


    /*
     * Chegamos aqui vindo de um modal, que trava o scroll do
     * body enquanto está aberto. A navegação desmonta o modal
     * fora do ciclo normal de fechamento, e a trava podia
     * sobrar — a página abria sem rolagem e só voltava ao
     * normal recarregando. Soltar na entrada é barato e não
     * depende de nada ter dado certo antes.
     */
    useEffect(() => {

        releaseScrollLock();

    }, []);


    /*
     * Pix em aberto: volta direto para a cobrança.
     *
     * Recarregar a página zerava `showPayment` e devolvia a
     * pessoa para "escolha como pagar" — com um Pix já
     * emitido e esperando. Pagar de novo criaria uma segunda
     * cobrança do mesmo horário.
     */
    useEffect(() => {

        try {

            const bruto =
                localStorage.getItem("markfy-pending-pix");

            if (!bruto) return;

            const salvo = JSON.parse(bruto);

            if (
                salvo?.pix?.qrCode &&
                salvo.companyHandle === checkoutData?.companyHandle &&
                salvo.productId === checkoutData?.productId
            ) {
                setShowPayment(true);
            }

        } catch {

            /* Sem localStorage utilizável: segue o fluxo normal. */

        }

    }, [
        checkoutData?.companyHandle,
        checkoutData?.productId
    ]);


    const product =
        checkoutData?.product || null;


    const amount = useMemo(() => {

        const value =
            checkoutData?.productPrice ??
            product?.value ??
            0;

        if (typeof value === "number") {
            return value;
        }

        return Number(
            String(value)
                .replace(/[^\d,.-]/g, "")
                .replace(",", ".")
        ) || 0;

    }, [
        checkoutData,
        product
    ]);


    const formattedAmount =
        amount.toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL"
            }
        );


    /*
     * =====================================================
     * SEM DADOS
     * =====================================================
     */

    if (!checkoutData) {

        return (

            <main className="checkout-page checkout-page--empty">

                <div className="checkout-empty">

                    <div className="checkout-empty-icon">

                        <Icon
                            icon="solar:danger-circle-outline"
                        />

                    </div>

                    <h1>
                        Checkout indisponível
                    </h1>

                    <p>
                        Não encontramos os dados desse pagamento.
                        Volte ao catálogo e tente novamente.
                    </p>

                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                    >
                        <Icon
                            icon="solar:arrow-left-outline"
                        />

                        Voltar

                    </button>

                </div>

            </main>

        );

    }


    /*
     * =====================================================
     * PAGAMENTO
     * =====================================================
     */

    if (showPayment) {

        return (

            <main className="checkout-page">

                <header className="checkout-header">

                    <button
                        type="button"
                        className="checkout-back"
                        onClick={() =>
                            setShowPayment(false)
                        }
                    >

                        <Icon
                            icon="solar:arrow-left-outline"
                        />

                    </button>


                    <div className="checkout-header-brand">

                        <strong>
                            Markfy
                        </strong>

                        <span>
                            Pagamento seguro
                        </span>

                    </div>


                    <div className="checkout-header-processor">

                        <Icon icon="solar:shield-check-bold" />

                        <span>
                            Pagamento processado por
                            <strong>Mercado Pago</strong>
                        </span>

                    </div>

                </header>


                <section className="checkout-payment-screen">

                    <div className="checkout-payment-heading">

                        <span>
                            PAGAMENTO
                        </span>

                        <h1>
                            Finalize seu pagamento
                        </h1>

                        <p>
                            Escolha uma forma de pagamento
                            para confirmar seu agendamento.
                        </p>

                    </div>


                    <div className="checkout-payment-layout">

                        <aside className="checkout-summary">

                            <div className="checkout-summary-heading">

                                <span>
                                    RESUMO
                                </span>

                                <h2>
                                    Seu agendamento
                                </h2>

                            </div>


                            <div className="checkout-summary-service">

                                {product?.images?.[0] ? (

                                    <img
                                        src={product.images[0]}
                                        alt=""
                                    />

                                ) : (

                                    <div className="checkout-summary-image">

                                        <Icon
                                            icon="solar:calendar-outline"
                                        />

                                    </div>

                                )}


                                <div>

                                    <strong>
                                        {
                                            checkoutData.productName ||
                                            product?.name ||
                                            "Agendamento"
                                        }
                                    </strong>

                                    <span>
                                        {
                                            checkoutData.companyName ||
                                            "Empresa"
                                        }
                                    </span>

                                </div>

                            </div>


                            <div className="checkout-summary-details">

                                <div>

                                    <Icon
                                        icon="solar:calendar-outline"
                                    />

                                    <div>

                                        <span>
                                            Data
                                        </span>

                                        <strong>
                                            {
                                                checkoutData.dayLabel ||
                                                checkoutData.day ||
                                                "-"
                                            }
                                        </strong>

                                    </div>

                                </div>


                                <div>

                                    <Icon
                                        icon="solar:clock-circle-outline"
                                    />

                                    <div>

                                        <span>
                                            Horário
                                        </span>

                                        <strong>
                                            {
                                                checkoutData.hour ||
                                                "-"
                                            }
                                        </strong>

                                    </div>

                                </div>


                                <div>

                                    <Icon
                                        icon="solar:user-outline"
                                    />

                                    <div>

                                        <span>
                                            Profissional
                                        </span>

                                        <strong>
                                            {
                                                checkoutData.professionalName ||
                                                "Profissional"
                                            }
                                        </strong>

                                    </div>

                                </div>

                            </div>


                            <div className="checkout-summary-total">

                                <span>
                                    Total
                                </span>

                                <strong>
                                    {formattedAmount}
                                </strong>

                            </div>

                        </aside>


                        <section className="checkout-payment-card">

                            <div className="checkout-payment-card-heading">

                                <div>

                                    <span>
                                        PAGAMENTO
                                    </span>

                                    <h2>
                                        Escolha como pagar
                                    </h2>

                                </div>

                                <div className="checkout-secure">

                                    <Icon
                                        icon="solar:shield-check-outline"
                                    />

                                    Seguro

                                </div>

                            </div>


                            {/* Serviços emendados: quem vai pagar
                                precisa ver pelo que está pagando —
                                o valor somado sozinho não diz. */}
                            {checkoutData.extraServices?.length > 0 && (

                                <div className="checkout-extra-services">

                                    <span className="checkout-extra-services-label">
                                        Neste atendimento
                                    </span>

                                    <ul>

                                        <li>
                                            <Icon icon="solar:check-circle-bold" />
                                            <span>{checkoutData.productName}</span>
                                        </li>

                                        {checkoutData.extraServices.map((item) => (
                                            <li key={item.productId}>
                                                <Icon icon="solar:check-circle-bold" />
                                                <span>{item.name}</span>
                                                <small>{item.value}</small>
                                            </li>
                                        ))}

                                    </ul>

                                </div>

                            )}


                            <MercadoPagoPayment

                                amount={amount}

                                companyHandle={
                                    checkoutData.companyHandle
                                }

                                productId={
                                    checkoutData.productId
                                }

                                professionalId={
                                    checkoutData.professionalId
                                }

                                professionalName={
                                    checkoutData.professionalName
                                }

                                day={
                                    checkoutData.day
                                }

                                dayLabel={
                                    checkoutData.dayLabel
                                }

                                hour={
                                    checkoutData.hour
                                }

                                userName={
                                    checkoutData.userName
                                }

                                clientId={
                                    checkoutData.clientId
                                }

                                payerEmail={
                                    checkoutData.payerEmail
                                }

                                payerPhone={
                                    checkoutData.payerPhone
                                }

                                notes={
                                    checkoutData.notes
                                }

                                subscriptionPlan={
                                    checkoutData.subscriptionPlan
                                }

                                onBack={() =>
                                    setShowPayment(false)
                                }

                                onSuccess={(data) => {

                                    console.log(
                                        "Pagamento criado:",
                                        data
                                    );

                                }}

                                onError={(error) => {

                                    console.error(
                                        "Erro no pagamento:",
                                        error
                                    );

                                }}

                            />

                        </section>

                    </div>

                </section>

            </main>

        );

    }


    /*
     * =====================================================
     * CHECKOUT / RESUMO
     * =====================================================
     */

    return (

        <main className="checkout-page">

            <header className="checkout-header">

                <button
                    type="button"
                    className="checkout-back"
                    onClick={() => navigate(-1)}
                    aria-label="Voltar"
                >

                    <Icon
                        icon="solar:arrow-left-outline"
                    />

                </button>


                <div className="checkout-header-brand">

                    <strong>
                        Markfy
                    </strong>

                    <span>
                        Checkout
                    </span>

                </div>


                <div className="checkout-header-processor">

                    <Icon icon="solar:shield-check-bold" />

                    <span>
                        Pagamento processado por
                        <strong>Mercado Pago</strong>
                    </span>

                </div>

            </header>


            <section className="checkout-content">

                <div className="checkout-intro">

                    <span className="checkout-eyebrow">
                        FINALIZAÇÃO
                    </span>

                    <h1>
                        Revise seu agendamento
                    </h1>

                    <p>
                        Confira os dados abaixo antes de
                        continuar para o pagamento.
                    </p>

                </div>


                <div className="checkout-grid">

                    <section className="checkout-main-card">

                        <div className="checkout-card-heading">

                            <div className="checkout-card-icon">

                                <Icon
                                    icon="solar:calendar-outline"
                                />

                            </div>

                            <div>

                                <span>
                                    AGENDAMENTO
                                </span>

                                <h2>
                                    Detalhes do atendimento
                                </h2>

                            </div>

                        </div>


                        <div className="checkout-service">

                            {product?.images?.[0] ? (

                                <img
                                    src={product.images[0]}
                                    alt={
                                        checkoutData.productName ||
                                        "Serviço"
                                    }
                                />

                            ) : (

                                <div className="checkout-service-image">

                                    <Icon
                                        icon="solar:scissors-outline"
                                    />

                                </div>

                            )}


                            <div className="checkout-service-info">

                                <span>
                                    Serviço
                                </span>

                                <h2>
                                    {
                                        checkoutData.productName ||
                                        product?.name ||
                                        "Agendamento"
                                    }
                                </h2>

                                <p>
                                    {
                                        checkoutData.companyName ||
                                        "Empresa"
                                    }
                                </p>

                            </div>

                        </div>


                        <div className="checkout-info-grid">

                            <div>

                                <Icon
                                    icon="solar:calendar-outline"
                                />

                                <span>
                                    Data
                                </span>

                                <strong>
                                    {
                                        checkoutData.dayLabel ||
                                        checkoutData.day ||
                                        "-"
                                    }
                                </strong>

                            </div>


                            <div>

                                <Icon
                                    icon="solar:clock-circle-outline"
                                />

                                <span>
                                    Horário
                                </span>

                                <strong>
                                    {
                                        checkoutData.hour ||
                                        "-"
                                    }
                                </strong>

                            </div>


                            <div>

                                <Icon
                                    icon="solar:user-outline"
                                />

                                <span>
                                    Profissional
                                </span>

                                <strong>
                                    {
                                        checkoutData.professionalName ||
                                        "Profissional"
                                    }
                                </strong>

                            </div>

                        </div>


                        <div className="checkout-client">

                            <div className="checkout-client-icon">

                                <Icon
                                    icon="solar:user-circle-outline"
                                />

                            </div>

                            <div>

                                <span>
                                    Agendamento para
                                </span>

                                <strong>
                                    {
                                        checkoutData.userName ||
                                        "Cliente"
                                    }
                                </strong>

                            </div>

                        </div>

                    </section>


                    <aside className="checkout-order-card">

                        <div>

                            <span className="checkout-eyebrow">
                                PAGAMENTO
                            </span>

                            <h2>
                                Resumo do pedido
                            </h2>

                        </div>


                        <div className="checkout-order-line">

                            <span>
                                {
                                    checkoutData.productName ||
                                    product?.name ||
                                    "Serviço"
                                }
                            </span>

                            <strong>
                                {formattedAmount}
                            </strong>

                        </div>


                        <div className="checkout-order-divider" />


                        <div className="checkout-order-total">

                            <span>
                                Total
                            </span>

                            <strong>
                                {formattedAmount}
                            </strong>

                        </div>


                        <div className="checkout-payment-methods">

                            <span>
                                Formas de pagamento
                            </span>

                            <div>

                                <span>

                                    <Icon
                                        icon="solar:card-outline"
                                    />

                                    Cartão

                                </span>


                                <span>

                                    <Icon
                                        icon="solar:qr-code-outline"
                                    />

                                    Pix

                                </span>

                            </div>

                        </div>


                        <button
                            type="button"
                            className="checkout-continue"
                            onClick={() =>
                                setShowPayment(true)
                            }
                        >

                            <span>
                                Continuar para pagamento
                            </span>

                            <Icon
                                icon="solar:arrow-right-outline"
                            />

                        </button>


                        <div className="checkout-security-note">

                            <Icon
                                icon="solar:shield-check-outline"
                            />

                            <span>
                                Seus dados de pagamento são
                                processados de forma segura.
                            </span>

                        </div>

                    </aside>

                </div>

            </section>

        </main>

    );

};


export default Checkout;