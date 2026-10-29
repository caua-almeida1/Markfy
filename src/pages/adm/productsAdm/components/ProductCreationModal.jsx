import React from "react";
import { Icon } from "@iconify/react";
import { useLicense } from "../../../../plans/LicenseContext";
import { useUserCompany } from "../../../../contexts/companyContext/UserCompanyContext";

import "./monthly-readiness.css";

import ThumbProduct from "../../../../img/adm-content/file (63).png";

/**
 * Opções de ciclo de cobrança do plano de mensalidade.
 * Puramente apresentacional — por isso vive aqui, e não no wizard.
 */
const MONTHLY_BILLING_CYCLE_OPTIONS = [
    { id: "monthly", label: "Mensal" },
    { id: "quarterly", label: "Trimestral" },
    { id: "semiannual", label: "Semestral" },
    { id: "annual", label: "Anual" }
];


/**
 * Minutos → "45m", "1h" ou "1h 30m".
 */
const formatDurationLabel = (minutes) => {

    const total = Number(minutes) || 0;

    const hours = Math.floor(total / 60);
    const mins = total % 60;

    if (hours === 0) {
        return `${mins}m`;
    }

    if (mins === 0) {
        return `${hours}h`;
    }

    return `${hours}h ${mins}m`;

};

/**
 * Modal de criação de produto com todas as etapas do fluxo.
 *
 * A tela de produtos mantém os dados e as ações do formulário e os
 * fornece pelo objeto `wizard`; a estrutura e a renderização de cada
 * etapa ficam centralizadas neste componente.
 */
const ProductCreationModal = ({
    isOpen,
    isClosing,
    closeModal,
    wizard
}) => {

    const license = useLicense();

    /* A mensalidade cai na conta Mercado Pago da empresa. Sem
       ela conectada, o plano aparece no catálogo e ninguém
       consegue assinar — melhor avisar aqui, na criação. */
    const { company } = useUserCompany() || {};

    const mercadoPagoConnected =
        company?.paymentSettings?.mercadoPago?.connected === true;

    const {
        DESCRIPTION_MAX_LENGTH,
        DURATION_MAX_MINUTES,
        activeFeeTab,
        autoRenew,
        billingCycle,
        bookingAdvanceDays,
        bookingAdvanceHours,
        bookingAdvanceMinutes,
        calculateDiscount,
        cancellationAdvanceDays,
        cancellationAdvanceHours,
        cancellationAdvanceMinutes,
        capitalizeFirst,
        carouselItems,
        closeBookingAdvanceModal,
        closeCancellationAdvanceModal,
        closeConfirmationModal,
        closeDynamicPriceModal,
        closeExtraFeeModal,
        currency,
        currencyPromo,
        customCategorys,
        defaultCategorys,
        descriptionEditorRef,
        descriptionLength,
        duration,
        execDescriptionCommand,
        handleAddCategory,
        handleAddServiceFee,
        handleAddTimeFee,
        handleAddTimeSlot,
        handleAdminClick,
        handleButtonSelect,
        handleCancellationDaysChange,
        handleCancellationHoursChange,
        handleCancellationMinutesChange,
        handleCloseOther,
        handleConfirmation,
        handleContinue,
        handleCurrencyChange,
        handleCurrencyPromoChange,
        handleDaysChange,
        handleDescriptionInput,
        handleDurationChange,
        handleHoursChange,
        handleImageUpload,
        handleItemClick,
        handleMinutesChange,
        handlePriceChange,
        handlePriceFromChange,
        handlePriceToChange,
        handleRemoveCategory,
        handleRemoveItem,
        handleRemoveServiceFee,
        handleRemoveTimeFee,
        handleRemoveTimeSlot,
        handleSaveDynamicPrices,
        handleSaveExtraFees,
        handleServiceFeeChange,
        handleTimeFeeChange,
        handleTimeSlotChange,
        isAddingProduct,
        isAnimating,
        isBookingAdvanceModalClosing,
        isBookingAdvanceModalOpen,
        isCancellationAdvanceModalClosing,
        isCancellationAdvanceModalOpen,
        isConfirmationModalClosing,
        isConfirmationModalOpen,
        isDynamicPriceModalClosing,
        isDynamicPriceModalOpen,
        isExtraFeeModalClosing,
        isExtraFeeModalOpen,
        isFading,
        isInputFilled,
        isOtherSelected,
        isPrivate,
        loyaltyMonths,
        members,
        newCategory,
        nextStep,
        normalizeTimeInput,
        notificationsEnabled,
        openBookingAdvanceModal,
        openCancellationAdvanceModal,
        openDynamicPriceModal,
        openExtraFeeModal,
        prepaymentRequired,
        prevStep,
        price,
        priceFrom,
        priceTo,
        productName,
        productType,
        reschedulingAllowed,
        selectedAdmins,
        selectedDay,
        selectedFeeDay,
        selectedItems,
        serviceFees,
        sessionsPerCycle,
        setActiveFeeTab,
        setAutoRenew,
        setBillingCycle,
        setCurrencyPromo,
        setIsPrivate,
        setLoyaltyMonths,
        setNewCategory,
        setNotificationsEnabled,
        setPrepaymentRequired,
        setProductInfo,
        setProductName,
        setProductType,
        setReschedulingAllowed,
        setSelectedDay,
        setSelectedFeeDay,
        setSessionsPerCycle,
        setSubscriptionCancellationNoticeDays,
        setTrialDays,
        setUnlimitedSessions,
        step,
        stepDirection,
        subscriptionCancellationNoticeDays,
        timeFees,
        timeSlots,
        trialDays,
        unlimitedSessions,
    } = wizard;

    if (!isOpen) {
        return null;
    }

    /* Duração: o range e os campos de hora/minuto são duas
       leituras do mesmo número de minutos. */

    const durationPercent =
        DURATION_MAX_MINUTES > 0
            ? (duration / DURATION_MAX_MINUTES) * 100
            : 0;

    const durationHours = Math.floor(duration / 60);
    const durationMinutes = duration % 60;

    return (
        <div
            className={`
                adm_products-modal-backdrop
                ${isClosing ? "adm_products-modal-backdrop-closing" : ""}
                ${!isClosing ? "adm_products-modal-backdrop-active" : ""}
            `}
            onClick={closeModal}
        >
            <div
                className={`adm_products-modal ${isClosing ? "closing" : ""}`}
                onClick={(event) => event.stopPropagation()}
            >
                {step === 1 && (
                    <div
                        className={`adm_products-modal-content first-step ${isAnimating
                            ? stepDirection === "next"
                                ? "slide-out-left"
                                : "slide-out-right"
                            : ""
                            } ${!isAnimating
                                ? stepDirection === "next"
                                    ? "slide-in-right"
                                    : "slide-in-left"
                                : ""
                            }`}
                    >
                        <img
                            src={ThumbProduct}
                            alt="Produto"
                            className="adm_products-modal-thumb"
                        />
                        <h1>Cadastre um novo Produto!</h1>
                        <h2>Realize o passo a passo para a criação de um novo produto.</h2>

                        <div className="adm_products-modal-buttons">
                            <button
                                className="adm_products-modal-btn secondary-btn"
                                onClick={closeModal}
                            >
                                Cancelar
                            </button>
                            <button
                                className="adm_products-modal-btn primary-btn"
                                onClick={nextStep}
                            >
                                Continuar
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div
                        className={`adm_products-modal-content second-step adm-product-type-step ${isAnimating
                                ? stepDirection === "next"
                                    ? "slide-out-left"
                                    : "slide-out-right"
                                : ""
                            } ${!isAnimating
                                ? stepDirection === "next"
                                    ? "slide-in-right"
                                    : "slide-in-left"
                                : ""
                            }`}
                    >

                        {/* HEADER */}

                        <div className="adm-product-type-header">

                            <span className="adm-product-type-overline">
                                TIPO DE OFERTA
                            </span>

                            <h2>
                                Como você deseja oferecer?
                            </h2>

                            <p>
                                Escolha como o cliente irá adquirir este produto.
                            </p>

                        </div>


                        {/* OPÇÕES */}

                        <div className="adm-product-type-options">

                            {/* PRODUTO INDIVIDUAL */}

                            <button
                                type="button"
                                className={`adm-product-type-card ${productType === "individual"
                                        ? "selected"
                                        : ""
                                    }`}
                                onClick={() => {
                                    handleButtonSelect(1);
                                    setProductType("individual");
                                }}
                            >

                                <div className="adm-product-type-card-top">

                                    <div className="adm-product-type-icon">
                                        <Icon icon="mdi:package-variant" />
                                    </div>

                                </div>


                                <div className="adm-product-type-card-content">

                                    <h3>
                                        Produto individual
                                    </h3>

                                    <p>
                                        Uma oferta única para o cliente,
                                        sem cobrança recorrente.
                                    </p>

                                </div>


                                <div className="adm-product-type-card-footer">

                                    <span>
                                        Compra única
                                    </span>

                                    <Icon icon="solar:arrow-right-up-linear" />

                                </div>


                                <span
                                    className={`adm-selection-check ${productType === "individual"
                                        ? "active"
                                        : ""
                                        }`}
                                    aria-hidden
                                >
                                    <Icon icon="material-symbols:check-rounded" />
                                </span>

                            </button>


                            {/* PLANO DE MENSALIDADE */}

                            <button
                                type="button"
                                className={`adm-product-type-card ${productType === "monthly"
                                        ? "selected"
                                        : ""
                                    }`}
                                onClick={() => {

                                    if (!license.can("monthlyPlans")) {

                                        alert(
                                            "Mensalidades e assinaturas não estão incluídas no plano atual da empresa. " +
                                            "O administrador principal pode mudar de plano em Perfil → Planos e Assinaturas."
                                        );

                                        return;
                                    }

                                    handleButtonSelect(2);
                                    setProductType("monthly");
                                }}
                            >

                                <div className="adm-product-type-card-top">

                                    <div className="adm-product-type-icon">
                                        <Icon icon="solar:refresh-circle-linear" />
                                    </div>

                                </div>


                                <div className="adm-product-type-card-content">

                                    <h3>
                                        Plano de mensalidade
                                    </h3>

                                    <p>
                                        Uma oferta com cobrança recorrente
                                        todos os meses.
                                    </p>

                                </div>


                                <div className="adm-product-type-card-footer">

                                    <span>
                                        Cobrança recorrente
                                    </span>

                                    <Icon icon="solar:arrow-right-up-linear" />

                                </div>


                                <span
                                    className={`adm-selection-check ${productType === "monthly"
                                        ? "active"
                                        : ""
                                        }`}
                                    aria-hidden
                                >
                                    <Icon icon="material-symbols:check-rounded" />
                                </span>

                            </button>

                        </div>


                        {/* AJUDA */}

                        <div className="adm-product-type-help">

                            <Icon icon="solar:info-circle-linear" />

                            <span>
                                Você poderá configurar os detalhes da oferta
                                nas próximas etapas.
                            </span>

                        </div>


                        {/* AÇÕES */}

                        <div className="adm_products-modal-buttons adm-product-type-actions">

                            <button
                                type="button"
                                className="adm_products-modal-btn secondary-btn"
                                onClick={prevStep}
                            >
                                Voltar
                            </button>

                            <button
                                type="button"
                                className={`adm_products-modal-btn primary-btn ${productType === null ? "disabled" : ""
                                    }`}
                                onClick={nextStep}
                                disabled={productType === null}
                                style={{
                                    cursor:
                                        productType === null
                                            ? "not-allowed"
                                            : "pointer",

                                    opacity:
                                        productType === null
                                            ? 0.5
                                            : 1
                                }}
                            >
                                Continuar
                            </button>

                        </div>

                    </div>
                )}

                {step === 2.5 && (
                    <div
                        className={`adm_products-modal-content adm-monthly-step ${isAnimating
                                ? stepDirection === "next"
                                    ? "slide-out-left"
                                    : "slide-out-right"
                                : ""
                            } ${!isAnimating
                                ? stepDirection === "next"
                                    ? "slide-in-right"
                                    : "slide-in-left"
                                : ""
                            }`}
                    >

                        {/* HEADER */}

                        <div className="adm-product-type-header">

                            <span className="adm-product-type-overline">
                                PLANO DE MENSALIDADE
                            </span>

                            <h2>
                                Configure a assinatura
                            </h2>

                            <p>
                                Defina o ciclo de cobrança e os benefícios
                                inclusos para quem assinar este plano.
                            </p>

                        </div>


                        {/* CICLO DE COBRANÇA */}

                        <div className="adm-monthly-section">

                            <span className="adm-monthly-section-label">
                                Ciclo de cobrança
                            </span>

                            <div className="adm-monthly-cycle-options">

                                {MONTHLY_BILLING_CYCLE_OPTIONS.map((option) => (
                                    <button
                                        key={option.id}
                                        type="button"
                                        className={`adm-monthly-cycle-option ${billingCycle === option.id ? "selected" : ""
                                            }`}
                                        onClick={() => setBillingCycle(option.id)}
                                    >
                                        {option.label}
                                    </button>
                                ))}

                            </div>

                        </div>


                        {/* BENEFÍCIOS INCLUSOS */}

                        <div className="adm-monthly-section">

                            <span className="adm-monthly-section-label">
                                Benefícios inclusos por ciclo
                            </span>

                            <div className="adm-monthly-settings-list">

                                <div className="adm-monthly-setting-row">

                                    <label
                                        className="adm-monthly-setting-info"
                                        htmlFor="adm-monthly-unlimited-toggle"
                                    >
                                        <h4>Acesso ilimitado</h4>
                                        <p>Sem limite de atendimentos no ciclo</p>
                                    </label>

                                    <div className="adm_admin_config-toggle-switch">
                                        <input
                                            className="adm_admin_config-toggle-input"
                                            id="adm-monthly-unlimited-toggle"
                                            type="checkbox"
                                            checked={unlimitedSessions}
                                            onChange={(e) =>
                                                setUnlimitedSessions(e.target.checked)
                                            }
                                        />
                                        <label
                                            className="adm_admin_config-toggle-label"
                                            htmlFor="adm-monthly-unlimited-toggle"
                                        />
                                    </div>

                                </div>

                                <div className="adm-monthly-setting-row">

                                    <div className="adm-monthly-setting-info">
                                        <h4>Sessões incluídas</h4>
                                        <p>Quantidade de atendimentos por ciclo</p>
                                    </div>

                                    {unlimitedSessions ? (

                                        <span className="adm-monthly-setting-badge">
                                            Ilimitado
                                        </span>

                                    ) : (

                                        <div className="adm-monthly-setting-input">
                                            <input
                                                type="number"
                                                min="0"
                                                placeholder="0"
                                                value={sessionsPerCycle}
                                                onChange={(e) =>
                                                    setSessionsPerCycle(e.target.value)
                                                }
                                            />
                                            <span>sessões</span>
                                        </div>

                                    )}

                                </div>

                            </div>

                        </div>


                        {/* REGRAS DA ASSINATURA */}

                        <div className="adm-monthly-section">

                            <span className="adm-monthly-section-label">
                                Regras da assinatura
                            </span>

                            <div className="adm-monthly-settings-list">

                                <div className="adm-monthly-setting-row">

                                    <label
                                        className="adm-monthly-setting-info"
                                        htmlFor="adm-monthly-autorenew-toggle"
                                    >
                                        <h4>Renovação automática</h4>
                                        <p>Cobra o cliente de novo a cada ciclo</p>
                                    </label>

                                    <div className="adm_admin_config-toggle-switch">
                                        <input
                                            className="adm_admin_config-toggle-input"
                                            id="adm-monthly-autorenew-toggle"
                                            type="checkbox"
                                            checked={autoRenew}
                                            onChange={(e) => setAutoRenew(e.target.checked)}
                                        />
                                        <label
                                            className="adm_admin_config-toggle-label"
                                            htmlFor="adm-monthly-autorenew-toggle"
                                        />
                                    </div>

                                </div>

                                <div className="adm-monthly-setting-row">

                                    <div className="adm-monthly-setting-info">
                                        <h4>Teste gratuito</h4>
                                        <p>Dias grátis antes da primeira cobrança</p>
                                    </div>

                                    <div className="adm-monthly-setting-input">
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            value={trialDays}
                                            onChange={(e) => setTrialDays(e.target.value)}
                                        />
                                        <span>dias</span>
                                    </div>

                                </div>

                                <div className="adm-monthly-setting-row">

                                    <div className="adm-monthly-setting-info">
                                        <h4>Permanência mínima</h4>
                                        <p>Tempo mínimo de fidelidade do cliente</p>
                                    </div>

                                    <div className="adm-monthly-setting-input">
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            value={loyaltyMonths}
                                            onChange={(e) => setLoyaltyMonths(e.target.value)}
                                        />
                                        <span>meses</span>
                                    </div>

                                </div>

                                <div className="adm-monthly-setting-row">

                                    <div className="adm-monthly-setting-info">
                                        <h4>Aviso de cancelamento</h4>
                                        <p>Antecedência para cancelar sem multa</p>
                                    </div>

                                    <div className="adm-monthly-setting-input">
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            value={subscriptionCancellationNoticeDays}
                                            onChange={(e) =>
                                                setSubscriptionCancellationNoticeDays(
                                                    e.target.value
                                                )
                                            }
                                        />
                                        <span>dias</span>
                                    </div>

                                </div>

                            </div>

                        </div>


                        {/* PARA O CLIENTE CONSEGUIR ASSINAR */}

                        <div className="adm-monthly-readiness">

                            <strong className="adm-monthly-readiness-title">
                                Para o cliente conseguir assinar
                            </strong>

                            <ol>

                                <li className={mercadoPagoConnected ? "is-done" : "is-todo"}>
                                    <Icon
                                        icon={mercadoPagoConnected
                                            ? "solar:check-circle-bold"
                                            : "solar:danger-circle-outline"}
                                    />
                                    <div>
                                        <b>
                                            {mercadoPagoConnected
                                                ? "Mercado Pago conectado"
                                                : "Conecte o Mercado Pago"}
                                        </b>
                                        <span>
                                            Perfil → Formas de Pagamento → Cartões → Conta Mercado Pago.
                                            É nessa conta que as mensalidades caem.
                                        </span>
                                    </div>
                                </li>

                                <li>
                                    <Icon icon="solar:refresh-circle-outline" />
                                    <div>
                                        <b>Verifique as assinaturas</b>
                                        <span>
                                            Na mesma tela, toque em "Verificar assinaturas". Se o
                                            Mercado Pago ainda não liberou, a tela diz o que fazer.
                                        </span>
                                    </div>
                                </li>

                                <li>
                                    <Icon icon="solar:user-check-outline" />
                                    <div>
                                        <b>O cliente assina em 4 passos</b>
                                        <span>
                                            Confere o plano, autoriza a cobrança recorrente, paga com
                                            cartão de crédito ou com a conta Mercado Pago, e pronto: a
                                            cobrança se repete sozinha a cada ciclo até ele cancelar.
                                        </span>
                                    </div>
                                </li>

                            </ol>

                            {!mercadoPagoConnected && (
                                <a
                                    className="adm-monthly-readiness-link"
                                    href="/central-adm?tab=perfil&screen=payment-card"
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    Conectar agora (abre em outra aba)
                                    <Icon icon="solar:arrow-right-up-linear" />
                                </a>
                            )}

                        </div>


                        {/* AJUDA */}

                        <div className="adm-product-type-help">

                            <Icon icon="solar:info-circle-linear" />

                            <span>
                                Você poderá alterar essas configurações
                                depois na página de gestão do produto. Quem já
                                assina continua com as condições que aceitou.
                            </span>

                        </div>


                        {/* AÇÕES */}

                        <div className="adm_products-modal-buttons adm-product-type-actions">

                            <button
                                type="button"
                                className="adm_products-modal-btn secondary-btn"
                                onClick={prevStep}
                            >
                                Voltar
                            </button>

                            <button
                                type="button"
                                className="adm_products-modal-btn primary-btn"
                                onClick={nextStep}
                            >
                                Continuar
                            </button>

                        </div>

                    </div>
                )}

                {step === 3 && (
                    <div
                        className={`adm_products-modal-content first-step ${isAnimating
                            ? stepDirection === "next"
                                ? "slide-out-left"
                                : "slide-out-right"
                            : ""
                            } ${!isAnimating
                                ? stepDirection === "next"
                                    ? "slide-in-right"
                                    : "slide-in-left"
                                : ""
                            }`}
                    >
                        <h2 className="adm_products-modal-content-title">Coleção de Fotos do Produto</h2>
                        <p className="adm_products-modal-content-subtitle">Adicione até 5 fotos ao catálogo de fotos do seu produto</p>

                        <div className="adm_products-modal-carousel-container">
                            <div className="adm_products-modal-carousel">
                                {carouselItems.map((item, index) => (
                                    item.image !== null ? (
                                        <div key={item.id} className="adm_products-modal-carousel-item" >
                                            <input
                                                id={`file-input-filled-${index}`}
                                                type="file"
                                                accept="image/*"
                                                style={{ display: "none" }}
                                                onChange={(e) => handleImageUpload(e, index)}
                                                multiple
                                            />
                                            <img
                                                src={item.image}
                                                alt={`Imagem ${index}`}
                                                className="adm_products-modal-carousel-image"
                                            />
                                            <div className="overlay-replace-image">Substituir</div>
                                            <button
                                                className="remove-item-button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveItem(index);
                                                }}
                                            >
                                                <Icon icon="lucide:trash" className="remove-item-icon" />
                                            </button>
                                        </div>
                                    ) : null
                                ))}
                                {carouselItems.filter(item => item.image === null).length > 0 && (
                                    <div className="adm_products-modal-carousel-item" onClick={() => document.getElementById('file-input-empty').click()}>
                                        <input
                                            id="file-input-empty"
                                            type="file"
                                            accept="image/*"
                                            style={{ display: "none" }}
                                            onChange={(e) => handleImageUpload(e, carouselItems.length)}
                                            multiple
                                        />
                                        <div
                                            className="adm_products-modal-carousel-item-content"

                                        >
                                            <Icon icon="material-symbols:upload-rounded" className="adm_products-modal-carousel-icon" />
                                            <span className="adm_products-modal-carousel-text">Adicionar Imagem</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="adm_products-modal-buttons">
                            <button
                                className="adm_products-modal-btn secondary-btn"
                                onClick={prevStep}
                            >
                                Voltar
                            </button>

                            <button
                                className="adm_products-modal-btn primary-btn"
                                onClick={nextStep}
                            >
                                Continuar
                            </button>
                        </div>
                    </div>
                )}

                {step === 4 && (
                    <div
                        className={`adm_products-modal-content first-step ${isAnimating
                            ? stepDirection === "next"
                                ? "slide-out-left"
                                : "slide-out-right"
                            : ""
                            } ${!isAnimating
                                ? stepDirection === "next"
                                    ? "slide-in-right"
                                    : "slide-in-left"
                                : ""
                            }`}
                    >
                        <h2 className="adm_products-modal-content-title">Informações do Produto</h2>

                        {/* Inputs com labels */}
                        <div className="adm_products-modal-input-group">
                            <label htmlFor="input1">Nome do produto</label>
                            <input
                                type="text"
                                id="input1"
                                className="adm_products-modal-input"
                                placeholder="Digite o nome do produto aqui..."
                                value={productName}
                                onChange={(e) => setProductName(e.target.value)}
                            />
                        </div>

                        <div className="adm_products-description-group">

                            <label>
                                Descrição
                            </label>

                            <div className="adm_products-description-editor">

                                {/* =========================
            TOOLBAR
        ========================= */}

                                <div className="adm_products-description-toolbar">

                                    {/* NEGRITO */}

                                    <button
                                        type="button"
                                        title="Negrito"
                                        onMouseDown={(e) => {

                                            e.preventDefault();

                                            execDescriptionCommand("bold");

                                        }}
                                    >
                                        <strong>B</strong>
                                    </button>


                                    {/* ITÁLICO */}

                                    <button
                                        type="button"
                                        title="Itálico"
                                        onMouseDown={(e) => {

                                            e.preventDefault();

                                            execDescriptionCommand("italic");

                                        }}
                                    >
                                        <em>I</em>
                                    </button>


                                    <div className="adm_products-description-toolbar-divider" />


                                    {/* LISTA */}

                                    <button
                                        type="button"
                                        title="Lista"
                                        onMouseDown={(e) => {

                                            e.preventDefault();

                                            execDescriptionCommand(
                                                "insertUnorderedList"
                                            );

                                        }}
                                    >
                                        <Icon icon="lucide:list" />
                                    </button>


                                    {/* LISTA NUMERADA */}

                                    <button
                                        type="button"
                                        title="Lista numerada"
                                        onMouseDown={(e) => {

                                            e.preventDefault();

                                            execDescriptionCommand(
                                                "insertOrderedList"
                                            );

                                        }}
                                    >
                                        <Icon icon="lucide:list-ordered" />
                                    </button>


                                    <div className="adm_products-description-toolbar-divider" />


                                    {/* PARÁGRAFO */}

                                    <button
                                        type="button"
                                        title="Parágrafo"
                                        onMouseDown={(e) => {

                                            e.preventDefault();

                                            execDescriptionCommand(
                                                "formatBlock",
                                                "p"
                                            );

                                        }}
                                    >
                                        <Icon icon="lucide:pilcrow" />
                                    </button>

                                </div>

                                <div
                                    ref={descriptionEditorRef}
                                    className="adm_products-description-editor-content"
                                    contentEditable
                                    suppressContentEditableWarning
                                    data-placeholder="Digite a descrição do produto..."
                                    onInput={handleDescriptionInput}
                                />

                                <div className="adm_products-description-counter">
                                    {descriptionLength}/{DESCRIPTION_MAX_LENGTH}
                                </div>

                            </div>

                        </div>

                        <div className="adm_products-modal-input-group">
                            <label htmlFor="input3">Preço do Produto</label>
                            <div className="adm_products-price-input-container">
                                <input
                                    type="text"
                                    id="input3"
                                    className="adm_products-modal-input adm_products-price-input"
                                    placeholder="Digite o preço do produto aqui..."
                                    value={price}
                                    onChange={handlePriceChange}
                                />
                                <div className="adm_products-currency-wrapper">
                                    <select
                                        className="adm_products-currency-select"
                                        value={currency}
                                        onChange={handleCurrencyChange}
                                    >
                                        <option value="BRL">BRL</option>
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="GBP">GBP</option>
                                        <option value="JPY">JPY</option>
                                    </select>
                                    <Icon icon="iconamoon:arrow-down-2-duotone" width="24" height="24" className="adm_products-currency-icon" />
                                </div>
                            </div>
                        </div>

                        <div className="adm_products-modal-input-group">

                            <label htmlFor="duration">
                                Duração do Serviço

                                <span className="adm_products-modal-range-value">
                                    {formatDurationLabel(duration)}
                                </span>
                            </label>


                            <div className="adm_products-range-container">

                                <input
                                    type="range"
                                    id="duration"
                                    className="adm_products-modal-range"
                                    min="0"
                                    max={DURATION_MAX_MINUTES}
                                    step="5"
                                    value={duration}
                                    onChange={(event) =>
                                        handleDurationChange(
                                            event.target.value
                                        )
                                    }
                                    style={{
                                        "--range-percent": `${durationPercent}%`
                                    }}
                                />

                                {/* O centro do thumb não fica exatamente
                                    em `percent%` — desloca-se meia largura
                                    do thumb ao longo do trilho. */}
                                <div
                                    className="adm_products-range-tooltip"
                                    style={{
                                        left:
                                            `calc(${durationPercent}% + ` +
                                            `${(0.5 - durationPercent / 100) * 30}px)`
                                    }}
                                >
                                    {formatDurationLabel(duration)}
                                </div>

                            </div>


                            {/* ENTRADA MANUAL */}

                            <div className="adm_products-duration-manual">

                                <div className="adm_products-duration-fields">

                                    <div className="adm_products-duration-field">

                                        <input
                                            type="number"
                                            min="0"
                                            max={Math.floor(
                                                DURATION_MAX_MINUTES / 60
                                            )}
                                            placeholder="0"
                                            aria-label="Horas"
                                            value={
                                                durationHours === 0
                                                    ? ""
                                                    : durationHours
                                            }
                                            onChange={(event) =>
                                                handleDurationChange(
                                                    (parseInt(
                                                        event.target.value,
                                                        10
                                                    ) || 0) * 60 +
                                                    durationMinutes
                                                )
                                            }
                                        />

                                        <span>h</span>

                                    </div>


                                    <div className="adm_products-duration-field">

                                        <input
                                            type="number"
                                            min="0"
                                            max="59"
                                            placeholder="0"
                                            aria-label="Minutos"
                                            value={
                                                durationMinutes === 0
                                                    ? ""
                                                    : durationMinutes
                                            }
                                            onChange={(event) => {

                                                const minutes =
                                                    Math.min(
                                                        parseInt(
                                                            event.target.value,
                                                            10
                                                        ) || 0,
                                                        59
                                                    );

                                                handleDurationChange(
                                                    durationHours * 60 +
                                                    minutes
                                                );

                                            }}
                                        />

                                        <span>min</span>

                                    </div>

                                </div>


                                <span className="adm_products-duration-hint">
                                    Máximo de
                                    {" "}
                                    {formatDurationLabel(
                                        DURATION_MAX_MINUTES
                                    )}
                                </span>

                            </div>

                        </div>

                        <div className="adm_products-modal-buttons">
                            <button
                                className="adm_products-modal-btn secondary-btn"
                                onClick={prevStep}
                            >
                                Voltar
                            </button>

                            <button
                                className="adm_products-modal-btn primary-btn"
                                onClick={nextStep}
                            >
                                Continuar
                            </button>
                        </div>
                    </div>
                )}

                {step === 5 && (
                    <div
                        className={`adm_products-modal-content first-step ${isAnimating
                            ? stepDirection === "next"
                                ? "slide-out-left"
                                : "slide-out-right"
                            : ""
                            } ${!isAnimating
                                ? stepDirection === "next"
                                    ? "slide-in-right"
                                    : "slide-in-left"
                                : ""
                            }`}
                    >
                        <h2 className="adm_products-modal-content-title">Categoria do Produto</h2>
                        <p className="adm_products-modal-content-subtitle">Selecione as categorias do seu produto</p>

                        <div className={`adm_products-order-grid-container ${isOtherSelected ? "other-content-active" : ""} ${isFading ? "other-content-fade-out" : "other-content-fade-in"}`}>
                            {isOtherSelected ? (
                                <div className="adm_products-other-content">
                                    <button className="other-content-close-btn" onClick={handleCloseOther}>
                                        <Icon icon="tabler:arrow-left" className="icon" />
                                    </button>
                                    <div className="selected-categories-container">
                                        {selectedItems.map((id) => {
                                            // Busca a categoria nas categorias padrão e personalizadas
                                            const selectedCategory = defaultCategorys.find((item) => item.id === id) || customCategorys.find((item) => item.id === id);
                                            return (
                                                <div key={id} className="selected-category-item">
                                                    <button className="remove-category-btn" onClick={() => handleRemoveCategory(id)}>
                                                        <Icon icon="tabler:x" className="icon" />
                                                    </button>
                                                    {selectedCategory?.label}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="adm_products-modal-input-group">
                                        <label htmlFor="input1">Categoria</label>
                                        <div className="input-with-button-container">
                                            <input
                                                type="text"
                                                id="input1"
                                                className="adm_products-modal-input"
                                                placeholder="Digite o nome da categoria aqui..."
                                                value={newCategory}
                                                onChange={(e) => setNewCategory(e.target.value)}
                                            />
                                            <button className="add-category-button" onClick={handleAddCategory}>
                                                <Icon icon="material-symbols:add" className="icon" />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // Renderiza apenas as categorias padrão no grid
                                defaultCategorys.map((item) => (
                                    <div
                                        key={item.id}
                                        className={`adm_products-order-grid-item ${selectedItems.includes(item.id) ? "selected" : ""
                                            }`}
                                        onClick={() => handleItemClick(item.id)}
                                    >
                                        <Icon icon={item.icon} className="icon" />
                                        <p>{item.label}</p>

                                        <span
                                            className={`adm-selection-check ${selectedItems.includes(item.id)
                                                ? "active"
                                                : ""
                                                }`}
                                            aria-hidden
                                        >
                                            <Icon icon="material-symbols:check-rounded" />
                                        </span>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="adm_products-modal-buttons">
                            <button
                                className="adm_products-modal-btn secondary-btn"
                                onClick={prevStep}
                            >
                                Voltar
                            </button>

                            <button
                                className="adm_products-modal-btn primary-btn"
                                onClick={nextStep}
                            >
                                Continuar
                            </button>
                        </div>
                    </div>
                )}

                {step === 6 && (
                    <div
                        className={`adm_products-modal-content first-step ${isAnimating
                            ? stepDirection === "next"
                                ? "slide-out-left"
                                : "slide-out-right"
                            : ""
                            } ${!isAnimating
                                ? stepDirection === "next"
                                    ? "slide-in-right"
                                    : "slide-in-left"
                                : ""
                            }`}
                    >
                        <h2 className="adm_products-modal-content-title">Descontos e Promoções</h2>
                        <p className="adm_products-modal-content-subtitle">Adicione descontos em seu produto para atrair mais visibilidade e engajamento.</p>

                        <div className="promotion-question-container">
                            <div className="adm_products-modal-input-group">
                                <label htmlFor="inputFrom">De</label>
                                <div className="adm_products-price-input-container">
                                    <input
                                        type="text"
                                        id="inputFrom"
                                        className="adm_products-modal-input adm_products-price-input"
                                        placeholder="ex: R$150,00"
                                        value={priceFrom}
                                        onChange={handlePriceFromChange}
                                    />
                                    <div className="adm_products-currency-wrapper">
                                        <select
                                            className="adm_products-currency-select"
                                            value={currencyPromo}
                                            onChange={handleCurrencyPromoChange}
                                        >
                                            <option value="BRL">BRL</option>
                                            <option value="USD">USD</option>
                                            <option value="EUR">EUR</option>
                                            <option value="GBP">GBP</option>
                                            <option value="JPY">JPY</option>
                                        </select>
                                        <Icon icon="iconamoon:arrow-down-2-duotone" width="24" height="24" className="adm_products-currency-icon" />
                                    </div>
                                </div>
                            </div>

                            <div className="adm_products-modal-input-group">
                                <label htmlFor="inputTo">Por</label>
                                <div className="adm_products-price-input-container">
                                    <input
                                        type="text"
                                        id="inputTo"
                                        className="adm_products-modal-input adm_products-price-input"
                                        placeholder="ex: R$50,00"
                                        value={priceTo}
                                        onChange={handlePriceToChange}
                                    />
                                    <div className="adm_products-currency-wrapper">
                                        <select
                                            className="adm_products-currency-select"
                                            value={currencyPromo}
                                            onChange={(e) => setCurrencyPromo(e.target.value)}
                                        >
                                            <option value="BRL">BRL</option>
                                            <option value="USD">USD</option>
                                            <option value="EUR">EUR</option>
                                            <option value="GBP">GBP</option>
                                            <option value="JPY">JPY</option>
                                        </select>
                                        <Icon icon="iconamoon:arrow-down-2-duotone" width="24" height="24" className="adm_products-currency-icon" />
                                    </div>
                                </div>
                            </div>

                        </div>

                        <div className="promotion-discount-message">
                            {calculateDiscount()}
                        </div>

                        <div className="adm_products-modal-buttons">
                            <button
                                className="adm_products-modal-btn secondary-btn"
                                onClick={prevStep}
                            >
                                Voltar
                            </button>

                            <button
                                className="adm_products-modal-btn primary-btn"
                                onClick={nextStep}
                            >
                                {isInputFilled ? "Continuar" : "Pular"} {/* Altera o texto do botão com base no estado */}
                            </button>
                        </div>
                    </div>
                )}

                {step === 7 && (
                    <div
                        className={`adm_products-modal-content first-step ${isAnimating
                            ? stepDirection === "next"
                                ? "slide-out-left"
                                : "slide-out-right"
                            : ""
                            } ${!isAnimating
                                ? stepDirection === "next"
                                    ? "slide-in-right"
                                    : "slide-in-left"
                                : ""
                            }`}
                    >
                        <h2 className="adm_products-modal-content-title">Configurações</h2>
                        <p className="adm_products-modal-content-subtitle adm_products-modal-content-subtitle-config">Ajuste as configurações do seu produto.</p>

                        <h1 className="adm_admins-title">Relacionar Usuários</h1>
                        <div className="adm_admins-config-content">
                            <div className="adm_admins-config-content-container">
                                <div className="adm_admins-config-wrapper">
                                    <div className="add-admin-config-button">
                                        <Icon icon="mdi:plus" className="icon" />
                                    </div>
                                    <h1>Adicionar</h1>
                                    <p>Usuários</p>
                                </div>
                                {members.map(member => (
                                    <div
                                        key={member.id}
                                        className={`adm_admins-config-wrapper adm_admins-config-wrapper-circles-select-adm ${selectedAdmins.includes(member.id) ? 'active' : ''
                                            }`}
                                        onClick={() => handleAdminClick(member.id)}
                                    >
                                        <div className="adm_admins-config-circle-container">
                                            <div className="adm_admins-config-circle">
                                                {member.avatar ? (
                                                    <img src={member.avatar} alt={member.name} className="adm_admins-avatar" />
                                                ) : (
                                                    member.name.charAt(0)
                                                )}
                                            </div>
                                            <div className={`selection-indicator ${selectedAdmins.includes(member.id) ? 'active' : ''}`}>
                                                <Icon icon="material-symbols:check" className="icon" />
                                            </div>
                                        </div>
                                        <div className="adm_admins-text-container">
                                            <h1>{member.name}</h1>
                                            <p>{capitalizeFirst(member.role)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <h1 className="adm_admins-title">Configurações</h1>
                        <div className="adm_admins-config-carousel">
                            <div className="adm_admins-config-carousel-container">
                                <div className="adm_admins-config-wrapper">
                                    <div className="adm_admins-config-square">
                                        <div className="adm_admins-config-content">
                                            <h1>Privacidade</h1>
                                            <p>Deixe este produto privado</p>
                                            <div class="adm_admin_config-toggle-switch">
                                                <input
                                                    class="adm_admin_config-toggle-input"
                                                    type="checkbox"
                                                    id="adm_admin_config-private-toggle"
                                                    checked={isPrivate}
                                                    onChange={(e) => setIsPrivate(e.target.checked)}
                                                />
                                                <label class="adm_admin_config-toggle-label" for="adm_admin_config-private-toggle"></label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="adm_admins-config-wrapper">
                                    <div className="adm_admins-config-square">
                                        <div className="adm_admins-config-content">
                                            <h1>Antecedência para Agendamento</h1>
                                            <p>Mínimo de horas/dias antes do agendamento.</p>
                                            <button className="adm_admins-config-time-button"
                                                onClick={openBookingAdvanceModal}
                                            >
                                                Definir
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="adm_admins-config-wrapper">
                                    <div className="adm_admins-config-square">
                                        <div className="adm_admins-config-content">
                                            <h1>Antecedência para Cancelamento</h1>
                                            <p>Tempo limite para cancelar sem penalidade</p>
                                            <button className="adm_admins-config-time-button" onClick={openCancellationAdvanceModal}>Definir</button>
                                        </div>
                                    </div>
                                </div>

                                <div className="adm_admins-config-wrapper">
                                    <div className="adm_admins-config-square">
                                        <div className="adm_admins-config-content">
                                            <h1>Notificações</h1>
                                            <p>Avisos para clientes e administradores</p>
                                            <div class="adm_admin_config-toggle-switch">
                                                <input
                                                    class="adm_admin_config-toggle-input"
                                                    id="adm_admin_config-notification-toggle"
                                                    type="checkbox"
                                                    checked={notificationsEnabled}
                                                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                                                />
                                                <label class="adm_admin_config-toggle-label" for="adm_admin_config-notification-toggle"></label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="adm_admins-config-wrapper">
                                    <div className="adm_admins-config-square">
                                        <div className="adm_admins-config-content">
                                            <h1>Preço Dinâmico</h1>
                                            <p>Valores diferentes por horário/dia.</p>
                                            <button
                                                className="adm_admins-config-time-button"
                                                onClick={openDynamicPriceModal}
                                            >
                                                Definir
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <div className="adm_admins-config-wrapper">
                                    <div className="adm_admins-config-square">
                                        <div className="adm_admins-config-content">
                                            <h1>Pagamento Antecipado</h1>
                                            <p>Exige pagamento antes do agendamento.</p>
                                            <div class="adm_admin_config-toggle-switch">
                                                <input
                                                    class="adm_admin_config-toggle-input"
                                                    id="adm_admin_config-pay-toggle"
                                                    type="checkbox"
                                                    checked={prepaymentRequired}
                                                    onChange={(e) => setPrepaymentRequired(e.target.checked)}
                                                />
                                                <label class="adm_admin_config-toggle-label" for="adm_admin_config-pay-toggle"></label>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="adm_admins-config-wrapper">
                                    <div className="adm_admins-config-square">
                                        <div className="adm_admins-config-content">
                                            <h1>Reagendamento</h1>
                                            <p>Permite alterar data/hora após confirmação.</p>
                                            <div class="adm_admin_config-toggle-switch">
                                                <input
                                                    class="adm_admin_config-toggle-input"
                                                    id="adm_admin_config-alt-date-toggle"
                                                    type="checkbox"
                                                    checked={reschedulingAllowed}
                                                    onChange={(e) => setReschedulingAllowed(e.target.checked)}
                                                />
                                                <label class="adm_admin_config-toggle-label" for="adm_admin_config-alt-date-toggle"></label>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="adm_admins-config-wrapper">
                                    <div className="adm_admins-config-square">
                                        <div className="adm_admins-config-content">
                                            <h1>Taxa Extra</h1>
                                            <p>Cobrança adicional por horário ou tipo de serviço.</p>
                                            <button
                                                className="adm_admins-config-time-button"
                                                onClick={openExtraFeeModal}
                                            >
                                                Definir
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="adm_products-modal-buttons">
                            <button
                                className="adm_products-modal-btn secondary-btn"
                                onClick={prevStep}
                            >
                                Voltar
                            </button>

                            <button
                                className="adm_products-modal-btn primary-btn"
                                onClick={handleContinue}
                            >
                                Continuar
                            </button>
                        </div>
                    </div>
                )}

                {isConfirmationModalOpen && (
                    <div className={`adm_confirmation-modal-overlay ${isConfirmationModalOpen ? 'active' : ''} ${isConfirmationModalClosing ? 'closing' : ''}`}>
                        <div className={`adm_confirmation-modal-content ${isConfirmationModalOpen && !isConfirmationModalClosing ? 'active' : ''} ${isConfirmationModalClosing ? 'closing' : ''}`}>
                            <Icon icon="mingcute:question-line" className="icon" />
                            <h2 className="adm_confirmation-modal-title">Confirmar Cadastro</h2>
                            <p className="adm_confirmation-modal-message">Deseja cadastrar este produto com as configurações selecionadas?</p>

                            <div className="adm_confirmation-modal-buttons">
                                <button
                                    className="adm_confirmation-modal-btn secondary-btn"
                                    onClick={closeConfirmationModal}
                                    disabled={isAddingProduct}
                                >
                                    Cancelar
                                </button>
                                <button
                                    className={`adm_confirmation-modal-btn primary-btn ${isAddingProduct ? "loading" : ""
                                        }`}
                                    onClick={handleConfirmation}
                                    disabled={isAddingProduct}
                                >
                                    {isAddingProduct ? (
                                        <>
                                            <span className="adm_confirmation-spinner"></span>
                                            Criando...
                                        </>
                                    ) : (
                                        "Confirmar"
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isBookingAdvanceModalOpen && (
                    <div className={`booking-advance-config-modal-overlay ${isBookingAdvanceModalClosing ? 'closing' : ''}`}>
                        <div className={`booking-advance-config-modal-content ${isBookingAdvanceModalClosing ? 'closing' : ''}`}>
                            <div>
                                <h2>Antecedência para Agendamento</h2>
                                <p>Escolha o tempo mínimo necessário antes de reservar:</p>
                            </div>

                            <div className="booking-advance-config-time-input">
                                <input
                                    type="number"
                                    min="0"
                                    placeholder="DD"
                                    className="booking-advance-config-input"
                                    value={bookingAdvanceDays}
                                    onChange={handleDaysChange}
                                />
                                :
                                <input
                                    type="number"
                                    min="0"
                                    max="23"
                                    placeholder="HH"
                                    className="booking-advance-config-input"
                                    value={bookingAdvanceHours}
                                    onChange={handleHoursChange}
                                />
                                :
                                <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    placeholder="MM"
                                    className="booking-advance-config-input"
                                    value={bookingAdvanceMinutes}
                                    onChange={handleMinutesChange}
                                />
                            </div>
                            <div className="booking-advance-config-modal-wrapper-buttons">
                                <button
                                    className="booking-advance-config-modal-close"
                                    onClick={closeBookingAdvanceModal}
                                >
                                    Fechar
                                </button>
                                <button
                                    className="booking-advance-config-modal-set"
                                    onClick={() => {
                                        // Normaliza os valores antes de salvar
                                        const normalized = normalizeTimeInput(
                                            bookingAdvanceDays,
                                            bookingAdvanceHours,
                                            bookingAdvanceMinutes
                                        );

                                        setProductInfo(prev => ({
                                            ...prev,
                                            bookingAdvance: {
                                                days: normalized.days,
                                                hours: normalized.hours,
                                                minutes: normalized.minutes
                                            }
                                        }));
                                        closeBookingAdvanceModal();
                                    }}
                                >
                                    Definir
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isCancellationAdvanceModalOpen && (
                    <div className={`cancellation-advance-config-modal-overlay ${isCancellationAdvanceModalClosing ? 'closing' : ''}`}>
                        <div className={`cancellation-advance-config-modal-content ${isCancellationAdvanceModalClosing ? 'closing' : ''}`}>
                            <div>
                                <h2>Antecedência para Cancelamento</h2>
                                <p>Escolha o tempo mínimo necessário antes de cancelar:</p>
                            </div>

                            <div className="cancellation-advance-config-time-input">
                                <input
                                    type="number"
                                    min="0"
                                    max="365"
                                    placeholder="DD"
                                    className="cancellation-advance-config-input"
                                    value={cancellationAdvanceDays}
                                    onChange={handleCancellationDaysChange}
                                />
                                :
                                <input
                                    type="number"
                                    min="0"
                                    max="23"
                                    placeholder="HH"
                                    className="cancellation-advance-config-input"
                                    value={cancellationAdvanceHours}
                                    onChange={handleCancellationHoursChange}
                                />
                                :
                                <input
                                    type="number"
                                    min="0"
                                    max="59"
                                    placeholder="MM"
                                    className="cancellation-advance-config-input"
                                    value={cancellationAdvanceMinutes}
                                    onChange={handleCancellationMinutesChange}
                                />
                            </div>
                            <div className="cancellation-advance-config-modal-wrapper-buttons">
                                <button
                                    className="cancellation-advance-config-modal-close"
                                    onClick={closeCancellationAdvanceModal}
                                >
                                    Fechar
                                </button>
                                <button
                                    className="cancellation-advance-config-modal-set"
                                    onClick={() => {
                                        // Normaliza os valores antes de salvar
                                        const normalized = normalizeTimeInput(
                                            cancellationAdvanceDays,
                                            cancellationAdvanceHours,
                                            cancellationAdvanceMinutes
                                        );

                                        // Atualiza o productInfo com os valores normalizados
                                        setProductInfo(prev => ({
                                            ...prev,
                                            cancellationAdvance: {
                                                days: normalized.days,
                                                hours: normalized.hours,
                                                minutes: normalized.minutes
                                            }
                                        }));
                                        closeCancellationAdvanceModal();
                                    }}
                                >
                                    Definir
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isDynamicPriceModalOpen && (
                    <div className={`cancellation-advance-config-modal-overlay ${isDynamicPriceModalClosing ? 'closing' : ''}`}>
                        <div className={`cancellation-advance-config-modal-content dynamic-price-modal ${isDynamicPriceModalClosing ? 'closing' : ''}`}>
                            <div>
                                <h2>Preço Dinâmico</h2>
                                <p>Defina valores diferentes por dia da semana:</p>
                            </div>

                            {/* Dias da semana */}
                            <div className="days-of-week-container">
                                {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map((day, index) => (
                                    <div
                                        key={index}
                                        className={`day-box ${selectedDay === index ? 'selected' : ''}`}
                                        onClick={() => setSelectedDay(index)}
                                    >
                                        {day}
                                    </div>
                                ))}
                            </div>

                            {/* Configuração de horários para o dia selecionado */}
                            {selectedDay !== null && (
                                <div className="time-slots-container">
                                    <h3>Horários para {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'][selectedDay]}</h3>

                                    {timeSlots[selectedDay]?.map((slot, slotIndex) => (
                                        <div key={slotIndex} className="time-slot">
                                            <input
                                                type="time"
                                                value={slot.startTime}
                                                onChange={(e) => handleTimeSlotChange(selectedDay, slotIndex, 'startTime', e.target.value)}
                                            />
                                            <span>às</span>
                                            <input
                                                type="time"
                                                value={slot.endTime}
                                                onChange={(e) => handleTimeSlotChange(selectedDay, slotIndex, 'endTime', e.target.value)}
                                            />
                                            <input
                                                type="number"
                                                placeholder="Valor (R$)"
                                                value={slot.price}
                                                onChange={(e) => handleTimeSlotChange(selectedDay, slotIndex, 'price', e.target.value)}
                                                min="0"
                                                step="0.01"
                                            />
                                            <button
                                                className="remove-slot"
                                                onClick={() => handleRemoveTimeSlot(selectedDay, slotIndex)}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    ))}

                                    <button
                                        className="add-time-slot"
                                        onClick={() => handleAddTimeSlot(selectedDay)}
                                    >
                                        + Adicionar horário
                                    </button>
                                </div>
                            )}

                            <div className="cancellation-advance-config-modal-wrapper-buttons">
                                <button
                                    className="cancellation-advance-config-modal-close"
                                    onClick={closeDynamicPriceModal}
                                >
                                    Fechar
                                </button>
                                <button
                                    className="cancellation-advance-config-modal-set"
                                    onClick={handleSaveDynamicPrices}
                                >
                                    Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {isExtraFeeModalOpen && (
                    <div className={`cancellation-advance-config-modal-overlay ${isExtraFeeModalClosing ? 'closing' : ''}`}>
                        <div className={`cancellation-advance-config-modal-content extra-fee-modal ${isExtraFeeModalClosing ? 'closing' : ''}`}>
                            <div>
                                <h2>Taxa Extra</h2>
                                <p>Defina cobranças adicionais por horário ou tipo de serviço:</p>
                            </div>

                            {/* Abas para selecionar o tipo de taxa */}
                            <div className="fee-type-tabs">
                                <button
                                    className={`tab-button ${activeFeeTab === 'time' ? 'active' : ''}`}
                                    onClick={() => setActiveFeeTab('time')}
                                >
                                    Por Horário
                                </button>
                                <button
                                    className={`tab-button ${activeFeeTab === 'service' ? 'active' : ''}`}
                                    onClick={() => setActiveFeeTab('service')}
                                >
                                    Por Serviço
                                </button>
                            </div>

                            <div className={`tab-content ${activeFeeTab === 'time' ? 'active' : ''}`}>
                                {activeFeeTab === 'time' && (
                                    <div className="time-based-fee">
                                        <div className="days-of-week-container">
                                            {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map((day, index) => (
                                                <div
                                                    key={index}
                                                    className={`day-box ${selectedFeeDay === index ? 'selected' : ''}`}
                                                    onClick={() => setSelectedFeeDay(index)}
                                                >
                                                    {day}
                                                </div>
                                            ))}
                                        </div>

                                        {selectedFeeDay !== null && (
                                            <div className="time-fee-container">
                                                <h3>Taxas por horário - {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'][selectedFeeDay]}</h3>

                                                {timeFees[selectedFeeDay]?.map((fee, feeIndex) => (
                                                    <div key={feeIndex} className="fee-slot">
                                                        {/* Linha superior com inputs de tempo */}
                                                        <div className="fee-time-row">
                                                            <input
                                                                type="time"
                                                                value={fee.startTime}
                                                                onChange={(e) => handleTimeFeeChange(selectedFeeDay, feeIndex, 'startTime', e.target.value)}
                                                                className="time-input"
                                                            />
                                                            <span className="time-separator">às</span>
                                                            <input
                                                                type="time"
                                                                value={fee.endTime}
                                                                onChange={(e) => handleTimeFeeChange(selectedFeeDay, feeIndex, 'endTime', e.target.value)}
                                                                className="time-input"
                                                            />
                                                        </div>

                                                        {/* Linha inferior com select e valor */}
                                                        <div className="fee-value-row">
                                                            <select
                                                                value={fee.type}
                                                                onChange={(e) => handleTimeFeeChange(selectedFeeDay, feeIndex, 'type', e.target.value)}
                                                                className="fee-type-select"
                                                            >
                                                                <option value="fixed">Valor Fixo</option>
                                                                <option value="percentage">Porcentagem</option>
                                                            </select>

                                                            <input
                                                                type="number"
                                                                placeholder={fee.type === 'fixed' ? 'Valor (R$)' : '%'}
                                                                value={fee.value}
                                                                onChange={(e) => handleTimeFeeChange(selectedFeeDay, feeIndex, 'value', e.target.value)}
                                                                className="fee-value-input"
                                                            />

                                                            <button
                                                                className="remove-slot"
                                                                onClick={() => handleRemoveTimeFee(selectedFeeDay, feeIndex)}
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}

                                                <button
                                                    className="add-time-slot"
                                                    onClick={() => handleAddTimeFee(selectedFeeDay)}
                                                >
                                                    + Adicionar Taxa
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}

                            </div>

                            <div className={`tab-content ${activeFeeTab === 'service' ? 'active' : ''}`}>

                                {activeFeeTab === 'service' && (
                                    <div className="service-based-fee">
                                        <div className="service-fee-list">
                                            {serviceFees.map((service, index) => (
                                                <div key={index} className="service-fee-item">
                                                    <input
                                                        type="text"
                                                        placeholder="Nome do serviço"
                                                        value={service.name}
                                                        onChange={(e) => handleServiceFeeChange(index, 'name', e.target.value)}
                                                    />
                                                    <select
                                                        value={service.type}
                                                        onChange={(e) => handleServiceFeeChange(index, 'type', e.target.value)}
                                                    >
                                                        <option value="fixed">Valor Fixo</option>
                                                        <option value="percentage">Porcentagem</option>
                                                    </select>
                                                    <input
                                                        type="number"
                                                        placeholder={service.type === 'fixed' ? 'Valor (R$)' : '%'}
                                                        value={service.value}
                                                        onChange={(e) => handleServiceFeeChange(index, 'value', e.target.value)}
                                                    />
                                                    <button
                                                        className="remove-slot"
                                                        onClick={() => handleRemoveServiceFee(index)}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        <button
                                            className="add-time-slot"
                                            onClick={handleAddServiceFee}
                                        >
                                            + Adicionar Serviço
                                        </button>
                                    </div>
                                )}
                            </div>

                            <div className="cancellation-advance-config-modal-wrapper-buttons">
                                <button
                                    className="cancellation-advance-config-modal-close"
                                    onClick={closeExtraFeeModal}
                                >
                                    Fechar
                                </button>
                                <button
                                    className="cancellation-advance-config-modal-set"
                                    onClick={handleSaveExtraFees}
                                >
                                    Salvar
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProductCreationModal;
