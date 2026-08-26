import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";

import { getDatabase, ref, update } from "firebase/database";

import { useUserCompany } from "../../../../../contexts/companyContext/UserCompanyContext";
import Toast from "../../../../../components/toast/Toast";

import "./BusinessHoursScreen.css";

const DAYS = [
    { id: "sunday", label: "Domingo" },
    { id: "monday", label: "Segunda-feira" },
    { id: "tuesday", label: "Terça-feira" },
    { id: "wednesday", label: "Quarta-feira" },
    { id: "thursday", label: "Quinta-feira" },
    { id: "friday", label: "Sexta-feira" },
    { id: "saturday", label: "Sábado" }
];

const createInitialSchedule = () => {

    const schedule = {};

    DAYS.forEach((day) => {

        schedule[day.id] = {
            enabled: true,
            intervals: [
                {
                    open: "08:00",
                    close: "18:00"
                }
            ]
        };

    });

    return schedule;

};

const BusinessHoursScreen = () => {

    const { company } = useUserCompany();

    const [schedule, setSchedule] = useState(
        createInitialSchedule()
    );

    const [initialSchedule, setInitialSchedule] = useState(
        createInitialSchedule()
    );

    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState("success");
    const [toastTitle, setToastTitle] = useState("");
    const [toastMessage, setToastMessage] = useState("");

    useEffect(() => {

        if (!company) return;

        const savedHours = company.businessHours;

        if (!savedHours) return;

        const data = createInitialSchedule();

        DAYS.forEach((day) => {

            if (savedHours[day.id]) {

                data[day.id] = {
                    enabled:
                        savedHours[day.id].enabled ?? true,

                    intervals:
                        savedHours[day.id].intervals || []
                };

            }

        });

        setSchedule(data);
        setInitialSchedule(data);

    }, [company]);

    const openToast = (type, title, message) => {

        setToastType(type);
        setToastTitle(title);
        setToastMessage(message);
        setShowToast(true);

    };

    const toggleDay = (dayId) => {

        setSchedule(prev => ({

            ...prev,

            [dayId]: {
                ...prev[dayId],
                enabled: !prev[dayId].enabled
            }

        }));

    };

    const updateInterval = (
        dayId,
        intervalIndex,
        field,
        value
    ) => {

        setSchedule(prev => {

            const intervals = [
                ...prev[dayId].intervals
            ];

            intervals[intervalIndex] = {
                ...intervals[intervalIndex],
                [field]: value
            };

            return {

                ...prev,

                [dayId]: {
                    ...prev[dayId],
                    intervals
                }

            };

        });

    };

    const addInterval = (dayId) => {

        setSchedule(prev => {

            const currentIntervals = prev[dayId].intervals;

            // Máximo de 3 intervalos
            if (currentIntervals.length >= 3) {
                return prev;
            }

            return {

                ...prev,

                [dayId]: {

                    ...prev[dayId],

                    intervals: [
                        ...currentIntervals,

                        {
                            open: "13:00",
                            close: "18:00"
                        }
                    ]

                }

            };

        });

    };

    const removeInterval = (
        dayId,
        intervalIndex
    ) => {

        setSchedule(prev => {

            const intervals =
                prev[dayId].intervals.filter(
                    (_, index) =>
                        index !== intervalIndex
                );

            return {

                ...prev,

                [dayId]: {
                    ...prev[dayId],
                    intervals
                }

            };

        });

    };

    const hasChanges =
        JSON.stringify(schedule) !==
        JSON.stringify(initialSchedule);

    const validateSchedule = () => {

        for (const day of DAYS) {

            const data = schedule[day.id];

            if (!data.enabled) continue;

            if (!data.intervals.length) {

                return `Adicione pelo menos um horário para ${day.label}.`;

            }

            for (const interval of data.intervals) {

                if (!interval.open || !interval.close) {

                    return `Preencha os horários de ${day.label}.`;

                }

                if (interval.open >= interval.close) {

                    return `O horário de fechamento de ${day.label} deve ser maior que o horário de abertura.`;

                }

            }

        }

        return null;

    };

    const handleSave = async () => {

        const error = validateSchedule();

        if (error) {

            openToast(
                "error",
                "Horário inválido",
                error
            );

            return;

        }

        try {

            const db = getDatabase();

            await update(
                ref(
                    db,
                    `companys/${company.handle}`
                ),
                {
                    businessHours: schedule
                }
            );

            setInitialSchedule(schedule);

            openToast(
                "success",
                "Sucesso",
                "Horários atualizados com sucesso."
            );

        } catch (error) {

            console.error(error);

            openToast(
                "error",
                "Erro ao salvar",
                "Não foi possível salvar os horários."
            );

        }

    };

    return (

        <div className="company-screen business-hours-screen">

            <div className="company-card business-hours-card">

                {DAYS.map((day) => {

                    const dayData =
                        schedule[day.id];

                    return (

                        <div
                            className={`business-day ${dayData.enabled
                                ? ""
                                : "disabled"
                                }`}
                            key={day.id}
                        >

                            <div className="business-day-header">

                                <div className="business-day-left">

                                    <Icon
                                        icon="solar:calendar-outline"
                                        className="company-input-icon"
                                    />

                                    <span>
                                        {day.label}
                                    </span>

                                </div>

                                <button
                                    type="button"
                                    className={`business-day-toggle ${dayData.enabled
                                        ? "active"
                                        : ""
                                        }`}
                                    onClick={() =>
                                        toggleDay(day.id)
                                    }
                                >

                                    <span />

                                </button>

                            </div>

                            {dayData.enabled && (

                                <div className="business-intervals">

                                    {dayData.intervals.map(
                                        (interval, index) => (

                                            <div
                                                className="business-interval"
                                                key={index}
                                            >

                                                <input
                                                    type="time"
                                                    value={interval.open}
                                                    onChange={(e) =>
                                                        updateInterval(
                                                            day.id,
                                                            index,
                                                            "open",
                                                            e.target.value
                                                        )
                                                    }
                                                />

                                                <span>
                                                    até
                                                </span>

                                                <input
                                                    type="time"
                                                    value={interval.close}
                                                    onChange={(e) =>
                                                        updateInterval(
                                                            day.id,
                                                            index,
                                                            "close",
                                                            e.target.value
                                                        )
                                                    }
                                                />

                                                {dayData.intervals.length >
                                                    1 && (

                                                        <button
                                                            type="button"
                                                            className="business-remove"
                                                            onClick={() =>
                                                                removeInterval(
                                                                    day.id,
                                                                    index
                                                                )
                                                            }
                                                        >

                                                            <Icon icon="solar:trash-bin-trash-outline" />

                                                        </button>

                                                    )}

                                            </div>

                                        )
                                    )}

                                    {dayData.intervals.length < 3 && (

                                        <button
                                            type="button"
                                            className="business-add-interval"
                                            onClick={() =>
                                                addInterval(day.id)
                                            }
                                        >

                                            <Icon icon="solar:add-circle-outline" />

                                            Adicionar intervalo

                                        </button>

                                    )}

                                </div>

                            )}

                            {!dayData.enabled && (

                                <span className="business-closed">
                                    Fechado
                                </span>

                            )}

                        </div>

                    );

                })}

            </div>

            <button
                disabled={!hasChanges}
                onClick={handleSave}
                className={`company-save ${!hasChanges
                    ? "disabled"
                    : ""
                    }`}
            >
                Salvar alterações
            </button>

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

export default BusinessHoursScreen;