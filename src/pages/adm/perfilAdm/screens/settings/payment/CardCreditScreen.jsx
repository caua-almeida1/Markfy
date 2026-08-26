import { useState } from "react";
import { Icon } from "@iconify/react";

const CardCreditScreen = ({ onBack }) => {
    const [saving, setSaving] = useState(false);
 

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
                        Cartão de crédito
                    </h3>

                    <p>
                        Adicione um cartão para receber
                        pagamentos dos seus clientes.
                    </p>

                </div>

            </div>


            {/* ================= CARD ================= */}

            <div className="payment-methods-card">

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
                        Os dados do cartão não serão armazenados
                        diretamente no sistema. Eles serão
                        processados de forma segura pelo provedor
                        de pagamentos.
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
        </div>

    );

};

export default CardCreditScreen;