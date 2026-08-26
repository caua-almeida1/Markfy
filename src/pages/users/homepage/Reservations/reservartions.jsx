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

    // ==========================================
    // CARREGAR RESERVAS
    // ==========================================

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

                // ==========================================
                // NÃO EXISTE MAIS SCHEDULES
                // ==========================================

                if (!snapshot.exists()) {

                    setReservations([]);

                    return;
                }

                const schedules = snapshot.val();

                // ==========================================
                // PEGAR SOMENTE RESERVAS EXISTENTES
                // DO CLIENTE LOGADO
                // ==========================================

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
    // ==========================================
    // STATUS DA RESERVA
    // ==========================================

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
                    label: status || "Status desconhecido",
                    className: "unknown"
                };

        }

    };

    // ==========================================
    // ABRIR MODAL
    // ==========================================

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

    // ==========================================
    // FECHAR MODAL
    // ==========================================

    const closeCancelModal = () => {

        if (cancelling) {
            return;
        }

        setShowCancelModal(false);
        setSelectedReservation(null);
        setCancelError("");

    };

    // ==========================================
    // DATA/HORA DA RESERVA
    // ==========================================

    const getReservationDate = (reservation) => {

        if (
            !reservation?.day ||
            !reservation?.hour
        ) {
            return null;
        }

        try {

            // Exemplo:
            // day = "26/08/2026"
            // hour = "18:30"

            const [
                day,
                month,
                year
            ] =
                reservation.day
                    .split("/")
                    .map(Number);

            const [
                hours,
                minutes
            ] =
                reservation.hour
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
                "Erro ao interpretar data da reserva:",
                error
            );

            return null;

        }

    };



    // ==========================================
    // DATA DA RESERVA PARA ORDENAÇÃO
    // ==========================================

    const getReservationTimestamp = (reservation) => {

        const date = getReservationDate(reservation);

        if (!date) {
            return Number.MAX_SAFE_INTEGER;
        }

        return date.getTime();

    };


    // ==========================================
    // PRIORIDADE DO STATUS
    // ==========================================

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


    // ==========================================
    // ORDENAR RESERVAS
    // ==========================================

    const getSortedReservations = () => {

        const sorted = [...reservations];

        switch (sortOption) {

            // ==========================================
            // PADRÃO
            // PENDENTE → COMPLETADO → CANCELADO
            // DENTRO DE CADA GRUPO: MAIS PRÓXIMO
            // ==========================================

            case "priority":

                return sorted.sort((a, b) => {

                    const statusA =
                        getStatusPriority(a.status);

                    const statusB =
                        getStatusPriority(b.status);

                    if (statusA !== statusB) {
                        return statusA - statusB;
                    }

                    return (
                        getReservationTimestamp(a) -
                        getReservationTimestamp(b)
                    );

                });


            // ==========================================
            // MAIS PRÓXIMA
            // ==========================================

            case "nearest":

                return sorted.sort((a, b) => {

                    return (
                        getReservationTimestamp(a) -
                        getReservationTimestamp(b)
                    );

                });


            // ==========================================
            // MAIS DISTANTE
            // ==========================================

            case "furthest":

                return sorted.sort((a, b) => {

                    return (
                        getReservationTimestamp(b) -
                        getReservationTimestamp(a)
                    );

                });


            // ==========================================
            // STATUS
            // ==========================================

            case "status":

                return sorted.sort((a, b) => {

                    const statusA =
                        getStatusPriority(a.status);

                    const statusB =
                        getStatusPriority(b.status);

                    if (statusA !== statusB) {
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


    // ==========================================
    // CONVERTER ANTECEDÊNCIA PARA MILISSEGUNDOS
    // ==========================================

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
            (days * 24 * 60 * 60 * 1000) +
            (hours * 60 * 60 * 1000) +
            (minutes * 60 * 1000)
        );

    };

    // ==========================================
    // FORMATAR ANTECEDÊNCIA
    // ==========================================

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
                `${days} ${days === 1
                    ? "dia"
                    : "dias"
                }`
            );

        }

        if (hours > 0) {

            parts.push(
                `${hours} ${hours === 1
                    ? "hora"
                    : "horas"
                }`
            );

        }

        if (minutes > 0) {

            parts.push(
                `${minutes} ${minutes === 1
                    ? "minuto"
                    : "minutos"
                }`
            );

        }

        return parts.length > 0
            ? parts.join(" e ")
            : "sem antecedência";

    };



    // ==========================================
    // CANCELAR RESERVA
    // ==========================================

    const handleCancelReservation = async () => {

        if (!selectedReservation) {
            return;
        }

        // ==========================================
        // SÓ PENDING PODE SER CANCELADO
        // ==========================================

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

            // ==========================================
            // REFERÊNCIA DA RESERVA
            // ==========================================

            const reservationRef = ref(
                db,
                `companys/${handle}/schedules/${reservation.id}`
            );

            // ==========================================
            // BUSCAR RESERVA NOVAMENTE
            // ==========================================

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

            // ==========================================
            // VERIFICAR STATUS REAL DO FIREBASE
            // ==========================================

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

            // ==========================================
            // DATA DA RESERVA
            // ==========================================

            const reservationDate =
                getReservationDate(
                    currentReservation
                );

            if (!reservationDate) {

                throw new Error(
                    "Não foi possível identificar a data e hora da reserva."
                );

            }

            // ==========================================
            // BUSCAR PRODUTO
            // ==========================================

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

            // ==========================================
            // VERIFICAR ANTECEDÊNCIA
            // ==========================================

            const advanceMs =
                getAdvanceInMilliseconds(
                    cancellationAdvance
                );

            const now =
                Date.now();

            const reservationTime =
                reservationDate.getTime();

            const minimumCancelTime =
                reservationTime - advanceMs;

            // Já passou do limite
            if (
                now > minimumCancelTime
            ) {

                throw new Error(
                    `Esta reserva não pode mais ser cancelada. O cancelamento deve ser feito com pelo menos ${formatAdvance(
                        cancellationAdvance
                    )} de antecedência.`
                );

            }

            // ==========================================
            // CANCELAR NO FIREBASE
            // ==========================================

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

            // ==========================================
            // ATUALIZAR ESTADO DA TELA
            // ==========================================

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

            // ==========================================
            // ATUALIZAR RESERVA LOCAL
            // ==========================================

            const localData =
                localStorage.getItem(
                    "markfy-last-agendamento"
                );

            if (localData) {

                try {

                    const localReservation =
                        JSON.parse(localData);

                    /*
                     * O timestamp é utilizado como
                     * identificador da reserva local.
                     */

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
                    // Ignora erro do localStorage
                }

            }

            // ==========================================
            // FECHAR MODAL
            // ==========================================

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



    // ==========================================
    // LOADING
    // ==========================================

    if (loading) {

        return (
            <div className="reservations-page">

                <div className="reservations-header">

                    <div>

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
                            className={`reservations-sort-button ${showSortMenu ? "active" : ""
                                }`}
                            onClick={() =>
                                setShowSortMenu(prev => !prev)
                            }
                            aria-label="Ordenar reservas"
                            aria-expanded={showSortMenu}
                        >

                            <Icon
                                icon="solar:sort-vertical-outline"
                            />

                        </button>

                        {showSortMenu && (

                            <>

                                <div
                                    className="reservations-sort-backdrop"
                                    onClick={() =>
                                        setShowSortMenu(false)
                                    }
                                />

                                <div className="reservations-sort-menu">

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

                                        <button
                                            type="button"
                                            className={
                                                sortOption === "priority"
                                                    ? "selected"
                                                    : ""
                                            }
                                            onClick={() => {

                                                setSortOption(
                                                    "priority"
                                                );

                                                setShowSortMenu(false);

                                            }}
                                        >

                                            <div className="sort-option-icon">

                                                <Icon
                                                    icon="solar:sort-by-time-outline"
                                                />

                                            </div>

                                            <div className="sort-option-content">

                                                <strong>
                                                    Prioridade
                                                </strong>

                                                <span>
                                                    Pendentes, concluídas e canceladas
                                                </span>

                                            </div>

                                            {sortOption === "priority" && (

                                                <Icon
                                                    icon="material-symbols:check"
                                                    className="sort-option-check"
                                                />

                                            )}

                                        </button>

                                        <button
                                            type="button"
                                            className={
                                                sortOption === "nearest"
                                                    ? "selected"
                                                    : ""
                                            }
                                            onClick={() => {

                                                setSortOption(
                                                    "nearest"
                                                );

                                                setShowSortMenu(false);

                                            }}
                                        >

                                            <div className="sort-option-icon">

                                                <Icon
                                                    icon="solar:calendar-search-outline"
                                                />

                                            </div>

                                            <div className="sort-option-content">

                                                <strong>
                                                    Mais próximas
                                                </strong>

                                                <span>
                                                    Primeiro o próximo agendamento
                                                </span>

                                            </div>

                                            {sortOption === "nearest" && (

                                                <Icon
                                                    icon="material-symbols:check"
                                                    className="sort-option-check"
                                                />

                                            )}

                                        </button>

                                        <button
                                            type="button"
                                            className={
                                                sortOption === "furthest"
                                                    ? "selected"
                                                    : ""
                                            }
                                            onClick={() => {

                                                setSortOption(
                                                    "furthest"
                                                );

                                                setShowSortMenu(false);

                                            }}
                                        >

                                            <div className="sort-option-icon">

                                                <Icon
                                                    icon="solar:calendar-add-outline"
                                                />

                                            </div>

                                            <div className="sort-option-content">

                                                <strong>
                                                    Mais distantes
                                                </strong>

                                                <span>
                                                    Primeiro o agendamento mais distante
                                                </span>

                                            </div>

                                            {sortOption === "furthest" && (

                                                <Icon
                                                    icon="material-symbols:check"
                                                    className="sort-option-check"
                                                />

                                            )}

                                        </button>

                                        <button
                                            type="button"
                                            className={
                                                sortOption === "status"
                                                    ? "selected"
                                                    : ""
                                            }
                                            onClick={() => {

                                                setSortOption(
                                                    "status"
                                                );

                                                setShowSortMenu(false);

                                            }}
                                        >

                                            <div className="sort-option-icon">

                                                <Icon
                                                    icon="solar:filter-outline"
                                                />

                                            </div>

                                            <div className="sort-option-content">

                                                <strong>
                                                    Por status
                                                </strong>

                                                <span>
                                                    Pendentes → concluídas → canceladas
                                                </span>

                                            </div>

                                            {sortOption === "status" && (

                                                <Icon
                                                    icon="material-symbols:check"
                                                    className="sort-option-check"
                                                />

                                            )}

                                        </button>

                                    </div>

                                </div>

                            </>

                        )}

                    </div>

                </div>

                <div className="reservations-loading">

                    <div className="reservation-skeleton" />

                    <div className="reservation-skeleton" />

                </div>

            </div>
        );

    }

    // ==========================================
    // TELA
    // ==========================================

    return (

        <div className="reservations-page">

            <div className="reservations-header">

                <div>

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
                        className={`reservations-sort-button ${showSortMenu ? "active" : ""
                            }`}
                        onClick={() => setShowSortMenu(prev => !prev)}
                        aria-label="Ordenar reservas"
                        aria-expanded={showSortMenu}
                    >

                        <Icon
                            icon="solar:sort-vertical-outline"
                        />

                    </button>

                    {showSortMenu && (

                        <>

                            <div
                                className="reservations-sort-backdrop"
                                onClick={() => setShowSortMenu(false)}
                            />

                            <div className="reservations-sort-menu">

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
                                        onClick={() => setShowSortMenu(false)}
                                        aria-label="Fechar"
                                    >
                                        <Icon icon="mdi:close" />
                                    </button>

                                </div>

                                <div className="reservations-sort-options">

                                    <button
                                        type="button"
                                        className={
                                            sortOption === "priority"
                                                ? "selected"
                                                : ""
                                        }
                                        onClick={() => {
                                            setSortOption("priority");
                                            setShowSortMenu(false);
                                        }}
                                    >

                                        <div className="sort-option-icon">
                                            <Icon icon="solar:sort-by-time-outline" />
                                        </div>

                                        <div className="sort-option-content">

                                            <strong>
                                                Prioridade
                                            </strong>

                                            <span>
                                                Pendentes, concluídas e canceladas
                                            </span>

                                        </div>

                                        {sortOption === "priority" && (
                                            <Icon
                                                icon="material-symbols:check"
                                                className="sort-option-check"
                                            />
                                        )}

                                    </button>

                                    <button
                                        type="button"
                                        className={
                                            sortOption === "nearest"
                                                ? "selected"
                                                : ""
                                        }
                                        onClick={() => {
                                            setSortOption("nearest");
                                            setShowSortMenu(false);
                                        }}
                                    >

                                        <div className="sort-option-icon">
                                            <Icon icon="solar:calendar-search-outline" />
                                        </div>

                                        <div className="sort-option-content">

                                            <strong>
                                                Mais próximas
                                            </strong>

                                            <span>
                                                Primeiro o próximo agendamento
                                            </span>

                                        </div>

                                        {sortOption === "nearest" && (
                                            <Icon
                                                icon="material-symbols:check"
                                                className="sort-option-check"
                                            />
                                        )}

                                    </button>

                                    <button
                                        type="button"
                                        className={
                                            sortOption === "furthest"
                                                ? "selected"
                                                : ""
                                        }
                                        onClick={() => {
                                            setSortOption("furthest");
                                            setShowSortMenu(false);
                                        }}
                                    >

                                        <div className="sort-option-icon">
                                            <Icon icon="solar:calendar-add-outline" />
                                        </div>

                                        <div className="sort-option-content">

                                            <strong>
                                                Mais distantes
                                            </strong>

                                            <span>
                                                Primeiro o agendamento mais distante
                                            </span>

                                        </div>

                                        {sortOption === "furthest" && (
                                            <Icon
                                                icon="material-symbols:check"
                                                className="sort-option-check"
                                            />
                                        )}

                                    </button>

                                    <button
                                        type="button"
                                        className={
                                            sortOption === "status"
                                                ? "selected"
                                                : ""
                                        }
                                        onClick={() => {
                                            setSortOption("status");
                                            setShowSortMenu(false);
                                        }}
                                    >

                                        <div className="sort-option-icon">
                                            <Icon icon="solar:filter-outline" />
                                        </div>

                                        <div className="sort-option-content">

                                            <strong>
                                                Por status
                                            </strong>

                                            <span>
                                                Pendentes → concluídas → canceladas
                                            </span>

                                        </div>

                                        {sortOption === "status" && (
                                            <Icon
                                                icon="material-symbols:check"
                                                className="sort-option-check"
                                            />
                                        )}

                                    </button>

                                </div>

                            </div>

                        </>

                    )}

                </div>

            </div>

            {reservations.length === 0 ? (

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

                <div className="reservations-list">

                    {getSortedReservations().map(
                        (reservation) => {

                            const status =
                                getReservationStatus(
                                    reservation.status
                                );

                            return (

                                <div
                                    className="reservation-card"
                                    key={reservation.id}
                                >

                                    <div className="reservation-card-top">

                                        <div className="reservation-date">

                                            <span>
                                                {reservation.day}
                                            </span>

                                            <strong>
                                                {reservation.hour}
                                            </strong>

                                        </div>

                                        <span
                                            className={`reservation-status ${status.className}`}
                                        >
                                            {status.label}
                                        </span>

                                    </div>

                                    <div className="reservation-info">

                                        <h2>
                                            {
                                                reservation.productName
                                            }
                                        </h2>

                                        <div className="reservation-info-row">

                                            <Icon
                                                icon="solar:user-outline"
                                            />

                                            <span>
                                                {
                                                    reservation.professionalName ||
                                                    "Profissional"
                                                }
                                            </span>

                                        </div>

                                        <div className="reservation-info-row">

                                            <Icon
                                                icon="solar:user-circle-outline"
                                            />

                                            <span>
                                                {
                                                    reservation.userName ||
                                                    "Cliente"
                                                }
                                            </span>

                                        </div>

                                    </div>

                                    <div className="reservation-card-footer">

                                        <span>
                                            {
                                                reservation.productPrice
                                            }
                                        </span>

                                        {reservation.status ===
                                            "pending" && (

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

                                                    Cancelar

                                                </button>

                                            )}

                                    </div>

                                </div>

                            );

                        }
                    )}

                </div>

            )}

            {/* ==========================================
                MODAL / SLIDE UP DE CANCELAMENTO
            ========================================== */}

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

                            {cancelError && (

                                <div className="reservation-cancel-error">

                                    <Icon
                                        icon="solar:danger-triangle-outline"
                                    />

                                    <span>
                                        {cancelError}
                                    </span>

                                </div>

                            )}

                            {!cancelError && (

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