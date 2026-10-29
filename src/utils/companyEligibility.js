/* =========================================================
   ELEGIBILIDADE E ORDEM DAS EMPRESAS NAS ÁREAS PÚBLICAS

   Regra única para Explorar e central do usuário:

   1. Só aparece quem pode receber clientes agora
      (publicAccess/{handle}.bookings, plano ativo e não
      vencido). Plano superior NÃO faz aparecer empresa
      inativa, suspensa ou vencida.

   2. Ordem:
        a) destaque (publicAccess.featured === true) primeiro;
        b) depois, perfil mais completo (logo, descrição,
           categoria, endereço) — quem preencheu mais ajuda
           mais quem está procurando;
        c) empate: nome, em ordem alfabética.

   O destaque vem de publicAccess, que só a conta master e o
   backend gravam a partir da licença (ver publicAccessFor em
   src/menus/engine/licensing.js): o navegador da empresa não
   consegue se promover. Toda empresa elegível continua na
   lista — o destaque muda a ordem, não esconde ninguém — e a
   tela identifica quem está em destaque.
========================================================= */

export const isBookingsOpen = (access, now = Date.now()) =>
    Boolean(
        access &&
        access.bookings === true &&
        (!access.expiresAt || Number(access.expiresAt) > now)
    );

const hasText = (value) => typeof value === "string" && value.replace(/<[^>]*>/g, "").trim().length > 0;

/** 0 a 4: quanto do perfil público está preenchido. */
export const profileCompleteness = (company) => {

    if (!company) return 0;

    const categories = Array.isArray(company.categories)
        ? company.categories
        : company.category
            ? [company.category]
            : [];

    return [
        hasText(company.logoUrl) || hasText(company.logo),
        hasText(company.description),
        categories.length > 0,
        Boolean(company.location && (company.location.city || company.location.street))
    ].filter(Boolean).length;
};

/**
 * Filtra pelos elegíveis e ordena.
 *
 * `accessByHandle`: publicAccess inteiro ({ handle: entrada }).
 * Sem ele, só ordena (a lista já veio filtrada).
 */
export const rankCompanies = (companies, accessByHandle = null, now = Date.now()) =>
    (companies || [])
        .filter((company) => company && company.handle)
        .filter((company) => !accessByHandle || isBookingsOpen(accessByHandle[company.handle], now))
        .map((company) => ({
            ...company,
            featured: accessByHandle
                ? accessByHandle[company.handle]?.featured === true
                : company.featured === true
        }))
        .sort((a, b) =>
            Number(b.featured) - Number(a.featured) ||
            profileCompleteness(b) - profileCompleteness(a) ||
            String(a.name || "").localeCompare(String(b.name || ""), "pt-BR")
        );
