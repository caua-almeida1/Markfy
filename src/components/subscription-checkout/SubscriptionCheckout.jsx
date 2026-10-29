import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import { Link, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";

import { formatPrice } from "../../utils/price";
import {
    getBillingCycle,
    getPlanHighlights,
    getPlanPriceSuffix
} from "../../utils/subscription";
import {
    CONSENT_VERSION,
    WITHDRAWAL_DAYS,
    watchSubscription
} from "../../utils/subscriptionRuntime";
import {
    rememberPendingSubscription,
    subscribe
} from "../../firebase/subscriptionsApi";

import SubscriptionResult from "./SubscriptionResult";

import "./subscription-checkout.css";


/* =========================================================
   CHECKOUT DA MENSALIDADE — 4 ETAPAS

     1. Plano        o que está sendo contratado, quanto e
                     quando cobra
     2. Autorização  aceite da cobrança recorrente e dos
                     termos, com o aviso de dados (LGPD)
     3. Pagamento    cartão de crédito (aqui mesmo) ou conta
                     Mercado Pago (no site deles)
     4. Pronto       estado real da assinatura, ao vivo

   O aceite vem ANTES dos dados de pagamento de propósito:
   ninguém digita o cartão sem saber que ele vai ser cobrado
   todo mês. E o que vai para o backend é só a escolha da
   pessoa — preço, ciclo e regras o backend lê do produto.
========================================================= */

const FUNCTIONS_URL = "https://us-central1-markfy-96942.cloudfunctions.net";

export const SUBSCRIPTION_STEPS = [
    { id: "plan", label: "Plano" },
    { id: "consent", label: "Autorização" },
    { id: "payment", label: "Pagamento" },
    { id: "done", label: "Pronto" }
];

/* Só links do Mercado Pago saem daqui para o navegador. */
const MERCADO_PAGO_URL = /^https:\/\/([a-z0-9-]+\.)*mercadopago\.com(\.br)?\//i;

const ERROR_TITLES = {
    CARD_NOT_VALIDATED: "Cartão não validado",
    CARD_TOKEN_INVALID: "Digite o cartão de novo",
    SAME_ACCOUNT: "Essa é a conta de quem recebe",
    PAYER_EMAIL_INVALID: "E-mail recusado",
    MERCADO_PAGO_SUBSCRIPTION_NOT_ENABLED: "A empresa ainda não recebe mensalidades",
    not_connected: "Pagamento online indisponível",
    already_active: "Você já assina este plano",
    company_unavailable: "Empresa indisponível",
    busy: "Quase lá",
    network: "Sem conexão",
    login_required: "Entre na sua conta"
};

const describeError = (error) => ({
    title: ERROR_TITLES[error?.code] || "Não foi possível assinar",
    message: error?.message || "Tente de novo em instantes.",
    ownerAction: Boolean(error?.data?.ownerAction),
    code: error?.code || null
});

const longDate = (date) =>
    date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });

/* Mesmos seletores de src/index.css: escolha explícita, apelido
   antigo e o automático do sistema. */
const isDarkTheme = () => {
    const root = document.documentElement;
    const chosen = root.getAttribute("data-theme");
    if (chosen) return chosen === "dark";
    return root.classList.contains("dark-mode") ||
        Boolean(window.matchMedia?.("(prefers-color-scheme: dark)").matches);
};

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;


/* ---------------------------------------------------------
   INDICADOR DE ETAPAS
--------------------------------------------------------- */

export const SubscriptionStepper = ({ current }) => {

    const index = SUBSCRIPTION_STEPS.findIndex((step) => step.id === current);

    return (
        <ol className="subcheck-stepper" aria-label="Etapas da assinatura">
            {SUBSCRIPTION_STEPS.map((step, position) => {

                const state =
                    position < index ? "done" : position === index ? "current" : "next";

                return (
                    <li
                        key={step.id}
                        className={`subcheck-stepper-item is-${state}`}
                        aria-current={state === "current" ? "step" : undefined}
                    >
                        <span className="subcheck-stepper-dot">
                            {state === "done"
                                ? <Icon icon="solar:check-read-linear" />
                                : position + 1}
                        </span>
                        <span className="subcheck-stepper-label">{step.label}</span>
                    </li>
                );
            })}
        </ol>
    );
};


/* ---------------------------------------------------------
   CHAVE PÚBLICA DA EMPRESA

   O cartão precisa ser tokenizado com a chave da MESMA conta
   que recebe — a da empresa, conectada via OAuth.
--------------------------------------------------------- */

const usePublicKey = (companyHandle, enabled) => {

    const [state, setState] = useState({ status: "idle", publicKey: null, message: "" });

    useEffect(() => {

        if (!enabled || !companyHandle || state.publicKey) return undefined;

        let cancelled = false;

        const load = async () => {

            setState({ status: "loading", publicKey: null, message: "" });

            try {

                const user = getAuth().currentUser;

                if (!user) throw new Error("Entre na sua conta para pagar.");

                const response = await fetch(
                    `${FUNCTIONS_URL}/getMercadoPagoPublicKey?companyHandle=${encodeURIComponent(companyHandle)}`,
                    { headers: { Authorization: `Bearer ${await user.getIdToken()}` } }
                );

                const data = await response.json().catch(() => ({}));

                if (!response.ok || !data.publicKey) {
                    throw new Error(data.message || "Esta empresa ainda não ativou pagamentos online.");
                }

                initMercadoPago(data.publicKey, { locale: "pt-BR" });

                if (!cancelled) setState({ status: "ready", publicKey: data.publicKey, message: "" });

            } catch (error) {

                if (!cancelled) {
                    setState({
                        status: "error",
                        publicKey: null,
                        message: error?.message || "Não foi possível carregar o pagamento."
                    });
                }
            }
        };

        load();

        return () => {
            cancelled = true;
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyHandle, enabled]);

    return state;
};


/* =========================================================
   COMPONENTE
========================================================= */

const SubscriptionCheckout = ({ checkoutData, onExit }) => {

    const navigate = useNavigate();

    const {
        companyHandle,
        companyName,
        productId,
        productName,
        product,
        professionalId,
        professionalName,
        day,
        dayLabel,
        hour,
        userName,
        notes,
        clientId,
        payerEmail: suggestedEmail,
        subscriptionPlan: plan
    } = checkoutData;

    const amount = Number(plan?.amount) || 0;
    const ciclo = getBillingCycle(plan?.billingCycle);
    const trialDays = Number(plan?.trialDays) || 0;
    const loyaltyMonths = Number(plan?.loyaltyMonths) || 0;
    const noticeDays = Number(plan?.cancellationNoticeDays) || 0;
    const autoRenew = plan?.autoRenew !== false;

    const firstCharge = useMemo(
        () => new Date(Date.now() + trialDays * 86400000),
        [trialDays]
    );

    const hasBooking = Boolean(day && hour && professionalId);

    const [step, setStep] = useState("plan");

    const [user, setUser] = useState(() => getAuth().currentUser);
    const [authReady, setAuthReady] = useState(Boolean(getAuth().currentUser));

    useEffect(() =>
        onAuthStateChanged(getAuth(), (current) => {
            setUser(current);
            setAuthReady(true);
        }), []);

    /* Aceites — os dois obrigatórios. */
    const [acceptCharge, setAcceptCharge] = useState(false);
    const [acceptTerms, setAcceptTerms] = useState(false);

    const [method, setMethod] = useState("card");
    const [accountEmail, setAccountEmail] = useState(suggestedEmail || "");

    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState(null);

    /* Depois de assinar: a assinatura viva, do banco. */
    const [subscriptionId, setSubscriptionId] = useState(null);
    const [created, setCreated] = useState(null);
    const [live, setLive] = useState(null);

    useEffect(() => {
        if (!user?.email || accountEmail) return;
        setAccountEmail(user.email);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.email]);

    useEffect(() => {
        if (!subscriptionId || !companyHandle) return undefined;
        return watchSubscription(companyHandle, subscriptionId, setLive);
    }, [companyHandle, subscriptionId]);

    /* Etapa nova começa do topo. */
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    }, [step]);

    const publicKey = usePublicKey(companyHandle, step === "payment" && method === "card");

    const accountEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(accountEmail.trim());


    /* ---------------- ENVIO ---------------- */

    const basePayload = () => ({
        handle: companyHandle,
        productId,
        userName: userName || user?.displayName || "Cliente",
        clientId,
        consent: { accepted: acceptCharge && acceptTerms, version: CONSENT_VERSION },
        booking: hasBooking
            ? { professionalId, day, hour, dayLabel, notes: notes || undefined }
            : undefined
    });

    const finish = (result) => {
        setCreated(result);
        setSubscriptionId(result.id);
        setStep("done");
    };

    const handleCardSubmit = async (formData) => {

        setError(null);

        try {

            const result = await subscribe({
                ...basePayload(),
                method: "card",
                cardTokenId: formData?.token,
                payerEmail: formData?.payer?.email || accountEmail.trim() || user?.email
            });

            finish(result);

        } catch (failure) {

            setError(describeError(failure));

            /* O Brick só libera o botão de novo se a promise rejeitar. */
            throw failure;
        }
    };

    /* O Card Payment Brick recria o formulário quando as props
       mudam de referência — e apaga o que a pessoa digitou. */
    const submitRef = useRef(handleCardSubmit);
    submitRef.current = handleCardSubmit;

    const onBrickSubmit = useCallback((formData) => submitRef.current(formData), []);

    const onBrickError = useCallback(() => {
        setError({
            title: "Formulário do cartão indisponível",
            message: "Recarregue a página ou pague pela sua conta Mercado Pago."
        });
    }, []);

    const brickInitialization = useMemo(() => ({
        amount,
        payer: user?.email ? { email: user.email } : undefined
    }), [amount, user?.email]);

    const brickCustomization = useMemo(() => ({
        paymentMethods: {
            /* Só crédito, à vista: é o que sustenta cobrança
               automática todo mês. */
            maxInstallments: 1,
            types: { included: ["credit_card"] }
        },
        visual: {
            /* O título do Brick diz "crédito ou débito"; a etapa
               já tem o próprio título. */
            hideFormTitle: true,
            texts: { formSubmit: "Assinar e autorizar cobrança" },
            style: { theme: isDarkTheme() ? "dark" : "default" }
        }
    }), []);

    const startAccountFlow = async () => {

        setSubmitting(true);
        setError(null);

        try {

            const result = await subscribe({
                ...basePayload(),
                method: "account",
                payerEmail: accountEmail.trim()
            });

            if (!result.redirectUrl || !MERCADO_PAGO_URL.test(result.redirectUrl)) {
                throw Object.assign(
                    new Error("O Mercado Pago não devolveu o link de autorização. Tente de novo ou use o cartão."),
                    { code: "no_redirect" }
                );
            }

            rememberPendingSubscription({
                handle: companyHandle,
                subscriptionId: result.id,
                productId,
                productName,
                booking: hasBooking ? { day, dayLabel, hour, professionalName } : null
            });

            window.location.assign(result.redirectUrl);

        } catch (failure) {

            setError(describeError(failure));
            setSubmitting(false);
        }
    };


    /* =====================================================
       SEM LOGIN
    ===================================================== */

    if (authReady && !user) {

        const back = `/central-user/${companyHandle}?product=${productId}`;

        return (
            <section className="subcheck">
                <div className="subcheck-card subcheck-card--center">
                    <div className="subcheck-result-icon is-pending">
                        <Icon icon="solar:shield-user-outline" />
                    </div>
                    <h2>Entre para assinar</h2>
                    <p>
                        A mensalidade fica ligada à sua conta: é por ela que você
                        acompanha as cobranças e cancela quando quiser.
                    </p>
                    <div className="subcheck-actions">
                        <button
                            type="button"
                            className="subcheck-button subcheck-button--primary"
                            onClick={() => navigate(`/login?redirect=${encodeURIComponent(back)}`)}
                        >
                            Entrar ou criar conta
                        </button>
                    </div>
                </div>
            </section>
        );
    }


    /* =====================================================
       ETAPAS
    ===================================================== */

    const priceLabel = `${formatPrice(amount)}${getPlanPriceSuffix(plan)}`;

    return (
        <section className="subcheck">

            <SubscriptionStepper current={step} />


            {/* =================================================
                1. PLANO
            ================================================= */}

            {step === "plan" && (

                <div className="subcheck-grid mkf-fade-enter">

                    <div className="subcheck-card">

                        <header className="subcheck-heading">
                            <span className="subcheck-eyebrow">Passo 1 de 4</span>
                            <h1>Confira o seu plano</h1>
                            <p>Antes de qualquer cobrança, veja exatamente o que você está contratando.</p>
                        </header>

                        <div className="subcheck-plan">

                            {product?.images?.[0] ? (
                                <img src={product.images[0]} alt="" className="subcheck-plan-image" />
                            ) : (
                                <div className="subcheck-plan-image subcheck-plan-image--empty">
                                    <Icon icon="solar:refresh-circle-linear" />
                                </div>
                            )}

                            <div className="subcheck-plan-info">
                                <strong>{productName}</strong>
                                <span>{companyName}</span>
                            </div>

                            <div className="subcheck-plan-price">
                                <strong>{formatPrice(amount)}</strong>
                                <span>{getPlanPriceSuffix(plan)}</span>
                            </div>

                        </div>

                        <ul className="subcheck-highlights">
                            {getPlanHighlights(plan).map((item) => (
                                <li key={item.id}>
                                    <Icon icon={item.icon} />
                                    <div>
                                        <span>{item.label}</span>
                                        <strong>{item.value}</strong>
                                    </div>
                                </li>
                            ))}
                        </ul>

                        <div className={`subcheck-booking ${hasBooking ? "" : "is-empty"}`}>
                            <Icon icon={hasBooking ? "solar:calendar-mark-outline" : "solar:calendar-add-outline"} />
                            {hasBooking ? (
                                <div>
                                    <strong>Primeiro atendimento: {dayLabel || day} às {hour}</strong>
                                    <span>
                                        Com {professionalName || "o profissional escolhido"}. Fica
                                        reservado assim que o pagamento for autorizado.
                                    </span>
                                </div>
                            ) : (
                                <div>
                                    <strong>Você agenda depois</strong>
                                    <span>Com a assinatura ativa, os horários do plano são marcados sem pagar de novo.</span>
                                </div>
                            )}
                        </div>

                    </div>

                    <aside className="subcheck-card subcheck-timeline-card">

                        <h2>Como a cobrança funciona</h2>

                        <ol className="subcheck-timeline">

                            <li>
                                <span className="subcheck-timeline-dot">1</span>
                                <div>
                                    <strong>Hoje</strong>
                                    <span>Você autoriza a cobrança no cartão de crédito ou na sua conta Mercado Pago.</span>
                                </div>
                            </li>

                            <li>
                                <span className="subcheck-timeline-dot">2</span>
                                <div>
                                    <strong>{trialDays > 0 ? longDate(firstCharge) : "Na autorização"}</strong>
                                    <span>
                                        {trialDays > 0
                                            ? `Fim dos ${plural(trialDays, "dia", "dias")} grátis. Primeira cobrança de ${formatPrice(amount)}.`
                                            : `Primeira cobrança de ${formatPrice(amount)}.`}
                                    </span>
                                </div>
                            </li>

                            <li>
                                <span className="subcheck-timeline-dot">3</span>
                                <div>
                                    <strong>{autoRenew ? ciclo.periodLabel : "Fim do ciclo"}</strong>
                                    <span>
                                        {autoRenew
                                            ? `${formatPrice(amount)} cobrados sozinhos, sempre no mesmo dia, até você cancelar.`
                                            : "Sem renovação automática: a assinatura termina ao fim do primeiro ciclo e não cobra de novo."}
                                    </span>
                                </div>
                            </li>

                        </ol>

                        <p className="subcheck-note">
                            <Icon icon="solar:close-circle-outline" />
                            {loyaltyMonths > 0
                                ? <>Cancele pela aba <strong>Reservas</strong>, sem falar com ninguém, depois da permanência mínima de {plural(loyaltyMonths, "mês", "meses")}.</>
                                : <>Cancele quando quiser pela aba <strong>Reservas</strong>, sem falar com ninguém.</>}
                        </p>

                        <div className="subcheck-actions">
                            <button
                                type="button"
                                className="subcheck-button subcheck-button--ghost"
                                onClick={onExit}
                            >
                                <Icon icon="solar:arrow-left-outline" />
                                <span>Voltar</span>
                            </button>
                            <button
                                type="button"
                                className="subcheck-button subcheck-button--primary"
                                onClick={() => setStep("consent")}
                            >
                                <span>Continuar</span>
                                <Icon icon="solar:arrow-right-outline" />
                            </button>
                        </div>

                    </aside>

                </div>
            )}


            {/* =================================================
                2. AUTORIZAÇÃO
            ================================================= */}

            {step === "consent" && (

                <div className="subcheck-card subcheck-card--narrow mkf-fade-enter">

                    <header className="subcheck-heading">
                        <span className="subcheck-eyebrow">Passo 2 de 4</span>
                        <h1>Autorize a cobrança recorrente</h1>
                        <p>Leia com calma. É isto que você está autorizando:</p>
                    </header>

                    <dl className="subcheck-terms">
                        <div>
                            <dt>Valor</dt>
                            <dd>{priceLabel}</dd>
                        </div>
                        <div>
                            <dt>Frequência</dt>
                            <dd>{autoRenew ? `${ciclo.periodLabel}, até você cancelar` : "Um ciclo, sem renovação"}</dd>
                        </div>
                        <div>
                            <dt>Primeira cobrança</dt>
                            <dd>{trialDays > 0 ? `${longDate(firstCharge)}, após o teste grátis` : "Na autorização"}</dd>
                        </div>
                        <div>
                            <dt>Quem recebe</dt>
                            <dd>{companyName}, pelo Mercado Pago</dd>
                        </div>
                        <div>
                            <dt>Cancelamento</dt>
                            <dd>
                                {loyaltyMonths > 0
                                    ? `Em Reservas → Mensalidades, depois da permanência mínima de ${plural(loyaltyMonths, "mês", "meses")}.`
                                    : "Quando quiser, em Reservas → Mensalidades."}
                                {noticeDays > 0 && ` Aviso prévio de ${plural(noticeDays, "dia", "dias")}.`}
                                {" "}Os atendimentos continuam valendo até o fim do período já pago.
                            </dd>
                        </div>
                        <div>
                            <dt>Arrependimento</dt>
                            <dd>
                                Desistiu nos primeiros {WITHDRAWAL_DAYS} dias? Cancele pela mesma tela e
                                receba de volta o que foi cobrado (Código de Defesa do Consumidor, art. 49).
                                Depois disso, não há devolução proporcional do ciclo em andamento.
                            </dd>
                        </div>
                    </dl>

                    <details className="subcheck-privacy" open>
                        <summary>
                            <Icon icon="solar:shield-keyhole-outline" />
                            <span>Seus dados nesta assinatura (LGPD)</span>
                        </summary>
                        <ul>
                            <li>
                                <strong>Quem trata:</strong> {companyName} é responsável pelo seu
                                atendimento; a Markfy opera a plataforma; o Mercado Pago processa o pagamento.
                            </li>
                            <li>
                                <strong>O que guardamos:</strong> seu nome, o e-mail do pagador, o histórico das
                                cobranças (valor, data e situação) e o registro deste aceite (data, versão dos termos
                                e condições do plano). <strong>O número do cartão não passa pela Markfy</strong>: ele
                                é digitado no ambiente seguro do Mercado Pago.
                            </li>
                            <li>
                                <strong>Para quê:</strong> cobrar a mensalidade, liberar seus atendimentos e comprovar
                                a contratação (execução de contrato, LGPD art. 7º, V).
                            </li>
                            <li>
                                <strong>Por quanto tempo:</strong> enquanto a assinatura existir e, depois, pelo prazo
                                exigido pela lei fiscal. Tentativas que você não concluir são apagadas em 48 horas.
                            </li>
                            <li>
                                <strong>Seus direitos:</strong> ver, corrigir e pedir a exclusão dos seus dados
                                (LGPD art. 18). Saiba mais na{" "}
                                <Link to="/privacidade" target="_blank" rel="noreferrer">Política de Privacidade</Link>.
                            </li>
                        </ul>
                    </details>

                    <div className="subcheck-checks">

                        <label className={`subcheck-check ${acceptCharge ? "is-checked" : ""}`}>
                            <input
                                type="checkbox"
                                checked={acceptCharge}
                                onChange={(event) => setAcceptCharge(event.target.checked)}
                            />
                            <span>
                                Autorizo {companyName} a cobrar <strong>{priceLabel}</strong> de forma
                                automática{autoRenew ? `, ${ciclo.periodLabel.toLowerCase()}, até eu cancelar` : ", uma vez"}.
                            </span>
                        </label>

                        <label className={`subcheck-check ${acceptTerms ? "is-checked" : ""}`}>
                            <input
                                type="checkbox"
                                checked={acceptTerms}
                                onChange={(event) => setAcceptTerms(event.target.checked)}
                            />
                            <span>
                                Li e aceito os{" "}
                                <Link to="/termos" target="_blank" rel="noreferrer">Termos de Uso</Link>{" "}
                                e a{" "}
                                <Link to="/privacidade" target="_blank" rel="noreferrer">Política de Privacidade</Link>.
                            </span>
                        </label>

                    </div>

                    <div className="subcheck-actions">
                        <button
                            type="button"
                            className="subcheck-button subcheck-button--ghost"
                            onClick={() => setStep("plan")}
                        >
                            <Icon icon="solar:arrow-left-outline" />
                            <span>Voltar</span>
                        </button>
                        <button
                            type="button"
                            className="subcheck-button subcheck-button--primary"
                            disabled={!acceptCharge || !acceptTerms}
                            onClick={() => setStep("payment")}
                        >
                            <span>Concordo e continuar</span>
                            <Icon icon="solar:arrow-right-outline" />
                        </button>
                    </div>

                </div>
            )}


            {/* =================================================
                3. PAGAMENTO
            ================================================= */}

            {step === "payment" && (

                <div className="subcheck-card subcheck-card--narrow mkf-fade-enter">

                    <header className="subcheck-heading">
                        <span className="subcheck-eyebrow">Passo 3 de 4</span>
                        <h1>Como você quer pagar?</h1>
                        <p>{priceLabel} · {autoRenew ? ciclo.periodLabel.toLowerCase() : "um ciclo"}</p>
                    </header>

                    <div className="subcheck-methods" role="radiogroup" aria-label="Forma de pagamento">

                        <button
                            type="button"
                            role="radio"
                            aria-checked={method === "card"}
                            className={`subcheck-method ${method === "card" ? "is-selected" : ""}`}
                            onClick={() => { setMethod("card"); setError(null); }}
                        >
                            <Icon icon="solar:card-outline" className="subcheck-method-icon" />
                            <span className="subcheck-method-text">
                                <strong>Cartão de crédito</strong>
                                <span>Digite o cartão aqui. A cobrança se repete sozinha no mesmo cartão.</span>
                            </span>
                            <span className="subcheck-method-radio" aria-hidden />
                        </button>

                        <button
                            type="button"
                            role="radio"
                            aria-checked={method === "account"}
                            className={`subcheck-method ${method === "account" ? "is-selected" : ""}`}
                            onClick={() => { setMethod("account"); setError(null); }}
                        >
                            <Icon icon="solar:wallet-money-outline" className="subcheck-method-icon" />
                            <span className="subcheck-method-text">
                                <strong>Conta Mercado Pago</strong>
                                <span>Entre na sua conta e pague com o saldo ou com um cartão salvo lá.</span>
                            </span>
                            <span className="subcheck-method-radio" aria-hidden />
                        </button>

                    </div>

                    {error && (
                        <div className={`subcheck-error ${error.ownerAction ? "is-owner" : ""}`} role="alert">
                            <Icon icon="solar:danger-circle-outline" />
                            <div>
                                <strong>{error.title}</strong>
                                <span>{error.message}</span>
                                {error.ownerAction && (
                                    <span className="subcheck-error-hint">
                                        O problema está na conta de recebimento da empresa, não no seu cartão.
                                        Nada foi cobrado.
                                    </span>
                                )}
                            </div>
                        </div>
                    )}


                    {/* ---------------- CARTÃO ---------------- */}

                    {method === "card" && (

                        <div className="subcheck-method-panel">

                            <ol className="subcheck-mini-steps">
                                <li>Preencha os dados do cartão de crédito e do titular.</li>
                                <li>Toque em <strong>Assinar e autorizar cobrança</strong>.</li>
                                <li>O Mercado Pago valida o cartão e a assinatura já começa.</li>
                            </ol>

                            {publicKey.status === "loading" && (
                                <div className="subcheck-loading">
                                    <Icon icon="svg-spinners:ring-resize" />
                                    <span>Abrindo o formulário seguro do Mercado Pago…</span>
                                </div>
                            )}

                            {publicKey.status === "error" && (
                                <div className="subcheck-error is-owner" role="alert">
                                    <Icon icon="solar:danger-circle-outline" />
                                    <div>
                                        <strong>Pagamento online indisponível</strong>
                                        <span>{publicKey.message}</span>
                                    </div>
                                </div>
                            )}

                            {publicKey.status === "ready" && (
                                <div className="subcheck-brick">
                                    <CardPayment
                                        initialization={brickInitialization}
                                        customization={brickCustomization}
                                        onSubmit={onBrickSubmit}
                                        onError={onBrickError}
                                        locale="pt-BR"
                                    />
                                </div>
                            )}

                        </div>
                    )}


                    {/* ---------------- CONTA MERCADO PAGO ---------------- */}

                    {method === "account" && (

                        <div className="subcheck-method-panel">

                            <ol className="subcheck-mini-steps">
                                <li>Confirme o e-mail da sua conta Mercado Pago.</li>
                                <li>Você vai para o site do Mercado Pago, entra e confirma a assinatura.</li>
                                <li>Volta para cá sozinho, com a assinatura ativa.</li>
                            </ol>

                            <label className="subcheck-field">
                                <span>E-mail da sua conta Mercado Pago</span>
                                <input
                                    type="email"
                                    inputMode="email"
                                    autoComplete="email"
                                    placeholder="voce@email.com"
                                    value={accountEmail}
                                    onChange={(event) => setAccountEmail(event.target.value)}
                                />
                                <small>
                                    Use o mesmo e-mail com que você entra no Mercado Pago — com outro,
                                    ele não deixa concluir.
                                </small>
                            </label>

                            <button
                                type="button"
                                className="subcheck-button subcheck-button--primary subcheck-button--block"
                                disabled={!accountEmailValid || submitting}
                                onClick={startAccountFlow}
                            >
                                {submitting ? (
                                    <>
                                        <Icon icon="svg-spinners:ring-resize" />
                                        <span>Preparando…</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Continuar no Mercado Pago</span>
                                        <Icon icon="solar:arrow-right-up-outline" />
                                    </>
                                )}
                            </button>

                        </div>
                    )}

                    <p className="subcheck-secure">
                        <Icon icon="solar:shield-check-outline" />
                        Pagamento processado pelo Mercado Pago. A Markfy não vê nem guarda o número do seu cartão.
                    </p>

                    <div className="subcheck-actions">
                        <button
                            type="button"
                            className="subcheck-button subcheck-button--ghost"
                            disabled={submitting}
                            onClick={() => setStep("consent")}
                        >
                            <Icon icon="solar:arrow-left-outline" />
                            <span>Voltar</span>
                        </button>
                    </div>

                </div>
            )}


            {/* =================================================
                4. PRONTO
            ================================================= */}

            {step === "done" && (

                <div className="subcheck-card subcheck-card--narrow mkf-fade-enter">
                    <SubscriptionResult
                        subscription={live || created}
                        loading={!live && !created}
                        companyHandle={companyHandle}
                        productId={productId}
                        productName={productName}
                        booking={hasBooking ? { day, dayLabel, hour, professionalName } : null}
                    />
                </div>
            )}

        </section>
    );
};


export default SubscriptionCheckout;
