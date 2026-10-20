import React from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import { Badge, Button } from "../../design-system/components";
import { useMenus } from "../MenusContext.jsx";
import { PageHead, Panel, dateTimeLabel } from "../ui.jsx";

/* =========================================================
   INTEGRAÇÕES

   Estado HONESTO de cada canal. As modalidades são
   diferentes e não são apresentadas como equivalentes:

     link        botão que leva o cliente para outro app
     import      pedidos do canal entram no painel
     status      o status volta para o canal (bidirecional)
     catalog     cardápio, preços e disponibilidade sincronizados

   Nenhum conector externo está ativo nesta versão. O backend
   já tem a estrutura (importação com chave externa contra
   duplicidade, em menus-engine/actions.js); cada conector só
   é ligado depois de credenciais e aprovação do provedor.
========================================================= */

const MODES = {
    link: { label: "Link externo", tone: "info" },
    import: { label: "Importa pedidos", tone: undefined },
    status: { label: "Sincroniza status", tone: undefined },
    catalog: { label: "Sincroniza cardápio", tone: undefined }
};

const PROVIDERS = [
    { id: "ifood", name: "iFood", icon: "solar:bag-smile-linear", available: ["link"], planned: ["import", "status", "catalog"], note: "Depende de credenciamento como integradora no portal de parceiros do iFood." },
    { id: "ninetyNine", name: "99Food", icon: "solar:bag-4-linear", available: ["link"], planned: ["import", "status"], note: "Depende de acesso à API de parceiros da 99Food." },
    { id: "keeta", name: "Keeta", icon: "solar:bag-3-linear", available: ["link"], planned: ["import", "status"], note: "Depende de acesso de integradora junto à Keeta." },
    { id: "whatsapp", name: "WhatsApp Business (API oficial)", icon: "mdi:whatsapp", available: [], planned: ["status"], note: "Avisos automáticos ao cliente exigem conta aprovada na WhatsApp Business Platform. O botão de conversa (link wa.me) já funciona no cardápio." },
    { id: "mercadopago", name: "Mercado Pago (pagamento online)", icon: "simple-icons:mercadopago", available: [], planned: ["import"], note: "A Bookings já usa o Mercado Pago. Para o cardápio, a cobrança online ainda não foi liberada." },
    { id: "printer", name: "Impressoras térmicas", icon: "solar:printer-minimalistic-linear", available: ["browser"], planned: ["direct"], note: "Disponível: impressão pelo navegador (comprovante e via da cozinha, 80 mm). Em breve: envio direto ESC/POS." },
    { id: "delivery", name: "Plataformas de entrega", icon: "solar:scooter-linear", available: [], planned: ["import", "status"], note: "Conectores com empresas de logística serão avaliados conforme demanda." },
    { id: "erp", name: "Sistemas de gestão (ERP)", icon: "solar:server-square-linear", available: [], planned: ["catalog"], note: "Exportação de pedidos em CSV já disponível nos relatórios." }
];

export default function Integrations() {
    const navigate = useNavigate();
    const { settings, source, handle, user, notify, path, features, demo } = useMenus();
    const requests = settings.integrationRequests || {};

    const request = async (provider) => {
        try {
            await source.set(`menusSettings/${handle}/integrationRequests/${provider.id}`, { at: Date.now(), by: user?.uid || null, byName: user?.name || null });
            notify("success", "Pedido registrado", `Vamos avisar quando a integração com ${provider.name} estiver disponível.`);
        } catch (error) {
            notify("error", "Não foi possível registrar", error.message);
        }
    };

    return (
        <div className="std-page">
            <PageHead
                title="Integrações"
                description="O que já funciona, o que depende de credenciais do parceiro e o que ainda não existe — sem promessas."
            />

            {!features.menusIntegrations && (
                <p className="mnu-alert is-info">
                    <Icon icon="solar:info-circle-linear" aria-hidden="true" />
                    Os conectores com canais de venda farão parte dos planos com integrações. Links externos e impressão pelo navegador já funcionam em todos os planos.
                </p>
            )}

            <div className="mnu-integrations">
                {PROVIDERS.map((provider) => {
                    const linked = provider.available.includes("link") && settings.externalLinks?.[provider.id];
                    return (
                        <article key={provider.id} className="std-panel mnu-integration">
                            <header>
                                <span className="mnu-integration__icon"><Icon icon={provider.icon} aria-hidden="true" /></span>
                                <div>
                                    <h2>{provider.name}</h2>
                                    <span className="mnu-row">
                                        {provider.available.includes("link") && <Badge tone={linked ? "success" : "info"}>{linked ? "Link configurado" : "Link externo disponível"}</Badge>}
                                        {provider.available.includes("browser") && <Badge tone="success">Disponível</Badge>}
                                        {provider.planned.filter((mode) => MODES[mode]).map((mode) => <Badge key={mode} plain>{MODES[mode].label}: não disponível</Badge>)}
                                    </span>
                                </div>
                            </header>
                            <p className="mk-muted">{provider.note}</p>
                            <footer className="mnu-row">
                                {provider.available.includes("link") && <Button size="sm" variant="outline" onClick={() => navigate(path("configuracoes/empresa"))}>{linked ? "Editar link" : "Configurar link"}</Button>}
                                {provider.id === "printer" && <Button size="sm" variant="outline" onClick={() => navigate(path("pedidos"))}>Imprimir a partir de um pedido</Button>}
                                {provider.id === "erp" && <Button size="sm" variant="outline" onClick={() => navigate(path("relatorios"))}>Exportar relatórios</Button>}
                                {provider.planned.length > 0 && provider.id !== "printer" && provider.id !== "erp" && (
                                    requests[provider.id]
                                        ? <span className="mk-muted">Interesse registrado em {dateTimeLabel(requests[provider.id].at)}</span>
                                        : <Button size="sm" variant="ghost" disabled={demo} onClick={() => request(provider)}>Solicitar integração</Button>
                                )}
                            </footer>
                        </article>
                    );
                })}
            </div>

            <Panel title="Como as integrações vão funcionar">
                <ul className="mnu-facts">
                    <li><Icon icon="solar:link-round-angle-linear" aria-hidden="true" /> <span><b>Link externo:</b> só leva o cliente ao outro app. Nenhum pedido entra aqui.</span></li>
                    <li><Icon icon="solar:import-linear" aria-hidden="true" /> <span><b>Importação de pedidos:</b> pedidos do canal aparecem no mesmo painel, sem duplicar (cada pedido externo tem uma chave única).</span></li>
                    <li><Icon icon="solar:refresh-circle-linear" aria-hidden="true" /> <span><b>Status bidirecional:</b> confirmar, preparar e despachar aqui atualiza o canal.</span></li>
                    <li><Icon icon="solar:documents-linear" aria-hidden="true" /> <span><b>Catálogo:</b> preços e disponibilidade enviados ao canal, com o estoque como fonte única.</span></li>
                </ul>
            </Panel>
        </div>
    );
}
