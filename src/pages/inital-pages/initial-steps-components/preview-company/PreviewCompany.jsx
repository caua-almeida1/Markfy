import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import {
  getDatabase,
  ref,
  set,
  update
} from "firebase/database";

import {
  getStorage,
  ref as storageRef,
  uploadString,
  getDownloadURL
} from "firebase/storage";

import { getAuth } from "firebase/auth";

import "./preview-company.css";

import { Icon } from "@iconify/react";

import {
  removeDraftImage
} from "../create-company/utils/companyDraft";


/* ============================================================
   TELA DE SUCESSO
   ============================================================ */

function SuccessScreen({
  companyName,
  companyHandle,
  onClose
}) {

  const url =
    `${window.location.origin}/central-user/${companyHandle}`;

  const [copied, setCopied] = useState(false);


  const copyToClipboard = async () => {

    try {

      await navigator.clipboard.writeText(url);

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 2000);

    } catch (err) {

      console.error(
        "Erro ao copiar:",
        err
      );

    }

  };


  return (

    <div className="preview-company-success-screen">

      <div className="preview-company-success-content">

        <h1>
          Vamos lá!
        </h1>


        <div className="preview-company-success-icon">

          <Icon
            icon="mingcute:check-fill"
            className="icon"
          />

        </div>


        <p>

          Sua Empresa{" "}

          <span>
            {companyName}
          </span>

          {" "}foi cadastrada com sucesso!

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
              type="button"
              className="company-link-copy-btn"
              onClick={copyToClipboard}
            >

              <Icon
                icon="prime:copy"
                className="icon"
              />

              {copied
                ? "Copiado!"
                : "Copiar"
              }

            </button>

          </div>

        </div>


        <button
          type="button"
          className="preview-company-success-btn"
          onClick={onClose}
        >
          Ir Para sua Empresa
        </button>

      </div>

    </div>

  );

}


/* ============================================================
   PREVIEW COMPANY
   ============================================================ */

export default function PreviewCompany() {

  const location =
    useLocation();

  const navigate =
    useNavigate();

  const companyData =
    location.state;


  const [loading, setLoading] =
    useState(false);

  const [successScreen, setSuccessScreen] =
    useState(false);


  /*
   * ============================================================
   * DADOS NÃO ENCONTRADOS
   * ============================================================
   */

  if (!companyData) {

    return (
      <div className="preview-company-wrapper">

        <div className="preview-company-container">

          <h1>
            Dados da empresa não encontrados.
          </h1>

          <button
            type="button"
            className="preview-btn preview-btn-back"
            onClick={() => navigate(-1)}
          >
            Voltar
          </button>

        </div>

      </div>
    );

  }


  /*
   * ============================================================
   * DRAFT
   * ============================================================
   */

  const draftId =
    location.pathname
      .split("/")
      .pop();


  const draftKey =
    `markfy_create_company_draft_${draftId}`;


  /*
   * ============================================================
   * LOCALIZAÇÃO
   *
   * Garante que mesmo que algum campo não exista,
   * a estrutura enviada ao Firebase seja completa.
   * ============================================================
   */

  const companyLocation = {

    street:
      companyData.location?.street ||
      "",

    number:
      companyData.location?.number ||
      "",

    neighborhood:
      companyData.location?.neighborhood ||
      "",

    city:
      companyData.location?.city ||
      "",

    state:
      companyData.location?.state ||
      "",

    zipCode:
      companyData.location?.zipCode ||
      "",

    country:
      companyData.location?.country ||
      ""

  };


  /*
   * ============================================================
   * COMPRESSÃO DA LOGO
   * ============================================================
   */

  const compressImage = (
    dataUrl,
    maxWidth = 500,
    quality = 0.7
  ) => {

    return new Promise((resolve, reject) => {

      const img =
        new Image();


      img.onload = () => {

        try {

          const canvas =
            document.createElement(
              "canvas"
            );


          const scale =
            Math.min(
              maxWidth / img.width,
              1
            );


          canvas.width =
            img.width * scale;


          canvas.height =
            img.height * scale;


          const ctx =
            canvas.getContext(
              "2d"
            );


          if (!ctx) {

            reject(
              new Error(
                "Não foi possível criar o canvas."
              )
            );

            return;
          }


          ctx.drawImage(
            img,
            0,
            0,
            canvas.width,
            canvas.height
          );


          resolve(
            canvas.toDataURL(
              "image/png",
              quality
            )
          );

        } catch (error) {

          reject(error);

        }

      };


      img.onerror = () => {

        reject(
          new Error(
            "Não foi possível carregar a imagem."
          )
        );

      };


      img.src = dataUrl;

    });

  };


  /*
   * ============================================================
   * CADASTRAR EMPRESA
   * ============================================================
   */

  const handleRegister = async () => {

    setLoading(true);


    try {

      /*
       * ========================================================
       * AUTENTICAÇÃO
       * ========================================================
       */

      const auth =
        getAuth();


      const user =
        auth.currentUser;


      if (!user) {

        throw new Error(
          "Usuário não autenticado."
        );

      }


      /*
       * ========================================================
       * BANCO
       * ========================================================
       */

      const db =
        getDatabase();


      /*
       * ========================================================
       * LOGO
       * ========================================================
       */

      let logoURL = null;


      if (companyData.logoPreview) {

        try {

          const compressedLogo =
            await compressImage(
              companyData.logoPreview,
              500,
              0.7
            );


          const storage =
            getStorage();


          const logoRef =
            storageRef(
              storage,
              `companys/${companyData.handle}/logo.png`
            );


          await uploadString(
            logoRef,
            compressedLogo,
            "data_url"
          );


          logoURL =
            await getDownloadURL(
              logoRef
            );


        } catch (err) {

          console.warn(
            "Não foi possível enviar a logo:",
            err
          );

          /*
           * A logo não impede a criação da empresa.
           */

          logoURL = null;

        }

      }


      /*
       * ========================================================
       * DADOS DA EMPRESA
       * ========================================================
       *
       * AQUI ESTÁ A CORREÇÃO:
       *
       * location é salvo dentro da empresa.
       * ========================================================
       */

      const companyRef =
        ref(
          db,
          `companys/${companyData.handle}`
        );


      await set(
        companyRef,
        {

          name:
            companyData.name,

          handle:
            companyData.handle,

          document:
            companyData.document,

          email:
            companyData.email,

          phone:
            companyData.phone,

          description:
            companyData.description || "",

          logoPreview:
            logoURL,

          /*
           * LOCALIZAÇÃO
           */
          location:
            companyLocation

        }
      );


      /*
       * ========================================================
       * MEMBRO MASTER
       * ========================================================
       */

      await set(
        ref(
          db,
          `companys/${companyData.handle}/members/${user.uid}`
        ),
        {
          role: "master"
        }
      );


      /*
       * ========================================================
       * ATUALIZA USUÁRIO
       * ========================================================
       *
       * SOMENTE AGORA o usuário deixa de ser initial.
       *
       * O fluxo anterior já criou:
       *
       * initial: true
       *
       * no cadastro.
       *
       * Agora que a empresa foi criada:
       *
       * initial: false
       * ========================================================
       */

      await update(
        ref(
          db,
          `users/${user.uid}`
        ),
        {

          userType:
            "admin",

          /*
           * FINALIZOU O INITIAL SETUP
           */
          initial:
            false,

          companyHandle:
            companyData.handle

        }
      );


      /*
       * ========================================================
       * REMOVE RASCUNHO
       * ========================================================
       */

      try {

        localStorage.removeItem(
          draftKey
        );


        await removeDraftImage(
          draftKey
        );


      } catch (err) {

        console.warn(
          "Erro ao remover rascunho:",
          err
        );

      }


      /*
       * ========================================================
       * SUCESSO
       * ========================================================
       */

      setSuccessScreen(
        true
      );


    } catch (error) {

      console.error(
        "Erro ao cadastrar empresa:",
        error
      );


      alert(
        "Não foi possível cadastrar a empresa."
      );


    } finally {

      setLoading(
        false
      );

    }

  };


  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (

    <div className="preview-company-wrapper">

      {!successScreen && (

        <>

          <div className="preview-company-container">

            <h1 className="preview-title">
              Pré-visualização da Empresa
            </h1>


            {/* ==================================================
                CABEÇALHO
                ================================================== */}

            <div className="preview-header">

              {companyData.logoPreview && (

                <img
                  src={companyData.logoPreview}
                  alt="Logo"
                  className="preview-logo"
                />

              )}


              <div className="preview-company-info">

                <h2 className="preview-company-name">
                  {companyData.name}
                </h2>


                <p className="preview-company-handle">
                  @{companyData.handle}
                </p>


                {companyData.description && (

                  <p className="preview-description">
                    {companyData.description}
                  </p>

                )}

              </div>

            </div>


            {/* ==================================================
                CONTATOS
                ================================================== */}

            <p className="preview-contact">
              📧 {companyData.email}
            </p>


            <p className="preview-contact">
              📞 {companyData.phone}
            </p>


            {/* ==================================================
                LOCALIZAÇÃO
                ================================================== */}

            <div className="preview-location">

              <h3>
                Localização
              </h3>


              {companyLocation.street && (

                <p>
                  📍{" "}
                  {companyLocation.street}

                  {companyLocation.number
                    ? `, ${companyLocation.number}`
                    : ""
                  }
                </p>

              )}


              {companyLocation.neighborhood && (

                <p>
                  Bairro:{" "}
                  {companyLocation.neighborhood}
                </p>

              )}


              {(companyLocation.city ||
                companyLocation.state) && (

                  <p>

                    {companyLocation.city}

                    {companyLocation.city &&
                      companyLocation.state
                      ? " - "
                      : ""
                    }

                    {companyLocation.state}

                  </p>

                )}


              {companyLocation.zipCode && (

                <p>
                  CEP:{" "}
                  {companyLocation.zipCode}
                </p>

              )}


              {companyLocation.country && (

                <p>
                  País:{" "}
                  {companyLocation.country}
                </p>

              )}

            </div>


            {/* ==================================================
                GALERIA
                ================================================== */}

            <div className="preview-gallery">

              <div className="gallery-item" />
              <div className="gallery-item" />
              <div className="gallery-item" />
              <div className="gallery-item" />

            </div>


            {/* ==================================================
                BOTÕES
                ================================================== */}

            <div className="preview-buttons">

              <button
                type="button"
                className="preview-btn preview-btn-back"
                onClick={() => navigate(-1)}
              >
                Voltar e Editar
              </button>


              <button
                type="button"
                className="preview-btn preview-btn-confirm"
                onClick={handleRegister}
                disabled={loading}
              >

                {loading
                  ? "Cadastrando..."
                  : "Cadastrar Empresa"
                }

              </button>

            </div>

          </div>


          {/* ==================================================
              LOADING
              ================================================== */}

          {loading && (

            <div className="preview-company-loading-backdrop">

              <div className="preview-company-loading-spinner">

                <Icon
                  icon="svg-spinners:ring-resize"
                  className="icon"
                />

              </div>

            </div>

          )}

        </>

      )}


      {/* ======================================================
          SUCESSO
          ====================================================== */}

      {successScreen && (

        <SuccessScreen

          companyName={
            companyData.name
          }

          companyHandle={
            companyData.handle
          }

          onClose={() =>
            navigate(
              `/central-user/${companyData.handle}/catalog`
            )
          }

        />

      )}

    </div>

  );

}