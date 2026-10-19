import React from "react";
import { Icon } from "@iconify/react";

import { useStudio } from "../StudioContext";
import { useLicense } from "../../plans/LicenseContext";
import TeamQrInvite from "../../qr/TeamQrInvite";
import { Badge } from "../../design-system/components";
import { PageHead } from "./shared";

/* =========================================================
   EQUIPE

   Quem faz parte da empresa e, para administradores, o
   convite por QR Code: escolhe a função, a pessoa aponta a
   câmera e se cadastra pelo celular. A equipe é a MESMA da
   Markfy Bookings (companys/{handle}/members).
========================================================= */

const ROLE_BADGE = {
    master: { label: "Administrador principal", tone: "success" },
    administrator: { label: "Administrador", tone: "info" },
    professional: { label: "Profissional", tone: undefined }
};

const Team = () => {

    const { companyState, canEdit } = useStudio();
    const license = useLicense();

    const members = companyState.members || [];
    const planLimit = license.plan?.limits?.maxMembers;
    const limit = planLimit === null || planLimit === undefined ? Infinity : planLimit;

    return (
        <div className="std-page">

            <PageHead
                title="Equipe"
                description={
                    Number.isFinite(limit)
                        ? `${members.length} de ${limit} pessoas no plano atual.`
                        : `${members.length} pessoas na equipe.`
                }
            />

            <div className="std-team">

                <section className="std-panel">
                    <h2 className="std-team__title">Membros</h2>

                    {companyState.loadingMembers && <p className="std-team__empty">Carregando equipe…</p>}

                    {!companyState.loadingMembers && members.length === 0 && (
                        <p className="std-team__empty">Ninguém por aqui ainda.</p>
                    )}

                    <ul className="std-team__list">
                        {members.map((member) => {

                            const badge = ROLE_BADGE[member.role] || ROLE_BADGE.professional;

                            return (
                                <li key={member.uid}>
                                    <span className="std-team__avatar">
                                        {(member.name || "?").trim().charAt(0).toUpperCase()}
                                    </span>
                                    <span className="std-team__who">
                                        <strong>{member.name || "(sem nome)"}</strong>
                                        <small>{member.email}</small>
                                    </span>
                                    <Badge tone={badge.tone}>{badge.label}</Badge>
                                </li>
                            );
                        })}
                    </ul>
                </section>

                {canEdit ? (
                    <TeamQrInvite />
                ) : (
                    <section className="std-panel std-team__locked">
                        <Icon icon="solar:lock-keyhole-minimalistic-bold" />
                        <p>Só administradores podem convidar pessoas para a equipe.</p>
                    </section>
                )}

            </div>
        </div>
    );
};

export default Team;
