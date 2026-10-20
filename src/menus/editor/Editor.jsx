import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import { Badge, Button, ConfirmDialog, Segmented, Sheet, Spinner, cx, useMediaQuery } from "../../design-system/components";
import { designFromTemplate, designNeedsAdvanced, getTemplate, normalizeDesign } from "../engine/design.js";
import { entries } from "../engine/util.js";
import { useMenus } from "../MenusContext.jsx";
import MenuRenderer from "../site/MenuRenderer.jsx";
import Frame, { DEVICES } from "./Frame.jsx";
import { ColorsPanel, ContentPanel, FontsPanel, ImagesPanel, LayoutPanel, TemplatesPanel } from "./panels.jsx";
import CategoriesPanel from "./CategoriesPanel.jsx";

import "./editor.css";

/* =========================================================
   EDITOR VISUAL DO CARDÁPIO

   Esquerda: painéis (modelos, cores, fontes, disposição,
   textos, imagens, categorias). Centro: o cardápio de
   verdade, em celular, tablet ou computador.

   Salva sozinho no rascunho (menusDrafts) 1 s depois da
   última mudança e só diz "Salvo" depois que o banco
   confirma. Uma cópia de segurança fica no navegador até o
   banco confirmar — se a conexão cair, nada se perde.
   Publicar acontece no servidor, a partir do rascunho SALVO.
========================================================= */

const TABS = [
    { id: "templates", label: "Modelos", icon: "solar:pallete-2-linear" },
    { id: "colors", label: "Cores", icon: "solar:palette-round-linear" },
    { id: "fonts", label: "Fontes", icon: "solar:text-bold-square-linear" },
    { id: "layout", label: "Disposição", icon: "solar:widget-2-linear" },
    { id: "content", label: "Textos", icon: "solar:text-field-linear" },
    { id: "images", label: "Imagens", icon: "solar:gallery-linear" },
    { id: "categories", label: "Categorias", icon: "solar:folder-with-files-linear" }
];

const backupKey = (handle) => `markfy:menus:draft-backup:${handle}`;

const readBackup = (handle) => {
    try {
        return JSON.parse(window.localStorage.getItem(backupKey(handle)) || "null");
    } catch {
        return null;
    }
};

const writeBackup = (handle, value) => {
    try {
        if (value) window.localStorage.setItem(backupKey(handle), JSON.stringify(value));
        else window.localStorage.removeItem(backupKey(handle));
    } catch {
        /* sem armazenamento: segue sem cópia local */
    }
};

const SaveState = ({ state, onRetry }) => {
    const map = {
        saved: { icon: "solar:cloud-check-linear", text: "Rascunho salvo", tone: "ok" },
        pending: { icon: "solar:pen-linear", text: "Alterações pendentes", tone: "idle" },
        saving: { icon: null, text: "Salvando…", tone: "idle" },
        error: { icon: "solar:cloud-cross-linear", text: "Não foi possível salvar", tone: "error" }
    }[state];
    return (
        <span className={`mne-save mne-save--${map.tone}`} role="status" aria-live="polite">
            {map.icon ? <Icon icon={map.icon} aria-hidden="true" /> : <Spinner />}
            <span className="mne-save__text">{map.text}</span>
            {state === "error" && <button type="button" onClick={onRetry}>Tentar de novo</button>}
        </span>
    );
};

export default function Editor() {
    const navigate = useNavigate();
    const { source, handle, draft, draftLoading, site, catalog, settings, floor, features, can, act, path, demo, notify } = useMenus();

    const advanced = Boolean(features.menusAdvancedDesign);
    const compact = useMediaQuery("(max-width: 1023px)");

    const [design, setDesign] = useState(null);
    const [history, setHistory] = useState({ past: [], future: [] });
    const [saveState, setSaveState] = useState("saved");
    const [tab, setTab] = useState("templates");
    const [device, setDevice] = useState("mobile");
    const [panelOpen, setPanelOpen] = useState(!compact);
    const [confirm, setConfirm] = useState(null);
    const [recovery, setRecovery] = useState(null);
    const [publishing, setPublishing] = useState(false);
    const [layoutsOpen, setLayoutsOpen] = useState(false);
    const [layoutName, setLayoutName] = useState("");

    const timer = useRef(null);
    const latest = useRef(null);

    /* Primeira carga: rascunho > publicado > modelo padrão. */
    useEffect(() => {
        if (design || draftLoading) return;
        const base = draft?.design || site?.design || designFromTemplate("moderno");
        setDesign(normalizeDesign(base));

        const backup = readBackup(handle);
        if (backup?.design && backup.at > (draft?.updatedAt || 0) + 1000) setRecovery(backup);
    }, [design, draft, draftLoading, site, handle]);

    const save = useCallback(async (value) => {
        setSaveState("saving");
        try {
            await source.update({
                [`menusDrafts/${handle}/design`]: value,
                [`menusDrafts/${handle}/updatedAt`]: Date.now()
            });
            if (latest.current === value) {
                writeBackup(handle, null);
                setSaveState("saved");
            }
        } catch {
            setSaveState("error");
        }
    }, [source, handle]);

    /* A aparência atual também mora num ref: digitação rápida
       encadeia mudanças sem depender do próximo render. */
    const designRef = useRef(null);
    designRef.current = design;

    const change = useCallback((updater, { record = true } = {}) => {
        const current = designRef.current;
        const next = normalizeDesign(typeof updater === "function" ? updater(current) : updater);
        designRef.current = next;
        setDesign(next);
        if (record) setHistory((value) => ({ past: [...value.past.slice(-49), current], future: [] }));
        latest.current = next;
        writeBackup(handle, { design: next, at: Date.now() });
        setSaveState("pending");
        clearTimeout(timer.current);
        timer.current = setTimeout(() => save(next), 1000);
    }, [handle, save]);

    useEffect(() => () => clearTimeout(timer.current), []);

    const undo = useCallback(() => {
        if (!history.past.length) return;
        const previous = history.past[history.past.length - 1];
        setHistory({ past: history.past.slice(0, -1), future: [designRef.current, ...history.future] });
        change(previous, { record: false });
    }, [history, change]);

    const redo = useCallback(() => {
        if (!history.future.length) return;
        const [next, ...rest] = history.future;
        setHistory({ past: [...history.past, designRef.current], future: rest });
        change(next, { record: false });
    }, [history, change]);

    useEffect(() => {
        const onKey = (event) => {
            if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "z") return;
            const tag = document.activeElement?.tagName;
            if (tag === "INPUT" || tag === "TEXTAREA") return;
            event.preventDefault();
            if (event.shiftKey) redo();
            else undo();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [undo, redo]);

    /* Fechar a aba com alteração ainda não confirmada pelo banco. */
    useEffect(() => {
        const onLeave = (event) => {
            if (saveState === "pending" || saveState === "saving" || saveState === "error") {
                event.preventDefault();
                event.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", onLeave);
        return () => window.removeEventListener("beforeunload", onLeave);
    }, [saveState]);

    const status = !site?.publishedAt
        ? { tone: "warning", label: "Ainda não publicado" }
        : (draft?.updatedAt || 0) > (site.publishedAt || 0) + 1500 || saveState !== "saved"
            ? { tone: "info", label: "Alterações não publicadas" }
            : { tone: "success", label: "Publicado" };

    const publish = async () => {
        clearTimeout(timer.current);
        if (latest.current) await save(latest.current);
        setPublishing(true);
        try {
            const result = await act("design.publish", {});
            notify(
                "success",
                "Cardápio publicado",
                result?.downgraded ? "Alguns ajustes avançados não fazem parte do seu plano e foram publicados no padrão do modelo." : "Os clientes já veem a versão nova."
            );
        } catch {
            /* aviso já exibido pelo act() */
        } finally {
            setPublishing(false);
        }
    };

    const applyTemplate = (templateId) =>
        change((current) => ({ ...designFromTemplate(templateId, { content: current.content, images: current.images }) }));

    const savedLayouts = entries(draft?.saved).sort((a, b) => (b.at || 0) - (a.at || 0));

    const panel = design && (
        <>
            {tab === "templates" && <TemplatesPanel design={design} advanced={advanced} onApply={applyTemplate} />}
            {tab === "colors" && <ColorsPanel design={design} advanced={advanced} onTheme={(patch) => change((current) => ({ ...current, theme: { ...current.theme, ...patch } }))} />}
            {tab === "fonts" && <FontsPanel design={design} advanced={advanced} onTheme={(patch) => change((current) => ({ ...current, theme: { ...current.theme, ...patch } }))} />}
            {tab === "layout" && (
                <LayoutPanel
                    design={design}
                    advanced={advanced}
                    onLayout={(patch) => change((current) => ({ ...current, layout: { ...current.layout, ...patch } }))}
                    onTheme={(patch) => change((current) => ({ ...current, theme: { ...current.theme, ...patch } }))}
                />
            )}
            {tab === "content" && <ContentPanel design={design} onContent={(patch) => change((current) => ({ ...current, content: { ...current.content, ...patch } }))} />}
            {tab === "images" && <ImagesPanel design={design} upload={source.upload} onImages={(patch) => change((current) => ({ ...current, images: { ...current.images, ...patch } }))} />}
            {tab === "categories" && <CategoriesPanel />}
        </>
    );

    const needsAdvanced = design && !advanced && designNeedsAdvanced(design);
    const preview = useMemo(() => design, [design]);

    if (!design) {
        return <div className="mne-loading mk-root mnu"><Spinner /> Abrindo o editor…</div>;
    }

    return (
        <div className={cx("mk-root mnu mne", compact && "mne--compact")}>
            <header className="mne-top">
                <div className="mne-top__left">
                    <Button variant="ghost" size="sm" icon="solar:arrow-left-linear" onClick={() => navigate(path(""))} aria-label="Voltar ao painel" />
                    <div className="mne-top__title">
                        <strong>Editor do cardápio</strong>
                        <span>{getTemplate(design.templateId).name} · <Badge tone={status.tone}>{status.label}</Badge></span>
                    </div>
                </div>

                <div className="mne-top__center">
                    <Segmented
                        label="Dispositivo da prévia"
                        value={device}
                        onChange={setDevice}
                        options={Object.entries(DEVICES).map(([id, spec]) => ({ value: id, label: spec.label, icon: spec.icon, iconOnly: compact }))}
                    />
                </div>

                <div className="mne-top__right">
                    <SaveState state={saveState} onRetry={() => latest.current && save(latest.current)} />
                    <Button variant="ghost" size="sm" icon="solar:undo-left-linear" aria-label="Desfazer (Ctrl+Z)" disabled={!history.past.length} onClick={undo} />
                    <Button variant="ghost" size="sm" icon="solar:undo-right-linear" aria-label="Refazer (Ctrl+Shift+Z)" disabled={!history.future.length} onClick={redo} />
                    <Button variant="ghost" size="sm" icon="solar:layers-linear" onClick={() => setLayoutsOpen(true)}>{compact ? "" : "Mais"}</Button>
                    {can("design.publish") && (
                        <Button variant="primary" size="sm" icon="solar:upload-linear" loading={publishing} onClick={publish}>Publicar</Button>
                    )}
                </div>
            </header>

            {recovery && (
                <div className="mne-banner" role="alert">
                    <Icon icon="solar:history-linear" aria-hidden="true" />
                    Encontramos alterações deste aparelho que não chegaram a ser salvas ({new Date(recovery.at).toLocaleString("pt-BR")}).
                    <Button size="sm" variant="primary" onClick={() => { change(recovery.design); setRecovery(null); }}>Recuperar</Button>
                    <Button size="sm" variant="ghost" onClick={() => { writeBackup(handle, null); setRecovery(null); }}>Descartar</Button>
                </div>
            )}

            {needsAdvanced && (
                <div className="mne-banner is-warn" role="status">
                    <Icon icon="solar:lock-keyhole-minimalistic-linear" aria-hidden="true" />
                    Este rascunho usa recursos avançados que o seu plano não inclui. Ao publicar, eles voltam ao padrão do modelo.
                </div>
            )}

            {demo && (
                <div className="mne-banner is-demo" role="note">
                    <Icon icon="solar:test-tube-linear" aria-hidden="true" />
                    Demonstração: mude à vontade. Nada é salvo de verdade e o cardápio real de ninguém é alterado.
                </div>
            )}

            <div className="mne-body">
                <aside className={cx("mne-side", compact && "is-sheet", compact && panelOpen && "is-open")} aria-label="Ajustes do cardápio">
                    <nav className="mne-tabs" aria-label="Painéis do editor">
                        {TABS.map((item) => (
                            <button key={item.id} type="button" className={cx("mne-tab", tab === item.id && "is-on")} aria-pressed={tab === item.id} onClick={() => { setTab(item.id); setPanelOpen(true); }}>
                                <Icon icon={item.icon} aria-hidden="true" />
                                <span>{item.label}</span>
                            </button>
                        ))}
                    </nav>
                    <div className="mne-scroll">
                        {compact && (
                            <div className="mne-sheet-head">
                                <strong>{TABS.find((item) => item.id === tab)?.label}</strong>
                                <Button size="sm" variant="ghost" icon="solar:alt-arrow-down-linear" onClick={() => setPanelOpen(false)}>Ver prévia</Button>
                            </div>
                        )}
                        {panel}
                    </div>
                </aside>

                <section className="mne-center" aria-label="Prévia do cardápio">
                    <Frame device={device}>
                        <MenuRenderer design={preview} settings={settings} catalog={catalog} floor={floor} features={features} mode="preview" handle={handle} />
                    </Frame>
                </section>
            </div>

            <Sheet open={layoutsOpen} onClose={() => setLayoutsOpen(false)} title="Versões e restauração" description="Duplique o layout atual, volte a um salvo ou restaure o padrão.">
                <div className="mnu-form">
                    <div className="mnu-card">
                        <b>Duplicar o layout atual</b>
                        <div className="mnu-row">
                            <input className="mk-input" placeholder="Ex.: Versão de Natal" value={layoutName} maxLength={40} onChange={(event) => setLayoutName(event.target.value)} aria-label="Nome da cópia" />
                            <Button
                                variant="primary"
                                disabled={!layoutName.trim()}
                                onClick={async () => {
                                    await source.set(`menusDrafts/${handle}/saved/${source.newKey()}`, { name: layoutName.trim(), design, at: Date.now() });
                                    setLayoutName("");
                                    notify("success", "Cópia salva");
                                }}
                            >
                                Salvar cópia
                            </Button>
                        </div>
                    </div>

                    {savedLayouts.length > 0 && (
                        <ul className="std-list">
                            {savedLayouts.map((item) => (
                                <li key={item.id}>
                                    <div className="std-row">
                                        <span className="std-row__icon"><Icon icon="solar:layers-linear" /></span>
                                        <span className="std-row__body">
                                            <span className="std-row__title">{item.name}</span>
                                            <span className="std-row__meta">{getTemplate(item.design?.templateId).name} · {new Date(item.at).toLocaleString("pt-BR")}</span>
                                        </span>
                                        <Button size="sm" onClick={() => setConfirm({ title: `Usar “${item.name}”?`, message: "O rascunho atual será substituído por esta cópia (dá para desfazer com Ctrl+Z).", label: "Usar esta versão", run: () => change(item.design) })}>Usar</Button>
                                        <Button size="sm" variant="ghost" icon="solar:trash-bin-minimalistic-linear" aria-label={`Excluir ${item.name}`} onClick={() => setConfirm({ title: `Excluir “${item.name}”?`, message: "A cópia salva será apagada.", label: "Excluir", danger: true, run: () => source.remove(`menusDrafts/${handle}/saved/${item.id}`) })} />
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}

                    <div className="mnu-card">
                        <b>Restaurar</b>
                        <Button
                            variant="outline"
                            icon="solar:restart-linear"
                            onClick={() => setConfirm({ title: "Restaurar o padrão do modelo?", message: `Cores, fontes e disposição voltam ao padrão de “${getTemplate(design.templateId).name}”. Textos e imagens ficam.`, label: "Restaurar", run: () => applyTemplate(design.templateId) })}
                        >
                            Restaurar padrão do modelo
                        </Button>
                        <Button
                            variant="outline"
                            icon="solar:history-2-linear"
                            disabled={!site?.design}
                            onClick={() => setConfirm({ title: "Descartar alterações não publicadas?", message: "O rascunho volta a ser igual ao cardápio publicado.", label: "Descartar", danger: true, run: () => change(site.design) })}
                        >
                            Voltar à versão publicada
                        </Button>
                    </div>

                    <Button
                        variant="ghost"
                        icon="solar:eye-linear"
                        onClick={() => (demo ? navigate(path("cliente")) : site?.slug ? window.open(`/m/${site.slug}`, "_blank", "noopener") : notify("info", "Publique primeiro", "O link público aparece depois da primeira publicação."))}
                    >
                        Ver o cardápio publicado
                    </Button>
                </div>
            </Sheet>

            <ConfirmDialog
                open={Boolean(confirm)}
                title={confirm?.title}
                message={confirm?.message}
                confirmLabel={confirm?.label}
                tone={confirm?.danger ? "danger" : "primary"}
                onClose={() => setConfirm(null)}
                onConfirm={async () => {
                    await confirm.run();
                    setConfirm(null);
                    setLayoutsOpen(false);
                }}
            />
        </div>
    );
}
