import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import { useStudio } from "../StudioContext";
import { useLicense } from "../../plans/LicenseContext";
import { ANALYTICS_EVENTS } from "../data/studioApi";
import { Button, EmptyState, Segmented, Skeleton } from "../../design-system/components";
import { BarChart, Delta, PageHead, conversionRate, formatNumber, useAnalytics, useSchedules } from "./shared";

/* =========================================================
   MARKFY ANALYTICS

   Só o que a página publicada mede de verdade: visitas
   (uma por sessão do navegador), cliques em agendar, no
   WhatsApp e em redes/links, e contatos enviados. Os
   agendamentos vêm da agenda real, marcados com a origem
   "studio" quando começaram na página.
========================================================= */

const KPIS = [
    { key: "view", icon: "solar:eye-linear", explain: "Pessoas que abriram a página. Cada visita conta uma vez por sessão do navegador." },
    { key: "booking_click", icon: "solar:calendar-linear", explain: "Toques em qualquer botão que leva ao agendamento." },
    { key: "whatsapp_click", icon: "ic:baseline-whatsapp", explain: "Toques nos botões e links de WhatsApp da página." },
    { key: "lead", icon: "solar:inbox-linear", explain: "Mensagens enviadas pelo formulário." }
];

const Analytics = () => {
    const navigate = useNavigate();
    const { handle, publishedPage, canEdit } = useStudio();
    const license = useLicense();

    const [days, setDays] = useState(30);
    const [metric, setMetric] = useState("view");
    const [asTable, setAsTable] = useState(false);

    const data = useAnalytics(handle, days);
    const schedules = useSchedules(handle);

    const bookingsFromSite = useMemo(() => {
        const since = Date.now() - days * 24 * 60 * 60 * 1000;
        const inRange = schedules.items.filter((item) => item.createdAt && item.createdAt >= since);
        return { total: inRange.length, site: inRange.filter((item) => item.source === "studio").length };
    }, [schedules.items, days]);

    const rate = conversionRate(data.totals);
    const prevRate = conversionRate(data.previous);

    /* Analytics é recurso de plano: sem ele a tela só explica. */
    if (!license.can("studioAnalytics")) {
        return (
            <div className="std-page">
                <PageHead title="Analytics" description="Visitas, cliques e contatos da sua página." />
                <section className="std-panel">
                    <EmptyState
                        icon="solar:lock-keyhole-minimalistic-linear"
                        title="Analytics não está no plano atual"
                        action={canEdit ? <Button variant="primary" onClick={() => navigate("/planos")}>Ver planos</Button> : null}
                    >
                        {canEdit
                            ? "Os planos Pro e Premium incluem as métricas da sua página publicada. Só o administrador principal troca o plano."
                            : "Peça ao administrador principal para mudar de plano e liberar as métricas."}
                    </EmptyState>
                </section>
            </div>
        );
    }

    if (!publishedPage && !data.loading && !data.hasAny) {
        return (
            <div className="std-page">
                <PageHead title="Analytics" description="Visitas, cliques e contatos da sua página." />
                <section className="std-panel">
                    <EmptyState
                        icon="solar:chart-2-linear"
                        title="As métricas começam quando a página vai ao ar"
                        action={<Button variant="primary" onClick={() => navigate("/studio/site")}>Ir para Meu site</Button>}
                    >
                        Publique sua página e compartilhe o link. A partir da primeira visita, os números aparecem aqui.
                    </EmptyState>
                </section>
            </div>
        );
    }

    return (
        <div className="std-page">
            <PageHead
                title="Analytics"
                description="O que acontece na sua página publicada, contado de verdade."
                actions={(
                    <Segmented
                        label="Período"
                        value={days}
                        onChange={setDays}
                        options={[
                            { value: 7, label: "7 dias" },
                            { value: 30, label: "30 dias" },
                            { value: 90, label: "90 dias" }
                        ]}
                    />
                )}
            />

            <div className="std-kpis">
                {KPIS.map((kpi) => (
                    <button
                        type="button"
                        key={kpi.key}
                        className={`std-kpi ${metric === kpi.key ? "is-active" : ""}`}
                        onClick={() => setMetric(kpi.key)}
                        aria-pressed={metric === kpi.key}
                    >
                        <span className="std-stat__label"><Icon icon={kpi.icon} aria-hidden="true" />{ANALYTICS_EVENTS[kpi.key]}</span>
                        {data.loading ? <Skeleton width={60} height={30} /> : <span className="std-stat__value">{formatNumber(data.totals[kpi.key])}</span>}
                        {!data.loading && <Delta current={data.totals[kpi.key]} previous={data.previous[kpi.key]} />}
                        <span className="std-kpi__explain">{kpi.explain}</span>
                    </button>
                ))}
            </div>

            <section className="std-panel" aria-labelledby="std-chart-title">
                <div className="std-panel__head">
                    <div>
                        <h2 id="std-chart-title">{ANALYTICS_EVENTS[metric]} por dia</h2>
                        <p>Últimos {days} dias. Passe o mouse ou o dedo nas barras para ver o dia.</p>
                    </div>
                    <Button variant="ghost" size="sm" icon={asTable ? "solar:chart-2-linear" : "solar:list-linear"} onClick={() => setAsTable((value) => !value)}>
                        {asTable ? "Ver gráfico" : "Ver tabela"}
                    </Button>
                </div>

                {data.loading ? (
                    <Skeleton height={200} />
                ) : asTable ? (
                    <div className="std-table-wrap">
                        <table className="std-table">
                            <thead>
                                <tr>
                                    <th scope="col">Dia</th>
                                    {KPIS.map((kpi) => <th scope="col" key={kpi.key}>{ANALYTICS_EVENTS[kpi.key]}</th>)}
                                </tr>
                            </thead>
                            <tbody>
                                {[...data.series].reverse().map((row) => (
                                    <tr key={row.key}>
                                        <th scope="row">{row.date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })}</th>
                                        {KPIS.map((kpi) => <td key={kpi.key}>{formatNumber(row[kpi.key])}</td>)}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <BarChart series={data.series} metric={metric} height={220} label={`${ANALYTICS_EVENTS[metric]} por dia nos últimos ${days} dias`} />
                )}
            </section>

            <div className="std-grid std-grid--2">
                <section className="std-panel" aria-labelledby="std-conv-title">
                    <div className="std-panel__head">
                        <h2 id="std-conv-title">Taxa de ação</h2>
                    </div>
                    <span className="std-big">{data.loading ? "–" : `${rate.toLocaleString("pt-BR")}%`}</span>
                    {!data.loading && <Delta current={rate} previous={prevRate} />}
                    <p className="std-hint">
                        De cada 100 visitas, quantas tocaram em agendar, chamaram no WhatsApp, abriram um app de pedido ou loja, ou enviaram o formulário. É o melhor sinal de que a página está convencendo.
                    </p>
                </section>

                <section className="std-panel" aria-labelledby="std-bsite-title">
                    <div className="std-panel__head">
                        <h2 id="std-bsite-title">Agendamentos vindos da página</h2>
                    </div>
                    <span className="std-big">
                        {schedules.loading ? "–" : formatNumber(bookingsFromSite.site)}
                        <small> de {formatNumber(bookingsFromSite.total)} no período</small>
                    </span>
                    <p className="std-hint">
                        Conta os agendamentos concluídos na Bookings por quem chegou tocando em “Agendar” na sua página.
                    </p>
                </section>
            </div>

            <section className="std-panel std-explain" aria-labelledby="std-how-title">
                <h2 id="std-how-title">Como medimos</h2>
                <ul>
                    <li>A contagem é feita só na página publicada. Prévias e o editor não entram nos números.</li>
                    <li>Guardamos apenas totais por dia. Nenhum dado pessoal do visitante é registrado.</li>
                    <li>Cliques em redes e links externos: {formatNumber(data.totals.social_click)} no período.</li>
                    <li>Cliques em iFood, 99Food, lojas, anúncios e rotas (Maps, Waze, Uber): {formatNumber(data.totals.channel_click)} no período.</li>
                </ul>
            </section>
        </div>
    );
};

export default Analytics;
