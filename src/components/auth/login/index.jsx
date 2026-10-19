import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from "react-router-dom";

import SplashScreen from './componentes/spashscreen';
import MarkfyLogo from "../../../img/logo-markfy.svg";
import emailjs from "@emailjs/browser";

import { realtimeDb } from '../../../firebase/firebase';
import {
  ref,
  set,
  get,
  update,
  query,
  orderByChild,
  equalTo
} from 'firebase/database';

import {
  doSignInWithEmailAndPassword,
  doSignInWithGoogle,
  doGetRedirectResult,
  doSendPasswordResetEmail,
  descreverErroDeAuth
} from '../../../firebase/auth';

import {
  createUserWithEmailAndPassword,
  RecaptchaVerifier,
  signInWithPhoneNumber
} from 'firebase/auth';

import Modal from '../../modal/Modal';

import {
  formatPhoneBR,
  isValidPhoneBR,
  toE164BR
} from '../../../utils/phoneBR';
import { auth } from '../../../firebase/firebase';

import { Icon } from '@iconify/react';
import './mainscreenregister.css';

const SERVICE_ID = "service_2l02vyh";
const TEMPLATE_ID = "template_6g6ub0p";
const PUBLIC_KEY = "QlWjNn5vihbWi9uLf";

/*
 * O Firebase devolve um código por erro; sem traduzir, tudo
 * vira "tente de novo" e a pessoa repete o mesmo engano.
 */
const descreverErroDeTelefone = (error) => {

  switch (error?.code) {

    case 'auth/invalid-verification-code':
      return 'Código incorreto. Confira os 6 números do SMS.';

    case 'auth/code-expired':
      return 'Esse código expirou. Peça um novo SMS.';

    case 'auth/invalid-phone-number':
      return 'Número inválido. Use DDD + número.';

    case 'auth/too-many-requests':
      return 'Muitas tentativas nesse número. Espere alguns minutos.';

    case 'auth/quota-exceeded':
      return 'O limite de SMS foi atingido hoje. Tente mais tarde.';

    case 'auth/network-request-failed':
      return 'Sem conexão. Verifique sua internet.';

    case 'auth/invalid-app-credential':
      return 'A verificação por SMS está indisponível neste ambiente. Entre com e-mail ou Google.';

    case 'auth/operation-not-allowed':
      return 'A entrada por telefone não está habilitada.';

    default:
      return 'Não foi possível concluir a verificação. Tente novamente.';

  }

};


const AuthScreen = () => {
  const navigate = useNavigate();

  const [formError, setFormError] = useState('');

  const [searchParams] = useSearchParams();

  const inviteId = searchParams.get("invite");

  /*
   * Destino depois do login (?redirect=/studio, por exemplo).
   * Só caminhos internos: "//site.com" ou URLs absolutas são
   * ignorados, para o parâmetro não virar redirecionamento
   * aberto.
   */
  const rawRedirect = searchParams.get("redirect") || "";
  const redirectTo =
    /^\/(?!\/)[\w\-/?=&.%]*$/.test(rawRedirect) && !rawRedirect.startsWith("/login")
      ? rawRedirect
      : null;
  const [inviteData, setInviteData] = useState(null);

  const [step, setStep] = useState('register');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLogin, setIsLogin] = useState(!inviteId);

  const [isLoading, setIsLoading] = useState(false);

  /* Recuperação de senha. O link apontava para
     /forgot-password, uma rota que nunca existiu: quem
     clicava caía na landing page. Agora é um painel aqui
     mesmo, com o e-mail que a pessoa já digitou. */
  const [showForgotPassword, setShowForgotPassword] =
    useState(false);

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);


  /* ============================================================
     ENTRAR COM TELEFONE

     Mesma verificação por SMS usada no agendamento, agora como
     forma de entrar. Para quem só tem WhatsApp e nunca lembra
     de senha, é o caminho mais curto até a conta.
     ============================================================ */

  const [showPhoneLogin, setShowPhoneLogin] = useState(false);
  const [phoneStep, setPhoneStep] = useState('phone');
  const [phoneValue, setPhoneValue] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneConfirmation, setPhoneConfirmation] = useState(null);
  const [phoneError, setPhoneError] = useState('');
  const [phoneLoading, setPhoneLoading] = useState(false);


  const abrirLoginPorTelefone = () => {

    setPhoneStep('phone');
    setPhoneCode('');
    setPhoneError('');
    setPhoneConfirmation(null);
    setShowPhoneLogin(true);

  };


  /*
   * Um nó virgem por tentativa.
   *
   * O grecaptcha marca o elemento onde já montou; reaproveitar
   * o mesmo <div> levanta "reCAPTCHA has already been rendered
   * in this element" e o token que sai dali é recusado.
   */
  const montarRecaptcha = () => {

    const container =
      document.getElementById('login-recaptcha');

    if (!container) {
      throw new Error('Container do reCAPTCHA não encontrado.');
    }

    if (window.loginRecaptchaVerifier) {
      try {
        window.loginRecaptchaVerifier.clear();
      } catch {
        /* já estava descartado */
      }
    }

    container.innerHTML = '';

    const host = document.createElement('div');
    host.id = `login-recaptcha-host-${Date.now()}`;
    container.appendChild(host);

    const verifier = new RecaptchaVerifier(
      auth,
      host,
      { size: 'invisible' }
    );

    window.loginRecaptchaVerifier = verifier;

    return verifier;

  };


  const enviarCodigoTelefone = async () => {

    const e164 = toE164BR(phoneValue);

    if (!e164) {
      setPhoneError('Informe um telefone válido, com DDD. Exemplo: (11) 98941-4218.');
      return;
    }

    setPhoneLoading(true);
    setPhoneError('');

    try {

      const confirmation = await signInWithPhoneNumber(
        auth,
        e164,
        montarRecaptcha()
      );

      setPhoneConfirmation(confirmation);
      setPhoneStep('code');
      setPhoneCode('');

    } catch (error) {

      console.error('[TELEFONE] Erro ao enviar SMS:', error);

      setPhoneError(descreverErroDeTelefone(error));

      if (
        error?.code === 'auth/invalid-app-credential' &&
        window.location.hostname === 'localhost'
      ) {
        console.warn(
          '[Markfy] O Firebase recusa o token do reCAPTCHA em http://localhost. ' +
          'Use um número de teste (Console → Authentication → Sign-in method → Telefone).'
        );
      }

    } finally {

      setPhoneLoading(false);

    }

  };


  const confirmarCodigoTelefone = async () => {

    if (!phoneConfirmation) {
      setPhoneError('Peça um novo código.');
      return;
    }

    setPhoneLoading(true);
    setPhoneError('');

    try {

      const credential =
        await phoneConfirmation.confirm(phoneCode.trim());

      const user = credential.user;

      const userRef = ref(realtimeDb, `users/${user.uid}`);

      const snapshot = await get(userRef);

      const existente = snapshot.exists()
        ? snapshot.val()
        : {};

      await update(userRef, {
        ...existente,
        uid: user.uid,
        phone: user.phoneNumber,
        name: existente.name || '',
        provider: existente.provider || 'phone',
        userType: existente.userType ?? existente.usertype ?? 'common',
        initial: snapshot.exists() ? existente.initial ?? true : true
      });

      setShowPhoneLogin(false);

      await checkUserInitial(
        user.uid,
        existente.email || '',
        existente.name || ''
      );

    } catch (error) {

      console.error('[TELEFONE] Erro ao confirmar:', error);

      setPhoneError(descreverErroDeTelefone(error));

      if (error?.code === 'auth/code-expired') {
        setPhoneStep('phone');
        setPhoneConfirmation(null);
        setPhoneCode('');
      }

    } finally {

      setPhoneLoading(false);

    }

  };


  const abrirRecuperacao = () => {

    setForgotEmail(formData.email || '');
    setForgotError('');
    setForgotSent(false);
    setShowForgotPassword(true);

  };


  const enviarRecuperacao = async () => {

    const email = forgotEmail.trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      setForgotError('Digite um e-mail válido.');
      return;
    }

    setForgotLoading(true);
    setForgotError('');

    try {

      await doSendPasswordResetEmail(email);

      setForgotSent(true);

    } catch (error) {

      console.error('[RESET] Erro:', error);

      /*
       * `auth/user-not-found` não vira mensagem.
       *
       * Responder "essa conta não existe" transforma a tela
       * em um verificador de quem tem conta aqui. A tela diz
       * sempre a mesma coisa; quem tem conta recebe o e-mail.
       */
      if (error?.code === 'auth/user-not-found') {

        setForgotSent(true);

      } else {

        setForgotError(descreverErroDeAuth(error));

      }

    } finally {

      setForgotLoading(false);

    }

  };

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

    /* Veio de uma tela que pediu login (Home, Studio). */
    if (redirectTo) {

      navigate(redirectTo);

      return;
    }

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

      /*
       * Consulta por e-mail em vez de baixar o nó "users"
       * inteiro. Esta é uma rota pública: a leitura
       * completa expunha nome e e-mail de toda a base.
       *
       * Requer .indexOn: ["email"] em "users".
       *
       * equalTo diferencia maiúsculas, então testamos
       * também o e-mail como foi digitado.
       */

      const typedEmail =
        formData.email;

      const lowercasedEmail =
        typedEmail.toLowerCase();

      const emailInUse = async (email) => {

        const snapshot =
          await get(
            query(
              ref(realtimeDb, "users"),
              orderByChild("email"),
              equalTo(email)
            )
          );

        return snapshot.exists();

      };

      let emailExists =
        await emailInUse(lowercasedEmail);

      if (
        !emailExists &&
        typedEmail !== lowercasedEmail
      ) {

        emailExists =
          await emailInUse(typedEmail);

      }

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

  /*
   * Grava o usuário do Google e encaminha.
   *
   * Compartilhado pelo popup e pela volta do redirect, que
   * chegam em momentos diferentes mas com o mesmo resultado.
   */
  const finalizarLoginGoogle = async (result) => {

    const user = result.user;

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

      /*
       * `update`, não `set`.
       *
       * O `set` reescreve o nó inteiro. Como o objeto era
       * montado a partir de uma leitura feita antes, qualquer
       * campo gravado entre a leitura e a escrita — o
       * companyHandle, por exemplo — era apagado. O `update`
       * mexe só nas chaves que passamos.
       */
      await update(
        userRef,
        userData
      );

      await checkUserInitial(
        user.uid,
        user.email,
        userData.name
      );

  };


  const signInWithGoogle = async () => {

    setFormError('');
    setIsLoading(true);

    try {

      const result =
        await doSignInWithGoogle();

      /*
       * null = caiu para o redirect e a página já está
       * saindo. Quem termina o login é o efeito da volta.
       */
      if (!result) {
        return;
      }

      await finalizarLoginGoogle(result);

    } catch (error) {

      console.error("[GOOGLE] Erro:", error);

      /* Fechar o popup não é erro: não vale um aviso
         vermelho na tela. */
      const mensagem = descreverErroDeAuth(error);

      if (mensagem) {
        setFormError(mensagem);
      }

    } finally {

      setIsLoading(false);

    }
  };


  /*
   * VOLTA DO REDIRECT
   *
   * Quando o popup não pôde abrir, o login termina aqui: a
   * página recarrega vinda do Google e o resultado espera
   * nesta chamada. Sem isto, quem passou pelo redirect
   * voltava para a tela de login como se nada tivesse
   * acontecido.
   */
  useEffect(() => {

    let cancelado = false;

    doGetRedirectResult()
      .then((result) => {

        if (!result || cancelado) {
          return;
        }

        return finalizarLoginGoogle(result);

      })
      .catch((error) => {

        console.error("[GOOGLE] Erro no redirect:", error);

        const mensagem = descreverErroDeAuth(error);

        if (mensagem && !cancelado) {
          setFormError(mensagem);
        }

      });

    return () => {
      cancelado = true;
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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


                {/* Entrar pelo telefone.

                    Vale tanto para entrar quanto para criar:
                    quem confirma um número que o Firebase ainda
                    não conhece ganha a conta na hora. Para quem
                    só usa WhatsApp, é o caminho mais curto. */}
                <button
                  type="button"
                  className="google-auth-button phone-auth-button"
                  onClick={abrirLoginPorTelefone}
                >

                  <Icon
                    icon="solar:phone-outline"
                    className="google-icon"
                  />

                  {isLogin
                    ? 'Conectar com telefone'
                    : 'Registrar com telefone'
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

                    <button
                      type="button"
                      className="forgot-password"
                      onClick={abrirRecuperacao}
                    >
                      Esqueceu a senha?
                    </button>

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


      {/* ============================================================
          RECUPERAR SENHA
          ============================================================ */}

      <Modal
        open={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        overlayClassName="auth-modal-overlay"
        className="auth-modal"
        label="Recuperar senha"
      >

        {forgotSent ? (

          <>
            <div className="auth-modal-icon is-success">
              <Icon icon="solar:letter-opened-outline" />
            </div>

            <h2>Confira seu e-mail</h2>

            <p>
              Se existir uma conta com <strong>{forgotEmail}</strong>,
              o link para criar uma senha nova chega em instantes.
              Vale olhar o spam.
            </p>

            <button
              type="button"
              className="auth-modal-button is-primary"
              onClick={() => setShowForgotPassword(false)}
            >
              Entendi
            </button>
          </>

        ) : (

          <>
            <div className="auth-modal-icon">
              <Icon icon="solar:lock-password-outline" />
            </div>

            <h2>Recuperar senha</h2>

            <p>
              Digite o e-mail da sua conta. Enviamos um link para
              você criar uma senha nova.
            </p>

            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              className="auth-modal-input"
              placeholder="voce@email.com"
              value={forgotEmail}
              autoFocus
              onChange={(e) => setForgotEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !forgotLoading) {
                  enviarRecuperacao();
                }
              }}
            />

            {forgotError && (
              <span className="auth-modal-error">
                {forgotError}
              </span>
            )}

            <div className="auth-modal-actions">

              <button
                type="button"
                className="auth-modal-button"
                onClick={() => setShowForgotPassword(false)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="auth-modal-button is-primary"
                disabled={forgotLoading}
                onClick={enviarRecuperacao}
              >
                {forgotLoading ? 'Enviando...' : 'Enviar link'}
              </button>

            </div>
          </>

        )}

      </Modal>


      {/* ============================================================
          ENTRAR COM TELEFONE
          ============================================================ */}

      <Modal
        open={showPhoneLogin}
        onClose={() => setShowPhoneLogin(false)}
        overlayClassName="auth-modal-overlay"
        className="auth-modal"
        label="Entrar com telefone"
      >

        <div className="auth-modal-icon">
          <Icon
            icon={
              phoneStep === 'code'
                ? 'solar:chat-round-call-outline'
                : 'solar:phone-outline'
            }
          />
        </div>

        {phoneStep === 'phone' ? (

          <>
            <h2>Entrar com telefone</h2>

            <p>
              Enviamos um código por SMS. Se ainda não tiver conta,
              ela é criada com esse número.
            </p>

            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={20}
              className="auth-modal-input"
              placeholder="(11) 98941-4218"
              value={phoneValue}
              autoFocus
              onChange={(e) => setPhoneValue(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  isValidPhoneBR(phoneValue) &&
                  !phoneLoading
                ) {
                  enviarCodigoTelefone();
                }
              }}
            />

            <span className="auth-modal-hint">
              {isValidPhoneBR(phoneValue)
                ? `Enviaremos o código para ${formatPhoneBR(phoneValue)}.`
                : 'Com DDD, como (11) 98941-4218.'}
            </span>

            {phoneError && (
              <span className="auth-modal-error">
                {phoneError}
              </span>
            )}

            <div className="auth-modal-actions">

              <button
                type="button"
                className="auth-modal-button"
                onClick={() => setShowPhoneLogin(false)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="auth-modal-button is-primary"
                disabled={phoneLoading || !isValidPhoneBR(phoneValue)}
                onClick={enviarCodigoTelefone}
              >
                {phoneLoading ? 'Enviando...' : 'Enviar código'}
              </button>

            </div>
          </>

        ) : (

          <>
            <h2>Digite o código</h2>

            <p>
              Enviamos 6 números para{' '}
              <strong>{formatPhoneBR(phoneValue)}</strong>.
            </p>

            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              className="auth-modal-input auth-modal-input--code"
              placeholder="000000"
              value={phoneCode}
              autoFocus
              onChange={(e) =>
                setPhoneCode(e.target.value.replace(/\D/g, ''))
              }
              onKeyDown={(e) => {
                if (
                  e.key === 'Enter' &&
                  phoneCode.length === 6 &&
                  !phoneLoading
                ) {
                  confirmarCodigoTelefone();
                }
              }}
            />

            {phoneError && (
              <span className="auth-modal-error">
                {phoneError}
              </span>
            )}

            <div className="auth-modal-actions">

              <button
                type="button"
                className="auth-modal-button"
                onClick={() => {
                  setPhoneStep('phone');
                  setPhoneError('');
                  setPhoneCode('');
                  setPhoneConfirmation(null);
                }}
              >
                Voltar
              </button>

              <button
                type="button"
                className="auth-modal-button is-primary"
                disabled={phoneLoading || phoneCode.length !== 6}
                onClick={confirmarCodigoTelefone}
              >
                {phoneLoading ? 'Verificando...' : 'Confirmar'}
              </button>

            </div>
          </>

        )}

      </Modal>


      {/* O reCAPTCHA fica fora dos modais: o verificador guarda
          o nó que recebeu, e o modal desmonta os filhos ao
          fechar. */}
      <div
        id="login-recaptcha"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          opacity: 0,
          pointerEvents: 'none'
        }}
      />

    </div>
  );
};

export default AuthScreen;