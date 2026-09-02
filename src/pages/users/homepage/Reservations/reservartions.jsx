import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { getDatabase, ref, get, update } from "firebase/database";
import { useParams } from "react-router-dom";

import { getClientId } from "../../../../utils/clientID";

import "./reservations.css";

const Reservations = () => {

    const { handle } = useParams();

    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedReservation, setSelectedReservation] = useState(null);
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [cancelError, setCancelError] = useState("");

    const [sortOption, setSortOption] = useState("priority");
    const [showSortMenu, setShowSortMenu] = useState(false);


    /* =====================================================
       CARREGAR RESERVAS
    ===================================================== */

    useEffect(() => {

        const loadReservations = async () => {

            setLoading(true);

            try {

                const clientId = getClientId();
                const db = getDatabase();

                if (!handle || !clientId) {
                    setReservations([]);
                    return;
                }

                const schedulesRef = ref(
                    db,
                    `companys/${handle}/schedules`
                );

                const snapshot = await get(schedulesRef);

                if (!snapshot.exists()) {
                    setReservations([]);
                    return;
                }

                const schedules = snapshot.val();

                const firebaseReservations =
                    Object.entries(schedules)
                        .map(([id, reservation]) => ({
                            id,
                            ...reservation
                        }))
                        .filter(
                            reservation =>
                                reservation.clientId === clientId
                        );

                setReservations(firebaseReservations);

            } catch (error) {

                console.error(
                    "Erro ao carregar reservas:",
                    error
                );

                setReservations([]);

            } finally {

                setLoading(false);

            }

        };

        loadReservations();

    }, [handle]);


    /* =====================================================
       STATUS
    ===================================================== */

    const getReservationStatus = (status) => {

        switch (status) {

            case "pending":
                return {
                    label: "Pendente",
                    className: "pending"
                };

            case "completed":
                return {
                    label: "Concluído",
                    className: "completed"
                };

            case "cancelados":
                return {
                    label: "Cancelado",
                    className: "cancelled"
                };

            default:
                return {
                    label: status || "Desconhecido",
                    className: "unknown"
                };

        }

    };


    /* =====================================================
       DATA
    ===================================================== */

    const getReservationDate = (reservation) => {

        if (
            !reservation?.day ||
            !reservation?.hour
        ) {
            return null;
        }

        try {

            const [
                day,
                month,
                year
            ] = reservation.day
                .split("/")
                .map(Number);

            const [
                hours,
                minutes
            ] = reservation.hour
                .split(":")
                .map(Number);

            if (
                !day ||
                !month ||
                !year ||
                Number.isNaN(hours) ||
                Number.isNaN(minutes)
            ) {
                return null;
            }

            const date = new Date(
                year,
                month - 1,
                day,
                hours,
                minutes,
                0,
                0
            );

            if (
                Number.isNaN(
                    date.getTime()
                )
            ) {
                return null;
            }

            return date;

        } catch (error) {

            console.error(
                "Erro ao interpretar data:",
                error
            );

            return null;

        }

    };


    const getReservationTimestamp = (reservation) => {

        const date =
            getReservationDate(reservation);

        if (!date) {
            return Number.MAX_SAFE_INTEGER;
        }

        return date.getTime();

    };


    /* =====================================================
       PRIORIDADE
    ===================================================== */

    const getStatusPriority = (status) => {

        switch (status) {

            case "pending":
                return 0;

            case "completed":
                return 1;

            case "cancelados":
                return 2;

            default:
                return 3;

        }

    };


    /* =====================================================
       ORDENAÇÃO
    ===================================================== */

    const getSortedReservations = () => {

        const sorted = [...reservations];

        switch (sortOption) {

            case "priority":

                return sorted.sort((a, b) => {

                    const statusA =
                        getStatusPriority(a.status);

                    const statusB =
                        getStatusPriority(b.status);

                    if (
                        statusA !== statusB
                    ) {
                        return statusA - statusB;
                    }

                    return (
                        getReservationTimestamp(a) -
                        getReservationTimestamp(b)
                    );

                });


            case "nearest":

                return sorted.sort((a, b) => {

                    return (
                        getReservationTimestamp(a) -
                        getReservationTimestamp(b)
                    );

                });


            case "furthest":

                return sorted.sort((a, b) => {

                    return (
                        getReservationTimestamp(b) -
                        getReservationTimestamp(a)
                    );

                });


            case "status":

                return sorted.sort((a, b) => {

                    const statusA =
                        getStatusPriority(a.status);

                    const statusB =
                        getStatusPriority(b.status);

                    if (
                        statusA !== statusB
                    ) {
                        return statusA - statusB;
                    }

                    return (
                        getReservationTimestamp(a) -
                        getReservationTimestamp(b)
                    );

                });


            default:

                return sorted;

        }

    };


    /* =====================================================
       ANTECEDÊNCIA
    ===================================================== */

    const getAdvanceInMilliseconds = (advance) => {

        if (!advance) {
            return 0;
        }

        const days =
            Number(advance.days) || 0;

        const hours =
            Number(advance.hours) || 0;

        const minutes =
            Number(advance.minutes) || 0;

        return (
            days * 24 * 60 * 60 * 1000 +
            hours * 60 * 60 * 1000 +
            minutes * 60 * 1000
        );

    };


    const formatAdvance = (advance) => {

        if (!advance) {
            return "sem antecedência";
        }

        const days =
            Number(advance.days) || 0;

        const hours =
            Number(advance.hours) || 0;

        const minutes =
            Number(advance.minutes) || 0;

        const parts = [];

        if (days > 0) {

            parts.push(
                `${days} ${days === 1 ? "dia" : "dias"}`
            );

        }

        if (hours > 0) {

            parts.push(
                `${hours} ${hours === 1 ? "hora" : "horas"}`
            );

        }

        if (minutes > 0) {

            parts.push(
                `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`
            );

        }

        return parts.length
            ? parts.join(" e ")
            : "sem antecedência";

    };


    /* =====================================================
       CANCELAMENTO
    ===================================================== */

    const openCancelModal = (reservation) => {

        if (
            reservation.status !== "pending"
        ) {
            return;
        }

        setSelectedReservation(reservation);
        setCancelError("");
        setShowCancelModal(true);

    };


    const closeCancelModal = () => {

        if (cancelling) {
            return;
        }

        setShowCancelModal(false);
        setSelectedReservation(null);
        setCancelError("");

    };


    const handleCancelReservation = async () => {

        if (!selectedReservation) {
            return;
        }

        if (
            selectedReservation.status !== "pending"
        ) {
            return;
        }

        if (!handle) {

            setCancelError(
                "Não foi possível identificar a empresa."
            );

            return;

        }

        setCancelling(true);
        setCancelError("");

        try {

            const db = getDatabase();

            const reservation =
                selectedReservation;

            const reservationRef = ref(
                db,
                `companys/${handle}/schedules/${reservation.id}`
            );

            const reservationSnapshot =
                await get(reservationRef);

            if (
                !reservationSnapshot.exists()
            ) {

                throw new Error(
                    "Esta reserva não foi encontrada."
                );

            }

            const currentReservation =
                reservationSnapshot.val();

            if (
                currentReservation.status !== "pending"
            ) {

                if (
                    currentReservation.status ===
                    "cancelados"
                ) {
                    throw new Error(
                        "Esta reserva já foi cancelada."
                    );
                }

                if (
                    currentReservation.status ===
                    "completed"
                ) {
                    throw new Error(
                        "Esta reserva já foi concluída."
                    );
                }

                throw new Error(
                    "Esta reserva não pode mais ser cancelada."
                );

            }

            const reservationDate =
                getReservationDate(
                    currentReservation
                );

            if (!reservationDate) {

                throw new Error(
                    "Não foi possível identificar a data e hora da reserva."
                );

            }

            let cancellationAdvance = null;

            if (
                currentReservation.productId
            ) {

                const productRef = ref(
                    db,
                    `companys/${handle}/products/${currentReservation.productId}`
                );

                const productSnapshot =
                    await get(productRef);

                if (
                    productSnapshot.exists()
                ) {

                    const product =
                        productSnapshot.val();

                    cancellationAdvance =
                        product.cancellationAdvance ||
                        null;

                }

            }

            const advanceMs =
                getAdvanceInMilliseconds(
                    cancellationAdvance
                );

            const now = Date.now();

            const reservationTime =
                reservationDate.getTime();

            const minimumCancelTime =
                reservationTime - advanceMs;

            if (
                now > minimumCancelTime
            ) {

                throw new Error(
                    `Esta reserva não pode mais ser cancelada. O cancelamento deve ser feito com pelo menos ${formatAdvance(
                        cancellationAdvance
                    )} de antecedência.`
                );

            }

            const cancelledAt =
                new Date().toISOString();

            await update(
                reservationRef,
                {
                    status: "cancelados",
                    cancelledAt,
                    cancelledBy: "client"
                }
            );

            setReservations(prev =>
                prev.map(item =>
                    item.id === reservation.id
                        ? {
                            ...item,
                            status: "cancelados",
                            cancelledAt,
                            cancelledBy: "client"
                        }
                        : item
                )
            );

            const localData =
                localStorage.getItem(
                    "markfy-last-agendamento"
                );

            if (localData) {

                try {

                    const localReservation =
                        JSON.parse(localData);

                    if (
                        localReservation?.timestamp ===
                        currentReservation.timestamp
                    ) {

                        localStorage.setItem(
                            "markfy-last-agendamento",
                            JSON.stringify({
                                ...localReservation,
                                status: "cancelados",
                                cancelledAt,
                                cancelledBy: "client"
                            })
                        );

                    }

                } catch {
                    // Ignorar erro local
                }

            }

            setShowCancelModal(false);
            setSelectedReservation(null);
            setCancelError("");

        } catch (error) {

            console.error(
                "Erro ao cancelar reserva:",
                error
            );

            setCancelError(
                error.message ||
                "Não foi possível cancelar a reserva."
            );

        } finally {

            setCancelling(false);

        }

    };


    /* =====================================================
       MENU DE ORDENAÇÃO
    ===================================================== */

    const renderSortMenu = () => {

        if (!showSortMenu) {
            return null;
        }

        const options = [
            {
                id: "priority",
                icon: "solar:sort-by-time-outline",
                title: "Prioridade",
                description:
                    "Pendentes, concluídas e canceladas"
            },
            {
                id: "nearest",
                icon: "solar:calendar-search-outline",
                title: "Mais próximas",
                description:
                    "Primeiro o próximo agendamento"
            },
            {
                id: "furthest",
                icon: "solar:calendar-add-outline",
                title: "Mais distantes",
                description:
                    "Primeiro o agendamento mais distante"
            },
            {
                id: "status",
                icon: "solar:filter-outline",
                title: "Por status",
                description:
                    "Pendentes → concluídas → canceladas"
            }
        ];

        return (
            <>
                <div
                    className="reservations-sort-backdrop"
                    onClick={() =>
                        setShowSortMenu(false)
                    }
                />

                <div
                    className="reservations-sort-menu"
                    onClick={(e) =>
                        e.stopPropagation()
                    }
                >

                    <div className="reservations-sort-menu-header">

                        <div>

                            <strong>
                                Ordenar reservas
                            </strong>

                            <span>
                                Escolha como deseja visualizar
                            </span>

                        </div>

                        <button
                            type="button"
                            onClick={() =>
                                setShowSortMenu(false)
                            }
                            aria-label="Fechar"
                        >
                            <Icon icon="mdi:close" />
                        </button>

                    </div>

                    <div className="reservations-sort-options">

                        {options.map(option => (

                            <button
                                key={option.id}
                                type="button"
                                className={
                                    sortOption === option.id
                                        ? "selected"
                                        : ""
                                }
                                onClick={() => {

                                    setSortOption(
                                        option.id
                                    );

                                    setShowSortMenu(false);

                                }}
                            >

                                <div className="sort-option-icon">

                                    <Icon
                                        icon={option.icon}
                                    />

                                </div>

                                <div className="sort-option-content">

                                    <strong>
                                        {option.title}
                                    </strong>

                                    <span>
                                        {option.description}
                                    </span>

                                </div>

                                {sortOption === option.id && (

                                    <Icon
                                        icon="material-symbols:check"
                                        className="sort-option-check"
                                    />

                                )}

                            </button>

                        ))}

                    </div>

                </div>
            </>
        );

    };


    /* =====================================================
       HEADER
    ===================================================== */

    const renderHeader = () => (

        <div className="reservations-header">

            <div className="reservations-header-content">

                <h1>
                    Reservas
                </h1>

                <p>
                    Seus agendamentos
                </p>

            </div>

            <div className="reservations-sort-wrapper">

                <button
                    type="button"
                    className={`reservations-sort-button ${showSortMenu
                            ? "active"
                            : ""
                        }`}
                    onClick={() =>
                        setShowSortMenu(
                            prev => !prev
                        )
                    }
                    aria-label="Ordenar reservas"
                    aria-expanded={showSortMenu}
                >

                    <Icon
                        icon="solar:sort-vertical-outline"
                    />

                </button>

                {renderSortMenu()}

            </div>

        </div>

    );


    /* =====================================================
       LOADING
    ===================================================== */

    if (loading) {

        return (

            <div className="reservations-page">

                {renderHeader()}

                <div className="reservations-loading">

                    <div className="reservation-skeleton" />

                    <div className="reservation-skeleton" />

                    <div className="reservation-skeleton" />

                </div>

            </div>

        );

    }


    /* =====================================================
       TELA PRINCIPAL
    ===================================================== */

    return (

        <div className="reservations-page">

            {renderHeader()}

            {reservations.length === 0 ? (

                /* ==========================================
                   EMPTY
                ========================================== */

                <div className="reservations-empty">

                    <div className="reservations-empty-icon">

                        <Icon
                            icon="solar:calendar-outline"
                        />

                    </div>

                    <h2>
                        Nenhuma reserva
                    </h2>

                    <p>
                        Quando você realizar um
                        agendamento, ele aparecerá aqui.
                    </p>

                </div>

            ) : (

                /* ==========================================
                   RESERVAS
                ========================================== */

                <div className="reservations-container">

                    {/* ======================================
                       CABEÇALHO DESKTOP
                    ====================================== */}

                    <div className="reservations-table-header">

                        <span>
                            Data e horário
                        </span>

                        <span>
                            Serviço
                        </span>

                        <span>
                            Profissional
                        </span>

                        <span>
                            Status
                        </span>

                        <span>
                            Valor
                        </span>

                        <span>
                            Ação
                        </span>

                    </div>


                    {/* ======================================
                       LISTA
                    ====================================== */}

                    <div className="reservations-list">

                        {getSortedReservations().map(
                            reservation => {

                                const status =
                                    getReservationStatus(
                                        reservation.status
                                    );

                                return (

                                    <article
                                        className="reservation-card"
                                        key={reservation.id}
                                    >

                                        {/* ====================
                                           DATA
                                        ==================== */}

                                        <div className="reservation-date">

                                            <div className="reservation-date-icon">

                                                <Icon
                                                    icon="solar:calendar-outline"
                                                />

                                            </div>

                                            <div className="reservation-date-content">

                                                <strong>
                                                    {reservation.day}
                                                </strong>

                                                <span>
                                                    {reservation.hour}
                                                </span>

                                            </div>

                                        </div>


                                        {/* ====================
                                           SERVIÇO
                                        ==================== */}

                                        <div className="reservation-service">

                                            <span className="reservation-mobile-label">
                                                Serviço
                                            </span>

                                            <strong>
                                                {
                                                    reservation.productName ||
                                                    "Serviço"
                                                }
                                            </strong>

                                            <span className="reservation-service-client">

                                                <Icon
                                                    icon="solar:user-circle-outline"
                                                />

                                                {
                                                    reservation.userName ||
                                                    "Cliente"
                                                }

                                            </span>

                                        </div>


                                        {/* ====================
                                           PROFISSIONAL
                                        ==================== */}

                                        <div className="reservation-professional">

                                            <span className="reservation-mobile-label">
                                                Profissional
                                            </span>

                                            <div className="reservation-professional-content">

                                                <div className="reservation-professional-icon">

                                                    <Icon
                                                        icon="solar:user-outline"
                                                    />

                                                </div>

                                                <span>
                                                    {
                                                        reservation.professionalName ||
                                                        "Profissional"
                                                    }
                                                </span>

                                            </div>

                                        </div>


                                        {/* ====================
                                           STATUS
                                        ==================== */}

                                        <div className="reservation-status-wrapper">

                                            <span className="reservation-mobile-label">
                                                Status
                                            </span>

                                            <span
                                                className={`reservation-status ${status.className}`}
                                            >
                                                <span className="reservation-status-dot" />

                                                {status.label}

                                            </span>

                                        </div>


                                        {/* ====================
                                           VALOR
                                        ==================== */}

                                        <div className="reservation-price">

                                            <span className="reservation-mobile-label">
                                                Valor
                                            </span>

                                            <strong>
                                                {
                                                    reservation.productPrice ||
                                                    "—"
                                                }
                                            </strong>

                                        </div>


                                        {/* ====================
                                           AÇÃO
                                        ==================== */}

                                        <div className="reservation-actions">

                                            {reservation.status ===
                                                "pending" ? (

                                                <button
                                                    type="button"
                                                    className="reservation-cancel-button"
                                                    onClick={() =>
                                                        openCancelModal(
                                                            reservation
                                                        )
                                                    }
                                                >

                                                    <Icon
                                                        icon="solar:close-circle-outline"
                                                    />

                                                    <span>
                                                        Cancelar
                                                    </span>

                                                </button>

                                            ) : (

                                                <span className="reservation-no-action">
                                                    —
                                                </span>

                                            )}

                                        </div>

                                    </article>

                                );

                            }
                        )}

                    </div>

                </div>

            )}


            {/* =================================================
                MODAL DE CANCELAMENTO
            ================================================= */}

            {showCancelModal &&
                selectedReservation && (

                    <div
                        className="reservation-cancel-overlay"
                        onClick={closeCancelModal}
                    >

                        <div
                            className="reservation-cancel-modal"
                            onClick={(e) =>
                                e.stopPropagation()
                            }
                        >

                            <div className="reservation-cancel-icon">

                                <Icon
                                    icon="solar:calendar-remove-outline"
                                />

                            </div>

                            <h2>
                                Cancelar reserva?
                            </h2>

                            <p>

                                Tem certeza que deseja
                                cancelar sua reserva de{" "}

                                <strong>
                                    {
                                        selectedReservation.productName
                                    }
                                </strong>
                                ?

                            </p>

                            {cancelError ? (

                                <div className="reservation-cancel-error">

                                    <Icon
                                        icon="solar:danger-triangle-outline"
                                    />

                                    <span>
                                        {cancelError}
                                    </span>

                                </div>

                            ) : (

                                <p className="reservation-cancel-warning">
                                    Essa ação não poderá
                                    ser desfeita.
                                </p>

                            )}

                            <div className="reservation-cancel-actions">

                                <button
                                    type="button"
                                    className="reservation-cancel-back"
                                    onClick={
                                        closeCancelModal
                                    }
                                    disabled={cancelling}
                                >
                                    Voltar
                                </button>

                                <button
                                    type="button"
                                    className="reservation-cancel-confirm"
                                    onClick={
                                        handleCancelReservation
                                    }
                                    disabled={cancelling}
                                >

                                    {cancelling ? (

                                        <>
                                            <span className="reservation-cancel-spinner" />

                                            Cancelando...
                                        </>

                                    ) : (

                                        <>
                                            <Icon
                                                icon="solar:close-circle-outline"
                                            />

                                            Cancelar reserva
                                        </>

                                    )}

                                </button>

                            </div>

                        </div>

                    </div>

                )}

        </div>

    );

};

export default Reservations;