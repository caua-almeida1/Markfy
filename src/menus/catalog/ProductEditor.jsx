import React, { useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";

import { Button, Field, Sheet, Spinner, cx } from "../../design-system/components";
import { DAY_IDS, DAY_LABELS, isTime } from "../engine/hours.js";
import { formatBRL } from "../engine/money.js";
import { GROUP_KINDS } from "../engine/pricing.js";
import { pushId } from "../engine/util.js";
import { DIET_TAGS } from "../site/MenuRenderer.jsx";
import { MoneyInput, Toggle } from "../ui.jsx";
import { useMenus } from "../MenusContext.jsx";

/* =========================================================
   EDITOR DE PRODUTO

   O básico à vista (nome, foto, preço, categoria) e o resto
   recolhido por assunto. Preço só pode ser alterado por quem
   tem a permissão "Alterar preços"; os outros veem o campo
   travado e o motivo.
========================================================= */

const ALLERGENS = ["Glúten", "Lactose", "Ovo", "Amendoim", "Castanhas", "Soja", "Peixe", "Crustáceos", "Gergelim", "Sulfitos"];

const Section = ({ title, hint, children, defaultOpen = false }) => (
    <details className="mnu-details" open={defaultOpen}>
        <summary>
            <span>
                <b>{title}</b>
                {hint && <small>{hint}</small>}
            </span>
            <Icon icon="solar:alt-arrow-down-linear" aria-hidden="true" />
        </summary>
        <div className="mnu-details__body">{children}</div>
    </details>
);

export const blankProduct = (categoryId) => ({
    name: "",
    description: "",
    categoryId,
    priceCents: 0,
    promoPriceCents: null,
    image: "",
    sizes: [],
    optionGroupIds: [],
    available: true,
    published: true,
    orderable: true,
    prepMinutes: null,
    sku: "",
    tags: {},
    dietTags: [],
    allergens: [],
    schedule: null,
    unitLabel: ""
});

export default function ProductEditor({ open, product, productId, categories, groups, onClose, onSave, onDelete, onManageGroups }) {
    const { can, source } = useMenus();
    const [form, setForm] = useState(product);
    const [busy, setBusy] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const fileRef = useRef(null);

    const canPrice = can("catalog.prices") || !productId;
    const set = (patch) => setForm((current) => ({ ...current, ...patch }));

    const sizes = form.sizes || [];
    const hasSizes = sizes.length > 0;

    const groupList = useMemo(() => groups, [groups]);

    const upload = async (file) => {
        if (!file) return;
        setUploading(true);
        setError("");
        try {
            const url = await source.upload(file, "products");
            set({ image: url });
        } catch (problem) {
            setError(problem.message || "Não foi possível enviar a imagem.");
        } finally {
            setUploading(false);
        }
    };

    const submit = async () => {
        if (!form.name.trim()) return setError("Dê um nome ao produto.");
        if (!form.categoryId) return setError("Escolha a categoria.");
        if (hasSizes && sizes.some((size) => !size.name.trim())) return setError("Dê um nome a cada tamanho.");
        if (form.schedule && (!isTime(form.schedule.from) || !isTime(form.schedule.to))) return setError("Confira o horário de disponibilidade.");

        setBusy(true);
        setError("");
        try {
            await onSave({
                ...form,
                name: form.name.trim().slice(0, 80),
                description: (form.description || "").trim().slice(0, 400),
                sku: (form.sku || "").trim().slice(0, 30),
                unitLabel: (form.unitLabel || "").trim().slice(0, 10),
                priceCents: hasSizes ? Math.min(...sizes.map((size) => size.priceCents || 0)) : form.priceCents || 0,
                promoPriceCents: !hasSizes && form.promoPriceCents ? form.promoPriceCents : null,
                sizes: sizes.map((size) => ({ ...size, name: size.name.trim().slice(0, 40) })),
                allergens: (form.allergens || []).filter(Boolean),
                prepMinutes: form.prepMinutes ? Math.max(0, Math.min(600, Math.round(form.prepMinutes))) : null
            });
            onClose();
        } catch (problem) {
            setError(problem.message || "Não foi possível salvar.");
        } finally {
            setBusy(false);
        }
    };

    const toggleList = (key, value) => {
        const list = form[key] || [];
        set({ [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] });
    };

    return (
        <Sheet
            open={open}
            onClose={onClose}
            title={productId ? "Editar produto" : "Novo produto"}
            description={productId ? form.name : "Comece pelo nome, foto e preço. O resto é opcional."}
            footer={(
                <>
                    {productId && can("catalog.edit") && (
                        <Button variant="danger" icon="solar:trash-bin-minimalistic-linear" onClick={onDelete}>Excluir</Button>
                    )}
                    <span style={{ flex: 1 }} />
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button variant="primary" loading={busy} onClick={submit}>Salvar</Button>
                </>
            )}
        >
            <div className="mnu-form">
                {error && <p className="mnu-alert is-bad" role="alert">{error}</p>}

                <div className="mnu-photo">
                    <button type="button" className="mnu-photo__drop" onClick={() => fileRef.current?.click()} aria-label="Escolher foto do produto">
                        {uploading ? <Spinner /> : form.image ? <img src={form.image} alt="" /> : <><Icon icon="solar:camera-add-linear" /> Foto</>}
                    </button>
                    <div>
                        <b>Foto do produto</b>
                        <small>JPG, PNG ou WEBP. Reduzimos o tamanho antes de enviar.</small>
                        <div className="mnu-row">
                            <Button size="sm" onClick={() => fileRef.current?.click()}>{form.image ? "Trocar" : "Enviar foto"}</Button>
                            {form.image && <Button size="sm" variant="ghost" onClick={() => set({ image: "" })}>Remover</Button>}
                        </div>
                    </div>
                    <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => upload(event.target.files?.[0])} />
                </div>

                <Field label="Nome" count={form.name.length} max={80}>
                    <input className="mk-input" value={form.name} maxLength={80} onChange={(event) => set({ name: event.target.value })} placeholder="Ex.: Pizza de calabresa" />
                </Field>

                <Field label="Descrição" count={(form.description || "").length} max={400}>
                    <textarea className="mk-textarea" value={form.description || ""} maxLength={400} onChange={(event) => set({ description: event.target.value })} placeholder="Ingredientes, porção, como é servido…" />
                </Field>

                <Field label="Categoria">
                    <select className="mk-select" value={form.categoryId || ""} onChange={(event) => set({ categoryId: event.target.value })}>
                        <option value="">Escolha…</option>
                        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}{category.menuName ? ` · ${category.menuName}` : ""}</option>)}
                    </select>
                </Field>

                <div className="mnu-card">
                    <Toggle
                        checked={hasSizes}
                        onChange={(value) => set({ sizes: value ? [{ id: pushId().slice(-8), name: "Médio", priceCents: form.priceCents || 0 }] : [] })}
                        label="Vende em tamanhos"
                        hint="Pizza média e grande, porção individual e para dois…"
                        disabled={!canPrice}
                    />

                    {!hasSizes ? (
                        <div className="mnu-grid-2">
                            <Field label="Preço" hint={canPrice ? undefined : "Seu perfil não altera preços."}>
                                <MoneyInput value={form.priceCents || 0} onChange={(value) => set({ priceCents: value })} disabled={!canPrice} />
                            </Field>
                            <Field label="Preço promocional (opcional)" hint="Só aparece riscado se for menor que o preço.">
                                <MoneyInput value={form.promoPriceCents ?? null} allowEmpty onChange={(value) => set({ promoPriceCents: value })} disabled={!canPrice} />
                            </Field>
                        </div>
                    ) : (
                        <div className="mnu-sizes">
                            {sizes.map((size, index) => (
                                <div key={size.id} className="mnu-sizes__row">
                                    <input className="mk-input" value={size.name} maxLength={40} aria-label={`Nome do tamanho ${index + 1}`} onChange={(event) => set({ sizes: sizes.map((item) => (item.id === size.id ? { ...item, name: event.target.value } : item)) })} />
                                    <MoneyInput value={size.priceCents || 0} onChange={(value) => set({ sizes: sizes.map((item) => (item.id === size.id ? { ...item, priceCents: value } : item)) })} disabled={!canPrice} aria-label={`Preço do tamanho ${size.name}`} />
                                    <Button
                                        size="sm"
                                        variant={size.available === false ? "outline" : "ghost"}
                                        icon={size.available === false ? "solar:eye-closed-linear" : "solar:eye-linear"}
                                        aria-label={size.available === false ? "Tamanho indisponível — tornar disponível" : "Marcar tamanho como indisponível"}
                                        onClick={() => set({ sizes: sizes.map((item) => (item.id === size.id ? { ...item, available: item.available === false } : item)) })}
                                    />
                                    <Button size="sm" variant="ghost" icon="solar:trash-bin-minimalistic-linear" aria-label="Remover tamanho" disabled={!canPrice} onClick={() => set({ sizes: sizes.filter((item) => item.id !== size.id) })} />
                                </div>
                            ))}
                            <Button size="sm" variant="outline" icon="solar:add-circle-linear" disabled={!canPrice} onClick={() => set({ sizes: [...sizes, { id: pushId().slice(-8), name: "", priceCents: 0 }] })}>Adicionar tamanho</Button>
                            <p className="mk-muted">Sabores com preço por tamanho usam estes tamanhos (veja “Adicionais e sabores”).</p>
                        </div>
                    )}
                </div>

                <div className="mnu-card">
                    <Toggle checked={form.available !== false} onChange={(value) => set({ available: value })} label="Disponível agora" hint="Desligue quando acabar; o produto continua cadastrado." />
                    <Toggle checked={form.published !== false} onChange={(value) => set({ published: value })} label="Publicado no cardápio" hint="Desligado: só a equipe vê (rascunho)." />
                    <Toggle checked={form.orderable !== false} onChange={(value) => set({ orderable: value })} label="Pode ser pedido" hint="Desligado: aparece só como vitrine (ex.: bufê por quilo)." />
                </div>

                <Section title="Adicionais e sabores" hint={`${(form.optionGroupIds || []).length} grupo(s) ligado(s)`} defaultOpen={(form.optionGroupIds || []).length > 0}>
                    {!groupList.length && <p className="mk-muted">Nenhum grupo criado ainda.</p>}
                    <div className="mnu-checks">
                        {groupList.map((group) => (
                            <label key={group.id} className="mnu-check">
                                <input type="checkbox" checked={(form.optionGroupIds || []).includes(group.id)} onChange={() => toggleList("optionGroupIds", group.id)} />
                                <span>
                                    <b>{group.name}</b>
                                    <small>{GROUP_KINDS[group.kind] || "Adicionais"} · {(group.options || []).length} opção(ões) · {Number(group.min) ? `obrigatório (mín. ${group.min})` : "opcional"}{Number(group.max) ? `, máx. ${group.max}` : ""}</small>
                                </span>
                            </label>
                        ))}
                    </div>
                    <Button size="sm" variant="outline" icon="solar:settings-linear" onClick={onManageGroups}>Gerenciar grupos</Button>
                </Section>

                <Section title="Destaques e selos" hint="Só o que for verdade: nada é marcado sozinho.">
                    <div className="mnu-chips">
                        {[["featured", "Destaque"], ["new", "Novidade"], ["bestseller", "Mais pedido"]].map(([key, label]) => (
                            <button key={key} type="button" className="mk-chip" aria-pressed={Boolean(form.tags?.[key])} onClick={() => set({ tags: { ...(form.tags || {}), [key]: !form.tags?.[key] } })}>{label}</button>
                        ))}
                    </div>
                    <p className="mnu-label">Informações alimentares</p>
                    <div className="mnu-chips">
                        {Object.entries(DIET_TAGS).map(([id, tag]) => (
                            <button key={id} type="button" className="mk-chip" aria-pressed={(form.dietTags || []).includes(id)} onClick={() => toggleList("dietTags", id)}>
                                <Icon icon={tag.icon} aria-hidden="true" /> {tag.label}
                            </button>
                        ))}
                    </div>
                    <p className="mnu-label">Alérgenos e avisos</p>
                    <div className="mnu-chips">
                        {ALLERGENS.map((item) => (
                            <button key={item} type="button" className="mk-chip" aria-pressed={(form.allergens || []).includes(item)} onClick={() => toggleList("allergens", item)}>{item}</button>
                        ))}
                    </div>
                </Section>

                <Section title="Horário de disponibilidade" hint={form.schedule ? "Só aparece para pedido nos dias e horas escolhidos" : "Disponível sempre que a loja estiver aberta"}>
                    <Toggle checked={Boolean(form.schedule)} onChange={(value) => set({ schedule: value ? { days: [1, 2, 3, 4, 5], from: "11:00", to: "15:00" } : null })} label="Limitar dias e horários" />
                    {form.schedule && (
                        <>
                            <div className="mnu-chips">
                                {DAY_IDS.map((id, index) => (
                                    <button
                                        key={id}
                                        type="button"
                                        className="mk-chip"
                                        aria-pressed={(form.schedule.days || []).includes(index)}
                                        onClick={() => {
                                            const days = form.schedule.days || [];
                                            set({ schedule: { ...form.schedule, days: days.includes(index) ? days.filter((day) => day !== index) : [...days, index].sort() } });
                                        }}
                                    >
                                        {DAY_LABELS[id].slice(0, 3)}
                                    </button>
                                ))}
                            </div>
                            <div className="mnu-grid-2">
                                <Field label="Das"><input className="mk-input" type="time" value={form.schedule.from} onChange={(event) => set({ schedule: { ...form.schedule, from: event.target.value } })} /></Field>
                                <Field label="Até"><input className="mk-input" type="time" value={form.schedule.to} onChange={(event) => set({ schedule: { ...form.schedule, to: event.target.value } })} /></Field>
                            </div>
                        </>
                    )}
                </Section>

                <Section title="Detalhes internos" hint="Código, preparo e unidade de venda">
                    <div className="mnu-grid-2">
                        <Field label="Código interno (SKU)"><input className="mk-input" value={form.sku || ""} maxLength={30} onChange={(event) => set({ sku: event.target.value })} /></Field>
                        <Field label="Tempo de preparo (min)"><input className="mk-input" type="number" min="0" max="600" value={form.prepMinutes || ""} onChange={(event) => set({ prepMinutes: Number(event.target.value) || null })} /></Field>
                    </div>
                    <Field label="Vendido por (opcional)" hint="Ex.: kg ou 100 g. Mostra o preço como “R$ 69,90/kg”.">
                        <input className="mk-input" value={form.unitLabel || ""} maxLength={10} onChange={(event) => set({ unitLabel: event.target.value })} />
                    </Field>
                </Section>

                {!hasSizes && form.promoPriceCents > 0 && form.promoPriceCents >= (form.priceCents || 0) && (
                    <p className="mnu-alert is-warn">O preço promocional ({formatBRL(form.promoPriceCents)}) não é menor que o preço normal, então não será mostrado.</p>
                )}
            </div>
        </Sheet>
    );
}

export const Thumb = ({ src, name, className }) => (
    <span className={cx("mnu-thumb", className)} aria-hidden="true">
        {src ? <img src={src} alt="" loading="lazy" /> : (name || "?").charAt(0)}
    </span>
);
