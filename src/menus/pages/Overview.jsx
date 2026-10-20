import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import { Badge, Button, EmptyState } from "../../design-system/components";
import { entries } from "../engine/util.js";
import { formatBRL } from "../engine/money.js";
import { isOpenAt, nextOpeningLabel } from "../engine/hours.js";
import { CHANNELS, isLate, STATUS } from "../engine/orders.js";
import { useMenus, useNow } from "../MenusContext.jsx";
import { isToday, listTables, liveOrders, summarizeOrders, topProducts } from "../data/selectors.js";
import { DemoTag, PageHead, Panel, Stat, minutesSince, durationLabel } from "../ui.jsx";
import DemoJourney from "../demo/DemoJourney.jsx";

/* =========================================================
   PAINEL (visão geral)

   Números do dia calculados dos pedidos reais (no fuso da
   empresa), o que precisa de atenção agora e o que falta
   configurar. Nada aqui é decorativo: cada indicador abre a
   tela onde se resolve.
========================================================= */

const useChecklist = () => {
    const { catalog, settings, site, draft, floor, features, path } = useMenus();
    const products = entries(catalog.products);
    return [
        { id: "profile", title: "Dados da empresa", hint: "Nome, descrição e contato.", done: Boolean(settings.profile?.name), to: path("configuracoes/empresa") },
        { id: "logo", title: "Logo e capa", hint: "Aparecem no topo do cardápio.", done: Boolean(draft?.design?.images?.logo), to: path("editor") },
        { id: "products", title: "Primeiros produtos", hint: "Com preço e, se quiser, foto.", done: products.length >= 3, to: path("cardapio") },
        { id: "hours", title: "Horário de funcionamento", hint: "Mostra “aberto agora” ao cliente.", done: isOpenAt(settings.hours, Date.now()).configured, to: path("configuracoes/horarios") },
        { id: "mode", title: "Pedidos ou só vitrine", hint: "Escolha se o cardápio recebe pedidos.", done: Boolean(settings.mode), to: path("configuracoes/pedidos") },
        ...(features.menusTables && settings.fulfillment?.dineIn?.enabled
            ? [{ id: "tables", title: "Mesas do salão", hint: "Monte a planta ou cadastre as mesas.", done: entries(floor.tables).length > 0, to: path("mesas") }]
            : []),
        { id: "publish", title: "Publicar o cardápio", hint: "Gera o link e o QR Code.", done: Boolean(site?.publishedAt), to: path("publicar") }
    ];
};

export default function Overview() {
    const navigate = useNavigate();
    const now = useNow(30000);
    const { settings, orders, openTabs, tableState, floor, calls, allowed, can, path, demo, act, catalog } = useMenus();

    const tz = settings.timezone;
    const todayOrders = useMemo(() => entries(orders).filter((order) => isToday(order.createdAt, tz, now)), [orders, tz, now]);
    const summary = summarizeOrders(todayOrders);
    const live = liveOrders(orders);
    const late = live.filter((order) => isLate(order, now, settings));
    const received = live.filter((order) => order.status === "received").sort((a, b) => a.createdAt - b.createdAt);
    const ready = live.filter((order) => order.status === "ready");
    const tables = listTables(floor);
    const busy = tables.filter((table) => tableState[table.id]?.tabId).length;
    const open = entries(openTabs);
    const openCents = open.reduce((sum, tab) => sum + (tab.totals?.totalCents || 0), 0);
    const ticket = summary.count ? Math.round((summary.itemsCents + summary.deliveryCents) / summary.count) : 0;
    const top = topProducts(todayOrders, 5);
    const callList = entries(calls).sort((a, b) => a.at - b.at);

    const checklist = useChecklist();
    const done = checklist.filter((item) => item.done).length;

    const hours = isOpenAt(settings.hours, now, tz);
    const productsCount = entries(catalog.products).length;

    return (
        <div className="std-page">
            {demo && <DemoJourney />}

            <PageHead
                eyebrow={new Date(now).toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })}
                title={settings.profile?.name ? `Olá, ${settings.profile.name}` : "Painel do Markfy Menus"}
                description={
                    hours.configured
                        ? hours.open ? "Aberto agora, de acordo com o horário configurado." : `Fechado agora${nextOpeningLabel(settings.hours, now, tz) ? ` · abre ${nextOpeningLabel(settings.hours, now, tz)}` : ""}.`
                        : "Configure o horário de funcionamento para o cardápio mostrar se está aberto."
                }
                actions={(
                    <>
                        <DemoTag />
                        {allowed("tables.view") && <Button variant="primary" icon="solar:armchair-2-bold" onClick={() => navigate(path("mesas"))}>Mesas</Button>}
                        {allowed("orders.create") && <Button icon="solar:cart-large-4-linear" onClick={() => navigate(path("pdv"))}>Novo pedido</Button>}
                        {can("design.edit") && <Button variant="outline" icon="solar:pallete-2-linear" onClick={() => navigate(path("editor"))}>Editar aparência</Button>}
                    </>
                )}
            />

            {done < checklist.length && can("settings.edit") && (
                <Panel
                    title="Deixe seu cardápio pronto"
                    description={`${done} de ${checklist.length} etapas concluídas. Você pode pausar e continuar quando quiser.`}
                    actions={<Button size="sm" variant="primary" onClick={() => navigate(path("comecar"))}>Continuar configuração</Button>}
                >
                    <div className="std-progress">
                        <div className="std-progress__bar"><span style={{ transform: `scaleX(${done / checklist.length})` }} /></div>
                        <strong>{Math.round((done / checklist.length) * 100)}%</strong>
                    </div>
                    <div className="mnu-checklist">
                        {checklist.map((item) => (
                            <button key={item.id} type="button" className={`std-check ${item.done ? "is-done" : ""}`} onClick={() => navigate(item.to)}>
                                <span className="std-check__mark"><Icon icon="solar:check-read-linear" /></span>
                                <span className="std-check__body">
                                    <span className="std-check__title">{item.title}</span>
                                    <span className="std-check__hint">{item.hint}</span>
                                </span>
                                <Icon icon="solar:alt-arrow-right-linear" />
                            </button>
                        ))}
                    </div>
                </Panel>
            )}

            <div className="std-stats mnu-stats">
                <Stat label="Vendas do dia" icon="solar:wallet-money-linear" value={formatBRL(summary.itemsCents + summary.deliveryCents)} hint={`${summary.count} pedido(s) não cancelados`} />
                <Stat label="Ticket médio" icon="solar:tag-price-linear" value={formatBRL(ticket)} hint="por pedido hoje" />
                <Stat label="Mesas ocupadas" icon="solar:armchair-2-linear" value={tables.length ? `${busy}/${tables.length}` : "—"} hint={open.length ? `${formatBRL(openCents)} em aberto` : "nenhuma comanda aberta"} />
                <Stat label="Em andamento" icon="solar:chef-hat-linear" value={live.length} hint={late.length ? `${late.length} atrasado(s)` : "nenhum atrasado"} tone={late.length ? "warning" : undefined} />
            </div>

            <div className="std-grid std-grid--main">
                <div className="std-grid">
                    <Panel
                        title="Precisa de atenção"
                        description="Pedidos novos, chamados das mesas e pedidos prontos."
                        actions={allowed("orders.view") && <Button size="sm" variant="ghost" iconRight="solar:arrow-right-linear" onClick={() => navigate(path("pedidos"))}>Pedidos</Button>}
                    >
                        {!received.length && !callList.length && !ready.length && !late.length && (
                            <EmptyState icon="solar:cup-hot-linear" title="Tudo em dia">Nenhum pedido esperando confirmação e nenhum chamado aberto.</EmptyState>
                        )}
                        <ul className="std-list">
                            {callList.map((call) => (
                                <li key={call.id}>
                                    <div className="std-row">
                                        <span className="std-row__icon mnu-tone--warn"><Icon icon={call.type === "bill" ? "solar:bill-list-linear" : "solar:hand-shake-linear"} /></span>
                                        <span className="std-row__body">
                                            <span className="std-row__title">{call.tableLabel}: {call.type === "bill" ? "pediu a conta" : "chamou o garçom"}</span>
                                            <span className="std-row__meta">há {durationLabel(minutesSince(call.at, now))} · pelo QR da mesa</span>
                                        </span>
                                        {can("tables.view") && (
                                            <Button size="sm" onClick={() => act("calls.resolve", { callId: call.id }, { success: "Chamado atendido" })}>Atendido</Button>
                                        )}
                                    </div>
                                </li>
                            ))}
                            {received.map((order) => (
                                <li key={order.id}>
                                    <div className="std-row">
                                        <span className="std-row__icon mnu-tone--info"><Icon icon={CHANNELS[order.channel]?.icon || "solar:inbox-in-linear"} /></span>
                                        <span className="std-row__body">
                                            <span className="std-row__title">#{order.code} · {order.customer?.name || order.tableLabel || CHANNELS[order.channel]?.label} aguardando confirmação</span>
                                            <span className="std-row__meta">{CHANNELS[order.channel]?.label} · há {durationLabel(minutesSince(order.createdAt, now))} · {formatBRL(order.totals?.totalCents)}</span>
                                        </span>
                                        {can("orders.status") && (
                                            <Button size="sm" variant="primary" onClick={() => act("orders.status", { orderId: order.id, to: "confirmed" }, { success: `Pedido #${order.code} confirmado` })}>Confirmar</Button>
                                        )}
                                    </div>
                                </li>
                            ))}
                            {ready.map((order) => (
                                <li key={order.id}>
                                    <button type="button" className="std-row" onClick={() => navigate(path("pedidos"))}>
                                        <span className="std-row__icon mnu-tone--ok"><Icon icon="solar:bell-bing-linear" /></span>
                                        <span className="std-row__body">
                                            <span className="std-row__title">#{order.code} pronto · {order.tableLabel || order.customer?.name || CHANNELS[order.channel]?.label}</span>
                                            <span className="std-row__meta">{STATUS.ready.label} há {durationLabel(minutesSince(order.readyAt || order.updatedAt, now))}</span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                            {late.filter((order) => order.status !== "received").map((order) => (
                                <li key={`late-${order.id}`}>
                                    <button type="button" className="std-row" onClick={() => navigate(path("pedidos"))}>
                                        <span className="std-row__icon mnu-tone--bad"><Icon icon="solar:alarm-linear" /></span>
                                        <span className="std-row__body">
                                            <span className="std-row__title">#{order.code} atrasado · {STATUS[order.status]?.label}</span>
                                            <span className="std-row__meta">aberto há {durationLabel(minutesSince(order.createdAt, now))}</span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </Panel>
                </div>

                <div className="std-grid">
                    <Panel title="Mais pedidos hoje" description="Quantidade vendida em pedidos não cancelados.">
                        {top.length ? (
                            <ol className="mnu-rank">
                                {top.map((row, index) => (
                                    <li key={row.key}>
                                        <span className="mnu-rank__pos">{index + 1}</span>
                                        <span className="mnu-rank__name">{row.name}</span>
                                        <span className="mnu-rank__value">{row.qty}×</span>
                                    </li>
                                ))}
                            </ol>
                        ) : (
                            <p className="mk-muted">Nenhuma venda registrada hoje ainda.</p>
                        )}
                    </Panel>

                    <Panel title="Atalhos">
                        <div className="mnu-shortcuts">
                            {can("catalog.edit") && <button type="button" onClick={() => navigate(path("cardapio"))}><Icon icon="solar:add-square-linear" /> Novo produto<small>{productsCount} no cardápio</small></button>}
                            {allowed("kitchen.view") && <button type="button" onClick={() => navigate(path("cozinha"))}><Icon icon="solar:chef-hat-linear" /> Tela da cozinha<small>Pedidos para preparo</small></button>}
                            {can("design.edit") && <button type="button" onClick={() => navigate(path("publicar"))}><Icon icon="solar:qr-code-linear" /> QR Codes<small>Cardápio e mesas</small></button>}
                            {can("reports.view") && <button type="button" onClick={() => navigate(path("relatorios"))}><Icon icon="solar:chart-2-linear" /> Relatórios<small>Vendas e horários</small></button>}
                        </div>
                    </Panel>

                    {summary.cancelledCount > 0 && (
                        <Panel title="Cancelamentos hoje">
                            <p className="mk-muted"><Badge tone="danger">{summary.cancelledCount}</Badge> pedido(s) cancelado(s) somando {formatBRL(summary.cancelledCents)}, fora das vendas do dia.</p>
                        </Panel>
                    )}
                </div>
            </div>
        </div>
    );
}
