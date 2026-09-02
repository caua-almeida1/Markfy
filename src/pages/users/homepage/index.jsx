import React, { useEffect, useState } from 'react';
import { useParams } from "react-router-dom";
import { get, ref, getDatabase, onValue, update } from "firebase/database";

import { Icon } from '@iconify/react';

import { Navigate, Link } from 'react-router-dom';
import { doSignInWithEmailAndPassword, doSignInWithGoogle } from '../../../firebase/auth';
import { useAuth } from '../../../contexts/authContext';

import "../homepage/home.css";
import TabBar from '../../../components/tabbar';
import ProductDetails from "./ProductDetails/ProductDetails";

import Thumb1 from "../../../img/1.jpg";

const HomePage = () => {
    const { handle } = useParams();
    const [products, setProducts] = useState([]);
    const [companyName, setCompanyName] = useState("");
    const [companyHandle, setCompanyHandle] = useState("");
    const [companyLogo, setCompanyLogo] = useState("");

    const [showAllProducts, setShowAllProducts] = useState(false);

    const [searchModal, setSearchModal] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");

    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [categoryKey, setCategoryKey] = useState(0);

    const orderedCategories = selectedCategory
        ? [
            ...categories.filter(cat => cat.label === selectedCategory),
            ...categories.filter(cat => cat.label !== selectedCategory)
        ]
        : categories;

    const [selectedProduct, setSelectedProduct] = useState(null);
    const [loadedImages, setLoadedImages] = useState({});

    const handleImageLoad = (id) => {
        setLoadedImages(prev => ({ ...prev, [id]: true }));
    };

    useEffect(() => {
        if (!handle) return;

        const db = getDatabase();
        const companyRef = ref(db, `companys/${handle}`);

        const unsubscribe = onValue(companyRef, async (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            setCompanyName(data.name || "");
            setCompanyLogo(data.logoPreview || "");
            setCompanyHandle(data.handle || "");
            const prodsArray = data.products
                ? Object.entries(data.products)
                    .filter(([id, prod]) =>
                        prod?.status !== "arquivados"
                    )
                    .map(([id, prod]) => ({
                        id,
                        ...prod,
                        orders: Number(prod.orders) || 0
                    }))
                    .sort((a, b) => b.orders - a.orders)
                : [];
            setProducts(prodsArray);
        });

        return () => unsubscribe();
    }, [handle]);



    useEffect(() => {
        if (products.length > 0) {
            const sorted = [...products].sort((a, b) => (b.orders || 0) - (a.orders || 0));
            setProducts(sorted);
        }
    }, [products]);

    useEffect(() => {
        if (!handle) return;

        const db = getDatabase();
        const productsRef = ref(db, `companys/${handle}/products`);
        const unsubscribe = onValue(productsRef, (snapshot) => {
            const data = snapshot.val() || {};


            const prods = Object.entries(data)
                .filter(([id, prod]) =>
                    prod?.status !== "arquivados"
                )
                .map(([id, prod]) => ({
                    id,
                    name: prod?.name || "(sem nome)",
                    orders: Number(prod?.orders) || 0,
                }));

            prods.sort((a, b) => b.orders - a.orders);

            // Log principal 
            console.log("Produtos ordenados por orders (maior -> menor):");
            prods.forEach((p, idx) => {
                console.log(`${idx + 1}. ${p.name} — orders: ${p.orders}`);
            });

            if (prods.length === 0) {
                console.log("Nenhum produto encontrado em companys/" + handle + "/products");
            }
        }, (err) => {
            console.error("Erro ao ler products do Firebase:", err);
        });

        return () => unsubscribe();
    }, [handle]);


    const formatDuration = (minutes) => {
        if (!minutes || isNaN(minutes)) return "";
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;

        if (h > 0 && m > 0) return `${h}h ${m}min`;
        if (h > 0) return `${h}h`;
        return `${m}min`;
    };

    const translateCategory = async (category) => {
        try {
            const res = await fetch("https://libretranslate.de/translate", {
                method: "POST",
                body: JSON.stringify({
                    q: category,
                    source: "pt",
                    target: "en",
                    format: "text"
                }),
                headers: { "Content-Type": "application/json" }
            });

            const data = await res.json();
            return data.translatedText || category;
        } catch (err) {
            console.error("Erro na tradução:", err);
            return category;
        }
    };

    const fetchIconForCategory = async (category) => {
        try {
            const translated = await translateCategory(category);

            const response = await fetch(
                `https://api.iconify.design/search?query=${encodeURIComponent(translated)}`
            );
            const data = await response.json();

            if (data?.icons?.length > 0) {
                return data.icons[0];
            } else {
                return "basil:other-1-outline";
            }
        } catch (err) {
            console.error("Erro ao buscar ícone:", err);
            return "basil:other-1-outline";
        }
    };

    useEffect(() => {
        if (!handle) return;

        const db = getDatabase();
        const companyRef = ref(db, `companys/${handle}`);

        const unsubscribe = onValue(companyRef, async (snapshot) => {
            const data = snapshot.val();
            if (!data) return;

            setCompanyName(data.name || "");
            setCompanyLogo(data.logoPreview || "");
            setCompanyHandle(data.handle || "");

            // Monta e ordena produtos
            const prodsArray = data.products
                ? Object.entries(data.products)
                    .filter(([id, prod]) =>
                        prod?.status !== "arquivados"
                    )
                    .map(([id, prod]) => ({
                        id,
                        ...prod,
                        orders: Number(prod.orders) || 0
                    }))
                    .sort((a, b) => b.orders - a.orders)
                : [];

            setProducts(prodsArray);

            const allCategories = prodsArray.flatMap(p => p.categories || []);
            const uniqueCats = [...new Set(allCategories)];

            const categoriesWithIcons = await Promise.all(
                uniqueCats.map(async (cat) => ({
                    label: cat,
                    icon: await fetchIconForCategory(cat),
                }))
            );

            setCategories(categoriesWithIcons);
        });

        return () => unsubscribe();
    }, [handle]);

    const filteredProducts = products.filter(product =>
        product.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const categoryProducts = selectedCategory
        ? products.filter(p =>
            p.categories?.includes(selectedCategory)
        )
        : products;

    const [searchClosing, setSearchClosing] = useState(false);

    const closeSearch = () => {
        setSearchClosing(true);

        setTimeout(() => {
            setSearchModal(false);
            setSearchClosing(false);
        }, 200);
    };

    return (
        <div className="home-page">
            <header className="home-header">

                <div className="home-company-info">
                    {companyLogo && (
                        <img
                            src={companyLogo}
                            alt={companyName}
                            className="home-company-logo"
                        />
                    )}

                    <h1 className="home-company-name">
                        {companyName}
                    </h1>
                </div>

                <button
                    className="home-search-button"
                    onClick={() => setSearchModal(true)}
                >
                    <Icon icon="mdi:magnify" />
                </button>

            </header>

            <div className="content-home-page">

                {!showAllProducts ? (

                    <>
                        {/* =========================
                CATEGORIAS
            ========================= */}

                        <div className="content-home-page-header home-category-content">

                            <div className="content-home-page-category">

                                {orderedCategories.map((cat, index) => (

                                    <div
                                        key={index}
                                        className={`home-page-category-item ${selectedCategory === cat.label
                                            ? "active"
                                            : ""
                                            }`}
                                        onClick={() => {

                                            setSelectedCategory(prev =>
                                                prev === cat.label
                                                    ? null
                                                    : cat.label
                                            );

                                            setLoadedImages({});
                                            setCategoryKey(prev => prev + 1);

                                        }}
                                    >

                                        <p>
                                            {cat.label}
                                        </p>

                                    </div>

                                ))}

                            </div>

                        </div>


                        {/* =========================
                MAIS RELEVANTES
            ========================= */}

                        {/* =========================
    PRODUTOS DA HOME
========================= */}

                        <div className="home-products-sections">

                            {/* =====================================================
        CATEGORIA / TODOS OS PRODUTOS
    ====================================================== */}

                            {selectedCategory && (

                                <div className="content-home-page-header">

                                    <div className="content-home-page-header-action all-products-section">

                                        <h2>
                                            {selectedCategory}
                                        </h2>

                                        <span
                                            onClick={() => {
                                                setShowAllProducts(true);
                                                setSelectedCategory(null);
                                            }}
                                        >
                                            Ver Tudo
                                        </span>

                                    </div>


                                    <div className="content-home-page-all-products">

                                        {categoryProducts.length > 0 ? (

                                            categoryProducts.map((product) => (

                                                <div
                                                    key={`${product.id}-${categoryKey}`}
                                                    className="home-page-product-item product-reveal-onload"
                                                    onClick={() =>
                                                        setSelectedProduct(product)
                                                    }
                                                >

                                                    {/* IMAGEM */}

                                                    <div className="product-image-container">

                                                        <div className="image-wrapper">

                                                            {!loadedImages[product.id] && (
                                                                <div className="image-skeleton" />
                                                            )}

                                                            <img
                                                                src={
                                                                    product.images?.[0]
                                                                        ? product.images[0]
                                                                        : Thumb1
                                                                }
                                                                alt={product.name}
                                                                className="product-image"
                                                                onLoad={() =>
                                                                    handleImageLoad(product.id)
                                                                }
                                                                onError={(e) => {

                                                                    e.target.src = Thumb1;

                                                                    handleImageLoad(product.id);

                                                                }}
                                                                style={{
                                                                    opacity:
                                                                        loadedImages[product.id]
                                                                            ? 1
                                                                            : 0
                                                                }}
                                                            />

                                                        </div>

                                                    </div>


                                                    {/* INFORMAÇÕES */}

                                                    <div className="product-details">

                                                        <h3 className="product-name">
                                                            {product.name}
                                                        </h3>

                                                        <h1 className="product-price">

                                                            {product.value}

                                                            <p>
                                                                /
                                                                {formatDuration(
                                                                    product.duration
                                                                )}
                                                            </p>

                                                        </h1>

                                                        <button
                                                            className="product-button"
                                                        >
                                                            Agendar
                                                        </button>

                                                    </div>

                                                </div>

                                            ))

                                        ) : (

                                            <p className="no-results">
                                                Nenhum produto nesta categoria
                                            </p>

                                        )}

                                    </div>

                                </div>

                            )}


                            {/* =====================================================
        MAIS RELEVANTES
    ====================================================== */}

                            <div className="content-home-page-header">

                                <div className="content-home-page-header-action">

                                    <h2>
                                        Mais Relevantes
                                    </h2>

                                    <span
                                        onClick={() => {
                                            setShowAllProducts(true);
                                            setSelectedCategory(null);
                                        }}
                                    >
                                        Ver Mais
                                    </span>

                                </div>


                                <div className="content-home-page-offers">

                                    {products.length > 0 ? (

                                        products
                                            .slice(0, 3)
                                            .map((product) => (

                                                <div
                                                    key={`${product.id}-${categoryKey}`}
                                                    className="home-page-offer-item product-reveal-onload"
                                                    onClick={() =>
                                                        setSelectedProduct(product)
                                                    }
                                                >

                                                    <div className="image-wrapper">

                                                        {!loadedImages[product.id] && (
                                                            <div className="image-skeleton" />
                                                        )}

                                                        <img
                                                            src={
                                                                product.images?.[0]
                                                                    ? product.images[0]
                                                                    : Thumb1
                                                            }
                                                            alt={product.name}
                                                            onLoad={() =>
                                                                handleImageLoad(product.id)
                                                            }
                                                            onError={(e) => {

                                                                e.target.src = Thumb1;

                                                                handleImageLoad(product.id);

                                                            }}
                                                            style={{
                                                                opacity:
                                                                    loadedImages[product.id]
                                                                        ? 1
                                                                        : 0
                                                            }}
                                                        />

                                                    </div>


                                                    <div className="home-page-offer-item-content">

                                                        <button>
                                                            {product.categories?.length > 0
                                                                ? product.categories[0]
                                                                : "Serviço"}
                                                        </button>

                                                        <p>
                                                            {product.name}
                                                        </p>

                                                        <h1>
                                                            {product.value}
                                                        </h1>

                                                    </div>

                                                </div>

                                            ))

                                    ) : (

                                        <p>
                                            Nenhuma oferta disponível.
                                        </p>

                                    )}

                                </div>

                            </div>


                            {/* =====================================================
        TODOS OS PRODUTOS
    ====================================================== */}

                            {!selectedCategory && (

                                <div className="content-home-page-header">

                                    <div className="content-home-page-header-action all-products-section">

                                        <h2>
                                            Todos os Produtos
                                        </h2>

                                        <span
                                            onClick={() => {
                                                window.dispatchEvent(
                                                    new CustomEvent("markfy:go-to-catalog")
                                                );
                                            }}
                                        >
                                            Ver Tudo
                                        </span>

                                    </div>


                                    <div className="content-home-page-all-products">

                                        {products.length > 0 ? (

                                            products.map((product) => (

                                                <div
                                                    key={product.id}
                                                    className="home-page-product-item product-reveal-onload"
                                                    onClick={() =>
                                                        setSelectedProduct(product)
                                                    }
                                                >

                                                    {/* IMAGEM */}

                                                    <div className="product-image-container">

                                                        <div className="image-wrapper">

                                                            {!loadedImages[product.id] && (
                                                                <div className="image-skeleton" />
                                                            )}

                                                            <img
                                                                src={
                                                                    product.images?.[0]
                                                                        ? product.images[0]
                                                                        : Thumb1
                                                                }
                                                                alt={product.name}
                                                                className="product-image"
                                                                onLoad={() =>
                                                                    handleImageLoad(product.id)
                                                                }
                                                                onError={(e) => {

                                                                    e.target.src = Thumb1;

                                                                    handleImageLoad(product.id);

                                                                }}
                                                                style={{
                                                                    opacity:
                                                                        loadedImages[product.id]
                                                                            ? 1
                                                                            : 0
                                                                }}
                                                            />

                                                        </div>

                                                    </div>


                                                    {/* INFORMAÇÕES */}

                                                    <div className="product-details">

                                                        <h3 className="product-name">
                                                            {product.name}
                                                        </h3>

                                                        <h1 className="product-price">

                                                            {product.value}

                                                            <p>
                                                                /
                                                                {formatDuration(
                                                                    product.duration
                                                                )}
                                                            </p>

                                                        </h1>

                                                        <button
                                                            className="product-button"
                                                        >
                                                            Agendar
                                                        </button>

                                                    </div>

                                                </div>

                                            ))

                                        ) : (

                                            <p className="no-results">
                                                Nenhum produto encontrado.
                                            </p>

                                        )}

                                    </div>

                                </div>

                            )}

                        </div>

                    </>

                ) : (

                    /* ========================================
                       TELA DE TODOS OS PRODUTOS
                    ======================================== */

                    <div className="all-products-view">

                        <div className="all-products-view-header">

                            <button
                                type="button"
                                onClick={() => {
                                    setShowAllProducts(false);
                                    setSelectedCategory(null);
                                }}
                                className="all-products-back"
                            >
                                <Icon icon="humbleicons:arrow-left" />

                                <span>
                                    Voltar
                                </span>
                            </button>

                            <div className="all-products-title-area">

                                <div>
                                    <h2>
                                        Todos os Produtos
                                    </h2>

                                    <p>
                                        {products.length}{" "}
                                        {products.length === 1
                                            ? "produto disponível"
                                            : "produtos disponíveis"}
                                    </p>
                                </div>

                            </div>

                        </div>


                        <div className="all-products-list">

                            {products.length > 0 ? (

                                products.map((product) => (

                                    <div
                                        key={product.id}
                                        className="all-product-card"
                                        onClick={() =>
                                            setSelectedProduct(product)
                                        }
                                    >

                                        {/* IMAGEM */}

                                        <div className="all-product-image-wrapper">

                                            {!loadedImages[product.id] && (
                                                <div className="all-product-image-skeleton" />
                                            )}

                                            <img
                                                src={
                                                    product.images?.[0]
                                                        ? product.images[0]
                                                        : Thumb1
                                                }
                                                alt={product.name}
                                                className="all-product-image"
                                                onLoad={() =>
                                                    handleImageLoad(product.id)
                                                }
                                                onError={(e) => {

                                                    e.target.src = Thumb1;

                                                    handleImageLoad(product.id);

                                                }}
                                                style={{
                                                    opacity:
                                                        loadedImages[product.id]
                                                            ? 1
                                                            : 0
                                                }}
                                            />

                                        </div>


                                        {/* INFORMAÇÕES */}

                                        <div className="all-product-info">

                                            <div className="all-product-main-info">

                                                <span className="all-product-category">

                                                    {product.categories?.length > 0
                                                        ? product.categories[0]
                                                        : "Serviço"}

                                                </span>

                                                <h3>
                                                    {product.name}
                                                </h3>

                                                <div className="all-product-meta">

                                                    <span>
                                                        <Icon icon="solar:clock-circle-outline" />

                                                        {formatDuration(
                                                            product.duration
                                                        )}
                                                    </span>

                                                    {product.description && (

                                                        <span className="all-product-description">
                                                            {product.description}
                                                        </span>

                                                    )}

                                                </div>

                                            </div>


                                            {/* PREÇO */}

                                            <div className="all-product-action">

                                                <div className="all-product-price">

                                                    <strong>
                                                        {product.value}
                                                    </strong>

                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={(e) => {

                                                        e.stopPropagation();

                                                        setSelectedProduct(product);

                                                    }}
                                                    className="all-product-schedule"
                                                >
                                                    Agendar

                                                    <Icon icon="humbleicons:arrow-right" />

                                                </button>

                                            </div>

                                        </div>

                                    </div>

                                ))

                            ) : (

                                <div className="all-products-empty">

                                    <Icon icon="solar:box-outline" />

                                    <h3>
                                        Nenhum produto encontrado
                                    </h3>

                                    <p>
                                        Esta empresa ainda não possui produtos disponíveis.
                                    </p>

                                </div>

                            )}

                        </div>

                    </div>

                )}


                {/* =========================
        PRODUCT DETAILS
    ========================= */}

                {selectedProduct && (

                    <ProductDetails
                        product={selectedProduct}
                        companyLogo={companyLogo}
                        companyName={companyName}
                        companyHandle={companyHandle}
                        onClose={() =>
                            setSelectedProduct(null)
                        }
                        formatDuration={formatDuration}
                    />

                )}

            </div>

            {searchModal && (
                <div className={`search-modal ${searchClosing ? "closing" : ""}`}>

                    <div className="search-modal-content">

                        <div className="search-modal-header">

                            <input
                                type="text"
                                placeholder="Pesquisar produtos..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                autoFocus
                            />

                            <button onClick={closeSearch}>
                                <Icon icon="mdi:close" />
                            </button>

                        </div>

                        <div className="search-results">

                            {filteredProducts.length > 0 ? (
                                filteredProducts.map(product => (
                                    <div
                                        key={product.id}
                                        className="search-result-item"
                                        onClick={() => {
                                            setSelectedProduct(product);
                                            setSearchModal(false);
                                        }}
                                    >
                                        <img
                                            src={product.images ? product.images[0] : ""}
                                            alt={product.name}
                                        />

                                        <div>
                                            <h3>{product.name}</h3>
                                            <p>{product.value}</p>
                                        </div>

                                    </div>
                                ))
                            ) : (
                                <p className="no-results">
                                    Nenhum produto encontrado
                                </p>
                            )}

                        </div>

                    </div>

                </div>
            )}
        </div>
    );
};

export default HomePage;
