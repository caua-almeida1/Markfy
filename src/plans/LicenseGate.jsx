import React from "react";

import { useUserCompany } from "../contexts/companyContext/UserCompanyContext";
import { useLicense } from "./LicenseContext";
import PlansView from "./PlansView";

/* =========================================================
   PORTEIRO DE PLANO

   Envolve um painel (Bookings ou Studio). Só renderiza o
   painel quando a empresa aberta tem plano ATIVO que inclui
   o produto. Caso contrário mostra a tela de planos.

   Enquanto a empresa ainda está sendo descoberta (carregando,
   escolha entre várias, sem empresa), deixa o próprio painel
   mostrar o seu estado — ele já sabe fazer isso.

   Falha fechado: licença carregando ou erro de leitura nunca
   libera o painel.
========================================================= */

export default function LicenseGate({ product, children }) {

    const companyState = useUserCompany();
    const license = useLicense();

    if (
        companyState.loading ||
        companyState.needsCompanySelection ||
        !license.handle
    ) {
        return children;
    }

    if (license.loading) {
        return (
            <div className="pl pl--blocked">
                <div className="pl-loading"><span className="pl-spin" style={{ borderColor: "rgba(120,120,140,.3)", borderTopColor: "var(--mkf-ui-primary, #092af3)", width: 34, height: 34 }} /></div>
            </div>
        );
    }

    if (license.error || !license.hasProduct(product)) {
        return <PlansView variant="blocked" blockedProduct={product} />;
    }

    return children;
}
