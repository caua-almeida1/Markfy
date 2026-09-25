import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import {
    getDatabase,
    ref,
    get
} from "firebase/database";

import {
    getStorage,
    ref as storageRef,
    getDownloadURL,
    listAll
} from "firebase/storage";

import "./company-info-modal.css";
import Modal from "../../../components/modal/Modal";


const WEEK_DAYS = [
    { id: "sunday", label: "Domingo" },
    { id: "monday", label: "Segunda-feira" },
    { id: "tuesday", label: "Terça-feira" },
    { id: "wednesday", label: "Quarta-feira" },
    { id: "thursday", label: "Quinta-feira" },
    { id: "friday", label: "Sexta-feira" },
    { id: "saturday", label: "Sábado" }
];

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

const PHOTO_CATEGORIES = [
    {
        id: "facade",
        name: "Fachada"
    },
    {
        id: "interior",
        name: "Interior"
    },
    {
        id: "services",
        name: "Serviços"
    },
    {
        id: "other",
        name: "Outros"
    }
];

const CompanyInfoModal = ({
    isOpen,
    companyName,
    companyHandle,
    companyLogo,
    onClose
}) => {

    const navigate = useNavigate();

    const [company, setCompany] = useState(null);

    const [selectedPhotoIndex, setSelectedPhotoIndex] =
        useState(null);

    const [professionals, setProfessionals] = useState([]);

    /* Fotos da empresa, lidas do Storage. */
    const [storagePhotos, setStoragePhotos] = useState([]);

    const [professionalPhotos, setProfessionalPhotos] =
        useState({});

    const [loading, setLoading] = useState(true);

    const [selectedProfessional, setSelectedProfessional] =
        useState(null);

    // ==========================================
    // CARREGAR EMPRESA
    // ==========================================

    useEffect(() => {

        if (!companyHandle) {
            setLoading(false);
            return;
        }

        const fetchCompany = async () => {

            try {

                const db = getDatabase();

                const companyRef =
                    ref(
                        db,
                        `companys/${companyHandle}`
                    );

                const companySnap =
                    await get(companyRef);

                if (!companySnap.exists()) {
                    setLoading(false);
                    return;
                }

                const companyData =
                    companySnap.val();

                setCompany(companyData);


                // ==========================================
                // PROFISSIONAIS
                // ==========================================

                const relatedProfessionalIds =
                    new Set();


                // Procura profissionais associados
                // aos produtos da empresa

                const products =
                    companyData.products || {};


                Object.values(products).forEach((product) => {

                    if (
                        !Array.isArray(
                            product?.relatedUsers
                        )
                    ) {
                        return;
                    }

                    product.relatedUsers.forEach((user) => {

                        if (user?.id) {
                            relatedProfessionalIds.add(
                                user.id
                            );
                        }

                    });

                });


                const ids = [
                    ...relatedProfessionalIds
                ];


                if (!ids.length) {
                    setProfessionals([]);
                    setLoading(false);
                    return;
                }


                /*
                 * Lê apenas os uids dos profissionais
                 * relacionados aos produtos.
                 *
                 * Ler o nó "users" inteiro numa rota pública
                 * expõe nome e e-mail de toda a base.
                 */

                const usersEntries =
                    await Promise.all(

                        ids.map(async (id) => {

                            const userSnap = await get(
                                ref(db, `users/${id}`)
                            );

                            return [
                                id,
                                userSnap.exists()
                                    ? userSnap.val()
                                    : null
                            ];

                        })

                    );

                const usersData =
                    Object.fromEntries(
                        usersEntries.filter(
                            ([, value]) => value
                        )
                    );


                const storage =
                    getStorage();

                const professionalsData = [];

                const photos = {};


                await Promise.all(
                    ids.map(async (id) => {

                        const user =
                            usersData[id];

                        if (!user) {
                            return;
                        }


                        const professional = {
                            id,
                            name:
                                user.name ||
                                "Profissional",

                            description:
                                user.description ||
                                ""
                        };


                        try {

                            const imageRef =
                                storageRef(
                                    storage,
                                    `users/${id}/profileImg`
                                );

                            const photoUrl =
                                await getDownloadURL(
                                    imageRef
                                );

                            photos[id] =
                                photoUrl;

                        } catch (error) {

                            if (
                                error.code !==
                                "storage/object-not-found"
                            ) {

                                console.error(
                                    "Erro ao carregar foto:",
                                    error
                                );

                            }

                        }


                        professionalsData.push(
                            professional
                        );

                    })
                );


                setProfessionals(
                    professionalsData
                );

                setProfessionalPhotos(
                    photos
                );

            } catch (error) {

                console.error(
                    "Erro ao carregar informações da empresa:",
                    error
                );

            } finally {

                setLoading(false);

            }

        };


        fetchCompany();

    }, [companyHandle]);


    // ==========================================
    // HORÁRIO
    // ==========================================

    const formatBusinessHours = () => {

        if (!company?.businessHours) {
            return [];
        }

        return WEEK_DAYS.map((day) => {

            const data =
                company.businessHours[day.id];

            if (
                !data ||
                data.enabled === false
            ) {

                return {
                    ...day,
                    closed: true
                };

            }

            return {
                ...day,
                closed: false,
                open:
                    data.open || "08:00",
                close:
                    data.close || "18:00"
            };

        });

    };


    const businessHours =
        formatBusinessHours();


    // ==========================================
    // LOCALIZAÇÃO
    // ==========================================

    const address =
        company?.address ||
        company?.location ||
        company?.endereco ||
        null;

    // ==========================================
    // GOOGLE MAPS
    // ==========================================

    const openGoogleMaps = () => {

        if (!address) {
            return;
        }

        const addressText =
            typeof address === "string"
                ? address
                : [
                    address.street,
                    address.number,
                    address.neighborhood,
                    address.city,
                    address.state,
                    address.zipCode,
                    address.country
                ]
                    .filter(Boolean)
                    .join(", ");

        if (!addressText.trim()) {
            return;
        }

        const mapsUrl =
            `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                addressText
            )}`;

        window.open(
            mapsUrl,
            "_blank",
            "noopener,noreferrer"
        );

    };

    // ==========================================
    // REDES SOCIAIS
    // ==========================================

    const socialLinks =
        company?.socialLinks ||
        company?.socialMedia ||
        company?.socials ||
        {};


    const enabledAmenities = AMENITIES.filter(
        (amenity) =>
            company?.amenities?.[amenity.id] === true
    );

    const PHOTO_CATEGORY_ORDER = {
        facade: 0,
        interior: 1,
        services: 2,
        other: 3
    };

    /* =========================================
       GALERIA — DO STORAGE

       O que existe de verdade são os arquivos em
       companys/{handle}/photos/. O nó do banco guarda uma
       cópia da URL de download, e essa cópia envelhece: o
       token da URL muda quando o arquivo é reenviado, some
       quando alguém regenera o token pelo console, e fotos
       apagadas pelo Storage continuam listadas. O resultado
       na tela era imagem quebrada.

       Agora quem manda é o Storage: listamos a pasta e
       resolvemos cada URL na hora. O banco entra só para dar
       a categoria de cada foto, casada pelo caminho do
       arquivo — e se a listagem falhar, ele ainda serve de
       queda para a galeria não sumir.
       ========================================= */

    useEffect(() => {

        if (!isOpen || !companyHandle) {
            setStoragePhotos([]);
            return undefined;
        }

        let cancelado = false;

        const carregar = async () => {

            try {

                const pasta = storageRef(
                    getStorage(),
                    `companys/${companyHandle}/photos`
                );

                const { items } = await listAll(pasta);

                const arquivos = await Promise.all(
                    items.map(async (item) => {

                        try {

                            return {
                                path: item.fullPath,
                                url: await getDownloadURL(item)
                            };

                        } catch {

                            return null;

                        }

                    })
                );

                if (!cancelado) {
                    setStoragePhotos(
                        arquivos.filter(Boolean)
                    );
                }

            } catch (error) {

                console.warn(
                    "Não foi possível listar as fotos:",
                    error
                );

                if (!cancelado) {
                    setStoragePhotos([]);
                }

            }

        };

        carregar();

        return () => {
            cancelado = true;
        };

    }, [isOpen, companyHandle]);


    /* Metadados do banco, indexados pelo caminho do arquivo. */
    const photoMeta = (() => {

        const entradas = company?.photos
            ? (
                Array.isArray(company.photos)
                    ? company.photos
                    : Object.values(company.photos)
            )
            : [];

        const porCaminho = {};

        entradas.forEach((entrada) => {

            if (entrada?.path) {
                porCaminho[entrada.path] = entrada;
            }

        });

        return porCaminho;

    })();


    const ordenarPorCategoria = (lista) =>
        [...lista].sort((a, b) => {

            const orderA =
                PHOTO_CATEGORY_ORDER[a.category] ?? 99;

            const orderB =
                PHOTO_CATEGORY_ORDER[b.category] ?? 99;

            return orderA - orderB;

        });


    const companyPhotos = storagePhotos.length
        ? ordenarPorCategoria(
            storagePhotos.map((arquivo) => ({
                ...(photoMeta[arquivo.path] || {}),
                id: photoMeta[arquivo.path]?.id || arquivo.path,
                path: arquivo.path,
                url: arquivo.url
            }))
        )
        : ordenarPorCategoria(
            (
                company?.photos
                    ? (
                        Array.isArray(company.photos)
                            ? company.photos
                            : Object.values(company.photos)
                    )
                    : []
            ).filter(photo => photo?.url)
        );
    /* ==========================================
   GALERIA
   ========================================== */

    const openPhotoViewer = (index) => {

        setSelectedPhotoIndex(index);

    };


    const closePhotoViewer = () => {

        setSelectedPhotoIndex(null);

    };


    const showPreviousPhoto = () => {

        setSelectedPhotoIndex((current) => {

            if (
                current === null ||
                !companyPhotos.length
            ) {
                return current;
            }

            return (
                current - 1 + companyPhotos.length
            ) % companyPhotos.length;

        });

    };


    const showNextPhoto = () => {

        setSelectedPhotoIndex((current) => {

            if (
                current === null ||
                !companyPhotos.length
            ) {
                return current;
            }

            return (
                current + 1
            ) % companyPhotos.length;

        });

    };

    // ==========================================
    // CATÁLOGO — PREVIEW
    // ==========================================

    const catalogProducts = useMemo(() => {

        if (!company?.products) {
            return [];
        }


        const products = Array.isArray(company.products)
            ? company.products.map((product, index) => ({
                id: product?.id || `product-${index}`,
                ...product
            }))
            : Object.entries(company.products).map(
                ([id, product]) => ({
                    id,
                    ...product
                })
            );


        return products
            .filter(
                product =>
                    product &&
                    (
                        product.name ||
                        product.title
                    )
            )
            .slice(0, 3);

    }, [company?.products]);

    const getCatalogProductName = (product) => {

        return (
            product?.name ||
            product?.title ||
            "Produto"
        );

    };


    const getCatalogProductDescription = (product) => {

        const description =
            product?.description ||
            product?.bio ||
            "";

        return String(description)
            .replace(/<[^>]*>/g, "")
            .trim();

    };


    const getCatalogProductImage = (product) => {

        if (product?.image) {
            return product.image;
        }

        if (product?.imageUrl) {
            return product.imageUrl;
        }

        if (product?.photo) {
            return product.photo;
        }

        if (product?.photoUrl) {
            return product.photoUrl;
        }

        if (Array.isArray(product?.images)) {
            return product.images[0] || "";
        }

        if (Array.isArray(product?.photos)) {
            return product.photos[0] || "";
        }

        return "";

    };


    const getCatalogProductPrice = (product) => {

        const price =
            product?.price ??
            product?.value ??
            product?.valor;

        if (
            price === undefined ||
            price === null ||
            price === ""
        ) {
            return "";
        }

        const numericPrice =
            Number(
                String(price)
                    .replace(",", ".")
                    .replace(/[^\d.]/g, "")
            );

        if (!Number.isFinite(numericPrice)) {
            return "";
        }

        return numericPrice.toLocaleString(
            "pt-BR",
            {
                style: "currency",
                currency: "BRL"
            }
        );

    };

    /*
     * Abre a página inicial da empresa — a mesma que o
     * cliente veria pelo link dela. Vai com `tab=home`
     * explícito para a aba e a URL nascerem coerentes.
     */
    const openCompanyHome = () => {

        if (!companyHandle) {

            console.warn(
                "CompanyInfo: companyHandle não encontrado."
            );

            return;

        }


        navigate(
            `/central-user/${companyHandle}?tab=home`
        );


        onClose();

    };


    const openCompanyCatalog = () => {

        if (!companyHandle) {

            console.warn(
                "CompanyInfo: companyHandle não encontrado."
            );

            return;

        }


        navigate(
            `/central-user/${companyHandle}?tab=catalog`
        );


        onClose();

    };
    // ==========================================
    // ANIMAÇÃO / PORTAL
    // ==========================================

    return createPortal(

        <Modal
                open={isOpen}
                onClose={onClose}
                overlayClassName="company-info-modal-overlay"
                className="company-info-modal"
            >

                        {/* ================================= */}
                        {/* HEADER */}
                        {/* ================================= */}

                        <div className="company-info-modal-header">

                            <button
                                type="button"
                                className="company-info-modal-close"
                                onClick={onClose}
                                aria-label="Fechar"
                            >
                                <Icon icon="mdi:close" />
                            </button>

                        </div>


                        {/* ================================= */}
                        {/* CONTEÚDO */}
                        {/* ================================= */}

                        <div className="company-info-modal-content">

                            {loading ? (

                                <div className="company-info-modal-loading">

                                    <Icon
                                        icon="svg-spinners:ring-resize"
                                        width="30"
                                    />

                                    <span>
                                        Carregando informações...
                                    </span>

                                </div>

                            ) : (

                                <>

                                    {/* ============================== */}
                                    {/* IDENTIDADE */}
                                    {/* ============================== */}

                                    <div className="company-info-identity">

                                        <div className="company-info-logo">

                                            {companyLogo ? (

                                                <img
                                                    src={companyLogo}
                                                    alt={companyName}
                                                />

                                            ) : (

                                                <span>
                                                    {companyName
                                                        ?.charAt(0)
                                                        ?.toUpperCase() || "?"}
                                                </span>

                                            )}

                                        </div>


                                        <div className="company-info-identity-text">

                                            <h2>
                                                {companyName}
                                            </h2>

                                            <span>
                                                @{companyHandle}
                                            </span>

                                        </div>

                                    </div>


                                    {/* ============================== */}
                                    {/* DESCRIÇÃO */}
                                    {/* ============================== */}

                                    {/* ============================== */}
                                    {/* FOTOS DO LOCAL */}
                                    {/* ============================== */}

                                    {companyPhotos.length > 0 && (

                                        <section className="company-info-section company-info-gallery-section">

                                            <div className="company-info-section-title">

                                                <Icon
                                                    icon="solar:gallery-wide-outline"
                                                />

                                                <h3>
                                                    Nosso espaço
                                                </h3>

                                            </div>


                                            <div className="company-info-gallery">

                                                {companyPhotos.map((photo, index) => {

                                                    const category =
                                                        PHOTO_CATEGORIES.find(
                                                            item =>
                                                                item.id === photo.category
                                                        );

                                                    return (

                                                        <div
                                                            className={`company-info-gallery-item ${index === 0
                                                                ? "featured"
                                                                : ""
                                                                } mkf-fade-enter`}
                                                            key={
                                                                photo.id ||
                                                                photo.url ||
                                                                index
                                                            }
                                                            onClick={() =>
                                                                openPhotoViewer(index)
                                                            }
                                                        >

                                                            <img
                                                                src={photo.url}
                                                                alt={
                                                                    category
                                                                        ? category.name
                                                                        : `Foto do local ${index + 1}`
                                                                }
                                                                loading={
                                                                    index === 0
                                                                        ? "eager"
                                                                        : "lazy"
                                                                }
                                                            />

                                                            {category && (

                                                                <div className="company-info-gallery-label">

                                                                    {category.name}

                                                                </div>

                                                            )}

                                                            <div className="company-info-gallery-expand">

                                                                <Icon
                                                                    icon="solar:maximize-outline"
                                                                />

                                                            </div>

                                                        </div>

                                                    );

                                                })}

                                            </div>

                                        </section>

                                    )}

                                    {/* ============================== */}
                                    {/* CATÁLOGO */}
                                    {/* ============================== */}

                                    {catalogProducts.length > 0 && (

                                        <section className="company-info-section company-info-catalog-section">

                                            <div className="company-info-section-title">

                                                <Icon
                                                    icon="gg:shopping-bag"
                                                />

                                                <h3>
                                                    Catálogo
                                                </h3>

                                            </div>


                                            <div className="company-info-catalog-grid">

                                                {catalogProducts.map((product) => {

                                                    const image =
                                                        getCatalogProductImage(
                                                            product
                                                        );

                                                    const name =
                                                        getCatalogProductName(
                                                            product
                                                        );

                                                    const description =
                                                        getCatalogProductDescription(
                                                            product
                                                        );

                                                    const price =
                                                        getCatalogProductPrice(
                                                            product
                                                        );


                                                    return (

                                                        <button
                                                            type="button"
                                                            className="company-info-catalog-product"
                                                            key={product.id}

                                                            onClick={() => {

                                                                if (!companyHandle) {
                                                                    return;
                                                                }


                                                                navigate(
                                                                    `/central-user/${companyHandle}?tab=catalog&product=${encodeURIComponent(
                                                                        product.id
                                                                    )}`
                                                                );


                                                                onClose();

                                                            }}
                                                        >

                                                            {/* IMAGEM */}

                                                            <div className="company-info-catalog-product-image">

                                                                {image ? (

                                                                    <img
                                                                        src={image}
                                                                        alt={name}
                                                                        loading="lazy"
                                                                    />

                                                                ) : (

                                                                    <div className="company-info-catalog-product-image-fallback">

                                                                        <Icon
                                                                            icon="solar:bag-4-outline"
                                                                        />

                                                                    </div>

                                                                )}

                                                            </div>


                                                            {/* CONTEÚDO */}

                                                            <div className="company-info-catalog-product-content">

                                                                <h4>
                                                                    {name}
                                                                </h4>


                                                                {description && (

                                                                    <p>
                                                                        {description}
                                                                    </p>

                                                                )}


                                                                {price && (

                                                                    <strong>
                                                                        {price}
                                                                    </strong>

                                                                )}

                                                            </div>

                                                        </button>

                                                    );

                                                })}

                                            </div>


                                            {/* AÇÕES DA EMPRESA */}

                                            <div className="company-info-actions">

                                                <button
                                                    type="button"
                                                    className="company-info-visit-button"
                                                    onClick={openCompanyHome}
                                                >

                                                    <Icon
                                                        icon="solar:shop-2-outline"
                                                    />

                                                    <span>
                                                        Visitar empresa
                                                    </span>

                                                </button>


                                                <button
                                                    type="button"
                                                    className="company-info-catalog-button"
                                                    onClick={openCompanyCatalog}
                                                >

                                                    <span>
                                                        Ver catálogo completo
                                                    </span>

                                                    <Icon
                                                        icon="humbleicons:arrow-right"
                                                    />

                                                </button>

                                            </div>

                                        </section>

                                    )}

                                    {(company?.description ||
                                        company?.bio) && (

                                            <section className="company-info-section">

                                                <div className="company-info-section-title">

                                                    <Icon
                                                        icon="solar:document-text-outline"
                                                    />

                                                    <h3>
                                                        Sobre a empresa
                                                    </h3>

                                                </div>

                                                <p className="company-info-description">
                                                    {company.description ||
                                                        company.bio}
                                                </p>

                                            </section>

                                        )}

                                    {/* ============================== */}
                                    {/* COMODIDADES */}
                                    {/* ============================== */}

                                    {enabledAmenities.length > 0 && (

                                        <section className="company-info-section">

                                            <div className="company-info-section-title">

                                                <Icon
                                                    icon="solar:stars-outline"
                                                />

                                                <h3>
                                                    Comodidades
                                                </h3>

                                            </div>


                                            <div className="company-info-amenities">

                                                {enabledAmenities.map(
                                                    (amenity) => (

                                                        <div
                                                            className="company-info-amenity"
                                                            key={amenity.id}
                                                        >

                                                            <div className="company-info-amenity-icon">

                                                                <Icon
                                                                    icon={amenity.icon}
                                                                />

                                                            </div>

                                                            <span>
                                                                {amenity.name}
                                                            </span>

                                                        </div>

                                                    )
                                                )}

                                            </div>

                                        </section>

                                    )}
                                    {/* ============================== */}
                                    {/* PROFISSIONAIS */}
                                    {/* ============================== */}

                                    <section className="company-info-section">

                                        <div className="company-info-section-title">

                                            <Icon
                                                icon="solar:users-group-rounded-outline"
                                            />

                                            <h3>
                                                Profissionais
                                            </h3>

                                        </div>


                                        {professionals.length > 0 ? (

                                            <div className="company-info-professionals">

                                                {professionals.map(
                                                    (professional) => (

                                                        <button
                                                            type="button"
                                                            className="company-info-professional"
                                                            key={professional.id}
                                                            onClick={() =>
                                                                setSelectedProfessional(professional)
                                                            }
                                                        >

                                                            <div className="company-info-professional-avatar">

                                                                {professionalPhotos[
                                                                    professional.id
                                                                ] ? (

                                                                    <img
                                                                        src={
                                                                            professionalPhotos[
                                                                            professional.id
                                                                            ]
                                                                        }
                                                                        alt={
                                                                            professional.name
                                                                        }
                                                                    />

                                                                ) : (

                                                                    <span>
                                                                        {professional.name
                                                                            ?.charAt(0)
                                                                            ?.toUpperCase() ||
                                                                            "?"}
                                                                    </span>

                                                                )}

                                                            </div>

                                                            <span>
                                                                {professional.name}
                                                            </span>

                                                        </button>

                                                    )
                                                )}

                                            </div>

                                        ) : (

                                            <p className="company-info-empty">
                                                Nenhum profissional disponível.
                                            </p>

                                        )}

                                    </section>


                                    {/* ============================== */}
                                    {/* HORÁRIO */}
                                    {/* ============================== */}

                                    {businessHours.length > 0 && (

                                        <section className="company-info-section">

                                            <div className="company-info-section-title">

                                                <Icon
                                                    icon="solar:clock-circle-outline"
                                                />

                                                <h3>
                                                    Horário de funcionamento
                                                </h3>

                                            </div>


                                            <div className="company-info-hours">

                                                {businessHours.map(
                                                    (day) => (

                                                        <div
                                                            className="company-info-hours-row"
                                                            key={day.id}
                                                        >

                                                            <span>
                                                                {day.label}
                                                            </span>

                                                            {day.closed ? (

                                                                <strong className="closed">
                                                                    Fechado
                                                                </strong>

                                                            ) : (

                                                                <strong>
                                                                    {day.open} – {day.close}
                                                                </strong>

                                                            )}

                                                        </div>

                                                    )
                                                )}

                                            </div>

                                        </section>

                                    )}


                                    {/* ============================== */}
                                    {/* ENDEREÇO */}
                                    {/* ============================== */}

                                    {/* ============================== */}
                                    {/* LOCALIZAÇÃO */}
                                    {/* ============================== */}

                                    {address && (

                                        <section className="company-info-section">

                                            <div className="company-info-section-title">

                                                <Icon
                                                    icon="solar:map-point-outline"
                                                />

                                                <h3>
                                                    Localização
                                                </h3>

                                            </div>


                                            <p className="company-info-address">

                                                {typeof address === "string"
                                                    ? address
                                                    : [
                                                        address.street,
                                                        address.number,
                                                        address.neighborhood,
                                                        address.city
                                                    ]
                                                        .filter(Boolean)
                                                        .join(", ")
                                                }

                                            </p>


                                            {/* ==============================
            VER NO MAPS
        ============================== */}

                                            <button
                                                type="button"
                                                className="company-info-maps-button"
                                                onClick={openGoogleMaps}
                                            >

                                                <Icon
                                                    icon="solar:map-arrow-up-outline"
                                                />

                                                <span>
                                                    Ver no Maps
                                                </span>

                                                <Icon
                                                    className="company-info-maps-button-arrow"
                                                    icon="humbleicons:arrow-right"
                                                />

                                            </button>

                                        </section>

                                    )}

                                    {/* ============================== */}
                                    {/* REDES SOCIAIS */}
                                    {/* ============================== */}

                                    {Object.keys(socialLinks).length > 0 && (

                                        <section className="company-info-section">

                                            <div className="company-info-section-title">

                                                <Icon
                                                    icon="solar:share-outline"
                                                />

                                                <h3>
                                                    Redes sociais
                                                </h3>

                                            </div>

                                            <div className="company-info-socials">

                                                {Object.entries(socialLinks).map(
                                                    ([network, value]) => {

                                                        if (!value) {
                                                            return null;
                                                        }

                                                        let socialValue = value;

                                                        if (
                                                            typeof value === "object"
                                                        ) {
                                                            socialValue =
                                                                value.url ||
                                                                value.link ||
                                                                value.href ||
                                                                value.value ||
                                                                value.username ||
                                                                "";
                                                        }

                                                        if (
                                                            typeof socialValue !== "string"
                                                        ) {
                                                            return null;
                                                        }

                                                        socialValue =
                                                            socialValue.trim();

                                                        if (!socialValue) {
                                                            return null;
                                                        }

                                                        const href =
                                                            /^https?:\/\//i.test(
                                                                socialValue
                                                            )
                                                                ? socialValue
                                                                : `https://${socialValue}`;

                                                        return (
                                                            <a
                                                                key={network}
                                                                href={href}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="company-info-social"
                                                            >
                                                                <Icon
                                                                    icon={
                                                                        network === "instagram"
                                                                            ? "mdi:instagram"
                                                                            : network === "facebook"
                                                                                ? "mdi:facebook"
                                                                                : network === "tiktok"
                                                                                    ? "ic:baseline-tiktok"
                                                                                    : "solar:link-outline"
                                                                    }
                                                                />

                                                                <span>
                                                                    {network}
                                                                </span>
                                                            </a>
                                                        );

                                                    }
                                                )}

                                            </div>

                                        </section>

                                    )}

                                </>

                            )}

                        </div>

                    </Modal>,

        document.body

    );
};


export default CompanyInfoModal;