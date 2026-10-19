import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@iconify/react";

import { useStudio } from "../StudioContext";
import { LEAD_STATUS, deleteLead, saveDraft, updateLead } from "../data/studioApi";
import { createSection } from "../site/schema";
import { whatsappLink } from "../data/companyBundle";
import { toE164BR } from "../../utils/phoneBR";
import { Badge, Button, ConfirmDialog, EmptyState, Segmented, Sheet, Skeleton, useToast } from "../../design-system/components";
import { PageHead, formatDateTime, formatRelative, useLeads } from "./shared";

/* =========================================================
   CONTATOS

   Mensagens enviadas pelo formulário da página publicada
   (studioLeads/{handle}). Cada uma tem um estado de
   atendimento que a equipe vai mudando.
========================================================= */

const FILTERS = [
    { value: "all", label: "Todos" },
    { value: "new", label: "Novos" },
    { value: "contacted", label: "Em atendimento" },
    { value: "done", label: "Concluídos" },
    { value: "archived", label: "Arquivados" }
];

const toCsv = (leads) => {
    const head = ["Recebido em", "Nome", "Telefone", "E-mail", "Mensagem", "Estado"];
    const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const rows = leads.map((lead) => [
        formatDateTime(lead.createdAt),
        lead.name,
        lead.phone,
        lead.email,
        lead.message,
        LEAD_STATUS[lead.status]?.label || lead.status
    ]);
    return [head, ...rows].map((row) => row.map(escape).join(";")).join("\n");
};

const Contacts = () => {
    const navigate = useNavigate();
    const notify = useToast();
    const [searchParams, setSearchParams] = useSearchParams();

    const { handle, user, bundle, draftPage, canEdit } = useStudio();
    const { leads, loading } = useLeads(handle);

    const [filter, setFilter] = useState("all");
    const [term, setTerm] = useState("");
    const [openId, setOpenId] = useState(searchParams.get("lead"));
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        const id = searchParams.get("lead");
        if (id) setOpenId(id);
    }, [searchParams]);

    const counts = useMemo(
        () => Object.fromEntries(FILTERS.map((item) => [item.value, item.value === "all" ? leads.length : leads.filter((lead) => lead.status === item.value).length])),
        [leads]
    );

    const list = useMemo(() => {
        const query = term.trim().toLowerCase();
        return leads
            .filter((lead) => filter === "all" || lead.status === filter)
            .filter((lead) => !query || [lead.name, lead.phone, lead.email, lead.message].some((value) => String(value || "").toLowerCase().includes(query)));
    }, [leads, filter, term]);

    const lead = leads.find((item) => item.id === openId) || null;

    const close = () => {
        setOpenId(null);
        if (searchParams.get("lead")) {
            searchParams.delete("lead");
            setSearchParams(searchParams, { replace: true });
        }
    };

    const setStatus = async (status, silent) => {
        if (!lead || lead.status === status) return;
        try {
            await updateLead(handle, lead.id, { status });
            if (!silent) notify("success", "Estado atualizado", LEAD_STATUS[status].label);
        } catch {
            notify("error", "Não foi possível atualizar", "Tente de novo.");
        }
    };

    const remove = async () => {
        setBusy(true);
        try {
            await deleteLead(handle, lead.id);
            notify("success", "Contato excluído", "");
            setConfirmDelete(false);
            close();
        } catch {
            notify("error", "Não foi possível excluir", "Tente de novo.");
        } finally {
            setBusy(false);
        }
    };

    const exportCsv = () => {
        const blob = new Blob([`﻿${toCsv(list)}`], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `contatos-${handle}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    const hasForm = draftPage?.sections?.some((section) => section.type === "form" && !section.hidden);

    const addForm = async () => {
        if (!draftPage) return navigate("/studio/site");
        try {
            await saveDraft(handle, { ...draftPage, sections: [...draftPage.sections, createSection("form", bundle)] }, user?.uid);
            notify("success", "Formulário adicionado", "Ele entrou no fim da página. Publique para ir ao ar.");
        } catch {
            notify("error", "Não foi possível adicionar", "Tente de novo.");
        }
    };

    const phone = lead ? toE164BR(lead.phone) : null;

    return (
        <div className="std-page">
            <PageHead
                title="Contatos"
                description="Mensagens enviadas pelo formulário da sua página. Acompanhe cada uma até o atendimento terminar."
                actions={leads.length > 0 && (
                    <Button variant="outline" icon="solar:download-minimalistic-linear" onClick={exportCsv}>
                        Exportar CSV
                    </Button>
                )}
            />

            {!hasForm && (
                <section className="std-panel std-inline" aria-label="Formulário na página">
                    <span className="std-row__icon"><Icon icon="solar:letter-linear" /></span>
                    <div className="std-inline__text">
                        <strong>Sua página ainda não tem formulário</strong>
                        <span>Sem ele, visitantes só conseguem falar com você por WhatsApp ou telefone.</span>
                    </div>
                    {canEdit && <Button variant="primary" size="sm" onClick={addForm}>Adicionar formulário</Button>}
                </section>
            )}

            <section className="std-panel" aria-label="Lista de contatos">
                <div className="std-toolbar">
                    <div className="std-filter" role="group" aria-label="Filtrar por estado">
                        {FILTERS.map((item) => (
                            <button
                                type="button"
                                key={item.value}
                                className="mk-chip"
                                aria-pressed={filter === item.value}
                                onClick={() => setFilter(item.value)}
                            >
                                {item.label}
                                <span className="std-filter__count">{counts[item.value]}</span>
                            </button>
                        ))}
                    </div>
                    <span className="mk-input-group std-search">
                        <Icon icon="solar:magnifer-linear" aria-hidden="true" />
                        <input className="mk-input" type="search" placeholder="Buscar nome, telefone ou mensagem" value={term} onChange={(event) => setTerm(event.target.value)} aria-label="Buscar contatos" />
                    </span>
                </div>

                {loading ? (
                    <div className="std-grid">{[0, 1, 2].map((key) => <Skeleton key={key} height={60} />)}</div>
                ) : list.length ? (
                    <ul className="std-list">
                        <AnimatePresence initial={false}>
                            {list.map((item) => (
                                <motion.li
                                    key={item.id}
                                    layout
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <button type="button" className="std-row" onClick={() => setOpenId(item.id)}>
                                        <span className={`std-row__icon ${item.status === "new" ? "is-new" : ""}`} aria-hidden="true">
                                            {(item.name || "?").charAt(0).toUpperCase()}
                                        </span>
                                        <span className="std-row__body">
                                            <span className="std-row__title">{item.name}</span>
                                            <span className="std-row__meta">{item.message || item.phone || item.email}</span>
                                        </span>
                                        <span className="std-row__aside">
                                            <Badge tone={LEAD_STATUS[item.status]?.tone}>{LEAD_STATUS[item.status]?.label}</Badge>
                                            <span>{formatRelative(item.createdAt)}</span>
                                        </span>
                                    </button>
                                </motion.li>
                            ))}
                        </AnimatePresence>
                    </ul>
                ) : (
                    <EmptyState icon="solar:inbox-linear" title={leads.length ? "Nenhum contato neste filtro" : "Nenhum contato ainda"}>
                        {leads.length
                            ? "Troque o filtro ou a busca para ver os outros."
                            : "Quando alguém enviar o formulário da sua página publicada, a mensagem aparece aqui na hora."}
                    </EmptyState>
                )}
            </section>

            <Sheet
                open={!!lead}
                onClose={close}
                title={lead?.name}
                description={lead ? `Recebido ${formatRelative(lead.createdAt)}, em ${formatDateTime(lead.createdAt)}` : ""}
                footer={lead && canEdit && (
                    <Button variant="danger" icon="solar:trash-bin-minimalistic-linear" onClick={() => setConfirmDelete(true)}>
                        Excluir
                    </Button>
                )}
            >
                {lead && (
                    <div className="std-lead">
                        <div className="std-lead__actions">
                            {phone && (
                                <Button
                                    variant="primary"
                                    icon="ic:baseline-whatsapp"
                                    as="a"
                                    href={whatsappLink(phone, `Olá, ${lead.name.split(" ")[0]}! Recebemos sua mensagem pela página da ${bundle?.name}.`)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={() => lead.status === "new" && canEdit && setStatus("contacted", true)}
                                >
                                    Responder no WhatsApp
                                </Button>
                            )}
                            {lead.phone && (
                                <Button variant="outline" icon="solar:phone-linear" as="a" href={`tel:${lead.phone.replace(/[^\d+]/g, "")}`}>
                                    Ligar
                                </Button>
                            )}
                            {lead.email && (
                                <Button variant="outline" icon="solar:letter-linear" as="a" href={`mailto:${lead.email}`}>
                                    E-mail
                                </Button>
                            )}
                        </div>

                        <dl className="std-facts">
                            {lead.phone && <div><dt>Telefone</dt><dd>{lead.phone}</dd></div>}
                            {lead.email && <div><dt>E-mail</dt><dd>{lead.email}</dd></div>}
                        </dl>

                        <div className="std-lead__msg">
                            <span>Mensagem</span>
                            <p>{lead.message || "Sem mensagem."}</p>
                        </div>

                        <div className="mk-field">
                            <span className="mk-field__label">Estado do atendimento</span>
                            <Segmented
                                label="Estado do atendimento"
                                value={lead.status}
                                onChange={(status) => canEdit && setStatus(status)}
                                options={Object.entries(LEAD_STATUS).map(([value, item]) => ({ value, label: item.label }))}
                            />
                            {phone && lead.status === "new" && (
                                <p className="mk-field__hint">Ao responder pelo WhatsApp, o contato passa para “Em atendimento”.</p>
                            )}
                        </div>
                    </div>
                )}
            </Sheet>

            <ConfirmDialog
                open={confirmDelete}
                title="Excluir este contato?"
                message="A mensagem e os dados de contato serão apagados de vez. Isso não pode ser desfeito."
                confirmLabel="Excluir"
                loading={busy}
                onConfirm={remove}
                onClose={() => setConfirmDelete(false)}
            />
        </div>
    );
};

export default Contacts;
