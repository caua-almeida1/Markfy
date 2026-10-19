import React from "react";

import markfyLogo from "../../img/logo-markfy.svg";

import "./route-transition.css";

/* Espera de carregamento de rota preguiçosa (Suspense).
   Mesma linguagem da transição, sem o véu animado. */
const RouteFallback = ({ label = "Carregando" }) => (
    <div className="mk-route-transition" role="status" aria-live="polite" style={{ position: "fixed" }}>
        <div className="mk-route-transition__veil" />
        <div className="mk-route-transition__content">
            <div className="mk-route-transition__mark">
                <img src={markfyLogo} alt="" />
                <span className="mk-route-transition__orbit" aria-hidden="true" />
            </div>
            <div className="mk-route-transition__text">
                <span>{label}…</span>
            </div>
        </div>
    </div>
);

export default RouteFallback;
