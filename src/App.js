import Login from "./components/auth/login";
import PrivateRoute from "./components/auth/PrivateRoute";

// ========= IMAGE CROPPER ===========
import "react-image-crop/dist/ReactCrop.css";

import InitialSetup from "./pages/inital-pages/initial-setup";

// ========= CREATE COMPANY ===========
import CreateCompany from "./pages/inital-pages/initial-steps-components/create-company/CreateCompany";
import PreviewCompany from "./pages/inital-pages/initial-steps-components/preview-company/PreviewCompany"

import Home from "./components/home";

// ========= USERS COMUNS PAGES ===========
import HomePage from "./pages/users/homepage";

import { AuthProvider } from "./contexts/authContext";
import { useRoutes } from "react-router-dom";
import Dashboard from "./pages/adm/dashboardAdm/dashboard";
import CentralAdm from "./pages/adm/centralAdm";
import CentralUser from "./pages/users/homepage"

import CompanyPage from "./pages/users/homepage/CompanyPage/CompanyPage";

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
    // Rota sem handle
    {
      path: "/central-user",
      element: <CentralUser />,
    },
    // Rota com handle
    {
      path: "/central-user/:handle",
      element: <CentralUser />,
    },
    {
      path: "/central-user/catalog/:handle",
      element: <CompanyPage />,
    }
  ];
  let routesElement = useRoutes(routesArray);
  return (
    <AuthProvider>
      <div className="w-full h-screen flex flex-col">{routesElement}</div>
    </AuthProvider>
  );
}

export default App;
