import { useState } from "react";
import { Icon } from "@iconify/react";

const CardConfigScreen = ({ onBack, openScreen }) => {

    const [cardsEnabled, setCardsEnabled] = useState(false);

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
                        Configurar cartões
                    </h3>

                    <p>
                        Configure os cartões que seus clientes
                        poderão utilizar para realizar pagamentos.
                    </p>

                </div>

            </div>


            {/* ================= ATIVAR ================= */}

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
                                Ativar cartões
                            </h3>

                            <p>
                                Permitir pagamentos utilizando
                                cartões de crédito e débito.
                            </p>

                        </div>

                    </div>

                    <button
                        type="button"
                        className={`toggle-switch ${cardsEnabled ? "active" : ""
                            }`}
                        onClick={() =>
                            setCardsEnabled(prev => !prev)
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


            {/* ================= CARTÕES ================= */}

            <div
                className={`payment-section ${!cardsEnabled
                        ? "payment-section-disabled"
                        : ""
                    }`}
            >

                <h3 className="payment-section-title">
                    Tipos de cartão
                </h3>

                <div className="payment-methods-card">

                    {/* ================= CRÉDITO ================= */}

                    <button
                        type="button"
                        className="payment-method"
                        disabled={!cardsEnabled}
                        onClick={() =>
                            openScreen("payment-card-credit")
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
                                    Cartão de crédito
                                </h3>

                                <p>
                                    Adicione um cartão de crédito
                                </p>

                            </div>

                        </div>

                        <Icon
                            icon="iconamoon:arrow-right-2"
                            className="payment-method-arrow"
                        />

                    </button>


                    {/* ================= DÉBITO ================= */}

                    <button
                        type="button"
                        className="payment-method"
                        disabled={!cardsEnabled}
                        onClick={() =>
                            openScreen("payment-card-debit")
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
                                    Cartão de débito
                                </h3>

                                <p>
                                    Adicione um cartão de débito
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


            {/* ================= VOLTAR ================= */}

            <div className="payment-actions">

                <button
                    type="button"
                    className="payment-cancel"
                    onClick={onBack}
                >
                    Voltar
                </button>

            </div>

        </div>

    );

};

export default CardConfigScreen;