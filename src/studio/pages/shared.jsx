import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";

import { ANALYTICS_EVENTS, dayKey, getAnalytics, getSchedules, watchLeads } from "../data/studioApi";
import { parseScheduleDate } from "../../utils/bookingHistory";
import { isCancelled } from "../../utils/scheduleStatus";

/* =========================================================
   PEÇAS COMPARTILHADAS DAS TELAS DO STUDIO
========================================================= */

export const PageHead = ({ title, description, actions }) => (
    <div className="std-page__head">
        <div className="std-page__title">
            <h1 className="mk-title mk-title--md">{title}</h1>
            {description && <p>{description}</p>}
        </div>
        {actions && <div className="std-page__actions">{actions}</div>}
    </div>
);

export const formatNumber = (value) => new Intl.NumberFormat("pt-BR").format(value || 0);

export const formatDateTime = (value) => {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    return date.toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
};

export const formatRelative = (value) => {
    if (!value) return "";
    const diff = Date.now() - value;
    const minutes = Math.round(diff / 60000);
    if (minutes < 1) return "agora";
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `há ${hours} h`;
    const days = Math.round(hours / 24);
    if (days < 30) return `há ${days} ${days === 1 ? "dia" : "dias"}`;
    return formatDateTime(value);
};

/* ---------- ANALYTICS ---------- */

const EVENTS = Object.keys(ANALYTICS_EVENTS);

export const useAnalytics = (handle, days) => {
    const [state, setState] = useState({ loading: true, raw: {} });

    useEffect(() => {
        if (!handle) return undefined;

        let cancelled = false;

        getAnalytics(handle)
            .then((raw) => !cancelled && setState({ loading: false, raw }))
            .catch(() => !cancelled && setState({ loading: false, raw: {} }));

        return () => {
            cancelled = true;
        };
    }, [handle]);

    return useMemo(() => {
        const summarize = (offset) => {
            const series = [];
            for (let i = days - 1; i >= 0; i -= 1) {
                const date = new Date();
                date.setHours(12, 0, 0, 0);
                date.setDate(date.getDate() - i - offset);
                const key = dayKey(date);
                const row = state.raw[key] || {};
                series.push({ key, date, ...Object.fromEntries(EVENTS.map((event) => [event, Number(row[event]) || 0])) });
            }
            const totals = Object.fromEntries(EVENTS.map((event) => [event, series.reduce((sum, row) => sum + row[event], 0)]));
            return { series, totals };
        };

        const current = summarize(0);
        const previous = summarize(days);

        return {
            loading: state.loading,
            hasAny: Object.keys(state.raw).length > 0,
            series: current.series,
            totals: current.totals,
            previous: previous.totals
        };
    }, [state, days]);
};

export const conversionRate = (totals) => {
    const actions = (totals.booking_click || 0) + (totals.whatsapp_click || 0) + (totals.lead || 0) + (totals.channel_click || 0);
    return totals.view ? Math.round((actions / totals.view) * 1000) / 10 : 0;
};

export const Delta = ({ current, previous }) => {
    if (!previous && !current) return null;
    if (!previous) return <span className="std-delta std-delta--up">novo</span>;

    const change = Math.round(((current - previous) / previous) * 100);
    if (!change) return <span className="std-delta">igual ao período anterior</span>;

    return (
        <span className={`std-delta ${change > 0 ? "std-delta--up" : "std-delta--down"}`}>
            <Icon icon={change > 0 ? "solar:arrow-right-up-linear" : "solar:arrow-right-down-linear"} aria-hidden="true" />
            {Math.abs(change)}% vs. período anterior
        </span>
    );
};

/* Barras de uma série só, com tooltip por barra. Série
   única: o título nomeia, não precisa de legenda. */
export const BarChart = ({ series, metric = "view", height = 180, label }) => {
    const [hover, setHover] = useState(null);

    const max = Math.max(1, ...series.map((row) => row[metric]));
    const ticks = niceTicks(max);
    const top = ticks[ticks.length - 1];
    const barGap = series.length > 40 ? 1 : 2;

    return (
        <div className="std-chart" style={{ height }} role="img" aria-label={label}>
            <div className="std-chart__grid" aria-hidden="true">
                {[...ticks].reverse().map((tick) => (
                    <span key={tick} style={{ bottom: `${(tick / top) * 100}%` }}>
                        <em>{formatNumber(tick)}</em>
                    </span>
                ))}
            </div>
            <div className="std-chart__bars" style={{ gap: barGap }}>
                {series.map((row, index) => {
                    const value = row[metric];
                    return (
                        <div
                            key={row.key}
                            className={`std-chart__col ${hover === index ? "is-hover" : ""}`}
                            onMouseEnter={() => setHover(index)}
                            onMouseLeave={() => setHover(null)}
                            onFocus={() => setHover(index)}
                            onBlur={() => setHover(null)}
                            tabIndex={0}
                            aria-label={`${row.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}: ${value}`}
                        >
                            <span className="std-chart__bar" style={{ height: value ? `max(3px, ${(value / top) * 100}%)` : 0 }} />
                            {hover === index && (
                                <span className="std-chart__tip" style={index > series.length * 0.7 ? { right: 0 } : { left: 0 }}>
                                    <strong>{formatNumber(value)}</strong>
                                    {row.date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="std-chart__axis" aria-hidden="true">
                <span>{series[0]?.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                <span>{series[series.length - 1]?.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
            </div>
        </div>
    );
};

const niceTicks = (max) => {
    if (max <= 4) return [0, 2, 4];
    const step = Math.pow(10, Math.floor(Math.log10(max)));
    const unit = max / step > 5 ? step * 2 : max / step > 2 ? step : step / 2;
    const top = Math.ceil(max / unit) * unit;
    const ticks = [];
    for (let value = 0; value <= top + 0.0001; value += unit) ticks.push(Math.round(value));
    return ticks.length > 5 ? [0, Math.round(top / 2), top] : ticks;
};

/* ---------- AGENDAMENTOS ---------- */

export const useSchedules = (handle) => {
    const [state, setState] = useState({ loading: true, items: [], error: null });

    const load = React.useCallback(() => {
        if (!handle) return;
        setState((current) => ({ ...current, loading: true }));
        getSchedules(handle)
            .then((items) => {
                const now = Date.now();
                setState({
                    loading: false,
                    error: null,
                    items: items
                        .map((item) => ({
                            ...item,
                            date: parseScheduleDate(item.day, item.hour),
                            createdAt: item.timestamp ? new Date(item.timestamp).getTime() : null
                        }))
                        .map((item) => ({
                            ...item,
                            upcoming: !!item.date && item.date.getTime() >= now && !isCancelled(item.status) && item.status !== "completed"
                        }))
                });
            })
            .catch((error) => setState({ loading: false, items: [], error }));
    }, [handle]);

    useEffect(() => {
        load();
    }, [load]);

    return { ...state, reload: load };
};

/* ---------- CONTATOS ---------- */

export const useLeads = (handle) => {
    const [state, setState] = useState({ loading: true, leads: [] });

    useEffect(() => {
        if (!handle) return undefined;
        return watchLeads(handle, (leads) => setState({ loading: false, leads }));
    }, [handle]);

    return state;
};

/* ---------- CHECKLIST ---------- */

export const buildChecklist = ({ bundle, draftPage, publishedPage }) => {
    if (!bundle) return [];

    const items = [
        {
            id: "logo",
            title: "Adicionar o logotipo",
            hint: "Aparece no topo da página e nos resultados da Markfy.",
            done: !!bundle.logo,
            to: "/studio/empresa#logo"
        },
        {
            id: "description",
            title: "Descrever o negócio",
            hint: "Um parágrafo sobre o que vocês fazem e para quem.",
            done: (bundle.description || "").length >= 40,
            to: "/studio/empresa#descricao"
        },
        {
            id: "services",
            title: "Cadastrar serviços",
            hint: "Com preço e duração, eles viram a seção de agendamento.",
            done: bundle.products.length > 0,
            to: "/central-adm?tab=produtos",
            external: true
        },
        {
            id: "hours",
            title: "Definir horário de funcionamento",
            hint: "Mostrado na página e usado pela agenda.",
            done: !!bundle.businessHours && Object.values(bundle.businessHours).some((day) => day?.enabled),
            to: "/central-adm?tab=perfil&screen=settings-hours",
            external: true
        },
        {
            id: "contact",
            title: "Adicionar WhatsApp ou telefone",
            hint: "Para o botão de conversa funcionar.",
            done: !!bundle.whatsapp || !!bundle.phone,
            to: "/studio/empresa#contato"
        },
        {
            id: "photos",
            title: "Enviar fotos do espaço ou do trabalho",
            hint: "Galerias com fotos reais convertem mais visitas em agendamentos.",
            done: bundle.photos.length >= 3,
            to: "/central-adm?tab=perfil&screen=settings-branding",
            external: true
        },
        {
            id: "page",
            title: "Criar a página",
            hint: "Escolha um modelo; os dados acima entram sozinhos.",
            done: !!draftPage,
            to: "/studio/site"
        },
        {
            id: "seo",
            title: "Revisar título e descrição para buscadores",
            hint: "É o texto que aparece no Google e ao compartilhar o link.",
            done: !!draftPage?.seo?.title && (draftPage?.seo?.description || "").length >= 50,
            to: "/studio/configuracoes#seo"
        },
        {
            id: "publish",
            title: "Publicar a página",
            hint: "Seu link fica no ar e as métricas começam a contar.",
            done: !!publishedPage,
            to: draftPage ? "/studio/editor" : "/studio/site"
        }
    ];

    return items;
};
