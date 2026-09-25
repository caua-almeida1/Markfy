/* =========================================================
   PREÇO E PROMOÇÃO

   Os preços são gravados como texto ("R$ 45,00") porque é
   assim que as telas os mostram. Isso é bom para ler e
   péssimo para calcular, então toda conta passa por aqui.

   POR QUE ISTO EXISTE

   O produto guardava três campos soltos:

       value            preço normal
       discount         "27%"
       discountedPrice  preço promocional

   Os três eram escritos na criação e só o `value` era
   editável depois. Bastava o dono mudar o preço para os
   outros dois ficarem mentindo — e era o que acontecia:
   "Pigmentação Barba" mostrava 14% de desconto com preço
   promocional IGUAL ao normal, e "Botox + Corte" anunciava
   40% num desconto que era de 20%.

   A partir daqui só existem duas verdades: o preço normal e
   o promocional. A porcentagem é sempre derivada dos dois,
   nunca digitada e nunca guardada por conta própria.
   ========================================================= */


/** "R$ 1.234,56" → 1234.56. Devolve 0 para o que não for número. */
export const parsePrice = (value) => {

    if (typeof value === "number") {
        return Number.isFinite(value) ? value : 0;
    }

    if (!value) return 0;

    const limpo =
        String(value)
            .replace(/[^\d,.-]/g, "")
            /* Separador de milhar some; a vírgula vira ponto. */
            .replace(/\.(?=\d{3}(\D|$))/g, "")
            .replace(",", ".");

    const numero = Number(limpo);

    return Number.isFinite(numero) ? numero : 0;

};


/** 1234.56 → "R$ 1.234,56". */
export const formatPrice = (value) =>
    Number(value || 0).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL"
    });


/**
 * A promoção de um produto, calculada na hora.
 *
 * `null` quando não há promoção válida — e "válida" aqui
 * quer dizer um preço promocional que existe, é maior que
 * zero e é MENOR que o normal. Um "desconto" que sobe o
 * preço não é desconto, e é exatamente o estado em que boa
 * parte dos produtos estava.
 */
export const getPromotion = (product) => {

    const normal = parsePrice(product?.value);

    const promocional = parsePrice(product?.discountedPrice);

    if (!(normal > 0) || !(promocional > 0)) {
        return null;
    }

    if (promocional >= normal) {
        return null;
    }

    const percentual =
        Math.round(((normal - promocional) / normal) * 100);

    if (percentual <= 0) {
        return null;
    }

    return {
        normal,
        promocional,
        percentual,
        economia: normal - promocional,
        normalLabel: formatPrice(normal),
        promocionalLabel: formatPrice(promocional),
        percentualLabel: `${percentual}%`
    };

};


export const hasPromotion = (product) =>
    getPromotion(product) !== null;


/**
 * Os campos de preço prontos para gravar.
 *
 * Recebe o que está nos inputs e devolve o objeto que vai
 * para o banco, já coerente: sem promoção válida, os campos
 * de desconto são apagados em vez de ficarem com lixo.
 *
 * `monthlyPlan.price` acompanha o preço normal quando o
 * produto é mensalidade — era por não acompanhar que editar
 * o preço de um plano não surtia efeito nenhum: o plano
 * continuava cobrando o valor antigo.
 */
export const buildPriceFields = ({
    value,
    promotionalPrice,
    isSubscription,
    monthlyPlan
}) => {

    const normal = parsePrice(value);

    const promocional = parsePrice(promotionalPrice);

    const temPromocao =
        normal > 0 &&
        promocional > 0 &&
        promocional < normal;

    const percentual =
        temPromocao
            ? Math.round(((normal - promocional) / normal) * 100)
            : 0;

    return {

        value: formatPrice(normal),

        /* null apaga o campo no Realtime Database. */
        discountedPrice:
            temPromocao ? formatPrice(promocional) : null,

        discount:
            temPromocao && percentual > 0
                ? `${percentual}%`
                : null,

        /* Campo antigo, mantido coerente para as telas que
           ainda o leem. */
        originalPrice:
            temPromocao ? formatPrice(normal) : null,

        ...(isSubscription
            ? {
                monthlyPlan: {
                    ...(monthlyPlan || {}),
                    price: formatPrice(normal)
                }
            }
            : {}
        )

    };

};


/**
 * Por que um preço promocional foi recusado.
 * `null` quando está tudo certo (inclusive vazio).
 */
export const validatePromotionalPrice = (value, promotionalPrice) => {

    const promocional = parsePrice(promotionalPrice);

    if (!String(promotionalPrice || "").trim() || promocional === 0) {
        return null;
    }

    const normal = parsePrice(value);

    if (!(normal > 0)) {
        return "Informe o preço normal primeiro.";
    }

    if (promocional >= normal) {
        return "O preço promocional precisa ser menor que o preço normal.";
    }

    return null;

};
