import React, { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";

import { Badge, Button, Field, Segmented, Spinner, Switch, cx } from "../../design-system/components";
import {
    DENSITIES,
    FONTS,
    HEADERS,
    IMAGE_RATIOS,
    MOTIONS,
    NAVS,
    PRODUCT_LAYOUTS,
    SHADOWS,
    TEMPLATES
} from "../engine/design.js";
import { ensureAllFonts } from "../site/fonts.js";
import TemplateThumb from "./TemplateThumb.jsx";

/* =========================================================
   PAINÉIS DO EDITOR

   Básico à vista, avançado recolhido. Quando o plano não
   inclui a personalização avançada, o controle aparece
   travado com o motivo — e o que é do plano continua livre
   (cor principal, textos, imagens e o que mostrar).
========================================================= */

const LockNote = () => (
    <p className="mne-lock">
        <Icon icon="solar:lock-keyhole-minimalistic-linear" aria-hidden="true" />
        Disponível nos planos com personalização avançada. No seu plano: cor principal, textos, imagens e o que mostrar.
    </p>
);

/* ---------- CONTRASTE (WCAG) ---------- */

const luminance = (hex) => {
    const value = String(hex || "").replace("#", "");
    if (value.length !== 6) return 0;
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

export const contrast = (a, b) => {
    const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
};

/* ---------- MODELOS ---------- */

export const TemplatesPanel = ({ design, advanced, onApply }) => {
    const [group, setGroup] = useState("Todos");
    const list = TEMPLATES.filter((template) => group === "Todos" || template.group === group);

    return (
        <div className="mne-panel">
            <p className="mne-hint">Cada modelo muda o topo, a navegação e a forma de mostrar os produtos. Depois de escolher, ajuste peça por peça.</p>
            <Segmented
                label="Filtrar modelos"
                size="sm"
                value={group}
                onChange={setGroup}
                options={[{ value: "Todos", label: "Todos" }, { value: "Estilo", label: "Por estilo" }, { value: "Segmento", label: "Por segmento" }]}
            />
            <div className="mne-templates">
                {list.map((template) => {
                    const locked = !advanced && template.tier !== "basic";
                    const current = design.templateId === template.id;
                    return (
                        <button
                            key={template.id}
                            type="button"
                            className={cx("mne-template", current && "is-current", locked && "is-locked")}
                            onClick={() => !locked && onApply(template.id)}
                            aria-pressed={current}
                            aria-disabled={locked || undefined}
                            title={locked ? "Disponível com personalização avançada" : template.description}
                        >
                            <TemplateThumb template={template} />
                            <span className="mne-template__name">
                                {template.name}
                                {locked && <Icon icon="solar:lock-keyhole-minimalistic-linear" aria-label="Bloqueado no plano atual" />}
                                {current && <Badge tone="success">Em uso</Badge>}
                            </span>
                            <small>{template.description}</small>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

/* ---------- CORES ---------- */

const COLOR_FIELDS = [
    ["primary", "Principal", "Botões, destaques e seleção"],
    ["secondary", "Secundária", "Fundos de apoio e capas sem foto"],
    ["accent", "Destaque", "Selos e detalhes"],
    ["background", "Fundo", "Fundo da página"],
    ["surface", "Cartões", "Fundo de cartões e janelas"],
    ["text", "Texto", "Títulos e textos"],
    ["muted", "Texto secundário", "Descrições e legendas"],
    ["border", "Bordas", "Linhas e contornos"],
    ["buttonText", "Texto dos botões", "Sobre a cor principal"]
];

const ColorInput = ({ value, onChange, label, disabled }) => {
    const [text, setText] = useState(value);
    useEffect(() => setText(value), [value]);
    return (
        <span className={cx("mne-color", disabled && "is-disabled")}>
            <input type="color" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} aria-label={label} />
            <input
                className="mk-input"
                value={text}
                disabled={disabled}
                maxLength={7}
                aria-label={`${label} em hexadecimal`}
                onChange={(event) => {
                    setText(event.target.value);
                    if (/^#[0-9a-f]{6}$/i.test(event.target.value)) onChange(event.target.value.toLowerCase());
                }}
            />
        </span>
    );
};

export const ColorsPanel = ({ design, advanced, onTheme }) => {
    const colors = design.theme.colors;
    const textRatio = contrast(colors.text, colors.background);
    const buttonRatio = contrast(colors.buttonText, colors.primary);

    const palettes = TEMPLATES.map((template) => ({ id: template.id, name: template.name, colors: template.theme.colors }));

    return (
        <div className="mne-panel">
            {(textRatio < 4.5 || buttonRatio < 4.5) && (
                <p className="mne-warn" role="status">
                    <Icon icon="solar:danger-triangle-linear" aria-hidden="true" />
                    {textRatio < 4.5 ? `O texto sobre o fundo tem contraste ${textRatio.toFixed(1)}:1 (o recomendado é 4,5:1). ` : ""}
                    {buttonRatio < 4.5 ? `O texto dos botões tem contraste ${buttonRatio.toFixed(1)}:1.` : ""}
                </p>
            )}

            {COLOR_FIELDS.map(([key, label, hint]) => {
                const locked = !advanced && key !== "primary";
                return (
                    <div key={key} className="mne-row">
                        <span>
                            <b>{label}</b>
                            <small>{hint}</small>
                        </span>
                        <ColorInput
                            value={colors[key]}
                            label={label}
                            disabled={locked}
                            onChange={(value) => onTheme({ colors: { ...colors, [key]: value } })}
                        />
                    </div>
                );
            })}

            {advanced ? (
                <details className="mnu-details">
                    <summary><span><b>Paletas prontas</b><small>Aplica só as cores</small></span><Icon icon="solar:alt-arrow-down-linear" aria-hidden="true" /></summary>
                    <div className="mne-palettes">
                        {palettes.map((palette) => (
                            <button key={palette.id} type="button" onClick={() => onTheme({ colors: { ...palette.colors } })} title={palette.name}>
                                {["primary", "accent", "background", "text"].map((key) => <i key={key} style={{ background: palette.colors[key] }} />)}
                                <small>{palette.name}</small>
                            </button>
                        ))}
                    </div>
                </details>
            ) : (
                <LockNote />
            )}
        </div>
    );
};

/* ---------- TIPOGRAFIA ---------- */

export const FontsPanel = ({ design, advanced, onTheme }) => {
    useEffect(() => {
        if (advanced) ensureAllFonts();
    }, [advanced]);

    const theme = design.theme;
    const fontOptions = Object.entries(FONTS);

    return (
        <div className="mne-panel">
            {!advanced && <LockNote />}
            <Field label="Fonte dos títulos">
                <select className="mk-select" value={theme.fonts.heading} disabled={!advanced} onChange={(event) => onTheme({ fonts: { ...theme.fonts, heading: event.target.value } })} style={{ fontFamily: FONTS[theme.fonts.heading]?.stack }}>
                    {fontOptions.map(([id, font]) => <option key={id} value={id} style={{ fontFamily: font.stack }}>{font.label}</option>)}
                </select>
            </Field>
            <Field label="Fonte dos textos">
                <select className="mk-select" value={theme.fonts.body} disabled={!advanced} onChange={(event) => onTheme({ fonts: { ...theme.fonts, body: event.target.value } })} style={{ fontFamily: FONTS[theme.fonts.body]?.stack }}>
                    {fontOptions.map(([id, font]) => <option key={id} value={id} style={{ fontFamily: font.stack }}>{font.label}</option>)}
                </select>
            </Field>
            <p className="mne-sample" style={{ fontFamily: FONTS[theme.fonts.heading]?.stack, fontWeight: theme.headingWeight, textTransform: theme.headingCase === "upper" ? "uppercase" : "none" }}>Pizza da casa</p>
            <p className="mne-sample is-body" style={{ fontFamily: FONTS[theme.fonts.body]?.stack, fontSize: theme.bodySize, lineHeight: theme.lineHeight }}>Massa de longa fermentação, molho de tomate fresco e manjericão.</p>

            <Range label="Peso dos títulos" min={300} max={900} step={100} value={theme.headingWeight} disabled={!advanced} onChange={(headingWeight) => onTheme({ headingWeight })} />
            <Range label="Tamanho do texto" min={13} max={19} step={1} value={theme.bodySize} unit="px" disabled={!advanced} onChange={(bodySize) => onTheme({ bodySize })} />
            <Range label="Altura da linha" min={1.2} max={1.9} step={0.05} value={theme.lineHeight} disabled={!advanced} onChange={(lineHeight) => onTheme({ lineHeight })} />

            <div className="mne-row">
                <span><b>Títulos</b><small>Caixa alta ou normal</small></span>
                <Segmented size="sm" label="Caixa dos títulos" value={theme.headingCase} onChange={(headingCase) => advanced && onTheme({ headingCase })} options={[{ value: "none", label: "Normal" }, { value: "upper", label: "CAIXA ALTA" }]} />
            </div>
        </div>
    );
};

export const Range = ({ label, value, min, max, step, onChange, unit = "", disabled }) => (
    <label className={cx("mne-range", disabled && "is-disabled")}>
        <span>
            <b>{label}</b>
            <output>{Number(value).toLocaleString("pt-BR")}{unit}</output>
        </span>
        <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(event) => onChange(Number(event.target.value))} />
    </label>
);

/* ---------- DISPOSIÇÃO ---------- */

const OptionGrid = ({ options, value, onChange, disabled, icons = {} }) => (
    <div className="mne-options">
        {Object.entries(options).map(([id, label]) => (
            <button key={id} type="button" className={cx("mne-option", value === id && "is-on")} aria-pressed={value === id} disabled={disabled} onClick={() => onChange(id)}>
                {icons[id] && <Icon icon={icons[id]} aria-hidden="true" />}
                {label}
            </button>
        ))}
    </div>
);

export const LayoutPanel = ({ design, advanced, onLayout, onTheme }) => {
    const { layout, theme } = design;
    return (
        <div className="mne-panel">
            {!advanced && <LockNote />}
            <p className="mnu-label">Topo</p>
            <OptionGrid options={HEADERS} value={layout.header} disabled={!advanced} onChange={(header) => onLayout({ header })} icons={{ hero: "solar:gallery-wide-linear", split: "solar:posts-carousel-horizontal-linear", banner: "solar:card-2-linear", centered: "solar:align-horizontal-center-linear", compact: "solar:minimize-square-linear", board: "solar:presentation-graph-linear" }} />
            <p className="mnu-label">Navegação entre categorias</p>
            <OptionGrid options={NAVS} value={layout.nav} disabled={!advanced} onChange={(nav) => onLayout({ nav })} icons={{ chips: "solar:tag-horizontal-linear", tabs: "solar:tab-linear", sidebar: "solar:sidebar-minimalistic-linear", tiles: "solar:widget-4-linear", sections: "solar:list-down-linear" }} />
            <p className="mnu-label">Produtos</p>
            <OptionGrid options={PRODUCT_LAYOUTS} value={layout.products} disabled={!advanced} onChange={(products) => onLayout({ products })} icons={{ list: "solar:list-linear", cards: "solar:widget-linear", photo: "solar:gallery-linear", menu: "solar:document-text-linear", compact: "solar:hamburger-menu-linear", carousel: "solar:slider-horizontal-linear", buffet: "solar:scale-linear" }} />

            {["cards", "photo"].includes(layout.products) && (
                <Range label="Produtos por linha (telas largas)" min={1} max={4} step={1} value={layout.columns} disabled={!advanced} onChange={(columns) => onLayout({ columns })} />
            )}

            <Field label="Proporção das fotos">
                <select className="mk-select" value={layout.imageRatio} disabled={!advanced} onChange={(event) => onLayout({ imageRatio: event.target.value })}>
                    {Object.entries(IMAGE_RATIOS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
            </Field>

            <div className="mne-row">
                <span><b>Barra de busca</b></span>
                <Segmented size="sm" label="Posição da busca" value={layout.search} onChange={(search) => advanced && onLayout({ search })} options={[{ value: "top", label: "No topo" }, { value: "nav", label: "Na navegação" }, { value: "hidden", label: "Oculta" }]} />
            </div>

            <details className="mnu-details" open>
                <summary><span><b>Formas e espaço</b><small>Raios, sombras, densidade e largura</small></span><Icon icon="solar:alt-arrow-down-linear" aria-hidden="true" /></summary>
                <div className="mnu-details__body">
                    <Range label="Arredondamento" min={0} max={32} step={1} unit="px" value={theme.radius} disabled={!advanced} onChange={(radius) => onTheme({ radius })} />
                    <Range label="Largura do conteúdo" min={640} max={1400} step={20} unit="px" value={theme.contentWidth} disabled={!advanced} onChange={(contentWidth) => onTheme({ contentWidth })} />
                    <Field label="Sombras">
                        <select className="mk-select" value={theme.shadow} disabled={!advanced} onChange={(event) => onTheme({ shadow: event.target.value })}>
                            {Object.entries(SHADOWS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                        </select>
                    </Field>
                    <Field label="Espaçamento">
                        <select className="mk-select" value={theme.density} disabled={!advanced} onChange={(event) => onTheme({ density: event.target.value })}>
                            {Object.entries(DENSITIES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                        </select>
                    </Field>
                    <Field label="Animações" hint="Quem pede menos movimento no aparelho sempre vê sem animação.">
                        <select className="mk-select" value={theme.motion} disabled={!advanced} onChange={(event) => onTheme({ motion: event.target.value })}>
                            {Object.entries(MOTIONS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                        </select>
                    </Field>
                </div>
            </details>
        </div>
    );
};

/* ---------- TEXTOS E O QUE MOSTRAR ---------- */

const TEXTS = [
    ["tagline", "Frase de apresentação", 120, "Ex.: Forno a lenha desde 1998"],
    ["heroTitle", "Título do topo (se diferente do nome)", 80, ""],
    ["heroSubtitle", "Subtítulo do topo", 200, ""],
    ["notice", "Aviso no alto da página", 200, "Ex.: Fechado no feriado de 15/11"],
    ["footerNote", "Texto do rodapé", 400, "Ex.: Preços sujeitos a alteração"],
    ["addLabel", "Botão de adicionar", 20, "Adicionar"],
    ["cartLabel", "Botão da sacola", 24, "Ver pedido"],
    ["checkoutLabel", "Título da finalização", 28, "Finalizar pedido"]
];

const SHOWS = [
    ["showSearch", "Busca de produtos"],
    ["showFeatured", "Faixa de destaques"],
    ["showImages", "Fotos dos produtos"],
    ["showDescriptions", "Descrições"],
    ["showPrepTime", "Tempo de preparo"],
    ["showAllergens", "Alérgenos"],
    ["showHours", "Horários"],
    ["showAddress", "Endereço"],
    ["showSocials", "Redes sociais"],
    ["showWhatsApp", "Botão de WhatsApp"],
    ["showShare", "Botão de compartilhar"]
];

export const ContentPanel = ({ design, onContent }) => (
    <div className="mne-panel">
        {TEXTS.map(([key, label, max, placeholder]) => (
            <Field key={key} label={label} count={(design.content[key] || "").length} max={max}>
                {max > 120 ? (
                    <textarea className="mk-textarea" rows={2} value={design.content[key] || ""} maxLength={max} placeholder={placeholder} onChange={(event) => onContent({ [key]: event.target.value })} />
                ) : (
                    <input className="mk-input" value={design.content[key] || ""} maxLength={max} placeholder={placeholder} onChange={(event) => onContent({ [key]: event.target.value })} />
                )}
            </Field>
        ))}
        <p className="mnu-label">O que mostrar</p>
        <div className="mne-shows">
            {SHOWS.map(([key, label]) => (
                <div key={key} className="mne-row">
                    <span><b>{label}</b></span>
                    <Switch checked={design.content[key] !== false} onChange={(value) => onContent({ [key]: value })} label={label} />
                </div>
            ))}
        </div>
    </div>
);

/* ---------- IMAGENS ---------- */

const ImageSlot = ({ label, hint, value, onChange, folder, upload, wide }) => {
    const ref = useRef(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const pick = async (file) => {
        if (!file) return;
        setBusy(true);
        setError("");
        try {
            onChange(await upload(file, folder));
        } catch (problem) {
            setError(problem.message || "Não foi possível enviar.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="mne-image">
            <button type="button" className={cx("mne-image__drop", wide && "is-wide")} onClick={() => ref.current?.click()} aria-label={`Escolher ${label.toLowerCase()}`}>
                {busy ? <Spinner /> : value ? <img src={value} alt="" /> : <Icon icon="solar:gallery-add-linear" aria-hidden="true" />}
            </button>
            <div>
                <b>{label}</b>
                <small>{hint}</small>
                {error && <small className="mnu-error">{error}</small>}
                <span className="mnu-row">
                    <Button size="sm" onClick={() => ref.current?.click()}>{value ? "Trocar" : "Enviar"}</Button>
                    {value && <Button size="sm" variant="ghost" onClick={() => onChange("")}>Remover</Button>}
                </span>
            </div>
            <input ref={ref} type="file" accept="image/*" hidden onChange={(event) => pick(event.target.files?.[0])} />
        </div>
    );
};

export const ImagesPanel = ({ design, onImages, upload }) => (
    <div className="mne-panel">
        <ImageSlot label="Logotipo" hint="Quadrado, de preferência com fundo." value={design.images.logo} folder="logo" upload={upload} onChange={(logo) => onImages({ logo })} />
        <ImageSlot label="Capa" hint="Horizontal, 1600 × 600 ou maior." value={design.images.cover} folder="cover" upload={upload} wide onChange={(cover) => onImages({ cover })} />
        <ImageSlot label="Ícone da aba (favicon)" hint="Quadrado e simples; aparece na aba do navegador." value={design.images.favicon} folder="logo" upload={upload} onChange={(favicon) => onImages({ favicon })} />
        <p className="mne-hint">As fotos de cada produto ficam em Cardápios e produtos.</p>
    </div>
);
