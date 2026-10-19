import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import { useAuth } from "../../../contexts/authContext";
import { useCompanyLogos } from "../../../firebase/companyLogo";
import { getScheduleStatus } from "../../../utils/scheduleStatus";

import { Badge, Button, EmptyState, Segmented, Skeleton } from "../../../design-system/components";
import { useMyReservations } from "./useMyReservations";

import "./discover.css";

/* =========================================================
   RESERVAS EM TODAS AS EMPRESAS

   Leitura agregada. Cancelar ou reagendar continua na aba
   Reservas da própria empresa, que já tem as regras de
   prazo e assinatura — cada item leva para lá.
========================================================= */

const DiscoverReservations = ({ onOpenTab }) => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { reservations, loading, reload } = useMyReservations();

    const [view, setView] = useState("upcoming");

    const companies = useMemo(
        () => [...new Set(reservations.map((item) => item.handle))].map((handle) => ({ handle })),
        [reservations]
    );

    const logos = useCompanyLogos(companies);

    const list = reservations.filter((item) => (view === "upcoming" ? item.upcoming : !item.upcoming));
    const ordered = view === "upcoming" ? list : [...list].reverse();

    return (
        <div className="mk-root dsc">
            <div className="dsc-layout dsc-layout--single">
                <main className="dsc-main">
                    <section className="dsc-hello">
                        <h1 className="mk-title mk-title--lg">Reservas</h1>
                        <p className="mk-lead">
                            Tudo o que você marcou em empresas da Markfy, num lugar só.
                            {!currentUser && " Sem conta, mostramos as reservas feitas neste aparelho."}
                        </p>
                    </section>

                    <div className="dsc-res-toolbar">
                        <Segmented
                            label="Período"
                            value={view}
                            onChange={setView}
                            options={[
                                { value: "upcoming", label: "Próximas" },
                                { value: "past", label: "Anteriores" }
                            ]}
                        />
                        <Button variant="ghost" size="sm" icon="solar:refresh-linear" onClick={reload} aria-label="Atualizar" />
                    </div>

                    {loading ? (
                        <div className="dsc-res-list">
                            {[0, 1, 2].map((key) => <Skeleton key={key} height={76} radius={16} />)}
                        </div>
                    ) : ordered.length ? (
                        <div className="dsc-res-list">
                            {ordered.map((item) => {
                                const status = getScheduleStatus(item.status);

                                return (
                                    <button
                                        type="button"
                                        key={`${item.handle}-${item.id}`}
                                        className="dsc-res dsc-res--full"
                                        onClick={() => navigate(`/central-user/${item.handle}?tab=reservas`)}
                                    >
                                        <span className="dsc-avatar" style={{ width: 44, height: 44 }} aria-hidden="true">
                                            {logos[item.handle]
                                                ? <img src={logos[item.handle]} alt="" />
                                                : <span>{item.companyName.charAt(0).toUpperCase()}</span>}
                                        </span>
                                        <span className="dsc-res__text">
                                            <strong>{item.productName || "Serviço"}</strong>
                                            <small>
                                                {item.companyName}
                                                {item.professionalName ? `, com ${item.professionalName}` : ""}
                                            </small>
                                            <span className="dsc-res__badges">
                                                <Badge tone={status.tone}>{status.label}</Badge>
                                                {item.productPrice && <Badge plain>{item.productPrice}</Badge>}
                                            </span>
                                        </span>
                                        <span className="dsc-res__when">
                                            <strong>{item.hour}</strong>
                                            <small>
                                                {item.date
                                                    ? item.date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                                                    : item.day}
                                            </small>
                                        </span>
                                        <Icon icon="solar:alt-arrow-right-linear" className="dsc-res__chevron" aria-hidden="true" />
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="dsc-empty-panel">
                            <EmptyState
                                icon="solar:calendar-linear"
                                title={view === "upcoming" ? "Nenhuma reserva marcada" : "Nenhuma reserva anterior"}
                                action={
                                    <Button variant="primary" onClick={() => onOpenTab?.("home")}>
                                        Encontrar uma empresa
                                    </Button>
                                }
                            >
                                {currentUser
                                    ? "Quando você agendar em qualquer empresa da Markfy, a reserva aparece aqui."
                                    : "Entre na sua conta para ver reservas feitas em outros aparelhos."}
                            </EmptyState>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default DiscoverReservations;
