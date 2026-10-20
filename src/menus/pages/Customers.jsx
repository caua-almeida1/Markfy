import React, { useMemo, useState } from "react";
import { Icon } from "@iconify/react";

import { EmptyState } from "../../design-system/components";
import { formatBRL } from "../engine/money.js";
import { CHANNELS } from "../engine/orders.js";
import { entries } from "../engine/util.js";
import { useMenus, useNode, useNow } from "../MenusContext.jsx";
import { DemoTag, PageHead, dateTimeLabel } from "../ui.jsx";

/* =========================================================
   CLIENTES

   Quem pediu nos últimos 90 dias, agrupado por telefone (ou
   nome, quando não há telefone). Só aparece o que o cliente
   informou para o próprio pedido — nenhum dado é cruzado com
   outras fontes, e a lista existe só para o atendimento.
========================================================= */

export default function Customers() {
    const { source, handle } = useMenus();
    const now = useNow(300000);
    const since = Math.floor(now / 86400000) * 86400000 - 90 * 86400000;
    const node = useNode(source, handle && `menusOps/${handle}/orders`, { orderBy: "createdAt", startAt: since });
    const [query, setQuery] = useState("");

    const customers = useMemo(() => {
        const map = {};
        entries(node.value)
            .filter((order) => order.status !== "cancelled" && (order.customer?.phone || (order.customer?.name && order.source !== "staff")))
            .forEach((order) => {
                const name = order.customer.name || "Cliente";
                const key = order.customer.phone || name.toLowerCase();
                const row = (map[key] = map[key] || { key, name, phone: order.customer.phone || "", count: 0, cents: 0, last: 0, channels: {} });
                row.count += 1;
                row.cents += order.totals?.totalCents || 0;
                row.channels[order.channel] = (row.channels[order.channel] || 0) + 1;
                if (order.createdAt > row.last) {
                    row.last = order.createdAt;
                    row.name = name;
                }
            });
        return Object.values(map).sort((a, b) => b.last - a.last);
    }, [node.value]);

    const shown = customers.filter((row) => !query || `${row.name} ${row.phone}`.toLowerCase().includes(query.toLowerCase()));

    return (
        <div className="std-page">
            <PageHead title="Clientes" description="Quem pediu nos últimos 90 dias, com base nos dados informados nos próprios pedidos." actions={<DemoTag />} />

            <label className="mk-input-group mnu-search">
                <Icon icon="solar:magnifer-linear" aria-hidden="true" />
                <input className="mk-input" type="search" placeholder="Nome ou telefone" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar cliente" />
            </label>

            {!shown.length ? (
                <div className="std-panel"><EmptyState icon="solar:users-group-two-rounded-linear" title="Nenhum cliente ainda">Clientes aparecem aqui quando fazem pedidos com nome ou telefone.</EmptyState></div>
            ) : (
                <div className="std-panel std-panel--flush">
                    <div className="mnu-table-wrap">
                        <table className="mnu-table">
                            <thead>
                                <tr>
                                    <th scope="col">Cliente</th>
                                    <th scope="col">Telefone</th>
                                    <th scope="col">Pedidos</th>
                                    <th scope="col">Total</th>
                                    <th scope="col">Canais</th>
                                    <th scope="col">Último pedido</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shown.map((row) => (
                                    <tr key={row.key}>
                                        <th scope="row">{row.name}</th>
                                        <td>{row.phone ? <a href={`tel:+55${row.phone}`}>{row.phone}</a> : "—"}</td>
                                        <td className="mnu-num">{row.count}</td>
                                        <td className="mnu-num">{formatBRL(row.cents)}</td>
                                        <td>{Object.entries(row.channels).map(([id, count]) => `${CHANNELS[id]?.label || id} ${count}`).join(" · ")}</td>
                                        <td>{dateTimeLabel(row.last)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
            <p className="mk-muted">Os dados vêm só dos pedidos e servem para o atendimento. Não use para envio de mensagens sem o consentimento do cliente.</p>
        </div>
    );
}
