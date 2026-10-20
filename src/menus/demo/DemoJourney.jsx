import React from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import { useMenus } from "../MenusContext.jsx";

/* Jornada curta da demonstração: quatro passos que mostram o
   produto inteiro em poucos minutos. */

const STEPS = [
    { to: "editor", icon: "solar:pallete-2-bold-duotone", title: "Escolha um estilo", text: "Troque entre 16 modelos, mude cores e fontes e veja em celular, tablet e computador." },
    { to: "cliente", icon: "solar:smartphone-2-bold-duotone", title: "Peça como cliente", text: "Monte uma pizza meio a meio, adicione na sacola e envie o pedido." },
    { to: "pedidos", icon: "solar:clipboard-list-bold-duotone", title: "Receba o pedido", text: "Ele chega no quadro de pedidos. Confirme e acompanhe até a entrega." },
    { to: "mesas", icon: "solar:armchair-2-bold-duotone", title: "Atenda no salão", text: "Abra uma mesa, lance itens, mande para a cozinha, divida e feche a conta." }
];

export default function DemoJourney() {
    const navigate = useNavigate();
    const { path } = useMenus();
    return (
        <section className="mnu-journey" aria-labelledby="mnu-journey-title">
            <div className="mnu-journey__head">
                <h2 id="mnu-journey-title">Conheça o Markfy Menus em 4 passos</h2>
                <p>Tudo aqui funciona de verdade, com um restaurante fictício. Nada é salvo.</p>
            </div>
            <ol className="mnu-journey__steps">
                {STEPS.map((step, index) => (
                    <li key={step.to}>
                        <button type="button" onClick={() => navigate(path(step.to))}>
                            <span className="mnu-journey__num">{index + 1}</span>
                            <Icon icon={step.icon} aria-hidden="true" />
                            <b>{step.title}</b>
                            <small>{step.text}</small>
                            <span className="mnu-journey__go">Ir <Icon icon="solar:arrow-right-linear" aria-hidden="true" /></span>
                        </button>
                    </li>
                ))}
            </ol>
        </section>
    );
}
