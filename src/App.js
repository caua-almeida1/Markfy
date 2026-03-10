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
import HomePage from "./pages/users/homepage";

import { AuthProvider } from "./contexts/authContext";
import { useRoutes } from "react-router-dom";
import Dashboard from "./pages/adm/dashboardAdm/dashboard";
import CentralAdm from "./pages/adm/centralAdm";
import CentralUser from "./pages/users/homepage";
import CompanyPage from "./pages/users/homepage/CompanyPage/CompanyPage";

// 🔹 IMPORTAR O NOVO CONTEXTO
import { UserCompanyProvider } from "./contexts/companyContext/UserCompanyContext";


import TestSMS from "./pages/TESTE-SMS/testesms";
function App() {
  const routesArray = [
    {
      path: "*",
      element: <Login />,
    },
    {
      path: "/initial-setup",
      element: <InitialSetup />,
    },
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
    {
      path: "/central-adm",
      element: (
        <PrivateRoute>
          <CentralAdm />
        </PrivateRoute>
      ),
    },
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
    {
      path: "/test-sms",
      element: <TestSMS />,
    }
  ];

  const routesElement = useRoutes(routesArray);

  return (
    <AuthProvider>
      <UserCompanyProvider>
        <div className="w-full h-screen flex flex-col">
          {routesElement}
        </div>
      </UserCompanyProvider>
    </AuthProvider>
  );
}

export default App;
