import React, { useState } from "react";
import { AnimatePresence, Reorder, motion, useDragControls } from "framer-motion";
import { Icon } from "@iconify/react";

import { PALETTES, RADII, SECTION_GROUPS, SECTION_TYPES, SITE_FONTS, resolveTheme } from "../site/schema";
import { useSiteFonts } from "../site/SiteRenderer";
import { Button, Segmented, Sheet, Switch, cx } from "../../design-system/components";
import { FieldEditor } from "./fields";

/* =========================================================
   PAINÉIS DO EDITOR
========================================================= */

const sectionTitle = (section) => {
    const text = section.props?.title;
    return typeof text === "string" && text.trim() ? text : SECTION_TYPES[section.type]?.label;
};

/* ---------- LISTA DE SEÇÕES ---------- */

const SectionRow = ({ section, selected, onSelect, onToggle, readOnly }) => {
    const controls = useDragControls();
    const def = SECTION_TYPES[section.type];

    return (
        <Reorder.Item
            value={section}
            dragListener={false}
            dragControls={controls}
            className={cx("ed-srow", selected && "is-selected", section.hidden && "is-hidden")}
            whileDrag={{ scale: 1.02, boxShadow: "0 12px 30px rgba(0,0,0,0.14)", zIndex: 5 }}
            transition={{ type: "spring", stiffness: 600, damping: 40 }}
        >
            {!readOnly && (
                <span
                    className="ed-srow__grip"
                    onPointerDown={(event) => controls.start(event)}
                    aria-hidden="true"
                    title="Arraste para reordenar"
                >
                    <Icon icon="solar:hamburger-menu-linear" />
                </span>
            )}
            <button type="button" className="ed-srow__main" onClick={() => onSelect(section.id)} aria-current={selected || undefined}>
                <span className="ed-srow__icon"><Icon icon={def.icon} aria-hidden="true" /></span>
                <span className="ed-srow__text">
                    <strong>{def.label}</strong>
                    <small>{sectionTitle(section)}</small>
                </span>
            </button>
            {!readOnly && (
                <button
                    type="button"
                    className="ed-srow__eye"
                    onClick={() => onToggle(section.id)}
                    aria-label={section.hidden ? `Mostrar ${def.label}` : `Ocultar ${def.label}`}
                    aria-pressed={section.hidden}
                >
                    <Icon icon={section.hidden ? "solar:eye-closed-linear" : "solar:eye-linear"} />
                </button>
            )}
        </Reorder.Item>
    );
};

export const SectionsPanel = ({ page, selectedId, onSelect, onReorder, onToggle, onAdd, readOnly }) => (
    <div className="ed-panel">
        <div className="ed-panel__head">
            <div>
                <h2>Seções</h2>
                <p>{readOnly ? "Ordem da página." : "Arraste pela alça para mudar a ordem."}</p>
            </div>
        </div>

        <Reorder.Group axis="y" values={page.sections} onReorder={readOnly ? () => {} : onReorder} className="ed-slist">
            {page.sections.map((section) => (
                <SectionRow
                    key={section.id}
                    section={section}
                    selected={section.id === selectedId}
                    onSelect={onSelect}
                    onToggle={onToggle}
                    readOnly={readOnly}
                />
            ))}
        </Reorder.Group>

        {!readOnly && (
            <Button variant="primary" block icon="solar:add-circle-linear" onClick={onAdd}>
                Adicionar seção
            </Button>
        )}
    </div>
);

/* ---------- BIBLIOTECA ---------- */

export const SectionLibrary = ({ open, onClose, page, onPick }) => (
    <Sheet open={open} onClose={onClose} title="Adicionar seção" description="A seção entra logo abaixo da selecionada, já com os dados da sua empresa.">
        <div className="ed-lib">
            {SECTION_GROUPS.map((group) => (
                <section key={group} className="ed-lib__group" aria-label={group}>
                    <h3>{group}</h3>
                    <div className="ed-lib__items">
                        {Object.entries(SECTION_TYPES)
                            .filter(([, def]) => def.group === group)
                            .map(([type, def]) => {
                                const exists = def.unique && page.sections.some((section) => section.type === type);
                                return (
                                    <button type="button" key={type} className="ed-lib__item" onClick={() => onPick(type)} disabled={exists}>
                                        <span className="ed-lib__icon"><Icon icon={def.icon} aria-hidden="true" /></span>
                                        <span className="ed-lib__text">
                                            <strong>{def.label}</strong>
                                            <small>{exists ? "Já está na página" : def.description}</small>
                                        </span>
                                        <Icon icon="solar:add-circle-linear" className="ed-lib__plus" aria-hidden="true" />
                                    </button>
                                );
                            })}
                    </div>
                </section>
            ))}
        </div>
    </Sheet>
);

/* ---------- TEMA ---------- */

const FontOption = ({ id, font, selected, onSelect }) => {
    useSiteFonts(id);

    return (
        <button type="button" className={cx("ed-font", selected && "is-selected")} onClick={onSelect} aria-pressed={selected}>
            <span
                className="ed-font__sample"
                style={{ fontFamily: font.heading, fontWeight: font.headingWeight, textTransform: font.headingCase }}
            >
                Aa
            </span>
            <span className="ed-font__text">
                <strong>{font.label}</strong>
                <small>{font.sample}</small>
            </span>
        </button>
    );
};

const COLOR_FIELDS = [
    { key: "accent", label: "Destaque" },
    { key: "background", label: "Fundo" },
    { key: "surface", label: "Cartões" },
    { key: "text", label: "Texto" },
    { key: "muted", label: "Texto secundário" },
    { key: "onAccent", label: "Texto sobre destaque" }
];

export const ThemePanel = ({ page, onTheme, onSettings, readOnly, whatsappAvailable }) => {
    const [custom, setCustom] = useState(Object.keys(page.theme.colors || {}).length > 0);
    const resolved = resolveTheme(page.theme);

    return (
        <div className="ed-panel">
            <div className="ed-panel__head">
                <div>
                    <h2>Aparência</h2>
                    <p>Cores, letras e cantos da página inteira.</p>
                </div>
            </div>

            <fieldset className="ed-group" disabled={readOnly}>
                <legend className="ed-group__legend"><span>Paleta</span></legend>
                <div className="ed-palettes">
                    {Object.entries(PALETTES).map(([id, palette]) => (
                        <button
                            type="button"
                            key={id}
                            className={cx("ed-palette", page.theme.palette === id && "is-selected")}
                            onClick={() => onTheme({ palette: id, colors: {} }, "palette")}
                            aria-pressed={page.theme.palette === id}
                        >
                            <span className="ed-palette__swatch" style={{ background: palette.colors.background }}>
                                <i style={{ background: palette.colors.text }} />
                                <i style={{ background: palette.colors.accent }} />
                            </span>
                            <span>{palette.label}</span>
                        </button>
                    ))}
                </div>
            </fieldset>

            <fieldset className="ed-group" disabled={readOnly}>
                <legend className="ed-group__legend"><span>Tipografia</span></legend>
                <div className="ed-fonts">
                    {Object.entries(SITE_FONTS).map(([id, font]) => (
                        <FontOption key={id} id={id} font={font} selected={page.theme.font === id} onSelect={() => onTheme({ font: id }, "font")} />
                    ))}
                </div>
            </fieldset>

            <fieldset className="ed-group" disabled={readOnly}>
                <legend className="ed-group__legend"><span>Cantos</span></legend>
                <Segmented
                    label="Cantos"
                    value={page.theme.radius}
                    onChange={(radius) => onTheme({ radius }, "radius")}
                    options={Object.entries(RADII).map(([value, radius]) => ({ value, label: radius.label }))}
                />
            </fieldset>

            <fieldset className="ed-group" disabled={readOnly}>
                <legend className="ed-group__legend"><span>Página</span></legend>
                <div className="ed-toggle">
                    <span>Barra do topo com menu</span>
                    <Switch label="Barra do topo" checked={page.settings.showHeader} onChange={(showHeader) => onSettings({ showHeader })} />
                </div>
                <div className="ed-toggle">
                    <span>
                        Botão flutuante do WhatsApp
                        {!whatsappAvailable && <small className="ed-muted">Cadastre o WhatsApp em Minha empresa.</small>}
                    </span>
                    <Switch label="Botão do WhatsApp" checked={page.settings.whatsappFloat} onChange={(whatsappFloat) => onSettings({ whatsappFloat })} disabled={!whatsappAvailable} />
                </div>
            </fieldset>

            <div className="ed-advanced">
                <button type="button" className="ed-advanced__toggle" onClick={() => setCustom((value) => !value)} aria-expanded={custom}>
                    <Icon icon="solar:pallete-2-linear" aria-hidden="true" />
                    Cores personalizadas
                    <Icon icon="solar:alt-arrow-down-linear" className="ed-advanced__chev" aria-hidden="true" />
                </button>
                <AnimatePresence initial={false}>
                    {custom && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                            style={{ overflow: "hidden" }}
                        >
                            <fieldset className="ed-colors" disabled={readOnly}>
                                {COLOR_FIELDS.map((item) => (
                                    <label key={item.key} className="ed-color">
                                        <input
                                            type="color"
                                            value={resolved.colors[item.key] || "#000000"}
                                            onChange={(event) =>
                                                onTheme({ colors: { ...(page.theme.colors || {}), [item.key]: event.target.value } }, `color.${item.key}`)
                                            }
                                        />
                                        <span>{item.label}</span>
                                        <code>{resolved.colors[item.key]}</code>
                                    </label>
                                ))}
                                {Object.keys(page.theme.colors || {}).length > 0 && (
                                    <Button variant="ghost" size="sm" icon="solar:restart-linear" onClick={() => onTheme({ colors: {} }, "colors.reset")}>
                                        Voltar às cores da paleta
                                    </Button>
                                )}
                            </fieldset>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

/* ---------- INSPETOR ---------- */

export const Inspector = ({ section, ctx, onProps, onVariant, onAction, readOnly, onBack }) => {
    const [advanced, setAdvanced] = useState(false);

    if (!section) {
        return (
            <div className="ed-panel ed-panel--empty">
                <Icon icon="solar:cursor-square-linear" aria-hidden="true" />
                <h2>Selecione uma seção</h2>
                <p>Clique em qualquer parte da página para editar textos, fotos e botões.</p>
            </div>
        );
    }

    const def = SECTION_TYPES[section.type];
    const visible = (field) => !field.showIf || field.showIf(section.props);
    const advancedFields = (def.advanced || []).filter(visible);

    return (
        <div className="ed-panel" key={section.id}>
            <div className="ed-panel__head ed-panel__head--inspector">
                {onBack && (
                    <Button variant="ghost" size="sm" icon="solar:arrow-left-linear" aria-label="Voltar para seções" onClick={onBack} />
                )}
                <span className="ed-srow__icon"><Icon icon={def.icon} aria-hidden="true" /></span>
                <div>
                    <h2>{def.label}</h2>
                    <p>{def.description}</p>
                </div>
            </div>

            <fieldset className="ed-fields" disabled={readOnly}>
                {def.variants.length > 1 && (
                    <div className="mk-field">
                        <span className="mk-field__label">Estilo</span>
                        <div className="ed-variants">
                            {def.variants.map((variant) => (
                                <button
                                    type="button"
                                    key={variant.id}
                                    className={cx("ed-variant", section.variant === variant.id && "is-selected")}
                                    aria-pressed={section.variant === variant.id}
                                    onClick={() => onVariant(variant.id)}
                                >
                                    <span className={`ed-variant__art ed-variant__art--${section.type}-${variant.id}`} aria-hidden="true">
                                        <i /><i /><i />
                                    </span>
                                    {variant.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {def.fields.filter(visible).map((field) => (
                    <FieldEditor
                        key={field.key}
                        field={field}
                        value={section.props[field.key]}
                        ctx={ctx}
                        historyKey={`${section.id}.${field.key}`}
                        onChange={(value, key) => onProps({ [field.key]: value }, key)}
                    />
                ))}

                {def.note && <p className="ed-note"><Icon icon="solar:info-circle-linear" aria-hidden="true" /> {def.note}</p>}

                {advancedFields.length > 0 && (
                    <div className="ed-advanced">
                        <button type="button" className="ed-advanced__toggle" onClick={() => setAdvanced((value) => !value)} aria-expanded={advanced}>
                            <Icon icon="solar:tuning-2-linear" aria-hidden="true" />
                            Mais opções
                            <Icon icon="solar:alt-arrow-down-linear" className="ed-advanced__chev" aria-hidden="true" />
                        </button>
                        <AnimatePresence initial={false}>
                            {advanced && (
                                <motion.div
                                    className="ed-fields"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                                    style={{ overflow: "hidden" }}
                                >
                                    {advancedFields.map((field) => (
                                        <FieldEditor
                                            key={field.key}
                                            field={field}
                                            value={section.props[field.key]}
                                            ctx={ctx}
                                            historyKey={`${section.id}.${field.key}`}
                                            onChange={(value, key) => onProps({ [field.key]: value }, key)}
                                        />
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </fieldset>

            {!readOnly && (
                <div className="ed-section-actions">
                    <Button variant="ghost" size="sm" icon="solar:copy-linear" onClick={() => onAction("duplicate")} disabled={def.unique}>
                        Duplicar
                    </Button>
                    <Button variant="ghost" size="sm" icon={section.hidden ? "solar:eye-linear" : "solar:eye-closed-linear"} onClick={() => onAction("toggle")}>
                        {section.hidden ? "Mostrar" : "Ocultar"}
                    </Button>
                    <Button variant="danger" size="sm" icon="solar:trash-bin-minimalistic-linear" onClick={() => onAction("delete")}>
                        Remover
                    </Button>
                </div>
            )}
        </div>
    );
};
