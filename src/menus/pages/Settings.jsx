import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@iconify/react";

import { Button, Field, Segmented } from "../../design-system/components";
import { DAY_IDS, DAY_LABELS, DEFAULT_TZ, fromBookingsHours } from "../engine/hours.js";
import { PAYMENT_METHODS } from "../engine/orders.js";
import { clean, pushId } from "../engine/util.js";
import { useMenus } from "../MenusContext.jsx";
import { loadCompanyBundle } from "../../studio/data/companyBundle";
import { MoneyInput, PageHead, Panel, Toggle } from "../ui.jsx";

/* =========================================================
   CONFIGURAÇÕES DA EMPRESA E DA OPERAÇÃO

   Tudo em menusSettings/{handle} — dados que o cardápio
   público precisa ler (por isso nada sigiloso mora aqui).
   Salvar mostra o resultado; sair com alteração pendente
   avisa antes.
========================================================= */

const SECTIONS = [
    { id: "empresa", label: "Empresa", icon: "solar:shop-2-linear" },
    { id: "horarios", label: "Horários", icon: "solar:clock-circle-linear" },
    { id: "pedidos", label: "Pedidos e entrega", icon: "solar:scooter-linear" },
    { id: "pagamentos", label: "Pagamentos", icon: "solar:wallet-money-linear" },
    { id: "mesas", label: "Mesas e QR", icon: "solar:armchair-2-linear" },
    { id: "notificacoes", label: "Notificações", icon: "solar:bell-linear" }
];

const TIMEZONES = ["America/Sao_Paulo", "America/Manaus", "America/Cuiaba", "America/Belem", "America/Fortaleza", "America/Recife", "America/Bahia", "America/Porto_Velho", "America/Rio_Branco", "America/Noronha"];

const HoursEditor = ({ hours, onChange }) => (
    <div className="mnu-hours-editor">
        {DAY_IDS.map((id) => {
            const day = hours?.[id] || { enabled: false, ranges: [] };
            const ranges = Array.isArray(day.ranges) ? day.ranges : Object.values(day.ranges || {});
            const set = (patch) => onChange({ ...(hours || {}), [id]: { ...day, ranges, ...patch } });
            return (
                <div key={id} className="mnu-day">
                    <label className="mnu-check">
                        <input type="checkbox" checked={day.enabled !== false && ranges.length > 0} onChange={(event) => set(event.target.checked ? { enabled: true, ranges: ranges.length ? ranges : [{ from: "11:00", to: "22:00" }] } : { enabled: false })} />
                        <span><b>{DAY_LABELS[id]}</b></span>
                    </label>
                    <div className="mnu-day__ranges">
                        {day.enabled !== false && ranges.map((range, index) => (
                            <span key={index} className="mnu-range">
                                <input className="mk-input" type="time" value={range.from} aria-label={`${DAY_LABELS[id]}: abre`} onChange={(event) => set({ ranges: ranges.map((item, i) => (i === index ? { ...item, from: event.target.value } : item)) })} />
                                <span aria-hidden="true">–</span>
                                <input className="mk-input" type="time" value={range.to} aria-label={`${DAY_LABELS[id]}: fecha`} onChange={(event) => set({ ranges: ranges.map((item, i) => (i === index ? { ...item, to: event.target.value } : item)) })} />
                                <Button size="sm" variant="ghost" icon="solar:close-circle-linear" aria-label="Remover faixa" onClick={() => set({ ranges: ranges.filter((_, i) => i !== index) })} />
                            </span>
                        ))}
                        {day.enabled !== false && ranges.length > 0 && ranges.length < 3 && (
                            <Button size="sm" variant="ghost" icon="solar:add-circle-linear" onClick={() => set({ ranges: [...ranges, { from: "18:00", to: "23:00" }] })}>Faixa</Button>
                        )}
                        {(day.enabled === false || !ranges.length) && <span className="mk-muted">Fechado</span>}
                    </div>
                </div>
            );
        })}
        <p className="mk-muted">Fecha depois da meia-noite? Use, por exemplo, 18:00 – 02:00.</p>
    </div>
);

export default function Settings() {
    const { section = "empresa" } = useParams();
    const navigate = useNavigate();
    const { settings, source, handle, path, features, notify, demo } = useMenus();

    const [form, setForm] = useState(settings);
    const [dirty, setDirty] = useState(false);
    const [busy, setBusy] = useState(false);
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        if (!dirty) setForm(settings);
    }, [settings, dirty]);

    useEffect(() => {
        const onLeave = (event) => {
            if (!dirty) return;
            event.preventDefault();
            event.returnValue = "";
        };
        window.addEventListener("beforeunload", onLeave);
        return () => window.removeEventListener("beforeunload", onLeave);
    }, [dirty]);

    const set = (key, value) => {
        setForm((current) => ({ ...current, [key]: value }));
        setDirty(true);
    };
    const setIn = (key, patch) => set(key, { ...(form[key] || {}), ...patch });

    const save = async () => {
        setBusy(true);
        try {
            const { onboarding, slug, integrationRequests, ...rest } = form;
            const patch = {};
            Object.entries(rest).forEach(([key, value]) => {
                if (key !== "id") patch[`menusSettings/${handle}/${key}`] = clean(value);
            });
            await source.update(patch);
            setDirty(false);
            notify("success", "Configurações salvas");
        } catch (error) {
            notify("error", "Não foi possível salvar", error.message);
        } finally {
            setBusy(false);
        }
    };

    const importFromCompany = async () => {
        setImporting(true);
        try {
            const bundle = await loadCompanyBundle(handle, { fresh: true });
            if (!bundle) throw new Error("Não encontramos os dados da empresa.");
            setForm((current) => ({
                ...current,
                profile: { ...(current.profile || {}), name: current.profile?.name || bundle.name, description: current.profile?.description || bundle.description },
                contact: { ...(current.contact || {}), whatsapp: current.contact?.whatsapp || bundle.whatsapp || "", phone: current.contact?.phone || bundle.phone || "", instagram: current.contact?.instagram || bundle.socials?.find((s) => s.id === "instagram")?.handle || "" },
                address: { ...(current.address || {}), text: current.address?.text || bundle.address || "" },
                hours: current.hours && Object.keys(current.hours).length ? current.hours : fromBookingsHours(bundle.businessHours) || current.hours
            }));
            setDirty(true);
            notify("info", "Dados trazidos da empresa", "Confira e salve.");
        } catch (error) {
            notify("error", "Não foi possível importar", error.message);
        } finally {
            setImporting(false);
        }
    };

    const delivery = form.fulfillment?.delivery || {};
    const zones = Array.isArray(delivery.zones) ? delivery.zones : Object.values(delivery.zones || {});
    const setDelivery = (patch) => set("fulfillment", { ...(form.fulfillment || {}), delivery: { ...delivery, ...patch } });

    return (
        <div className="std-page">
            <PageHead
                title="Empresa e operação"
                description="O que o cliente vê no cardápio e como os pedidos funcionam."
                actions={(
                    <>
                        {dirty && <span className="mnu-dirty"><Icon icon="solar:pen-linear" aria-hidden="true" /> Alterações não salvas</span>}
                        <Button variant="ghost" disabled={!dirty} onClick={() => { setForm(settings); setDirty(false); }}>Descartar</Button>
                        <Button variant="primary" loading={busy} disabled={!dirty} onClick={save}>Salvar</Button>
                    </>
                )}
            />

            <div className="mnu-tabsbar" role="tablist" aria-label="Seções">
                {SECTIONS.map((item) => (
                    <button key={item.id} type="button" role="tab" aria-selected={section === item.id} className={section === item.id ? "is-on" : ""} onClick={() => navigate(path(`configuracoes/${item.id}`))}>
                        <Icon icon={item.icon} aria-hidden="true" /> {item.label}
                    </button>
                ))}
            </div>

            {section === "empresa" && (
                <div className="std-grid std-grid--2">
                    <Panel title="Apresentação" actions={!demo && <Button size="sm" variant="outline" loading={importing} icon="solar:import-linear" onClick={importFromCompany}>Trazer da empresa</Button>}>
                        <Field label="Nome no cardápio"><input className="mk-input" value={form.profile?.name || ""} maxLength={60} onChange={(event) => setIn("profile", { name: event.target.value })} /></Field>
                        <Field label="Descrição" count={(form.profile?.description || "").length} max={400}>
                            <textarea className="mk-textarea" value={form.profile?.description || ""} maxLength={400} onChange={(event) => setIn("profile", { description: event.target.value })} />
                        </Field>
                        <Field label="Endereço"><input className="mk-input" value={form.address?.text || ""} maxLength={200} onChange={(event) => setIn("address", { text: event.target.value })} placeholder="Rua, número, bairro, cidade" /></Field>
                    </Panel>
                    <Panel title="Contato e redes">
                        <Field label="WhatsApp (com DDD)" hint="Mostra o botão “Falar no WhatsApp”. Só números com código do país, ex.: 5511999990000."><input className="mk-input" inputMode="tel" value={form.contact?.whatsapp || ""} onChange={(event) => setIn("contact", { whatsapp: event.target.value.replace(/[^\d]/g, "").slice(0, 13) })} /></Field>
                        <Field label="Telefone"><input className="mk-input" value={form.contact?.phone || ""} maxLength={20} onChange={(event) => setIn("contact", { phone: event.target.value })} /></Field>
                        <Field label="Instagram"><input className="mk-input" value={form.contact?.instagram || ""} maxLength={40} onChange={(event) => setIn("contact", { instagram: event.target.value.replace(/^@/, "") })} placeholder="seurestaurante" /></Field>
                        <p className="mnu-label">Também vende em outros canais?</p>
                        <p className="mk-muted">Link externo: o cliente sai do seu cardápio e abre o outro app. Não importa pedidos (veja Integrações).</p>
                        {[["ifood", "Link da loja no iFood"], ["ninetyNine", "Link da loja no 99Food"], ["keeta", "Link da loja no Keeta"]].map(([id, label]) => (
                            <Field key={id} label={label}><input className="mk-input" value={form.externalLinks?.[id] || ""} placeholder="https://" onChange={(event) => setIn("externalLinks", { [id]: event.target.value.trim() })} /></Field>
                        ))}
                    </Panel>
                </div>
            )}

            {section === "horarios" && (
                <Panel title="Horário de funcionamento" description="O cardápio mostra “Aberto agora” e só aceita pedidos dentro do horário (a não ser que você permita fora dele)." actions={!demo && <Button size="sm" variant="outline" loading={importing} icon="solar:import-linear" onClick={importFromCompany}>Usar o da Bookings</Button>}>
                    <Field label="Fuso horário" hint="Horários, “hoje” dos relatórios e numeração diária dos pedidos usam este fuso.">
                        <select className="mk-select" value={form.timezone || DEFAULT_TZ} onChange={(event) => set("timezone", event.target.value)}>
                            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace("America/", "").replace("_", " ")}</option>)}
                        </select>
                    </Field>
                    <HoursEditor hours={form.hours} onChange={(hours) => set("hours", hours)} />
                </Panel>
            )}

            {section === "pedidos" && (
                <div className="std-grid">
                    <Panel title="Como o cardápio funciona">
                        <Segmented
                            label="Modo do cardápio"
                            value={form.mode || "showcase"}
                            onChange={(mode) => set("mode", mode)}
                            options={[{ value: "showcase", label: "Só vitrine" }, { value: "ordering", label: "Recebe pedidos" }]}
                        />
                        {form.mode === "ordering" && !features.menusOrdering && (
                            <p className="mnu-alert is-warn">O plano atual não inclui pedidos online. O cardápio continua como vitrine até o plano incluir esse recurso.</p>
                        )}
                        <p className="mk-muted">Vitrine: o cliente vê produtos e preços e fala com você pelos contatos. Pedidos: o cliente monta a sacola e envia.</p>
                    </Panel>

                    {form.mode === "ordering" && (
                        <div className="std-grid std-grid--2">
                            <Panel title="Retirada">
                                <Toggle checked={Boolean(form.fulfillment?.pickup?.enabled)} onChange={(enabled) => set("fulfillment", { ...(form.fulfillment || {}), pickup: { ...(form.fulfillment?.pickup || {}), enabled } })} label="Aceitar pedidos para retirar" />
                                <Field label="Tempo médio até ficar pronto (min)"><input className="mk-input" type="number" min="0" max="600" value={form.fulfillment?.pickup?.etaMinutes || ""} onChange={(event) => set("fulfillment", { ...(form.fulfillment || {}), pickup: { ...(form.fulfillment?.pickup || {}), etaMinutes: Number(event.target.value) || null } })} /></Field>
                            </Panel>

                            <Panel title="Entrega">
                                <Toggle checked={Boolean(delivery.enabled)} onChange={(enabled) => setDelivery({ enabled })} label="Fazer entregas" />
                                <div className="mnu-grid-2">
                                    <Field label="Taxa padrão"><MoneyInput value={delivery.feeCents || 0} onChange={(feeCents) => setDelivery({ feeCents })} /></Field>
                                    <Field label="Pedido mínimo"><MoneyInput value={delivery.minOrderCents || 0} onChange={(minOrderCents) => setDelivery({ minOrderCents })} /></Field>
                                    <Field label="Grátis acima de (opcional)"><MoneyInput value={delivery.freeAboveCents ?? null} allowEmpty onChange={(freeAboveCents) => setDelivery({ freeAboveCents })} /></Field>
                                    <Field label="Tempo estimado (min)"><input className="mk-input" type="number" min="0" max="600" value={delivery.etaMinutes || ""} onChange={(event) => setDelivery({ etaMinutes: Number(event.target.value) || null })} /></Field>
                                </div>
                                <p className="mnu-label">Regiões de entrega (opcional)</p>
                                <p className="mk-muted">Com regiões, o cliente escolhe o bairro e a taxa vem da região; fora delas, não há entrega.</p>
                                {zones.map((zone, index) => (
                                    <div key={zone.id} className="mnu-row">
                                        <input className="mk-input" value={zone.name} placeholder="Bairro ou região" maxLength={60} aria-label="Nome da região" onChange={(event) => setDelivery({ zones: zones.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)) })} />
                                        <MoneyInput value={zone.feeCents || 0} onChange={(feeCents) => setDelivery({ zones: zones.map((item, i) => (i === index ? { ...item, feeCents } : item)) })} aria-label={`Taxa de ${zone.name}`} />
                                        <Button size="sm" variant="ghost" icon="solar:trash-bin-minimalistic-linear" aria-label="Remover região" onClick={() => setDelivery({ zones: zones.filter((_, i) => i !== index) })} />
                                    </div>
                                ))}
                                <Button size="sm" variant="outline" icon="solar:add-circle-linear" onClick={() => setDelivery({ zones: [...zones, { id: pushId().slice(-8), name: "", feeCents: delivery.feeCents || 0 }] })}>Adicionar região</Button>
                            </Panel>
                        </div>
                    )}

                    <Panel title="Fluxo dos pedidos">
                        <Toggle checked={Boolean(form.ordering?.autoConfirm)} onChange={(autoConfirm) => setIn("ordering", { autoConfirm })} label="Confirmar pedidos online automaticamente" hint="Desligado: alguém da equipe confirma antes de ir para a cozinha." />
                        <Toggle checked={form.ordering?.useAwaitingPickup !== false} onChange={(useAwaitingPickup) => setIn("ordering", { useAwaitingPickup })} label="Usar a etapa “Aguardando retirada”" />
                        <Toggle checked={Boolean(form.ordering?.skipPreparing)} onChange={(skipPreparing) => setIn("ordering", { skipPreparing })} label="Pular a etapa “Em preparo”" hint="Para operações em que confirmado já significa preparando." />
                        <Toggle checked={Boolean(form.ordering?.acceptWhenClosed)} onChange={(acceptWhenClosed) => setIn("ordering", { acceptWhenClosed })} label="Aceitar pedidos fora do horário" hint="O cliente é avisado de que a loja está fechada." />
                        <Field label="Marcar como atrasado depois de (min)"><input className="mk-input" type="number" min="5" max="240" value={form.ordering?.lateAfterMinutes || 30} onChange={(event) => setIn("ordering", { lateAfterMinutes: Number(event.target.value) || 30 })} /></Field>
                    </Panel>
                </div>
            )}

            {section === "pagamentos" && (
                <div className="std-grid std-grid--2">
                    <Panel title="Formas aceitas na entrega e retirada" description="Aparecem para o cliente ao finalizar. O pagamento é feito na hora da entrega ou retirada.">
                        {["pix", "credit", "debit", "cash", "voucher"].map((id) => (
                            <Toggle key={id} checked={Boolean(form.payments?.[id])} onChange={(value) => setIn("payments", { [id]: value })} label={PAYMENT_METHODS[id].label} />
                        ))}
                        <Field label="Chave Pix (opcional)" hint="Mostrada ao cliente que escolher Pix. Não é validada automaticamente: confira o recebimento antes de confirmar.">
                            <input className="mk-input" value={form.payments?.pixKey || ""} maxLength={80} onChange={(event) => setIn("payments", { pixKey: event.target.value })} />
                        </Field>
                    </Panel>
                    <Panel title="Pagamento online pelo cardápio">
                        <p className="mnu-alert is-warn"><Icon icon="solar:clock-circle-linear" aria-hidden="true" /> Em breve.</p>
                        <p className="mk-muted">
                            Hoje o Markfy Menus não cobra o cliente online e nunca mostra um pedido como pago sem um pagamento
                            confirmado. A conexão com o Mercado Pago que a Bookings já usa será estendida ao cardápio numa próxima versão.
                        </p>
                    </Panel>
                </div>
            )}

            {section === "mesas" && (
                <div className="std-grid std-grid--2">
                    <Panel title="Comandas">
                        <Field label="Taxa de serviço padrão (%)" hint="Aplicada ao abrir a mesa; quem tem permissão pode retirar. 0 = sem taxa.">
                            <input className="mk-input" type="number" min="0" max="30" step="0.5" value={form.tables?.serviceFeePercent ?? 10} onChange={(event) => setIn("tables", { serviceFeePercent: Number(event.target.value) })} />
                        </Field>
                        <Toggle checked={Boolean(form.fulfillment?.dineIn?.enabled)} onChange={(enabled) => set("fulfillment", { ...(form.fulfillment || {}), dineIn: { enabled } })} label="Atendimento no local (mesas)" />
                    </Panel>
                    <Panel title="QR Code da mesa">
                        <Toggle checked={Boolean(form.tables?.qrCalls)} onChange={(qrCalls) => setIn("tables", { qrCalls })} label="Cliente pode chamar o garçom e pedir a conta" />
                        <Toggle checked={Boolean(form.tables?.qrOrdering)} onChange={(qrOrdering) => setIn("tables", { qrOrdering })} label="Cliente pode pedir pelo QR da mesa" hint="Só funciona com a mesa já aberta pela equipe. O pedido entra na comanda e aguarda confirmação." />
                        {!features.menusTables && <p className="mnu-alert is-warn">Mesas e comandas não estão no plano atual.</p>}
                    </Panel>
                </div>
            )}

            {section === "notificacoes" && (
                <div className="std-grid std-grid--2">
                    <Panel title="Para a equipe">
                        <p className="mk-muted">Novos pedidos aparecem na hora no painel, com aviso na tela e som opcional (ligue no menu lateral ou na tela da cozinha). Funciona com o painel aberto.</p>
                    </Panel>
                    <Panel title="Para o cliente">
                        <ul className="mnu-facts">
                            <li><Icon icon="solar:check-circle-linear" aria-hidden="true" /> <span><b>Página de acompanhamento</b> — ativa: o cliente acompanha recebido, em preparo, pronto e saiu para entrega em tempo real.</span></li>
                            <li><Icon icon="mdi:whatsapp" aria-hidden="true" /> <span><b>WhatsApp (API oficial)</b> — não configurado. Mensagens automáticas exigem uma conta WhatsApp Business Platform aprovada; nenhuma mensagem é enviada hoje.</span></li>
                            <li><Icon icon="solar:letter-linear" aria-hidden="true" /> <span><b>E-mail e SMS</b> — não configurados.</span></li>
                        </ul>
                        <p className="mk-muted">Quando um canal for ativado, o cliente poderá escolher receber ou não as mensagens (consentimento).</p>
                    </Panel>
                </div>
            )}

        </div>
    );
}
