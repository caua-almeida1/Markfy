/* =========================================================
   LOGO DA EMPRESA

   FONTE ÚNICA: Firebase Storage, em

       companys/{handle}/logo.png

   O Realtime Database NÃO guarda mais a logo. Antes havia
   dois caminhos divergentes:

     - criação da empresa (PreviewCompany) subia o arquivo
       para o Storage e gravava a download URL no RTDB;

     - edição da marca (BrandingScreen) gravava o base64
       INTEIRO dentro de companys/{handle}/logoPreview.

   O segundo caminho deixava ~40 KB por empresa dentro do
   nó lido por home, catálogo, detalhes do produto e
   checkout, e ainda derrubava a logo da tela Explorar,
   porque o índice público só aceita URL (sanitizeLogoUrl).

   Agora os dois caminhos passam por `uploadCompanyLogo` e
   toda leitura passa por `useCompanyLogo`. O que restou de
   base64 no banco é migrado por `migrateLegacyLogo`, que
   sobe o arquivo e limpa o campo.
========================================================= */

import { useEffect, useState } from "react";

import {
    getDatabase,
    ref as dbRef,
    update
} from "firebase/database";

import {
    getStorage,
    ref as storageRef,
    uploadString,
    getDownloadURL
} from "firebase/storage";


export const getCompanyLogoPath = (handle) =>
    `companys/${handle}/logo.png`;


/**
 * `true` para base64 embutido (data:image/...).
 */
export const isDataUrl = (value) =>
    typeof value === "string" &&
    value.startsWith("data:");


/**
 * `true` para URL utilizável (Storage ou qualquer http).
 */
export const isRemoteUrl = (value) =>
    typeof value === "string" &&
    /^https?:\/\//i.test(value.trim());


/* =========================================================
   COMPRESSÃO

   500px de largura e qualidade 0.7 — os mesmos números que
   a criação da empresa já usava, agora em um lugar só.
========================================================= */

export const compressLogo = (
    dataUrl,
    maxWidth = 500,
    quality = 0.7
) =>
    new Promise((resolve, reject) => {

        const image = new Image();

        image.onload = () => {

            try {

                const canvas =
                    document.createElement("canvas");

                const scale =
                    Math.min(maxWidth / image.width, 1);

                canvas.width = image.width * scale;
                canvas.height = image.height * scale;

                const context =
                    canvas.getContext("2d");

                if (!context) {

                    reject(
                        new Error(
                            "Não foi possível criar o canvas."
                        )
                    );

                    return;
                }

                context.drawImage(
                    image,
                    0,
                    0,
                    canvas.width,
                    canvas.height
                );

                resolve(
                    canvas.toDataURL("image/png", quality)
                );

            } catch (error) {

                reject(error);

            }

        };

        image.onerror = () =>
            reject(
                new Error("Não foi possível ler a imagem.")
            );

        image.src = dataUrl;

    });


/* =========================================================
   CACHE DE LEITURA

   A mesma logo é pedida pela home, pelo catálogo, pelos
   detalhes do produto e pelo modal da empresa. Sem cache,
   cada montagem dispararia um getDownloadURL novo.
========================================================= */

const logoCache = new Map();


const fetchLogoUrl = (handle) =>
    getDownloadURL(
        storageRef(
            getStorage(),
            getCompanyLogoPath(handle)
        )
    );


/**
 * Download URL da logo, ou `null` quando a empresa não tem
 * logo. Nunca lança: a falta de logo não pode derrubar a
 * tela que só queria renderizar um cabeçalho.
 */
export const loadCompanyLogo = (handle) => {

    if (!handle) {
        return Promise.resolve(null);
    }

    if (!logoCache.has(handle)) {

        logoCache.set(
            handle,
            fetchLogoUrl(handle).catch(() => {

                /* Empresa sem logo é situação normal.
                   Esquecemos o resultado para que uma
                   próxima montagem tente de novo depois
                   de um upload. */
                logoCache.delete(handle);

                return null;

            })
        );

    }

    return logoCache.get(handle);

};


/**
 * Invalida o cache (usar depois de trocar a logo).
 */
export const clearCompanyLogoCache = (handle) => {

    if (!handle) {
        logoCache.clear();
        return;
    }

    logoCache.delete(handle);

};


/* =========================================================
   ESCRITA
========================================================= */

/**
 * Comprime e envia a logo para o Storage.
 *
 * Aceita data URL (vindo de um input de arquivo ou do
 * cropper) e devolve a download URL. Se receber uma URL
 * remota, entende que a logo já está hospedada e apenas a
 * devolve.
 */
export const uploadCompanyLogo = async (handle, source) => {

    if (!handle || !source) {
        return null;
    }

    if (isRemoteUrl(source)) {
        return source;
    }

    const compressed =
        await compressLogo(source);

    const reference =
        storageRef(
            getStorage(),
            getCompanyLogoPath(handle)
        );

    await uploadString(
        reference,
        compressed,
        "data_url"
    );

    const url =
        await getDownloadURL(reference);

    clearCompanyLogoCache(handle);

    logoCache.set(
        handle,
        Promise.resolve(url)
    );

    return url;

};


/* =========================================================
   MIGRAÇÃO DO LEGADO

   Empresas salvas pela tela de marca antiga têm o base64
   dentro de companys/{handle}/logoPreview. Ao detectar
   isso, subimos o arquivo para o Storage, apontamos o
   índice público para a URL e ZERAMOS o campo no RTDB.

   Só roda com um membro autenticado — é ele quem tem
   permissão de escrita no nó da empresa.

   A ordem importa: o campo só é apagado DEPOIS de o upload
   ter dado certo. Se o upload falhar, o base64 continua lá
   e a migração é tentada de novo na próxima vez.
========================================================= */

export const migrateLegacyLogo = async (handle, legacyValue) => {

    if (!handle || !isDataUrl(legacyValue)) {
        return null;
    }

    try {

        const url =
            await uploadCompanyLogo(handle, legacyValue);

        if (!url) {
            return null;
        }

        const database = getDatabase();

        /* Limpa o base64 do nó da empresa e deixa o índice
           público apontando para o arquivo. */
        await update(
            dbRef(database, `companys/${handle}`),
            { logoPreview: null }
        );

        await update(
            dbRef(database, `companiesIndex/${handle}`),
            { logoUrl: url }
        );

        console.info(
            `Logo da empresa "${handle}" migrada para o Storage.`
        );

        return url;

    } catch (error) {

        console.warn(
            "Não foi possível migrar a logo para o Storage:",
            error
        );

        return null;

    }

};


/* =========================================================
   HOOKS
========================================================= */

/**
 * Logo de uma empresa, resolvida no Storage.
 *
 * `hint` evita a ida ao Storage quando quem chama já tem
 * uma URL pronta (por exemplo companiesIndex.logoUrl).
 * Valores em base64 são ignorados de propósito: é o formato
 * que estamos tirando de circulação.
 */
export const useCompanyLogo = (handle, hint) => {

    const usableHint =
        isRemoteUrl(hint)
            ? hint
            : null;

    const [logo, setLogo] = useState(usableHint);


    useEffect(() => {

        if (usableHint) {

            setLogo(usableHint);

            return undefined;
        }

        if (!handle) {

            setLogo(null);

            return undefined;
        }

        let cancelled = false;

        loadCompanyLogo(handle).then((url) => {

            if (!cancelled) {
                setLogo(url);
            }

        });

        return () => {
            cancelled = true;
        };

    }, [handle, usableHint]);


    return logo;

};


/**
 * Versão em lote, para listas de empresas.
 *
 * Devolve `{ [handle]: url }`. Handles que já vêm com uma
 * URL pronta não geram ida ao Storage.
 */
export const useCompanyLogos = (companies) => {

    const [logos, setLogos] = useState({});

    const signature =
        (companies || [])
            .map(
                (company) =>
                    `${company?.handle}:${isRemoteUrl(company?.logoUrl) ? 1 : 0}`
            )
            .join(",");


    useEffect(() => {

        const list = companies || [];

        if (!list.length) {

            setLogos({});

            return undefined;
        }

        let cancelled = false;

        Promise.all(
            list.map(async (company) => {

                const handle = company?.handle;

                if (!handle) {
                    return null;
                }

                if (isRemoteUrl(company.logoUrl)) {
                    return [handle, company.logoUrl];
                }

                const url =
                    await loadCompanyLogo(handle);

                return [handle, url];

            })
        ).then((entries) => {

            if (cancelled) {
                return;
            }

            setLogos(
                Object.fromEntries(
                    entries.filter(Boolean)
                )
            );

        });

        return () => {
            cancelled = true;
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [signature]);


    return logos;

};
