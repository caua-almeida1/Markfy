import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import { useStudio, STATUS_META } from "../StudioContext";
import { Badge, Button, Skeleton, copyText, useToast } from "../../design-system/components";
import { getScheduleStatus } from "../../utils/scheduleStatus";
import { LEAD_STATUS } from "../data/studioApi";

import SitePreviewThumb from "../site/SitePreviewThumb";
import {
    PageHead,
    buildChecklist,
    formatNumber,
    formatRelative,
    useAnalytics,
    useLeads,
    useSchedules
} from "./shared";

/* =========================================================
   VISÃO GERAL

   Responde, nesta ordem: minha página está no ar? alguém
   está vendo? o que falta configurar? o que chegou de novo?
========================================================= */

const Overview = () => {
    const navigate = useNavigate();
    const notify = useToast();

    const { company, handle, bundle, bundleLoading, draftPage, publishedPage, status, publicUrl, user, canEdit, draftLoading } = useStudio();

    const analytics = useAnalytics(handle, 7);
    const schedules = useSchedules(handle);
    const { leads, loading: leadsLoading } = useLeads(handle);

    const checklist = useMemo(() => buildChecklist({ bundle, draftPage, publishedPage }), [bundle, draftPage, publishedPage]);
    const done = checklist.filter((item) => item.done).length;
    const pending = checklist.filter((item) => !item.done);

    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentBookings = schedules.items.filter((item) => item.createdAt && item.createdAt >= weekAgo);
    const fromSite = recentBookings.filter((item) => item.source === "studio").length;
    const upcoming = schedules.items.filter((item) => item.upcoming).sort((a, b) => a.date - b.date).slice(0, 5);
    const newLeads = leads.filter((lead) => lead.status === "new");

    const meta = STATUS_META[status];
    const firstName = (user?.displayName || "").split(" ")[0];

    const go = (item) => navigate(item.to);

    const copyLink = async () => {
        const ok = await copyText(publicUrl);
        notify(ok ? "success" : "error", ok ? "Link copiado" : "Não foi possível copiar", ok ? publicUrl : "Copie o link manualmente.");
    };

    const headline = {
        none: "Crie a página da sua empresa",
        draft: "Sua página está quase pronta",
        published: "Sua página está no ar",
        changes: "Você tem alterações para publicar"
    }[status];

    const subline = {
        none: "Escolha um modelo e o Studio monta a primeira versão com os dados que você já tem na Markfy.",
        draft: "Revise o conteúdo e publique quando estiver tudo certo. Antes disso, ninguém vê o rascunho.",
        published: "Compartilhe o link no Instagram, no WhatsApp e no Google Meu Negócio.",
        changes: "Quem visita ainda vê a versão anterior. Publique para atualizar."
    }[status];

    return (
        <div className="std-page">
            <PageHead
                title={firstName ? `Olá, ${firstName}` : "Visão geral"}
                description={`Como está a presença digital da ${company?.name || "sua empresa"} hoje.`}
            />

            <section className="std-hero" aria-labelledby="std-hero-title">
                <div className="std-hero__text">
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                    <h2 id="std-hero-title">{headline}</h2>
                    <p>{subline}</p>

                    {(status === "published" || status === "changes") && (
                        <div className="std-link">
                            <Icon icon="solar:global-linear" aria-hidden="true" />
                            <a href={publicUrl} target="_blank" rel="noopener noreferrer">{publicUrl.replace(/^https?:\/\//, "")}</a>
                            <Button variant="ghost" size="sm" icon="solar:copy-linear" aria-label="Copiar link" onClick={copyLink} />
                        </div>
                    )}

                    <div className="std-hero__actions">
                        {status === "none" ? (
                            <Button variant="primary" icon="solar:magic-stick-3-linear" onClick={() => navigate("/studio/site")} disabled={!canEdit || draftLoading}>
                                Escolher um modelo
                            </Button>
                        ) : (
                            <Button variant="primary" icon="solar:pen-2-linear" onClick={() => navigate("/studio/editor")}>
                                {canEdit ? "Editar página" : "Ver página"}
                            </Button>
                        )}
                        {(status === "published" || status === "changes") && (
                            <Button variant="outline" icon="solar:arrow-right-up-linear" as="a" href={publicUrl} target="_blank" rel="noopener noreferrer">
                                Abrir página
                            </Button>
                        )}
                    </div>
                    {!canEdit && (
                        <p className="std-hint">Seu acesso é de profissional: você vê tudo, mas só o responsável edita e publica.</p>
                    )}
                </div>

                <div className="std-hero__preview" aria-hidden="true">
                    {draftPage || publishedPage ? (
                        <SitePreviewThumb page={draftPage || publishedPage} bundle={bundle} />
                    ) : (
                        <div className="std-hero__blank">
                            <span /><span /><span />
                        </div>
                    )}
                </div>
            </section>

            <section aria-labelledby="std-week-title" className="std-grid">
                <div className="std-panel__head">
                    <div>
                        <h2 id="std-week-title" className="std-section-title">Últimos 7 dias</h2>
                    </div>
                    <Button variant="ghost" size="sm" iconRight="solar:arrow-right-linear" onClick={() => navigate("/studio/analytics")}>
                        Ver analytics
                    </Button>
                </div>

                <div className="std-stats">
                    {[
                        { label: "Visitas na página", icon: "solar:eye-linear", value: analytics.totals.view, loading: analytics.loading },
                        { label: "Cliques em agendar", icon: "solar:calendar-linear", value: analytics.totals.booking_click, loading: analytics.loading },
                        { label: "Contatos recebidos", icon: "solar:inbox-linear", value: analytics.totals.lead, loading: analytics.loading },
                        {
                            label: "Agendamentos feitos",
                            icon: "solar:check-circle-linear",
                            value: recentBookings.length,
                            loading: schedules.loading,
                            hint: schedules.loading ? "" : `${fromSite} pela página`
                        }
                    ].map((stat) => (
                        <div key={stat.label} className="std-stat">
                            <span className="std-stat__label">
                                <Icon icon={stat.icon} aria-hidden="true" />
                                {stat.label}
                            </span>
                            {stat.loading ? (
                                <Skeleton width={60} height={28} />
                            ) : (
                                <span className="std-stat__value">{formatNumber(stat.value)}</span>
                            )}
                            {stat.hint && <span className="std-stat__hint">{stat.hint}</span>}
                        </div>
                    ))}
                </div>

                {!publishedPage && !analytics.loading && (
                    <p className="std-hint">
                        As métricas começam a contar quando a página é publicada. Os agendamentos são os da sua agenda na Markfy Bookings.
                    </p>
                )}
            </section>

            <div className="std-grid std-grid--main">
                <section className="std-panel" aria-labelledby="std-check-title">
                    <div className="std-panel__head">
                        <div>
                            <h2 id="std-check-title">Configuração</h2>
                            <p>
                                {pending.length
                                    ? `${pending.length} ${pending.length === 1 ? "passo pendente" : "passos pendentes"}. Cada um leva direto ao lugar certo.`
                                    : "Tudo configurado. Bom trabalho."}
                            </p>
                        </div>
                    </div>

                    <div className="std-progress" aria-label={`${done} de ${checklist.length} concluídos`}>
                        <span className="std-progress__bar">
                            <span style={{ transform: `scaleX(${checklist.length ? done / checklist.length : 0})` }} />
                        </span>
                        <strong>{done}/{checklist.length}</strong>
                    </div>

                    {bundleLoading ? (
                        <div className="std-grid">{[0, 1, 2, 3].map((key) => <Skeleton key={key} height={44} />)}</div>
                    ) : (
                        <div>
                            {[...pending, ...checklist.filter((item) => item.done)].map((item) => (
                                <button
                                    type="button"
                                    key={item.id}
                                    className={`std-check ${item.done ? "is-done" : ""}`}
                                    onClick={() => go(item)}
                                >
                                    <span className="std-check__mark" aria-hidden="true">
                                        <Icon icon="solar:check-read-linear" />
                                    </span>
                                    <span className="std-check__body">
                                        <span className="std-check__title">{item.title}</span>
                                        {!item.done && <span className="std-check__hint">{item.hint}</span>}
                                    </span>
                                    <span className="mk-visually-hidden">{item.done ? "(concluído)" : "(pendente)"}</span>
                                    <Icon icon={item.external ? "solar:arrow-right-up-linear" : "solar:alt-arrow-right-linear"} aria-hidden="true" />
                                </button>
                            ))}
                        </div>
                    )}
                </section>

                <div className="std-grid">
                    <section className="std-panel" aria-labelledby="std-next-title">
                        <div className="std-panel__head">
                            <h2 id="std-next-title">Próximos agendamentos</h2>
                            <Button variant="ghost" size="sm" onClick={() => navigate("/studio/agendamentos")}>Ver todos</Button>
                        </div>
                        {schedules.loading ? (
                            <Skeleton height={120} />
                        ) : upcoming.length ? (
                            <ul className="std-list">
                                {upcoming.map((item) => {
                                    const st = getScheduleStatus(item.status);
                                    return (
                                        <li key={item.id}>
                                            <div className="std-row">
                                                <span className="std-row__body">
                                                    <span className="std-row__title">{item.userName || "Cliente"}</span>
                                                    <span className="std-row__meta">{item.productName}{item.professionalName ? `, com ${item.professionalName}` : ""}</span>
                                                </span>
                                                <span className="std-row__aside">
                                                    <strong>{item.hour}</strong>
                                                    <span>{item.date?.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
                                                </span>
                                                <Badge tone={st.tone} className="std-only-wide">{st.label}</Badge>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        ) : (
                            <p className="std-hint">Nenhum agendamento marcado daqui para frente.</p>
                        )}
                    </section>

                    <section className="std-panel" aria-labelledby="std-leads-title">
                        <div className="std-panel__head">
                            <h2 id="std-leads-title">
                                Contatos {newLeads.length > 0 && <Badge tone="info">{newLeads.length} novos</Badge>}
                            </h2>
                            <Button variant="ghost" size="sm" onClick={() => navigate("/studio/contatos")}>Abrir</Button>
                        </div>
                        {leadsLoading ? (
                            <Skeleton height={80} />
                        ) : leads.length ? (
                            <ul className="std-list">
                                {leads.slice(0, 3).map((lead) => (
                                    <li key={lead.id}>
                                        <button type="button" className="std-row" onClick={() => navigate(`/studio/contatos?lead=${lead.id}`)}>
                                            <span className="std-row__icon"><Icon icon="solar:user-linear" /></span>
                                            <span className="std-row__body">
                                                <span className="std-row__title">{lead.name}</span>
                                                <span className="std-row__meta">{lead.message || lead.phone || lead.email}</span>
                                            </span>
                                            <span className="std-row__aside">
                                                <Badge tone={LEAD_STATUS[lead.status]?.tone}>{LEAD_STATUS[lead.status]?.label}</Badge>
                                                <span>{formatRelative(lead.createdAt)}</span>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="std-hint">
                                Quando alguém enviar o formulário da sua página, o contato aparece aqui.
                            </p>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};

export default Overview;
