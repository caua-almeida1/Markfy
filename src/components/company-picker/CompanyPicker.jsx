import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react";

import { useUserCompany } from "../../contexts/companyContext/UserCompanyContext";
import { useCompanyLogos } from "../../firebase/companyLogo";

import markfyLogo from "../../img/logo-markfy.svg";

import "./company-picker.css";

/* =========================================================
   SELEÇÃO DE EMPRESA

   Quem participa de mais de uma empresa escolhe qual quer
   administrar. Dois formatos, mesma lista:

     - "screen": tela cheia, mostrada pelo painel logo
       depois do login, antes de qualquer dado carregar;

     - "modal": aberto pelo botão "Trocar empresa", por cima
       do painel, e fechável.
========================================================= */

const CompanyAvatar = ({ name, logo }) => {

    /* A logo vem do Storage; se o arquivo falhar (ou não
       existir), cai para a inicial em vez de um ícone
       quebrado. */
    const [broken, setBroken] = useState(false);

    useEffect(() => {
        setBroken(false);
    }, [logo]);

    return (
        <span className="company-picker__avatar" aria-hidden="true">
            {logo && !broken ? (
                <img
                    src={logo}
                    alt=""
                    onError={() => setBroken(true)}
                />
            ) : (
                <span>
                    {name?.charAt(0)?.toUpperCase() || "M"}
                </span>
            )}
        </span>
    );

};

const CompanyPicker = ({
    variant = "screen",
    onClose
}) => {

    const {
        companies,
        companyHandle,
        selectCompany
    } = useUserCompany();

    const logos = useCompanyLogos(companies);

    const [pending, setPending] = useState(null);

    const isModal = variant === "modal";


    useEffect(() => {

        if (!isModal) return undefined;

        const handleKey = (event) => {
            if (event.key === "Escape") onClose?.();
        };

        window.addEventListener("keydown", handleKey);

        return () =>
            window.removeEventListener("keydown", handleKey);

    }, [isModal, onClose]);


    const handleSelect = async (handle) => {

        if (pending) return;

        if (handle === companyHandle) {
            onClose?.();
            return;
        }

        /* No modal, fecha antes: a troca mostra a tela de
           carregamento do painel, e o modal não deve
           reaparecer por cima da empresa nova. */
        if (isModal) onClose?.();

        setPending(handle);

        try {

            await selectCompany(handle);

        } finally {

            setPending(null);

        }

    };


    const card = (
        <section
            className="company-picker__card"
            role={isModal ? "dialog" : undefined}
            aria-modal={isModal ? "true" : undefined}
            aria-labelledby="company-picker-title"
            onClick={(event) => event.stopPropagation()}
        >

            <header className="company-picker__header">

                {!isModal && (
                    <img
                        className="company-picker__brand"
                        src={markfyLogo}
                        alt="Markfy"
                    />
                )}

                <div>
                    <h1 id="company-picker-title">
                        {isModal
                            ? "Trocar de empresa"
                            : "Qual empresa você quer acessar?"}
                    </h1>

                    <p>
                        Você faz parte de {companies.length} empresas.
                        Pedidos, produtos e agenda mostram só a
                        empresa escolhida.
                    </p>
                </div>

                {isModal && (
                    <button
                        type="button"
                        className="company-picker__close"
                        onClick={onClose}
                        aria-label="Fechar"
                    >
                        <Icon icon="lucide:x" />
                    </button>
                )}

            </header>

            <ul className="company-picker__list">

                {companies.map((item) => {

                    const isCurrent = item.handle === companyHandle;
                    const isPending = item.handle === pending;

                    return (
                        <li key={item.handle}>
                            <button
                                type="button"
                                className={
                                    "company-picker__item" +
                                    (isCurrent ? " company-picker__item--current" : "")
                                }
                                onClick={() => handleSelect(item.handle)}
                                disabled={Boolean(pending)}
                                aria-current={isCurrent ? "true" : undefined}
                            >

                                <CompanyAvatar
                                    name={item.name}
                                    logo={logos[item.handle]}
                                />

                                <span className="company-picker__info">
                                    <strong>{item.name}</strong>
                                    <small>
                                        @{item.handle} · {item.roleLabel}
                                    </small>
                                </span>

                                {isCurrent && (
                                    <span className="company-picker__badge">
                                        Atual
                                    </span>
                                )}

                                <Icon
                                    className="company-picker__arrow"
                                    icon={
                                        isPending
                                            ? "svg-spinners:ring-resize"
                                            : "lucide:chevron-right"
                                    }
                                />

                            </button>
                        </li>
                    );

                })}

            </ul>

        </section>
    );


    if (isModal) {
        return (
            <div
                className="company-picker company-picker--modal"
                onClick={onClose}
            >
                {card}
            </div>
        );
    }

    return (
        <main className="company-picker company-picker--screen">
            {card}
        </main>
    );

};

export default CompanyPicker;
