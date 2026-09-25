import { useEffect, useState } from "react";

import { getDatabase, ref, onValue } from "firebase/database";

import "./companyThemes.css";

import {
    DEFAULT_COMPANY_THEME,
    getCompanyTheme,
    isValidCompanyTheme
} from "./companyThemes";


/* =========================================================
   TEMA DA EMPRESA NA PÁGINA PÚBLICA

   Lê companys/{handle}/theme e escreve o atributo
   `data-company-theme` no <html>.

   POR QUE NO <html>
   -----------------

   ProductDetails, CompanyInfoModal e o aviso de cookies
   renderizam em portal no <body> — fora da árvore da
   página. Um wrapper com a classe não alcançaria esses
   componentes, e o modal do produto ficaria com a cor da
   plataforma enquanto o resto da página usa a da empresa.

   POR QUE NÃO PESA
   ----------------

   - É um atributo, não estado do React: trocar de aba
     dentro da central (início, catálogo, reservas…) não
     repinta nada.
   - A leitura é um listener único por handle, no campo
     `theme` — não no nó da empresa inteiro.
   - Ao sair da página da empresa, o atributo é removido e
     a plataforma volta à paleta padrão.
========================================================= */

export const useCompanyTheme = (handle) => {

    const [theme, setTheme] = useState(DEFAULT_COMPANY_THEME);


    /* Escuta só o campo do tema. */
    useEffect(() => {

        if (!handle) {

            setTheme(DEFAULT_COMPANY_THEME);

            return undefined;
        }

        const themeRef = ref(
            getDatabase(),
            `companys/${handle}/theme`
        );

        const unsubscribe = onValue(
            themeRef,
            (snapshot) => {

                const value = snapshot.val();

                setTheme(
                    isValidCompanyTheme(value)
                        ? value
                        : DEFAULT_COMPANY_THEME
                );

            },
            () => {

                setTheme(DEFAULT_COMPANY_THEME);

            }
        );

        return () => unsubscribe();

    }, [handle]);


    /* Aplica no documento. */
    useEffect(() => {

        const root = document.documentElement;

        if (!handle) {

            root.removeAttribute("data-company-theme");

            return undefined;
        }

        root.setAttribute("data-company-theme", theme);

        return () => {
            root.removeAttribute("data-company-theme");
        };

    }, [handle, theme]);


    return getCompanyTheme(theme);

};


export default useCompanyTheme;
