import React, { useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@iconify/react";

import { getPromotion } from "../../../../utils/price";

import "./promo-carousel.css";


/* =========================================================
   BANNERS DE PROMOÇÃO

   Banner, não card de produto.

   A diferença é o que a peça faz: um card lista um item e
   compete com os outros da grade; um banner é uma peça de
   comunicação — manchete grande, uma linha de apoio, a
   imagem sangrando no fundo e um botão. É o que faz a seção
   parar o olho no meio de uma página que já é toda feita de
   cards.

   Por isso cada banner mostra UM produto grande, e não
   cinco pequenos lado a lado. Até 5 banners no carrossel,
   um de cada vez.

   O tema da loja entra pela cor: o fundo sai de
   `--mkf-ui-primary`, então o banner acompanha a identidade
   de cada empresa em vez de ter cor própria.
   ========================================================= */


const MAX_BANNERS = 5;


/*
 * A descrição vem do editor de texto rico, então pode trazer
 * <span style=...> e afins. No banner isso aparecia como
 * código cru no lugar da frase.
 */
const somenteTexto = (html) => {

    if (!html) return "";

    return String(html)
        .replace(/<[^>]*>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();

};


const PromoBanner = ({ product, image, onOpen }) => {

    const promocao = getPromotion(product);

    const apoio = somenteTexto(product.description);

    return (
        <article className="promo-banner">

            {/* A imagem é fundo, não conteúdo: sangra até a
                borda e recebe o degradê que segura o texto. */}
            <div className="promo-banner-bg">

                {image && (
                    <img
                        src={image}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                    />
                )}

                <span className="promo-banner-scrim" />

            </div>


            <div className="promo-banner-content">

                <span className="promo-banner-eyebrow">
                    {promocao ? "Oferta" : "Destaque"}
                </span>

                <h3 className="promo-banner-title">
                    {product.name || "Produto"}
                </h3>

                {apoio && (
                    <p className="promo-banner-text">
                        {apoio}
                    </p>
                )}

                <div className="promo-banner-price">

                    {promocao ? (
                        <>
                            <s>{promocao.normalLabel}</s>

                            <strong>
                                {promocao.promocionalLabel}
                            </strong>
                        </>
                    ) : (
                        <strong>
                            {product.value || "Sob consulta"}
                        </strong>
                    )}

                </div>

                <button
                    type="button"
                    className="promo-banner-cta"
                    onClick={() => onOpen(product)}
                >
                    Agendar
                    <Icon icon="humbleicons:arrow-right" />
                </button>

            </div>


            {/* O número grande é o chamariz da peça — é o que
                se lê de longe, antes mesmo do nome. */}
            {promocao && (

                <div className="promo-banner-off">

                    <span>até</span>

                    <strong>{promocao.percentual}%</strong>

                    <span>OFF</span>

                </div>

            )}

        </article>
    );

};


const PromoCarousel = ({
    products = [],
    getProductImage,
    onOpenProduct
}) => {

    const trilhoRef = useRef(null);

    const [indiceAtivo, setIndiceAtivo] = useState(0);


    /*
     * Os melhores primeiro.
     *
     * Ordena por desconto e só então corta, senão o corte
     * cairia na ordem em que os produtos vieram do banco e a
     * melhor oferta poderia ficar de fora.
     */
    const destaques = useMemo(() => {

        const comOferta = [];
        const semOferta = [];

        products.forEach((product) => {

            const promocao = getPromotion(product);

            if (promocao) {
                comOferta.push({ product, percentual: promocao.percentual });
            } else {
                semOferta.push({ product, percentual: 0 });
            }

        });

        comOferta.sort((a, b) => b.percentual - a.percentual);

        return [...comOferta, ...semOferta]
            .slice(0, MAX_BANNERS)
            .map((item) => item.product);

    }, [products]);


    /* Qual banner está à vista, para acender o ponto certo. */
    const aoRolar = () => {

        const trilho = trilhoRef.current;

        if (!trilho) return;

        const largura =
            trilho.querySelector(".promo-banner")?.offsetWidth || 1;

        setIndiceAtivo(
            Math.round(trilho.scrollLeft / (largura + 16))
        );

    };


    useEffect(() => {

        const trilho = trilhoRef.current;

        if (!trilho) return undefined;

        trilho.addEventListener("scroll", aoRolar, { passive: true });

        return () =>
            trilho.removeEventListener("scroll", aoRolar);

    }, [destaques.length]);


    const irPara = (indice) => {

        const trilho = trilhoRef.current;

        if (!trilho) return;

        const largura =
            trilho.querySelector(".promo-banner")?.offsetWidth || 0;

        trilho.scrollTo({
            left: indice * (largura + 16),
            behavior: "smooth"
        });

    };


    const deslizar = (direcao) => {

        irPara(
            Math.min(
                Math.max(indiceAtivo + direcao, 0),
                destaques.length - 1
            )
        );

    };


    if (destaques.length === 0) {
        return null;
    }


    const temOferta =
        destaques.some((product) => getPromotion(product));


    return (
        <section className="promo-carousel">

            <div className="promo-carousel-heading">

                <div>
                    <span>
                        {temOferta ? "Ofertas" : "Vitrine"}
                    </span>

                    <h2>
                        {temOferta
                            ? "Aproveite enquanto dura"
                            : "Em destaque"}
                    </h2>
                </div>

                {destaques.length > 1 && (

                    <div className="promo-carousel-nav">

                        <button
                            type="button"
                            disabled={indiceAtivo === 0}
                            onClick={() => deslizar(-1)}
                            aria-label="Banner anterior"
                        >
                            <Icon icon="humbleicons:arrow-left" />
                        </button>

                        <button
                            type="button"
                            disabled={indiceAtivo >= destaques.length - 1}
                            onClick={() => deslizar(1)}
                            aria-label="Próximo banner"
                        >
                            <Icon icon="humbleicons:arrow-right" />
                        </button>

                    </div>

                )}

            </div>


            <div
                className="promo-carousel-track"
                ref={trilhoRef}
            >

                {destaques.map((product) => (
                    <PromoBanner
                        key={product.id}
                        product={product}
                        image={getProductImage?.(product)}
                        onOpen={onOpenProduct}
                    />
                ))}

            </div>


            {destaques.length > 1 && (

                <div className="promo-carousel-dots">

                    {destaques.map((product, indice) => (

                        <button
                            key={product.id}
                            type="button"
                            className={
                                indice === indiceAtivo ? "is-active" : ""
                            }
                            onClick={() => irPara(indice)}
                            aria-label={`Ir para o banner ${indice + 1}`}
                        />

                    ))}

                </div>

            )}

        </section>
    );

};


export default PromoCarousel;
