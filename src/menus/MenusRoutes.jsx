import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { useMenus } from "./MenusContext.jsx";
import { Forbidden, LockedFeature } from "./ui.jsx";
import { LOCKED } from "./locked.js";

import Overview from "./pages/Overview.jsx";
import Catalog from "./pages/Catalog.jsx";
import Editor from "./editor/Editor.jsx";
import Publish from "./pages/Publish.jsx";
import Tables from "./tables/Tables.jsx";
import Orders from "./pages/Orders.jsx";
import Pos from "./pages/Pos.jsx";
import Kitchen from "./pages/Kitchen.jsx";
import Cashier from "./pages/Cashier.jsx";
import Stock from "./pages/Stock.jsx";
import Reports from "./pages/Reports.jsx";
import Customers from "./pages/Customers.jsx";
import Team from "./pages/Team.jsx";
import Units from "./pages/Units.jsx";
import Settings from "./pages/Settings.jsx";
import Integrations from "./pages/Integrations.jsx";
import Plan from "./pages/Plan.jsx";
import Onboarding from "./pages/Onboarding.jsx";
import CustomerView from "./demo/CustomerView.jsx";
import PickupDisplay from "./pages/PickupDisplay.jsx";
import DisplayTV from "./display/DisplayTV.jsx";

const DISPLAY_PERMS = ["orders.view", "kitchen.view"];

/* =========================================================
   ROTAS DO MENUS (relativas a /menus ou /menus/demo)

   Cada tela confere a permissão e o recurso do plano antes de
   mostrar qualquer coisa. Isso é conforto de interface: a
   decisão de verdade acontece no servidor e nas regras do
   banco, então trocar a URL não libera nada.
========================================================= */

const Guard = ({ perm, feature, children, what }) => {
    const { can, features } = useMenus();
    const perms = Array.isArray(perm) ? perm : perm ? [perm] : [];
    if (perms.length && !perms.some(can)) return <Forbidden what={what} />;
    if (feature && !features[feature]) return <LockedFeature {...LOCKED[feature]} />;
    return children;
};

export default function MenusRoutes({ shell }) {
    const { demo } = useMenus();

    return (
        <Routes>
            <Route path="editor" element={<Guard perm="design.edit" what="o editor visual"><Editor /></Guard>} />
            <Route path="cozinha" element={<Guard perm="kitchen.view" feature="menusPos" what="a tela da cozinha"><Kitchen /></Guard>} />
            <Route path="senhas/tv" element={<Guard perm={DISPLAY_PERMS} what="o monitor de retirada"><DisplayTV /></Guard>} />
            <Route path="comecar" element={<Guard perm="settings.edit" what="a configuração inicial"><Onboarding /></Guard>} />
            <Route
                path="*"
                element={shell(
                    <Routes>
                        <Route index element={<Overview />} />
                        <Route path="cardapio" element={<Guard perm="catalog.view" what="o cardápio"><Catalog /></Guard>} />
                        <Route path="publicar" element={<Guard perm="design.edit" what="a publicação"><Publish /></Guard>} />
                        <Route path="mesas" element={<Guard perm="tables.view" feature="menusTables" what="as mesas"><Tables /></Guard>} />
                        <Route path="pedidos" element={<Guard perm={["orders.view", "delivery.view"]} what="os pedidos"><Orders /></Guard>} />
                        <Route path="entregas" element={<Guard perm={["orders.view", "delivery.view"]} what="as entregas"><Orders preset="delivery" /></Guard>} />
                        <Route path="pdv" element={<Guard perm="orders.create" feature="menusPos" what="o PDV"><Pos /></Guard>} />
                        <Route path="senhas" element={<Guard perm={DISPLAY_PERMS} what="o monitor de retirada"><PickupDisplay /></Guard>} />
                        <Route path="caixa" element={<Guard perm={["tabs.payment", "orders.payment"]} what="o caixa"><Cashier /></Guard>} />
                        <Route path="estoque" element={<Guard perm="stock.view" feature="menusStock" what="o estoque"><Stock /></Guard>} />
                        <Route path="relatorios" element={<Guard perm="reports.view" what="os relatórios"><Reports /></Guard>} />
                        <Route path="clientes" element={<Guard perm="customers.view" what="os clientes"><Customers /></Guard>} />
                        <Route path="equipe" element={<Guard perm="team.manage" what="a equipe"><Team /></Guard>} />
                        <Route path="unidades" element={<Guard perm="settings.edit" what="as unidades"><Units /></Guard>} />
                        <Route path="configuracoes" element={<Guard perm="settings.edit" what="as configurações"><Settings /></Guard>} />
                        <Route path="configuracoes/:section" element={<Guard perm="settings.edit" what="as configurações"><Settings /></Guard>} />
                        <Route path="integracoes" element={<Guard perm="settings.edit" what="as integrações"><Integrations /></Guard>} />
                        <Route path="plano" element={<Plan />} />
                        {demo && <Route path="cliente" element={<CustomerView />} />}
                        <Route path="*" element={<Navigate to="." replace />} />
                    </Routes>
                )}
            />
        </Routes>
    );
}

