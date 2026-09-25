/* =========================================================
   IMAGENS DE PRODUTO

   As imagens de produto vivem no Firebase Storage, em
   `companys/{handle}/products/{productId}/images`, e NÃO no
   Realtime Database.

   Produtos antigos ainda carregam `images` (base64) e
   `image` (URL) gravados no RTDB. Eles continuam servindo
   de fallback quando a pasta do Storage está vazia, mas a
   fonte principal é sempre o Storage.
========================================================= */

import { useEffect, useMemo, useState } from "react";

import {
    getStorage,
    ref as storageRef,
    listAll,
    getDownloadURL
} from "firebase/storage";


/**
 * Caminho da pasta de imagens de um produto no Storage.
 */
export const getProductImagesPath = (
    companyHandle,
    productId
) => `companys/${companyHandle}/products/${productId}/images`;


/*
   Cache de promessas por produto.

   Várias telas (home, catálogo, detalhes) pedem as mesmas
   imagens; sem o cache cada montagem dispararia um novo
   listAll + getDownloadURL por arquivo.
*/
const imagesCache = new Map();


const sortByImageIndex = (items) => {

    const getIndex = (name) => {

        const match = name.match(/image_(\d+)/);

        return match
            ? Number(match[1])
            : Number.MAX_SAFE_INTEGER;

    };

    return [...items].sort(
        (a, b) =>
            getIndex(a.name) - getIndex(b.name)
    );

};


const fetchProductImages = async (
    companyHandle,
    productId
) => {

    const folderRef =
        storageRef(
            getStorage(),
            getProductImagesPath(
                companyHandle,
                productId
            )
        );

    const result =
        await listAll(folderRef);

    return Promise.all(
        sortByImageIndex(result.items).map(
            (itemRef) =>
                getDownloadURL(itemRef)
        )
    );

};


/**
 * URLs das imagens de um produto, em ordem.
 *
 * Retorna `[]` quando a pasta não existe ou a leitura
 * falha — nunca lança, porque a falta de imagem não deve
 * derrubar a tela que só queria mostrar um card.
 */
export const loadProductImages = (
    companyHandle,
    productId
) => {

    if (!companyHandle || !productId) {
        return Promise.resolve([]);
    }

    const key = `${companyHandle}/${productId}`;

    if (!imagesCache.has(key)) {

        imagesCache.set(
            key,
            fetchProductImages(
                companyHandle,
                productId
            ).catch((error) => {

                console.error(
                    "Erro ao carregar imagens do produto:",
                    key,
                    error
                );

                /* Permite nova tentativa numa próxima
                   montagem em vez de cachear o erro. */
                imagesCache.delete(key);

                return [];

            })
        );

    }

    return imagesCache.get(key);

};


/**
 * Esquece o que foi cacheado para um produto (ou para
 * todos, quando nenhum id é informado), para que a próxima
 * leitura volte ao Storage. Usado depois de um upload.
 */
export const clearProductImagesCache = (
    companyHandle,
    productId
) => {

    if (!companyHandle || !productId) {
        imagesCache.clear();
        return;
    }

    imagesCache.delete(
        `${companyHandle}/${productId}`
    );

};


/**
 * Imagens gravadas no RTDB por versões antigas do cadastro.
 */
const getLegacyImages = (product) => {

    const fromImages =
        Array.isArray(product?.images)
            ? product.images.filter(Boolean)
            : product?.images
                ? [product.images]
                : [];

    if (fromImages.length > 0) {
        return fromImages;
    }

    return product?.image
        ? [product.image]
        : [];

};


/**
 * Carrega as imagens de uma lista de produtos e devolve um
 * mapa `{ [productId]: string[] }`.
 *
 * Produtos sem arquivo no Storage caem no que estiver no
 * RTDB, então nenhum card fica sem imagem enquanto houver
 * o dado antigo.
 */
export const useProductImages = (
    companyHandle,
    products
) => {

    const [imagesByProduct, setImagesByProduct] =
        useState({});


    /* A lista de produtos é recriada a cada snapshot do
       RTDB; depender dos ids evita refazer o fetch quando
       só a identidade do array mudou. */
    const productIds = useMemo(
        () =>
            (products || [])
                .map((product) => product?.id)
                .filter(Boolean)
                .join(","),
        [products]
    );


    useEffect(() => {

        if (!companyHandle || !productIds) {

            setImagesByProduct({});

            return;
        }

        let cancelled = false;

        const list = products || [];

        Promise.all(
            list.map(
                async (product) => {

                    const stored =
                        await loadProductImages(
                            companyHandle,
                            product.id
                        );

                    return [
                        product.id,
                        stored.length > 0
                            ? stored
                            : getLegacyImages(product)
                    ];

                }
            )
        ).then((entries) => {

            if (cancelled) {
                return;
            }

            setImagesByProduct(
                Object.fromEntries(entries)
            );

        });

        return () => {
            cancelled = true;
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyHandle, productIds]);


    return imagesByProduct;

};


/**
 * Versão para uma tela que lida com um único produto.
 */
export const useSingleProductImages = (
    companyHandle,
    product
) => {

    /*
     * Começa VAZIO de propósito.
     *
     * Semear com getLegacyImages(product) fazia a tela
     * pintar primeiro o base64 que ainda está no RTDB e,
     * um instante depois, trocar pela URL do Storage. Duas
     * fontes para a mesma imagem no mesmo <img> — o
     * navegador pintava, descartava e repintava, e era isso
     * que se via como piscada ao abrir os detalhes do
     * produto.
     *
     * O custo é um quadro de skeleton. Na prática nem isso,
     * porque a listagem que abriu o modal já resolveu essas
     * mesmas URLs e elas estão no cache de loadProductImages.
     */
    const [images, setImages] = useState([]);

    const productId = product?.id;


    useEffect(() => {

        if (!companyHandle || !productId) {
            return;
        }

        let cancelled = false;

        loadProductImages(
            companyHandle,
            productId
        ).then((stored) => {

            if (cancelled) {
                return;
            }

            setImages(
                stored.length > 0
                    ? stored
                    : getLegacyImages(product)
            );

        });

        return () => {
            cancelled = true;
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyHandle, productId]);


    return images;

};
