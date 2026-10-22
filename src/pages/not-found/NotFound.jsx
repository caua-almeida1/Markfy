import React from "react";
import { Link, useNavigate } from "react-router-dom";

import markfyLogo from "../../img/logo-markfy.svg";

import { usePageMeta } from "../../hooks/usePageMeta";

import "./not-found.css";

/* =========================================================
   PÁGINA NÃO ENCONTRADA

   Antes, qualquer endereço desconhecido abria a landing — um
   link quebrado parecia funcionar, e o Google via a mesma
   página em infinitas URLs. Esta página explica o que houve,
   oferece caminhos úteis e pede para não ser indexada.

   Rotas válidas que dependem de login ou de dados (painel,
   página de uma empresa) não caem aqui: elas existem no
   roteador e tratam o próprio "não encontrado".
========================================================= */

const NotFound = () => {

    const navigate = useNavigate();

    usePageMeta({
        title: "Página não encontrada",
        description: "O endereço acessado não existe na Markfy.",
        noindex: true
    });

    const canGoBack =
        typeof window !== "undefined" &&
        window.history.length > 1;

    return (
        <main className="mk-not-found">

            <div className="mk-not-found__card">

                <img
                    className="mk-not-found__logo"
                    src={markfyLogo}
                    alt="Markfy"
                    width="56"
                    height="56"
                />

                <p className="mk-not-found__code" aria-hidden="true">404</p>

                <h1>Página não encontrada</h1>

                <p className="mk-not-found__text">
                    O endereço pode ter sido digitado errado ou a página mudou de lugar.
                    Se você recebeu este link de uma empresa, confira o @ com ela.
                </p>

                <div className="mk-not-found__actions">

                    <Link className="mk-not-found__primary" to="/">
                        Ir para o início
                    </Link>

                    {canGoBack && (
                        <button
                            type="button"
                            className="mk-not-found__secondary"
                            onClick={() => navigate(-1)}
                        >
                            Voltar
                        </button>
                    )}

                </div>

                <nav className="mk-not-found__links" aria-label="Atalhos">
                    <Link to="/central-user">Encontrar empresas</Link>
                    <Link to="/home">Produtos Markfy</Link>
                    <Link to="/login">Entrar</Link>
                </nav>

            </div>

        </main>
    );
};

export default NotFound;
