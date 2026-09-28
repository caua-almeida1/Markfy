import { parsePrice, formatPrice } from "./price";


/* =========================================================
   COMBOS

   Um combo é um produto que junta outros: "Corte + Barba"
   vendido como uma coisa só, com preço e duração somados.

   POR QUE É UM PRODUTO, E NÃO UM TIPO NOVO DE COISA

   Ele mora em `companys/{handle}/products/{id}` como
   qualquer outro, com `type: "combo"`. Assim catálogo,
   detalhes, agenda, pagamento e painel continuam
   funcionando sem saber que combos existem — o que muda é
   só o que a tela mostra a mais.

   O que o combo guarda além do resto:

       comboItems   os produtos que o formam, com nome,
                    preço e duração congelados no momento
                    da criação
       includes     o texto livre do "este combo inclui"

   Os itens são uma CÓPIA, não uma referência. Se o preço
   do corte mudar amanhã, o combo continua valendo o que
   foi anunciado — quem quiser repassar o aumento edita o
   combo. Guardar só o id faria o preço do combo mudar
   sozinho, sem ninguém decidir.
   ========================================================= */


export const COMBO_TYPE = "combo";

/* Dois é o mínimo para ser combo; acima de cinco o nome
   fica ilegível e a duração, impraticável. */
export const MIN_COMBO_ITEMS = 2;
export const MAX_COMBO_ITEMS = 5;

export const COMBO_NAME_MAX = 60;
export const COMBO_DESCRIPTION_MAX = 220;
export const COMBO_INCLUDES_MAX = 180;


export const isComboProduct = (product) =>
    product?.type === COMBO_TYPE;


/** Os itens do combo, sempre como array. */
export const getComboItems = (product) => {

    const itens = product?.comboItems;

    if (Array.isArray(itens)) {
        return itens;
    }

    /* O Realtime Database devolve objeto quando as chaves
       não são 0,1,2... sequenciais. */
    if (itens && typeof itens === "object") {
        return Object.values(itens);
    }

    return [];

};


export const getComboItemCount = (product) =>
    getComboItems(product).length;


/**
 * "Corte + Barba + Sobrancelha".
 *
 * É só uma sugestão: o nome fica editável. Combos de três
 * ou mais produtos com nomes longos passam do limite, e aí
 * o corte acontece na hora de gravar, não aqui — quem está
 * digitando precisa ver o nome inteiro para decidir o que
 * encurtar.
 */
export const buildComboName = (produtos = []) =>
    produtos
        .map((produto) => (produto?.name || "").trim())
        .filter(Boolean)
        .join(" + ");


/**
 * "Este combo inclui: Corte, Barba e Sobrancelha."
 *
 * Lista com vírgulas e um "e" antes do último, que é como
 * se escreve — e não como um join simples produziria.
 */
export const buildComboIncludes = (produtos = []) => {

    const nomes =
        produtos
            .map((produto) => (produto?.name || "").trim())
            .filter(Boolean);

    if (nomes.length === 0) {
        return "";
    }

    if (nomes.length === 1) {
        return nomes[0];
    }

    return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;

};


/** A soma dos preços, como número. */
export const sumComboPrice = (produtos = []) =>
    produtos.reduce(
        (total, produto) => total + parsePrice(produto?.value),
        0
    );


export const sumComboPriceLabel = (produtos = []) =>
    formatPrice(sumComboPrice(produtos));


/** A soma das durações, em minutos. */
export const sumComboDuration = (produtos = []) =>
    produtos.reduce(
        (total, produto) => total + (Number(produto?.duration) || 0),
        0
    );


/** 95 → "1h 35min". */
export const formatDurationLabel = (minutos) => {

    const total = Number(minutos) || 0;

    const horas = Math.floor(total / 60);
    const resto = total % 60;

    if (horas === 0) {
        return `${resto}min`;
    }

    if (resto === 0) {
        return `${horas}h`;
    }

    return `${horas}h ${resto}min`;

};


/**
 * Os itens no formato que vai para o banco.
 *
 * Só os campos que o combo precisa mostrar depois. Copiar o
 * produto inteiro traria imagens, categorias e configurações
 * de agendamento que já vivem no produto original.
 */
export const buildComboItems = (produtos = []) =>
    produtos.map((produto) => ({
        productId: produto.id,
        name: produto.name || "",
        value: produto.value || null,
        duration: Number(produto.duration) || 0
    }));


/**
 * Por que o combo não pode ser criado ainda.
 * `null` quando está tudo certo.
 */
export const validateCombo = ({
    produtos = [],
    name,
    description,
    includes
}) => {

    if (produtos.length < MIN_COMBO_ITEMS) {
        return `Escolha pelo menos ${MIN_COMBO_ITEMS} produtos.`;
    }

    if (produtos.length > MAX_COMBO_ITEMS) {
        return `Um combo aceita no máximo ${MAX_COMBO_ITEMS} produtos.`;
    }

    if (!String(name || "").trim()) {
        return "Dê um nome ao combo.";
    }

    if (String(name).trim().length > COMBO_NAME_MAX) {
        return `O nome passa de ${COMBO_NAME_MAX} caracteres.`;
    }

    if (String(description || "").length > COMBO_DESCRIPTION_MAX) {
        return `A descrição passa de ${COMBO_DESCRIPTION_MAX} caracteres.`;
    }

    if (String(includes || "").length > COMBO_INCLUDES_MAX) {
        return `O campo "este combo inclui" passa de ${COMBO_INCLUDES_MAX} caracteres.`;
    }

    /*
     * Um combo sem duração não pode ser agendado: a agenda
     * não saberia quanto tempo reservar.
     */
    if (sumComboDuration(produtos) <= 0) {
        return "Os produtos escolhidos não têm duração definida.";
    }

    return null;

};
