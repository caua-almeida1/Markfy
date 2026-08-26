import React, { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { getDatabase, ref, onValue, get, update, remove } from "firebase/database";
import { motion, AnimatePresence } from "framer-motion";
import "./orders.css";
import placeholder from "../../../img/1.jpg";
import Toast from "../../../components/toast/Toast";

const Orders = ({ company, initialOrder }) => {
    const [activeTab, setActiveTab] = useState("ativos");
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [orderToDelete, setOrderToDelete] = useState(null);
    const [openOrderDetails, setOpenOrderDetails] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [orderToCancel, setOrderToCancel] = useState(null);

    // FILTROS
    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isSortOpen, setIsSortOpen] = useState(false);

    const [selectedSort, setSelectedSort] = useState("dateAsc");
    const [tempSort, setTempSort] = useState("dateAsc");

    const [selectedPeriod, setSelectedPeriod] = useState("all");
    const [selectedProfessionals, setSelectedProfessionals] = useState([]);
    const [selectedServices, setSelectedServices] = useState([]);

    // filtros temporários (modal)
    const [tempPeriod, setTempPeriod] = useState("all");
    const [tempProfessionals, setTempProfessionals] = useState([]);
    const [tempServices, setTempServices] = useState([]);

    const periodOptions = [
        { id: "all", label: "Todos" },
        { id: "today", label: "Hoje" },
        { id: "tomorrow", label: "Amanhã" },
        { id: "week", label: "Esta semana" },
        { id: "next7", label: "Próximos 7 dias" },
        { id: "month", label: "Este mês" },
    ];

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

    const parseOrderDate = (order) => {
        if (!order.day) return null;

        const [day, month, year] = order.day.split("/").map(Number);

        return new Date(year, month - 1, day);
    };

    const [professionalSearch, setProfessionalSearch] = useState("");
    const [serviceSearch, setServiceSearch] = useState("");

    const professionals = [
        ...new Set(
            orders
                .map(order => order.professionalName)
                .filter(Boolean)
        )
    ];

    const services = [
        ...new Set(
            orders
                .map(order => order.productName)
                .filter(Boolean)
        )
    ];

    useEffect(() => {
        if (!company?.handle) return;

        const db = getDatabase();
        const schedulesRef = ref(db, `companys/${company.handle}/schedules`);

        const unsubscribe = onValue(schedulesRef, async (snapshot) => {
            const data = snapshot.val();
            if (!data) {
                setOrders([]);
                setLoading(false);
                return;
            }

            const productsRef = ref(db, `companys/${company.handle}/products`);
            const productsSnap = await get(productsRef);
            const productsData = productsSnap.exists() ? productsSnap.val() : {};

            const formatted = Object.entries(data).map(([id, item]) => {
                const product = productsData[item.productId] || {};
                const firstImage = Array.isArray(product.images)
                    ? product.images[0]
                    : product.images || placeholder;

                // ============ NOVA LÓGICA DE CÁLCULO DE HORÁRIO ============
                let endTimeDisplay = item.hour || "—";

                if (item.hour && product?.duration) {
                    const durationMinutes = Number(product.duration);
                    if (!isNaN(durationMinutes)) {
                        const [startHour, startMin] = item.hour.split(":").map(Number);
                        const totalMinutes = startHour * 60 + startMin + durationMinutes;
                        const endHour = Math.floor(totalMinutes / 60) % 24;
                        const endMin = totalMinutes % 60;
                        const formattedEnd = `${endHour.toString().padStart(2, "0")}:${endMin
                            .toString()
                            .padStart(2, "0")}`;

                        endTimeDisplay = `${item.hour} - ${formattedEnd}`;

                        // 🧾 Log detalhado da conta
                        console.log("📋 --- Cálculo de duração ---");
                        console.log("🕒 Início:", item.hour);
                        console.log("⏱️ Duração (min):", durationMinutes);
                        console.log("🧮 Total em minutos:", startHour * 60 + startMin, "+", durationMinutes, "=", totalMinutes);
                        console.log("➡️ Resultado:", endTimeDisplay);
                        console.log("---------------------------");
                    } else {
                        console.warn("⚠️ Duração inválida para o produto:", product.name, product.duration);
                    }
                } else {
                    console.warn("⚠️ Sem hora ou duração definida para o agendamento:", item);
                }
                // ===========================================================

                return {
                    id,
                    ...item,
                    productName: product.name || "Serviço",
                    productValue: product.value || "—",
                    productImage: firstImage || placeholder,
                    professionalName: item.professionalName || "Profissional",
                    duration: product.duration || null,
                    fullHour: endTimeDisplay,
                    statusDisplay:
                        item.status === "pending" || item.status === "ativos"
                            ? "ativos"
                            : item.status === "completed"
                                ? "completos"
                                : "cancelados",
                };
            });
            const sortedOrders = formatted.sort((a, b) => {
                try {
                    const [dayA, monthA, yearA] = (a.day || "").split("/").map(Number);
                    const [hourA, minuteA] = (a.hour || "00:00").split(":").map(Number);
                    const dateA = new Date(yearA, monthA - 1, dayA, hourA, minuteA);

                    const [dayB, monthB, yearB] = (b.day || "").split("/").map(Number);
                    const [hourB, minuteB] = (b.hour || "00:00").split(":").map(Number);
                    const dateB = new Date(yearB, monthB - 1, dayB, hourB, minuteB);

                    return dateA - dateB;
                } catch (err) {
                    console.error("Erro ao ordenar pedidos:", err);
                    return 0;
                }
            });

            setOrders(sortedOrders);

            setLoading(false);
        });

        return () => unsubscribe();
    }, [company]);

    useEffect(() => {
        if (initialOrder) {
            setOpenOrderDetails(initialOrder);
        }
    }, [initialOrder]);

    const handleComplete = async (order) => {

        try {

            const db = getDatabase();

            const orderRef = ref(
                db,
                `companys/${company.handle}/schedules/${order.id}`
            );

            await update(orderRef, {
                status: "completed"
            });

            openToast(
                "success",
                "Pedido concluído",
                "O atendimento foi finalizado com sucesso."
            );

        } catch {

            openToast(
                "error",
                "Erro",
                "Não foi possível concluir o pedido."
            );

        }

    };

    const handleCancel = async (order) => {

        try {

            const db = getDatabase();

            const orderRef = ref(
                db,
                `companys/${company.handle}/schedules/${order.id}`
            );

            await update(orderRef, {
                status: "cancelados"
            });

            openToast(
                "success",
                "Pedido cancelado",
                "O agendamento foi cancelado com sucesso."
            );

        } catch {

            openToast(
                "error",
                "Erro",
                "Não foi possível cancelar o pedido."
            );

        }

    };

    const handleDelete = async () => {

        if (!orderToDelete) return;

        try {

            const db = getDatabase();

            const orderRef = ref(
                db,
                `companys/${company.handle}/schedules/${orderToDelete.id}`
            );

            await remove(orderRef);

            setOrderToDelete(null);

            openToast(
                "success",
                "Pedido excluído",
                "O agendamento foi removido com sucesso."
            );

        } catch {

            openToast(
                "error",
                "Erro",
                "Não foi possível excluir o pedido."
            );

        }

    };

    const filteredOrders = orders
        .filter((order) => {

            // Aba
            const matchesTab = order.statusDisplay === activeTab;

            // Pesquisa
            const matchesSearch =
                searchTerm === "" ||
                order.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.userName?.toLowerCase().includes(searchTerm.toLowerCase());

            // Profissional
            const matchesProfessional =
                selectedProfessionals.length === 0 ||
                selectedProfessionals.includes(order.professionalName);

            // Serviço
            const matchesService =
                selectedServices.length === 0 ||
                selectedServices.includes(order.productName);

            // Período
            let matchesPeriod = true;

            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);

            const orderDate = parseOrderDate(order);

            if (orderDate) {

                orderDate.setHours(0, 0, 0, 0);

                switch (selectedPeriod) {

                    case "today":
                        matchesPeriod =
                            orderDate.getTime() === today.getTime();
                        break;

                    case "tomorrow":
                        matchesPeriod =
                            orderDate.getTime() === tomorrow.getTime();
                        break;

                    case "week": {

                        const endWeek = new Date(today);
                        endWeek.setDate(today.getDate() + 7);

                        matchesPeriod =
                            orderDate >= today &&
                            orderDate <= endWeek;

                        break;
                    }

                    case "next7": {

                        const next7 = new Date(today);
                        next7.setDate(today.getDate() + 7);

                        matchesPeriod =
                            orderDate >= today &&
                            orderDate <= next7;

                        break;
                    }

                    case "month":

                        matchesPeriod =
                            orderDate.getMonth() === today.getMonth() &&
                            orderDate.getFullYear() === today.getFullYear();

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

                    const dateA = new Date(
                        `${a.day.split("/").reverse().join("-")}T${a.hour || "00:00"}`
                    );

                    const dateB = new Date(
                        `${b.day.split("/").reverse().join("-")}T${b.hour || "00:00"}`
                    );

                    return dateA - dateB;
                }

                case "dateDesc": {

                    const dateA = new Date(
                        `${a.day.split("/").reverse().join("-")}T${a.hour || "00:00"}`
                    );

                    const dateB = new Date(
                        `${b.day.split("/").reverse().join("-")}T${b.hour || "00:00"}`
                    );

                    return dateB - dateA;
                }

                case "nameAsc":
                    return (a.userName || "").localeCompare(b.userName || "");

                case "nameDesc":
                    return (b.userName || "").localeCompare(a.userName || "");

                case "serviceAsc":
                    return (a.productName || "").localeCompare(b.productName || "");

                case "serviceDesc":
                    return (b.productName || "").localeCompare(a.productName || "");

                case "priceAsc": {

                    const priceA = Number(
                        (a.productValue || "")
                            .replace(/[^\d,]/g, "")
                            .replace(/\./g, "")
                            .replace(",", ".")
                    );

                    const priceB = Number(
                        (b.productValue || "")
                            .replace(/[^\d,]/g, "")
                            .replace(/\./g, "")
                            .replace(",", ".")
                    );

                    return priceA - priceB;
                }

                case "priceDesc": {

                    const priceA = Number(
                        (a.productValue || "")
                            .replace(/[^\d,]/g, "")
                            .replace(/\./g, "")
                            .replace(",", ".")
                    );

                    const priceB = Number(
                        (b.productValue || "")
                            .replace(/[^\d,]/g, "")
                            .replace(/\./g, "")
                            .replace(",", ".")
                    );

                    return priceB - priceA;
                }

                default:
                    return 0;

            }

        });

    useEffect(() => {
        if (openOrderDetails) {
            console.log("Produto aberto:", openOrderDetails.productName);
            console.log("Duration (minutos):", openOrderDetails.duration);
        }
    }, [openOrderDetails]);

    if (loading) {
        return <div className="orders-page"><p>Carregando pedidos...</p></div>;
    }

    const truncate = (text, max = 16) => {
        if (!text) return "—";
        return text.length > max ? `${text.slice(0, max)}...` : text;
    };



    return (
        <div className="orders-page">
            <header className="orders-header">
                <div className="header-content">
                    <h1>Pedidos</h1>
                    <div className="orders-header-tabs">
                        {["ativos", "completos", "cancelados"].map((tab) => (
                            <button
                                key={tab}
                                className={activeTab === tab ? "active" : ""}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>


            </header>

            <div className="orders-search-bar">
                <Icon icon="tabler:search" className="icon search-icon" />
                <input
                    type="text"
                    placeholder="Pesquisar por cliente ou produto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>


            <div className="orders-actions-bar">
                <button
                    className="orders-action-button"
                    onClick={() => {

                        setTempPeriod(selectedPeriod);
                        setTempProfessionals(selectedProfessionals);
                        setTempServices(selectedServices);

                        setIsFilterOpen(true);

                    }}
                >
                    <Icon icon="mage:filter-fill" className="icon" />
                    Filtrar
                </button>

                <button
                    className="orders-action-button"
                    onClick={() => {
                        setTempSort(selectedSort);
                        setIsSortOpen(true);
                    }}
                >
                    <Icon icon="tabler:arrows-sort" className="icon" />
                    Ordenar
                </button>

            </div>

            <div className="orders-filter-chips">

                {selectedPeriod !== "all" && (
                    <button
                        className="orders-filter-chip"
                        onClick={() => setSelectedPeriod("all")}
                    >
                        {periodOptions.find(p => p.id === selectedPeriod)?.label}

                        <Icon
                            icon="mingcute:close-line"
                            className="icon"
                        />
                    </button>
                )}

                {selectedProfessionals.map((professional) => (
                    <button
                        key={professional}
                        className="orders-filter-chip"
                        onClick={() =>
                            setSelectedProfessionals(prev =>
                                prev.filter(item => item !== professional)
                            )
                        }
                    >
                        {truncate(professional, 14)}

                        <Icon
                            icon="mingcute:close-line"
                            className="icon"
                        />
                    </button>
                ))}

                {selectedServices.map((service) => (
                    <button
                        key={service}
                        className="orders-filter-chip"
                        onClick={() =>
                            setSelectedServices(prev =>
                                prev.filter(item => item !== service)
                            )
                        }
                    >
                        {truncate(service, 18)}

                        <Icon
                            icon="mingcute:close-line"
                            className="icon"
                        />
                    </button>
                ))}

            </div>

            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3 }}
                    className="orders-content"
                >
                    {filteredOrders.length > 0 ? (
                        filteredOrders.map((order) => (
                            <div className="order-card" key={order.id}>
                                <div className="order-card-header">
                                    <img
                                        src={order.productImage || placeholder}
                                        alt={order.productName}
                                    />
                                    <div className="order-card-infos-product">
                                        <div className="order-card-product-name-status">
                                            <h3>{order.productName}</h3>

                                            <Icon
                                                icon="tabler:dots"
                                                className="icon dots-icon"
                                                onClick={() => setOpenOrderDetails(order)}
                                            />
                                        </div>

                                        <div className="order-info-description">
                                            <div className="order-info-description-line-flex">
                                                <div className="order-description-item">
                                                    <Icon icon="tabler:clock-hour-4-filled" className="icon" />
                                                    {order.fullHour || order.hour || "—"}

                                                </div>
                                                <div className="order-description-item">
                                                    <Icon icon="lets-icons:date-fill" className="icon" />
                                                    {order.day || "—"}
                                                </div>
                                            </div>
                                            <div className="order-description-item">
                                                <Icon icon="eos-icons:master" className="icon" />
                                                <span className="professional-name">
                                                    {order.professionalName}
                                                </span>

                                                <p className="order-description-item">
                                                    <Icon icon="jam:coin-f" className="icon" />
                                                    {order.productValue}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="order-card-footer">
                                    {(activeTab === "completos" || activeTab === "cancelados") && (
                                        <button
                                            className="order-cancel-button"
                                            onClick={() => setOrderToDelete(order)}
                                        >
                                            Excluir
                                        </button>
                                    )}

                                    {activeTab === "ativos" && (
                                        <>
                                            <button
                                                className="order-cancel-button order"
                                                onClick={() => setOrderToCancel(order)}
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                className="order-view-button"
                                                onClick={() => handleComplete(order)}
                                            >
                                                Completar Pedido
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))
                    ) : (
                        <p>Nenhum pedido encontrado para esta aba.</p>
                    )}
                </motion.div>
            </AnimatePresence>

            <AnimatePresence>

                {isSortOpen && (

                    <motion.div
                        className="orders-filter-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsSortOpen(false)}
                    >

                        <motion.div
                            className="orders-filter-modal"
                            onClick={(e) => e.stopPropagation()}
                            initial={{ scale: .9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: .9, opacity: 0 }}
                        >

                            <div className="orders-filter-header">

                                <h2>Ordenar pedidos</h2>

                                <button onClick={() => setIsSortOpen(false)}>
                                    <Icon icon="mingcute:close-line" />
                                </button>

                            </div>

                            <div className="orders-filter-content">

                                <div className="orders-filter-options">

                                    {sortOptions.map(option => (

                                        <button
                                            key={option.id}
                                            className={`orders-filter-option ${tempSort === option.id ? "active" : ""
                                                }`}
                                            onClick={() => setTempSort(option.id)}
                                        >

                                            {option.label}

                                            {tempSort === option.id && (
                                                <Icon
                                                    icon="mingcute:check-fill"
                                                    className="icon"
                                                />
                                            )}

                                        </button>

                                    ))}

                                </div>

                            </div>

                            <div className="orders-filter-footer">

                                <button
                                    className="orders-filter-clear"
                                    onClick={() => setTempSort("dateAsc")}
                                >
                                    Padrão
                                </button>

                                <button
                                    className="orders-filter-apply"
                                    onClick={() => {

                                        setSelectedSort(tempSort);
                                        setIsSortOpen(false);

                                    }}
                                >
                                    Aplicar
                                </button>

                            </div>

                        </motion.div>

                    </motion.div>

                )}

            </AnimatePresence>

            <AnimatePresence>
                {openOrderDetails && (
                    <motion.div
                        className="order-details-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={(e) => {
                            if (e.target.classList.contains("order-details-overlay")) {
                                setOpenOrderDetails(null);
                            }
                        }}
                    >
                        <motion.div
                            className="order-details-container"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 250, damping: 25 }}
                        >
                            {/* ===== HEADER FIXO ===== */}
                            <header className="order-details-header">
                                <div className="order-details-header-content">
                                    <div>
                                        <h3 className="order-details-title">Detalhes do Agendamento</h3>
                                        <p className="order-details-id">ID: {openOrderDetails.id}</p>
                                    </div>

                                    {/* Ícone X para fechar */}
                                    <button
                                        className="order-details-close-icon"
                                        onClick={() => setOpenOrderDetails(null)}
                                        aria-label="Fechar"
                                    >
                                        ✕
                                    </button>
                                </div>
                            </header>

                            {/* ===== CONTEÚDO SCROLLÁVEL ===== */}
                            <div className="order-details-scrollable">
                                <h3 className="order-section-title">Informações do Serviço</h3>
                                <section className="order-details-service">
                                    <img
                                        src={openOrderDetails.productImage}
                                        alt={openOrderDetails.productName}
                                        className="order-details-image"
                                    />

                                    <div className="order-details-service-info">
                                        <div className="order-service-row">
                                            <span className="order-service-label">Serviço:</span>
                                            <span className="order-service-value">
                                                {truncate(openOrderDetails.productName, 18)}
                                            </span>
                                        </div>

                                        <div className="order-service-row">
                                            <span className="order-service-label">Valor:</span>
                                            <span className="order-service-value">{openOrderDetails.productValue}</span>
                                        </div>

                                        <div className="order-service-row">
                                            <span className="order-service-label">Profissional:</span>
                                            <span className="order-service-value">
                                                {truncate(openOrderDetails.professionalName, 16)}
                                            </span>
                                        </div>
                                    </div>
                                </section>

                                <h3 className="order-section-title">Informações do Agendamento</h3>
                                <section className="order-details-info">
                                    <div className="order-info-row">
                                        <span className="order-info-label">Data:</span>
                                        <span className="order-info-value">
                                            {openOrderDetails.dayLabel || openOrderDetails.day}
                                        </span>
                                    </div>

                                    <div className="order-info-row">
                                        <span className="order-info-label">Horário:</span>
                                        <span className="order-info-value">  {openOrderDetails.fullHour || openOrderDetails.hour}
                                        </span>
                                    </div>

                                    <div className="order-info-row">
                                        <span className="order-info-label">Cliente:</span>
                                        <span className="order-info-value">
                                            {truncate(openOrderDetails.userName, 16)}
                                        </span>
                                    </div>

                                    <div className="order-info-row">
                                        <span className="order-info-label">Status:</span>
                                        <span className="order-info-value">{openOrderDetails.statusDisplay}</span>
                                    </div>
                                </section>
                            </div>

                            {/* ===== BOTÕES AÇÕES ===== */}
                            <div className="order-details-actions">
                                <button
                                    className="order-details-delete-btn"
                                    onClick={() => {
                                        setOrderToDelete(openOrderDetails);
                                        setOpenOrderDetails(null);
                                    }}
                                >
                                    Excluir
                                </button>

                                {openOrderDetails.statusDisplay === "ativos" && (
                                    <button
                                        className="order-details-complete-btn"
                                        onClick={() => handleComplete(openOrderDetails)}
                                    >
                                        Completar Pedido
                                    </button>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {orderToDelete && (
                    <motion.div
                        className="orders-modal__overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="orders-modal__container"
                            initial={{ scale: 0.7, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.7, opacity: 0 }}
                            transition={{ type: "spring", stiffness: 300, damping: 25 }}
                        >
                            <h3 className="orders-modal__title">Excluir pedido?</h3>
                            <p className="orders-modal__message">
                                Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.
                            </p>
                            <div className="orders-modal__buttons">
                                <button className="orders-modal__btn--delete" onClick={handleDelete}>
                                    Excluir
                                </button>
                                <button className="orders-modal__btn--cancel" onClick={() => setOrderToDelete(null)}>
                                    Cancelar
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {orderToCancel && (
                    <motion.div
                        className="orders-modal__overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <motion.div
                            className="orders-modal__container"
                            initial={{
                                scale: 0.75,
                                opacity: 0,
                                y: 20
                            }}
                            animate={{
                                scale: 1,
                                opacity: 1,
                                y: 0
                            }}
                            exit={{
                                scale: 0.75,
                                opacity: 0,
                                y: 20
                            }}
                            transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 24
                            }}
                        >
                            <h3 className="orders-modal__title">
                                Cancelar pedido?
                            </h3>

                            <p className="orders-modal__message">
                                Tem certeza que deseja cancelar este pedido?
                                O cliente poderá ser notificado sobre o cancelamento.
                            </p>

                            <div className="orders-modal__buttons">

                                <button
                                    className="orders-modal__btn--delete"
                                    onClick={async () => {

                                        await handleCancel(orderToCancel);

                                        setOrderToCancel(null);

                                    }}
                                >
                                    Cancelar Pedido
                                </button>

                                <button
                                    className="orders-modal__btn--cancel"
                                    onClick={() => setOrderToCancel(null)}
                                >
                                    Voltar
                                </button>

                            </div>

                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <AnimatePresence>
                {isFilterOpen && (
                    <motion.div
                        className="orders-filter-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setIsFilterOpen(false)}
                    >
                        <motion.div
                            className="orders-filter-modal"
                            onClick={(e) => e.stopPropagation()}
                            initial={{
                                y: window.innerWidth <= 768 ? 100 : 0,
                                scale: window.innerWidth > 768 ? .9 : 1,
                                opacity: 0
                            }}
                            animate={{
                                y: 0,
                                scale: 1,
                                opacity: 1
                            }}
                            exit={{
                                y: window.innerWidth <= 768 ? 100 : 0,
                                scale: window.innerWidth > 768 ? .9 : 1,
                                opacity: 0
                            }}
                            transition={{
                                duration: .28
                            }}
                        >

                            <div className="orders-filter-header">

                                <h2>Filtrar pedidos</h2>

                                <button onClick={() => setIsFilterOpen(false)}>
                                    <Icon icon="mingcute:close-line" />
                                </button>

                            </div>

                            <div className="orders-filter-content">

                                <section className="orders-filter-section">

                                    <h3>Período</h3>

                                    <div className="orders-filter-options">
                                        {periodOptions.map((period) => (
                                            <button
                                                key={period.id}
                                                className={`orders-filter-option ${tempPeriod === period.id ? "active" : ""
                                                    }`}
                                                onClick={() => setTempPeriod(period.id)}
                                            >
                                                {period.label}

                                                {tempPeriod === period.id && (
                                                    <Icon
                                                        icon="mingcute:check-fill"
                                                        className="icon"
                                                    />
                                                )}
                                            </button>
                                        ))}
                                    </div>

                                </section>

                                <section className="orders-filter-section">

                                    <h3>Profissional</h3>

                                    <input
                                        type="text"
                                        placeholder="Pesquisar profissional..."
                                        value={professionalSearch}
                                        onChange={(e) => setProfessionalSearch(e.target.value)}
                                    />

                                    <div className="orders-filter-list">
                                        {professionals
                                            .filter(name =>
                                                name.toLowerCase().includes(professionalSearch.toLowerCase())
                                            )
                                            .map(name => (

                                                <button
                                                    key={name}
                                                    className={`orders-filter-option ${tempProfessionals.includes(name) ? "active" : ""
                                                        }`}
                                                    onClick={() =>
                                                        setTempProfessionals(prev =>
                                                            prev.includes(name)
                                                                ? prev.filter(item => item !== name)
                                                                : [...prev, name]
                                                        )
                                                    }
                                                >
                                                    <span>{truncate(name, 14)}</span>

                                                    {tempProfessionals.includes(name) && (
                                                        <Icon
                                                            icon="mingcute:check-fill"
                                                            className="icon"
                                                        />
                                                    )}

                                                </button>

                                            ))}
                                    </div>

                                </section>

                                <section className="orders-filter-section">

                                    <h3>Serviço</h3>

                                    <input
                                        type="text"
                                        placeholder="Pesquisar serviço..."
                                        value={serviceSearch}
                                        onChange={(e) => setServiceSearch(e.target.value)}
                                    />

                                    <div className="orders-filter-list">
                                        {services
                                            .filter(name =>
                                                name.toLowerCase().includes(serviceSearch.toLowerCase())
                                            )
                                            .map(name => (

                                                <button
                                                    key={name}
                                                    className={`orders-filter-option ${tempServices.includes(name) ? "active" : ""
                                                        }`}
                                                    onClick={() =>
                                                        setTempServices(prev =>
                                                            prev.includes(name)
                                                                ? prev.filter(item => item !== name)
                                                                : [...prev, name]
                                                        )
                                                    }
                                                >
                                                    <span>{truncate(name, 18)}</span>

                                                    {tempServices.includes(name) && (
                                                        <Icon
                                                            icon="mingcute:check-fill"
                                                            className="icon"
                                                        />
                                                    )}

                                                </button>

                                            ))}
                                    </div>

                                </section>

                            </div>

                            <div className="orders-filter-footer">

                                <button
                                    className="orders-filter-clear"
                                    onClick={() => {

                                        setTempPeriod("all");
                                        setTempProfessionals([]);
                                        setTempServices([]);

                                    }}
                                >
                                    Limpar
                                </button>

                                <button
                                    className="orders-filter-apply"
                                    onClick={() => {

                                        setSelectedPeriod(tempPeriod);
                                        setSelectedProfessionals(tempProfessionals);
                                        setSelectedServices(tempServices);

                                        setIsFilterOpen(false);

                                    }}
                                >
                                    Aplicar filtros
                                </button>

                            </div>

                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Toast
                show={showToast}
                type={toastType}
                title={toastTitle}
                message={toastMessage}
                onClose={() => setShowToast(false)}
            />
        </div>
    );
};

export const OrderDetailsModal = ({ order, onClose, onComplete, onCancel }) => {
    if (!order) return null;

    const truncate = (text, max = 16) => {
        if (!text) return "—";
        return text.length > max ? `${text.slice(0, max)}...` : text;
    };

    return (
        <motion.div
            className="order-details-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
                if (e.target.classList.contains("order-details-overlay")) onClose();
            }}
        >
            <motion.div
                className="order-details-container"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", stiffness: 250, damping: 25 }}
            >
                <header className="order-details-header">
                    <div className="order-details-header-content">
                        <div>
                            <h3 className="order-details-title">Detalhes do Agendamento</h3>
                            <p className="order-details-id">ID: {order.id}</p>
                        </div>

                        <button
                            className="order-details-close-icon"
                            onClick={onClose}
                            aria-label="Fechar"
                        >
                            ✕
                        </button>
                    </div>
                </header>

                <div className="order-details-scrollable">
                    <h3 className="order-section-title">Informações do Serviço</h3>
                    <section className="order-details-service">
                        <img
                            src={order.productImage}
                            alt={order.productName}
                            className="order-details-image"
                        />
                        <div className="order-details-service-info">
                            <div className="order-service-row">
                                <span className="order-service-label">Serviço:</span>
                                <span className="order-service-value">
                                    {truncate(order.productName, 18)}
                                </span>                            </div>
                            <div className="order-service-row">
                                <span className="order-service-label">Valor:</span>
                                <span className="order-service-value">{order.productValue}</span>
                            </div>
                            <div className="order-service-row">
                                <span className="order-service-label">Cliente:</span>
                                <span className="order-service-value">
                                    {truncate(order.clientName, 16)}
                                </span>
                            </div>
                        </div>
                    </section>

                    <h3 className="order-section-title">Informações do Agendamento</h3>
                    <section className="order-details-info">
                        <div className="order-info-row">
                            <span className="order-info-label">Data:</span>
                            <span className="order-info-value">{order.day}</span>
                        </div>
                        <div className="order-info-row">
                            <span className="order-info-label">Horário:</span>
                            <span className="order-info-value">{order.fullHour || order.hour}</span>
                        </div>
                        <div className="order-info-row">
                            <span className="order-info-label">Status:</span>
                            <span className="order-info-value">{order.status}</span>
                        </div>
                    </section>

                    <div className="order-details-actions">
                        <button className="order-cancel-button" onClick={() => onCancel(order)}>
                            Cancelar
                        </button>
                        <button className="order-view-button" onClick={() => onComplete(order)}>
                            Completar Pedido
                        </button>
                    </div>

                </div>
            </motion.div>
        </motion.div>
    );
};

export default Orders;
