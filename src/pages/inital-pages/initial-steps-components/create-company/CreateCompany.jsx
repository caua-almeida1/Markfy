import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from 'react-router-dom';

import './create-company.css';
import ImageCropper from './utils/components/ImageCropper';

import {
  saveDraftImage,
  getDraftImage,
  removeDraftImage
} from './utils/companyDraft';

import { Icon } from '@iconify/react';

import {
  getDatabase,
  ref as dbRef,
  get,
  child
} from 'firebase/database';


const emptyLocation = {
  street: '',
  number: '',
  neighborhood: '',
  city: '',
  state: '',
  zipCode: '',
  country: ''
};

const COMPANY_CATEGORIES = [
  {
    id: 'barbearia',
    name: 'Barbearia',
    icon: 'solar:scissors-outline'
  },
  {
    id: 'salao-beleza',
    name: 'Salão de beleza',
    icon: 'solar:mirror-outline'
  },
  {
    id: 'cabeleireiro',
    name: 'Cabeleireiro',
    icon: 'solar:scissors-outline'
  },
  {
    id: 'manicure-pedicure',
    name: 'Manicure e pedicure',
    icon: 'solar:hand-stars-outline'
  },
  {
    id: 'sobrancelhas',
    name: 'Design de sobrancelhas',
    icon: 'solar:eye-outline'
  },
  {
    id: 'cilios',
    name: 'Extensão de cílios',
    icon: 'solar:eye-scan-outline'
  },
  {
    id: 'maquiagem',
    name: 'Maquiagem',
    icon: 'solar:palette-outline'
  },
  {
    id: 'tatuagem',
    name: 'Estúdio de tatuagem',
    icon: 'solar:pen-new-square-outline'
  },
  {
    id: 'fotografia',
    name: 'Estúdio de fotografia',
    icon: 'solar:camera-outline'
  },
  {
    id: 'estetica',
    name: 'Clínica de estética',
    icon: 'solar:heart-pulse-outline'
  },
  {
    id: 'massoterapia',
    name: 'Massoterapia',
    icon: 'solar:hand-heart-outline'
  },
  {
    id: 'spa',
    name: 'Spa e bem-estar',
    icon: 'solar:leaf-outline'
  },
  {
    id: 'odontologia',
    name: 'Clínica odontológica',
    icon: 'solar:medical-kit-outline'
  },
  {
    id: 'medicina',
    name: 'Consultório médico',
    icon: 'solar:stethoscope-outline'
  },
  {
    id: 'fisioterapia',
    name: 'Fisioterapia',
    icon: 'solar:health-outline'
  },
  {
    id: 'nutricao',
    name: 'Nutrição',
    icon: 'solar:chef-hat-outline'
  },
  {
    id: 'psicologia',
    name: 'Psicologia',
    icon: 'solar:brain-outline'
  },
  {
    id: 'personal-trainer',
    name: 'Personal trainer',
    icon: 'solar:running-outline'
  },
  {
    id: 'academia',
    name: 'Academia',
    icon: 'solar:dumbbell-outline'
  },
  {
    id: 'pilates',
    name: 'Pilates',
    icon: 'solar:body-outline'
  },
  {
    id: 'yoga',
    name: 'Yoga',
    icon: 'solar:meditation-outline'
  },
  {
    id: 'pet-shop',
    name: 'Pet shop',
    icon: 'solar:cat-outline'
  },
  {
    id: 'banho-tosa',
    name: 'Banho e tosa',
    icon: 'solar:scissors-square-outline'
  },
  {
    id: 'eventos',
    name: 'Fotografia e eventos',
    icon: 'solar:gallery-outline'
  },
  {
    id: 'design',
    name: 'Agência de design',
    icon: 'solar:pen-2-outline'
  },
  {
    id: 'marketing',
    name: 'Marketing e publicidade',
    icon: 'solar:graph-up-outline'
  },
  {
    id: 'tecnologia',
    name: 'Tecnologia e desenvolvimento',
    icon: 'solar:code-outline'
  },
  {
    id: 'consultoria',
    name: 'Consultoria',
    icon: 'solar:case-outline'
  },
  {
    id: 'educacao',
    name: 'Educação e cursos',
    icon: 'solar:book-2-outline'
  },
  {
    id: 'automotivo',
    name: 'Serviços automotivos',
    icon: 'solar:wheel-outline'
  }
];

const CreateCompany = () => {

  const navigate = useNavigate();
  const routerLocation = useLocation();

  const database = getDatabase();
  const sessionId = routerLocation.pathname.split('/').pop();

  const draftKey = `markfy_create_company_draft_${sessionId}`;
  const hasRestoredDraft = useRef(false);
  const [step, setStep] = useState(1);

  /* =====================================================
     DADOS DA EMPRESA
     ===================================================== */

  const [companyName, setCompanyName] = useState('');
  const [companyHandle, setCompanyHandle] = useState('');
  const [doc, setDoc] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [settingsStep, setSettingsStep] = useState('location');
  const [companyCategories, setCompanyCategories] = useState([]);
  /* =====================================================
       VALIDAÇÕES
       ===================================================== */

  const [nameErrors, setNameErrors] = useState([]);
  const [errors, setErrors] = useState([]);
  const [docError, setDocError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [isCheckingHandle, setIsCheckingHandle] = useState(false);


  /* =====================================================
     IDENTIDADE
     ===================================================== */

  const [companyDescription, setCompanyDescription] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);

  const [logoFile, setLogoFile] = useState(null);

  const [showLogoModal, setShowLogoModal] = useState(false);

  const [logoSource, setLogoSource] = useState(null);
  const [showLogoCropper, setShowLogoCropper] = useState(false);

  const [isDraggingLogo, setIsDraggingLogo] = useState(false);

  /* =====================================================
     LOCALIZAÇÃO
     ===================================================== */

  const [location, setLocation] = useState(emptyLocation);
  const [loadingLocation, setLoadingLocation] = useState(false);

  /* =====================================================
     VALIDA NOME
     ===================================================== */

  const handleCategoryToggle = (categoryId) => {

    setCompanyCategories(prev => {

      if (prev.includes(categoryId)) {
        return prev.filter(id => id !== categoryId);
      }

      if (prev.length >= 3) {
        return prev;
      }

      return [...prev, categoryId];

    });

  };
  const validateName = (value) => {

    const validationErrors = [];

    if (value.trim().length === 0) {
      validationErrors.push(
        'O nome da empresa é obrigatório.'
      );
    }

    if (value.length > 30) {
      validationErrors.push(
        'Máximo de 30 caracteres.'
      );
    }

    setNameErrors(validationErrors);

  };


  /* =====================================================
     VALIDA IDENTIFICADOR
     ===================================================== */

  const validateHandle = async (value) => {

    const validationErrors = [];

    if (value.length < 3) {
      validationErrors.push(
        'Mínimo de 3 caracteres.'
      );
    }

    if (value.length > 25) {
      validationErrors.push(
        'Máximo de 25 caracteres.'
      );
    }

    if (/\s/.test(value)) {
      validationErrors.push(
        'Não pode conter espaços.'
      );
    }

    if (!/^[a-zA-Z0-9_-]*$/.test(value)) {
      validationErrors.push(
        'Apenas letras, números, hífen ou underline são permitidos.'
      );
    }

    if (
      validationErrors.length === 0 &&
      value
    ) {

      setIsCheckingHandle(true);

      try {

        const snapshot = await get(
          child(
            dbRef(database),
            `companys/${value}`
          )
        );

        if (snapshot.exists()) {

          validationErrors.push(
            'Este identificador já está em uso.'
          );

        }

      } catch (err) {

        console.error(
          'Erro ao verificar identificador:',
          err
        );

      }

      setIsCheckingHandle(false);

    }

    setErrors(validationErrors);

  };


  /* =====================================================
     CPF / CNPJ
     ===================================================== */

  const validateCPF_CNPJ = (value) => {

    const clean = value.replace(/\D/g, '');

    if (clean.length === 11) {

      if (!isValidCPF(clean)) {
        setDocError('CPF inválido.');
      } else {
        setDocError('');
      }

      return;
    }

    if (clean.length === 14) {

      if (!isValidCNPJ(clean)) {
        setDocError('CNPJ inválido.');
      } else {
        setDocError('');
      }

      return;
    }

    setDocError(
      'Informe um CPF ou CNPJ válido.'
    );

  };


  const isValidCPF = (cpf) => {

    if (
      !cpf ||
      cpf.length !== 11 ||
      /^(\d)\1{10}$/.test(cpf)
    ) {
      return false;
    }

    let sum = 0;

    for (let i = 0; i < 9; i++) {

      sum +=
        parseInt(cpf[i]) *
        (10 - i);

    }

    let firstDigit =
      (sum * 10) % 11;

    if (firstDigit === 10) {
      firstDigit = 0;
    }

    if (
      firstDigit !==
      parseInt(cpf[9])
    ) {
      return false;
    }

    sum = 0;

    for (let i = 0; i < 10; i++) {

      sum +=
        parseInt(cpf[i]) *
        (11 - i);

    }

    let secondDigit =
      (sum * 10) % 11;

    if (secondDigit === 10) {
      secondDigit = 0;
    }

    return (
      secondDigit ===
      parseInt(cpf[10])
    );

  };


  const isValidCNPJ = (cnpj) => {

    if (
      !cnpj ||
      cnpj.length !== 14 ||
      /^(\d)\1{13}$/.test(cnpj)
    ) {
      return false;
    }

    let length = cnpj.length - 2;

    let numbers =
      cnpj.substring(0, length);

    let digits =
      cnpj.substring(length);

    let sum = 0;

    let pos =
      length - 7;

    for (
      let i = length;
      i >= 1;
      i--
    ) {

      sum +=
        parseInt(
          numbers.charAt(
            length - i
          )
        ) * pos--;

      if (pos < 2) {
        pos = 9;
      }

    }

    let result =
      sum % 11 < 2
        ? 0
        : 11 - (sum % 11);

    if (
      result !==
      parseInt(digits.charAt(0))
    ) {
      return false;
    }

    length += 1;

    numbers =
      cnpj.substring(0, length);

    sum = 0;

    pos =
      length - 7;

    for (
      let i = length;
      i >= 1;
      i--
    ) {

      sum +=
        parseInt(
          numbers.charAt(
            length - i
          )
        ) * pos--;

      if (pos < 2) {
        pos = 9;
      }

    }

    result =
      sum % 11 < 2
        ? 0
        : 11 - (sum % 11);

    return (
      result ===
      parseInt(digits.charAt(1))
    );

  };


  /* =====================================================
     EMAIL
     ===================================================== */

  const validateEmail = (value) => {

    const regex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!regex.test(value)) {

      setEmailError(
        'Email inválido.'
      );

    } else {

      setEmailError('');

    }

  };


  /* =====================================================
     TELEFONE
     ===================================================== */

  const validatePhone = (value) => {

    const digits =
      value.replace(/\D/g, '');

    if (
      digits.length < 10 ||
      digits.length > 11
    ) {

      setPhoneError(
        'Número de telefone deve ter 10 ou 11 dígitos.'
      );

    } else {

      setPhoneError('');

    }

  };


  /* =====================================================
     IDENTIFICADOR
     ===================================================== */

  const handleHandleChange = (event) => {

    const value =
      event.target.value
        .toLowerCase()
        .replace(/^@/, '');

    setCompanyHandle(value);

    validateHandle(value);

  };


  /* =====================================================
     LOCALIZAÇÃO
     ===================================================== */

  const handleLocationChange = (event) => {

    const {
      name,
      value
    } = event.target;

    setLocation(prev => ({
      ...prev,
      [name]: value
    }));

  };


  const handleDeviceLocation = () => {

    if (!navigator.geolocation) {
      return;
    }

    setLoadingLocation(true);

    navigator.geolocation.getCurrentPosition(

      async (position) => {

        try {

          const {
            latitude,
            longitude
          } = position.coords;

          const response =
            await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
              {
                headers: {
                  Accept:
                    'application/json'
                }
              }
            );

          if (!response.ok) {
            throw new Error(
              'Erro ao buscar endereço.'
            );
          }

          const data =
            await response.json();

          const address =
            data.address || {};

          setLocation({

            street:
              address.road ||
              address.pedestrian ||
              address.residential ||
              '',

            number:
              address.house_number ||
              '',

            neighborhood:
              address.neighbourhood ||
              address.suburb ||
              '',

            city:
              address.city ||
              address.town ||
              address.village ||
              '',

            state:
              address.state ||
              '',

            zipCode:
              address.postcode ||
              '',

            country:
              address.country ||
              ''

          });

        } catch (error) {

          console.error(error);

        } finally {

          setLoadingLocation(false);

        }

      },

      (error) => {

        console.error(error);

        setLoadingLocation(false);

      },

      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }

    );

  };


  /* =====================================================
     ETAPA 01
     ===================================================== */

  const handleNextStep = (event) => {

    event.preventDefault();

    if (
      errors.length > 0 ||
      nameErrors.length > 0 ||
      docError !== '' ||
      emailError !== '' ||
      phoneError !== '' ||
      isCheckingHandle
    ) {
      return;
    }

    if (
      !companyName.trim() ||
      !companyHandle.trim() ||
      !doc.trim() ||
      !email.trim() ||
      !phone.trim()
    ) {
      return;
    }

    setStep(2);

  };


  /* =====================================================
     ETAPA 02
     ===================================================== */

  const handleNextToSettings = () => {
    setStep(3);
  };

  /* =====================================================
     VOLTAR
     ===================================================== */

  const handlePreviousStep = () => {

    setStep(prev =>
      Math.max(1, prev - 1)
    );

  };


  /* =====================================================
     PREVIEW
     ===================================================== */

  const handleProceedToPreview = () => {
    navigate(
      `/newcompany/previewcompany/${sessionId}`,
      {
        state: {
          name: companyName,
          handle: companyHandle,
          document: doc,
          email,
          phone,

          companyCategories,
          description: companyDescription,

          logoPreview: selectedImage || null,

          location: {
            street: location.street || '',
            number: location.number || '',
            neighborhood: location.neighborhood || '',
            city: location.city || '',
            state: location.state || '',
            zipCode: location.zipCode || '',
            country: location.country || ''
          },

          returnStep: step,
          draftKey
        }
      }
    );
  };

  /* =====================================================
   LOGO
   ===================================================== */
  const handleLogoChange = (event) => {

    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    handleLogoFile(file);

    event.target.value = '';

  };

  const handleLogoFile = (file) => {

    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    setLogoFile(file);

    const reader = new FileReader();

    reader.onload = () => {

      setLogoSource(reader.result);

      // Fecha o modal de seleção
      setShowLogoModal(false);

      // Abre somente o modal de recorte
      setShowLogoCropper(true);

    };

    reader.onerror = () => {

      console.error('Erro ao carregar imagem.');

    };

    reader.readAsDataURL(file);

  };

  const handleLogoDragOver = (event) => {

    event.preventDefault();

    setIsDraggingLogo(true);

  };


  const handleLogoDragLeave = (event) => {

    event.preventDefault();

    setIsDraggingLogo(false);

  };


  const handleLogoDrop = (event) => {

    event.preventDefault();

    setIsDraggingLogo(false);

    const file = event.dataTransfer.files?.[0];

    if (!file) {
      return;
    }

    handleLogoFile(file);

  };

  const handleLogoCrop = (croppedImage) => {

    setSelectedImage(croppedImage);

    setShowLogoCropper(false);
    setLogoSource(null);

  };

  /* =====================================================
   RESTAURAR RASCUNHO
   ===================================================== */

  useEffect(() => {

    let cancelled = false;

    const restoreDraft = async () => {

      try {

        const savedDraft =
          localStorage.getItem(draftKey);

        let draft = null;

        if (savedDraft) {

          draft = JSON.parse(
            savedDraft
          );

        }


        // ============================
        // DADOS DA EMPRESA
        // ============================

        if (draft) {

          setCompanyName(
            draft.companyName || ''
          );

          setCompanyHandle(
            draft.companyHandle || ''
          );

          setDoc(
            draft.doc || ''
          );

          setEmail(
            draft.email || ''
          );

          setPhone(
            draft.phone || ''
          );


          // ============================
          // IDENTIDADE
          // ============================

          setCompanyDescription(
            draft.companyDescription || ''
          );


          // ============================
          // LOCALIZAÇÃO
          // ============================

          setLocation(
            draft.location || emptyLocation
          );

          setCompanyCategories(
            Array.isArray(draft.companyCategories)
              ? draft.companyCategories
              : draft.companyCategory
                ? [draft.companyCategory]
                : []
          );

          setSettingsStep(
            draft.settingsStep || 'location'
          );
          // ============================
          // ETAPA
          // ============================

          setStep(
            draft.step || 1
          );

        }


        // ============================
        // RESTAURAR IMAGEM
        // ============================

        const savedImage =
          await getDraftImage(draftKey);

        if (
          savedImage &&
          !cancelled
        ) {

          setSelectedImage(
            savedImage
          );

        }

      } catch (error) {

        console.error(
          'Erro ao restaurar rascunho:',
          error
        );

      } finally {

        if (!cancelled) {

          hasRestoredDraft.current =
            true;

        }

      }

    };


    restoreDraft();

    return () => {

      cancelled = true;

    };

  }, [draftKey]);

  /* =====================================================
   SALVAR RASCUNHO
   ===================================================== */

  useEffect(() => {

    if (
      !hasRestoredDraft.current
    ) {
      return;
    }


    const saveDraft = async () => {

      try {

        // ============================
        // LOCALSTORAGE
        // SOMENTE DADOS LEVES
        // ============================

        const draft = {

          step,

          companyName,
          companyHandle,
          doc,
          email,
          phone,

          companyCategories,
          settingsStep,

          companyDescription,

          location

        };

        localStorage.setItem(
          draftKey,
          JSON.stringify(draft)
        );


        // ============================
        // IMAGEM → INDEXEDDB
        // ============================

        if (selectedImage) {

          await saveDraftImage(
            draftKey,
            selectedImage
          );

        } else {

          await removeDraftImage(
            draftKey
          );

        }

      } catch (error) {

        console.error(
          'Erro ao salvar rascunho:',
          error
        );

      }

    };


    saveDraft();

  }, [
    draftKey,

    step,

    companyName,
    companyHandle,
    doc,
    email,
    phone,

    companyDescription,

    selectedImage,

    location
  ]);

  return (

    <main className="create-company-wrapper">

      {/* =================================================
          HEADER
          ================================================= */}

      <header className="create-company-header">

        <button
          type="button"
          className="create-company-header-back"
          onClick={() => navigate(-1)}
          aria-label="Voltar"
        >
          <Icon icon="solar:arrow-left-linear" />
        </button>

        <div className="create-company-header-brand">
          <span>MARKFY</span>
        </div>

        <span className="create-company-header-step">
          0{step}
        </span>

      </header>


      <section className="create-company-content">

        {/* =================================================
            PROGRESS
            ================================================= */}

        <div className="create-company-progress">

          <div
            className={`create-company-progress-item ${step >= 1 ? 'active' : ''
              }`}
          >
            <span>01</span>
            <p>Dados da empresa</p>
          </div>

          <div className="create-company-progress-line" />

          <div
            className={`create-company-progress-item ${step >= 2 ? 'active' : ''
              }`}
          >
            <span>02</span>
            <p>Identidade</p>
          </div>

          <div className="create-company-progress-line" />

          <div
            className={`create-company-progress-item ${step >= 3 ? 'active' : ''
              }`}
          >
            <span>03</span>
            <p>Configurações</p>
          </div>

        </div>


        {/* =================================================
            STEP 01
            ================================================= */}

        {step === 1 && (

          <div className="create-company-step">

            <div className="create-company-intro">

              <span className="create-company-overline">
                DADOS DA EMPRESA
              </span>

              <h1>
                Vamos criar sua empresa.
              </h1>

              <p>
                Informe os dados principais para
                cadastrar sua empresa na Markfy.
              </p>

            </div>


            <form
              className="create-company-form"
              onSubmit={handleNextStep}
            >

              <div className="create-company-field">

                <label htmlFor="companyName">
                  Nome da empresa
                </label>

                <input
                  id="companyName"
                  type="text"
                  placeholder="Ex.: Markfy Tecnologia"
                  value={companyName}
                  onChange={(event) => {

                    const value =
                      event.target.value;

                    setCompanyName(value);

                    validateName(value);

                  }}
                  required
                />

                {nameErrors.length > 0 && (

                  <div className="create-company-field-error">

                    <Icon icon="solar:danger-triangle-linear" />

                    <span>
                      {nameErrors[0]}
                    </span>

                  </div>

                )}

              </div>


              <div className="create-company-field">

                <label htmlFor="companyHandle">
                  Identificador
                </label>

                <div className="create-company-handle">

                  <span>@</span>

                  <input
                    id="companyHandle"
                    type="text"
                    placeholder="nome_da_empresa"
                    value={companyHandle}
                    onChange={handleHandleChange}
                    autoComplete="off"
                    required
                  />

                  {isCheckingHandle && (

                    <Icon
                      icon="svg-spinners:ring-resize"
                      className="create-company-loading"
                    />

                  )}

                </div>

                <small>
                  Esse identificador será usado para
                  encontrar sua empresa na Markfy.
                </small>

                {errors.length > 0 && (

                  <div className="create-company-field-error">

                    <Icon icon="solar:danger-triangle-linear" />

                    <span>
                      {errors[0]}
                    </span>

                  </div>

                )}

              </div>


              <div className="create-company-field">

                <label htmlFor="companyDocument">
                  CPF ou CNPJ
                </label>

                <input
                  id="companyDocument"
                  type="text"
                  inputMode="numeric"
                  placeholder="Digite o CPF ou CNPJ"
                  value={doc}
                  onChange={(event) => {

                    const value =
                      event.target.value.replace(
                        /\D/g,
                        ''
                      );

                    setDoc(value);

                    validateCPF_CNPJ(value);

                  }}
                  required
                />

                {docError && (

                  <div className="create-company-field-error">

                    <Icon icon="solar:danger-triangle-linear" />

                    <span>
                      {docError}
                    </span>

                  </div>

                )}

              </div>


              <div className="create-company-fields-row">

                <div className="create-company-field">

                  <label htmlFor="companyEmail">
                    Email
                  </label>

                  <input
                    id="companyEmail"
                    type="email"
                    placeholder="contato@empresa.com"
                    value={email}
                    onChange={(event) => {

                      const value =
                        event.target.value;

                      setEmail(value);

                      validateEmail(value);

                    }}
                    required
                  />

                  {emailError && (

                    <div className="create-company-field-error">

                      <Icon icon="solar:danger-triangle-linear" />

                      <span>
                        {emailError}
                      </span>

                    </div>

                  )}

                </div>


                <div className="create-company-field">

                  <label htmlFor="companyPhone">
                    Telefone
                  </label>

                  <input
                    id="companyPhone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="(00) 00000-0000"
                    value={phone}
                    onChange={(event) => {

                      const value =
                        event.target.value.replace(
                          /\D/g,
                          ''
                        );

                      setPhone(value);

                      validatePhone(value);

                    }}
                    required
                  />

                  {phoneError && (

                    <div className="create-company-field-error">

                      <Icon icon="solar:danger-triangle-linear" />

                      <span>
                        {phoneError}
                      </span>

                    </div>

                  )}

                </div>

              </div>


              <div className="create-company-actions">

                <button
                  type="button"
                  className="create-company-back"
                  onClick={() => navigate(-1)}
                >
                  <Icon icon="solar:arrow-left-linear" />

                  Voltar
                </button>

                <button
                  type="submit"
                  className="create-company-primary"
                  disabled={
                    isCheckingHandle ||
                    errors.length > 0 ||
                    nameErrors.length > 0 ||
                    docError !== '' ||
                    emailError !== '' ||
                    phoneError !== ''
                  }
                >
                  Continuar

                  <Icon icon="solar:arrow-right-linear" />
                </button>

              </div>

            </form>

          </div>

        )}


        {/* =================================================
            STEP 02
            ================================================= */}

        {step === 2 && (

          <div className="create-company-step">

            <div className="create-company-intro">

              <span className="create-company-overline">
                IDENTIDADE DA EMPRESA
              </span>

              <h1>
                Dê uma identidade à sua empresa.
              </h1>

              <p>
                Escolha como sua empresa será apresentada
                para seus clientes.
              </p>

            </div>


            {/* LOGO */}

            <div className="create-company-logo-section">

              <div className="create-company-section-heading">

                <div className="create-company-section-icon">
                  <Icon icon="solar:gallery-add-linear" />
                </div>

                <div>

                  <strong>
                    Logo da empresa
                  </strong>

                  <span>
                    Use uma imagem quadrada para obter
                    o melhor resultado.
                  </span>

                </div>

              </div>


              <div className="create-company-logo-upload-wrapper">

                <button
                  type="button"
                  className={`create-company-logo-upload ${selectedImage ? 'has-image' : ''
                    }`}
                  onClick={() => setShowLogoModal(true)}
                >

                  {selectedImage ? (

                    <>
                      <div className="create-company-logo-preview-circle">
                        <img
                          src={selectedImage}
                          alt="Preview da logo"
                        />
                      </div>

                      <div className="create-company-logo-overlay">

                        <Icon icon="solar:pen-new-square-linear" />

                        <span>
                          Editar imagem
                        </span>

                      </div>
                    </>

                  ) : (

                    <div className="create-company-logo-empty">

                      <div className="create-company-logo-empty-icon">

                        <Icon icon="solar:gallery-add-linear" />

                      </div>

                      <strong>
                        Adicionar logo
                      </strong>

                      <span>
                        PNG, JPG ou WEBP
                      </span>

                    </div>

                  )}

                </button>

              </div>

              {selectedImage && (

                <button
                  type="button"
                  className="create-company-logo-remove"
                  onClick={() =>
                    setSelectedImage(null)
                  }
                >
                  <Icon icon="solar:trash-bin-trash-linear" />

                  Remover logo
                </button>

              )}

            </div>


            {/* DESCRIÇÃO */}

            <div className="create-company-description">

              <label htmlFor="companyDescription">
                Descrição
              </label>

              <textarea
                id="companyDescription"
                placeholder="Conte brevemente sobre sua empresa..."
                maxLength={300}
                rows={5}
                value={companyDescription}
                onChange={(event) =>
                  setCompanyDescription(
                    event.target.value
                  )
                }
              />

              <div className="create-company-description-footer">

                <span>
                  Uma breve descrição ajuda seus clientes
                  a entenderem sua empresa.
                </span>

                <small>
                  {companyDescription.length}/300
                </small>

              </div>

            </div>


            <div className="create-company-actions">

              <button
                type="button"
                className="create-company-back"
                onClick={handlePreviousStep}
              >
                <Icon icon="solar:arrow-left-linear" />

                Voltar
              </button>

              <button
                type="button"
                className="create-company-primary"
                onClick={handleNextToSettings}
              >
                Continuar

                <Icon icon="solar:arrow-right-linear" />
              </button>

            </div>

          </div>

        )}


        {/* =================================================
            STEP 03
            ================================================= */}

        {/* =================================================
    STEP 03 — CONFIGURAÇÕES
    ================================================= */}

        {step === 3 && (

          <div className="create-company-step">

            <div className="create-company-intro">

              <span className="create-company-overline">
                CONFIGURAÇÕES DA EMPRESA
              </span>

              <h1>
                Vamos configurar sua empresa.
              </h1>

              <p>
                Complete as informações abaixo para
                deixar sua empresa pronta para seus clientes.
              </p>

            </div>


            {/* =================================================
        CONFIGURATION TABS
        ================================================= */}

            <div className="create-company-settings-tabs">

              <button
                type="button"
                className={
                  settingsStep === 'location'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setSettingsStep('location')
                }
              >

                <Icon icon="solar:map-point-outline" />

                <span>
                  Localização
                </span>

              </button>


              <button
                type="button"
                className={
                  settingsStep === 'category'
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setSettingsStep('category')
                }
              >

                <Icon icon="solar:shop-2-outline" />

                <span>
                  Categoria
                </span>

              </button>

            </div>


            {/* =================================================
        LOCALIZAÇÃO
        ================================================= */}

            {settingsStep === 'location' && (

              <div className="create-company-settings-content">

                <div className="create-company-subintro">

                  <span className="create-company-overline">
                    LOCALIZAÇÃO
                  </span>

                  <h2>
                    Onde sua empresa está?
                  </h2>

                  <p>
                    Adicione o endereço da sua empresa.
                    Você pode usar sua localização atual
                    ou preencher os dados manualmente.
                  </p>

                </div>


                {/* LOCALIZAÇÃO AUTOMÁTICA */}

                <button
                  type="button"
                  className="create-company-location-detect"
                  onClick={handleDeviceLocation}
                  disabled={loadingLocation}
                >

                  <div className="create-company-location-detect-icon">

                    <Icon
                      icon={
                        loadingLocation
                          ? 'line-md:loading-twotone-loop'
                          : 'solar:gps-outline'
                      }
                    />

                  </div>


                  <div className="create-company-location-detect-content">

                    <strong>
                      {loadingLocation
                        ? 'Localizando...'
                        : 'Usar minha localização'}
                    </strong>

                    <span>
                      Preencher automaticamente pelo dispositivo
                    </span>

                  </div>


                  <Icon
                    icon="solar:alt-arrow-right-linear"
                    className="create-company-location-detect-arrow"
                  />

                </button>


                <div className="create-company-location-divider">
                  <span>
                    ou preencha manualmente
                  </span>
                </div>


                {/* ENDEREÇO */}

                <div className="create-company-location-form">

                  <div className="create-company-location-row">

                    <div className="create-company-field">

                      <label htmlFor="street">
                        Rua ou avenida
                      </label>

                      <div className="create-company-input-icon-wrapper">

                        <Icon icon="solar:map-point-outline" />

                        <input
                          id="street"
                          name="street"
                          type="text"
                          placeholder="Rua ou avenida"
                          value={location.street}
                          onChange={handleLocationChange}
                        />

                      </div>

                    </div>


                    <div className="create-company-field create-company-location-number">

                      <label htmlFor="number">
                        Número
                      </label>

                      <input
                        id="number"
                        name="number"
                        type="text"
                        placeholder="Número"
                        value={location.number}
                        onChange={handleLocationChange}
                      />

                    </div>

                  </div>


                  <div className="create-company-field">

                    <label htmlFor="neighborhood">
                      Bairro
                    </label>

                    <input
                      id="neighborhood"
                      name="neighborhood"
                      type="text"
                      placeholder="Bairro"
                      value={location.neighborhood}
                      onChange={handleLocationChange}
                    />

                  </div>


                  <div className="create-company-location-row">

                    <div className="create-company-field">

                      <label htmlFor="city">
                        Cidade
                      </label>

                      <input
                        id="city"
                        name="city"
                        type="text"
                        placeholder="Cidade"
                        value={location.city}
                        onChange={handleLocationChange}
                      />

                    </div>


                    <div className="create-company-field">

                      <label htmlFor="state">
                        Estado
                      </label>

                      <input
                        id="state"
                        name="state"
                        type="text"
                        placeholder="Estado"
                        value={location.state}
                        onChange={handleLocationChange}
                      />

                    </div>

                  </div>


                  <div className="create-company-location-row">

                    <div className="create-company-field">

                      <label htmlFor="zipCode">
                        CEP
                      </label>

                      <input
                        id="zipCode"
                        name="zipCode"
                        type="text"
                        inputMode="numeric"
                        placeholder="00000-000"
                        value={location.zipCode}
                        onChange={handleLocationChange}
                      />

                    </div>


                    <div className="create-company-field">

                      <label htmlFor="country">
                        País
                      </label>

                      <input
                        id="country"
                        name="country"
                        type="text"
                        placeholder="País"
                        value={location.country}
                        onChange={handleLocationChange}
                      />

                    </div>

                  </div>

                </div>

              </div>

            )}


            {/* =================================================
        CATEGORIA
        ================================================= */}

            {settingsStep === 'category' && (

              <div className="create-company-settings-content">

                <div className="create-company-subintro">

                  <span className="create-company-overline">
                    CATEGORIA
                  </span>

                  <h2>
                    Qual é o tipo da sua empresa?
                  </h2>

                  <div className="create-company-category-counter">
                    <span>
                      {companyCategories.length}/3 categorias selecionadas
                    </span>

                    {companyCategories.length === 3 && (
                      <small>
                        Você atingiu o limite de categorias.
                      </small>
                    )}
                  </div>

                </div>


                <div className="create-company-category-grid">

                  {COMPANY_CATEGORIES.map((category) => {

                    const isSelected =
                      companyCategories.includes(category.id);

                    return (

                      <button
                        key={category.id}
                        type="button"
                        className={`create-company-category-card ${isSelected
                          ? 'selected'
                          : ''
                          }`}
                        onClick={() =>
                          handleCategoryToggle(category.id)
                        }
                      >

                        <div className="create-company-category-icon">

                          <Icon icon={category.icon} />

                        </div>


                        <span>
                          {category.name}
                        </span>


                        {isSelected && (

                          <div className="create-company-category-check">

                            <Icon icon="solar:check-circle-bold" />

                          </div>

                        )}

                      </button>

                    );

                  })}

                </div>

              </div>

            )}


            {/* =================================================
        ACTIONS
        ================================================= */}

            <div className="create-company-actions">

              <button
                type="button"
                className="create-company-back"
                onClick={handlePreviousStep}
              >

                <Icon icon="solar:arrow-left-linear" />

                Voltar

              </button>


              {settingsStep === 'location' ? (

                <button
                  type="button"
                  className="create-company-primary"
                  onClick={() =>
                    setSettingsStep('category')
                  }
                >

                  Continuar

                  <Icon icon="solar:arrow-right-linear" />

                </button>

              ) : (

                <button
                  type="button"
                  className="create-company-primary"
                  disabled={companyCategories.length === 0}
                  onClick={handleProceedToPreview}
                >
                  Revisar empresa

                  <Icon icon="solar:arrow-right-linear" />

                </button>

              )}

            </div>

          </div>

        )}



      </section>


      {/* =================================================
          MODAL DA LOGO
          ================================================= */}

      {/* =================================================
    MODAL DA LOGO
    ================================================= */}

      {
        showLogoModal && (

          <div
            className="create-company-logo-modal"
            role="dialog"
            aria-modal="true"
            onClick={(event) => {

              if (event.target === event.currentTarget) {
                setShowLogoModal(false);
              }

            }}
          >

            <div className="create-company-logo-modal-content">

              {/* HEADER */}

              <div className="create-company-logo-modal-header">

                <div className="create-company-logo-modal-title">

                  <div className="create-company-logo-modal-title-icon">
                    <Icon icon="solar:gallery-add-linear" />
                  </div>

                  <div>

                    <span className="create-company-overline">
                      LOGO DA EMPRESA
                    </span>

                    <h2>
                      {selectedImage
                        ? 'Sua logo está pronta.'
                        : 'Adicione sua logo.'}
                    </h2>

                    <p>
                      {selectedImage
                        ? 'Você pode trocar a imagem sempre que quiser.'
                        : 'Escolha uma imagem ou arraste um arquivo para cá.'}
                    </p>

                  </div>

                </div>


                <button
                  type="button"
                  className="create-company-logo-modal-close"
                  onClick={() => setShowLogoModal(false)}
                  aria-label="Fechar"
                >
                  <Icon icon="solar:close-linear" />
                </button>

              </div>


              {/* CONTEÚDO */}

              {selectedImage ? (

                <div className="create-company-logo-editor">

                  <div
                    className="create-company-logo-final-preview"
                    onClick={() => {
                      setLogoSource(selectedImage);
                      setShowLogoModal(false);
                      setShowLogoCropper(true);
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();

                        setLogoSource(selectedImage);
                        setShowLogoModal(false);
                        setShowLogoCropper(true);
                      }
                    }}
                  >
                    <div className="create-company-logo-final-circle">

                      <img
                        src={selectedImage}
                        alt="Logo da empresa"
                      />

                    </div>

                    <div className="create-company-logo-final-overlay">

                      <Icon icon="solar:pen-new-square-linear" />

                      <span>
                        Editar imagem
                      </span>

                    </div>
                  </div>


                  <div className="create-company-logo-final-info">

                    <strong>
                      Logo definida
                    </strong>

                    <span>
                      A imagem foi recortada em formato circular
                      para manter uma apresentação consistente.
                    </span>

                  </div>


                  <div className="create-company-logo-editor-actions">

                    <label
                      htmlFor="companyLogoReplace"
                      className="create-company-logo-change"
                    >

                      <Icon icon="solar:gallery-edit-linear" />

                      Trocar imagem

                    </label>

                    <input
                      id="companyLogoReplace"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="create-company-logo-file-input"
                      onChange={handleLogoChange}
                    />


                    <button
                      type="button"
                      className="create-company-logo-remove-editor"
                      onClick={() => {

                        setSelectedImage(null);
                        setLogoFile(null);
                        setLogoSource(null);

                      }}
                    >

                      <Icon icon="solar:trash-bin-trash-linear" />

                      Remover

                    </button>

                  </div>

                </div>

              ) : (

                <div
                  className={`create-company-logo-dropzone ${isDraggingLogo ? 'dragging' : ''
                    }`}
                  onDragOver={handleLogoDragOver}
                  onDragEnter={handleLogoDragOver}
                  onDragLeave={handleLogoDragLeave}
                  onDrop={handleLogoDrop}
                >

                  <input
                    id="companyLogo"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="create-company-logo-file-input"
                    onChange={handleLogoChange}
                  />


                  <div className="create-company-logo-dropzone-icon">

                    <Icon icon="solar:cloud-upload-linear" />

                  </div>


                  <strong>
                    Arraste sua logo para cá
                  </strong>

                  <span>
                    ou selecione uma imagem do seu dispositivo
                  </span>


                  <label
                    htmlFor="companyLogo"
                    className="create-company-logo-select"
                  >

                    <Icon icon="solar:gallery-add-linear" />

                    Selecionar imagem

                  </label>


                  <small>
                    PNG, JPG ou WEBP · recomendado 1:1
                  </small>

                </div>

              )}


              {/* FOOTER */}

              <div className="create-company-logo-modal-footer">

                <span>
                  Você poderá alterar sua logo depois.
                </span>

                <button
                  type="button"
                  className="create-company-logo-modal-primary"
                  onClick={() => setShowLogoModal(false)}
                >

                  {selectedImage
                    ? 'Usar esta logo'
                    : 'Continuar sem logo'}

                  <Icon icon="solar:arrow-right-linear" />

                </button>

              </div>

            </div>

          </div>

        )
      }

      {
        showLogoCropper && logoSource && (

          <div className="create-company-crop-modal">

            <div className="create-company-crop-modal-content">

              <div className="create-company-crop-header">

                <span className="create-company-overline">
                  AJUSTAR LOGO
                </span>

                <h2>
                  Enquadre sua logo.
                </h2>

                <p>
                  Ajuste a imagem dentro do círculo
                  para definir exatamente como ela será exibida.
                </p>

              </div>


              <div className="create-company-crop-area">

                <ImageCropper
                  imageSrc={logoSource}

                  closeModal={() => {

                    setShowLogoCropper(false);
                    setLogoSource(null);
                    setLogoFile(null);

                  }}

                  updateAvatar={handleLogoCrop}

                />

              </div>

            </div>

          </div>

        )
      }

    </main >

  );

};


export default CreateCompany;