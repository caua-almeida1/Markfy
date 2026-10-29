import LandingPage from "./pages/landing/LandingPage";

import Login from "./components/auth/login";
import PrivateRoute from "./components/auth/PrivateRoute";

// ========= IMAGE CROPPER ===========
import "react-image-crop/dist/ReactCrop.css";

// ========= USERS COMUNS PAGES ===========

import { AuthProvider } from "./contexts/authContext";
import { useRoutes } from "react-router-dom";
import { lazy, Suspense } from "react";

import CentralUser from "./pages/users/homepage/centralUser";
import CompanyPage from "./pages/users/homepage/CompanyPage/CompanyPage";

// 🔹 IMPORTAR O NOVO CONTEXTO
import { UserCompanyProvider } from "./contexts/companyContext/UserCompanyContext";
import { ConsentProvider } from "./contexts/consentContext/ConsentContext";
import { ThemeProvider } from "./theme/ThemeContext";


import PrivacyPolicy from "./pages/legal/PrivacyPolicy";
import TermsOfUse from "./pages/legal/TermsOfUse";


import MarkfyHome from "./pages/home/MarkfyHome";
import { LicenseProvider } from "./plans/LicenseContext";
import LicenseGate from "./plans/LicenseGate";
import RouteFallback from "./components/route-transition/RouteFallback";
import NotFound from "./pages/not-found/NotFound";
import { usePageMeta } from "./hooks/usePageMeta";
import { useAnalytics } from "./analytics/analytics";

/* Rotas privadas ou de fluxo (login, painel, checkout...):
   título próprio e "noindex" — não devem aparecer na busca.
   O robots.txt sozinho não impede indexação. */
const NoIndex = ({ title, children }) => {
  usePageMeta({ title, noindex: true });
  return children;
};

/*
 * Painel da empresa, criação de empresa, checkout, convites e
 * planos em pedaços próprios do bundle.
 *
 * Antes, quem só abria a página de uma barbearia para agendar
 * baixava junto o painel inteiro (dashboard, produtos,
 * pedidos, agenda — dezenas de milhares de linhas). O CSS
 * global que vivia nesses módulos foi para src/index.css,
 * para nada mudar de aparência.
 */
const CentralAdm = lazy(() => import("./pages/adm/centralAdm"));
const InitialSetup = lazy(() => import("./pages/inital-pages/initial-setup"));
const CreateCompany = lazy(() => import("./pages/inital-pages/initial-steps-components/create-company/CreateCompany"));
const PreviewCompany = lazy(() => import("./pages/inital-pages/initial-steps-components/preview-company/PreviewCompany"));
const Checkout = lazy(() => import("./pages/users/checkout/Checkout"));
const SubscriptionReturn = lazy(() => import("./pages/users/subscription-return/SubscriptionReturn"));
const PaymentResult = lazy(() => import("./components/payment-result/PaymentResult"));
const Invite = lazy(() => import("./pages/invite/Invite"));
const QrLoginPage = lazy(() => import("./qr/QrLoginPage"));
const QrInvitePage = lazy(() => import("./qr/QrInvitePage"));
const PlansPage = lazy(() => import("./plans/PlansPage"));

/*
 * Markfy Studio e as páginas públicas criadas nele ficam em
 * pedaços próprios do bundle: quem só agenda nunca baixa o
 * editor.
 */
const StudioApp = lazy(() => import("./studio/StudioApp"));
const PublicSite = lazy(() => import("./studio/public/PublicSite"));

/* Markfy Menus: painel (com a demonstração) e cardápio público
   também ficam em pedaços próprios. */
const MenusApp = lazy(() => import("./menus/MenusApp"));
const PublicMenu = lazy(() => import("./menus/public/PublicMenu"));

/* Painel do dono da plataforma: chunk próprio, só abre quem digita a rota. */
const MarkfyMasterDev = lazy(() => import("./master/MarkfyMasterDev"));

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

/* Página de teste de SMS: ferramenta de desenvolvimento. Em
   produção ela ficava pública e puxava o @mui/material (e o
   emotion) para o bundle principal só por causa dela. */
const TestSMS = IS_DEV
  ? lazy(() => import("./pages/TESTE-SMS/testesms"))
  : null;

function App() {
  /* GA4 só com ID configurado E aceite de "Estatísticas". */
  useAnalytics();

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
      path: "/",
      element: <LandingPage />,
    },

    /* Endereço desconhecido: página 404 de verdade, em vez
       de mostrar a landing em qualquer URL. */
    {
      path: "*",
      element: <NotFound />,
    },

    /* =====================================================
       LOGIN
    ===================================================== */

    {
      path: "/login",
      element: (
        <NoIndex title="Entrar">
          <Login />
        </NoIndex>
      ),
    },

    /* O convite manda quem ainda não tem conta para
       /register?invite=...; a tela de login já abre no modo
       cadastro quando há convite. Sem esta rota, a pessoa
       caía na landing. */
    {
      path: "/register",
      element: (
        <NoIndex title="Criar conta">
          <Login />
        </NoIndex>
      ),
    },

    /* =====================================================
       HOME DA REDE — Studio, Bookings e Menus
    ===================================================== */

    {
      path: "/home",
      element: <MarkfyHome />,
    },

    {
      path: "/home/:step",
      element: (
        <NoIndex title="Markfy">
          <MarkfyHome />
        </NoIndex>
      ),
    },

    /* =====================================================
       MARKFY STUDIO

       A tela de entrada do Studio pede login sozinha (em
       vez do PrivateRoute), para explicar o produto antes
       de mandar a pessoa embora.
    ===================================================== */

    {
      path: "/studio/*",
      element: (
        <Suspense fallback={<RouteFallback label="Abrindo o Markfy Studio" />}>
          <StudioApp />
        </Suspense>
      ),
    },

    /* =====================================================
       MARKFY MENUS

       /menus/demo é aberta (restaurante fictício, em memória);
       o painel pede login sozinho, como o Studio.
    ===================================================== */

    {
      path: "/menus/*",
      element: (
        <Suspense fallback={<RouteFallback label="Abrindo o Markfy Menus" />}>
          <MenusApp />
        </Suspense>
      ),
    },

    /* Cardápio público e acompanhamento do pedido. */
    {
      path: "/m/:slug",
      element: (
        <Suspense fallback={<RouteFallback />}>
          <PublicMenu />
        </Suspense>
      ),
    },

    {
      path: "/m/:slug/pedido/:orderId",
      element: (
        <Suspense fallback={<RouteFallback />}>
          <PublicMenu />
        </Suspense>
      ),
    },

    /* QR CODE — entrar em outro aparelho e entrar na equipe. */
    {
      path: "/qr-login",
      element: (
        <NoIndex title="Entrar com QR Code">
          <QrLoginPage />
        </NoIndex>
      ),
    },

    {
      path: "/entrar-equipe/:inviteId",
      element: (
        <NoIndex title="Entrar na equipe">
          <QrInvitePage />
        </NoIndex>
      ),
    },

    /* PLANOS DA EMPRESA — escolha e pagamento (só o administrador
       principal assina; a tela explica isso para os demais). */
    {
      path: "/planos",
      element: (
        <NoIndex title="Planos da empresa">
          <PrivateRoute>
            <PlansPage />
          </PrivateRoute>
        </NoIndex>
      ),
    },

    /* MARKFY MASTER DEV — login próprio, não usa o PrivateRoute. */
    {
      path: "/markfy-master-dev",
      element: (
        <NoIndex title="Master">
          <Suspense fallback={<RouteFallback />}>
            <MarkfyMasterDev />
          </Suspense>
        </NoIndex>
      ),
    },

    /* Página pública publicada pelo Studio. */
    {
      path: "/s/:handle",
      element: (
        <Suspense fallback={<RouteFallback />}>
          <PublicSite />
        </Suspense>
      ),
    },

    {
      path: "/payment-result",
      element: (
        <NoIndex title="Pagamento">
          <PaymentResult />
        </NoIndex>
      ),
    },

    {
      path: "/checkout",
      element: (
        <NoIndex title="Pagamento">
          <Checkout />
        </NoIndex>
      ),
    },

    /* Volta do Mercado Pago depois de assinar pela conta de lá
       (back_url da assinatura). */
    {
      path: "/assinatura/retorno",
      element: (
        <NoIndex title="Assinatura">
          <SubscriptionReturn />
        </NoIndex>
      ),
    },

    /* =====================================================
       INITIAL SETUP
    ===================================================== */

    {
      path: "/initial-setup",
      element: (
        <NoIndex title="Primeiros passos">
          <InitialSetup />
        </NoIndex>
      ),
    },

    /* =====================================================
       CONVITE
    ===================================================== */

    {
      path: "/invite/:inviteId",
      element: (
        <NoIndex title="Convite">
          <Invite />
        </NoIndex>
      ),
    },

    /* =====================================================
       CRIAÇÃO DE EMPRESA
    ===================================================== */

    {
      path: "/newcompany/:sessionId",
      element: (
        <NoIndex title="Criar empresa">
          <PrivateRoute>
            <CreateCompany />
          </PrivateRoute>
        </NoIndex>
      ),
    },

    {
      path: "/newcompany/previewcompany/:sessionId",
      element: (
        <NoIndex title="Revisar empresa">
          <PrivateRoute>
            <PreviewCompany />
          </PrivateRoute>
        </NoIndex>
      ),
    },

    /* =====================================================
       ADMIN
    ===================================================== */

    {
      path: "/central-adm",
      element: (
        <NoIndex title="Painel da empresa">
          <PrivateRoute>
            <LicenseGate product="bookings">
              <CentralAdm />
            </LicenseGate>
          </PrivateRoute>
        </NoIndex>
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
       DESENVOLVIMENTO

       Só existe rodando npm start. Em produção o array
       simplesmente não recebe esta entrada.
    ===================================================== */

    ...(IS_DEV
      ? [
        {
          path: "/test-sms",
          element: (
            <Suspense fallback={<div style={{ padding: 24 }}>Carregando…</div>}>
              <TestSMS />
            </Suspense>
          ),
        },
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
         <LicenseProvider>
          {/* Envolve todas as rotas: o aviso de cookies aparece
              na landing, no login, no catálogo, no checkout e no
              painel, e qualquer tela consegue consultar o
              consentimento via useConsent(). */}
          <ConsentProvider>
            <div className="w-full h-screen flex flex-col">
              <Suspense fallback={<RouteFallback />}>
                {routesElement}
              </Suspense>
            </div>
          </ConsentProvider>
         </LicenseProvider>
        </UserCompanyProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
