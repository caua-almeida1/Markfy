import React from "react";

import { Badge } from "../../design-system/components";
import PlansView from "../../plans/PlansView";
import { FEATURES } from "../../plans/planDefaults";
import { useMenus } from "../MenusContext.jsx";
import { PageHead, Panel } from "../ui.jsx";

/* =========================================================
   PLANO E ASSINATURA

   Painel real: a MESMA tela de planos da Markfy (catálogo,
   preços e cobrança centralizados). Demonstração: mostra o
   que o plano simulado libera, sem cobrar nada.
========================================================= */

export default function Plan() {
    const { demo, features, planId } = useMenus();

    if (demo) {
        return (
            <div className="std-page">
                <PageHead title="Plano e assinatura" description="Na demonstração, troque o plano simulado no topo e veja o painel se adaptar." />
                <Panel title={`Plano simulado: ${planId}`}>
                    <ul className="mnu-facts">
                        {FEATURES.filter((feature) => feature.product === "menus").map((feature) => (
                            <li key={feature.id}>
                                <Badge tone={features[feature.id] ? "success" : undefined}>{features[feature.id] ? "Incluído" : "Não incluído"}</Badge>
                                <span><b>{feature.label}</b> — {feature.hint}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="mk-muted">Preços reais aparecem na tela de planos da sua conta, depois do cadastro.</p>
                </Panel>
            </div>
        );
    }

    return (
        <div className="std-page">
            <PlansView variant="embedded" blockedProduct="menus" />
        </div>
    );
}
