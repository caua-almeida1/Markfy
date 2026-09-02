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

const MAX_INTERVALS = 3;

const createInitialSchedule = () => {

    const schedule = {};

    DAYS.forEach((day) => {

        schedule[day.id] = {
            enabled: true,

            open: "08:00",

            close: "18:00",

            intervals: []

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

    // ==========================================
    // CARREGAR HORÁRIOS DO BANCO
    // ==========================================

    useEffect(() => {

        if (!company) return;

        const savedHours =
            company.businessHours;

        if (!savedHours) return;

        const data =
            createInitialSchedule();

        DAYS.forEach((day) => {

            const savedDay =
                savedHours[day.id];

            if (!savedDay) {
                return;
            }

            let intervals =
                Array.isArray(savedDay.intervals)
                    ? savedDay.intervals
                    : [];

            // Mantém no máximo 3 pausas
            intervals =
                intervals.slice(0, MAX_INTERVALS);

            data[day.id] = {

                enabled:
                    savedDay.enabled ?? true,

                open:
                    savedDay.open || "08:00",

                close:
                    savedDay.close || "18:00",

                intervals

            };

        });

        setSchedule(data);

        setInitialSchedule(
            JSON.parse(
                JSON.stringify(data)
            )
        );

    }, [company]);

    // ==========================================
    // TOAST
    // ==========================================

    const openToast = (
        type,
        title,
        message
    ) => {

        setToastType(type);
        setToastTitle(title);
        setToastMessage(message);
        setShowToast(true);

    };

    // ==========================================
    // ATIVAR / DESATIVAR DIA
    // ==========================================

    const toggleDay = (dayId) => {

        setSchedule(prev => ({

            ...prev,

            [dayId]: {

                ...prev[dayId],

                enabled:
                    !prev[dayId].enabled

            }

        }));

    };

    const updateBusinessHour = (
        dayId,
        field,
        value
    ) => {

        setSchedule(prev => ({

            ...prev,

            [dayId]: {

                ...prev[dayId],

                [field]: value

            }

        }));

    };

    // ==========================================
    // ALTERAR INTERVALO
    // ==========================================

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

    // ==========================================
    // ADICIONAR INTERVALO
    // ==========================================

    const addInterval = (dayId) => {

        setSchedule(prev => {

            const currentIntervals =
                Array.isArray(
                    prev[dayId].intervals
                )
                    ? prev[dayId].intervals
                    : [];

            if (
                currentIntervals.length >=
                MAX_INTERVALS
            ) {

                return prev;

            }

            return {

                ...prev,

                [dayId]: {

                    ...prev[dayId],

                    intervals: [

                        ...currentIntervals,

                        {
                            open: "12:00",
                            close: "13:00"
                        }

                    ]

                }

            };

        });

    };

    // ==========================================
    // REMOVER INTERVALO
    // ==========================================

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

    // ==========================================
    // VERIFICAR ALTERAÇÕES
    // ==========================================

    const hasChanges =
        JSON.stringify(schedule) !==
        JSON.stringify(initialSchedule);

    // ==========================================
    // CONVERTER HORÁRIO
    // ==========================================

    const timeToMinutes = (time) => {

        if (!time) {
            return null;
        }

        const [
            hour,
            minute
        ] = time
            .split(":")
            .map(Number);

        if (
            Number.isNaN(hour) ||
            Number.isNaN(minute)
        ) {

            return null;

        }

        return (
            hour * 60 +
            minute
        );

    };

    // ==========================================
    // VALIDAR HORÁRIOS
    // ==========================================

    const validateSchedule = () => {

        for (const day of DAYS) {

            const data =
                schedule[day.id];

            // ==========================================
            // DIA FECHADO
            // ==========================================

            if (!data.enabled) {
                continue;
            }

            // ==========================================
            // HORÁRIO PRINCIPAL
            // ==========================================

            const open =
                timeToMinutes(data.open);

            const close =
                timeToMinutes(data.close);

            if (
                open === null ||
                close === null
            ) {

                return (
                    `Informe corretamente o horário ` +
                    `de funcionamento de ${day.label}.`
                );

            }

            if (open >= close) {

                return (
                    `O horário de fechamento de ` +
                    `${day.label} deve ser maior que ` +
                    `o horário de abertura.`
                );

            }

            // ==========================================
            // LIMITE DE PAUSAS
            // ==========================================

            if (
                data.intervals.length >
                MAX_INTERVALS
            ) {

                return (
                    `${day.label} pode possuir no máximo ` +
                    `${MAX_INTERVALS} intervalos.`
                );

            }

            // ==========================================
            // VALIDAR PAUSAS
            // ==========================================

            for (
                const interval
                of data.intervals
            ) {

                if (
                    !interval?.open ||
                    !interval?.close
                ) {

                    return (
                        `Preencha todos os horários ` +
                        `das pausas de ${day.label}.`
                    );

                }

                const intervalOpen =
                    timeToMinutes(
                        interval.open
                    );

                const intervalClose =
                    timeToMinutes(
                        interval.close
                    );

                if (
                    intervalOpen === null ||
                    intervalClose === null
                ) {

                    return (
                        `Existe uma pausa com horário ` +
                        `inválido em ${day.label}.`
                    );

                }

                // ==========================================
                // PAUSA PRECISA TER DURAÇÃO
                // ==========================================

                if (
                    intervalOpen >= intervalClose
                ) {

                    return (
                        `O horário final da pausa de ` +
                        `${day.label} deve ser maior ` +
                        `que o horário inicial.`
                    );

                }

                // ==========================================
                // PAUSA PRECISA ESTAR DENTRO
                // DO HORÁRIO DE FUNCIONAMENTO
                // ==========================================

                if (
                    intervalOpen < open ||
                    intervalClose > close
                ) {

                    return (
                        `A pausa de ${day.label} deve ` +
                        `estar dentro do horário de ` +
                        `funcionamento (${data.open} às ${data.close}).`
                    );

                }

            }

            // ==========================================
            // PAUSAS NÃO PODEM SE SOBREPOR
            // ==========================================

            const sortedIntervals =
                [...data.intervals]
                    .map(interval => ({
                        open:
                            timeToMinutes(
                                interval.open
                            ),
                        close:
                            timeToMinutes(
                                interval.close
                            )
                    }))
                    .sort(
                        (a, b) =>
                            a.open - b.open
                    );

            for (
                let i = 1;
                i < sortedIntervals.length;
                i++
            ) {

                const previous =
                    sortedIntervals[i - 1];

                const current =
                    sortedIntervals[i];

                if (
                    current.open <
                    previous.close
                ) {

                    return (
                        `As pausas de ${day.label} ` +
                        `não podem se sobrepor.`
                    );

                }

            }

        }

        return null;

    };

    // ==========================================
    // SALVAR
    // ==========================================

    const handleSave = async () => {

        const error =
            validateSchedule();

        if (error) {

            openToast(
                "error",
                "Horário inválido",
                error
            );

            return;

        }

        try {

            const db =
                getDatabase();

            await update(
                ref(
                    db,
                    `companys/${company.handle}`
                ),
                {
                    businessHours:
                        schedule
                }
            );

            setInitialSchedule(
                JSON.parse(
                    JSON.stringify(schedule)
                )
            );

            openToast(
                "success",
                "Sucesso",
                "Horários atualizados com sucesso."
            );

        } catch (error) {

            console.error(
                "Erro ao salvar horários:",
                error
            );

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

                            {/* ============================= */}
                            {/* HEADER DO DIA */}
                            {/* ============================= */}

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

                            {/* ============================= */}
                            {/* INTERVALOS */}
                            {/* ============================= */}

                            {dayData.enabled && (

                                <div className="business-intervals">

                                    {/* ================================= */}
                                    {/* HORÁRIO DE FUNCIONAMENTO */}
                                    {/* ================================= */}

                                    <div className="business-hours-section">

                                        <div className="business-hours-section-title">
                                            Horário de funcionamento
                                        </div>

                                        <div className="business-hours-row">

                                            <input
                                                type="time"
                                                value={dayData.open}
                                                onChange={(e) =>
                                                    updateBusinessHour(
                                                        day.id,
                                                        "open",
                                                        e.target.value
                                                    )
                                                }
                                            />

                                            <span>até</span>

                                            <input
                                                type="time"
                                                value={dayData.close}
                                                onChange={(e) =>
                                                    updateBusinessHour(
                                                        day.id,
                                                        "close",
                                                        e.target.value
                                                    )
                                                }
                                            />

                                        </div>

                                    </div>


                                    {/* ================================= */}
                                    {/* PAUSAS */}
                                    {/* ================================= */}

                                    <div className="business-breaks-section">

                                        <div className="business-hours-section-title">
                                            Pausas
                                        </div>

                                        {dayData.intervals.map(
                                            (interval, index) => (

                                                <div className="business-interval">
                                                    <div className="business-interval-label">
                                                        Pausa {index + 1}
                                                    </div>

                                                    <div className="business-interval-fields">

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

                                                        <span>até</span>

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

                                                    </div>
                                                </div>

                                            )
                                        )}

                                        {/* ================================= */}
                                        {/* ADICIONAR PAUSA */}
                                        {/* ================================= */}

                                        {dayData.intervals.length <
                                            MAX_INTERVALS && (

                                                <button
                                                    type="button"
                                                    className="business-add-interval"
                                                    onClick={() =>
                                                        addInterval(day.id)
                                                    }
                                                >

                                                    <Icon
                                                        icon="solar:add-circle-outline"
                                                    />

                                                    Adicionar pausa

                                                </button>

                                            )}

                                    </div>

                                </div>

                            )}

                            {/* ============================= */}
                            {/* FECHADO */}
                            {/* ============================= */}

                            {!dayData.enabled && (

                                <span className="business-closed">
                                    Fechado
                                </span>

                            )}

                        </div>

                    );

                })}

            </div>

            {/* ============================= */}
            {/* SALVAR */}
            {/* ============================= */}

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

            {/* ============================= */}
            {/* TOAST */}
            {/* ============================= */}

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