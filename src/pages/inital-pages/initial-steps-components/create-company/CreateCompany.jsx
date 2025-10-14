import React, { useState } from 'react';
import { useNavigate } from "react-router-dom";

import './create-company.css';
import Logo from '../../../../img/logo-markfy.svg';

import { Icon } from '@iconify/react';
import imageCompression from 'browser-image-compression';

import ImageCropper from './utils/components/ImageCropper';
import Profile from './utils/components/Profile';

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getDatabase, ref as dbRef, set, get, child } from "firebase/database";

const CreateCompany = () => {
  const storage = getStorage();
  const database = getDatabase();

  const dataURLtoBlob = (dataurl) => {
    const arr = dataurl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  };

  const [step, setStep] = useState(1);

  const [nameErrors, setNameErrors] = useState([]);
  const [companyName, setCompanyName] = useState('');
  const [companyHandle, setCompanyHandle] = useState('');
  const [errors, setErrors] = useState([]);
  const [isCheckingHandle, setIsCheckingHandle] = useState(false);
  const [doc, setDoc] = useState('');
  const [docError, setDocError] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');

  const navigate = useNavigate();

  const validateHandle = async (value) => {
    const validationErrors = [];

    if (value.length < 3) {
      validationErrors.push('Mínimo de 3 caracteres.');
    }

    if (value.length > 25) {
      validationErrors.push('Máximo de 25 caracteres.');
    }

    if (/\s/.test(value)) {
      validationErrors.push('Não pode conter espaços.');
    }

    if (!/^[a-zA-Z0-9_-]*$/.test(value)) {
      validationErrors.push('Apenas letras, números, hífen ou underline são permitidos.');
    }

    // Só consulta no banco se não tiver erros locais
    if (validationErrors.length === 0 && value) {
      setIsCheckingHandle(true);
      try {
        const snapshot = await get(child(dbRef(database), `companys/${value}`));
        if (snapshot.exists()) {
          validationErrors.push('Este identificador já está em uso.');
        }
      } catch (err) {
        console.error("Erro ao verificar identificador:", err);
      }
      setIsCheckingHandle(false);
    }

    setErrors(validationErrors);
  };

  const validateName = (value) => {
    const validationErrors = [];

    if (value.trim().length === 0) {
      validationErrors.push('O nome da empresa é obrigatório.');
    }

    if (value.length > 30) {
      validationErrors.push('Máximo de 30 caracteres.');
    }

    setNameErrors(validationErrors);
  };

  const validateCPF_CNPJ = (value) => {
    const clean = value.replace(/\D/g, '');

    if (clean.length === 11) {
      if (!isValidCPF(clean)) {
        setDocError('CPF inválido.');
      } else {
        setDocError('');
      }
    } else if (clean.length === 14) {
      if (!isValidCNPJ(clean)) {
        setDocError('CNPJ inválido.');
      } else {
        setDocError('');
      }
    } else {
      setDocError('Informe um CPF ou CNPJ válido.');
    }
  };

  const isValidCPF = (cpf) => {
    if (!cpf || cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(cpf[i]) * (10 - i);
    let firstDigit = (sum * 10) % 11;
    if (firstDigit === 10) firstDigit = 0;
    if (firstDigit !== parseInt(cpf[9])) return false;

    sum = 0;
    for (let i = 0; i < 10; i++) sum += parseInt(cpf[i]) * (11 - i);
    let secondDigit = (sum * 10) % 11;
    if (secondDigit === 10) secondDigit = 0;
    return secondDigit === parseInt(cpf[10]);
  };

  const isValidCNPJ = (cnpj) => {
    if (!cnpj || cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
    let length = cnpj.length - 2;
    let numbers = cnpj.substring(0, length);
    let digits = cnpj.substring(length);
    let sum = 0;
    let pos = length - 7;
    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbers.charAt(length - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    let result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    if (result !== parseInt(digits.charAt(0))) return false;

    length += 1;
    numbers = cnpj.substring(0, length);
    sum = 0;
    pos = length - 7;
    for (let i = length; i >= 1; i--) {
      sum += parseInt(numbers.charAt(length - i)) * pos--;
      if (pos < 2) pos = 9;
    }
    result = sum % 11 < 2 ? 0 : 11 - (sum % 11);
    return result === parseInt(digits.charAt(1));
  };

  const validateEmail = (value) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(value)) {
      setEmailError('Email inválido.');
    } else {
      setEmailError('');
    }
  };

  const validatePhone = (value) => {
    const digits = value.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 11) {
      setPhoneError('Número de telefone deve ter 10 ou 11 dígitos.');
    } else {
      setPhoneError('');
    }
  };

  const handleChange = (e) => {
    const value = e.target.value.toLowerCase();
    setCompanyHandle(value);
    validateHandle(value);
  };

  const [companyDescription, setCompanyDescription] = useState('');

  const [selectedImage, setSelectedImage] = useState(null);

  // ======== VARIÁVEIS COMPRMIR IMAGEM =========

  const compressImage = (imageSrc, quality = 0.25) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        // Diminuir a largura e altura proporcionalmente
        const maxWidth = img.width * quality;
        const maxHeight = img.height * quality;

        canvas.width = maxWidth;
        canvas.height = maxHeight;

        ctx.drawImage(img, 0, 0, maxWidth, maxHeight);

        // Gerar imagem JPEG comprimida (pode usar 'image/png' se quiser)
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7); // 0.7 qualidade para jpeg

        resolve(compressedDataUrl);
      };
      img.onerror = (err) => reject(err);

      img.src = imageSrc;
    });
  };

  const [showImageModal, setShowImageModal] = useState(false);

  const handleProceedToPreview = () => {
    const sessionId = Date.now(); // ou o sessionId que você já tem
    navigate(`/newcompany/previewcompany/${sessionId}`, {
      state: {
        name: companyName,
        handle: companyHandle,
        document: doc,
        email,
        phone,
        description: companyDescription,
        logoPreview: selectedImage || null,
      },
    });
  };

  return (
    <div className="create-company-wrapper">
      <div className="create-company-container">
        <div className="create-company-box">
          <img src={Logo} className="setup-logo" />

          {step === 1 && (
            <>

              <h1>Criar Nova Empresa</h1>
              <p>Preencha os campos abaixo para cadastrar sua empresa na plataforma.</p>

              <form className="create-company-form" onSubmit={(e) => {
                e.preventDefault();
                if (
                  errors.length === 0 &&
                  nameErrors.length === 0 &&
                  docError === '' &&
                  emailError === '' &&
                  phoneError === ''
                ) {
                  setStep(2); // muda para o passo 2
                }
              }}>
                <input
                  type="text"
                  placeholder="Nome da Empresa"
                  className="create-company-input"
                  value={companyName}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCompanyName(value);
                    validateName(value);
                  }}
                  required
                />
                {
                  nameErrors.length > 0 && (
                    <ul className="handle-error-list">
                      {nameErrors.map((err, index) => (
                        <li key={index}>{err}</li>
                      ))}
                    </ul>
                  )
                }

                <div className="company-at-input-wrapper">
                  <span className="company-at-prefix">@</span>
                  <input
                    type="text"
                    placeholder="identificador_da_empresa"
                    className="company-at-input"
                    value={companyHandle}
                    onChange={handleChange}
                    required
                  />
                </div>
                {
                  errors.length > 0 && (
                    <ul className="handle-error-list">
                      {errors.map((err, index) => (
                        <li key={index}>{err}</li>
                      ))}
                    </ul>
                  )
                }

                <input
                  type="text"
                  placeholder="CPF ou CNPJ"
                  className="create-company-input"
                  value={doc}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setDoc(raw);
                    validateCPF_CNPJ(raw);
                  }}
                  required
                />
                {
                  docError && (
                    <p className="handle-error-single">{docError}</p>
                  )
                }

                <input
                  type="email"
                  placeholder="Email de contato"
                  className="create-company-input"
                  value={email}
                  onChange={(e) => {
                    const value = e.target.value;
                    setEmail(value);
                    validateEmail(value);
                  }}
                  required
                />
                {
                  emailError && (
                    <p className="handle-error-single">{emailError}</p>
                  )
                }

                <input
                  type="tel"
                  placeholder="Telefone de contato (apenas números)"
                  className="create-company-input"
                  value={phone}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '');
                    setPhone(value);
                    validatePhone(value);
                  }}
                  required
                />
                {
                  phoneError && (
                    <p className="handle-error-single">{phoneError}</p>
                  )
                }

                <button
                  type="submit"
                  className="create-company-btn"
                  disabled={
                    errors.length > 0 ||
                    nameErrors.length > 0 ||
                    docError !== '' ||
                    emailError !== '' ||
                    phoneError !== ''
                  }
                >
                  Prosseguir
                </button>
              </form>
            </>
          )}

          {step === 2 && (
            <>
              <h1>Detalhes da Empresa</h1>
              <p>Adicione uma logo e uma descrição para a {companyName}.</p>
              <Profile selectedImage={selectedImage} setSelectedImage={setSelectedImage} />
              <div className="create-company-form">

                <textarea
                  className="create-company-input"
                  placeholder="Descrição da empresa (máx. 300 caracteres)"
                  maxLength={300}
                  rows={4}
                  value={companyDescription}
                  onChange={(e) => setCompanyDescription(e.target.value)}
                />

                <div className='create-company-btn-wrapper-row'>
                  <button
                    className="create-company-btn create-company-btn-back"
                    type="button"
                    onClick={() => setStep(1)}
                  >
                    Voltar
                  </button>

                  <button
                    className="create-company-btn"
                    type="button"
                    onClick={handleProceedToPreview}
                    disabled={!selectedImage}
                    style={{
                      opacity: !selectedImage ? 0.5 : 1,
                      cursor: !selectedImage ? "not-allowed" : "pointer"
                    }}
                  >
                    Preview da Empresa
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateCompany;
