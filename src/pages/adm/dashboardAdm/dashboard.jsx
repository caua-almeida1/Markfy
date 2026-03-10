import React, { useState, useEffect } from 'react';
import './DashboardAdm.css';
import { Icon } from '@iconify/react';
import { getAuth } from "firebase/auth";
import { getDatabase, ref, onValue, get, update, remove } from "firebase/database";
import { motion, AnimatePresence } from "framer-motion";

import MaleEmoji1 from "../../../img/MEMOJIS PACK/males/emoji (1).svg";
import MaleEmoji2 from "../../../img/MEMOJIS PACK/males/emoji (2).svg";
import MaleEmoji3 from "../../../img/MEMOJIS PACK/males/emoji (3).svg";
import MaleEmoji4 from "../../../img/MEMOJIS PACK/males/emoji (4).svg";
import MaleEmoji5 from "../../../img/MEMOJIS PACK/males/emoji (5).svg";
import placeholder from "../../../img/product-details/not-professional.png";

import { OrderDetailsModal } from "../ordersAdm/orders";

const Dashboard = ({ activeTab, setActiveTab }) => {
    const [showBalance, setShowBalance] = useState(false);
    const [transitioning, setTransitioning] = useState(false);
    const [userName, setUserName] = useState("");
    const [saldoEstimado, setSaldoEstimado] = useState("0,00");
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);

    const toggleVisibility = () => {
        setTransitioning(true);
        setTimeout(() => {
            setShowBalance(!showBalance);
            setTransitioning(false);
        }, 400);
    };

    const getGreeting = () => {
        const currentHour = new Date().getHours();
        if (currentHour < 12) return 'Bom dia';
        if (currentHour < 18) return 'Boa tarde';
        return 'Boa noite';
    };

    useEffect(() => {
        const auth = getAuth();
        const user = auth.currentUser;
        if (user) {
            const db = getDatabase();

            const userRef = ref(db, `users/${user.uid}`);
            get(userRef)
                .then(snapshot => {
                    if (snapshot.exists()) {
                        const data = snapshot.val();
                        setUserName(data.name || "Usuário");
                    } else {
                        setUserName("Usuário");
                    }
                })
                .catch(error => {
                    console.error("Erro ao buscar nome:", error);
                    setUserName("Usuário");
                });

            const companiesRef = ref(db, "companys");

            // 🔹 Listener em tempo real para todas as empresas
            const unsubscribe = onValue(companiesRef, (snapshot) => {
                if (snapshot.exists()) {
                    const companiesData = snapshot.val();
                    let totalValue = 0;
                    const professionalOrders = [];

                    for (const companyKey of Object.keys(companiesData)) {
                        const company = companiesData[companyKey];
                        const schedules = company.schedules || {};
                        const products = company.products || {};

                        Object.keys(schedules).forEach(scheduleId => {
                            const schedule = schedules[scheduleId];

                            if (schedule.professionalId === user.uid && schedule.status === "pending") {
                                const product = products[schedule.productId] || {};
                                const productImage = Array.isArray(product.images)
                                    ? product.images[0]
                                    : product.images || placeholder;

                                // 🕒 === LÓGICA PARA CALCULAR O HORÁRIO FINAL ===
                                let endTimeDisplay = schedule.hour || "—";

                                if (schedule.hour && product?.duration) {
                                    const durationMinutes = Number(product.duration);
                                    if (!isNaN(durationMinutes)) {
                                        const [startHour, startMin] = schedule.hour.split(":").map(Number);
                                        const totalMinutes = startHour * 60 + startMin + durationMinutes;
                                        const endHour = Math.floor(totalMinutes / 60) % 24;
                                        const endMin = totalMinutes % 60;
                                        const formattedEnd = `${endHour.toString().padStart(2, "0")}:${endMin
                                            .toString()
                                            .padStart(2, "0")}`;

                                        endTimeDisplay = `${schedule.hour} - ${formattedEnd}`;
                                    }
                                }

                                // ✅ Adiciona o pedido com fullHour incluído
                                professionalOrders.push({
                                    id: scheduleId,
                                    productName: product.name || "Serviço",
                                    productValue: schedule.productPrice || "—",
                                    productImage,
                                    day: schedule.day || "—",
                                    hour: schedule.hour || "—",
                                    fullHour: endTimeDisplay, // 👈 importante!
                                    clientName: schedule.userName || "Cliente",
                                    status: schedule.status || "pending",
                                    companyName: company.name || "",
                                });

                                // 🔍 Debug opcional
                                console.log("⏰ Início:", schedule.hour);
                                console.log("🕒 Duração:", product.duration);
                                console.log("➡️ Resultado:", endTimeDisplay);
                            }

                            // ✅ Soma apenas os concluídos para o saldo estimado
                            if (schedule.professionalId === user.uid && schedule.status === "completed" && schedule.productPrice) {
                                const numericPrice = parseFloat(
                                    schedule.productPrice
                                        .replace("R$", "")
                                        .replace(".", "")
                                        .replace(",", ".")
                                        .trim()
                                );
                                totalValue += numericPrice;
                            }
                        });
                    }

                    const sortedOrders = professionalOrders.sort((a, b) => {
                        try {
                            // Converter "day" e "hour" em objetos Date
                            const [dayA, monthA, yearA] = a.day.split("/").map(Number);
                            const [hourA, minuteA] = a.hour.split(":").map(Number);
                            const dateA = new Date(yearA, monthA - 1, dayA, hourA, minuteA);

                            const [dayB, monthB, yearB] = b.day.split("/").map(Number);
                            const [hourB, minuteB] = b.hour.split(":").map(Number);
                            const dateB = new Date(yearB, monthB - 1, dayB, hourB, minuteB);

                            // Ordena do mais próximo para o mais distante
                            return dateA - dateB;
                        } catch (err) {
                            console.error("Erro ao ordenar pedidos:", err);
                            return 0;
                        }
                    });

                    setOrders(sortedOrders); 
                    setSaldoEstimado(
                        totalValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    );
                } else {
                    setSaldoEstimado("R$ 0,00");
                    setOrders([]);
                }
            }, (error) => {
                console.error("Erro ao ouvir empresas:", error);
                setSaldoEstimado("R$ 0,00");
                setOrders([]);
            });

            // 🔹 Cleanup — remove o listener ao desmontar o componente
            return () => unsubscribe();

        }
    }, []);

    const handleCompleteOrder = async (order) => {
        const db = getDatabase();
        const companyRef = ref(db, "companys");
        const snapshot = await get(companyRef);

        if (snapshot.exists()) {
            const companies = snapshot.val();
            for (const companyKey in companies) {
                const schedules = companies[companyKey].schedules || {};
                if (schedules[order.id]) {
                    await update(ref(db, `companys/${companyKey}/schedules/${order.id}`), { status: "completed" });
                    setSelectedOrder(null);
                    return;
                }
            }
        }
    };

    const handleCancelOrder = async (order) => {
        const db = getDatabase();
        const companyRef = ref(db, "companys");
        const snapshot = await get(companyRef);

        if (snapshot.exists()) {
            const companies = snapshot.val();
            for (const companyKey in companies) {
                const schedules = companies[companyKey].schedules || {};
                if (schedules[order.id]) {
                    await update(ref(db, `companys/${companyKey}/schedules/${order.id}`), { status: "cancelados" });
                    setSelectedOrder(null);
                    return;
                }
            }
        }
    };


    const admins = [
        { id: 1, name: 'Thales Silva', img: MaleEmoji1 },
        { id: 2, name: 'Maria Oliveira', img: MaleEmoji2 },
        { id: 3, name: 'Carlos Almeida', img: MaleEmoji3 },
        { id: 4, name: 'Ana Costa', img: MaleEmoji4 },
        { id: 5, name: 'Fernanda Ramos Ola ola ola', img: MaleEmoji5 },
    ];

    return (
        <div className="dashboard-page">
            <header className="dashboard-adm-header">
                <div className="dashboard-adm-header-content">
                    <div className="dashboard-adm-header-description">
                        <p>Olá, {userName}</p>
                        <h1>{getGreeting()}!</h1>
                    </div>

                    {/* <div className="icon-container">
                        <Icon icon="ph:bell-bold" className="icon" />
                        <span className="notification-circle">9+</span>
                    </div> */}
                </div>
            </header>

            <div className="dashboard-content">
                <div className="dashboard-top-content">
                    <p>Saldo Estimado</p>
                    <div className="dashboard-top-content-wallet">
                        <h1 className={`wallet-balance ${transitioning ? 'hidden' : 'visible'}`}>
                            {showBalance ? saldoEstimado : '******'}
                        </h1>
                        <div className={`icon-container ${showBalance ? 'active' : ''}`}>
                            <span className="icon-background"></span>
                            <Icon
                                icon={showBalance ? 'mdi:eye' : 'mdi:eye-off'}
                                className="icon"
                                onClick={toggleVisibility}
                            />
                        </div>
                    </div>
                </div>

                <div className="dashboard-mid-content">
                    <div className="dashboard-mid-products">
                        <h1>Administradores</h1>
                        <div className="dashboard-products-list-content">
                            <button>
                                <Icon icon="mynaui:plus" className="icon" />
                            </button>
                            <div className="dashboard-admins-list">
                                {admins.map((admin) => (
                                    <div key={admin.id} className="dashboard-adm-item">
                                        <img src={admin.img} alt={`Imagem de ${admin.name}`} />
                                        <h1>{admin.name.length > 14 ? `${admin.name.slice(0, 14)}...` : admin.name}</h1>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className='dashboard-buttons-actions'>
                        <button><Icon icon="ph:hand-coins" className='icon' /> Transações</button>
                        <button onClick={() => setActiveTab("produtos", { openModal: true })}>
                            <Icon icon="tabler:user" className='icon' />
                            Novo Produto
                        </button>
                    </div>

                    <div className="dashboard-card-section">
                        <div className='dashboard-card-section-header'>
                            <h1>Pedidos</h1>
                            <p onClick={() => setActiveTab("pedidos")}>Ver Mais</p>
                        </div>

                        <div className="dashboard-cards">
                            {orders.length > 0 ? (
                                orders.slice(0, 4).map((order) => (
                                    <div key={order.id}
                                        className="dashboard-card"
                                        onClick={() => setSelectedOrder(order)} >
                                        <h2>{order.clientName}</h2>
                                        <div className='dashboard-content-price-time'>
                                            <p className='dashboard-card-time'>
                                                {order.hour} - {order.day}
                                            </p>
                                            <p className='dashboard-card-price'>{order.productValue}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="no-orders">Nenhum pedido encontrado</p>
                            )}
                        </div>
                    </div>
                </div>

            </div>
            <AnimatePresence>
                {selectedOrder && (
                    <OrderDetailsModal
                        order={selectedOrder}
                        onClose={() => setSelectedOrder(null)}
                        onComplete={handleCompleteOrder}
                        onCancel={handleCancelOrder}
                    />
                )}
            </AnimatePresence>

        </div>

    );
};

export default Dashboard;
