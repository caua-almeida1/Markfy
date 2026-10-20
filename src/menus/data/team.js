import { useMemo } from "react";

import { useUserCompany } from "../../contexts/companyContext/UserCompanyContext";
import { resolveRole, ROLES } from "../engine/permissions.js";
import { entries } from "../engine/util.js";
import { useMenus, useNode } from "../MenusContext.jsx";

/* =========================================================
   EQUIPE DO MENUS

   Painel real: pessoas de companys/{handle}/members (as
   mesmas da Bookings e do Studio), com o perfil do Menus de
   menusStaff. Demonstração: só as pessoas fictícias — a
   equipe real de quem está logado nunca aparece na demo.
========================================================= */

export const useTeam = () => {
    const { source, handle, demo, staff } = useMenus();
    const companyState = useUserCompany() || {};
    const members = useNode(source, handle && `companys/${handle}/members`);

    return useMemo(() => {
        const roleOf = (uid, memberRole) => resolveRole(memberRole, staff[uid]);

        if (demo) {
            return entries(members.value).map((member) => ({
                uid: member.id,
                name: staff[member.id]?.name || "Pessoa da equipe",
                memberRole: member.role,
                role: roleOf(member.id, member.role),
                roleLabel: ROLES[roleOf(member.id, member.role)]?.label || "",
                grants: staff[member.id]?.grants || null
            }));
        }

        const people = (companyState.members || []).map((member) => ({
            uid: member.uid,
            name: member.name || member.displayName || member.email || "Pessoa da equipe",
            email: member.email || "",
            memberRole: member.role,
            role: roleOf(member.uid, member.role),
            roleLabel: ROLES[roleOf(member.uid, member.role)]?.label || "",
            grants: staff[member.uid]?.grants || null
        }));

        /* Quem está em members mas ainda não carregou o perfil. */
        entries(members.value).forEach((member) => {
            if (!people.some((person) => person.uid === member.id)) {
                people.push({
                    uid: member.id,
                    name: staff[member.id]?.name || "Pessoa da equipe",
                    memberRole: member.role,
                    role: roleOf(member.id, member.role),
                    roleLabel: ROLES[roleOf(member.id, member.role)]?.label || "",
                    grants: staff[member.id]?.grants || null
                });
            }
        });

        return people;
    }, [demo, members.value, staff, companyState.members]);
};
