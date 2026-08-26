import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { getDatabase, ref, update } from "firebase/database";

import { useUserCompany } from "../../../../../contexts/companyContext/UserCompanyContext";
import Toast from "../../../../../components/toast/Toast";

const emptyLocation = {
    street: "",
    number: "",
    neighborhood: "",
    city: "",
    state: "",
    zipCode: "",
    country: ""
};

const LocationScreen = () => {

    const { company } = useUserCompany();

    const [location, setLocation] = useState(emptyLocation);
    const [initialLocation, setInitialLocation] = useState(emptyLocation);

    const [editing, setEditing] = useState(false);
    const [loadingLocation, setLoadingLocation] = useState(false);

    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState("success");
    const [toastTitle, setToastTitle] = useState("");
    const [toastMessage, setToastMessage] = useState("");

    useEffect(() => {

        if (!company) return;

        const companyLocation = company.location || {};

        const data = {
            street: companyLocation.street || "",
            number: companyLocation.number || "",
            neighborhood: companyLocation.neighborhood || "",
            city: companyLocation.city || "",
            state: companyLocation.state || "",
            zipCode: companyLocation.zipCode || "",
            country: companyLocation.country || ""
        };

        setLocation(data);
        setInitialLocation(data);

        const hasLocation = Object.values(data).some(Boolean);

        setEditing(!hasLocation);

    }, [company]);

    const openToast = (type, title, message) => {

        setToastType(type);
        setToastTitle(title);
        setToastMessage(message);
        setShowToast(true);

    };

    const handleChange = (e) => {

        const { name, value } = e.target;

        setLocation(prev => ({
            ...prev,
            [name]: value
        }));

    };

    const hasLocation = Object.values(location).some(
        value => value.trim() !== ""
    );

    const hasChanges =
        JSON.stringify(location) !== JSON.stringify(initialLocation);

    const handleDeviceLocation = () => {

        if (!navigator.geolocation) {

            openToast(
                "error",
                "Localização indisponível",
                "Seu dispositivo não oferece suporte à localização."
            );

            return;

        }

        setLoadingLocation(true);

        navigator.geolocation.getCurrentPosition(

            async (position) => {

                try {

                    const { latitude, longitude } = position.coords;

                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
                        {
                            headers: {
                                Accept: "application/json"
                            }
                        }
                    );

                    if (!response.ok) {
                        throw new Error("Erro ao buscar endereço.");
                    }

                    const data = await response.json();

                    const address = data.address || {};

                    const newLocation = {

                        street:
                            address.road ||
                            address.pedestrian ||
                            address.residential ||
                            "",

                        number:
                            address.house_number || "",

                        neighborhood:
                            address.neighbourhood ||
                            address.suburb ||
                            "",

                        city:
                            address.city ||
                            address.town ||
                            address.village ||
                            "",

                        state:
                            address.state || "",

                        zipCode:
                            address.postcode || "",

                        country:
                            address.country || ""

                    };

                    setLocation(newLocation);
                    setEditing(true);

                    openToast(
                        "success",
                        "Localização encontrada",
                        "Confira os dados antes de salvar."
                    );

                } catch (error) {

                    console.error(error);

                    openToast(
                        "error",
                        "Erro ao localizar",
                        "Não foi possível obter o endereço."
                    );

                } finally {

                    setLoadingLocation(false);

                }

            },

            (error) => {

                console.error(error);

                setLoadingLocation(false);

                openToast(
                    "error",
                    "Localização negada",
                    "Permita o acesso à localização para continuar."
                );

            },

            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }

        );

    };

    const handleSave = async () => {

        if (!location.street.trim()) {

            openToast(
                "error",
                "Endereço incompleto",
                "Informe a rua ou avenida."
            );

            return;

        }

        if (!location.city.trim()) {

            openToast(
                "error",
                "Cidade obrigatória",
                "Informe a cidade."
            );

            return;

        }

        if (!location.state.trim()) {

            openToast(
                "error",
                "Estado obrigatório",
                "Informe o estado."
            );

            return;

        }

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
                    location
                }
            );

            setInitialLocation(location);
            setEditing(false);

            openToast(
                "success",
                "Sucesso",
                "Endereço atualizado com sucesso."
            );

        } catch (error) {

            console.error(error);

            openToast(
                "error",
                "Erro ao salvar",
                "Não foi possível salvar o endereço."
            );

        }

    };

    if (!editing && hasLocation) {

        return (

            <div className="company-screen">

                <div className="company-card location-card">

                    <div className="location-summary">

                        <div className="location-summary-icon">

                            <Icon icon="solar:map-point-outline" />

                        </div>

                        <div className="location-summary-content">

                            <strong>
                                {location.street}
                                {location.number
                                    ? `, ${location.number}`
                                    : ""}
                            </strong>

                            <span>
                                {location.neighborhood}
                                {location.city
                                    ? ` • ${location.city}`
                                    : ""}
                            </span>

                            <span>
                                {location.state}
                                {location.zipCode
                                    ? ` • ${location.zipCode}`
                                    : ""}
                            </span>

                        </div>

                    </div>

                    <button
                        className="location-edit-button"
                        onClick={() => setEditing(true)}
                    >

                        <Icon icon="solar:pen-outline" />

                        Editar

                    </button>

                </div>

                <Toast
                    show={showToast}
                    type={toastType}
                    title={toastTitle}
                    message={toastMessage}
                    onClose={() => setShowToast(false)}
                />

            </div>

        );

    }

    return (

        <div className="company-screen">

            <div className="company-card">

                <div className="location-actions">

                    <button
                        className="location-action"
                        onClick={handleDeviceLocation}
                        disabled={loadingLocation}
                    >

                        <Icon
                            icon={
                                loadingLocation
                                    ? "line-md:loading-twotone-loop"
                                    : "solar:gps-outline"
                            }
                        />

                        <div>

                            <strong>
                                {loadingLocation
                                    ? "Localizando..."
                                    : "Usar minha localização"}
                            </strong>

                            <span>
                                Preencher automaticamente pelo dispositivo
                            </span>

                        </div>

                    </button>

                </div>

                <div className="location-divider">

                    <span>ou preencha manualmente</span>

                </div>

                <div className="company-input-group">

                    <Icon
                        icon="solar:map-point-outline"
                        className="company-input-icon"
                    />

                    <input
                        className="company-input"
                        name="street"
                        placeholder="Rua ou avenida"
                        value={location.street}
                        onChange={handleChange}
                    />

                </div>

                <div className="company-input-group">

                    <Icon
                        icon="solar:hashtag-outline"
                        className="company-input-icon"
                    />

                    <input
                        className="company-input"
                        name="number"
                        placeholder="Número"
                        value={location.number}
                        onChange={handleChange}
                    />

                </div>

                <div className="company-input-group">

                    <Icon
                        icon="solar:buildings-2-outline"
                        className="company-input-icon"
                    />

                    <input
                        className="company-input"
                        name="neighborhood"
                        placeholder="Bairro"
                        value={location.neighborhood}
                        onChange={handleChange}
                    />

                </div>

                <div className="company-input-group">

                    <Icon
                        icon="solar:city-outline"
                        className="company-input-icon"
                    />

                    <input
                        className="company-input"
                        name="city"
                        placeholder="Cidade"
                        value={location.city}
                        onChange={handleChange}
                    />

                </div>

                <div className="company-input-group">

                    <Icon
                        icon="solar:flag-outline"
                        className="company-input-icon"
                    />

                    <input
                        className="company-input"
                        name="state"
                        placeholder="Estado"
                        value={location.state}
                        onChange={handleChange}
                    />

                </div>

                <div className="company-input-group">

                    <Icon
                        icon="solar:mailbox-outline"
                        className="company-input-icon"
                    />

                    <input
                        className="company-input"
                        name="zipCode"
                        placeholder="CEP"
                        value={location.zipCode}
                        onChange={handleChange}
                    />

                </div>

            </div>

            <button
                className={`company-save ${!hasChanges ? "disabled" : ""}`}
                disabled={!hasChanges}
                onClick={handleSave}
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

export default LocationScreen;