import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";

import { getDatabase, ref, update } from "firebase/database";

import { useUserCompany } from "../../../../../contexts/companyContext/UserCompanyContext";
import Toast from "../../../../../components/toast/Toast";

const SOCIALS = [
    {
        id: "instagram",
        name: "Instagram",
        icon: "mdi:instagram",
        baseUrl: "https://instagram.com/"
    },
    {
        id: "facebook",
        name: "Facebook",
        icon: "mdi:facebook",
        baseUrl: "https://facebook.com/"
    },
    {
        id: "tiktok",
        name: "TikTok",
        icon: "ic:baseline-tiktok",
        baseUrl: "https://tiktok.com/@"
    },
    {
        id: "x",
        name: "X",
        icon: "prime:twitter",
        baseUrl: "https://x.com/"
    },
    {
        id: "youtube",
        name: "YouTube",
        icon: "mdi:youtube",
        baseUrl: "https://youtube.com/@"
    }
];

const createInitialForm = () => {

    const data = {};

    SOCIALS.forEach((social) => {

        data[social.id] = {
            handle: "",
            link: ""
        };

    });

    return data;

};

const SocialMediaScreen = () => {

    const { company } = useUserCompany();

    const [form, setForm] = useState(createInitialForm);
    const [initialForm, setInitialForm] = useState(createInitialForm);

    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState("success");
    const [toastTitle, setToastTitle] = useState("");
    const [toastMessage, setToastMessage] = useState("");

    useEffect(() => {

        if (!company) return;

        const socialMedia = company.socialMedia || {};

        const data = createInitialForm();

        SOCIALS.forEach((social) => {

            data[social.id] = {

                handle:
                    socialMedia[social.id]?.handle || "",

                link:
                    socialMedia[social.id]?.link || ""

            };

        });

        setForm(data);
        setInitialForm(data);

    }, [company]);

    const openToast = (type, title, message) => {

        setToastType(type);
        setToastTitle(title);
        setToastMessage(message);
        setShowToast(true);

    };

    const handleChange = (social, value) => {

        let handle = value.trim();

        // Remove espaços
        handle = handle.replace(/\s/g, "");

        // Remove @ do início para evitar duplicação
        handle = handle.replace(/^@+/, "");

        const socialConfig = SOCIALS.find(
            item => item.id === social
        );

        const link = handle
            ? `${socialConfig.baseUrl}${handle}`
            : "";

        setForm(prev => ({

            ...prev,

            [social]: {
                handle,
                link
            }

        }));

    };

    const hasChanges =
        JSON.stringify(form) !== JSON.stringify(initialForm);

    const handleSave = async () => {

        if (!company?.handle) {

            openToast(
                "error",
                "Empresa não encontrada",
                "Não foi possível identificar a empresa."
            );

            return;

        }

        try {

            const db = getDatabase();

            await update(
                ref(db, `companys/${company.handle}`),
                {
                    socialMedia: form
                }
            );

            setInitialForm(form);

            openToast(
                "success",
                "Sucesso",
                "Redes sociais atualizadas com sucesso."
            );

        } catch (error) {

            console.error(error);

            openToast(
                "error",
                "Erro ao salvar",
                "Não foi possível salvar as redes sociais."
            );

        }

    };

    return (

        <div className="company-screen">

            <div className="company-card social-media-card">

                {SOCIALS.map((social) => (

                    <div
                        className="company-input-group"
                        key={social.id}
                    >

                        <Icon
                            icon={social.icon}
                            className="company-input-icon"
                        />

                        <input
                            className="company-input"
                            type="text"
                            placeholder={`${social.name} @`}
                            value={
                                form[social.id]?.handle
                                    ? `@${form[social.id].handle}`
                                    : ""
                            }
                            onChange={(e) =>
                                handleChange(
                                    social.id,
                                    e.target.value
                                )
                            }
                        />

                    </div>

                ))}

            </div>

            <button
                disabled={!hasChanges}
                onClick={handleSave}
                className={`company-save ${!hasChanges ? "disabled" : ""
                    }`}
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

export default SocialMediaScreen;