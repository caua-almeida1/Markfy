import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";

import {
    getDatabase,
    ref,
    get,
    update
} from "firebase/database";

import {
    useUserCompany
} from "../../../../../../contexts/companyContext/UserCompanyContext";

import Toast from "../../../../../../components/toast/Toast";

const PixConfigScreen = ({ onBack }) => {

    const { company } = useUserCompany();

    const [pixType, setPixType] = useState("");
    const [pixKey, setPixKey] = useState("");

    const [pixEnabled, setPixEnabled] = useState(false);
    const [hasPix, setHasPix] = useState(false);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);


    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState("success");
    const [toastTitle, setToastTitle] = useState("");
    const [toastMessage, setToastMessage] = useState("");


    /* ================= TOAST ================= */

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


    /* ================= LOAD ================= */

    useEffect(() => {

        const loadPix = async () => {

            if (!company?.handle) {

                setLoading(false);

                return;

            }


            try {

                const db = getDatabase();

                const snapshot = await get(

                    ref(
                        db,
                        `companys/${company.handle}/payments/pix`
                    )

                );


                if (snapshot.exists()) {

                    const pix = snapshot.val();

                    const type =
                        pix.type || "";

                    const key =
                        pix.key || "";

                    const enabled =
                        pix.enabled === true;


                    setPixType(type);

                    setPixKey(key);

                    setPixEnabled(enabled);

                    setHasPix(
                        Boolean(type && key)
                    );

                }


            } catch (error) {

                console.error(
                    "Erro ao carregar Pix:",
                    error
                );

                openToast(
                    "error",
                    "Erro",
                    "Não foi possível carregar a configuração do Pix."
                );

            } finally {

                setLoading(false);

            }

        };


        loadPix();

    }, [company]);


    /* ================= SAVE ================= */

    const savePix = async ({
        enabled = pixEnabled,
        type = pixType,
        key = pixKey
    }) => {

        if (
            !company?.handle ||
            saving
        ) {
            return false;
        }


        try {

            setSaving(true);


            const db = getDatabase();


            const data = {

                enabled,

                type,

                key: key.trim()

            };


            await update(

                ref(
                    db,
                    `companys/${company.handle}/payments/pix`
                ),

                data

            );


            setPixEnabled(enabled);

            setPixType(type);

            setPixKey(key);


            setHasPix(
                Boolean(
                    type &&
                    key.trim()
                )
            );


            openToast(
                "success",
                "Alterações salvas",
                "As configurações do Pix foram atualizadas."
            );


            return true;


        } catch (error) {

            console.error(
                "Erro ao salvar Pix:",
                error
            );


            openToast(
                "error",
                "Erro ao salvar",
                "Não foi possível atualizar as configurações do Pix."
            );


            return false;


        } finally {

            setSaving(false);

        }

    };


    /* ================= TYPE ================= */

    const handlePixTypeChange = async (e) => {

        const newType =
            e.target.value;


        setPixType(newType);


        await savePix({

            enabled: pixEnabled,

            type: newType,

            key: pixKey

        });

    };


    /* ================= KEY ================= */

    const handlePixKeyChange = (e) => {

        setPixKey(
            e.target.value
        );

    };


    /*
     * Salva quando o usuário
     * termina de editar o campo.
     */

    const handlePixKeyBlur = async () => {

        const newKey =
            pixKey.trim();


        if (!newKey) {

            return;

        }


        if (newKey === "") {

            return;

        }


        await savePix({

            enabled: pixEnabled,

            type: pixType,

            key: newKey

        });

    };


    /* ================= TOGGLE ================= */

    const togglePix = async () => {

        /*
         * Não existe chave configurada.
         * Não permite ativar.
         */

        if (!hasPix) {

            openToast(
                "error",
                "Configure o Pix",
                "Adicione uma chave Pix antes de ativá-lo."
            );

            return;

        }


        const newEnabled =
            !pixEnabled;


        /*
         * Atualiza visualmente
         * antes da gravação.
         */

        setPixEnabled(
            newEnabled
        );


        const success =
            await savePix({

                enabled: newEnabled,

                type: pixType,

                key: pixKey

            });


        /*
         * Se falhar,
         * desfaz visualmente.
         */

        if (!success) {

            setPixEnabled(
                !newEnabled
            );

        }

    };


    /* ================= LOADING ================= */

    if (loading) {

        return (

            <div className="payment-screen">

                <div className="payment-info">

                    <div className="payment-info-content">

                        <h3>
                            Configurar Pix
                        </h3>

                        <p>
                            Carregando configuração...
                        </p>

                    </div>

                </div>

            </div>

        );

    }


    return (

        <div className="payment-screen">


            {/* ================= INFO ================= */}

            <div className="payment-info">

                <div className="payment-info-icon">

                    <Icon
                        icon="solar:qr-code-outline"
                    />

                </div>


                <div className="payment-info-content">

                    <h3>
                        Configurar Pix
                    </h3>

                    <p>
                        Configure a chave Pix que será utilizada
                        para receber os pagamentos dos seus clientes.
                    </p>

                </div>

            </div>


            {/* ================= ATIVAR ================= */}

            <div className="payment-methods-card">

                <div className="payment-config-toggle">

                    <div className="payment-config-toggle-left">

                        <div className="payment-method-icon">

                            <Icon
                                icon="solar:power-outline"
                            />

                        </div>

                        <div>

                            <h3>
                                Ativar Pix
                            </h3>

                            <p>
                                Permitir pagamentos por Pix.
                            </p>

                        </div>

                    </div>


                    <button
                        type="button"
                        className={`toggle-switch ${pixEnabled
                                ? "active"
                                : ""
                            }`}
                        disabled={
                            !hasPix ||
                            saving
                        }
                        onClick={togglePix}
                        aria-label={
                            pixEnabled
                                ? "Desativar Pix"
                                : "Ativar Pix"
                        }
                    >

                        <span className="toggle-circle" />

                    </button>

                </div>

            </div>


            {/* ================= CONFIGURAÇÃO ================= */}

            <div
                className={`payment-methods-card ${!pixEnabled
                        ? "payment-methods-card--disabled"
                        : ""
                    }`}
            >


                {/* TIPO */}

                <div className="payment-config-content">

                    <div className="payment-config-icon">

                        <Icon
                            icon="solar:key-outline"
                        />

                    </div>


                    <select
                        className="payment-config-input"
                        value={pixType}
                        onChange={
                            handlePixTypeChange
                        }
                        disabled={
                            !pixEnabled ||
                            saving
                        }
                    >

                        <option value="">
                            Tipo da chave
                        </option>

                        <option value="cpf">
                            CPF
                        </option>

                        <option value="cnpj">
                            CNPJ
                        </option>

                        <option value="email">
                            E-mail
                        </option>

                        <option value="phone">
                            Telefone
                        </option>

                        <option value="random">
                            Chave aleatória
                        </option>

                    </select>

                </div>


                {/* CHAVE */}

                <div className="payment-config-content">

                    <div className="payment-config-icon">

                        <Icon
                            icon="solar:qr-code-outline"
                        />

                    </div>


                    <input
                        className="payment-config-input"
                        type="text"
                        value={pixKey}
                        onChange={
                            handlePixKeyChange
                        }
                        onBlur={
                            handlePixKeyBlur
                        }
                        placeholder="Chave Pix"
                        disabled={
                            !pixEnabled ||
                            saving
                        }
                    />

                </div>

            </div>


            {/* ================= VOLTAR ================= */}

            <button
                type="button"
                className="payment-cancel"
                onClick={onBack}
            >
                Voltar
            </button>


            {/* ================= TOAST ================= */}

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

export default PixConfigScreen;