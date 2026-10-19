import { getAuth } from "firebase/auth";

/* Chamadas às Cloud Functions de QR Code. Nada aqui decide
   permissão: quem confere login, função, plano e validade é o
   backend. */

const FUNCTIONS_URL = "https://us-central1-markfy-96942.cloudfunctions.net";

export const callQr = async (name, body, { auth = true } = {}) => {

    const headers = { "Content-Type": "application/json" };

    if (auth) {
        const user = getAuth().currentUser;

        if (!user) throw new Error("Entre na sua conta para continuar.");

        headers.Authorization = `Bearer ${await user.getIdToken()}`;
    }

    const response = await fetch(`${FUNCTIONS_URL}/${name}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body || {})
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.success === false) {
        const error = new Error(data.message || "Não foi possível concluir. Tente de novo.");
        error.status = response.status;
        throw error;
    }

    return data;
};

export const ROLE_LABELS = {
    administrator: "Administrador",
    professional: "Profissional"
};
