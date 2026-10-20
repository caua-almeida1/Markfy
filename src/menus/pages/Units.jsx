import React from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import { useUserCompany } from "../../contexts/companyContext/UserCompanyContext";
import { Badge, Button } from "../../design-system/components";
import { productIncludes, licenseActive } from "../engine/licensing.js";
import { useMenus, useNode } from "../MenusContext.jsx";
import { PageHead, Panel } from "../ui.jsx";

/* =========================================================
   UNIDADES

   Na Markfy, cada unidade é uma empresa com o próprio
   cardápio, equipe e plano — dados nunca se misturam. Esta
   tela mostra as unidades em que a pessoa trabalha e troca
   de unidade com um toque.
========================================================= */

const UnitRow = ({ unit, current, source, onOpen }) => {
    const license = useNode(source, `licenses/${unit.handle}`);
    const hasMenus = licenseActive(license.value) && productIncludes(license.value?.product, "menus");
    return (
        <li>
            <div className="std-row">
                <span className="std-row__icon"><Icon icon="solar:shop-2-linear" /></span>
                <span className="std-row__body">
                    <span className="std-row__title">{unit.name || unit.handle}{current && <> · <Badge tone="success">aberta agora</Badge></>}</span>
                    <span className="std-row__meta">@{unit.handle} · {unit.role === "master" ? "Proprietário" : unit.role === "administrator" ? "Administrador" : "Equipe"}</span>
                </span>
                {license.loading ? null : hasMenus ? <Badge tone="info" plain>Menus no plano</Badge> : <Badge plain>Sem Menus</Badge>}
                {!current && <Button size="sm" onClick={onOpen}>Abrir</Button>}
            </div>
        </li>
    );
};

export default function Units() {
    const navigate = useNavigate();
    const { demo, source, handle, settings } = useMenus();
    const companyState = useUserCompany() || {};

    if (demo) {
        return (
            <div className="std-page">
                <PageHead title="Unidades" description="Cada unidade tem cardápio, equipe, planta e plano próprios." />
                <Panel>
                    <ul className="std-list">
                        <li><div className="std-row"><span className="std-row__icon"><Icon icon="solar:shop-2-linear" /></span><span className="std-row__body"><span className="std-row__title">{settings.profile?.name} · <Badge tone="success">aberta agora</Badge></span><span className="std-row__meta">Unidade de demonstração</span></span></div></li>
                    </ul>
                    <p className="mk-muted">Com várias empresas na mesma conta, você troca de unidade aqui ou no seletor do menu lateral.</p>
                </Panel>
            </div>
        );
    }

    const units = companyState.companies || [];

    return (
        <div className="std-page">
            <PageHead
                title="Unidades"
                description="Cada unidade é uma empresa na Markfy, com cardápio, equipe, planta e plano próprios."
                actions={<Button variant="outline" icon="solar:add-circle-linear" onClick={() => navigate("/initial-setup")}>Nova unidade</Button>}
            />
            <Panel>
                <ul className="std-list">
                    {units.map((unit) => (
                        <UnitRow key={unit.handle} unit={unit} current={unit.handle === handle} source={source} onOpen={() => companyState.selectCompany?.(unit.handle)} />
                    ))}
                    {!units.length && <li className="mk-muted">Só esta unidade por enquanto.</li>}
                </ul>
            </Panel>
        </div>
    );
}
