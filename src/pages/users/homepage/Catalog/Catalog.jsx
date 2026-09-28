import React, { useEffect, useMemo, useState } from "react";
import {
    useParams,
    useSearchParams
} from "react-router-dom";
import { Icon } from "@iconify/react";
import { getDatabase, ref, onValue } from "firebase/database";

import ProductDetails from "../ProductDetails/ProductDetails";
import PriceTag from "../../../../components/price-tag/PriceTag";
import Thumb1 from "../../../../img/1.jpg";

import {
    getPlanHighlights,
    getPlanPriceSuffix,
    getPlanSessionsLabel,
    isSubscriptionProduct,
    normalizeMonthlyPlan
} from "../../../../utils/subscription";

import { useProductImages } from "../../../../utils/productImages";

import { useCompanyLogo } from "../../../../firebase/companyLogo";

import "./Catalog.css";

const Catalog = () => {

    const { handle } = useParams();
    const [
        searchParams
    ] = useSearchParams();

    const [products, setProducts] = useState([]);

    const [companyName, setCompanyName] = useState("");
    /* Valor legado do RTDB; a logo real vem do Storage. */
    const [legacyLogo, setLegacyLogo] = useState("");
    const [companyHandle, setCompanyHandle] = useState("");

    const companyLogo = useCompanyLogo(
        companyHandle || handle,
        legacyLogo
    );

    const [selectedProduct, setSelectedProduct] = useState(null);

    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("all");
    const [categoryLoading, setCategoryLoading] = useState(false);

    /* Tipo de oferta: "all" | "individual" | "monthly".
       Serviços avulsos são o foco da página, então vêm
       primeiro e são o que aparece em "Todos". */
    const [selectedType, setSelectedType] = useState("all");

    const [loadedImages, setLoadedImages] = useState({});


    // ==========================================
    // IMAGENS (STORAGE)
    //
    // Ficam em companys/{handle}/products/{id}/images,
    // e não no Realtime Database.
    // ==========================================

    const productImages = useProductImages(
        companyHandle || handle,
        products
    );

    const getProductImage = (product) =>
        productImages[product?.id]?.[0] || Thumb1;


    // ==========================================
    // ORDENAÇÃO
    // ==========================================

    const [sortOption, setSortOption] = useState("relevance");
    const [showSortMenu, setShowSortMenu] = useState(false);


    // ==========================================
    // CARREGAR EMPRESA E PRODUTOS
    // ==========================================

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

                    setProducts([]);

                    setCompanyName("");
                    setLegacyLogo("");
                    setCompanyHandle(handle);

                    return;

                }


                // ==========================================
                // EMPRESA
                // ==========================================

                setCompanyName(
                    data.name || ""
                );

                setLegacyLogo(
                    data.logoPreview || ""
                );

                setCompanyHandle(
                    data.handle || handle
                );


                // ==========================================
                // PRODUTOS
                // ==========================================

                const productsArray = data.products
                    ? Object.entries(data.products)
                        .filter(
                            ([, product]) =>
                                product?.status !== "arquivados"
                        )
                        .map(([id, product], index) => ({
                            id,
                            ...product,

                            // Guarda a posição original para
                            // manter a ordem de relevância.
                            originalIndex: index
                        }))
                    : [];


                setProducts(productsArray);

            },
            (error) => {

                console.error(
                    "Erro ao carregar catálogo:",
                    error
                );

                setProducts([]);

            }
        );


        return () => unsubscribe();

    }, [handle]);

    useEffect(() => {

        const productId =
            searchParams.get(
                "product"
            );


        if (
            !productId ||
            !products.length
        ) {

            return;

        }


        const product =
            products.find(
                item =>
                    String(item.id) ===
                    String(productId)
            );


        if (product) {

            setSelectedProduct(
                product
            );

        }

    }, [
        products,
        searchParams
    ]);

    // ==========================================
    // TROCAR CATEGORIA
    // ==========================================

    const handleCategoryChange = (category) => {

        if (category === selectedCategory) {
            return;
        }

        setCategoryLoading(true);

        // Remove o estado de carregamento das imagens
        // para que os novos cards também possam exibir skeleton.
        setLoadedImages({});

        setSelectedCategory(category);

    };

    // ==========================================
    // FINALIZAR LOADING DA CATEGORIA
    // ==========================================

    useEffect(() => {

        if (!categoryLoading) {
            return;
        }

        const timer = setTimeout(() => {

            setCategoryLoading(false);

        }, 450);

        return () => clearTimeout(timer);

    }, [
        categoryLoading,
        selectedCategory
    ]);

    // ==========================================
    // IMAGEM
    // ==========================================

    const handleImageLoad = (id) => {

        setLoadedImages((prev) => ({
            ...prev,
            [id]: true
        }));

    };


    // ==========================================
    // DURAÇÃO
    // ==========================================

    const formatDuration = (minutes) => {

        if (
            minutes === undefined ||
            minutes === null ||
            minutes === "" ||
            isNaN(minutes)
        ) {
            return "";
        }

        const value = Number(minutes);

        if (value <= 0) {
            return "";
        }

        const hours = Math.floor(
            value / 60
        );

        const remainingMinutes =
            value % 60;


        if (
            hours > 0 &&
            remainingMinutes > 0
        ) {

            return `${hours}h ${remainingMinutes}min`;

        }


        if (hours > 0) {

            return `${hours}h`;

        }


        return `${remainingMinutes}min`;

    };


    // ==========================================
    // CONVERTER PREÇO
    // ==========================================

    const getPriceValue = (product) => {

        if (!product) {
            return 0;
        }

        const rawValue =
            product.value ??
            product.price ??
            0;

        if (typeof rawValue === "number") {
            return rawValue;
        }

        const normalized =
            String(rawValue)
                .replace(/[^\d,.-]/g, "")
                .replace(/\./g, "")
                .replace(",", ".");

        const number =
            Number(normalized);

        return Number.isNaN(number)
            ? 0
            : number;

    };


    // ==========================================
    // CONVERTER DURAÇÃO
    // ==========================================

    const getDurationValue = (product) => {

        const duration =
            Number(product?.duration);

        return Number.isNaN(duration)
            ? 0
            : duration;

    };

    // ==========================================
    // CATEGORIAS
    // ==========================================

    const categories = useMemo(() => {

        const categorySet = new Set();

        products.forEach((product) => {

            if (!Array.isArray(product.categories)) {
                return;
            }

            product.categories.forEach((category) => {

                if (
                    typeof category === "string" &&
                    category.trim()
                ) {
                    categorySet.add(
                        category.trim()
                    );
                }

            });

        });

        return [
            "all",
            ...Array.from(categorySet).sort(
                (a, b) =>
                    a.localeCompare(
                        b,
                        "pt-BR",
                        {
                            sensitivity: "base"
                        }
                    )
            )
        ];

    }, [products]);
    // ==========================================
    // FILTRAR + ORDENAR
    // ==========================================

    const filteredProducts = useMemo(() => {

        const search =
            searchTerm
                .trim()
                .toLowerCase();


        // ==========================================
        // FILTRO
        // ==========================================

        const filtered = products.filter(
            (product) => {

                // ==========================================
                // FILTRO POR CATEGORIA
                // ==========================================

                if (
                    selectedCategory !== "all" &&
                    !(
                        Array.isArray(product.categories) &&
                        product.categories.some(
                            (category) =>
                                String(category).toLowerCase() ===
                                selectedCategory.toLowerCase()
                        )
                    )
                ) {
                    return false;
                }


                // ==========================================
                // FILTRO POR PESQUISA
                // ==========================================

                if (!search) {
                    return true;
                }

                const productName =
                    product.name
                        ?.toLowerCase() || "";


                const categories =
                    Array.isArray(
                        product.categories
                    )
                        ? product.categories
                            .join(" ")
                            .toLowerCase()
                        : "";


                const description =
                    product.description
                        ?.toLowerCase() || "";


                return (
                    productName.includes(search) ||
                    categories.includes(search) ||
                    description.includes(search)
                );

            }
        );


        // ==========================================
        // ORDENAÇÃO
        // ==========================================

        return [...filtered].sort(
            (a, b) => {

                switch (sortOption) {

                    // ==================================
                    // MAIS RELEVANTES
                    // ==================================

                    case "relevance":

                        return (
                            (a.originalIndex ?? 0) -
                            (b.originalIndex ?? 0)
                        );


                    // ==================================
                    // NOME A → Z
                    // ==================================

                    case "nameAsc":

                        return (
                            (a.name || "")
                                .localeCompare(
                                    b.name || "",
                                    "pt-BR",
                                    {
                                        sensitivity: "base"
                                    }
                                )
                        );


                    // ==================================
                    // NOME Z → A
                    // ==================================

                    case "nameDesc":

                        return (
                            (b.name || "")
                                .localeCompare(
                                    a.name || "",
                                    "pt-BR",
                                    {
                                        sensitivity: "base"
                                    }
                                )
                        );


                    // ==================================
                    // MENOR PREÇO
                    // ==================================

                    case "priceAsc":

                        return (
                            getPriceValue(a) -
                            getPriceValue(b)
                        );


                    // ==================================
                    // MAIOR PREÇO
                    // ==================================

                    case "priceDesc":

                        return (
                            getPriceValue(b) -
                            getPriceValue(a)
                        );


                    // ==================================
                    // MENOR DURAÇÃO
                    // ==================================

                    case "durationAsc":

                        return (
                            getDurationValue(a) -
                            getDurationValue(b)
                        );


                    // ==================================
                    // MAIOR DURAÇÃO
                    // ==================================

                    case "durationDesc":

                        return (
                            getDurationValue(b) -
                            getDurationValue(a)
                        );


                    default:

                        return (
                            (a.originalIndex ?? 0) -
                            (b.originalIndex ?? 0)
                        );

                }

            }
        );

    }, [
        products,
        searchTerm,
        selectedCategory,
        sortOption
    ]);


    // ==========================================
    // ASSINATURAS
    //
    // Planos de mensalidade saem da lista normal
    // para não misturar cobrança recorrente com
    // serviço avulso.
    // ==========================================

    const subscriptionProducts = useMemo(
        () =>
            selectedType === "individual"
                ? []
                : filteredProducts.filter(
                    isSubscriptionProduct
                ),
        [filteredProducts, selectedType]
    );


    const catalogProducts = useMemo(
        () =>
            selectedType === "monthly"
                ? []
                : filteredProducts.filter(
                    (product) =>
                        !isSubscriptionProduct(product)
                ),
        [filteredProducts, selectedType]
    );


    const TYPE_OPTIONS = [
        {
            id: "all",
            label: "Tudo",
            icon: "lucide:layers"
        },
        {
            id: "individual",
            label: "Serviços",
            icon: "solar:scissors-outline"
        },
        {
            id: "monthly",
            label: "Mensalidades",
            icon: "solar:refresh-circle-linear"
        }
    ];


    const visibleCount =
        catalogProducts.length +
        subscriptionProducts.length;


    const typeCounts = useMemo(() => {

        const monthly =
            filteredProducts.filter(
                isSubscriptionProduct
            ).length;

        return {
            all: filteredProducts.length,
            monthly,
            individual:
                filteredProducts.length - monthly
        };

    }, [filteredProducts]);


    // ==========================================
    // TEXTO DA ORDENAÇÃO ATUAL
    // ==========================================

    const getSortLabel = () => {

        switch (sortOption) {

            case "nameAsc":
                return "Nome A → Z";

            case "nameDesc":
                return "Nome Z → A";

            case "priceAsc":
                return "Menor preço";

            case "priceDesc":
                return "Maior preço";

            case "durationAsc":
                return "Menor duração";

            case "durationDesc":
                return "Maior duração";

            case "relevance":
            default:
                return "Mais relevantes";

        }

    };


    // ==========================================
    // SELECIONAR ORDENAÇÃO
    // ==========================================

    const handleSortChange = (option) => {

        setSortOption(option);

        setShowSortMenu(false);

    };


    // ==========================================
    // ABRIR PRODUTO
    // ==========================================

    const openProduct = (product) => {

        setSelectedProduct(product);

    };


    // ==========================================
    // FECHAR PRODUTO
    // ==========================================

    const closeProduct = () => {

        setSelectedProduct(null);

    };


    return (

        <div className="catalog-page">


            {/* =================================================
                HEADER
            ================================================= */}

            <div className="catalog-page-header">


                {/* =============================================
                    TÍTULO
                ============================================== */}

                <div className="catalog-page-title">

                    <h2>
                        Catálogo
                    </h2>

                    <p>

                        {visibleCount}

                        {" "}

                        {visibleCount === 1
                            ? "item disponível"
                            : "itens disponíveis"}

                    </p>

                </div>


                {/* =============================================
                    CONTROLES
                ============================================== */}

                <div className="catalog-header-controls">


                    {/* =========================================
                        PESQUISA
                    ========================================== */}

                    <div className="catalog-search">

                        <Icon
                            icon="mdi:magnify"
                        />


                        <input
                            type="text"
                            placeholder="Pesquisar serviço..."
                            value={searchTerm}
                            onChange={(event) =>
                                setSearchTerm(
                                    event.target.value
                                )
                            }
                        />


                        {searchTerm && (

                            <button
                                type="button"
                                aria-label="Limpar pesquisa"
                                onClick={() =>
                                    setSearchTerm("")
                                }
                            >

                                <Icon
                                    icon="mdi:close"
                                />

                            </button>

                        )}

                    </div>


                    {/* =========================================
                        BOTÃO ORDENAR
                    ========================================== */}

                    <div className="catalog-sort-wrapper">

                        <button
                            type="button"
                            className={`catalog-sort-button ${showSortMenu
                                ? "active"
                                : ""
                                }`}
                            onClick={() =>
                                setShowSortMenu(
                                    prev => !prev
                                )
                            }
                            aria-label="Ordenar catálogo"
                            aria-expanded={
                                showSortMenu
                            }
                        >

                            <Icon
                                icon="solar:sort-vertical-outline"
                            />

                            <span>
                                Ordenar
                            </span>

                        </button>


                        {/* =====================================
                            MENU
                        ====================================== */}

                        {showSortMenu && (

                            <>

                                <div
                                    className="catalog-sort-backdrop"
                                    onClick={() =>
                                        setShowSortMenu(false)
                                    }
                                />


                                <div className="catalog-sort-menu">


                                    {/* =============================
                                        HEADER DO MENU
                                    ============================== */}

                                    <div className="catalog-sort-menu-header">

                                        <div>

                                            <strong>
                                                Ordenar catálogo
                                            </strong>

                                            <span>
                                                {getSortLabel()}
                                            </span>

                                        </div>


                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowSortMenu(
                                                    false
                                                )
                                            }
                                            aria-label="Fechar"
                                        >

                                            <Icon
                                                icon="mdi:close"
                                            />

                                        </button>

                                    </div>


                                    {/* =============================
                                        OPÇÕES
                                    ============================== */}

                                    <div className="catalog-sort-options">


                                        {/* MAIS RELEVANTES */}

                                        <button
                                            type="button"
                                            className={
                                                sortOption ===
                                                    "relevance"
                                                    ? "selected"
                                                    : ""
                                            }
                                            onClick={() =>
                                                handleSortChange(
                                                    "relevance"
                                                )
                                            }
                                        >

                                            <div className="catalog-sort-option-icon">

                                                <Icon
                                                    icon="solar:star-outline"
                                                />

                                            </div>


                                            <div className="catalog-sort-option-content">

                                                <strong>
                                                    Mais relevantes
                                                </strong>

                                                <span>
                                                    Ordem padrão do catálogo
                                                </span>

                                            </div>


                                            {sortOption ===
                                                "relevance" && (

                                                    <Icon
                                                        icon="material-symbols:check"
                                                        className="catalog-sort-option-check"
                                                    />

                                                )}

                                        </button>


                                        {/* NOME A → Z */}

                                        <button
                                            type="button"
                                            className={
                                                sortOption ===
                                                    "nameAsc"
                                                    ? "selected"
                                                    : ""
                                            }
                                            onClick={() =>
                                                handleSortChange(
                                                    "nameAsc"
                                                )
                                            }
                                        >

                                            <div className="catalog-sort-option-icon">

                                                <Icon
                                                    icon="solar:text-field-outline"
                                                />

                                            </div>


                                            <div className="catalog-sort-option-content">

                                                <strong>
                                                    Nome A → Z
                                                </strong>

                                                <span>
                                                    Ordem alfabética crescente
                                                </span>

                                            </div>


                                            {sortOption ===
                                                "nameAsc" && (

                                                    <Icon
                                                        icon="material-symbols:check"
                                                        className="catalog-sort-option-check"
                                                    />

                                                )}

                                        </button>


                                        {/* NOME Z → A */}

                                        <button
                                            type="button"
                                            className={
                                                sortOption ===
                                                    "nameDesc"
                                                    ? "selected"
                                                    : ""
                                            }
                                            onClick={() =>
                                                handleSortChange(
                                                    "nameDesc"
                                                )
                                            }
                                        >

                                            <div className="catalog-sort-option-icon">

                                                <Icon
                                                    icon="solar:text-field-outline"
                                                />

                                            </div>


                                            <div className="catalog-sort-option-content">

                                                <strong>
                                                    Nome Z → A
                                                </strong>

                                                <span>
                                                    Ordem alfabética decrescente
                                                </span>

                                            </div>


                                            {sortOption ===
                                                "nameDesc" && (

                                                    <Icon
                                                        icon="material-symbols:check"
                                                        className="catalog-sort-option-check"
                                                    />

                                                )}

                                        </button>


                                        {/* MENOR PREÇO */}

                                        <button
                                            type="button"
                                            className={
                                                sortOption ===
                                                    "priceAsc"
                                                    ? "selected"
                                                    : ""
                                            }
                                            onClick={() =>
                                                handleSortChange(
                                                    "priceAsc"
                                                )
                                            }
                                        >

                                            <div className="catalog-sort-option-icon">

                                                <Icon
                                                    icon="solar:tag-price-outline"
                                                />

                                            </div>


                                            <div className="catalog-sort-option-content">

                                                <strong>
                                                    Menor preço
                                                </strong>

                                                <span>
                                                    Do menor para o maior
                                                </span>

                                            </div>


                                            {sortOption ===
                                                "priceAsc" && (

                                                    <Icon
                                                        icon="material-symbols:check"
                                                        className="catalog-sort-option-check"
                                                    />

                                                )}

                                        </button>


                                        {/* MAIOR PREÇO */}

                                        <button
                                            type="button"
                                            className={
                                                sortOption ===
                                                    "priceDesc"
                                                    ? "selected"
                                                    : ""
                                            }
                                            onClick={() =>
                                                handleSortChange(
                                                    "priceDesc"
                                                )
                                            }
                                        >

                                            <div className="catalog-sort-option-icon">

                                                <Icon
                                                    icon="solar:tag-price-outline"
                                                />

                                            </div>


                                            <div className="catalog-sort-option-content">

                                                <strong>
                                                    Maior preço
                                                </strong>

                                                <span>
                                                    Do maior para o menor
                                                </span>

                                            </div>


                                            {sortOption ===
                                                "priceDesc" && (

                                                    <Icon
                                                        icon="material-symbols:check"
                                                        className="catalog-sort-option-check"
                                                    />

                                                )}

                                        </button>


                                        {/* MENOR DURAÇÃO */}

                                        <button
                                            type="button"
                                            className={
                                                sortOption ===
                                                    "durationAsc"
                                                    ? "selected"
                                                    : ""
                                            }
                                            onClick={() =>
                                                handleSortChange(
                                                    "durationAsc"
                                                )
                                            }
                                        >

                                            <div className="catalog-sort-option-icon">

                                                <Icon
                                                    icon="solar:clock-circle-outline"
                                                />

                                            </div>


                                            <div className="catalog-sort-option-content">

                                                <strong>
                                                    Menor duração
                                                </strong>

                                                <span>
                                                    Serviços mais rápidos primeiro
                                                </span>

                                            </div>


                                            {sortOption ===
                                                "durationAsc" && (

                                                    <Icon
                                                        icon="material-symbols:check"
                                                        className="catalog-sort-option-check"
                                                    />

                                                )}

                                        </button>


                                        {/* MAIOR DURAÇÃO */}

                                        <button
                                            type="button"
                                            className={
                                                sortOption ===
                                                    "durationDesc"
                                                    ? "selected"
                                                    : ""
                                            }
                                            onClick={() =>
                                                handleSortChange(
                                                    "durationDesc"
                                                )
                                            }
                                        >

                                            <div className="catalog-sort-option-icon">

                                                <Icon
                                                    icon="solar:clock-circle-outline"
                                                />

                                            </div>


                                            <div className="catalog-sort-option-content">

                                                <strong>
                                                    Maior duração
                                                </strong>

                                                <span>
                                                    Serviços mais longos primeiro
                                                </span>

                                            </div>


                                            {sortOption ===
                                                "durationDesc" && (

                                                    <Icon
                                                        icon="material-symbols:check"
                                                        className="catalog-sort-option-check"
                                                    />

                                                )}

                                        </button>


                                    </div>

                                </div>

                            </>

                        )}

                    </div>

                </div>

            </div>


            {/* =================================================
    CATEGORIAS
================================================= */}

            {
                categories.length > 1 && (

                    <div className="catalog-categories-wrapper">

                        <div className="catalog-categories">

                            {categories.map((category) => {

                                const isActive =
                                    selectedCategory === category;

                                const label =
                                    category === "all"
                                        ? "Todos"
                                        : category;

                                return (

                                    <button
                                        key={category}
                                        type="button"
                                        className={
                                            `catalog-category-button ${isActive
                                                ? "active"
                                                : ""
                                            }`
                                        }
                                        onClick={() =>
                                            handleCategoryChange(category)
                                        }
                                    >

                                        {label}

                                    </button>

                                );

                            })}

                        </div>

                    </div>

                )
            }


            {/* =================================================
                TIPO DE OFERTA
            ================================================= */}

            <div className="catalog-type-filter">

                {TYPE_OPTIONS.map((option) => (

                    <button
                        key={option.id}
                        type="button"
                        className={
                            selectedType === option.id
                                ? "active"
                                : ""
                        }
                        onClick={() =>
                            setSelectedType(option.id)
                        }
                    >

                        <Icon icon={option.icon} />

                        <span>
                            {option.label}
                        </span>

                        <b>
                            {typeCounts[option.id]}
                        </b>

                    </button>

                ))}

            </div>

            <div className="catalog-list">

                {categoryLoading ? (

                    Array.from({
                        length: Math.max(
                            Math.min(filteredProducts.length || 4, 6),
                            4
                        )
                    }).map((_, index) => (

                        <div
                            key={`category-skeleton-${index}`}
                            className="catalog-product catalog-product-skeleton"
                        >

                            <div className="catalog-product-image-wrapper">

                                <div className="catalog-product-image-skeleton" />

                            </div>


                            <div className="catalog-product-info">

                                <div className="catalog-product-main-info">

                                    <div className="catalog-skeleton-category" />

                                    <div className="catalog-skeleton-title" />

                                    <div className="catalog-product-meta">

                                        <div className="catalog-skeleton-meta" />

                                    </div>

                                </div>


                                <div className="catalog-product-action">

                                    <div className="catalog-skeleton-price" />

                                    <div className="catalog-skeleton-button" />

                                </div>

                            </div>

                        </div>

                    ))

                ) : catalogProducts.length > 0 ? (

                    catalogProducts.map(
                        (product) => (

                            <div
                                key={product.id}
                                className="catalog-product"
                                onClick={() =>
                                    openProduct(product)
                                }
                            >


                                {/* =================================
                                    IMAGEM
                                ================================== */}

                                <div className="catalog-product-image-wrapper">


                                    {!loadedImages[
                                        product.id
                                    ] && (

                                            <div className="catalog-product-image-skeleton" />

                                        )}


                                    <img
                                        src={
                                            getProductImage(
                                                product
                                            )
                                        }
                                        alt={
                                            product.name ||
                                            "Serviço"
                                        }
                                        className="catalog-product-image"

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

                                </div>


                                {/* =================================
                                    INFORMAÇÕES
                                ================================== */}

                                <div className="catalog-product-info">


                                    <div className="catalog-product-main-info">


                                        {product.categories?.length > 0 && (

                                            <span className="catalog-product-category">

                                                {
                                                    product.categories[0]
                                                }

                                            </span>

                                        )}


                                        <h3>
                                            {product.name}
                                        </h3>


                                        <div className="catalog-product-meta">


                                            {product.duration && (

                                                <span>

                                                    <Icon
                                                        icon="solar:clock-circle-outline"
                                                    />

                                                    {formatDuration(
                                                        product.duration
                                                    )}

                                                </span>

                                            )}


                                            {/* {product.description && (

                                                <span className="catalog-product-description">

                                                    {
                                                        product.description
                                                    }

                                                </span>

                                            )} */}

                                        </div>

                                    </div>


                                    {/* =================================
                                        PREÇO + AÇÃO
                                    ================================== */}

                                    <div className="catalog-product-action">


                                        <div className="catalog-product-price">

                                            <strong>
                                                <PriceTag product={product} />
                                            </strong>

                                        </div>


                                        <button
                                            type="button"
                                            className="catalog-product-schedule"

                                            onClick={(event) => {

                                                event.stopPropagation();

                                                openProduct(
                                                    product
                                                );

                                            }}
                                        >

                                            Agendar

                                            <Icon
                                                icon="humbleicons:arrow-right"
                                            />

                                        </button>

                                    </div>

                                </div>

                            </div>

                        )
                    )

                ) : subscriptionProducts.length > 0 ? null : (

                    <div className="catalog-empty">

                        <Icon
                            icon={
                                searchTerm
                                    ? "mdi:magnify-close"
                                    : "solar:box-outline"
                            }
                        />

                        <h3>

                            {searchTerm
                                ? "Nenhum serviço encontrado"
                                : "Nenhum serviço disponível"}

                        </h3>

                        <p>

                            {searchTerm
                                ? "Tente pesquisar por outro nome, categoria ou serviço."
                                : "Esta empresa ainda não possui serviços disponíveis."
                            }

                        </p>

                    </div>

                )}

            </div>


            {/* =================================================
                ASSINATURAS
            ================================================= */}

            {!categoryLoading &&
                subscriptionProducts.length > 0 && (

                    <div
                        className={`catalog-subscriptions ${catalogProducts.length === 0
                            ? "is-only"
                            : ""
                            }`}
                    >

                        <div className="catalog-subscriptions-heading">

                            <div>

                                <span>
                                    Assinaturas
                                </span>

                                <h3>
                                    Planos de mensalidade
                                </h3>

                            </div>

                            <p>

                                {subscriptionProducts.length}

                                {" "}

                                {subscriptionProducts.length === 1
                                    ? "plano disponível"
                                    : "planos disponíveis"}

                            </p>

                        </div>


                        <div className="catalog-subscriptions-note">

                            <Icon icon="solar:info-circle-linear" />

                            <p>
                                Os itens abaixo têm cobrança
                                recorrente: o valor se repete a cada
                                ciclo enquanto a assinatura estiver
                                ativa.
                            </p>

                        </div>


                        <div className="catalog-subscriptions-list">

                            {subscriptionProducts.map((product) => {

                                const plan =
                                    normalizeMonthlyPlan(product);

                                if (!plan) {
                                    return null;
                                }

                                return (

                                    <div
                                        key={product.id}
                                        className="catalog-subscription"
                                        onClick={() =>
                                            openProduct(product)
                                        }
                                    >

                                        {/* IMAGEM */}

                                        <div className="catalog-subscription-image">

                                            <img
                                                src={
                                                    getProductImage(
                                                        product
                                                    )
                                                }
                                                alt={
                                                    product.name ||
                                                    "Plano"
                                                }
                                                onError={(event) => {

                                                    event.currentTarget.src =
                                                        Thumb1;

                                                }}
                                            />

                                            <span className="catalog-subscription-badge">
                                                {plan.billingCycleLabel}
                                            </span>

                                        </div>


                                        {/* CONTEÚDO */}

                                        <div className="catalog-subscription-content">

                                            <h4>
                                                {product.name}
                                            </h4>

                                            <span className="catalog-subscription-sessions">
                                                {getPlanSessionsLabel(
                                                    plan
                                                )}
                                            </span>


                                            <ul className="catalog-subscription-details">

                                                {getPlanHighlights(
                                                    plan
                                                ).map((highlight) => (

                                                    <li
                                                        key={highlight.id}
                                                    >

                                                        <Icon
                                                            icon={
                                                                highlight.icon
                                                            }
                                                        />

                                                        <span>
                                                            {highlight.value}
                                                        </span>

                                                    </li>

                                                ))}

                                            </ul>


                                            <div className="catalog-subscription-action">

                                                <div className="catalog-subscription-price">

                                                    <strong>
                                                        <PriceTag product={product} />
                                                    </strong>

                                                    <span>
                                                        {getPlanPriceSuffix(
                                                            plan
                                                        )}
                                                    </span>

                                                </div>

                                                <button
                                                    type="button"
                                                    className="catalog-product-schedule"
                                                    onClick={(event) => {

                                                        event.stopPropagation();

                                                        openProduct(
                                                            product
                                                        );

                                                    }}
                                                >

                                                    Ver mensalidade

                                                    <Icon
                                                        icon="humbleicons:arrow-right"
                                                    />

                                                </button>

                                            </div>

                                        </div>

                                    </div>

                                );

                            })}

                        </div>

                    </div>

                )}


            {/* =================================================
                DETALHES
            ================================================= */}

            {selectedProduct && (

                <ProductDetails

                    product={
                        selectedProduct
                    }

                    companyLogo={
                        companyLogo
                    }

                    companyName={
                        companyName
                    }

                    companyHandle={
                        companyHandle
                    }

                    onClose={
                        closeProduct
                    }

                    formatDuration={
                        formatDuration
                    }

                />

            )}

        </div>

    );

};

export default Catalog;