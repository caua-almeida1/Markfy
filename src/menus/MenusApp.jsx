import React, { useEffect, useMemo } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import { useAuth } from "../contexts/authContext";
import { useUserCompany } from "../contexts/companyContext/UserCompanyContext";
import LicenseGate from "../plans/LicenseGate";
import CompanyPicker from "../components/company-picker/CompanyPicker";
import { Button, ToastProvider, useBodyClass } from "../design-system/components";

import { createFirebaseSource } from "./data/firebaseSource.js";
import { MenusProvider, useMenus } from "./MenusContext.jsx";
import Shell from "./Shell.jsx";
import MenusRoutes from "./MenusRoutes.jsx";
import DemoApp from "./demo/DemoApp.jsx";
import Loader from "./Loader.jsx";

import markfyLogo from "../img/logo-markfy.svg";

import "../studio/studio.css";
import "../studio/studio-pages.css";
import "./menus.css";

/* =========================================================
   MARKFY MENUS — ENTRADA

     /menus/demo/*   demonstração (sem login, em memória)
     /menus/*        painel da empresa (login + empresa +
                     plano com o Menus)

   O painel real e a demonstração usam as MESMAS telas; só a
   fonte de dados muda (MenusProvider recebe a fonte).
========================================================= */

const Welcome = () => {
    const navigate = useNavigate();
    return (
        <div className="mk-root std-gate mnu">
            <div className="std-gate__inner">
                <span className="std-brand">
                    <img src={markfyLogo} alt="" />
                    Markfy <em>Menus</em>
                </span>
                <h1 className="mk-title mk-title--xl">Seu cardápio digital, seus pedidos e seu salão no mesmo lugar.</h1>
                <p className="mk-lead">
                    Monte o cardápio com modelos feitos para restaurantes, bares, cafeterias e food trucks,
                    publique com QR Code e, se quiser, receba pedidos e organize mesas e comandas.
                </p>
                <ul className="std-gate__list">
                    <li><Icon icon="solar:pallete-2-linear" /> 16 modelos com composições diferentes, ajustáveis peça por peça</li>
                    <li><Icon icon="solar:armchair-2-linear" /> Mesas em grade, lista ou planta do salão, com comandas e divisão de conta</li>
                    <li><Icon icon="solar:chef-hat-linear" /> Pedidos por status, tela da cozinha e balcão, sem limite de pedidos</li>
                </ul>
                <div className="std-gate__actions">
                    <Button variant="primary" size="lg" onClick={() => navigate("/login?redirect=/menus")}>Entrar para começar</Button>
                    <Button variant="outline" size="lg" icon="solar:play-circle-linear" onClick={() => navigate("/menus/demo")}>Experimentar a demonstração</Button>
                </div>
                <p className="std-gate__hint">A demonstração usa um restaurante fictício e não precisa de cadastro.</p>
            </div>
        </div>
    );
};

const NoCompany = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    return (
        <div className="mk-root std-gate mnu">
            <div className="std-gate__inner">
                <span className="std-brand"><img src={markfyLogo} alt="" /> Markfy <em>Menus</em></span>
                <h1 className="mk-title mk-title--lg">Primeiro, cadastre sua empresa</h1>
                <p className="mk-lead">
                    O Menus usa a mesma empresa da Markfy (nome, logo, endereço, horários e equipe). Leva poucos
                    minutos e serve para todos os produtos da Markfy.
                </p>
                <div className="std-gate__actions">
                    <Button
                        variant="primary"
                        size="lg"
                        onClick={() => navigate("/initial-setup", { state: { name: currentUser?.displayName || "", email: currentUser?.email || "", id: currentUser?.uid } })}
                    >
                        Cadastrar minha empresa
                    </Button>
                    <Button variant="ghost" size="lg" onClick={() => navigate("/menus/demo")}>Ver a demonstração</Button>
                </div>
            </div>
        </div>
    );
};

/* Não deu para ler a empresa (sem rede ou sem permissão). Melhor
   dizer isso do que concluir "sem plano" ou "fora da equipe". */
const LoadProblem = ({ offline }) => (
    <div className="mk-root std-gate mnu">
        <div className="std-gate__inner">
            <span className="std-brand"><img src={markfyLogo} alt="" /> Markfy <em>Menus</em></span>
            <h1 className="mk-title mk-title--lg">{offline ? "Sem conexão com o servidor" : "Não conseguimos abrir seu painel"}</h1>
            <p className="mk-lead">
                {offline
                    ? "Verifique a internet deste aparelho. O painel volta sozinho quando a conexão voltar."
                    : "O servidor recusou a leitura dos dados da empresa. Tente de novo; se continuar, entre de novo na sua conta."}
            </p>
            <div className="std-gate__actions">
                <Button variant="primary" size="lg" onClick={() => window.location.reload()}>Tentar de novo</Button>
            </div>
        </div>
    </div>
);

/* Sem nenhuma configuração ainda: o painel abre o passo a passo. */
const FirstRunRedirect = ({ children }) => {
    const { settings, loading, can, path } = useMenus();
    const navigate = useNavigate();
    const location = useLocation();

    const fresh = !loading && !settings?.onboarding && !settings?.profile && can("settings.edit");
    const onOnboarding = location.pathname.startsWith(path("comecar"));

    useEffect(() => {
        if (fresh && !onOnboarding) navigate(path("comecar"), { replace: true });
    }, [fresh, onOnboarding, navigate, path]);

    return children;
};

const RealPanel = () => {
    const { currentUser } = useAuth();
    const companyState = useUserCompany();
    const handle = companyState.companyHandle || companyState.company?.handle || null;

    const source = useMemo(() => (handle ? createFirebaseSource(handle) : null), [handle]);
    const user = useMemo(() => (currentUser ? { uid: currentUser.uid, name: currentUser.displayName || currentUser.email || "" } : null), [currentUser]);

    if (!currentUser) return <Welcome />;
    if (companyState.loading) return <Loader label="Buscando sua empresa" />;
    if (companyState.needsCompanySelection) return <CompanyPicker />;
    if (!handle) return <NoCompany />;

    return (
        <LicenseGate product="menus">
            <MenusProvider key={handle} source={source} base="/menus" user={user}>
                <PanelBody canSwitch={(companyState.companies?.length || 0) > 1} fallbackName={companyState.company?.name} />
            </MenusProvider>
        </LicenseGate>
    );
};

const PanelBody = ({ canSwitch, fallbackName }) => {
    const { settings, draft, loading, loadError, online, role } = useMenus();

    if (loadError) return <LoadProblem />;
    if (loading) return online ? <Loader /> : <LoadProblem offline />;

    if (!role) {
        return (
            <div className="mk-root std-gate mnu">
                <div className="std-gate__inner">
                    <h1 className="mk-title mk-title--lg">Você não faz parte da equipe desta empresa</h1>
                    <p className="mk-lead">Peça um convite ao responsável para acessar o Markfy Menus.</p>
                </div>
            </div>
        );
    }

    return (
        <FirstRunRedirect>
            <MenusRoutes
                shell={(children) => (
                    <Shell
                        companyName={settings.profile?.name || fallbackName || "Minha empresa"}
                        companyLogo={draft?.design?.images?.logo || null}
                        canSwitch={canSwitch}
                    >
                        {children}
                    </Shell>
                )}
            />
        </FirstRunRedirect>
    );
};

export default function MenusApp() {
    useBodyClass("mk-bleed mk-studio-body mk-menus-body");

    useEffect(() => {
        const previous = document.title;
        document.title = "Markfy Menus";
        return () => {
            document.title = previous;
        };
    }, []);

    return (
        <ToastProvider>
            <Routes>
                <Route path="demo/*" element={<DemoApp />} />
                <Route path="*" element={<RealPanel />} />
            </Routes>
        </ToastProvider>
    );
}

