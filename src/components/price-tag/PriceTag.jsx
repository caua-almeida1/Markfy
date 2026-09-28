import React from "react";

import {
    getEffectivePriceLabel,
    getPromotion
} from "../../utils/price";

import "./price-tag.css";


/* =========================================================
   PREÇO DE PRODUTO

   Com promoção, mostra o normal riscado e o promocional em
   destaque. Sem promoção, só o preço.

   Existe para as telas pararem de ler `product.value` na
   mão. Quando cada uma fazia isso, o catálogo anunciava
   desconto e o checkout cobrava cheio — e corrigir exigia
   lembrar de todos os lugares.
   ========================================================= */

const PriceTag = ({
    product,

    className = "",

    /* Em espaços apertados (linha de lista, rodapé), o preço
       riscado atrapalha mais do que informa. */
    compact = false
}) => {

    const promocao = getPromotion(product);

    if (!promocao) {
        return (
            <span className={`price-tag ${className}`}>
                {getEffectivePriceLabel(product)}
            </span>
        );
    }

    return (
        <span className={`price-tag has-promo ${className}`}>

            {!compact && (
                <s className="price-tag-old">
                    {promocao.normalLabel}
                </s>
            )}

            <strong className="price-tag-now">
                {promocao.promocionalLabel}
            </strong>

        </span>
    );

};


export default PriceTag;
