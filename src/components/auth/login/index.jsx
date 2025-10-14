import React, { useState, useEffect } from 'react';
import SplashScreen from './componentes/spashscreen';
import MarkfyLogo from "../../../img/logo-markfy.svg";
import emailjs from "@emailjs/browser";

import { realtimeDb } from '../../../firebase/firebase';
import { ref, set, get } from 'firebase/database';

import {
  doSignInWithEmailAndPassword,
  doSignInWithGoogle
} from '../../../firebase/auth';

import { useNavigate } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../../firebase/firebase';

import { Icon } from '@iconify/react';
import './mainscreenregister.css';


const SERVICE_ID = "service_2l02vyh";
const TEMPLATE_ID = "template_6g6ub0p";
const PUBLIC_KEY = "QlWjNn5vihbWi9uLf";

const AuthScreen = () => {
  const [formError, setFormError] = useState('');

  useEffect(() => {
    emailjs.init(PUBLIC_KEY);
  }, []);
  const [step, setStep] = useState('register'); // 'register' | 'verify'
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    confirmPassword: ''
  });

  const handleAnimationComplete = () => {
    setShowSplash(false);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);
    setStep('register'); // <--- adiciona isso

    // Limpa os campos ao alternar
    setFormData({
      email: !isLogin ? formData.email : '', // mantém o email se for voltar para login
      password: '',
      name: '',
      confirmPassword: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(''); // limpa mensagens anteriores
    setIsLoading(true);

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const passwordRegex = /^(?=.*\d).{8,}$/;

    // Validação comum para login e registro
    if (!formData.email || !formData.password) {
      setFormError("Preencha seu email e senha.");
      setIsLoading(false);
      return;
    }

    if (!emailRegex.test(formData.email)) {
      setFormError("Email inválido.");
      setIsLoading(false);
      return;
    }

    if (!isLogin && !passwordRegex.test(formData.password)) {
      setFormError("A senha deve ter no mínimo 8 caracteres e pelo menos um número.");
      setIsLoading(false);
      return;
    }

    if (!isLogin && formData.password !== formData.confirmPassword) {
      setFormError("Senhas não correspondem.");
      setIsLoading(false);
      return;
    }

    try {
      if (isLogin) {
        const userCredential = await doSignInWithEmailAndPassword(formData.email, formData.password);
        const user = userCredential.user;

        if (rememberMe) {
          localStorage.setItem('authUser', JSON.stringify({
            uid: user.uid,
            email: user.email
          }));
        }

        // busca o nome do usuário
        const userRef = ref(realtimeDb, 'users/' + user.uid);
        const snapshot = await get(userRef);

        let name = 'Usuário';
        if (snapshot.exists()) {
          const userData = snapshot.val();
          name = userData.name || name;
        }

        await checkUserInitial(user.uid, user.email, name);


      } else {
        // verifica se email já está cadastrado
        const snapshot = await get(ref(realtimeDb, 'users'));
        const users = snapshot.val();
        const emailExists = Object.values(users || {}).some(user => user.email === formData.email);

        if (emailExists) {
          setFormError("Email já cadastrado.");
          setIsLoading(false);
          return;
        }

        // Gera código e envia
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        setGeneratedCode(code);
        await sendVerificationEmail(formData.email, code);
        setStep('verify');
      }
    } catch (error) {
      setFormError("Email ou senha incorreta.");
    } finally {
      setIsLoading(false);
    }
  };

  const checkUserInitial = async (uid, email, name) => {
    const userRef = ref(realtimeDb, 'users/' + uid);
    const snapshot = await get(userRef);

    if (snapshot.exists()) {
      const userData = snapshot.val();

      if (userData.initial === false) {
        navigate('/central-user', {
          state: { name: userData.name || name, email, id: uid }
        });
      } else {
        navigate('/initial-setup', {
          state: { name: userData.name || name, email, id: uid }
        });
      }
    } else {
      await set(userRef, {
        uid,
        name,
        email,
        initial: false
      });

      navigate('/initial-setup', { state: { name, email, id: uid } });
    }
  };

  const hashPassword = async (password) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  };

  const signInWithGoogle = async () => {
    try {
      const result = await doSignInWithGoogle();
      const user = result.user;

      const userRef = ref(realtimeDb, 'users/' + user.uid);
      const existingSnapshot = await get(userRef);

      const existingData = existingSnapshot.exists() ? existingSnapshot.val() : {};

      await set(userRef, {
        ...existingData, // preserva o que já existe (ex: senha)
        uid: user.uid,
        name: user.displayName,
        email: user.email,
        provider: 'google',
        usertype: existingData.usertype ?? 'null'
      });

      await checkUserInitial(user.uid, user.email, user.displayName || 'Usuário');

    } catch (error) {
      alert(error.message);
    }
  };

  useEffect(() => {
    const storedUser = localStorage.getItem('authUser');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);

      (async () => {
        const userRef = ref(realtimeDb, 'users/' + parsedUser.uid);
        const snapshot = await get(userRef);

        let name = 'Usuário';
        if (snapshot.exists()) {
          const userData = snapshot.val();
          name = userData.name || name;
        }

        await checkUserInitial(parsedUser.uid, parsedUser.email, name);
      })();
    }
  }, []);


  useEffect(() => {
    if (!showSplash) {
      const blob = document.getElementById("blob");
      if (blob) {
        // Animação aleatória do blob
        const animateBlob = () => {
          const x = Math.random() * 80;
          const y = Math.random() * 80;
          const scale = 1 + Math.random() * 0.5;

          blob.animate({
            left: `${x}%`,
            top: `${y}%`,
            transform: `scale(${scale})`
          }, { duration: 2000, fill: "forwards" });

          setTimeout(animateBlob, 2000);
        };

        animateBlob();
      }
    }
  }, [showSplash]);

  const [verificationCode, setVerificationCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');

  const sendVerificationEmail = async (email: string, code: string) => {
    try {
      await emailjs.send(
        SERVICE_ID,
        TEMPLATE_ID,
        {
          user_email: email,
          verification_code: code,
        },
        PUBLIC_KEY
      );
      console.log("E-mail enviado com sucesso!");
    } catch (error) {
      console.error("Erro ao enviar e-mail:", error);
      alert("Erro ao enviar o e-mail de verificação. Tente novamente.");
    }
  };

  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="app-container">
      {!showSplash && (
        <div className="liquid-background">
          <div id="blob" className="blob"></div>
          <div id="blur" className="blur"></div>
        </div>
      )}
      {showSplash ? (
        <SplashScreen onAnimationComplete={handleAnimationComplete} />
      ) : (
        <div className="main-container">
          <div className="content-wrapper">
            <div className="auth-header">
              <img
                src={MarkfyLogo}
                alt="Markfy Logo"
                className="auth-logo"
              />

            </div>
            <div className="auth-title">
              <h1>{isLogin ? 'Conecte-se com sua conta' : 'Crie sua conta'}</h1>
            </div>

            {step === 'register' ? (
              <form onSubmit={handleSubmit} className="auth-form">
                <div className="input-group">
                  {!isLogin && (
                    <input
                      type="text"
                      name="name"
                      placeholder="Nome completo"
                      className="auth-input"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                    />
                  )}
                  <input
                    type="email"
                    name="email"
                    placeholder="E-mail"
                    className="auth-input"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />
                  <div className="password-input-wrapper">
                    <input
                      type={showPassword ? "text" : "password"}
                      name="password"
                      placeholder="Senha"
                      className="auth-input"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                    />
                    <Icon
                      icon={showPassword ? "mdi:eye-off" : "mdi:eye"}
                      className="password-toggle-icon"
                      onClick={() => setShowPassword(!showPassword)}
                    />
                  </div>
                  {!isLogin && (
                    <div className="password-input-wrapper">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirmPassword"
                        placeholder="Confirme sua senha"
                        className="auth-input"
                        value={formData.confirmPassword}
                        onChange={handleInputChange}
                        required
                      />
                      <Icon
                        icon={showConfirmPassword ? "mdi:eye-off" : "mdi:eye"}
                        className="password-toggle-icon"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      />
                    </div>
                  )}
                </div>
                {formError && <div className="form-error">{formError}</div>}

                <button type="submit" className="auth-button" disabled={isLoading}>
                  {isLoading ? 'Carregando...' : isLogin ? 'Conectar-se' : 'Registrar-se'}
                </button>

                <div className="auth-divider">
                  <span className="divider-line"></span>
                  <span className="divider-text">ou</span>
                  <span className="divider-line"></span>
                </div>

                <button
                  type="button"
                  className="google-auth-button"
                  onClick={signInWithGoogle}
                >
                  <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                  {isLogin ? 'Conectar com Google' : 'Registrar com Google'}
                </button>

                {isLogin && (
                  <div className="auth-options">
                    <div className="remember-me">
                      <div className="checkbox-wrapper-46">
                        <input
                          type="checkbox"
                          id="remember-me-checkbox"
                          className="inp-cbx"
                          checked={rememberMe}
                          onChange={() => setRememberMe(!rememberMe)}
                        />
                        <label htmlFor="remember-me-checkbox" className="cbx">
                          <span>
                            <svg viewBox="0 0 12 10" height="10px" width="12px">
                              <polyline points="1.5 6 4.5 9 10.5 1"></polyline>
                            </svg>
                          </span>
                        </label>
                        <label
                          htmlFor="remember-me-checkbox"
                          className="remember-text"
                        >
                          Lembrar de mim
                        </label>
                      </div>
                    </div>
                    <a href="/forgot-password" className="forgot-password">
                      Esqueceu a senha?
                    </a>
                  </div>
                )}
              </form>
            ) : (
              <form onSubmit={async (e) => {
                e.preventDefault();
                setFormError('');

                if (verificationCode !== generatedCode) {
                  setFormError("Código de verificação incorreto.");
                  return;
                }

                try {
                  setIsLoading(true);
                  const userCredential = await createUserWithEmailAndPassword(
                    auth,
                    formData.email,
                    formData.password
                  );
                  const user = userCredential.user;

                  const hashedPassword = await hashPassword(formData.password);

                  await set(ref(realtimeDb, 'users/' + user.uid), {
                    uid: user.uid,
                    name: formData.name,
                    email: formData.email,
                    password: hashedPassword,
                    provider: 'markfy',
                    usertype: 'null',
                    initial: false
                  });

                  await checkUserInitial(user.uid, formData.email, formData.name);
                } catch (error) {
                  setFormError("Erro ao criar o usuário. Tente novamente.");
                } finally {
                  setIsLoading(false);
                }
              }} className="auth-form">
                <p className="auth-subtitle">
                  Enviamos um código de verificação para <strong>{formData.email}</strong>. Insira-o abaixo:
                </p>
                <input
                  type="text"
                  name="code"
                  placeholder="Código de verificação"
                  className="auth-input verify-input"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  required
                />
                {formError && <div className="form-error">{formError}</div>}
                <button type="submit" className="auth-button verify-button" disabled={isLoading}>
                  {isLoading ? 'Carregando...' : 'Verificar código'}
                </button>
              </form>
            )}

          </div>

          <div className="auth-footer">
            <p className="auth-toggle-text">
              {isLogin ? 'Não possui uma conta?' : 'Já possui uma conta?'}{' '}
              <button onClick={toggleAuthMode} className="auth-toggle-button">
                {isLogin ? 'Registre-se' : 'Faça login'}
              </button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuthScreen;