/* =========================================================
   TEMA — CLARO / ESCURO / SISTEMA

   ONDE A PREFERÊNCIA MORA
   -----------------------

   1. `<html data-theme>`  — o que de fato pinta a tela.
      O CSS inteiro reage a esse atributo (ver index.css).

   2. Cookie `markfy_theme` — lido pelo script inline do
      public/index.html ANTES do primeiro paint, para a
      tela já nascer no tema certo (sem flash branco).

   3. `users/{uid}/preferences/theme` no Realtime Database —
      só para quem tem conta, para a escolha acompanhar o
      usuário em outro dispositivo.

   POR QUE NÃO PESA
   ----------------

   - Trocar de rota não mexe em nada: o tema vive num
     atributo do <html>, fora da árvore React. Nenhum
     componente re-renderiza por causa de navegação.

   - O contexto guarda só a string do tema ("light",
     "dark" ou "system"). Trocar de tela não dispara
     leitura nova.

   - O banco é lido UMA vez por sessão de login, não por
     rota. E a escrita só acontece quando o usuário
     realmente clica no botão.

   - O cookie é gravado de forma síncrona e lido pelo
     script de boot, sem esperar React nem Firebase.
========================================================= */

export const THEME_COOKIE = "markfy_theme";

export const THEME_STORAGE_KEY = "markfy-theme";

/* 1 ano: é preferência de interface, não dado sensível. */
const THEME_MAX_AGE_DAYS = 365;

export const THEMES = ["light", "dark", "system"];

export const DEFAULT_THEME = "system";


const isBrowser = () =>
    typeof window !== "undefined" &&
    typeof document !== "undefined";


export const isValidTheme = (value) =>
    THEMES.includes(value);


/* =========================================================
   LEITURA / ESCRITA LOCAL
========================================================= */

const readCookie = (name) => {

    if (!isBrowser()) return null;

    const match =
        document.cookie.match(
            new RegExp(`(?:^|;\\s*)${name}=([^;]*)`)
        );

    return match
        ? decodeURIComponent(match[1])
        : null;

};


const writeCookie = (name, value) => {

    if (!isBrowser()) return;

    const secure =
        window.location.protocol === "https:"
            ? "; Secure"
            : "";

    document.cookie =
        `${name}=${encodeURIComponent(value)}` +
        `; path=/` +
        `; max-age=${THEME_MAX_AGE_DAYS * 24 * 60 * 60}` +
        `; SameSite=Lax${secure}`;

};


/**
 * Preferência gravada neste dispositivo, ou `null`.
 */
export const readStoredTheme = () => {

    if (!isBrowser()) return null;

    const fromCookie = readCookie(THEME_COOKIE);

    if (isValidTheme(fromCookie)) {
        return fromCookie;
    }

    try {

        const fromStorage =
            window.localStorage.getItem(THEME_STORAGE_KEY);

        return isValidTheme(fromStorage)
            ? fromStorage
            : null;

    } catch (error) {

        return null;

    }

};


/**
 * Grava no dispositivo (cookie + espelho em localStorage).
 *
 * O cookie é a fonte principal porque o script de boot o lê
 * antes de qualquer JavaScript da aplicação rodar.
 */
export const writeStoredTheme = (theme) => {

    if (!isBrowser() || !isValidTheme(theme)) return;

    writeCookie(THEME_COOKIE, theme);

    try {
        window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch (error) {
        /* modo privado: o cookie basta */
    }

};


/* =========================================================
   APLICAÇÃO NO DOCUMENTO
========================================================= */

/**
 * `true` quando o sistema operacional está no escuro.
 */
export const prefersDark = () => {

    if (!isBrowser() || !window.matchMedia) {
        return false;
    }

    return window.matchMedia(
        "(prefers-color-scheme: dark)"
    ).matches;

};


/**
 * Tema efetivo: "system" vira "light" ou "dark".
 */
export const resolveTheme = (theme) => {

    if (theme === "light" || theme === "dark") {
        return theme;
    }

    return prefersDark()
        ? "dark"
        : "light";

};


/**
 * Escreve o tema no <html>.
 *
 * - `data-theme` só existe quando a escolha é explícita;
 *   sem ele, o CSS segue o sistema sozinho, via
 *   @media (prefers-color-scheme).
 *
 * - a classe `.dark-mode` é mantida porque telas antigas
 *   ainda dependem dela.
 *
 * `animate` liga a transição suave; no boot ela fica
 * desligada para não animar o primeiro paint.
 */
export const applyTheme = (theme, { animate = false } = {}) => {

    if (!isBrowser()) return;

    const root = document.documentElement;

    const effective = resolveTheme(theme);

    if (animate) {

        root.classList.add("mkf-theme-transition");

        window.setTimeout(() => {
            root.classList.remove("mkf-theme-transition");
        }, 260);

    }

    if (theme === "system") {
        root.removeAttribute("data-theme");
    } else {
        root.setAttribute("data-theme", theme);
    }

    root.classList.toggle(
        "dark-mode",
        effective === "dark"
    );

    /* Pinta a barra do navegador no mobile junto. */
    const meta =
        document.querySelector('meta[name="theme-color"]');

    if (meta) {
        meta.setAttribute(
            "content",
            effective === "dark" ? "#111214" : "#ffffff"
        );
    }

};
