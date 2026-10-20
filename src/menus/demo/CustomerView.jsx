import React, { useCallback, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";

import { Badge, Button, Segmented } from "../../design-system/components";
import { useMenus } from "../MenusContext.jsx";
import { listTables } from "../data/selectors.js";
import MenuRenderer from "../site/MenuRenderer.jsx";
import Frame from "../editor/Frame.jsx";
import { PageHead } from "../ui.jsx";

/* =========================================================
   DEMONSTRAÇÃO: O CARDÁPIO COMO O CLIENTE VÊ

   O cardápio publicado da empresa fictícia num celular (ou
   tablet/computador). Pedir aqui roda o mesmo fluxo do
   cardápio público — validação, preço do servidor, código do
   pedido e acompanhamento ao vivo — só que em memória.
   Também dá para simular o QR Code de uma mesa.
========================================================= */

export default function CustomerView() {
    const navigate = useNavigate();
    const { source, handle, site, draft, settings, catalog, floor, features, path } = useMenus();
    const [params, setParams] = useSearchParams();
    const [device, setDevice] = useState("mobile");
    const tableId = params.get("mesa");
    const tables = listTables(floor).filter((table) => !table.disabled);

    const actions = {
        placeOrder: (payload) => source.publicAction("public.placeOrder", payload),
        call: (type) => source.publicAction("public.call", { tableId, type }),
        watchTrack: (orderId, callback) => source.watch(`menusTrack/${handle}/${orderId}`, (value) => callback(value))
    };

    const watchTrack = useCallback(actions.watchTrack, [source, handle]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div className="std-page">
            <PageHead
                title="Visão do cliente"
                description="O cardápio publicado, como aparece no celular de quem escaneia o QR Code."
                actions={(
                    <>
                        <Badge tone="info">Pedidos de demonstração</Badge>
                        <Button variant="outline" icon="solar:clipboard-list-linear" onClick={() => navigate(path("pedidos"))}>Ver pedidos chegando</Button>
                    </>
                )}
            />

            <div className="mnu-toolbar">
                <Segmented
                    label="Dispositivo"
                    value={device}
                    onChange={setDevice}
                    options={[
                        { value: "mobile", label: "Celular", icon: "solar:smartphone-linear" },
                        { value: "tablet", label: "Tablet", icon: "solar:tablet-linear" },
                        { value: "desktop", label: "Computador", icon: "solar:monitor-linear" }
                    ]}
                />
                <label className="mnu-row">
                    <Icon icon="solar:qr-code-linear" aria-hidden="true" />
                    <select className="mk-select mnu-select" value={tableId || ""} onChange={(event) => setParams(event.target.value ? { mesa: event.target.value } : {})} aria-label="Simular QR Code de mesa">
                        <option value="">Cardápio geral (retirada e entrega)</option>
                        {tables.map((table) => <option key={table.id} value={table.id}>QR da {table.label}</option>)}
                    </select>
                </label>
            </div>

            {tableId && (
                <p className="mnu-alert is-info">
                    <Icon icon="solar:info-circle-linear" aria-hidden="true" />
                    Pedido pela mesa só é aceito com a mesa aberta pela equipe. Experimente uma mesa ocupada (Mesa 1, 2 ou 6) ou abra uma em Mesas e comandas.
                </p>
            )}

            <div className="mnu-customer">
                <Frame device={device}>
                    <MenuRenderer
                        key={tableId || "geral"}
                        design={site?.design || draft?.design}
                        settings={settings}
                        catalog={catalog}
                        floor={floor}
                        features={features}
                        mode="demo"
                        handle={handle}
                        tableId={tableId}
                        actions={{ ...actions, watchTrack }}
                    />
                </Frame>
            </div>
        </div>
    );
}
