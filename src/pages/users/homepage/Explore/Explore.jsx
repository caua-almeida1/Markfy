import React, {
    useDeferredValue,
    useEffect,
    useMemo,
    useState
} from "react";

import { Icon } from "@iconify/react";

import { useCompaniesIndex }
    from "../../../../firebase/useCompaniesIndex";

import { useCompanyLogos }
    from "../../../../firebase/companyLogo";

import "./explore.css";

import {
    CATEGORY_GROUPS,
    COMPANY_CATEGORIES
} from "../../../../utils/companyCategories";

import CompanyInfoModal
    from "../../../users/CompanyInfoModal/CompanyInfoModal";


const Explore = () => {

    /*
     * Mesma fonte e mesmo critério da central do usuário:
     * só empresas elegíveis (plano ativo com Bookings), em
     * destaque primeiro. Ver firebase/useCompaniesIndex.js e
     * utils/companyEligibility.js.
     */
    const {
        companies,
        loading,
        error: loadError,
        reload: reloadCompanies
    } = useCompaniesIndex();

    const [searchTerm, setSearchTerm] = useState("");

    /* Digitação sem travar: o filtro segue um passo atrás. */
    const deferredSearchTerm = useDeferredValue(searchTerm);

    const [searchFocused, setSearchFocused] =
        useState(false);


    const [nearbyLoading, setNearbyLoading] = useState(false);

    /*
    =========================================================
    EMPRESA SELECIONADA
    =========================================================
    */

    const [selectedCompany, setSelectedCompany] =
        useState(null);

    const [userLocation, setUserLocation] =
        useState(null);

    const [locationStatus, setLocationStatus] =
        useState("idle");

    const [nearbyCompanies, setNearbyCompanies] =
        useState([]);

    const [cep, setCep] =
        useState("");

    const [cepLoading, setCepLoading] =
        useState(false);

    const [cepError, setCepError] =
        useState("");

    const [locationMethod, setLocationMethod] =
        useState(null);

    const [categoryExplorerOpen, setCategoryExplorerOpen] =
        useState(false);

    const [activeCategoryGroup, setActiveCategoryGroup] =
        useState(null);

    const [activeCategoryId, setActiveCategoryId] =
        useState(null);

    const [categorySearch, setCategorySearch] = useState('');




    /*
    =========================================================
    PESQUISA
    =========================================================
    */

    const filteredCompanies = useMemo(() => {

        const term =
            deferredSearchTerm
                .trim()
                .toLowerCase();

        if (!term) {

            return companies;
        }

        return companies.filter(
            (company) => {

                const name =
                    String(
                        company.name || ""
                    ).toLowerCase();

                const description =
                    String(
                        company.description || ""
                    ).toLowerCase();

                const handle =
                    String(
                        company.handle || ""
                    ).toLowerCase();

                return (
                    name.includes(term) ||
                    description.includes(term) ||
                    handle.includes(term)
                );

            }
        );

    }, [
        companies,
        deferredSearchTerm
    ]);


    /*
    =========================================================
    EMPRESAS EM DESTAQUE
    =========================================================
    */

    const featuredCompanies = useMemo(() => {

        if (searchTerm.trim()) {

            return [];
        }

        /* A lista já vem ordenada pela regra central
           (destaque do plano, perfil completo, nome). */
        return companies.slice(0, 3);

    }, [
        companies,
        searchTerm
    ]);

    const companiesByCategory = useMemo(() => {

        if (!companies.length) {
            return [];
        }

        return COMPANY_CATEGORIES
            .map(category => {

                const categoryCompanies =
                    companies.filter(company => {

                        const categories =
                            Array.isArray(company.categories)
                                ? company.categories
                                : company.category
                                    ? [company.category]
                                    : [];

                        return categories.includes(
                            category.id
                        );

                    });

                return {
                    ...category,
                    companies: categoryCompanies
                };

            })
            .filter(category =>
                category.companies.length > 0
            );

    }, [
        companies
    ]);
    /*
    =========================================================
    HELPERS
    =========================================================
    */

    const getCompanyName = (company) => {

        return (
            company?.name ||
            "Empresa"
        );

    };


    const getCompanyDescription = (company) => {

        if (!company?.description) {

            return "Conheça esta empresa e seus serviços.";
        }

        return String(
            company.description
        )
            .replace(
                /<[^>]*>/g,
                ""
            )
            .trim();

    };


    /*
     * Logos resolvidas no Storage.
     *
     * Quando o índice já traz logoUrl (que é uma download
     * URL do Storage), ela é usada direto; quem não tem cai
     * no getDownloadURL de companys/{handle}/logo.png.
     * logoPreview do RTDB não entra: é o formato legado que
     * está sendo retirado de circulação.
     */
    const companyLogos = useCompanyLogos(companies);


    const getCompanyLogo = (company) => {

        return (
            companyLogos[company?.handle] ||
            ""
        );

    };


    const getCompanyHandle = (company) => {

        return (
            company?.handle ||
            ""
        );

    };


    /*
    =========================================================
    ABRIR COMPANY INFO MODAL
    =========================================================
    */

    const openCompanyInfo = (company) => {

        if (!company) {
            return;
        }

        setSelectedCompany(
            company
        );

    };


    /*
    =========================================================
    FECHAR COMPANY INFO MODAL
    =========================================================
    */

    const closeCompanyInfo = () => {

        setSelectedCompany(null);

    };


    /*
    =========================================================
    LIMPAR PESQUISA
    =========================================================
    */

    const clearSearch = () => {

        setSearchTerm("");

        setSearchFocused(false);

    };


    /*
    =========================================================
    COMPANY CARD
    =========================================================
    */

    const renderCompanyCard = (
        company,
        index
    ) => {

        const logo =
            getCompanyLogo(company);

        const name =
            getCompanyName(company);

        const description =
            getCompanyDescription(company);

        return (

            <button
                key={
                    company.handle ||
                    `company-${index}`
                }

                type="button"

                className="explore-company-card"

                style={{
                    "--explore-index": index
                }}

                onClick={() =>
                    openCompanyInfo(
                        company
                    )
                }
            >

                {/* LOGO */}

                <div className="explore-company-card-logo">

                    {logo ? (

                        <img
                            src={logo}
                            alt={name}
                        />

                    ) : (

                        <div className="explore-company-logo-fallback">

                            <Icon
                                icon="solar:shop-2-outline"
                            />

                        </div>

                    )}

                </div>


                {/* CONTEÚDO */}

                <div className="explore-company-card-content">

                    <div className="explore-company-card-title">

                        <h3>
                            {name}
                        </h3>

                        <Icon
                            icon="solar:verified-check-bold"
                        />

                    </div>


                    <p>
                        {description}
                    </p>


                    <span className="explore-company-handle">

                        <Icon
                            icon="solar:link-round-angle-linear"
                        />

                        @{getCompanyHandle(
                            company
                        )}

                    </span>

                </div>


                {/* SETA */}

                <div className="explore-company-arrow">

                    <Icon
                        icon="humbleicons:arrow-right"
                    />

                </div>

            </button>

        );

    };

    /*
=========================================================
LOCALIZAÇÃO
=========================================================
*/

    const MAX_NEARBY_DISTANCE = 15;


    /*
    =========================================================
    GEOCODIFICAR ENDEREÇO
    =========================================================
    */

    const geocodeAddress = async (location) => {

        if (
            !location ||
            typeof location !== "object"
        ) {
            return null;
        }


        const params = new URLSearchParams({

            street: [
                location.street,
                location.number
            ]
                .filter(Boolean)
                .join(", "),

            city:
                location.city || "",

            state:
                location.state || "",

            postalcode:
                location.zipCode ||
                location.cep ||
                "",

            country:
                location.country ||
                "Brasil",

            format: "jsonv2",

            limit: "1"

        });


        const url =
            `https://nominatim.openstreetmap.org/search?${params.toString()}`;


        try {

            const response =
                await fetch(
                    url,
                    {
                        headers: {
                            Accept:
                                "application/json"
                        }
                    }
                );


            if (!response.ok) {

                throw new Error(
                    `HTTP ${response.status}`
                );

            }


            const results =
                await response.json();


            if (!results.length) {

                return null;
            }


            const result =
                results[0];


            const latitude =
                Number(result.lat);

            const longitude =
                Number(result.lon);


            if (
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude)
            ) {

                return null;
            }


            return {
                latitude,
                longitude
            };

        } catch (error) {

            console.error(
                "Erro ao geocodificar endereço:",
                error
            );

            return null;

        }

    };


    /*
    =========================================================
    PEGAR ENDEREÇO DA EMPRESA
    =========================================================
    */

    const getCompanyLocation = (company) => {

        return (
            company?.location ||
            company?.address ||
            company?.endereco ||
            null
        );

    };


    /*
    =========================================================
    GEOCODIFICAR EMPRESA
    =========================================================
    */

    const geocodeCompanyAddress = async (company) => {

        /*
         * Se o índice já trouxe as coordenadas, não
         * precisamos consultar o geocodificador.
         */

        if (
            company?.coordinates?.latitude != null &&
            company?.coordinates?.longitude != null
        ) {

            return {
                latitude:
                    Number(company.coordinates.latitude),

                longitude:
                    Number(company.coordinates.longitude)
            };

        }


        const location =
            getCompanyLocation(
                company
            );


        if (!location) {

            console.warn(
                "⚠️ Empresa sem endereço:",
                company?.name
            );

            return null;
        }


        console.log(
            "🌎 Geocodificando:",
            company.name
        );


        const coordinates =
            await geocodeAddress(
                location
            );


        if (!coordinates) {

            console.warn(
                "⚠️ Não foi possível localizar:",
                company.name,
                location
            );

            return null;
        }


        console.log(
            "📍",
            company.name,
            coordinates
        );


        return coordinates;

    };


    /*
    =========================================================
    DISTÂNCIA ENTRE DOIS PONTOS
    =========================================================
    */

    const calculateDistance = (
        latitude1,
        longitude1,
        latitude2,
        longitude2
    ) => {

        const earthRadius = 6371;


        const toRadians = (value) =>
            value * Math.PI / 180;


        const dLatitude =
            toRadians(
                latitude2 -
                latitude1
            );


        const dLongitude =
            toRadians(
                longitude2 -
                longitude1
            );


        const a =
            Math.sin(
                dLatitude / 2
            ) ** 2 +

            Math.cos(
                toRadians(latitude1)
            ) *

            Math.cos(
                toRadians(latitude2)
            ) *

            Math.sin(
                dLongitude / 2
            ) ** 2;


        const c =
            2 *
            Math.atan2(
                Math.sqrt(a),
                Math.sqrt(1 - a)
            );


        return earthRadius * c;

    };


    /*
    =========================================================
    FORMATAR DISTÂNCIA
    =========================================================
    */

    const formatDistance = (distance) => {

        if (distance < 1) {

            return `${Math.round(
                distance * 1000
            )} m`;

        }


        return `${distance
            .toFixed(1)
            .replace(".", ",")} km`;

    };


    /*
    =========================================================
    ATIVAR LOCALIZAÇÃO DO DISPOSITIVO
    =========================================================
    */

    const enableLocation = () => {

        if (!navigator.geolocation) {

            setLocationStatus(
                "unavailable"
            );

            return;
        }


        setLocationStatus(
            "loading"
        );

        setCepError("");


        navigator.geolocation.getCurrentPosition(

            (position) => {

                const location = {

                    latitude:
                        position.coords.latitude,

                    longitude:
                        position.coords.longitude

                };


                console.log(
                    "📍 LOCALIZAÇÃO DO USUÁRIO:",
                    location
                );


                setUserLocation(
                    location
                );


                setLocationMethod(
                    "device"
                );


                setLocationStatus(
                    "enabled"
                );

            },


            (error) => {

                console.error(
                    "Erro ao obter localização:",
                    error
                );


                if (
                    error.code ===
                    error.PERMISSION_DENIED
                ) {

                    setLocationStatus(
                        "denied"
                    );

                    return;
                }


                setLocationStatus(
                    "unavailable"
                );

            },


            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 300000
            }

        );

    };


    /*
    =========================================================
    LOCALIZAR USUÁRIO PELO CEP
    =========================================================
    */

    const searchByCep = async () => {

        const cleanCep =
            cep.replace(
                /\D/g,
                ""
            );


        if (
            cleanCep.length !== 8
        ) {

            setCepError(
                "Digite um CEP válido."
            );

            return;
        }


        setCepLoading(true);

        setCepError("");

        setLocationStatus(
            "loading"
        );


        try {

            console.log(
                "📮 BUSCANDO CEP:",
                cleanCep
            );


            /*
            Primeiro consultamos o CEP
            para obter o endereço brasileiro.
            */

            const viaCepResponse =
                await fetch(
                    `https://viacep.com.br/ws/${cleanCep}/json/`
                );


            if (
                !viaCepResponse.ok
            ) {

                throw new Error(
                    "Não foi possível consultar o CEP."
                );

            }


            const viaCep =
                await viaCepResponse.json();


            if (viaCep.erro) {

                throw new Error(
                    "CEP não encontrado."
                );

            }


            console.log(
                "📮 ENDEREÇO DO CEP:",
                viaCep
            );


            /*
            Agora transformamos o endereço
            em latitude e longitude.
            */

            const coordinates =
                await geocodeAddress({

                    street:
                        viaCep.logradouro,

                    number:
                        "",

                    city:
                        viaCep.localidade,

                    state:
                        viaCep.uf,

                    zipCode:
                        cleanCep,

                    country:
                        "Brasil"

                });


            if (!coordinates) {

                throw new Error(
                    "Não foi possível encontrar a localização deste CEP."
                );

            }


            console.log(
                "🌎 COORDENADAS DO CEP:",
                coordinates
            );


            setUserLocation(
                coordinates
            );


            setLocationMethod(
                "cep"
            );


            setLocationStatus(
                "enabled"
            );


        } catch (error) {

            console.error(
                "❌ Erro ao buscar CEP:",
                error
            );


            setCepError(
                error.message ||
                "Não foi possível localizar este CEP."
            );


            setLocationStatus(
                "idle"
            );


        } finally {

            setCepLoading(false);

        }

    };


    /*
    =========================================================
    CALCULAR EMPRESAS PRÓXIMAS
    =========================================================
    */

    useEffect(() => {

        if (!userLocation) {

            setNearbyCompanies([]);
            setNearbyLoading(false);

            return;
        }


        if (!companies.length) {

            /*
             * Ainda estamos esperando as empresas
             * chegarem do Firebase.
             */

            if (loading) {
                setNearbyLoading(true);
            } else {
                setNearbyLoading(false);
            }

            return;
        }


        let cancelled = false;


        const calculateNearbyCompanies =
            async () => {

                /*
                ================================================
                COMEÇOU A BUSCA
                ================================================
                */

                setNearbyLoading(true);
                setNearbyCompanies([]);


                console.log(
                    "========================================"
                );

                console.log(
                    "📍 LOCALIZAÇÃO DO USUÁRIO:",
                    userLocation
                );

                console.log(
                    "📏 RAIO:",
                    MAX_NEARBY_DISTANCE,
                    "km"
                );


                const results = [];


                try {

                    for (
                        const company of companies
                    ) {

                        if (cancelled) {
                            return;
                        }


                        const coordinates =
                            await geocodeCompanyAddress(
                                company
                            );


                        if (!coordinates) {
                            continue;
                        }


                        const distance =
                            calculateDistance(

                                userLocation.latitude,

                                userLocation.longitude,

                                coordinates.latitude,

                                coordinates.longitude

                            );


                        console.log(
                            `📏 ${company.name}: ${distance.toFixed(2)} km`
                        );


                        if (
                            distance <=
                            MAX_NEARBY_DISTANCE
                        ) {

                            results.push({

                                ...company,

                                distance,

                                coordinates

                            });

                        }


                        /*
                        Respeita o limite do Nominatim.
                        */

                        await new Promise(
                            (resolve) =>
                                setTimeout(
                                    resolve,
                                    1100
                                )
                        );

                    }


                    if (cancelled) {
                        return;
                    }


                    results.sort(
                        (a, b) =>
                            a.distance -
                            b.distance
                    );


                    console.log(
                        "========================================"
                    );

                    console.log(
                        "🏆 EMPRESAS EM ATÉ 15 KM:"
                    );

                    console.table(
                        results.map(
                            (company) => ({

                                empresa:
                                    company.name,

                                distancia:
                                    `${company.distance.toFixed(2)} km`,

                                latitude:
                                    company.coordinates.latitude,

                                longitude:
                                    company.coordinates.longitude

                            })
                        )
                    );

                    console.log(
                        "========================================"
                    );


                    setNearbyCompanies(
                        results
                    );


                } catch (error) {

                    console.error(
                        "Erro ao encontrar empresas próximas:",
                        error
                    );


                    if (!cancelled) {

                        setNearbyCompanies([]);

                    }

                } finally {

                    if (!cancelled) {

                        /*
                        ==========================================
                        TERMINOU A BUSCA
                        ==========================================
                        */

                        setNearbyLoading(false);

                    }

                }

            };


        calculateNearbyCompanies();


        return () => {

            cancelled = true;

        };


    }, [
        companies,
        userLocation,
        loading
    ]);
    /*
    =========================================================
    RENDER
    =========================================================
    */

    const getCategoryById = (categoryId) => {

        return COMPANY_CATEGORIES.find(
            category =>
                category.id === categoryId
        );

    };


    const getCompaniesForCategory = (categoryId) => {
        const search = categorySearch.trim().toLowerCase();

        return companies.filter(company => {
            const categories = Array.isArray(company.categories)
                ? company.categories
                : company.category
                    ? [company.category]
                    : [];

            if (!categories.includes(categoryId)) {
                return false;
            }

            if (!search) {
                return true;
            }

            const name = getCompanyName(company).toLowerCase();
            const description = getCompanyDescription(company).toLowerCase();
            const handle = getCompanyHandle(company).toLowerCase();

            return (
                name.includes(search) ||
                description.includes(search) ||
                handle.includes(search)
            );
        });
    };

    const getAllCategoryCompanies = () => {

        const search =
            categorySearch
                .trim()
                .toLowerCase();

        if (!search) {
            return companies;
        }

        return companies.filter((company) => {

            const name =
                getCompanyName(company)
                    .toLowerCase();

            const description =
                getCompanyDescription(company)
                    .toLowerCase();

            const handle =
                getCompanyHandle(company)
                    .toLowerCase();

            return (
                name.includes(search) ||
                description.includes(search) ||
                handle.includes(search)
            );

        });
    };

    const openCategoryGroup = (group) => {
        setActiveCategoryGroup(group);
        setActiveCategoryId(null);
        setCategorySearch('');
        setCategoryExplorerOpen(true);
    };

    const closeCategoryExplorer = () => {

        setCategoryExplorerOpen(false);

        setActiveCategoryGroup(null);
        setActiveCategoryId(null);

    };

    const selectCategory = (categoryId) => {
        setActiveCategoryId(categoryId);
        setCategorySearch('');
    };

    return (

        <div className="explore-page">


            {/* =================================================
                HEADER
            ================================================= */}

            <header className="explore-header">

                <div className="explore-header-content">

                    <span className="explore-header-eyebrow">
                        DESCUBRA
                    </span>

                    <h1>
                        Explore
                    </h1>

                    <p>
                        Encontre empresas e descubra novos
                        serviços para agendar.
                    </p>

                </div>


                <div className="explore-header-icon">

                    <Icon
                        icon="solar:compass-linear"
                    />

                </div>

            </header>


            {/* =================================================
                PESQUISA
            ================================================= */}

            <section
                className={
                    searchFocused
                        ? "explore-search explore-search--focused"
                        : "explore-search"
                }
            >

                <Icon
                    icon="mdi:magnify"
                    className="explore-search-icon"
                />


                <input
                    type="text"
                    value={searchTerm}
                    placeholder="Buscar empresa..."

                    onFocus={() =>
                        setSearchFocused(true)
                    }

                    onChange={(event) =>
                        setSearchTerm(
                            event.target.value
                        )
                    }
                />


                {searchTerm && (

                    <button
                        type="button"
                        className="explore-search-clear"
                        onClick={
                            clearSearch
                        }
                        aria-label="Limpar pesquisa"
                    >

                        <Icon
                            icon="mdi:close-circle"
                        />

                    </button>

                )}

            </section>


            {/* =================================================
                PESQUISA
            ================================================= */}

            {searchTerm.trim() ? (

                <section className="explore-section">

                    <div className="explore-section-heading">

                        <div>

                            <span>
                                Pesquisa
                            </span>

                            <h2>
                                Resultados
                            </h2>

                        </div>

                        {!loading && (

                            <small>

                                {filteredCompanies.length}{" "}

                                {filteredCompanies.length === 1
                                    ? "empresa"
                                    : "empresas"}

                            </small>

                        )}

                    </div>


                    {loadError && !companies.length ? (

                        <div className="explore-empty" role="alert">

                            <div className="explore-empty-icon">

                                <Icon
                                    icon="solar:wifi-router-minimalistic-outline"
                                />

                            </div>

                            <h3>
                                Não foi possível carregar as empresas
                            </h3>

                            <p>
                                Confira sua conexão e tente de novo.
                            </p>

                            <button
                                type="button"
                                onClick={reloadCompanies}
                            >
                                Tentar de novo
                            </button>

                        </div>

                    ) : loading ? (

                        <div className="explore-loading">

                            <Icon
                                icon="svg-spinners:ring-resize"
                            />

                            <span>
                                Procurando empresas...
                            </span>

                        </div>

                    ) : filteredCompanies.length > 0 ? (

                        /*
                        AQUI CONTINUA VERTICAL
                        */

                        <div className="explore-company-list">

                            {filteredCompanies.map(
                                renderCompanyCard
                            )}

                        </div>

                    ) : (

                        <div className="explore-empty">

                            <div className="explore-empty-icon">

                                <Icon
                                    icon="mdi:magnify"
                                />

                            </div>

                            <h3>
                                Nenhuma empresa encontrada
                            </h3>

                            <p>
                                Tente buscar por outro nome
                                ou termo.
                            </p>

                            <button
                                type="button"
                                onClick={
                                    clearSearch
                                }
                            >
                                Limpar pesquisa
                            </button>

                        </div>

                    )}

                </section>

            ) : (

                <>


                    {/* =================================================
                        EM DESTAQUE
                    ================================================= */}

                    {!loading &&
                        featuredCompanies.length > 0 && (

                            <section className="explore-section">

                                <div className="explore-section-heading">

                                    <div>

                                        <span>
                                            Para você
                                        </span>

                                        <h2>
                                            Em destaque
                                        </h2>

                                        {featuredCompanies.some(
                                            (company) => company.featured
                                        ) && (
                                            <small className="explore-featured-disclosure">
                                                "Destaque" indica empresa com plano Pro ou Premium.
                                                As demais aparecem pela completude do perfil.
                                            </small>
                                        )}

                                    </div>

                                </div>


                                {/* =====================================
                                    ÚNICO SCROLL HORIZONTAL DA TELA
                                ===================================== */}

                                <div className="explore-featured-scroll">

                                    <div className="explore-featured">

                                        {featuredCompanies.map(
                                            (
                                                company,
                                                index
                                            ) => {

                                                const logo =
                                                    getCompanyLogo(
                                                        company
                                                    );

                                                const name =
                                                    getCompanyName(
                                                        company
                                                    );

                                                return (

                                                    <button
                                                        key={
                                                            company.handle ||
                                                            `featured-${index}`
                                                        }

                                                        type="button"

                                                        className="explore-featured-card"

                                                        style={{
                                                            "--explore-index":
                                                                index
                                                        }}

                                                        onClick={() =>
                                                            openCompanyInfo(
                                                                company
                                                            )
                                                        }
                                                    >

                                                        <div className="explore-featured-image">

                                                            {logo ? (

                                                                <img
                                                                    src={
                                                                        logo
                                                                    }
                                                                    alt={
                                                                        name
                                                                    }
                                                                />

                                                            ) : (

                                                                <Icon
                                                                    icon="solar:shop-2-outline"
                                                                />

                                                            )}

                                                        </div>


                                                        <div className="explore-featured-overlay" />


                                                        <div className="explore-featured-content">

                                                            <span>
                                                                {company.featured
                                                                    ? "Destaque"
                                                                    : "Empresa"}
                                                            </span>

                                                            <strong>
                                                                {name}
                                                            </strong>

                                                            <small>

                                                                <Icon
                                                                    icon="solar:arrow-right-linear"
                                                                />

                                                                Conhecer

                                                            </small>

                                                        </div>

                                                    </button>

                                                );

                                            }
                                        )}

                                    </div>

                                </div>

                            </section>

                        )}
                    {/* =================================================
    PERTO DE VOCÊ
================================================= */}

                    <section className="explore-section">

                        <div className="explore-section-heading">

                            <div>

                                <span>
                                    Localização
                                </span>

                                <h2>
                                    Perto de você
                                </h2>

                            </div>

                        </div>


                        {/* =================================================
        ESCOLHER LOCALIZAÇÃO
    ================================================= */}
                        {(
                            locationStatus === "idle" ||
                            locationStatus === "loading"
                        ) && (

                                <div className="explore-location-card">

                                    <div className="explore-location-icon">

                                        <Icon
                                            icon="solar:map-point-wave-linear"
                                        />

                                    </div>


                                    <div className="explore-location-content">

                                        <h3>
                                            Encontre empresas próximas
                                        </h3>

                                        <p>
                                            Escolha como deseja encontrar
                                            empresas perto de você.
                                        </p>


                                        <div className="explore-location-actions">

                                            <button
                                                type="button"
                                                onClick={enableLocation}
                                                disabled={locationStatus === "loading"}
                                            >

                                                {locationStatus === "loading" ? (

                                                    <>
                                                        <Icon
                                                            icon="svg-spinners:ring-resize"
                                                        />

                                                        Obtendo localização...

                                                    </>

                                                ) : (

                                                    <>
                                                        <Icon
                                                            icon="solar:map-point-outline"
                                                        />

                                                        Ativar localização

                                                    </>

                                                )}

                                            </button>


                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setLocationStatus(
                                                        "cep"
                                                    );
                                                    setCepError("");
                                                }}
                                            >

                                                <Icon
                                                    icon="solar:letter-linear"
                                                />

                                                Usar CEP

                                            </button>

                                        </div>



                                    </div>

                                </div>

                            )}


                        {/* =================================================
        DIGITANDO / BUSCANDO CEP
    ================================================= */}

                        {locationStatus === "cep" && (

                            <div className="explore-location-card">

                                <div className="explore-location-icon">

                                    <Icon
                                        icon="solar:map-point-wave-linear"
                                    />

                                </div>


                                <div className="explore-location-content">

                                    <h3>
                                        Encontre empresas pelo CEP
                                    </h3>

                                    <p>
                                        Digite seu CEP para encontrar
                                        empresas em até 15 km.
                                    </p>


                                    <div className="explore-location-cep">

                                        <div className="explore-location-cep-input">

                                            <Icon
                                                icon="solar:map-point-outline"
                                            />

                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                maxLength={9}
                                                placeholder="Digite seu CEP"
                                                value={cep}
                                                onChange={(event) => {

                                                    let value =
                                                        event.target.value
                                                            .replace(
                                                                /\D/g,
                                                                ""
                                                            )
                                                            .slice(
                                                                0,
                                                                8
                                                            );


                                                    if (
                                                        value.length > 5
                                                    ) {

                                                        value =
                                                            value.slice(
                                                                0,
                                                                5
                                                            ) +
                                                            "-" +
                                                            value.slice(
                                                                5
                                                            );

                                                    }


                                                    setCep(
                                                        value
                                                    );

                                                }}
                                            />

                                        </div>


                                        <button
                                            type="button"
                                            onClick={
                                                searchByCep
                                            }
                                            disabled={
                                                cepLoading
                                            }
                                        >

                                            {cepLoading ? (

                                                <Icon
                                                    icon="svg-spinners:ring-resize"
                                                />

                                            ) : (

                                                <Icon
                                                    icon="solar:magnifer-linear"
                                                />

                                            )}

                                            Buscar

                                        </button>

                                    </div>


                                    {cepError && (

                                        <span className="explore-location-error">

                                            {cepError}

                                        </span>

                                    )}


                                    <button
                                        type="button"
                                        className="explore-location-change"
                                        onClick={() => {

                                            setLocationStatus(
                                                "idle"
                                            );

                                            setCepError("");

                                        }}
                                    >

                                        ← Escolher outra opção

                                    </button>

                                </div>

                            </div>

                        )}

                        {/* =================================================
        LOCALIZAÇÃO NEGADA
    ================================================= */}

                        {locationStatus === "denied" && (

                            <div className="explore-location-card">

                                <div className="explore-location-icon">

                                    <Icon
                                        icon="solar:shield-warning-linear"
                                    />

                                </div>


                                <div className="explore-location-content">

                                    <h3>
                                        Localização não permitida
                                    </h3>

                                    <p>
                                        Você pode permitir o acesso à
                                        localização ou informar seu CEP.
                                    </p>


                                    <div className="explore-location-actions">

                                        <button
                                            type="button"
                                            onClick={
                                                enableLocation
                                            }
                                        >
                                            Tentar novamente
                                        </button>


                                        <button
                                            type="button"
                                            onClick={() =>
                                                setLocationStatus(
                                                    "cep"
                                                )
                                            }
                                        >
                                            Usar CEP
                                        </button>

                                    </div>

                                </div>

                            </div>

                        )}


                        {/* =================================================
        INDISPONÍVEL
    ================================================= */}

                        {locationStatus === "unavailable" && (

                            <div className="explore-location-card">

                                <div className="explore-location-icon">

                                    <Icon
                                        icon="solar:map-point-remove-linear"
                                    />

                                </div>


                                <div className="explore-location-content">

                                    <h3>
                                        Não foi possível obter sua localização
                                    </h3>

                                    <p>
                                        Você também pode informar seu CEP
                                        para encontrar empresas próximas.
                                    </p>


                                    <button
                                        type="button"
                                        onClick={() =>
                                            setLocationStatus(
                                                "cep"
                                            )
                                        }
                                    >

                                        Usar CEP

                                    </button>

                                </div>

                            </div>

                        )}


                        {/* =================================================
        EMPRESAS PRÓXIMAS
    ================================================= */}

                        {locationStatus === "enabled" && (

                            nearbyLoading ? (

                                /*
                                =====================================================
                                CARREGANDO EMPRESAS PRÓXIMAS
                                =====================================================
                                */

                                <div className="explore-nearby-loading">

                                    <div className="explore-nearby-loading-header">

                                        <div className="explore-skeleton explore-skeleton-location" />

                                        <div className="explore-skeleton explore-skeleton-distance" />

                                    </div>


                                    <div className="explore-nearby-skeleton-list">

                                        {[1, 2, 3].map((item) => (

                                            <div
                                                key={item}
                                                className="explore-nearby-skeleton-card"
                                            >

                                                <div className="explore-skeleton explore-skeleton-logo" />


                                                <div className="explore-nearby-skeleton-content">

                                                    <div className="explore-skeleton explore-skeleton-title" />

                                                    <div className="explore-skeleton explore-skeleton-description" />

                                                    <div className="explore-skeleton explore-skeleton-small" />

                                                </div>


                                                <div className="explore-skeleton explore-skeleton-arrow" />

                                            </div>

                                        ))}

                                    </div>


                                    <div className="explore-nearby-loading-text">

                                        <Icon
                                            icon="svg-spinners:ring-resize"
                                        />

                                        <span>
                                            Procurando empresas próximas...
                                        </span>

                                    </div>

                                </div>

                            ) : nearbyCompanies.length > 0 ? (

                                /*
                                =====================================================
                                EMPRESAS ENCONTRADAS
                                =====================================================
                                */

                                <>

                                    <div className="explore-nearby-info">

                                        <span>

                                            <Icon
                                                icon="solar:map-point-outline"
                                            />

                                            {locationMethod === "cep"
                                                ? `CEP ${cep}`
                                                : "Sua localização"}

                                        </span>


                                        <small>
                                            Até 15 km
                                        </small>

                                    </div>


                                    <div className="explore-company-list">

                                        {nearbyCompanies.map(
                                            (
                                                company,
                                                index
                                            ) => {

                                                const logo =
                                                    getCompanyLogo(
                                                        company
                                                    );

                                                const name =
                                                    getCompanyName(
                                                        company
                                                    );


                                                return (

                                                    <button
                                                        key={
                                                            company.handle ||
                                                            `nearby-${index}`
                                                        }

                                                        type="button"

                                                        className="explore-company-card"

                                                        onClick={() =>
                                                            openCompanyInfo(
                                                                company
                                                            )
                                                        }
                                                    >

                                                        <div className="explore-company-card-logo">

                                                            {logo ? (

                                                                <img
                                                                    src={logo}
                                                                    alt={name}
                                                                />

                                                            ) : (

                                                                <div className="explore-company-logo-fallback">

                                                                    <Icon
                                                                        icon="solar:shop-2-outline"
                                                                    />

                                                                </div>

                                                            )}

                                                        </div>


                                                        <div className="explore-company-card-content">

                                                            <div className="explore-company-card-title">

                                                                <h3>
                                                                    {name}
                                                                </h3>

                                                                <Icon
                                                                    icon="solar:verified-check-bold"
                                                                />

                                                            </div>


                                                            <p>
                                                                {getCompanyDescription(
                                                                    company
                                                                )}
                                                            </p>


                                                            <span className="explore-company-handle">

                                                                <Icon
                                                                    icon="solar:map-point-outline"
                                                                />

                                                                {formatDistance(
                                                                    company.distance
                                                                )}

                                                            </span>

                                                        </div>


                                                        <div className="explore-company-arrow">

                                                            <Icon
                                                                icon="humbleicons:arrow-right"
                                                            />

                                                        </div>

                                                    </button>

                                                );

                                            }
                                        )}

                                    </div>

                                </>

                            ) : (

                                /*
                                =====================================================
                                NENHUMA EMPRESA — SÓ APARECE DEPOIS QUE TERMINAR
                                =====================================================
                                */

                                <div className="explore-empty">

                                    <div className="explore-empty-icon">

                                        <Icon
                                            icon="solar:map-point-search-linear"
                                        />

                                    </div>


                                    <h3>
                                        Nenhuma empresa próxima
                                    </h3>


                                    <p>
                                        Não encontramos empresas em um raio
                                        de 15 km da sua localização.
                                    </p>


                                    <button
                                        type="button"
                                        onClick={() => {

                                            setLocationStatus(
                                                "idle"
                                            );

                                            setUserLocation(
                                                null
                                            );

                                            setNearbyCompanies(
                                                []
                                            );

                                            setNearbyLoading(
                                                false
                                            );

                                        }}
                                    >

                                        Alterar localização

                                    </button>

                                </div>

                            )

                        )}
                    </section>

                    {/* =================================================
                        TODAS AS EMPRESAS
                    ================================================= */}

                    {/* =================================================
    EXPLORADOR DE CATEGORIAS
================================================= */}

                    {!loading &&
                        companies.length > 0 && (

                            <section className="explore-section">

                                {!categoryExplorerOpen ? (

                                    <div className="explore-category-discovery">

                                        {/* =================================
                        CABEÇALHO
                    ================================= */}

                                        <div className="explore-category-discovery-header">

                                            <div>

                                                <span>
                                                    Descubra
                                                </span>

                                                <h2>
                                                    O que você procura?
                                                </h2>

                                            </div>

                                            <Icon
                                                icon="solar:compass-linear"
                                                className="explore-category-discovery-compass"
                                            />

                                        </div>


                                        {/* =================================
                        GRUPOS
                    ================================= */}

                                        <div className="explore-category-groups">

                                            {CATEGORY_GROUPS.map(
                                                (group) => (

                                                    <button
                                                        key={group.id}
                                                        type="button"
                                                        className="explore-category-group"
                                                        onClick={() =>
                                                            openCategoryGroup(
                                                                group
                                                            )
                                                        }
                                                    >

                                                        <div className="explore-category-group-icon">

                                                            <Icon
                                                                icon={group.icon}
                                                            />

                                                        </div>


                                                        <div className="explore-category-group-content">

                                                            <strong>
                                                                {group.name}
                                                            </strong>

                                                            <span>
                                                                {group.description}
                                                            </span>

                                                        </div>


                                                        <Icon
                                                            icon="solar:arrow-right-linear"
                                                            className="explore-category-group-arrow"
                                                        />

                                                    </button>

                                                )
                                            )}

                                        </div>


                                        {/* =================================
                        TODAS
                    ================================= */}

                                        <button
                                            type="button"
                                            className="explore-category-all"
                                            onClick={() => {

                                                setActiveCategoryGroup({
                                                    id: "all",
                                                    name: "Todas as categorias",
                                                    description:
                                                        "Explore todos os tipos de empresa",
                                                    icon:
                                                        "solar:widget-4-linear",
                                                    categories:
                                                        COMPANY_CATEGORIES.map(
                                                            category =>
                                                                category.id
                                                        )
                                                });

                                                setActiveCategoryId(null);
                                                setCategoryExplorerOpen(true);

                                            }}
                                        >

                                            <span>
                                                Explorar todas as categorias
                                            </span>

                                            <Icon
                                                icon="solar:arrow-right-linear"
                                            />

                                        </button>

                                    </div>

                                ) : (

                                    <div className="explore-category-browser">

                                        {/* =================================
                        HEADER
                    ================================= */}

                                        <div className="explore-category-browser-header">

                                            <button
                                                type="button"
                                                className="explore-category-browser-back"
                                                onClick={
                                                    closeCategoryExplorer
                                                }
                                            >

                                                <Icon
                                                    icon="solar:arrow-left-linear"
                                                />

                                            </button>


                                            <div>

                                                <span>
                                                    Categorias
                                                </span>

                                                <h2>
                                                    {activeCategoryGroup?.name}
                                                </h2>

                                            </div>

                                        </div>


                                        {/* =================================
                        CATEGORIAS INTERNAS
                    ================================= */}

                                        <div className="explore-category-tabs">

                                            {activeCategoryGroup?.categories.map(
                                                (categoryId) => {

                                                    const category =
                                                        getCategoryById(
                                                            categoryId
                                                        );

                                                    if (!category) {
                                                        return null;
                                                    }

                                                    const categoryCompanies =
                                                        getCompaniesForCategory(
                                                            category.id
                                                        );

                                                    return (

                                                        <button
                                                            key={category.id}
                                                            type="button"

                                                            className={
                                                                activeCategoryId === category.id
                                                                    ? "explore-category-tab active"
                                                                    : "explore-category-tab"
                                                            }

                                                            onClick={() =>
                                                                selectCategory(
                                                                    category.id
                                                                )
                                                            }
                                                        >

                                                            <Icon
                                                                icon={
                                                                    category.icon
                                                                }
                                                            />

                                                            <span>
                                                                {category.name}
                                                            </span>

                                                            {categoryCompanies.length > 0 && (

                                                                <small>
                                                                    {
                                                                        categoryCompanies.length
                                                                    }
                                                                </small>

                                                            )}

                                                        </button>

                                                    );

                                                }
                                            )}

                                        </div>


                                        {/* =================================
                        EMPRESAS
                    ================================= */}

                                        {activeCategoryId ? (
                                            <>
                                                <div className="explore-category-search">

                                                    <Icon
                                                        icon="solar:magnifer-linear"
                                                    />

                                                    <input
                                                        type="text"
                                                        value={categorySearch}
                                                        onChange={(e) =>
                                                            setCategorySearch(
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder={`Pesquisar em ${getCategoryById(
                                                            activeCategoryId
                                                        )?.name || "categoria"
                                                            }...`}
                                                    />

                                                    {categorySearch && (

                                                        <button
                                                            type="button"
                                                            className="explore-category-search-clear"
                                                            onClick={() =>
                                                                setCategorySearch("")
                                                            }
                                                            aria-label="Limpar pesquisa"
                                                        >

                                                            <Icon
                                                                icon="solar:close-circle-linear"
                                                            />

                                                        </button>

                                                    )}

                                                </div>


                                                {(() => {

                                                    const categoryCompanies =
                                                        getCompaniesForCategory(
                                                            activeCategoryId
                                                        );

                                                    return (

                                                        <>

                                                            {categorySearch && (

                                                                <div className="explore-category-search-info">

                                                                    {categoryCompanies.length === 0
                                                                        ? "Nenhuma empresa encontrada"
                                                                        : `${categoryCompanies.length} empresa${categoryCompanies.length !== 1
                                                                            ? "s"
                                                                            : ""
                                                                        } encontrada${categoryCompanies.length !== 1
                                                                            ? "s"
                                                                            : ""
                                                                        }`
                                                                    }

                                                                </div>

                                                            )}


                                                            <div className="explore-category-results">

                                                                {categoryCompanies.length > 0 ? (

                                                                    categoryCompanies.map(
                                                                        (company, index) => (

                                                                            <button
                                                                                key={
                                                                                    getCompanyHandle(
                                                                                        company
                                                                                    ) ||
                                                                                    `category-${index}`
                                                                                }

                                                                                type="button"

                                                                                className="explore-category-result"

                                                                                onClick={() =>
                                                                                    openCompanyInfo(
                                                                                        company
                                                                                    )
                                                                                }
                                                                            >

                                                                                <div className="explore-category-result-logo">

                                                                                    {getCompanyLogo(
                                                                                        company
                                                                                    ) ? (

                                                                                        <img
                                                                                            src={
                                                                                                getCompanyLogo(
                                                                                                    company
                                                                                                )
                                                                                            }
                                                                                            alt={
                                                                                                getCompanyName(
                                                                                                    company
                                                                                                )
                                                                                            }
                                                                                        />

                                                                                    ) : (

                                                                                        <Icon
                                                                                            icon="solar:shop-linear"
                                                                                        />

                                                                                    )}

                                                                                </div>


                                                                                <div className="explore-category-result-info">

                                                                                    <strong>
                                                                                        {getCompanyName(
                                                                                            company
                                                                                        )}
                                                                                    </strong>


                                                                                    <span>
                                                                                        {getCompanyDescription(
                                                                                            company
                                                                                        )}
                                                                                    </span>


                                                                                    <small>
                                                                                        @{getCompanyHandle(
                                                                                            company
                                                                                        )}
                                                                                    </small>

                                                                                </div>


                                                                                <div className="explore-category-result-arrow">

                                                                                    <Icon
                                                                                        icon="solar:alt-arrow-right-linear"
                                                                                    />

                                                                                </div>

                                                                            </button>

                                                                        )
                                                                    )

                                                                ) : (

                                                                    <div className="explore-category-empty">

                                                                        <div className="explore-category-empty-icon">

                                                                            <Icon
                                                                                icon="solar:shop-2-linear"
                                                                            />

                                                                        </div>


                                                                        <strong>

                                                                            {categorySearch
                                                                                ? "Nenhuma empresa encontrada"
                                                                                : "Nenhuma empresa nesta categoria"}

                                                                        </strong>


                                                                        <span>

                                                                            {categorySearch
                                                                                ? "Tente pesquisar por outro nome ou termo."
                                                                                : "Ainda não existem empresas cadastradas nesta categoria."}

                                                                        </span>

                                                                    </div>

                                                                )}

                                                            </div>

                                                        </>

                                                    );

                                                })()}

                                            </>
                                        ) : activeCategoryGroup?.id === "all" ? (

                                            <>
                                                <div className="explore-category-search">

                                                    <Icon
                                                        icon="solar:magnifer-linear"
                                                    />

                                                    <input
                                                        type="text"
                                                        value={categorySearch}
                                                        onChange={(e) =>
                                                            setCategorySearch(
                                                                e.target.value
                                                            )
                                                        }
                                                        placeholder="Pesquisar em todas as categorias..."
                                                    />

                                                    {categorySearch && (

                                                        <button
                                                            type="button"
                                                            className="explore-category-search-clear"
                                                            onClick={() =>
                                                                setCategorySearch("")
                                                            }
                                                            aria-label="Limpar pesquisa"
                                                        >

                                                            <Icon
                                                                icon="solar:close-circle-linear"
                                                            />

                                                        </button>

                                                    )}

                                                </div>


                                                {(() => {

                                                    const allCompanies =
                                                        getAllCategoryCompanies();

                                                    return (

                                                        <>

                                                            {categorySearch && (

                                                                <div className="explore-category-search-info">

                                                                    {allCompanies.length === 0
                                                                        ? "Nenhuma empresa encontrada"
                                                                        : `${allCompanies.length} empresa${allCompanies.length !== 1
                                                                            ? "s"
                                                                            : ""
                                                                        } encontrada${allCompanies.length !== 1
                                                                            ? "s"
                                                                            : ""
                                                                        }`
                                                                    }

                                                                </div>

                                                            )}


                                                            <div className="explore-category-results">

                                                                {allCompanies.length > 0 ? (

                                                                    allCompanies.map(
                                                                        (company, index) => (

                                                                            <button
                                                                                key={
                                                                                    getCompanyHandle(
                                                                                        company
                                                                                    ) ||
                                                                                    `all-company-${index}`
                                                                                }

                                                                                type="button"

                                                                                className="explore-category-result"

                                                                                onClick={() =>
                                                                                    openCompanyInfo(
                                                                                        company
                                                                                    )
                                                                                }
                                                                            >

                                                                                <div className="explore-category-result-logo">

                                                                                    {getCompanyLogo(
                                                                                        company
                                                                                    ) ? (

                                                                                        <img
                                                                                            src={
                                                                                                getCompanyLogo(
                                                                                                    company
                                                                                                )
                                                                                            }
                                                                                            alt={
                                                                                                getCompanyName(
                                                                                                    company
                                                                                                )
                                                                                            }
                                                                                        />

                                                                                    ) : (

                                                                                        <Icon
                                                                                            icon="solar:shop-linear"
                                                                                        />

                                                                                    )}

                                                                                </div>


                                                                                <div className="explore-category-result-info">

                                                                                    <strong>
                                                                                        {getCompanyName(
                                                                                            company
                                                                                        )}
                                                                                    </strong>


                                                                                    <span>
                                                                                        {getCompanyDescription(
                                                                                            company
                                                                                        )}
                                                                                    </span>


                                                                                    <small>
                                                                                        @{getCompanyHandle(
                                                                                            company
                                                                                        )}
                                                                                    </small>

                                                                                </div>


                                                                                <div className="explore-category-result-arrow">

                                                                                    <Icon
                                                                                        icon="solar:alt-arrow-right-linear"
                                                                                    />

                                                                                </div>

                                                                            </button>

                                                                        )
                                                                    )

                                                                ) : (

                                                                    <div className="explore-category-empty">

                                                                        <div className="explore-category-empty-icon">

                                                                            <Icon
                                                                                icon="solar:shop-2-linear"
                                                                            />

                                                                        </div>


                                                                        <strong>
                                                                            {categorySearch
                                                                                ? "Nenhuma empresa encontrada"
                                                                                : "Nenhuma empresa disponível"}
                                                                        </strong>


                                                                        <span>
                                                                            {categorySearch
                                                                                ? "Tente pesquisar por outro nome ou termo."
                                                                                : "Ainda não existem empresas cadastradas."}
                                                                        </span>

                                                                    </div>

                                                                )}

                                                            </div>

                                                        </>

                                                    );

                                                })()}

                                            </>

                                        ) : (

                                            <div className="explore-category-browser-placeholder">

                                                <Icon
                                                    icon="solar:widget-4-linear"
                                                />

                                                <strong>
                                                    Selecione uma categoria
                                                </strong>

                                                <span>
                                                    Escolha uma categoria acima para
                                                    encontrar empresas.
                                                </span>

                                            </div>

                                        )}

                                    </div>

                                )}

                            </section>

                        )}

                    <section className="explore-section">

                        <div className="explore-section-heading">

                            <div>

                                <span>
                                    Markfy
                                </span>

                                <h2>
                                    Empresas
                                </h2>

                            </div>

                            {!loading && (

                                <small>

                                    {companies.length}{" "}

                                    {companies.length === 1
                                        ? "disponível"
                                        : "disponíveis"}

                                </small>

                            )}

                        </div>


                        {loading ? (

                            <div className="explore-loading">

                                <Icon
                                    icon="svg-spinners:ring-resize"
                                />

                                <span>
                                    Encontrando empresas...
                                </span>

                            </div>

                        ) : companies.length > 0 ? (

                            /*
                            IMPORTANTE:
                            LISTA DE EMPRESAS CONTINUA VERTICAL
                            */

                            <div className="explore-company-list">

                                {companies.map(
                                    renderCompanyCard
                                )}

                            </div>

                        ) : (

                            <div className="explore-empty">

                                <div className="explore-empty-icon">

                                    <Icon
                                        icon="solar:shop-2-outline"
                                    />

                                </div>

                                <h3>
                                    Ainda não há empresas
                                </h3>

                                <p>
                                    Novas empresas aparecerão
                                    aqui quando estiverem
                                    disponíveis.
                                </p>

                            </div>

                        )}

                    </section>


                    {/* =================================================
                        CTA
                    ================================================= */}

                    {!loading &&
                        companies.length > 0 && (

                            <section className="explore-bottom-card">

                                <div className="explore-bottom-icon">

                                    <Icon
                                        icon="solar:compass-linear"
                                    />

                                </div>

                                <div>

                                    <span>
                                        Continue explorando
                                    </span>

                                    <h2>
                                        Encontre seu próximo
                                        agendamento.
                                    </h2>

                                    <p>
                                        Pesquise uma empresa
                                        acima para começar.
                                    </p>

                                </div>

                            </section>

                        )}

                </>

            )}


            {/* =================================================
                COMPANY INFO MODAL
            ================================================= */}

            <CompanyInfoModal

                isOpen={
                    Boolean(
                        selectedCompany
                    )
                }

                companyName={
                    selectedCompany?.name ||
                    "Empresa"
                }

                companyHandle={
                    selectedCompany?.handle ||
                    ""
                }

                companyLogo={
                    companyLogos[selectedCompany?.handle] ||
                    ""
                }

                onClose={
                    closeCompanyInfo
                }

            />

        </div>

    );

};

export default Explore;