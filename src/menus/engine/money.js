/* =========================================================
   DINHEIRO

   Todo valor do Markfy Menus é gravado em CENTAVOS inteiros
   (campos terminados em "Cents"). Soma de centavos é exata;
   soma de reais em ponto flutuante não é (0,1 + 0,2).
========================================================= */

/** Converte número em reais, texto "R$ 1.234,56" ou centavos já inteiros (via opts). */
export const toCents = (value) => {
    if (value === null || value === undefined || value === "") return null;

    if (typeof value === "number") {
        return Number.isFinite(value) ? Math.round(value * 100) : null;
    }

    let normalized = String(value).trim().replace(/[^\d,.-]/g, "");
    if (!normalized || !/\d/.test(normalized)) return null;

    if (normalized.includes(",") && normalized.includes(".")) {
        normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else if (normalized.includes(",")) {
        normalized = normalized.replace(",", ".");
    }

    const amount = Number(normalized);
    return Number.isFinite(amount) ? Math.round(amount * 100) : null;
};

export const cents = (value) => {
    const number = Math.round(Number(value));
    return Number.isFinite(number) ? number : 0;
};

export const isMoney = (value) => Number.isInteger(value) && value >= 0 && value <= 100000000;

export const formatBRL = (valueCents) =>
    (cents(valueCents) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** Texto do campo de preço (sem "R$"), para inputs. */
export const centsToInput = (valueCents) =>
    valueCents === null || valueCents === undefined
        ? ""
        : (cents(valueCents) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Percentual de um valor, arredondado ao centavo. */
export const percentOf = (valueCents, percent) => Math.round((cents(valueCents) * Number(percent || 0)) / 100);

/**
 * Divide um total em N partes que somam EXATAMENTE o total.
 * Os centavos que sobram vão para as primeiras partes:
 * R$ 100,00 / 3 = 33,34 + 33,33 + 33,33.
 */
export const splitEqually = (totalCents, parts) => {
    const total = cents(totalCents);
    const count = Math.max(1, Math.min(100, Math.round(Number(parts) || 1)));
    const base = Math.floor(total / count);
    const remainder = total - base * count;
    return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
};
