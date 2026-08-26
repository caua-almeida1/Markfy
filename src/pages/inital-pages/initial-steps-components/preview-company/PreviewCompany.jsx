import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { getDatabase, ref, set, update } from "firebase/database";
import { getStorage, ref as storageRef, uploadString, getDownloadURL } from "firebase/storage";
import { getAuth } from "firebase/auth";
import "./preview-company.css";
import { Icon } from "@iconify/react";

// Componente interno de sucesso
function SuccessScreen({ companyName, companyHandle, onClose }) {
  const url = `${window.location.origin}/central-user/${companyHandle}`;
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Erro ao copiar:", err);
    }
  };

  return (
    <div className="preview-company-success-screen">
      <div className="preview-company-success-content">
        <h1>Vamos lá!</h1>
        <div className="preview-company-success-icon">
          <Icon icon="mingcute:check-fill" className="icon" />
        </div>
        <p>
          Sua Empresa <span>{companyName}</span> foi cadastrada com sucesso!
        </p>

        <div className="company-link-box">
          <p className="company-link-label">
            O link da sua empresa para acesso dos seus clientes é:
          </p>
          <div className="company-link-wrapper">
            <input
              type="text"
              value={url}
              readOnly
              className="company-link-input"
            />
            <button
              className="company-link-copy-btn"
              onClick={copyToClipboard}
            >
              <Icon icon="prime:copy" className="icon" />
              {copied ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </div>

        <button className="preview-company-success-btn" onClick={onClose}>
          Ir Para sua Empresa
        </button>
      </div>
    </div>
  );
}

export default function PreviewCompany() {
  const location = useLocation();
  const navigate = useNavigate();
  const companyData = location.state;

  const [loading, setLoading] = useState(false);
  const [successScreen, setSuccessScreen] = useState(false);

  if (!companyData) return <p>Dados da empresa não encontrados.</p>;

  const compressImage = (dataUrl, maxWidth = 500, quality = 0.7) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = dataUrl;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const scale = Math.min(maxWidth / img.width, 1);
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/png", quality));
      };
    });
  };

  const handleRegister = async () => {
    setLoading(true);

    try {
      const auth = getAuth();
      const user = auth.currentUser;

      if (!user) {
        throw new Error("Usuário não autenticado");
      }

      let logoURL = null;

      // ============================
      // Tenta fazer upload da logo
      // ============================
      if (companyData.logoPreview) {
        try {
          const compressedLogo = await compressImage(
            companyData.logoPreview,
            500,
            0.7
          );

          const storage = getStorage();
          const logoRef = storageRef(
            storage,
            `companys/${companyData.handle}/logo.png`
          );

          await uploadString(logoRef, compressedLogo, "data_url");
          logoURL = await getDownloadURL(logoRef);
        } catch (err) {
          console.warn("Não foi possível enviar a logo:", err);
          logoURL = null;
        }
      }

      const db = getDatabase();

      // ============================
      // Criação da empresa (OBRIGATÓRIA)
      // ============================
      await set(ref(db, `companys/${companyData.handle}`), {
        name: companyData.name,
        handle: companyData.handle,
        document: companyData.document,
        email: companyData.email,
        phone: companyData.phone,
        description: companyData.description,
        logoPreview: logoURL,
      });

      // ============================
      // Adiciona membro (não impede cadastro)
      // ============================
      try {
        await set(
          ref(db, `companys/${companyData.handle}/members/${user.uid}`),
          {
            role: "master",
          }
        );
      } catch (err) {
        console.warn("Erro ao adicionar membro:", err);
      }

      // ============================
      // Atualiza usuário (não impede cadastro)
      // ============================
      try {
        await update(ref(db, `users/${user.uid}`), {
          userType: "admin",
          initial: false,

          companyHandle: companyData.handle
        });
      } catch (err) {
        console.warn("Erro ao atualizar usuário:", err);
      }

      setSuccessScreen(true);
    } catch (error) {
      console.error("Erro ao cadastrar empresa:", error);
      alert("Não foi possível cadastrar a empresa.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="preview-company-wrapper">
      {!successScreen && (
        <>
          <div className="preview-company-container">
            <h1 className="preview-title">Pré-visualização da Empresa</h1>

            <div className="preview-header">
              {companyData.logoPreview && (
                <img src={companyData.logoPreview} alt="Logo" className="preview-logo" />
              )}
              <div className="preview-company-info">
                <h2 className="preview-company-name">{companyData.name}</h2>
                <p className="preview-company-handle">@{companyData.handle}</p>
                <p className="preview-description">{companyData.description}</p>
              </div>
            </div>

            <p className="preview-contact">📧 {companyData.email}</p>
            <p className="preview-contact">📞 {companyData.phone}</p>

            <div className="preview-gallery">
              <div className="gallery-item"></div>
              <div className="gallery-item"></div>
              <div className="gallery-item"></div>
              <div className="gallery-item"></div>
            </div>

            <div className="preview-buttons">
              <button className="preview-btn preview-btn-back" onClick={() => navigate(-1)}>
                Voltar e Editar
              </button>
              <button className="preview-btn preview-btn-confirm" onClick={handleRegister}>
                Cadastrar Empresa
              </button>
            </div>
          </div>

          {loading && (
            <div className="preview-company-loading-backdrop">
              <div className="preview-company-loading-spinner">
                <Icon icon="svg-spinners:ring-resize" className="icon" />
              </div>
            </div>
          )}
        </>
      )}

      {successScreen && (
        <SuccessScreen
          companyName={companyData.name}
          companyHandle={companyData.handle}
          onClose={() => navigate(`/central-user/${companyData.handle}/catalog`)}
        />
      )}
    </div>
  );
}
