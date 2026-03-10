import React, { useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import "./perfilAdm.css";

const PerfilAdm = () => {
    const [darkMode, setDarkMode] = useState(false);

    // Carrega o tema salvo (opcional)
    useEffect(() => {
        const saved = localStorage.getItem("darkMode");
        if (saved === "true") setDarkMode(true);
    }, []);

    // Atualiza o tema quando o estado muda
    useEffect(() => {
        const root = document.documentElement;
        if (darkMode) {
            root.classList.add("dark-mode");
        } else {
            root.classList.remove("dark-mode");
        }
        localStorage.setItem("darkMode", darkMode);
    }, [darkMode]);

    const toggleDarkMode = () => {
        setDarkMode((prev) => !prev);
    };

    return (
        <main className="perfil-adm-page">
            <div className="perfil-adm-container">
                <h1 className="perfil-title">Perfil</h1>

                <div className="adm-perfil-content">
                    <h2 className="adm-perfil-subtitle">Conta</h2>
                    <div className="adm-perfil-info">
                        <img
                            src="https://img.freepik.com/fotos-gratis/jovem-bonito-encaracolado-digitando-no-telefone-isolado-na-parede-azul_231208-1231.jpg?semt=ais_hybrid&w=740&q=80"
                            alt="Foto do usuário"
                            className="adm-perfil-img"
                        />

                        <div className="adm-perfil-details">
                            <p className="adm-perfil-name">Nome do Usuário</p>
                            <p className="adm-perfil-email">usuario@email.com</p>
                        </div>

                        <Icon
                            icon="iconamoon:arrow-right-2"
                            className="adm-perfil-arrow"
                        />
                    </div>

                    <h2 className="adm-perfil-subtitle">Preferências de Interface</h2>
                    <div className="adm-perfil-info adm-perfil-company">
                        <div className="adm-perfil-row">
                            <div className="adm-perfil-details">
                                <p className="adm-perfil-name">Notificações</p>
                            </div>
                            <Icon
                                icon="iconamoon:arrow-right-2"
                                className="adm-perfil-arrow"
                            />
                        </div>

                        {/* Tema escuro */}
                        <div className="adm-perfil-row">
                            <div className="adm-perfil-details">
                                <p className="adm-perfil-name">Tema escuro</p>
                            </div>

                            <div
                                className={`toggle-switch ${darkMode ? "active" : ""}`}
                                onClick={toggleDarkMode}
                            >
                                <div className="toggle-circle"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default PerfilAdm;
