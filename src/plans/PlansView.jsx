import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getAuth } from "firebase/auth";
import { Icon } from "@iconify/react";

import CompanyPicker from "../components/company-picker/CompanyPicker";
import { useUserCompany } from "../contexts/companyContext/UserCompanyContext";
import { useLicense } from "./LicenseContext";
import {
    FEATURES,
    PRODUCT_ICONS,
    PRODUCT_IDS,
    PRODUCT_LABELS,
    PRODUCT_SHORT,
    bundleSavings,
    describeLimit,
    featuresFor,
    formatPrice,
    licenseProductFor,
    limitsFor,
    planProducts,
    priceFor,
    productLabel,
    productsOf
} from "./planDefaults";

import markfyLogo from "../img/logo-markfy.svg";
import "./plans.css";

/* =========================================================
   TELA DE PLANOS

   Uma tela só, em três lugares:
     - "blocked"   no lugar do painel (Bookings, Studio ou
                   Menus) quando a empresa não tem plano ativo
                   com aquele produto;
     - "page"      rota /planos (inclusive logo depois de criar
                   a empresa);
     - "embedded"  dentro do perfil do administrador.

   O plano é da EMPRESA. Só o administrador principal assina
   ou troca; para os demais a tela é só leitura. O pagamento
   acontece no Mercado Pago da Markfy e quem libera o acesso
   é o backend, depois de confirmar o pagamento — esta tela
   nunca grava a licença.

   Preço, pacote e economia saem das mesmas funções que o
   backend usa para cobrar (src/menus/engine/licensing.js).
========================================================= */

const FUNCTIONS_URL = "https://us-central1-markfy-96942.cloudfunctions.net";

const dateLabel = (millis) =>
    millis
        ? new Date(millis).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
        : "";

const periodLabel = (days) => (days === 30 ? "/mês" : days === 365 ? "/ano" : `/${days} dias`);

const listJoin = (items) =>
    items.length <= 1 ? items.join("") : `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;

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

/** O que deixa de valer ao trocar do plano atual para `plan` + `product`. */
const lossesFor = (license, plan, product) => {
    if (!license.active || !license.plan) return null;

    const nextProducts = productsOf(licenseProductFor(plan.id, plan, product));
    const lostProducts = productsOf(license.product).filter((id) => !nextProducts.includes(id));

    const lostFeatures = FEATURES.filter(
        (feature) =>
            productsOf(license.product).includes(feature.product) &&
            nextProducts.includes(feature.product) &&
            license.plan.features?.[feature.id] &&
            !plan.features?.[feature.id]
    );

    if (!lostProducts.length && !lostFeatures.length) return null;

    return { lostProducts, lostFeatures };
};

function PlanCard({ plan, choice, catalog, current, canBuy, busy, onBuy, locked }) {

    const product = plan.bundle ? null : choice;
    const products = plan.bundle ? planProducts(plan) : [choice];
    const price = priceFor(plan, product);
    const savings = plan.bundle ? bundleSavings(plan, catalog) : null;

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
                <strong>{formatPrice(price)}</strong>
                <span>{periodLabel(plan.periodDays)}</span>
            </div>

            {savings && savings.percent > 0 && (
                <div className="pl-card__save">
                    <strong>Economize {formatPrice(savings.saving)}{periodLabel(plan.periodDays)}</strong>
                    <span>
                        Assinando {listJoin(savings.parts.map((part) => `${PRODUCT_SHORT[part.product]} (${part.planName || "plano individual"})`))} separadamente,
                        você pagaria {formatPrice(savings.separate)}. No {plan.name}: {savings.percent}% a menos.
                    </span>
                </div>
            )}

            <div className={`pl-card__product ${plan.bundle ? "is-bundle" : ""}`}>
                <Icon icon={plan.bundle ? "solar:crown-star-bold" : PRODUCT_ICONS[choice]} />
                {plan.bundle ? `${products.map((id) => PRODUCT_SHORT[id]).join(" + ")} juntos` : PRODUCT_LABELS[choice]}
            </div>

            <ul className="pl-card__list">
                {limitsFor(products).map((limit) => (
                    <li key={limit.id}>
                        <Icon icon="solar:check-circle-bold" />
                        {describeLimit(limit, plan.limits[limit.id])}
                    </li>
                ))}

                {products.includes("menus") && (
                    <li>
                        <Icon icon="solar:check-circle-bold" />
                        Cardápio digital com QR Code e pedidos ilimitados
                    </li>
                )}

                {featuresFor(products).map((feature) => (
                    <li key={feature.id} className={plan.features[feature.id] ? "" : "is-off"}>
                        <Icon icon={plan.features[feature.id] ? "solar:check-circle-bold" : "solar:close-circle-linear"} />
                        {feature.label}
                    </li>
                ))}
            </ul>

            <button
                type="button"
                className="pl-btn"
                disabled={!canBuy || busy || locked || price < 1}
                onClick={() => onBuy(plan, product)}
            >
                {busy
                    ? <span className="pl-spin" />
                    : <Icon icon={current ? "solar:refresh-bold" : "solar:card-bold"} />}
                {price < 1
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

    const preferred = new URLSearchParams(location.search).get("produto");

    const [choice, setChoice] = useState(
        PRODUCT_IDS.includes(blockedProduct) ? blockedProduct : PRODUCT_IDS.includes(preferred) ? preferred : "bookings"
    );
    const [busyPlan, setBusyPlan] = useState(null);
    const [error, setError] = useState("");
    const [confirm, setConfirm] = useState(null);

    const checkout = variant === "page" ? new URLSearchParams(location.search).get("checkout") : null;

    const visible = useMemo(
        () => license.catalog.filter((plan) => plan.active),
        [license.catalog]
    );

    const hasSingleProductPlans = visible.some((plan) => !plan.bundle);
    const suspended = license.state === "suspended";
    const canBuy = license.isOwner && !suspended && license.catalogPublished;

    const startCheckout = async (plan, product) => {

        setError("");
        setBusyPlan(plan.id);
        setConfirm(null);

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

    /* Downgrade: antes de pagar, mostra o que deixa de valer.
       Nada é apagado — os dados ficam guardados e voltam a
       aparecer se o recurso for contratado de novo. */
    const buy = (plan, product) => {
        const losses = lossesFor(license, plan, product);
        if (losses) {
            setConfirm({ plan, product, losses });
            return;
        }
        startCheckout(plan, product);
    };

    const blocked = variant === "blocked";
    const copy = STATE_COPY[license.state] || STATE_COPY.none;
    const companyName = company?.name || "Sua empresa";

    const currentProductLabel = license.product ? productLabel(license.product) : "";

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
                        {(blocked || variant === "page") && (
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
                        <h1>
                            {license.active && blockedProduct
                                ? `O plano da ${companyName} não inclui o ${PRODUCT_LABELS[blockedProduct]}`
                                : `${companyName} ${copy.title}`}
                        </h1>
                        <p>
                            {license.active && blockedProduct
                                ? `Seu plano atual (${license.plan?.name || ""}${currentProductLabel ? ` · ${currentProductLabel}` : ""}) continua valendo. Para usar o ${PRODUCT_LABELS[blockedProduct]} também, escolha um plano que o inclua.`
                                : copy.text}
                            {!license.active && blockedProduct && license.state !== "suspended" && (
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
                                : "O plano vale para a empresa toda, não para uma pessoa. Contrate um produto ou reúna Studio, Bookings e Menus no Premium."}
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
                    <span>Os planos individuais liberam um produto. Qual você quer?</span>
                    <div>
                        {PRODUCT_IDS.map((id) => (
                            <button
                                key={id}
                                type="button"
                                role="radio"
                                aria-checked={choice === id}
                                className={choice === id ? "is-on" : ""}
                                onClick={() => setChoice(id)}
                            >
                                <Icon icon={PRODUCT_ICONS[id]} />
                                {PRODUCT_SHORT[id]}
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
                        (plan.bundle || license.product === choice);

                    return (
                        <PlanCard
                            key={plan.id}
                            plan={plan}
                            choice={choice}
                            catalog={visible}
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
                sozinho; ao renovar o mesmo plano, o novo período soma ao que ainda restava. Trocar de plano
                nunca apaga os dados da empresa.
            </p>

            {confirm && (
                <div className="pl-confirm" role="dialog" aria-modal="true" aria-labelledby="pl-confirm-title">
                    <div className="pl-confirm__panel">
                        <span className="pl-hero__badge is-lock"><Icon icon="solar:danger-triangle-bold" /> Antes de trocar</span>
                        <h2 id="pl-confirm-title">O plano {confirm.plan.name} tem menos recursos que o atual</h2>
                        <p>Ao trocar, deixa de valer:</p>
                        <ul>
                            {confirm.losses.lostProducts.map((id) => (
                                <li key={id}><Icon icon={PRODUCT_ICONS[id]} /> Acesso ao {PRODUCT_LABELS[id]}</li>
                            ))}
                            {confirm.losses.lostFeatures.map((feature) => (
                                <li key={feature.id}><Icon icon="solar:close-circle-linear" /> {feature.label}</li>
                            ))}
                        </ul>
                        <p className="pl-confirm__safe">
                            <Icon icon="solar:shield-check-bold" />
                            Nenhum dado é apagado: cardápios, pedidos, mesas, páginas e agendamentos ficam guardados e
                            voltam a aparecer se você contratar esses recursos de novo.
                        </p>
                        <div className="pl-confirm__actions">
                            <button type="button" className="pl-link" onClick={() => setConfirm(null)}>Manter plano atual</button>
                            <button type="button" className="pl-btn" style={{ "--pl": confirm.plan.color, padding: "0 22px" }} onClick={() => startCheckout(confirm.plan, confirm.product)}>
                                Trocar mesmo assim
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {pickerOpen && <CompanyPicker variant="modal" onClose={() => setPickerOpen(false)} />}
        </section>
    );
}
