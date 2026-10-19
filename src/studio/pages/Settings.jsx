import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import { useStudio, STATUS_META } from "../StudioContext";
import { deleteDraft, saveDraft } from "../data/studioApi";
import { usePublish } from "../usePublish";
import { ImageField } from "../editor/fields";
import { useTheme } from "../../theme/ThemeContext";
import { Badge, Button, ConfirmDialog, Field, Segmented, copyText, useToast } from "../../design-system/components";
import { PageHead } from "./shared";

/* =========================================================
   CONFIGURAÇÕES

   Título e descrição para buscadores e compartilhamento,
   estado de publicação, endereço da página e preferências
   do Studio. Domínio próprio NÃO aparece: a infraestrutura
   atual publica só em /s/{handle}.
========================================================= */

const Settings = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const notify = useToast();

    const { handle, user, bundle, draftPage, publishedPage, status, publicUrl, canEdit } = useStudio();
    const { publish, unpublish, busy } = usePublish();
    const theme = useTheme();

    const [seo, setSeo] = useState({ title: "", description: "", image: "" });
    const [saving, setSaving] = useState(false);
    const [confirm, setConfirm] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const baseSeo = draftPage?.seo;
    const baseKey = JSON.stringify(baseSeo || {});

    useEffect(() => {
        if (baseSeo) setSeo(baseSeo);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [baseKey]);

    useEffect(() => {
        if (!location.hash) return;
        const node = document.getElementById(location.hash.slice(1));
        if (node) setTimeout(() => node.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    }, [location.hash]);

    const dirty = baseSeo && JSON.stringify(seo) !== baseKey;
    const meta = STATUS_META[status];

    const saveSeo = async () => {
        setSaving(true);
        try {
            await saveDraft(handle, { ...draftPage, seo: { title: seo.title.trim(), description: seo.description.trim(), image: seo.image } }, user?.uid);
            notify("success", "Informações salvas", publishedPage ? "Publique para levar a mudança ao ar." : "Elas entram no ar quando você publicar.");
        } catch {
            notify("error", "Não foi possível salvar", "Tente de novo.");
        } finally {
            setSaving(false);
        }
    };

    const removePage = async () => {
        setDeleting(true);
        try {
            if (publishedPage) await unpublish();
            await deleteDraft(handle);
            notify("success", "Página apagada", "Você pode criar outra quando quiser.");
            setConfirm(null);
            navigate("/studio/site");
        } catch {
            notify("error", "Não foi possível apagar", "Tente de novo.");
        } finally {
            setDeleting(false);
        }
    };

    const title = seo.title || bundle?.name || "";
    const description = seo.description || "";

    return (
        <div className="std-page">
            <PageHead title="Configurações" description="Como sua página aparece no Google e ao ser compartilhada, e o que está no ar." />

            <section className="std-panel std-card" id="publicacao" aria-labelledby="std-st-pub">
                <div className="std-panel__head">
                    <div>
                        <h2 id="std-st-pub">Publicação</h2>
                        <p>{meta.text}</p>
                    </div>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                </div>

                <div className="std-link std-link--block">
                    <Icon icon="solar:global-linear" aria-hidden="true" />
                    <span>{publicUrl.replace(/^https?:\/\//, "")}</span>
                    <Button
                        variant="ghost"
                        size="sm"
                        icon="solar:copy-linear"
                        aria-label="Copiar link"
                        onClick={async () => {
                            const ok = await copyText(publicUrl);
                            notify(ok ? "success" : "error", ok ? "Link copiado" : "Não foi possível copiar", "");
                        }}
                    />
                </div>
                <p className="std-hint">Este é o endereço da sua página. Ele usa o nome de usuário da empresa na Markfy.</p>

                {canEdit && draftPage && (
                    <div className="std-card__footer std-card__footer--start">
                        {(status === "draft" || status === "changes") && (
                            <Button variant="primary" icon="solar:upload-minimalistic-linear" loading={busy === "publish"} onClick={() => publish()}>
                                {status === "draft" ? "Publicar página" : "Publicar alterações"}
                            </Button>
                        )}
                        {publishedPage && (
                            <Button variant="outline" icon="solar:eye-closed-linear" onClick={() => setConfirm("unpublish")}>
                                Tirar do ar
                            </Button>
                        )}
                    </div>
                )}
            </section>

            <section className="std-panel std-card" id="seo" aria-labelledby="std-st-seo">
                <div className="std-panel__head">
                    <div>
                        <h2 id="std-st-seo">Google e compartilhamento</h2>
                        <p>O título e a descrição que aparecem nos resultados de busca e quando alguém envia o seu link.</p>
                    </div>
                </div>

                {!draftPage ? (
                    <p className="std-hint">Crie sua página primeiro, em Meu site.</p>
                ) : (
                    <div className="std-grid std-grid--main">
                        <fieldset className="std-fieldset std-grid" disabled={!canEdit}>
                            <Field label="Título da página" count={seo.title.length} max={60} hint="Até 60 caracteres. Nome da empresa e o que ela faz funcionam bem.">
                                <input className="mk-input" maxLength={60} value={seo.title} onChange={(event) => setSeo({ ...seo, title: event.target.value })} />
                            </Field>
                            <Field label="Descrição" count={seo.description.length} max={160} hint="Até 160 caracteres. Diga o principal serviço e a cidade.">
                                <textarea className="mk-textarea" rows={3} maxLength={160} value={seo.description} onChange={(event) => setSeo({ ...seo, description: event.target.value })} />
                            </Field>
                            <ImageField label="Imagem de compartilhamento" value={seo.image} onChange={(image) => setSeo({ ...seo, image })} ctx={{ handle, bundle }} />
                            {dirty && (
                                <div className="std-card__footer std-card__footer--start">
                                    <Button variant="primary" loading={saving} onClick={saveSeo}>Salvar</Button>
                                    <Button variant="ghost" onClick={() => setSeo(baseSeo)}>Descartar</Button>
                                </div>
                            )}
                        </fieldset>

                        <div className="std-grid">
                            <div className="std-serp" aria-label="Prévia no Google">
                                <span className="std-serp__url">{publicUrl.replace(/^https?:\/\//, "")}</span>
                                <span className="std-serp__title">{title}</span>
                                <span className="std-serp__desc">{description || "Escreva uma descrição para aparecer aqui."}</span>
                            </div>
                            <div className="std-share" aria-label="Prévia do link compartilhado">
                                <span className="std-share__img">
                                    {seo.image ? <img src={seo.image} alt="" /> : <Icon icon="solar:gallery-linear" aria-hidden="true" />}
                                </span>
                                <span className="std-share__text">
                                    <strong>{title}</strong>
                                    <span>{description}</span>
                                </span>
                            </div>
                            <p className="std-hint">
                                A página é montada no navegador. Buscadores como o Google leem esses dados normalmente; alguns aplicativos de mensagem podem mostrar só o título padrão até a Markfy oferecer pré-renderização.
                            </p>
                        </div>
                    </div>
                )}
            </section>

            <section className="std-panel std-card" aria-labelledby="std-st-look">
                <div className="std-panel__head">
                    <div>
                        <h2 id="std-st-look">Aparência do Studio</h2>
                        <p>Só muda a interface do Studio e da Markfy neste aparelho. Sua página tem cores próprias.</p>
                    </div>
                </div>
                <Segmented
                    label="Tema"
                    value={theme?.theme || "system"}
                    onChange={(value) => theme?.setTheme?.(value)}
                    options={[
                        { value: "light", label: "Claro", icon: "solar:sun-2-linear" },
                        { value: "dark", label: "Escuro", icon: "solar:moon-linear" },
                        { value: "system", label: "Automático", icon: "solar:monitor-linear" }
                    ]}
                />
            </section>

            {canEdit && draftPage && (
                <section className="std-panel std-card std-danger" aria-labelledby="std-st-danger">
                    <div className="std-panel__head">
                        <div>
                            <h2 id="std-st-danger">Apagar página</h2>
                            <p>Remove o rascunho e tira a página do ar. Os dados da empresa, os contatos e as métricas continuam.</p>
                        </div>
                        <Button variant="danger" icon="solar:trash-bin-minimalistic-linear" onClick={() => setConfirm("delete")}>
                            Apagar página
                        </Button>
                    </div>
                </section>
            )}

            <ConfirmDialog
                open={confirm === "unpublish"}
                title="Tirar a página do ar?"
                message="O link deixa de funcionar para os visitantes. Seu rascunho continua salvo e você pode publicar de novo quando quiser."
                confirmLabel="Tirar do ar"
                loading={busy === "unpublish"}
                onConfirm={async () => {
                    if (await unpublish()) setConfirm(null);
                }}
                onClose={() => setConfirm(null)}
            />

            <ConfirmDialog
                open={confirm === "delete"}
                title="Apagar a página?"
                message="O rascunho será apagado e a página sairá do ar. Isso não pode ser desfeito."
                confirmLabel="Apagar"
                loading={deleting}
                onConfirm={removePage}
                onClose={() => setConfirm(null)}
            />
        </div>
    );
};

export default Settings;
