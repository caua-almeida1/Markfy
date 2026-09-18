import React, {
    useEffect,
    useRef,
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


const FUNCTIONS_URL =
    "https://us-central1-markfy-96942.cloudfunctions.net";


/* =====================================================
   MENSAGENS DE RECUSA

   O Mercado Pago devolve um status_detail técnico; aqui
   ele vira uma instrução que o cliente consegue seguir.
===================================================== */

const REJECTION_MESSAGES = {
    cc_rejected_bad_filled_card_number:
        "Confira o número do cartão.",
    cc_rejected_bad_filled_date:
        "Confira a data de validade do cartão.",
    cc_rejected_bad_filled_security_code:
        "Confira o código de segurança do cartão.",
    cc_rejected_bad_filled_other:
        "Confira os dados do cartão.",
    cc_rejected_insufficient_amount:
        "O cartão não tem limite suficiente. Tente outro cartão ou o Pix.",
    cc_rejected_call_for_authorize:
        "O banco pediu autorização para este pagamento. Ligue para o banco e tente de novo.",
    cc_rejected_card_disabled:
        "Este cartão está desativado. Ligue para o banco ou use outro cartão.",
    cc_rejected_duplicated_payment:
        "Você já fez um pagamento igual. Se precisar pagar de novo, use outro cartão.",
    cc_rejected_high_risk:
        "O pagamento foi recusado por segurança. Tente outro cartão ou o Pix.",
    cc_rejected_max_attempts:
        "Limite de tentativas atingido. Tente outro cartão ou o Pix.",
    cc_rejected_blacklist:
        "Não foi possível pagar com este cartão. Tente outro cartão ou o Pix.",
    cc_rejected_other_reason:
        "O banco recusou o pagamento. Tente outro cartão ou o Pix."
};


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

    const [publicKey, setPublicKey] =
        useState(null);

    const [loading, setLoading] =
        useState(true);

    const [loadError, setLoadError] =
        useState("");

    const [error, setError] =
        useState("");

    // Resultado final: aprovado, Pix aguardando ou em análise.
    const [result, setResult] =
        useState(null);

    const [copied, setCopied] =
        useState(false);


    /*
     * Os callbacks costumam chegar como funções inline, que
     * mudam a cada render do pai. Guardá-los em ref evita
     * reinicializar o pagamento (e remontar o formulário)
     * toda vez que o checkout renderiza.
     */
    const onErrorRef = useRef(onError);
    const onSuccessRef = useRef(onSuccess);

    useEffect(() => {
        onErrorRef.current = onError;
        onSuccessRef.current = onSuccess;
    }, [onError, onSuccess]);


    /* =====================================================
       CHAVE PÚBLICA DA EMPRESA

       O cartão precisa ser tokenizado com a chave da MESMA
       conta que recebe o pagamento — a da empresa, conectada
       via OAuth. Uma chave fixa do .env pertence a outra
       conta e o Mercado Pago recusa o token do cartão.
    ===================================================== */

    useEffect(() => {

        let cancelled = false;

        const loadPublicKey = async () => {

            try {

                setLoading(true);
                setLoadError("");

                const currentUser =
                    getAuth().currentUser;

                if (!currentUser) {
                    throw new Error(
                        "Entre na sua conta para pagar."
                    );
                }

                if (!companyHandle) {
                    throw new Error(
                        "Empresa não informada."
                    );
                }

                const idToken =
                    await currentUser.getIdToken();

                const response =
                    await fetch(
                        `${FUNCTIONS_URL}/getMercadoPagoPublicKey?companyHandle=${encodeURIComponent(companyHandle)}`,
                        {
                            headers: {
                                Authorization:
                                    `Bearer ${idToken}`
                            }
                        }
                    );

                const data =
                    await response
                        .json()
                        .catch(() => ({}));

                if (
                    !response.ok ||
                    !data.success ||
                    !data.publicKey
                ) {
                    throw new Error(
                        data.message ||
                        "Esta empresa ainda não ativou pagamentos online."
                    );
                }

                if (cancelled) return;

                initMercadoPago(
                    data.publicKey,
                    {
                        locale: "pt-BR"
                    }
                );

                setPublicKey(data.publicKey);

            } catch (err) {

                if (cancelled) return;

                console.error(
                    "Erro ao preparar Mercado Pago:",
                    err
                );

                setLoadError(
                    err?.message ||
                    "Não foi possível carregar o pagamento."
                );

                onErrorRef.current?.(err);

            } finally {

                if (!cancelled) {
                    setLoading(false);
                }

            }
        };

        loadPublicKey();

        return () => {
            cancelled = true;
        };

    }, [companyHandle]);


    /* =====================================================
       ENVIAR PAGAMENTO
    ===================================================== */

    const handleSubmit = async ({
        selectedPaymentMethod,
        formData
    }) => {

        try {

            setError("");

            const currentUser =
                getAuth().currentUser;

            if (!currentUser) {
                throw new Error(
                    "Entre na sua conta para pagar."
                );
            }

            const idToken =
                await currentUser.getIdToken();


            const paymentMethodId =
                formData?.payment_method_id ||
                selectedPaymentMethod?.id ||
                null;

            if (!paymentMethodId) {
                throw new Error(
                    "Escolha uma forma de pagamento."
                );
            }


            const payerData =
                formData?.payer || {};

            const payer = {

                ...(payerData.email
                    ? { email: payerData.email }
                    : {}
                ),

                ...(payerData.identification
                    ? {
                        identification: {
                            type:
                                payerData.identification.type,
                            number:
                                payerData.identification.number
                        }
                    }
                    : {}
                )

            };


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
                    formData?.token || null,

                issuerId:
                    formData?.issuer_id || null,

                installments:
                    Number(formData?.installments) > 0
                        ? Number(formData.installments)
                        : 1,

                payer

            };


            const response =
                await fetch(
                    `${FUNCTIONS_URL}/createMercadoPagoPayment`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                            Authorization:
                                `Bearer ${idToken}`
                        },
                        body:
                            JSON.stringify(paymentData)
                    }
                );

            const data =
                await response
                    .json()
                    .catch(() => ({}));


            if (!response.ok || !data.success) {

                const failure =
                    new Error(
                        data.message ||
                        "Não foi possível processar o pagamento."
                    );

                failure.details =
                    data.details || null;

                failure.code =
                    data.code || null;

                throw failure;
            }


            /* ---------------------------------------------
               Recusado pelo banco: a requisição deu certo,
               mas o pagamento não. Mostra o motivo e deixa
               o cliente tentar de novo no mesmo formulário.
            --------------------------------------------- */

            if (
                data.status === "rejected" ||
                data.status === "cancelled"
            ) {

                setError(
                    REJECTION_MESSAGES[data.statusDetail] ||
                    "O pagamento foi recusado. Tente outro cartão ou o Pix."
                );

                // O Brick espera a promise rejeitar para
                // liberar o botão de pagar novamente.
                throw Object.assign(
                    new Error("rejected"),
                    { handled: true }
                );
            }


            if (data.paymentId) {

                localStorage.setItem(
                    "markfy-pending-payment",
                    JSON.stringify({
                        paymentId: data.paymentId,
                        companyHandle,
                        productId,
                        day,
                        hour
                    })
                );

            }

            setResult(data);

            onSuccessRef.current?.(data);

        } catch (err) {

            if (!err?.handled) {

                console.error(
                    "❌ Erro ao processar pagamento:",
                    err?.message,
                    err?.details || ""
                );

                setError(
                    err?.message ||
                    "Não foi possível processar o pagamento."
                );

                onErrorRef.current?.(err);
            }

            throw err;
        }

    };


    const copyPixCode = async () => {

        try {

            await navigator.clipboard.writeText(
                result?.pix?.qrCode || ""
            );

            setCopied(true);

            setTimeout(() => setCopied(false), 2500);

        } catch {

            setCopied(false);

        }
    };


    /* =====================================================
       CARREGANDO
    ===================================================== */

    if (loading) {

        return (
            <div className="mercado-pago-payment-loading">
                <div className="mercado-pago-payment-spinner" />
                <p>Preparando pagamento...</p>
            </div>
        );
    }


    /* =====================================================
       NÃO FOI POSSÍVEL PREPARAR
    ===================================================== */

    if (loadError || !publicKey) {

        return (
            <div className="mercado-pago-payment-error">

                <Icon icon="mdi:alert-circle-outline" />

                <h3>Pagamento online indisponível</h3>

                <p>{loadError}</p>

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
       RESULTADO
    ===================================================== */

    if (result) {

        const pix =
            result.pix;

        if (
            result.status === "pending" &&
            pix?.qrCode
        ) {

            return (
                <div className="mercado-pago-payment-result">

                    <Icon
                        icon="solar:qr-code-linear"
                        className="mercado-pago-payment-result-icon"
                    />

                    <h3>Pague com Pix para confirmar</h3>

                    <p>
                        Abra o app do seu banco, escolha pagar com Pix
                        e escaneie o código ou use o copia e cola.
                        O horário é confirmado assim que o pagamento cair.
                    </p>

                    {pix.qrCodeBase64 && (
                        <img
                            className="mercado-pago-payment-qr"
                            src={`data:image/png;base64,${pix.qrCodeBase64}`}
                            alt="QR code do Pix"
                        />
                    )}

                    <div className="mercado-pago-payment-pix-code">
                        <code>{pix.qrCode}</code>
                    </div>

                    <button
                        type="button"
                        className="mercado-pago-payment-primary"
                        onClick={copyPixCode}
                    >
                        {copied
                            ? "Código copiado"
                            : "Copiar código Pix"}
                    </button>

                    {pix.ticketUrl && (
                        <a
                            href={pix.ticketUrl}
                            target="_blank"
                            rel="noreferrer"
                        >
                            Abrir Pix no Mercado Pago
                        </a>
                    )}

                </div>
            );
        }

        if (result.status === "approved") {

            return (
                <div className="mercado-pago-payment-result">

                    <Icon
                        icon="solar:check-circle-bold"
                        className="mercado-pago-payment-result-icon is-success"
                    />

                    <h3>Pagamento aprovado</h3>

                    <p>
                        Seu horário {dayLabel ? `de ${dayLabel} ` : ""}
                        às {hour} está confirmado.
                    </p>

                </div>
            );
        }

        return (
            <div className="mercado-pago-payment-result">

                <Icon
                    icon="solar:hourglass-line-linear"
                    className="mercado-pago-payment-result-icon"
                />

                <h3>Pagamento em análise</h3>

                <p>
                    O Mercado Pago está analisando o pagamento. Você
                    recebe a confirmação assim que ele for aprovado —
                    normalmente em poucos minutos.
                </p>

            </div>
        );
    }


    /* =====================================================
       FORMULÁRIO
    ===================================================== */

    return (

        <div className="mercado-pago-payment">

            <div className="mercado-pago-payment-content">

                <div className="mercado-pago-payment-amount">

                    <span>Total</span>

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
                    <div
                        className="mercado-pago-payment-inline-error"
                        role="alert"
                    >
                        {error}
                    </div>
                )}

                <Payment

                    initialization={{
                        amount: Number(amount) || 0
                    }}

                    customization={{
                        paymentMethods: {
                            creditCard: "all",
                            debitCard: "all",
                            bankTransfer: "all"
                        }
                    }}

                    onSubmit={handleSubmit}

                    onError={(brickError) => {

                        console.error(
                            "Erro Payment Brick:",
                            brickError
                        );

                        setError(
                            "Não foi possível carregar ou processar o pagamento."
                        );

                        onErrorRef.current?.(brickError);
                    }}

                />

            </div>

        </div>

    );

};


export default MercadoPagoPayment;
