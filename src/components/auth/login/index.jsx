import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from "react-router-dom";

import SplashScreen from './componentes/spashscreen';
import MarkfyLogo from "../../../img/logo-markfy.svg";
import emailjs from "@emailjs/browser";

import { realtimeDb } from '../../../firebase/firebase';
import { ref, set, get, update } from 'firebase/database';

import {
  doSignInWithEmailAndPassword,
  doSignInWithGoogle
} from '../../../firebase/auth';

import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../../firebase/firebase';

import { Icon } from '@iconify/react';
import './mainscreenregister.css';

const SERVICE_ID = "service_2l02vyh";
const TEMPLATE_ID = "template_6g6ub0p";
const PUBLIC_KEY = "QlWjNn5vihbWi9uLf";

const AuthScreen = () => {
  const navigate = useNavigate();

  const [formError, setFormError] = useState('');

  const [searchParams] = useSearchParams();

  const inviteId = searchParams.get("invite");
  const [inviteData, setInviteData] = useState(null);

  const [step, setStep] = useState('register');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLogin, setIsLogin] = useState(!inviteId);

  const [isLoading, setIsLoading] = useState(false);

  const [verificationCode, setVerificationCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    confirmPassword: ''
  });

  /*
   * ============================================================
   * EMAILJS
   * ============================================================
   */

  useEffect(() => {
    emailjs.init(PUBLIC_KEY);
  }, []);

  /*
   * ============================================================
   * CONVITE
   * ============================================================
   */

  useEffect(() => {
    if (!inviteId) return;

    const loadInvite = async () => {
      try {
        const snapshot = await get(
          ref(realtimeDb, `invites/${inviteId}`)
        );

        if (!snapshot.exists()) {
          setFormError("Convite inválido.");
          return;
        }

        const invite = snapshot.val();

        if (invite.status !== "pending") {
          setFormError("Este convite não está mais disponível.");
          return;
        }

        setInviteData(invite);

        setFormData(prev => ({
          ...prev,
          email: invite.invitedEmail
        }));

      } catch (err) {
        console.error(err);
        setFormError("Não foi possível validar o convite.");
      }
    };

    loadInvite();

  }, [inviteId]);

  /*
   * ============================================================
   * SPLASH
   * ============================================================
   */

  const handleAnimationComplete = () => {
    setShowSplash(false);
  };

  /*
   * ============================================================
   * INPUTS
   * ============================================================
   */

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  /*
   * ============================================================
   * ALTERNAR LOGIN / REGISTRO
   * ============================================================
   */

  const toggleAuthMode = () => {
    setIsLogin(!isLogin);

    setStep('register');

    setFormData({
      email: !isLogin ? formData.email : '',
      password: '',
      name: '',
      confirmPassword: ''
    });

    setFormError('');
    setVerificationCode('');
    setGeneratedCode('');
  };

  /*
   * ============================================================
   * HASH DA SENHA
   * ============================================================
   */

  const hashPassword = async (password) => {
    const encoder = new TextEncoder();

    const data = encoder.encode(password);

    const hashBuffer =
      await window.crypto.subtle.digest(
        'SHA-256',
        data
      );

    const hashArray =
      Array.from(new Uint8Array(hashBuffer));

    const hashHex =
      hashArray
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    return hashHex;
  };

  /*
   * ============================================================
   * VERIFICAÇÃO DO ESTADO INICIAL DO USUÁRIO
   *
   * initial === true
   *      ↓
   * /initial-setup
   *
   * initial === false
   *      ↓
   * central
   * ============================================================
   */

  const checkUserInitial = async (uid, email, name) => {
    console.log(
      "[AUTH] Verificando usuário:",
      uid
    );

    const userRef =
      ref(realtimeDb, `users/${uid}`);

    const snapshot =
      await get(userRef);

    /*
     * ------------------------------------------------------------
     * Usuário ainda não possui registro no RTDB
     * ------------------------------------------------------------
     *
     * Também tratamos como PRIMEIRO ACESSO.
     */

    if (!snapshot.exists()) {

      console.log(
        "[AUTH] Usuário sem registro. Criando com initial: true."
      );

      await set(userRef, {
        uid,
        name,
        email,
        provider: "markfy",
        userType: "common",

        // PRIMEIRO ACESSO
        initial: true
      });

      navigate("/initial-setup", {
        state: {
          name,
          email,
          id: uid
        }
      });

      return;
    }

    const userData = snapshot.val();

    console.log(
      "[AUTH] Dados encontrados:",
      userData
    );

    /*
     * ------------------------------------------------------------
     * PRIMEIRO ACESSO
     * ------------------------------------------------------------
     */

    if (userData.initial === true) {

      console.log(
        "[AUTH] Usuário ainda está no Initial Setup."
      );

      navigate("/initial-setup", {
        state: {
          name: userData.name || name,
          email: userData.email || email,
          id: uid
        }
      });

      return;
    }

    /*
     * ------------------------------------------------------------
     * USUÁRIO JÁ CONFIGURADO
     * ------------------------------------------------------------
     */

    if (
      userData.userType === "admin" ||
      userData.usertype === "admin"
    ) {

      console.log(
        "[AUTH] Usuário configurado → Central Admin"
      );

      navigate("/central-adm");

      return;
    }

    console.log(
      "[AUTH] Usuário configurado → Central User"
    );

    navigate("/central-user");
  };

  /*
   * ============================================================
   * REDIRECIONAMENTO APÓS AUTENTICAÇÃO
   * ============================================================
   */

  const redirectAfterAuth = async (
    uid,
    email,
    name
  ) => {

    /*
     * Convite possui fluxo próprio.
     */
    if (inviteId) {

      navigate(`/invite/${inviteId}`);

      return;
    }

    /*
     * Login / cadastro normal
     */
    await checkUserInitial(
      uid,
      email,
      name
    );
  };

  /*
   * ============================================================
   * LOGIN / REGISTRO
   * ============================================================
   */

  const handleSubmit = async (e) => {
    e.preventDefault();

    setFormError('');
    setIsLoading(true);

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    const passwordRegex =
      /^(?=.*\d).{8,}$/;

    /*
     * ------------------------------------------------------------
     * VALIDAÇÕES
     * ------------------------------------------------------------
     */

    if (
      !formData.email ||
      !formData.password
    ) {

      setFormError(
        "Preencha seu email e senha."
      );

      setIsLoading(false);

      return;
    }

    if (
      !emailRegex.test(formData.email)
    ) {

      setFormError(
        "Email inválido."
      );

      setIsLoading(false);

      return;
    }

    if (
      !isLogin &&
      !passwordRegex.test(formData.password)
    ) {

      setFormError(
        "A senha deve ter no mínimo 8 caracteres e pelo menos um número."
      );

      setIsLoading(false);

      return;
    }

    if (
      !isLogin &&
      formData.password !==
      formData.confirmPassword
    ) {

      setFormError(
        "Senhas não correspondem."
      );

      setIsLoading(false);

      return;
    }

    try {

      /*
       * ==========================================================
       * LOGIN
       * ==========================================================
       */

      if (isLogin) {

        const userCredential =
          await doSignInWithEmailAndPassword(
            formData.email,
            formData.password
          );

        const user =
          userCredential.user;

        /*
         * Lembrar de mim
         */

        if (rememberMe) {

          localStorage.setItem(
            'authUser',
            JSON.stringify({
              uid: user.uid,
              email: user.email
            })
          );
        }

        /*
         * Busca usuário
         */

        const userRef =
          ref(
            realtimeDb,
            `users/${user.uid}`
          );

        const snapshot =
          await get(userRef);

        let name = "Usuário";

        if (snapshot.exists()) {

          const userData =
            snapshot.val();

          name =
            userData.name ||
            name;
        }

        /*
         * Verifica initial
         */

        await redirectAfterAuth(
          user.uid,
          user.email,
          name
        );

        return;
      }

      /*
       * ==========================================================
       * VERIFICA SE EMAIL JÁ EXISTE
       * ==========================================================
       */

      const snapshot =
        await get(
          ref(realtimeDb, "users")
        );

      const users =
        snapshot.val();

      const emailExists =
        Object.values(users || {}).some(
          user =>
            user.email?.toLowerCase() ===
            formData.email.toLowerCase()
        );

      if (emailExists) {

        setFormError(
          "Email já cadastrado."
        );

        setIsLoading(false);

        return;
      }

      /*
       * ==========================================================
       * CADASTRO POR CONVITE
       * ==========================================================
       */

      if (inviteId) {

        try {

          const userCredential =
            await createUserWithEmailAndPassword(
              auth,
              formData.email,
              formData.password
            );

          const user =
            userCredential.user;

          const hashedPassword =
            await hashPassword(
              formData.password
            );

          /*
           * Usuário de convite é admin.
           *
           * Como o convite já define o fluxo administrativo,
           * mantemos initial: false.
           */

          await set(
            ref(
              realtimeDb,
              `users/${user.uid}`
            ),
            {
              uid: user.uid,
              name: formData.name,
              email: formData.email,
              password: hashedPassword,
              provider: "markfy",

              userType: "admin",

              initial: false
            }
          );

          await redirectAfterAuth(
            user.uid,
            formData.email,
            formData.name
          );

          return;

        } catch (err) {

          console.error(
            "[AUTH] Erro no cadastro por convite:",
            err
          );

          setFormError(
            "Erro ao criar a conta."
          );

          setIsLoading(false);

          return;
        }
      }

      /*
       * ==========================================================
       * CADASTRO NORMAL
       * ==========================================================
       */

      const code =
        Math.floor(
          100000 +
          Math.random() * 900000
        ).toString();

      setGeneratedCode(code);

      await sendVerificationEmail(
        formData.email,
        code
      );

      /*
       * Neste momento ainda NÃO criamos o usuário.
       *
       * O usuário será criado somente depois que o código
       * for confirmado.
       */

      setStep("verify");

    } catch (error) {

      console.error(
        "[AUTH] Erro na autenticação:",
        error
      );

      setFormError(
        "Email ou senha incorreta."
      );

    } finally {

      setIsLoading(false);
    }
  };

  /*
   * ============================================================
   * ENVIO DO EMAIL DE VERIFICAÇÃO
   * ============================================================
   */

  const sendVerificationEmail = async (
    email,
    code
  ) => {

    try {

      await emailjs.send(
        SERVICE_ID,
        TEMPLATE_ID,
        {
          user_email: email,

          verification_code: code,

          email_title:
            "Confirmação de Cadastro - Markfy",

          email_message:
            "Obrigado por se cadastrar na Markfy! " +
            "Para concluir seu cadastro, utilize " +
            "o código de verificação abaixo."
        },
        PUBLIC_KEY
      );

      console.log(
        "E-mail enviado com sucesso!"
      );

    } catch (error) {

      console.error(
        "Erro ao enviar o e-mail:",
        error
      );

      alert(
        "Erro ao enviar o e-mail de verificação. " +
        "Tente novamente."
      );
    }
  };

  /*
   * ============================================================
   * CONFIRMAÇÃO DO CÓDIGO
   *
   * AQUI ESTÁ A PRINCIPAL CORREÇÃO.
   *
   * Novo usuário:
   *
   * initial: true
   *
   * Depois:
   *
   * /initial-setup
   * ============================================================
   */

  const handleVerificationSubmit = async (e) => {

    e.preventDefault();

    setFormError('');

    /*
     * Código incorreto
     */

    if (
      verificationCode !==
      generatedCode
    ) {

      setFormError(
        "Código de verificação incorreto."
      );

      return;
    }

    try {

      setIsLoading(true);

      /*
       * ----------------------------------------------------------
       * CRIA USUÁRIO NO FIREBASE AUTH
       * ----------------------------------------------------------
       */

      const userCredential =
        await createUserWithEmailAndPassword(
          auth,
          formData.email,
          formData.password
        );

      const user =
        userCredential.user;

      /*
       * ----------------------------------------------------------
       * HASH DA SENHA
       * ----------------------------------------------------------
       */

      const hashedPassword =
        await hashPassword(
          formData.password
        );

      /*
       * ----------------------------------------------------------
       * CRIA REGISTRO NO REALTIME DATABASE
       * ----------------------------------------------------------
       *
       * IMPORTANTE:
       *
       * initial: TRUE
       *
       * Isso significa:
       *
       * "Esse usuário ainda não terminou o setup."
       *
       * ----------------------------------------------------------
       */

      await set(
        ref(
          realtimeDb,
          `users/${user.uid}`
        ),
        {
          uid: user.uid,

          name: formData.name,

          email: formData.email,

          password: hashedPassword,

          provider: 'markfy',

          userType: 'common',

          /*
           * PRIMEIRO ACESSO
           */
          initial: true
        }
      );

      console.log(
        "[AUTH] Usuário criado com initial: true"
      );

      /*
       * ----------------------------------------------------------
       * SALVA LOGIN SE MARCADO
       * ----------------------------------------------------------
       */

      if (rememberMe) {

        localStorage.setItem(
          'authUser',
          JSON.stringify({
            uid: user.uid,
            email: user.email
          })
        );
      }

      /*
       * ----------------------------------------------------------
       * VAI PARA INITIAL SETUP
       * ----------------------------------------------------------
       */

      navigate("/initial-setup", {
        state: {
          name: formData.name,
          email: formData.email,
          id: user.uid
        }
      });

    } catch (error) {

      console.error(
        "[AUTH] Erro ao criar usuário:",
        error
      );

      /*
       * Caso o Auth tenha criado o usuário mas o RTDB tenha
       * falhado, o usuário ainda pode existir no Firebase Auth.
       *
       * Por isso mostramos uma mensagem clara.
       */

      setFormError(
        "Erro ao criar o usuário. Tente novamente."
      );

    } finally {

      setIsLoading(false);
    }
  };

  /*
   * ============================================================
   * LOGIN COM GOOGLE
   * ============================================================
   */

  const signInWithGoogle = async () => {

    try {

      const result =
        await doSignInWithGoogle();

      const user =
        result.user;

      const userRef =
        ref(
          realtimeDb,
          `users/${user.uid}`
        );

      const existingSnapshot =
        await get(userRef);

      const existingData =
        existingSnapshot.exists()
          ? existingSnapshot.val()
          : {};

      /*
       * Se for usuário novo Google:
       *
       * initial = true
       *
       * Se já existir:
       * preserva o valor atual.
       */

      const userData = {
        ...existingData,

        uid: user.uid,

        name:
          user.displayName ||
          existingData.name ||
          "Usuário",

        email: user.email,

        provider: 'google',

        userType:
          existingData.userType ??
          existingData.usertype ??
          'common',

        initial:
          existingSnapshot.exists()
            ? existingData.initial ?? true
            : true
      };

      await set(
        userRef,
        userData
      );

      console.log(
        "[GOOGLE] Usuário:",
        userData
      );

      /*
       * Se for novo Google,
       * vai para initial setup.
       */

      await checkUserInitial(
        user.uid,
        user.email,
        userData.name
      );

    } catch (error) {

      console.error(
        "[GOOGLE] Erro:",
        error
      );

      alert(error.message);
    }
  };

  /*
   * ============================================================
   * LOGIN AUTOMÁTICO / LEMBRAR DE MIM
   * ============================================================
   */

  useEffect(() => {

    if (!auth.currentUser) {

      localStorage.removeItem(
        "authUser"
      );

      return;
    }

    const storedUser =
      localStorage.getItem(
        "authUser"
      );

    if (!storedUser) return;

    try {

      const parsedUser =
        JSON.parse(storedUser);

      (async () => {

        const userRef =
          ref(
            realtimeDb,
            `users/${parsedUser.uid}`
          );

        const snapshot =
          await get(userRef);

        /*
         * Usuário não existe mais
         */

        if (!snapshot.exists()) {

          localStorage.removeItem(
            "authUser"
          );

          await auth.signOut();

          return;
        }

        const userData =
          snapshot.val();

        await checkUserInitial(
          parsedUser.uid,
          parsedUser.email,
          userData.name ||
          "Usuário"
        );

      })();

    } catch (error) {

      console.error(
        "[AUTH] Erro ao restaurar sessão:",
        error
      );

      localStorage.removeItem(
        "authUser"
      );
    }

  }, []);

  /*
   * ============================================================
   * ANIMAÇÃO DO BLOB
   * ============================================================
   */

  useEffect(() => {

    if (!showSplash) {

      const blob =
        document.getElementById("blob");

      if (blob) {

        const animateBlob = () => {

          const x =
            Math.random() * 80;

          const y =
            Math.random() * 80;

          const scale =
            1 + Math.random() * 0.5;

          blob.animate(
            {
              left: `${x}%`,
              top: `${y}%`,
              transform: `scale(${scale})`
            },
            {
              duration: 2000,
              fill: "forwards"
            }
          );

          setTimeout(
            animateBlob,
            2000
          );
        };

        animateBlob();
      }
    }

  }, [showSplash]);

  /*
   * ============================================================
   * RENDER
   * ============================================================
   */

  return (
    <div className="app-container">

      {!showSplash && (
        <div className="liquid-background">

          <div
            id="blob"
            className="blob"
          />

          <div
            id="blur"
            className="blur"
          />

        </div>
      )}

      {showSplash ? (

        <SplashScreen
          onAnimationComplete={
            handleAnimationComplete
          }
        />

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

              <h1>
                {isLogin
                  ? 'Conecte-se com sua conta'
                  : 'Crie sua conta'
                }
              </h1>

            </div>

            {step === 'register' ? (

              /*
               * ==================================================
               * FORMULÁRIO DE LOGIN / REGISTRO
               * ==================================================
               */

              <form
                onSubmit={handleSubmit}
                className="auth-form"
              >

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
                    disabled={!!inviteId}
                    placeholder="E-mail"
                    className="auth-input"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                  />

                  <div className="password-input-wrapper">

                    <input
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      name="password"
                      placeholder="Senha"
                      className="auth-input"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                    />

                    <Icon
                      icon={
                        showPassword
                          ? "mdi:eye-off"
                          : "mdi:eye"
                      }
                      className="password-toggle-icon"
                      onClick={() =>
                        setShowPassword(
                          !showPassword
                        )
                      }
                    />

                  </div>

                  {!isLogin && (

                    <div className="password-input-wrapper">

                      <input
                        type={
                          showConfirmPassword
                            ? "text"
                            : "password"
                        }
                        name="confirmPassword"
                        placeholder="Confirme sua senha"
                        className="auth-input"
                        value={
                          formData.confirmPassword
                        }
                        onChange={
                          handleInputChange
                        }
                        required
                      />

                      <Icon
                        icon={
                          showConfirmPassword
                            ? "mdi:eye-off"
                            : "mdi:eye"
                        }
                        className="password-toggle-icon"
                        onClick={() =>
                          setShowConfirmPassword(
                            !showConfirmPassword
                          )
                        }
                      />

                    </div>

                  )}

                </div>

                {formError && (
                  <div className="form-error">
                    {formError}
                  </div>
                )}

                <button
                  type="submit"
                  className="auth-button"
                  disabled={isLoading}
                >
                  {isLoading
                    ? 'Carregando...'
                    : isLogin
                      ? 'Conectar-se'
                      : 'Registrar-se'
                  }
                </button>

                <div className="auth-divider">

                  <span className="divider-line" />

                  <span className="divider-text">
                    ou
                  </span>

                  <span className="divider-line" />

                </div>

                <button
                  type="button"
                  className="google-auth-button"
                  onClick={signInWithGoogle}
                >

                  <svg
                    className="google-icon"
                    viewBox="0 0 24 24"
                    width="18"
                    height="18"
                  >

                    <path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />

                    <path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />

                    <path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />

                    <path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />

                  </svg>

                  {isLogin
                    ? 'Conectar com Google'
                    : 'Registrar com Google'
                  }

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
                          onChange={() =>
                            setRememberMe(
                              !rememberMe
                            )
                          }
                        />

                        <label
                          htmlFor="remember-me-checkbox"
                          className="cbx"
                        >

                          <span>

                            <svg
                              viewBox="0 0 12 10"
                              height="10px"
                              width="12px"
                            >

                              <polyline
                                points="1.5 6 4.5 9 10.5 1"
                              />

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

                    <a
                      href="/forgot-password"
                      className="forgot-password"
                    >
                      Esqueceu a senha?
                    </a>

                  </div>

                )}

              </form>

            ) : (

              /*
               * ==================================================
               * FORMULÁRIO DE VERIFICAÇÃO
               * ==================================================
               */

              <form
                onSubmit={
                  handleVerificationSubmit
                }
                className="auth-form"
              >

                <p className="auth-subtitle">

                  Enviamos um código de verificação
                  para{" "}

                  <strong>
                    {formData.email}
                  </strong>

                  . Insira-o abaixo:

                </p>

                <input
                  type="text"
                  name="code"
                  placeholder="Código de verificação"
                  className="auth-input verify-input"
                  value={verificationCode}
                  onChange={(e) =>
                    setVerificationCode(
                      e.target.value
                    )
                  }
                  required
                />

                {formError && (

                  <div className="form-error">
                    {formError}
                  </div>

                )}

                <button
                  type="submit"
                  className="auth-button verify-button"
                  disabled={isLoading}
                >

                  {isLoading
                    ? 'Carregando...'
                    : 'Verificar código'
                  }

                </button>

              </form>

            )}

          </div>

          <div className="auth-footer">

            <p className="auth-toggle-text">

              {isLogin
                ? 'Não possui uma conta?'
                : 'Já possui uma conta?'
              }

              {' '}

              <button
                onClick={toggleAuthMode}
                className="auth-toggle-button"
              >

                {isLogin
                  ? 'Registre-se'
                  : 'Faça login'
                }

              </button>

            </p>

          </div>

        </div>
      )}

    </div>
  );
};

export default AuthScreen;