import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import { getAuth, onAuthStateChanged } from "firebase/auth";
import { getDatabase, ref, get, update } from "firebase/database";

import {
    DEFAULT_THEME,
    applyTheme,
    isValidTheme,
    prefersDark,
    readStoredTheme,
    resolveTheme,
    writeStoredTheme
} from "./theme";


/* =========================================================
   CONTEXTO DE TEMA

   Guarda uma string e nada mais. A pintura é do CSS, a
   partir do atributo em <html> — então mudar de rota, abrir
   modal ou recarregar uma lista não recalcula tema nenhum.
========================================================= */

const ThemeContext = createContext(null);


export const useTheme = () => {

    const context = useContext(ThemeContext);

    if (!context) {

        throw new Error(
            "useTheme precisa estar dentro de <ThemeProvider>."
        );

    }

    return context;

};


export const ThemeProvider = ({ children }) => {

    /*
     * Estado inicial vem do que o script de boot já leu.
     * Assim o primeiro render nasce coerente com a tela,
     * sem um segundo paint.
     */
    const [theme, setThemeState] = useState(
        () => readStoredTheme() || DEFAULT_THEME
    );

    const [resolved, setResolved] = useState(
        () => resolveTheme(readStoredTheme() || DEFAULT_THEME)
    );

    /* Evita gravar no banco a preferência que acabou de vir
       dele. */
    const hydratingFromDatabase = useRef(false);

    const userIdRef = useRef(null);


    /* =====================================================
       APLICAR
    ===================================================== */

    const applyAndTrack = useCallback((next, animate) => {

        applyTheme(next, { animate });

        setResolved(resolveTheme(next));

    }, []);


    /* =====================================================
       TROCA EXPLÍCITA
    ===================================================== */

    const setTheme = useCallback((next) => {

        if (!isValidTheme(next)) {
            return;
        }

        setThemeState(next);

        writeStoredTheme(next);

        applyAndTrack(next, true);

        /* Só grava no banco quem tem conta. A escrita é
           disparada pelo clique, não pela navegação. */
        const uid = userIdRef.current;

        if (!uid || hydratingFromDatabase.current) {
            return;
        }

        update(
            ref(getDatabase(), `users/${uid}/preferences`),
            { theme: next }
        ).catch((error) => {

            console.warn(
                "Não foi possível salvar o tema na conta:",
                error
            );

        });

    }, [applyAndTrack]);


    /**
     * Alterna claro/escuro a partir do que está na tela.
     * Usado pelo botão "Modo escuro".
     */
    const toggleTheme = useCallback(() => {

        setTheme(
            resolveTheme(theme) === "dark"
                ? "light"
                : "dark"
        );

    }, [theme, setTheme]);


    /* =====================================================
       SINCRONIA COM O SISTEMA

       Só tem efeito quando a escolha é "system".
    ===================================================== */

    useEffect(() => {

        if (theme !== "system" || !window.matchMedia) {
            return undefined;
        }

        const query = window.matchMedia(
            "(prefers-color-scheme: dark)"
        );

        const handleChange = () => {
            applyAndTrack("system", true);
        };

        query.addEventListener("change", handleChange);

        return () => {
            query.removeEventListener("change", handleChange);
        };

    }, [theme, applyAndTrack]);


    /* =====================================================
       SINCRONIA ENTRE ABAS
    ===================================================== */

    useEffect(() => {

        const handleStorage = (event) => {

            if (event.key && !event.key.includes("theme")) {
                return;
            }

            const stored = readStoredTheme();

            if (stored && stored !== theme) {

                setThemeState(stored);

                applyAndTrack(stored, true);

            }

        };

        window.addEventListener("storage", handleStorage);

        return () => {
            window.removeEventListener("storage", handleStorage);
        };

    }, [theme, applyAndTrack]);


    /* =====================================================
       PREFERÊNCIA DA CONTA

       Lida UMA vez por login, nunca por rota. Se o
       dispositivo já tem uma escolha local, ela vence: é a
       mais recente do ponto de vista de quem está usando.
    ===================================================== */

    useEffect(() => {

        const unsubscribe = onAuthStateChanged(
            getAuth(),
            async (user) => {

                userIdRef.current = user?.uid || null;

                if (!user) {
                    return;
                }

                if (readStoredTheme()) {
                    return;
                }

                try {

                    const snapshot = await get(
                        ref(
                            getDatabase(),
                            `users/${user.uid}/preferences/theme`
                        )
                    );

                    const stored = snapshot.val();

                    if (!isValidTheme(stored)) {
                        return;
                    }

                    hydratingFromDatabase.current = true;

                    setThemeState(stored);

                    writeStoredTheme(stored);

                    applyAndTrack(stored, true);

                    hydratingFromDatabase.current = false;

                } catch (error) {

                    console.warn(
                        "Não foi possível ler o tema da conta:",
                        error
                    );

                }

            }
        );

        return () => unsubscribe();

    }, [applyAndTrack]);


    /* =====================================================
       GARANTIA DE COERÊNCIA

       O script de boot já pintou a tela. Isto só cobre o
       caso de ele não ter rodado (por exemplo em teste).
    ===================================================== */

    useEffect(() => {

        applyTheme(theme, { animate: false });

        setResolved(resolveTheme(theme));

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    const value = useMemo(
        () => ({
            theme,
            resolvedTheme: resolved,
            isDark: resolved === "dark",
            followsSystem: theme === "system",
            systemPrefersDark: prefersDark(),
            setTheme,
            toggleTheme
        }),
        [theme, resolved, setTheme, toggleTheme]
    );


    return (

        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>

    );

};


export default ThemeContext;
