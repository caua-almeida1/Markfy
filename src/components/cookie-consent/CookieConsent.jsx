import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@iconify/react";

import { useConsent } from "../../contexts/consentContext/ConsentContext";

import { useExitTransition } from "../../hooks/useExitTransition";
import Modal from "../modal/Modal";

import "./cookie-consent.css";


/* =========================================================
   AVISO DE COOKIES — LGPD

   Duas camadas:

   1. Banner: aceitar tudo / recusar não essenciais /
      personalizar. "Recusar" tem o MESMO peso visual que
      "aceitar" — se recusar fosse mais difícil, o
      consentimento não seria livre (Art. 8º, caput).

   2. Painel: uma chave por finalidade, com o que é gravado,
      para quê e por quanto tempo (Art. 9º). Categorias não
      essenciais começam desligadas.

   O banner NÃO bloqueia a navegação: nada de cookie wall,
   já que recusar não pode custar o acesso ao serviço.
========================================================= */


const PRIVACY_POLICY_PATH = "/privacidade";


const CookieConsent = () => {

    const {
        categories,
        consent,
        isDecided,
        isPreferencesOpen,
        acceptAll,
        rejectAll,
        savePreferences,
        openPreferences,
        closePreferences
    } = useConsent();


    /* Seleção local do painel: só vira decisão quando o
       titular confirma. */
    const [selection, setSelection] = useState({});

    const [expandedCategory, setExpandedCategory] =
        useState(null);

    const showBanner =
        !isDecided && !isPreferencesOpen;


    /*
     * O banner tem entrada e saída próprias — ele não é
     * modal, é uma faixa fixa no rodapé. Mesmo motor de
     * saída por tempo do Modal, para nunca ficar preso.
     */
    const {
        rendered: bannerRendered,
        leaving: bannerLeaving
    } = useExitTransition(showBanner, undefined, 300);


    /* Abriu o painel → parte do que já está gravado, ou de
       tudo desligado se ainda não houve decisão. */
    useEffect(() => {

        if (!isPreferencesOpen) {
            return;
        }

        setSelection(
            Object.fromEntries(
                categories.map((category) => [
                    category.id,
                    category.required
                        ? true
                        : Boolean(
                            consent?.categories?.[category.id]
                        )
                ])
            )
        );

        setExpandedCategory(null);

    }, [isPreferencesOpen, categories, consent]);


    /* Esc fecha o painel — mas só quando já existe uma
       decisão registrada, senão o titular sairia do painel
       sem ter escolhido nada. */
    useEffect(() => {

        if (!isPreferencesOpen) {
            return;
        }

        const handleKeyDown = (event) => {

            if (event.key === "Escape" && isDecided) {
                closePreferences();
            }

        };

        window.addEventListener("keydown", handleKeyDown);

        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };

    }, [isPreferencesOpen, isDecided, closePreferences]);


    const toggleCategory = (categoryId, required) => {

        if (required) {
            return;
        }

        setSelection((previous) => ({
            ...previous,
            [categoryId]: !previous[categoryId]
        }));

    };


    return createPortal(

        <>

            {/* =====================================================
                BANNER
            ===================================================== */}

            {bannerRendered && (

                    <div
                        className="mkf-consent-banner"
                        data-state={bannerLeaving ? "leaving" : "entering"}
                        role="dialog"
                        aria-live="polite"
                        aria-label="Aviso de cookies"
                    >

                        <div className="mkf-consent-banner-icon">
                            <Icon icon="mdi:cookie-outline" />
                        </div>


                        <div className="mkf-consent-banner-text">

                            <strong>
                                Este site usa cookies
                            </strong>

                            <p>
                                Usamos cookies necessários para você
                                entrar na conta, agendar e pagar com
                                segurança. Outros, como lembrar suas
                                preferências, só com a sua autorização.
                                Você pode mudar de ideia quando quiser.

                                {" "}

                                <a
                                    href={PRIVACY_POLICY_PATH}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Política de Privacidade
                                </a>
                            </p>

                        </div>


                        <div className="mkf-consent-banner-actions">

                            <button
                                type="button"
                                className="mkf-consent-btn mkf-consent-btn--ghost"
                                onClick={openPreferences}
                            >
                                Personalizar
                            </button>

                            {/* Mesmo peso visual de "Aceitar": o
                                titular precisa poder recusar com um
                                clique só. */}
                            <button
                                type="button"
                                className="mkf-consent-btn mkf-consent-btn--secondary"
                                onClick={rejectAll}
                            >
                                Recusar não essenciais
                            </button>

                            <button
                                type="button"
                                className="mkf-consent-btn mkf-consent-btn--primary"
                                onClick={acceptAll}
                            >
                                Aceitar todos
                            </button>

                        </div>

                    </div>

            )}


            {/* =====================================================
                PAINEL DE PREFERÊNCIAS
            ===================================================== */}

            {/* `dismissible` só depois de existir uma decisão
                registrada: antes disso, fechar no Esc ou no fundo
                deixaria o titular sem ter escolhido nada. */}
            <Modal
                open={isPreferencesOpen}
                onClose={closePreferences}
                dismissible={isDecided}
                overlayClassName="mkf-consent-overlay"
                className="mkf-consent-panel"
                label="Preferências de cookies"
                variant="sheet"
            >

                            {/* HEADER */}

                            <div className="mkf-consent-panel-header">

                                <div>

                                    <span>
                                        Privacidade
                                    </span>

                                    <h2>
                                        Preferências de cookies
                                    </h2>

                                </div>

                                {isDecided && (

                                    <button
                                        type="button"
                                        className="mkf-consent-panel-close"
                                        onClick={closePreferences}
                                        aria-label="Fechar"
                                    >
                                        <Icon icon="lucide:x" />
                                    </button>

                                )}

                            </div>


                            {/* CONTEÚDO */}

                            <div className="mkf-consent-panel-content">

                                <p className="mkf-consent-panel-intro">
                                    Escolha finalidade por finalidade.
                                    Tudo que não é essencial começa
                                    desligado e só é ativado se você
                                    ligar aqui. Ao desligar, o que já
                                    tiver sido guardado naquela
                                    finalidade é apagado.
                                </p>


                                <div className="mkf-consent-categories">

                                    {categories.map((category) => {

                                        const isOn =
                                            category.required ||
                                            Boolean(selection[category.id]);

                                        const isExpanded =
                                            expandedCategory === category.id;

                                        return (

                                            <div
                                                key={category.id}
                                                className={`mkf-consent-category ${isExpanded
                                                    ? "expanded"
                                                    : ""
                                                    }`}
                                            >

                                                <div className="mkf-consent-category-head">

                                                    <button
                                                        type="button"
                                                        className="mkf-consent-category-toggle"
                                                        onClick={() =>
                                                            setExpandedCategory(
                                                                isExpanded
                                                                    ? null
                                                                    : category.id
                                                            )
                                                        }
                                                        aria-expanded={isExpanded}
                                                    >

                                                        <Icon
                                                            icon="lucide:chevron-right"
                                                            className="mkf-consent-category-chevron"
                                                        />

                                                        <span>

                                                            <strong>
                                                                {category.label}

                                                                {category.required && (

                                                                    <em>
                                                                        Sempre ativo
                                                                    </em>

                                                                )}
                                                            </strong>

                                                            <small>
                                                                {category.summary}
                                                            </small>

                                                        </span>

                                                    </button>


                                                    <label
                                                        className={`mkf-consent-switch ${isOn
                                                            ? "on"
                                                            : ""
                                                            } ${category.required
                                                                ? "locked"
                                                                : ""
                                                            }`}
                                                    >

                                                        <input
                                                            type="checkbox"
                                                            checked={isOn}
                                                            disabled={category.required}
                                                            onChange={() =>
                                                                toggleCategory(
                                                                    category.id,
                                                                    category.required
                                                                )
                                                            }
                                                            aria-label={`Ativar ${category.label}`}
                                                        />

                                                        <span />

                                                    </label>

                                                </div>


                                                {/* Abre e fecha por CSS, com
                                                    grid-template-rows 0fr -> 1fr:
                                                    é a forma de animar até a altura
                                                    do conteúdo sem medir nada em
                                                    JavaScript. */}
                                                <div
                                                    className="mkf-consent-category-body"
                                                    data-open={isExpanded}
                                                    aria-hidden={!isExpanded}
                                                >

                                                            <div>

                                                                <p>
                                                                    {category.description}
                                                                </p>

                                                                {category.items.length > 0 ? (

                                                                    <ul>

                                                                        {category.items.map(
                                                                            (item) => (

                                                                                <li key={item.name}>

                                                                                    <code>
                                                                                        {item.name}
                                                                                    </code>

                                                                                    <span>
                                                                                        {item.purpose}
                                                                                    </span>

                                                                                    <small>
                                                                                        Retenção:
                                                                                        {" "}
                                                                                        {item.retention}
                                                                                    </small>

                                                                                </li>

                                                                            )
                                                                        )}

                                                                    </ul>

                                                                ) : (

                                                                    <p className="mkf-consent-category-empty">
                                                                        Nenhum cookie ou dado é gravado
                                                                        nesta finalidade hoje.
                                                                    </p>

                                                                )}

                                                            </div>

                                                </div>

                                            </div>

                                        );

                                    })}

                                </div>


                                <p className="mkf-consent-panel-legal">

                                    <Icon icon="solar:shield-check-outline" />

                                    <span>
                                        Tratamos seus dados conforme a Lei
                                        13.709/2018 (LGPD). Você pode revogar
                                        este consentimento, pedir acesso,
                                        correção ou eliminação dos seus dados
                                        a qualquer momento pela

                                        {" "}

                                        <a
                                            href={PRIVACY_POLICY_PATH}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            Política de Privacidade
                                        </a>.
                                    </span>

                                </p>

                            </div>


                            {/* AÇÕES */}

                            <div className="mkf-consent-panel-actions">

                                <button
                                    type="button"
                                    className="mkf-consent-btn mkf-consent-btn--secondary"
                                    onClick={rejectAll}
                                >
                                    Recusar não essenciais
                                </button>

                                <div>

                                    <button
                                        type="button"
                                        className="mkf-consent-btn mkf-consent-btn--ghost"
                                        onClick={() =>
                                            savePreferences(selection)
                                        }
                                    >
                                        Salvar escolha
                                    </button>

                                    <button
                                        type="button"
                                        className="mkf-consent-btn mkf-consent-btn--primary"
                                        onClick={acceptAll}
                                    >
                                        Aceitar todos
                                    </button>

                                </div>

                            </div>

            </Modal>

        </>,

        document.body

    );

};


export default CookieConsent;
