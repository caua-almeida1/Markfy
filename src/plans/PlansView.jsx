import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { Icon } from "@iconify/react";

import CompanyPicker from "../components/company-picker/CompanyPicker";
import { useUserCompany } from "../contexts/companyContext/UserCompanyContext";
import { useLicense } from "./LicenseContext";
import {
    FEATURES,
    LIMITS,
    PRODUCT_LABELS,
    describeLimit,
    formatPrice
} from "./planDefaults";

import markfyLogo from "../img/logo-markfy.svg";
import "./plans.css";

/* =========================================================
   TELA DE PLANOS

   Uma tela só, em três lugares:
     - "blocked"   no lugar do painel (Bookings ou Studio)
                   quando a empresa não tem plano ativo;
     - "page"      rota /planos (inclusive logo depois de criar
                   a empresa);
     - "embedded"  dentro do perfil do administrador.

   O plano é da EMPRESA. Só o administrador principal assina
   ou troca; para os demais a tela é só leitura. O pagamento
   acontece no Mercado Pago da Markfy e quem libera o acesso
   é o backend, depois de confirmar o pagamento — esta tela
   nunca grava a licença.
========================================================= */

const FUNCTIONS_URL = "https://us-central1-markfy-96942.cloudfunctions.net";

const dateLabel = (millis) =>
    millis
        ? new Date(millis).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
        : "";

const periodLabel = (days) => (days === 30 ? "/mês" : days === 365 ? "/ano" : `/${days} dias`);

const STATE_COPY = {
    none: {
        title: "não tem um plano ativo",
        text: "Escolha um plano para liberar o painel da empresa."
    },
    expired: {
        title: "está com o plano vencido",
        text: "Renove para voltar a usar o painel agora mesmo."
    },
    suspended: {
        title: "está com o plano suspenso",
        text: "O acesso foi suspenso pela Markfy. Fale com a gente para regularizar."
    }
};

function PlanCard({ plan, choice, current, canBuy, busy, onBuy, locked }) {

    const product = plan.bundle ? "both" : choice;

    return (
        <article
            className={`pl-card ${plan.highlight ? "is-highlight" : ""} ${current ? "is-current" : ""}`}
            style={{ "--pl": plan.color }}
        >
            {plan.highlight && <span className="pl-card__flag">Mais completo</span>}

            <header>
                <span className="pl-card__tier">{plan.tier || "Plano"}</span>
                <h3>{plan.name}</h3>
                <p>{plan.tagline}</p>
            </header>

            <div className="pl-card__price">
                <strong>{formatPrice(plan.price)}</strong>
                <span>{periodLabel(plan.periodDays)}</span>
            </div>

            <div className={`pl-card__product ${plan.bundle ? "is-bundle" : ""}`}>
                <Icon icon={plan.bundle ? "solar:crown-star-bold" : product === "studio" ? "solar:pallete-2-bold" : "solar:calendar-bold"} />
                {plan.bundle ? "Bookings + Studio juntos" : PRODUCT_LABELS[product]}
            </div>

            <ul className="pl-card__list">
                {LIMITS.map((limit) => (
                    <li key={limit.id}>
                        <Icon icon="solar:check-circle-bold" />
                        {describeLimit(limit, plan.limits[limit.id])}
                    </li>
                ))}

                {FEATURES.map((feature) => (
                    <li key={feature.id} className={plan.features[feature.id] ? "" : "is-off"}>
                        <Icon icon={plan.features[feature.id] ? "solar:check-circle-bold" : "solar:close-circle-linear"} />
                        {feature.label}
                    </li>
                ))}
            </ul>

            <button
                type="button"
                className="pl-btn"
                disabled={!canBuy || busy || locked || plan.price < 1}
                onClick={() => onBuy(plan, product)}
            >
                {busy
                    ? <span className="pl-spin" />
                    : <Icon icon={current ? "solar:refresh-bold" : "solar:card-bold"} />}
                {plan.price < 1
                    ? "Indisponível"
                    : current
                        ? "Renovar plano"
                        : "Assinar " + plan.name}
            </button>
        </article>
    );
}

export default function PlansView({ variant = "page", blockedProduct = null }) {

    const navigate = useNavigate();
    const location = useLocation();

    const { company, companies } = useUserCompany();
    const [pickerOpen, setPickerOpen] = useState(false);
    const license = useLicense();

    const [choice, setChoice] = useState(blockedProduct || "bookings");
    const [busyPlan, setBusyPlan] = useState(null);
    const [error, setError] = useState("");

    const checkout = variant === "page" ? new URLSearchParams(location.search).get("checkout") : null;

    const visible = useMemo(
        () => license.catalog.filter((plan) => plan.active),
        [license.catalog]
    );

    const hasSingleProductPlans = visible.some((plan) => !plan.bundle);
    const suspended = license.state === "suspended";
    const canBuy = license.isOwner && !suspended && license.catalogPublished;

    const buy = async (plan, product) => {

        setError("");
        setBusyPlan(plan.id);

        try {

            const user = getAuth().currentUser;

            if (!user) throw new Error("Entre na sua conta para continuar.");

            const response = await fetch(`${FUNCTIONS_URL}/createMarkfyPlanCheckout`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${await user.getIdToken()}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ handle: license.handle, planId: plan.id, product })
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok || !data.checkoutUrl) {
                throw new Error(data.message || "Não foi possível iniciar o pagamento.");
            }

            window.location.assign(data.checkoutUrl);

        } catch (err) {

            setError(err.message || "Não foi possível iniciar o pagamento.");
            setBusyPlan(null);
        }
    };

    const blocked = variant === "blocked";
    const copy = STATE_COPY[license.state] || STATE_COPY.none;
    const companyName = company?.name || "Sua empresa";

    const currentProductLabel = license.product ? PRODUCT_LABELS[license.product] : "";

    return (
        <section className={`pl pl--${variant}`}>

            {variant !== "embedded" && (
                <header className="pl-top">
                    <span className="pl-brand">
                        <img src={markfyLogo} alt="" />
                        <b>Markfy</b>
                    </span>

                    <span className="pl-top__actions">
                        {companies?.length > 1 && (
                            <button type="button" className="pl-link" onClick={() => setPickerOpen(true)}>
                                <Icon icon="solar:shop-2-linear" /> Trocar de empresa
                            </button>
                        )}
                        {blocked && (
                            <button type="button" className="pl-link" onClick={() => navigate("/home")}>
                                <Icon icon="solar:arrow-left-linear" /> Voltar ao início
                            </button>
                        )}
                    </span>
                </header>
            )}

            <div className="pl-hero">

                {blocked ? (
                    <>
                        <span className="pl-hero__badge is-lock">
                            <Icon icon="solar:lock-keyhole-minimalistic-bold" />
                            {blockedProduct ? PRODUCT_LABELS[blockedProduct] : "Painel"} bloqueado
                        </span>
                        <h1>{companyName} {copy.title}</h1>
                        <p>
                            {copy.text}
                            {blockedProduct && license.state !== "suspended" && (
                                <> Para usar o {PRODUCT_LABELS[blockedProduct]}, o plano precisa incluí-lo.</>
                            )}
                        </p>
                    </>
                ) : (
                    <>
                        <span className="pl-hero__badge"><Icon icon="solar:cup-star-bold" /> Planos Markfy</span>
                        <h1>{license.active ? "Seu plano" : `Escolha o plano da ${companyName}`}</h1>
                        <p>
                            {variant === "page" && !license.active
                                ? "Falta só esta etapa: com um plano ativo, o painel da empresa é liberado."
                                : "O plano vale para a empresa toda, não para uma pessoa."}
                        </p>
                    </>
                )}
            </div>

            {checkout && (
                <div className={`pl-note is-${checkout === "success" ? "ok" : checkout === "pending" ? "warn" : "bad"}`} role="status">
                    <Icon icon={checkout === "success" ? "solar:check-circle-bold" : "solar:clock-circle-bold"} />
                    {checkout === "success" && (license.active
                        ? "Pagamento confirmado. Seu plano está ativo!"
                        : "Pagamento recebido. Estamos liberando o acesso — isso leva alguns segundos.")}
                    {checkout === "pending" && "Pagamento pendente. O acesso é liberado assim que o Mercado Pago confirmar."}
                    {checkout === "failure" && "O pagamento não foi concluído. Você pode tentar de novo quando quiser."}
                </div>
            )}

            {license.active && license.plan && (
                <div className="pl-current" style={{ "--pl": license.plan.color }}>
                    <span className="pl-current__orb"><Icon icon="solar:cup-star-bold" /></span>
                    <div>
                        <small>Plano atual da empresa</small>
                        <strong>{license.plan.name} <em>{currentProductLabel}</em></strong>
                        {license.license.expiresAt && <span>Válido até {dateLabel(license.license.expiresAt)}</span>}
                    </div>
                </div>
            )}

            {!license.isOwner && (
                <div className="pl-note is-warn">
                    <Icon icon="solar:shield-user-bold" />
                    Só o administrador principal da empresa pode assinar ou trocar o plano. Peça a ele para fazer isso.
                </div>
            )}

            {suspended && (
                <div className="pl-note is-bad">
                    <Icon icon="solar:danger-triangle-bold" />
                    O plano desta empresa foi suspenso. Não é possível assinar por aqui — fale com o suporte da Markfy.
                </div>
            )}

            {!license.catalogPublished && (
                <div className="pl-note is-warn">
                    <Icon icon="solar:clock-circle-bold" />
                    Os planos ainda estão sendo publicados. Volte em instantes.
                </div>
            )}

            {error && (
                <div className="pl-note is-bad" role="alert">
                    <Icon icon="solar:danger-triangle-bold" /> {error}
                </div>
            )}

            {hasSingleProductPlans && (
                <div className="pl-choice" role="radiogroup" aria-label="Produto do plano">
                    <span>Os planos Básico e Comum liberam um produto. Qual você quer?</span>
                    <div>
                        {["bookings", "studio"].map((id) => (
                            <button
                                key={id}
                                type="button"
                                role="radio"
                                aria-checked={choice === id}
                                className={choice === id ? "is-on" : ""}
                                onClick={() => setChoice(id)}
                            >
                                <Icon icon={id === "bookings" ? "solar:calendar-bold" : "solar:pallete-2-bold"} />
                                {PRODUCT_LABELS[id]}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="pl-grid">
                {visible.map((plan) => {

                    const current =
                        license.active &&
                        license.license.plan === plan.id &&
                        (plan.bundle || license.product === choice || license.product === "both");

                    return (
                        <PlanCard
                            key={plan.id}
                            plan={plan}
                            choice={choice}
                            current={current}
                            canBuy={canBuy}
                            locked={license.loading}
                            busy={busyPlan === plan.id}
                            onBuy={buy}
                        />
                    );
                })}
            </div>

            <p className="pl-foot">
                <Icon icon="solar:shield-check-bold" />
                Pagamento seguro pelo Mercado Pago. Cada pagamento libera o período do plano e não renova
                sozinho; ao renovar o mesmo plano, o novo período soma ao que ainda restava.
            </p>

            {pickerOpen && <CompanyPicker variant="modal" onClose={() => setPickerOpen(false)} />}
        </section>
    );
}
