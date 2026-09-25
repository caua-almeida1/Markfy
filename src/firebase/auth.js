// firebase/auth.js
import {
  getRedirectResult,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect
} from "firebase/auth";

import { auth } from "./firebase";


export const doSignInWithEmailAndPassword = (email, password) => {
  return signInWithEmailAndPassword(auth, email, password);
};


/* =========================================================
   GOOGLE

   O popup é o caminho bom quando funciona: a pessoa não
   perde o estado da página. Mas ele falha de um jeito
   silencioso em situações comuns — bloqueador de popup,
   webview do Instagram/Facebook, Safari no iPhone com
   "Bloquear janelas" ligado, navegação privada.

   Antes o erro do popup subia cru até um `alert()`, inclusive
   quando a pessoa só tinha fechado a janelinha. Aqui o popup
   é tentado primeiro e, nos casos em que ele comprovadamente
   não vai abrir, caímos para o redirect, que sempre funciona.
   ========================================================= */

const criarProviderGoogle = () => {

  const provider = new GoogleAuthProvider();

  /*
   * Força a escolha de conta.
   *
   * Sem isto, quem tem uma sessão Google aberta entra direto
   * com ela e não entende por que "logou com a conta errada"
   * — e não tem como trocar sem deslogar do Google inteiro.
   */
  provider.setCustomParameters({
    prompt: "select_account"
  });

  return provider;

};


/* Erros em que insistir no popup não adianta. */
const PRECISA_DE_REDIRECT = [
  "auth/popup-blocked",
  "auth/operation-not-supported-in-this-environment",
  "auth/web-storage-unsupported"
];


/* Erros que são a pessoa desistindo, não uma falha. */
export const CANCELADO_PELO_USUARIO = [
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled"
];


export const doSignInWithGoogle = async () => {

  try {

    return await signInWithPopup(
      auth,
      criarProviderGoogle()
    );

  } catch (error) {

    if (PRECISA_DE_REDIRECT.includes(error?.code)) {

      /*
       * O redirect sai da página. Quem chamou não recebe
       * resultado nenhum — a sessão volta no próximo
       * carregamento, por doGetRedirectResult.
       */
      await signInWithRedirect(
        auth,
        criarProviderGoogle()
      );

      return null;

    }

    throw error;

  }

};


/**
 * Resultado de um login por redirect, se houver.
 * Devolve null em todo carregamento normal da página.
 */
export const doGetRedirectResult = () =>
  getRedirectResult(auth);


export const doSendPasswordResetEmail = (email) =>
  sendPasswordResetEmail(auth, email);


/* =========================================================
   MENSAGENS

   O `error.message` do Firebase é texto para quem programa
   ("Firebase: Error (auth/invalid-credential)."). Mostrar
   isso num alert não ajuda ninguém a entrar na conta.
   ========================================================= */

export const descreverErroDeAuth = (error) => {

  switch (error?.code) {

    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "E-mail ou senha incorretos.";

    case "auth/invalid-email":
      return "Esse e-mail não parece válido.";

    case "auth/user-disabled":
      return "Esta conta foi desativada.";

    case "auth/email-already-in-use":
      return "Já existe uma conta com esse e-mail. Tente entrar.";

    case "auth/weak-password":
      return "A senha precisa de pelo menos 6 caracteres.";

    case "auth/too-many-requests":
      return "Muitas tentativas. Espere alguns minutos e tente de novo.";

    case "auth/network-request-failed":
      return "Sem conexão. Verifique sua internet e tente de novo.";

    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "";

    case "auth/account-exists-with-different-credential":
      return "Esse e-mail já entra por outro método. Use o método original e depois vincule o Google no seu perfil.";

    case "auth/unauthorized-domain":
      return "Este endereço não está autorizado no Firebase. Adicione-o em Authentication → Settings → Domínios autorizados.";

    default:
      return "Não foi possível concluir. Tente de novo em instantes.";

  }

};
