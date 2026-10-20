import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";

import { Button, Field, Segmented, cx } from "../../design-system/components";
import { clean } from "../engine/util.js";
import { useMenus, useNow } from "../MenusContext.jsx";
import { ensureFonts } from "../site/fonts.js";
import { buildBoard, DISPLAY_DEFAULTS, sampleOrders, withDisplayDefaults } from "../display/board.js";
import DisplayBoard, { Stage } from "../display/DisplayBoard.jsx";
import { DISPLAY_TEMPLATES } from "../display/templates.js";
import { announce, chime, unlockAudio } from "../display/sound.js";
import { PageHead, Panel, Toggle } from "../ui.jsx";

/* =========================================================
   MONITOR DE RETIRADA — CONFIGURAÇÃO (/menus/senhas)

   Escolher o modelo, os textos e o que entra na tela, com
   prévia ao vivo. A TV abre em /menus/senhas/tv.
   Grava em menusSettings/{handle}/display (público por
   natureza: nada sigiloso aqui).
========================================================= */

const READY_MINUTES = [5, 10, 15, 20, 30];

const CHANNEL_OPTIONS = [
    { id: "pickup", label: "Retirada", hint: "Pedidos do cardápio digital para retirar" },
    { id: "counter", label: "Balcão", hint: "Pedidos lançados no PDV / balcão" },
    { id: "table", label: "Mesa", hint: "Útil em praça de alimentação com senha" },
    { id: "delivery", label: "Delivery", hint: "Mostra para o entregador o que já está pronto" }
];

const company = (settings, site, draft) => ({
    name: settings.profile?.name || "",
    logo: site?.design?.images?.logo || draft?.design?.images?.logo || null
});

export default function PickupDisplay() {
    const { settings, site, draft, orders, source, handle, path, can, notify, demo } = useMenus();
    const now = useNow(10000);
    const canEdit = can("settings.edit");

    const saved = useMemo(() => withDisplayDefaults(settings.display), [settings.display]);
    const [form, setForm] = useState(saved);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!dirty) setForm(saved);
    }, [saved, dirty]);

    useEffect(() => {
        ensureFonts(DISPLAY_TEMPLATES.flatMap((template) => [template.fonts.heading, template.fonts.body]));
    }, []);

    const set = (patch) => {
        setForm((current) => ({ ...current, ...patch }));
        setDirty(true);
    };

    const live = buildBoard(orders, form, now);
    const usingSample = !live.preparing.length && !live.ready.length;
    const preview = usingSample ? buildBoard(sampleOrders(now), form, now) : live;
    const samples = useMemo(() => sampleOrders(now), [now]);

    const brand = company(settings, site, draft);
    const brandColor = site?.design?.theme?.colors?.primary || draft?.design?.theme?.colors?.primary || null;
    const tvUrl = `${window.location.origin}${path("senhas/tv")}`;

    const save = async () => {
        setBusy(true);
        try {
            await source.update({ [`menusSettings/${handle}/display`]: clean(form) });
            setDirty(false);
            notify("success", "Monitor salvo", "A TV atualiza sozinha em alguns segundos.");
        } catch (error) {
            notify("error", "Não foi possível salvar", error.message);
        } finally {
            setBusy(false);
        }
    };

    const copyUrl = async () => {
        try {
            await navigator.clipboard.writeText(tvUrl);
            notify("success", "Endereço copiado");
        } catch {
            notify("info", "Copie o endereço", tvUrl);
        }
    };

    const testSound = () => {
        unlockAudio();
        if (form.sound) chime();
        if (form.voice) announce({ code: "042", name: form.showNames ? "Ana" : "" });
        if (!form.sound && !form.voice) notify("info", "Som e voz estão desligados");
    };

    return (
        <div className="std-page mnu-display">
            <PageHead
                eyebrow="Painel de senhas"
                title="Monitor de retirada"
                description="Uma TV no salão mostra quais pedidos estão em preparo e quais já podem ser retirados, com som e destaque a cada pedido pronto."
                actions={(
                    <>
                        <Button variant="secondary" icon="solar:tv-linear" onClick={() => window.open(path("senhas/tv"), "_blank", "noopener")}>Abrir na TV</Button>
                        {canEdit && (
                            <Button variant="primary" loading={busy} disabled={!dirty} onClick={save}>
                                {dirty ? "Salvar alterações" : "Salvo"}
                            </Button>
                        )}
                    </>
                )}
            />

            <section className="mnu-display__preview" aria-label="Prévia do monitor">
                <div className={cx("mnu-display__screen", form.orientation === "portrait" && "is-portrait")}>
                    <Stage orientation={form.orientation}>
                        <DisplayBoard board={preview} company={brand} now={now} brandColor={brandColor} />
                    </Stage>
                </div>
                <p className="mk-muted">
                    {usingSample
                        ? "Prévia com pedidos de exemplo: ainda não há pedidos em andamento nos canais escolhidos."
                        : `Prévia ao vivo: ${live.preparing.length} em preparo e ${live.ready.length} pronto(s) agora.`}
                    {demo && " Na TV da demonstração, os pedidos andam sozinhos."}
                </p>
            </section>

            <Panel title="Modelo" description="Escolha o visual que combina com a casa. Todos mostram as mesmas informações, com letras grandes para ler de longe.">
                <div className="mnu-display__gallery" role="radiogroup" aria-label="Modelo do monitor">
                    {DISPLAY_TEMPLATES.map((template) => {
                        const on = form.template === template.id;
                        return (
                            <button
                                key={template.id}
                                type="button"
                                role="radio"
                                aria-checked={on}
                                disabled={!canEdit}
                                className={cx("mnu-display__card", on && "is-on")}
                                onClick={() => set({ template: template.id })}
                            >
                                <span className="mnu-display__thumb">
                                    <Stage>
                                        <DisplayBoard
                                            board={buildBoard(samples, { ...form, template: template.id, orientation: "landscape" }, now)}
                                            company={brand}
                                            now={now}
                                            brandColor={brandColor}
                                        />
                                    </Stage>
                                </span>
                                <span className="mnu-display__meta">
                                    <b>{template.name}</b>
                                    <em>{template.mood}</em>
                                    {on && <Icon className="mnu-display__check" icon="solar:check-circle-bold" aria-label="Escolhido" />}
                                </span>
                                <small>{template.description}</small>
                            </button>
                        );
                    })}
                </div>
            </Panel>

            <div className="std-grid std-grid--2">
                <Panel title="Textos da tela">
                    <div className="mnu-form">
                        <Field label="Título" count={form.title.length} max={40}>
                            <input className="mk-input" value={form.title} maxLength={40} disabled={!canEdit} onChange={(event) => set({ title: event.target.value })} placeholder={DISPLAY_DEFAULTS.title} />
                        </Field>
                        <Field label="Coluna de preparo" count={form.preparingLabel.length} max={24}>
                            <input className="mk-input" value={form.preparingLabel} maxLength={24} disabled={!canEdit} onChange={(event) => set({ preparingLabel: event.target.value })} placeholder={DISPLAY_DEFAULTS.preparingLabel} />
                        </Field>
                        <Field label="Coluna de prontos" count={form.readyLabel.length} max={28}>
                            <input className="mk-input" value={form.readyLabel} maxLength={28} disabled={!canEdit} onChange={(event) => set({ readyLabel: event.target.value })} placeholder={DISPLAY_DEFAULTS.readyLabel} />
                        </Field>
                        <Field label="Mensagem no rodapé" hint="Passa devagar no pé da tela. Bom para promoção do dia, Wi-Fi ou Instagram. Deixe vazio para não mostrar." count={form.message.length} max={140}>
                            <input className="mk-input" value={form.message} maxLength={140} disabled={!canEdit} onChange={(event) => set({ message: event.target.value })} />
                        </Field>
                    </div>
                </Panel>

                <Panel title="O que aparece">
                    <div className="mnu-form">
                        <div className="mnu-display__channels">
                            <span className="mk-field__label">Pedidos destes canais</span>
                            {CHANNEL_OPTIONS.map((channel) => (
                                <Toggle
                                    key={channel.id}
                                    label={channel.label}
                                    hint={channel.hint}
                                    checked={form.channels[channel.id] === true}
                                    disabled={!canEdit}
                                    onChange={(value) => set({ channels: { ...form.channels, [channel.id]: value } })}
                                />
                            ))}
                        </div>
                        <Toggle label="Mostrar o primeiro nome" hint="Só o primeiro nome do cliente, nunca sobrenome ou telefone." checked={form.showNames} disabled={!canEdit} onChange={(value) => set({ showNames: value })} />
                        <Toggle label="Mostrar pedidos ainda não confirmados" hint="Aparecem mais claros na coluna de preparo, para o cliente saber que o pedido entrou." checked={form.showReceived} disabled={!canEdit} onChange={(value) => set({ showReceived: value })} />
                        <Field label="Quanto tempo um pedido pronto fica na tela" hint="Ao marcar como entregue ou retirado ele sai na hora.">
                            <select className="mk-select" value={form.readyMinutes} disabled={!canEdit} onChange={(event) => set({ readyMinutes: Number(event.target.value) })}>
                                {READY_MINUTES.map((minutes) => <option key={minutes} value={minutes}>{minutes} minutos</option>)}
                            </select>
                        </Field>
                    </div>
                </Panel>

                <Panel title="Som e aparência">
                    <div className="mnu-form">
                        <Toggle label="Tocar um sino a cada pedido pronto" checked={form.sound} disabled={!canEdit} onChange={(value) => set({ sound: value })} />
                        <Toggle label="Chamar o pedido em voz alta" hint="“Pedido 42, Ana. Pode retirar.” Usa a voz do aparelho da TV." checked={form.voice} disabled={!canEdit} onChange={(value) => set({ voice: value })} />
                        <div>
                            <Button size="sm" variant="ghost" icon="solar:volume-loud-linear" onClick={testSound}>Testar som neste aparelho</Button>
                        </div>
                        <Toggle
                            label="Usar a cor do meu cardápio"
                            hint={brandColor ? "Troca a cor de destaque do modelo pela cor principal do seu cardápio." : "Publique o cardápio para usar a cor dele aqui."}
                            checked={form.useBrandColor}
                            disabled={!canEdit || !brandColor}
                            onChange={(value) => set({ useBrandColor: value })}
                        />
                        <Segmented
                            label="Posição da TV"
                            value={form.orientation}
                            onChange={(value) => canEdit && set({ orientation: value })}
                            options={[
                                { value: "landscape", label: "Deitada" },
                                { value: "portrait", label: "Em pé" }
                            ]}
                        />
                    </div>
                </Panel>

                <Panel title="Como colocar na TV">
                    <ol className="mnu-display__steps">
                        <li><b>Ligue um navegador na TV.</b> Smart TV, Fire TV Stick, Chromecast com Google TV ou um computador ligado no HDMI.</li>
                        <li><b>Entre com uma conta da equipe</b> que possa ver os pedidos (por exemplo, a da cozinha).</li>
                        <li>
                            <b>Abra este endereço:</b>
                            <span className="mnu-display__url">
                                <code>{tvUrl}</code>
                                <Button size="sm" variant="ghost" icon="solar:copy-linear" onClick={copyUrl}>Copiar</Button>
                            </span>
                        </li>
                        <li><b>Toque em “Iniciar monitor”.</b> A tela fica cheia, acesa e se atualiza sozinha. Mudanças salvas aqui chegam na TV em segundos.</li>
                    </ol>
                </Panel>
            </div>
        </div>
    );
}
