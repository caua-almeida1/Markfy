import React, { useMemo } from "react";

import { Icon } from "@iconify/react";

import { getPromotion } from "../../../../utils/price";

import ProductThumb from "../../../../components/product-thumb/ProductThumb";

import "./promo-carousel.css";


/* =========================================================
   BANNERS DE OFERTA

   Duas peças pretas, lado a lado. Sem carrossel: o que está
   na tela está na tela, e quem passa o olho vê as duas ao
   mesmo tempo — um carrossel esconde metade e depende de a
   pessoa interagir para revelar o resto.

   O FUNDO É SEMPRE PRETO, de propósito.

   Ele não acompanha o tema da loja. Uma vinheta escura é o
   que faz a foto do produto recortar e o número do desconto
   saltar; fundo colorido brigaria com a imagem e mudaria de
   legibilidade a cada empresa. Do tema vêm só a cor do texto
   de destaque e a do botão, que é onde a identidade aparece
   sem atrapalhar a leitura.
   ========================================================= */


/* Duas por vez, e ponto. */
const MAX_BANNERS = 2;


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


const PromoBanner = ({ product, images, onOpen }) => {

    const promocao = getPromotion(product);

    const apoio = somenteTexto(product.description);

    return (
        <article className="promo-banner">

            <div className="promo-banner-content">

                <span className="promo-banner-eyebrow">
                    {promocao ? "Oferta" : "Destaque"}
                </span>

                <h3 className="promo-banner-title">
                    {promocao
                        ? `${promocao.percentual}% de desconto`
                        : product.name}
                </h3>

                {/* Os dois preços, lado a lado.

                    "20% de desconto" sozinho não diz quanto
                    custa; "de R$ 50 por R$ 40" responde a
                    pergunta que a pessoa realmente tem. */}
                {promocao ? (

                    <p className="promo-banner-text">
                        {product.name} — de{" "}
                        <s>{promocao.normalLabel}</s>{" "}
                        por{" "}
                        <strong>{promocao.promocionalLabel}</strong>
                    </p>

                ) : (

                    <p className="promo-banner-text">
                        {apoio || product.value || "Confira os detalhes"}
                    </p>

                )}

                <button
                    type="button"
                    className="promo-banner-cta"
                    onClick={() => onOpen(product)}
                >
                    {promocao ? "Aproveitar" : "Ver detalhes"}
                    <Icon icon="humbleicons:arrow-right" />
                </button>

            </div>


            {/* A arte: número gigante atrás, foto na frente. */}
            <div className="promo-banner-art">

                {promocao && (
                    <span
                        className="promo-banner-off"
                        aria-hidden="true"
                    >
                        {promocao.percentual}
                        <em>
                            %
                            <br />
                            OFF
                        </em>
                    </span>
                )}

                <ProductThumb
                    className="promo-banner-photo"
                    images={images}
                    icon="solar:bag-smile-outline"
                />

            </div>

        </article>
    );

};


const PromoCarousel = ({
    products = [],
    getProductImages,
    onOpenProduct
}) => {

    /*
     * As duas melhores ofertas.
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


    if (destaques.length === 0) {
        return null;
    }


    const temOferta =
        destaques.some((product) => getPromotion(product));


    return (
        <section className="promo-carousel">

            <div className="promo-carousel-heading">

                <span>
                    {temOferta ? "Ofertas" : "Vitrine"}
                </span>

                <h2>
                    {temOferta
                        ? "Aproveite enquanto dura"
                        : "Em destaque"}
                </h2>

            </div>


            <div
                className={`promo-banner-grid ${destaques.length === 1 ? "is-single" : ""
                    }`}
            >

                {destaques.map((product) => (
                    <PromoBanner
                        key={product.id}
                        product={product}
                        images={getProductImages?.(product)}
                        onOpen={onOpenProduct}
                    />
                ))}

            </div>

        </section>
    );

};


export default PromoCarousel;
