import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";

import { Badge, Button, ConfirmDialog, Field, copyText } from "../../design-system/components";
import { slugProblem, suggestSlug } from "../engine/design.js";
import { useMenus } from "../MenusContext.jsx";
import { listTables } from "../data/selectors.js";
import QrImage from "../../qr/QrImage";
import { openPrint } from "../components/receipt.js";
import { LockedFeature, PageHead, Panel, dateTimeLabel } from "../ui.jsx";
import { LOCKED } from "../locked.js";

/* =========================================================
   PUBLICAÇÃO, ENDEREÇO E QR CODES

   Publicar copia o RASCUNHO SALVO para a versão pública, no
   servidor (que também confere o plano e reserva o endereço).
   O endereço /m/{nome} é único: dois estabelecimentos nunca
   ficam com o mesmo.
========================================================= */

const qrPng = (value, size = 900) => QRCode.toDataURL(value, { width: size, margin: 2, errorCorrectionLevel: "M", color: { dark: "#0b0d1a", light: "#ffffff" } });

/* Nome de mesa e da empresa vêm do banco: escapa antes de
   montar o HTML da folha de impressão. */
const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

export default function Publish() {
    const navigate = useNavigate();
    const { site, draft, settings, source, handle, act, can, floor, features, notify, demo, path } = useMenus();

    const [slug, setSlug] = useState(settings.slug || suggestSlug(settings.profile?.name, handle));
    const [slugState, setSlugState] = useState({ checking: false, message: "" });
    const [busy, setBusy] = useState(null);
    const [confirm, setConfirm] = useState(false);

    useEffect(() => {
        if (settings.slug) setSlug(settings.slug);
    }, [settings.slug]);

    const publicUrl = site?.slug ? `${window.location.origin}/m/${site.slug}` : null;
    const pending = site?.publishedAt && (draft?.updatedAt || 0) > (site.publishedAt || 0) + 1500;
    const tables = listTables(floor);

    const checkSlug = async (value) => {
        const problem = slugProblem(value, handle);
        if (problem) {
            setSlugState({ checking: false, message: problem, ok: false });
            return false;
        }
        setSlugState({ checking: true, message: "" });
        const owner = await source.get(`menusSlugs/${value}`).catch(() => null);
        const ok = !owner || owner === handle;
        setSlugState({ checking: false, ok, message: ok ? "Endereço disponível." : "Este endereço já é usado por outro estabelecimento." });
        return ok;
    };

    const saveSlug = async () => {
        if (!(await checkSlug(slug))) return;
        setBusy("slug");
        try {
            await source.update({ [`menusSettings/${handle}/slug`]: slug });
            notify("success", "Endereço salvo", site?.publishedAt ? "Publique de novo para o novo endereço entrar no ar." : "Ele entra no ar na publicação.");
        } catch (error) {
            notify("error", "Não foi possível salvar", error.message);
        } finally {
            setBusy(null);
        }
    };

    const publish = async () => {
        setBusy("publish");
        try {
            if (!settings.slug) {
                if (!(await checkSlug(slug))) return;
                await source.update({ [`menusSettings/${handle}/slug`]: slug });
            }
            if (!draft?.design) {
                notify("info", "Abra o editor", "Escolha um modelo no editor visual antes de publicar.");
                return;
            }
            const result = await act("design.publish", {}, { success: "Cardápio publicado" });
            if (result?.downgraded) notify("info", "Publicado com o padrão do plano", "Ajustes avançados não incluídos no plano ficaram no padrão do modelo.");
        } catch {
            /* aviso já exibido */
        } finally {
            setBusy(null);
        }
    };

    const download = async (value, name) => {
        const url = await qrPng(value);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${name}.png`;
        link.click();
    };

    const printTables = async () => {
        if (!site?.slug) return;
        const cards = await Promise.all(
            tables.filter((table) => !table.disabled).map(async (table) => {
                const url = `${window.location.origin}/m/${site.slug}?mesa=${table.id}`;
                const png = await qrPng(url, 420);
                return `<div class="q"><img src="${png}" alt=""><b>${escapeHtml(table.label)}</b><small>Aponte a câmera para ver o cardápio</small></div>`;
            })
        );
        openPrint(
            "QR Codes das mesas",
            `<style>body{width:auto}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}.q{border:1px dashed #999;padding:12px;text-align:center;break-inside:avoid}.q img{width:100%;max-width:200px}.q b{display:block;font-size:18px;margin-top:6px}.q small{color:#555}</style><h1>${escapeHtml(settings.profile?.name)}</h1><div class="g">${cards.join("")}</div>`
        );
    };

    return (
        <div className="std-page">
            <PageHead
                title="Publicação e QR Codes"
                description="Endereço público do cardápio, publicação e códigos para imprimir."
                actions={(
                    <>
                        <Button variant="outline" icon="solar:pallete-2-linear" onClick={() => navigate(path("editor"))}>Editor visual</Button>
                        {can("design.publish") && <Button variant="primary" icon="solar:upload-linear" loading={busy === "publish"} onClick={publish}>{site?.publishedAt ? "Publicar alterações" : "Publicar cardápio"}</Button>}
                    </>
                )}
            />

            <div className="std-grid std-grid--main">
                <div className="std-grid">
                    <Panel title="Situação">
                        <div className="mnu-pubstate">
                            {site?.publishedAt ? (
                                <>
                                    <Badge tone={pending ? "info" : "success"}>{pending ? "Há alterações não publicadas" : "Publicado"}</Badge>
                                    <span className="mk-muted">Última publicação: {dateTimeLabel(site.publishedAt)}</span>
                                </>
                            ) : (
                                <Badge tone="warning">Ainda não publicado</Badge>
                            )}
                        </div>
                        {publicUrl && (
                            <div className="mnu-linkbox">
                                <code>{publicUrl}</code>
                                <span className="mnu-row">
                                    <Button size="sm" icon="solar:copy-linear" onClick={async () => { const ok = await copyText(publicUrl); notify(ok ? "success" : "error", ok ? "Link copiado" : "Não foi possível copiar"); }}>Copiar</Button>
                                    {demo ? (
                                        <Button size="sm" variant="outline" icon="solar:eye-linear" onClick={() => navigate(path("cliente"))}>Ver como cliente</Button>
                                    ) : (
                                        <Button size="sm" variant="outline" icon="solar:arrow-right-up-linear" as="a" href={publicUrl} target="_blank" rel="noopener noreferrer">Abrir</Button>
                                    )}
                                </span>
                            </div>
                        )}
                        {site?.publishedAt && can("design.publish") && (
                            <Button variant="ghost" size="sm" onClick={() => setConfirm(true)}>Tirar do ar</Button>
                        )}
                    </Panel>

                    <Panel title="Endereço público" description="Curto e fácil de ditar por telefone.">
                        <Field label="Endereço" hint={slugState.message || "Letras minúsculas, números e hífens."} error={slugState.ok === false ? slugState.message : undefined}>
                            <div className="mnu-slug">
                                <span>{window.location.host}/m/</span>
                                <input
                                    className="mk-input"
                                    value={slug}
                                    maxLength={40}
                                    disabled={!can("settings.edit")}
                                    onChange={(event) => {
                                        setSlug(event.target.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 40));
                                        setSlugState({ checking: false, message: "" });
                                    }}
                                    onBlur={() => slug && checkSlug(slug)}
                                />
                            </div>
                        </Field>
                        {can("settings.edit") && (
                            <Button size="sm" variant="outline" loading={busy === "slug" || slugState.checking} disabled={slug === settings.slug} onClick={saveSlug}>Salvar endereço</Button>
                        )}
                    </Panel>

                    <Panel title="Domínio próprio">
                        {features.menusCustomDomain ? (
                            <>
                                <p className="mk-muted">
                                    Para usar um endereço como <b>cardapio.seurestaurante.com.br</b>, a equipe Markfy configura o domínio com você
                                    (é preciso acesso ao painel de DNS do domínio). O link /m/ e os QR Codes continuam valendo.
                                </p>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={demo || Boolean(settings.integrationRequests?.customDomain)}
                                    onClick={() => source.set(`menusSettings/${handle}/integrationRequests/customDomain`, { at: Date.now() }).then(() => notify("success", "Pedido registrado", "A equipe Markfy entra em contato para configurar."))}
                                >
                                    {settings.integrationRequests?.customDomain ? "Configuração solicitada" : "Solicitar configuração"}
                                </Button>
                            </>
                        ) : (
                            <LockedFeature {...LOCKED.menusCustomDomain} />
                        )}
                    </Panel>
                </div>

                <div className="std-grid">
                    <Panel title="QR Code do cardápio" description="Para mesas, balcão, vitrine, panfletos e redes sociais.">
                        {publicUrl ? (
                            <div className="mnu-qr">
                                <QrImage value={publicUrl} size={200} />
                                <Button size="sm" icon="solar:download-minimalistic-linear" onClick={() => download(publicUrl, `qr-cardapio-${site.slug}`)}>Baixar PNG</Button>
                            </div>
                        ) : (
                            <p className="mk-muted">O QR Code aparece depois da primeira publicação.</p>
                        )}
                    </Panel>

                    {features.menusTables && (
                        <Panel title="QR Code por mesa" description="Abre o cardápio já identificando a mesa (chamar garçom, pedir a conta e, se ativado, pedir pela mesa).">
                            {!publicUrl ? (
                                <p className="mk-muted">Publique o cardápio para gerar os códigos das mesas.</p>
                            ) : !tables.length ? (
                                <p className="mk-muted">Cadastre as mesas em Mesas e comandas.</p>
                            ) : (
                                <>
                                    <Button size="sm" variant="primary" icon="solar:printer-minimalistic-linear" onClick={printTables}>Imprimir todos ({tables.filter((table) => !table.disabled).length})</Button>
                                    <ul className="mnu-qrlist">
                                        {tables.slice(0, 60).map((table) => {
                                            const url = `${publicUrl}?mesa=${table.id}`;
                                            return (
                                                <li key={table.id}>
                                                    <b>{table.label}</b>
                                                    <Button size="sm" variant="ghost" icon="solar:download-minimalistic-linear" aria-label={`Baixar QR da ${table.label}`} onClick={() => download(url, `qr-${table.label.replace(/\s+/g, "-").toLowerCase()}`)} />
                                                    {demo && <Button size="sm" variant="ghost" icon="solar:eye-linear" aria-label={`Abrir como cliente da ${table.label}`} onClick={() => navigate(`${path("cliente")}?mesa=${table.id}`)} />}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </>
                            )}
                        </Panel>
                    )}
                </div>
            </div>

            <ConfirmDialog
                open={confirm}
                title="Tirar o cardápio do ar?"
                message="O link e os QR Codes passam a mostrar “cardápio indisponível”. Nada é apagado: publique de novo quando quiser."
                confirmLabel="Tirar do ar"
                onClose={() => setConfirm(false)}
                onConfirm={async () => {
                    await act("design.unpublish", {}, { success: "Cardápio fora do ar" }).catch(() => null);
                    setConfirm(false);
                }}
            />
        </div>
    );
}
