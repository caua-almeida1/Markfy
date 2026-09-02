// Orders.jsx

import React, { useState, useEffect, useMemo } from "react";
import { Icon } from "@iconify/react";
import {
    getDatabase,
    ref,
    onValue,
    get,
    update,
    remove
} from "firebase/database";
import { motion, AnimatePresence } from "framer-motion";

import "./orders.css";
import placeholder from "../../../img/1.jpg";
import Toast from "../../../components/toast/Toast";

const Orders = ({ company, initialOrder }) => {

    /* =========================================================
       ESTADOS PRINCIPAIS
    ========================================================= */

    const [activeTab, setActiveTab] = useState("ativos");

    const [orders, setOrders] = useState([]);

    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState("");

    const [openOrderDetails, setOpenOrderDetails] = useState(null);

    const [orderToDelete, setOrderToDelete] = useState(null);

    const [orderToCancel, setOrderToCancel] = useState(null);


    /* =========================================================
       FILTROS
    ========================================================= */

    const [isFilterOpen, setIsFilterOpen] = useState(false);

    const [selectedPeriod, setSelectedPeriod] = useState("all");

    const [selectedProfessionals, setSelectedProfessionals] = useState([]);

    const [selectedServices, setSelectedServices] = useState([]);


    const [tempPeriod, setTempPeriod] = useState("all");

    const [tempProfessionals, setTempProfessionals] = useState([]);

    const [tempServices, setTempServices] = useState([]);


    const [professionalSearch, setProfessionalSearch] = useState("");

    const [serviceSearch, setServiceSearch] = useState("");


    /* =========================================================
       ORDENAÇÃO
    ========================================================= */

    const [isSortOpen, setIsSortOpen] = useState(false);

    const [selectedSort, setSelectedSort] = useState("dateAsc");

    const [tempSort, setTempSort] = useState("dateAsc");


    /* =========================================================
       TOAST
    ========================================================= */

    const [showToast, setShowToast] = useState(false);

    const [toastType, setToastType] = useState("success");

    const [toastTitle, setToastTitle] = useState("");

    const [toastMessage, setToastMessage] = useState("");


    const openToast = (type, title, message) => {

        setToastType(type);

        setToastTitle(title);

        setToastMessage(message);

        setShowToast(true);

    };


    /* =========================================================
       OPÇÕES
    ========================================================= */

    const periodOptions = [
        {
            id: "all",
            label: "Todos"
        },
        {
            id: "today",
            label: "Hoje"
        },
        {
            id: "tomorrow",
            label: "Amanhã"
        },
        {
            id: "week",
            label: "Esta semana"
        },
        {
            id: "next7",
            label: "Próximos 7 dias"
        },
        {
            id: "month",
            label: "Este mês"
        }
    ];


    const sortOptions = [
        {
            id: "dateAsc",
            label: "Data mais próxima"
        },
        {
            id: "dateDesc",
            label: "Data mais distante"
        },
        {
            id: "nameAsc",
            label: "Cliente (A-Z)"
        },
        {
            id: "nameDesc",
            label: "Cliente (Z-A)"
        },
        {
            id: "serviceAsc",
            label: "Serviço (A-Z)"
        },
        {
            id: "serviceDesc",
            label: "Serviço (Z-A)"
        },
        {
            id: "priceAsc",
            label: "Menor valor"
        },
        {
            id: "priceDesc",
            label: "Maior valor"
        }
    ];


    /* =========================================================
       UTILITÁRIOS
    ========================================================= */

    const parseOrderDate = (order) => {

        if (!order?.day) return null;

        const [day, month, year] =
            order.day.split("/").map(Number);

        if (!day || !month || !year) {
            return null;
        }

        return new Date(
            year,
            month - 1,
            day
        );

    };


    const parseOrderDateTime = (order) => {

        if (!order?.day) return null;

        const [day, month, year] =
            order.day.split("/").map(Number);

        const [hour, minute] =
            (order.hour || "00:00")
                .split(":")
                .map(Number);

        if (!day || !month || !year) {
            return null;
        }

        return new Date(
            year,
            month - 1,
            day,
            hour || 0,
            minute || 0
        );

    };


    const truncate = (text, max = 20) => {

        if (!text) return "—";

        return text.length > max
            ? `${text.slice(0, max)}...`
            : text;

    };


    const parsePrice = (value) => {

        if (typeof value === "number") {
            return value;
        }

        if (!value) return 0;

        return Number(
            String(value)
                .replace(/[^\d,.-]/g, "")
                .replace(/\./g, "")
                .replace(",", ".")
        ) || 0;

    };


    const formatStatus = (status) => {

        switch (status) {

            case "ativos":
            case "pending":
                return "Ativo";

            case "completos":
            case "completed":
                return "Completo";

            case "cancelados":
            case "cancelled":
            case "canceled":
                return "Cancelado";

            default:
                return "Ativo";

        }

    };


    const getStatusIcon = (status) => {

        switch (status) {

            case "completos":
                return "lucide:check-circle";

            case "cancelados":
                return "lucide:x-circle";

            default:
                return "lucide:clock-3";

        }

    };


    /* =========================================================
       CARREGAR PEDIDOS
    ========================================================= */

    useEffect(() => {

        if (!company?.handle) return;

        const db = getDatabase();

        const schedulesRef =
            ref(
                db,
                `companys/${company.handle}/schedules`
            );


        const unsubscribe = onValue(
            schedulesRef,
            async (snapshot) => {

                const data = snapshot.val();


                if (!data) {

                    setOrders([]);

                    setLoading(false);

                    return;

                }


                try {

                    const productsRef =
                        ref(
                            db,
                            `companys/${company.handle}/products`
                        );


                    const productsSnap =
                        await get(productsRef);


                    const productsData =
                        productsSnap.exists()
                            ? productsSnap.val()
                            : {};


                    const formatted =
                        Object.entries(data).map(
                            ([id, item]) => {

                                const product =
                                    productsData[
                                    item.productId
                                    ] || {};


                                let firstImage =
                                    placeholder;


                                if (
                                    Array.isArray(
                                        product.images
                                    )
                                ) {

                                    firstImage =
                                        product.images[0] ||
                                        placeholder;

                                } else if (
                                    product.images
                                ) {

                                    firstImage =
                                        product.images;

                                }


                                /* =========================
                                   HORÁRIO FINAL
                                ========================= */

                                let endTimeDisplay =
                                    item.hour || "—";


                                if (
                                    item.hour &&
                                    product?.duration
                                ) {

                                    const durationMinutes =
                                        Number(
                                            product.duration
                                        );


                                    if (
                                        !Number.isNaN(
                                            durationMinutes
                                        )
                                    ) {

                                        const [
                                            startHour,
                                            startMin
                                        ] =
                                            item.hour
                                                .split(":")
                                                .map(Number);


                                        const totalMinutes =
                                            startHour * 60 +
                                            startMin +
                                            durationMinutes;


                                        const endHour =
                                            Math.floor(
                                                totalMinutes / 60
                                            ) % 24;


                                        const endMin =
                                            totalMinutes % 60;


                                        const formattedEnd =
                                            `${String(
                                                endHour
                                            ).padStart(2, "0")}:${String(
                                                endMin
                                            ).padStart(2, "0")}`;


                                        endTimeDisplay =
                                            `${item.hour} - ${formattedEnd}`;

                                    }

                                }


                                /* =========================
                                   STATUS
                                ========================= */

                                let statusDisplay =
                                    "ativos";


                                if (
                                    item.status ===
                                    "completed"
                                ) {

                                    statusDisplay =
                                        "completos";

                                } else if (
                                    item.status ===
                                    "cancelados" ||
                                    item.status ===
                                    "cancelled" ||
                                    item.status ===
                                    "canceled"
                                ) {

                                    statusDisplay =
                                        "cancelados";

                                } else {

                                    statusDisplay =
                                        "ativos";

                                }


                                return {

                                    id,

                                    ...item,

                                    productName:
                                        product.name ||
                                        "Serviço",

                                    productValue:
                                        product.value ||
                                        "—",

                                    productImage:
                                        firstImage,

                                    professionalName:
                                        item.professionalName ||
                                        "Profissional",

                                    duration:
                                        product.duration ||
                                        null,

                                    fullHour:
                                        endTimeDisplay,

                                    statusDisplay

                                };

                            }
                        );


                    formatted.sort(
                        (a, b) => {

                            const dateA =
                                parseOrderDateTime(a);

                            const dateB =
                                parseOrderDateTime(b);

                            if (!dateA || !dateB) {
                                return 0;
                            }

                            return dateA - dateB;

                        }
                    );


                    setOrders(formatted);

                    setLoading(false);

                } catch (error) {

                    console.error(
                        "Erro ao carregar pedidos:",
                        error
                    );

                    setOrders([]);

                    setLoading(false);

                }

            }
        );


        return () => unsubscribe();

    }, [company]);


    /* =========================================================
       PEDIDO INICIAL
    ========================================================= */

    useEffect(() => {

        if (initialOrder) {

            setOpenOrderDetails(
                initialOrder
            );

        }

    }, [initialOrder]);


    /* =========================================================
       LISTAS DE FILTROS
    ========================================================= */

    const professionals = useMemo(() => {

        return [
            ...new Set(
                orders
                    .map(
                        order =>
                            order.professionalName
                    )
                    .filter(Boolean)
            )
        ];

    }, [orders]);


    const services = useMemo(() => {

        return [
            ...new Set(
                orders
                    .map(
                        order =>
                            order.productName
                    )
                    .filter(Boolean)
            )
        ];

    }, [orders]);


    /* =========================================================
       FILTRAGEM + ORDENAÇÃO
    ========================================================= */

    const filteredOrders = useMemo(() => {

        return orders

            .filter((order) => {

                /* =========================
                   ABA
                ========================= */

                const matchesTab =
                    order.statusDisplay ===
                    activeTab;


                /* =========================
                   PESQUISA
                ========================= */

                const normalizedSearch =
                    searchTerm
                        .trim()
                        .toLowerCase();


                const matchesSearch =
                    !normalizedSearch ||
                    order.productName
                        ?.toLowerCase()
                        .includes(
                            normalizedSearch
                        ) ||
                    order.userName
                        ?.toLowerCase()
                        .includes(
                            normalizedSearch
                        ) ||
                    order.clientName
                        ?.toLowerCase()
                        .includes(
                            normalizedSearch
                        ) ||
                    order.professionalName
                        ?.toLowerCase()
                        .includes(
                            normalizedSearch
                        );


                /* =========================
                   PROFISSIONAL
                ========================= */

                const matchesProfessional =
                    selectedProfessionals.length === 0 ||
                    selectedProfessionals.includes(
                        order.professionalName
                    );


                /* =========================
                   SERVIÇO
                ========================= */

                const matchesService =
                    selectedServices.length === 0 ||
                    selectedServices.includes(
                        order.productName
                    );


                /* =========================
                   PERÍODO
                ========================= */

                let matchesPeriod = true;


                const today =
                    new Date();


                today.setHours(
                    0,
                    0,
                    0,
                    0
                );


                const tomorrow =
                    new Date(today);


                tomorrow.setDate(
                    tomorrow.getDate() + 1
                );


                const orderDate =
                    parseOrderDate(order);


                if (orderDate) {

                    orderDate.setHours(
                        0,
                        0,
                        0,
                        0
                    );


                    switch (
                    selectedPeriod
                    ) {

                        case "today":

                            matchesPeriod =
                                orderDate.getTime() ===
                                today.getTime();

                            break;


                        case "tomorrow":

                            matchesPeriod =
                                orderDate.getTime() ===
                                tomorrow.getTime();

                            break;


                        case "week": {

                            const endWeek =
                                new Date(today);

                            endWeek.setDate(
                                today.getDate() + 7
                            );

                            matchesPeriod =
                                orderDate >= today &&
                                orderDate <= endWeek;

                            break;

                        }


                        case "next7": {

                            const next7 =
                                new Date(today);

                            next7.setDate(
                                today.getDate() + 7
                            );

                            matchesPeriod =
                                orderDate >= today &&
                                orderDate <= next7;

                            break;

                        }


                        case "month":

                            matchesPeriod =
                                orderDate.getMonth() ===
                                today.getMonth() &&
                                orderDate.getFullYear() ===
                                today.getFullYear();

                            break;


                        default:

                            matchesPeriod = true;

                    }

                }


                return (
                    matchesTab &&
                    matchesSearch &&
                    matchesProfessional &&
                    matchesService &&
                    matchesPeriod
                );

            })


            .sort((a, b) => {

                switch (selectedSort) {

                    case "dateAsc": {

                        const dateA =
                            parseOrderDateTime(a);

                        const dateB =
                            parseOrderDateTime(b);

                        return (
                            (dateA?.getTime() || 0) -
                            (dateB?.getTime() || 0)
                        );

                    }


                    case "dateDesc": {

                        const dateA =
                            parseOrderDateTime(a);

                        const dateB =
                            parseOrderDateTime(b);

                        return (
                            (dateB?.getTime() || 0) -
                            (dateA?.getTime() || 0)
                        );

                    }


                    case "nameAsc":

                        return (
                            a.userName ||
                            a.clientName ||
                            ""
                        ).localeCompare(
                            b.userName ||
                            b.clientName ||
                            ""
                        );


                    case "nameDesc":

                        return (
                            b.userName ||
                            b.clientName ||
                            ""
                        ).localeCompare(
                            a.userName ||
                            a.clientName ||
                            ""
                        );


                    case "serviceAsc":

                        return (
                            a.productName || ""
                        ).localeCompare(
                            b.productName || ""
                        );


                    case "serviceDesc":

                        return (
                            b.productName || ""
                        ).localeCompare(
                            a.productName || ""
                        );


                    case "priceAsc":

                        return (
                            parsePrice(
                                a.productValue
                            ) -
                            parsePrice(
                                b.productValue
                            )
                        );


                    case "priceDesc":

                        return (
                            parsePrice(
                                b.productValue
                            ) -
                            parsePrice(
                                a.productValue
                            )
                        );


                    default:

                        return 0;

                }

            });

    }, [
        orders,
        activeTab,
        searchTerm,
        selectedPeriod,
        selectedProfessionals,
        selectedServices,
        selectedSort
    ]);


    /* =========================================================
       CONTADORES
    ========================================================= */

    const orderCounts = useMemo(() => {

        return {

            ativos:
                orders.filter(
                    order =>
                        order.statusDisplay ===
                        "ativos"
                ).length,

            completos:
                orders.filter(
                    order =>
                        order.statusDisplay ===
                        "completos"
                ).length,

            cancelados:
                orders.filter(
                    order =>
                        order.statusDisplay ===
                        "cancelados"
                ).length

        };

    }, [orders]);


    /* =========================================================
       CONCLUIR
    ========================================================= */

    const handleComplete = async (
        order
    ) => {

        try {

            const db =
                getDatabase();


            const orderRef =
                ref(
                    db,
                    `companys/${company.handle}/schedules/${order.id}`
                );


            await update(
                orderRef,
                {
                    status:
                        "completed"
                }
            );


            setOpenOrderDetails(
                null
            );


            openToast(
                "success",
                "Pedido concluído",
                "O atendimento foi finalizado com sucesso."
            );

        } catch (error) {

            console.error(
                error
            );


            openToast(
                "error",
                "Erro",
                "Não foi possível concluir o pedido."
            );

        }

    };


    /* =========================================================
       CANCELAR
    ========================================================= */

    const handleCancel = async (
        order
    ) => {

        try {

            const db =
                getDatabase();


            const orderRef =
                ref(
                    db,
                    `companys/${company.handle}/schedules/${order.id}`
                );


            await update(
                orderRef,
                {
                    status:
                        "cancelados"
                }
            );


            openToast(
                "success",
                "Pedido cancelado",
                "O agendamento foi cancelado com sucesso."
            );

        } catch (error) {

            console.error(
                error
            );


            openToast(
                "error",
                "Erro",
                "Não foi possível cancelar o pedido."
            );

        }

    };


    /* =========================================================
       EXCLUIR
    ========================================================= */

    const handleDelete = async () => {

        if (!orderToDelete) {
            return;
        }


        try {

            const db =
                getDatabase();


            const orderRef =
                ref(
                    db,
                    `companys/${company.handle}/schedules/${orderToDelete.id}`
                );


            await remove(
                orderRef
            );


            setOrderToDelete(
                null
            );


            openToast(
                "success",
                "Pedido excluído",
                "O agendamento foi removido com sucesso."
            );

        } catch (error) {

            console.error(
                error
            );


            openToast(
                "error",
                "Erro",
                "Não foi possível excluir o pedido."
            );

        }

    };


    /* =========================================================
       AÇÕES DOS FILTROS
    ========================================================= */

    const openFilters = () => {

        setTempPeriod(
            selectedPeriod
        );

        setTempProfessionals(
            selectedProfessionals
        );

        setTempServices(
            selectedServices
        );

        setProfessionalSearch("");

        setServiceSearch("");

        setIsFilterOpen(
            true
        );

    };


    const applyFilters = () => {

        setSelectedPeriod(
            tempPeriod
        );

        setSelectedProfessionals(
            tempProfessionals
        );

        setSelectedServices(
            tempServices
        );

        setIsFilterOpen(
            false
        );

    };


    const clearTempFilters = () => {

        setTempPeriod(
            "all"
        );

        setTempProfessionals(
            []
        );

        setTempServices(
            []
        );

    };


    /* =========================================================
       BADGE / FILTROS ATIVOS
    ========================================================= */

    const activeFiltersCount =
        (
            selectedPeriod !== "all"
                ? 1
                : 0
        ) +
        selectedProfessionals.length +
        selectedServices.length;


    /* =========================================================
       LOADING
    ========================================================= */

    if (loading) {

        return (

            <div className="orders-page">

                <div className="orders-loading">

                    <div className="orders-loading-spinner" />

                    <p>
                        Carregando pedidos...
                    </p>

                </div>

            </div>

        );

    }


    /* =========================================================
       RENDER
    ========================================================= */

    return (

        <div className="orders-page">

            <main className="orders-main">

                {/* =================================================
                    HEADER
                ================================================= */}

                <header className="orders-header">

                    <div className="orders-header-main">

                        <div className="orders-header-title">

                            <span className="orders-eyebrow">
                                Gestão
                            </span>

                            <h1>
                                Pedidos
                            </h1>

                            <p>
                                Acompanhe e gerencie todos os
                                agendamentos da sua empresa.
                            </p>

                        </div>

                        <div className="orders-header-summary">

                            <div className="orders-summary-item">

                                <span>
                                    Total
                                </span>

                                <strong>
                                    {orders.length}
                                </strong>

                            </div>

                            <div className="orders-summary-divider" />

                            <div className="orders-summary-item">

                                <span>
                                    Ativos
                                </span>

                                <strong>
                                    {orderCounts.ativos}
                                </strong>

                            </div>

                        </div>

                    </div>

                </header>


                {/* =================================================
                    STATUS NAVIGATION
                ================================================= */}

                <section className="orders-status-section">

                    <div className="orders-status-tabs">

                        {[
                            {
                                id: "ativos",
                                label: "Ativos",
                                icon: "lucide:clock-3"
                            },
                            {
                                id: "completos",
                                label: "Completos",
                                icon: "lucide:check-circle-2"
                            },
                            {
                                id: "cancelados",
                                label: "Cancelados",
                                icon: "lucide:x-circle"
                            }
                        ].map((tab) => (

                            <button
                                key={tab.id}
                                type="button"
                                className={
                                    activeTab === tab.id
                                        ? "active"
                                        : ""
                                }
                                onClick={() =>
                                    setActiveTab(
                                        tab.id
                                    )
                                }
                            >

                                <Icon
                                    icon={tab.icon}
                                />

                                <span>
                                    {tab.label}
                                </span>

                                <strong>
                                    {orderCounts[tab.id]}
                                </strong>

                            </button>

                        ))}

                    </div>

                </section>


                {/* =================================================
                    TOOLBAR
                ================================================= */}

                <section className="orders-toolbar">

                    <div className="orders-search">

                        <Icon
                            icon="lucide:search"
                            className="orders-search-icon"
                        />

                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) =>
                                setSearchTerm(
                                    e.target.value
                                )
                            }
                            placeholder="Pesquisar cliente, serviço ou profissional..."
                        />

                        {searchTerm && (

                            <button
                                type="button"
                                className="orders-search-clear"
                                onClick={() =>
                                    setSearchTerm("")
                                }
                            >

                                <Icon
                                    icon="lucide:x"
                                />

                            </button>

                        )}

                    </div>


                    <div className="orders-toolbar-actions">

                        <button
                            type="button"
                            className={
                                `orders-toolbar-button ${activeFiltersCount > 0
                                    ? "has-filter"
                                    : ""
                                }`
                            }
                            onClick={
                                openFilters
                            }
                        >

                            <Icon
                                icon="lucide:filter"
                            />

                            <span>
                                Filtrar
                            </span>

                            {activeFiltersCount > 0 && (

                                <b>
                                    {activeFiltersCount}
                                </b>

                            )}

                        </button>


                        <button
                            type="button"
                            className="orders-toolbar-button"
                            onClick={() => {

                                setTempSort(
                                    selectedSort
                                );

                                setIsSortOpen(
                                    true
                                );

                            }}
                        >

                            <Icon
                                icon="lucide:arrow-up-down"
                            />

                            <span>
                                Ordenar
                            </span>

                        </button>

                    </div>

                </section>


                {/* =================================================
                    FILTER CHIPS
                ================================================= */}

                {activeFiltersCount > 0 && (

                    <div className="orders-filter-chips">

                        {selectedPeriod !== "all" && (

                            <button
                                type="button"
                                className="orders-filter-chip"
                                onClick={() =>
                                    setSelectedPeriod(
                                        "all"
                                    )
                                }
                            >

                                <span>
                                    {
                                        periodOptions.find(
                                            item =>
                                                item.id ===
                                                selectedPeriod
                                        )?.label
                                    }
                                </span>

                                <Icon
                                    icon="lucide:x"
                                />

                            </button>

                        )}


                        {selectedProfessionals.map(
                            (professional) => (

                                <button
                                    key={
                                        professional
                                    }
                                    type="button"
                                    className="orders-filter-chip"
                                    onClick={() =>
                                        setSelectedProfessionals(
                                            prev =>
                                                prev.filter(
                                                    item =>
                                                        item !==
                                                        professional
                                                )
                                        )
                                    }
                                >

                                    <span>
                                        {truncate(
                                            professional,
                                            22
                                        )}
                                    </span>

                                    <Icon
                                        icon="lucide:x"
                                    />

                                </button>

                            )
                        )}


                        {selectedServices.map(
                            (service) => (

                                <button
                                    key={service}
                                    type="button"
                                    className="orders-filter-chip"
                                    onClick={() =>
                                        setSelectedServices(
                                            prev =>
                                                prev.filter(
                                                    item =>
                                                        item !==
                                                        service
                                                )
                                        )
                                    }
                                >

                                    <span>
                                        {truncate(
                                            service,
                                            24
                                        )}
                                    </span>

                                    <Icon
                                        icon="lucide:x"
                                    />

                                </button>

                            )
                        )}

                    </div>

                )}


                {/* =================================================
                    LIST HEADER
                ================================================= */}

                <section className="orders-list-section">

                    <div className="orders-list-header">

                        <div>
                            <span>
                                {filteredOrders.length}
                            </span>

                            <p>
                                {filteredOrders.length === 1
                                    ? "pedido encontrado"
                                    : "pedidos encontrados"}
                            </p>
                        </div>

                        <span className="orders-current-sort">

                            {sortOptions.find(
                                option =>
                                    option.id ===
                                    selectedSort
                            )?.label}

                        </span>

                    </div>


                    {/* =================================================
                        LIST
                    ================================================= */}

                    <AnimatePresence mode="wait">

                        <motion.div
                            key={
                                `${activeTab}-${selectedSort}-${searchTerm}-${selectedPeriod}`
                            }
                            className="orders-list"
                            initial={{
                                opacity: 0,
                                y: 8
                            }}
                            animate={{
                                opacity: 1,
                                y: 0
                            }}
                            exit={{
                                opacity: 0,
                                y: -8
                            }}
                            transition={{
                                duration: 0.2
                            }}
                        >

                            {/* =========================================
                                TABLE HEADER
                            ========================================= */}

                            {filteredOrders.length > 0 && (

                                <div className="orders-table-header">

                                    <span>
                                        Serviço
                                    </span>

                                    <span>
                                        Cliente
                                    </span>

                                    <span>
                                        Profissional
                                    </span>

                                    <span>
                                        Data e horário
                                    </span>

                                    <span>
                                        Valor
                                    </span>

                                    <span>
                                        Status
                                    </span>

                                    <span>
                                        Ações
                                    </span>

                                </div>

                            )}


                            {/* =========================================
                                ORDERS
                            ========================================= */}

                            {filteredOrders.length > 0 ? (

                                filteredOrders.map(
                                    (order) => {

                                        const clientName =
                                            order.userName ||
                                            order.clientName ||
                                            "Cliente";


                                        return (

                                            <article
                                                className="orders-row"
                                                key={
                                                    order.id
                                                }
                                            >

                                                {/* =====================
                                                    SERVICE
                                                ===================== */}

                                                <div className="orders-row-service">

                                                    <div className="orders-product-image">

                                                        <img
                                                            src={
                                                                order.productImage ||
                                                                placeholder
                                                            }
                                                            alt={
                                                                order.productName
                                                            }
                                                            onError={(
                                                                e
                                                            ) => {

                                                                e.currentTarget.src =
                                                                    placeholder;

                                                            }}
                                                        />

                                                    </div>

                                                    <div className="orders-product-info">

                                                        <strong>
                                                            {
                                                                order.productName
                                                            }
                                                        </strong>

                                                        <span>
                                                            ID #{order.id}
                                                        </span>

                                                    </div>

                                                </div>


                                                {/* =====================
                                                    CLIENT
                                                ===================== */}

                                                <div className="orders-row-client">

                                                    <div className="orders-client-avatar">

                                                        {clientName
                                                            .charAt(
                                                                0
                                                            )
                                                            .toUpperCase()}

                                                    </div>

                                                    <div className="orders-client-info">

                                                        <strong>
                                                            {
                                                                truncate(
                                                                    clientName,
                                                                    24
                                                                )
                                                            }
                                                        </strong>

                                                        <span>
                                                            Cliente
                                                        </span>

                                                    </div>

                                                </div>


                                                {/* =====================
                                                    PROFESSIONAL
                                                ===================== */}

                                                <div className="orders-row-professional">

                                                    <div className="orders-info-icon">

                                                        <Icon
                                                            icon="lucide:user-round"
                                                        />

                                                    </div>

                                                    <span>
                                                        {
                                                            truncate(
                                                                order.professionalName,
                                                                22
                                                            )
                                                        }
                                                    </span>

                                                </div>


                                                {/* =====================
                                                    DATE
                                                ===================== */}

                                                <div className="orders-row-date">

                                                    <div>

                                                        <Icon
                                                            icon="lucide:calendar-days"
                                                        />

                                                        <span>
                                                            {
                                                                order.dayLabel ||
                                                                order.day ||
                                                                "—"
                                                            }
                                                        </span>

                                                    </div>

                                                    <div>

                                                        <Icon
                                                            icon="lucide:clock-3"
                                                        />

                                                        <span>
                                                            {
                                                                order.fullHour ||
                                                                order.hour ||
                                                                "—"
                                                            }
                                                        </span>

                                                    </div>

                                                </div>


                                                {/* =====================
                                                    VALUE
                                                ===================== */}

                                                <div className="orders-row-value">

                                                    <strong>
                                                        {
                                                            order.productValue
                                                        }
                                                    </strong>

                                                </div>


                                                {/* =====================
                                                    STATUS
                                                ===================== */}

                                                <div className="orders-row-status">

                                                    <span
                                                        className={
                                                            `orders-status-badge ${order.statusDisplay}`
                                                        }
                                                    >

                                                        <Icon
                                                            icon={
                                                                getStatusIcon(
                                                                    order.statusDisplay
                                                                )
                                                            }
                                                        />

                                                        {
                                                            formatStatus(
                                                                order.statusDisplay
                                                            )
                                                        }

                                                    </span>

                                                </div>


                                                {/* =====================
                                                    ACTIONS
                                                ===================== */}

                                                <div className="orders-row-actions">

                                                    <button
                                                        type="button"
                                                        className="orders-row-details"
                                                        onClick={() =>
                                                            setOpenOrderDetails(
                                                                order
                                                            )
                                                        }
                                                        title="Ver detalhes"
                                                    >

                                                        <Icon
                                                            icon="lucide:ellipsis"
                                                        />

                                                    </button>


                                                    {activeTab ===
                                                        "ativos" && (

                                                            <button
                                                                type="button"
                                                                className="orders-row-complete"
                                                                onClick={() =>
                                                                    handleComplete(
                                                                        order
                                                                    )
                                                                }
                                                                title="Completar pedido"
                                                            >

                                                                <Icon
                                                                    icon="lucide:check"
                                                                />

                                                            </button>

                                                        )}

                                                </div>

                                            </article>

                                        );

                                    }
                                )

                            ) : (

                                <div className="orders-empty">

                                    <div className="orders-empty-icon">

                                        <Icon
                                            icon={
                                                searchTerm ||
                                                    activeFiltersCount
                                                    ? "lucide:search-x"
                                                    : "lucide:inbox"
                                            }
                                        />

                                    </div>

                                    <h3>

                                        {searchTerm ||
                                            activeFiltersCount
                                            ? "Nenhum pedido encontrado"
                                            : `Nenhum pedido ${activeTab === "ativos"
                                                ? "ativo"
                                                : activeTab ===
                                                    "completos"
                                                    ? "completo"
                                                    : "cancelado"
                                            }`}

                                    </h3>

                                    <p>

                                        {searchTerm ||
                                            activeFiltersCount
                                            ? "Tente alterar sua pesquisa ou remover alguns filtros."
                                            : "Quando houver pedidos nesta categoria, eles aparecerão aqui."}

                                    </p>


                                    {(searchTerm ||
                                        activeFiltersCount) && (

                                            <button
                                                type="button"
                                                onClick={() => {

                                                    setSearchTerm(
                                                        ""
                                                    );

                                                    setSelectedPeriod(
                                                        "all"
                                                    );

                                                    setSelectedProfessionals(
                                                        []
                                                    );

                                                    setSelectedServices(
                                                        []
                                                    );

                                                }}
                                            >
                                                Limpar filtros
                                            </button>

                                        )}

                                </div>

                            )}

                        </motion.div>

                    </AnimatePresence>

                </section>

            </main>


            {/* =====================================================
                MODAL DE ORDENAÇÃO
            ===================================================== */}

            <AnimatePresence>

                {isSortOpen && (

                    <motion.div
                        className="orders-modal-overlay"
                        initial={{
                            opacity: 0
                        }}
                        animate={{
                            opacity: 1
                        }}
                        exit={{
                            opacity: 0
                        }}
                        onClick={() =>
                            setIsSortOpen(
                                false
                            )
                        }
                    >

                        <motion.div
                            className="orders-sort-modal"
                            initial={{
                                opacity: 0,
                                scale: 0.94,
                                y: 10
                            }}
                            animate={{
                                opacity: 1,
                                scale: 1,
                                y: 0
                            }}
                            exit={{
                                opacity: 0,
                                scale: 0.94,
                                y: 10
                            }}
                            transition={{
                                duration: 0.2
                            }}
                            onClick={(e) =>
                                e.stopPropagation()
                            }
                        >

                            <div className="orders-modal-header">

                                <div>

                                    <span>
                                        Preferência
                                    </span>

                                    <h2>
                                        Ordenar pedidos
                                    </h2>

                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setIsSortOpen(
                                            false
                                        )
                                    }
                                >

                                    <Icon
                                        icon="lucide:x"
                                    />

                                </button>

                            </div>


                            <div className="orders-sort-options">

                                {sortOptions.map(
                                    (option) => (

                                        <button
                                            key={
                                                option.id
                                            }
                                            type="button"
                                            className={
                                                tempSort ===
                                                    option.id
                                                    ? "active"
                                                    : ""
                                            }
                                            onClick={() =>
                                                setTempSort(
                                                    option.id
                                                )
                                            }
                                        >

                                            <span>
                                                {
                                                    option.label
                                                }
                                            </span>

                                            {tempSort ===
                                                option.id && (

                                                    <Icon
                                                        icon="lucide:check"
                                                    />

                                                )}

                                        </button>

                                    )
                                )}

                            </div>


                            <div className="orders-modal-footer">

                                <button
                                    type="button"
                                    className="orders-modal-secondary"
                                    onClick={() =>
                                        setTempSort(
                                            "dateAsc"
                                        )
                                    }
                                >
                                    Padrão
                                </button>

                                <button
                                    type="button"
                                    className="orders-modal-primary"
                                    onClick={() => {

                                        setSelectedSort(
                                            tempSort
                                        );

                                        setIsSortOpen(
                                            false
                                        );

                                    }}
                                >
                                    Aplicar
                                </button>

                            </div>

                        </motion.div>

                    </motion.div>

                )}

            </AnimatePresence>


            {/* =====================================================
                MODAL DE FILTROS
            ===================================================== */}

            <AnimatePresence>

                {isFilterOpen && (

                    <motion.div
                        className="orders-modal-overlay"
                        initial={{
                            opacity: 0
                        }}
                        animate={{
                            opacity: 1
                        }}
                        exit={{
                            opacity: 0
                        }}
                        onClick={() =>
                            setIsFilterOpen(
                                false
                            )
                        }
                    >

                        <motion.div
                            className="orders-filter-modal-new"
                            initial={{
                                opacity: 0,
                                scale: 0.94,
                                y: 10
                            }}
                            animate={{
                                opacity: 1,
                                scale: 1,
                                y: 0
                            }}
                            exit={{
                                opacity: 0,
                                scale: 0.94,
                                y: 10
                            }}
                            transition={{
                                duration: 0.2
                            }}
                            onClick={(e) =>
                                e.stopPropagation()
                            }
                        >

                            <div className="orders-modal-header">

                                <div>

                                    <span>
                                        Refinar resultados
                                    </span>

                                    <h2>
                                        Filtrar pedidos
                                    </h2>

                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setIsFilterOpen(
                                            false
                                        )
                                    }
                                >

                                    <Icon
                                        icon="lucide:x"
                                    />

                                </button>

                            </div>


                            <div className="orders-filter-modal-content">

                                {/* =========================
                                    PERÍODO
                                ========================= */}

                                <section className="orders-filter-block">

                                    <div className="orders-filter-block-header">

                                        <h3>
                                            Período
                                        </h3>

                                        <span>
                                            Escolha uma janela
                                        </span>

                                    </div>

                                    <div className="orders-filter-period-grid">

                                        {periodOptions.map(
                                            (period) => (

                                                <button
                                                    key={
                                                        period.id
                                                    }
                                                    type="button"
                                                    className={
                                                        tempPeriod ===
                                                            period.id
                                                            ? "active"
                                                            : ""
                                                    }
                                                    onClick={() =>
                                                        setTempPeriod(
                                                            period.id
                                                        )
                                                    }
                                                >

                                                    {
                                                        period.label
                                                    }

                                                    {tempPeriod ===
                                                        period.id && (

                                                            <Icon
                                                                icon="lucide:check"
                                                            />

                                                        )}

                                                </button>

                                            )
                                        )}

                                    </div>

                                </section>


                                {/* =========================
                                    PROFISSIONAL
                                ========================= */}

                                <section className="orders-filter-block">

                                    <div className="orders-filter-block-header">

                                        <h3>
                                            Profissional
                                        </h3>

                                        <span>
                                            Selecione um ou mais
                                        </span>

                                    </div>


                                    <div className="orders-filter-search">

                                        <Icon
                                            icon="lucide:search"
                                        />

                                        <input
                                            type="text"
                                            placeholder="Pesquisar profissional..."
                                            value={
                                                professionalSearch
                                            }
                                            onChange={(
                                                e
                                            ) =>
                                                setProfessionalSearch(
                                                    e.target.value
                                                )
                                            }
                                        />

                                    </div>


                                    <div className="orders-filter-selection-list">

                                        {professionals
                                            .filter(
                                                name =>
                                                    name
                                                        .toLowerCase()
                                                        .includes(
                                                            professionalSearch
                                                                .toLowerCase()
                                                        )
                                            )
                                            .map(
                                                name => (

                                                    <button
                                                        key={
                                                            name
                                                        }
                                                        type="button"
                                                        className={
                                                            tempProfessionals.includes(
                                                                name
                                                            )
                                                                ? "active"
                                                                : ""
                                                        }
                                                        onClick={() =>
                                                            setTempProfessionals(
                                                                prev =>
                                                                    prev.includes(
                                                                        name
                                                                    )
                                                                        ? prev.filter(
                                                                            item =>
                                                                                item !==
                                                                                name
                                                                        )
                                                                        : [
                                                                            ...prev,
                                                                            name
                                                                        ]
                                                            )
                                                        }
                                                    >

                                                        <span>
                                                            {
                                                                name
                                                            }
                                                        </span>

                                                        {tempProfessionals.includes(
                                                            name
                                                        ) && (

                                                                <Icon
                                                                    icon="lucide:check"
                                                                />

                                                            )}

                                                    </button>

                                                )
                                            )}

                                        {professionals.length ===
                                            0 && (

                                                <p className="orders-filter-empty">
                                                    Nenhum profissional
                                                    encontrado.
                                                </p>

                                            )}

                                    </div>

                                </section>


                                {/* =========================
                                    SERVIÇO
                                ========================= */}

                                <section className="orders-filter-block">

                                    <div className="orders-filter-block-header">

                                        <h3>
                                            Serviço
                                        </h3>

                                        <span>
                                            Selecione um ou mais
                                        </span>

                                    </div>


                                    <div className="orders-filter-search">

                                        <Icon
                                            icon="lucide:search"
                                        />

                                        <input
                                            type="text"
                                            placeholder="Pesquisar serviço..."
                                            value={
                                                serviceSearch
                                            }
                                            onChange={(
                                                e
                                            ) =>
                                                setServiceSearch(
                                                    e.target.value
                                                )
                                            }
                                        />

                                    </div>


                                    <div className="orders-filter-selection-list">

                                        {services
                                            .filter(
                                                name =>
                                                    name
                                                        .toLowerCase()
                                                        .includes(
                                                            serviceSearch
                                                                .toLowerCase()
                                                        )
                                            )
                                            .map(
                                                name => (

                                                    <button
                                                        key={
                                                            name
                                                        }
                                                        type="button"
                                                        className={
                                                            tempServices.includes(
                                                                name
                                                            )
                                                                ? "active"
                                                                : ""
                                                        }
                                                        onClick={() =>
                                                            setTempServices(
                                                                prev =>
                                                                    prev.includes(
                                                                        name
                                                                    )
                                                                        ? prev.filter(
                                                                            item =>
                                                                                item !==
                                                                                name
                                                                        )
                                                                        : [
                                                                            ...prev,
                                                                            name
                                                                        ]
                                                            )
                                                        }
                                                    >

                                                        <span>
                                                            {
                                                                name
                                                            }
                                                        </span>

                                                        {tempServices.includes(
                                                            name
                                                        ) && (

                                                                <Icon
                                                                    icon="lucide:check"
                                                                />

                                                            )}

                                                    </button>

                                                )
                                            )}

                                        {services.length ===
                                            0 && (

                                                <p className="orders-filter-empty">
                                                    Nenhum serviço
                                                    encontrado.
                                                </p>

                                            )}

                                    </div>

                                </section>

                            </div>


                            <div className="orders-modal-footer">

                                <button
                                    type="button"
                                    className="orders-modal-secondary"
                                    onClick={
                                        clearTempFilters
                                    }
                                >
                                    Limpar
                                </button>

                                <button
                                    type="button"
                                    className="orders-modal-primary"
                                    onClick={
                                        applyFilters
                                    }
                                >
                                    Aplicar filtros
                                </button>

                            </div>

                        </motion.div>

                    </motion.div>

                )}

            </AnimatePresence>


            {/* =====================================================
                MODAL DETALHES
            ===================================================== */}

            <AnimatePresence>

                {openOrderDetails && (

                    <motion.div
                        className="orders-details-overlay"
                        initial={{
                            opacity: 0
                        }}
                        animate={{
                            opacity: 1
                        }}
                        exit={{
                            opacity: 0
                        }}
                        onClick={(e) => {

                            if (
                                e.target.classList.contains(
                                    "orders-details-overlay"
                                )
                            ) {

                                setOpenOrderDetails(
                                    null
                                );

                            }

                        }}
                    >

                        <motion.div
                            className="orders-details-modal"
                            initial={{
                                opacity: 0,
                                scale: 0.95,
                                y: 15
                            }}
                            animate={{
                                opacity: 1,
                                scale: 1,
                                y: 0
                            }}
                            exit={{
                                opacity: 0,
                                scale: 0.95,
                                y: 15
                            }}
                            transition={{
                                type: "spring",
                                stiffness: 280,
                                damping: 25
                            }}
                        >

                            {/* =========================
                                HEADER
                            ========================= */}

                            <header className="orders-details-header">

                                <div>

                                    <span>
                                        Pedido
                                    </span>

                                    <h2>
                                        Detalhes do agendamento
                                    </h2>

                                    <p>
                                        #{openOrderDetails.id}
                                    </p>

                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setOpenOrderDetails(
                                            null
                                        )
                                    }
                                >

                                    <Icon
                                        icon="lucide:x"
                                    />

                                </button>

                            </header>


                            {/* =========================
                                BODY
                            ========================= */}

                            <div className="orders-details-body">

                                {/* =====================
                                    PRODUCT
                                ===================== */}

                                <section className="orders-details-product">

                                    <div className="orders-details-product-image">

                                        <img
                                            src={
                                                openOrderDetails.productImage ||
                                                placeholder
                                            }
                                            alt={
                                                openOrderDetails.productName
                                            }
                                            onError={(
                                                e
                                            ) => {

                                                e.currentTarget.src =
                                                    placeholder;

                                            }}
                                        />

                                    </div>


                                    <div className="orders-details-product-info">

                                        <span>
                                            Serviço
                                        </span>

                                        <h3>
                                            {
                                                openOrderDetails.productName
                                            }
                                        </h3>

                                        <strong>
                                            {
                                                openOrderDetails.productValue
                                            }
                                        </strong>

                                    </div>


                                    <span
                                        className={
                                            `orders-status-badge ${openOrderDetails.statusDisplay}`
                                        }
                                    >

                                        <Icon
                                            icon={
                                                getStatusIcon(
                                                    openOrderDetails.statusDisplay
                                                )
                                            }
                                        />

                                        {
                                            formatStatus(
                                                openOrderDetails.statusDisplay
                                            )
                                        }

                                    </span>

                                </section>


                                {/* =====================
                                    INFORMATION GRID
                                ===================== */}

                                <section className="orders-details-grid">

                                    <div className="orders-details-item">

                                        <span>
                                            Cliente
                                        </span>

                                        <strong>
                                            {
                                                truncate(
                                                    openOrderDetails.userName ||
                                                    openOrderDetails.clientName ||
                                                    "Cliente",
                                                    28
                                                )
                                            }
                                        </strong>

                                    </div>


                                    <div className="orders-details-item">

                                        <span>
                                            Profissional
                                        </span>

                                        <strong>
                                            {
                                                truncate(
                                                    openOrderDetails.professionalName,
                                                    28
                                                )
                                            }
                                        </strong>

                                    </div>


                                    <div className="orders-details-item">

                                        <span>
                                            Data
                                        </span>

                                        <strong>
                                            {
                                                openOrderDetails.dayLabel ||
                                                openOrderDetails.day ||
                                                "—"
                                            }
                                        </strong>

                                    </div>


                                    <div className="orders-details-item">

                                        <span>
                                            Horário
                                        </span>

                                        <strong>
                                            {
                                                openOrderDetails.fullHour ||
                                                openOrderDetails.hour ||
                                                "—"
                                            }
                                        </strong>

                                    </div>


                                    <div className="orders-details-item">

                                        <span>
                                            Duração
                                        </span>

                                        <strong>
                                            {openOrderDetails.duration
                                                ? `${openOrderDetails.duration} min`
                                                : "—"}
                                        </strong>

                                    </div>


                                    <div className="orders-details-item">

                                        <span>
                                            Valor
                                        </span>

                                        <strong>
                                            {
                                                openOrderDetails.productValue
                                            }
                                        </strong>

                                    </div>

                                </section>


                                {/* =====================
                                    ID DO PRODUTO
                                ===================== */}

                                {openOrderDetails.productId && (

                                    <section className="orders-details-reference">

                                        <div>

                                            <span>
                                                Produto relacionado
                                            </span>

                                            <strong>
                                                #{openOrderDetails.productId}
                                            </strong>

                                        </div>

                                        <Icon
                                            icon="lucide:package"
                                        />

                                    </section>

                                )}

                            </div>


                            {/* =========================
                                ACTIONS
                            ========================= */}

                            <footer className="orders-details-actions">

                                <button
                                    type="button"
                                    className="orders-details-delete"
                                    onClick={() => {

                                        setOrderToDelete(
                                            openOrderDetails
                                        );

                                        setOpenOrderDetails(
                                            null
                                        );

                                    }}
                                >

                                    <Icon
                                        icon="lucide:trash-2"
                                    />

                                    Excluir

                                </button>


                                {openOrderDetails.statusDisplay ===
                                    "ativos" && (

                                        <>

                                            <button
                                                type="button"
                                                className="orders-details-cancel"
                                                onClick={() => {

                                                    setOrderToCancel(
                                                        openOrderDetails
                                                    );

                                                    setOpenOrderDetails(
                                                        null
                                                    );

                                                }}
                                            >

                                                Cancelar

                                            </button>


                                            <button
                                                type="button"
                                                className="orders-details-complete"
                                                onClick={() =>
                                                    handleComplete(
                                                        openOrderDetails
                                                    )
                                                }
                                            >

                                                <Icon
                                                    icon="lucide:check"
                                                />

                                                Completar pedido

                                            </button>

                                        </>

                                    )}

                            </footer>

                        </motion.div>

                    </motion.div>

                )}

            </AnimatePresence>


            {/* =====================================================
                MODAL EXCLUSÃO
            ===================================================== */}

            <AnimatePresence>

                {orderToDelete && (

                    <motion.div
                        className="orders-confirm-overlay"
                        initial={{
                            opacity: 0
                        }}
                        animate={{
                            opacity: 1
                        }}
                        exit={{
                            opacity: 0
                        }}
                    >

                        <motion.div
                            className="orders-confirm-modal"
                            initial={{
                                opacity: 0,
                                scale: 0.92
                            }}
                            animate={{
                                opacity: 1,
                                scale: 1
                            }}
                            exit={{
                                opacity: 0,
                                scale: 0.92
                            }}
                        >

                            <div className="orders-confirm-icon danger">

                                <Icon
                                    icon="lucide:trash-2"
                                />

                            </div>

                            <h2>
                                Excluir pedido?
                            </h2>

                            <p>
                                Tem certeza que deseja excluir
                                este pedido? Essa ação não pode
                                ser desfeita.
                            </p>

                            <div className="orders-confirm-actions">

                                <button
                                    type="button"
                                    onClick={() =>
                                        setOrderToDelete(
                                            null
                                        )
                                    }
                                >
                                    Voltar
                                </button>

                                <button
                                    type="button"
                                    className="danger"
                                    onClick={
                                        handleDelete
                                    }
                                >
                                    Excluir pedido
                                </button>

                            </div>

                        </motion.div>

                    </motion.div>

                )}

            </AnimatePresence>


            {/* =====================================================
                MODAL CANCELAMENTO
            ===================================================== */}

            <AnimatePresence>

                {orderToCancel && (

                    <motion.div
                        className="orders-confirm-overlay"
                        initial={{
                            opacity: 0
                        }}
                        animate={{
                            opacity: 1
                        }}
                        exit={{
                            opacity: 0
                        }}
                    >

                        <motion.div
                            className="orders-confirm-modal"
                            initial={{
                                opacity: 0,
                                scale: 0.92
                            }}
                            animate={{
                                opacity: 1,
                                scale: 1
                            }}
                            exit={{
                                opacity: 0,
                                scale: 0.92
                            }}
                        >

                            <div className="orders-confirm-icon warning">

                                <Icon
                                    icon="lucide:circle-alert"
                                />

                            </div>

                            <h2>
                                Cancelar pedido?
                            </h2>

                            <p>
                                Tem certeza que deseja cancelar
                                este agendamento? O cliente poderá
                                ser notificado sobre o cancelamento.
                            </p>

                            <div className="orders-confirm-actions">

                                <button
                                    type="button"
                                    onClick={() =>
                                        setOrderToCancel(
                                            null
                                        )
                                    }
                                >
                                    Voltar
                                </button>

                                <button
                                    type="button"
                                    className="warning"
                                    onClick={async () => {

                                        await handleCancel(
                                            orderToCancel
                                        );

                                        setOrderToCancel(
                                            null
                                        );

                                        setOpenOrderDetails(
                                            null
                                        );

                                    }}
                                >
                                    Cancelar pedido
                                </button>

                            </div>

                        </motion.div>

                    </motion.div>

                )}

            </AnimatePresence>


            {/* =====================================================
                TOAST
            ===================================================== */}

            <Toast
                show={showToast}
                type={toastType}
                title={toastTitle}
                message={toastMessage}
                onClose={() =>
                    setShowToast(false)
                }
            />

        </div>

    );

};


/* ================================================================
   MODAL EXTERNO DE DETALHES
================================================================ */

export const OrderDetailsModal = ({
    order,
    onClose,
    onComplete,
    onCancel
}) => {

    if (!order) {
        return null;
    }


    const truncate = (
        text,
        max = 20
    ) => {

        if (!text) return "—";

        return text.length > max
            ? `${text.slice(0, max)}...`
            : text;

    };


    const getStatusLabel = (
        status
    ) => {

        if (
            status === "completed" ||
            status === "completos"
        ) {
            return "Completo";
        }

        if (
            status === "cancelados" ||
            status === "cancelled"
        ) {
            return "Cancelado";
        }

        return "Ativo";

    };


    return (

        <motion.div
            className="orders-details-overlay"
            initial={{
                opacity: 0
            }}
            animate={{
                opacity: 1
            }}
            exit={{
                opacity: 0
            }}
            onClick={(e) => {

                if (
                    e.target.classList.contains(
                        "orders-details-overlay"
                    )
                ) {

                    onClose();

                }

            }}
        >

            <motion.div
                className="orders-details-modal"
                initial={{
                    opacity: 0,
                    scale: 0.95,
                    y: 15
                }}
                animate={{
                    opacity: 1,
                    scale: 1,
                    y: 0
                }}
                exit={{
                    opacity: 0,
                    scale: 0.95,
                    y: 15
                }}
            >

                <header className="orders-details-header">

                    <div>

                        <span>
                            Pedido
                        </span>

                        <h2>
                            Detalhes do agendamento
                        </h2>

                        <p>
                            #{order.id}
                        </p>

                    </div>

                    <button
                        type="button"
                        onClick={
                            onClose
                        }
                    >

                        <Icon
                            icon="lucide:x"
                        />

                    </button>

                </header>


                <div className="orders-details-body">

                    <section className="orders-details-product">

                        <div className="orders-details-product-image">

                            <img
                                src={
                                    order.productImage ||
                                    placeholder
                                }
                                alt={
                                    order.productName
                                }
                            />

                        </div>

                        <div className="orders-details-product-info">

                            <span>
                                Serviço
                            </span>

                            <h3>
                                {
                                    order.productName
                                }
                            </h3>

                            <strong>
                                {
                                    order.productValue
                                }
                            </strong>

                        </div>

                        <span
                            className={
                                `orders-status-badge ${order.statusDisplay ||
                                order.status
                                }`
                            }
                        >
                            {getStatusLabel(
                                order.statusDisplay ||
                                order.status
                            )}
                        </span>

                    </section>


                    <section className="orders-details-grid">

                        <div className="orders-details-item">

                            <span>
                                Cliente
                            </span>

                            <strong>
                                {
                                    truncate(
                                        order.clientName ||
                                        order.userName,
                                        28
                                    )
                                }
                            </strong>

                        </div>


                        <div className="orders-details-item">

                            <span>
                                Profissional
                            </span>

                            <strong>
                                {
                                    truncate(
                                        order.professionalName,
                                        28
                                    )
                                }
                            </strong>

                        </div>


                        <div className="orders-details-item">

                            <span>
                                Data
                            </span>

                            <strong>
                                {
                                    order.dayLabel ||
                                    order.day ||
                                    "—"
                                }
                            </strong>

                        </div>


                        <div className="orders-details-item">

                            <span>
                                Horário
                            </span>

                            <strong>
                                {
                                    order.fullHour ||
                                    order.hour ||
                                    "—"
                                }
                            </strong>

                        </div>

                    </section>

                </div>


                <footer className="orders-details-actions">

                    <button
                        type="button"
                        className="orders-details-cancel"
                        onClick={() =>
                            onCancel(
                                order
                            )
                        }
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        className="orders-details-complete"
                        onClick={() =>
                            onComplete(
                                order
                            )
                        }
                    >

                        <Icon
                            icon="lucide:check"
                        />

                        Completar pedido

                    </button>

                </footer>

            </motion.div>

        </motion.div>

    );

};


export default Orders;