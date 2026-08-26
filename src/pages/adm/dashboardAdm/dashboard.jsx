import React, { useState, useEffect } from 'react';
import './DashboardAdm.css';
import { Icon } from '@iconify/react';
import { getAuth } from "firebase/auth";
import {
    getStorage,
    ref as storageRef,
    getDownloadURL,
} from "firebase/storage";
import { getDatabase, ref, onValue, get, set, push, update, remove } from "firebase/database";
import { motion, AnimatePresence } from "framer-motion";
import emailjs from "@emailjs/browser";
import { useNavigate } from "react-router-dom";

import MaleEmoji1 from "../../../img/MEMOJIS PACK/males/emoji (1).svg";
import MaleEmoji2 from "../../../img/MEMOJIS PACK/males/emoji (2).svg";
import MaleEmoji3 from "../../../img/MEMOJIS PACK/males/emoji (3).svg";
import MaleEmoji4 from "../../../img/MEMOJIS PACK/males/emoji (4).svg";
import MaleEmoji5 from "../../../img/MEMOJIS PACK/males/emoji (5).svg";
import placeholder from "../../../img/product-details/not-professional.png";

import { OrderDetailsModal } from "../ordersAdm/orders";
import Toast from "../../../components/toast/Toast"

import { useUserCompany } from "../../../contexts/companyContext/UserCompanyContext";

const Dashboard = ({ activeTab, setActiveTab }) => {
    const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
    const [isAdminModalVisible, setIsAdminModalVisible] = useState(false);
    const [adminRegisterMode, setAdminRegisterMode] = useState("manual");
    const [memberPhotos, setMemberPhotos] = useState({});

    const navigate = useNavigate();
    const { members, company } = useUserCompany();

    const [showBalance, setShowBalance] = useState(false);
    const [transitioning, setTransitioning] = useState(false);
    const [userName, setUserName] = useState("");
    const [saldoEstimado, setSaldoEstimado] = useState("0,00");
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);

    // ENVIAR EMAIL MEMBROS
    const [inviteName, setInviteName] = useState("");
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviteRole, setInviteRole] = useState("administrator");
    const [sendingInvite, setSendingInvite] = useState(false);

    const SERVICE_ID = "service_2l02vyh";
    const TEMPLATE_ID = "template_qc4x8co";
    const PUBLIC_KEY = "QlWjNn5vihbWi9uLf";


    const [toast, setToast] = useState({
        show: false,
        type: "success",
        title: "",
        message: ""
    });

    const showToast = (
        type,
        title,
        message
    ) => {

        setToast({
            show: true,
            type,
            title,
            message
        });

    };

    const sendInviteEmail = async (
        invitedName,
        invitedEmail,
        companyName,
        inviterName,
        role,
        inviteLink
    ) => {


        await emailjs.send(
            SERVICE_ID,
            TEMPLATE_ID,
            {
                invited_name: invitedName,
                invited_email: invitedEmail,

                inviter_name: inviterName,

                company_name: companyName,

                role:
                    role === "administrator"
                        ? "Administrador"
                        : "Profissional",

                invite_link: inviteLink
            },
            PUBLIC_KEY
        );

    };

    useEffect(() => {

        if (!members || members.length === 0) {
            setMemberPhotos({});
            return;
        }

        const storage = getStorage();

        const loadMemberPhotos = async () => {

            const photos = {};

            await Promise.all(
                members.map(async (member) => {

                    if (!member?.uid) {
                        return;
                    }

                    try {

                        const profileImageRef =
                            storageRef(
                                storage,
                                `users/${member.uid}/profileImg`,
                            );

                        const photoUrl =
                            await getDownloadURL(
                                profileImageRef,
                            );

                        photos[member.uid] = photoUrl;

                    } catch (error) {

                        /*
                         * Usuário ainda não possui foto.
                         * Não é necessário mostrar erro no console
                         * para cada usuário sem foto.
                         */

                        if (
                            error.code !==
                            "storage/object-not-found"
                        ) {

                            console.error(
                                `Erro ao carregar foto do usuário ${member.uid}:`,
                                error,
                            );

                        }

                    }

                }),
            );

            setMemberPhotos(photos);

        };

        loadMemberPhotos();

    }, [members]);

    useEffect(() => {
        emailjs.init(PUBLIC_KEY);
    }, []);

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

    const openAdminModal = () => {
        setIsAdminModalVisible(true);

        requestAnimationFrame(() => {
            setIsAdminModalOpen(true);
        });
    };

    const closeAdminModal = () => {
        setIsAdminModalOpen(false);

        setTimeout(() => {
            setIsAdminModalVisible(false);
        }, 300);
    };

    useEffect(() => {
        if (isAdminModalVisible) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }

        return () => {
            document.body.style.overflow = "";
        };
    }, [isAdminModalVisible]);

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

                                // === LÓGICA PARA CALCULAR O HORÁRIO FINAL ===
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

                                professionalOrders.push({
                                    id: scheduleId,
                                    productName: product.name || "Serviço",
                                    productValue: schedule.productPrice || "—",
                                    productImage,
                                    day: schedule.day || "—",
                                    hour: schedule.hour || "—",
                                    fullHour: endTimeDisplay,
                                    clientName: schedule.userName || "Cliente",
                                    status: schedule.status || "pending",
                                    companyName: company.name || "",
                                });
                                console.log("⏰ Início:", schedule.hour);
                                console.log("🕒 Duração:", product.duration);
                                console.log("➡️ Resultado:", endTimeDisplay);
                            }

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


    // FUNCAO ENVIAR EMAIL PARA NOVO MEMBRO
    const handleSendInvite = async (e) => {
        e.preventDefault();

        if (!inviteName.trim()) {
            alert("Informe o nome.");
            return;
        }

        if (!inviteEmail.trim()) {
            alert("Informe o e-mail.");
            return;
        }



        setSendingInvite(true);

        const db = getDatabase();
        const auth = getAuth();

        const uid = auth.currentUser.uid;

        const companiesSnapshot = await get(ref(db, "companys"));

        let companyName = "";
        let companyHandle = "";


        if (companiesSnapshot.exists()) {

            const companies = companiesSnapshot.val();

            for (const companyKey in companies) {

                const members = companies[companyKey].members || {};

                if (members[uid]) {

                    companyName = companies[companyKey].name;
                    companyHandle = companyKey;

                    break;

                }

            }

        }

        const inviteRef = push(ref(db, "invites"));
        const inviteId = inviteRef.key;

        const inviteLink =
            `${window.location.origin}/invite/${inviteId}`;

        await set(inviteRef, {
            invitedName: inviteName,
            invitedEmail: inviteEmail.toLowerCase().trim(),

            inviterUid: uid,
            inviterName: userName,

            companyHandle,
            companyName,

            role: inviteRole,

            status: "pending",

            createdAt: Date.now(),

            expiresAt:
                Date.now() +
                1000 * 60 * 60 * 24 * 15,

            acceptedAt: null,
            acceptedBy: null
        });
        try {

            await sendInviteEmail(
                inviteName,
                inviteEmail,
                companyName,
                userName,
                inviteRole,
                inviteLink
            );

            showToast(
                "success",
                "Convite enviado",
                "O convite foi enviado para o e-mail informado."
            );

            setInviteName("");
            setInviteEmail("");
            setInviteRole("administrator");

            closeAdminModal();

        } catch (err) {
            console.error("EMAILJS ERROR:", err);

            showToast(
                "error",
                "Erro ao enviar",
                "Não foi possível enviar o convite. Tente novamente."
            );
        } finally {

            setSendingInvite(false);

        }


    };

    const truncate = (text, max = 16) => {
        if (!text) return "—";
        return text.length > max ? `${text.slice(0, max)}...` : text;
    };

    const getMemberInitial = (member) => {

        const name =
            member?.name?.trim() ||
            "Usuário";

        return name
            .charAt(0)
            .toUpperCase();

    };

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
                        <h1>Membros</h1>
                        <div className="dashboard-products-list-content">
                            <button onClick={openAdminModal}>
                                <Icon icon="mynaui:plus" className="icon" />
                            </button>
                            <div className="dashboard-admins-list">
                                {members.map((member) => (
                                    <div
                                        key={member.uid}
                                        className="dashboard-adm-item"
                                    >

                                        {memberPhotos[member.uid] ? (

                                            <img
                                                src={memberPhotos[member.uid]}
                                                alt={member.name || "Usuário"}
                                                className="dashboard-member-photo"
                                            />

                                        ) : (

                                            <div className="dashboard-member-placeholder">
                                                {getMemberInitial(member)}
                                            </div>

                                        )}

                                        <h1>
                                            {
                                                member.name.length > 14
                                                    ? `${member.name.slice(0, 14)}...`
                                                    : member.name
                                            }
                                        </h1>

                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className='dashboard-buttons-actions'>
                        <button
                            onClick={() => {
                                if (!company?.handle) return;

                                navigate(
                                    `/central-user/${company.handle}`
                                );
                            }}
                        >
                            <Icon
                                icon="tdesign:town-filled"
                                className="icon"
                            />

                            Minha página
                        </button>
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
                                        <h2>{truncate(order.clientName, 14)}</h2>                                        <div className='dashboard-content-price-time'>
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

            {isAdminModalVisible && (
                <div
                    className={`dashboard-admin-modal-overlay ${isAdminModalOpen ? "dashboard-admin-modal-overlay--open" : ""}`}
                    onClick={closeAdminModal}
                >
                    <div
                        className={`dashboard-admin-modal ${isAdminModalOpen ? "dashboard-admin-modal--open" : ""}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="dashboard-admin-modal__header">

                            <h2>Adicionar membro</h2>

                            <button
                                className="dashboard-admin-modal__close"
                                onClick={closeAdminModal}
                            >
                                <Icon icon="mingcute:close-line" className="icon" />
                            </button>
                        </div>

                        <div className="dashboard-admin-register-switch">

                            <div
                                className={`dashboard-admin-register-switch__indicator ${adminRegisterMode === "requests"
                                    ? "dashboard-admin-register-switch__indicator--right"
                                    : ""
                                    }`}
                            />

                            <button
                                className={adminRegisterMode === "manual"
                                    ? "dashboard-admin-register-switch__button dashboard-admin-register-switch__button--active"
                                    : "dashboard-admin-register-switch__button"}
                                onClick={() => setAdminRegisterMode("manual")}
                            >
                                Convidar
                            </button>

                            <button
                                className={adminRegisterMode === "requests"
                                    ? "dashboard-admin-register-switch__button dashboard-admin-register-switch__button--active"
                                    : "dashboard-admin-register-switch__button"}
                                onClick={() => setAdminRegisterMode("requests")}
                            >
                                Pedidos
                            </button>

                        </div>

                        <div className="dashboard-admin-modal__content">

                            {adminRegisterMode === "manual" ? (

                                <form
                                    className="dashboard-admin-form"
                                    onSubmit={handleSendInvite}
                                >
                                    <div className="dashboard-admin-form__group">
                                        <label>Nome completo</label>
                                        <input
                                            type="text"
                                            placeholder="Ex.: João da Silva"
                                            value={inviteName}
                                            onChange={(e) => setInviteName(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="dashboard-admin-form__group">
                                        <label>E-mail</label>
                                        <input
                                            type="email"
                                            placeholder="joao@email.com"
                                            value={inviteEmail}
                                            onChange={(e) => setInviteEmail(e.target.value)}
                                            required
                                        />
                                    </div>

                                    <div className="dashboard-admin-form__group">
                                        <label>Função</label>

                                        <select
                                            value={inviteRole}
                                            onChange={(e) => setInviteRole(e.target.value)}
                                        >
                                            <option value="administrator">Administrador</option>
                                            <option value="professional">Profissional</option>
                                        </select>
                                    </div>

                                    <button
                                        type="submit"
                                        className="dashboard-admin-form__submit"
                                        disabled={sendingInvite}
                                    >
                                        <Icon icon="solar:user-plus-bold" className="icon" />

                                        {
                                            sendingInvite
                                                ? "Enviando..."
                                                : "Enviar convite"
                                        }

                                    </button>

                                </form>

                            ) : (

                                <div className="dashboard-admin-requests">


                                </div>

                            )}

                        </div>

                    </div>
                </div>
            )}

            <Toast
                show={toast.show}
                type={toast.type}
                title={toast.title}
                message={toast.message}
                onClose={() =>
                    setToast(prev => ({
                        ...prev,
                        show: false
                    }))
                }
            />
        </div>

    );
};

export default Dashboard;
