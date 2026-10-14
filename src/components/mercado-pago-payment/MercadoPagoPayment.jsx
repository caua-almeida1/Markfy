import React, {
    useCallback,
    useEffect,
    useMemo,
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
    getDatabase,
    onValue,
    ref
} from "firebase/database";

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

    /* Pagador já identificado antes do checkout. É o que
       permite emitir o Pix sem abrir formulário nenhum. */
    payerEmail,
    payerPhone,

    /* Recado do cliente, digitado no agendamento. Viaja junto
       porque é o backend quem cria o agendamento depois que o
       pagamento é aprovado. */
    notes,

    /* Plano de mensalidade, quando o produto é assinatura.
       Muda o endpoint, os meios de pagamento e o texto. */
    subscriptionPlan,

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

    /* Aceite explícito da cobrança automática. */
    const [autoDebitAccepted, setAutoDebitAccepted] =
        useState(false);

    /* Virou "pago" enquanto a pessoa olhava o QR. */
    const [pixPaid, setPixPaid] = useState(false);


    /* =====================================================
       PIX PENDENTE

       O QR fica na tela esperando a pessoa abrir o banco e
       pagar — o que acontece FORA do app. Sem observar o
       pagamento, a tela ficava parada para sempre, mesmo
       depois de o dinheiro cair.

       E recarregar perdia tudo: o código voltava ao "escolha
       como pagar" com uma cobrança já emitida em aberto.
       Guardar o Pix aqui é o que faz o mesmo QR voltar.
    ===================================================== */

    const PIX_STORAGE_KEY = "markfy-pending-pix";

    /* O Mercado Pago expira o Pix; depois disso o QR
       guardado não serve mais para nada. */
    const PIX_TTL_MS = 60 * 60 * 1000;


    const guardarPixPendente = (data) => {

        try {

            localStorage.setItem(
                PIX_STORAGE_KEY,
                JSON.stringify({
                    paymentId: data.paymentId,
                    companyHandle,
                    productId,
                    day,
                    hour,
                    status: data.status,
                    pix: data.pix,
                    savedAt: Date.now()
                })
            );

        } catch {

            /* Navegação privada: seguimos sem o atalho. */

        }

    };


    const limparPixPendente = () => {

        try {
            localStorage.removeItem(PIX_STORAGE_KEY);
        } catch {
            /* nada a fazer */
        }

    };


    /* Retoma o Pix em aberto ao voltar para a tela. */
    useEffect(() => {

        try {

            const bruto =
                localStorage.getItem(PIX_STORAGE_KEY);

            if (!bruto) return;

            const salvo = JSON.parse(bruto);

            const vencido =
                Date.now() - (salvo.savedAt || 0) > PIX_TTL_MS;

            if (
                vencido ||
                salvo.companyHandle !== companyHandle ||
                salvo.productId !== productId ||
                !salvo.pix?.qrCode
            ) {

                if (vencido) limparPixPendente();

                return;

            }

            setResult({
                paymentId: salvo.paymentId,
                status: "pending",
                pix: salvo.pix
            });

        } catch {

            /* JSON corrompido: ignora. */

        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyHandle, productId]);


    /*
     * Observa a cobrança enquanto o QR está na tela.
     *
     * Quem confirma é o webhook do Mercado Pago, que escreve
     * em paymentOrders. Aqui só escutamos esse nó — nada de
     * ficar perguntando de tempos em tempos.
     */
    useEffect(() => {

        const paymentId = result?.paymentId;

        if (
            !paymentId ||
            !companyHandle ||
            result?.status !== "pending" ||
            !result?.pix?.qrCode
        ) {
            return undefined;
        }

        const unsubscribe = onValue(
            ref(
                getDatabase(),
                `companys/${companyHandle}/paymentOrders/${paymentId}`
            ),
            (snapshot) => {

                const ordem = snapshot.val();

                if (!ordem) return;

                const pago =
                    ordem.status === "paid" ||
                    ordem.mercadoPagoStatus === "approved" ||
                    ordem.scheduleCreated === true;

                if (pago) {

                    setPixPaid(true);
                    limparPixPendente();
                    onSuccessRef.current?.(ordem);

                }

            }
        );

        return () => unsubscribe();

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [result?.paymentId, result?.status, companyHandle]);


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

    /*
     * Monta o pagador que vai para o Mercado Pago.
     *
     * O que o Brick manda tem prioridade — foi o cliente que
     * digitou ali. O resto vem do que já sabemos dele desde o
     * agendamento, e é isso que faz o Pix não precisar de
     * formulário: o e-mail obrigatório do pagador já está em
     * mãos antes de a tela abrir.
     */
    const montarPagador = (formPayer = {}) => {

        const [primeiroNome, ...restoDoNome] =
            String(userName || "")
                .trim()
                .split(/\s+/)
                .filter(Boolean);

        const email =
            formPayer.email ||
            payerEmail ||
            "";

        return {

            ...(email ? { email } : {}),

            ...(primeiroNome
                ? { first_name: primeiroNome }
                : {}
            ),

            ...(restoDoNome.length
                ? { last_name: restoDoNome.join(" ") }
                : {}
            ),

            /* CPF: sempre o que o Brick coletou. É ele quem
               sabe quando o meio de pagamento exige, e quem
               valida antes de enviar. */
            ...(formPayer.identification?.number
                ? {
                    identification: {
                        type:
                            formPayer.identification.type,
                        number:
                            formPayer.identification.number
                    }
                }
                : {}
            ),

            ...(payerPhone
                ? {
                    phone: {
                        area_code:
                            String(payerPhone).slice(0, 2),
                        number:
                            String(payerPhone).slice(2)
                    }
                }
                : {}
            )

        };

    };


    /*
     * O envio em si, compartilhado pelo cartão (que vem do
     * Brick) e pelo Pix (que é um botão nosso).
     */
    const enviarPagamento = async ({
        paymentMethodId,
        formData = {}
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


            if (!paymentMethodId) {
                throw new Error(
                    "Escolha uma forma de pagamento."
                );
            }


            const payer =
                montarPagador(formData?.payer);

            if (!payer.email) {
                throw new Error(
                    "Informe um e-mail para receber o comprovante."
                );
            }


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

                notes,

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


            /*
             * Assinatura vai por outro caminho.
             *
             * /v1/payments cobra UMA vez. Cobrança que se
             * repete sozinha é /preapproval, que guarda a
             * autorização no cartão — e é por isso que
             * mensalidade não aceita Pix nem boleto: não há
             * como debitá-los automaticamente.
             */
            const endpoint =
                subscriptionPlan
                    ? "createMercadoPagoSubscription"
                    : "createMercadoPagoPayment";

            const corpo =
                subscriptionPlan
                    ? {
                        companyHandle,
                        productId,
                        professionalId,
                        professionalName,
                        day,
                        dayLabel,
                        hour,
                        userName,
                        clientId,
                        notes,
                        cardTokenId: formData?.token || null,
                        payerEmail: payer.email
                    }
                    : paymentData;

            const response =
                await fetch(
                    `${FUNCTIONS_URL}/${endpoint}`,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                            Authorization:
                                `Bearer ${idToken}`
                        },
                        body:
                            JSON.stringify(corpo)
                    }
                );

            const data =
                await response
                    .json()
                    .catch(() => ({}));


            if (!response.ok || !data.success) {

                /*
                 * `details` traz o texto do próprio Mercado
                 * Pago. É lá que aparecem as recusas que não
                 * têm nada a ver com o cartão do cliente —
                 * conta de recebimento sem validação de
                 * identidade, conta sem permissão para
                 * receber, credencial desconectada. Sem
                 * mostrar isso, o cliente lê "confira os
                 * dados" e tenta de novo para sempre, e o dono
                 * da empresa nunca fica sabendo que o problema
                 * é a conta dele.
                 */
                const failure =
                    new Error(
                        data.ownerAction
                            ? data.message
                            : [
                                data.message,
                                data.details &&
                                data.details !== data.message
                                    ? `Mercado Pago: ${data.details}`
                                    : null
                            ]
                                .filter(Boolean)
                                .join(" ") ||
                            "Não foi possível processar o pagamento."
                    );

                failure.ownerAction =
                    Boolean(data.ownerAction);

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

            if (data?.pix?.qrCode) {
                guardarPixPendente(data);
            }

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


    /* O Brick devolve o método escolhido e os dados do
       cartão; daqui para baixo o caminho é o mesmo do Pix. */
    const handleSubmit = async ({
        selectedPaymentMethod,
        formData
    }) => {

        return enviarPagamento({

            paymentMethodId:
                formData?.payment_method_id ||
                selectedPaymentMethod?.id ||
                null,

            formData

        });

    };


    /* =====================================================
       PROPS ESTÁVEIS DO PAYMENT BRICK

       O <Payment> do sdk-react desmonta e recria o formulário
       sempre que initialization, customization, onSubmit ou
       onError mudam de referência. Sem memoizar, qualquer
       setState do checkout apagava o que o cliente digitou
       (nome do titular, CPF) e o Brick acusava "Dado obrigatório".
    ===================================================== */

    const isSubscription = Boolean(subscriptionPlan);

    const brickInitialization = useMemo(() => ({

        amount: Number(amount) || 0,

        /* Pré-preenche o pagador com o que o
           agendamento já coletou. */
        payer: payerEmail
            ? { email: payerEmail }
            : undefined

    }), [amount, payerEmail]);

    const brickCustomization = useMemo(() => ({
        paymentMethods:
            isSubscription
                ? {
                    /* Só crédito: débito e Pix não
                       sustentam cobrança recorrente. */
                    creditCard: "all"
                }
                : {
                    creditCard: "all",
                    debitCard: "all",

                    /* É por aqui que o Pix aparece. */
                    bankTransfer: "all"
                }
    }), [isSubscription]);

    const handleSubmitRef = useRef(handleSubmit);
    handleSubmitRef.current = handleSubmit;

    const handleBrickSubmit = useCallback(
        (data) => handleSubmitRef.current(data),
        []
    );

    const handleBrickError = useCallback((brickError) => {

        console.error(
            "Erro Payment Brick:",
            brickError
        );

        setError(
            "Não foi possível carregar ou processar o pagamento."
        );

        onErrorRef.current?.(brickError);
    }, []);


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

        /* Caiu enquanto a pessoa esperava. */
        if (pixPaid) {

            return (
                <div className="mercado-pago-payment-result">

                    <Icon
                        icon="solar:check-circle-bold"
                        className="mercado-pago-payment-result-icon is-success"
                    />

                    <h3>Pagamento confirmado</h3>

                    <p>
                        Recebemos seu Pix e seu horário
                        {dayLabel ? ` de ${dayLabel}` : ""}
                        {hour ? ` às ${hour}` : ""} está reservado.
                    </p>

                    <button
                        type="button"
                        className="mercado-pago-payment-primary"
                        onClick={() =>
                            window.location.assign(
                                `/central-user/${companyHandle}?tab=reservas`
                            )
                        }
                    >
                        Ver meu agendamento
                    </button>

                </div>
            );

        }

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
                    </p>

                    {/* A tela vira sozinha quando o webhook do
                        Mercado Pago confirma. Dizer isso evita a
                        pessoa ficar recarregando — e recarregar
                        era justamente o que a mandava de volta
                        para a escolha de pagamento. */}
                    <div className="mercado-pago-payment-waiting">

                        <Icon icon="svg-spinners:ring-resize" />

                        <span>
                            Aguardando o pagamento. Esta tela
                            se atualiza sozinha.
                        </span>

                    </div>

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

                {/* =====================================================
                    MENSALIDADE — O QUE VAI ACONTECER

                    Assinar é autorizar uma cobrança que se
                    repete sozinha. Isso precisa estar escrito
                    antes do formulário, com o valor, a
                    frequência e como cancelar — não em letra
                    miúda depois.
                ===================================================== */}

                {subscriptionPlan && (

                    <div className="mercado-pago-subscription-notice">

                        <div className="mercado-pago-subscription-notice-head">
                            <Icon icon="solar:refresh-circle-bold" />
                            <strong>Cobrança automática</strong>
                        </div>

                        <ul>

                            <li>
                                <Icon icon="solar:card-outline" />
                                <span>
                                    Serão cobrados{" "}
                                    <strong>
                                        {Number(amount || 0).toLocaleString("pt-BR", {
                                            style: "currency",
                                            currency: "BRL"
                                        })}
                                    </strong>{" "}
                                    no seu cartão{" "}
                                    <strong>
                                        {subscriptionPlan.billingCycleDescription ||
                                            "a cada ciclo"}
                                    </strong>
                                    , sem você precisar fazer nada.
                                </span>
                            </li>

                            <li>
                                <Icon icon="solar:calendar-outline" />
                                <span>
                                    A cobrança se repete até você cancelar.
                                </span>
                            </li>

                            <li>
                                <Icon icon="solar:close-circle-outline" />
                                <span>
                                    Dá para cancelar quando quiser, pela aba{" "}
                                    <strong>Reservas</strong>
                                    {subscriptionPlan.cancellationNoticeDays > 0
                                        ? `, avisando com ${subscriptionPlan.cancellationNoticeDays} dias de antecedência`
                                        : ""}
                                    {subscriptionPlan.loyaltyMonths > 0
                                        ? `. Este plano tem fidelidade de ${subscriptionPlan.loyaltyMonths} ${subscriptionPlan.loyaltyMonths === 1 ? "mês" : "meses"}`
                                        : ""}
                                    .
                                </span>
                            </li>

                            {/* Sem estorno.

                                Precisa estar no aviso, e não só
                                em algum termo: é a única parte
                                que custa dinheiro a quem
                                desistir no meio do ciclo. */}
                            <li>
                                <Icon icon="solar:shield-warning-outline" />
                                <span>
                                    <strong>
                                        Valores já cobrados não são
                                        estornados.
                                    </strong>{" "}
                                    Ao cancelar, você mantém o acesso
                                    até o fim do ciclo pago, mas não
                                    há devolução proporcional.
                                </span>
                            </li>

                            <li>
                                <Icon icon="solar:bill-list-outline" />
                                <span>
                                    Só cartão de crédito: Pix e boleto não podem
                                    ser debitados automaticamente.
                                </span>
                            </li>

                        </ul>

                        <label className="mercado-pago-subscription-accept">

                            <input
                                type="checkbox"
                                checked={autoDebitAccepted}
                                onChange={(e) =>
                                    setAutoDebitAccepted(e.target.checked)
                                }
                            />

                            <span>
                                Entendi e autorizo a cobrança automática
                                no meu cartão, e que valores já cobrados
                                não são estornados em caso de
                                cancelamento.
                            </span>

                        </label>

                    </div>

                )}


                {/* =====================================================
                    PAGAMENTO — PAYMENT BRICK

                    Pix e cartão, os dois pelo Brick do Mercado
                    Pago.

                    Já tentamos emitir o Pix por fora, com um
                    botão nosso chamando a API direto. Não
                    funcionou: o Mercado Pago exige um pagador
                    completo — e-mail, CPF, primeiro e último
                    nome — e recusa o que estiver faltando com
                    um texto que não diz o que faltou ("Error
                    in Financial Identity Use Case"). Montar
                    esse pagador na mão significa reimplementar,
                    campo a campo, a validação que o Brick já
                    faz antes de enviar.

                    O que o Brick pede a mais é pré-preenchido
                    com o que o agendamento já sabe, então o
                    cliente não redigita.
                ===================================================== */}

                {(!subscriptionPlan || autoDebitAccepted) && (

                <Payment
                    initialization={brickInitialization}
                    customization={brickCustomization}
                    onSubmit={handleBrickSubmit}
                    onError={handleBrickError}
                />

                )}

            </div>

        </div>

    );

};


export default MercadoPagoPayment;
