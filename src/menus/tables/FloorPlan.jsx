import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";

import { Button, ConfirmDialog, Field, Segmented, cx, useMediaQuery } from "../../design-system/components";
import { formatBRL } from "../engine/money.js";
import { pushId } from "../engine/util.js";
import { TABLE_STATUS } from "../data/selectors.js";
import { useMenus } from "../MenusContext.jsx";
import { durationLabel } from "../ui.jsx";

/* =========================================================
   PLANTA DO SALÃO

   Visualização: as mesas na posição real, com cor, ícone e
   texto do estado (nunca só a cor). Toque abre a mesa.

   Edição (computador e tablet): arrastar para mover, puxar o
   canto para redimensionar, setas do teclado para ajustar
   de 10 em 10 (Shift: 50). No celular a planta fica só para
   consulta e as mesas são cadastradas pela lista — sem gestos
   imprecisos. Salvar passa pelo servidor, que confere o limite
   de mesas do plano e se alguém mudou a planta ao mesmo tempo.
========================================================= */

const GRID = 10;
const snap = (value) => Math.round(value / GRID) * GRID;

const SHAPES = { square: "Quadrada", round: "Redonda", rect: "Retangular", bar: "Balcão" };

const usePlanScale = (ref, contentWidth) => {
    const [width, setWidth] = useState(0);
    useLayoutEffect(() => {
        const node = ref.current;
        if (!node) return undefined;
        const update = () => setWidth(node.clientWidth);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(node);
        return () => observer.disconnect();
    }, [ref]);
    return width ? Math.min(1.2, width / Math.max(contentWidth, 640)) : 1;
};

const bounds = (tables) => {
    const list = Object.values(tables);
    return {
        w: Math.max(720, ...list.map((table) => (table.x || 0) + (table.w || 90) + 60)),
        h: Math.max(420, ...list.map((table) => (table.y || 0) + (table.h || 90) + 60))
    };
};

export const PlanView = ({ tables, areaId, views, onSelect, compact }) => {
    const ref = useRef(null);
    const inArea = useMemo(() => Object.fromEntries(Object.entries(tables).filter(([, table]) => !areaId || table.areaId === areaId)), [tables, areaId]);
    const size = bounds(inArea);
    const scale = usePlanScale(ref, size.w);

    return (
        <div ref={ref} className="mnu-plan">
            <div className="mnu-plan__canvas" style={{ height: size.h * scale }}>
                <div className="mnu-plan__stage" style={{ width: size.w, height: size.h, transform: `scale(${scale})` }}>
                    {Object.entries(inArea).map(([id, table]) => {
                        const view = views[id] || { status: "free" };
                        const meta = TABLE_STATUS[view.status] || TABLE_STATUS.free;
                        return (
                            <button
                                key={id}
                                type="button"
                                className={cx("mnu-ptable", `is-${table.shape || "square"}`, `mnu-status--${view.status}`, view.attention && "has-attention")}
                                style={{ left: table.x || 0, top: table.y || 0, width: table.w || 90, height: table.h || 90, transform: table.rotation ? `rotate(${table.rotation}deg)` : undefined }}
                                onClick={() => onSelect(id)}
                                aria-label={`${table.label}: ${meta.label}${view.guests ? `, ${view.guests} pessoas` : ""}${view.totalCents ? `, ${formatBRL(view.totalCents)}` : ""}`}
                            >
                                <b>{table.label.replace(/^Mesa\s+/i, "")}</b>
                                <small><Icon icon={meta.icon} aria-hidden="true" /> {compact ? "" : meta.label}</small>
                                {view.status !== "free" && view.status !== "unavailable" && view.status !== "reserved" && !compact && (
                                    <small>{durationLabel(view.elapsed)}</small>
                                )}
                                {view.attention && <span className="mnu-ptable__alert" aria-hidden="true"><Icon icon="solar:bell-bing-bold" /></span>}
                            </button>
                        );
                    })}
                    {!Object.keys(inArea).length && <p className="mnu-plan__empty">Nenhuma mesa neste ambiente.</p>}
                </div>
            </div>
        </div>
    );
};

/* ---------- EDITOR ---------- */

export const FloorEditor = ({ floor, onClose }) => {
    const { act, maxTables, tableState } = useMenus();
    const canDrag = !useMediaQuery("(max-width: 719px)");

    const [areas, setAreas] = useState(() => ({ ...(floor.areas || {}) }));
    const [tables, setTables] = useState(() => ({ ...(floor.tables || {}) }));
    const [areaId, setAreaId] = useState(() => Object.keys(floor.areas || {})[0] || null);
    const [selected, setSelected] = useState(null);
    const [busy, setBusy] = useState(false);
    const [confirm, setConfirm] = useState(null);
    const [error, setError] = useState("");

    const ref = useRef(null);
    const drag = useRef(null);

    useEffect(() => {
        if (!Object.keys(areas).length) {
            const id = pushId().slice(-10);
            setAreas({ [id]: { name: "Salão", order: 0 } });
            setAreaId(id);
        }
    }, [areas]);

    const inArea = Object.fromEntries(Object.entries(tables).filter(([, table]) => table.areaId === areaId));
    const size = bounds(inArea);
    const scale = usePlanScale(ref, size.w);

    const total = Object.keys(tables).length;
    const limitReached = maxTables !== null && maxTables !== undefined && total >= maxTables;

    const patchTable = (id, patch) => setTables((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

    const addTable = () => {
        if (limitReached) return;
        const id = pushId().slice(-12);
        const numbers = Object.values(tables).map((table) => Number(String(table.label).match(/(\d+)$/)?.[1]) || 0);
        const next = Math.max(0, ...numbers) + 1;
        const count = Object.keys(inArea).length;
        patchTable(id, { label: `Mesa ${next}`, seats: 4, areaId, shape: "square", x: 40 + (count % 5) * 140, y: 40 + Math.floor(count / 5) * 140, w: 96, h: 96, order: total });
        setSelected(id);
    };

    const addArea = () => {
        const id = pushId().slice(-10);
        setAreas((current) => ({ ...current, [id]: { name: `Ambiente ${Object.keys(current).length + 1}`, order: Object.keys(current).length } }));
        setAreaId(id);
    };

    const onPointerDown = (event, id, mode) => {
        if (!canDrag) return;
        event.preventDefault();
        event.stopPropagation();
        setSelected(id);
        const table = tables[id];
        drag.current = { id, mode, startX: event.clientX, startY: event.clientY, x: table.x || 0, y: table.y || 0, w: table.w || 90, h: table.h || 90 };
        event.currentTarget.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event) => {
        const state = drag.current;
        if (!state) return;
        const dx = (event.clientX - state.startX) / scale;
        const dy = (event.clientY - state.startY) / scale;
        if (state.mode === "move") patchTable(state.id, { x: Math.max(0, snap(state.x + dx)), y: Math.max(0, snap(state.y + dy)) });
        else patchTable(state.id, { w: Math.max(50, snap(state.w + dx)), h: Math.max(50, snap(state.h + dy)) });
    };

    const onPointerUp = () => {
        drag.current = null;
    };

    const onKeyDown = (event, id) => {
        const step = event.shiftKey ? 50 : GRID;
        const table = tables[id];
        const moves = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
        if (moves[event.key]) {
            event.preventDefault();
            patchTable(id, { x: Math.max(0, (table.x || 0) + moves[event.key][0]), y: Math.max(0, (table.y || 0) + moves[event.key][1]) });
        }
        if (event.key === "Delete" && !tableState[id]?.tabId) removeTable(id);
    };

    const removeTable = (id) => {
        if (tableState[id]?.tabId) {
            setError(`${tables[id].label} está aberta. Feche a comanda antes de remover a mesa.`);
            return;
        }
        setTables((current) => {
            const next = { ...current };
            delete next[id];
            return next;
        });
        setSelected(null);
    };

    const save = async () => {
        setBusy(true);
        setError("");
        try {
            await act("floor.save", { areas, tables, baseVersion: floor.version ?? null }, { success: "Planta salva" });
            onClose();
        } catch (problem) {
            setError(problem.message);
        } finally {
            setBusy(false);
        }
    };

    const current = selected ? tables[selected] : null;
    const areaList = Object.entries(areas).sort(([, a], [, b]) => (a.order || 0) - (b.order || 0));

    return (
        <div className="mnu-floored">
            <div className="mnu-floored__bar">
                <div className="mnu-chips" role="group" aria-label="Ambientes">
                    {areaList.map(([id, area]) => (
                        <button key={id} type="button" className="mk-chip" aria-pressed={areaId === id} onClick={() => { setAreaId(id); setSelected(null); }}>{area.name}</button>
                    ))}
                    <Button size="sm" variant="ghost" icon="solar:add-circle-linear" onClick={addArea}>Ambiente</Button>
                </div>
                <div className="mnu-row">
                    <Button size="sm" variant="outline" icon="solar:add-square-linear" onClick={addTable} disabled={limitReached} title={limitReached ? `O plano permite até ${maxTables} mesas` : undefined}>Mesa</Button>
                    <Button size="sm" variant="ghost" onClick={onClose}>Cancelar</Button>
                    <Button size="sm" variant="primary" loading={busy} onClick={save}>Salvar planta</Button>
                </div>
            </div>

            <p className="mk-muted mnu-floored__hint">
                {canDrag
                    ? "Arraste as mesas para a posição real; puxe o canto para mudar o tamanho. Com uma mesa selecionada, use as setas do teclado."
                    : "No celular, edite as mesas pela lista abaixo. Para posicionar na planta, use um computador ou tablet."}
                {maxTables !== null && maxTables !== undefined && ` ${total} de ${maxTables} mesas do plano.`}
            </p>

            {error && <p className="mnu-alert is-bad" role="alert">{error}</p>}

            {areaId && areas[areaId] && (
                <div className="mnu-row">
                    <Field label="Nome do ambiente">
                        <input className="mk-input" value={areas[areaId].name} maxLength={40} onChange={(event) => setAreas({ ...areas, [areaId]: { ...areas[areaId], name: event.target.value } })} />
                    </Field>
                    <Button
                        size="sm"
                        variant="ghost"
                        icon="solar:trash-bin-minimalistic-linear"
                        disabled={Object.keys(inArea).length > 0 || areaList.length <= 1}
                        title={Object.keys(inArea).length ? "Mova ou remova as mesas antes" : undefined}
                        onClick={() => setConfirm({ run: () => { const next = { ...areas }; delete next[areaId]; setAreas(next); setAreaId(Object.keys(next)[0]); } })}
                    >
                        Remover ambiente
                    </Button>
                </div>
            )}

            <div className="mnu-floored__body">
                {canDrag && (
                    <div ref={ref} className="mnu-plan is-editing" onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}>
                        <div className="mnu-plan__canvas" style={{ height: size.h * scale }} onClick={() => setSelected(null)}>
                            <div className="mnu-plan__stage mnu-plan__stage--grid" style={{ width: size.w, height: size.h, transform: `scale(${scale})` }}>
                                {Object.entries(inArea).map(([id, table]) => (
                                    <div
                                        key={id}
                                        role="button"
                                        tabIndex={0}
                                        className={cx("mnu-ptable is-edit", `is-${table.shape || "square"}`, selected === id && "is-selected", table.disabled && "mnu-status--unavailable")}
                                        style={{ left: table.x || 0, top: table.y || 0, width: table.w || 90, height: table.h || 90, transform: table.rotation ? `rotate(${table.rotation}deg)` : undefined }}
                                        onPointerDown={(event) => onPointerDown(event, id, "move")}
                                        onKeyDown={(event) => onKeyDown(event, id)}
                                        onFocus={() => setSelected(id)}
                                        onClick={(event) => event.stopPropagation()}
                                        aria-label={`${table.label}, ${table.seats} lugares. Use as setas para mover.`}
                                    >
                                        <b>{table.label}</b>
                                        <small>{table.seats} lugares</small>
                                        <span className="mnu-ptable__resize" onPointerDown={(event) => onPointerDown(event, id, "resize")} aria-hidden="true" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <aside className="mnu-floored__side">
                    {current ? (
                        <div className="mnu-form">
                            <p className="mnu-label">Mesa selecionada</p>
                            <Field label="Identificador (aparece para todos)">
                                <input className="mk-input" value={current.label} maxLength={24} onChange={(event) => patchTable(selected, { label: event.target.value })} />
                            </Field>
                            <Field label="Apelido (opcional)">
                                <input className="mk-input" value={current.nickname || ""} maxLength={40} onChange={(event) => patchTable(selected, { nickname: event.target.value })} placeholder="Ex.: perto da janela" />
                            </Field>
                            <div className="mnu-grid-2">
                                <Field label="Lugares"><input className="mk-input" type="number" min="1" max="60" value={current.seats} onChange={(event) => patchTable(selected, { seats: Number(event.target.value) || 1 })} /></Field>
                                <Field label="Ambiente">
                                    <select className="mk-select" value={current.areaId || ""} onChange={(event) => patchTable(selected, { areaId: event.target.value })}>
                                        {areaList.map(([id, area]) => <option key={id} value={id}>{area.name}</option>)}
                                    </select>
                                </Field>
                            </div>
                            <Segmented label="Formato" size="sm" value={current.shape || "square"} onChange={(shape) => patchTable(selected, { shape, ...(shape === "rect" ? { w: 140, h: 90 } : shape === "bar" ? { w: 80, h: 60 } : {}) })} options={Object.entries(SHAPES).map(([value, label]) => ({ value, label }))} />
                            <Segmented label="Rotação" size="sm" value={String(current.rotation || 0)} onChange={(value) => patchTable(selected, { rotation: Number(value) })} options={[{ value: "0", label: "0°" }, { value: "45", label: "45°" }, { value: "90", label: "90°" }]} />
                            <label className="mnu-check">
                                <input type="checkbox" checked={Boolean(current.disabled)} onChange={(event) => patchTable(selected, { disabled: event.target.checked })} />
                                <span><b>Indisponível</b><small>Manutenção, interditada ou fora de uso hoje</small></span>
                            </label>
                            <Button variant="danger" icon="solar:trash-bin-minimalistic-linear" onClick={() => removeTable(selected)}>Remover mesa</Button>
                        </div>
                    ) : (
                        <p className="mk-muted">Selecione uma mesa para editar nome, lugares, formato e ambiente.</p>
                    )}

                    <p className="mnu-label">Mesas neste ambiente</p>
                    <ul className="mnu-flist">
                        {Object.entries(inArea).map(([id, table]) => (
                            <li key={id}>
                                <button type="button" className={cx(selected === id && "is-on")} onClick={() => setSelected(id)}>
                                    <b>{table.label}</b>
                                    <small>{table.seats} lugares · {SHAPES[table.shape || "square"]}{table.disabled ? " · indisponível" : ""}</small>
                                </button>
                            </li>
                        ))}
                    </ul>
                </aside>
            </div>

            <ConfirmDialog
                open={Boolean(confirm)}
                title="Remover este ambiente?"
                message="Ele está vazio. A mudança só vale depois de salvar a planta."
                confirmLabel="Remover"
                onClose={() => setConfirm(null)}
                onConfirm={() => {
                    confirm.run();
                    setConfirm(null);
                }}
            />
        </div>
    );
};
