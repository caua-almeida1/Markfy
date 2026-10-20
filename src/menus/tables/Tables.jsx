import React, { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";

import { Badge, Button, EmptyState, Segmented, Sheet, cx } from "../../design-system/components";
import { formatBRL } from "../engine/money.js";
import { isLate } from "../engine/orders.js";
import { entries } from "../engine/util.js";
import { useMenus, useNode, useNow } from "../MenusContext.jsx";
import { callsByTable, deriveTable, isToday, listAreas, listTables, liveOrders, ordersByTab, TABLE_STATUS } from "../data/selectors.js";
import { useTeam } from "../data/team.js";
import { DemoTag, PageHead, Stat, durationLabel, minutesSince } from "../ui.jsx";
import TableDetail from "./TableDetail.jsx";
import { FloorEditor, PlanView } from "./FloorPlan.jsx";

/* =========================================================
   MESAS E COMANDAS

   Três visões dos MESMOS dados vivos: grade de cartões,
   lista compacta e planta do salão. Os números do topo saem
   das mesas, comandas e pedidos reais — nada decorativo.

   Abrir uma mesa passa pelo servidor numa transação: dois
   garçons tocando na mesma mesa livre ao mesmo tempo nunca
   criam duas comandas; o segundo é levado à comanda aberta.
========================================================= */

const readPref = (key, fallback) => {
    try {
        return window.localStorage.getItem(`markfy:menus:${key}`) || fallback;
    } catch {
        return fallback;
    }
};

const writePref = (key, value) => {
    try {
        window.localStorage.setItem(`markfy:menus:${key}`, value);
    } catch {
        /* sem preferência salva */
    }
};

const TableCard = ({ view, density, onOpen }) => {
    const { table } = view;
    const meta = TABLE_STATUS[view.status];
    const busy = !["free", "reserved", "unavailable"].includes(view.status);

    return (
        <button type="button" className={cx("mnu-tcard", `mnu-status--${view.status}`, density === "compact" && "is-compact", view.attention && "has-attention")} onClick={onOpen}>
            <span className="mnu-tcard__top">
                <b className="mnu-tcard__label">{table.label}</b>
                {view.attention && <span className="mnu-tcard__alert"><Icon icon="solar:bell-bing-bold" aria-hidden="true" /> {view.calls.some((call) => call.type === "bill") ? "Conta" : "Chamado"}</span>}
            </span>
            <span className="mnu-tcard__status"><Icon icon={meta.icon} aria-hidden="true" /> {meta.label}</span>
            {density !== "compact" && (
                <span className="mnu-tcard__meta">
                    {busy ? (
                        <>
                            <span><Icon icon="solar:users-group-rounded-linear" aria-hidden="true" /> {view.guests || "—"}</span>
                            <span><Icon icon="solar:clock-circle-linear" aria-hidden="true" /> {durationLabel(view.elapsed)}</span>
                        </>
                    ) : view.status === "reserved" ? (
                        <span>{view.reservation?.name}{view.reservation?.time ? ` · ${view.reservation.time}` : ""}</span>
                    ) : (
                        <span>{table.seats} lugares{table.nickname ? ` · ${table.nickname}` : ""}</span>
                    )}
                </span>
            )}
            {busy && (
                <span className="mnu-tcard__foot">
                    <b>{formatBRL(view.totalCents)}</b>
                    {density !== "compact" && view.waiterName && <small>{view.waiterName.split(" ")[0]}</small>}
                    {view.pendingCount > 0 && <Badge tone="warning">{view.pendingCount} a enviar</Badge>}
                    {view.readyCount > 0 && <Badge tone="success">pronto</Badge>}
                    {view.lateCount > 0 && <Badge tone="danger">atrasado</Badge>}
                </span>
            )}
        </button>
    );
};

const OpenTableSheet = ({ table, onClose, onOpened }) => {
    const { act, user, can, tableState, notify } = useMenus();
    const team = useTeam();
    const [guests, setGuests] = useState(Math.min(table?.seats || 2, 2));
    const [customerName, setCustomerName] = useState("");
    const [waiterUid, setWaiterUid] = useState(user?.uid || "");
    const [notes, setNotes] = useState("");
    const [busy, setBusy] = useState(false);
    const reservation = tableState[table?.id]?.reservation;

    const open = async () => {
        setBusy(true);
        try {
            const waiter = team.find((person) => person.uid === waiterUid);
            const result = await act("tables.open", { tableId: table.id, guests, customerName: customerName || reservation?.name || "", waiterUid, waiterName: waiter?.name || "", notes }, { quiet: true });
            onOpened(result.tabId);
        } catch (error) {
            /* Outra pessoa abriu a mesa no mesmo instante: vai para a comanda dela. */
            if (error.code === "table_busy" && error.extra?.tabId) onOpened(error.extra.tabId);
            else notify("error", "Não foi possível abrir a mesa", error.message);
        } finally {
            setBusy(false);
        }
    };

    if (!table) return null;

    return (
        <Sheet
            open
            onClose={onClose}
            side="center"
            title={`Abrir ${table.label}`}
            description={`${table.seats} lugares${reservation ? ` · reservada para ${reservation.name}${reservation.time ? ` às ${reservation.time}` : ""}` : ""}`}
            footer={(
                <>
                    {reservation && can("tables.open") && <Button variant="ghost" onClick={() => act("tables.reserve", { tableId: table.id, reservation: null }, { success: "Reserva removida" }).then(onClose)}>Tirar reserva</Button>}
                    <span style={{ flex: 1 }} />
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button variant="primary" loading={busy} onClick={open}>Abrir mesa</Button>
                </>
            )}
        >
            <div className="mnu-form">
                <div className="mnu-row">
                    <span className="mnu-label">Pessoas</span>
                    <div className="mnu-qty is-big">
                        <Button variant="ghost" icon="solar:minus-circle-linear" aria-label="Menos pessoas" disabled={guests <= 1} onClick={() => setGuests(guests - 1)} />
                        <output aria-live="polite">{guests}</output>
                        <Button variant="ghost" icon="solar:add-circle-linear" aria-label="Mais pessoas" onClick={() => setGuests(Math.min(99, guests + 1))} />
                    </div>
                </div>
                <label className="mk-field">
                    <span className="mk-field__label">Cliente (opcional)</span>
                    <input className="mk-input" value={customerName} placeholder={reservation?.name || "Nome para identificar"} maxLength={80} onChange={(event) => setCustomerName(event.target.value)} />
                </label>
                <label className="mk-field">
                    <span className="mk-field__label">Responsável pelo atendimento</span>
                    <select className="mk-select" value={waiterUid} onChange={(event) => setWaiterUid(event.target.value)}>
                        <option value="">Ninguém específico</option>
                        {team.map((person) => <option key={person.uid} value={person.uid}>{person.name} · {person.roleLabel}</option>)}
                    </select>
                </label>
                <label className="mk-field">
                    <span className="mk-field__label">Observações (opcional)</span>
                    <input className="mk-input" value={notes} maxLength={280} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: aniversário, cadeira de bebê" />
                </label>
            </div>
        </Sheet>
    );
};

const ReserveSheet = ({ table, onClose }) => {
    const { act } = useMenus();
    const [name, setName] = useState("");
    const [time, setTime] = useState("");
    if (!table) return null;
    return (
        <Sheet
            open
            onClose={onClose}
            side="center"
            title={`Reservar ${table.label}`}
            description="Marca a mesa como reservada para a equipe. Reservas online pela Bookings não entram aqui automaticamente."
            footer={(
                <>
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button variant="primary" disabled={!name.trim()} onClick={() => act("tables.reserve", { tableId: table.id, reservation: { name, time } }, { success: "Mesa reservada" }).then(onClose).catch(() => null)}>Reservar</Button>
                </>
            )}
        >
            <div className="mnu-form">
                <label className="mk-field"><span className="mk-field__label">Nome da reserva</span><input className="mk-input" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} autoFocus /></label>
                <label className="mk-field"><span className="mk-field__label">Horário (opcional)</span><input className="mk-input" type="time" value={time} onChange={(event) => setTime(event.target.value)} /></label>
            </div>
        </Sheet>
    );
};

export default function Tables() {
    const { floor, tableState, openTabs, orders, calls, settings, can, act, source, handle } = useMenus();
    const team = useTeam();
    const now = useNow(30000);
    const [params, setParams] = useSearchParams();

    const [view, setView] = useState(() => readPref("tables:view", "grid"));
    const [density, setDensity] = useState(() => readPref("tables:density", "full"));
    const [areaId, setAreaId] = useState("all");
    const [status, setStatus] = useState("all");
    const [waiter, setWaiter] = useState("all");
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState("label");
    const [editingPlan, setEditingPlan] = useState(false);
    const [opening, setOpening] = useState(null);
    const [reserving, setReserving] = useState(null);
    const [choice, setChoice] = useState(null);
    const [looseOpen, setLooseOpen] = useState(false);
    const [looseLabel, setLooseLabel] = useState("");

    const selectedTab = params.get("comanda");
    const selectedTable = params.get("mesa");

    const areas = listAreas(floor);
    const tables = listTables(floor);
    const byTab = useMemo(() => ordersByTab(orders), [orders]);
    const byTable = useMemo(() => callsByTable(calls), [calls]);
    const tabs = openTabs;

    const views = useMemo(() => {
        const map = {};
        tables.forEach((table) => {
            const state = tableState[table.id];
            const tab = state?.tabId ? tabs[state.tabId] && { ...tabs[state.tabId], id: state.tabId } : null;
            map[table.id] = deriveTable({ table, state, tab, orders: tab ? byTab[tab.id] || [] : [], calls: byTable[table.id] || [], now });
        });
        return map;
    }, [tables, tableState, tabs, byTab, byTable, now]);

    const looseTabs = entries(tabs).filter((tab) => !tab.tableId);

    /* Fechamentos de hoje: total vendido nas mesas. */
    const since = Math.floor(now / 3600000) * 3600000 - 26 * 3600000;
    const closedToday = useNode(source, handle && `menusOps/${handle}/tabs`, { orderBy: "closedAt", startAt: since });
    const soldToday = entries(closedToday.value)
        .filter((tab) => tab.status === "closed" && isToday(tab.closedAt, settings.timezone, now))
        .reduce((sum, tab) => sum + (tab.totals?.totalCents || 0), 0);

    const all = Object.values(views);
    const counts = {
        free: all.filter((v) => v.status === "free").length,
        busy: all.filter((v) => !["free", "reserved", "unavailable"].includes(v.status)).length,
        reserved: all.filter((v) => v.status === "reserved").length,
        attention: all.filter((v) => v.attention).length,
        payment: all.filter((v) => v.status === "awaiting_payment").length
    };
    const live = liveOrders(orders).filter((order) => order.channel === "table" || order.tabId);
    const late = live.filter((order) => isLate(order, now, settings)).length;
    const openTotal = entries(tabs).reduce((sum, tab) => sum + (tab.totals?.balanceCents || 0), 0);

    const filtered = tables.filter((table) => {
        const v = views[table.id];
        if (areaId !== "all" && table.areaId !== areaId) return false;
        if (status === "busy" && ["free", "reserved", "unavailable"].includes(v.status)) return false;
        if (status !== "all" && status !== "busy" && v.status !== status) return false;
        if (waiter !== "all" && (v.tab?.waiterUid || "") !== waiter) return false;
        if (query && !`${table.label} ${table.nickname || ""} ${v.tab?.customerName || ""}`.toLowerCase().includes(query.toLowerCase())) return false;
        return true;
    });

    const sorted = view === "list"
        ? [...filtered].sort((a, b) => {
            const va = views[a.id];
            const vb = views[b.id];
            if (sort === "time") return vb.elapsed - va.elapsed;
            if (sort === "total") return vb.totalCents - va.totalCents;
            if (sort === "status") return va.status.localeCompare(vb.status);
            return String(a.label).localeCompare(String(b.label), "pt-BR", { numeric: true });
        })
        : filtered;

    const openTable = (tableId) => {
        const v = views[tableId];
        if (!v) return;
        if (v.status === "unavailable") return;
        if (v.tab) {
            setParams({ comanda: v.tab.id, mesa: tableId });
            return;
        }
        if (!can("tables.open")) return;
        setChoice(tableId);
    };

    const setPref = (key, value, setter) => {
        setter(value);
        writePref(key, value);
    };

    if (!tables.length && !editingPlan) {
        return (
            <div className="std-page">
                <PageHead title="Mesas e comandas" description="Cadastre as mesas para começar a atender." />
                <div className="std-panel">
                    <EmptyState
                        icon="solar:armchair-2-linear"
                        title="Nenhuma mesa cadastrada"
                        action={can("tables.layout") && <Button variant="primary" icon="solar:add-square-linear" onClick={() => setEditingPlan(true)}>Montar a planta do salão</Button>}
                    >
                        Monte a planta com ambientes (salão, varanda, balcão) e mesas com nome, lugares e formato. Você também pode abrir comandas avulsas sem mesa.
                    </EmptyState>
                    {can("tables.open") && <Button variant="outline" icon="solar:bill-list-linear" onClick={() => setLooseOpen(true)}>Abrir comanda avulsa</Button>}
                </div>
                {looseOpen && <LooseSheet label={looseLabel} setLabel={setLooseLabel} onClose={() => setLooseOpen(false)} onOpened={(tabId) => { setLooseOpen(false); setParams({ comanda: tabId }); }} />}
            </div>
        );
    }

    return (
        <div className="std-page">
            <PageHead
                title="Mesas e comandas"
                description="Toque numa mesa livre para abrir o atendimento ou numa ocupada para ver a comanda."
                actions={(
                    <>
                        <DemoTag />
                        {can("tables.open") && <Button icon="solar:bill-list-linear" onClick={() => setLooseOpen(true)}>Comanda avulsa</Button>}
                        {can("tables.layout") && <Button variant="outline" icon="solar:map-linear" onClick={() => { setEditingPlan(true); setView("plan"); }}>Editar planta</Button>}
                    </>
                )}
            />

            <div className="std-stats mnu-stats mnu-stats--tables">
                <Stat label="Livres" icon="solar:check-circle-linear" value={counts.free} />
                <Stat label="Ocupadas" icon="solar:users-group-rounded-linear" value={counts.busy} hint={counts.reserved ? `${counts.reserved} reservada(s)` : undefined} />
                <Stat label="Aguardando atendimento" icon="solar:bell-bing-linear" value={counts.attention} tone={counts.attention ? "warning" : undefined} hint={counts.payment ? `${counts.payment} pediram a conta` : undefined} />
                <Stat label="Pedidos em andamento" icon="solar:chef-hat-linear" value={live.length} tone={late ? "danger" : undefined} hint={late ? `${late} atrasado(s)` : "nenhum atrasado"} />
                <Stat label="Comandas abertas" icon="solar:bill-list-linear" value={entries(tabs).length} hint={`${formatBRL(openTotal)} em aberto`} />
                <Stat label="Vendido hoje nas mesas" icon="solar:wallet-money-linear" value={formatBRL(soldToday)} hint="comandas fechadas" />
            </div>

            {editingPlan ? (
                <div className="std-panel">
                    <FloorEditor floor={floor} onClose={() => setEditingPlan(false)} />
                </div>
            ) : (
                <>
                    <div className="mnu-toolbar">
                        <Segmented
                            label="Visualização"
                            value={view}
                            onChange={(value) => setPref("tables:view", value, setView)}
                            options={[
                                { value: "grid", label: "Grade", icon: "solar:widget-4-linear" },
                                { value: "list", label: "Lista", icon: "solar:list-linear" },
                                { value: "plan", label: "Planta", icon: "solar:map-linear" }
                            ]}
                        />
                        {view !== "plan" && (
                            <label className="mk-input-group mnu-search">
                                <Icon icon="solar:magnifer-linear" aria-hidden="true" />
                                <input className="mk-input" type="search" placeholder="Mesa ou cliente" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar mesa" />
                            </label>
                        )}
                        <select className="mk-select mnu-select" value={status} onChange={(event) => setStatus(event.target.value)} aria-label="Filtrar por situação">
                            <option value="all">Todas as situações</option>
                            <option value="busy">Ocupadas</option>
                            {Object.entries(TABLE_STATUS).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}
                        </select>
                        <select className="mk-select mnu-select" value={waiter} onChange={(event) => setWaiter(event.target.value)} aria-label="Filtrar por responsável">
                            <option value="all">Todos os responsáveis</option>
                            {team.map((person) => <option key={person.uid} value={person.uid}>{person.name}</option>)}
                        </select>
                        {view === "grid" && (
                            <Segmented label="Cartões" size="sm" value={density} onChange={(value) => setPref("tables:density", value, setDensity)} options={[{ value: "full", label: "Completo" }, { value: "compact", label: "Compacto" }]} />
                        )}
                    </div>

                    {areas.length > 1 && (
                        <div className="mnu-chips" role="group" aria-label="Ambientes">
                            {view !== "plan" && <button type="button" className="mk-chip" aria-pressed={areaId === "all"} onClick={() => setAreaId("all")}>Todos</button>}
                            {areas.map((area) => (
                                <button key={area.id} type="button" className="mk-chip" aria-pressed={areaId === area.id || (view === "plan" && areaId === "all" && area.id === areas[0].id)} onClick={() => setAreaId(area.id)}>
                                    {area.name} <small>{tables.filter((table) => table.areaId === area.id && views[table.id]?.tab).length}/{tables.filter((table) => table.areaId === area.id).length}</small>
                                </button>
                            ))}
                        </div>
                    )}

                    <div className="mnu-legend" aria-label="Legenda">
                        {["free", "awaiting_order", "sent", "preparing", "occupied", "awaiting_payment", "reserved", "unavailable"].map((id) => (
                            <span key={id} className={`mnu-legend__item mnu-status--${id}`}><Icon icon={TABLE_STATUS[id].icon} aria-hidden="true" /> {TABLE_STATUS[id].label}</span>
                        ))}
                    </div>

                    {view === "grid" && (
                        <div className={cx("mnu-tgrid", density === "compact" && "is-compact")}>
                            {sorted.map((table) => <TableCard key={table.id} view={views[table.id]} density={density} onOpen={() => openTable(table.id)} />)}
                            {looseTabs.map((tab) => (
                                <TableCard
                                    key={tab.id}
                                    density={density}
                                    view={deriveTable({ table: { label: tab.label, seats: 0 }, state: { tabId: tab.id, openedAt: tab.openedAt }, tab, orders: byTab[tab.id] || [], calls: [], now })}
                                    onOpen={() => setParams({ comanda: tab.id })}
                                />
                            ))}
                            {!sorted.length && !looseTabs.length && <p className="mk-muted">Nenhuma mesa com esses filtros.</p>}
                        </div>
                    )}

                    {view === "list" && (
                        <div className="std-panel std-panel--flush">
                            <div className="mnu-table-wrap">
                                <table className="mnu-table">
                                    <thead>
                                        <tr>
                                            <th scope="col"><button type="button" onClick={() => setSort("label")}>Mesa {sort === "label" && "↓"}</button></th>
                                            <th scope="col"><button type="button" onClick={() => setSort("status")}>Situação {sort === "status" && "↓"}</button></th>
                                            <th scope="col">Pessoas</th>
                                            <th scope="col"><button type="button" onClick={() => setSort("time")}>Tempo {sort === "time" && "↓"}</button></th>
                                            <th scope="col">Responsável</th>
                                            <th scope="col"><button type="button" onClick={() => setSort("total")}>Total {sort === "total" && "↓"}</button></th>
                                            <th scope="col"><span className="mk-visually-hidden">Ações</span></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sorted.map((table) => {
                                            const v = views[table.id];
                                            const meta = TABLE_STATUS[v.status];
                                            const busy = Boolean(v.tab);
                                            return (
                                                <tr key={table.id} className={cx(`mnu-status--${v.status}`, v.attention && "has-attention")}>
                                                    <th scope="row">{table.label}{table.nickname && <small> · {table.nickname}</small>}</th>
                                                    <td><span className="mnu-pill"><Icon icon={meta.icon} aria-hidden="true" /> {meta.label}</span>{v.attention && <Badge tone="warning">chamado</Badge>}</td>
                                                    <td>{busy ? v.guests : `${table.seats} lug.`}</td>
                                                    <td>{busy ? durationLabel(v.elapsed) : "—"}</td>
                                                    <td>{v.waiterName || "—"}</td>
                                                    <td className="mnu-num">{busy ? formatBRL(v.totalCents) : "—"}</td>
                                                    <td className="mnu-actions">
                                                        {busy ? (
                                                            <Button size="sm" onClick={() => openTable(table.id)}>Ver comanda</Button>
                                                        ) : v.status === "unavailable" ? null : (
                                                            can("tables.open") && <Button size="sm" variant="primary" onClick={() => openTable(table.id)}>Abrir</Button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {view === "plan" && (
                        <div className="std-panel">
                            <PlanView tables={floor.tables || {}} areaId={areaId === "all" ? areas[0]?.id : areaId} views={views} onSelect={openTable} />
                        </div>
                    )}

                    {entries(calls).length > 0 && (
                        <div className="std-panel">
                            <div className="std-panel__head"><div><h2>Chamados pelo QR</h2><p>Atenda e marque como resolvido.</p></div></div>
                            <ul className="std-list">
                                {entries(calls).map((call) => (
                                    <li key={call.id}>
                                        <div className="std-row">
                                            <span className="std-row__icon mnu-tone--warn"><Icon icon={call.type === "bill" ? "solar:bill-list-linear" : "solar:hand-shake-linear"} /></span>
                                            <span className="std-row__body">
                                                <span className="std-row__title">{call.tableLabel} · {call.type === "bill" ? "pediu a conta" : "chamou o garçom"}</span>
                                                <span className="std-row__meta">há {durationLabel(minutesSince(call.at, now))}</span>
                                            </span>
                                            <Button size="sm" onClick={() => act("calls.resolve", { callId: call.id }, { success: "Chamado resolvido" })}>Atendido</Button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </>
            )}

            {choice && (
                <Sheet
                    open
                    onClose={() => setChoice(null)}
                    side="center"
                    title={floor.tables?.[choice]?.label}
                    description={views[choice]?.reservation ? `Reservada para ${views[choice].reservation.name}${views[choice].reservation.time ? ` às ${views[choice].reservation.time}` : ""}` : "Mesa livre"}
                >
                    <div className="mnu-choice">
                        <Button variant="primary" size="lg" block icon="solar:armchair-2-bold" onClick={() => { setOpening(choice); setChoice(null); }}>Abrir mesa</Button>
                        <Button size="lg" block icon="solar:calendar-mark-linear" onClick={() => { setReserving(choice); setChoice(null); }}>Reservar</Button>
                        {can("tables.layout") && <Button variant="ghost" block icon="solar:map-linear" onClick={() => { setChoice(null); setEditingPlan(true); setView("plan"); }}>Editar na planta</Button>}
                    </div>
                </Sheet>
            )}

            {opening && (
                <OpenTableSheet
                    table={{ ...floor.tables[opening], id: opening }}
                    onClose={() => setOpening(null)}
                    onOpened={(tabId) => {
                        setOpening(null);
                        setParams({ comanda: tabId, mesa: opening });
                    }}
                />
            )}

            {reserving && <ReserveSheet table={{ ...floor.tables[reserving], id: reserving }} onClose={() => setReserving(null)} />}

            {looseOpen && <LooseSheet label={looseLabel} setLabel={setLooseLabel} onClose={() => setLooseOpen(false)} onOpened={(tabId) => { setLooseOpen(false); setParams({ comanda: tabId }); }} />}

            {selectedTab && <TableDetail tabId={selectedTab} tableId={selectedTable} onClose={() => setParams({})} />}

        </div>
    );
}

const LooseSheet = ({ label, setLabel, onClose, onOpened }) => {
    const { act } = useMenus();
    return (
        <Sheet
            open
            onClose={onClose}
            side="center"
            title="Comanda avulsa"
            description="Para balcão, cartão de consumo ou cliente sem mesa."
            footer={(
                <>
                    <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button
                        variant="primary"
                        disabled={!label.trim()}
                        onClick={async () => {
                            try {
                                const result = await act("tables.open", { label: label.trim() });
                                setLabel("");
                                onOpened(result.tabId);
                            } catch {
                                /* aviso já exibido */
                            }
                        }}
                    >
                        Abrir comanda
                    </Button>
                </>
            )}
        >
            <label className="mk-field">
                <span className="mk-field__label">Nome ou número</span>
                <input className="mk-input" value={label} maxLength={40} onChange={(event) => setLabel(event.target.value)} placeholder="Ex.: Comanda 27, João" autoFocus />
            </label>
        </Sheet>
    );
};
