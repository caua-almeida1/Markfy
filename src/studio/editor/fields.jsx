import React, { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Icon } from "@iconify/react";

import { BUTTON_ACTIONS, CHANNELS, CHANNEL_OPTIONS, SECTION_TYPES, channelLooksWrong } from "../site/schema";
import { uploadStudioImage } from "../data/uploadImage";
import { Button, Field, Segmented, Switch, Spinner, cx, useToast } from "../../design-system/components";

/* =========================================================
   CAMPOS DO INSPETOR

   Cada tipo de campo declarado em schema.js tem um editor
   aqui. `onChange(valor, chaveDeHistórico)` — a chave junta
   as teclas de uma mesma digitação num passo de desfazer.
========================================================= */

/* ---------- IMAGEM ---------- */

const PhotoPicker = ({ photos, onPick, onClose }) => (
    <motion.div
        className="ed-picker"
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.16 }}
    >
        <div className="ed-picker__head">
            <strong>Fotos da empresa</strong>
            <Button variant="ghost" size="sm" icon="solar:close-circle-linear" aria-label="Fechar" onClick={onClose} />
        </div>
        {photos.length ? (
            <div className="ed-picker__grid">
                {photos.map((url) => (
                    <button type="button" key={url} onClick={() => onPick(url)} aria-label="Usar esta foto">
                        <img src={url} alt="" loading="lazy" />
                    </button>
                ))}
            </div>
        ) : (
            <p className="ed-muted">Nenhuma foto cadastrada. Envie fotos em Minha empresa ou pelo botão Enviar.</p>
        )}
    </motion.div>
);

const useUploader = (handle) => {
    const notify = useToast();
    const [uploading, setUploading] = useState(0);

    const upload = async (files) => {
        const list = Array.from(files || []);
        if (!list.length) return [];

        setUploading((value) => value + list.length);

        const urls = [];

        for (const file of list) {
            try {
                urls.push(await uploadStudioImage(handle, file));
            } catch (error) {
                notify("error", "Imagem não enviada", error?.message || "Verifique a conexão e tente de novo.");
            } finally {
                setUploading((value) => value - 1);
            }
        }

        return urls;
    };

    return { upload, uploading };
};

export const ImageField = ({ label, value, onChange, ctx }) => {
    const inputRef = useRef(null);
    const [picking, setPicking] = useState(false);
    const { upload, uploading } = useUploader(ctx.handle);

    const onFiles = async (event) => {
        const [url] = await upload(event.target.files);
        event.target.value = "";
        if (url) onChange(url);
    };

    return (
        <div className="mk-field ed-image">
            <span className="mk-field__label">{label}</span>
            <div className={cx("ed-image__box", !value && "is-empty")}>
                {uploading ? (
                    <span className="ed-image__state"><Spinner /> Enviando…</span>
                ) : value ? (
                    <img src={value} alt="" />
                ) : (
                    <span className="ed-image__state"><Icon icon="solar:gallery-add-linear" /> Sem imagem</span>
                )}
            </div>
            <div className="ed-image__actions">
                <Button size="sm" variant="secondary" icon="solar:upload-linear" onClick={() => inputRef.current?.click()} disabled={!!uploading}>
                    Enviar
                </Button>
                <Button size="sm" variant="secondary" icon="solar:gallery-linear" onClick={() => setPicking((open) => !open)} aria-expanded={picking}>
                    Fotos da empresa
                </Button>
                {value && (
                    <Button size="sm" variant="ghost" icon="solar:trash-bin-minimalistic-linear" aria-label="Remover imagem" onClick={() => onChange("")} />
                )}
            </div>
            <input ref={inputRef} type="file" accept="image/*" hidden onChange={onFiles} />
            <AnimatePresence>
                {picking && (
                    <PhotoPicker
                        photos={ctx.bundle?.photos || []}
                        onClose={() => setPicking(false)}
                        onPick={(url) => {
                            onChange(url);
                            setPicking(false);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

export const ImagesField = ({ label, value = [], onChange, ctx, max = 16 }) => {
    const inputRef = useRef(null);
    const [picking, setPicking] = useState(false);
    const { upload, uploading } = useUploader(ctx.handle);

    const images = Array.isArray(value) ? value : [];

    const move = (index, delta) => {
        const next = [...images];
        const target = index + delta;
        if (target < 0 || target >= next.length) return;
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    };

    const onFiles = async (event) => {
        const room = max - images.length;
        const urls = await upload(Array.from(event.target.files || []).slice(0, room));
        event.target.value = "";
        if (urls.length) onChange([...images, ...urls]);
    };

    const companyPhotos = (ctx.bundle?.photos || []).filter((url) => !images.includes(url));

    return (
        <div className="mk-field ed-images">
            <span className="mk-field__label">
                <span>{label}</span>
                <span className="mk-field__count">{images.length}/{max}</span>
            </span>

            <ul className="ed-images__grid">
                <AnimatePresence initial={false}>
                    {images.map((url, index) => (
                        <motion.li
                            key={url}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ duration: 0.18 }}
                        >
                            <img src={url} alt="" />
                            <span className="ed-images__tools">
                                <button type="button" aria-label="Mover para a esquerda" onClick={() => move(index, -1)} disabled={index === 0}>
                                    <Icon icon="solar:alt-arrow-left-linear" />
                                </button>
                                <button type="button" aria-label="Remover foto" onClick={() => onChange(images.filter((item) => item !== url))}>
                                    <Icon icon="solar:trash-bin-minimalistic-linear" />
                                </button>
                                <button type="button" aria-label="Mover para a direita" onClick={() => move(index, 1)} disabled={index === images.length - 1}>
                                    <Icon icon="solar:alt-arrow-right-linear" />
                                </button>
                            </span>
                        </motion.li>
                    ))}
                </AnimatePresence>
                {uploading > 0 &&
                    Array.from({ length: uploading }).map((_, index) => (
                        <li key={`up-${index}`} className="is-loading"><Spinner /></li>
                    ))}
            </ul>

            <div className="ed-image__actions">
                <Button size="sm" variant="secondary" icon="solar:upload-linear" onClick={() => inputRef.current?.click()} disabled={images.length >= max}>
                    Enviar fotos
                </Button>
                <Button size="sm" variant="secondary" icon="solar:gallery-linear" onClick={() => setPicking((open) => !open)} disabled={images.length >= max} aria-expanded={picking}>
                    Fotos da empresa
                </Button>
            </div>
            <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={onFiles} />
            <AnimatePresence>
                {picking && (
                    <PhotoPicker
                        photos={companyPhotos}
                        onClose={() => setPicking(false)}
                        onPick={(url) => {
                            if (images.length < max) onChange([...images, url]);
                        }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

/* ---------- LINK ---------- */

const UrlInput = ({ label, value, onChange, historyKey, channel }) => {
    const invalid = value && !/^https?:\/\//i.test(value);
    const wrongHost = !invalid && channel && channelLooksWrong(channel, value);

    return (
        <Field
            label={label}
            hint={wrongHost
                ? `Este link não parece ser do ${CHANNELS[channel].label}. Confira se copiou o endereço certo.`
                : "Comece com https://"}
            error={invalid ? "O link precisa começar com https://" : null}
        >
            <input
                className="mk-input"
                type="url"
                inputMode="url"
                placeholder="https://"
                value={value || ""}
                onChange={(event) => onChange(event.target.value.trim(), historyKey)}
            />
        </Field>
    );
};

/* ---------- BOTÃO ---------- */

const ANCHOR_TYPES = ["catalog", "properties", "channels", "services", "packages", "booking", "steps", "gallery", "team", "contact", "form", "faq", "about"];

export const ButtonField = ({ field, value, onChange, ctx, historyKey }) => {
    const button = value || { label: "", action: "booking", url: "" };
    const enabled = !!button.label;
    const set = (patch, key) => onChange({ ...button, ...patch }, key);

    const anchors = ANCHOR_TYPES.filter((type) => ctx.page.sections.some((section) => section.type === type));

    return (
        <fieldset className="ed-group">
            <legend className="ed-group__legend">
                <span>{field.label}</span>
                {field.optional && (
                    <Switch
                        label={`Mostrar ${field.label.toLowerCase()}`}
                        checked={enabled}
                        onChange={(on) => set({ label: on ? "Saiba mais" : "" })}
                    />
                )}
            </legend>

            {(enabled || !field.optional) && (
                <>
                    <Field label="Texto do botão" count={button.label.length} max={30}>
                        <input
                            className="mk-input"
                            value={button.label}
                            maxLength={30}
                            onChange={(event) => set({ label: event.target.value }, `${historyKey}.label`)}
                        />
                    </Field>
                    <Field label="Ao clicar">
                        <select
                            className="mk-select"
                            value={button.action}
                            onChange={(event) => set({ action: event.target.value, url: "", channel: event.target.value === "channel" ? "ifood" : "" })}
                        >
                            {BUTTON_ACTIONS.map((action) => (
                                <option key={action.value} value={action.value}>{action.label}</option>
                            ))}
                        </select>
                    </Field>

                    {button.action === "channel" && (
                        <>
                            <Field label="Plataforma">
                                <select className="mk-select" value={button.channel || "ifood"} onChange={(event) => set({ channel: event.target.value })}>
                                    {CHANNEL_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </Field>
                            <UrlInput
                                label="Link da sua loja ou perfil"
                                value={button.url}
                                channel={button.channel || "ifood"}
                                historyKey={`${historyKey}.url`}
                                onChange={(url, key) => set({ url }, key)}
                            />
                        </>
                    )}

                    {button.action === "url" && (
                        <UrlInput label="Link" value={button.url} historyKey={`${historyKey}.url`} onChange={(url, key) => set({ url }, key)} />
                    )}

                    {button.action === "anchor" && (
                        <Field label="Seção de destino">
                            <select className="mk-select" value={button.url || anchors[0] || ""} onChange={(event) => set({ url: event.target.value })}>
                                {anchors.length ? anchors.map((type) => (
                                    <option key={type} value={type}>{SECTION_TYPES[type].label}</option>
                                )) : <option value="">Nenhuma seção disponível</option>}
                            </select>
                        </Field>
                    )}

                    {button.action === "whatsapp" && !ctx.bundle?.whatsapp && (
                        <p className="ed-warning">
                            <Icon icon="solar:danger-triangle-linear" aria-hidden="true" />
                            Sem WhatsApp cadastrado, este botão não aparece. Cadastre em Minha empresa.
                        </p>
                    )}

                    {button.action === "booking" && !ctx.bundle?.products?.length && (
                        <p className="ed-warning">
                            <Icon icon="solar:danger-triangle-linear" aria-hidden="true" />
                            Você ainda não tem serviços na Markfy Bookings. O botão leva à página da empresa, mas sem serviços não há o que agendar.
                        </p>
                    )}

                    {(button.action === "channel" || button.action === "url") && !button.url && (
                        <p className="ed-warning">
                            <Icon icon="solar:danger-triangle-linear" aria-hidden="true" />
                            Sem link, o botão não aparece na página.
                        </p>
                    )}
                </>
            )}
        </fieldset>
    );
};

/* ---------- LISTA ---------- */

export const ListField = ({ field, value = [], onChange, ctx, historyKey }) => {
    const items = Array.isArray(value) ? value : [];
    const [open, setOpen] = useState(items.length ? 0 : null);

    const update = (index, patch, key) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)), key);

    const move = (index, delta) => {
        const target = index + delta;
        if (target < 0 || target >= items.length) return;
        const next = [...items];
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
        setOpen(target);
    };

    const add = () => {
        onChange([...items, { ...field.empty }]);
        setOpen(items.length);
    };

    const summary = (item) => {
        const text = field.fields
            .filter((sub) => sub.type === "text" || sub.type === "textarea")
            .map((sub) => item[sub.key])
            .find((value) => typeof value === "string" && value.trim());

        if (text) return text;

        const select = field.fields.find((sub) => sub.type === "select");
        const option = select?.options.find((opt) => opt.value === item[select.key]);

        return option?.label || `Novo ${field.itemLabel}`;
    };

    return (
        <div className="ed-list">
            <div className="mk-field__label">
                <span>{field.label}</span>
                <span className="mk-field__count">{items.length}/{field.max}</span>
            </div>
            {field.hint && <p className="mk-field__hint">{field.hint}</p>}

            <ul className="ed-list__items">
                {items.map((item, index) => (
                    <li key={index} className={cx("ed-list__item", open === index && "is-open")}>
                        <div className="ed-list__row">
                            <button type="button" className="ed-list__toggle" onClick={() => setOpen(open === index ? null : index)} aria-expanded={open === index}>
                                <Icon icon="solar:alt-arrow-right-linear" aria-hidden="true" />
                                <span>{summary(item)}</span>
                            </button>
                            <span className="ed-list__tools">
                                <button type="button" aria-label="Subir" onClick={() => move(index, -1)} disabled={index === 0}><Icon icon="solar:alt-arrow-up-linear" /></button>
                                <button type="button" aria-label="Descer" onClick={() => move(index, 1)} disabled={index === items.length - 1}><Icon icon="solar:alt-arrow-down-linear" /></button>
                                <button type="button" aria-label={`Remover ${field.itemLabel}`} onClick={() => onChange(items.filter((_, i) => i !== index))}><Icon icon="solar:trash-bin-minimalistic-linear" /></button>
                            </span>
                        </div>
                        <AnimatePresence initial={false}>
                            {open === index && (
                                <motion.div
                                    className="ed-list__body"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                                >
                                    <div className="ed-list__fields">
                                        {field.fields.map((sub) => (
                                            <FieldEditor
                                                key={sub.key}
                                                field={sub}
                                                value={item[sub.key]}
                                                ctx={ctx}
                                                item={item}
                                                historyKey={`${historyKey}.${index}.${sub.key}`}
                                                onChange={(next, key) => update(index, { [sub.key]: next }, key)}
                                            />
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </li>
                ))}
            </ul>

            {items.length < field.max && (
                <Button variant="outline" size="sm" icon="solar:add-circle-linear" onClick={add}>
                    Adicionar {field.itemLabel}
                </Button>
            )}
        </div>
    );
};

/* ---------- DESPACHANTE ---------- */

export const FieldEditor = ({ field, value, onChange, ctx, historyKey, item }) => {
    switch (field.type) {
        case "text":
            return (
                <Field label={field.label} count={(value || "").length} max={field.max}>
                    <input
                        className="mk-input"
                        type="text"
                        value={value || ""}
                        maxLength={field.max}
                        placeholder={field.placeholder || ""}
                        onChange={(event) => onChange(event.target.value, historyKey)}
                    />
                </Field>
            );
        case "url":
            return (
                <UrlInput
                    label={field.label}
                    value={value}
                    historyKey={historyKey}
                    channel={field.channelKey ? item?.[field.channelKey] : null}
                    onChange={onChange}
                />
            );
        case "textarea":
            return (
                <Field label={field.label} count={(value || "").length} max={field.max}>
                    <textarea
                        className="mk-textarea"
                        rows={field.rows || 3}
                        value={value || ""}
                        maxLength={field.max}
                        placeholder={field.placeholder}
                        onChange={(event) => onChange(event.target.value, historyKey)}
                    />
                </Field>
            );
        case "select":
            return (
                <Field label={field.label}>
                    <select className="mk-select" value={value ?? field.options[0]?.value ?? ""} onChange={(event) => onChange(event.target.value)}>
                        {field.options.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>
                </Field>
            );
        case "number":
            return (
                <Field label={field.label}>
                    <input
                        className="mk-input"
                        type="number"
                        min={field.min}
                        max={field.max}
                        value={value ?? ""}
                        onChange={(event) => {
                            const number = Math.max(field.min || 0, Math.min(field.max || 999, Number(event.target.value) || field.min || 1));
                            onChange(number, historyKey);
                        }}
                    />
                </Field>
            );
        case "toggle":
            return (
                <div className="ed-toggle">
                    <span>{field.label}</span>
                    <Switch label={field.label} checked={!!value} onChange={(next) => onChange(next)} />
                </div>
            );
        case "segmented":
            return (
                <div className="mk-field">
                    <span className="mk-field__label">{field.label}</span>
                    <Segmented label={field.label} value={value} onChange={(next) => onChange(next)} options={field.options} />
                    {field.hint && <p className="mk-field__hint">{field.hint}</p>}
                </div>
            );
        case "image":
            return <ImageField label={field.label} value={value} onChange={(next) => onChange(next)} ctx={ctx} />;
        case "images":
            return <ImagesField label={field.label} value={value} onChange={(next) => onChange(next)} ctx={ctx} max={field.max} />;
        case "button":
            return <ButtonField field={field} value={value} onChange={onChange} ctx={ctx} historyKey={historyKey} />;
        case "list":
            return <ListField field={field} value={value} onChange={onChange} ctx={ctx} historyKey={historyKey} />;
        default:
            return null;
    }
};
