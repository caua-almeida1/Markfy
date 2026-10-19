import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import { useStudio } from "../StudioContext";
import { saveDraft } from "../data/studioApi";
import { createSection } from "../site/schema";
import { getScheduleStatus, isCancelled } from "../../utils/scheduleStatus";
import { Badge, Button, EmptyState, Segmented, Skeleton, useToast } from "../../design-system/components";
import { PageHead, formatNumber, useSchedules } from "./shared";

/* =========================================================
   AGENDAMENTOS

   Leitura da agenda real da Markfy Bookings
   (companys/{handle}/schedules). O Studio não tem agenda
   própria: confirmar, remarcar e cancelar continuam no
   painel da Bookings, que já tem as regras de prazo,
   profissional e pagamento.
========================================================= */

const DAY = 24 * 60 * 60 * 1000;

const Bookings = () => {
    const navigate = useNavigate();
    const notify = useToast();
    const { handle, user, draftPage, canEdit, bundle } = useStudio();
    const { items, loading, reload } = useSchedules(handle);

    const [view, setView] = useState("upcoming");
    const [adding, setAdding] = useState(false);

    const now = Date.now();
    const todayKey = new Date().toDateString();

    const stats = useMemo(() => {
        const last30 = items.filter((item) => item.createdAt && item.createdAt >= now - 30 * DAY);
        return {
            upcoming: items.filter((item) => item.upcoming).length,
            today: items.filter((item) => item.date && item.date.toDateString() === todayKey && !isCancelled(item.status)).length,
            last30: last30.length,
            fromSite: last30.filter((item) => item.source === "studio").length
        };
    }, [items, now, todayKey]);

    const list = useMemo(() => {
        if (view === "upcoming") return items.filter((item) => item.upcoming).sort((a, b) => a.date - b.date);
        if (view === "cancelled") return items.filter((item) => isCancelled(item.status)).sort((a, b) => (b.date || 0) - (a.date || 0));
        return items
            .filter((item) => !item.upcoming && !isCancelled(item.status))
            .sort((a, b) => (b.date || 0) - (a.date || 0));
    }, [items, view]);

    const hasBookingSection = draftPage?.sections?.some((section) => section.type === "booking" && !section.hidden);

    const addSection = async () => {
        if (!draftPage) return navigate("/studio/site");

        setAdding(true);

        try {
            const sections = [...draftPage.sections];
            const heroIndex = sections.findIndex((section) => section.type === "hero");
            sections.splice(heroIndex + 1, 0, createSection("booking", bundle));
            await saveDraft(handle, { ...draftPage, sections }, user?.uid);
            notify("success", "Seção de agendamento adicionada", "Ela entrou logo abaixo do banner. Publique para ir ao ar.");
        } catch {
            notify("error", "Não foi possível adicionar", "Tente de novo em instantes.");
        } finally {
            setAdding(false);
        }
    };

    return (
        <div className="std-page">
            <PageHead
                title="Agendamentos"
                description="Os horários marcados na sua agenda da Markfy Bookings, inclusive os que vieram da sua página."
                actions={(
                    <>
                        <Button variant="ghost" icon="solar:refresh-linear" onClick={reload} aria-label="Atualizar lista" />
                        <Button variant="primary" iconRight="solar:arrow-right-up-linear" onClick={() => navigate("/central-adm?tab=horarios")}>
                            Gerenciar agenda
                        </Button>
                    </>
                )}
            />

            <div className="std-stats">
                {[
                    { label: "Próximos", value: stats.upcoming, icon: "solar:calendar-linear" },
                    { label: "Hoje", value: stats.today, icon: "solar:sun-2-linear" },
                    { label: "Criados em 30 dias", value: stats.last30, icon: "solar:graph-up-linear" },
                    { label: "Pela sua página (30 dias)", value: stats.fromSite, icon: "solar:window-frame-linear" }
                ].map((stat) => (
                    <div key={stat.label} className="std-stat">
                        <span className="std-stat__label"><Icon icon={stat.icon} aria-hidden="true" />{stat.label}</span>
                        {loading ? <Skeleton width={50} height={28} /> : <span className="std-stat__value">{formatNumber(stat.value)}</span>}
                    </div>
                ))}
            </div>

            <section className="std-panel std-inline" aria-label="Agendamento na página">
                <span className="std-row__icon"><Icon icon="solar:calendar-add-linear" /></span>
                <div className="std-inline__text">
                    <strong>{hasBookingSection ? "Sua página recebe agendamentos" : "Receba agendamentos pela sua página"}</strong>
                    <span>
                        {hasBookingSection
                            ? "A seção de agendamento mostra seus serviços e leva direto para escolher o horário na Bookings."
                            : "Adicione a seção de agendamento: seus serviços com botão de agendar e o horário de funcionamento."}
                    </span>
                </div>
                {hasBookingSection ? (
                    <Button variant="outline" size="sm" onClick={() => navigate("/studio/editor")}>Ver no editor</Button>
                ) : (
                    canEdit && (
                        <Button variant="primary" size="sm" loading={adding} onClick={addSection}>
                            {draftPage ? "Adicionar à página" : "Criar página"}
                        </Button>
                    )
                )}
            </section>

            <section className="std-panel" aria-labelledby="std-bk-title">
                <div className="std-panel__head">
                    <h2 id="std-bk-title">Lista</h2>
                    <Segmented
                        label="Filtrar agendamentos"
                        value={view}
                        onChange={setView}
                        options={[
                            { value: "upcoming", label: "Próximos" },
                            { value: "past", label: "Anteriores" },
                            { value: "cancelled", label: "Cancelados" }
                        ]}
                    />
                </div>

                {loading ? (
                    <div className="std-grid">{[0, 1, 2].map((key) => <Skeleton key={key} height={56} />)}</div>
                ) : list.length ? (
                    <ul className="std-list">
                        {list.slice(0, 60).map((item) => {
                            const st = getScheduleStatus(item.status);
                            return (
                                <li key={item.id}>
                                    <div className="std-row">
                                        <span className="std-row__icon" aria-hidden="true">
                                            {(item.userName || "C").charAt(0).toUpperCase()}
                                        </span>
                                        <span className="std-row__body">
                                            <span className="std-row__title">{item.userName || "Cliente"}</span>
                                            <span className="std-row__meta">
                                                {item.productName}
                                                {item.professionalName ? `, com ${item.professionalName}` : ""}
                                                {item.productPrice ? `, ${item.productPrice}` : ""}
                                            </span>
                                        </span>
                                        <span className="std-row__badges">
                                            {item.source === "studio" && <Badge tone="info" plain>Pela página</Badge>}
                                            <Badge tone={st.tone}>{st.label}</Badge>
                                        </span>
                                        <span className="std-row__aside">
                                            <strong>{item.hour}</strong>
                                            <span>{item.date ? item.date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }) : item.day}</span>
                                        </span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <EmptyState icon="solar:calendar-linear" title={view === "upcoming" ? "Nenhum horário marcado" : "Nada por aqui"}>
                        {view === "upcoming"
                            ? "Quando um cliente agendar pela Bookings ou pela sua página, o horário aparece aqui."
                            : "Não há agendamentos nesta lista."}
                    </EmptyState>
                )}
                {list.length > 60 && <p className="std-hint">Mostrando os 60 primeiros. A lista completa está no painel da Bookings.</p>}
            </section>
        </div>
    );
};

export default Bookings;
