import React, { useMemo, useState } from "react";

import { Button, Field, Segmented, Sheet } from "../../design-system/components";
import { pushId } from "../engine/util.js";
import { MoneyInput } from "../ui.jsx";
import { useMenus } from "../MenusContext.jsx";

/* =========================================================
   GRUPO DE ADICIONAIS / SABORES

   Três tipos:
     addon   soma ao preço (bacon, borda, cobertura)
     choice  escolha (ponto da carne, sabor do refrigerante)
     flavor  sabores de pizza: o preço da pizza passa a ser o
             do sabor mais caro (ou a média), por tamanho

   Mínimo > 0 torna o grupo obrigatório. Os tamanhos que
   aparecem nos preços por tamanho vêm dos produtos que usam
   o grupo.
========================================================= */

export const blankGroup = () => ({ name: "", kind: "addon", min: 0, max: 1, flavorPricing: "highest", options: [] });

export default function GroupEditor({ open, group, groupId, products, onClose, onSave, onDelete }) {
    const { can } = useMenus();
    const [form, setForm] = useState(group);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const canPrice = can("catalog.prices") || !groupId;
    const set = (patch) => setForm((current) => ({ ...current, ...patch }));

    const usedBy = products.filter((product) => (product.optionGroupIds || []).includes(groupId));

    /* Tamanhos de quem usa o grupo (por id, sem repetir). */
    const sizes = useMemo(() => {
        const map = new Map();
        usedBy.forEach((product) => (product.sizes || []).forEach((size) => map.has(size.id) || map.set(size.id, size)));
        return [...map.values()];
    }, [usedBy]);

    const options = form.options || [];
    const bySize = form.kind === "flavor" ? sizes.length > 0 : false;

    const updateOption = (id, patch) => set({ options: options.map((option) => (option.id === id ? { ...option, ...patch } : option)) });

    const submit = async () => {
        if (!form.name.trim()) return setError("Dê um nome ao grupo.");
        if (!options.length) return setError("Adicione pelo menos uma opção.");
        if (options.some((option) => !option.name.trim())) return setError("Toda opção precisa de um nome.");
        const min = Math.max(0, Math.round(Number(form.min) || 0));
        const max = Math.max(0, Math.round(Number(form.max) || 0));
        if (max && min > max) return setError("O mínimo não pode ser maior que o máximo.");

        setBusy(true);
        try {
            await onSave({ ...form, name: form.name.trim().slice(0, 60), min, max, options: options.map((option) => ({ ...option, name: option.name.trim().slice(0, 80) })) });
            onClose();
        } catch (problem) {
            setError(problem.message || "Não foi possível salvar.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <Sheet
            open={open}
            onClose={onClose}
            title={groupId ? "Editar grupo" : "Novo grupo de opções"}
            description={groupId ? `Usado em ${usedBy.length} produto(s).` : "Ex.: Adicionais, Ponto da carne, Sabores, Borda."}
            footer={(
                <>
                    {groupId && <Button variant="danger" onClick={onDelete}>Excluir</Button>}
                    <span style={{ flex: 1 }} />
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button variant="primary" loading={busy} onClick={submit}>Salvar</Button>
                </>
            )}
        >
            <div className="mnu-form">
                {error && <p className="mnu-alert is-bad" role="alert">{error}</p>}

                <Field label="Nome do grupo">
                    <input className="mk-input" value={form.name} maxLength={60} onChange={(event) => set({ name: event.target.value })} />
                </Field>

                <div className="mnu-field">
                    <span className="mnu-label">Tipo</span>
                    <Segmented
                        label="Tipo do grupo"
                        value={form.kind}
                        onChange={(kind) => set({ kind, ...(kind === "flavor" ? { min: Math.max(1, Number(form.min) || 1), max: Math.max(2, Number(form.max) || 2) } : {}) })}
                        options={[
                            { value: "addon", label: "Adicionais" },
                            { value: "choice", label: "Escolha" },
                            { value: "flavor", label: "Sabores" }
                        ]}
                    />
                    <small className="mk-muted">
                        {form.kind === "addon" && "Cada opção soma ao preço do produto."}
                        {form.kind === "choice" && "O cliente escolhe entre as opções; pode ou não mudar o preço."}
                        {form.kind === "flavor" && "Para pizzas e afins: o preço final vem dos sabores escolhidos."}
                    </small>
                </div>

                <div className="mnu-grid-2">
                    <Field label="Mínimo de escolhas" hint="0 = opcional">
                        <input className="mk-input" type="number" min="0" max="50" value={form.min} onChange={(event) => set({ min: event.target.value })} />
                    </Field>
                    <Field label="Máximo de escolhas" hint="0 = sem limite">
                        <input className="mk-input" type="number" min="0" max="50" value={form.max} onChange={(event) => set({ max: event.target.value })} />
                    </Field>
                </div>

                {form.kind === "flavor" && (
                    <div className="mnu-field">
                        <span className="mnu-label">Preço com mais de um sabor</span>
                        <Segmented
                            label="Regra de preço"
                            value={form.flavorPricing || "highest"}
                            onChange={(flavorPricing) => set({ flavorPricing })}
                            options={[
                                { value: "highest", label: "Sabor mais caro" },
                                { value: "average", label: "Média dos sabores" }
                            ]}
                        />
                        <small className="mk-muted">O cliente vê essa regra ao escolher os sabores.</small>
                    </div>
                )}

                <div className="mnu-options">
                    <div className="mnu-options__head">
                        <span>Opção</span>
                        {bySize ? sizes.map((size) => <span key={size.id}>{size.name}</span>) : <span>{form.kind === "flavor" ? "Preço da pizza" : "Acréscimo"}</span>}
                        <span className="mnu-visually-hidden">Ações</span>
                    </div>
                    {options.map((option) => (
                        <div key={option.id} className={`mnu-options__row ${option.available === false ? "is-off" : ""}`} style={{ "--cols": bySize ? sizes.length : 1 }}>
                            <input className="mk-input" value={option.name} maxLength={80} aria-label="Nome da opção" onChange={(event) => updateOption(option.id, { name: event.target.value })} />
                            {bySize ? (
                                sizes.map((size) => (
                                    <MoneyInput
                                        key={size.id}
                                        value={option.priceBySize?.[size.id] ?? null}
                                        allowEmpty
                                        disabled={!canPrice}
                                        aria-label={`Preço de ${option.name} no tamanho ${size.name}`}
                                        onChange={(value) => updateOption(option.id, { priceBySize: { ...(option.priceBySize || {}), [size.id]: value } })}
                                    />
                                ))
                            ) : (
                                <MoneyInput value={option.priceCents || 0} disabled={!canPrice} aria-label={`Preço de ${option.name}`} onChange={(value) => updateOption(option.id, { priceCents: value })} />
                            )}
                            <span className="mnu-options__actions">
                                <Button
                                    size="sm"
                                    variant={option.available === false ? "outline" : "ghost"}
                                    icon={option.available === false ? "solar:eye-closed-linear" : "solar:eye-linear"}
                                    aria-label={option.available === false ? "Indisponível — tornar disponível" : "Marcar como indisponível"}
                                    onClick={() => updateOption(option.id, { available: option.available === false })}
                                />
                                <Button size="sm" variant="ghost" icon="solar:trash-bin-minimalistic-linear" aria-label="Remover opção" onClick={() => set({ options: options.filter((item) => item.id !== option.id) })} />
                            </span>
                        </div>
                    ))}
                    <Button size="sm" variant="outline" icon="solar:add-circle-linear" onClick={() => set({ options: [...options, { id: pushId().slice(-8), name: "", priceCents: 0 }] })}>
                        Adicionar opção
                    </Button>
                    {form.kind === "flavor" && !sizes.length && (
                        <p className="mk-muted">Ligue este grupo a um produto com tamanhos para definir o preço de cada sabor por tamanho.</p>
                    )}
                </div>
            </div>
        </Sheet>
    );
}
