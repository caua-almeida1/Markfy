import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getDatabase, ref, get } from "firebase/database";
import TabBar from "../../../../components/tabbar";
import { useAuth } from "../../../../contexts/authContext"; // 🟢 importa o contexto de auth

import { useCompanyLogo } from "../../../../firebase/companyLogo";
import { useCompanyTheme } from "../../../../theme/useCompanyTheme";

import Modal from "../../../../components/modal/Modal";

import { PublicAccessGate } from "../../../../plans/publicAccess";
import "./company-page.css";

function CompanyPageInner() {
  const { handle } = useParams();
  const navigate = useNavigate();
  const { currentUser, userLoggedIn } = useAuth(); // 🟢 dados do usuário autenticado

  const [company, setCompany] = useState(null);

  /* Esta rota também é pública e identificada pelo handle,
     então usa a paleta da empresa. */
  useCompanyTheme(handle);

  /* A logo vem do Storage; company.logoPreview só serve de
     dica para empresas ainda não migradas. */
  const companyLogo = useCompanyLogo(
    handle,
    company?.logoPreview
  );
  const [loading, setLoading] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const currentUrl = window.location.href;

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const db = getDatabase();
        const companyRef = ref(db, `companys/${handle}`);
        const snapshot = await get(companyRef);

        if (snapshot.exists()) {
          setCompany(snapshot.val());
        } else {
          setCompany(null);
        }
      } catch (error) {
        console.error("Erro ao buscar empresa:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchCompany();
  }, [handle]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Erro ao copiar link:", err);
    }
  };

  const goToAdmin = () => {
    setShowManageModal(false);

    if (userLoggedIn && currentUser) {
      sessionStorage.setItem("forceAdminReload", "true");
      navigate("/central-adm");
    } else {
      alert("Você precisa estar logado para acessar o painel da empresa.");
      navigate("/Login");
    }
  };

  if (loading) return <p>Carregando...</p>;
  if (!company) return <p>Empresa não encontrada.</p>;

  return (
    <div className="company-page-wrapper">
      <div className="company-page-content">

        <div className="company-page-container">
          <div className="company-page-header">
            {companyLogo && (
              <img
                src={companyLogo}
                alt={company.name}
                className="company-page-logo"
              />
            )}
            <div className="company-page-info">
              <h2 className="company-page-name">{company.name}</h2>
              <p className="company-page-handle">@{company.handle}</p>
              <p className="company-page-description">{company.description}</p>
            </div>
          </div>

          <p className="company-page-contact">📧 {company.email}</p>
          <p className="company-page-contact">📞 {company.phone}</p>

          {/* ======= BOTÕES ======= */}
          <div className="company-page-btn-row">
            <button
              className="company-btn company-btn-share"
              onClick={() => setShowShareModal(true)}
            >
              Compartilhar
            </button>
            <button
              className="company-btn company-btn-manage"
              onClick={() => setShowManageModal(true)}
            >
              Gerenciar
            </button>
          </div>

          <div className="company-page-gallery">
            <div className="company-page-gallery-item"></div>
            <div className="company-page-gallery-item"></div>
            <div className="company-page-gallery-item"></div>
            <div className="company-page-gallery-item"></div>
          </div>


        </div>

        <div style={{ marginTop: "20px" }}>
          <TabBar />
        </div>

        {/* ======= MODAL DE COMPARTILHAR ======= */}
        <Modal
          open={showShareModal}
          onClose={() => setShowShareModal(false)}
          overlayClassName="share-modal-overlay"
          className="share-modal-content"
          label="Compartilhar empresa"
        >
                <h3>Compartilhar Empresa</h3>
                <p>Copie o link abaixo para compartilhar:</p>

                <div className="share-modal-input-wrapper">
                  <input
                    type="text"
                    value={currentUrl}
                    readOnly
                    className="share-modal-input"
                  />
                  <button
                    className="share-modal-copy-btn"
                    onClick={copyToClipboard}
                  >
                    {copied ? "Copiado!" : "Copiar"}
                  </button>
                </div>

                <button
                  className="share-modal-close-btn"
                  onClick={() => setShowShareModal(false)}
                >
                  Fechar
                </button>
        </Modal>

        {/* ======= MODAL DE CONFIRMAÇÃO DE GERENCIAMENTO ======= */}
        <Modal
          open={showManageModal}
          onClose={() => setShowManageModal(false)}
          overlayClassName="share-modal-overlay"
          className="share-modal-content"
          label="Gerenciar empresa"
        >
                <h3>Gerenciar Empresa</h3>
                <p>Deseja ir para a tela de gerenciamento da sua empresa?</p>

                <div className="share-modal-btn-group">
                  <button
                    className="share-modal-confirm-btn"
                    onClick={goToAdmin}
                  >
                    Sim, ir para o painel
                  </button>
                  <button
                    className="share-modal-close-btn"
                    onClick={() => setShowManageModal(false)}
                  >
                    Cancelar
                  </button>
                </div>
        </Modal>
      </div>
    </div>
  );
}


export default function CompanyPage() {

  const { handle } = useParams();

  return (
    <PublicAccessGate handle={handle}>
      <CompanyPageInner />
    </PublicAccessGate>
  );
}
