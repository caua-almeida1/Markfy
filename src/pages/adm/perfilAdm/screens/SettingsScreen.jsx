import { Icon } from "@iconify/react";
import { useState } from "react";

const SettingsScreen = ({ openScreen }) => {

    return (

        <div className="adm-perfil-content">

            <div className="adm-perfil-info adm-perfil-company">

                <div
                    className="adm-perfil-row"
                    onClick={() => openScreen("settings-company")}
                >

                    <div className="adm-perfil-row-left">

                        <Icon
                            icon="solar:buildings-2-outline"
                            className="adm-perfil-row-icon"
                        />

                        <div className="adm-perfil-details">

                            <p className="adm-perfil-name">
                                Dados da empresa
                            </p>

                        </div>

                    </div>

                    <Icon
                        icon="iconamoon:arrow-right-2"
                        className="adm-perfil-arrow"
                    />

                </div>

                <div
                    className="adm-perfil-row"
                    onClick={() => openScreen("settings-branding")}
                >

                    <div className="adm-perfil-row-left">

                        <Icon
                            icon="solar:palette-outline"
                            className="adm-perfil-row-icon"
                        />

                        <div className="adm-perfil-details">

                            <p className="adm-perfil-name">
                                Identidade visual
                            </p>

                        </div>

                    </div>

                    <Icon
                        icon="iconamoon:arrow-right-2"
                        className="adm-perfil-arrow"
                    />

                </div>

                <div
                    className="adm-perfil-row"
                    onClick={() => openScreen("settings-location")}
                >

                    <div className="adm-perfil-row-left">

                        <Icon
                            icon="solar:map-point-outline"
                            className="adm-perfil-row-icon"
                        />

                        <div className="adm-perfil-details">

                            <p className="adm-perfil-name">
                                Localização
                            </p>

                        </div>

                    </div>

                    <Icon
                        icon="iconamoon:arrow-right-2"
                        className="adm-perfil-arrow"
                    />

                </div>

                <div
                    className="adm-perfil-row"
                    onClick={() => openScreen("settings-social")}
                >

                    <div className="adm-perfil-row-left">

                        <Icon
                            icon="solar:share-circle-outline"
                            className="adm-perfil-row-icon"
                        />

                        <div className="adm-perfil-details">

                            <p className="adm-perfil-name">
                                Redes sociais
                            </p>

                        </div>

                    </div>

                    <Icon
                        icon="iconamoon:arrow-right-2"
                        className="adm-perfil-arrow"
                    />

                </div>

                <div
                    className="adm-perfil-row"
                    onClick={() => openScreen("settings-hours")}
                >

                    <div className="adm-perfil-row-left">

                        <Icon
                            icon="solar:clock-circle-outline"
                            className="adm-perfil-row-icon"
                        />

                        <div className="adm-perfil-details">

                            <p className="adm-perfil-name">
                                Horário de funcionamento
                            </p>

                        </div>

                    </div>

                    <Icon
                        icon="iconamoon:arrow-right-2"
                        className="adm-perfil-arrow"
                    />

                </div>

                <div
                    className="adm-perfil-row"
                    onClick={() => openScreen("settings-integrations")}
                >

                    <div className="adm-perfil-row-left">

                        <Icon
                            icon="solar:link-round-outline"
                            className="adm-perfil-row-icon"
                        />

                        <div className="adm-perfil-details">

                            <p className="adm-perfil-name">
                                Integrações
                            </p>

                        </div>

                    </div>

                    <Icon
                        icon="iconamoon:arrow-right-2"
                        className="adm-perfil-arrow"
                    />

                </div>

            </div>

        </div>

    );
};

export default SettingsScreen;