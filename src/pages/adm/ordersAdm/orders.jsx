import React, { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { getDatabase, ref, onValue, get, update, remove } from "firebase/database";
import { motion, AnimatePresence } from "framer-motion";
import "./orders.css";
import placeholder from "../../../img/product-details/not-professional.png";

const Orders = ({ company, initialOrder }) => {
    const [activeTab, setActiveTab] = useState("ativos");
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [orderToDelete, setOrderToDelete] = useState(null);
    const [openOrderDetails, setOpenOrderDetails] = useState(null);
    const [searchTerm, setSearchTerm] = useState("");

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
        const db = getDatabase();
        const orderRef = ref(db, `companys/${company.handle}/schedules/${order.id}`);
        await update(orderRef, { status: "completed" });
    };

    const handleCancel = async (order) => {
        const db = getDatabase();
        const orderRef = ref(db, `companys/${company.handle}/schedules/${order.id}`);
        await update(orderRef, { status: "cancelados" });
    };

    const handleDelete = async () => {
        if (!orderToDelete) return;
        const db = getDatabase();
        const orderRef = ref(db, `companys/${company.handle}/schedules/${orderToDelete.id}`);
        await remove(orderRef);
        setOrderToDelete(null);
    };

    const filteredOrders = orders.filter((order) => {
        const matchesTab = order.statusDisplay === activeTab;
        const matchesSearch =
            order.productName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            order.userName?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesTab && (searchTerm === "" || matchesSearch);
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
                                                {order.professionalName}

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
                                                onClick={() => handleCancel(order)}
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
                                            <span className="order-service-value">{openOrderDetails.productName}</span>
                                        </div>

                                        <div className="order-service-row">
                                            <span className="order-service-label">Valor:</span>
                                            <span className="order-service-value">{openOrderDetails.productValue}</span>
                                        </div>

                                        <div className="order-service-row">
                                            <span className="order-service-label">Profissional:</span>
                                            <span className="order-service-value">{openOrderDetails.professionalName}</span>
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
                                        <span className="order-info-value">{openOrderDetails.userName}</span>
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
        </div>
    );
};

export const OrderDetailsModal = ({ order, onClose, onComplete, onCancel }) => {
    if (!order) return null;

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
                                <span className="order-service-value">{order.productName}</span>
                            </div>
                            <div className="order-service-row">
                                <span className="order-service-label">Valor:</span>
                                <span className="order-service-value">{order.productValue}</span>
                            </div>
                            <div className="order-service-row">
                                <span className="order-service-label">Cliente:</span>
                                <span className="order-service-value">{order.clientName}</span>
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
