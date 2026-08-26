import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import InputMask from "react-input-mask";
import { getDatabase, ref, onValue, get, update } from "firebase/database";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from '@iconify/react';
import { getClientId } from "../../../../utils/clientID";

import Toast from "../../../../components/toast/Toast";
import {
    getStorage,
    ref as storageRef,
    getDownloadURL,
} from "firebase/storage";

import OrderSummary from "../../../../components/order-summary";

import "./product-details.css";

import noprofessionalplaceholder from "../../../../img/product-details/not-professional.png";

const ProductDetails = ({ product, companyName, companyHandle, companyLogo, onClose, formatDuration }) => {
    const clientId = getClientId();

    const [productDetailsSelectedProfessionalId, setProductDetailsSelectedProfessionalId] = useState(null);
    const [relatedUsersWithInfo, setRelatedUsersWithInfo] = useState([]);
    const [professionalPhotos, setProfessionalPhotos] = useState({});

    const [showProfessionals, setShowProfessionals] = useState(false);

    const [showAllDays, setShowAllDays] = useState(false);
    const [availableTimes, setAvailableTimes] = useState([]);
    const [loadingTimes, setLoadingTimes] = useState(false);

    const [loadingProfessionals, setLoadingProfessionals] = useState(false);
    const [currentMonthIndex, setCurrentMonthIndex] = useState(0);

    const [selectedDay, setSelectedDay] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);

    const [isClosingTimes, setIsClosingTimes] = useState(false);

    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [isAskingPhone, setIsAskingPhone] = useState(false);
    const [userName, setUserName] = useState("");
    const [isConfirmed, setIsConfirmed] = useState(false);

    const [showOrderSummary, setShowOrderSummary] = useState(false);
    const [lastAgendamento, setLastAgendamento] = useState(null);

    const [whatsappMemberPhotos, setWhatsappMemberPhotos] = useState({});
    const [showWhatsappModal, setShowWhatsappModal] = useState(false);
    const [whatsappMembers, setWhatsappMembers] = useState([]);
    const [loadingWhatsappMembers, setLoadingWhatsappMembers] = useState(false);

    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState("success");
    const [toastTitle, setToastTitle] = useState("");
    const [toastMessage, setToastMessage] = useState("");

    const DEFAULT_BUSINESS_HOURS = {
        open: "07:00",
        close: "22:00",
        intervals: []
    };

    const WEEK_DAYS = [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday"
    ];

    const timeToMinutes = (time) => {

        if (!time) return 0;

        const [hour, minute] = time.split(":").map(Number);

        return hour * 60 + minute;
    };

    const minutesToTime = (minutes) => {

        const hour = Math.floor(minutes / 60);
        const minute = minutes % 60;

        return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    };

    const openToast = (type, title, message) => {

        setToastType(type);
        setToastTitle(title);
        setToastMessage(message);
        setShowToast(true);

    };

    const saveLocalAgendamento = (agendamento) => {
        try {
            localStorage.setItem(
                "markfy-last-agendamento",
                JSON.stringify({
                    ...agendamento,
                    clientId,
                    companyHandle
                })
            );
        } catch (error) {
            console.error(
                "Erro ao salvar agendamento no dispositivo:",
                error
            );
        }
    };

    useEffect(() => {

        const fetchUsersInfo = async () => {

            if (!product?.relatedUsers?.length) {
                setRelatedUsersWithInfo([]);
                setProfessionalPhotos({});
                return;
            }

            try {

                const db = getDatabase();
                const storage = getStorage();

                const usersRef = ref(db, "users");

                const usersSnap = await get(usersRef);

                const usersData =
                    usersSnap.exists()
                        ? usersSnap.val()
                        : {};

                const enrichedUsers =
                    product.relatedUsers.map((relUser) => {

                        const userInfo =
                            usersData[relUser.id] || {};

                        return {
                            id: relUser.id,
                            role: relUser.role,
                            name: userInfo.name || "Sem nome"
                        };

                    });

                setRelatedUsersWithInfo(
                    enrichedUsers
                );

                // ==========================================
                // FOTOS DOS PROFISSIONAIS
                // ==========================================

                const photos = {};

                await Promise.all(
                    enrichedUsers.map(async (user) => {

                        try {

                            const profileImageRef =
                                storageRef(
                                    storage,
                                    `users/${user.id}/profileImg`
                                );

                            const photoUrl =
                                await getDownloadURL(
                                    profileImageRef
                                );

                            photos[user.id] = photoUrl;

                        } catch (error) {

                            // Sem foto = usa inicial
                            if (
                                error.code !==
                                "storage/object-not-found"
                            ) {

                                console.error(
                                    `Erro ao carregar foto de ${user.id}:`,
                                    error
                                );

                            }

                        }

                    })
                );

                setProfessionalPhotos(photos);

            } catch (err) {

                console.error(
                    "Erro ao buscar informações dos usuários relacionados:",
                    err
                );

                setRelatedUsersWithInfo([]);
                setProfessionalPhotos({});

            }

        };

        fetchUsersInfo();

    }, [product?.relatedUsers]);

    const groupedByMonth = availableTimes.reduce((acc, day) => {
        const [dd, mm, yyyy] = day.day.split("/");
        const dateObj = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);
        const monthLabel = dateObj.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

        if (!acc[monthLabel]) acc[monthLabel] = [];
        acc[monthLabel].push(day);
        return acc;
    }, {});

    const months = Object.keys(groupedByMonth);

    const handleOpenWhatsapp = async () => {

        if (!product?.relatedUsers?.length) {
            setWhatsappMembers([]);
            setWhatsappMemberPhotos({});
            setShowWhatsappModal(true);
            return;
        }

        setLoadingWhatsappMembers(true);
        setShowWhatsappModal(true);

        try {

            const db = getDatabase();
            const storage = getStorage();

            const whatsappMembersData = [];
            const photos = {};

            for (const relatedUser of product.relatedUsers) {

                if (!relatedUser?.id) {
                    continue;
                }

                // ===============================
                // WHATSAPP
                // ===============================

                const whatsappRef = ref(
                    db,
                    `companys/${companyHandle}/integrations/whatsapp/${relatedUser.id}`
                );

                const whatsappSnap =
                    await get(whatsappRef);

                if (!whatsappSnap.exists()) {
                    continue;
                }

                const whatsappData =
                    whatsappSnap.val();

                if (whatsappData.enabled !== true) {
                    continue;
                }

                if (!whatsappData.phone) {
                    continue;
                }

                // ===============================
                // USUÁRIO
                // ===============================

                const userInfo =
                    relatedUsersWithInfo.find(
                        user => user.id === relatedUser.id
                    );

                // ===============================
                // FOTO DE PERFIL
                // ===============================

                try {

                    const profileImageRef =
                        storageRef(
                            storage,
                            `users/${relatedUser.id}/profileImg`
                        );

                    const photoUrl =
                        await getDownloadURL(
                            profileImageRef
                        );

                    photos[relatedUser.id] = photoUrl;

                } catch (photoError) {

                    // Usuário simplesmente não possui foto
                    if (
                        photoError.code !==
                        "storage/object-not-found"
                    ) {
                        console.error(
                            "Erro ao carregar foto:",
                            photoError
                        );
                    }

                }

                // ===============================
                // ADICIONAR MEMBRO
                // ===============================

                whatsappMembersData.push({

                    id: relatedUser.id,

                    name:
                        userInfo?.name ||
                        "Profissional",

                    phone:
                        whatsappData.phone

                });

            }

            setWhatsappMembers(
                whatsappMembersData
            );

            setWhatsappMemberPhotos(
                photos
            );

        } catch (error) {

            console.error(
                "Erro ao buscar WhatsApp dos profissionais:",
                error
            );

            setWhatsappMembers([]);
            setWhatsappMemberPhotos({});

        } finally {

            setLoadingWhatsappMembers(false);

        }

    };

    useEffect(() => {

        const fetchAvailableTimes = async () => {

            if (!productDetailsSelectedProfessionalId) {

                setAvailableTimes([]);

                return;

            }

            setLoadingTimes(true);

            try {

                const db = getDatabase();

                // ==========================================
                // PROFISSIONAL
                // ==========================================

                const userRef = ref(
                    db,
                    `users/${productDetailsSelectedProfessionalId}`
                );

                const userSnap = await get(userRef);

                if (!userSnap.exists()) {

                    setAvailableTimes([]);

                    return;

                }

                const userData = userSnap.val();

                const scheduledTimes =
                    Array.isArray(userData.scheduledTimes)
                        ? userData.scheduledTimes
                        : [];


                // ==========================================
                // EMPRESA
                // ==========================================

                const companyRef = ref(
                    db,
                    `companys/${companyHandle}`
                );

                const companySnap = await get(companyRef);

                const companyData =
                    companySnap.exists()
                        ? companySnap.val()
                        : {};

                const businessHours =
                    companyData.businessHours || {};


                // ==========================================
                // DURAÇÃO DO SERVIÇO
                // ==========================================

                const serviceDuration =
                    Number(product.duration) || 0;


                // ==========================================
                // GERAR CALENDÁRIO
                // ==========================================

                const today = new Date();

                const dates = [];


                for (let i = 0; i < 14; i++) {

                    const d = new Date(today);

                    d.setDate(
                        today.getDate() + i
                    );


                    const dd = String(
                        d.getDate()
                    ).padStart(2, "0");

                    const mm = String(
                        d.getMonth() + 1
                    ).padStart(2, "0");

                    const yyyy =
                        d.getFullYear();


                    const dayStr =
                        `${dd}/${mm}/${yyyy}`;


                    const formattedDay = d
                        .toLocaleDateString(
                            "pt-BR",
                            {
                                weekday: "long",
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric"
                            }
                        )
                        .replace(
                            /^./,
                            char => char.toUpperCase()
                        );


                    // ==========================================
                    // DIA DA SEMANA
                    // ==========================================

                    const weekDay =
                        WEEK_DAYS[d.getDay()];


                    /*
                     * Aceita tanto:
                     *
                     * businessHours:
                     * {
                     *   monday: {
                     *      enabled: true,
                     *      intervals: [...]
                     *   }
                     * }
                     *
                     * quanto estruturas onde o dia
                     * possui diretamente os intervalos.
                     */

                    const dayBusinessHours =
                        businessHours[weekDay];


                    // ==========================================
                    // HORÁRIO PADRÃO
                    // ==========================================

                    let businessIntervals = [
                        {
                            open: DEFAULT_BUSINESS_HOURS.open,
                            close: DEFAULT_BUSINESS_HOURS.close
                        }
                    ];


                    // ==========================================
                    // EMPRESA CONFIGURADA
                    // ==========================================

                    if (dayBusinessHours) {

                        // Dia desativado
                        if (
                            dayBusinessHours.enabled === false ||
                            dayBusinessHours.active === false
                        ) {

                            continue;

                        }


                        if (
                            Array.isArray(
                                dayBusinessHours.intervals
                            )
                        ) {

                            businessIntervals =
                                dayBusinessHours.intervals
                                    .filter(interval =>
                                        interval?.open &&
                                        interval?.close
                                    )
                                    .map(interval => ({
                                        open: interval.open,
                                        close: interval.close
                                    }));


                            /*
                             * Se o dia existe mas não possui
                             * intervalos, considera fechado.
                             */

                            if (
                                businessIntervals.length === 0
                            ) {

                                continue;

                            }

                        }

                    }


                    // ==========================================
                    // HORÁRIOS OCUPADOS DO PROFISSIONAL
                    // ==========================================

                    const busySlots =
                        scheduledTimes.filter(
                            t => t.day === dayStr
                        );


                    // ==========================================
                    // GERAR SLOTS
                    // ==========================================

                    const allSlots = [];


                    businessIntervals.forEach(interval => {

                        const openMinutes =
                            timeToMinutes(
                                interval.open
                            );

                        const closeMinutes =
                            timeToMinutes(
                                interval.close
                            );


                        /*
                         * O horário precisa comportar
                         * o serviço inteiro.
                         */

                        const lastStart =
                            closeMinutes -
                            serviceDuration;


                        for (
                            let minutes = openMinutes;
                            minutes <= lastStart;
                            minutes += 30
                        ) {

                            allSlots.push(
                                minutesToTime(minutes)
                            );

                        }

                    });


                    // Evita duplicação caso existam
                    // intervalos sobrepostos.

                    const uniqueSlots = [
                        ...new Set(allSlots)
                    ];


                    // ==========================================
                    // BLOQUEAR HORÁRIOS DO PROFISSIONAL
                    // ==========================================

                    const blockedSlots = new Set();


                    busySlots.forEach(t => {

                        if (!t.hour) return;


                        const startMinutes =
                            timeToMinutes(t.hour);


                        const endMinutes =
                            startMinutes +
                            serviceDuration;


                        uniqueSlots.forEach(slot => {

                            const slotMinutes =
                                timeToMinutes(slot);


                            /*
                             * Considera conflito caso
                             * o novo horário esteja dentro
                             * do agendamento existente.
                             */

                            if (
                                slotMinutes < endMinutes &&
                                slotMinutes + serviceDuration > startMinutes
                            ) {

                                blockedSlots.add(slot);

                            }

                        });

                    });


                    // ==========================================
                    // HORÁRIOS LIVRES
                    // ==========================================

                    let freeSlots =
                        uniqueSlots.filter(
                            slot =>
                                !blockedSlots.has(slot)
                        );


                    // ==========================================
                    // SE FOR HOJE
                    // ==========================================

                    if (
                        d.toDateString() ===
                        today.toDateString()
                    ) {

                        const nowMinutes =
                            today.getHours() * 60 +
                            today.getMinutes();


                        freeSlots =
                            freeSlots.filter(slot => {

                                return (
                                    timeToMinutes(slot) >
                                    nowMinutes
                                );

                            });

                    }


                    // ==========================================
                    // ADICIONAR DIA
                    // ==========================================

                    if (freeSlots.length > 0) {

                        dates.push({

                            day: dayStr,

                            label: formattedDay,

                            slots: freeSlots

                        });

                    }

                }


                setAvailableTimes(dates);

            } catch (err) {

                console.error(
                    "Erro ao buscar horários disponíveis:",
                    err
                );

                setAvailableTimes([]);

            } finally {

                setLoadingTimes(false);

            }

        };


        fetchAvailableTimes();

    }, [
        productDetailsSelectedProfessionalId,
        companyHandle,
        product?.duration
    ]);

    const productDetailsCapFirst = (s = "") =>
        s.length ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";

    const [imgLoaded, setImgLoaded] = useState(false);

    const [visible, setVisible] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const maxLength = 100;
    const [selectedImage, setSelectedImage] = useState(0);

    const images = Array.isArray(product?.images)
        ? product.images.filter(Boolean)
        : product?.images
            ? [product.images]
            : [];

    const toggleExpanded = () => setExpanded(!expanded);

    const displayText = expanded
        ? product.description
        : product.description.length > maxLength
            ? product.description.slice(0, maxLength) + "..."
            : product.description;

    useEffect(() => {
        if (images.length > 0) {
            const img = new Image();
            img.src = images[0];
            img.onload = () => setImgLoaded(true);
        }
    }, [images]);

    useEffect(() => {
        if (!product) return;
        setVisible(true);
        setImgLoaded(false);
        setSelectedImage(0);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = prev; };
    }, [product]);

    if (!product) return null;

    // ================ FUNÇÃO DE CONFIRMAR AGENDAMENTO ================
    const toShedule = async (agendamento) => {

        if (
            !product ||
            !companyHandle ||
            !productDetailsSelectedProfessionalId
        ) {
            openToast(
                "error",
                "Erro",
                "Não foi possível realizar o agendamento."
            );

            return false;
        }

        try {

            const db = getDatabase();

            // ==========================================
            // VERIFICAR AGENDAMENTO RECENTE
            // ==========================================

            const schedulesRef = ref(
                db,
                `companys/${companyHandle}/schedules`
            );

            const schedulesSnap =
                await get(schedulesRef);

            const schedulesData =
                schedulesSnap.exists()
                    ? schedulesSnap.val()
                    : {};

            const now = Date.now();

            let bloqueado = false;

            Object.values(schedulesData).forEach((ag) => {

                if (
                    !ag ||
                    ag.clientId !== clientId ||
                    !ag.timestamp
                ) {
                    return;
                }

                const createdAt =
                    new Date(ag.timestamp).getTime();

                if (Number.isNaN(createdAt)) {
                    return;
                }

                const diffMs =
                    now - createdAt;

                const diffMinutes =
                    diffMs / (1000 * 60);

                // Bloqueia pelos 30 minutos após a criação
                if (
                    diffMinutes >= 0 &&
                    diffMinutes < 30
                ) {
                    bloqueado = true;
                }

            });

            if (bloqueado) {

                openToast(
                    "error",
                    "Agendamento recente",
                    "Você já realizou um agendamento recentemente. Tente novamente em 30 minutos."
                );

                return false;
            }

            // ==========================================
            // ATUALIZAR PEDIDOS DO PRODUTO
            // ==========================================

            const productRef = ref(
                db,
                `companys/${companyHandle}/products/${product.id}`
            );

            const updatedOrders =
                (product.orders || 0) + 1;

            await update(
                productRef,
                {
                    orders: updatedOrders
                }
            );

            // ==========================================
            // SALVAR AGENDAMENTO
            // ==========================================

            const scheduleId =
                agendamento.timestamp
                    .replace(/[:.]/g, "-");

            const newScheduleRef =
                ref(
                    db,
                    `companys/${companyHandle}/schedules/${scheduleId}`
                );

            const agendamentoComStatus = {
                ...agendamento,
                status: "pending",
                clientId
            };

            await update(
                newScheduleRef,
                agendamentoComStatus
            );

            // ==========================================
            // ATUALIZAR HORÁRIOS DO PROFISSIONAL
            // ==========================================

            const userRef = ref(
                db,
                `users/${productDetailsSelectedProfessionalId}`
            );

            const userSnap =
                await get(userRef);

            const userData =
                userSnap.exists()
                    ? userSnap.val()
                    : {};

            const currentTimes =
                Array.isArray(userData.scheduledTimes)
                    ? userData.scheduledTimes
                    : [];

            const updatedTimes = [
                ...currentTimes,
                {
                    day: agendamento.day,
                    hour: agendamento.hour
                }
            ];

            await update(
                userRef,
                {
                    scheduledTimes: updatedTimes
                }
            );

            // ==========================================
            // ATUALIZAR HORÁRIOS NA INTERFACE
            // ==========================================

            setAvailableTimes((prev) =>
                prev.map((d) =>
                    d.day === agendamento.day
                        ? {
                            ...d,
                            slots: d.slots.filter(
                                (h) =>
                                    h !== agendamento.hour
                            )
                        }
                        : d
                )
            );

            console.log(
                "✅ Agendamento confirmado:",
                agendamento.day,
                agendamento.hour
            );

            return true;

        } catch (error) {

            console.error(
                "❌ Erro ao salvar agendamento:",
                error
            );

            openToast(
                "error",
                "Não foi possível agendar",
                "Ocorreu um erro ao realizar o agendamento. Tente novamente."
            );

            return false;
        }
    };

    const handleProductBack = () => {

        // Modal de confirmação aberto
        if (showConfirmationModal) {

            // Etapa de nome
            if (isAskingPhone) {
                setIsAskingPhone(false);
                return;
            }

            // Etapa de confirmação
            setShowConfirmationModal(false);
            return;
        }

        // Já escolheu um horário → volta para os dias
        if (selectedSlot) {
            setSelectedSlot(null);
            return;
        }

        // Já escolheu um dia → volta para a seleção de profissional
        if (selectedDay) {
            setSelectedDay(null);
            return;
        }

        // Está na tela de profissionais → volta para detalhes
        if (showProfessionals) {

            setShowProfessionals(false);

            setProductDetailsSelectedProfessionalId(null);
            setSelectedDay(null);
            setSelectedSlot(null);

            setAvailableTimes([]);
            setCurrentMonthIndex(0);

            return;
        }

        // Nenhuma etapa anterior → fecha o produto
        setVisible(false);
    };

    return createPortal(
        <AnimatePresence
            mode="wait"
            onExitComplete={() => onClose?.()}
        >
            {visible && (
                <motion.div
                    className="product-details-overlay"
                    onClick={() => setVisible(false)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >

                    <AnimatePresence>
                        {showWhatsappModal && (

                            <motion.div
                                className="whatsapp-modal-overlay"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                onClick={() => setShowWhatsappModal(false)}
                            >

                                <motion.div
                                    className="whatsapp-modal"
                                    initial={{
                                        opacity: 0,
                                        scale: 0.9,
                                        y: 20
                                    }}
                                    animate={{
                                        opacity: 1,
                                        scale: 1,
                                        y: 0
                                    }}
                                    exit={{
                                        opacity: 0,
                                        scale: 0.9,
                                        y: 20
                                    }}
                                    transition={{
                                        duration: 0.25,
                                        ease: "easeOut"
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                >

                                    <div className="whatsapp-modal-header">

                                        <div>
                                            <h2>Fale com a equipe</h2>

                                            <p>
                                                Escolha um profissional para entrar
                                                em contato pelo WhatsApp.
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowWhatsappModal(false)
                                            }
                                        >
                                            <Icon icon="mdi:close" />
                                        </button>

                                    </div>

                                    <div className="whatsapp-modal-content">

                                        {loadingWhatsappMembers ? (

                                            <div className="whatsapp-modal-loading">

                                                <Icon
                                                    icon="svg-spinners:ring-resize"
                                                    width="30"
                                                />

                                                <p>
                                                    Carregando contatos...
                                                </p>

                                            </div>

                                        ) : whatsappMembers.length > 0 ? (

                                            <div className="whatsapp-members-list">

                                                {whatsappMembers.map((member) => (

                                                    <button
                                                        type="button"
                                                        className="whatsapp-member"
                                                        key={member.id}
                                                        onClick={() => {

                                                            const phone =
                                                                member.phone
                                                                    .replace(/\D/g, "");

                                                            window.open(
                                                                `https://wa.me/${phone}`,
                                                                "_blank"
                                                            );

                                                        }}
                                                    >

                                                        <div className="whatsapp-member-avatar">

                                                            {whatsappMemberPhotos[member.id] ? (

                                                                <img
                                                                    src={whatsappMemberPhotos[member.id]}
                                                                    alt={member.name}
                                                                    className="whatsapp-member-profile-image"
                                                                    onLoad={(e) => {
                                                                        console.log(
                                                                            "✅ Foto carregada:",
                                                                            member.id,
                                                                            e.currentTarget.currentSrc
                                                                        );
                                                                    }}
                                                                    onError={(e) => {

                                                                        console.error(
                                                                            "❌ Erro ao carregar foto:",
                                                                            member.id,
                                                                            e.currentTarget.src
                                                                        );

                                                                        e.currentTarget.style.display = "none";

                                                                        const fallback =
                                                                            e.currentTarget.parentElement
                                                                                ?.querySelector(
                                                                                    ".whatsapp-member-avatar-fallback"
                                                                                );

                                                                        if (fallback) {
                                                                            fallback.style.display = "flex";
                                                                        }

                                                                    }}
                                                                />

                                                            ) : null}

                                                            <div
                                                                className="whatsapp-member-avatar-fallback"
                                                                style={{
                                                                    display: whatsappMemberPhotos[member.id]
                                                                        ? "none"
                                                                        : "flex"
                                                                }}
                                                            >
                                                                {member.name
                                                                    ?.trim()
                                                                    ?.charAt(0)
                                                                    ?.toUpperCase() || "?"}
                                                            </div>

                                                        </div>

                                                        <div className="whatsapp-member-info">

                                                            <strong>
                                                                {member.name}
                                                            </strong>

                                                            <span>
                                                                {member.phone}
                                                            </span>

                                                        </div>

                                                        <Icon
                                                            icon="mage:whatsapp-filled"
                                                            className="whatsapp-member-icon"
                                                        />

                                                    </button>

                                                ))}

                                            </div>

                                        ) : (

                                            <div className="whatsapp-modal-empty">

                                                <Icon
                                                    icon="mage:whatsapp-filled"
                                                    width="42"
                                                />

                                                <h3>
                                                    Nenhum contato disponível
                                                </h3>

                                                <p>
                                                    Nenhum profissional relacionado
                                                    a este produto possui um WhatsApp
                                                    habilitado.
                                                </p>

                                            </div>

                                        )}

                                    </div>

                                </motion.div>

                            </motion.div>

                        )}
                    </AnimatePresence>

                    <motion.div
                        key={product.id}
                        className="product-details-container"
                        onClick={(e) => e.stopPropagation()}
                        initial={{ scale: 0.30, opacity: 0, borderRadius: "5rem" }}
                        animate={{ scale: 1, opacity: 1, }}
                        exit={{ scale: 0.30, opacity: 0, borderRadius: "5rem" }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        role="dialog"
                        aria-modal="true"
                    >
                        <div className={`product-details-media ${showProfessionals ? "hidden" : ""}`}>

                            {!imgLoaded && <div className="product-details-skeleton" />}
                            <img
                                src={images[selectedImage] || ""}
                                alt={product.name}
                                className="product-details-image"
                                style={{ display: imgLoaded ? "block" : "none" }}
                                onLoad={() => setImgLoaded(true)}
                            />

                            {images.length > 0 && (
                                <div className="product-details-carousel" role="listbox" aria-label="Imagens do produto">
                                    <div
                                        className="carousel-blur-fallback"
                                        aria-hidden
                                        style={{ backgroundImage: `url(${images[selectedImage]})` }}
                                    />
                                    {images.map((img, index) => (
                                        <button
                                            type="button"
                                            key={index}
                                            className={`carousel-thumb ${index === selectedImage ? "active" : ""}`}
                                            onClick={() => {
                                                if (index !== selectedImage) {
                                                    setImgLoaded(false);
                                                    setSelectedImage(index);
                                                }
                                            }}
                                            aria-pressed={index === selectedImage}
                                            aria-label={`Imagem ${index + 1}`}
                                        >
                                            <img src={img} alt="" />
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="product-details-header">
                                <button className="product-details-back" onClick={() => setVisible(false)}>
                                    <Icon icon="humbleicons:arrow-left" className="icon" />
                                </button>

                                {/* <button className="product-details-cart" onClick={() => alert("Adicionado ao carrinho!")}>
                                    <Icon icon="lucide:shopping-cart" className="icon" />
                                </button> */}
                            </div>
                        </div>

                        <div className={`product-details-body ${showProfessionals ? "fullscreen" : ""}`}>
                            <div className="product-details-content-scroll">

                                <div className="product-details-info">
                                    <AnimatePresence mode="wait">
                                        {loadingProfessionals ? (
                                            <motion.div
                                                key="loading"
                                                className="loading-container-product-details"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.3 }}
                                            >
                                                <div className="spinner-product-details" />
                                                <p>Carregando ...</p>
                                            </motion.div>
                                        ) : !showProfessionals ? (
                                            <motion.div
                                                key="info"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.3 }}
                                            >
                                                {/* --- BLOCO COMPLETO ORIGINAL --- */}
                                                {product.categories && product.categories.length > 0 && (
                                                    <div className="product-details-categories">
                                                        {(() => {
                                                            const limit = 3;
                                                            const cats = product.categories.slice(0, limit);
                                                            const extra = product.categories.length > limit;

                                                            return (
                                                                <span className="categories-text">
                                                                    {cats.join(" • ")}
                                                                    {extra && "..."}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                )}

                                                <h2 className="product-details-title">{product.name}</h2>
                                                <div className="product-details-company-info">
                                                    <div className="company-info-left">
                                                        {companyLogo && (
                                                            <div className="product-details-company-logo">
                                                                <img src={companyLogo} alt="Logo da Empresa" className="company-logo" />
                                                            </div>
                                                        )}
                                                        <span>
                                                            <h1>{companyName}</h1>
                                                            <p>@{companyHandle}</p>
                                                        </span>
                                                    </div>

                                                    <div className="product-details-company-actions">
                                                        {/* <button className="product-details-email-button">
                                                            <Icon icon="mdi:email" width="24" height="24" />
                                                        </button> */}
                                                        <button
                                                            className="product-details-whatsap-button"
                                                            onClick={handleOpenWhatsapp}
                                                        >
                                                            <Icon
                                                                icon="mage:whatsapp-filled"
                                                                width="24"
                                                                height="24"
                                                            />
                                                        </button>
                                                    </div>
                                                </div>

                                                <h1>Descrição</h1>
                                                {product.description && (
                                                    <p className="product-details-description">
                                                        {displayText}{" "}
                                                        {product.description.length > maxLength && (
                                                            <span className="read-more-inline" onClick={toggleExpanded}>
                                                                {expanded ? " Ler menos" : " Ler mais"}
                                                            </span>
                                                        )}
                                                    </p>
                                                )}
                                            </motion.div>
                                        ) : (

                                            <motion.div
                                                key="profissionais"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.3 }}
                                            >
                                                {/* --- BLOCO PROFISSIONAIS --- */}
                                                <div className="product-details-professional">

                                                    <div className="product-details-step-header">

                                                        <button
                                                            type="button"
                                                            className="product-details-step-back"
                                                            onClick={() => {
                                                                setShowProfessionals(false);
                                                                setProductDetailsSelectedProfessionalId(null);
                                                                setSelectedDay(null);
                                                                setSelectedSlot(null);
                                                                setAvailableTimes([]);
                                                                setCurrentMonthIndex(0);
                                                            }}
                                                        >
                                                            <Icon icon="humbleicons:arrow-left" />

                                                            <span>Voltar</span>
                                                        </button>

                                                        <h1>Escolha um profissional</h1>

                                                    </div>

                                                    {Array.isArray(relatedUsersWithInfo) && relatedUsersWithInfo.length > 0 ? (
                                                        <div className="product-details-professionals-list">
                                                            {relatedUsersWithInfo.map((user, index) => {
                                                                const id = user.id ?? index;
                                                                const isSelected = productDetailsSelectedProfessionalId === id;
                                                                const initial = (user.name && user.name.trim()[0]?.toUpperCase()) || "?";

                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        key={id}
                                                                        className={`professional-circle-card ${isSelected ? "selected" : ""}`}
                                                                        onClick={() => {

                                                                            // Clicou novamente no profissional já selecionado
                                                                            if (
                                                                                productDetailsSelectedProfessionalId === id
                                                                            ) {
                                                                                return;
                                                                            }

                                                                            // ==========================================
                                                                            // TROCOU DE PROFISSIONAL
                                                                            // ==========================================

                                                                            setIsClosingTimes(true);

                                                                            // Limpa imediatamente a seleção anterior
                                                                            setSelectedDay(null);
                                                                            setSelectedSlot(null);
                                                                            setAvailableTimes([]);
                                                                            setCurrentMonthIndex(0);

                                                                            // Seleciona o novo profissional
                                                                            setProductDetailsSelectedProfessionalId(id);

                                                                            // Pequeno tempo para a animação de saída
                                                                            setTimeout(() => {
                                                                                setIsClosingTimes(false);
                                                                            }, 300);

                                                                        }}

                                                                        aria-pressed={isSelected}
                                                                        role="option"
                                                                        aria-selected={isSelected}
                                                                        title={user.name}
                                                                    >
                                                                        <div className="professional-circle-wrap">

                                                                            {professionalPhotos[user.id] ? (

                                                                                <img
                                                                                    src={professionalPhotos[user.id]}
                                                                                    alt={user.name}
                                                                                    className="professional-circle-img"
                                                                                />

                                                                            ) : (

                                                                                <div className="professional-circle-fallback">
                                                                                    {initial}
                                                                                </div>

                                                                            )}

                                                                            <span
                                                                                className={`professional-circle-check ${isSelected ? "selected" : ""
                                                                                    }`}
                                                                            >
                                                                                <Icon icon="material-symbols:check-circle" />
                                                                            </span>

                                                                        </div>

                                                                        <span className="professional-circle-name">{user.name}</span>
                                                                    </button>
                                                                );
                                                            })}

                                                            {!productDetailsSelectedProfessionalId && (
                                                                <div className="no-professional-placeholder">
                                                                    <img
                                                                        src={noprofessionalplaceholder}
                                                                        alt="Selecione um profissional"
                                                                        className="no-professional-image"
                                                                    />
                                                                    <h3>Nenhum profissional selecionado</h3>
                                                                    <p>Escolha um profissional acima para visualizar os dias e horários disponíveis.</p>
                                                                </div>
                                                            )}

                                                            {productDetailsSelectedProfessionalId && !selectedDay && (
                                                                <div className="product-details-available-days">
                                                                    <h2 className="choose-day-title">Escolha um dia</h2>

                                                                    {months.length > 0 && (
                                                                        <div className="month-selector">
                                                                            <div className="month-header">
                                                                                <button
                                                                                    disabled={currentMonthIndex === 0}
                                                                                    onClick={() =>
                                                                                        setCurrentMonthIndex((i) => i - 1)
                                                                                    }
                                                                                    className={`month-arrow ${currentMonthIndex === 0 ? "disabled" : ""
                                                                                        }`}
                                                                                    type="button"
                                                                                    aria-label="Mês anterior"
                                                                                >
                                                                                    <Icon icon="humbleicons:arrow-left" />
                                                                                </button>

                                                                                <h3 className="month-title">{months[currentMonthIndex]}</h3>

                                                                                <button
                                                                                    disabled={currentMonthIndex === months.length - 1}
                                                                                    onClick={() => setCurrentMonthIndex((i) => i + 1)}
                                                                                    className={`month-arrow ${currentMonthIndex === months.length - 1 ? "disabled" : ""}`}
                                                                                >
                                                                                    <Icon icon="humbleicons:arrow-right" />
                                                                                </button>
                                                                            </div>

                                                                            {/* substitua o map dos dias por este código */}
                                                                            <div className="days-scroll"
                                                                                onWheel={(e) => {
                                                                                    const el = e.currentTarget;
                                                                                    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                                                                                        el.scrollLeft += e.deltaY;
                                                                                        e.preventDefault();
                                                                                    }
                                                                                }}
                                                                                onMouseDown={(e) => {
                                                                                    const el = e.currentTarget;
                                                                                    el.isDragging = true;
                                                                                    el.startX = e.pageX + el.scrollLeft;
                                                                                }}
                                                                                onMouseMove={(e) => {
                                                                                    const el = e.currentTarget;
                                                                                    if (!el.isDragging) return;
                                                                                    el.scrollLeft = el.startX - e.pageX;
                                                                                }}
                                                                                onMouseUp={(e) => {
                                                                                    e.currentTarget.isDragging = false;
                                                                                }}
                                                                                onMouseLeave={(e) => {
                                                                                    e.currentTarget.isDragging = false;
                                                                                }}
                                                                            >
                                                                                {groupedByMonth[months[currentMonthIndex]].map((day) => {
                                                                                    // day.day é "dd/mm/yyyy"
                                                                                    const [dd, mm, yyyy] = day.day.split("/").map((v) => v.padStart(2, "0"));
                                                                                    // usa construtor local (evita shift de timezone)
                                                                                    const dateObj = new Date(Number(yyyy), Number(mm) - 1, Number(dd));

                                                                                    const dayName = dateObj
                                                                                        .toLocaleDateString("pt-BR", { weekday: "short" })
                                                                                        .replace(".", "");
                                                                                    const dayNumber = dateObj.toLocaleDateString("pt-BR", { day: "2-digit" });

                                                                                    return (
                                                                                        <button
                                                                                            key={day.day}
                                                                                            className="day-button"
                                                                                            onClick={() => {
                                                                                                // cria label a partir do mesmo dateObj (local)
                                                                                                const label = dateObj.toLocaleDateString("pt-BR", {
                                                                                                    weekday: "long",
                                                                                                    day: "2-digit",
                                                                                                    month: "2-digit",
                                                                                                    year: "numeric",
                                                                                                });
                                                                                                setSelectedDay({
                                                                                                    ...day,
                                                                                                    label: label.charAt(0).toUpperCase() + label.slice(1),
                                                                                                });
                                                                                            }}
                                                                                        >
                                                                                            <span className="day-name">{dayName}</span>
                                                                                            <span className="day-number">{dayNumber}</span>
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            <div
                                                                className={`product-details-available-times-wrapper ${selectedDay && !isClosingTimes ? "open" : isClosingTimes ? "closing" : ""
                                                                    }`}
                                                            >
                                                                {selectedDay && (
                                                                    <div className="product-details-available-times">
                                                                        <h2>Horários disponíveis em {selectedDay.label}</h2>
                                                                        <div
                                                                            className="slots-scroll"
                                                                            onWheel={(e) => {
                                                                                const el = e.currentTarget;
                                                                                if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                                                                                    el.scrollLeft += e.deltaY;
                                                                                    e.preventDefault();
                                                                                }
                                                                            }}
                                                                        >
                                                                            {selectedDay.slots.map((slot) => (
                                                                                <button
                                                                                    key={slot}
                                                                                    className={`slot-button ${selectedSlot === slot ? "selected" : ""}`}
                                                                                    onClick={() => setSelectedSlot(slot)}
                                                                                >
                                                                                    {slot}
                                                                                </button>
                                                                            ))}
                                                                        </div>

                                                                        <button className="back-to-days" onClick={() => setSelectedDay(null)}>
                                                                            Voltar para dias
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="product-details-professional-empty">Informação não disponível.</p>
                                                    )}

                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Footer fixo */}
                            <div className="product-details-footer">
                                <div className="product-details-footer-price">
                                    <p>Preço Total</p>
                                    <span>{product.value}</span>
                                </div>
                                <button
                                    className={`product-details-footer-cta ${showProfessionals &&
                                        !(productDetailsSelectedProfessionalId && selectedDay && selectedSlot)
                                        ? "disabled"
                                        : ""
                                        }`}
                                    disabled={
                                        showProfessionals &&
                                        !(productDetailsSelectedProfessionalId && selectedDay && selectedSlot)
                                    }
                                    onClick={() => {
                                        // 1. Primeira etapa → abre seleção de profissional
                                        if (!showProfessionals && !loadingProfessionals) {
                                            setLoadingProfessionals(true);
                                            setTimeout(() => {
                                                setLoadingProfessionals(false);
                                                setShowProfessionals(true);
                                            }, 1000);
                                            return;
                                        }

                                        // 2. Já na tela de profissionais, mas faltam seleções
                                        if (
                                            showProfessionals &&
                                            (!productDetailsSelectedProfessionalId || !selectedDay || !selectedSlot)
                                        ) {
                                            document
                                                .querySelector(".product-details-professionals-list")
                                                ?.scrollIntoView({ behavior: "smooth" });
                                            return;
                                        }

                                        // 3. Tudo pronto → confirmar agendamento
                                        if (
                                            showProfessionals &&
                                            productDetailsSelectedProfessionalId &&
                                            selectedDay &&
                                            selectedSlot
                                        ) {
                                            setShowConfirmationModal(true);
                                            return;
                                        }
                                    }}
                                >
                                    <Icon icon="ic:round-schedule-send" className="icon" />
                                    {showProfessionals ? "Prosseguir" : "Agendar Agora"}
                                </button>
                            </div>
                        </div>

                    </motion.div >
                    <AnimatePresence>
                        {showConfirmationModal && (
                            <motion.div
                                className="confirmation-modal-overlay"
                                onClick={(e) => e.stopPropagation()}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.25, ease: "easeOut" }}
                            >
                                <motion.div
                                    className="confirmation-modal"
                                    onClick={(e) => e.stopPropagation()}
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.8, opacity: 0 }}
                                    transition={{ duration: 0.25, ease: "easeOut" }}
                                >

                                    {/* ======================= ETAPA 1: Confirmar agendamento ======================= */}
                                    {!isAskingPhone && isConfirmed === false && (
                                        <>
                                            <h2>Confirmar agendamento</h2>
                                            <p>
                                                Deseja confirmar o horário <strong>{selectedSlot}</strong> em{" "}
                                                <strong>{selectedDay?.label}</strong> com{" "}
                                                <strong>
                                                    {
                                                        relatedUsersWithInfo.find(
                                                            (u) => u.id === productDetailsSelectedProfessionalId
                                                        )?.name || "profissional não identificado"
                                                    }
                                                </strong>
                                                ?
                                            </p>

                                            <div className="confirmation-modal-actions">
                                                <button
                                                    className="confirmation-btn cancel"
                                                    onClick={() => setShowConfirmationModal(false)}
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    className="confirmation-btn confirm"
                                                    onClick={() => setIsAskingPhone(true)}
                                                >
                                                    Confirmar
                                                </button>
                                            </div>
                                        </>
                                    )}

                                    {/* ======================= ETAPA 2: Pedir nome ======================= */}
                                    {isAskingPhone && !isConfirmed && (
                                        <>
                                            <h2>Informe seu nome</h2>
                                            <p>Digite seu nome para confirmar o agendamento:</p>

                                            <input
                                                type="text"
                                                className="auth-input"
                                                placeholder="Seu nome completo"
                                                value={userName}
                                                onChange={(e) => setUserName(e.target.value)}
                                                maxLength={40}
                                            />

                                            <div className="confirmation-modal-actions">
                                                <button
                                                    className="confirmation-btn cancel"
                                                    onClick={() => setIsAskingPhone(false)}
                                                >
                                                    Voltar
                                                </button>
                                                <button
                                                    className="confirmation-btn confirm"
                                                    disabled={!userName.trim()}
                                                    onClick={async () => {

                                                        setIsConfirmed("loading");

                                                        const agendamento = {
                                                            productId: product.id,
                                                            productName: product.name,
                                                            productPrice: product.value,

                                                            professionalId:
                                                                productDetailsSelectedProfessionalId,

                                                            professionalName:
                                                                relatedUsersWithInfo.find(
                                                                    (u) =>
                                                                        u.id ===
                                                                        productDetailsSelectedProfessionalId
                                                                )?.name ||
                                                                "Profissional não identificado",

                                                            day: selectedDay.day,

                                                            dayLabel:
                                                                selectedDay.label,

                                                            hour: selectedSlot,

                                                            userName:
                                                                userName.trim(),

                                                            timestamp:
                                                                new Date().toISOString(),
                                                        };

                                                        console.log(
                                                            "📅 Agendamento iniciado:",
                                                            agendamento
                                                        );

                                                        const success =
                                                            await toShedule(agendamento);

                                                        // ==========================================
                                                        // ERRO
                                                        // ==========================================

                                                        if (!success) {

                                                            setIsConfirmed(false);

                                                            setShowConfirmationModal(false);

                                                            return;
                                                        }

                                                        saveLocalAgendamento({
                                                            ...agendamento,
                                                            status: "pending"
                                                        });

                                                        // ==========================================
                                                        // SUCESSO
                                                        // ==========================================

                                                        setLastAgendamento({
                                                            ...agendamento,
                                                            product,
                                                        });

                                                        setIsConfirmed("success");

                                                    }}
                                                >
                                                    Confirmar Agendamento
                                                </button>
                                            </div>
                                        </>
                                    )}

                                    {/* ======================= ETAPA 3: Loading ======================= */}
                                    <AnimatePresence mode="wait">
                                        {isConfirmed === "loading" && (
                                            <motion.div
                                                key="loading-screen"
                                                className="loading-agendamento"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.5, ease: "easeOut" }}
                                            >
                                                <Icon icon="svg-spinners:clock" className="icon" />
                                                <p>Realizando seu agendamento...</p>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>


                                    {/* ======================= ETAPA 4: Sucesso ======================= */}
                                    <AnimatePresence mode="wait">
                                        {isConfirmed === "success" && (
                                            <motion.div
                                                key="success-screen"
                                                className="agendamento-sucesso"
                                                initial={{ opacity: 0, scale: 0.8 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                transition={{
                                                    delay: 0.4,
                                                    duration: 0.6,
                                                    ease: "easeOut",
                                                }}
                                            >
                                                <Icon icon="mdi:check-circle" className="icon" />
                                                <h2>Agendamento realizado com sucesso!</h2>
                                                <p>
                                                    Seu horário para <strong>{selectedDay.label}</strong> às{" "}
                                                    <strong>{selectedSlot}</strong> foi confirmado.
                                                </p>

                                                <div className="confirmation-modal-actions">
                                                    <button
                                                        className="confirmation-btn cancel"
                                                        onClick={() => {
                                                            setShowConfirmationModal(false);
                                                            setIsAskingPhone(false);
                                                            setIsConfirmed(false);
                                                            setUserName("");
                                                            onClose?.();
                                                        }}
                                                    >
                                                        Fechar
                                                    </button>

                                                    <button
                                                        className="confirmation-btn confirm"
                                                        onClick={() => {
                                                            setShowConfirmationModal(false);
                                                            setShowOrderSummary(true);
                                                        }}
                                                    >
                                                        Ver Agendamento
                                                    </button>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            </motion.div>
                        )
                        }
                    </AnimatePresence >

                    <AnimatePresence>
                        {showOrderSummary && (
                            <OrderSummary
                                agendamento={lastAgendamento}

                                onBack={() => {
                                    setShowOrderSummary(false);
                                }}

                                onClose={() => {

                                    setShowOrderSummary(false);

                                    setVisible(false);

                                    window.dispatchEvent(
                                        new Event("markfy:go-to-reservations")
                                    );

                                    onClose?.();
                                }}
                            />
                        )}
                    </AnimatePresence>
                    <Toast
                        show={showToast}
                        type={toastType}
                        title={toastTitle}
                        message={toastMessage}
                        onClose={() => setShowToast(false)}
                    />
                </motion.div >
            )
            }
        </AnimatePresence >,
        document.body
    );
};

export default ProductDetails;
