import React, { useState } from "react";
import { Icon } from "@iconify/react";

import { Badge, Button, Sheet } from "../../design-system/components";
import { ACTIONS, ASSIGNABLE_ROLES, ROLES, can as roleCan } from "../engine/permissions.js";
import { clean, entries } from "../engine/util.js";
import { useMenus, useNode } from "../MenusContext.jsx";
import { useTeam } from "../data/team.js";
import TeamQrInvite from "../../qr/TeamQrInvite";
import { DemoTag, PageHead, Panel, dateTimeLabel } from "../ui.jsx";

/* =========================================================
   EQUIPE E PERMISSÕES

   A equipe é a mesma da Markfy (Bookings e Studio). Aqui se
   define o PERFIL de cada profissional no Menus e, se
   preciso, ajustes por ação. Dono e administradores têm o
   perfil fixo pelo papel na empresa.

   Toda mudança de perfil vai para a auditoria. O servidor
   usa estes mesmos perfis para autorizar cada operação.
========================================================= */

const groupActions = () => {
    const groups = {};
    Object.entries(ACTIONS).forEach(([id, meta]) => {
        (groups[meta.module] = groups[meta.module] || []).push({ id, ...meta });
    });
    return groups;
};

const GrantsEditor = ({ person, onClose }) => {
    const { source, handle, user, notify, staff } = useMenus();
    const [role, setRole] = useState(person.role);
    const [grants, setGrants] = useState(person.grants || {});
    const [busy, setBusy] = useState(false);
    const fixed = person.memberRole === "master" || person.memberRole === "administrator";

    const save = async () => {
        setBusy(true);
        try {
            const value = clean({ ...(staff[person.uid] || {}), name: person.name, role, grants: Object.keys(grants).length ? grants : null, updatedAt: Date.now(), updatedBy: user?.uid || null });
            await source.set(`menusStaff/${handle}/${person.uid}`, value);
            await source.set(`menusAudit/${handle}/${source.newKey()}`, {
                type: "team.role_changed",
                at: Date.now(),
                by: user?.uid || null,
                byName: user?.name || null,
                details: clean({ uid: person.uid, name: person.name, from: person.role, to: role, grants })
            }).catch(() => null);
            notify("success", "Permissões salvas", person.name);
            onClose();
        } catch (error) {
            notify("error", "Não foi possível salvar", error.message);
        } finally {
            setBusy(false);
        }
    };

    const groups = groupActions();

    return (
        <Sheet
            open
            onClose={onClose}
            title={person.name}
            description={fixed ? "Perfil definido pelo papel na empresa." : "Escolha o perfil e, se precisar, ajuste ações específicas."}
            footer={!fixed && (
                <>
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button variant="primary" loading={busy} onClick={save}>Salvar</Button>
                </>
            )}
        >
            <div className="mnu-form">
                {fixed ? (
                    <p className="mnu-alert is-ok">{ROLES[person.role]?.label}: {ROLES[person.role]?.description}</p>
                ) : (
                    <>
                        <div className="mnu-roles">
                            {ASSIGNABLE_ROLES.map((id) => (
                                <button key={id} type="button" className={`mnu-role ${role === id ? "is-on" : ""}`} aria-pressed={role === id} onClick={() => setRole(id)}>
                                    <b>{ROLES[id].label}</b>
                                    <small>{ROLES[id].description}</small>
                                </button>
                            ))}
                        </div>
                        <details className="mnu-details">
                            <summary><span><b>Ajustes por ação</b><small>Libere ou bloqueie algo além do perfil</small></span><Icon icon="solar:alt-arrow-down-linear" aria-hidden="true" /></summary>
                            <div className="mnu-details__body">
                                {Object.entries(groups).map(([module, actions]) => (
                                    <fieldset key={module} className="mnu-grants">
                                        <legend>{module}</legend>
                                        {actions.filter((action) => action.id !== "plan.manage" && action.id !== "team.manage").map((action) => {
                                            const base = ROLES[role]?.actions.includes(action.id);
                                            const value = grants[action.id];
                                            const effective = typeof value === "boolean" ? value : base;
                                            return (
                                                <div key={action.id} className="mnu-grant">
                                                    <span>{action.label}{typeof value === "boolean" && <Badge tone="info" plain>ajustado</Badge>}</span>
                                                    <select
                                                        className="mk-select"
                                                        value={typeof value === "boolean" ? String(value) : "inherit"}
                                                        aria-label={action.label}
                                                        onChange={(event) => {
                                                            const next = { ...grants };
                                                            if (event.target.value === "inherit") delete next[action.id];
                                                            else next[action.id] = event.target.value === "true";
                                                            setGrants(next);
                                                        }}
                                                    >
                                                        <option value="inherit">Do perfil ({base ? "sim" : "não"})</option>
                                                        <option value="true">Liberar</option>
                                                        <option value="false">Bloquear</option>
                                                    </select>
                                                    <Icon icon={effective ? "solar:check-circle-bold" : "solar:close-circle-linear"} className={effective ? "is-on" : "is-off"} aria-label={effective ? "Permitido" : "Não permitido"} />
                                                </div>
                                            );
                                        })}
                                    </fieldset>
                                ))}
                            </div>
                        </details>
                    </>
                )}
            </div>
        </Sheet>
    );
};

export default function Team() {
    const { demo, source, handle, can } = useMenus();
    const team = useTeam();
    const audit = useNode(source, can("audit.view") ? `menusAudit/${handle}` : null, { orderBy: "at", limitToLast: 40 });
    const [editing, setEditing] = useState(null);
    const [matrix, setMatrix] = useState(false);

    return (
        <div className="std-page">
            <PageHead
                title="Equipe e permissões"
                description="A equipe é a mesma da Markfy. Defina o perfil de cada pessoa no Menus."
                actions={<><DemoTag /><Button variant="outline" icon="solar:table-linear" onClick={() => setMatrix(true)}>O que cada perfil pode</Button></>}
            />

            <div className="std-grid std-grid--main">
                <Panel title="Pessoas" description={`${team.length} na equipe`}>
                    <ul className="std-list">
                        {team.map((person) => (
                            <li key={person.uid}>
                                <button type="button" className="std-row" onClick={() => setEditing(person)}>
                                    <span className="std-row__icon"><Icon icon={person.memberRole === "master" ? "solar:crown-linear" : "solar:user-linear"} /></span>
                                    <span className="std-row__body">
                                        <span className="std-row__title">{person.name}</span>
                                        <span className="std-row__meta">{ROLES[person.role]?.description}{person.grants ? " · com ajustes" : ""}</span>
                                    </span>
                                    <Badge tone={person.role === "owner" ? "success" : person.role === "admin" ? "info" : undefined}>{person.roleLabel}</Badge>
                                </button>
                            </li>
                        ))}
                    </ul>
                </Panel>

                <div className="std-grid">
                    <Panel title="Convidar para a equipe" description="A pessoa aponta a câmera, cria a conta e entra direto na empresa.">
                        {demo ? <p className="mk-muted">O convite por QR Code não funciona na demonstração.</p> : <TeamQrInvite />}
                    </Panel>

                    {can("audit.view") && (
                        <Panel title="Auditoria recente" description="Descontos, cancelamentos, estornos, reaberturas, preços e permissões.">
                            <ul className="mnu-audit">
                                {entries(audit.value).sort((a, b) => b.at - a.at).map((entry) => (
                                    <li key={entry.id}>
                                        <span>{dateTimeLabel(entry.at)}</span>
                                        <span><b>{entry.byName || "Sistema"}</b> · {AUDIT_LABELS[entry.type] || entry.type}{entry.details?.reason ? ` · “${entry.details.reason}”` : ""}{entry.details?.name ? ` · ${entry.details.name}` : ""}{entry.details?.tableLabel ? ` · ${entry.details.tableLabel}` : ""}</span>
                                    </li>
                                ))}
                                {!entries(audit.value).length && <li className="mk-muted">Nada registrado ainda.</li>}
                            </ul>
                        </Panel>
                    )}
                </div>
            </div>

            {editing && <GrantsEditor person={editing} onClose={() => setEditing(null)} />}

            <Sheet open={matrix} onClose={() => setMatrix(false)} title="Permissões por perfil" description="O servidor confere exatamente esta tabela em cada operação.">
                <div className="mnu-table-wrap">
                    <table className="mnu-table mnu-matrix">
                        <thead>
                            <tr>
                                <th scope="col">Ação</th>
                                {Object.entries(ROLES).map(([id, role]) => <th key={id} scope="col">{role.label}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(ACTIONS).map(([id, action]) => (
                                <tr key={id}>
                                    <th scope="row">{action.label}<small> · {action.module}</small></th>
                                    {Object.keys(ROLES).map((role) => (
                                        <td key={role}>{roleCan(role, id) ? <Icon icon="solar:check-circle-bold" className="is-on" aria-label="Sim" /> : <Icon icon="solar:minus-circle-linear" className="is-off" aria-label="Não" />}</td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Sheet>
        </div>
    );
}

const AUDIT_LABELS = {
    "tab.discount": "concedeu desconto",
    "tab.service_fee": "ajustou taxa de serviço",
    "tab.adjustment_voided": "retirou ajuste da conta",
    "tab.item_cancelled": "cancelou item",
    "tab.refund": "estornou pagamento",
    "tab.reopened": "reabriu comanda",
    "tab.items_transferred": "transferiu itens",
    "tab.table_moved": "mudou comanda de mesa",
    "tab.merged": "uniu mesas",
    "order.cancelled": "cancelou pedido",
    "order.refund": "estornou pedido",
    "catalog.price_changed": "alterou preço",
    "catalog.product_deleted": "excluiu produto",
    "team.role_changed": "alterou permissões"
};
