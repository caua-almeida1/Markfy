import React, { useEffect, useState } from "react";
import { NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Icon } from "@iconify/react";

import { useAuth } from "../contexts/authContext";
import Team from "./pages/Team";
import Plan from "./pages/Plan";
import LicenseGate from "../plans/LicenseGate";
import CompanyPicker from "../components/company-picker/CompanyPicker";
import { Badge, Button, Sheet, ToastProvider, useBodyClass, cx } from "../design-system/components";

import { StudioProvider, useStudio, STATUS_META } from "./StudioContext";
import { watchLeads } from "./data/studioApi";

import Overview from "./pages/Overview";
import MySite from "./pages/MySite";
import Bookings from "./pages/Bookings";
import Contacts from "./pages/Contacts";
import Analytics from "./pages/Analytics";
import CompanySettings from "./pages/CompanySettings";
import Settings from "./pages/Settings";
import Editor from "./editor/Editor";

import markfyLogo from "../img/logo-markfy.svg";

import "./studio.css";
import "./studio-pages.css";

/* =========================================================
   MARKFY STUDIO — CASCA

   Rotas (relativas a /studio):

     /               Visão geral
     /site           Meu site (modelo, status, publicação)
     /editor         Editor visual (tela cheia)
     /agendamentos   Agendamentos vindos da Bookings
     /contatos       Contatos do formulário
     /analytics      Métricas da página
     /empresa        Minha empresa
     /configuracoes  Publicação, SEO e preferências
========================================================= */

export const NAV = [
    { to: "/studio", label: "Visão geral", icon: "solar:home-smile-angle-linear", end: true },
    { to: "/studio/site", label: "Meu site", icon: "solar:window-frame-linear" },
    { to: "/studio/agendamentos", label: "Agendamentos", icon: "solar:calendar-linear" },
    { to: "/studio/contatos", label: "Contatos", icon: "solar:inbox-linear", badge: "leads" },
    { to: "/studio/analytics", label: "Analytics", icon: "solar:chart-2-linear" },
    { to: "/studio/equipe", label: "Equipe", icon: "solar:users-group-rounded-linear" },
    { to: "/studio/plano", label: "Plano", icon: "solar:cup-star-linear" },
    { to: "/studio/empresa", label: "Minha empresa", icon: "solar:shop-2-linear" },
    { to: "/studio/configuracoes", label: "Configurações", icon: "solar:settings-linear" }
];

const MOBILE_PRIMARY = ["/studio", "/studio/site", "/studio/contatos", "/studio/analytics"];

const StudioLoader = ({ label = "Carregando seu Studio" }) => (
    <div className="mks-loader" role="status" aria-live="polite">
        <span className="mks-loader__mark">
            <img src={markfyLogo} alt="" />
        </span>
        <span>{label}…</span>
    </div>
);

/* ---------- ENTRADA SEM LOGIN ---------- */

const StudioWelcome = () => {
    const navigate = useNavigate();

    return (
        <div className="mk-root std-gate">
            <div className="std-gate__inner">
                <span className="std-brand">
                    <img src={markfyLogo} alt="" />
                    Markfy <em>Studio</em>
                </span>
                <h1 className="mk-title mk-title--xl">Sua página profissional, sem escrever código.</h1>
                <p className="mk-lead">
                    Escolha um modelo pensado para o seu tipo de negócio, ajuste textos, fotos e cores,
                    publique com um link próprio e receba agendamentos pela Markfy Bookings.
                </p>
                <ul className="std-gate__list">
                    <li><Icon icon="solar:pallete-2-linear" /> Modelos para barbearias, salões, clínicas, estúdios e autônomos</li>
                    <li><Icon icon="solar:calendar-linear" /> Serviços, preços e agenda vindos direto da Bookings</li>
                    <li><Icon icon="solar:chart-2-linear" /> Visitas, cliques e contatos medidos de verdade</li>
                </ul>
                <div className="std-gate__actions">
                    <Button variant="primary" size="lg" onClick={() => navigate("/login?redirect=/studio")}>
                        Entrar para começar
                    </Button>
                    <Button variant="ghost" size="lg" onClick={() => navigate("/home")}>
                        Voltar
                    </Button>
                </div>
            </div>
        </div>
    );
};

/* ---------- SEM EMPRESA ---------- */

const NoCompany = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();

    return (
        <div className="mk-root std-gate">
            <div className="std-gate__inner">
                <span className="std-brand">
                    <img src={markfyLogo} alt="" />
                    Markfy <em>Studio</em>
                </span>
                <h1 className="mk-title mk-title--lg">Primeiro, cadastre sua empresa</h1>
                <p className="mk-lead">
                    O Studio usa os dados da sua empresa na Markfy (nome, logo, endereço, serviços e
                    horários) para montar a página. Leva poucos minutos, e você não vai precisar
                    digitar nada disso de novo.
                </p>
                <div className="std-gate__actions">
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={() =>
                            navigate("/initial-setup", {
                                state: {
                                    name: currentUser?.displayName || "",
                                    email: currentUser?.email || "",
                                    id: currentUser?.uid
                                }
                            })
                        }
                    >
                        Cadastrar minha empresa
                    </Button>
                    <Button variant="ghost" size="lg" onClick={() => navigate("/home")}>
                        Voltar
                    </Button>
                </div>
                <p className="std-gate__hint">
                    Trabalha numa empresa que já usa a Markfy? Peça ao responsável um convite para a equipe.
                </p>
            </div>
        </div>
    );
};

/* ---------- NAVEGAÇÃO ---------- */

const NavItem = ({ item, onNavigate, compact }) => {
    const reduce = useReducedMotion();
    const { leadsNew } = useStudioCounters();

    return (
        <NavLink
            to={item.to}
            end={item.end}
            className={({ isActive }) => cx("std-nav__item", isActive && "is-active", compact && "is-compact")}
            onClick={onNavigate}
        >
            {({ isActive }) => (
                <>
                    {isActive && (
                        <motion.span
                            layoutId={compact ? "std-nav-pill-m" : "std-nav-pill"}
                            className="std-nav__pill"
                            transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                        />
                    )}
                    <Icon icon={item.icon} aria-hidden="true" />
                    <span className="std-nav__label">{item.label}</span>
                    {item.badge === "leads" && leadsNew > 0 && (
                        <span className="std-nav__count" aria-label={`${leadsNew} novos`}>{leadsNew}</span>
                    )}
                </>
            )}
        </NavLink>
    );
};

/* Contador de contatos novos para o selo do menu. */
const CountersContext = React.createContext({ leadsNew: 0 });
const useStudioCounters = () => React.useContext(CountersContext);

const CountersProvider = ({ children }) => {
    const { handle } = useStudio();
    const [leadsNew, setLeadsNew] = useState(0);

    useEffect(() => {
        if (!handle) return undefined;

        return watchLeads(handle, (leads) =>
            setLeadsNew(leads.filter((lead) => lead.status === "new").length)
        );
    }, [handle]);

    return <CountersContext.Provider value={{ leadsNew }}>{children}</CountersContext.Provider>;
};

const Shell = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();

    const { company, companyState, status, publicUrl, bundle } = useStudio();

    const [moreOpen, setMoreOpen] = useState(false);
    const [pickerOpen, setPickerOpen] = useState(false);

    const canSwitch = (companyState.companies?.length || 0) > 1;
    const meta = STATUS_META[status];

    useEffect(() => {
        setMoreOpen(false);
        window.scrollTo({ top: 0 });
    }, [location.pathname]);

    return (
        <div className="mk-root std">
            <aside className="std-side" aria-label="Menu do Studio">
                <div className="std-side__top">
                    <button type="button" className="std-brand std-brand--button" onClick={() => navigate("/home")} title="Voltar para a Markfy">
                        <img src={markfyLogo} alt="" />
                        Markfy <em>Studio</em>
                    </button>

                    <button
                        type="button"
                        className="std-company"
                        onClick={canSwitch ? () => setPickerOpen(true) : undefined}
                        disabled={!canSwitch}
                        aria-label={canSwitch ? "Trocar de empresa" : undefined}
                    >
                        <span className="std-company__logo">
                            {bundle?.logo ? <img src={bundle.logo} alt="" /> : company?.name?.charAt(0)}
                        </span>
                        <span className="std-company__text">
                            <strong>{company?.name}</strong>
                            <small>@{company?.handle}</small>
                        </span>
                        {canSwitch && <Icon icon="solar:sort-vertical-linear" aria-hidden="true" />}
                    </button>
                </div>

                <div className="std-nav" role="navigation" aria-label="Seções do Studio">
                    {NAV.map((item) => (
                        <NavItem key={item.to} item={item} />
                    ))}
                </div>

                <div className="std-side__bottom">
                    <button type="button" className="std-switch" onClick={() => navigate("/home")}>
                        <Icon icon="solar:round-transfer-horizontal-bold" aria-hidden="true" />
                        Trocar de plataforma
                    </button>

                    <div className="std-status">
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        {(status === "published" || status === "changes") && (
                            <a href={publicUrl} target="_blank" rel="noopener noreferrer" className="std-status__link">
                                Ver página no ar
                                <Icon icon="solar:arrow-right-up-linear" aria-hidden="true" />
                            </a>
                        )}
                    </div>
                </div>
            </aside>

            <header className="std-mtop">
                <button type="button" className="std-brand std-brand--button" onClick={() => navigate("/home")}>
                    <img src={markfyLogo} alt="" />
                    Studio
                </button>
                <button
                    type="button"
                    className="std-mtop__company"
                    onClick={canSwitch ? () => setPickerOpen(true) : undefined}
                    disabled={!canSwitch}
                >
                    <span>{company?.name}</span>
                    {canSwitch && <Icon icon="solar:alt-arrow-down-linear" aria-hidden="true" />}
                </button>
            </header>

            <main className="std-main">
                <div key={location.pathname} className="mk-enter">
                    {children}
                </div>
            </main>

            <div className="std-mnav" role="navigation" aria-label="Seções do Studio">
                {NAV.filter((item) => MOBILE_PRIMARY.includes(item.to)).map((item) => (
                    <NavItem key={item.to} item={item} compact />
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
                    {NAV.filter((item) => !MOBILE_PRIMARY.includes(item.to)).map((item) => (
                        <NavItem key={item.to} item={item} onNavigate={() => setMoreOpen(false)} />
                    ))}
                    <hr className="mk-divider" />
                    <button type="button" className="std-nav__item" onClick={() => navigate("/home")}>
                        <Icon icon="solar:arrow-left-linear" aria-hidden="true" />
                        <span className="std-nav__label">Voltar para a Markfy</span>
                    </button>
                </div>
            </Sheet>

            {pickerOpen && <CompanyPicker variant="modal" onClose={() => setPickerOpen(false)} />}
        </div>
    );
};

/* ---------- PORTEIRO ---------- */

const StudioGate = () => {
    const { user, companyState, handle } = useStudio();

    if (!user) return <StudioWelcome />;
    if (companyState.loading) return <StudioLoader label="Buscando sua empresa" />;
    if (companyState.needsCompanySelection) return <CompanyPicker />;
    if (!handle) return <NoCompany />;

    return (
        <LicenseGate product="studio">
        <CountersProvider>
            <Routes>
                <Route path="editor" element={<Editor />} />
                <Route
                    path="*"
                    element={(
                        <Shell>
                            <Routes>
                                <Route index element={<Overview />} />
                                <Route path="site" element={<MySite />} />
                                <Route path="agendamentos" element={<Bookings />} />
                                <Route path="contatos" element={<Contacts />} />
                                <Route path="analytics" element={<Analytics />} />
                                <Route path="equipe" element={<Team />} />
                                <Route path="plano" element={<Plan />} />
                                <Route path="empresa" element={<CompanySettings />} />
                                <Route path="configuracoes" element={<Settings />} />
                                <Route path="*" element={<Overview />} />
                            </Routes>
                        </Shell>
                    )}
                />
            </Routes>
        </CountersProvider>
        </LicenseGate>
    );
};

const StudioApp = () => {
    useBodyClass("mk-bleed mk-studio-body");

    useEffect(() => {
        const previous = document.title;
        document.title = "Markfy Studio";
        return () => {
            document.title = previous;
        };
    }, []);

    return (
        <ToastProvider>
            <StudioProvider>
                <StudioGate />
            </StudioProvider>
        </ToastProvider>
    );
};

export default StudioApp;
