import React from "react";

import markfyLogo from "../img/logo-markfy.svg";

/* Tela de carregamento do Menus (mesma do Studio, com a cor do Menus). */
export default function Loader({ label = "Abrindo o Markfy Menus" }) {
    return (
        <div className="mks-loader mnu" role="status" aria-live="polite">
            <span className="mks-loader__mark"><img src={markfyLogo} alt="" /></span>
            <span>{label}…</span>
        </div>
    );
}
