import React from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import { formatPrice } from "../../utils/price";
import { getBillingCycle } from "../../utils/subscription";
import { getSubscriptionStatusInfo } from "../../utils/subscriptionRuntime";


/* =========================================================
   RESULTADO DA ASSINATURA

   A última etapa do checkout e a tela de volta do Mercado
   Pago mostram a mesma coisa: em que pé está a assinatura e
   o que a pessoa faz agora. Recebe a assinatura VIVA (do
   banco, via watchSubscription) — o webhook e a
   sincronização mudam o estado enquanto a tela está aberta.
========================================================= */

const longDate = (ms) =>
    new Date(Number(ms)).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    });


const FirstBooking = ({ firstBooking, booking, onChooseTime }) => {

    const status = firstBooking?.status;

    if (!status) {
        return (
            <div className="subcheck-result-booking">
                <Icon icon="solar:calendar-add-outline" />
                <div>
                    <strong>Agende quando quiser</strong>
                    <span>
                        Seus atendimentos do plano são marcados pela página
                        do produto, sem pagar de novo.
                    </span>
                </div>
                <button type="button" onClick={onChooseTime}>
                    Agendar agora
                </button>
            </div>
        );
    }

    if (status === "booked") {
        return (
            <div className="subcheck-result-booking is-ok">
                <Icon icon="solar:calendar-mark-bold" />
                <div>
                    <strong>Primeiro atendimento reservado</strong>
                    <span>
                        {booking?.dayLabel || booking?.day}
                        {booking?.hour ? ` às ${booking.hour}` : ""}
                        {booking?.professionalName ? ` com ${booking.professionalName}` : ""}
                    </span>
                </div>
            </div>
        );
    }

    if (status === "failed") {
        return (
            <div className="subcheck-result-booking is-warning" role="alert">
                <Icon icon="solar:danger-triangle-outline" />
                <div>
                    <strong>Não deu para reservar o horário escolhido</strong>
                    <span>
                        {firstBooking.message || "O horário não estava mais livre."}{" "}
                        Sua assinatura está ativa: escolha outro horário, sem pagar nada.
                    </span>
                </div>
                <button type="button" onClick={onChooseTime}>
                    Escolher horário
                </button>
            </div>
        );
    }

    return (
        <div className="subcheck-result-booking">
            <Icon icon="svg-spinners:ring-resize" />
            <div>
                <strong>Reservando seu horário…</strong>
                <span>Isso leva só alguns segundos.</span>
            </div>
        </div>
    );
};


const SubscriptionResult = ({
    subscription,
    loading,
    companyHandle,
    productId,
    productName,
    booking,
    onSync,
    syncing
}) => {

    const navigate = useNavigate();

    const goToReservations = () =>
        navigate(`/central-user/${companyHandle}?tab=reservas`);

    const goToProduct = () =>
        navigate(`/central-user/${companyHandle}${productId ? `?product=${productId}` : ""}`);


    if (loading && !subscription) {
        return (
            <div className="subcheck-result">
                <div className="subcheck-result-icon is-pending">
                    <Icon icon="svg-spinners:ring-resize" />
                </div>
                <h2>Confirmando com o Mercado Pago…</h2>
                <p>Não feche esta página.</p>
            </div>
        );
    }


    const status = subscription?.status;

    /* ---------------- ATIVA ---------------- */

    if (status === "authorized" || status === "past_due") {

        const ciclo = getBillingCycle(subscription.billingCycle);
        const estado = getSubscriptionStatusInfo(subscription);

        return (
            <div className="subcheck-result">

                <div className="subcheck-result-icon is-success">
                    <Icon icon="solar:check-circle-bold" />
                </div>

                <h2>Assinatura ativa!</h2>

                <p>
                    A cobrança automática de{" "}
                    <strong>{formatPrice(subscription.price)}</strong>{" "}
                    ({ciclo.periodLabel.toLowerCase()}) está autorizada.
                    Você recebe os comprovantes do Mercado Pago por e-mail.
                </p>

                {status === "past_due" && (
                    <p className="subcheck-result-alert" role="alert">
                        <Icon icon="solar:danger-triangle-outline" />
                        {estado.description}
                    </p>
                )}

                <dl className="subcheck-result-facts">
                    <div>
                        <dt>Plano</dt>
                        <dd>{subscription.productName || productName}</dd>
                    </div>
                    <div>
                        <dt>Próxima cobrança</dt>
                        <dd>
                            {subscription.nextBillingAt
                                ? longDate(subscription.nextBillingAt)
                                : "—"}
                        </dd>
                    </div>
                    <div>
                        <dt>Para cancelar</dt>
                        <dd>Reservas → Mensalidades</dd>
                    </div>
                </dl>

                <FirstBooking
                    firstBooking={subscription.firstBooking}
                    booking={booking}
                    onChooseTime={goToProduct}
                />

                <div className="subcheck-actions">
                    <button
                        type="button"
                        className="subcheck-button subcheck-button--primary"
                        onClick={goToReservations}
                    >
                        <span>Ver minhas mensalidades</span>
                        <Icon icon="solar:arrow-right-outline" />
                    </button>
                </div>

            </div>
        );
    }


    /* ---------------- ESPERANDO ---------------- */

    if (status === "pending") {
        return (
            <div className="subcheck-result">

                <div className="subcheck-result-icon is-pending">
                    <Icon icon="solar:hourglass-line-linear" />
                </div>

                <h2>Falta pouco</h2>

                <p>
                    Assim que o Mercado Pago confirmar a sua autorização,
                    a assinatura é ativada. Esta tela se atualiza sozinha.
                </p>

                <div className="subcheck-actions">
                    <button
                        type="button"
                        className="subcheck-button subcheck-button--primary"
                        onClick={onSync}
                        disabled={syncing}
                    >
                        {syncing ? (
                            <>
                                <Icon icon="svg-spinners:ring-resize" />
                                <span>Verificando…</span>
                            </>
                        ) : (
                            <>
                                <Icon icon="solar:refresh-outline" />
                                <span>Verificar agora</span>
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        className="subcheck-button subcheck-button--ghost"
                        onClick={goToProduct}
                    >
                        Tentar outra forma de pagamento
                    </button>
                </div>

                <p className="subcheck-result-note">
                    <Icon icon="solar:info-circle-linear" />
                    Desistiu no Mercado Pago? Tudo bem: nada foi cobrado, e a
                    tentativa é apagada sozinha em até 48 horas.
                </p>

            </div>
        );
    }


    /* ---------------- NÃO CONCLUÍDA ---------------- */

    return (
        <div className="subcheck-result">

            <div className="subcheck-result-icon is-error">
                <Icon icon="solar:close-circle-outline" />
            </div>

            <h2>A assinatura não foi concluída</h2>

            <p>
                Nenhuma cobrança foi feita. Você pode tentar de novo pelo
                cartão de crédito ou pela sua conta Mercado Pago.
            </p>

            <div className="subcheck-actions">
                <button
                    type="button"
                    className="subcheck-button subcheck-button--primary"
                    onClick={goToProduct}
                >
                    Tentar de novo
                </button>
            </div>

        </div>
    );
};


export default SubscriptionResult;
