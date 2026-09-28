import React, { useEffect, useState } from "react";

import { Icon } from "@iconify/react";

import "./product-thumb.css";


/* =========================================================
   IMAGEM DE PRODUTO

   Três estados, e a diferença entre eles importa:

     carregando  as URLs do Storage ainda estão sendo
                 resolvidas — skeleton
     sem imagem  o produto não tem foto cadastrada — ícone
     com imagem  a foto

   Antes existia um só: qualquer ausência caía numa foto
   genérica (`img/1.jpg`) de um produto que não é o produto.
   Como resolver as URLs leva alguns instantes, essa foto
   errada aparecia em TODA visita, para todo mundo, e só
   depois era trocada — parecia um catálogo de outra loja
   piscando antes do certo.

   O skeleton diz "está vindo" sem afirmar nada falso.
   ========================================================= */


const ProductThumb = ({
    /* undefined = ainda resolvendo. Array = resolvido (pode
       estar vazio). É essa distinção que separa o skeleton
       do estado "sem foto". */
    images,

    alt = "",

    className = "",

    icon = "solar:bag-smile-outline"
}) => {

    const resolvido = Array.isArray(images);

    const url = resolvido ? images[0] : null;

    /* A imagem só aparece depois que o navegador termina de
       pintá-la; até lá o skeleton continua, senão haveria um
       quadro em branco entre um e outro. */
    const [carregada, setCarregada] = useState(false);

    /* Uma URL que o navegador não conseguiu abrir — arquivo
       removido do Storage, token vencido. */
    const [falhou, setFalhou] = useState(false);


    useEffect(() => {

        setCarregada(false);
        setFalhou(false);

    }, [url]);


    const mostrarSkeleton =
        !resolvido || (url && !carregada && !falhou);

    const mostrarIcone =
        resolvido && (!url || falhou);


    return (
        <div className={`product-thumb ${className}`}>

            {url && !falhou && (
                <img
                    src={url}
                    alt={alt}
                    loading="lazy"
                    onLoad={() => setCarregada(true)}
                    onError={() => setFalhou(true)}
                    style={{ opacity: carregada ? 1 : 0 }}
                />
            )}

            {mostrarSkeleton && (
                <span
                    className="product-thumb-skeleton"
                    aria-hidden="true"
                />
            )}

            {mostrarIcone && (
                <span
                    className="product-thumb-empty"
                    aria-hidden="true"
                >
                    <Icon icon={icon} />
                </span>
            )}

        </div>
    );

};


export default ProductThumb;
