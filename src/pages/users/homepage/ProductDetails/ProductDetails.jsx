import React, { useEffect, useState } from "react";
import {
    useNavigate
} from "react-router-dom";

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

import {
    getAuth,
    RecaptchaVerifier,
    signInWithPhoneNumber
} from "firebase/auth";

import OrderSummary from "../../../../components/order-summary";
import CompanyInfoModal from "../../CompanyInfoModal/CompanyInfoModal";

import "./product-details.css";

import noprofessionalplaceholder from "../../../../img/product-details/not-professional.png";

import MercadoPagoPayment from "../../../../components/mercado-pago-payment/MercadoPagoPayment";

const ProductDetails = ({ product, companyName, companyHandle, companyLogo, onClose, formatDuration }) => {
    const clientId = getClientId();

    const navigate = useNavigate();

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

    const [showCompanyInfo, setShowCompanyInfo] = useState(false);

    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState("success");
    const [toastTitle, setToastTitle] = useState("");
    const [toastMessage, setToastMessage] = useState("");
    const [requiresPayment, setRequiresPayment] = useState(false);

    const [showMercadoPagoPayment, setShowMercadoPagoPayment] = useState(false);
    const [showPayment, setShowPayment] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState("idle");
    const [showPaymentAuth, setShowPaymentAuth] = useState(false);

    const [authPhone, setAuthPhone] = useState("");
    const [authCode, setAuthCode] = useState("");
    const [authConfirmation, setAuthConfirmation] = useState(null);
    const [phoneVerified, setPhoneVerified] = useState(false);

    const [authStep, setAuthStep] = useState("phone");
    const [authLoading, setAuthLoading] = useState(false);
    const [authError, setAuthError] = useState("");

    const [showPostCheckout, setShowPostCheckout] = useState(false);
    const [postCheckoutStatus, setPostCheckoutStatus] = useState("checking");
    const [postCheckoutPayment, setPostCheckoutPayment] = useState(null);

    const [loggedUserEmail, setLoggedUserEmail] = useState("");
    const [loggedUserId, setLoggedUserId] = useState(null);
    const [isUserLoggedIn, setIsUserLoggedIn] = useState(false);
    const [emailConfirmed, setEmailConfirmed] = useState(false);

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

    const openCheckout = () => {

        const agendamento =
            buildAgendamento();

        navigate(
            "/checkout",
            {
                state: {
                    checkoutData: {

                        ...agendamento,

                        companyHandle,

                        companyName,

                        companyLogo,

                        productId:
                            product.id,

                        productName:
                            product.name,

                        productPrice:
                            product.value,

                        product,

                        professionalId:
                            productDetailsSelectedProfessionalId,

                        professionalName:
                            relatedUsersWithInfo.find(
                                (u) =>
                                    u.id ===
                                    productDetailsSelectedProfessionalId
                            )?.name ||
                            "Profissional não identificado",

                        day:
                            selectedDay?.day,

                        dayLabel:
                            selectedDay?.label,

                        hour:
                            selectedSlot,

                        userName:
                            userName.trim(),

                        clientId
                    }
                }
            }
        );

    };

    const timeToMinutes = (time) => {

        if (!time) return null;

        const [hour, minute] =
            time.split(":").map(Number);

        if (
            Number.isNaN(hour) ||
            Number.isNaN(minute)
        ) {
            return null;
        }

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

    useEffect(() => {

        const fetchPaymentSettings = async () => {

            if (!companyHandle) {
                setRequiresPayment(false);
                return;
            }

            try {

                const db = getDatabase();

                const paymentSettingsRef = ref(
                    db,
                    `companys/${companyHandle}/paymentSettings`
                );

                const snapshot =
                    await get(paymentSettingsRef);

                if (!snapshot.exists()) {
                    setRequiresPayment(false);
                    return;
                }

                const paymentSettings =
                    snapshot.val();

                setRequiresPayment(
                    paymentSettings.receiveBeforeBooking === true
                );

            } catch (error) {

                console.error(
                    "Erro ao carregar configurações de pagamento:",
                    error
                );

                setRequiresPayment(false);

            }

        };

        fetchPaymentSettings();

    }, [companyHandle]);

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

        const params =
            new URLSearchParams(
                window.location.search
            );

        const mercadoPagoStatus =
            params.get("status");

        const paymentId =
            params.get("payment_id");

        const externalReference =
            params.get("external_reference");

        /*
         * O Mercado Pago pode retornar
         * parâmetros diferentes dependendo
         * do fluxo.
         *
         * A existência do nosso pagamento
         * no localStorage é o principal indicador.
         */

        const pendingPayment =
            localStorage.getItem(
                "markfy-pending-payment"
            );

        if (
            pendingPayment &&
            (
                mercadoPagoStatus ||
                paymentId ||
                externalReference
            )
        ) {

            checkPendingPayment();

            /*
             * Limpa os parâmetros do retorno
             * sem recarregar a página.
             */

            const cleanUrl =
                `${window.location.pathname}`;

            window.history.replaceState(
                {},
                document.title,
                cleanUrl
            );
        }

    }, [companyHandle]);

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

                const appointmentInterval =
                    Number(businessHours.interval) || 30;

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


                    // ==========================================
                    // CONFIGURAÇÃO DO DIA
                    // ==========================================

                    const dayBusinessHours =
                        businessHours[weekDay];


                    // ==========================================
                    // HORÁRIO DE FUNCIONAMENTO
                    // ==========================================

                    let businessOpen =
                        DEFAULT_BUSINESS_HOURS.open;

                    let businessClose =
                        DEFAULT_BUSINESS_HOURS.close;

                    let businessBreaks = [];


                    // ==========================================
                    // DIA CONFIGURADO
                    // ==========================================

                    if (dayBusinessHours) {

                        // --------------------------------------
                        // DIA FECHADO
                        // --------------------------------------

                        if (
                            dayBusinessHours.enabled === false ||
                            dayBusinessHours.active === false
                        ) {
                            continue;
                        }


                        // --------------------------------------
                        // HORÁRIO PRINCIPAL
                        // --------------------------------------

                        businessOpen =
                            dayBusinessHours.open ||
                            DEFAULT_BUSINESS_HOURS.open;

                        businessClose =
                            dayBusinessHours.close ||
                            DEFAULT_BUSINESS_HOURS.close;


                        // --------------------------------------
                        // PAUSAS
                        // --------------------------------------

                        if (
                            Array.isArray(
                                dayBusinessHours.intervals
                            )
                        ) {

                            businessBreaks =
                                dayBusinessHours.intervals
                                    .filter(interval =>
                                        interval?.open &&
                                        interval?.close
                                    )
                                    .map(interval => ({
                                        open: interval.open,
                                        close: interval.close
                                    }))
                                    .sort(
                                        (a, b) =>
                                            timeToMinutes(a.open) -
                                            timeToMinutes(b.open)
                                    );

                        }

                    }


                    // ==========================================
                    // CONVERTER HORÁRIOS
                    // ==========================================

                    const businessOpenMinutes =
                        timeToMinutes(businessOpen);

                    const businessCloseMinutes =
                        timeToMinutes(businessClose);


                    if (
                        businessOpenMinutes === null ||
                        businessCloseMinutes === null ||
                        businessOpenMinutes >= businessCloseMinutes
                    ) {
                        continue;
                    }


                    // ==========================================
                    // CRIAR PERÍODOS DISPONÍVEIS
                    // DESCONTANDO AS PAUSAS
                    // ==========================================

                    const businessIntervals = [];

                    let currentStart =
                        businessOpenMinutes;


                    // ==========================================
                    // PERCORRER PAUSAS
                    // ==========================================

                    businessBreaks.forEach((breakInterval) => {

                        const breakOpen =
                            timeToMinutes(
                                breakInterval.open
                            );

                        const breakClose =
                            timeToMinutes(
                                breakInterval.close
                            );


                        // --------------------------------------
                        // PAUSA INVÁLIDA
                        // --------------------------------------

                        if (
                            breakOpen === null ||
                            breakClose === null ||
                            breakOpen >= breakClose
                        ) {
                            return;
                        }


                        // --------------------------------------
                        // PAUSA FORA DO HORÁRIO
                        // --------------------------------------

                        if (
                            breakClose <= businessOpenMinutes ||
                            breakOpen >= businessCloseMinutes
                        ) {
                            return;
                        }


                        // --------------------------------------
                        // LIMITAR PAUSA AO HORÁRIO DA EMPRESA
                        // --------------------------------------

                        const effectiveBreakOpen =
                            Math.max(
                                breakOpen,
                                businessOpenMinutes
                            );

                        const effectiveBreakClose =
                            Math.min(
                                breakClose,
                                businessCloseMinutes
                            );


                        // --------------------------------------
                        // PERÍODO ANTES DA PAUSA
                        // --------------------------------------

                        if (
                            currentStart <
                            effectiveBreakOpen
                        ) {

                            businessIntervals.push({
                                open:
                                    minutesToTime(
                                        currentStart
                                    ),

                                close:
                                    minutesToTime(
                                        effectiveBreakOpen
                                    )
                            });

                        }


                        // --------------------------------------
                        // CONTINUAR APÓS A PAUSA
                        // --------------------------------------

                        currentStart =
                            Math.max(
                                currentStart,
                                effectiveBreakClose
                            );

                    });


                    // ==========================================
                    // PERÍODO FINAL
                    // ==========================================

                    if (
                        currentStart <
                        businessCloseMinutes
                    ) {

                        businessIntervals.push({
                            open:
                                minutesToTime(
                                    currentStart
                                ),

                            close:
                                minutesToTime(
                                    businessCloseMinutes
                                )
                        });

                    }


                    // ==========================================
                    // HORÁRIOS OCUPADOS DO PROFISSIONAL
                    // ==========================================

                    const busySlots =
                        scheduledTimes.filter(
                            t => t.day === dayStr
                        );


                    // ==========================================
                    // GERAR TODOS OS SLOTS
                    // ==========================================

                    const allSlots = [];


                    businessIntervals.forEach((interval) => {

                        const openMinutes =
                            timeToMinutes(
                                interval.open
                            );

                        const closeMinutes =
                            timeToMinutes(
                                interval.close
                            );


                        // --------------------------------------
                        // INTERVALO INVÁLIDO
                        // --------------------------------------

                        if (
                            openMinutes === null ||
                            closeMinutes === null ||
                            openMinutes >= closeMinutes
                        ) {
                            return;
                        }


                        // --------------------------------------
                        // ÚLTIMO HORÁRIO POSSÍVEL
                        // --------------------------------------

                        const lastStart =
                            closeMinutes -
                            serviceDuration;


                        if (
                            lastStart <
                            openMinutes
                        ) {
                            return;
                        }


                        // --------------------------------------
                        // HORÁRIOS DE 30 EM 30 MINUTOS
                        // --------------------------------------

                        for (
                            let minutes = openMinutes;
                            minutes <= lastStart;
                            minutes += appointmentInterval
                        ) {

                            const slotStart =
                                minutes;

                            const slotEnd =
                                slotStart +
                                serviceDuration;


                            // --------------------------------------
                            // O SERVIÇO PRECISA CABER INTEIRO
                            // --------------------------------------

                            if (
                                slotStart >= openMinutes &&
                                slotEnd <= closeMinutes
                            ) {

                                allSlots.push(
                                    minutesToTime(
                                        slotStart
                                    )
                                );

                            }

                        }

                    });


                    // ==========================================
                    // REMOVER DUPLICADOS
                    // ==========================================

                    const uniqueSlots = [
                        ...new Set(allSlots)
                    ].sort(
                        (a, b) =>
                            timeToMinutes(a) -
                            timeToMinutes(b)
                    );


                    // ==========================================
                    // BLOQUEAR HORÁRIOS DO PROFISSIONAL
                    // ==========================================

                    const blockedSlots =
                        new Set();


                    busySlots.forEach((t) => {

                        if (!t.hour) {
                            return;
                        }


                        const startMinutes =
                            timeToMinutes(
                                t.hour
                            );


                        if (startMinutes === null) {
                            return;
                        }


                        const endMinutes =
                            startMinutes +
                            serviceDuration;


                        uniqueSlots.forEach((slot) => {

                            const slotMinutes =
                                timeToMinutes(slot);


                            if (slotMinutes === null) {
                                return;
                            }


                            // --------------------------------------
                            // VERIFICAR CONFLITO
                            // --------------------------------------

                            if (
                                slotMinutes < endMinutes &&
                                slotMinutes + serviceDuration >
                                startMinutes
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
                            freeSlots.filter(
                                slot =>
                                    timeToMinutes(slot) >
                                    nowMinutes
                            );

                    }


                    // ==========================================
                    // ADICIONAR DIA
                    // ==========================================

                    if (
                        freeSlots.length > 0
                    ) {

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

    const toggleExpanded = () => {
        setExpanded(prev => !prev);
    };

    const stripHtml = (html = "") => {
        const temp = document.createElement("div");

        temp.innerHTML = html;

        return (
            temp.textContent ||
            temp.innerText ||
            ""
        );
    };

    const createTruncatedHtml = (html, maxLength) => {
        if (!html) return "";

        const temp = document.createElement("div");
        temp.innerHTML = html;

        let currentLength = 0;
        let finished = false;

        const walk = (node) => {
            if (finished) return;

            if (node.nodeType === Node.TEXT_NODE) {
                const remaining = maxLength - currentLength;

                if (node.textContent.length > remaining) {
                    node.textContent =
                        node.textContent.slice(0, remaining);

                    currentLength = maxLength;
                    finished = true;
                } else {
                    currentLength += node.textContent.length;
                }

                return;
            }

            const children = Array.from(node.childNodes);

            for (const child of children) {
                if (finished) {
                    node.removeChild(child);
                    continue;
                }

                walk(child);
            }
        };

        walk(temp);

        return temp.innerHTML;
    };

    const descriptionText =
        stripHtml(product.description);

    const shouldTruncate =
        descriptionText.length > maxLength;

    const truncatedDescription =
        shouldTruncate
            ? createTruncatedHtml(
                product.description,
                maxLength
            )
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

    useEffect(() => {
        return () => {
            if (window.recaptchaVerifier) {
                try {
                    window.recaptchaVerifier.clear();
                } catch (error) {
                    console.warn(
                        "Erro ao limpar reCAPTCHA:",
                        error
                    );
                }

                window.recaptchaVerifier = null;
            }
        };
    }, []);

    if (!product) return null;

    const setupRecaptcha = () => {
        const auth = getAuth();

        const container =
            document.getElementById("recaptcha-container");

        if (!container) {
            throw new Error(
                "Container do reCAPTCHA não encontrado."
            );
        }

        if (window.recaptchaVerifier) {
            try {
                window.recaptchaVerifier.clear();
            } catch (error) {
                console.warn(
                    "Não foi possível limpar o reCAPTCHA anterior:",
                    error
                );
            }

            window.recaptchaVerifier = null;
        }

        const verifier =
            new RecaptchaVerifier(
                auth,
                "recaptcha-container",
                {
                    size: "invisible",

                    callback: () => {
                        console.log(
                            "✅ reCAPTCHA resolvido"
                        );
                    },

                    "expired-callback": () => {
                        console.log(
                            "⚠️ reCAPTCHA expirado"
                        );

                        if (window.recaptchaVerifier) {
                            try {
                                window.recaptchaVerifier.clear();
                            } catch (error) {
                                console.warn(
                                    "Erro ao limpar reCAPTCHA expirado:",
                                    error
                                );
                            }

                            window.recaptchaVerifier = null;
                        }
                    }
                }
            );

        window.recaptchaVerifier = verifier;

        return verifier;
    };

    const sendAuthCode = async () => {

        if (!authPhone.trim()) {
            setAuthError("Informe seu número de telefone.");
            return;
        }

        setAuthLoading(true);
        setAuthError("");

        try {

            const auth = getAuth();

            const phoneNumber =
                authPhone.startsWith("+")
                    ? authPhone
                    : `+55${authPhone.replace(/\D/g, "")}`;

            const appVerifier = setupRecaptcha();


            console.log("📞 Solicitando SMS para:", phoneNumber);

            const confirmation =
                await signInWithPhoneNumber(
                    auth,
                    phoneNumber,
                    appVerifier
                );

            console.log("📱 Firebase aceitou a solicitação de SMS:", confirmation);

            setAuthConfirmation(confirmation);
            setAuthStep("code");

        } catch (error) {

            console.error(
                "Erro ao enviar SMS:",
                error
            );

            setAuthError(
                "Não foi possível enviar o código. Verifique o número e tente novamente."
            );

            if (window.recaptchaVerifier) {
                try {
                    window.recaptchaVerifier.clear();
                } catch (error) {
                    console.warn(
                        "Erro ao limpar reCAPTCHA:",
                        error
                    );
                }

                window.recaptchaVerifier = null;
            }

        } finally {

            setAuthLoading(false);

        }
    };

    const verifyAuthCode = async () => {

        if (!authCode.trim()) {
            setAuthError("Informe o código recebido por SMS.");
            return;
        }

        if (!authConfirmation) {
            setAuthError("Solicite um novo código.");
            return;
        }

        setAuthLoading(true);
        setAuthError("");

        try {

            const result =
                await authConfirmation.confirm(
                    authCode.trim()
                );

            console.log(
                "✅ Telefone verificado:",
                result.user.uid
            );

            /*
             * IMPORTANTE:
             * Primeiro marcamos o telefone como verificado.
             *
             * NÃO abrimos o Mercado Pago aqui.
             */

            setPhoneVerified(true);
            setAuthStep("authenticated");

        } catch (error) {

            console.error(
                "Erro ao verificar telefone:",
                error
            );

            setAuthError(
                "Não foi possível verificar o código. Tente novamente."
            );

        } finally {

            setAuthLoading(false);

        }
    };

    const checkLoggedUser = () => {

        const auth = getAuth();
        const currentUser = auth.currentUser;

        if (currentUser?.email) {

            setIsUserLoggedIn(true);
            setLoggedUserEmail(currentUser.email);
            setLoggedUserId(currentUser.uid);

            return true;
        }

        setIsUserLoggedIn(false);
        setLoggedUserEmail("");
        setLoggedUserId(null);

        return false;
    };

    const buildAgendamento = () => {
        return {
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
    };

    const createPaymentData = () => {
        return {
            companyHandle,

            productId:
                product.id,

            professionalId:
                productDetailsSelectedProfessionalId,

            professionalName:
                relatedUsersWithInfo.find(
                    (u) =>
                        u.id ===
                        productDetailsSelectedProfessionalId
                )?.name ||
                "Profissional não identificado",

            day:
                selectedDay.day,

            dayLabel:
                selectedDay.label,

            hour:
                selectedSlot,

            userName:
                userName.trim(),

            clientId,

            userId:
                getAuth().currentUser?.uid || null
        };
    };

    const createMercadoPagoCheckout = async () => {

        setPaymentStatus("loading");
        setAuthError("");

        try {

            const currentUser =
                getAuth().currentUser;

            if (!currentUser) {
                throw new Error(
                    "Usuário não autenticado."
                );
            }

            /*
             * O Payment Brick será aberto
             * dentro do próprio Markfy.
             */

            setShowPaymentAuth(false);
            setShowMercadoPagoPayment(true);
            setPaymentStatus("idle");

        } catch (error) {

            console.error(
                "❌ Erro ao abrir pagamento:",
                error
            );

            setPaymentStatus("error");

            setAuthError(
                error.message ||
                "Não foi possível abrir o pagamento."
            );

        }

    };

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

    const finalizeAgendamento = async (agendamento) => {
        setIsConfirmed("loading");

        console.log(
            "📅 Agendamento iniciado:",
            agendamento
        );

        const success =
            await toShedule(agendamento);

        if (!success) {
            setIsConfirmed(false);
            setShowConfirmationModal(false);
            return;
        }

        saveLocalAgendamento({
            ...agendamento,
            status: "pending"
        });

        setLastAgendamento({
            ...agendamento,
            product,
        });

        setIsConfirmed("success");
    };

    const handleProductBack = () => {

        if (showMercadoPagoPayment) {
            setShowMercadoPagoPayment(false);
            setPaymentStatus("idle");
            setAuthError("");
            return;
        }

        if (showPaymentAuth) {
            setShowPaymentAuth(false);
            return;
        }

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

    const checkPendingPayment = async () => {
        try {
            const pendingPaymentRaw =
                localStorage.getItem("markfy-pending-payment");

            if (!pendingPaymentRaw) {
                return;
            }

            const pendingPayment =
                JSON.parse(pendingPaymentRaw);

            if (
                !pendingPayment?.paymentId ||
                pendingPayment.companyHandle !== companyHandle
            ) {
                return;
            }

            setShowPostCheckout(true);
            setPostCheckoutStatus("checking");

            const db = getDatabase();

            const paymentRef = ref(
                db,
                `companys/${companyHandle}/paymentOrders/${pendingPayment.paymentId}`
            );

            /*
             * Primeiro verificamos imediatamente.
             */

            const snapshot = await get(paymentRef);

            if (snapshot.exists()) {

                const paymentData = snapshot.val();

                setPostCheckoutPayment(paymentData);

                if (
                    paymentData.status === "paid" ||
                    paymentData.scheduleCreated === true
                ) {
                    setPostCheckoutStatus("success");

                    localStorage.removeItem(
                        "markfy-pending-payment"
                    );

                    return;
                }

                if (
                    paymentData.status === "rejected" ||
                    paymentData.status === "cancelled"
                ) {
                    setPostCheckoutStatus("error");
                    return;
                }
            }

            /*
             * O webhook pode ainda estar processando.
             *
             * Então observamos o paymentOrder
             * em tempo real.
             */

            const unsubscribe =
                onValue(
                    paymentRef,
                    (snapshot) => {

                        if (!snapshot.exists()) {
                            return;
                        }

                        const paymentData =
                            snapshot.val();

                        setPostCheckoutPayment(
                            paymentData
                        );

                        /*
                         * PAGAMENTO CONFIRMADO
                         */

                        if (
                            paymentData.status === "paid" ||
                            paymentData.scheduleCreated === true
                        ) {

                            setPostCheckoutStatus(
                                "success"
                            );

                            localStorage.removeItem(
                                "markfy-pending-payment"
                            );

                            unsubscribe();

                            return;
                        }

                        /*
                         * PAGAMENTO RECUSADO
                         */

                        if (
                            paymentData.status === "rejected" ||
                            paymentData.status === "cancelled"
                        ) {

                            setPostCheckoutStatus(
                                "error"
                            );

                            unsubscribe();

                            return;
                        }

                        /*
                         * PAGAMENTO AINDA PENDENTE
                         */

                        setPostCheckoutStatus(
                            "checking"
                        );
                    }
                );

            /*
             * Segurança:
             * não deixamos a tela esperando indefinidamente.
             */

            setTimeout(() => {
                unsubscribe();

                setPostCheckoutStatus((current) => {

                    if (current === "checking") {
                        return "timeout";
                    }

                    return current;
                });

            }, 60000);

        } catch (error) {

            console.error(
                "Erro ao verificar pagamento:",
                error
            );

            setPostCheckoutStatus("error");
        }
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


                    <CompanyInfoModal
                        isOpen={showCompanyInfo}
                        companyName={companyName}
                        companyHandle={companyHandle}
                        companyLogo={companyLogo}
                        onClose={() => setShowCompanyInfo(false)}
                    />

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
                                                    <button
                                                        type="button"
                                                        className="company-info-left"
                                                        onClick={() => setShowCompanyInfo(true)}
                                                        aria-label={`Ver informações sobre ${companyName}`}
                                                    >
                                                        {companyLogo && (
                                                            <div className="product-details-company-logo">
                                                                <img src={companyLogo} alt="Logo da Empresa" className="company-logo" />
                                                            </div>
                                                        )}
                                                        <span>
                                                            <h1>{companyName}</h1>
                                                            <p>@{companyHandle}</p>
                                                        </span>
                                                    </button>

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

                                                {requiresPayment && (
                                                    <div className="product-details-payment-notice">

                                                        <div className="product-details-payment-notice-icon">
                                                            <Icon icon="solar:card-outline" />
                                                        </div>

                                                        <div className="product-details-payment-notice-content">

                                                            <strong>
                                                                Pagamento antecipado necessário
                                                            </strong>

                                                            <span>
                                                                Para confirmar este agendamento, o pagamento
                                                                deverá ser realizado antecipadamente.
                                                            </span>

                                                        </div>

                                                    </div>
                                                )}

                                                <h1>Descrição</h1>

                                                {product.description && (
                                                    <div className="product-details-description">

                                                        <div
                                                            className="product-details-description-formatted"
                                                            dangerouslySetInnerHTML={{
                                                                __html: expanded
                                                                    ? product.description
                                                                    : truncatedDescription
                                                            }}
                                                        />

                                                        {shouldTruncate && (
                                                            <button
                                                                type="button"
                                                                className="read-more-inline"
                                                                onClick={toggleExpanded}
                                                            >
                                                                {expanded
                                                                    ? "Ler menos"
                                                                    : "Ler mais"}
                                                            </button>
                                                        )}

                                                    </div>
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

                                                        <div className="product-details-professional-heading">
                                                            <span className="product-details-step-eyebrow">
                                                                Agendamento
                                                            </span>

                                                            <h1>Escolha um profissional</h1>

                                                            <p>
                                                                Selecione quem irá realizar seu atendimento.
                                                            </p>
                                                        </div>

                                                    </div>


                                                    {Array.isArray(relatedUsersWithInfo) &&
                                                        relatedUsersWithInfo.length > 0 ? (

                                                        <div className="product-details-professional-selection">

                                                            <div className="product-details-professionals-list">

                                                                {relatedUsersWithInfo.map((user, index) => {

                                                                    const id = user.id ?? index;

                                                                    const isSelected =
                                                                        productDetailsSelectedProfessionalId === id;

                                                                    const initial =
                                                                        (user.name &&
                                                                            user.name.trim()[0]?.toUpperCase()) ||
                                                                        "?";

                                                                    return (
                                                                        <button
                                                                            type="button"
                                                                            key={id}
                                                                            className={`professional-selection-card ${isSelected ? "selected" : ""
                                                                                }`}
                                                                            onClick={() => {

                                                                                if (
                                                                                    productDetailsSelectedProfessionalId === id
                                                                                ) {
                                                                                    return;
                                                                                }

                                                                                setIsClosingTimes(true);

                                                                                setSelectedDay(null);
                                                                                setSelectedSlot(null);
                                                                                setAvailableTimes([]);
                                                                                setCurrentMonthIndex(0);

                                                                                setProductDetailsSelectedProfessionalId(id);

                                                                                setTimeout(() => {
                                                                                    setIsClosingTimes(false);
                                                                                }, 300);
                                                                            }}
                                                                            aria-pressed={isSelected}
                                                                        >

                                                                            <div className="professional-selection-avatar">

                                                                                {professionalPhotos[user.id] ? (

                                                                                    <img
                                                                                        src={
                                                                                            professionalPhotos[user.id]
                                                                                        }
                                                                                        alt=""
                                                                                    />

                                                                                ) : (

                                                                                    <span>
                                                                                        {initial}
                                                                                    </span>

                                                                                )}

                                                                            </div>


                                                                            <div className="professional-selection-info">

                                                                                <strong>
                                                                                    {user.name}
                                                                                </strong>

                                                                                <span>
                                                                                    {isSelected
                                                                                        ? "Profissional selecionado"
                                                                                        : "Selecionar profissional"}
                                                                                </span>

                                                                            </div>


                                                                            <div
                                                                                className={`professional-selection-check ${isSelected ? "selected" : ""
                                                                                    }`}
                                                                            >
                                                                                <Icon
                                                                                    icon={
                                                                                        isSelected
                                                                                            ? "material-symbols:check-rounded"
                                                                                            : "solar:alt-arrow-right-outline"
                                                                                    }
                                                                                />
                                                                            </div>

                                                                        </button>
                                                                    );
                                                                })}

                                                            </div>


                                                            {!productDetailsSelectedProfessionalId && (

                                                                <div className="no-professional-placeholder">

                                                                    <img
                                                                        src={noprofessionalplaceholder}
                                                                        alt=""
                                                                        className="no-professional-image"
                                                                    />

                                                                    <div>
                                                                        <h3>Nenhum profissional selecionado</h3>

                                                                        <p>
                                                                            Escolha um profissional acima para
                                                                            visualizar os dias e horários disponíveis.
                                                                        </p>
                                                                    </div>

                                                                </div>

                                                            )}


                                                            {productDetailsSelectedProfessionalId &&
                                                                !selectedDay && (

                                                                    <div className="product-details-available-days">

                                                                        <div className="choose-day-heading">

                                                                            <div>
                                                                                <span>
                                                                                    Próxima etapa
                                                                                </span>

                                                                                <h2>
                                                                                    Escolha um dia
                                                                                </h2>
                                                                            </div>

                                                                        </div>

                                                                        {months.length > 0 && (

                                                                            <div className="month-selector">

                                                                                <div className="month-header">

                                                                                    <button
                                                                                        type="button"
                                                                                        disabled={currentMonthIndex === 0}
                                                                                        onClick={() =>
                                                                                            setCurrentMonthIndex(
                                                                                                (i) => i - 1
                                                                                            )
                                                                                        }
                                                                                        className={`month-arrow ${currentMonthIndex === 0
                                                                                            ? "disabled"
                                                                                            : ""
                                                                                            }`}
                                                                                        aria-label="Mês anterior"
                                                                                    >
                                                                                        <Icon icon="humbleicons:arrow-left" />
                                                                                    </button>


                                                                                    <h3 className="month-title">
                                                                                        {months[currentMonthIndex]}
                                                                                    </h3>


                                                                                    <button
                                                                                        type="button"
                                                                                        disabled={
                                                                                            currentMonthIndex ===
                                                                                            months.length - 1
                                                                                        }
                                                                                        onClick={() =>
                                                                                            setCurrentMonthIndex(
                                                                                                (i) => i + 1
                                                                                            )
                                                                                        }
                                                                                        className={`month-arrow ${currentMonthIndex ===
                                                                                            months.length - 1
                                                                                            ? "disabled"
                                                                                            : ""
                                                                                            }`}
                                                                                        aria-label="Próximo mês"
                                                                                    >
                                                                                        <Icon icon="humbleicons:arrow-right" />
                                                                                    </button>

                                                                                </div>


                                                                                <div
                                                                                    className="days-scroll"
                                                                                    onWheel={(e) => {
                                                                                        const el = e.currentTarget;

                                                                                        if (
                                                                                            Math.abs(e.deltaY) >
                                                                                            Math.abs(e.deltaX)
                                                                                        ) {
                                                                                            el.scrollLeft += e.deltaY;
                                                                                            e.preventDefault();
                                                                                        }
                                                                                    }}
                                                                                >

                                                                                    {groupedByMonth[
                                                                                        months[currentMonthIndex]
                                                                                    ].map((day) => {

                                                                                        const [
                                                                                            dd,
                                                                                            mm,
                                                                                            yyyy
                                                                                        ] = day.day
                                                                                            .split("/")
                                                                                            .map((v) =>
                                                                                                v.padStart(2, "0")
                                                                                            );

                                                                                        const dateObj =
                                                                                            new Date(
                                                                                                Number(yyyy),
                                                                                                Number(mm) - 1,
                                                                                                Number(dd)
                                                                                            );

                                                                                        const dayName =
                                                                                            dateObj
                                                                                                .toLocaleDateString(
                                                                                                    "pt-BR",
                                                                                                    {
                                                                                                        weekday: "short"
                                                                                                    }
                                                                                                )
                                                                                                .replace(".", "");

                                                                                        const dayNumber =
                                                                                            dateObj.toLocaleDateString(
                                                                                                "pt-BR",
                                                                                                {
                                                                                                    day: "2-digit"
                                                                                                }
                                                                                            );

                                                                                        return (
                                                                                            <button
                                                                                                type="button"
                                                                                                key={day.day}
                                                                                                className="day-button"
                                                                                                onClick={() => {

                                                                                                    const label =
                                                                                                        dateObj.toLocaleDateString(
                                                                                                            "pt-BR",
                                                                                                            {
                                                                                                                weekday: "long",
                                                                                                                day: "2-digit",
                                                                                                                month: "2-digit",
                                                                                                                year: "numeric"
                                                                                                            }
                                                                                                        );

                                                                                                    setSelectedDay({
                                                                                                        ...day,
                                                                                                        label:
                                                                                                            label
                                                                                                                .charAt(0)
                                                                                                                .toUpperCase() +
                                                                                                            label.slice(1)
                                                                                                    });
                                                                                                }}
                                                                                            >
                                                                                                <span className="day-name">
                                                                                                    {dayName}
                                                                                                </span>

                                                                                                <span className="day-number">
                                                                                                    {dayNumber}
                                                                                                </span>
                                                                                            </button>
                                                                                        );
                                                                                    })}

                                                                                </div>

                                                                            </div>
                                                                        )}

                                                                    </div>
                                                                )}


                                                            <div
                                                                className={`product-details-available-times-wrapper ${selectedDay && !isClosingTimes
                                                                    ? "open"
                                                                    : isClosingTimes
                                                                        ? "closing"
                                                                        : ""
                                                                    }`}
                                                            >

                                                                {selectedDay && (

                                                                    <div className="product-details-available-times">

                                                                        <h2>
                                                                            Horários disponíveis em{" "}
                                                                            {selectedDay.label}
                                                                        </h2>

                                                                        <div
                                                                            className="slots-scroll"
                                                                            onWheel={(e) => {
                                                                                const el = e.currentTarget;

                                                                                if (
                                                                                    Math.abs(e.deltaY) >
                                                                                    Math.abs(e.deltaX)
                                                                                ) {
                                                                                    el.scrollLeft += e.deltaY;
                                                                                    e.preventDefault();
                                                                                }
                                                                            }}
                                                                        >

                                                                            {selectedDay.slots.map((slot) => (

                                                                                <button
                                                                                    type="button"
                                                                                    key={slot}
                                                                                    className={`slot-button ${selectedSlot === slot
                                                                                        ? "selected"
                                                                                        : ""
                                                                                        }`}
                                                                                    onClick={() =>
                                                                                        setSelectedSlot(slot)
                                                                                    }
                                                                                >
                                                                                    {slot}
                                                                                </button>

                                                                            ))}

                                                                        </div>

                                                                        <button
                                                                            type="button"
                                                                            className="back-to-days"
                                                                            onClick={() =>
                                                                                setSelectedDay(null)
                                                                            }
                                                                        >
                                                                            <Icon icon="humbleicons:arrow-left" />
                                                                            Voltar para dias
                                                                        </button>

                                                                    </div>

                                                                )}

                                                            </div>

                                                        </div>

                                                    ) : (

                                                        <p className="product-details-professional-empty">
                                                            Informação não disponível.
                                                        </p>

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
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.25, ease: "easeOut" }}
                                onClick={() => {
                                    if (
                                        isConfirmed !== "loading" &&
                                        paymentStatus !== "loading"
                                    ) {
                                        setShowConfirmationModal(false);
                                    }
                                }}
                            >
                                <motion.div
                                    className="confirmation-modal"
                                    role="dialog"
                                    aria-modal="true"
                                    aria-labelledby="confirmation-modal-title"
                                    onClick={(e) => e.stopPropagation()}
                                    initial={{
                                        opacity: 0,
                                        y: 24,
                                        scale: 0.96
                                    }}
                                    animate={{
                                        opacity: 1,
                                        y: 0,
                                        scale: 1
                                    }}
                                    exit={{
                                        opacity: 0,
                                        y: 20,
                                        scale: 0.97
                                    }}
                                    transition={{
                                        duration: 0.28,
                                        ease: [0.22, 1, 0.36, 1]
                                    }}
                                >

                                    {/* =====================================================
                    RECAPTCHA
                ===================================================== */}

                                    <div
                                        id="recaptcha-container"
                                        style={{
                                            position: "absolute",
                                            width: 1,
                                            height: 1,
                                            overflow: "hidden",
                                            opacity: 0,
                                            pointerEvents: "none"
                                        }}
                                    />

                                    {/* =====================================================
                    HEADER
                ===================================================== */}

                                    {isConfirmed !== "loading" && (
                                        <div className="confirmation-modal-header">

                                            <div className="confirmation-modal-header-left">

                                                <div className="confirmation-modal-header-icon">
                                                    <Icon icon="solar:calendar-add-outline" />
                                                </div>

                                                <div>
                                                    <span className="confirmation-modal-eyebrow">
                                                        {showPaymentAuth
                                                            ? "Pagamento seguro"
                                                            : isAskingPhone
                                                                ? "Quase lá"
                                                                : "Novo agendamento"}
                                                    </span>

                                                    <h2 id="confirmation-modal-title">
                                                        {showPaymentAuth
                                                            ? "Confirme seus dados"
                                                            : isAskingPhone
                                                                ? "Quem fará o agendamento?"
                                                                : "Confirme seu horário"}
                                                    </h2>
                                                </div>

                                            </div>

                                            <button
                                                type="button"
                                                className="confirmation-modal-close"
                                                aria-label="Fechar"
                                                onClick={() => {
                                                    if (
                                                        isConfirmed === "loading" ||
                                                        paymentStatus === "loading"
                                                    ) {
                                                        return;
                                                    }

                                                    setShowConfirmationModal(false);
                                                }}
                                            >
                                                <Icon icon="mdi:close" />
                                            </button>

                                        </div>
                                    )}

                                    {/* =====================================================
                    ETAPA 1 — RESUMO DO AGENDAMENTO
                ===================================================== */}

                                    {!isAskingPhone &&
                                        !showPaymentAuth &&
                                        isConfirmed === false && (

                                            <motion.div
                                                key="confirmation-step"
                                                className="confirmation-modal-step"
                                                initial={{ opacity: 0, x: -12 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 12 }}
                                                transition={{ duration: 0.2 }}
                                            >

                                                {/* Serviço */}

                                                <div className="confirmation-service-card">

                                                    <div className="confirmation-service-image">

                                                        {images[selectedImage] ? (
                                                            <img
                                                                src={images[selectedImage]}
                                                                alt={product.name}
                                                            />
                                                        ) : (
                                                            <div className="confirmation-service-image-fallback">
                                                                <Icon icon="solar:scissors-outline" />
                                                            </div>
                                                        )}

                                                    </div>

                                                    <div className="confirmation-service-info">

                                                        <span className="confirmation-service-label">
                                                            Serviço
                                                        </span>

                                                        <h3>
                                                            {product.name}
                                                        </h3>

                                                        <div className="confirmation-service-meta">

                                                            {product.duration && (
                                                                <span>
                                                                    <Icon icon="solar:clock-circle-outline" />
                                                                    {formatDuration
                                                                        ? formatDuration(product.duration)
                                                                        : `${product.duration} min`}
                                                                </span>
                                                            )}

                                                            <span>
                                                                <Icon icon="solar:tag-outline" />
                                                                {product.value}
                                                            </span>

                                                        </div>

                                                    </div>

                                                </div>

                                                {/* Informações do agendamento */}

                                                <div className="confirmation-booking-card">

                                                    <div className="confirmation-booking-card-header">

                                                        <div>
                                                            <span className="confirmation-section-label">
                                                                Seu horário
                                                            </span>

                                                            <strong>
                                                                Confira os detalhes antes de continuar
                                                            </strong>
                                                        </div>

                                                        <div className="confirmation-booking-status">
                                                            <Icon icon="solar:check-circle-outline" />
                                                            Disponível
                                                        </div>

                                                    </div>

                                                    <div className="confirmation-booking-grid">

                                                        <div className="confirmation-booking-item">

                                                            <div className="confirmation-booking-item-icon">
                                                                <Icon icon="solar:user-outline" />
                                                            </div>

                                                            <div>
                                                                <span>Profissional</span>

                                                                <strong>
                                                                    {
                                                                        relatedUsersWithInfo.find(
                                                                            (u) =>
                                                                                u.id ===
                                                                                productDetailsSelectedProfessionalId
                                                                        )?.name ||
                                                                        "Profissional não identificado"
                                                                    }
                                                                </strong>
                                                            </div>

                                                        </div>

                                                        <div className="confirmation-booking-item">

                                                            <div className="confirmation-booking-item-icon">
                                                                <Icon icon="solar:calendar-outline" />
                                                            </div>

                                                            <div>
                                                                <span>Data</span>

                                                                <strong>
                                                                    {selectedDay?.label || "—"}
                                                                </strong>
                                                            </div>

                                                        </div>

                                                        <div className="confirmation-booking-item">

                                                            <div className="confirmation-booking-item-icon">
                                                                <Icon icon="solar:clock-circle-outline" />
                                                            </div>

                                                            <div>
                                                                <span>Horário</span>

                                                                <strong>
                                                                    {selectedSlot || "—"}
                                                                </strong>
                                                            </div>

                                                        </div>

                                                        <div className="confirmation-booking-item">

                                                            <div className="confirmation-booking-item-icon">
                                                                <Icon icon="solar:wallet-outline" />
                                                            </div>

                                                            <div>
                                                                <span>Valor</span>

                                                                <strong>
                                                                    {product.value}
                                                                </strong>
                                                            </div>

                                                        </div>

                                                    </div>

                                                </div>

                                                {/* Aviso de pagamento */}

                                                {requiresPayment && (
                                                    <div className="confirmation-payment-notice">

                                                        <div className="confirmation-payment-notice-icon">
                                                            <Icon icon="solar:card-outline" />
                                                        </div>

                                                        <div>
                                                            <strong>
                                                                Pagamento antecipado
                                                            </strong>

                                                            <span>
                                                                Após confirmar seus dados,
                                                                você será direcionado para o
                                                                pagamento seguro.
                                                            </span>
                                                        </div>

                                                        <Icon
                                                            icon="solar:shield-check-outline"
                                                            className="confirmation-payment-notice-check"
                                                        />

                                                    </div>
                                                )}

                                                {/* Ações */}

                                                <div className="confirmation-modal-actions">

                                                    <button
                                                        type="button"
                                                        className="confirmation-modal-button confirmation-modal-button--secondary"
                                                        onClick={() =>
                                                            setShowConfirmationModal(false)
                                                        }
                                                    >
                                                        <Icon icon="solar:arrow-left-outline" />
                                                        <span>Voltar</span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="confirmation-modal-button confirmation-modal-button--primary"
                                                        onClick={() => {
                                                            checkLoggedUser();

                                                            setEmailConfirmed(false);

                                                            setIsAskingPhone(true);
                                                        }}
                                                    >
                                                        <span>
                                                            Continuar
                                                        </span>

                                                        <Icon icon="solar:arrow-right-outline" />
                                                    </button>

                                                </div>

                                            </motion.div>
                                        )}

                                    {/* =====================================================
                    ETAPA 2 — NOME
                ===================================================== */}

                                    {/* =====================================================
    ETAPA 2 — IDENTIFICAÇÃO
===================================================== */}

                                    {isAskingPhone &&
                                        !showPaymentAuth &&
                                        isConfirmed === false && (

                                            <motion.div
                                                key="identification-step"
                                                className="confirmation-modal-step"
                                                initial={{
                                                    opacity: 0,
                                                    x: 16
                                                }}
                                                animate={{
                                                    opacity: 1,
                                                    x: 0
                                                }}
                                                exit={{
                                                    opacity: 0,
                                                    x: -16
                                                }}
                                                transition={{
                                                    duration: 0.22
                                                }}
                                            >

                                                {/* =====================================================
                USUÁRIO LOGADO
            ===================================================== */}

                                                {isUserLoggedIn ? (

                                                    <>

                                                        <div className="confirmation-step-intro">

                                                            <div className="confirmation-step-icon">
                                                                <Icon icon="solar:user-circle-outline" />
                                                            </div>

                                                            <div>

                                                                <span className="confirmation-step-label">
                                                                    Identificação
                                                                </span>

                                                                <h3>
                                                                    Confirme seus dados
                                                                </h3>

                                                                <p>
                                                                    Você já está conectado.
                                                                    Confirme seu nome e e-mail para
                                                                    identificar o agendamento.
                                                                </p>

                                                            </div>

                                                        </div>


                                                        {/* =================================================
                        NOME
                    ================================================= */}

                                                        <div className="confirmation-form">

                                                            <label
                                                                htmlFor="confirmation-user-name"
                                                                className="confirmation-form-label"
                                                            >
                                                                Seu nome
                                                            </label>

                                                            <div
                                                                className={`confirmation-input-wrapper ${userName.trim()
                                                                    ? "has-value"
                                                                    : ""
                                                                    }`}
                                                            >

                                                                <Icon
                                                                    icon="solar:user-outline"
                                                                    className="confirmation-input-icon"
                                                                />

                                                                <input
                                                                    id="confirmation-user-name"
                                                                    type="text"
                                                                    autoComplete="name"
                                                                    placeholder="Digite seu nome completo"
                                                                    value={userName}
                                                                    maxLength={40}
                                                                    autoFocus
                                                                    onChange={(e) =>
                                                                        setUserName(
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                />

                                                                {userName.trim() && (
                                                                    <Icon
                                                                        icon="solar:check-circle-outline"
                                                                        className="confirmation-input-success"
                                                                    />
                                                                )}

                                                            </div>

                                                            <span className="confirmation-form-hint">
                                                                Usaremos esse nome para identificar
                                                                seu agendamento.
                                                            </span>

                                                        </div>


                                                        {/* =================================================
                        E-MAIL DA CONTA
                    ================================================= */}

                                                        <div
                                                            className="confirmation-logged-email"
                                                            style={{
                                                                marginTop: "16px",
                                                                marginBottom: "0"
                                                            }}
                                                        >

                                                            <div className="confirmation-logged-email-icon">

                                                                <Icon icon="solar:letter-outline" />

                                                            </div>

                                                            <div className="confirmation-logged-email-content">

                                                                <span>
                                                                    Esse é o seu e-mail?
                                                                </span>

                                                                <strong>
                                                                    {loggedUserEmail}
                                                                </strong>

                                                            </div>

                                                            <div className="confirmation-logged-email-check">

                                                                <Icon icon="solar:check-circle-bold" />

                                                            </div>

                                                        </div>


                                                        {/* =================================================
                        RESUMO DO HORÁRIO
                    ================================================= */}

                                                        <div className="confirmation-mini-summary">

                                                            <div className="confirmation-mini-summary-icon">

                                                                <Icon icon="solar:calendar-mark-outline" />

                                                            </div>

                                                            <div className="confirmation-mini-summary-content">

                                                                <strong>
                                                                    {selectedDay?.label}
                                                                </strong>

                                                                <span>
                                                                    às {selectedSlot} • {
                                                                        relatedUsersWithInfo.find(
                                                                            (u) =>
                                                                                u.id ===
                                                                                productDetailsSelectedProfessionalId
                                                                        )?.name ||
                                                                        "Profissional"
                                                                    }
                                                                </span>

                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setIsAskingPhone(false);
                                                                }}
                                                                aria-label="Editar horário"
                                                            >
                                                                <Icon icon="solar:pen-outline" />
                                                            </button>

                                                        </div>


                                                        {/* =================================================
                        AÇÕES
                    ================================================= */}

                                                        <div className="confirmation-modal-actions">

                                                            <button
                                                                type="button"
                                                                className="confirmation-modal-button confirmation-modal-button--secondary"
                                                                onClick={() =>
                                                                    setIsAskingPhone(false)
                                                                }
                                                            >

                                                                <Icon icon="solar:arrow-left-outline" />

                                                                <span>
                                                                    Voltar
                                                                </span>

                                                            </button>


                                                            <button
                                                                type="button"
                                                                className="confirmation-modal-button confirmation-modal-button--primary"
                                                                disabled={!userName.trim()}
                                                                onClick={async () => {

                                                                    const agendamento =
                                                                        buildAgendamento();

                                                                    setEmailConfirmed(true);

                                                                    /*
                                                                     * Usuário já está autenticado.
                                                                     *
                                                                     * Não precisa:
                                                                     * - telefone
                                                                     * - SMS
                                                                     * - novo login
                                                                     */

                                                                    if (requiresPayment) {

                                                                        openCheckout();

                                                                        return;
                                                                    }

                                                                    await finalizeAgendamento(
                                                                        agendamento
                                                                    );

                                                                }}
                                                            >

                                                                <span>
                                                                    {requiresPayment
                                                                        ? "Continuar para pagamento"
                                                                        : "Confirmar agendamento"}
                                                                </span>

                                                                <Icon
                                                                    icon={
                                                                        requiresPayment
                                                                            ? "solar:arrow-right-outline"
                                                                            : "solar:check-outline"
                                                                    }
                                                                />

                                                            </button>

                                                        </div>

                                                    </>

                                                ) : (

                                                    /* =====================================================
                                                       USUÁRIO NÃO LOGADO
                                                    ===================================================== */

                                                    <>

                                                        <div className="confirmation-step-intro">

                                                            <div className="confirmation-step-icon">

                                                                <Icon icon="solar:user-circle-outline" />

                                                            </div>

                                                            <div>

                                                                <span className="confirmation-step-label">
                                                                    Identificação
                                                                </span>

                                                                <h3>
                                                                    Como podemos te chamar?
                                                                </h3>

                                                                <p>
                                                                    Informe seu nome para identificarmos
                                                                    seu agendamento.
                                                                </p>

                                                            </div>

                                                        </div>


                                                        {/* =================================================
                        NOME
                    ================================================= */}

                                                        <div className="confirmation-form">

                                                            <label
                                                                htmlFor="confirmation-user-name"
                                                                className="confirmation-form-label"
                                                            >
                                                                Seu nome
                                                            </label>

                                                            <div
                                                                className={`confirmation-input-wrapper ${userName.trim()
                                                                    ? "has-value"
                                                                    : ""
                                                                    }`}
                                                            >

                                                                <Icon
                                                                    icon="solar:user-outline"
                                                                    className="confirmation-input-icon"
                                                                />

                                                                <input
                                                                    id="confirmation-user-name"
                                                                    type="text"
                                                                    autoComplete="name"
                                                                    placeholder="Digite seu nome completo"
                                                                    value={userName}
                                                                    maxLength={40}
                                                                    autoFocus
                                                                    onChange={(e) =>
                                                                        setUserName(
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    onKeyDown={(e) => {

                                                                        if (
                                                                            e.key === "Enter" &&
                                                                            userName.trim()
                                                                        ) {

                                                                            const agendamento =
                                                                                buildAgendamento();

                                                                            if (requiresPayment) {

                                                                                setPhoneVerified(false);

                                                                                setShowPaymentAuth(true);

                                                                                setAuthStep("phone");

                                                                                setAuthCode("");

                                                                                setAuthError("");

                                                                                return;

                                                                            }

                                                                            finalizeAgendamento(
                                                                                agendamento
                                                                            );

                                                                        }

                                                                    }}
                                                                />

                                                                {userName.trim() && (

                                                                    <Icon
                                                                        icon="solar:check-circle-outline"
                                                                        className="confirmation-input-success"
                                                                    />

                                                                )}

                                                            </div>

                                                            <span className="confirmation-form-hint">
                                                                Usaremos esse nome apenas para identificar
                                                                seu agendamento.
                                                            </span>

                                                        </div>


                                                        {/* =================================================
                        RESUMO DO HORÁRIO
                    ================================================= */}

                                                        <div className="confirmation-mini-summary">

                                                            <div className="confirmation-mini-summary-icon">

                                                                <Icon icon="solar:calendar-mark-outline" />

                                                            </div>

                                                            <div className="confirmation-mini-summary-content">

                                                                <strong>
                                                                    {selectedDay?.label}
                                                                </strong>

                                                                <span>
                                                                    às {selectedSlot} • {
                                                                        relatedUsersWithInfo.find(
                                                                            (u) =>
                                                                                u.id ===
                                                                                productDetailsSelectedProfessionalId
                                                                        )?.name ||
                                                                        "Profissional"
                                                                    }
                                                                </span>

                                                            </div>

                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setIsAskingPhone(false);
                                                                }}
                                                                aria-label="Editar horário"
                                                            >

                                                                <Icon icon="solar:pen-outline" />

                                                            </button>

                                                        </div>


                                                        {/* =================================================
                        AÇÕES
                    ================================================= */}

                                                        <div className="confirmation-modal-actions">

                                                            <button
                                                                type="button"
                                                                className="confirmation-modal-button confirmation-modal-button--secondary"
                                                                onClick={() =>
                                                                    setIsAskingPhone(false)
                                                                }
                                                            >

                                                                <Icon icon="solar:arrow-left-outline" />

                                                                <span>
                                                                    Voltar
                                                                </span>

                                                            </button>


                                                            <button
                                                                type="button"
                                                                className="confirmation-modal-button confirmation-modal-button--primary"
                                                                disabled={!userName.trim()}
                                                                onClick={async () => {

                                                                    const agendamento =
                                                                        buildAgendamento();

                                                                    if (requiresPayment) {

                                                                        setPhoneVerified(false);

                                                                        setShowPaymentAuth(true);

                                                                        setAuthStep("phone");

                                                                        setAuthCode("");

                                                                        setAuthError("");

                                                                        return;

                                                                    }

                                                                    await finalizeAgendamento(
                                                                        agendamento
                                                                    );

                                                                }}
                                                            >

                                                                <span>
                                                                    Confirmar agendamento
                                                                </span>

                                                                <Icon icon="solar:check-outline" />

                                                            </button>

                                                        </div>

                                                    </>

                                                )}

                                            </motion.div>
                                        )}
                                    {/* =====================================================
                    PAGAMENTO — AUTENTICAÇÃO
                ===================================================== */}

                                    {showPaymentAuth &&
                                        isConfirmed === false && (

                                            <motion.div
                                                key="payment-auth"
                                                className="confirmation-modal-step confirmation-payment-auth"
                                                initial={{ opacity: 0, x: 18 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -18 }}
                                                transition={{ duration: 0.22 }}
                                            >

                                                <button
                                                    type="button"
                                                    className="confirmation-inline-back"
                                                    onClick={() => {

                                                        setShowPaymentAuth(false);
                                                        setAuthStep("phone");
                                                        setAuthCode("");
                                                        setAuthError("");

                                                    }}
                                                >
                                                    <Icon icon="solar:arrow-left-outline" />
                                                    Voltar
                                                </button>

                                                {/* Segurança */}

                                                <div className="confirmation-payment-hero">

                                                    <div className="confirmation-payment-hero-icon">
                                                        <Icon icon="solar:shield-check-outline" />
                                                    </div>

                                                    <div>

                                                        <span>
                                                            Pagamento protegido
                                                        </span>

                                                        <h3>
                                                            Confirme seu telefone
                                                        </h3>

                                                        <p>
                                                            Essa etapa ajuda a proteger seu
                                                            agendamento e confirmar sua identidade.
                                                        </p>

                                                    </div>

                                                </div>

                                                {/* Telefone */}

                                                {authStep === "phone" && !phoneVerified && (
                                                    <motion.div
                                                        key="phone"
                                                        className="confirmation-auth-content"
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                    >

                                                        <div className="confirmation-form">

                                                            <label
                                                                htmlFor="confirmation-auth-phone"
                                                                className="confirmation-form-label"
                                                            >
                                                                Número de telefone
                                                            </label>

                                                            <div className="confirmation-input-wrapper">

                                                                <Icon
                                                                    icon="solar:phone-outline"
                                                                    className="confirmation-input-icon"
                                                                />

                                                                <InputMask
                                                                    mask="(99) 99999-9999"
                                                                    value={authPhone}
                                                                    onChange={(e) =>
                                                                        setAuthPhone(
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                >
                                                                    {(inputProps) => (
                                                                        <input
                                                                            {...inputProps}
                                                                            id="confirmation-auth-phone"
                                                                            type="tel"
                                                                            autoComplete="tel"
                                                                            placeholder="(00) 00000-0000"
                                                                            autoFocus
                                                                        />
                                                                    )}
                                                                </InputMask>

                                                            </div>

                                                            <span className="confirmation-form-hint">
                                                                Enviaremos um código de verificação
                                                                por SMS.
                                                            </span>

                                                        </div>

                                                        {authError && (
                                                            <motion.div
                                                                className="confirmation-auth-error"
                                                                initial={{
                                                                    opacity: 0,
                                                                    y: -5
                                                                }}
                                                                animate={{
                                                                    opacity: 1,
                                                                    y: 0
                                                                }}
                                                            >
                                                                <Icon icon="solar:danger-triangle-outline" />

                                                                <span>
                                                                    {authError}
                                                                </span>
                                                            </motion.div>
                                                        )}

                                                        <button
                                                            type="button"
                                                            className="confirmation-modal-button confirmation-modal-button--primary confirmation-auth-button"
                                                            disabled={
                                                                authLoading ||
                                                                !authPhone.trim()
                                                            }
                                                            onClick={sendAuthCode}
                                                        >
                                                            {authLoading ? (
                                                                <>
                                                                    <Icon
                                                                        icon="svg-spinners:90-ring-with-bg"
                                                                    />

                                                                    <span>
                                                                        Enviando código...
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span>
                                                                        Enviar código
                                                                    </span>

                                                                    <Icon icon="solar:plain-2-outline" />
                                                                </>
                                                            )}
                                                        </button>

                                                    </motion.div>
                                                )}

                                                {/* Código */}

                                                {authStep === "code" && !phoneVerified && (
                                                    <motion.div
                                                        key="code"
                                                        className="confirmation-auth-content"
                                                        initial={{
                                                            opacity: 0,
                                                            x: 12
                                                        }}
                                                        animate={{
                                                            opacity: 1,
                                                            x: 0
                                                        }}
                                                    >

                                                        <div className="confirmation-code-header">

                                                            <div className="confirmation-code-icon">
                                                                <Icon icon="solar:chat-round-call-outline" />
                                                            </div>

                                                            <div>

                                                                <span>
                                                                    Código enviado
                                                                </span>

                                                                <strong>
                                                                    {authPhone}
                                                                </strong>

                                                            </div>

                                                        </div>

                                                        <div className="confirmation-form">

                                                            <label
                                                                htmlFor="confirmation-auth-code"
                                                                className="confirmation-form-label"
                                                            >
                                                                Código de verificação
                                                            </label>

                                                            <input
                                                                id="confirmation-auth-code"
                                                                type="text"
                                                                inputMode="numeric"
                                                                autoComplete="one-time-code"
                                                                maxLength={6}
                                                                autoFocus
                                                                className="confirmation-code-input"
                                                                placeholder="000000"
                                                                value={authCode}
                                                                onChange={(e) =>
                                                                    setAuthCode(
                                                                        e.target.value
                                                                            .replace(/\D/g, "")
                                                                    )
                                                                }
                                                                onKeyDown={(e) => {

                                                                    if (
                                                                        e.key === "Enter" &&
                                                                        authCode.length === 6 &&
                                                                        !authLoading
                                                                    ) {
                                                                        verifyAuthCode();
                                                                    }

                                                                }}
                                                            />

                                                            <span className="confirmation-form-hint">
                                                                Digite os 6 números recebidos por SMS.
                                                            </span>

                                                        </div>

                                                        {authError && (
                                                            <motion.div
                                                                className="confirmation-auth-error"
                                                                initial={{
                                                                    opacity: 0,
                                                                    y: -5
                                                                }}
                                                                animate={{
                                                                    opacity: 1,
                                                                    y: 0
                                                                }}
                                                            >
                                                                <Icon icon="solar:danger-triangle-outline" />

                                                                <span>
                                                                    {authError}
                                                                </span>
                                                            </motion.div>
                                                        )}

                                                        <button
                                                            type="button"
                                                            className="confirmation-modal-button confirmation-modal-button--primary confirmation-auth-button"
                                                            disabled={
                                                                authLoading ||
                                                                authCode.length !== 6
                                                            }
                                                            onClick={verifyAuthCode}
                                                        >
                                                            {authLoading ? (
                                                                <>
                                                                    <Icon
                                                                        icon="svg-spinners:90-ring-with-bg"
                                                                    />

                                                                    <span>
                                                                        Verificando...
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span>
                                                                        Confirmar telefone
                                                                    </span>

                                                                    <Icon icon="solar:check-outline" />
                                                                </>
                                                            )}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="confirmation-change-phone"
                                                            onClick={() => {

                                                                setAuthStep("phone");
                                                                setAuthCode("");
                                                                setAuthError("");

                                                            }}
                                                        >
                                                            <Icon icon="solar:pen-outline" />

                                                            Alterar número
                                                        </button>

                                                    </motion.div>
                                                )}

                                                {/* =====================================================
    TELEFONE VERIFICADO
===================================================== */}

                                                {phoneVerified && (
                                                    <motion.div
                                                        key="phone-verified"
                                                        className="confirmation-auth-verified"
                                                        initial={{
                                                            opacity: 0,
                                                            y: 8
                                                        }}
                                                        animate={{
                                                            opacity: 1,
                                                            y: 0
                                                        }}
                                                        transition={{
                                                            duration: 0.3,
                                                            ease: [0.22, 1, 0.36, 1]
                                                        }}
                                                    >

                                                        <div className="confirmation-auth-verified-main">

                                                            <div className="confirmation-auth-verified-icon">
                                                                <Icon icon="solar:check-circle-bold" />
                                                            </div>

                                                            <div className="confirmation-auth-verified-info">

                                                                <h3>
                                                                    Telefone verificado
                                                                </h3>

                                                                <div className="confirmation-auth-verified-phone">

                                                                    <span>
                                                                        {authPhone}
                                                                    </span>

                                                                    <button
                                                                        type="button"
                                                                        className="confirmation-auth-edit"
                                                                        aria-label="Alterar número de telefone"
                                                                        onClick={() => {
                                                                            setPhoneVerified(false);
                                                                            setAuthStep("phone");
                                                                            setAuthError("");
                                                                            setAuthCode("");
                                                                            setAuthConfirmation(null);
                                                                        }}
                                                                    >
                                                                        <Icon icon="solar:pen-2-outline" />
                                                                    </button>

                                                                </div>

                                                            </div>

                                                        </div>

                                                        <button
                                                            type="button"
                                                            className="confirmation-modal-button confirmation-modal-button--primary confirmation-auth-button"
                                                            onClick={async () => {
                                                                await createMercadoPagoCheckout();
                                                            }}
                                                        >
                                                            <span>
                                                                Continuar para pagamento
                                                            </span>

                                                            <Icon icon="solar:arrow-right-outline" />
                                                        </button>

                                                    </motion.div>
                                                )}

                                            </motion.div>
                                        )}

                                    {/* =====================================================
                    LOADING
                ===================================================== */}

                                    {isConfirmed === "loading" && (

                                        <motion.div
                                            key="loading"
                                            className="confirmation-modal-state confirmation-modal-state--loading"
                                            initial={{
                                                opacity: 0,
                                                scale: 0.96
                                            }}
                                            animate={{
                                                opacity: 1,
                                                scale: 1
                                            }}
                                            exit={{
                                                opacity: 0,
                                                scale: 0.96
                                            }}
                                        >

                                            <div className="confirmation-loading-icon">

                                                <Icon icon="svg-spinners:ring-resize" />

                                            </div>

                                            <span className="confirmation-state-eyebrow">
                                                Só um momento
                                            </span>

                                            <h2>
                                                Confirmando seu agendamento
                                            </h2>

                                            <p>
                                                Estamos reservando seu horário.
                                                Isso pode levar alguns segundos.
                                            </p>

                                            <div className="confirmation-loading-progress">
                                                <span />
                                            </div>

                                        </motion.div>

                                    )}

                                    {/* =====================================================
                    SUCESSO
                ===================================================== */}

                                    {isConfirmed === "success" && (

                                        <motion.div
                                            key="success"
                                            className="confirmation-modal-state confirmation-modal-state--success"
                                            initial={{
                                                opacity: 0,
                                                scale: 0.94
                                            }}
                                            animate={{
                                                opacity: 1,
                                                scale: 1
                                            }}
                                            exit={{
                                                opacity: 0,
                                                scale: 0.94
                                            }}
                                            transition={{
                                                duration: 0.35,
                                                ease: [0.22, 1, 0.36, 1]
                                            }}
                                        >

                                            <div className="confirmation-success-icon">

                                                <Icon icon="solar:check-circle-bold" />

                                            </div>

                                            <span className="confirmation-state-eyebrow">
                                                Tudo certo!
                                            </span>

                                            <h2>
                                                Agendamento confirmado
                                            </h2>

                                            <p>
                                                Seu horário foi reservado com sucesso.
                                                Esperamos você!
                                            </p>

                                            <div className="confirmation-success-card">

                                                <div className="confirmation-success-service">

                                                    <div className="confirmation-success-service-icon">
                                                        <Icon icon="solar:scissors-outline" />
                                                    </div>

                                                    <div>

                                                        <span>
                                                            Serviço
                                                        </span>

                                                        <strong>
                                                            {lastAgendamento?.productName ||
                                                                product.name}
                                                        </strong>

                                                    </div>

                                                </div>

                                                <div className="confirmation-success-divider" />

                                                <div className="confirmation-success-details">

                                                    <div>

                                                        <Icon icon="solar:calendar-outline" />

                                                        <span>
                                                            {lastAgendamento?.day ||
                                                                selectedDay?.label}
                                                        </span>

                                                    </div>

                                                    <div>

                                                        <Icon icon="solar:clock-circle-outline" />

                                                        <span>
                                                            {lastAgendamento?.hour ||
                                                                selectedSlot}
                                                        </span>

                                                    </div>

                                                </div>

                                            </div>

                                            <div className="confirmation-modal-actions">

                                                <button
                                                    type="button"
                                                    className="confirmation-modal-button confirmation-modal-button--secondary"
                                                    onClick={() => {

                                                        setShowConfirmationModal(false);
                                                        setIsAskingPhone(false);
                                                        setIsConfirmed(false);
                                                        setShowPaymentAuth(false);
                                                        setUserName("");

                                                        setPhoneVerified(false);
                                                        setAuthStep("phone");
                                                        setAuthCode("");
                                                        setAuthError("");

                                                    }}
                                                >
                                                    Fechar
                                                </button>

                                                <button
                                                    type="button"
                                                    className="confirmation-modal-button confirmation-modal-button--primary"
                                                    onClick={() => {

                                                        setShowConfirmationModal(false);
                                                        setShowOrderSummary(true);

                                                    }}
                                                >
                                                    <span>
                                                        Ver agendamento
                                                    </span>

                                                    <Icon icon="solar:arrow-right-outline" />
                                                </button>

                                            </div>

                                        </motion.div>

                                    )}

                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>

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
