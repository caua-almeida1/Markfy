import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import { Button, Field, Spinner, cx } from "../../design-system/components";
import { designFromTemplate, getTemplate, normalizeDesign, slugProblem, suggestSlug, TEMPLATES } from "../engine/design.js";
import { fromBookingsHours } from "../engine/hours.js";
import { formatBRL } from "../engine/money.js";
import { clean, entries, pushId } from "../engine/util.js";
import { useMenus } from "../MenusContext.jsx";
import { catalogApi } from "../catalog/catalogApi.js";
import { listCategories, listMenus } from "../data/selectors.js";
import { loadCompanyBundle } from "../../studio/data/companyBundle";
import MenuRenderer from "../site/MenuRenderer.jsx";
import Frame from "../editor/Frame.jsx";
import TemplateThumb from "../editor/TemplateThumb.jsx";
import { MoneyInput, Toggle } from "../ui.jsx";

import "../editor/editor.css";

/* =========================================================
   PRIMEIROS PASSOS

   Curto, progressivo e pausável: cada etapa grava o que a
   pessoa decidiu e o progresso fica em
   menusSettings/{h}/onboarding. Quem só quer um cardápio de
   vitrine nunca passa por entrega, pagamentos ou mesas.

   Sugestões por segmento são só sugestões: nada é criado
   sem a pessoa tocar, e nenhum produto fictício é publicado.
========================================================= */

const SEGMENTS = {
    restaurante: { label: "Restaurante", icon: "solar:chef-hat-linear", template: "familiar", categories: ["Entradas", "Pratos principais", "Bebidas", "Sobremesas"] },
    pizzaria: { label: "Pizzaria", icon: "solar:pizza-linear", template: "pizzaria", categories: ["Pizzas salgadas", "Pizzas doces", "Bebidas"] },
    hamburgueria: { label: "Hamburgueria", icon: "mdi:hamburger", template: "hamburgueria", categories: ["Burgers", "Acompanhamentos", "Bebidas", "Sobremesas"] },
    lanchonete: { label: "Lanchonete", icon: "mdi:food", template: "moderno", categories: ["Lanches", "Salgados", "Sucos", "Bebidas"] },
    bar: { label: "Bar", icon: "solar:wineglass-linear", template: "bar", categories: ["Drinks", "Cervejas", "Petiscos", "Sem álcool"] },
    cafeteria: { label: "Cafeteria", icon: "solar:cup-hot-linear", template: "cafeteria", categories: ["Cafés", "Bebidas geladas", "Salgados", "Doces"] },
    doceria: { label: "Doceria", icon: "mdi:cupcake", template: "doceria", categories: ["Bolos", "Doces", "Tortas", "Bebidas"] },
    foodtruck: { label: "Food truck", icon: "mdi:truck-outline", template: "foodtruck", categories: ["Lanches", "Porções", "Bebidas"] },
    marmitaria: { label: "Marmitaria", icon: "mdi:food-takeout-box-outline", template: "marmitaria", categories: ["Marmitas", "Saladas", "Bebidas"] },
    quilo: { label: "Por quilo", icon: "solar:scale-linear", template: "quilo", categories: ["Bufê por quilo", "Pratos à parte", "Bebidas", "Sobremesas"] },
    outro: { label: "Outro", icon: "solar:shop-2-linear", template: "moderno", categories: ["Destaques", "Bebidas"] }
};

const HOURS_PRESETS = {
    lunch: { label: "Almoço (11h–15h)", ranges: [{ from: "11:00", to: "15:00" }] },
    dinner: { label: "Jantar (18h–23h)", ranges: [{ from: "18:00", to: "23:00" }] },
    both: { label: "Almoço e jantar", ranges: [{ from: "11:00", to: "15:00" }, { from: "18:00", to: "23:00" }] },
    allday: { label: "Dia todo (10h–22h)", ranges: [{ from: "10:00", to: "22:00" }] },
    night: { label: "Noite (18h–02h)", ranges: [{ from: "18:00", to: "02:00" }] }
};

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export default function Onboarding() {
    const navigate = useNavigate();
    const { settings, source, handle, user, catalog, draft, features, act, path, notify, floor, demo } = useMenus();
    const api = useMemo(() => catalogApi(source, user), [source, user]);

    const progress = settings.onboarding || {};
    const [mode, setMode] = useState(settings.mode || "showcase");
    const dineIn = Boolean(settings.fulfillment?.dineIn?.enabled);

    const steps = useMemo(() => {
        const list = ["empresa", "segmento", "identidade", "modelo", "categorias", "produtos", "horario", "modo"];
        if (mode === "ordering") list.push("entrega");
        if (features.menusTables && (dineIn || mode === "ordering")) list.push("mesas");
        list.push("previa", "publicar");
        return list;
    }, [mode, features.menusTables, dineIn]);

    const LABELS = {
        empresa: "Sua empresa",
        segmento: "Tipo de negócio",
        identidade: "Logo e cores",
        modelo: "Modelo",
        categorias: "Categorias",
        produtos: "Primeiros produtos",
        horario: "Horário e contato",
        modo: "Vitrine ou pedidos",
        entrega: "Entrega e pagamento",
        mesas: "Mesas",
        previa: "Pré-visualização",
        publicar: "Publicar"
    };

    const [step, setStep] = useState(() => (steps.includes(progress.step) ? progress.step : "empresa"));
    const [busy, setBusy] = useState(false);
    const index = steps.indexOf(step);

    const saveProgress = (patch) =>
        source.update(Object.fromEntries(Object.entries(clean({ ...progress, ...patch, updatedAt: Date.now() })).map(([key, value]) => [`menusSettings/${handle}/onboarding/${key}`, value])));

    const go = async (next, done) => {
        await saveProgress({ step: next, done: { ...(progress.done || {}), ...(done ? { [step]: true } : {}) } }).catch(() => null);
        setStep(next);
        window.scrollTo({ top: 0 });
    };

    const nextStep = () => steps[Math.min(steps.length - 1, index + 1)];

    /* ---------- dados das etapas ---------- */

    const [profile, setProfile] = useState({ name: settings.profile?.name || "", description: settings.profile?.description || "" });
    const [segment, setSegment] = useState(settings.segment || null);
    const [design, setDesign] = useState(() => normalizeDesign(draft?.design || designFromTemplate("moderno")));
    const [primaryChosen, setPrimaryChosen] = useState(Boolean(draft?.design));
    const [contact, setContact] = useState({ whatsapp: settings.contact?.whatsapp || "", phone: settings.contact?.phone || "" });
    const [hoursPreset, setHoursPreset] = useState(null);
    const [openDays, setOpenDays] = useState([1, 2, 3, 4, 5, 6]);
    const [products, setProducts] = useState([{ id: pushId(), name: "", priceCents: 0, categoryId: "" }]);
    const [newCategory, setNewCategory] = useState("");
    const [tableCount, setTableCount] = useState(10);
    const [slug, setSlug] = useState(settings.slug || suggestSlug(settings.profile?.name, handle));
    const [delivery, setDelivery] = useState({ pickup: settings.fulfillment?.pickup?.enabled ?? true, delivery: settings.fulfillment?.delivery?.enabled ?? false, dineIn: settings.fulfillment?.dineIn?.enabled ?? false, feeCents: settings.fulfillment?.delivery?.feeCents ?? 600 });
    const [payments, setPayments] = useState({ pix: true, credit: true, debit: true, cash: true, ...(settings.payments || {}) });
    const logoRef = useRef(null);
    const coverRef = useRef(null);
    const [uploading, setUploading] = useState(null);

    const bundleLoaded = useRef(false);
    useEffect(() => {
        if (demo || bundleLoaded.current || settings.profile?.name) return;
        bundleLoaded.current = true;
        loadCompanyBundle(handle).then((bundle) => {
            if (!bundle) return;
            setProfile((current) => ({ name: current.name || bundle.name || "", description: current.description || bundle.description || "" }));
            setContact((current) => ({ whatsapp: current.whatsapp || bundle.whatsapp || "", phone: current.phone || bundle.phone || "" }));
            if (bundle.logo) setDesign((current) => (current.images.logo ? current : normalizeDesign({ ...current, images: { ...current.images, logo: bundle.logo } })));
        }).catch(() => null);
    }, [demo, handle, settings.profile?.name]);

    const menus = listMenus(catalog);
    const categories = listCategories(catalog);
    const suggested = SEGMENTS[segment || "outro"];

    const ensureMenu = async () => {
        if (menus[0]) return menus[0].id;
        const id = api.newId();
        await api.saveMenu(id, { name: "Cardápio principal", order: 0, active: true });
        return id;
    };

    const saveDesign = (value) => source.update({ [`menusDrafts/${handle}/design`]: clean(value), [`menusDrafts/${handle}/updatedAt`]: Date.now() });

    const upload = async (file, kind) => {
        if (!file) return;
        setUploading(kind);
        try {
            const url = await source.upload(file, kind === "logo" ? "logo" : "cover");
            setDesign((current) => normalizeDesign({ ...current, images: { ...current.images, [kind]: url } }));
        } catch (error) {
            notify("error", "Não foi possível enviar", error.message);
        } finally {
            setUploading(null);
        }
    };

    const continueStep = async () => {
        setBusy(true);
        try {
            if (step === "empresa") {
                if (profile.name.trim().length < 2) {
                    notify("error", "Informe o nome do estabelecimento");
                    return;
                }
                await source.update({ [`menusSettings/${handle}/profile`]: clean({ ...(settings.profile || {}), name: profile.name.trim(), description: profile.description.trim() }) });
                if (!settings.slug) setSlug(suggestSlug(profile.name, handle));
            }
            if (step === "segmento" && segment) {
                await source.update({ [`menusSettings/${handle}/segment`]: segment });
                const template = getTemplate(SEGMENTS[segment].template);
                const allowed = template.tier === "basic" || features.menusAdvancedDesign;
                if (!draft?.design) setDesign((current) => designFromTemplate(allowed ? template.id : "familiar", { images: current.images, content: current.content }));
            }
            if (step === "identidade" || step === "modelo") await saveDesign(design);
            if (step === "horario") {
                const patch = { [`menusSettings/${handle}/contact`]: clean({ ...(settings.contact || {}), ...contact }) };
                if (hoursPreset) {
                    const hours = {};
                    DAYS.forEach((day, i) => {
                        hours[day] = openDays.includes(i) ? { enabled: true, ranges: HOURS_PRESETS[hoursPreset].ranges } : { enabled: false, ranges: [] };
                    });
                    patch[`menusSettings/${handle}/hours`] = hours;
                }
                if (!settings.timezone) patch[`menusSettings/${handle}/timezone`] = "America/Sao_Paulo";
                await source.update(patch);
            }
            if (step === "modo") await source.update({ [`menusSettings/${handle}/mode`]: mode });
            if (step === "entrega") {
                await source.update({
                    [`menusSettings/${handle}/fulfillment`]: clean({
                        ...(settings.fulfillment || {}),
                        pickup: { ...(settings.fulfillment?.pickup || {}), enabled: delivery.pickup },
                        delivery: { ...(settings.fulfillment?.delivery || {}), enabled: delivery.delivery, feeCents: delivery.feeCents },
                        dineIn: { enabled: delivery.dineIn }
                    }),
                    [`menusSettings/${handle}/payments`]: clean({ ...(settings.payments || {}), ...payments })
                });
            }
            if (step === "produtos") {
                const valid = products.filter((row) => row.name.trim() && row.categoryId);
                for (const row of valid) {
                    await api.saveProduct(api.newId(), { name: row.name.trim(), categoryId: row.categoryId, priceCents: row.priceCents || 0, available: true, published: true, order: 99 });
                }
                if (valid.length) setProducts([{ id: pushId(), name: "", priceCents: 0, categoryId: valid[0].categoryId }]);
            }
            if (step === "mesas" && tableCount > 0 && !entries(floor.tables).length) {
                const areaId = "salao";
                const tables = {};
                for (let i = 1; i <= tableCount; i += 1) {
                    tables[`mesa-${i}`] = { label: `Mesa ${i}`, seats: 4, areaId, shape: "square", x: 40 + ((i - 1) % 5) * 140, y: 40 + Math.floor((i - 1) / 5) * 140, w: 96, h: 96, order: i };
                }
                await act("floor.save", { areas: { [areaId]: { name: "Salão", order: 0 } }, tables, baseVersion: floor.version ?? null }, { success: `${tableCount} mesas criadas` });
            }
            if (step === "publicar") {
                const problem = slugProblem(slug, handle);
                if (problem) {
                    notify("error", "Endereço inválido", problem);
                    return;
                }
                const owner = await source.get(`menusSlugs/${slug}`).catch(() => null);
                if (owner && owner !== handle) {
                    notify("error", "Endereço em uso", "Escolha outro endereço.");
                    return;
                }
                await source.update({ [`menusSettings/${handle}/slug`]: slug });
                await saveDesign(design);
                await act("design.publish", {}, { success: "Cardápio publicado!" });
                await saveProgress({ step: "publicar", completedAt: Date.now(), done: { ...(progress.done || {}), publicar: true } });
                navigate(path("publicar"));
                return;
            }
            await go(nextStep(), true);
        } catch (error) {
            if (error?.message) notify("error", "Não deu certo", error.message);
        } finally {
            setBusy(false);
        }
    };

    const exit = async () => {
        await saveProgress({ step, pausedAt: Date.now() }).catch(() => null);
        navigate(path(""));
    };

    const finishWithoutPublishing = async () => {
        await saveProgress({ step, completedAt: Date.now() }).catch(() => null);
        navigate(path(""));
    };

    const optional = ["identidade", "categorias", "produtos", "mesas", "previa"].includes(step);

    return (
        <div className="mk-root mnu mno">
            <header className="mno-top">
                <span className="std-brand"><Icon icon="solar:chef-hat-bold-duotone" aria-hidden="true" /> Markfy <em>Menus</em></span>
                <span className="mno-top__progress" aria-label={`Etapa ${index + 1} de ${steps.length}`}>
                    <span style={{ transform: `scaleX(${(index + 1) / steps.length})` }} />
                </span>
                <Button variant="ghost" size="sm" onClick={exit}>Salvar e sair</Button>
            </header>

            <div className="mno-body">
                <nav className="mno-steps" aria-label="Etapas">
                    <ol>
                        {steps.map((id, i) => (
                            <li key={id}>
                                <button type="button" className={cx(id === step && "is-on", progress.done?.[id] && "is-done")} onClick={() => setStep(id)} aria-current={id === step ? "step" : undefined}>
                                    <span className="mno-steps__dot">{progress.done?.[id] ? <Icon icon="solar:check-read-linear" aria-hidden="true" /> : i + 1}</span>
                                    {LABELS[id]}
                                </button>
                            </li>
                        ))}
                    </ol>
                </nav>

                <main className="mno-main">
                    <div className="mno-card mk-enter" key={step}>
                        <span className="mnu-eyebrow">Etapa {index + 1} de {steps.length}</span>

                        {step === "empresa" && (
                            <>
                                <h1 className="mk-title mk-title--md">Como o seu estabelecimento se chama?</h1>
                                <p className="mk-lead">É o nome que aparece no topo do cardápio. Dá para mudar depois.</p>
                                <Field label="Nome"><input className="mk-input" value={profile.name} maxLength={60} onChange={(event) => setProfile({ ...profile, name: event.target.value })} autoFocus /></Field>
                                <Field label="Uma frase sobre o lugar (opcional)" count={profile.description.length} max={400}>
                                    <textarea className="mk-textarea" value={profile.description} maxLength={400} onChange={(event) => setProfile({ ...profile, description: event.target.value })} placeholder="Ex.: Pizzas de fermentação natural no forno a lenha, no centro da cidade." />
                                </Field>
                            </>
                        )}

                        {step === "segmento" && (
                            <>
                                <h1 className="mk-title mk-title--md">Que tipo de negócio é?</h1>
                                <p className="mk-lead">Usamos isso para sugerir modelo e categorias. Nada é criado sem você confirmar.</p>
                                <div className="mno-segments">
                                    {Object.entries(SEGMENTS).map(([id, item]) => (
                                        <button key={id} type="button" className={cx("mno-segment", segment === id && "is-on")} aria-pressed={segment === id} onClick={() => setSegment(id)}>
                                            <Icon icon={item.icon} aria-hidden="true" />
                                            {item.label}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}

                        {step === "identidade" && (
                            <>
                                <h1 className="mk-title mk-title--md">Logo, capa e cor principal</h1>
                                <p className="mk-lead">Opcional agora: o cardápio fica bonito mesmo sem fotos, e você pode trocar quando quiser.</p>
                                <div className="mno-identity">
                                    <button type="button" className="mne-image__drop" onClick={() => logoRef.current?.click()} aria-label="Enviar logotipo">
                                        {uploading === "logo" ? <Spinner /> : design.images.logo ? <img src={design.images.logo} alt="" /> : <><Icon icon="solar:gallery-add-linear" aria-hidden="true" /> Logo</>}
                                    </button>
                                    <button type="button" className="mne-image__drop is-wide" onClick={() => coverRef.current?.click()} aria-label="Enviar capa">
                                        {uploading === "cover" ? <Spinner /> : design.images.cover ? <img src={design.images.cover} alt="" /> : <><Icon icon="solar:gallery-wide-linear" aria-hidden="true" /> Capa</>}
                                    </button>
                                    <input ref={logoRef} type="file" accept="image/*" hidden onChange={(event) => upload(event.target.files?.[0], "logo")} />
                                    <input ref={coverRef} type="file" accept="image/*" hidden onChange={(event) => upload(event.target.files?.[0], "cover")} />
                                </div>
                                <label className="mne-row">
                                    <span><b>Cor principal</b><small>Botões e destaques</small></span>
                                    <input type="color" value={design.theme.colors.primary} onChange={(event) => { setPrimaryChosen(true); setDesign(normalizeDesign({ ...design, theme: { ...design.theme, colors: { ...design.theme.colors, primary: event.target.value } } })); }} aria-label="Cor principal" />
                                </label>
                            </>
                        )}

                        {step === "modelo" && (
                            <>
                                <h1 className="mk-title mk-title--md">Escolha um modelo</h1>
                                <p className="mk-lead">Cada um tem topo, navegação e disposição dos produtos diferentes. {suggested && segment ? `Sugestão para ${suggested.label.toLowerCase()}: ${getTemplate(suggested.template).name}.` : ""}</p>
                                <div className="mne-templates mno-templates">
                                    {[...TEMPLATES].sort((a, b) => (a.id === suggested?.template ? -1 : b.id === suggested?.template ? 1 : 0)).map((template) => {
                                        const locked = template.tier !== "basic" && !features.menusAdvancedDesign;
                                        return (
                                            <button
                                                key={template.id}
                                                type="button"
                                                className={cx("mne-template", design.templateId === template.id && "is-current", locked && "is-locked")}
                                                aria-pressed={design.templateId === template.id}
                                                aria-disabled={locked || undefined}
                                                onClick={() => {
                                                    if (locked) return;
                                                    const primary = design.theme.colors.primary;
                                                    const next = designFromTemplate(template.id, { images: design.images, content: design.content });
                                                    setDesign(primaryChosen ? normalizeDesign({ ...next, theme: { ...next.theme, colors: { ...next.theme.colors, primary } } }) : next);
                                                }}
                                            >
                                                <TemplateThumb template={template} />
                                                <span className="mne-template__name">{template.name}{locked && <Icon icon="solar:lock-keyhole-minimalistic-linear" aria-label="Não incluído no plano" />}</span>
                                                <small>{template.description}</small>
                                            </button>
                                        );
                                    })}
                                </div>
                            </>
                        )}

                        {step === "categorias" && (
                            <>
                                <h1 className="mk-title mk-title--md">Como o cardápio se divide?</h1>
                                <p className="mk-lead">Toque nas sugestões ou escreva as suas.</p>
                                <div className="mnu-chips">
                                    {(suggested?.categories || []).filter((name) => !categories.some((category) => category.name.toLowerCase() === name.toLowerCase())).map((name) => (
                                        <button key={name} type="button" className="mk-chip" onClick={async () => api.saveCategory(api.newId(), { name, menuId: await ensureMenu(), order: categories.length, active: true })}>
                                            <Icon icon="solar:add-circle-linear" aria-hidden="true" /> {name}
                                        </button>
                                    ))}
                                </div>
                                <form className="mnu-row" onSubmit={async (event) => { event.preventDefault(); if (!newCategory.trim()) return; await api.saveCategory(api.newId(), { name: newCategory.trim(), menuId: await ensureMenu(), order: categories.length, active: true }); setNewCategory(""); }}>
                                    <input className="mk-input" value={newCategory} maxLength={60} onChange={(event) => setNewCategory(event.target.value)} placeholder="Outra categoria" aria-label="Nova categoria" />
                                    <Button type="submit" disabled={!newCategory.trim()}>Adicionar</Button>
                                </form>
                                <ul className="mno-list">
                                    {categories.map((category) => <li key={category.id}><Icon icon="solar:folder-linear" aria-hidden="true" /> {category.name}</li>)}
                                    {!categories.length && <li className="mk-muted">Nenhuma categoria ainda.</li>}
                                </ul>
                            </>
                        )}

                        {step === "produtos" && (
                            <>
                                <h1 className="mk-title mk-title--md">Cadastre alguns produtos</h1>
                                <p className="mk-lead">Só nome, preço e categoria. Fotos, tamanhos e adicionais você completa em Cardápios e produtos.</p>
                                {!categories.length ? (
                                    <p className="mnu-alert is-warn">Crie pelo menos uma categoria na etapa anterior.</p>
                                ) : (
                                    <div className="mno-products">
                                        {products.map((row, i) => (
                                            <div key={row.id} className="mno-product">
                                                <input className="mk-input" placeholder="Nome do produto" value={row.name} maxLength={80} aria-label={`Produto ${i + 1}`} onChange={(event) => setProducts(products.map((item) => (item.id === row.id ? { ...item, name: event.target.value } : item)))} />
                                                <MoneyInput value={row.priceCents} onChange={(priceCents) => setProducts(products.map((item) => (item.id === row.id ? { ...item, priceCents } : item)))} aria-label={`Preço do produto ${i + 1}`} />
                                                <select className="mk-select" value={row.categoryId} aria-label={`Categoria do produto ${i + 1}`} onChange={(event) => setProducts(products.map((item) => (item.id === row.id ? { ...item, categoryId: event.target.value } : item)))}>
                                                    <option value="">Categoria…</option>
                                                    {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                                                </select>
                                            </div>
                                        ))}
                                        <Button size="sm" variant="outline" icon="solar:add-circle-linear" onClick={() => setProducts([...products, { id: pushId(), name: "", priceCents: 0, categoryId: products[products.length - 1]?.categoryId || "" }])}>Mais um produto</Button>
                                        <p className="mk-muted">{entries(catalog.products).length} produto(s) já no cardápio.</p>
                                    </div>
                                )}
                            </>
                        )}

                        {step === "horario" && (
                            <>
                                <h1 className="mk-title mk-title--md">Quando vocês abrem?</h1>
                                <p className="mk-lead">Escolha um modelo de horário (ajuste fino em Configurações) e o contato principal.</p>
                                <div className="mnu-chips">
                                    {Object.entries(HOURS_PRESETS).map(([id, preset]) => (
                                        <button key={id} type="button" className="mk-chip" aria-pressed={hoursPreset === id} onClick={() => setHoursPreset(id)}>{preset.label}</button>
                                    ))}
                                    {!demo && (
                                        <button
                                            type="button"
                                            className="mk-chip"
                                            onClick={async () => {
                                                const bundle = await loadCompanyBundle(handle).catch(() => null);
                                                const hours = fromBookingsHours(bundle?.businessHours);
                                                if (hours) {
                                                    await source.update({ [`menusSettings/${handle}/hours`]: hours });
                                                    notify("success", "Horário da Bookings importado");
                                                } else notify("info", "A empresa ainda não tem horário na Bookings");
                                            }}
                                        >
                                            Usar o horário da Bookings
                                        </button>
                                    )}
                                </div>
                                {hoursPreset && (
                                    <div className="mnu-chips" aria-label="Dias abertos">
                                        {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((label, i) => (
                                            <button key={label} type="button" className="mk-chip" aria-pressed={openDays.includes(i)} onClick={() => setOpenDays(openDays.includes(i) ? openDays.filter((day) => day !== i) : [...openDays, i])}>{label}</button>
                                        ))}
                                    </div>
                                )}
                                <div className="mnu-grid-2">
                                    <Field label="WhatsApp (com DDD e 55)"><input className="mk-input" inputMode="tel" value={contact.whatsapp} onChange={(event) => setContact({ ...contact, whatsapp: event.target.value.replace(/\D/g, "").slice(0, 13) })} placeholder="5511999990000" /></Field>
                                    <Field label="Telefone"><input className="mk-input" value={contact.phone} maxLength={20} onChange={(event) => setContact({ ...contact, phone: event.target.value })} /></Field>
                                </div>
                            </>
                        )}

                        {step === "modo" && (
                            <>
                                <h1 className="mk-title mk-title--md">O cardápio recebe pedidos?</h1>
                                <div className="mno-modes">
                                    <button type="button" className={cx("mno-mode", mode === "showcase" && "is-on")} aria-pressed={mode === "showcase"} onClick={() => setMode("showcase")}>
                                        <Icon icon="solar:book-2-linear" aria-hidden="true" />
                                        <b>Só vitrine</b>
                                        <small>Produtos, preços, fotos, horário e contato. O cliente pede no balcão, na mesa ou pelo WhatsApp.</small>
                                    </button>
                                    <button type="button" className={cx("mno-mode", mode === "ordering" && "is-on")} aria-pressed={mode === "ordering"} onClick={() => setMode("ordering")} disabled={!features.menusOrdering}>
                                        <Icon icon="solar:bag-4-linear" aria-hidden="true" />
                                        <b>Receber pedidos</b>
                                        <small>{features.menusOrdering ? "Retirada, entrega e pelo QR da mesa, com acompanhamento para o cliente." : "Não incluído no plano atual."}</small>
                                    </button>
                                </div>
                            </>
                        )}

                        {step === "entrega" && (
                            <>
                                <h1 className="mk-title mk-title--md">Como o pedido chega ao cliente?</h1>
                                <Toggle checked={delivery.pickup} onChange={(pickup) => setDelivery({ ...delivery, pickup })} label="Retirada no local" />
                                <Toggle checked={delivery.delivery} onChange={(value) => setDelivery({ ...delivery, delivery: value })} label="Entrega" />
                                {delivery.delivery && <Field label="Taxa de entrega padrão" hint={`Hoje: ${formatBRL(delivery.feeCents)}. Regiões e pedido mínimo em Configurações.`}><MoneyInput value={delivery.feeCents} onChange={(feeCents) => setDelivery({ ...delivery, feeCents })} /></Field>}
                                <Toggle checked={delivery.dineIn} onChange={(dine) => setDelivery({ ...delivery, dineIn: dine })} label="Consumo no local (mesas)" hint="Ativa a etapa de mesas e o QR Code por mesa." />
                                <p className="mnu-label">Formas de pagamento na entrega ou retirada</p>
                                <div className="mnu-chips">
                                    {[["pix", "Pix"], ["credit", "Crédito"], ["debit", "Débito"], ["cash", "Dinheiro"], ["voucher", "Vale-refeição"]].map(([id, label]) => (
                                        <button key={id} type="button" className="mk-chip" aria-pressed={Boolean(payments[id])} onClick={() => setPayments({ ...payments, [id]: !payments[id] })}>{label}</button>
                                    ))}
                                </div>
                            </>
                        )}

                        {step === "mesas" && (
                            <>
                                <h1 className="mk-title mk-title--md">Quantas mesas o salão tem?</h1>
                                <p className="mk-lead">Criamos as mesas no ambiente “Salão”. Depois você posiciona na planta, renomeia e cria varanda, balcão e outros ambientes.</p>
                                {entries(floor.tables).length ? (
                                    <p className="mnu-alert is-ok">Você já tem {entries(floor.tables).length} mesa(s) cadastrada(s).</p>
                                ) : (
                                    <div className="mnu-row">
                                        <input className="mk-input" type="number" min="0" max="200" value={tableCount} onChange={(event) => setTableCount(Math.max(0, Number(event.target.value) || 0))} aria-label="Quantidade de mesas" />
                                        <span className="mk-muted">mesas</span>
                                    </div>
                                )}
                            </>
                        )}

                        {step === "previa" && (
                            <>
                                <h1 className="mk-title mk-title--md">Assim o cliente vai ver</h1>
                                <p className="mk-lead">Navegue, abra um produto, teste a busca. Os pedidos ficam desligados na pré-visualização.</p>
                                <div className="mno-preview">
                                    <Frame device="mobile">
                                        <MenuRenderer design={design} settings={{ ...settings, profile: { ...(settings.profile || {}), ...profile } }} catalog={catalog} features={features} mode="preview" handle={handle} />
                                    </Frame>
                                </div>
                            </>
                        )}

                        {step === "publicar" && (
                            <>
                                <h1 className="mk-title mk-title--md">Escolha o endereço e publique</h1>
                                <p className="mk-lead">O link e o QR Code passam a funcionar na hora.</p>
                                <Field label="Endereço do cardápio" hint={slugProblem(slug, handle) || "Disponível depois de publicar."}>
                                    <div className="mnu-slug"><span>{window.location.host}/m/</span><input className="mk-input" value={slug} maxLength={40} onChange={(event) => setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-"))} /></div>
                                </Field>
                                <p className="mnu-alert is-info">
                                    <Icon icon="solar:clipboard-check-linear" aria-hidden="true" />
                                    {categories.length} categoria(s) · {entries(catalog.products).length} produto(s) · {mode === "ordering" ? "recebe pedidos" : "só vitrine"} · modelo {getTemplate(design.templateId).name}
                                </p>
                            </>
                        )}

                        <div className="mno-actions">
                            {index > 0 && <Button variant="ghost" icon="solar:arrow-left-linear" onClick={() => setStep(steps[index - 1])}>Voltar</Button>}
                            <span style={{ flex: 1 }} />
                            {optional && <Button variant="ghost" onClick={() => go(nextStep(), false)}>Pular</Button>}
                            {step === "publicar" && <Button variant="ghost" onClick={finishWithoutPublishing}>Publicar depois</Button>}
                            <Button variant="primary" loading={busy} iconRight={step === "publicar" ? "solar:upload-linear" : "solar:arrow-right-linear"} onClick={continueStep} disabled={step === "segmento" && !segment}>
                                {step === "publicar" ? "Publicar cardápio" : "Continuar"}
                            </Button>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
