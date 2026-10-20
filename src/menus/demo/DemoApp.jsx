import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import { Button } from "../../design-system/components";
import { ROLES } from "../engine/permissions.js";
import { createDemoSource, DEMO_TEAM } from "../data/demoSource.js";
import { MenusProvider, useMenus } from "../MenusContext.jsx";
import Shell from "../Shell.jsx";
import MenusRoutes from "../MenusRoutes.jsx";
import Loader from "../Loader.jsx";

/* =========================================================
   DEMONSTRAÇÃO DO MARKFY MENUS (/menus/demo)

   Um restaurante fictício completo, sem cadastro. Usa as
   MESMAS telas do painel real com uma fonte de dados em
   memória: dá para editar o cardápio, pedir como cliente,
   abrir mesas, mandar para a cozinha e fechar a conta.

   Nada sai do navegador. A faixa no topo deixa isso claro o
   tempo todo, e "Ver como" troca o perfil (dono, garçom,
   cozinha…) para mostrar as permissões de verdade.
========================================================= */

const DemoBar = ({ actingAs, onActAs, plan, onPlan, onReset }) => {
    const navigate = useNavigate();
    return (
        <div className="mnu-demobar" role="region" aria-label="Controles da demonstração">
            <span className="mnu-demobar__tag"><Icon icon="solar:test-tube-bold" aria-hidden="true" /> Demonstração</span>
            <span className="mnu-demobar__text">Cantina Aurora é fictícia. Pedidos e pagamentos aqui não são reais e nada é salvo.</span>
            <label className="mnu-demobar__field">
                <span>Ver como</span>
                <select value={actingAs} onChange={(event) => onActAs(event.target.value)}>
                    {Object.entries(DEMO_TEAM).map(([uid, person]) => (
                        <option key={uid} value={uid}>{person.role ? `${ROLES[person.role].label} · ${person.name.split(" ")[0]}` : "Proprietário"}</option>
                    ))}
                </select>
            </label>
            <label className="mnu-demobar__field">
                <span>Simular plano</span>
                <select value={plan} onChange={(event) => onPlan(event.target.value)}>
                    <option value="premium">Premium</option>
                    <option value="standard">Comum</option>
                    <option value="basic">Básico</option>
                </select>
            </label>
            <Button size="sm" variant="ghost" icon="solar:restart-linear" onClick={onReset}>Recomeçar</Button>
            <Button size="sm" variant="primary" onClick={() => navigate("/login?redirect=/menus")}>Criar meu cardápio</Button>
        </div>
    );
};

const DemoPanel = ({ bar }) => {
    const { settings, draft } = useMenus();
    return (
        <MenusRoutes
            shell={(children) => (
                <Shell companyName={settings.profile?.name || "Cantina Aurora"} companyLogo={draft?.design?.images?.logo} canSwitch={false} topSlot={bar}>
                    {children}
                </Shell>
            )}
        />
    );
};

export default function DemoApp() {
    const [source, setSource] = useState(null);
    const [actingAs, setActingAs] = useState("demo-owner");
    const [plan, setPlan] = useState("premium");
    const [seed, setSeed] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setSource(null);
        createDemoSource({ plan: "premium" }).then((created) => {
            if (cancelled) return;
            setActingAs("demo-owner");
            setPlan("premium");
            setSource(created);
        });
        return () => {
            cancelled = true;
        };
    }, [seed]);

    useEffect(() => {
        document.title = "Markfy Menus — demonstração";
    }, []);

    const actAs = useCallback((uid) => {
        source?.setActingAs(uid);
        setActingAs(uid);
    }, [source]);

    const switchPlan = useCallback(async (next) => {
        await source?.setPlan(next);
        setPlan(next);
    }, [source]);

    const user = useMemo(() => ({ uid: actingAs, name: DEMO_TEAM[actingAs]?.name || "" }), [actingAs]);

    if (!source) return <Loader label="Preparando a Cantina Aurora (fictícia)" />;

    const bar = <DemoBar actingAs={actingAs} onActAs={actAs} plan={plan} onPlan={switchPlan} onReset={() => setSeed((value) => value + 1)} />;

    return (
        <MenusProvider key={seed} source={source} base="/menus/demo" user={user}>
            <DemoPanel bar={bar} />
        </MenusProvider>
    );
}
