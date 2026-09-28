import React, {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import { Icon } from "@iconify/react";

import {
    getDatabase,
    ref,
    get,
    update
} from "firebase/database";

import { useNavigate, useParams } from "react-router-dom";

import { getAuth, onAuthStateChanged } from "firebase/auth";

import Modal from "../../../../components/modal/Modal";

import { getClientId } from "../../../../utils/clientID";

import {
    getSubscriptionSummary,
    isSubscriptionUsable,
    watchCompanySubscriptions
} from "../../../../utils/subscriptionRuntime";

import "./reservations.css";


const Reservations = () => {

    const { handle } = useParams();

    /*
     * Quem está logado.
     *
     * Precisa ser estado, e vir do listener: `auth.currentUser`
     * é null enquanto a sessão está sendo restaurada do disco,
     * e as reservas carregam antes disso. Sem reagir ao
     * listener, entrar na conta não trazia os agendamentos
     * feitos em outro aparelho até recarregar a página.
     */
    const navigate = useNavigate();

    const [accountUid, setAccountUid] = useState(null);

    /* =====================================================
       ASSINATURAS

       Uma mensalidade não é uma reserva: ela não tem dia nem
       hora, tem ciclo, saldo e uma cobrança que volta. Por
       isso aparece acima da lista, com o que só ela precisa
       responder — quanto sobrou, quando cobra de novo, como
       sair.
    ===================================================== */

    const [subscriptions, setSubscriptions] = useState([]);

    const [cancelTarget, setCancelTarget] = useState(null);
    const [cancellingSub, setCancellingSub] = useState(false);


    useEffect(() => {

        if (!handle || !accountUid) {
            setSubscriptions([]);
            return undefined;
        }

        const unsubscribe = watchCompanySubscriptions(
            handle,
            (todas) =>
                setSubscriptions(
                    todas.filter(
                        item =>
                            item.uid === accountUid &&
                            isSubscriptionUsable(item)
                    )
                )
        );

        return () => unsubscribe();

    }, [handle, accountUid]);


    const cancelarAssinatura = async () => {

        if (!cancelTarget) return;

        setCancellingSub(true);

        try {

            const token =
                await getAuth().currentUser?.getIdToken();

            const resposta = await fetch(
                "https://us-central1-markfy-96942.cloudfunctions.net/cancelMercadoPagoSubscription",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        companyHandle: handle,
                        subscriptionId: cancelTarget.id
                    })
                }
            );

            const dados = await resposta.json().catch(() => ({}));

            if (!resposta.ok || !dados.success) {
                throw new Error(
                    dados.message ||
                    "Não foi possível cancelar a assinatura."
                );
            }

            setCancelTarget(null);

            showToast(
                "Assinatura cancelada. Não haverá novas cobranças.",
                "success"
            );

        } catch (error) {

            console.error("Erro ao cancelar assinatura:", error);

            showToast(
                error.message ||
                "Não foi possível cancelar a assinatura.",
                "error"
            );

        } finally {

            setCancellingSub(false);

        }

    };

    useEffect(() => {

        return onAuthStateChanged(
            getAuth(),
            (currentUser) =>
                setAccountUid(currentUser?.uid || null)
        );

    }, []);

    /* =====================================================
       ESTADOS PRINCIPAIS
    ===================================================== */

    const [reservations, setReservations] = useState([]);

    const [loading, setLoading] = useState(true);

    const [refreshing, setRefreshing] = useState(false);

    const [searchTerm, setSearchTerm] = useState("");

    const [statusFilter, setStatusFilter] = useState("all");

    const [sortOption, setSortOption] = useState("priority");

    const [showSortMenu, setShowSortMenu] = useState(false);

    /* =====================================================
       MODAL CANCELAMENTO
    ===================================================== */

    const [selectedReservation, setSelectedReservation] =
        useState(null);

    const [showCancelModal, setShowCancelModal] =
        useState(false);

    const [cancelling, setCancelling] =
        useState(false);

    const [cancelError, setCancelError] =
        useState("");

    /* =====================================================
       FEEDBACK
    ===================================================== */

    const [toast, setToast] = useState(null);


    /* =====================================================
       TOAST
    ===================================================== */

    const showToast = useCallback(
        (message, type = "success") => {

            setToast({
                message,
                type
            });

        },
        []
    );


    useEffect(() => {

        if (!toast) {
            return undefined;
        }

        const timer = setTimeout(() => {

            setToast(null);

        }, 2800);

        return () => clearTimeout(timer);

    }, [toast]);


    /* =====================================================
       CARREGAR RESERVAS
    ===================================================== */

    const loadReservations = useCallback(
        async (options = {}) => {

            const {
                showRefresh = false
            } = options;

            if (showRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            try {

                const clientId = getClientId();

                const db = getDatabase();

                if (!handle) {

                    setReservations([]);

                    return;
                }

                const schedulesRef = ref(
                    db,
                    `companys/${handle}/schedules`
                );

                const snapshot =
                    await get(schedulesRef);

                if (!snapshot.exists()) {

                    setReservations([]);

                    return;
                }

                const schedules =
                    snapshot.val();

                const firebaseReservations =
                    Object.entries(schedules)
                        .map(
                            ([id, reservation]) => ({
                                id,
                                ...reservation
                            })
                        )
                        /*
                         * Meus agendamentos = os desta conta
                         * OU os deste aparelho.
                         *
                         * Só o clientId não bastava: ele
                         * identifica o navegador, então quem
                         * agendava logado e abria o app no
                         * celular não via nada. E o `userId`,
                         * que o agendamento já gravava, não
                         * era lido por ninguém.
                         *
                         * Os dois juntos cobrem os três casos:
                         * agendou sem conta e continua sem
                         * conta (clientId), agendou logado
                         * (userId), e agendou sem conta neste
                         * aparelho e criou a conta depois —
                         * esse continua enxergando o histórico
                         * antigo enquanto usar o mesmo
                         * navegador.
                         */
                        .filter(
                            (reservation) =>
                                (
                                    accountUid &&
                                    reservation.userId === accountUid
                                ) ||
                                (
                                    clientId &&
                                    reservation.clientId === clientId
                                )
                        );

                setReservations(
                    firebaseReservations
                );

            } catch (error) {

                console.error(
                    "Erro ao carregar reservas:",
                    error
                );

                setReservations([]);

                showToast(
                    "Não foi possível carregar suas reservas.",
                    "error"
                );

            } finally {

                setLoading(false);
                setRefreshing(false);

            }

        },
        [
            handle,
            accountUid,
            showToast
        ]
    );


    useEffect(() => {

        loadReservations();

    }, [loadReservations]);


    /* =====================================================
       ESC
    ===================================================== */

    useEffect(() => {

        const handleKeyDown = (event) => {

            if (event.key !== "Escape") {
                return;
            }

            if (showSortMenu) {
                setShowSortMenu(false);
            }

            if (
                showCancelModal &&
                !cancelling
            ) {
                closeCancelModal();
            }

        };

        document.addEventListener(
            "keydown",
            handleKeyDown
        );

        return () => {

            document.removeEventListener(
                "keydown",
                handleKeyDown
            );

        };

    }, [
        showSortMenu,
        showCancelModal,
        cancelling
    ]);


    /* =====================================================
       BLOQUEAR SCROLL QUANDO MODAL ESTÁ ABERTO
    ===================================================== */

    useEffect(() => {

        const shouldLock =
            showCancelModal ||
            showSortMenu;

        if (!shouldLock) {
            return undefined;
        }

        const originalOverflow =
            document.body.style.overflow;

        document.body.style.overflow =
            "hidden";

        return () => {

            document.body.style.overflow =
                originalOverflow;

        };

    }, [
        showCancelModal,
        showSortMenu
    ]);


    /* =====================================================
       STATUS
    ===================================================== */

    const getReservationStatus = useCallback(
        (status) => {

            switch (status) {

                case "pending":

                    return {
                        label: "Pendente",
                        className: "pending",
                        icon:
                            "solar:clock-circle-outline"
                    };

                case "completed":

                    return {
                        label: "Concluído",
                        className: "completed",
                        icon:
                            "solar:check-circle-outline"
                    };

                case "cancelados":

                    return {
                        label: "Cancelado",
                        className: "cancelled",
                        icon:
                            "solar:close-circle-outline"
                    };

                default:

                    return {
                        label:
                            status ||
                            "Desconhecido",
                        className: "unknown",
                        icon:
                            "solar:question-circle-outline"
                    };

            }

        },
        []
    );


    /* =====================================================
       DATA DA RESERVA
    ===================================================== */

    const getReservationDate = useCallback(
        (reservation) => {

            if (!reservation) {
                return null;
            }

            if (
                reservation.day &&
                reservation.hour
            ) {

                try {

                    const parts =
                        String(
                            reservation.day
                        )
                            .split("/")
                            .map(Number);

                    const day =
                        parts[0];

                    const month =
                        parts[1];

                    const year =
                        parts[2];

                    const timeParts =
                        String(
                            reservation.hour
                        )
                            .split(":")
                            .map(Number);

                    const hours =
                        timeParts[0] ?? 0;

                    const minutes =
                        timeParts[1] ?? 0;

                    if (
                        !day ||
                        !month ||
                        !year
                    ) {
                        return null;
                    }

                    const date =
                        new Date(
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

                }

            }

            if (reservation.date) {

                const fallbackDate =
                    new Date(
                        reservation.date
                    );

                if (
                    !Number.isNaN(
                        fallbackDate.getTime()
                    )
                ) {
                    return fallbackDate;
                }

            }

            return null;

        },
        []
    );


    /* =====================================================
       TIMESTAMP
    ===================================================== */

    const getReservationTimestamp =
        useCallback(
            (reservation) => {

                const date =
                    getReservationDate(
                        reservation
                    );

                if (!date) {
                    return Number.MAX_SAFE_INTEGER;
                }

                return date.getTime();

            },
            [getReservationDate]
        );


    /* =====================================================
       PRIORIDADE DOS STATUS
    ===================================================== */

    const getStatusPriority = useCallback(
        (status) => {

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

        },
        []
    );


    /* =====================================================
       DATA FORMATADA
    ===================================================== */

    const formatDateLong =
        useCallback(
            (reservation) => {

                const date =
                    getReservationDate(
                        reservation
                    );

                if (!date) {
                    return reservation?.day || "—";
                }

                return new Intl.DateTimeFormat(
                    "pt-BR",
                    {
                        weekday: "short",
                        day: "2-digit",
                        month: "short"
                    }
                )
                    .format(date)
                    .replace(".", "");

            },
            [getReservationDate]
        );


    /* =====================================================
       DATA COMPLETA
    ===================================================== */

    const formatDateComplete =
        useCallback(
            (reservation) => {

                const date =
                    getReservationDate(
                        reservation
                    );

                if (!date) {
                    return reservation?.day || "—";
                }

                return new Intl.DateTimeFormat(
                    "pt-BR",
                    {
                        weekday: "long",
                        day: "2-digit",
                        month: "long",
                        year: "numeric"
                    }
                ).format(date);

            },
            [getReservationDate]
        );


    /* =====================================================
       PREÇO
    ===================================================== */

    const formatPrice = useCallback(
        (value) => {

            if (
                value === undefined ||
                value === null ||
                value === ""
            ) {
                return "—";
            }

            if (
                typeof value === "number"
            ) {

                return value.toLocaleString(
                    "pt-BR",
                    {
                        style: "currency",
                        currency: "BRL"
                    }
                );

            }

            const original =
                String(value).trim();

            if (
                original.includes("R$")
            ) {
                return original;
            }

            const normalized =
                original
                    .replace(/\s/g, "")
                    .replace(/\./g, "")
                    .replace(",", ".");

            const parsed =
                Number(normalized);

            if (
                !Number.isNaN(parsed)
            ) {

                return parsed.toLocaleString(
                    "pt-BR",
                    {
                        style: "currency",
                        currency: "BRL"
                    }
                );

            }

            return original;

        },
        []
    );


    /* =====================================================
       HOJE
    ===================================================== */

    const isToday = useCallback(
        (reservation) => {

            const date =
                getReservationDate(
                    reservation
                );

            if (!date) {
                return false;
            }

            const today =
                new Date();

            return (
                date.getDate() ===
                today.getDate() &&
                date.getMonth() ===
                today.getMonth() &&
                date.getFullYear() ===
                today.getFullYear()
            );

        },
        [getReservationDate]
    );


    /* =====================================================
       RESERVA NO FUTURO
    ===================================================== */

    const isUpcoming =
        useCallback(
            (reservation) => {

                const date =
                    getReservationDate(
                        reservation
                    );

                return Boolean(
                    date &&
                    date.getTime() >
                    Date.now() &&
                    reservation.status ===
                    "pending"
                );

            },
            [getReservationDate]
        );


    /* =====================================================
       BUSCA
    ===================================================== */

    const normalizeSearch =
        useCallback(
            (value) => {

                return String(
                    value ?? ""
                )
                    .normalize("NFD")
                    .replace(
                        /[\u0300-\u036f]/g,
                        ""
                    )
                    .toLowerCase()
                    .trim();

            },
            []
        );


    const matchesSearch =
        useCallback(
            (
                reservation,
                query
            ) => {

                if (!query) {
                    return true;
                }

                const values = [
                    reservation.productName,
                    reservation.userName,
                    reservation.professionalName,
                    reservation.day,
                    reservation.hour,
                    reservation.status
                ];

                const normalized =
                    normalizeSearch(
                        query
                    );

                return values.some(
                    (value) =>
                        normalizeSearch(
                            value
                        ).includes(
                            normalized
                        )
                );

            },
            [normalizeSearch]
        );


    /* =====================================================
       FILTROS + ORDENAÇÃO
    ===================================================== */

    const filteredReservations =
        useMemo(() => {

            const filtered =
                reservations.filter(
                    (reservation) => {

                        const statusMatches =
                            statusFilter ===
                            "all" ||
                            reservation.status ===
                            statusFilter;

                        const searchMatches =
                            matchesSearch(
                                reservation,
                                searchTerm
                            );

                        return (
                            statusMatches &&
                            searchMatches
                        );

                    }
                );

            switch (sortOption) {

                case "nearest":

                    return filtered.sort(
                        (a, b) =>
                            getReservationTimestamp(
                                a
                            ) -
                            getReservationTimestamp(
                                b
                            )
                    );

                case "furthest":

                    return filtered.sort(
                        (a, b) =>
                            getReservationTimestamp(
                                b
                            ) -
                            getReservationTimestamp(
                                a
                            )
                    );

                case "status":

                    return filtered.sort(
                        (a, b) => {

                            const statusA =
                                getStatusPriority(
                                    a.status
                                );

                            const statusB =
                                getStatusPriority(
                                    b.status
                                );

                            if (
                                statusA !==
                                statusB
                            ) {
                                return (
                                    statusA -
                                    statusB
                                );
                            }

                            return (
                                getReservationTimestamp(
                                    a
                                ) -
                                getReservationTimestamp(
                                    b
                                )
                            );

                        }
                    );

                case "priority":
                default:

                    return filtered.sort(
                        (a, b) => {

                            const statusA =
                                getStatusPriority(
                                    a.status
                                );

                            const statusB =
                                getStatusPriority(
                                    b.status
                                );

                            if (
                                statusA !==
                                statusB
                            ) {
                                return (
                                    statusA -
                                    statusB
                                );
                            }

                            return (
                                getReservationTimestamp(
                                    a
                                ) -
                                getReservationTimestamp(
                                    b
                                )
                            );

                        }
                    );

            }

        }, [
            reservations,
            statusFilter,
            searchTerm,
            sortOption,
            matchesSearch,
            getReservationTimestamp,
            getStatusPriority
        ]);


    /* =====================================================
       ESTATÍSTICAS
    ===================================================== */

    const reservationStats =
        useMemo(() => {

            const total =
                reservations.length;

            const pending =
                reservations.filter(
                    (item) =>
                        item.status ===
                        "pending"
                ).length;

            const completed =
                reservations.filter(
                    (item) =>
                        item.status ===
                        "completed"
                ).length;

            const cancelled =
                reservations.filter(
                    (item) =>
                        item.status ===
                        "cancelados"
                ).length;

            return {
                total,
                pending,
                completed,
                cancelled
            };

        }, [reservations]);


    /* =====================================================
       PRÓXIMA RESERVA
    ===================================================== */

    const nextReservation =
        useMemo(() => {

            const upcoming =
                reservations
                    .filter(
                        (reservation) =>
                            isUpcoming(
                                reservation
                            )
                    )
                    .sort(
                        (a, b) =>
                            getReservationTimestamp(
                                a
                            ) -
                            getReservationTimestamp(
                                b
                            )
                    );

            return upcoming[0] || null;

        }, [
            reservations,
            isUpcoming,
            getReservationTimestamp
        ]);


    const nextReservationId =
        nextReservation?.id || null;


    /* =====================================================
       LIMPAR FILTROS
    ===================================================== */

    const clearFilters = () => {

        setSearchTerm("");

        setStatusFilter("all");

    };


    /* =====================================================
       ANTECEDÊNCIA
    ===================================================== */

    const getAdvanceInMilliseconds =
        useCallback(
            (advance) => {

                if (!advance) {
                    return 0;
                }

                const days =
                    Number(
                        advance.days
                    ) || 0;

                const hours =
                    Number(
                        advance.hours
                    ) || 0;

                const minutes =
                    Number(
                        advance.minutes
                    ) || 0;

                return (
                    days *
                    24 *
                    60 *
                    60 *
                    1000 +
                    hours *
                    60 *
                    60 *
                    1000 +
                    minutes *
                    60 *
                    1000
                );

            },
            []
        );


    /* =====================================================
       FORMATAR ANTECEDÊNCIA
    ===================================================== */

    const formatAdvance =
        useCallback(
            (advance) => {

                if (!advance) {
                    return "sem antecedência";
                }

                const days =
                    Number(
                        advance.days
                    ) || 0;

                const hours =
                    Number(
                        advance.hours
                    ) || 0;

                const minutes =
                    Number(
                        advance.minutes
                    ) || 0;

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

                return parts.length
                    ? parts.join(" e ")
                    : "sem antecedência";

            },
            []
        );


    /* =====================================================
       ABRIR MODAL
    ===================================================== */

    const openCancelModal = (
        reservation
    ) => {

        if (
            reservation.status !==
            "pending"
        ) {
            return;
        }

        setSelectedReservation(
            reservation
        );

        setCancelError("");

        setShowCancelModal(true);

    };


    /* =====================================================
       FECHAR MODAL
    ===================================================== */

    const closeCancelModal = () => {

        if (cancelling) {
            return;
        }

        setShowCancelModal(false);

        setSelectedReservation(
            null
        );

        setCancelError("");

    };


    /* =====================================================
       CANCELAR RESERVA
    ===================================================== */

    const handleCancelReservation =
        async () => {

            if (!selectedReservation) {
                return;
            }

            if (
                selectedReservation.status !==
                "pending"
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

                const db =
                    getDatabase();

                const reservation =
                    selectedReservation;

                const reservationRef =
                    ref(
                        db,
                        `companys/${handle}/schedules/${reservation.id}`
                    );

                const reservationSnapshot =
                    await get(
                        reservationRef
                    );

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
                    currentReservation.status !==
                    "pending"
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

                if (
                    !reservationDate
                ) {

                    throw new Error(
                        "Não foi possível identificar a data e hora da reserva."
                    );

                }

                let cancellationAdvance =
                    null;

                if (
                    currentReservation.productId
                ) {

                    const productRef =
                        ref(
                            db,
                            `companys/${handle}/products/${currentReservation.productId}`
                        );

                    const productSnapshot =
                        await get(
                            productRef
                        );

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

                const now =
                    Date.now();

                const reservationTime =
                    reservationDate.getTime();

                const minimumCancelTime =
                    reservationTime -
                    advanceMs;

                if (
                    now >
                    minimumCancelTime
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

                setReservations(
                    (prev) =>
                        prev.map(
                            (item) =>
                                item.id ===
                                    reservation.id
                                    ? {
                                        ...item,
                                        status:
                                            "cancelados",
                                        cancelledAt,
                                        cancelledBy:
                                            "client"
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
                            JSON.parse(
                                localData
                            );

                        if (
                            localReservation?.timestamp ===
                            currentReservation.timestamp
                        ) {

                            localStorage.setItem(
                                "markfy-last-agendamento",
                                JSON.stringify({
                                    ...localReservation,
                                    status:
                                        "cancelados",
                                    cancelledAt,
                                    cancelledBy:
                                        "client"
                                })
                            );

                        }

                    } catch {

                        /* Ignora erro do localStorage */

                    }

                }

                setShowCancelModal(false);

                setSelectedReservation(
                    null
                );

                setCancelError("");

                showToast(
                    "Reserva cancelada com sucesso.",
                    "success"
                );

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
       GOOGLE CALENDAR
    ===================================================== */

    const addToCalendar = (
        reservation
    ) => {

        const date =
            getReservationDate(
                reservation
            );

        if (!date) {

            showToast(
                "Não foi possível criar o evento.",
                "error"
            );

            return;
        }

        let durationMinutes = 60;

        if (
            reservation.duration
        ) {

            const numericDuration =
                Number(
                    reservation.duration
                );

            if (
                !Number.isNaN(
                    numericDuration
                ) &&
                numericDuration > 0
            ) {

                durationMinutes =
                    numericDuration;

            }

        }

        const endDate =
            new Date(
                date.getTime() +
                durationMinutes *
                60 *
                1000
            );

        const formatGoogleDate =
            (value) =>
                value
                    .toISOString()
                    .replace(/[-:]/g, "")
                    .replace(/\.\d{3}/, "");

        const start =
            formatGoogleDate(
                date
            );

        const end =
            formatGoogleDate(
                endDate
            );

        const title =
            reservation.productName ||
            "Agendamento";

        const professional =
            reservation.professionalName
                ? `Profissional: ${reservation.professionalName}`
                : "";

        const details =
            [
                "Agendamento pelo Markfy",
                professional
            ]
                .filter(Boolean)
                .join("\n");

        const url =
            new URL(
                "https://calendar.google.com/calendar/render"
            );

        url.searchParams.set(
            "action",
            "TEMPLATE"
        );

        url.searchParams.set(
            "text",
            title
        );

        url.searchParams.set(
            "dates",
            `${start}/${end}`
        );

        url.searchParams.set(
            "details",
            details
        );

        window.open(
            url.toString(),
            "_blank",
            "noopener,noreferrer"
        );

    };


    /* =====================================================
       COPIAR DETALHES
    ===================================================== */

    const copyReservationDetails =
        async (reservation) => {

            const details =
                [
                    `Serviço: ${reservation.productName ||
                    "Serviço"
                    }`,
                    `Data: ${formatDateComplete(
                        reservation
                    )
                    }`,
                    `Horário: ${reservation.hour ||
                    "—"
                    }`,
                    `Profissional: ${reservation.professionalName ||
                    "Profissional"
                    }`,
                    `Valor: ${formatPrice(
                        reservation.productPrice
                    )
                    }`
                ].join("\n");

            try {

                await navigator.clipboard.writeText(
                    details
                );

                showToast(
                    "Detalhes copiados.",
                    "success"
                );

            } catch (error) {

                console.error(
                    "Erro ao copiar:",
                    error
                );

                showToast(
                    "Não foi possível copiar os detalhes.",
                    "error"
                );

            }

        };


    /* =====================================================
       LABEL DO SORT
    ===================================================== */

    const sortLabel = useMemo(() => {

        switch (sortOption) {

            case "nearest":
                return "Mais próximas";

            case "furthest":
                return "Mais distantes";

            case "status":
                return "Por status";

            case "priority":
            default:
                return "Prioridade";

        }

    }, [sortOption]);


    /* =====================================================
       OPÇÕES DO SORT
    ===================================================== */

    const sortOptions = [
        {
            id: "priority",
            icon:
                "solar:sort-by-time-outline",
            title: "Prioridade",
            description:
                "Pendentes, concluídas e canceladas"
        },
        {
            id: "nearest",
            icon:
                "solar:calendar-search-outline",
            title: "Mais próximas",
            description:
                "Primeiro os próximos horários"
        },
        {
            id: "furthest",
            icon:
                "solar:calendar-add-outline",
            title: "Mais distantes",
            description:
                "Primeiro os agendamentos mais distantes"
        },
        {
            id: "status",
            icon:
                "solar:filter-outline",
            title: "Por status",
            description:
                "Agrupa pela situação da reserva"
        }
    ];


    /* =====================================================
       RENDER SORT
    ===================================================== */

    const renderSortMenu = () => {

        if (!showSortMenu) {
            return null;
        }

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
                    role="dialog"
                    aria-label="Ordenar reservas"
                    onClick={(event) =>
                        event.stopPropagation()
                    }
                >

                    <div className="reservations-sort-handle" />

                    <div className="reservations-sort-menu-header">

                        <div>

                            <span className="reservations-eyebrow">
                                Visualização
                            </span>

                            <strong>
                                Ordenar reservas
                            </strong>

                            <small>
                                {sortLabel}
                            </small>

                        </div>

                        <button
                            type="button"
                            className="reservations-sort-close"
                            onClick={() =>
                                setShowSortMenu(
                                    false
                                )
                            }
                            aria-label="Fechar"
                        >

                            <Icon
                                icon="mdi:close"
                            />

                        </button>

                    </div>


                    <div className="reservations-sort-options">

                        {sortOptions.map(
                            (option) => {

                                const selected =
                                    sortOption ===
                                    option.id;

                                return (

                                    <button
                                        key={option.id}
                                        type="button"
                                        className={`reservations-sort-option ${selected
                                                ? "selected"
                                                : ""
                                            }`}
                                        onClick={() => {

                                            setSortOption(
                                                option.id
                                            );

                                            setShowSortMenu(
                                                false
                                            );

                                        }}
                                    >

                                        <span className="sort-option-icon">

                                            <Icon
                                                icon={
                                                    option.icon
                                                }
                                            />

                                        </span>

                                        <span className="sort-option-content">

                                            <strong>
                                                {
                                                    option.title
                                                }
                                            </strong>

                                            <small>
                                                {
                                                    option.description
                                                }
                                            </small>

                                        </span>

                                        {selected && (

                                            <Icon
                                                icon="material-symbols:check-rounded"
                                                className="sort-option-check"
                                            />

                                        )}

                                    </button>

                                );

                            }
                        )}

                    </div>

                </div>
            </>
        );

    };


    /* =====================================================
       HEADER
    ===================================================== */

    const renderHeader = () => {

        return (
            <header className="reservations-header">

                <div className="reservations-header-content">

                    <span className="reservations-eyebrow">
                        Minha conta
                    </span>

                    <div className="reservations-title-row">

                        <div>

                            <h1>
                                Reservas
                            </h1>

                            <p>
                                Acompanhe seus agendamentos
                                em um só lugar.
                            </p>

                        </div>

                    </div>

                </div>

                <div className="reservations-header-actions">

                    <button
                        type="button"
                        className={`reservations-icon-button ${refreshing
                                ? "loading"
                                : ""
                            }`}
                        onClick={() =>
                            loadReservations({
                                showRefresh: true
                            })
                        }
                        disabled={refreshing}
                        aria-label="Atualizar reservas"
                        title="Atualizar reservas"
                    >

                        <Icon
                            icon="solar:refresh-outline"
                        />

                    </button>

                    <div className="reservations-sort-wrapper">

                        <button
                            type="button"
                            className={`reservations-sort-button ${showSortMenu
                                    ? "active"
                                    : ""
                                }`}
                            onClick={() =>
                                setShowSortMenu(
                                    (prev) =>
                                        !prev
                                )
                            }
                            aria-label="Ordenar reservas"
                            aria-expanded={
                                showSortMenu
                            }
                            title="Ordenar"
                        >

                            <Icon
                                icon="solar:sort-vertical-outline"
                            />

                        </button>

                        {renderSortMenu()}

                    </div>

                </div>

            </header>
        );

    };


    /* =====================================================
       RESUMO
    ===================================================== */

    const renderSummary = () => {

        return (
            <section className="reservations-summary">

                <article
                    className={`reservation-summary-card ${statusFilter === "all"
                            ? "active"
                            : ""
                        }`}
                    onClick={() =>
                        setStatusFilter("all")
                    }
                >

                    <div className="summary-card-top">

                        <span className="summary-card-icon">
                            <Icon
                                icon="solar:calendar-mark-outline"
                            />
                        </span>

                        <span className="summary-card-label">
                            Total
                        </span>

                    </div>

                    <strong>
                        {
                            reservationStats.total
                        }
                    </strong>

                    <small>
                        todas as reservas
                    </small>

                </article>


                <article
                    className={`reservation-summary-card pending ${statusFilter === "pending"
                            ? "active"
                            : ""
                        }`}
                    onClick={() =>
                        setStatusFilter(
                            "pending"
                        )
                    }
                >

                    <div className="summary-card-top">

                        <span className="summary-card-icon">
                            <Icon
                                icon="solar:clock-circle-outline"
                            />
                        </span>

                        <span className="summary-card-label">
                            Pendentes
                        </span>

                    </div>

                    <strong>
                        {
                            reservationStats.pending
                        }
                    </strong>

                    <small>
                        aguardando atendimento
                    </small>

                </article>


                <article
                    className={`reservation-summary-card completed ${statusFilter === "completed"
                            ? "active"
                            : ""
                        }`}
                    onClick={() =>
                        setStatusFilter(
                            "completed"
                        )
                    }
                >

                    <div className="summary-card-top">

                        <span className="summary-card-icon">
                            <Icon
                                icon="solar:check-circle-outline"
                            />
                        </span>

                        <span className="summary-card-label">
                            Concluídas
                        </span>

                    </div>

                    <strong>
                        {
                            reservationStats.completed
                        }
                    </strong>

                    <small>
                        atendimentos realizados
                    </small>

                </article>


                <article
                    className={`reservation-summary-card cancelled ${statusFilter === "cancelados"
                            ? "active"
                            : ""
                        }`}
                    onClick={() =>
                        setStatusFilter(
                            "cancelados"
                        )
                    }
                >

                    <div className="summary-card-top">

                        <span className="summary-card-icon">
                            <Icon
                                icon="solar:close-circle-outline"
                            />
                        </span>

                        <span className="summary-card-label">
                            Canceladas
                        </span>

                    </div>

                    <strong>
                        {
                            reservationStats.cancelled
                        }
                    </strong>

                    <small>
                        reservas canceladas
                    </small>

                </article>

            </section>
        );

    };


    /* =====================================================
       PRÓXIMA RESERVA
    ===================================================== */

    const renderNextReservation = () => {

        if (!nextReservation) {
            return null;
        }

        const status =
            getReservationStatus(
                nextReservation.status
            );

        return (
            <section className="next-reservation-card">

                <div className="next-reservation-main">

                    <div className="next-reservation-icon">

                        <Icon
                            icon="solar:calendar-date-outline"
                        />

                    </div>

                    <div className="next-reservation-content">

                        <div className="next-reservation-heading">

                            <span>
                                Próxima reserva
                            </span>

                            {isToday(
                                nextReservation
                            ) && (

                                    <strong className="today-badge">
                                        Hoje
                                    </strong>

                                )}

                        </div>

                        <h2>
                            {
                                nextReservation.productName ||
                                "Serviço"
                            }
                        </h2>

                        <p>

                            <span>
                                {
                                    formatDateComplete(
                                        nextReservation
                                    )
                                }
                            </span>

                            <span className="next-reservation-dot">
                                •
                            </span>

                            <strong>
                                {
                                    nextReservation.hour ||
                                    "—"
                                }
                            </strong>

                            <span className="next-reservation-dot">
                                •
                            </span>

                            <span>
                                {
                                    nextReservation.professionalName ||
                                    "Profissional"
                                }
                            </span>

                        </p>

                    </div>

                </div>

                <div className="next-reservation-actions">

                    <button
                        type="button"
                        onClick={() =>
                            addToCalendar(
                                nextReservation
                            )
                        }
                    >

                        <Icon
                            icon="solar:calendar-add-outline"
                        />

                        <span>
                            Adicionar ao calendário
                        </span>

                    </button>

                </div>

            </section>
        );

    };


    /* =====================================================
       FILTROS
    ===================================================== */

    const renderFilters = () => {

        const hasFilters =
            Boolean(
                searchTerm.trim()
            ) ||
            statusFilter !== "all";

        return (
            <section className="reservations-toolbar">

                <div className="reservations-search">

                    <Icon
                        icon="solar:magnifer-outline"
                    />

                    <input
                        type="search"
                        value={searchTerm}
                        onChange={(event) =>
                            setSearchTerm(
                                event.target.value
                            )
                        }
                        placeholder="Buscar por serviço, profissional ou data..."
                        aria-label="Buscar reservas"
                    />

                    {searchTerm && (

                        <button
                            type="button"
                            className="reservations-search-clear"
                            onClick={() =>
                                setSearchTerm("")
                            }
                            aria-label="Limpar busca"
                        >

                            <Icon
                                icon="mdi:close-circle"
                            />

                        </button>

                    )}

                </div>


                <div className="reservations-filter-group">

                    <button
                        type="button"
                        className={
                            statusFilter === "all"
                                ? "active"
                                : ""
                        }
                        onClick={() =>
                            setStatusFilter(
                                "all"
                            )
                        }
                    >
                        Todas
                    </button>

                    <button
                        type="button"
                        className={
                            statusFilter === "pending"
                                ? "active"
                                : ""
                        }
                        onClick={() =>
                            setStatusFilter(
                                "pending"
                            )
                        }
                    >
                        Pendentes
                    </button>

                    <button
                        type="button"
                        className={
                            statusFilter === "completed"
                                ? "active"
                                : ""
                        }
                        onClick={() =>
                            setStatusFilter(
                                "completed"
                            )
                        }
                    >
                        Concluídas
                    </button>

                    <button
                        type="button"
                        className={
                            statusFilter === "cancelados"
                                ? "active"
                                : ""
                        }
                        onClick={() =>
                            setStatusFilter(
                                "cancelados"
                            )
                        }
                    >
                        Canceladas
                    </button>

                </div>


                <div className="reservations-results-info">

                    <span>
                        {filteredReservations.length}{" "}
                        {filteredReservations.length ===
                            1
                            ? "resultado"
                            : "resultados"}
                    </span>

                    <span>
                        Ordenado por{" "}
                        <strong>
                            {sortLabel}
                        </strong>
                    </span>

                    {hasFilters && (

                        <button
                            type="button"
                            onClick={
                                clearFilters
                            }
                        >
                            Limpar filtros
                        </button>

                    )}

                </div>

            </section>
        );

    };


    /* =====================================================
       EMPTY STATE GERAL
    ===================================================== */

    const renderEmptyState =
        () => {

            return (
                <div className="reservations-empty">

                    <div className="reservations-empty-icon">

                        <Icon
                            icon="solar:calendar-outline"
                        />

                    </div>

                    <span className="reservations-empty-label">
                        Reservas
                    </span>

                    <h2>
                        Nenhuma reserva encontrada
                    </h2>

                    <p>
                        Quando você fizer um
                        agendamento, ele aparecerá
                        automaticamente aqui.
                    </p>

                </div>
            );

        };


    /* =====================================================
       EMPTY STATE DE FILTRO
    ===================================================== */

    const renderFilteredEmpty =
        () => {

            return (
                <div className="reservations-empty filtered-empty">

                    <div className="reservations-empty-icon">

                        <Icon
                            icon="solar:magnifer-outline"
                        />

                    </div>

                    <span className="reservations-empty-label">
                        Filtros
                    </span>

                    <h2>
                        Nenhum resultado
                    </h2>

                    <p>
                        Não encontramos reservas
                        com os filtros atuais.
                    </p>

                    <button
                        type="button"
                        className="reservations-clear-button"
                        onClick={
                            clearFilters
                        }
                    >
                        Limpar filtros
                    </button>

                </div>
            );

        };


    /* =====================================================
       SKELETON
    ===================================================== */

    if (loading) {

        return (
            <div className="reservations-page">

                {renderHeader()}

            {/* =====================================================
                CANCELAR ASSINATURA

                As duas travas do plano — fidelidade e aviso
                prévio — aparecem aqui, na hora da decisão. Dizer
                isso só no contrato não ajuda ninguém.
            ===================================================== */}

            <Modal
                open={!!cancelTarget}
                onClose={() => !cancellingSub && setCancelTarget(null)}
                overlayClassName="reservations-cancel-sub-overlay"
                className="reservations-cancel-sub-modal"
                label="Cancelar assinatura"
            >

                {cancelTarget && (() => {

                    const regras =
                        getSubscriptionSummary(
                            cancelTarget,
                            reservations
                        ).cancelamento;

                    return (
                        <>
                            <div className="reservations-cancel-sub-icon">
                                <Icon icon="solar:close-circle-outline" />
                            </div>

                            <h2>Cancelar esta mensalidade?</h2>

                            {regras.emFidelidade ? (

                                <p>
                                    Este plano tem fidelidade até{" "}
                                    <strong>
                                        {regras.fimDaFidelidade
                                            .toLocaleDateString("pt-BR")}
                                    </strong>
                                    . Só depois dessa data ele pode ser
                                    encerrado. Fale com a empresa se precisar
                                    de uma exceção.
                                </p>

                            ) : (

                                <>

                                <p>
                                    As cobranças param e o acesso segue até o
                                    fim do ciclo atual
                                    {regras.avisoDias > 0
                                        ? `, e o aviso prévio de ${regras.avisoDias} dias faz o encerramento valer a partir de ${regras.encerraEm.toLocaleDateString("pt-BR")}`
                                        : ""}
                                    .
                                </p>

                                {/* O que a pessoa precisa saber ANTES de
                                    confirmar, não depois de ver a fatura. */}
                                <p className="reservations-cancel-sub-warning">
                                    <strong>
                                        O valor já cobrado não será estornado.
                                    </strong>{" "}
                                    Não há devolução proporcional pelos dias
                                    restantes do ciclo.
                                </p>

                                </>

                            )}

                            <div className="reservations-cancel-sub-actions">

                                <button
                                    type="button"
                                    disabled={cancellingSub}
                                    onClick={() => setCancelTarget(null)}
                                >
                                    Manter assinatura
                                </button>

                                <button
                                    type="button"
                                    className="is-danger"
                                    disabled={cancellingSub || regras.emFidelidade}
                                    onClick={cancelarAssinatura}
                                >
                                    {cancellingSub
                                        ? "Cancelando..."
                                        : "Cancelar assinatura"}
                                </button>

                            </div>
                        </>
                    );

                })()}

            </Modal>

                <div className="reservations-skeleton-summary">

                    <div className="reservation-skeleton-block" />
                    <div className="reservation-skeleton-block" />
                    <div className="reservation-skeleton-block" />
                    <div className="reservation-skeleton-block" />

                </div>

                <div className="reservations-loading">

                    <div className="reservation-skeleton-toolbar" />

                    <div className="reservation-skeleton-card">
                        <span />
                        <span />
                        <span />
                    </div>

                    <div className="reservation-skeleton-card">
                        <span />
                        <span />
                        <span />
                    </div>

                    <div className="reservation-skeleton-card">
                        <span />
                        <span />
                        <span />
                    </div>

                </div>

            </div>
        );

    }


    /* =====================================================
       RENDER PRINCIPAL
    ===================================================== */

    return (
        <div className="reservations-page">

            {renderHeader()}

            <main className="reservations-main">

                {renderSummary()}

                {/* =====================================================
                    MINHAS MENSALIDADES
                ===================================================== */}

                {subscriptions.length > 0 && (

                    <section className="reservations-subscriptions">

                        <div className="reservations-list-header">

                            <div>
                                <span className="reservations-eyebrow">
                                    Mensalidades
                                </span>

                                <h2>Seus planos ativos</h2>
                            </div>
                        </div>

                        {subscriptions.map((assinatura) => {

                            const resumo = getSubscriptionSummary(
                                assinatura,
                                reservations
                            );

                            return (
                                <article
                                    key={assinatura.id}
                                    className="reservations-subscription"
                                >

                                    <header>

                                        <div className="reservations-subscription-icon">
                                            <Icon icon="solar:crown-star-bold" />
                                        </div>

                                        <div>
                                            <strong>
                                                {assinatura.productName || "Mensalidade"}
                                            </strong>

                                            <span>
                                                {Number(assinatura.price || 0)
                                                    .toLocaleString("pt-BR", {
                                                        style: "currency",
                                                        currency: "BRL"
                                                    })}
                                                {" · "}
                                                {resumo.ciclo.periodLabel}
                                            </span>
                                        </div>

                                        <span
                                            className={`reservations-subscription-badge ${assinatura.status === "past_due"
                                                ? "is-late"
                                                : "is-active"
                                                }`}
                                        >
                                            {assinatura.status === "past_due"
                                                ? "Pagamento pendente"
                                                : "Ativa"}
                                        </span>

                                    </header>

                                    <div className="reservations-subscription-facts">

                                        <div>
                                            <span>Neste ciclo</span>
                                            <strong>
                                                {resumo.sessoesRestantes === null
                                                    ? "Ilimitado"
                                                    : `${resumo.sessoesRestantes} de ${assinatura.sessionsPerCycle}`}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>Próxima cobrança</span>
                                            <strong>
                                                {resumo.proximaCobranca
                                                    .toLocaleDateString("pt-BR")}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>Ciclo atual até</span>
                                            <strong>
                                                {resumo.cycleEnd
                                                    .toLocaleDateString("pt-BR")}
                                            </strong>
                                        </div>

                                    </div>

                                    {assinatura.status === "past_due" && (

                                        <p className="reservations-subscription-alert">
                                            <Icon icon="solar:danger-triangle-outline" />

                                            <span>
                                                A última cobrança não passou. O Mercado
                                                Pago vai tentar de novo; se não der certo,
                                                a assinatura é encerrada.
                                            </span>
                                        </p>

                                    )}

                                    <div className="reservations-subscription-actions">

                                        {/* Marcar o próximo atendimento acontece na
                                            tela do produto: é lá que vivem a agenda do
                                            profissional e as regras de antecedência.
                                            Duplicar o seletor aqui seria manter duas
                                            versões da mesma regra. */}
                                        <button
                                            type="button"
                                            className="reservations-subscription-primary"
                                            disabled={resumo.sessoesRestantes === 0}
                                            onClick={() =>
                                                navigate(
                                                    `/central-user/${handle}?product=${assinatura.productId}`
                                                )
                                            }
                                        >
                                            <Icon icon="solar:calendar-add-outline" />

                                            {resumo.sessoesRestantes === 0
                                                ? "Sem atendimentos neste ciclo"
                                                : "Marcar próximo atendimento"}
                                        </button>

                                        <button
                                            type="button"
                                            className="reservations-subscription-cancel"
                                            onClick={() => setCancelTarget(assinatura)}
                                        >
                                            Cancelar assinatura
                                        </button>

                                    </div>

                                </article>
                            );

                        })}

                    </section>

                )}

                {renderNextReservation()}

                {renderFilters()}


                {reservations.length === 0 ? (

                    renderEmptyState()

                ) : filteredReservations.length === 0 ? (

                    renderFilteredEmpty()

                ) : (

                    <section className="reservations-container">

                        <div className="reservations-list-header">

                            <div>

                                <span className="reservations-eyebrow">
                                    Histórico
                                </span>

                                <h2>
                                    Seus agendamentos
                                </h2>

                            </div>

                            <span className="reservations-list-count">
                                {filteredReservations.length}{" "}
                                reservas
                            </span>

                        </div>


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
                                Ações
                            </span>

                        </div>


                        <div className="reservations-list">

                            {filteredReservations.map(
                                (reservation) => {

                                    const status =
                                        getReservationStatus(
                                            reservation.status
                                        );

                                    const isNext =
                                        reservation.id ===
                                        nextReservationId;

                                    return (

                                        <article
                                            key={
                                                reservation.id
                                            }
                                            className={`reservation-card ${isNext
                                                    ? "is-next"
                                                    : ""
                                                } ${reservation.status ===
                                                    "cancelados"
                                                    ? "is-cancelled"
                                                    : ""
                                                }`}
                                        >

                                            {isNext && (

                                                <span className="reservation-next-line">
                                                    Próxima
                                                </span>

                                            )}


                                            {/* =========================================
                                               DATA
                                            ========================================= */}

                                            <div className="reservation-date">

                                                <div className="reservation-date-icon">

                                                    <Icon
                                                        icon="solar:calendar-outline"
                                                    />

                                                </div>

                                                <div className="reservation-date-content">

                                                    <div className="reservation-date-top">

                                                        <strong>
                                                            {
                                                                formatDateLong(
                                                                    reservation
                                                                )
                                                            }
                                                        </strong>

                                                        {isToday(
                                                            reservation
                                                        ) && (

                                                                <span className="reservation-today-badge">
                                                                    Hoje
                                                                </span>

                                                            )}

                                                    </div>

                                                    <span className="reservation-time">

                                                        <Icon
                                                            icon="solar:clock-circle-outline"
                                                        />

                                                        {
                                                            reservation.hour ||
                                                            "—"
                                                        }

                                                    </span>

                                                </div>

                                            </div>


                                            {/* =========================================
                                               SERVIÇO
                                            ========================================= */}

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


                                            {/* =========================================
                                               PROFISSIONAL
                                            ========================================= */}

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


                                            {/* =========================================
                                               STATUS
                                            ========================================= */}

                                            <div className="reservation-status-wrapper">

                                                <span className="reservation-mobile-label">
                                                    Status
                                                </span>

                                                <span
                                                    className={`reservation-status ${status.className}`}
                                                >

                                                    <Icon
                                                        icon={
                                                            status.icon
                                                        }
                                                    />

                                                    <span>
                                                        {
                                                            status.label
                                                        }
                                                    </span>

                                                </span>

                                            </div>


                                            {/* =========================================
                                               VALOR
                                            ========================================= */}

                                            <div className="reservation-price">

                                                <span className="reservation-mobile-label">
                                                    Valor
                                                </span>

                                                <strong>
                                                    {
                                                        formatPrice(
                                                            reservation.productPrice
                                                        )
                                                    }
                                                </strong>

                                            </div>


                                            {/* =========================================
                                               AÇÕES
                                            ========================================= */}

                                            <div className="reservation-actions">

                                                <button
                                                    type="button"
                                                    className="reservation-action-button"
                                                    onClick={() =>
                                                        addToCalendar(
                                                            reservation
                                                        )
                                                    }
                                                    title="Adicionar ao calendário"
                                                    aria-label="Adicionar ao calendário"
                                                >

                                                    <Icon
                                                        icon="solar:calendar-add-outline"
                                                    />

                                                </button>


                                                <button
                                                    type="button"
                                                    className="reservation-action-button"
                                                    onClick={() =>
                                                        copyReservationDetails(
                                                            reservation
                                                        )
                                                    }
                                                    title="Copiar detalhes"
                                                    aria-label="Copiar detalhes"
                                                >

                                                    <Icon
                                                        icon="solar:copy-outline"
                                                    />

                                                </button>


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

                    </section>

                )}

            </main>


            {/* =============================================
               MODAL CANCELAMENTO
            ============================================= */}

            {showCancelModal &&
                selectedReservation && (

                    <div
                        className="reservation-cancel-overlay"
                        onClick={
                            closeCancelModal
                        }
                    >

                        <div
                            className="reservation-cancel-modal"
                            onClick={(event) =>
                                event.stopPropagation()
                            }
                        >

                            <div className="reservation-cancel-handle" />

                            <div className="reservation-cancel-icon">

                                <Icon
                                    icon="solar:calendar-remove-outline"
                                />

                            </div>


                            <span className="reservation-modal-eyebrow">
                                Cancelamento
                            </span>

                            <h2>
                                Cancelar reserva?
                            </h2>

                            <p>

                                Você está cancelando a
                                reserva de{" "}

                                <strong>
                                    {
                                        selectedReservation.productName ||
                                        "Serviço"
                                    }
                                </strong>

                                .

                            </p>


                            <div className="reservation-cancel-summary">

                                <div>

                                    <span>
                                        Data
                                    </span>

                                    <strong>
                                        {
                                            formatDateLong(
                                                selectedReservation
                                            )
                                        }
                                    </strong>

                                </div>

                                <div>

                                    <span>
                                        Horário
                                    </span>

                                    <strong>
                                        {
                                            selectedReservation.hour ||
                                            "—"
                                        }
                                    </strong>

                                </div>

                            </div>


                            {cancelError ? (

                                <div className="reservation-cancel-error">

                                    <Icon
                                        icon="solar:danger-triangle-outline"
                                    />

                                    <span>
                                        {
                                            cancelError
                                        }
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
                                    disabled={
                                        cancelling
                                    }
                                >
                                    Voltar
                                </button>


                                <button
                                    type="button"
                                    className="reservation-cancel-confirm"
                                    onClick={
                                        handleCancelReservation
                                    }
                                    disabled={
                                        cancelling
                                    }
                                >

                                    {cancelling ? (

                                        <>
                                            <span className="reservation-cancel-spinner" />

                                            Cancelando...
                                        </>

                                    ) : (

                                        <>
                                            <Icon
                                                icon="solar:trash-bin-trash-outline"
                                            />

                                            Cancelar reserva
                                        </>

                                    )}

                                </button>

                            </div>

                        </div>

                    </div>

                )}


            {/* =============================================
               TOAST
            ============================================= */}

            {toast && (

                <div
                    className={`reservations-toast ${toast.type}`}
                    role="status"
                >

                    <span className="reservations-toast-icon">

                        <Icon
                            icon={
                                toast.type ===
                                    "error"
                                    ? "solar:danger-triangle-outline"
                                    : "solar:check-circle-outline"
                            }
                        />

                    </span>

                    <span>
                        {toast.message}
                    </span>

                </div>

            )}

        </div>
    );

};


export default Reservations;