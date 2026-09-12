import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { getDatabase, onValue, ref } from "firebase/database";

import { Icon } from "@iconify/react";

import "../homepage/home.css";
import ProductDetails from "./ProductDetails/ProductDetails";

import CompanyInfoModal
    from "../../users/CompanyInfoModal/CompanyInfoModal";

import Thumb1 from "../../../img/1.jpg";

const HomePage = () => {

    const { handle } = useParams();

    /* =========================================================
       EMPRESA
    ========================================================= */

    const [companyName, setCompanyName] = useState("");
    const [companyHandle, setCompanyHandle] = useState("");
    const [companyLogo, setCompanyLogo] = useState("");


    /* =========================================================
       PRODUTOS
    ========================================================= */

    const [products, setProducts] = useState([]);

    /* =========================================================
       UI
    ========================================================= */

    const [selectedCategory, setSelectedCategory] = useState("Todos");
    const [selectedProduct, setSelectedProduct] = useState(null);

    const [showCompanyInfo, setShowCompanyInfo] =
        useState(false);

    const [searchModal, setSearchModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const [showAllProducts, setShowAllProducts] = useState(false);

    const [loadedImages, setLoadedImages] = useState({});

    /* =========================================================
       IMAGENS
    ========================================================= */

    const handleImageLoad = (id) => {
        setLoadedImages((prev) => ({
            ...prev,
            [id]: true
        }));
    };

    /* =========================================================
       DURAÇÃO
    ========================================================= */

    const formatDuration = (minutes) => {

        if (!minutes || Number.isNaN(Number(minutes))) {
            return "";
        }

        const value = Number(minutes);

        const hours = Math.floor(value / 60);
        const mins = value % 60;

        if (hours > 0 && mins > 0) {
            return `${hours}h ${mins}min`;
        }

        if (hours > 0) {
            return `${hours}h`;
        }

        return `${mins}min`;
    };

    /* =========================================================
       FIREBASE
    ========================================================= */

    useEffect(() => {

        if (!handle) return;

        const db = getDatabase();

        const companyRef = ref(
            db,
            `companys/${handle}`
        );

        const unsubscribe = onValue(
            companyRef,
            (snapshot) => {

                const data = snapshot.val();

                if (!data) {
                    return;
                }

                setCompanyName(
                    data.name || ""
                );

                setCompanyLogo(
                    data.logoPreview || ""
                );

                setCompanyHandle(
                    data.handle || handle
                );

                const productsData = data.products || {};

                const productsArray = Object.entries(
                    productsData
                )
                    .filter(
                        ([, product]) =>
                            product?.status !== "arquivados"
                    )
                    .map(
                        ([id, product]) => ({
                            id,
                            ...product,
                            orders:
                                Number(product?.orders) || 0
                        })
                    )
                    .sort(
                        (a, b) =>
                            b.orders - a.orders
                    );

                setProducts(productsArray);
            }
        );

        return () => unsubscribe();

    }, [handle]);

    /* =========================================================
       CATEGORIAS
    ========================================================= */

    const categories = useMemo(() => {

        const categorySet = new Set();

        products.forEach((product) => {

            if (!Array.isArray(product.categories)) {
                return;
            }

            product.categories.forEach((category) => {

                if (
                    category &&
                    typeof category === "string"
                ) {
                    categorySet.add(category);
                }

            });

        });

        return [
            "Todos",
            ...Array.from(categorySet)
        ];

    }, [products]);

    /* =========================================================
       PRODUTOS FILTRADOS
    ========================================================= */

    const visibleProducts = useMemo(() => {

        let result = [...products];

        if (selectedCategory !== "Todos") {

            result = result.filter(
                (product) =>
                    product.categories?.includes(
                        selectedCategory
                    )
            );

        }

        return result;

    }, [
        products,
        selectedCategory
    ]);

    /* =========================================================
       PESQUISA
    ========================================================= */

    const searchResults = useMemo(() => {

        const term =
            searchTerm
                .trim()
                .toLowerCase();

        if (!term) {
            return products;
        }

        return products.filter(
            (product) => {

                const name =
                    product.name
                        ?.toLowerCase() || "";

                const description =
                    product.description
                        ?.toLowerCase() || "";

                const categories =
                    product.categories
                        ?.join(" ")
                        ?.toLowerCase() || "";

                return (
                    name.includes(term) ||
                    description.includes(term) ||
                    categories.includes(term)
                );

            }
        );

    }, [
        products,
        searchTerm
    ]);

    /* =========================================================
       PRODUTOS EM DESTAQUE
    ========================================================= */

    /* =========================================================
       MAIS PROCURADOS
    ========================================================= */

    const featuredProducts = useMemo(() => {

        return products
            .filter((product) => Number(product.orders) > 0)
            .sort(
                (a, b) =>
                    Number(b.orders || 0) -
                    Number(a.orders || 0)
            )
            .slice(0, 3);

    }, [products]);

    /* =========================================================
       PRODUTO CARD
    ========================================================= */

    const renderProductCard = (
        product,
        index
    ) => {

        const image =
            product.images?.[0] ||
            Thumb1;

        const category =
            product.categories?.[0] ||
            "Serviço";

        return (

            <article
                key={product.id}
                className="home-product-card"
                style={{
                    "--product-index": index
                }}
                onClick={() =>
                    setSelectedProduct(product)
                }
            >

                {/* IMAGEM */}

                <div className="home-product-card-image">

                    {!loadedImages[product.id] && (
                        <div className="home-product-skeleton" />
                    )}

                    <img
                        src={image}
                        alt={product.name}
                        loading="lazy"
                        onLoad={() =>
                            handleImageLoad(
                                product.id
                            )
                        }
                        onError={(event) => {

                            event.currentTarget.src =
                                Thumb1;

                            handleImageLoad(
                                product.id
                            );

                        }}
                        style={{
                            opacity:
                                loadedImages[
                                    product.id
                                ]
                                    ? 1
                                    : 0
                        }}
                    />

                    <span className="home-product-category">
                        {category}
                    </span>

                </div>

                {/* CONTEÚDO */}

                <div className="home-product-card-content">

                    <div className="home-product-card-top">

                        <h3>
                            {product.name}
                        </h3>

                        {product.description && (
                            <div
                                className="product-description-content"
                                dangerouslySetInnerHTML={{
                                    __html: product.description
                                }}
                            />
                        )}

                    </div>

                    <div className="home-product-card-bottom">

                        <div className="home-product-meta">

                            <strong>
                                {product.value}
                            </strong>

                            {product.duration && (

                                <span>
                                    <Icon icon="solar:clock-circle-outline" />

                                    {formatDuration(
                                        product.duration
                                    )}
                                </span>

                            )}

                        </div>

                        <button
                            type="button"
                            onClick={(event) => {

                                event.stopPropagation();

                                setSelectedProduct(
                                    product
                                );

                            }}
                        >
                            Agendar

                            <Icon icon="humbleicons:arrow-right" />

                        </button>

                    </div>

                </div>

            </article>

        );

    };

    /* =========================================================
       EMPRESA
    ========================================================= */

    const openCompanyInfo = () => {

        setShowCompanyInfo(true);

    };

    const closeCompanyInfo = () => {

        setShowCompanyInfo(false);

    };
    /* =========================================================
       CATÁLOGO
    ========================================================= */

    const openCatalog = () => {

        setShowAllProducts(true);

        setSelectedCategory("Todos");

    };

    /* =========================================================
       RENDER
    ========================================================= */

    return (

        <div className="home-page">

            {/* =================================================
                HEADER
            ================================================= */}

            <header className="home-header">

                <div className="home-company">

                    {companyLogo ? (

                        <img
                            src={companyLogo}
                            alt={companyName}
                            className="home-company-logo"
                        />

                    ) : (

                        <div className="home-company-logo-fallback">

                            <Icon icon="solar:shop-2-outline" />

                        </div>

                    )}

                    <div>

                        <span>
                            Você está em
                        </span>

                        <strong>
                            {companyName}
                        </strong>

                    </div>

                </div>

                <button
                    type="button"
                    className="home-header-search"
                    onClick={() =>
                        setSearchModal(true)
                    }
                    aria-label="Pesquisar produtos"
                >
                    <Icon icon="mdi:magnify" />
                </button>

            </header>


            {/* =================================================
                CONTEÚDO
            ================================================= */}

            <main className="home-content">


                {/* =================================================
                    HERO
                ================================================= */}

                {!showAllProducts && (

                    <section className="home-intro">

                        <span className="home-intro-eyebrow">
                            Serviços disponíveis
                        </span>

                        <h1>
                            O que você precisa
                            <br />
                            <strong>agendar hoje?</strong>
                        </h1>

                        <p>
                            Escolha um serviço, veja os
                            detalhes e agende seu horário.
                        </p>

                    </section>

                )}


                {/* =================================================
                    CATEGORIAS
                ================================================= */}

                {categories.length > 1 && (

                    <section className="home-categories">

                        <div className="home-section-heading">

                            <div>
                                <span>
                                    Explore
                                </span>

                                <h2>
                                    Categorias
                                </h2>
                            </div>

                        </div>

                        <div className="home-category-list">

                            {categories.map(
                                (category) => (

                                    <button
                                        type="button"
                                        key={category}
                                        className={
                                            selectedCategory ===
                                                category
                                                ? "active"
                                                : ""
                                        }
                                        onClick={() => {

                                            setSelectedCategory(
                                                category
                                            );

                                            setShowAllProducts(
                                                false
                                            );

                                        }}
                                    >

                                        {category}

                                    </button>

                                )
                            )}

                        </div>

                    </section>

                )}


                {/* =================================================
                    CATÁLOGO
                ================================================= */}

                <section className="home-catalog">

                    <div className="home-section-heading">

                        <div>

                            <span>
                                {selectedCategory === "Todos"
                                    ? "Catálogo"
                                    : "Categoria"}
                            </span>

                            <h2>
                                {selectedCategory === "Todos"
                                    ? "Nossos produtos"
                                    : selectedCategory}
                            </h2>

                        </div>

                        {!showAllProducts &&
                            products.length > 4 && (

                                <button
                                    type="button"
                                    className="home-see-all"
                                    onClick={
                                        openCatalog
                                    }
                                >
                                    Ver todos

                                    <Icon icon="humbleicons:arrow-right" />

                                </button>

                            )}

                    </div>


                    {/* PRODUTOS */}

                    <div
                        className={
                            showAllProducts
                                ? "home-products-grid home-products-grid--all"
                                : "home-products-grid"
                        }
                    >

                        {(showAllProducts
                            ? visibleProducts
                            : visibleProducts.slice(0, 4)
                        ).map(
                            renderProductCard
                        )}

                    </div>


                    {/* VAZIO */}

                    {visibleProducts.length === 0 && (

                        <div className="home-empty">

                            <div>
                                <Icon icon="solar:box-outline" />
                            </div>

                            <h3>
                                Nenhum produto encontrado
                            </h3>

                            <p>
                                Não existem produtos
                                disponíveis nesta categoria.
                            </p>

                        </div>

                    )}

                </section>


                {/* =================================================
                    MAIS POPULARES
                ================================================= */}

                {!showAllProducts &&
                    selectedCategory === "Todos" &&
                    featuredProducts.length > 0 && (

                        <section className="home-featured">

                            <div className="home-section-heading">

                                <div>

                                    <span>
                                        Destaques
                                    </span>

                                    <h2>
                                        Mais procurados
                                    </h2>

                                </div>

                            </div>

                            <div className="home-featured-list">

                                {featuredProducts
                                    .slice(0, 3)
                                    .map(
                                        (product) => (

                                            <button
                                                type="button"
                                                key={product.id}
                                                className="home-featured-item"
                                                onClick={() =>
                                                    setSelectedProduct(
                                                        product
                                                    )
                                                }
                                            >

                                                <div className="home-featured-image">

                                                    <img
                                                        src={
                                                            product.images?.[0] ||
                                                            Thumb1
                                                        }
                                                        alt={
                                                            product.name
                                                        }
                                                    />

                                                </div>

                                                <div>

                                                    <span>
                                                        {product.categories?.[0] ||
                                                            "Serviço"}
                                                    </span>

                                                    <strong>
                                                        {product.name}
                                                    </strong>

                                                    <p>
                                                        {product.value}
                                                    </p>

                                                </div>

                                                <Icon
                                                    icon="humbleicons:arrow-right"
                                                />

                                            </button>

                                        )
                                    )}

                            </div>

                        </section>

                    )}


                {/* =================================================
                    EMPRESA
                ================================================= */}

                {!showAllProducts && (

                    <section
                        className="home-company-card"
                        onClick={openCompanyInfo}
                    >

                        <div className="home-company-card-icon">

                            <Icon icon="solar:shop-2-outline" />

                        </div>

                        <div>

                            <span>
                                Conheça a empresa
                            </span>

                            <h2>
                                {companyName}
                            </h2>

                            <p>
                                Veja informações,
                                localização, fotos e
                                comodidades.
                            </p>

                        </div>

                        <Icon
                            icon="humbleicons:arrow-right"
                        />

                    </section>

                )}

            </main>

            {/* =================================================
    COMPANY INFO MODAL
================================================= */}

            <CompanyInfoModal
                isOpen={showCompanyInfo}

                companyName={
                    companyName ||
                    "Empresa"
                }

                companyHandle={
                    companyHandle ||
                    handle ||
                    ""
                }

                companyLogo={
                    companyLogo ||
                    ""
                }

                onClose={
                    closeCompanyInfo
                }
            />

            {/* =================================================
                PRODUCT DETAILS
            ================================================= */}

            {selectedProduct && (

                <ProductDetails
                    product={selectedProduct}
                    companyLogo={companyLogo}
                    companyName={companyName}
                    companyHandle={companyHandle}
                    onClose={() =>
                        setSelectedProduct(null)
                    }
                    formatDuration={
                        formatDuration
                    }
                />

            )}


            {/* =================================================
                PESQUISA
            ================================================= */}

            {searchModal && (

                <div
                    className="home-search-overlay"
                    onMouseDown={(event) => {

                        if (
                            event.target ===
                            event.currentTarget
                        ) {
                            setSearchModal(false);
                        }

                    }}
                >

                    <div className="home-search-modal">

                        <div className="home-search-modal-header">

                            <div className="home-search-input">

                                <Icon icon="mdi:magnify" />

                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Pesquisar produto..."
                                    value={searchTerm}
                                    onChange={(event) =>
                                        setSearchTerm(
                                            event.target.value
                                        )
                                    }
                                />

                            </div>

                            <button
                                type="button"
                                onClick={() =>
                                    setSearchModal(
                                        false
                                    )
                                }
                            >
                                <Icon icon="mdi:close" />
                            </button>

                        </div>


                        <div className="home-search-results">

                            {searchResults.length > 0 ? (

                                searchResults.map(
                                    (product) => (

                                        <button
                                            type="button"
                                            key={product.id}
                                            className="home-search-result"
                                            onClick={() => {

                                                setSelectedProduct(
                                                    product
                                                );

                                                setSearchModal(
                                                    false
                                                );

                                            }}
                                        >

                                            <img
                                                src={
                                                    product.images?.[0] ||
                                                    Thumb1
                                                }
                                                alt={
                                                    product.name
                                                }
                                            />

                                            <div>

                                                <strong>
                                                    {product.name}
                                                </strong>

                                                <span>
                                                    {product.value}
                                                </span>

                                            </div>

                                            <Icon
                                                icon="humbleicons:arrow-right"
                                            />

                                        </button>

                                    )
                                )

                            ) : (

                                <div className="home-search-empty">

                                    <Icon icon="mdi:magnify" />

                                    <p>
                                        Nenhum produto
                                        encontrado.
                                    </p>

                                </div>

                            )}

                        </div>

                    </div>

                </div>

            )}

        </div>

    );

};

export default HomePage;