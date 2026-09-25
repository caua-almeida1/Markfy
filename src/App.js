import LandingPage from "./pages/landing/LandingPage";

import Login from "./components/auth/login";
import PrivateRoute from "./components/auth/PrivateRoute";

// ========= IMAGE CROPPER ===========
import "react-image-crop/dist/ReactCrop.css";

import InitialSetup from "./pages/inital-pages/initial-setup";

// ========= CREATE COMPANY ===========
import CreateCompany from "./pages/inital-pages/initial-steps-components/create-company/CreateCompany";
import PreviewCompany from "./pages/inital-pages/initial-steps-components/preview-company/PreviewCompany";

import Home from "./components/home";

// ========= USERS COMUNS PAGES ===========

import { AuthProvider } from "./contexts/authContext";
import { useRoutes } from "react-router-dom";
import { lazy, Suspense } from "react";

import Dashboard from "./pages/adm/dashboardAdm/dashboard";
import CentralAdm from "./pages/adm/centralAdm";
import HomePage from "./pages/users/homepage";

import Checkout from "./pages/users/checkout/Checkout";

import PaymentResult from "./components/payment-result/PaymentResult";

import CentralUser from "./pages/users/homepage/centralUser";
import CompanyPage from "./pages/users/homepage/CompanyPage/CompanyPage";

// 🔹 IMPORTAR O NOVO CONTEXTO
import { UserCompanyProvider } from "./contexts/companyContext/UserCompanyContext";
import { ConsentProvider } from "./contexts/consentContext/ConsentContext";
import { ThemeProvider } from "./theme/ThemeContext";

import Invite from "./pages/invite/Invite"

import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import TermsOfUse from "./pages/legal/TermsOfUse";

import TestSMS from "./pages/TESTE-SMS/testesms";

/*
 * ============================================================
 * FERRAMENTAS DE DESENVOLVIMENTO
 * ============================================================
 *
 * Import dinâmico: vira um chunk separado, que o build de
 * produção nunca carrega porque a rota não é registrada.
 * ============================================================
 */

const IS_DEV = process.env.NODE_ENV === "development";

/*
 * O ternário com condição constante faz o webpack descartar
 * o import() inteiro no build de produção, em vez de gerar
 * um chunk que nunca é carregado.
 */

const RtdbAnalytics = IS_DEV
  ? lazy(() => import("./pages/dev/RtdbAnalytics/RtdbAnalytics"))
  : null;

function App() {
  /*
   * O identificador anônimo do cliente (markfy-client-id)
   * NÃO é mais criado aqui. Ele é essencial para reencontrar
   * um agendamento sem conta, mas criá-lo em toda visita —
   * inclusive em quem só abriu a landing — seria gravar um
   * identificador sem necessidade. Agora ele nasce só quando
   * o agendamento começa (ver utils/clientID.js), que é o
   * princípio da necessidade da LGPD (Art. 6º, III).
   */

  const routesArray = [

    /* =====================================================
       PÁGINA PRINCIPAL / LANDING
    ===================================================== */

    {
      path: "*",
      element: <LandingPage />,
    },

    /* =====================================================
       LOGIN
    ===================================================== */

    {
      path: "/login",
      element: <Login />,
    },

    {
      path: "/payment-result",
      element: <PaymentResult />,
    },

    {
      path: "/checkout",
      element: <Checkout />,
    },

    /* =====================================================
       INITIAL SETUP
    ===================================================== */

    {
      path: "/initial-setup",
      element: <InitialSetup />,
    },

    /* =====================================================
       CONVITE
    ===================================================== */

    {
      path: "/invite/:inviteId",
      element: <Invite />,
    },

    /* =====================================================
       CRIAÇÃO DE EMPRESA
    ===================================================== */

    {
      path: "/newcompany/:sessionId",
      element: (
        <PrivateRoute>
          <CreateCompany />
        </PrivateRoute>
      ),
    },

    {
      path: "/newcompany/previewcompany/:sessionId",
      element: (
        <PrivateRoute>
          <PreviewCompany />
        </PrivateRoute>
      ),
    },

    /* =====================================================
       ADMIN
    ===================================================== */

    {
      path: "/central-adm",
      element: (
        <PrivateRoute>
          <CentralAdm />
        </PrivateRoute>
      ),
    },

    /* =====================================================
       USUÁRIO
    ===================================================== */

    {
      path: "/central-user",
      element: <CentralUser />,
    },

    {
      path: "/central-user/:handle",
      element: <CentralUser />,
    },

    {
      path: "/central-user/:handle/catalog",
      element: <CompanyPage />,
    },

    /* =====================================================
       LEGAL

       Rotas fixas: o rodapé, o aviso de cookies e o painel
       de preferências apontam para cá.
    ===================================================== */

    {
      path: "/privacidade",
      element: <PrivacyPolicy />,
    },

    {
      path: "/termos",
      element: <TermsOfUse />,
    },

    /* =====================================================
       TESTES
    ===================================================== */

    {
      path: "/test-sms",
      element: <TestSMS />,
    },

    /* =====================================================
       DESENVOLVIMENTO

       Só existe rodando npm start. Em produção o array
       simplesmente não recebe esta entrada.
    ===================================================== */

    ...(IS_DEV
      ? [
        {
          path: "/dev/rtdb",
          element: (
            <Suspense fallback={<div style={{ padding: 24 }}>Carregando…</div>}>
              <RtdbAnalytics />
            </Suspense>
          ),
        },
      ]
      : []),

  ];

  const routesElement = useRoutes(routesArray);

  return (
    /* ThemeProvider por fora de tudo: o tema mora num
       atributo do <html>, então trocar de rota ou de estado
       de login não reavalia nem repinta nada. */
    <ThemeProvider>
      <AuthProvider>
        <UserCompanyProvider>
          {/* Envolve todas as rotas: o aviso de cookies aparece
              na landing, no login, no catálogo, no checkout e no
              painel, e qualquer tela consegue consultar o
              consentimento via useConsent(). */}
          <ConsentProvider>
            <div className="w-full h-screen flex flex-col">
              {routesElement}
            </div>
          </ConsentProvider>
        </UserCompanyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
