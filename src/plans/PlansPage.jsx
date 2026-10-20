import React from "react";
import { useNavigate } from "react-router-dom";

import CompanyPicker from "../components/company-picker/CompanyPicker";
import { useUserCompany } from "../contexts/companyContext/UserCompanyContext";
import { useLicense } from "./LicenseContext";
import PlansView from "./PlansView";

/* Rota /planos: escolha e pagamento do plano da empresa aberta.
   É para onde a criação da empresa leva ao terminar. */

export default function PlansPage() {

    const navigate = useNavigate();
    const companyState = useUserCompany();
    const license = useLicense();

    if (companyState.loading) {
        return <div className="pl pl--page"><div className="pl-loading"><span className="pl-spin" style={{ borderColor: "rgba(120,120,140,.3)", borderTopColor: "var(--mkf-ui-primary, #092af3)", width: 34, height: 34 }} /></div></div>;
    }

    if (companyState.needsCompanySelection) return <CompanyPicker />;

    if (!license.handle) {
        return (
            <section className="pl pl--page">
                <div className="pl-hero">
                    <h1>Você ainda não tem uma empresa</h1>
                    <p>Crie a sua empresa para escolher um plano.</p>
                    <button type="button" className="pl-btn" style={{ alignSelf: "flex-start", padding: "0 26px" }} onClick={() => navigate("/home")}>
                        Voltar ao início
                    </button>
                </div>
            </section>
        );
    }

    return (
        <>
            <PlansView variant="page" />

            {license.active && (
                <div className="pl pl--open" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 2600, padding: "14px 16px", background: "var(--mkf-ui-surface, #fff)", borderTop: "1px solid var(--mkf-ui-border, #e8e9ed)", flexDirection: "row", justifyContent: "center", gap: 10, flexWrap: "wrap" }}>
                    {license.hasProduct("bookings") && (
                        <button type="button" className="pl-btn" style={{ "--pl": "var(--mkf-ui-primary, #092af3)", padding: "0 26px" }} onClick={() => navigate("/central-adm")}>
                            Abrir Markfy Bookings
                        </button>
                    )}
                    {license.hasProduct("studio") && (
                        <button type="button" className="pl-btn" style={{ "--pl": "#e11d74", padding: "0 26px" }} onClick={() => navigate("/studio")}>
                            Abrir Markfy Studio
                        </button>
                    )}
                    {license.hasProduct("menus") && (
                        <button type="button" className="pl-btn" style={{ "--pl": "#d9480f", padding: "0 26px" }} onClick={() => navigate("/menus")}>
                            Abrir Markfy Menus
                        </button>
                    )}
                </div>
            )}
        </>
    );
}
