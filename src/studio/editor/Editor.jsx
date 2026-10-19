import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Icon } from "@iconify/react";

import { useStudio } from "../StudioContext";
import { saveDraft } from "../data/studioApi";
import { SECTION_TYPES, createSection, newId } from "../site/schema";
import SiteRenderer, { WhatsAppFloat } from "../site/SiteRenderer";
import { usePublish } from "../usePublish";
import { useHistory } from "./useHistory";
import { Inspector, SectionLibrary, SectionsPanel, ThemePanel } from "./panels";

import {
    Badge,
    Button,
    Segmented,
    Sheet,
    Spinner,
    copyText,
    cx,
    useMediaQuery,
    useToast
} from "../../design-system/components";

import "./editor.css";

/* =========================================================
   EDITOR VISUAL DO STUDIO

   Esquerda: seções (ordem, visibilidade) e aparência.
   Centro:   a página de verdade, em computador, tablet ou
             celular. Clicar numa seção seleciona.
   Direita:  o inspetor da seção selecionada — o básico à
             vista, o resto em "Mais opções".

   Salva sozinho 1s depois da última mudança, mostra o
   estado no topo e só diz "Salvo" depois que o banco
   confirmou. Desfazer/refazer com Ctrl+Z / Ctrl+Shift+Z.

   Abaixo de 1200px os painéis viram folhas inferiores e a
   barra de ferramentas desce para o polegar.
========================================================= */

const DEVICES = {
    desktop: { label: "Computador", icon: "solar:monitor-linear", width: null },
    tablet: { label: "Tablet", icon: "solar:tablet-linear", width: 820 },
    mobile: { label: "Celular", icon: "solar:smartphone-linear", width: 390 }
};

/* ---------- MOLDURA DA PRÉVIA ---------- */

const Canvas = ({ device, children, onBackground, viewportRef, scaleRef, floating }) => {
    const areaRef = useRef(null);
    const [size, setSize] = useState({ w: 0, h: 0 });

    useLayoutEffect(() => {
        const node = areaRef.current;
        if (!node) return undefined;

        const update = () => setSize({ w: node.clientWidth, h: node.clientHeight });
        update();

        const observer = new ResizeObserver(update);
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    const pad = size.w < 600 ? 12 : 32;
    const available = Math.max(200, size.w - pad * 2);
    const target = DEVICES[device].width || Math.max(1180, available);
    const scale = Math.min(1, available / target);
    const height = Math.max(300, (size.h - pad * 2) / scale);

    if (scaleRef) scaleRef.current = scale;

    return (
        <div
            ref={areaRef}
            className="ed-canvas"
            style={{ padding: pad }}
            onClick={(event) => event.target === event.currentTarget && onBackground?.()}
        >
            {size.w > 0 && (
                <div
                    className={cx("ed-frame", `ed-frame--${device}`)}
                    style={{ width: target * scale, height: height * scale }}
                >
                    <div
                        ref={viewportRef}
                        className="ed-frame__viewport"
                        style={{ width: target, height, transform: `scale(${scale})` }}
                    >
                        <div key={device} className="mk-enter-fade">
                            {children}
                        </div>
                    </div>
                    {floating}
                </div>
            )}
        </div>
    );
};

/* ---------- ESTADO DO SALVAMENTO ---------- */

const SaveIndicator = ({ state, savedAt, onRetry }) => {
    const content = {
        saved: { icon: "solar:cloud-check-linear", text: savedAt ? "Salvo" : "Tudo salvo", tone: "ok" },
        pending: { icon: "solar:pen-linear", text: "Alterações não salvas", tone: "idle" },
        saving: { icon: null, text: "Salvando…", tone: "idle" },
        error: { icon: "solar:cloud-cross-linear", text: "Não foi possível salvar", tone: "error" }
    }[state];

    return (
        <span className={`ed-save ed-save--${content.tone}`} role="status" aria-live="polite">
            <span key={state} className="ed-save__inner mk-enter-fade">
                {content.icon ? <Icon icon={content.icon} aria-hidden="true" /> : <Spinner />}
                <span className="ed-save__text">{content.text}</span>
            </span>
            {state === "error" && (
                <button type="button" className="ed-save__retry" onClick={onRetry}>Tentar de novo</button>
            )}
        </span>
    );
};

/* ---------- EDITOR ---------- */

const Editor = () => {
    const navigate = useNavigate();
    const notify = useToast();
    const reduce = useReducedMotion();
    const [searchParams, setSearchParams] = useSearchParams();

    const { handle, user, bundle, draftPage, draftLoading, canEdit, status, publicUrl } = useStudio();
    const { publish, busy } = usePublish();

    const isCompact = useMediaQuery("(max-width: 1199px)");
    const isPhone = useMediaQuery("(max-width: 640px)");

    const history = useHistory(null);
    const page = history.value;

    const [selectedId, setSelectedId] = useState(null);
    const [device, setDevice] = useState("desktop");
    const [leftTab, setLeftTab] = useState("sections");
    const [sheet, setSheet] = useState(null);
    const [libraryOpen, setLibraryOpen] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(searchParams.get("preview") === "1");
    const [previewDevice, setPreviewDevice] = useState("desktop");
    const [published, setPublished] = useState(false);

    const [saveState, setSaveState] = useState("saved");
    const [savedAt, setSavedAt] = useState(null);

    const viewportRef = useRef(null);
    const scaleRef = useRef(1);
    const savedJson = useRef(null);
    const pageRef = useRef(page);
    pageRef.current = page;

    const readOnly = !canEdit;

    /* ---------- CARREGAR ---------- */

    useEffect(() => {
        if (draftLoading || page) return;

        if (!draftPage) {
            navigate("/studio/site", { replace: true });
            return;
        }

        savedJson.current = JSON.stringify(draftPage);
        history.reset(draftPage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftLoading, draftPage]);

    useEffect(() => {
        if (isPhone) setDevice("mobile");
    }, [isPhone]);

    /* ---------- SALVAMENTO AUTOMÁTICO ---------- */

    const saveNow = useCallback(async () => {
        const current = pageRef.current;
        if (!current || readOnly) return true;

        const json = JSON.stringify(current);
        if (json === savedJson.current) {
            setSaveState("saved");
            return true;
        }

        setSaveState("saving");

        try {
            await saveDraft(handle, current, user?.uid);
            savedJson.current = json;
            setSavedAt(Date.now());
            setSaveState(JSON.stringify(pageRef.current) === json ? "saved" : "pending");
            return true;
        } catch (error) {
            console.error("Erro ao salvar o rascunho:", error);
            setSaveState("error");
            return false;
        }
    }, [handle, user, readOnly]);

    useEffect(() => {
        if (!page || savedJson.current === null || readOnly) return undefined;

        if (JSON.stringify(page) === savedJson.current) {
            setSaveState((current) => (current === "saving" ? current : "saved"));
            return undefined;
        }

        setSaveState((current) => (current === "saving" ? current : "pending"));

        const timer = setTimeout(saveNow, 1000);
        return () => clearTimeout(timer);
    }, [page, saveNow, readOnly]);

    useEffect(() => {
        const onBeforeUnload = (event) => {
            if (saveState !== "saved") {
                event.preventDefault();
                event.returnValue = "";
            }
        };

        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [saveState]);

    /* ---------- MUTAÇÕES ---------- */

    const updateSections = useCallback(
        (fn, key) => history.commit((current) => ({ ...current, sections: fn(current.sections) }), key),
        [history]
    );

    const setProps = (id, patch, key) =>
        updateSections((sections) => sections.map((section) => (section.id === id ? { ...section, props: { ...section.props, ...patch } } : section)), key);

    const setVariant = (id, variant) =>
        updateSections((sections) => sections.map((section) => (section.id === id ? { ...section, variant } : section)));

    const toggleHidden = (id) =>
        updateSections((sections) => sections.map((section) => (section.id === id ? { ...section, hidden: !section.hidden } : section)));

    const move = (id, delta) =>
        updateSections((sections) => {
            const index = sections.findIndex((section) => section.id === id);
            const target = index + delta;
            if (index < 0 || target < 0 || target >= sections.length) return sections;
            const next = [...sections];
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });

    const duplicate = (id) => {
        const source = page.sections.find((section) => section.id === id);
        if (!source || SECTION_TYPES[source.type].unique) return;
        const copy = { ...JSON.parse(JSON.stringify(source)), id: newId() };
        updateSections((sections) => {
            const index = sections.findIndex((section) => section.id === id);
            const next = [...sections];
            next.splice(index + 1, 0, copy);
            return next;
        });
        setSelectedId(copy.id);
    };

    const remove = (id) => {
        const label = SECTION_TYPES[page.sections.find((section) => section.id === id)?.type]?.label;
        updateSections((sections) => sections.filter((section) => section.id !== id));
        setSelectedId(null);
        setSheet(null);
        notify("success", `${label || "Seção"} removida`, "Mudou de ideia? Use Desfazer, no topo.");
    };

    const add = (type) => {
        const section = createSection(type, bundle);
        updateSections((sections) => {
            const index = sections.findIndex((item) => item.id === selectedId);
            const next = [...sections];
            next.splice(index >= 0 ? index + 1 : next.length, 0, section);
            return next;
        });
        setLibraryOpen(false);
        setSelectedId(section.id);
        if (isCompact) setSheet("edit");
    };

    const setTheme = (patch, key) => history.commit((current) => ({ ...current, theme: { ...current.theme, ...patch } }), key);
    const setSettings = (patch) => history.commit((current) => ({ ...current, settings: { ...current.settings, ...patch } }));

    const sectionAction = (action) => {
        if (!selectedId) return;
        if (action === "duplicate") duplicate(selectedId);
        if (action === "toggle") toggleHidden(selectedId);
        if (action === "delete") remove(selectedId);
        if (action === "up") move(selectedId, -1);
        if (action === "down") move(selectedId, 1);
    };

    /* ---------- SELEÇÃO E ROLAGEM ---------- */

    const select = (id) => {
        setSelectedId(id);
        if (isCompact && id) setSheet("edit");
    };

    useEffect(() => {
        if (!selectedId) return;
        const viewport = viewportRef.current;
        const node = viewport?.querySelector(`[data-section-id="${selectedId}"]`);
        if (!viewport || !node) return;

        const scale = scaleRef.current || 1;
        const top = (node.getBoundingClientRect().top - viewport.getBoundingClientRect().top) / scale + viewport.scrollTop;
        const bottom = top + node.offsetHeight;
        const visibleTop = viewport.scrollTop;
        const visibleBottom = visibleTop + viewport.clientHeight;

        if (top < visibleTop || top > visibleBottom - 80 || bottom < visibleTop + 80) {
            viewport.scrollTo({ top: Math.max(0, top - 16), behavior: reduce ? "auto" : "smooth" });
        }
    }, [selectedId, page?.sections?.length, reduce]);

    /* ---------- ATALHOS ---------- */

    useEffect(() => {
        const onKey = (event) => {
            const mod = event.ctrlKey || event.metaKey;
            if (!mod || readOnly) return;

            const key = event.key.toLowerCase();

            if (key === "z" && !event.shiftKey) {
                event.preventDefault();
                history.undo();
            } else if ((key === "z" && event.shiftKey) || key === "y") {
                event.preventDefault();
                history.redo();
            } else if (key === "s") {
                event.preventDefault();
                saveNow();
            }
        };

        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [history, readOnly, saveNow]);

    /* ---------- AÇÕES DO TOPO ---------- */

    const leave = async () => {
        if (saveState !== "saved" && !readOnly) {
            const ok = await saveNow();
            if (!ok) {
                notify("error", "Alterações não salvas", "Tente salvar de novo antes de sair.");
                return;
            }
        }
        navigate("/studio/site");
    };

    const doPublish = async () => {
        const ok = await publish(page);
        if (ok) {
            savedJson.current = JSON.stringify(page);
            setSaveState("saved");
            setSavedAt(Date.now());
            setPublished(true);
        }
    };

    const openPreview = () => {
        setPreviewDevice(isPhone ? "mobile" : device);
        setPreviewOpen(true);
    };

    const closePreview = () => {
        setPreviewOpen(false);
        if (searchParams.get("preview")) {
            searchParams.delete("preview");
            setSearchParams(searchParams, { replace: true });
        }
    };

    const upToDate = status === "published" && saveState === "saved";
    const publishLabel = status === "none" || status === "draft" ? "Publicar" : upToDate ? "Publicada" : "Publicar alterações";

    const ctx = useMemo(() => ({ handle, bundle, page }), [handle, bundle, page]);

    const selected = page?.sections.find((section) => section.id === selectedId) || null;

    if (!page) {
        return (
            <div className="mk-root ed-loading" role="status">
                <Spinner /> Abrindo o editor…
            </div>
        );
    }

    /* Ações rápidas no selo da seção selecionada, dentro
       da própria prévia. */
    const chipActions = readOnly
        ? null
        : (section) => {
            const index = page.sections.findIndex((item) => item.id === section.id);
            return (
                <span className="mks-edit-chip__tools">
                    <button type="button" aria-label="Subir seção" disabled={index === 0} onClick={(event) => { event.stopPropagation(); move(section.id, -1); }}>
                        <Icon icon="solar:alt-arrow-up-linear" />
                    </button>
                    <button type="button" aria-label="Descer seção" disabled={index === page.sections.length - 1} onClick={(event) => { event.stopPropagation(); move(section.id, 1); }}>
                        <Icon icon="solar:alt-arrow-down-linear" />
                    </button>
                    <button type="button" aria-label={section.hidden ? "Mostrar seção" : "Ocultar seção"} onClick={(event) => { event.stopPropagation(); toggleHidden(section.id); }}>
                        <Icon icon={section.hidden ? "solar:eye-linear" : "solar:eye-closed-linear"} />
                    </button>
                    <button type="button" aria-label="Remover seção" onClick={(event) => { event.stopPropagation(); remove(section.id); }}>
                        <Icon icon="solar:trash-bin-minimalistic-linear" />
                    </button>
                </span>
            );
        };

    const sectionsPanel = (
        <SectionsPanel
            page={page}
            selectedId={selectedId}
            readOnly={readOnly}
            onSelect={(id) => {
                setSelectedId(id);
                if (isCompact) setSheet("edit");
            }}
            onReorder={(sections) => updateSections(() => sections, "reorder")}
            onToggle={toggleHidden}
            onAdd={() => setLibraryOpen(true)}
        />
    );

    const themePanel = (
        <ThemePanel
            page={page}
            readOnly={readOnly}
            onTheme={setTheme}
            onSettings={setSettings}
            whatsappAvailable={!!bundle?.whatsapp}
        />
    );

    const inspector = (
        <Inspector
            key={selected?.id || "none"}
            section={selected}
            ctx={ctx}
            readOnly={readOnly}
            onProps={(patch, key) => setProps(selected.id, patch, key)}
            onVariant={(variant) => setVariant(selected.id, variant)}
            onAction={sectionAction}
        />
    );

    return (
        <div className={cx("mk-root ed", isCompact && "ed--compact")}>
            {/* ---------- TOPO ---------- */}
            <header className="ed-top">
                <div className="ed-top__left">
                    <Button variant="ghost" size="sm" icon="solar:arrow-left-linear" onClick={leave} aria-label="Voltar para Meu site">
                        {!isCompact && "Sair"}
                    </Button>
                    <div className="ed-top__title">
                        <strong>{bundle?.name || "Minha página"}</strong>
                        {readOnly ? <Badge>Somente visualização</Badge> : <SaveIndicator state={saveState} savedAt={savedAt} onRetry={saveNow} />}
                    </div>
                </div>

                {!isPhone && (
                    <div className="ed-top__center">
                        <Segmented
                            label="Tamanho da prévia"
                            value={device}
                            onChange={setDevice}
                            options={Object.entries(DEVICES).map(([value, item]) => ({ value, label: item.label, icon: item.icon, iconOnly: true }))}
                        />
                    </div>
                )}

                <div className="ed-top__right">
                    {!readOnly && (
                        <span className="ed-history">
                            <Button variant="ghost" size="sm" icon="solar:undo-left-linear" aria-label="Desfazer (Ctrl+Z)" title="Desfazer (Ctrl+Z)" onClick={history.undo} disabled={!history.canUndo} />
                            <Button variant="ghost" size="sm" icon="solar:undo-right-linear" aria-label="Refazer (Ctrl+Shift+Z)" title="Refazer (Ctrl+Shift+Z)" onClick={history.redo} disabled={!history.canRedo} />
                        </span>
                    )}
                    <Button variant="outline" size="sm" icon="solar:eye-linear" onClick={openPreview} aria-label="Pré-visualizar">
                        {!isPhone && "Pré-visualizar"}
                    </Button>
                    {!readOnly && (
                        <motion.span layout className="ed-publish-wrap">
                            <Button
                                variant="primary"
                                size="sm"
                                icon={upToDate ? "solar:check-circle-linear" : "solar:upload-minimalistic-linear"}
                                loading={busy === "publish"}
                                disabled={upToDate || saveState === "saving"}
                                onClick={doPublish}
                                className={cx("ed-publish", upToDate && "is-done")}
                                aria-label={publishLabel}
                            >
                                {!isPhone && publishLabel}
                            </Button>
                        </motion.span>
                    )}
                </div>
            </header>

            {/* ---------- CORPO ---------- */}
            <div className="ed-body">
                {!isCompact && (
                    <aside className="ed-left" aria-label="Seções e aparência">
                        <div className="ed-tabs">
                            <Segmented
                                label="Painel"
                                value={leftTab}
                                onChange={setLeftTab}
                                options={[
                                    { value: "sections", label: "Seções", icon: "solar:layers-minimalistic-linear" },
                                    { value: "theme", label: "Aparência", icon: "solar:pallete-2-linear" }
                                ]}
                            />
                        </div>
                        <div className="ed-scroll">
                            <div key={leftTab} className="mk-enter-fade">
                                {leftTab === "sections" ? sectionsPanel : themePanel}
                            </div>
                        </div>
                    </aside>
                )}

                <main className="ed-center" aria-label="Prévia editável da página">
                    <Canvas
                        device={device}
                        viewportRef={viewportRef}
                        scaleRef={scaleRef}
                        onBackground={() => setSelectedId(null)}
                        floating={page.settings.whatsappFloat ? <WhatsAppFloat bundle={bundle} className="mks-wa--frame" /> : null}
                    >
                        <SiteRenderer
                            page={page}
                            bundle={bundle}
                            mode="edit"
                            selectedId={selectedId}
                            onSelect={select}
                            sectionActions={chipActions}
                        />
                    </Canvas>
                </main>

                {!isCompact && (
                    <aside className="ed-right" aria-label="Editar seção">
                        <div className="ed-scroll">{inspector}</div>
                    </aside>
                )}
            </div>

            {/* ---------- CELULAR / TABLET ---------- */}
            {isCompact && (
                <div className="ed-dock" role="toolbar" aria-label="Ferramentas do editor">
                    {[
                        { id: "sections", label: "Seções", icon: "solar:layers-minimalistic-linear" },
                        { id: "edit", label: "Editar", icon: "solar:pen-2-linear", disabled: !selected },
                        { id: "theme", label: "Aparência", icon: "solar:pallete-2-linear" },
                        ...(!readOnly ? [{ id: "add", label: "Adicionar", icon: "solar:add-circle-linear" }] : [])
                    ].map((item) => (
                        <button
                            type="button"
                            key={item.id}
                            className={cx("ed-dock__item", sheet === item.id && "is-active")}
                            disabled={item.disabled}
                            onClick={() => (item.id === "add" ? setLibraryOpen(true) : setSheet(item.id))}
                        >
                            <Icon icon={item.icon} aria-hidden="true" />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>
            )}

            {isCompact && (
                <>
                    <Sheet open={sheet === "sections"} onClose={() => setSheet(null)} title="Seções">
                        {sectionsPanel}
                    </Sheet>
                    <Sheet open={sheet === "theme"} onClose={() => setSheet(null)} title="Aparência">
                        {themePanel}
                    </Sheet>
                    <Sheet open={sheet === "edit" && !!selected} onClose={() => setSheet(null)} title={selected ? SECTION_TYPES[selected.type].label : ""}>
                        {inspector}
                    </Sheet>
                </>
            )}

            <SectionLibrary open={libraryOpen} onClose={() => setLibraryOpen(false)} page={page} onPick={add} />

            {/* ---------- PRÉ-VISUALIZAÇÃO ---------- */}
            <AnimatePresence>
                {previewOpen && (
                    <motion.div
                        className="ed-preview"
                        role="dialog"
                        aria-modal="true"
                        aria-label="Pré-visualização"
                        initial={{ opacity: 0, scale: reduce ? 1 : 0.985 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: reduce ? 1 : 0.985 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                        onKeyDown={(event) => event.key === "Escape" && closePreview()}
                    >
                        <div className="ed-preview__bar">
                            <span className="ed-preview__label">
                                <Icon icon="solar:eye-linear" aria-hidden="true" />
                                Pré-visualização
                                {!isPhone && <small>como o visitante vai ver</small>}
                            </span>
                            {!isPhone && (
                                <Segmented
                                    label="Tamanho"
                                    value={previewDevice}
                                    onChange={setPreviewDevice}
                                    options={Object.entries(DEVICES).map(([value, item]) => ({ value, label: item.label, icon: item.icon, iconOnly: true }))}
                                />
                            )}
                            <Button variant="secondary" size="sm" icon="solar:close-circle-linear" onClick={closePreview} autoFocus>
                                Fechar
                            </Button>
                        </div>
                        <Canvas
                            device={previewDevice}
                            floating={page.settings.whatsappFloat ? <WhatsAppFloat bundle={bundle} className="mks-wa--frame" /> : null}
                        >
                            <SiteRenderer page={page} bundle={bundle} mode="preview" />
                        </Canvas>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ---------- PUBLICADA ---------- */}
            <Sheet
                open={published}
                onClose={() => setPublished(false)}
                side="center"
                footer={(
                    <>
                        <Button variant="ghost" onClick={() => setPublished(false)}>Continuar editando</Button>
                        <Button variant="primary" icon="solar:arrow-right-up-linear" as="a" href={publicUrl} target="_blank" rel="noopener noreferrer">
                            Abrir página
                        </Button>
                    </>
                )}
            >
                <div className="ed-done">
                    <motion.span
                        className="ed-done__mark"
                        initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
                        animate={{ scale: 1, rotate: 0, opacity: 1 }}
                        transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 16, delay: 0.1 }}
                    >
                        <Icon icon="solar:check-circle-bold" />
                    </motion.span>
                    <h2>Sua página está no ar</h2>
                    <p>Compartilhe o link no Instagram, no WhatsApp e no perfil do Google da sua empresa.</p>
                    <div className="ed-done__link">
                        <span>{publicUrl.replace(/^https?:\/\//, "")}</span>
                        <Button
                            variant="secondary"
                            size="sm"
                            icon="solar:copy-linear"
                            onClick={async () => {
                                const ok = await copyText(publicUrl);
                                notify(ok ? "success" : "error", ok ? "Link copiado" : "Não foi possível copiar", "");
                            }}
                        >
                            Copiar
                        </Button>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        icon="ic:baseline-whatsapp"
                        as="a"
                        href={`https://wa.me/?text=${encodeURIComponent(`Conheça a ${bundle?.name}: ${publicUrl}`)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        Enviar pelo WhatsApp
                    </Button>
                </div>
            </Sheet>
        </div>
    );
};

export default Editor;
