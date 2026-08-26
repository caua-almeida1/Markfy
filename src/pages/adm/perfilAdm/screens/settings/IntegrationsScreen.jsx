import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";

import {
    getDatabase,
    ref,
    update
} from "firebase/database";

import {
    useUserCompany
} from "../../../../../contexts/companyContext/UserCompanyContext";

import Toast from "../../../../../components/toast/Toast";

import "./IntegrationsScreen.css";


const IntegrationsScreen = () => {

    const {
        company,
        members
    } = useUserCompany();

    const [whatsapp, setWhatsapp] = useState({});

    const [initialWhatsapp, setInitialWhatsapp] = useState({});

    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState("success");
    const [toastTitle, setToastTitle] = useState("");
    const [toastMessage, setToastMessage] = useState("");


    useEffect(() => {

        if (!company || !members) return;

        const saved =
            company.integrations?.whatsapp || {};

        const data = {};

        members.forEach(member => {

            data[member.uid] = {

                enabled:
                    saved[member.uid]?.enabled || false,

                phone:
                    saved[member.uid]?.phone || ""

            };

        });

        setWhatsapp(data);
        setInitialWhatsapp(data);

    }, [company, members]);


    const openToast = (
        type,
        title,
        message
    ) => {

        setToastType(type);
        setToastTitle(title);
        setToastMessage(message);

        setShowToast(true);

    };


    const handlePhoneChange = (
        uid,
        value
    ) => {

        let phone =
            value.replace(/\D/g, "");

        if (phone.length > 13) {

            phone =
                phone.slice(0, 13);

        }

        setWhatsapp(prev => ({

            ...prev,

            [uid]: {

                ...prev[uid],

                phone

            }

        }));

    };


    const toggleWhatsapp = (uid) => {

        setWhatsapp(prev => ({

            ...prev,

            [uid]: {

                ...prev[uid],

                enabled:
                    !prev[uid]?.enabled

            }

        }));

    };


    const formatPhone = (phone) => {

        if (!phone) return "";

        const numbers =
            phone.replace(/\D/g, "");

        if (numbers.length <= 11) {

            return numbers
                .replace(
                    /^(\d{2})(\d)/,
                    "($1) $2"
                )
                .replace(
                    /(\d{5})(\d)/,
                    "$1-$2"
                );

        }

        return numbers;

    };


    const hasChanges =
        JSON.stringify(whatsapp) !==
        JSON.stringify(initialWhatsapp);


    const handleSave = async () => {

        if (!company?.handle) {

            openToast(
                "error",
                "Empresa não encontrada",
                "Não foi possível identificar a empresa."
            );

            return;

        }


        for (const member of members) {

            const data =
                whatsapp[member.uid];

            if (
                data?.enabled &&
                data.phone.length < 10
            ) {

                openToast(
                    "error",
                    "WhatsApp inválido",
                    `Informe um número válido para ${member.name}.`
                );

                return;

            }

        }


        try {

            const db =
                getDatabase();

            await update(

                ref(
                    db,
                    `companys/${company.handle}/integrations`
                ),

                {
                    whatsapp
                }

            );


            setInitialWhatsapp(
                whatsapp
            );


            openToast(
                "success",
                "Sucesso",
                "Integração do WhatsApp atualizada."
            );


        } catch (error) {

            console.error(error);

            openToast(
                "error",
                "Erro ao salvar",
                "Não foi possível salvar a integração."
            );

        }

    };


    return (

        <div className="company-screen integrations-screen">

            <div className="integration-card">

                <div className="integration-header">

                    <div className="integration-header-icon">

                        <Icon icon="logos:whatsapp-icon" />

                    </div>

                    <div>

                        <h3>
                            WhatsApp
                        </h3>

                        <p>
                            Configure o contato de cada membro da empresa.
                        </p>

                    </div>

                </div>


                <div className="integration-members">

                    {members.map(member => {

                        const data =
                            whatsapp[member.uid] || {};

                        return (

                            <div
                                className="integration-member"
                                key={member.uid}
                            >

                                <div className="integration-member-info">

                                    <div className="integration-member-avatar">

                                        {member.name
                                            ?.charAt(0)
                                            ?.toUpperCase()
                                        }

                                    </div>


                                    <div className="integration-member-details">

                                        <strong>
                                            {member.name}
                                        </strong>

                                        <span>
                                            {member.roleLabel}
                                        </span>

                                    </div>

                                </div>


                                <div className="integration-member-actions">

                                    <input
                                        type="tel"
                                        placeholder="WhatsApp"
                                        value={formatPhone(data.phone)}
                                        disabled={!data.enabled}
                                        onChange={(e) =>
                                            handlePhoneChange(
                                                member.uid,
                                                e.target.value
                                            )
                                        }
                                    />


                                    <button
                                        type="button"
                                        className={`whatsapp-toggle ${data.enabled
                                            ? "active"
                                            : ""
                                            }`}
                                        onClick={() =>
                                            toggleWhatsapp(
                                                member.uid
                                            )
                                        }
                                    >

                                        <span />

                                    </button>

                                </div>

                            </div>

                        );

                    })}

                </div>

            </div>


            <button
                disabled={!hasChanges}
                onClick={handleSave}
                className={`company-save ${!hasChanges
                    ? "disabled"
                    : ""
                    }`}
            >
                Salvar alterações
            </button>


            <Toast
                show={showToast}
                type={toastType}
                title={toastTitle}
                message={toastMessage}
                onClose={() =>
                    setShowToast(false)
                }
            />

        </div>

    );

};


export default IntegrationsScreen;