import React, { useEffect, useMemo, useState } from "react";

import { Icon } from "@iconify/react";

import Modal from "../../../../components/modal/Modal";
import ProductThumb from "../../../../components/product-thumb/ProductThumb";

import {
    buildComboIncludes,
    buildComboName,
    COMBO_DESCRIPTION_MAX,
    COMBO_INCLUDES_MAX,
    COMBO_NAME_MAX,
    formatDurationLabel,
    isComboProduct,
    MAX_COMBO_ITEMS,
    MIN_COMBO_ITEMS,
    sumComboDuration,
    sumComboPriceLabel,
    validateCombo
} from "../../../../utils/combo";

import { isSubscriptionProduct } from "../../../../utils/subscription";

import "./combo-builder.css";


/* =========================================================
   CRIAR COMBO

   Dois passos, e a divisão não é enfeite: escolher os
   produtos e nomear o pacote são decisões diferentes, e
   misturá-las numa tela só faria a pessoa editar o nome
   antes de saber o que o combo tem.

     1. escolher    2 a 5 produtos
     2. ajustar     nome, descrição, "inclui" e preço

   Nome, texto do "inclui" e preço já chegam prontos a partir
   do que foi escolhido. São sugestões: tudo é editável, e o
   preço somado costuma ser o ponto de partida para o
   desconto do combo.
   ========================================================= */


const ComboBuilderModal = ({
    open,
    onClose,
    products = [],
    getProductImages,
    onCreate,
    creating = false
}) => {

    const [step, setStep] = useState("escolher");

    const [selectedIds, setSelectedIds] = useState([]);

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [includes, setIncludes] = useState("");
    const [price, setPrice] = useState("");

    /* Qual produto cede a imagem do combo. Começa no
       primeiro e a pessoa pode trocar. */
    const [coverId, setCoverId] = useState(null);

    const [search, setSearch] = useState("");
    const [error, setError] = useState("");


    /*
     * Produtos que podem entrar num combo.
     *
     * Mensalidade fica de fora: ela tem cobrança recorrente
     * e ciclo próprio, que não somam com um serviço avulso.
     * Combo de combo também não — o preço já viria somado
     * duas vezes.
     */
    const elegiveis = useMemo(() => {

        const termo = search.trim().toLowerCase();

        return products
            .filter(
                (product) =>
                    !isSubscriptionProduct(product) &&
                    !isComboProduct(product) &&
                    product.status !== "arquivados"
            )
            .filter(
                (product) =>
                    !termo ||
                    (product.name || "")
                        .toLowerCase()
                        .includes(termo)
            );

    }, [products, search]);


    const selecionados = useMemo(
        () =>
            selectedIds
                .map((id) => products.find((p) => p.id === id))
                .filter(Boolean),
        [selectedIds, products]
    );


    /* Zera tudo ao reabrir: um combo pela metade da vez
       anterior não pode reaparecer. */
    useEffect(() => {

        if (open) return;

        setStep("escolher");
        setSelectedIds([]);
        setName("");
        setDescription("");
        setIncludes("");
        setPrice("");
        setCoverId(null);
        setSearch("");
        setError("");

    }, [open]);


    const alternar = (product) => {

        setError("");

        setSelectedIds((atual) => {

            if (atual.includes(product.id)) {
                return atual.filter((id) => id !== product.id);
            }

            if (atual.length >= MAX_COMBO_ITEMS) {

                setError(
                    `Um combo aceita no máximo ${MAX_COMBO_ITEMS} produtos.`
                );

                return atual;

            }

            return [...atual, product.id];

        });

    };


    const irParaAjustes = () => {

        if (selecionados.length < MIN_COMBO_ITEMS) {

            setError(
                `Escolha pelo menos ${MIN_COMBO_ITEMS} produtos.`
            );

            return;

        }

        /* As sugestões são montadas agora, e não a cada
           seleção: assim o que a pessoa já tiver editado no
           passo 2 não é sobrescrito ao voltar e avançar. */
        setName(buildComboName(selecionados));
        setIncludes(buildComboIncludes(selecionados));
        setPrice(sumComboPriceLabel(selecionados));
        setCoverId(selecionados[0].id);

        setError("");
        setStep("ajustar");

    };


    const criar = () => {

        const problema = validateCombo({
            produtos: selecionados,
            name,
            description,
            includes
        });

        if (problema) {
            setError(problema);
            return;
        }

        onCreate({
            produtos: selecionados,
            name: name.trim(),
            description: description.trim(),
            includes: includes.trim(),
            price,
            coverProductId: coverId
        });

    };


    const duracaoTotal = sumComboDuration(selecionados);


    return (
        <Modal
            open={open}
            onClose={creating ? undefined : onClose}
            dismissible={!creating}
            overlayClassName="combo-builder-overlay"
            className="combo-builder"
            label="Criar combo"
        >

            <header className="combo-builder-header">

                <div>
                    <span>
                        {step === "escolher"
                            ? `Passo 1 de 2`
                            : `Passo 2 de 2`}
                    </span>

                    <h2>
                        {step === "escolher"
                            ? "Escolha os produtos"
                            : "Ajuste o combo"}
                    </h2>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    disabled={creating}
                    aria-label="Fechar"
                >
                    <Icon icon="lucide:x" />
                </button>

            </header>


            <div className="combo-builder-body">

                {step === "escolher" ? (

                    <>
                        <p className="combo-builder-intro">
                            Junte de {MIN_COMBO_ITEMS} a {MAX_COMBO_ITEMS}{" "}
                            serviços num pacote só. O preço e a duração
                            são somados, e você ajusta tudo no próximo
                            passo.
                        </p>

                        <div className="combo-builder-search">

                            <Icon icon="lucide:search" />

                            <input
                                type="text"
                                placeholder="Buscar produto"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />

                        </div>

                        {elegiveis.length === 0 ? (

                            <div className="combo-builder-empty">
                                <Icon icon="lucide:package-search" />

                                <strong>Nenhum produto disponível</strong>

                                <span>
                                    Combos usam serviços avulsos —
                                    mensalidades e outros combos não
                                    entram.
                                </span>
                            </div>

                        ) : (

                            <div className="combo-builder-list">

                                {elegiveis.map((product) => {

                                    const marcado =
                                        selectedIds.includes(product.id);

                                    return (
                                        <button
                                            key={product.id}
                                            type="button"
                                            className={`combo-builder-item ${marcado ? "is-selected" : ""
                                                }`}
                                            onClick={() => alternar(product)}
                                        >

                                            <span className="combo-builder-item-thumb">
                                                <ProductThumb
                                                    images={getProductImages?.(product)}
                                                    alt={product.name}
                                                />
                                            </span>

                                            <span className="combo-builder-item-text">

                                                <strong>{product.name}</strong>

                                                <small>
                                                    {product.value || "Sem preço"}
                                                    {product.duration
                                                        ? ` · ${formatDurationLabel(product.duration)}`
                                                        : ""}
                                                </small>

                                            </span>

                                            <span className="combo-builder-check">
                                                {marcado && (
                                                    <Icon icon="lucide:check" />
                                                )}
                                            </span>

                                        </button>
                                    );

                                })}

                            </div>

                        )}
                    </>

                ) : (

                    <>
                        {/* Resumo do que foi escolhido, sempre à
                            vista enquanto se edita o nome. */}
                        <div className="combo-builder-summary">

                            <div className="combo-builder-summary-facts">

                                <div>
                                    <span>Produtos</span>
                                    <strong>{selecionados.length}</strong>
                                </div>

                                <div>
                                    <span>Duração</span>
                                    <strong>
                                        {formatDurationLabel(duracaoTotal)}
                                    </strong>
                                </div>

                                <div>
                                    <span>Soma</span>
                                    <strong>
                                        {sumComboPriceLabel(selecionados)}
                                    </strong>
                                </div>

                            </div>

                            {/* Qual imagem representa o combo. */}
                            <div className="combo-builder-covers">

                                <span className="combo-builder-label">
                                    Imagem do combo
                                </span>

                                <div className="combo-builder-covers-list">

                                    {selecionados.map((product) => (

                                        <button
                                            key={product.id}
                                            type="button"
                                            className={`combo-builder-cover ${coverId === product.id ? "is-active" : ""
                                                }`}
                                            onClick={() => setCoverId(product.id)}
                                            title={product.name}
                                        >
                                            <ProductThumb
                                                images={getProductImages?.(product)}
                                                alt={product.name}
                                            />
                                        </button>

                                    ))}

                                </div>

                            </div>

                        </div>


                        <div className="combo-builder-field">

                            <label htmlFor="combo-name">
                                Nome do combo
                            </label>

                            <input
                                id="combo-name"
                                type="text"
                                maxLength={COMBO_NAME_MAX}
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />

                            <small>
                                {name.length}/{COMBO_NAME_MAX}
                            </small>

                        </div>


                        <div className="combo-builder-field">

                            <label htmlFor="combo-price">
                                Preço
                            </label>

                            <input
                                id="combo-price"
                                type="text"
                                value={price}
                                onChange={(e) => setPrice(e.target.value)}
                            />

                            <small>
                                Já vem com a soma dos produtos. Baixe o
                                valor se o combo tiver desconto.
                            </small>

                        </div>


                        <div className="combo-builder-field">

                            <label htmlFor="combo-includes">
                                Este combo inclui
                            </label>

                            <textarea
                                id="combo-includes"
                                rows={2}
                                maxLength={COMBO_INCLUDES_MAX}
                                value={includes}
                                onChange={(e) => setIncludes(e.target.value)}
                            />

                            <small>
                                {includes.length}/{COMBO_INCLUDES_MAX}
                            </small>

                        </div>


                        <div className="combo-builder-field">

                            <label htmlFor="combo-description">
                                Descrição
                                <span className="combo-builder-optional">
                                    opcional
                                </span>
                            </label>

                            <textarea
                                id="combo-description"
                                rows={3}
                                maxLength={COMBO_DESCRIPTION_MAX}
                                placeholder="O que o cliente ganha ao fechar o pacote?"
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                            />

                            <small>
                                {description.length}/{COMBO_DESCRIPTION_MAX}
                            </small>

                        </div>
                    </>

                )}


                {error && (
                    <div className="combo-builder-error" role="alert">
                        <Icon icon="lucide:alert-triangle" />
                        <span>{error}</span>
                    </div>
                )}

            </div>


            <footer className="combo-builder-footer">

                {step === "escolher" ? (

                    <>
                        <span className="combo-builder-count">
                            {selecionados.length} de {MAX_COMBO_ITEMS}
                            {selecionados.length > 0 && (
                                <strong>
                                    {sumComboPriceLabel(selecionados)}
                                </strong>
                            )}
                        </span>

                        <button
                            type="button"
                            className="combo-builder-primary"
                            disabled={selecionados.length < MIN_COMBO_ITEMS}
                            onClick={irParaAjustes}
                        >
                            Continuar
                            <Icon icon="lucide:arrow-right" />
                        </button>
                    </>

                ) : (

                    <>
                        <button
                            type="button"
                            className="combo-builder-secondary"
                            disabled={creating}
                            onClick={() => setStep("escolher")}
                        >
                            <Icon icon="lucide:arrow-left" />
                            Voltar
                        </button>

                        <button
                            type="button"
                            className="combo-builder-primary"
                            disabled={creating}
                            onClick={criar}
                        >
                            {creating ? "Criando..." : "Criar combo"}
                            <Icon
                                icon={
                                    creating
                                        ? "svg-spinners:90-ring-with-bg"
                                        : "lucide:check"
                                }
                            />
                        </button>
                    </>

                )}

            </footer>

        </Modal>
    );

};


export default ComboBuilderModal;
