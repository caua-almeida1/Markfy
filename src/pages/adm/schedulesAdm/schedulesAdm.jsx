import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { getDatabase, ref, get, set, update, onValue } from "firebase/database";

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
        <div className="schedules-container">
            <header className="schedules-header">
                <h1>Agenda</h1>
            </header>
            <div className="schedules-content">

                <div className="schedule-content-days-months">

                    <div
                        className="schedule-month-selector"
                        ref={dropdownRef}
                    >

                        <div
                            className="schedule-content-days-months-header"
                            onClick={() => setShowMonths(prev => !prev)}
                        >
                            <h1>
                                {months[selectedMonth]} {selectedYear}
                            </h1>

                            <Icon
                                icon="iconamoon:arrow-down-2-duotone"
                                className={`icon ${showMonths ? "open" : ""}`}
                            />
                        </div>

                        {showMonths && (
                            <div className="schedule-month-dropdown">

                                {availableYears.map((year) => {

                                    const isOpen = expandedYear === year;

                                    return (

                                        <div
                                            key={year}
                                            className="schedule-month-group"
                                        >

                                            <button
                                                className={`schedule-month-group-header ${selectedYear === year ? "active" : ""
                                                    }`}
                                                onClick={() =>
                                                    setExpandedYear(isOpen ? null : year)
                                                }
                                            >

                                                <span>{year}</span>

                                                <Icon
                                                    icon="iconamoon:arrow-down-2-duotone"
                                                    className={`icon ${isOpen ? "open" : ""}`}
                                                />

                                            </button>

                                            {isOpen && (

                                                <div className="schedule-month-list">

                                                    {months.map((month, index) => (

                                                        <button
                                                            key={`${month}-${year}`}
                                                            className={`schedule-month-option ${selectedMonth === index &&
                                                                selectedYear === year
                                                                ? "active"
                                                                : ""
                                                                }`}
                                                            onClick={() => {

                                                                setSelectedMonth(index);
                                                                setSelectedYear(year);

                                                                setShowMonths(false);

                                                            }}
                                                        >
                                                            {month}
                                                        </button>

                                                    ))}

                                                </div>

                                            )}

                                        </div>

                                    );

                                })}

                            </div>
                        )}
                    </div>
                    <div className="schedule-days-wrapper">

                        <button
                            className="schedule-days-arrow"
                            onClick={() => scrollDays(-1)}
                        >
                            <Icon icon="solar:alt-arrow-left-linear" />
                        </button>

                        <div
                            className="schedule-days-scroll"
                            ref={daysRef}
                        >

                            {monthDays.map(({ day, weekDay }) => (

                                <button
                                    onClick={() => {

                                        setSelectedDay(day);

                                    }}
                                    key={day}
                                    className={`
                                    schedule-day
                                    ${isToday(day) ? "today" : ""}
                                    ${isSelectedDay(day) ? "selected" : ""}
                                    `}                                >
                                    <span className="schedule-day-week">
                                        {weekDay}
                                    </span>

                                    <span className="schedule-day-number">
                                        {day}
                                    </span>

                                </button>

                            ))}

                        </div>

                        <button
                            className="schedule-days-arrow"
                            onClick={() => scrollDays(1)}
                        >
                            <Icon icon="solar:alt-arrow-right-linear" />
                        </button>

                    </div>
                </div>

                <hr className="schedule-divider" />
                <div
                    className="schedule-timeline"
                    ref={timelineRef}
                >

                    {hours.map((hour) => (

                        <div
                            key={hour}
                            className="schedule-hour-row"
                        >

                            <div className="schedule-hour-label">

                                {hour}

                            </div>

                            <div className="schedule-hour-grid">

                                <div className="schedule-hour-divider" />

                                <div className="schedule-hour-body">

                                    {(schedulesByHour[hour.slice(0, 2)] || []).map((schedule) => (

                                        <div
                                            key={schedule.id}
                                            className="schedule-event-slot"
                                            onClick={() => openSchedule(schedule)}                                        >
                                            <div className="schedule-event-content">
                                                <div
                                                    className={`schedule-event-accent ${schedule.status
                                                        ?.trim()
                                                        ?.toLowerCase()}`}
                                                />

                                                <div className="schedule-event-info">

                                                    <h1 className="schedule-event-title">
                                                        {schedule.productName}
                                                    </h1>

                                                    <p className="schedule-event-client">
                                                        {schedule.userName}
                                                    </p>

                                                    <span className="schedule-event-time">
                                                        {schedule.startHourText} - {schedule.endHourText}
                                                    </span>

                                                </div>

                                                <div className="schedule-event-side">

                                                    <div
                                                        className={`schedule-event-admin ${schedule.status
                                                            ?.trim()
                                                            ?.toLowerCase()}`}
                                                    >
                                                        {schedule.professionalName?.charAt(0)}
                                                    </div>

                                                </div>

                                            </div>

                                        </div>

                                    ))}

                                </div>

                            </div>

                        </div>

                    ))}

                </div>
            </div>

            {isModalOpen && (

                <div
                    ref={backdropRef}
                    className={`schedule-modal ${isClosingModal ? "closing" : "opening"}`}
                    onClick={closeSchedule}
                >

                    <div
                        ref={modalContentRef}
                        className={`schedule-modal-content ${isClosingModal ? "closing" : "opening"}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div
                            className="schedule-modal-handle"

                        />
                        <button
                            className="schedule-modal-close"
                            onClick={closeSchedule}
                        >
                            ✕
                        </button>

                        <div className="schedule-modal-body">

                            <div className="schedule-modal-header">

                                <h2>
                                    {selectedSchedule.productName}
                                </h2>

                            </div>

                            <div className="schedule-modal-info">


                                <div className="schedule-info-item">

                                    <Icon
                                        icon="solar:calendar-date-linear"
                                        className="schedule-info-icon"
                                    />

                                    <span>
                                        {selectedSchedule.dayLabel}
                                    </span>

                                </div>

                                <div className="schedule-info-item">

                                    <Icon
                                        icon="solar:clock-circle-linear"
                                        className="schedule-info-icon"
                                    />

                                    <span>
                                        {selectedSchedule.startHourText} - {selectedSchedule.endHourText}
                                    </span>

                                </div>

                                <div className="schedule-info-item">

                                    <Icon
                                        icon="solar:user-linear"
                                        className="schedule-info-icon"
                                    />

                                    <span>
                                        {selectedSchedule.userName}
                                    </span>

                                </div>

                                <div className="schedule-info-item">

                                    <Icon
                                        icon="material-symbols:crown-outline-rounded"
                                        className="schedule-info-icon"
                                    />

                                    <span>
                                        {selectedSchedule.professionalName}
                                    </span>

                                </div>

                                <div className="schedule-info-item">

                                    <Icon
                                        icon="solar:verified-check-linear"
                                        className="schedule-info-icon"
                                    />

                                    <span
                                        className={`schedule-status ${scheduleStatus.className}`}
                                    >
                                        {scheduleStatus.label}
                                    </span>

                                </div>

                                <div className="schedule-info-item">

                                    <Icon
                                        icon="solar:wallet-money-linear"
                                        className="schedule-info-icon"
                                    />

                                    <span className="schedule-info-price">
                                        {selectedSchedule.productPrice || 0}
                                    </span>

                                </div>

                                <div
                                    className={`schedule-countdown ${scheduleFinished
                                        ? "finished"
                                        : "running"
                                        }`}
                                >

                                    <Icon
                                        icon={
                                            scheduleFinished
                                                ? "solar:check-circle-linear"
                                                : "solar:clock-circle-linear"
                                        }
                                    />

                                    <div>

                                        <strong>

                                            {scheduleFinished
                                                ? "Atendimento encerrado"
                                                : "Tempo restante"}

                                        </strong>

                                        <span>

                                            {scheduleFinished
                                                ? "O horário deste agendamento já passou."
                                                : remainingTime}

                                        </span>

                                    </div>

                                </div>

                            </div>

                        </div>

                    </div>

                </div>

            )}
        </div>
    );
};

export default SchedulesAdm;
