import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Icon } from "@iconify/react";

import CompanyPicker from "../components/company-picker/CompanyPicker";
import { Badge, Button, Sheet, cx } from "../design-system/components";
import { entries } from "./engine/util.js";
import { useMenus } from "./MenusContext.jsx";

import markfyLogo from "../img/logo-markfy.svg";

/* =========================================================
   CASCA DO MARKFY MENUS

   Menu lateral no desktop, barra inferior no celular — o
   mesmo formato do Studio, com a cor do Menus. "Mesas e
   comandas" fica no topo da Operação e também como atalho
   fixo: quem atende não passa pelo editor para chegar lá.

   Cada item declara a permissão e o recurso do plano que
   exige. Sem permissão: some. Sem o recurso no plano: fica
   visível com cadeado e abre a explicação do upgrade.
========================================================= */

export const NAV_GROUPS = [
    {
        label: "Visão geral",
        items: [{ to: "", label: "Painel", icon: "solar:widget-5-linear", end: true }]
    },
    {
        label: "Operação",
        items: [
            { to: "mesas", label: "Mesas e comandas", icon: "solar:armchair-2-linear", perm: "tables.view", feature: "menusTables", badge: "calls" },
            { to: "pedidos", label: "Pedidos", icon: "solar:clipboard-list-linear", perm: "orders.view", badge: "orders" },
            { to: "pdv", label: "PDV / Balcão", icon: "solar:cart-large-4-linear", perm: "orders.create", feature: "menusPos" },
            { to: "cozinha", label: "Cozinha", icon: "solar:chef-hat-linear", perm: "kitchen.view", feature: "menusPos" },
            { to: "senhas", label: "Monitor de retirada", icon: "solar:tv-linear", perm: ["orders.view", "kitchen.view"] },
            { to: "caixa", label: "Caixa", icon: "solar:wallet-money-linear", perm: "tabs.payment" },
            { to: "entregas", label: "Delivery e retirada", icon: "solar:scooter-linear", perm: ["orders.view", "delivery.view"] }
        ]
    },
    {
        label: "Meu cardápio",
        items: [
            { to: "cardapio", label: "Cardápios e produtos", icon: "solar:document-text-linear", perm: "catalog.view" },
            { to: "editor", label: "Editor visual", icon: "solar:pallete-2-linear", perm: "design.edit" },
            { to: "publicar", label: "Publicação e QR Codes", icon: "solar:qr-code-linear", perm: "design.edit" }
        ]
    },
    {
        label: "Gestão",
        items: [
            { to: "estoque", label: "Estoque", icon: "solar:box-linear", perm: "stock.view", feature: "menusStock" },
            { to: "relatorios", label: "Relatórios", icon: "solar:chart-2-linear", perm: "reports.view" },
            { to: "clientes", label: "Clientes", icon: "solar:users-group-two-rounded-linear", perm: "customers.view" },
            { to: "equipe", label: "Equipe e permissões", icon: "solar:shield-user-linear", perm: "team.manage" },
            { to: "unidades", label: "Unidades", icon: "solar:buildings-2-linear", perm: "settings.edit" }
        ]
    },
    {
        label: "Configurações",
        items: [
            { to: "configuracoes", label: "Empresa e operação", icon: "solar:settings-linear", perm: "settings.edit" },
            { to: "integracoes", label: "Integrações", icon: "solar:plug-circle-linear", perm: "settings.edit" },
            { to: "plano", label: "Plano e assinatura", icon: "solar:cup-star-linear", perm: "plan.manage" }
        ]
    }
];

const MOBILE_PRIMARY = ["", "mesas", "pedidos", "cardapio"];

const useVisibleNav = () => {
    const { can, features } = useMenus();
    return useMemo(
        () =>
            NAV_GROUPS.map((group) => ({
                ...group,
                items: group.items
                    .filter((item) => !item.perm || (Array.isArray(item.perm) ? item.perm.some(can) : can(item.perm)))
                    .map((item) => ({ ...item, locked: Boolean(item.feature && !features[item.feature]) }))
            })).filter((group) => group.items.length),
        [can, features]
    );
};

const NavItem = ({ item, compact, onNavigate }) => {
    const reduce = useReducedMotion();
    const { path, orders, calls } = useMenus();

    const count = item.badge === "orders"
        ? entries(orders).filter((order) => order.status === "received").length
        : item.badge === "calls"
            ? entries(calls).length
            : 0;

    return (
        <NavLink
            to={path(item.to)}
            end={item.end}
            className={({ isActive }) => cx("std-nav__item", isActive && "is-active", compact && "is-compact")}
            onClick={onNavigate}
        >
            {({ isActive }) => (
                <>
                    {isActive && (
                        <motion.span
                            layoutId={compact ? "mnu-nav-pill-m" : "mnu-nav-pill"}
                            className="std-nav__pill"
                            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                        />
                    )}
                    <Icon icon={item.icon} aria-hidden="true" />
                    <span className="std-nav__label">{item.label}</span>
                    {item.locked && <Icon icon="solar:lock-keyhole-minimalistic-linear" className="mnu-nav__lock" aria-label="Não incluído no plano" />}
                    {!item.locked && count > 0 && <span className="std-nav__count" aria-label={`${count} aguardando`}>{count}</span>}
                </>
            )}
        </NavLink>
    );
};

export default function Shell({ children, companyName, companyLogo, canSwitch, topSlot }) {
    const location = useLocation();
    const navigate = useNavigate();
    const { path, site, demo, soundOn, toggleSound, allowed, settings, online } = useMenus();
    const groups = useVisibleNav();

    const [moreOpen, setMoreOpen] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);

    useEffect(() => {
        setMoreOpen(false);
        window.scrollTo({ top: 0 });
    }, [location.pathname]);

    const flat = groups.flatMap((group) => group.items);
    const mobile = flat.filter((item) => MOBILE_PRIMARY.includes(item.to)).slice(0, 4);
    const publicUrl = site?.slug ? `${window.location.origin}/m/${site.slug}` : null;

    return (
        <div className={cx("mk-root std mnu", demo && "mnu--demo")}>
            <aside className="std-side" aria-label="Menu do Markfy Menus">
                <div className="std-side__top">
                    <button type="button" className="std-brand std-brand--button" onClick={() => navigate(demo ? "/home" : "/home")} title="Voltar para a Markfy">
                        <img src={markfyLogo} alt="" />
                        Markfy <em>Menus</em>
                    </button>

                    <button
                        type="button"
                        className="std-company"
                        onClick={canSwitch ? () => setPickerOpen(true) : undefined}
                        disabled={!canSwitch}
                        aria-label={canSwitch ? "Trocar de empresa" : undefined}
                    >
                        <span className="std-company__logo">
                            {companyLogo ? <img src={companyLogo} alt="" /> : (companyName || "M").charAt(0)}
                        </span>
                        <span className="std-company__text">
                            <strong>{companyName}</strong>
                            <small>{demo ? "Empresa fictícia" : settings.slug ? `/m/${settings.slug}` : "Markfy Menus"}</small>
                        </span>
                        {canSwitch && <Icon icon="solar:sort-vertical-linear" aria-hidden="true" />}
                    </button>

                    {allowed("tables.view") && (
                        <Button variant="primary" block icon="solar:armchair-2-bold" onClick={() => navigate(path("mesas"))}>
                            Mesas e comandas
                        </Button>
                    )}
                </div>

                <div className="std-nav mnu-nav" role="navigation" aria-label="Seções do Menus">
                    {groups.map((group) => (
                        <div key={group.label} className="mnu-nav__group">
                            <span className="mnu-nav__heading">{group.label}</span>
                            {group.items.map((item) => <NavItem key={item.to || "home"} item={item} />)}
                        </div>
                    ))}
                </div>

                <div className="std-side__bottom">
                    <button type="button" className="std-switch mnu-sound" onClick={toggleSound} aria-pressed={soundOn}>
                        <Icon icon={soundOn ? "solar:volume-loud-linear" : "solar:volume-cross-linear"} aria-hidden="true" />
                        {soundOn ? "Som de novos pedidos ligado" : "Som de novos pedidos desligado"}
                    </button>
                    <button type="button" className="std-switch" onClick={() => navigate("/home")}>
                        <Icon icon="solar:round-transfer-horizontal-bold" aria-hidden="true" />
                        Trocar de plataforma
                    </button>
                    <div className="std-status">
                        {site?.publishedAt ? <Badge tone="success">Cardápio publicado</Badge> : <Badge tone="warning">Ainda não publicado</Badge>}
                        {publicUrl && (
                            <a href={demo ? path("cliente") : publicUrl} target={demo ? undefined : "_blank"} rel="noopener noreferrer" className="std-status__link">
                                Ver como cliente
                                <Icon icon="solar:arrow-right-up-linear" aria-hidden="true" />
                            </a>
                        )}
                    </div>
                </div>
            </aside>

            <header className="std-mtop">
                <button type="button" className="std-brand std-brand--button" onClick={() => navigate("/home")}>
                    <img src={markfyLogo} alt="" />
                    Menus
                </button>
                <button
                    type="button"
                    className="std-mtop__company"
                    onClick={canSwitch ? () => setPickerOpen(true) : undefined}
                    disabled={!canSwitch}
                >
                    <span>{companyName}</span>
                    {canSwitch && <Icon icon="solar:alt-arrow-down-linear" aria-hidden="true" />}
                </button>
            </header>

            <main className="std-main">
                {!online && (
                    <div className="mnu-offline" role="status">
                        <Icon icon="solar:danger-triangle-linear" aria-hidden="true" />
                        Sem conexão. Mesas, pedidos e pagamentos voltam a funcionar assim que a internet voltar.
                    </div>
                )}
                {topSlot}
                <div key={location.pathname} className="mk-enter">
                    {children}
                </div>
            </main>

            <div className="std-mnav" role="navigation" aria-label="Seções do Menus">
                {mobile.map((item) => (
                    <NavItem key={item.to || "home"} item={{ ...item, label: item.to === "mesas" ? "Mesas" : item.to === "cardapio" ? "Cardápio" : item.label }} compact />
                ))}
                <button
                    type="button"
                    className={cx("std-nav__item is-compact", moreOpen && "is-active")}
                    onClick={() => setMoreOpen(true)}
                    aria-haspopup="dialog"
                >
                    <Icon icon="solar:menu-dots-circle-linear" aria-hidden="true" />
                    <span className="std-nav__label">Mais</span>
                </button>
            </div>

            <Sheet open={moreOpen} onClose={() => setMoreOpen(false)} title="Mais opções">
                <div className="std-more">
                    {groups.map((group) => {
                        const rest = group.items.filter((item) => !mobile.some((m) => m.to === item.to));
                        if (!rest.length) return null;
                        return (
                            <div key={group.label} className="mnu-nav__group">
                                <span className="mnu-nav__heading">{group.label}</span>
                                {rest.map((item) => <NavItem key={item.to} item={item} onNavigate={() => setMoreOpen(false)} />)}
                            </div>
                        );
                    })}
                    <hr className="mk-divider" />
                    <button type="button" className="std-nav__item" onClick={toggleSound}>
                        <Icon icon={soundOn ? "solar:volume-loud-linear" : "solar:volume-cross-linear"} aria-hidden="true" />
                        <span className="std-nav__label">{soundOn ? "Desligar som de pedidos" : "Ligar som de pedidos"}</span>
                    </button>
                    <button type="button" className="std-nav__item" onClick={() => navigate("/home")}>
                        <Icon icon="solar:arrow-left-linear" aria-hidden="true" />
                        <span className="std-nav__label">Voltar para a Markfy</span>
                    </button>
                </div>
            </Sheet>

            {pickerOpen && <CompanyPicker variant="modal" onClose={() => setPickerOpen(false)} />}
        </div>
    );
}
