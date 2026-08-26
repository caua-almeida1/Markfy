import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { getDatabase, ref, update } from "firebase/database";

import { useUserCompany } from "../../../../../contexts/companyContext/UserCompanyContext";
import Toast from "../../../../../components/toast/Toast";

const BrandingScreen = () => {

    const { company } = useUserCompany();

    const [logo, setLogo] = useState("");
    const [initialLogo, setInitialLogo] = useState("");

    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState("success");
    const [toastTitle, setToastTitle] = useState("");
    const [toastMessage, setToastMessage] = useState("");

    useEffect(() => {

        if (!company) return;

        const currentLogo = company.logoPreview || "";

        setLogo(currentLogo);
        setInitialLogo(currentLogo);

    }, [company]);

    const openToast = (type, title, message) => {

        setToastType(type);
        setToastTitle(title);
        setToastMessage(message);
        setShowToast(true);

    };

    const handleLogoChange = (e) => {

        const file = e.target.files?.[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {

            openToast(
                "error",
                "Arquivo inválido",
                "Selecione uma imagem para utilizar como logo."
            );

            return;

        }

        const reader = new FileReader();

        reader.onload = () => {

            setLogo(reader.result);

        };

        reader.readAsDataURL(file);

    };

    const hasChanges = logo !== initialLogo;

    const handleSave = async () => {

        if (!company?.handle) {

            openToast(
                "error",
                "Empresa não encontrada",
                "Não foi possível identificar a empresa."
            );

            return;

        }

        if (!logo) {

            openToast(
                "error",
                "Logo não encontrada",
                "Selecione uma logo antes de salvar."
            );

            return;

        }

        try {

            const db = getDatabase();

            await update(
                ref(db, `companys/${company.handle}`),
                {
                    logoPreview: logo
                }
            );

            setInitialLogo(logo);

            openToast(
                "success",
                "Sucesso",
                "A identidade visual foi atualizada."
            );

        } catch (error) {

            console.error(error);

            openToast(
                "error",
                "Erro ao salvar",
                "Não foi possível atualizar a identidade visual."
            );

        }

    };

    return (

        <div className="company-screen">

            <div className="company-card">

                <div className="branding-input-group">

                    <Icon
                        icon="solar:gallery-add-outline"
                        className="company-input-icon"
                    />

                    <div className="branding-logo-content">

                        <div className="branding-logo-preview">

                            {logo ? (

                                <img
                                    src={logo}
                                    alt="Logo da empresa"
                                    className="branding-logo-image"
                                />

                            ) : (

                                <div className="branding-logo-placeholder">
                                    Untitled
                                </div>

                            )}

                        </div>

                        <div className="branding-logo-details">

                            <span className="branding-logo-title">
                                Logo da empresa
                            </span>

                            <span className="branding-logo-description">
                                Adicione a identidade visual da sua empresa.
                            </span>

                        </div>

                    </div>

                    <label className="branding-logo-button">

                        <Icon icon="solar:upload-outline" />

                        <span>
                            Alterar
                        </span>

                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoChange}
                        />

                    </label>

                </div>

            </div>

            <button
                disabled={!hasChanges}
                onClick={handleSave}
                className={`company-save ${!hasChanges ? "disabled" : ""}`}
            >
                Salvar alterações
            </button>

            <Toast
                show={showToast}
                type={toastType}
                title={toastTitle}
                message={toastMessage}
                onClose={() => setShowToast(false)}
            />

        </div>

    );

};

export default BrandingScreen;