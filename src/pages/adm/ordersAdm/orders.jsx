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

import "./orders.css";
import placeholder from "../../../img/1.jpg";
import Toast from "../../../components/toast/Toast";
import Modal from "../../../components/modal/Modal";
import useLastValue from "../../../hooks/useLastValue";

import {
    getSubscriptionSummary,
    isSubscriptionUsable,
    watchCompanySubscriptions
} from "../../../utils/subscriptionRuntime";

const Orders = ({ company, initialOrder }) => {

    /* =========================================================
       ESTADOS PRINCIPAIS
    ========================================================= */

    const [activeTab, setActiveTab] = useState("ativos");

    /* =========================================================
       ASSINATURAS

       Uma aba à parte porque uma mensalidade não é um pedido:
       não tem data, não é concluída, e o que importa nela é
       quanto ainda vai render e quando cobra de novo. Misturar
       com os agendamentos esconderia as duas coisas.
    ========================================================= */

    const [subscriptions, setSubscriptions] = useState([]);


    useEffect(() => {

        if (!company?.handle) {
            setSubscriptions([]);
            return undefined;
        }

        const unsubscribe = watchCompanySubscriptions(
            company.handle,
            setSubscriptions
        );

        return () => unsubscribe();

    }, [company?.handle]);


    const activeSubscriptions =
        subscriptions.filter(isSubscriptionUsable);

    const [orders, setOrders] = useState([]);

    const [loading, setLoading] = useState(true);

    const [searchTerm, setSearchTerm] = useState("");

    const [openOrderDetails, setOpenOrderDetails] = useState(null);

    /* O modal de detalhes só sai do DOM depois da animação,
       quando o state já é null: sem guardar o último pedido
       o painel sairia vazio. */
    const orderDetails = useLastValue(openOrderDetails);

    const [orderToDelete, setOrderToDelete] = useState(null);

    const [orderToCancel, setOrderToCancel] = useState(null);


    /* =========================================================
       SELEÇÃO EM LOTE
    ========================================================= */

    const [selectionMode, setSelectionMode] = useState(false);

    const [selectedOrderIds, setSelectedOrderIds] = useState([]);

    const [showBulkCancelConfirm, setShowBulkCancelConfirm] = useState(false);

    const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);


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
       AÇÕES DE SELEÇÃO
    ========================================================= */

    const toggleSelectionMode = () => {

        setSelectionMode(
            prev => !prev
        );

        setSelectedOrderIds(
            []
        );

    };


    const toggleSelectOrder = (id) => {

        setSelectedOrderIds(
            prev =>
                prev.includes(id)
                    ? prev.filter(
                        item =>
                            item !== id
                    )
                    : [
                        ...prev,
                        id
                    ]
        );

    };


    const isAllFilteredSelected =
        filteredOrders.length > 0 &&
        filteredOrders.every(
            order =>
                selectedOrderIds.includes(
                    order.id
                )
        );


    const toggleSelectAll = () => {

        if (isAllFilteredSelected) {

            setSelectedOrderIds(
                []
            );

        } else {

            setSelectedOrderIds(
                filteredOrders.map(
                    order =>
                        order.id
                )
            );

        }

    };


    useEffect(() => {

        setSelectedOrderIds(
            []
        );

    }, [activeTab]);


    /* =========================================================
       AÇÕES EM LOTE
    ========================================================= */

    const handleBulkComplete = async () => {

        if (selectedOrderIds.length === 0) {
            return;
        }

        const ids = selectedOrderIds;

        try {

            const db =
                getDatabase();

            await Promise.all(
                ids.map(
                    (id) =>
                        update(
                            ref(
                                db,
                                `companys/${company.handle}/schedules/${id}`
                            ),
                            {
                                status:
                                    "completed"
                            }
                        )
                )
            );

            setSelectedOrderIds(
                []
            );

            openToast(
                "success",
                "Pedidos concluídos",
                `${ids.length} pedido(s) finalizado(s) com sucesso.`
            );

        } catch (error) {

            console.error(
                error
            );

            openToast(
                "error",
                "Erro",
                "Não foi possível concluir os pedidos selecionados."
            );

        }

    };


    const handleBulkCancel = async () => {

        if (selectedOrderIds.length === 0) {
            return;
        }

        const ids = selectedOrderIds;

        try {

            const db =
                getDatabase();

            await Promise.all(
                ids.map(
                    (id) =>
                        update(
                            ref(
                                db,
                                `companys/${company.handle}/schedules/${id}`
                            ),
                            {
                                status:
                                    "cancelados"
                            }
                        )
                )
            );

            setSelectedOrderIds(
                []
            );

            setShowBulkCancelConfirm(
                false
            );

            openToast(
                "success",
                "Pedidos cancelados",
                `${ids.length} agendamento(s) cancelado(s) com sucesso.`
            );

        } catch (error) {

            console.error(
                error
            );

            openToast(
                "error",
                "Erro",
                "Não foi possível cancelar os pedidos selecionados."
            );

        }

    };


    const handleBulkDelete = async () => {

        if (selectedOrderIds.length === 0) {
            return;
        }

        const ids = selectedOrderIds;

        try {

            const db =
                getDatabase();

            await Promise.all(
                ids.map(
                    (id) =>
                        remove(
                            ref(
                                db,
                                `companys/${company.handle}/schedules/${id}`
                            )
                        )
                )
            );

            setSelectedOrderIds(
                []
            );

            setShowBulkDeleteConfirm(
                false
            );

            openToast(
                "success",
                "Pedidos excluídos",
                `${ids.length} agendamento(s) removido(s) com sucesso.`
            );

        } catch (error) {

            console.error(
                error
            );

            openToast(
                "error",
                "Erro",
                "Não foi possível excluir os pedidos selecionados."
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
                            },
                            {
                                id: "assinaturas",
                                label: "Assinaturas",
                                icon: "lucide:repeat"
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
                                    {tab.id === "assinaturas"
                                        ? activeSubscriptions.length
                                        : orderCounts[tab.id]}
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


                        <button
                            type="button"
                            className={
                                `orders-toolbar-button ${selectionMode
                                    ? "has-filter"
                                    : ""
                                }`
                            }
                            onClick={
                                toggleSelectionMode
                            }
                        >

                            <Icon
                                icon={
                                    selectionMode
                                        ? "lucide:x"
                                        : "lucide:list-checks"
                                }
                            />

                            <span>
                                {selectionMode
                                    ? "Cancelar seleção"
                                    : "Selecionar"}
                            </span>

                        </button>

                    </div>

                </section>


                {/* =================================================
                    BULK ACTIONS BAR
                ================================================= */}

                {selectionMode && (

                    <div className="orders-bulk-bar">

                        <label className="orders-bulk-select-all">

                            <input
                                type="checkbox"
                                checked={
                                    isAllFilteredSelected
                                }
                                onChange={
                                    toggleSelectAll
                                }
                            />

                            <span>
                                {selectedOrderIds.length > 0
                                    ? `${selectedOrderIds.length} selecionado${selectedOrderIds.length > 1 ? "s" : ""}`
                                    : "Selecionar todos"}
                            </span>

                        </label>


                        {selectedOrderIds.length > 0 && (

                            <div className="orders-bulk-actions">

                                {activeTab === "ativos" && (

                                    <>

                                        <button
                                            type="button"
                                            className="orders-bulk-complete"
                                            onClick={
                                                handleBulkComplete
                                            }
                                        >

                                            <Icon
                                                icon="lucide:check"
                                            />

                                            Completar

                                        </button>

                                        <button
                                            type="button"
                                            className="orders-bulk-cancel"
                                            onClick={() =>
                                                setShowBulkCancelConfirm(
                                                    true
                                                )
                                            }
                                        >

                                            <Icon
                                                icon="lucide:circle-alert"
                                            />

                                            Cancelar

                                        </button>

                                    </>

                                )}

                                <button
                                    type="button"
                                    className="orders-bulk-delete"
                                    onClick={() =>
                                        setShowBulkDeleteConfirm(
                                            true
                                        )
                                    }
                                >

                                    <Icon
                                        icon="lucide:trash-2"
                                    />

                                    Excluir

                                </button>

                            </div>

                        )}

                    </div>

                )}


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
                    ASSINATURAS

                    Substitui a lista de pedidos quando a aba
                    está selecionada. Cada linha responde o que
                    o dono da empresa precisa saber: quem
                    assina, quanto rende, quanto já usou do
                    ciclo e quando entra o próximo dinheiro.
                ================================================= */}

                {activeTab === "assinaturas" ? (

                    <section className="orders-list-section">

                        <div className="orders-list-header">

                            <div>
                                <span>
                                    {activeSubscriptions.length}
                                    {" "}
                                    {activeSubscriptions.length === 1
                                        ? "assinatura ativa"
                                        : "assinaturas ativas"}
                                </span>

                                <h2>Receita recorrente</h2>
                            </div>

                            {activeSubscriptions.length > 0 && (

                                <div className="orders-subscriptions-total">
                                    <span>Por ciclo</span>

                                    <strong>
                                        {activeSubscriptions
                                            .reduce(
                                                (soma, item) =>
                                                    soma + Number(item.price || 0),
                                                0
                                            )
                                            .toLocaleString("pt-BR", {
                                                style: "currency",
                                                currency: "BRL"
                                            })}
                                    </strong>
                                </div>

                            )}

                        </div>


                        {activeSubscriptions.length === 0 ? (

                            <div className="orders-empty">

                                <Icon icon="lucide:repeat" />

                                <h3>Nenhuma assinatura ativa</h3>

                                <p>
                                    Quando alguém assinar um produto de
                                    mensalidade, ele aparece aqui com o
                                    saldo do ciclo e a próxima cobrança.
                                </p>

                            </div>

                        ) : (

                            <div className="orders-subscriptions-list">

                                {activeSubscriptions.map((assinatura) => {

                                    const resumo =
                                        getSubscriptionSummary(
                                            assinatura,
                                            orders
                                        );

                                    /* Os dias que a pessoa já marcou
                                       dentro do ciclo atual. É o que o
                                       profissional precisa ver para se
                                       organizar. */
                                    const diasMarcados =
                                        orders
                                            .filter(
                                                (pedido) =>
                                                    pedido.subscriptionId ===
                                                    assinatura.id
                                            )
                                            .filter((pedido) => {

                                                const data =
                                                    parseOrderDateTime(pedido);

                                                return (
                                                    data &&
                                                    data >= resumo.cycleStart &&
                                                    data < resumo.cycleEnd &&
                                                    pedido.status !== "cancelados"
                                                );

                                            })
                                            .sort(
                                                (a, b) =>
                                                    (parseOrderDateTime(a) || 0) -
                                                    (parseOrderDateTime(b) || 0)
                                            );

                                    return (
                                        <article
                                            key={assinatura.id}
                                            className="orders-subscription"
                                        >

                                            <header>

                                                <div className="orders-subscription-avatar">
                                                    <Icon icon="lucide:user-round" />
                                                </div>

                                                <div className="orders-subscription-who">

                                                    <strong>
                                                        {assinatura.userName ||
                                                            "Sem nome"}
                                                    </strong>

                                                    <span>
                                                        {assinatura.productName ||
                                                            "Mensalidade"}
                                                    </span>

                                                </div>

                                                <div className="orders-subscription-price">

                                                    <strong>
                                                        {Number(assinatura.price || 0)
                                                            .toLocaleString("pt-BR", {
                                                                style: "currency",
                                                                currency: "BRL"
                                                            })}
                                                    </strong>

                                                    <span>
                                                        {resumo.ciclo.periodLabel}
                                                    </span>

                                                </div>

                                                <span
                                                    className={`orders-subscription-badge ${assinatura.status === "past_due"
                                                        ? "is-late"
                                                        : "is-active"
                                                        }`}
                                                >
                                                    {assinatura.status === "past_due"
                                                        ? "Em atraso"
                                                        : "Ativa"}
                                                </span>

                                            </header>

                                            <div className="orders-subscription-facts">

                                                <div>
                                                    <span>Usou no ciclo</span>
                                                    <strong>
                                                        {resumo.sessoesUsadas}
                                                        {resumo.sessoesRestantes === null
                                                            ? " (ilimitado)"
                                                            : ` de ${assinatura.sessionsPerCycle}`}
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
                                                    <span>Cliente desde</span>
                                                    <strong>
                                                        {new Date(assinatura.startedAt)
                                                            .toLocaleDateString("pt-BR")}
                                                    </strong>
                                                </div>

                                            </div>

                                            <div className="orders-subscription-days">

                                                <span className="orders-subscription-days-label">
                                                    Dias marcados neste ciclo
                                                </span>

                                                {diasMarcados.length === 0 ? (

                                                    <em>
                                                        Nada marcado ainda.
                                                    </em>

                                                ) : (

                                                    <div className="orders-subscription-days-list">

                                                        {diasMarcados.map((pedido) => (

                                                            <button
                                                                key={pedido.id}
                                                                type="button"
                                                                onClick={() =>
                                                                    setOpenOrderDetails(pedido)
                                                                }
                                                            >
                                                                <Icon icon="lucide:calendar" />

                                                                {pedido.day} · {pedido.hour}
                                                            </button>

                                                        ))}

                                                    </div>

                                                )}

                                            </div>

                                        </article>
                                    );

                                })}

                            </div>

                        )}

                    </section>

                ) : (<>

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

                    {/* Reordenar/filtrar remonta a lista pelo `key` e
                        a entrada do CSS reinicia. Sem animação de
                        saída, a lista nova não espera a antiga. */}
                    <div
                        key={
                            `${activeTab}-${selectedSort}-${searchTerm}-${selectedPeriod}`
                        }
                        className={
                            `orders-list mkf-list-enter ${selectionMode
                                ? "has-selection"
                                : ""
                            }`
                        }
                    >

                            {/* =========================================
                                TABLE HEADER
                            ========================================= */}

                            {filteredOrders.length > 0 && (

                                <div className="orders-table-header">

                                    {selectionMode && (

                                        <div className="orders-row-checkbox">

                                            <input
                                                type="checkbox"
                                                checked={
                                                    isAllFilteredSelected
                                                }
                                                onChange={
                                                    toggleSelectAll
                                                }
                                            />

                                        </div>

                                    )}

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


                                        const isOrderSelected =
                                            selectedOrderIds.includes(
                                                order.id
                                            );


                                        return (

                                            <article
                                                className={
                                                    `orders-row ${isOrderSelected
                                                        ? "selected"
                                                        : ""
                                                    }`
                                                }
                                                key={
                                                    order.id
                                                }
                                            >

                                                {selectionMode && (

                                                    <div
                                                        className="orders-row-checkbox"
                                                        onClick={(e) =>
                                                            e.stopPropagation()
                                                        }
                                                    >

                                                        <input
                                                            type="checkbox"
                                                            checked={
                                                                isOrderSelected
                                                            }
                                                            onChange={() =>
                                                                toggleSelectOrder(
                                                                    order.id
                                                                )
                                                            }
                                                        />

                                                    </div>

                                                )}

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

                        </div>

                </section>

                </>)}

            </main>


            {/* =====================================================
                MODAL DE ORDENAÇÃO
            ===================================================== */}

            <Modal
                open={isSortOpen}
                onClose={() =>
                            setIsSortOpen(
                                false
                            )}
                overlayClassName="orders-modal-overlay"
                className="orders-sort-modal"
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

                        </Modal>


            {/* =====================================================
                MODAL DE FILTROS
            ===================================================== */}

            <Modal
                open={isFilterOpen}
                onClose={() =>
                            setIsFilterOpen(
                                false
                            )}
                overlayClassName="orders-modal-overlay"
                className="orders-filter-modal-new"
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

                        </Modal>


            {/* =====================================================
                MODAL DETALHES
            ===================================================== */}

            <Modal
                open={!!openOrderDetails}
                onClose={() => setOpenOrderDetails(null)}
                overlayClassName="orders-details-overlay"
                className="orders-details-modal"
            >

                {orderDetails && (
                    <>

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
                                        #{orderDetails.id}
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
                                                orderDetails.productImage ||
                                                placeholder
                                            }
                                            alt={
                                                orderDetails.productName
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
                                                orderDetails.productName
                                            }
                                        </h3>

                                        <strong>
                                            {
                                                orderDetails.productValue
                                            }
                                        </strong>

                                    </div>


                                    <span
                                        className={
                                            `orders-status-badge ${orderDetails.statusDisplay}`
                                        }
                                    >

                                        <Icon
                                            icon={
                                                getStatusIcon(
                                                    orderDetails.statusDisplay
                                                )
                                            }
                                        />

                                        {
                                            formatStatus(
                                                orderDetails.statusDisplay
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
                                                    orderDetails.userName ||
                                                    orderDetails.clientName ||
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
                                                    orderDetails.professionalName,
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
                                                orderDetails.dayLabel ||
                                                orderDetails.day ||
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
                                                orderDetails.fullHour ||
                                                orderDetails.hour ||
                                                "—"
                                            }
                                        </strong>

                                    </div>


                                    <div className="orders-details-item">

                                        <span>
                                            Duração
                                        </span>

                                        <strong>
                                            {orderDetails.duration
                                                ? `${orderDetails.duration} min`
                                                : "—"}
                                        </strong>

                                    </div>


                                    <div className="orders-details-item">

                                        <span>
                                            Valor
                                        </span>

                                        <strong>
                                            {
                                                orderDetails.productValue
                                            }
                                        </strong>

                                    </div>

                                </section>


                                {/* =====================
                                    OBSERVAÇÃO DO CLIENTE

                                    Fica antes do id do produto
                                    porque é o que muda o
                                    atendimento — alergia, atraso,
                                    preferência. Um id de produto
                                    ninguém lê com pressa; um
                                    recado, sim.
                                ===================== */}

                                {orderDetails.notes && (

                                    <section className="orders-details-notes">

                                        <div className="orders-details-notes-head">

                                            <Icon icon="lucide:message-square-text" />

                                            <span>
                                                Observação do cliente
                                            </span>

                                        </div>

                                        <p>
                                            {orderDetails.notes}
                                        </p>

                                    </section>

                                )}


                                {/* =====================
                                    ID DO PRODUTO
                                ===================== */}

                                {orderDetails.productId && (

                                    <section className="orders-details-reference">

                                        <div>

                                            <span>
                                                Produto relacionado
                                            </span>

                                            <strong>
                                                #{orderDetails.productId}
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
                                            orderDetails
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


                                {orderDetails.statusDisplay ===
                                    "ativos" && (

                                        <>

                                            <button
                                                type="button"
                                                className="orders-details-cancel"
                                                onClick={() => {

                                                    setOrderToCancel(
                                                        orderDetails
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
                                                        orderDetails
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

                    </>
                )}

                        </Modal>


            {/* =====================================================
                MODAL EXCLUSÃO
            ===================================================== */}

            <Modal
                open={orderToDelete}
                onClose={() => setOrderToDelete(null)}
                overlayClassName="orders-confirm-overlay"
                className="orders-confirm-modal"
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

                        </Modal>


            {/* =====================================================
                MODAL CANCELAMENTO
            ===================================================== */}

            <Modal
                open={orderToCancel}
                onClose={() => setOrderToCancel(null)}
                overlayClassName="orders-confirm-overlay"
                className="orders-confirm-modal"
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

                        </Modal>


            {/* =====================================================
                MODAL CANCELAMENTO EM LOTE
            ===================================================== */}

            <Modal
                open={showBulkCancelConfirm}
                onClose={() => setShowBulkCancelConfirm(false)}
                overlayClassName="orders-confirm-overlay"
                className="orders-confirm-modal"
            >

                            <div className="orders-confirm-icon warning">

                                <Icon
                                    icon="lucide:circle-alert"
                                />

                            </div>

                            <h2>
                                Cancelar pedidos selecionados?
                            </h2>

                            <p>
                                Tem certeza que deseja cancelar
                                {" "}{selectedOrderIds.length} agendamento(s)?
                                Os clientes poderão ser notificados
                                sobre o cancelamento.
                            </p>

                            <div className="orders-confirm-actions">

                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowBulkCancelConfirm(
                                            false
                                        )
                                    }
                                >
                                    Voltar
                                </button>

                                <button
                                    type="button"
                                    className="warning"
                                    onClick={
                                        handleBulkCancel
                                    }
                                >
                                    Cancelar pedidos
                                </button>

                            </div>

                        </Modal>


            {/* =====================================================
                MODAL EXCLUSÃO EM LOTE
            ===================================================== */}

            <Modal
                open={showBulkDeleteConfirm}
                onClose={() => setShowBulkDeleteConfirm(false)}
                overlayClassName="orders-confirm-overlay"
                className="orders-confirm-modal"
            >

                            <div className="orders-confirm-icon danger">

                                <Icon
                                    icon="lucide:trash-2"
                                />

                            </div>

                            <h2>
                                Excluir pedidos selecionados?
                            </h2>

                            <p>
                                Tem certeza que deseja excluir
                                {" "}{selectedOrderIds.length} pedido(s)?
                                Essa ação não pode ser desfeita.
                            </p>

                            <div className="orders-confirm-actions">

                                <button
                                    type="button"
                                    onClick={() =>
                                        setShowBulkDeleteConfirm(
                                            false
                                        )
                                    }
                                >
                                    Voltar
                                </button>

                                <button
                                    type="button"
                                    className="danger"
                                    onClick={
                                        handleBulkDelete
                                    }
                                >
                                    Excluir pedidos
                                </button>

                            </div>

                        </Modal>


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

        <Modal
            open
            onClose={onClose}
            overlayClassName="orders-details-overlay"
            className="orders-details-modal"
            label="Detalhes do pedido"
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

        </Modal>

    );

};


export default Orders;