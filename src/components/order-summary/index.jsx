import React from "react";
import "./order-summary.css";

const OrderSummary = ({
    agendamento,
    onClose,
    onBack
}) => {

    if (!agendamento) return null;

    const { product } = agendamento;

    return (
        <div
            className="order-summary-overlay"
            onClick={(e) => e.stopPropagation()}
        >

            <div
                className="order-summary-container"
                onClick={(e) => e.stopPropagation()}
            >

                {/* VOLTAR */}

                {/* <button
                    type="button"
                    className="order-summary-back"
                    onClick={onBack}
                    aria-label="Voltar"
                >
                    <span>←</span>
                    Voltar
                </button> */}


                {/* TÍTULO */}

                <h2 className="order-summary-title">
                    Resumo do Agendamento
                </h2>

                <p className="order-summary-subtext">
                    Seu agendamento está confirmado. Confira os detalhes da sua reserva.
                </p>


                {/* PRODUTO */}

                {product && (

                    <div className="order-summary-product">

                        <div className="order-summary-product-content">

                            <img
                                src={
                                    product.images?.[0] ||
                                    product.image ||
                                    "https://via.placeholder.com/100"
                                }
                                alt={product.name}
                                className="order-summary-product-image"
                            />

                            <div className="order-summary-product-details">

                                <p className="order-summary-product-name">
                                    {product.name}
                                </p>

                                <p className="order-summary-product-price">
                                    {product.value}
                                </p>

                            </div>

                        </div>

                    </div>

                )}


                {/* DETALHES */}

                <div className="order-summary-info">

                    <h3 className="order-summary-section-title">
                        Detalhes do Agendamento
                    </h3>

                    <p>
                        <strong>Código:</strong>{" "}
                        {agendamento.timestamp}
                    </p>

                    <p>
                        <strong>Nome Informado:</strong>{" "}
                        {agendamento.userName}
                    </p>

                    <p>
                        <strong>Profissional Agendado:</strong>{" "}
                        {agendamento.professionalName}
                    </p>

                    <p>
                        <strong>Data e Horário:</strong>{" "}
                        {agendamento.dayLabel} às{" "}
                        {agendamento.hour}
                    </p>

                </div>


                {/* BOTÃO */}

                <button
                    type="button"
                    className="order-summary-close"
                    onClick={onClose}
                >
                    Ver minha reserva
                </button>

                <span>
                    Acompanhe os detalhes do seu agendamento em suas reservas.
                </span>

            </div>

        </div>
    );
};

export default OrderSummary;