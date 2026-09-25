import React, { useEffect, useState } from "react";
import {
    useNavigate
} from "react-router-dom";

import { createPortal } from "react-dom";
import { getDatabase, ref, onValue, get, update } from "firebase/database";
import { Icon } from '@iconify/react';
import { getClientId } from "../../../../utils/clientID";
import {
    formatPhoneBR,
    isValidPhoneBR,
    toE164BR
} from "../../../../utils/phoneBR";

import Toast from "../../../../components/toast/Toast";
import {
    getStorage,
    ref as storageRef,
    getDownloadURL,
} from "firebase/storage";

import {
    getAuth,
    onAuthStateChanged,
    RecaptchaVerifier,
    signInWithPhoneNumber
} from "firebase/auth";

import OrderSummary from "../../../../components/order-summary";
import CompanyInfoModal from "../../CompanyInfoModal/CompanyInfoModal";

import {
    getPlanHighlights,
    getPlanPriceSuffix,
    getPlanSessionsLabel,
    normalizeMonthlyPlan
} from "../../../../utils/subscription";

import {
    getSubscriptionSummary,
    getUserSubscription,
    isSubscriptionUsable
} from "../../../../utils/subscriptionRuntime";

import { useSingleProductImages } from "../../../../utils/productImages";

import { useExitTransition } from "../../../../hooks/useExitTransition";

import "./product-details.css";

import noprofessionalplaceholder from "../../../../img/product-details/not-professional.png";

import MercadoPagoPayment from "../../../../components/mercado-pago-payment/MercadoPagoPayment";
import Modal from "../../../../components/modal/Modal";

/* Um recado, não um texto. O limite existe para o card do
   pedido no painel continuar legível. */
const NOTES_MAX_LENGTH = 300;


const ProductDetails = ({ product, companyName, companyHandle, companyLogo, onClose, formatDuration }) => {
    const clientId = getClientId();

    const navigate = useNavigate();

    /* =========================================================
       PLANO DE MENSALIDADE

       `null` para produtos avulsos — todo o bloco de assinatura
       depende desta única checagem.
    ========================================================= */

    const monthlyPlan =
        normalizeMonthlyPlan(product);

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

    /* Enquanto o Firebase restaura a sessão do disco,
       auth.currentUser é null. Sem esperar por isso, quem já
       estava logado caía no fluxo de visitante. */
    const [authReady, setAuthReady] = useState(false);

    /* Dados de quem não tem conta. O e-mail entra aqui porque
       o Mercado Pago exige um pagador com e-mail para emitir
       o Pix. */
    const [guestEmail, setGuestEmail] = useState("");

    /* Recado do cliente para quem vai atender. */
    const [notes, setNotes] = useState("");

    /* =====================================================
       MENSALIDADE

       Assinatura já ativa desta pessoa neste produto.

       Quando existe, o produto deixa de ser "comprar" e vira
       "usar o que já pago": a pessoa não passa por pagamento
       nenhum, só escolhe o próximo horário dentro do que o
       plano dá.
    ===================================================== */

    const [activeSubscription, setActiveSubscription] =
        useState(null);

    const [subscriptionSchedules, setSubscriptionSchedules] =
        useState([]);

    const [loadingSubscription, setLoadingSubscription] =
        useState(false);

    /* Segundos que faltam para poder reenviar o SMS. Sem isso
       o reenvio em sequência cai no auth/too-many-requests do
       Firebase e o número fica bloqueado por horas. */
    const [resendIn, setResendIn] = useState(0);

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

    /*
      * Leva para a aba de reservas desta empresa. A URL manda
      * na aba, então dá para chegar lá de qualquer tela sem
      * precisar de callback vindo do centralUser.
      */
     const goToReservations = () => {

        navigate(
            `/central-user/${companyHandle}?tab=reservas`
        );

    };


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

                        /* O checkout e o resumo do pedido
                           leem product.images; repassamos as
                           URLs já resolvidas do Storage. */
                        product: {
                            ...product,
                            images
                        },

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

                        /* O checkout precisa do pagador pronto:
                           é com isso que ele emite o Pix sem
                           abrir formulário nenhum. */
                        payerEmail,

                        payerPhone,

                        notes:
                            notes.trim(),

                        /* O checkout precisa saber que é
                           assinatura: muda o endpoint, os
                           meios de pagamento e o aviso. */
                        subscriptionPlan:
                            monthlyPlan
                                ? {
                                    billingCycle:
                                        monthlyPlan.billingCycle,
                                    billingCycleDescription:
                                        monthlyPlan.billingCyclePeriodLabel ||
                                        monthlyPlan.billingCycleLabel,
                                    cancellationNoticeDays:
                                        monthlyPlan.cancellationNoticeDays,
                                    loyaltyMonths:
                                        monthlyPlan.loyaltyMonths
                                }
                                : null,

                        isGuest:
                            !isUserLoggedIn,

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

                /*
                 * Lê apenas os uids relacionados ao produto.
                 *
                 * Ler o nó "users" inteiro numa rota pública
                 * expõe nome e e-mail de toda a base.
                 */

                const enrichedUsers = await Promise.all(

                    product.relatedUsers.map(async (relUser) => {

                        const userSnap = await get(
                            ref(db, `users/${relUser.id}`)
                        );

                        const userInfo =
                            userSnap.exists()
                                ? userSnap.val()
                                : {};

                        return {
                            id: relUser.id,
                            role: relUser.role,
                            name: userInfo.name || "Sem nome"
                        };

                    })

                );

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

    const groupedByMonth = {};

    for (const day of availableTimes) {

        const [dd, mm, yyyy] = day.day.split("/");

        const dateObj = new Date(`${yyyy}-${mm}-${dd}T12:00:00`);

        const monthLabel = dateObj.toLocaleDateString("pt-BR", {
            month: "long",
            year: "numeric"
        });

        if (!groupedByMonth[monthLabel]) {
            groupedByMonth[monthLabel] = [];
        }

        groupedByMonth[monthLabel].push(day);

    }

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

    const [showImageFullscreen, setShowImageFullscreen] = useState(false);

    /* As imagens vêm do Storage
       (companys/{handle}/products/{id}/images); o que houver
       em product.images no RTDB é só fallback de cadastros
       antigos. */
    const images = useSingleProductImages(
        companyHandle,
        product
    );

    const toggleExpanded = () => {
        setExpanded(prev => !prev);
    };

    const openImageFullscreen = () => {
        if (!images.length) return;

        setShowImageFullscreen(true);
    };

    const closeImageFullscreen = () => {
        setShowImageFullscreen(false);
    };

    const showPreviousImage = () => {
        if (images.length <= 1) return;

        setSelectedImage((current) =>
            current === 0
                ? images.length - 1
                : current - 1
        );

        setImgLoaded(false);
    };

    const showNextImage = () => {
        if (images.length <= 1) return;

        setSelectedImage((current) =>
            current === images.length - 1
                ? 0
                : current + 1
        );

        setImgLoaded(false);
    };

    const shareProduct = async () => {
        try {

            const productUrl =
                `${window.location.origin}/central-user/${encodeURIComponent(
                    companyHandle
                )}?product=${encodeURIComponent(
                    product.id
                )}`;

            const shareData = {
                title: product.name,
                text: `Confira ${product.name} na ${companyName}.`,
                url: productUrl
            };

            /*
             * Compartilhamento nativo
             * principalmente no celular.
             */

            if (
                navigator.share &&
                typeof navigator.share === "function"
            ) {

                await navigator.share(shareData);

                return;
            }

            /*
             * Fallback para navegadores
             * que não possuem navigator.share.
             */

            if (
                navigator.clipboard &&
                typeof navigator.clipboard.writeText === "function"
            ) {

                await navigator.clipboard.writeText(
                    productUrl
                );

                openToast(
                    "success",
                    "Link copiado",
                    "O link deste produto foi copiado para a área de transferência."
                );

                return;
            }

            /*
             * Último fallback para navegadores
             * mais antigos.
             */

            const temporaryInput =
                document.createElement("input");

            temporaryInput.value = productUrl;

            temporaryInput.style.position = "fixed";
            temporaryInput.style.opacity = "0";
            temporaryInput.style.pointerEvents = "none";

            document.body.appendChild(
                temporaryInput
            );

            temporaryInput.select();
            temporaryInput.setSelectionRange(
                0,
                temporaryInput.value.length
            );

            document.execCommand("copy");

            document.body.removeChild(
                temporaryInput
            );

            openToast(
                "success",
                "Link copiado",
                "O link deste produto foi copiado para a área de transferência."
            );

        } catch (error) {

            /*
             * O usuário pode simplesmente ter
             * fechado o menu nativo de compartilhamento.
             */

            if (
                error?.name === "AbortError"
            ) {
                return;
            }

            console.error(
                "Erro ao compartilhar produto:",
                error
            );

            openToast(
                "error",
                "Não foi possível compartilhar",
                "Tente novamente."
            );
        }
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

    /*
     * Depende do ID, não do objeto.
     *
     * `product` é recriado a cada snapshot do Realtime (a
     * home remonta a lista inteira), então com [product] este
     * efeito rodava de novo a cada atualização da empresa:
     * `setImgLoaded(false)` escondia a imagem já carregada e
     * mostrava o skeleton por um quadro. Era uma das
     * piscadas ao abrir os detalhes do produto.
     */
    useEffect(() => {
        if (!product?.id) return undefined;
        setVisible(true);
        setImgLoaded(false);
        setSelectedImage(0);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = prev; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [product?.id]);

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

    useEffect(() => {

        if (!showImageFullscreen) {
            return;
        }

        const handleKeyDown = (event) => {

            if (event.key === "Escape") {
                closeImageFullscreen();
                return;
            }

            if (event.key === "ArrowLeft") {
                showPreviousImage();
                return;
            }

            if (event.key === "ArrowRight") {
                showNextImage();
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

    }, [showImageFullscreen, images.length]);


    /*
     * O travamento de scroll fica num efeito separado, com
     * dependência só em `showImageFullscreen`.
     *
     * Junto com o listener de teclado ele dependia também de
     * `images.length` — e como as imagens chegam do Storage
     * depois da montagem, o overflow do body era destravado e
     * travado de novo assim que elas resolviam. Um reflow do
     * documento inteiro no meio da animação de abertura.
     */
    useEffect(() => {

        if (!showImageFullscreen) {
            return undefined;
        }

        const previousOverflow =
            document.body.style.overflow;

        document.body.style.overflow = "hidden";

        return () => {

            document.body.style.overflow =
                previousOverflow;

        };

    }, [showImageFullscreen]);


    /*
     * Fechamento do modal.
     *
     * Antes era `AnimatePresence mode="wait"` com
     * `onExitComplete={() => onClose?.()}` — ou seja, quem
     * fechava de verdade era o fim da animação de saída. Se
     * ela não rodasse (aba em segundo plano, GPU ocupada,
     * movimento reduzido), `onClose` nunca era chamado e o
     * modal ficava aberto.
     *
     * Agora a saída é por tempo, então fecha sempre.
     */
    /*
     * QUEM É O CLIENTE
     * ----------------
     *
     * Isto era uma função chamada no clique do "Continuar",
     * lendo `auth.currentUser` na hora e só aceitando quem
     * tivesse e-mail. Dois furos, e os dois apareciam como o
     * mesmo sintoma — pedir SMS a quem já está logado:
     *
     *   1. no clique a sessão podia ainda estar sendo
     *      restaurada do disco, e `currentUser` vir null;
     *
     *   2. quem entrou pelo telefone não tem e-mail, então
     *      nunca contava como logado. Aí o fluxo pedia
     *      verificação de novo, e o `confirm()` logava a
     *      mesma conta sem e-mail — que continuava não
     *      contando como logada. Esse era o loop.
     *
     * Agora a identidade vem do próprio listener do Firebase,
     * `!!user` basta, e o e-mail é complementado pelo perfil
     * em users/{uid} quando a conta não tem um.
     */
    useEffect(() => {

        const auth = getAuth();

        const unsubscribe = onAuthStateChanged(
            auth,
            async (currentUser) => {

                setAuthReady(true);

                if (!currentUser) {

                    setIsUserLoggedIn(false);
                    setLoggedUserEmail("");
                    setLoggedUserId(null);

                    return;
                }

                setIsUserLoggedIn(true);
                setLoggedUserId(currentUser.uid);
                setLoggedUserEmail(currentUser.email || "");

                try {

                    const snapshot =
                        await get(
                            ref(
                                getDatabase(),
                                `users/${currentUser.uid}`
                            )
                        );

                    const profile =
                        snapshot.val() || {};

                    if (!currentUser.email && profile.email) {
                        setLoggedUserEmail(profile.email);
                    }

                    /* Só preenche o nome se o cliente ainda
                       não digitou nada, para não apagar o que
                       ele escreveu. */
                    setUserName(
                        previous =>
                            previous.trim()
                                ? previous
                                : (profile.name || currentUser.displayName || "")
                    );

                    if (currentUser.phoneNumber || profile.phone) {
                        setAuthPhone(
                            previous =>
                                previous.trim()
                                    ? previous
                                    : (currentUser.phoneNumber || profile.phone)
                        );
                    }

                } catch (error) {

                    console.warn(
                        "Não foi possível ler o perfil do usuário:",
                        error
                    );

                }

            }
        );

        return unsubscribe;

    }, []);


    /* O número em E.164, que é o formato que o Firebase
       aceita — ou null enquanto o que foi digitado não for
       um telefone brasileiro possível. */
    const phoneE164 =
        toE164BR(authPhone);

    const guestPhoneValid =
        isValidPhoneBR(authPhone);

    const guestPhoneDigits =
        phoneE164
            ? phoneE164.slice(3)
            : "";

    const guestEmailValid =
        /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(
            guestEmail.trim()
        );

    /*
     * Verificação por SMS só existe para visitante que vai
     * pagar adiantado. Conta logada nunca passa por aqui: o
     * `confirm()` do Firebase troca a sessão, e trocar a
     * sessão de quem já entrou seria derrubá-lo da conta.
     */
    const needsPhoneVerification =
        !isUserLoggedIn &&
        requiresPayment &&
        !monthlyPlan;


    /* O pagador do Mercado Pago. Conta logada usa o e-mail
       da conta; visitante usa o que digitou. */
    /*
     * Conta criada por telefone não tem e-mail, e o Mercado
     * Pago não emite Pix sem um pagador com e-mail. Nesse
     * caso o campo aparece mesmo para quem está logado — é a
     * única informação que ainda falta.
     */
    const payerEmail =
        (
            (isUserLoggedIn && loggedUserEmail)
                ? loggedUserEmail
                : guestEmail
        ).trim();

    const precisaPedirEmail =
        requiresPayment &&
        !(isUserLoggedIn && loggedUserEmail);

    const payerPhone =
        guestPhoneDigits;


    /*
     * Assinatura ativa e os atendimentos já marcados nela.
     *
     * Os agendamentos entram junto porque é com eles que se
     * conta quantas sessões sobraram no ciclo — o número não
     * fica guardado em lugar nenhum de propósito: contar na
     * hora não sai do lugar quando alguém desmarca.
     */
    useEffect(() => {

        let cancelado = false;

        const carregar = async () => {

            if (
                !monthlyPlan ||
                !loggedUserId ||
                !companyHandle ||
                !product?.id
            ) {
                setActiveSubscription(null);
                return;
            }

            setLoadingSubscription(true);

            try {

                const assinatura = await getUserSubscription(
                    companyHandle,
                    loggedUserId,
                    product.id
                );

                if (cancelado) return;

                setActiveSubscription(
                    isSubscriptionUsable(assinatura)
                        ? assinatura
                        : null
                );

                if (isSubscriptionUsable(assinatura)) {

                    const snapshot = await get(
                        ref(
                            getDatabase(),
                            `companys/${companyHandle}/schedules`
                        )
                    );

                    if (cancelado) return;

                    setSubscriptionSchedules(
                        Object.entries(snapshot.val() || {})
                            .map(([id, item]) => ({ id, ...item }))
                            .filter(
                                item =>
                                    item.subscriptionId === assinatura.id
                            )
                    );

                }

            } catch (error) {

                console.warn(
                    "Não foi possível ler a assinatura:",
                    error
                );

            } finally {

                if (!cancelado) setLoadingSubscription(false);

            }

        };

        carregar();

        return () => {
            cancelado = true;
        };

    }, [
        monthlyPlan,
        loggedUserId,
        companyHandle,
        product?.id
    ]);


    /* Resumo pronto para a tela. */
    const subscriptionSummary =
        activeSubscription
            ? getSubscriptionSummary(
                activeSubscription,
                subscriptionSchedules
            )
            : null;


    /*
     * Mensalidade exige conta — sempre, mesmo quando a
     * empresa não pede pagamento antecipado.
     *
     * Não é burocracia: é uma cobrança que se repete sozinha
     * todo mês. Quem assina precisa de um lugar para ver,
     * pausar e cancelar, e isso só existe atrelado a uma
     * conta. Um visitante identificado apenas pelo aparelho
     * perderia esse acesso ao trocar de celular — com a
     * cobrança seguindo normalmente.
     */
    const subscriptionNeedsLogin =
        Boolean(monthlyPlan) &&
        !isUserLoggedIn;


    /* Contagem do reenvio de SMS. */
    useEffect(() => {

        if (resendIn <= 0) {
            return undefined;
        }

        const timer = setTimeout(
            () => setResendIn(value => value - 1),
            1000
        );

        return () => clearTimeout(timer);

    }, [resendIn]);

    const {
        rendered: overlayRendered,
        leaving: overlayLeaving
    } = useExitTransition(visible, onClose, 220);

    if (!product) return null;

    /*
     * O reCAPTCHA precisa de um nó VIRGEM.
     *
     * O `clear()` desfaz o verificador do lado do Firebase,
     * mas o grecaptcha continua com o elemento marcado como
     * já usado. Tentar montar de novo no mesmo <div> levanta
     * "reCAPTCHA has already been rendered in this element",
     * e a partir daí o token que sai de lá é recusado como
     * inválido.
     *
     * Por isso cada tentativa ganha um filho novo, descartado
     * no fim. O container externo continua fixo só para dar
     * um lugar previsível na página.
     */
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

        /* Fora com o widget da tentativa anterior. */
        container.innerHTML = "";

        const host =
            document.createElement("div");

        host.id =
            `recaptcha-host-${Date.now()}`;

        container.appendChild(host);

        const verifier =
            new RecaptchaVerifier(
                auth,
                host,
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

    /*
     * O Firebase devolve um código por erro. Antes tudo virava
     * "tente novamente", e era isso que fazia a tela parecer
     * um loop: o cliente digitava o código errado, lia uma
     * frase genérica, pedia outro SMS e caía no mesmo lugar,
     * sem nunca saber o que estava acontecendo.
     */
    const describeAuthError = (error) => {

        switch (error?.code) {

            case "auth/invalid-verification-code":
                return "Código incorreto. Confira os 6 números do SMS.";

            case "auth/code-expired":
                return "Esse código expirou. Peça um novo SMS.";

            case "auth/invalid-phone-number":
                return "Número inválido. Use DDD + número, como (11) 90000-0000.";

            case "auth/missing-phone-number":
                return "Informe seu número de telefone.";

            case "auth/too-many-requests":
                return "Muitas tentativas nesse número. Espere alguns minutos antes de tentar de novo.";

            case "auth/quota-exceeded":
                return "O limite de SMS da empresa foi atingido hoje. Tente mais tarde.";

            case "auth/network-request-failed":
                return "Sem conexão. Verifique sua internet e tente de novo.";

            case "auth/captcha-check-failed":
                return "A verificação de segurança falhou. Recarregue a página e tente de novo.";

            /*
             * O reCAPTCHA foi resolvido, mas o Google recusou
             * o token.
             *
             * Não é o número nem o cliente. Medimos: o MESMO
             * código, no mesmo minuto, é aceito em
             * https://markfy-96942.firebaseapp.com e recusado
             * em http://localhost:3000. É ambiente, não
             * aplicação — em produção este caminho funciona.
             *
             * Em desenvolvimento, use os números de teste do
             * Firebase (Console → Authentication → Sign-in
             * method → Telefone), que pulam reCAPTCHA e SMS.
             */
            case "auth/invalid-app-credential":
            case "auth/internal-error-encountered":
                return "A verificação por SMS está indisponível neste ambiente. Entre com sua conta para concluir o pagamento.";

            case "auth/operation-not-allowed":
                return "A verificação por SMS não está habilitada. Entre com sua conta para concluir o pagamento.";

            default:
                return "Não foi possível concluir a verificação. Tente novamente.";

        }

    };


    const sendAuthCode = async () => {

        if (!phoneE164) {
            setAuthError(
                "Informe um telefone válido, com DDD. Exemplo: (11) 98941-4218."
            );
            return;
        }

        /*
         * `confirm()` do Firebase faz login de verdade. Se
         * alguém já está logado, isso trocaria a conta dele
         * por uma conta de telefone — então esse caminho nem
         * começa para quem tem sessão.
         */
        if (isUserLoggedIn) {
            setPhoneVerified(true);
            setAuthStep("authenticated");
            return;
        }

        setAuthLoading(true);
        setAuthError("");

        try {

            const auth = getAuth();

            /*
             * Normalizado em um lugar só.
             *
             * Antes era `authPhone.startsWith("+") ? authPhone
             * : "+55" + digitos`. Quem digitava o número já com
             * o 55 na frente via a máscara de 11 dígitos cortar
             * o fim, e o "+55" ser colado no que sobrou: o
             * Firebase recebia "+5555119894142", um número que
             * não existe.
             */
            const phoneNumber = phoneE164;

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
            setAuthCode("");
            setResendIn(60);

        } catch (error) {

            console.error(
                "Erro ao enviar SMS:",
                error
            );

            setAuthError(
                describeAuthError(error)
            );

            if (
                error?.code === "auth/invalid-app-credential" &&
                window.location.hostname === "localhost"
            ) {

                console.warn(
                    "[Markfy] O Firebase recusa o token do reCAPTCHA em " +
                    "http://localhost. Não é bug do app: o mesmo código " +
                    "funciona nos domínios autorizados em HTTPS. Para " +
                    "testar aqui, cadastre um número de teste em " +
                    "Firebase Console → Authentication → Sign-in method → " +
                    "Telefone → Números de teste."
                );

            }

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
                describeAuthError(error)
            );

            /* Código expirado não tem conserto: o cliente
               precisa de um SMS novo, então já devolvemos ele
               para a etapa do telefone em vez de deixá-lo
               tentando o mesmo código. */
            if (error?.code === "auth/code-expired") {

                setAuthConfirmation(null);
                setAuthStep("phone");
                setAuthCode("");

            }

        } finally {

            setAuthLoading(false);

        }
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

            /* Só grava se a pessoa escreveu: um campo vazio em
               todo agendamento é ruído no painel. */
            ...(notes.trim()
                ? { notes: notes.trim() }
                : {}
            ),

            /* Atendimento consumido pela mensalidade. É por
               este campo que o painel sabe que não há dinheiro
               novo entrando neste agendamento. */
            ...(activeSubscription
                ? { subscriptionId: activeSubscription.id }
                : {}
            ),

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
                clientId,

                /* Liga o agendamento à conta, quando existe
                   uma. O clientId sozinho identifica só o
                   aparelho: trocar de celular fazia o
                   histórico desaparecer. */
                ...(loggedUserId
                    ? { userId: loggedUserId }
                    : {}
                )
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

    if (!overlayRendered) {
        return null;
    }

    return createPortal(
        <div
            className={`product-details-overlay ${overlayLeaving
                ? "mkf-fade-leave"
                : "mkf-fade-enter"
                }`}
            onClick={() => setVisible(false)}
        >

            {/* =====================================================
                RECAPTCHA

                Fica aqui, e não dentro do modal de confirmação,
                porque o RecaptchaVerifier guarda o nó do DOM que
                recebeu na criação. Se esse nó sai da árvore — e
                o modal desmonta os filhos ao fechar, inclusive
                durante a animação de saída — o verificador passa
                a apontar para um elemento órfão e o envio do SMS
                falha com captcha-check-failed.

                Na raiz do produto ele sobrevive a todas as
                etapas do fluxo.
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

                    <CompanyInfoModal
                        isOpen={showCompanyInfo}
                        companyName={companyName}
                        companyHandle={companyHandle}
                        companyLogo={companyLogo}
                        onClose={() => setShowCompanyInfo(false)}
                    />

                    <Modal
                open={showWhatsappModal}
                onClose={() => setShowWhatsappModal(false)}
                overlayClassName="whatsapp-modal-overlay"
                className="whatsapp-modal"
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

                                </Modal>

                    {showImageFullscreen && images.length > 0 && (

                            <div
                                className="product-image-fullscreen mkf-fade-enter"
                                onClick={closeImageFullscreen}
                            >

                                {/* ==========================================
                HEADER
            ========================================== */}

                                <div
                                    className="product-image-fullscreen-header"
                                    onClick={(event) =>
                                        event.stopPropagation()
                                    }
                                >

                                    <div className="product-image-fullscreen-counter">
                                        {selectedImage + 1}
                                        <span>
                                            /
                                        </span>
                                        {images.length}
                                    </div>


                                    <button
                                        type="button"
                                        className="product-image-fullscreen-close"
                                        onClick={closeImageFullscreen}
                                        aria-label="Fechar tela cheia"
                                    >
                                        <Icon icon="mdi:close" />
                                    </button>

                                </div>


                                {/* ==========================================
                IMAGEM
            ========================================== */}

                                <div
                                    className="product-image-fullscreen-main"
                                    onClick={(event) =>
                                        event.stopPropagation()
                                    }
                                >

                                    {images.length > 1 && (

                                        <button
                                            type="button"
                                            className="product-image-fullscreen-nav previous"
                                            onClick={showPreviousImage}
                                            aria-label="Imagem anterior"
                                        >
                                            <Icon icon="humbleicons:arrow-left" />
                                        </button>

                                    )}


                                    <img
                                        key={images[selectedImage]}
                                        src={images[selectedImage]}
                                        alt={`${product.name} - imagem ${selectedImage + 1}`}
                                        className="product-image-fullscreen-image mkf-fade-enter"
                                    />


                                    {images.length > 1 && (

                                        <button
                                            type="button"
                                            className="product-image-fullscreen-nav next"
                                            onClick={showNextImage}
                                            aria-label="Próxima imagem"
                                        >
                                            <Icon icon="humbleicons:arrow-right" />
                                        </button>

                                    )}

                                </div>


                                {/* ==========================================
                MINIATURAS
            ========================================== */}

                                {images.length > 1 && (

                                    <div
                                        className="product-image-fullscreen-thumbnails"
                                        onClick={(event) =>
                                            event.stopPropagation()
                                        }
                                    >

                                        {images.map((image, index) => (

                                            <button
                                                type="button"
                                                key={`${image}-${index}`}
                                                className={`product-image-fullscreen-thumbnail ${selectedImage === index
                                                    ? "active"
                                                    : ""
                                                    }`}
                                                onClick={() => {
                                                    if (
                                                        index !== selectedImage
                                                    ) {
                                                        setImgLoaded(false);
                                                        setSelectedImage(index);
                                                    }
                                                }}
                                                aria-label={`Visualizar imagem ${index + 1}`}
                                                aria-pressed={
                                                    selectedImage === index
                                                }
                                            >

                                                <img
                                                    src={image}
                                                    alt=""
                                                />

                                            </button>

                                        ))}

                                    </div>

                                )}

                            </div>

                    )}

                    <div
                        key={product.id}
                        className="product-details-container mkf-product-enter"
                        onClick={(e) => e.stopPropagation()}
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

                                <button
                                    type="button"
                                    className="product-details-back"
                                    onClick={() => setVisible(false)}
                                    aria-label="Voltar"
                                >
                                    <Icon
                                        icon="humbleicons:arrow-left"
                                        className="icon"
                                    />
                                </button>


                                <div className="product-details-media-actions">

                                    {/* COMPARTILHAR */}

                                    <button
                                        type="button"
                                        className="product-details-media-action"
                                        onClick={shareProduct}
                                        aria-label="Compartilhar produto"
                                        title="Compartilhar"
                                    >
                                        <Icon icon="solar:share-linear" />
                                    </button>


                                    {/* TELA CHEIA */}

                                    <button
                                        type="button"
                                        className="product-details-media-action"
                                        onClick={openImageFullscreen}
                                        disabled={!images.length}
                                        aria-label="Ver imagem em tela cheia"
                                        title="Tela cheia"
                                    >
                                        <Icon icon="solar:maximize-linear" />
                                    </button>

                                </div>

                            </div>
                        </div>



                        <div className={`product-details-body ${showProfessionals ? "fullscreen" : ""}`}>
                            <div className="product-details-content-scroll">

                                <div className="product-details-info">
                                    {/* Troca de conteúdo por CSS: o `key` remonta
                                        e o fade de entrada reinicia. Sem saída,
                                        o bloco novo não espera o antigo sumir. */}
                                    {loadingProfessionals ? (
                                            <div
                                                key="loading"
                                                className="loading-container-product-details mkf-fade-enter"
                                            >
                                                <div className="spinner-product-details" />
                                                <p>Carregando ...</p>
                                            </div>
                                        ) : !showProfessionals ? (
                                            <div
                                                key="info"
                                                className="mkf-fade-enter"
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

                                                {/* ==========================================
                                                    ASSINATURA — PLANO DE MENSALIDADE
                                                ========================================== */}

                                                {/* =========================================
                                                    JÁ ASSINA

                                                    Abrir de novo o produto que a pessoa já
                                                    paga não pode parecer uma segunda compra.
                                                    Aqui ela vê o que tem direito, quando
                                                    cobra de novo, e marca o próximo
                                                    atendimento pelo mesmo seletor de sempre.
                                                ========================================= */}

                                                {activeSubscription && subscriptionSummary && (

                                                    <div className="product-details-subscription-active">

                                                        <div className="product-details-subscription-active-head">

                                                            <Icon icon="solar:verified-check-bold" />

                                                            <div>
                                                                <strong>
                                                                    Você já assina este plano
                                                                </strong>

                                                                <span>
                                                                    Escolha o dia e o horário do próximo
                                                                    atendimento — não há nada a pagar agora.
                                                                </span>
                                                            </div>

                                                        </div>

                                                        <div className="product-details-subscription-active-facts">

                                                            <div>
                                                                <span>Neste ciclo</span>
                                                                <strong>
                                                                    {subscriptionSummary.sessoesRestantes === null
                                                                        ? "Atendimentos ilimitados"
                                                                        : `${subscriptionSummary.sessoesRestantes} de ${activeSubscription.sessionsPerCycle} restantes`}
                                                                </strong>
                                                            </div>

                                                            <div>
                                                                <span>Próxima cobrança</span>
                                                                <strong>
                                                                    {subscriptionSummary.proximaCobranca
                                                                        .toLocaleDateString("pt-BR")}
                                                                </strong>
                                                            </div>

                                                        </div>

                                                        {subscriptionSummary.sessoesRestantes === 0 && (

                                                            <p className="product-details-subscription-active-warning">
                                                                <Icon icon="solar:danger-triangle-outline" />

                                                                <span>
                                                                    Você já usou todos os atendimentos deste
                                                                    ciclo. A partir de{" "}
                                                                    {subscriptionSummary.cycleEnd
                                                                        .toLocaleDateString("pt-BR")}{" "}
                                                                    eles voltam a ficar disponíveis.
                                                                </span>
                                                            </p>

                                                        )}

                                                    </div>

                                                )}


                                                {monthlyPlan && !activeSubscription && (

                                                    <div className="product-details-subscription">

                                                        {/* CABEÇALHO */}

                                                        <div className="product-details-subscription-header">

                                                            <div className="product-details-subscription-icon">
                                                                <Icon icon="solar:refresh-circle-linear" />
                                                            </div>

                                                            <div className="product-details-subscription-heading">

                                                                <span>
                                                                    Assinatura
                                                                    {" • "}
                                                                    {monthlyPlan.billingCycleLabel}
                                                                </span>

                                                                <h3>
                                                                    Este produto é uma mensalidade
                                                                </h3>

                                                                <p>
                                                                    O valor é cobrado de forma recorrente
                                                                    enquanto a assinatura estiver ativa,
                                                                    e não apenas uma vez.
                                                                </p>

                                                            </div>

                                                        </div>


                                                        {/* VALOR */}

                                                        <div className="product-details-subscription-price">

                                                            <div>

                                                                <span>
                                                                    Valor da mensalidade
                                                                </span>

                                                                <strong>
                                                                    {product.value}

                                                                    <em>
                                                                        {getPlanPriceSuffix(monthlyPlan)}
                                                                    </em>
                                                                </strong>

                                                            </div>

                                                            <span className="product-details-subscription-sessions">
                                                                {getPlanSessionsLabel(monthlyPlan)}
                                                            </span>

                                                        </div>


                                                        {/* DETALHES */}

                                                        <ul className="product-details-subscription-list">

                                                            {getPlanHighlights(monthlyPlan).map(
                                                                (highlight) => (

                                                                    <li key={highlight.id}>

                                                                        <Icon icon={highlight.icon} />

                                                                        <div>

                                                                            <span>
                                                                                {highlight.label}
                                                                            </span>

                                                                            <strong>
                                                                                {highlight.value}
                                                                            </strong>

                                                                        </div>

                                                                    </li>

                                                                )
                                                            )}

                                                        </ul>


                                                        {/* AVISOS */}

                                                        <p className="product-details-subscription-footnote">

                                                            <Icon icon="solar:info-circle-linear" />

                                                            {monthlyPlan.autoRenew
                                                                ? "A cobrança se repete automaticamente a cada ciclo até que você cancele."
                                                                : "A renovação não é automática: será preciso renovar manualmente a cada ciclo."}

                                                        </p>

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
                                            </div>
                                        ) : (

                                            <div
                                                key="profissionais"
                                                className="mkf-fade-enter"
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
                                                                                    {activeSubscription
                                                                                        ? "Sua mensalidade"
                                                                                        : monthlyPlan
                                                                                            ? "Primeiro atendimento"
                                                                                            : "Próxima etapa"}
                                                                                </span>

                                                                                <h2>
                                                                                    {activeSubscription
                                                                                        ? "Quando quer ser atendido?"
                                                                                        : monthlyPlan
                                                                                            ? "Quando começa?"
                                                                                            : "Escolha um dia"}
                                                                                </h2>
                                                                            </div>

                                                                        </div>

                                                                        {/* O dia escolhido aqui é o
                                                                            primeiro uso do plano, não
                                                                            a data da cobrança — e não
                                                                            prende a pessoa a ele. */}
                                                                        {monthlyPlan && !activeSubscription && (

                                                                            <p className="product-details-subscription-hint">
                                                                                <Icon icon="solar:info-circle-outline" />

                                                                                <span>
                                                                                    Este é o dia do seu
                                                                                    <strong> primeiro atendimento</strong>.
                                                                                    Os próximos você marca quando
                                                                                    quiser, na aba <strong>Reservas</strong>.
                                                                                </span>
                                                                            </p>

                                                                        )}

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
                                            </div>
                                        )}
                                </div>
                            </div>

                            {/* Footer fixo */}
                            <div className="product-details-footer">
                                <div className="product-details-footer-price">
                                    <p>
                                        {monthlyPlan
                                            ? "Mensalidade"
                                            : "Preço Total"}
                                    </p>
                                    <span>
                                        {product.value}

                                        {monthlyPlan && (
                                            <em className="product-details-footer-cycle">
                                                {getPlanPriceSuffix(monthlyPlan)}
                                            </em>
                                        )}
                                    </span>
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
                                    {showProfessionals
                                        ? "Prosseguir"
                                        : monthlyPlan
                                            ? "Assinar Agora"
                                            : "Agendar Agora"}
                                </button>
                            </div>
                        </div>

                    </div>
                    <Modal
                open={showConfirmationModal}
                onClose={() => {
                                    if (
                                        isConfirmed !== "loading" &&
                                        paymentStatus !== "loading"
                                    ) {
                                        setShowConfirmationModal(false);
                                    }
                                }}
                overlayClassName="confirmation-modal-overlay"
                className="confirmation-modal"
            >

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

                                            <div
                                                key="confirmation-step"
                                                className="confirmation-modal-step mkf-fade-enter"
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
                                                        disabled={!authReady}
                                                        onClick={() => {

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

                                            </div>
                                        )}

                                    {/* =====================================================
                    ETAPA 2 — NOME
                ===================================================== */}

                                    {/* =====================================================
    ETAPA 2 — IDENTIFICAÇÃO
===================================================== */}

                                    {/* =====================================================
                        MENSALIDADE — PRECISA DE CONTA

                        Antes do formulário de identificação, e
                        no lugar dele: assinar cria uma cobrança
                        que se repete sozinha, e isso precisa de
                        um lugar onde a pessoa possa ver, pausar
                        e cancelar depois.
                    ===================================================== */}

                                    {isAskingPhone &&
                                        subscriptionNeedsLogin &&
                                        isConfirmed === false && (

                                            <div
                                                key="subscription-login"
                                                className="confirmation-modal-step mkf-fade-enter"
                                            >

                                                <div className="confirmation-step-intro">

                                                    <div className="confirmation-step-icon">
                                                        <Icon icon="solar:shield-user-outline" />
                                                    </div>

                                                    <div>

                                                        <span className="confirmation-step-label">
                                                            Mensalidade
                                                        </span>

                                                        <h3>
                                                            Entre para assinar
                                                        </h3>

                                                        <p>
                                                            A mensalidade é cobrada de forma
                                                            automática a cada ciclo. Para você
                                                            poder acompanhar, pausar ou cancelar
                                                            quando quiser, ela fica ligada a uma
                                                            conta.
                                                        </p>

                                                    </div>

                                                </div>

                                                <div className="confirmation-subscription-points">

                                                    <div>
                                                        <Icon icon="solar:calendar-outline" />
                                                        <span>
                                                            Seus atendimentos ficam salvos e você
                                                            remarca pela aba Reservas.
                                                        </span>
                                                    </div>

                                                    <div>
                                                        <Icon icon="solar:card-outline" />
                                                        <span>
                                                            Você vê a próxima cobrança e cancela
                                                            sem precisar falar com ninguém.
                                                        </span>
                                                    </div>

                                                </div>

                                                <div className="confirmation-modal-actions">

                                                    <button
                                                        type="button"
                                                        className="confirmation-modal-button confirmation-modal-button--secondary"
                                                        onClick={() => setIsAskingPhone(false)}
                                                    >
                                                        <Icon icon="solar:arrow-left-outline" />
                                                        <span>Voltar</span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        className="confirmation-modal-button confirmation-modal-button--primary"
                                                        onClick={() => navigate("/login")}
                                                    >
                                                        <span>Entrar ou criar conta</span>
                                                        <Icon icon="solar:arrow-right-outline" />
                                                    </button>

                                                </div>

                                            </div>

                                        )}


                                    {isAskingPhone &&
                                        !subscriptionNeedsLogin &&
                                        !showPaymentAuth &&
                                        isConfirmed === false && (

                                            <div
                                                key="identification-step"
                                                className="confirmation-modal-step mkf-fade-enter"
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

                                                        {loggedUserEmail ? (

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

                                                        ) : precisaPedirEmail && (

                                                            <div
                                                                className="confirmation-form"
                                                                style={{ marginTop: "16px" }}
                                                            >

                                                                <label
                                                                    htmlFor="confirmation-logged-email"
                                                                    className="confirmation-form-label"
                                                                >
                                                                    E-mail
                                                                </label>

                                                                <div
                                                                    className={`confirmation-input-wrapper ${guestEmailValid
                                                                        ? "has-value"
                                                                        : ""
                                                                        }`}
                                                                >

                                                                    <Icon
                                                                        icon="solar:letter-outline"
                                                                        className="confirmation-input-icon"
                                                                    />

                                                                    <input
                                                                        id="confirmation-logged-email"
                                                                        type="email"
                                                                        autoComplete="email"
                                                                        inputMode="email"
                                                                        placeholder="voce@email.com"
                                                                        value={guestEmail}
                                                                        onChange={(e) =>
                                                                            setGuestEmail(
                                                                                e.target.value
                                                                            )
                                                                        }
                                                                    />

                                                                    {guestEmailValid && (

                                                                        <Icon
                                                                            icon="solar:check-circle-outline"
                                                                            className="confirmation-input-success"
                                                                        />

                                                                    )}

                                                                </div>

                                                                <span className="confirmation-form-hint">
                                                                    Sua conta é de telefone e ainda não tem
                                                                    e-mail. É para lá que vai o comprovante.
                                                                </span>

                                                            </div>

                                                        )}


                                                        {/* =================================================
                        OBSERVAÇÕES

                        Opcional de propósito. É o lugar de
                        "cabelo muito grosso", "vou chegar 10
                        minutos atrasado", "sou alérgico a X" —
                        coisas que hoje vão por WhatsApp e se
                        perdem antes de chegar em quem atende.
                    ================================================= */}

                                                        <div className="confirmation-form">

                                                            <label
                                                                htmlFor="confirmation-notes"
                                                                className="confirmation-form-label"
                                                            >
                                                                Observações
                                                                <span className="confirmation-form-optional">
                                                                    opcional
                                                                </span>
                                                            </label>

                                                            <textarea
                                                                id="confirmation-notes"
                                                                className="confirmation-textarea"
                                                                rows={3}
                                                                maxLength={NOTES_MAX_LENGTH}
                                                                placeholder="Algo que o profissional precise saber antes do atendimento?"
                                                                value={notes}
                                                                onChange={(e) =>
                                                                    setNotes(e.target.value)
                                                                }
                                                            />

                                                            <span className="confirmation-form-hint">
                                                                {notes.length}/{NOTES_MAX_LENGTH}
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
                                                                disabled={
                                                                    !userName.trim() ||
                                                                    (precisaPedirEmail && !guestEmailValid)
                                                                }
                                                                onClick={async () => {

                                                                    const agendamento =
                                                                        buildAgendamento();

                                                                    setEmailConfirmed(true);

                                                                    /*
                                                                     * Já assina: usa a mensalidade.
                                                                     */
                                                                    if (activeSubscription) {

                                                                        await finalizeAgendamento(
                                                                            agendamento
                                                                        );

                                                                        return;

                                                                    }

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

                                                                        if (e.key === "Enter") {
                                                                            e.preventDefault();
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
                        TELEFONE
                    ================================================= */}

                                                        <div className="confirmation-form">

                                                            <label
                                                                htmlFor="confirmation-guest-phone"
                                                                className="confirmation-form-label"
                                                            >
                                                                Telefone
                                                            </label>

                                                            <div
                                                                className={`confirmation-input-wrapper ${guestPhoneDigits.length >= 10
                                                                    ? "has-value"
                                                                    : ""
                                                                    }`}
                                                            >

                                                                <Icon
                                                                    icon="solar:phone-outline"
                                                                    className="confirmation-input-icon"
                                                                />

                                                                {/*
                                                                    Campo livre, sem máscara.

                                                                    A máscara de 11 dígitos era o que
                                                                    estragava o número de quem digita
                                                                    ou cola com o 55 na frente: ela
                                                                    cortava o fim e o código ainda
                                                                    colava "+55" no que sobrou. Agora
                                                                    o texto é livre e a normalização
                                                                    acontece em toE164BR, que entende
                                                                    +55, 55, 0 na frente ou só o DDD.
                                                                */}
                                                                <input
                                                                    id="confirmation-guest-phone"
                                                                    type="tel"
                                                                    autoComplete="tel"
                                                                    inputMode="tel"
                                                                    maxLength={20}
                                                                    placeholder="(11) 98941-4218"
                                                                    value={authPhone}
                                                                    onChange={(e) =>
                                                                        setAuthPhone(
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                />

                                                                {guestPhoneValid && (

                                                                    <Icon
                                                                        icon="solar:check-circle-outline"
                                                                        className="confirmation-input-success"
                                                                    />

                                                                )}

                                                            </div>

                                                            <span className="confirmation-form-hint">
                                                                {guestPhoneValid
                                                                    ? (
                                                                        needsPhoneVerification
                                                                            ? `Enviaremos o código para ${formatPhoneBR(authPhone)}.`
                                                                            : `A empresa vai falar com você em ${formatPhoneBR(authPhone)}.`
                                                                    )
                                                                    : (
                                                                        authPhone.trim()
                                                                            ? "Número incompleto. Use DDD + número, como (11) 98941-4218."
                                                                            : "Com DDD, como (11) 98941-4218."
                                                                    )}
                                                            </span>

                                                        </div>


                                                        {/* =================================================
                        E-MAIL

                        Obrigatório só quando há pagamento: o
                        Mercado Pago exige um pagador com
                        e-mail para emitir o Pix, e é por ele
                        que o comprovante chega.
                    ================================================= */}

                                                        {requiresPayment && (

                                                            <div className="confirmation-form">

                                                                <label
                                                                    htmlFor="confirmation-guest-email"
                                                                    className="confirmation-form-label"
                                                                >
                                                                    E-mail
                                                                </label>

                                                                <div
                                                                    className={`confirmation-input-wrapper ${guestEmailValid
                                                                        ? "has-value"
                                                                        : ""
                                                                        }`}
                                                                >

                                                                    <Icon
                                                                        icon="solar:letter-outline"
                                                                        className="confirmation-input-icon"
                                                                    />

                                                                    <input
                                                                        id="confirmation-guest-email"
                                                                        type="email"
                                                                        autoComplete="email"
                                                                        inputMode="email"
                                                                        placeholder="voce@email.com"
                                                                        value={guestEmail}
                                                                        onChange={(e) =>
                                                                            setGuestEmail(
                                                                                e.target.value
                                                                            )
                                                                        }
                                                                    />

                                                                    {guestEmailValid && (

                                                                        <Icon
                                                                            icon="solar:check-circle-outline"
                                                                            className="confirmation-input-success"
                                                                        />

                                                                    )}

                                                                </div>

                                                                <span className="confirmation-form-hint">
                                                                    O comprovante do pagamento vai para
                                                                    esse endereço.
                                                                </span>

                                                            </div>

                                                        )}


                                                        {/* =================================================
                        OBSERVAÇÕES

                        Opcional de propósito. É o lugar de
                        "cabelo muito grosso", "vou chegar 10
                        minutos atrasado", "sou alérgico a X" —
                        coisas que hoje vão por WhatsApp e se
                        perdem antes de chegar em quem atende.
                    ================================================= */}

                                                        <div className="confirmation-form">

                                                            <label
                                                                htmlFor="confirmation-notes"
                                                                className="confirmation-form-label"
                                                            >
                                                                Observações
                                                                <span className="confirmation-form-optional">
                                                                    opcional
                                                                </span>
                                                            </label>

                                                            <textarea
                                                                id="confirmation-notes"
                                                                className="confirmation-textarea"
                                                                rows={3}
                                                                maxLength={NOTES_MAX_LENGTH}
                                                                placeholder="Algo que o profissional precise saber antes do atendimento?"
                                                                value={notes}
                                                                onChange={(e) =>
                                                                    setNotes(e.target.value)
                                                                }
                                                            />

                                                            <span className="confirmation-form-hint">
                                                                {notes.length}/{NOTES_MAX_LENGTH}
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
                                                                disabled={
                                                                    !userName.trim() ||
                                                                    !guestPhoneValid ||
                                                                    (requiresPayment && !guestEmailValid)
                                                                }
                                                                onClick={async () => {

                                                                    const agendamento =
                                                                        buildAgendamento();

                                                                    /*
                                                                     * Já assina: o atendimento sai da
                                                                     * mensalidade que ele paga, então
                                                                     * não há o que cobrar aqui.
                                                                     */
                                                                    if (activeSubscription) {

                                                                        await finalizeAgendamento(
                                                                            agendamento
                                                                        );

                                                                        return;

                                                                    }

                                                                    /*
                                                                     * Agendamento gratuito não passa
                                                                     * por SMS: sem dinheiro em jogo,
                                                                     * o código só atrapalharia.
                                                                     */
                                                                    if (needsPhoneVerification) {

                                                                        setPhoneVerified(false);

                                                                        setShowPaymentAuth(true);

                                                                        setAuthStep("phone");

                                                                        setAuthCode("");

                                                                        setAuthError("");

                                                                        return;

                                                                    }

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
                                                                    Confirmar agendamento
                                                                </span>

                                                                <Icon icon="solar:check-outline" />

                                                            </button>

                                                        </div>

                                                    </>

                                                )}

                                            </div>
                                        )}
                                    {/* =====================================================
                    PAGAMENTO — AUTENTICAÇÃO
                ===================================================== */}

                                    {showPaymentAuth &&
                                        isConfirmed === false && (

                                            <div
                                                key="payment-auth"
                                                className="confirmation-modal-step confirmation-payment-auth mkf-fade-enter"
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
                                                    <div
                                                        key="phone"
                                                        className="confirmation-auth-content mkf-fade-enter"
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

                                                                <input
                                                                    id="confirmation-auth-phone"
                                                                    type="tel"
                                                                    autoComplete="tel"
                                                                    inputMode="tel"
                                                                    maxLength={20}
                                                                    autoFocus
                                                                    placeholder="(11) 98941-4218"
                                                                    value={authPhone}
                                                                    onChange={(e) =>
                                                                        setAuthPhone(
                                                                            e.target.value
                                                                        )
                                                                    }
                                                                    onKeyDown={(e) => {

                                                                        if (
                                                                            e.key === "Enter" &&
                                                                            guestPhoneValid &&
                                                                            !authLoading
                                                                        ) {
                                                                            sendAuthCode();
                                                                        }

                                                                    }}
                                                                />

                                                                {guestPhoneValid && (

                                                                    <Icon
                                                                        icon="solar:check-circle-outline"
                                                                        className="confirmation-input-success"
                                                                    />

                                                                )}

                                                            </div>

                                                            {/* Mostra o número exato antes de gastar
                                                                um envio: é mais barato ler do que
                                                                esperar um SMS que nunca chega. */}
                                                            <span className="confirmation-form-hint">
                                                                {guestPhoneValid
                                                                    ? `Enviaremos um código para ${formatPhoneBR(authPhone)}.`
                                                                    : "Digite com DDD. Exemplo: (11) 98941-4218."}
                                                            </span>

                                                        </div>

                                                        {authError && (
                                                            <div
                                                                className="confirmation-auth-error mkf-fade-enter"
                                                            >
                                                                <Icon icon="solar:danger-triangle-outline" />

                                                                <span>
                                                                    {authError}
                                                                </span>
                                                            </div>
                                                        )}

                                                        <button
                                                            type="button"
                                                            className="confirmation-modal-button confirmation-modal-button--primary confirmation-auth-button"
                                                            disabled={
                                                                authLoading ||
                                                                !guestPhoneValid
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

                                                    </div>
                                                )}

                                                {/* Código */}

                                                {authStep === "code" && !phoneVerified && (
                                                    <div
                                                        key="code"
                                                        className="confirmation-auth-content mkf-fade-enter"
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
                                                            <div
                                                                className="confirmation-auth-error mkf-fade-enter"
                                                            >
                                                                <Icon icon="solar:danger-triangle-outline" />

                                                                <span>
                                                                    {authError}
                                                                </span>
                                                            </div>
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

                                                        {/* Reenviar, com espera.

                                                            Sem a espera o cliente que não recebe o
                                                            SMS fica martelando o botão, o Firebase
                                                            responde too-many-requests e aí o número
                                                            dele fica bloqueado por horas — o que
                                                            parece, de fora, o app travado pedindo
                                                            código para sempre. */}

                                                        <button
                                                            type="button"
                                                            className="confirmation-change-phone"
                                                            disabled={resendIn > 0 || authLoading}
                                                            onClick={sendAuthCode}
                                                        >
                                                            <Icon icon="solar:refresh-outline" />

                                                            {resendIn > 0
                                                                ? `Reenviar SMS em ${resendIn}s`
                                                                : "Reenviar SMS"}
                                                        </button>

                                                        <button
                                                            type="button"
                                                            className="confirmation-change-phone"
                                                            onClick={() => {

                                                                setAuthStep("phone");
                                                                setAuthCode("");
                                                                setAuthError("");
                                                                setAuthConfirmation(null);

                                                            }}
                                                        >
                                                            <Icon icon="solar:pen-outline" />

                                                            Alterar número
                                                        </button>

                                                    </div>
                                                )}

                                                {/* =====================================================
    TELEFONE VERIFICADO
===================================================== */}

                                                {phoneVerified && (
                                                    <div
                                                        key="phone-verified"
                                                        className="confirmation-auth-verified mkf-fade-enter"
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
                                                            onClick={() => {
                                                                openCheckout();
                                                            }}
                                                        >
                                                            <span>
                                                                Continuar para pagamento
                                                            </span>

                                                            <Icon icon="solar:arrow-right-outline" />
                                                        </button>

                                                    </div>
                                                )}

                                            </div>
                                        )}

                                    {/* =====================================================
                    LOADING
                ===================================================== */}

                                    {isConfirmed === "loading" && (

                                        <div
                                            key="loading"
                                            className="confirmation-modal-state confirmation-modal-state--loading mkf-fade-enter"
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

                                        </div>

                                    )}

                                    {/* =====================================================
                    SUCESSO
                ===================================================== */}

                                    {isConfirmed === "success" && (

                                        <div
                                            key="success"
                                            className="confirmation-modal-state confirmation-modal-state--success mkf-fade-enter"
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

                                            {/* O resumo acima é só deste
                                                agendamento; daqui a pessoa
                                                chega à lista completa. */}
                                            <button
                                                type="button"
                                                className="confirmation-modal-link"
                                                onClick={goToReservations}
                                            >
                                                <Icon icon="solar:calendar-mark-outline" />

                                                <span>
                                                    Verificar meus agendamentos
                                                </span>
                                            </button>

                                        </div>

                                    )}

                                </Modal>

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
                    <Toast
                        show={showToast}
                        type={toastType}
                        title={toastTitle}
                        message={toastMessage}
                        onClose={() => setShowToast(false)}
                    />
        </div>,
        document.body
    );
};

export default ProductDetails;
