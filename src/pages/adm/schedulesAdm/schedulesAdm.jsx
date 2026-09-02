import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { getDatabase, ref, get, set, update, onValue } from "firebase/database";
import {
    getStorage,
    ref as storageRef,
    getDownloadURL,
    listAll
} from "firebase/storage";

import "./schedulesAdm.css";

import { useUserCompany } from "../../../../src/contexts/companyContext/UserCompanyContext";

const weekDays = [
    "Dom",
    "Seg",
    "Ter",
    "Qua",
    "Qui",
    "Sex",
    "Sáb"
];

const months = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro"
];

const hourToMinutes = (hour) => {

    const [h, m] = hour.split(":").map(Number);

    return h * 60 + m;

};

const minutesToHour = (minutes) => {

    const h = Math.floor(minutes / 60);
    const m = minutes % 60;

    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

};

const SchedulesAdm = () => {
    const { company } = useUserCompany();
    const [showMonths, setShowMonths] = useState(false);
    const currentDate = new Date();

    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const [expandedYear, setExpandedYear] = useState(currentYear);

    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [selectedYear, setSelectedYear] = useState(currentYear);
    const availableYears = [
        currentYear - 1,
        currentYear,
        currentYear + 1
    ];

    const [selectedSchedule, setSelectedSchedule] = useState(null);
    const modalContentRef = useRef(null);

    const backdropRef = useRef(null);

    const [isModalOpen, setIsModalOpen] = useState(false);

    const [isClosingModal, setIsClosingModal] = useState(false);

    const [schedules, setSchedules] = useState([]);
    const [loadingSchedules, setLoadingSchedules] = useState(true);

    const [userProfileImages, setUserProfileImages] = useState({});

    const [productImages, setProductImages] = useState({});

    const [selectedDay, setSelectedDay] = useState(currentDate.getDate());

    const selectedDate = useMemo(() => {

        return `${String(selectedDay).padStart(2, "0")}/${String(selectedMonth + 1).padStart(2, "0")}/${selectedYear}`;

    }, [
        selectedDay,
        selectedMonth,
        selectedYear
    ]);

    const monthDays = useMemo(() => {

        const totalDays = new Date(
            selectedYear,
            selectedMonth + 1,
            0
        ).getDate();

        return Array.from({ length: totalDays }, (_, index) => {

            const date = new Date(
                selectedYear,
                selectedMonth,
                index + 1
            );

            return {
                day: index + 1,
                weekDay: weekDays[date.getDay()]
            };

        });

    }, [selectedMonth]);

    useEffect(() => {

        if (!company?.handle) return;

        const db = getDatabase();

        const schedulesRef = ref(
            db,
            `companys/${company.handle}/schedules`
        );

        const unsubscribe = onValue(
            schedulesRef,
            async (snapshot) => {

                setLoadingSchedules(true);

                if (!snapshot.exists()) {

                    setSchedules([]);
                    setLoadingSchedules(false);

                    return;
                }

                // Busca todos os produtos da empresa
                const productsSnapshot = await get(
                    ref(db, `companys/${company.handle}/products`)
                );

                const products = productsSnapshot.val() || {};

                const productsMap = {};

                Object.entries(products).forEach(([id, product]) => {

                    productsMap[id] = product;

                });

                const schedulesData = snapshot.val();

                const list = Object.entries(schedulesData)
                    .map(([id, schedule]) => {

                        const product = productsMap[schedule.productId];

                        const duration = Number(product?.duration || 0);

                        const startMinutes = hourToMinutes(schedule.hour);

                        const endMinutes = startMinutes + duration;

                        return {

                            id,

                            ...schedule,

                            productName:
                                product?.name || schedule.productName,

                            duration,

                            startMinutes,

                            endMinutes,

                            startHourText: schedule.hour,

                            endHourText: minutesToHour(endMinutes)

                        };

                    })
                    .filter(schedule => schedule.day === selectedDate);

                // ==========================================
                // BUSCAR FOTOS DOS PROFISSIONAIS
                // ==========================================

                // ==========================================
                // BUSCAR FOTOS DOS PROFISSIONAIS NO STORAGE
                // ==========================================

                const productIds = [
                    ...new Set(
                        list
                            .map(schedule => schedule.productId)
                            .filter(Boolean)
                    )
                ];

                const productImagesMap = {};
                const storage = getStorage();

                await Promise.all(
                    productIds.map(async (productId) => {

                        try {

                            const imagesFolderRef = storageRef(
                                storage,
                                `companys/${company.handle}/products/${productId}/images`
                            );

                            // Lista tudo que existe dentro de /images
                            const imagesResult = await listAll(
                                imagesFolderRef
                            );

                            // Nenhuma imagem
                            if (!imagesResult.items.length) {
                                return;
                            }

                            // Pega a primeira imagem encontrada,
                            // independente do nome do arquivo
                            const firstImageRef =
                                imagesResult.items[0];

                            const imageUrl =
                                await getDownloadURL(firstImageRef);

                            productImagesMap[productId] =
                                imageUrl;

                        } catch (error) {

                            console.log(
                                `Não foi possível encontrar imagem do produto ${productId}:`,
                                error
                            );

                        }

                    })
                );

                setProductImages(productImagesMap);

                const professionalIds = [
                    ...new Set(
                        list
                            .map(schedule => schedule.professionalId)
                            .filter(Boolean)
                    )
                ];

                const profileImages = {};


                await Promise.all(
                    professionalIds.map(async (userId) => {

                        try {

                            const imageRef = storageRef(
                                storage,
                                `users/${userId}/profileImg`
                            );

                            const imageUrl = await getDownloadURL(imageRef);

                            profileImages[userId] = imageUrl;

                        } catch (error) {

                            // Usuário sem foto = usa a inicial
                            console.log(
                                `Usuário ${userId} não possui foto de perfil.`
                            );

                        }

                    })
                );

                setUserProfileImages(profileImages);

                setSchedules(list);

                setLoadingSchedules(false);

            }
        );

        return () => unsubscribe();

    }, [
        company,
        selectedDate
    ]);

    useEffect(() => {

        const totalDays = new Date(
            selectedYear,
            selectedMonth + 1,
            0
        ).getDate();

        if (selectedDay > totalDays) {
            setSelectedDay(totalDays);
        }

    }, [selectedMonth, selectedYear]);

    const selectedIsToday =
        selectedYear === currentYear &&
        selectedMonth === currentMonth;

    const currentHour = currentDate.getHours();

    const hours = useMemo(() => {

        return Array.from({ length: 24 }, (_, index) => {

            return `${index.toString().padStart(2, "0")}:00`;

        });

    }, []);

    const timelineRef = useRef(null);

    const dropdownRef = useRef(null);
    const daysRef = useRef(null);
    useEffect(() => {

        if (!timelineRef.current) return;

        const hourHeight = 96;

        if (
            selectedYear === currentYear &&
            selectedMonth === currentMonth &&
            selectedDay === currentDate.getDate()
        ) {

            timelineRef.current.scrollTop =
                currentDate.getHours() * hourHeight;

        } else {

            timelineRef.current.scrollTop = 0;

        }

    }, [
        selectedDay,
        selectedMonth,
        selectedYear
    ]);
    useEffect(() => {

        const handleClickOutside = (event) => {

            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setShowMonths(false);
            }

        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };

    }, []);

    useEffect(() => {

        if (!daysRef.current) return;

        const selectedElement =
            daysRef.current.querySelector(".schedule-day.selected");

        if (!selectedElement) return;

        selectedElement.scrollIntoView({
            behavior: "smooth",
            inline: "center",
            block: "nearest"
        });

    }, [
        selectedDay,
        selectedMonth,
        selectedYear
    ]);
    const scrollDays = (direction) => {

        if (!daysRef.current) return;

        daysRef.current.scrollBy({
            left: direction * 260,
            behavior: "smooth"
        });

    };

    const isToday = (day) => (
        selectedYear === currentYear &&
        selectedMonth === currentMonth &&
        day === currentDate.getDate()
    );

    const isSelectedDay = (day) => (
        selectedDay === day
    );

    const schedulesByHour = useMemo(() => {

        return schedules.reduce((acc, schedule) => {

            const hour = schedule.hour.slice(0, 2);

            if (!acc[hour]) {
                acc[hour] = [];
            }

            acc[hour].push(schedule);

            return acc;

        }, {});

    }, [schedules]);

    const openSchedule = (schedule) => {

        setSelectedSchedule(schedule);

        setIsClosingModal(false);

        setIsModalOpen(true);

    };

    const closeSchedule = () => {

        setIsClosingModal(true);

        setTimeout(() => {

            setIsModalOpen(false);

            setSelectedSchedule(null);

            setIsClosingModal(false);

        }, 250);

    };

    const statusMap = {
        completed: {
            label: "Concluído",
            className: "completed"
        },
        pending: {
            label: "Em andamento",
            className: "pending"
        },
        cancelled: {
            label: "Cancelado",
            className: "cancelled"
        },
        canceled: {
            label: "Cancelado",
            className: "cancelled"
        }
    };

    const scheduleStatus =
        statusMap[selectedSchedule?.status] || {
            label: selectedSchedule?.status,
            className: "default"
        };

    const [remainingTime, setRemainingTime] = useState("");
    const [scheduleFinished, setScheduleFinished] = useState(false);

    useEffect(() => {

        if (!selectedSchedule || !isModalOpen) return;

        const updateRemainingTime = () => {

            const [day, month, year] =
                selectedSchedule.day.split("/").map(Number);

            const [endHour, endMinute] =
                selectedSchedule.endHourText.split(":").map(Number);

            const endDate = new Date(
                year,
                month - 1,
                day,
                endHour,
                endMinute,
                0
            );

            const now = new Date();

            const diff = endDate.getTime() - now.getTime();

            if (diff <= 0) {

                setScheduleFinished(true);

                setRemainingTime("Este atendimento já foi finalizado.");

                return;

            }

            setScheduleFinished(false);

            const totalSeconds = Math.floor(diff / 1000);

            const days = Math.floor(totalSeconds / 86400);

            const hours = Math.floor((totalSeconds % 86400) / 3600);

            const minutes = Math.floor((totalSeconds % 3600) / 60);

            const seconds = totalSeconds % 60;

            let text = "";

            if (days > 0)
                text += `${days}d `;

            if (hours > 0 || days > 0)
                text += `${hours}h `;

            text += `${minutes}min ${seconds}s`;

            setRemainingTime(text);

        };

        updateRemainingTime();

        const interval = setInterval(
            updateRemainingTime,
            1000
        );

        return () => clearInterval(interval);

    }, [
        selectedSchedule,
        isModalOpen
    ]);
    return (
        <div className="schedules-container schedules-desktop">

            {/* =========================================================
            HEADER — DESKTOP
        ========================================================= */}

            <header className="schedules-header">

                <div className="schedules-header-main">

                    <div className="schedules-header-title">

                        <span className="schedules-eyebrow">
                            Gestão
                        </span>

                        <h1>
                            Agenda
                        </h1>

                        <p>
                            Visualize, acompanhe e gerencie os
                            agendamentos da sua empresa.
                        </p>

                    </div>

                </div>

            </header>


            {/* =========================================================
            MAIN
        ========================================================= */}

            <main className="schedules-content">

                {/* =====================================================
                TOP CONTROL BAR
            ===================================================== */}

                <section className="schedules-topbar">

                    <div className="schedules-topbar-left">

                        {/* =================================================
                        MÊS / ANO
                    ================================================= */}

                        <div
                            className="schedule-month-selector"
                            ref={dropdownRef}
                        >

                            <button
                                type="button"
                                className="schedule-month-selector-trigger"
                                onClick={() =>
                                    setShowMonths(
                                        prev => !prev
                                    )
                                }
                            >

                                <div className="schedule-month-selector-icon">

                                    <Icon
                                        icon="akar-icons:calendar"
                                        className="icon"
                                    />

                                </div>

                                <div className="schedule-month-selector-text">

                                    <span>
                                        Período
                                    </span>

                                    <strong>
                                        {months[selectedMonth]} {selectedYear}
                                    </strong>

                                </div>

                                <Icon
                                    icon="iconamoon:arrow-down-2-duotone"
                                    className={`icon ${showMonths ? "open" : ""
                                        }`}
                                />

                            </button>


                            {showMonths && (

                                <div className="schedule-month-dropdown">

                                    {availableYears.map(
                                        year => {

                                            const isOpen =
                                                expandedYear === year;

                                            return (

                                                <div
                                                    key={year}
                                                    className="schedule-month-group"
                                                >

                                                    <button
                                                        type="button"
                                                        className={`schedule-month-group-header ${selectedYear === year
                                                            ? "active"
                                                            : ""
                                                            }`}
                                                        onClick={() =>
                                                            setExpandedYear(
                                                                isOpen
                                                                    ? null
                                                                    : year
                                                            )
                                                        }
                                                    >

                                                        <span>
                                                            {year}
                                                        </span>

                                                        <Icon
                                                            icon="iconamoon:arrow-down-2-duotone"
                                                            className={`icon ${isOpen
                                                                ? "open"
                                                                : ""
                                                                }`}
                                                        />

                                                    </button>


                                                    {isOpen && (

                                                        <div className="schedule-month-list">

                                                            {months.map(
                                                                (
                                                                    month,
                                                                    index
                                                                ) => (

                                                                    <button
                                                                        type="button"
                                                                        key={`${month}-${year}`}
                                                                        className={`schedule-month-option ${selectedMonth === index &&
                                                                            selectedYear === year
                                                                            ? "active"
                                                                            : ""
                                                                            }`}
                                                                        onClick={() => {

                                                                            setSelectedMonth(
                                                                                index
                                                                            );

                                                                            setSelectedYear(
                                                                                year
                                                                            );

                                                                            setShowMonths(
                                                                                false
                                                                            );

                                                                        }}
                                                                    >
                                                                        {month}
                                                                    </button>

                                                                )
                                                            )}

                                                        </div>

                                                    )}

                                                </div>

                                            );

                                        }
                                    )}

                                </div>

                            )}

                        </div>


                        {/* =================================================
                        NAVEGAÇÃO DE SEMANA
                    ================================================= */}



                    </div>


                    {/* =================================================
                    RESUMO
                ================================================= */}

                    <div className="schedules-topbar-summary">

                        <div className="schedules-topbar-summary-item">

                            <span>
                                Agendamentos
                            </span>

                            <strong>
                                {schedules.length}
                            </strong>

                        </div>


                        <div className="schedules-topbar-summary-divider" />


                        <div className="schedules-topbar-summary-item">

                            <span>
                                Em andamento
                            </span>

                            <strong>
                                {
                                    schedules.filter(
                                        schedule =>
                                            schedule.status === "pending"
                                    ).length
                                }
                            </strong>

                        </div>


                        <div className="schedules-topbar-summary-divider" />


                        <div className="schedules-topbar-summary-item">

                            <span>
                                Concluídos
                            </span>

                            <strong>
                                {
                                    schedules.filter(
                                        schedule =>
                                            schedule.status === "completed"
                                    ).length
                                }
                            </strong>

                        </div>

                    </div>

                </section>


                {/* =====================================================
                DAY STRIP
            ===================================================== */}

                <section className="schedules-days-section">

                    <div className="schedules-days-header">

                        <div>

                            <span className="schedules-section-eyebrow">
                                Calendário
                            </span>

                            <h2>
                                Dias do mês
                            </h2>

                        </div>


                        <div className="schedules-selected-day-label">

                            <span>
                                Visualizando
                            </span>

                            <strong>
                                {weekDays[
                                    new Date(
                                        selectedYear,
                                        selectedMonth,
                                        selectedDay
                                    ).getDay()
                                ]}{" "}
                                {selectedDay} de{" "}
                                {months[selectedMonth]}
                            </strong>

                        </div>

                    </div>


                    <div className="schedule-days-wrapper">

                        <button
                            type="button"
                            className="schedule-days-arrow"
                            onClick={() =>
                                scrollDays(-1)
                            }
                            aria-label="Dias anteriores"
                        >

                            <Icon
                                icon="solar:alt-arrow-left-linear"
                            />

                        </button>


                        <div
                            className="schedule-days-scroll"
                            ref={daysRef}
                        >

                            {monthDays.map(
                                ({
                                    day,
                                    weekDay
                                }) => {

                                    const selected =
                                        isSelectedDay(day);

                                    const today =
                                        isToday(day);

                                    const hasEvents =
                                        day === selectedDay &&
                                        schedules.length > 0;

                                    return (

                                        <button
                                            type="button"
                                            key={day}
                                            className={`
                                            schedule-day
                                            ${today ? "today" : ""}
                                            ${selected ? "selected" : ""}
                                            ${hasEvents ? "has-events" : ""}
                                        `}
                                            onClick={() =>
                                                setSelectedDay(day)
                                            }
                                        >

                                            <span className="schedule-day-week">
                                                {weekDay}
                                            </span>

                                            <span className="schedule-day-number">
                                                {day}
                                            </span>

                                            {hasEvents && (

                                                <span className="schedule-day-count">
                                                    {schedules.length}
                                                </span>

                                            )}

                                        </button>

                                    );

                                }
                            )}

                        </div>


                        <button
                            type="button"
                            className="schedule-days-arrow"
                            onClick={() =>
                                scrollDays(1)
                            }
                            aria-label="Próximos dias"
                        >

                            <Icon
                                icon="solar:alt-arrow-right-linear"
                            />

                        </button>

                    </div>

                </section>


                {/* =====================================================
                DAY OVERVIEW
            ===================================================== */}

                <section className="schedules-day-overview">

                    <div className="schedules-day-overview-main">

                        <div className="schedules-day-overview-icon">

                            <Icon
                                icon="solar:calendar-mark-linear"
                            />

                        </div>

                        <div>

                            <span>
                                Agenda do dia
                            </span>

                            <strong>
                                {weekDays[
                                    new Date(
                                        selectedYear,
                                        selectedMonth,
                                        selectedDay
                                    ).getDay()
                                ]},{" "}
                                {selectedDay} de{" "}
                                {months[selectedMonth]}
                            </strong>

                        </div>

                    </div>


                    <div className="schedules-day-overview-stats">

                        <div className="schedules-day-overview-stat">

                            <span>
                                Total
                            </span>

                            <strong>
                                {schedules.length}
                            </strong>

                        </div>


                        <div className="schedules-day-overview-divider" />


                        <div className="schedules-day-overview-stat">

                            <span>
                                Em andamento
                            </span>

                            <strong>
                                {
                                    schedules.filter(
                                        schedule =>
                                            schedule.status === "pending"
                                    ).length
                                }
                            </strong>

                        </div>


                        <div className="schedules-day-overview-divider" />


                        <div className="schedules-day-overview-stat">

                            <span>
                                Concluídos
                            </span>

                            <strong>
                                {
                                    schedules.filter(
                                        schedule =>
                                            schedule.status === "completed"
                                    ).length
                                }
                            </strong>

                        </div>


                        <div className="schedules-day-overview-divider" />


                        <div className="schedules-day-overview-stat">

                            <span>
                                Cancelados
                            </span>

                            <strong>
                                {
                                    schedules.filter(
                                        schedule =>
                                            schedule.status === "cancelled" ||
                                            schedule.status === "canceled"
                                    ).length
                                }
                            </strong>

                        </div>

                    </div>

                </section>


                {/* =====================================================
                AGENDA DESKTOP
            ===================================================== */}

                <section className="schedules-workspace">

                    {/* =================================================
                    TIMELINE
                ================================================= */}

                    <div className="schedules-calendar-panel">

                        <div className="schedules-calendar-panel-header">

                            <div>

                                <span className="schedules-section-eyebrow">
                                    Cronograma
                                </span>

                                <h2>
                                    Agenda do dia
                                </h2>

                            </div>


                            <div className="schedules-calendar-panel-actions">

                                <div className="schedules-status-legend">

                                    <span className="schedules-legend-item pending">
                                        <i />
                                        Em andamento
                                    </span>

                                    <span className="schedules-legend-item completed">
                                        <i />
                                        Concluído
                                    </span>

                                    <span className="schedules-legend-item cancelled">
                                        <i />
                                        Cancelado
                                    </span>

                                </div>

                            </div>

                        </div>


                        <div className="schedules-calendar-body">

                            <div
                                className="schedule-timeline"
                                ref={timelineRef}
                            >

                                {loadingSchedules ? (

                                    <div className="schedules-loading-state">

                                        <div className="schedules-loading-icon">

                                            <Icon
                                                icon="line-md:loading-twotone-loop"
                                            />

                                        </div>

                                        <strong>
                                            Carregando agenda
                                        </strong>

                                        <span>
                                            Buscando os agendamentos do dia.
                                        </span>

                                    </div>

                                ) : (

                                    hours.map(
                                        hour => {

                                            const hourKey =
                                                hour.slice(
                                                    0,
                                                    2
                                                );

                                            const hourSchedules =
                                                schedulesByHour[
                                                hourKey
                                                ] || [];

                                            return (

                                                <div
                                                    key={hour}
                                                    className={`schedule-hour-row ${hourSchedules.length > 0
                                                        ? "has-schedules"
                                                        : ""
                                                        }`}
                                                >

                                                    {/* HORA */}

                                                    <div className="schedule-hour-label">

                                                        <span>
                                                            {hour}
                                                        </span>

                                                    </div>


                                                    {/* LINHA */}

                                                    <div className="schedule-hour-grid">

                                                        <div className="schedule-hour-divider" />


                                                        <div className="schedule-hour-body">

                                                            {/* MARCAÇÃO DE HORA ATUAL */}

                                                            {selectedIsToday &&
                                                                currentDate.getHours() ===
                                                                Number(hourKey) && (

                                                                    <div className="schedule-current-time-line">

                                                                        <span>
                                                                            Agora
                                                                        </span>

                                                                    </div>

                                                                )}


                                                            {/* EVENTOS */}

                                                            {hourSchedules.length >
                                                                0 ? (

                                                                <div className="schedule-hour-events">

                                                                    {hourSchedules.map(
                                                                        schedule => {

                                                                            const scheduleStatus =
                                                                                statusMap[
                                                                                schedule.status
                                                                                ] ||
                                                                                {
                                                                                    label:
                                                                                        schedule.status ||
                                                                                        "Agendado",
                                                                                    className:
                                                                                        "default"
                                                                                };

                                                                            const isCurrent =
                                                                                schedule.status ===
                                                                                "pending";

                                                                            return (

                                                                                <article
                                                                                    key={schedule.id}
                                                                                    className={`
                                                                                    schedule-event-slot
                                                                                    schedule-event-card
                                                                                    ${schedule.status
                                                                                            ?.trim()
                                                                                            ?.toLowerCase() || "default"}
                                                                                    ${isCurrent
                                                                                            ? "is-current"
                                                                                            : ""
                                                                                        }
                                                                                `}
                                                                                    onClick={() =>
                                                                                        openSchedule(
                                                                                            schedule
                                                                                        )
                                                                                    }
                                                                                >

                                                                                    <div className="schedule-event-accent" />


                                                                                    <div className="schedule-event-content">

                                                                                        {/* HORA */}

                                                                                        <div className="schedule-event-time-column">

                                                                                            <strong>
                                                                                                {
                                                                                                    schedule.startHourText
                                                                                                }
                                                                                            </strong>

                                                                                            <span>
                                                                                                {
                                                                                                    schedule.endHourText
                                                                                                }
                                                                                            </span>

                                                                                        </div>


                                                                                        {/* SERVIÇO */}

                                                                                        <div className="schedule-event-main">

                                                                                            <div className="schedule-event-title-row">

                                                                                                <h3 className="schedule-event-title">
                                                                                                    {
                                                                                                        schedule.productName ||
                                                                                                        "Serviço"
                                                                                                    }
                                                                                                </h3>

                                                                                                <span
                                                                                                    className={`schedule-event-status-badge ${scheduleStatus.className}`}
                                                                                                >

                                                                                                    {
                                                                                                        scheduleStatus.label
                                                                                                    }

                                                                                                </span>

                                                                                            </div>


                                                                                            <div className="schedule-event-meta">

                                                                                                <span>

                                                                                                    <Icon
                                                                                                        icon="solar:user-linear"
                                                                                                    />

                                                                                                    {
                                                                                                        schedule.userName ||
                                                                                                        "Cliente"
                                                                                                    }

                                                                                                </span>


                                                                                                <span>

                                                                                                    <Icon
                                                                                                        icon="solar:clock-circle-linear"
                                                                                                    />

                                                                                                    {
                                                                                                        schedule.duration
                                                                                                            ? `${schedule.duration} min`
                                                                                                            : "Duração não informada"
                                                                                                    }

                                                                                                </span>

                                                                                            </div>

                                                                                        </div>


                                                                                        {/* PROFISSIONAL */}

                                                                                        <div className="schedule-event-professional">

                                                                                            <div className="schedule-event-admin">

                                                                                                {userProfileImages[
                                                                                                    schedule.professionalId
                                                                                                ] ? (

                                                                                                    <img
                                                                                                        src={
                                                                                                            userProfileImages[
                                                                                                            schedule.professionalId
                                                                                                            ]
                                                                                                        }
                                                                                                        alt={
                                                                                                            schedule.professionalName ||
                                                                                                            "Profissional"
                                                                                                        }
                                                                                                    />

                                                                                                ) : (

                                                                                                    schedule.professionalName
                                                                                                        ?.charAt(0)
                                                                                                        ?.toUpperCase() ||
                                                                                                    "?"

                                                                                                )}

                                                                                            </div>


                                                                                            <div className="schedule-event-professional-info">

                                                                                                <span>
                                                                                                    Responsável
                                                                                                </span>

                                                                                                <strong>
                                                                                                    {
                                                                                                        schedule.professionalName ||
                                                                                                        "Não informado"
                                                                                                    }
                                                                                                </strong>

                                                                                            </div>

                                                                                        </div>


                                                                                        {/* ACTION */}

                                                                                        <button
                                                                                            type="button"
                                                                                            className="schedule-event-open"
                                                                                            onClick={(event) => {

                                                                                                event.stopPropagation();

                                                                                                openSchedule(
                                                                                                    schedule
                                                                                                );

                                                                                            }}
                                                                                            title="Ver detalhes"
                                                                                        >

                                                                                            <Icon
                                                                                                icon="lucide:arrow-up-right"
                                                                                            />

                                                                                        </button>

                                                                                    </div>

                                                                                </article>

                                                                            );

                                                                        }
                                                                    )}

                                                                </div>

                                                            ) : (

                                                                <div className="schedule-empty-hour">

                                                                    <span>
                                                                        Horário disponível
                                                                    </span>

                                                                </div>

                                                            )}

                                                        </div>

                                                    </div>

                                                </div>

                                            );

                                        }
                                    )

                                )}

                            </div>

                        </div>

                    </div>


                    {/* =================================================
                    SIDEBAR DESKTOP
                ================================================= */}

                    <aside className="schedules-sidebar">

                        {/* =================================================
                        RESUMO
                    ================================================= */}

                        <section className="schedules-sidebar-card schedules-sidebar-summary">

                            <div className="schedules-sidebar-card-header">

                                <div>

                                    <span>
                                        Resumo
                                    </span>

                                    <h3>
                                        Hoje na agenda
                                    </h3>

                                </div>

                                <Icon
                                    icon="solar:chart-2-linear"
                                />

                            </div>


                            <div className="schedules-sidebar-summary-total">

                                <strong>
                                    {schedules.length}
                                </strong>

                                <span>
                                    agendamentos
                                </span>

                            </div>


                            <div className="schedules-sidebar-summary-list">

                                <div className="schedules-sidebar-summary-row">

                                    <span>

                                        <i className="pending" />

                                        Em andamento

                                    </span>

                                    <strong>
                                        {
                                            schedules.filter(
                                                schedule =>
                                                    schedule.status === "pending"
                                            ).length
                                        }
                                    </strong>

                                </div>


                                <div className="schedules-sidebar-summary-row">

                                    <span>

                                        <i className="completed" />

                                        Concluídos

                                    </span>

                                    <strong>
                                        {
                                            schedules.filter(
                                                schedule =>
                                                    schedule.status === "completed"
                                            ).length
                                        }
                                    </strong>

                                </div>


                                <div className="schedules-sidebar-summary-row">

                                    <span>

                                        <i className="cancelled" />

                                        Cancelados

                                    </span>

                                    <strong>
                                        {
                                            schedules.filter(
                                                schedule =>
                                                    schedule.status === "cancelled" ||
                                                    schedule.status === "canceled"
                                            ).length
                                        }
                                    </strong>

                                </div>

                            </div>

                        </section>


                        {/* =================================================
                        PRÓXIMO AGENDAMENTO
                    ================================================= */}

                        <section className="schedules-sidebar-card schedules-next-card">

                            <div className="schedules-sidebar-card-header">

                                <div>

                                    <span>
                                        Próximo
                                    </span>

                                    <h3>
                                        Próximo atendimento
                                    </h3>

                                </div>

                                <Icon
                                    icon="solar:clock-circle-linear"
                                />

                            </div>


                            {schedules.length > 0 ? (

                                <>

                                    {(() => {

                                        const sortedSchedules =
                                            [...schedules]
                                                .sort(
                                                    (
                                                        a,
                                                        b
                                                    ) =>
                                                        (
                                                            a.startMinutes ||
                                                            0
                                                        ) -
                                                        (
                                                            b.startMinutes ||
                                                            0
                                                        )
                                                );

                                        const nextSchedule =
                                            sortedSchedules.find(
                                                schedule => {

                                                    const scheduleHour =
                                                        hourToMinutes(
                                                            schedule.startHourText ||
                                                            schedule.hour
                                                        );

                                                    return (
                                                        scheduleHour >=
                                                        currentHour * 60 &&
                                                        schedule.status !==
                                                        "completed" &&
                                                        schedule.status !==
                                                        "cancelled" &&
                                                        schedule.status !==
                                                        "canceled"
                                                    );

                                                }
                                            ) ||
                                            sortedSchedules[0];

                                        return (

                                            <div className="schedules-next-content">

                                                <div className="schedules-next-time">

                                                    <strong>
                                                        {
                                                            nextSchedule?.startHourText ||
                                                            nextSchedule?.hour ||
                                                            "--:--"
                                                        }
                                                    </strong>

                                                    <span>
                                                        {
                                                            nextSchedule?.endHourText ||
                                                            "--:--"
                                                        }
                                                    </span>

                                                </div>


                                                <div className="schedules-next-service">

                                                    <strong>
                                                        {
                                                            nextSchedule?.productName ||
                                                            "Atendimento"
                                                        }
                                                    </strong>

                                                    <span>
                                                        {
                                                            nextSchedule?.userName ||
                                                            "Cliente"
                                                        }
                                                    </span>

                                                    <small>
                                                        {nextSchedule?.professionalName ||
                                                            "Profissional não informado"}
                                                    </small>

                                                </div>

                                            </div>

                                        );

                                    })()}

                                </>

                            ) : (

                                <div className="schedules-next-empty">

                                    <div className="schedules-next-empty-icon">

                                        <Icon
                                            icon="solar:calendar-add-linear"
                                        />

                                    </div>

                                    <strong>
                                        Nenhum próximo atendimento
                                    </strong>

                                    <span>
                                        Sua agenda está livre neste período.
                                    </span>

                                </div>

                            )}

                        </section>


                        {/* =================================================
                        DISTRIBUIÇÃO POR PROFISSIONAL
                    ================================================= */}

                        <section className="schedules-sidebar-card">

                            <div className="schedules-sidebar-card-header">

                                <div>

                                    <span>
                                        Equipe
                                    </span>

                                    <h3>
                                        Profissionais do dia
                                    </h3>

                                </div>

                                <Icon
                                    icon="solar:users-group-rounded-linear"
                                />

                            </div>


                            <div className="schedules-professionals-list">

                                {[
                                    ...new Map(
                                        schedules.map(
                                            schedule => [
                                                schedule.professionalId ||
                                                schedule.professionalName,
                                                schedule
                                            ]
                                        )
                                    ).values()
                                ].map(
                                    (
                                        schedule
                                    ) => {

                                        const professionalSchedules =
                                            schedules.filter(
                                                item =>
                                                    (
                                                        item.professionalId ||
                                                        item.professionalName
                                                    ) ===
                                                    (
                                                        schedule.professionalId ||
                                                        schedule.professionalName
                                                    )
                                            );

                                        return (

                                            <button
                                                type="button"
                                                key={
                                                    schedule.professionalId ||
                                                    schedule.professionalName
                                                }
                                                className="schedules-professional-item"
                                                onClick={() =>
                                                    openSchedule(
                                                        professionalSchedules[0]
                                                    )
                                                }
                                            >

                                                <div className="schedules-professional-avatar">

                                                    {userProfileImages[
                                                        schedule.professionalId
                                                    ] ? (

                                                        <img
                                                            src={
                                                                userProfileImages[
                                                                schedule.professionalId
                                                                ]
                                                            }
                                                            alt={
                                                                schedule.professionalName ||
                                                                "Profissional"
                                                            }
                                                        />

                                                    ) : (

                                                        schedule.professionalName
                                                            ?.charAt(0)
                                                            ?.toUpperCase() ||
                                                        "?"

                                                    )}

                                                </div>


                                                <div className="schedules-professional-info">

                                                    <strong>
                                                        {
                                                            schedule.professionalName ||
                                                            "Profissional"
                                                        }
                                                    </strong>

                                                    <span>
                                                        {professionalSchedules.length}{" "}
                                                        {professionalSchedules.length ===
                                                            1
                                                            ? "agendamento"
                                                            : "agendamentos"}
                                                    </span>

                                                </div>


                                                <Icon
                                                    icon="lucide:chevron-right"
                                                />

                                            </button>

                                        );

                                    }
                                )}


                                {schedules.length === 0 && (

                                    <div className="schedules-professionals-empty">

                                        <Icon
                                            icon="solar:user-linear"
                                        />

                                        <span>
                                            Nenhum profissional com agenda hoje.
                                        </span>

                                    </div>

                                )}

                            </div>

                        </section>


                        {/* =================================================
                        INFORMAÇÃO DE HORÁRIO
                    ================================================= */}

                        <section className="schedules-sidebar-card schedules-sidebar-tip">

                            <div className="schedules-sidebar-tip-icon">

                                <Icon
                                    icon="solar:lightbulb-minimalistic-linear"
                                />

                            </div>

                            <div>

                                <strong>
                                    Dica
                                </strong>

                                <p>
                                    Clique em qualquer atendimento para
                                    visualizar todos os detalhes.
                                </p>

                            </div>

                        </section>

                    </aside>

                </section>

            </main>


            {/* =========================================================
            MODAL DE DETALHES DO AGENDAMENTO
        ========================================================= */}

            {isModalOpen && (

                <div
                    ref={backdropRef}
                    className={`schedule-modal ${isClosingModal
                        ? "closing"
                        : "opening"
                        }`}
                    onClick={closeSchedule}
                >

                    <div
                        ref={modalContentRef}
                        className={`schedule-modal-content ${isClosingModal
                            ? "closing"
                            : "opening"
                            }`}
                        onClick={(e) =>
                            e.stopPropagation()
                        }
                    >

                        <div className="schedule-modal-handle" />


                        {/* =================================================
                        HEADER
                    ================================================= */}

                        <div className="schedule-modal-header">

                            <div className="schedule-modal-header-top">

                                <div className="schedule-modal-service-image">

                                    {productImages[
                                        selectedSchedule?.productId
                                    ] ? (

                                        <img
                                            src={
                                                productImages[
                                                selectedSchedule.productId
                                                ]
                                            }
                                            alt={
                                                selectedSchedule?.productName ||
                                                "Produto"
                                            }
                                        />

                                    ) : (

                                        <div className="schedule-modal-service-image-placeholder">

                                            <Icon
                                                icon="solar:gallery-linear"
                                            />

                                        </div>

                                    )}

                                </div>


                                <div className="schedule-modal-title-wrapper">

                                    <span>
                                        Agendamento
                                    </span>

                                    <h2>
                                        {
                                            selectedSchedule?.productName ||
                                            "Atendimento"
                                        }
                                    </h2>

                                    <p>
                                        ID #{selectedSchedule?.id}
                                    </p>

                                </div>

                            </div>


                            <div
                                className={`schedule-modal-status ${scheduleStatus.className
                                    }`}
                            >

                                <span className="schedule-modal-status-dot" />

                                {
                                    scheduleStatus.label
                                }

                            </div>

                        </div>


                        {/* =================================================
                        MODAL MAIN
                    ================================================= */}

                        <div className="schedule-modal-main">

                            {/* CLIENTE */}

                            <div className="schedule-modal-client">

                                <div className="schedule-modal-client-avatar">

                                    {
                                        selectedSchedule?.userName
                                            ?.charAt(0)
                                            ?.toUpperCase() ||
                                        "U"
                                    }

                                </div>

                                <div>

                                    <span>
                                        Cliente
                                    </span>

                                    <strong>
                                        {
                                            selectedSchedule?.userName ||
                                            "Cliente"
                                        }
                                    </strong>

                                </div>

                            </div>


                            {/* DATA / HORÁRIO */}

                            <div className="schedule-modal-datetime">

                                <div className="schedule-modal-detail">

                                    <div className="schedule-modal-detail-icon">

                                        <Icon
                                            icon="solar:calendar-date-linear"
                                        />

                                    </div>

                                    <div>

                                        <span>
                                            Data
                                        </span>

                                        <strong>
                                            {
                                                selectedSchedule?.dayLabel ||
                                                selectedSchedule?.day ||
                                                "—"
                                            }
                                        </strong>

                                    </div>

                                </div>


                                <div className="schedule-modal-detail">

                                    <div className="schedule-modal-detail-icon">

                                        <Icon
                                            icon="solar:clock-circle-linear"
                                        />

                                    </div>

                                    <div>

                                        <span>
                                            Horário
                                        </span>

                                        <strong>
                                            {
                                                selectedSchedule?.startHourText ||
                                                selectedSchedule?.hour ||
                                                "—"
                                            }

                                            {" — "}

                                            {
                                                selectedSchedule?.endHourText ||
                                                "—"
                                            }

                                        </strong>

                                    </div>

                                </div>


                                <div className="schedule-modal-detail">

                                    <div className="schedule-modal-detail-icon">

                                        <Icon
                                            icon="solar:hourglass-linear"
                                        />

                                    </div>

                                    <div>

                                        <span>
                                            Duração
                                        </span>

                                        <strong>
                                            {
                                                selectedSchedule?.duration
                                                    ? `${selectedSchedule.duration} min`
                                                    : "—"
                                            }
                                        </strong>

                                    </div>

                                </div>

                            </div>


                            {/* PROFISSIONAL */}

                            <div className="schedule-modal-professional">

                                <div className="schedule-modal-professional-avatar">

                                    {userProfileImages[
                                        selectedSchedule?.professionalId
                                    ] ? (

                                        <img
                                            src={
                                                userProfileImages[
                                                selectedSchedule?.professionalId
                                                ]
                                            }
                                            alt={
                                                selectedSchedule
                                                    ?.professionalName ||
                                                "Profissional"
                                            }
                                        />

                                    ) : (

                                        selectedSchedule
                                            ?.professionalName
                                            ?.charAt(0)
                                            ?.toUpperCase() ||
                                        "?"

                                    )}

                                </div>


                                <div className="schedule-modal-professional-info">

                                    <span>
                                        Responsável
                                    </span>

                                    <strong>
                                        {
                                            selectedSchedule?.professionalName ||
                                            "Não informado"
                                        }
                                    </strong>

                                </div>

                            </div>

                        </div>


                        {/* =================================================
                        PRICE
                    ================================================= */}

                        <div className="schedule-modal-price">

                            <div>

                                <span>
                                    Pedido
                                </span>

                                <strong>
                                    {
                                        selectedSchedule?.productName ||
                                        "Atendimento"
                                    }
                                </strong>

                            </div>

                            <strong>
                                {
                                    selectedSchedule?.productPrice ||
                                    selectedSchedule?.productValue ||
                                    "R$ 0,00"
                                }
                            </strong>

                        </div>


                        {/* =================================================
                        COUNTDOWN
                    ================================================= */}

                        <div
                            className={`schedule-countdown ${scheduleFinished
                                ? "finished"
                                : "running"
                                }`}
                        >

                            <div className="schedule-countdown-icon">

                                <Icon
                                    icon={
                                        scheduleFinished
                                            ? "solar:check-circle-linear"
                                            : "solar:clock-circle-linear"
                                    }
                                />

                            </div>


                            <div className="schedule-countdown-content">

                                <strong>

                                    {scheduleFinished
                                        ? "Agendamento encerrado"
                                        : "Tempo restante"}

                                </strong>

                                <span>

                                    {scheduleFinished
                                        ? "O horário deste agendamento já passou."
                                        : remainingTime}

                                </span>

                            </div>

                        </div>


                        {/* =================================================
                        FOOTER
                    ================================================= */}

                        <div className="schedule-modal-footer">

                            <button
                                type="button"
                                className="schedule-modal-secondary"
                                onClick={closeSchedule}
                            >
                                Fechar
                            </button>


                            {!scheduleFinished && (

                                <button
                                    type="button"
                                    className="schedule-modal-complete"
                                    onClick={() => {
                                        // lógica existente
                                    }}
                                >

                                    <Icon
                                        icon="solar:check-circle-linear"
                                    />

                                    Completar pedido

                                </button>

                            )}

                        </div>

                    </div>

                </div>

            )}

        </div>
    );
};

export default SchedulesAdm;
