import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import { useStudio, STATUS_META } from "../StudioContext";
import { createDraft, saveDraft } from "../data/studioApi";
import { TEMPLATES, applyTemplateLook, buildPage, recommendTemplate } from "../site/templates";
import { PALETTES, SITE_FONTS } from "../site/schema";
import SitePreviewThumb from "../site/SitePreviewThumb";
import { usePublish } from "../usePublish";

import { Badge, Button, ConfirmDialog, Sheet, Skeleton, Segmented, useToast } from "../../design-system/components";
import { PageHead, formatDateTime } from "./shared";

/* =========================================================
   MEU SITE

   Sem página: escolher o modelo. Cada cartão é uma prévia
   VIVA, montada com os dados reais da empresa — a pessoa vê
   o próprio negócio em cada modelo antes de escolher.

   A galeria mostra primeiro os modelos principais (e o
   indicado para a empresa); os demais ficam atrás de
   "Mostrar mais modelos", para a escolha não virar uma
   parede de opções.

   Com página: estado de publicação, ações principais e a
   opção de trocar o visual sem perder o conteúdo.
========================================================= */

const DataSummary = ({ bundle }) => {
    const items = [
        { ok: !!bundle.logo, label: "Logotipo" },
        { ok: !!bundle.description, label: "Descrição" },
        { ok: bundle.products.length > 0, label: `${bundle.products.length} ${bundle.products.length === 1 ? "serviço" : "serviços"}` },
        { ok: bundle.professionals.length > 0, label: `${bundle.professionals.length} ${bundle.professionals.length === 1 ? "profissional" : "profissionais"}` },
        { ok: bundle.photos.length > 0, label: `${bundle.photos.length} fotos` },
        { ok: !!bundle.address, label: "Endereço" },
        { ok: !!bundle.businessHours, label: "Horários" },
        { ok: !!bundle.whatsapp, label: "WhatsApp" }
    ];

    return (
        <div className="std-datasum">
            <p>Estes dados já estão na Markfy e entram na página automaticamente:</p>
            <ul>
                {items.map((item) => (
                    <li key={item.label} className={item.ok ? "is-ok" : ""}>
                        <Icon icon={item.ok ? "solar:check-circle-bold" : "solar:minus-circle-linear"} aria-hidden="true" />
                        {item.label}
                        <span className="mk-visually-hidden">{item.ok ? "disponível" : "ainda não cadastrado"}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const TemplateCard = ({ template, bundle, recommended, onPreview, onChoose, index, busy, current }) => {
    const page = useMemo(() => buildPage(template.id, bundle), [template.id, bundle]);
    const palette = PALETTES[template.theme.palette];

    return (
        <article className="std-tpl mk-enter" style={{ "--i": index % 6 }}>
            <button type="button" className="std-tpl__preview" onClick={onPreview} aria-label={`Ver o modelo ${template.name} em tamanho maior`}>
                <SitePreviewThumb page={page} bundle={bundle} />
                <span className="std-tpl__zoom"><Icon icon="solar:magnifer-zoom-in-linear" /> Ver maior</span>
            </button>
            <div className="std-tpl__body">
                <div className="std-tpl__title">
                    <h3>{template.name}</h3>
                    {recommended && <Badge tone="info" plain>Indicado para você</Badge>}
                    {current && <Badge plain>Em uso</Badge>}
                </div>
                <p className="std-tpl__aud">{template.audience}</p>
                <p>{template.description}</p>
                <div className="std-tpl__meta" aria-label="Paleta e tipografia">
                    <span className="std-swatches" aria-hidden="true">
                        {["background", "accent", "text"].map((key) => (
                            <i key={key} style={{ background: palette.colors[key] }} />
                        ))}
                    </span>
                    <span>{SITE_FONTS[template.theme.font].sample}</span>
                </div>
                <Button variant={recommended ? "primary" : "outline"} block loading={busy === template.id} disabled={!!busy} onClick={onChoose}>
                    Usar este modelo
                </Button>
            </div>
        </article>
    );
};

const TemplateGallery = ({ bundle, onChoose, busy, current }) => {
    const recommended = recommendTemplate(bundle.categories);
    const [preview, setPreview] = useState(null);
    const [device, setDevice] = useState("desktop");
    const [showAll, setShowAll] = useState(false);

    /* Principais = os marcados como destaque + o indicado e o
       atual, se estiverem entre os outros. */
    const isMain = (template) => template.featured || template.id === recommended || template.id === current;

    const main = [...TEMPLATES.filter(isMain)].sort((a, b) => (b.id === recommended) - (a.id === recommended));
    const more = TEMPLATES.filter((template) => !isMain(template));

    const previewPage = useMemo(() => (preview ? buildPage(preview.id, bundle) : null), [preview, bundle]);

    const renderCard = (template, index) => (
        <TemplateCard
            key={template.id}
            index={index}
            template={template}
            bundle={bundle}
            busy={busy}
            recommended={template.id === recommended && !current}
            current={template.id === current}
            onPreview={() => setPreview(template)}
            onChoose={() => onChoose(template.id)}
        />
    );

    return (
        <>
            <div className="std-tpls">
                {main.map(renderCard)}
                {showAll && more.map(renderCard)}
            </div>

            {more.length > 0 && (
                <div className="std-tpls__more">
                    {!showAll && (
                        <p className="std-hint">
                            Mais {more.length} modelos: {more.map((template) => template.audience.split(/,| e /)[0].toLowerCase()).join(", ")}.
                        </p>
                    )}
                    <Button
                        variant="outline"
                        icon={showAll ? "solar:alt-arrow-up-linear" : "solar:widget-add-linear"}
                        onClick={() => setShowAll((value) => !value)}
                        aria-expanded={showAll}
                    >
                        {showAll ? "Mostrar menos" : "Mostrar mais modelos"}
                    </Button>
                </div>
            )}

            <Sheet
                open={!!preview}
                onClose={() => setPreview(null)}
                side="center"
                title={preview ? `Modelo ${preview.name}` : ""}
                description={preview?.description}
                footer={(
                    <>
                        <Segmented
                            label="Tamanho da prévia"
                            value={device}
                            onChange={setDevice}
                            options={[
                                { value: "desktop", label: "Computador", icon: "solar:monitor-linear" },
                                { value: "mobile", label: "Celular", icon: "solar:smartphone-linear" }
                            ]}
                        />
                        <Button variant="primary" loading={busy === preview?.id} onClick={() => onChoose(preview.id)}>
                            Usar este modelo
                        </Button>
                    </>
                )}
            >
                {previewPage && (
                    <div className={`std-tpl-big std-tpl-big--${device}`}>
                        <SitePreviewThumb page={previewPage} bundle={bundle} width={device === "mobile" ? 390 : 1280} />
                    </div>
                )}
            </Sheet>
        </>
    );
};

const MySite = () => {
    const navigate = useNavigate();
    const notify = useToast();

    const { handle, user, bundle, bundleLoading, draft, draftPage, draftLoading, publishedPage, published, status, publicUrl, canEdit } = useStudio();
    const { publish, busy: publishing } = usePublish();

    const [busy, setBusy] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [changeMode, setChangeMode] = useState("look");

    const meta = STATUS_META[status];

    const createFrom = async (templateId) => {
        if (!canEdit) return;
        setBusy(templateId);
        try {
            await createDraft(handle, buildPage(templateId, bundle), user?.uid);
            notify("success", "Página criada", "Agora é só ajustar o que quiser no editor.");
            navigate("/studio/editor");
        } catch (error) {
            notify("error", "Não foi possível criar a página", "Verifique sua conexão e tente de novo.");
        } finally {
            setBusy(null);
        }
    };

    const changeTemplate = async (templateId) => {
        setBusy(templateId);
        try {
            const next = changeMode === "look" ? applyTemplateLook(draftPage, templateId) : buildPage(templateId, bundle);
            await saveDraft(handle, next, user?.uid);
            notify("success", "Modelo aplicado", changeMode === "look" ? "O conteúdo foi mantido com o novo visual." : "A página recomeçou com o novo modelo.");
            setConfirm(null);
            navigate("/studio/editor");
        } catch {
            notify("error", "Não foi possível trocar o modelo", "Tente de novo em instantes.");
        } finally {
            setBusy(null);
        }
    };

    if (bundleLoading || draftLoading || !bundle) {
        return (
            <div className="std-page">
                <PageHead title="Meu site" />
                <div className="std-tpls">
                    {[0, 1, 2].map((key) => <Skeleton key={key} height={420} radius={26} />)}
                </div>
            </div>
        );
    }

    if (!draftPage) {
        return (
            <div className="std-page">
                <PageHead
                    title="Escolha um modelo"
                    description={`As prévias abaixo já usam os dados reais da ${bundle.name}. Depois você muda textos, fotos, cores e seções como quiser.`}
                />
                <DataSummary bundle={bundle} />
                {!canEdit ? (
                    <p className="std-hint">Só o responsável pela empresa pode criar a página.</p>
                ) : (
                    <TemplateGallery bundle={bundle} onChoose={createFrom} busy={busy} />
                )}
            </div>
        );
    }

    return (
        <div className="std-page">
            <PageHead
                title="Meu site"
                description="Sua página, o estado de publicação e o modelo em uso."
                actions={(
                    <>
                        <Button variant="outline" icon="solar:eye-linear" onClick={() => navigate("/studio/editor?preview=1")}>
                            Pré-visualizar
                        </Button>
                        <Button variant="primary" icon="solar:pen-2-linear" onClick={() => navigate("/studio/editor")}>
                            {canEdit ? "Editar página" : "Ver página"}
                        </Button>
                    </>
                )}
            />

            <div className="std-grid std-grid--main">
                <section className="std-panel std-panel--flush" aria-label="Prévia da página">
                    <div className="std-sitecard__preview">
                        <SitePreviewThumb page={draftPage} bundle={bundle} />
                    </div>
                </section>

                <section className="std-panel" aria-labelledby="std-pub-title">
                    <div className="std-panel__head">
                        <h2 id="std-pub-title">Publicação</h2>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                    </div>
                    <p className="std-hint">{meta.text}</p>

                    <dl className="std-facts">
                        <div>
                            <dt>Último salvamento</dt>
                            <dd>{draft?.updatedAt ? formatDateTime(draft.updatedAt) : "Ainda não salvo"}</dd>
                        </div>
                        <div>
                            <dt>Publicada em</dt>
                            <dd>{published?.publishedAt ? formatDateTime(published.publishedAt) : "Nunca publicada"}</dd>
                        </div>
                        <div>
                            <dt>Endereço público</dt>
                            <dd>
                                {publishedPage ? (
                                    <a href={publicUrl} target="_blank" rel="noopener noreferrer">{publicUrl.replace(/^https?:\/\//, "")}</a>
                                ) : (
                                    <span>{publicUrl.replace(/^https?:\/\//, "")} (disponível ao publicar)</span>
                                )}
                            </dd>
                        </div>
                    </dl>

                    {canEdit && (status === "draft" || status === "changes") && (
                        <Button variant="primary" icon="solar:upload-minimalistic-linear" loading={publishing === "publish"} onClick={() => publish()}>
                            {status === "draft" ? "Publicar página" : "Publicar alterações"}
                        </Button>
                    )}
                    <Button variant="ghost" icon="solar:settings-linear" onClick={() => navigate("/studio/configuracoes")}>
                        Título, descrição e compartilhamento
                    </Button>
                </section>
            </div>

            {canEdit && (
                <section className="std-grid" aria-labelledby="std-change-title">
                    <div className="std-panel__head">
                        <div>
                            <h2 id="std-change-title" className="std-section-title">Trocar de modelo</h2>
                            <p className="std-hint">Modelo atual: {TEMPLATES.find((item) => item.id === draftPage.template)?.name || "personalizado"}.</p>
                        </div>
                        <Segmented
                            label="Como trocar"
                            value={changeMode}
                            onChange={setChangeMode}
                            options={[
                                { value: "look", label: "Só o visual" },
                                { value: "fresh", label: "Recomeçar" }
                            ]}
                        />
                    </div>
                    <p className="std-hint">
                        {changeMode === "look"
                            ? "Mantém suas seções e textos e aplica paleta, tipografia e cantos do novo modelo."
                            : "Substitui o rascunho pela composição do novo modelo. A versão publicada não muda até você publicar de novo."}
                    </p>
                    <TemplateGallery
                        bundle={bundle}
                        current={draftPage.template}
                        busy={busy}
                        onChoose={(id) => (changeMode === "fresh" ? setConfirm(id) : changeTemplate(id))}
                    />
                </section>
            )}

            <ConfirmDialog
                open={!!confirm}
                title="Recomeçar com outro modelo?"
                message="As seções e textos do rascunho atual serão substituídos. A página publicada continua igual até você publicar de novo."
                confirmLabel="Recomeçar"
                loading={!!busy}
                onConfirm={() => changeTemplate(confirm)}
                onClose={() => setConfirm(null)}
            />
        </div>
    );
};

export default MySite;
