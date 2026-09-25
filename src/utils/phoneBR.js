/* =========================================================
   TELEFONE BRASILEIRO → E.164

   O Firebase só aceita o formato E.164: "+" seguido do
   código do país e do número, sem espaço nem pontuação.

   Transformar o que a pessoa digita nisso parece trivial e
   não é. O caso que quebrou de verdade:

     a pessoa digitou o número JÁ com o 55 na frente
     (5511989414218). A máscara de 11 dígitos guardou só
     "55119894142", o código jogou "+55" na frente, e o que
     foi para o Firebase era "+5555119894142" — um número
     que não existe. O erro que voltava não falava nada
     sobre isso.

   Aqui o 55 inicial é reconhecido como código do país em
   vez de virar DDD, e o resultado é sempre o mesmo número,
   tenha ele sido digitado com +55, com 55, com 0 na frente
   ou só com o DDD.
   ========================================================= */


/**
 * Devolve o número em E.164 (+55DDNÚMERO) ou null se o que
 * foi digitado não puder ser um telefone brasileiro.
 */
export const toE164BR = (input) => {

    let digitos =
        String(input || "").replace(/\D/g, "");

    if (!digitos) {
        return null;
    }

    /* Código do país digitado junto.
       Só tiramos o 55 quando sobra um número plausível — sem
       isso, um fixo de São Paulo (55 + 8 dígitos = "5534567890")
       perderia o próprio DDD. */
    if (
        digitos.length > 11 &&
        digitos.startsWith("55")
    ) {
        digitos = digitos.slice(2);
    }

    /* Zero de operadora ou DDD escrito como "011". */
    digitos = digitos.replace(/^0+/, "");

    /* 10 = fixo com DDD, 11 = celular com DDD. */
    if (
        digitos.length !== 10 &&
        digitos.length !== 11
    ) {
        return null;
    }

    const ddd = Number(digitos.slice(0, 2));

    /* DDD brasileiro vai de 11 a 99, e nenhum começa com 0. */
    if (ddd < 11) {
        return null;
    }

    /* Celular tem 9 dígitos e começa com 9. */
    if (
        digitos.length === 11 &&
        digitos[2] !== "9"
    ) {
        return null;
    }

    return `+55${digitos}`;

};


export const isValidPhoneBR = (input) =>
    toE164BR(input) !== null;


/**
 * Formata para leitura: +55 (11) 98941-4218.
 * Serve para mostrar à pessoa o número exato que vai receber
 * o SMS, antes de gastar um envio.
 */
export const formatPhoneBR = (input) => {

    const e164 = toE164BR(input);

    if (!e164) {
        return "";
    }

    const digitos = e164.slice(3);

    const ddd = digitos.slice(0, 2);
    const resto = digitos.slice(2);

    const meio =
        resto.length === 9
            ? `${resto.slice(0, 5)}-${resto.slice(5)}`
            : `${resto.slice(0, 4)}-${resto.slice(4)}`;

    return `+55 (${ddd}) ${meio}`;

};


export default toE164BR;
