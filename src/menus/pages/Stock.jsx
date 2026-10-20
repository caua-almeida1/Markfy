import React, { useState } from "react";
import { Icon } from "@iconify/react";

import { Badge, Button, Segmented, Sheet, Switch } from "../../design-system/components";
import { isLow, isOut, MOVE_TYPES } from "../engine/stock.js";
import { entries } from "../engine/util.js";
import { useMenus, useNode } from "../MenusContext.jsx";
import { listProducts } from "../data/selectors.js";
import { Thumb } from "../catalog/ProductEditor.jsx";
import { DemoTag, PageHead, Panel, Stat, dateTimeLabel } from "../ui.jsx";

/* =========================================================
   ESTOQUE (por produto)

   Ligue o controle nos produtos que fazem sentido. Pedido
   confirmado baixa; pedido cancelado devolve; quantidade
   zerada marca "esgotado" no cardápio sozinho. Toda
   movimentação passa pelo servidor e fica no histórico.

   Fichas técnicas por ingrediente ainda não fazem parte
   desta versão — nada é descontado de insumos que não estão
   cadastrados.
========================================================= */

export default function Stock() {
    const { catalog, stock, act, can, source, handle } = useMenus();
    const moves = useNode(source, handle && `menusStockMoves/${handle}`, { orderBy: "at", limitToLast: 60 });
    const canEdit = can("stock.edit");

    const [filter, setFilter] = useState("tracked");
    const [moving, setMoving] = useState(null);

    const products = listProducts(catalog);
    const rows = products.map((product) => ({ product, entry: stock[product.id] || null }));
    const tracked = rows.filter((row) => row.entry?.track);
    const low = tracked.filter((row) => isLow(row.entry));
    const out = tracked.filter((row) => isOut(row.entry));

    const shown = filter === "tracked" ? tracked : filter === "alerts" ? [...out, ...low] : rows;
    const names = Object.fromEntries(products.map((product) => [product.id, product.name]));

    return (
        <div className="std-page">
            <PageHead title="Estoque" description="Controle por produto, com baixa automática nos pedidos confirmados." actions={<DemoTag />} />

            <div className="std-stats mnu-stats">
                <Stat label="Com controle" icon="solar:box-linear" value={tracked.length} hint={`de ${products.length} produtos`} />
                <Stat label="Estoque baixo" icon="solar:danger-triangle-linear" value={low.length} tone={low.length ? "warning" : undefined} />
                <Stat label="Esgotados" icon="solar:forbidden-circle-linear" value={out.length} tone={out.length ? "danger" : undefined} hint="marcados no cardápio" />
                <Stat label="Movimentações" icon="solar:history-linear" value={entries(moves.value).length} hint="últimas registradas" />
            </div>

            {(low.length > 0 || out.length > 0) && (
                <p className="mnu-alert is-warn">
                    <Icon icon="solar:danger-triangle-linear" aria-hidden="true" />
                    {out.length ? `${out.map((row) => row.product.name).join(", ")} esgotado(s). ` : ""}
                    {low.length ? `${low.map((row) => row.product.name).join(", ")} abaixo do mínimo.` : ""}
                </p>
            )}

            <div className="mnu-toolbar">
                <Segmented label="Mostrar" value={filter} onChange={setFilter} options={[{ value: "tracked", label: "Com controle" }, { value: "alerts", label: "Alertas" }, { value: "all", label: "Todos os produtos" }]} />
            </div>

            <div className="std-panel std-panel--flush">
                <div className="mnu-table-wrap">
                    <table className="mnu-table">
                        <thead>
                            <tr>
                                <th scope="col">Produto</th>
                                <th scope="col">Controle</th>
                                <th scope="col">Quantidade</th>
                                <th scope="col">Mínimo</th>
                                <th scope="col">Situação</th>
                                <th scope="col"><span className="mk-visually-hidden">Ações</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            {shown.map(({ product, entry }) => (
                                <tr key={product.id}>
                                    <th scope="row"><span className="mnu-cell-product"><Thumb src={product.image} name={product.name} /> {product.name}</span></th>
                                    <td>
                                        <Switch
                                            checked={Boolean(entry?.track)}
                                            disabled={!canEdit}
                                            label={`Controlar estoque de ${product.name}`}
                                            onChange={(value) => act("stock.set", { productId: product.id, track: value, ...(value && !entry ? { qty: 0, min: 0 } : {}) }, { success: value ? "Controle ligado" : "Controle desligado" }).catch(() => null)}
                                        />
                                    </td>
                                    <td className="mnu-num">{entry?.track ? entry.qty : "—"}</td>
                                    <td className="mnu-num">{entry?.track ? entry.min || 0 : "—"}</td>
                                    <td>
                                        {!entry?.track ? <span className="mk-muted">Sem controle</span> : isOut(entry) ? <Badge tone="danger">Esgotado</Badge> : isLow(entry) ? <Badge tone="warning">Baixo</Badge> : <Badge tone="success">OK</Badge>}
                                    </td>
                                    <td className="mnu-actions">
                                        {entry?.track && canEdit && <Button size="sm" onClick={() => setMoving({ product, entry, type: "entry", qty: 1, min: entry.min || 0, reason: "" })}>Movimentar</Button>}
                                    </td>
                                </tr>
                            ))}
                            {!shown.length && (
                                <tr><td colSpan={6} className="mk-muted">{filter === "tracked" ? "Nenhum produto com controle. Use “Todos os produtos” para ligar." : "Nada aqui."}</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <Panel title="Histórico de movimentações" description="Vendas, devoluções por cancelamento, entradas, perdas e contagens.">
                <ul className="std-list">
                    {entries(moves.value).sort((a, b) => b.at - a.at).map((move) => (
                        <li key={move.id}>
                            <div className="std-row">
                                <span className={`std-row__icon ${move.delta < 0 ? "mnu-tone--bad" : "mnu-tone--ok"}`}><Icon icon={move.delta < 0 ? "solar:arrow-down-linear" : "solar:arrow-up-linear"} /></span>
                                <span className="std-row__body">
                                    <span className="std-row__title">{names[move.productId] || "Produto removido"} · {MOVE_TYPES[move.type]?.label || move.type}</span>
                                    <span className="std-row__meta">{dateTimeLabel(move.at)}{move.reason ? ` · ${move.reason}` : ""}</span>
                                </span>
                                <span className="std-row__aside"><strong>{move.delta > 0 ? "+" : ""}{move.delta}</strong>fica {move.after}</span>
                            </div>
                        </li>
                    ))}
                    {!entries(moves.value).length && <li className="mk-muted">Nenhuma movimentação ainda.</li>}
                </ul>
            </Panel>

            <Panel title="Ingredientes e fichas técnicas">
                <p className="mk-muted">
                    Ainda não disponível. Nesta versão o controle é por produto pronto; o consumo de ingredientes por
                    receita será adicionado depois, sem estimar o que não estiver cadastrado.
                </p>
            </Panel>

            <Sheet
                open={Boolean(moving)}
                onClose={() => setMoving(null)}
                side="center"
                title={moving ? `Movimentar · ${moving.product.name}` : ""}
                description={moving ? `Hoje: ${moving.entry.qty} un.` : ""}
                footer={moving && (
                    <>
                        <Button variant="ghost" onClick={() => setMoving(null)}>Cancelar</Button>
                        <Button
                            variant="primary"
                            onClick={async () => {
                                try {
                                    if (moving.type === "adjust") await act("stock.set", { productId: moving.product.id, qty: moving.qty, min: moving.min }, { success: "Contagem registrada" });
                                    else await act("stock.move", { productId: moving.product.id, type: moving.type, delta: moving.qty, reason: moving.reason }, { success: "Movimentação registrada" });
                                    setMoving(null);
                                } catch {
                                    /* aviso já exibido */
                                }
                            }}
                        >
                            Registrar
                        </Button>
                    </>
                )}
            >
                {moving && (
                    <div className="mnu-form">
                        <Segmented label="Tipo" value={moving.type} onChange={(type) => setMoving({ ...moving, type, qty: type === "adjust" ? moving.entry.qty : 1 })} options={[{ value: "entry", label: "Entrada" }, { value: "loss", label: "Perda" }, { value: "adjust", label: "Contagem" }]} />
                        <label className="mk-field">
                            <span className="mk-field__label">{moving.type === "adjust" ? "Quantidade contada" : "Quantidade"}</span>
                            <input className="mk-input" type="number" min="0" value={moving.qty} onChange={(event) => setMoving({ ...moving, qty: Number(event.target.value) })} />
                        </label>
                        {moving.type === "adjust" ? (
                            <label className="mk-field">
                                <span className="mk-field__label">Estoque mínimo (aviso)</span>
                                <input className="mk-input" type="number" min="0" value={moving.min} onChange={(event) => setMoving({ ...moving, min: Number(event.target.value) })} />
                            </label>
                        ) : (
                            <label className="mk-field">
                                <span className="mk-field__label">Motivo (opcional)</span>
                                <input className="mk-input" value={moving.reason} maxLength={140} onChange={(event) => setMoving({ ...moving, reason: event.target.value })} placeholder={moving.type === "loss" ? "Ex.: venceu, caiu" : "Ex.: produção do dia"} />
                            </label>
                        )}
                    </div>
                )}
            </Sheet>
        </div>
    );
}
