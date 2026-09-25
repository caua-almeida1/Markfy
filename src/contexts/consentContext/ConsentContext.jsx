import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState
} from "react";

import {
    CONSENT_CATEGORIES,
    OPTIONAL_CATEGORIES,
    acceptAllConsent,
    readConsent,
    rejectAllConsent,
    resetConsent,
    saveConsent,
    subscribeConsent
} from "../../utils/consent";

import CookieConsent from "../../components/cookie-consent/CookieConsent";


/* =========================================================
   CONTEXTO DE CONSENTIMENTO

   Fica acima de tudo (ver App.js) para que qualquer tela
   consiga perguntar "posso guardar isso?" e para que o
   banner apareça em todas as páginas — inclusive landing,
   login, catálogo e checkout.

   O provider também RENDERIZA o banner: montar o provider
   já é o suficiente, ninguém precisa lembrar de incluir o
   componente em cada rota.
========================================================= */

const ConsentContext = createContext(null);


export const useConsent = () => {

    const context = useContext(ConsentContext);

    if (!context) {

        throw new Error(
            "useConsent precisa estar dentro de <ConsentProvider>."
        );

    }

    return context;

};


const emptySelection = () =>
    Object.fromEntries(
        OPTIONAL_CATEGORIES.map(
            (categoryId) => [categoryId, false]
        )
    );


export const ConsentProvider = ({ children }) => {

    const [consent, setConsent] = useState(
        () => readConsent()
    );

    const [isPreferencesOpen, setIsPreferencesOpen] =
        useState(false);


    /* Mantém a escolha em sincronia quando ela muda em
       outra aba ou por outro ponto do app. */
    useEffect(() => {

        const unsubscribe = subscribeConsent(setConsent);

        const handleStorage = () => {
            setConsent(readConsent());
        };

        window.addEventListener("storage", handleStorage);

        return () => {
            unsubscribe();
            window.removeEventListener("storage", handleStorage);
        };

    }, []);


    /* Sem decisão registrada, o banner precisa aparecer. */
    const isDecided = consent !== null;


    const hasConsent = useCallback(
        (categoryId) => {

            if (categoryId === "essential") {
                return true;
            }

            return Boolean(
                consent?.categories?.[categoryId]
            );

        },
        [consent]
    );


    const acceptAll = useCallback(() => {

        setConsent(acceptAllConsent());
        setIsPreferencesOpen(false);

    }, []);


    const rejectAll = useCallback(() => {

        setConsent(rejectAllConsent());
        setIsPreferencesOpen(false);

    }, []);


    const savePreferences = useCallback((selection) => {

        setConsent(
            saveConsent({
                ...emptySelection(),
                ...selection
            })
        );

        setIsPreferencesOpen(false);

    }, []);


    /* Art. 8º, §5º — revogar tem que ser tão simples
       quanto aceitar. */
    const revokeConsent = useCallback(() => {

        resetConsent();

        setConsent(null);
        setIsPreferencesOpen(false);

    }, []);


    const openPreferences = useCallback(() => {
        setIsPreferencesOpen(true);
    }, []);


    const closePreferences = useCallback(() => {
        setIsPreferencesOpen(false);
    }, []);


    const value = useMemo(
        () => ({
            categories: CONSENT_CATEGORIES,
            consent,
            isDecided,
            hasConsent,
            acceptAll,
            rejectAll,
            savePreferences,
            revokeConsent,
            openPreferences,
            closePreferences,
            isPreferencesOpen
        }),
        [
            consent,
            isDecided,
            hasConsent,
            acceptAll,
            rejectAll,
            savePreferences,
            revokeConsent,
            openPreferences,
            closePreferences,
            isPreferencesOpen
        ]
    );


    return (

        <ConsentContext.Provider value={value}>

            {children}

            <CookieConsent />

        </ConsentContext.Provider>

    );

};


export default ConsentContext;
