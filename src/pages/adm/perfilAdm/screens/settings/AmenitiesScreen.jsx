import React, { useEffect, useState } from "react";
import { Icon } from "@iconify/react";

import {
    getDatabase,
    ref,
    get,
    update
} from "firebase/database";

import Toast from "../../../../../components/toast/Toast";

import { getAuth } from "firebase/auth";

const AMENITIES = [

    {
        id: "wifi",
        name: "Wi-Fi",
        description: "Disponibiliza internet Wi-Fi para os clientes.",
        icon: "akar-icons:wifi"
    },

    {
        id: "parking",
        name: "Estacionamento",
        description: "Possui estacionamento para clientes.",
        icon: "fluent:vehicle-car-parking-16-regular"
    },

    {
        id: "accessibility",
        name: "Acessibilidade",
        description: "Espaço preparado para pessoas com deficiência.",
        icon: "solar:accessibility-outline"
    },

    {
        id: "airConditioning",
        name: "Ar-condicionado",
        description: "Ambiente climatizado.",
        icon: "solar:wind-outline"
    },

    {
        id: "bathroom",
        name: "Banheiro",
        description: "Possui banheiro disponível para clientes.",
        icon: "cil:bathroom"
    },

    {
        id: "waitingRoom",
        name: "Sala de espera",
        description: "Possui espaço para clientes aguardarem.",
        icon: "solar:armchair-2-outline"
    },

    {
        id: "television",
        name: "Televisão",
        description: "Disponibiliza televisão para entretenimento dos clientes.",
        icon: "solar:tv-outline"
    },

    {
        id: "videoGame",
        name: "Videogame",
        description: "Disponibiliza videogame para os clientes.",
        icon: "solar:gamepad-outline"
    },

    {
        id: "music",
        name: "Música ambiente",
        description: "Possui música ambiente no estabelecimento.",
        icon: "solar:music-note-outline"
    },

    {
        id: "petFriendly",
        name: "Pet friendly",
        description: "Permite a entrada de animais de estimação.",
        icon: "solar:cat-outline"
    },

    {
        id: "coffee",
        name: "Café e água",
        description: "Oferece café, água ou outras bebidas aos clientes.",
        icon: "solar:cup-outline"
    },

    {
        id: "snacks",
        name: "Lanches",
        description: "Disponibiliza lanches ou pequenos alimentos aos clientes.",
        icon: "ic:outline-lunch-dining"
    },

    {
        id: "powerOutlet",
        name: "Tomadas",
        description: "Ddadisponibiliza tomadas para os clientes.",
        icon: "solar:plug-circle-outline"
    },

    {
        id: "charger",
        name: "Carregador",
        description: "Disponibiliza carregadores para dispositivos.",
        icon: "solar:battery-charge-outline"
    },

    {
        id: "outdoorArea",
        name: "Área externa",
        description: "Possui área externa disponível.",
        icon: "solar:buildings-3-outline"
    },

    {
        id: "smokingArea",
        name: "Área para fumantes",
        description: "Possui espaço destinado para fumantes.",
        icon: "streamline:smoking-area"
    },

    {
        id: "kidsArea",
        name: "Espaço infantil",
        description: "Possui espaço preparado para crianças.",
        icon: "solar:balloon-outline"
    },

    {
        id: "readingArea",
        name: "Espaço para leitura",
        description: "Disponibiliza livros ou espaço para leitura.",
        icon: "solar:book-outline"
    },

    {
        id: "freeDrinks",
        name: "Bebidas gratuitas",
        description: "Oferece bebidas gratuitamente aos clientes.",
        icon: "solar:bottle-outline"
    },

    {
        id: "security",
        name: "Segurança",
        description: "Possui recursos de segurança no estabelecimento.",
        icon: "solar:shield-check-outline"
    }

];


const AmenitiesScreen = ({ user }) => {

    const [amenities, setAmenities] = useState({});

    const [initialAmenities, setInitialAmenities] = useState({});

    const [companyHandle, setCompanyHandle] = useState("");

    const [loading, setLoading] = useState(true);

    const [saving, setSaving] = useState(false);

    const [toast, setToast] = useState({
        show: false,
        type: "success",
        title: "",
        message: ""
    });

    /*
     * ==========================================
     * DESCOBRIR EMPRESA
     * ==========================================
     */

    useEffect(() => {

        const loadCompany = async () => {

            try {

                const auth = getAuth();

                const currentUser =
                    auth.currentUser;

                if (!currentUser) {

                    setLoading(false);

                    return;

                }

                const db =
                    getDatabase();


                /*
                 * Primeiro tenta utilizar
                 * os dados já carregados pelo PerfilAdm.
                 */

                const directHandle =
                    user?.companyHandle ||
                    user?.company?.handle ||
                    user?.handle;


                if (directHandle) {

                    setCompanyHandle(
                        directHandle
                    );

                    await loadAmenities(
                        directHandle
                    );

                    return;

                }


                /*
                 * Caso o handle não esteja
                 * diretamente no usuário,
                 * procura nas empresas.
                 */

                const companiesRef =
                    ref(
                        db,
                        "companys"
                    );

                const snapshot =
                    await get(
                        companiesRef
                    );


                if (!snapshot.exists()) {

                    setLoading(false);

                    return;

                }


                const companies =
                    snapshot.val();


                let foundHandle = "";


                Object.entries(companies)
                    .some(([handle, company]) => {

                        if (!company) {
                            return false;
                        }


                        const ownerId =
                            company.ownerId ||
                            company.ownerUid ||
                            company.uid ||
                            company.userId;


                        if (
                            ownerId ===
                            currentUser.uid
                        ) {

                            foundHandle =
                                handle;

                            return true;

                        }


                        /*
                         * Alguns projetos armazenam
                         * administradores/membros.
                         */

                        if (
                            company.members &&
                            typeof company.members === "object"
                        ) {

                            const isMember =
                                Object.values(
                                    company.members
                                ).some(member => {

                                    if (
                                        typeof member === "string"
                                    ) {

                                        return (
                                            member ===
                                            currentUser.uid
                                        );

                                    }

                                    return (
                                        member?.uid ===
                                        currentUser.uid
                                    );

                                });


                            if (isMember) {

                                foundHandle =
                                    handle;

                                return true;

                            }

                        }


                        return false;

                    });


                if (foundHandle) {

                    setCompanyHandle(
                        foundHandle
                    );

                    await loadAmenities(
                        foundHandle
                    );

                } else {

                    setLoading(false);

                }

            } catch (error) {

                console.error(
                    "Erro ao localizar empresa:",
                    error
                );

                setLoading(false);

            }

        };


        loadCompany();

    }, [user]);


    /*
     * ==========================================
     * CARREGAR COMODIDADES
     * ==========================================
     */

    const loadAmenities = async (handle) => {

        try {

            const db =
                getDatabase();


            const amenitiesRef =
                ref(
                    db,
                    `companys/${handle}/amenities`
                );


            const snapshot =
                await get(
                    amenitiesRef
                );


            const saved =
                snapshot.exists()
                    ? snapshot.val()
                    : {};


            const normalized = {};


            AMENITIES.forEach(amenity => {

                normalized[amenity.id] =
                    saved[amenity.id] === true;

            });


            setAmenities(
                normalized
            );

            setInitialAmenities(
                JSON.parse(
                    JSON.stringify(normalized)
                )
            );

        } catch (error) {

            console.error(
                "Erro ao carregar comodidades:",
                error
            );

        } finally {

            setLoading(false);

        }

    };


    /*
     * ==========================================
     * ALTERAR COMODIDADE
     * ==========================================
     */

    const toggleAmenity = (id) => {

        setAmenities(prev => ({

            ...prev,

            [id]: !prev[id]

        }));

    };


    /*
     * ==========================================
     * VERIFICAR ALTERAÇÕES
     * ==========================================
     */

    const hasChanges =
        JSON.stringify(amenities) !==
        JSON.stringify(initialAmenities);


    /*
     * ==========================================
     * SALVAR
     * ==========================================
     */

    const handleSave = async () => {

        if (
            !companyHandle ||
            !hasChanges ||
            saving
        ) {
            return;
        }


        try {

            setSaving(true);


            const db =
                getDatabase();


            const amenitiesRef =
                ref(
                    db,
                    `companys/${companyHandle}/amenities`
                );


            await update(
                amenitiesRef,
                amenities
            );


            setInitialAmenities(
                JSON.parse(
                    JSON.stringify(amenities)
                )
            );


            setToast({
                show: true,
                type: "success",
                title: "Comodidades atualizadas",
                message:
                    "As comodidades da empresa foram salvas com sucesso."
            });


        } catch (error) {

            console.error(
                "Erro ao salvar comodidades:",
                error
            );


            setToast({
                show: true,
                type: "error",
                title: "Erro ao salvar",
                message:
                    "Não foi possível salvar as comodidades. Tente novamente."
            });


        } finally {

            setSaving(false);

        }

    };


    /*
     * ==========================================
     * LOADING
     * ==========================================
     */

    if (loading) {

        return (

            <div className="company-screen">

                <div className="company-card amenities-card">

                    <div className="amenities-loading">

                        <span />

                        <span />

                        <span />

                    </div>

                </div>

            </div>

        );

    }


    /*
     * ==========================================
     * RENDER
     * ==========================================
     */

    return (

        <div className="company-screen">

            <div className="amenities-description">

                <p>
                    Selecione as comodidades disponíveis
                    no seu estabelecimento.
                </p>

            </div>


            <div className="company-card amenities-card">

                {AMENITIES.map((amenity) => (

                    <div
                        key={amenity.id}
                        className="amenity-row"
                    >

                        <div className="amenity-left">

                            <div className="amenity-icon">

                                <Icon
                                    icon={amenity.icon}
                                />

                            </div>


                            <div className="amenity-info">

                                <span className="amenity-name">
                                    {amenity.name}
                                </span>

                                <small>
                                    {amenity.description}
                                </small>

                            </div>

                        </div>


                        <button
                            type="button"
                            className={`amenity-toggle ${amenities[amenity.id]
                                ? "active"
                                : ""
                                }`}
                            onClick={() =>
                                toggleAmenity(
                                    amenity.id
                                )
                            }
                            aria-label={`Ativar ${amenity.name}`}
                            aria-pressed={
                                amenities[amenity.id]
                            }
                        >

                            <span />

                        </button>

                    </div>

                ))}

            </div>

            <button
                type="button"
                className={`company-save ${!hasChanges || saving
                    ? "disabled"
                    : ""
                    }`}
                disabled={
                    !hasChanges ||
                    saving
                }
                onClick={handleSave}
            >

                {saving
                    ? "Salvando..."
                    : "Salvar alterações"}

            </button>

            <Toast
                show={toast.show}
                type={toast.type}
                title={toast.title}
                message={toast.message}
                onClose={() =>
                    setToast(prev => ({
                        ...prev,
                        show: false
                    }))
                }
            />
        </div>

    );

};


export default AmenitiesScreen;