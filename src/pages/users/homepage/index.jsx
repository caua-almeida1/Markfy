import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { getDatabase, onValue, ref } from "firebase/database";

import { Icon } from "@iconify/react";

import "../homepage/home.css";
import ProductDetails from "./ProductDetails/ProductDetails";

import CompanyInfoModal
    from "../../users/CompanyInfoModal/CompanyInfoModal";

import {
    getPlanHighlights,
    getPlanPriceSuffix,
    getPlanSessionsLabel,
    isSubscriptionProduct,
    normalizeMonthlyPlan
} from "../../../utils/subscription";

import { useProductImages } from "../../../utils/productImages";

import PromoCarousel from "./PromoCarousel/PromoCarousel";
import ProductThumb from "../../../components/product-thumb/ProductThumb";
import PriceTag from "../../../components/price-tag/PriceTag";

import {
    formatDurationLabel,
    getComboItemCount,
    getComboItems,
    isComboProduct
} from "../../../utils/combo";

import { useCompanyLogo } from "../../../firebase/companyLogo";


const HomePage = () => {

    const { handle } = useParams();
    const location = useLocation();
    const navigate = useNavigate();
    /* =========================================================
       EMPRESA
    ========================================================= */

    const [companyName, setCompanyName] = useState("");
    const [companyHandle, setCompanyHandle] = useState("");
    /* A logo vive em companys/{handle}/logo.png. O estado
       abaixo só guarda o valor legado do RTDB, usado como
       dica enquanto a empresa não foi migrada. */
    const [legacyLogo, setLegacyLogo] = useState("");

    const companyLogo = useCompanyLogo(
        companyHandle || handle,
        legacyLogo
    );


    /* =========================================================
       PRODUTOS
    ========================================================= */

    const [products, setProducts] = useState([]);

    /* As imagens ficam no Storage, não no RTDB — daí serem
       resolvidas à parte dos produtos. */
    const productImages = useProductImages(
        companyHandle || handle,
        products
    );

    /*
     * A primeira imagem do produto, ou null.
     *
     * Antes caía em `Thumb1` (img/1.jpg) — a foto de um
     * produto que não é este. Como resolver as URLs do
     * Storage leva alguns instantes, essa foto errada
     * aparecia em toda visita antes da certa.
     */
    const getProductImage = (product) =>
        productImages[product?.id]?.[0] || null;


    /*
     * O array cru, para quem sabe lidar com os três estados.
     *
     * `undefined` quer dizer "ainda resolvendo"; um array
     * vazio quer dizer "não tem foto". Quem recebe só a URL
     * não consegue separar as duas coisas.
     */
    const getProductImages = (product) =>
        productImages[product?.id];

    /* =========================================================
       UI
    ========================================================= */

    const [selectedCategory, setSelectedCategory] = useState("Todos");
    const [selectedProduct, setSelectedProduct] = useState(null);

    const productIdFromUrl =
        new URLSearchParams(location.search).get("product");

    const [showCompanyInfo, setShowCompanyInfo] =
        useState(false);

    const [searchModal, setSearchModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const [showAllProducts, setShowAllProducts] = useState(false);

    const [loadedImages, setLoadedImages] = useState({});

    const [pageStatus, setPageStatus] = useState("loading");
    // loading | ready | not-found | error

    const [productNotFound, setProductNotFound] = useState(false);

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

        if (!handle) {

            setPageStatus("not-found");

            return;
        }


        setPageStatus("loading");
        setProducts([]);
        setSelectedProduct(null);
        setProductNotFound(false);


        const db = getDatabase();

        const companyRef = ref(
            db,
            `companys/${handle}`
        );


        let finished = false;


        /*
        ============================================================
        TIMEOUT DE SEGURANÇA
        ============================================================
        */

        const timeout = setTimeout(() => {

            if (!finished) {

                finished = true;

                setPageStatus("error");

            }

        }, 10000);


        /*
        ============================================================
        FIREBASE
        ============================================================
        */

        const unsubscribe = onValue(
            companyRef,

            (snapshot) => {

                if (finished) {
                    return;
                }


                const data = snapshot.val();


                /*
                ----------------------------------------------------
                EMPRESA NÃO EXISTE
                ----------------------------------------------------
                */

                if (!data) {

                    finished = true;

                    clearTimeout(timeout);

                    setPageStatus("not-found");

                    return;
                }


                /*
                ----------------------------------------------------
                EMPRESA ENCONTRADA
                ----------------------------------------------------
                */

                setCompanyName(
                    data.name || ""
                );


                /* A logo vem do Storage (ver logo abaixo).
                   data.logoPreview só cobre empresas ainda
                   não migradas. */
                setLegacyLogo(
                    data.logoPreview || ""
                );


                setCompanyHandle(
                    data.handle || handle
                );


                const productsData =
                    data.products || {};


                const productsArray =
                    Object.entries(productsData)

                        .filter(
                            ([, product]) =>
                                product?.status !==
                                "arquivados"
                        )

                        .map(
                            ([id, product]) => ({
                                id,
                                ...product,
                                orders:
                                    Number(
                                        product?.orders
                                    ) || 0
                            })
                        )

                        .sort(
                            (a, b) =>
                                b.orders -
                                a.orders
                        );


                setProducts(productsArray);

                finished = true;

                clearTimeout(timeout);

                setPageStatus("ready");

            },

            (error) => {

                console.error(
                    "Erro ao carregar empresa:",
                    error
                );


                if (!finished) {

                    finished = true;

                    clearTimeout(timeout);

                    setPageStatus("error");

                }

            }
        );


        return () => {

            finished = true;

            clearTimeout(timeout);

            unsubscribe();

        };

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
       ASSINATURAS

       Planos de mensalidade ganham uma seção própria para o
       cliente não confundir cobrança recorrente com compra
       avulsa — por isso saem da grade do catálogo.
    ========================================================= */

    const subscriptionProducts = useMemo(() => {

        return visibleProducts.filter(
            isSubscriptionProduct
        );

    }, [visibleProducts]);


    /*
     * Combos ganham seção própria, como as mensalidades.
     *
     * Na grade do catálogo eles competem com os serviços que
     * os formam — e "Corte + Barba" ao lado de "Corte" e
     * "Barba" só confunde. Numa seção à parte, a proposta
     * fica clara: é um pacote.
     */
    const comboProducts = useMemo(() => {

        return visibleProducts.filter(isComboProduct);

    }, [visibleProducts]);


    const catalogProducts = useMemo(() => {

        return visibleProducts.filter(
            (product) =>
                !isSubscriptionProduct(product) &&
                !isComboProduct(product)
        );

    }, [visibleProducts]);

    useEffect(() => {

        /*
        ============================================================
        SEM PRODUTO NA URL
        ============================================================
        */

        if (!productIdFromUrl) {

            setProductNotFound(false);

            return;
        }


        /*
        ============================================================
        EMPRESA AINDA CARREGANDO
        ============================================================
        */

        if (pageStatus === "loading") {
            return;
        }


        /*
        ============================================================
        EMPRESA NÃO EXISTE
        ============================================================
        */

        if (pageStatus === "not-found") {

            setSelectedProduct(null);
            setProductNotFound(true);

            return;
        }


        /*
        ============================================================
        ERRO
        ============================================================
        */

        if (pageStatus === "error") {

            setSelectedProduct(null);
            setProductNotFound(true);

            return;
        }


        /*
        ============================================================
        PROCURAR PRODUTO
        ============================================================
        */

        const product =
            products.find(
                (item) =>
                    String(item.id) ===
                    String(productIdFromUrl)
            );


        if (product) {

            setSelectedProduct(product);
            setProductNotFound(false);

            return;
        }


        /*
        ============================================================
        PRODUTO NÃO EXISTE
        ============================================================
        */

        setSelectedProduct(null);
        setProductNotFound(true);

    }, [
        productIdFromUrl,
        products,
        pageStatus
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

    const openProduct = (product) => {

        if (!product?.id) {
            return;
        }

        setSelectedProduct(product);

        const params =
            new URLSearchParams(
                location.search
            );

        params.set(
            "product",
            product.id
        );

        navigate(
            `${location.pathname}?${params.toString()}`,
            {
                replace: true
            }
        );

    };

    const renderProductCard = (
        product,
        index
    ) => {

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
                    openProduct(product)
                }
            >

                {/* IMAGEM */}

                <div className="home-product-card-image">

                    {/* ProductThumb cuida dos três estados:
                        skeleton enquanto as URLs do Storage não
                        chegam, ícone quando o produto não tem
                        foto, e a foto quando ela pinta. */}
                    <ProductThumb
                        images={getProductImages(product)}
                        alt={product.name}
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
                                <PriceTag product={product} />
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

                                openProduct(product);

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
       CARD DE ASSINATURA

       Mostra o preço já com o ciclo ("/mês") e os pontos
       principais do plano, para o cliente perceber que é uma
       cobrança recorrente antes de abrir o produto.
    ========================================================= */

    const renderSubscriptionCard = (product) => {

        const plan =
            normalizeMonthlyPlan(product);

        if (!plan) {
            return null;
        }

        const highlights =
            getPlanHighlights(plan);

        return (

            <article
                key={product.id}
                className="home-subscription-card"
                onClick={() =>
                    openProduct(product)
                }
            >

                {/* TOPO */}

                <div className="home-subscription-card-top">

                    <div className="home-subscription-icon">
                        <Icon icon="solar:refresh-circle-linear" />
                    </div>

                    <span className="home-subscription-badge">
                        {plan.billingCycleLabel}
                    </span>

                </div>


                {/* IDENTIFICAÇÃO */}

                <h3>
                    {product.name}
                </h3>

                <p className="home-subscription-sessions">
                    {getPlanSessionsLabel(plan)}
                </p>


                {/* PREÇO */}

                <div className="home-subscription-price">

                    <strong>
                        <PriceTag product={product} />
                    </strong>

                    <span>
                        {getPlanPriceSuffix(plan)}
                    </span>

                </div>

                {plan.trialDays > 0 && (

                    <span className="home-subscription-trial">

                        <Icon icon="solar:gift-outline" />

                        {plan.trialDays}
                        {plan.trialDays === 1
                            ? " dia grátis"
                            : " dias grátis"}

                    </span>

                )}


                {/* DETALHES DA MENSALIDADE */}

                <ul className="home-subscription-details">

                    {highlights.map((highlight) => (

                        <li key={highlight.id}>

                            <Icon icon={highlight.icon} />

                            <div>

                                <span>
                                    {highlight.label}
                                </span>

                                <strong>
                                    {highlight.value}
                                </strong>

                            </div>

                        </li>

                    ))}

                </ul>


                {/* AÇÃO */}

                <button
                    type="button"
                    className="home-subscription-cta"
                    onClick={(event) => {

                        event.stopPropagation();

                        openProduct(product);

                    }}
                >
                    Ver mensalidade

                    <Icon icon="humbleicons:arrow-right" />

                </button>

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

    const renderPageSkeleton = () => {
        return (
            <div className="home-page-skeleton">

                {/* HEADER */}
                <div className="home-skeleton-header">
                    <div className="home-skeleton-company">
                        <div className="home-skeleton-circle" />

                        <div className="home-skeleton-company-text">
                            <div className="home-skeleton-line home-skeleton-line--small" />
                            <div className="home-skeleton-line home-skeleton-line--company" />
                        </div>
                    </div>

                    <div className="home-skeleton-search" />
                </div>


                {/* HERO */}
                <section className="home-skeleton-hero">
                    <div className="home-skeleton-line home-skeleton-line--eyebrow" />

                    <div className="home-skeleton-title" />
                    <div className="home-skeleton-title home-skeleton-title--short" />

                    <div className="home-skeleton-description" />
                    <div className="home-skeleton-description home-skeleton-description--short" />
                </section>


                {/* CATEGORIAS */}
                <section className="home-skeleton-section">

                    <div className="home-skeleton-heading">
                        <div className="home-skeleton-heading-small" />
                        <div className="home-skeleton-heading-large" />
                    </div>

                    <div className="home-skeleton-categories">
                        <div />
                        <div />
                        <div />
                        <div />
                    </div>

                </section>


                {/* PRODUTOS */}
                <section className="home-skeleton-section">

                    <div className="home-skeleton-heading">
                        <div className="home-skeleton-heading-small" />
                        <div className="home-skeleton-heading-large" />
                    </div>

                    <div className="home-skeleton-products">

                        {[1, 2, 3, 4].map((item) => (
                            <div
                                className="home-skeleton-product"
                                key={item}
                            >
                                <div className="home-skeleton-product-image" />

                                <div className="home-skeleton-product-content">

                                    <div className="home-skeleton-product-title" />

                                    <div className="home-skeleton-product-description" />
                                    <div className="home-skeleton-product-description short" />

                                    <div className="home-skeleton-product-bottom">
                                        <div className="home-skeleton-price" />
                                        <div className="home-skeleton-button" />
                                    </div>

                                </div>
                            </div>
                        ))}

                    </div>

                </section>

            </div>
        );
    };

    const renderNotFound = () => {
        return (
            <div className="home-not-found">

                <div className="home-not-found-icon">
                    <Icon icon="solar:shop-2-outline" />
                </div>

                <h1>
                    Empresa não encontrada
                </h1>

                <p>
                    Não encontramos nenhuma empresa ou catálogo
                    associado a este link.
                </p>

                <button
                    type="button"
                    onClick={() => navigate("/")}
                >
                    Voltar para o início

                    <Icon icon="humbleicons:arrow-right" />
                </button>

            </div>
        );
    };

    /* =========================================================
       RENDER
    ========================================================= */

    return (

        <>
            {pageStatus === "loading" && (
                renderPageSkeleton()
            )}


            {pageStatus === "not-found" && (
                renderNotFound()
            )}


            {pageStatus === "error" && (
                <div className="home-not-found">

                    <div className="home-not-found-icon">
                        <Icon icon="solar:cloud-cross-outline" />
                    </div>

                    <h1>
                        Não foi possível carregar
                    </h1>

                    <p>
                        Houve um problema ao carregar
                        esta empresa. Tente novamente.
                    </p>

                    <button
                        type="button"
                        onClick={() =>
                            window.location.reload()
                        }
                    >
                        Tentar novamente

                        <Icon icon="solar:refresh-outline" />
                    </button>

                </div>
            )}


            {pageStatus === "ready" && !productNotFound && (

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

                        {/* Quando a categoria só tem assinaturas, o
                            catálogo some para não exibir uma grade
                            vazia logo acima da seção de planos. */}

                        {(catalogProducts.length > 0 ||
                            subscriptionProducts.length === 0) && (

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
                                    catalogProducts.length > 4 && (

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
                                    ? catalogProducts
                                    : catalogProducts.slice(0, 4)
                                ).map(
                                    renderProductCard
                                )}

                            </div>


                            {/* VAZIO */}

                            {catalogProducts.length === 0 && (

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

                        )}


                                {/* =================================================
                            VITRINE DE PROMOÇÕES

                            Entre o catálogo e as mensalidades: quem
                            rolou além da grade de produtos já está
                            procurando o que comprar, e ainda não
                            chegou na conversa de assinatura. É onde
                            um destaque tem chance de ser visto.

                            Usa o catálogo (sem mensalidades) porque
                            desconto em assinatura é outra conversa —
                            mexe no valor recorrente, não numa compra.
                        ================================================= */}

                        {!showAllProducts && (

                            <PromoCarousel
                                products={catalogProducts}
                                getProductImages={getProductImages}
                                onOpenProduct={setSelectedProduct}
                            />

                        )}


                {/* =================================================
                    COMBOS

                    Entre as ofertas e as mensalidades: quem
                    chegou aqui já viu o catálogo e está
                    decidindo o quanto quer fazer. É onde um
                    pacote tem chance de ser considerado.
                ================================================= */}

                {!showAllProducts && comboProducts.length > 0 && (

                    <section className="home-combos">

                        <div className="home-section-heading">

                            <div>
                                <span>Combos</span>

                                <h2>Mais de um serviço, um preço só</h2>
                            </div>

                        </div>

                        <div className="home-combos-list">

                            {comboProducts.map((product) => {

                                const itens = getComboItems(product);

                                return (
                                    <article
                                        key={product.id}
                                        className="home-combo-card"
                                        onClick={() => openProduct(product)}
                                    >

                                        <div className="home-combo-thumb">

                                            <ProductThumb
                                                images={getProductImages(product)}
                                                alt={product.name}
                                            />

                                            {/* O rótulo é a informação
                                                principal do card: diz de
                                                cara que ali tem mais de
                                                um serviço. */}
                                            <span className="home-combo-badge">
                                                +{getComboItemCount(product)} produtos
                                            </span>

                                        </div>

                                        <div className="home-combo-body">

                                            <strong className="home-combo-name">
                                                {product.name}
                                            </strong>

                                            <span className="home-combo-items">
                                                {itens
                                                    .map((item) => item.name)
                                                    .join(" · ")}
                                            </span>

                                            <div className="home-combo-footer">

                                                <span className="home-combo-price">
                                                    <PriceTag product={product} />
                                                </span>

                                                {product.duration > 0 && (
                                                    <span className="home-combo-duration">
                                                        <Icon icon="solar:clock-circle-outline" />
                                                        {formatDurationLabel(product.duration)}
                                                    </span>
                                                )}

                                            </div>

                                        </div>

                                    </article>
                                );

                            })}

                        </div>

                    </section>

                )}


                {/* =================================================
                    ASSINATURAS
                ================================================= */}

                        {subscriptionProducts.length > 0 && (

                            <section className="home-subscriptions">

                                <div className="home-section-heading">

                                    <div>

                                        <span>
                                            Assinaturas
                                        </span>

                                        <h2>
                                            Planos de mensalidade
                                        </h2>

                                    </div>

                                </div>


                                <div className="home-subscriptions-note">

                                    <Icon icon="solar:info-circle-linear" />

                                    <p>
                                        Os itens abaixo não são compras
                                        avulsas: o valor é cobrado de forma
                                        recorrente enquanto a assinatura
                                        estiver ativa.
                                    </p>

                                </div>


                                <div className="home-subscriptions-list">

                                    {subscriptionProducts.map(
                                        renderSubscriptionCard
                                    )}

                                </div>

                            </section>

                        )}


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
                                                            setSelectedProduct(product)
                                                        }
                                                    >

                                                        <div className="home-featured-image">

                                                            <img
                                                                src={
                                                                    getProductImage(
                                                                        product
                                                                    )
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
                                                                <PriceTag product={product} />

                                                                {isSubscriptionProduct(
                                                                    product
                                                                ) && (
                                                                    <em className="home-product-cycle">
                                                                        {getPlanPriceSuffix(
                                                                            normalizeMonthlyPlan(
                                                                                product
                                                                            )
                                                                        )}
                                                                    </em>
                                                                )}
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
                            onClose={() => {

                                setSelectedProduct(null);

                                const params =
                                    new URLSearchParams(
                                        location.search
                                    );

                                params.delete("product");

                                const search =
                                    params.toString();

                                navigate(
                                    `${location.pathname}${search ? `?${search}` : ""}`,
                                    {
                                        replace: true
                                    }
                                );

                            }}
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

                                                        openProduct(product);

                                                        setSearchModal(false);

                                                    }}
                                                >

                                                    <img
                                                        src={
                                                            getProductImage(
                                                                product
                                                            )
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
                                                            <PriceTag product={product} />

                                                            {isSubscriptionProduct(
                                                                product
                                                            ) && (
                                                                <em className="home-product-cycle">
                                                                    {getPlanPriceSuffix(
                                                                        normalizeMonthlyPlan(
                                                                            product
                                                                        )
                                                                    )}
                                                                    {" • assinatura"}
                                                                </em>
                                                            )}
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

            )}


            {pageStatus === "ready" && productNotFound && (

                <div className="home-not-found">

                    <div className="home-not-found-icon">
                        <Icon icon="solar:box-outline" />
                    </div>

                    <h1>
                        Produto não encontrado
                    </h1>

                    <p>
                        Esse produto não existe mais ou
                        o link está incorreto.
                    </p>

                    <button
                        type="button"
                        onClick={() => {

                            const params =
                                new URLSearchParams(
                                    location.search
                                );

                            params.delete("product");

                            const search =
                                params.toString();

                            navigate(
                                `${location.pathname}${search ? `?${search}` : ""}`,
                                {
                                    replace: true
                                }
                            );

                        }}
                    >
                        Ver catálogo

                        <Icon icon="humbleicons:arrow-right" />
                    </button>

                </div>

            )}

        </>

    );

};

export default HomePage;