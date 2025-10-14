import React, { useEffect, useState } from 'react';
import { useParams } from "react-router-dom";
import { getDatabase, ref, onValue } from "firebase/database";

import { Icon } from '@iconify/react';

import { Navigate, Link } from 'react-router-dom';
import { doSignInWithEmailAndPassword, doSignInWithGoogle } from '../../../firebase/auth';
import { useAuth } from '../../../contexts/authContext';

import "../homepage/home.css";
import TabBar from '../../../components/tabbar';
import ProductDetails from "./ProductDetails/ProductDetails";

import Thumb1 from "../../../img/1.jpg";

const HomePage = () => {
    const { handle } = useParams(); // pega /central-user/:handle
    const [products, setProducts] = useState([]);
    const [companyName, setCompanyName] = useState("");
    const [companyHandle, setCompanyHandle] = useState("");
    const [companyLogo, setCompanyLogo] = useState("");
    const [categories, setCategories] = useState([]);

    const [selectedProduct, setSelectedProduct] = useState(null);

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
                ? Object.entries(data.products).map(([id, prod]) => ({ id, ...prod }))
                : [];
            setProducts(prodsArray);
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
            return data.translatedText || category; // se não traduzir, retorna original
        } catch (err) {
            console.error("Erro na tradução:", err);
            return category; // fallback
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
                return data.icons[0]; // pega o primeiro que achar
            } else {
                return "basil:other-1-outline"; // fallback
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
            const prodsArray = data.products
                ? Object.entries(data.products).map(([id, prod]) => ({ id, ...prod }))
                : [];
            setProducts(prodsArray);

            // junta todas categorias únicas
            const allCategories = prodsArray.flatMap(p => p.categories || []);
            const uniqueCats = [...new Set(allCategories)];

            // traduz + busca ícone
            const categoriesWithIcons = await Promise.all(
                uniqueCats.map(async (cat) => {
                    const icon = await fetchIconForCategory(cat);
                    return { label: cat, icon };
                })
            );

            setCategories(categoriesWithIcons);
        });

        return () => unsubscribe();
    }, [handle]);

    return (
        <div className="home-page">
            <header className="home-header">
                <form className="search-form">
                    <button className="search-button">
                        <svg width="17" height="16" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="search">
                            <path d="M7.667 12.667A5.333 5.333 0 107.667 2a5.333 5.333 0 000 10.667zM14.334 14l-2.9-2.9" stroke="currentColor" strokeWidth="1.333" strokeLinecap="round" strokeLinejoin="round"></path>
                        </svg>
                    </button>
                    <input className="search-input" placeholder="Pesquise..." required type="text" />
                    <button className="reset-button" type="reset">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </form>

                <button className='home-order-by'>
                    <Icon icon="tabler:category" className='icon' />
                </button>
            </header>

            <div className='content-home-page'>
                <div className='content-home-page-header'>
                    <div className='content-home-page-header-action'>
                        <h2>Mais Relevantes</h2>
                        <span>Ver Mais</span>
                    </div>
                    <div className='content-home-page-offers'>
                        <div className="home-page-offer-item">
                            <img src={Thumb1} alt="Oferta" />
                            <div className="home-page-offer-item-content">
                                <button>Cabelo</button>
                                <p>Corte de Cabelo</p>
                                <h1><b>R$</b>45,00</h1>
                            </div>
                        </div>
                        <div className="home-page-offer-item">
                            <img src={Thumb1} alt="Oferta" />
                            <div className="home-page-offer-item-content">
                                <button>Cabelo</button>
                                <p>Corte de Cabelo</p>
                                <h1><b>R$</b>45,00</h1>
                            </div>
                        </div>
                        <div className="home-page-offer-item">
                            <img src={Thumb1} alt="Oferta" />
                            <div className="home-page-offer-item-content">
                                <button>Cabelo</button>
                                <p>Corte de Cabelo</p>
                                <h1><b>R$</b>45,00</h1>
                            </div>
                        </div>
                    </div>
                </div>

                <div className='content-home-page-header home-category-content'>
                    <div className='content-home-page-header-action'>
                        <h2>Categorias</h2>
                    </div>
                    <div className='content-home-page-category'>
                        {categories.map((cat, index) => (
                            <div key={index} className='home-page-category-item'>
                                <p>{cat.label}</p>
                            </div>
                        ))}
                    </div>
                </div>

                <div className='content-home-page-header'>
                    <div className='content-home-page-header-action all-products-section'>
                        <h2>Todos os Produtos</h2>
                        <span>Ver Tudo</span>
                    </div>
                    <div className="content-home-page-all-products">
                        {products.length > 0 ? (
                            products.map(product => (
                                <div
                                    key={product.id}
                                    className="home-page-product-item"
                                    onClick={() => setSelectedProduct(product)}
                                >
                                    <div className="product-image-container">
                                        <img
                                            src={product.images ? product.images[0] : ""}
                                            alt={product.name}
                                            className="product-image"
                                        />
                                    </div>
                                    <div className="product-details">
                                        <h3 className="product-name">{product.name}</h3>
                                        <h1 className="product-price">
                                            {product.value}
                                            <p>/{formatDuration(product.duration)}</p>
                                        </h1>
                                        <button className="product-button">Agendar</button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p>Nenhum produto encontrado.</p>
                        )}
                    </div>
                    {selectedProduct && (
                        <ProductDetails
                            product={selectedProduct}
                            companyLogo={companyLogo}
                            companyName={companyName}
                            companyHandle={companyHandle}
                            onClose={() => setSelectedProduct(null)}
                            formatDuration={formatDuration}
                        />
                    )}
                </div>

            </div>
            <TabBar />
        </div>
    );
};

export default HomePage;
