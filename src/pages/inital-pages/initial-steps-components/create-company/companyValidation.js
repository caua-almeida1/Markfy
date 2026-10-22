/* =========================================================
   VALIDAÇÕES DO CADASTRO DE EMPRESA

   Funções puras (testadas em __tests__/companyValidation).
   Cada uma devolve a mensagem do problema, ou "" quando está
   tudo certo — a tela mostra a mensagem junto do campo.
========================================================= */

export const digits = (value) => String(value || "").replace(/\D/g, "");

/* ---------- nome ---------- */

export const nameProblem = (value) => {
    const name = String(value || "").trim();
    if (!name) return "Informe o nome da empresa.";
    if (name.length > 40) return "Use no máximo 40 caracteres.";
    return "";
};

/* ---------- @ (handle) ----------
   Mesmas regras de antes: 3–25 caracteres, letras, números,
   hífen e underline, minúsculas. */

export const HANDLE_MIN = 3;
export const HANDLE_MAX = 25;

export const normalizeHandle = (value) =>
    String(value || "")
        .toLowerCase()
        .replace(/^@/, "")
        .replace(/\s+/g, "");

/** "Barbearia do Zé!" → "barbeariadoze". */
export const suggestHandle = (name) =>
    String(name || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/&/g, "e")
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, HANDLE_MAX);

export const handleProblem = (value) => {
    const handle = String(value || "");
    if (!handle) return "Escolha o @ da empresa.";
    if (!/^[a-z0-9_-]+$/.test(handle)) return "Use só letras minúsculas, números, hífen (-) ou underline (_).";
    if (handle.length < HANDLE_MIN) return `Use pelo menos ${HANDLE_MIN} caracteres.`;
    if (handle.length > HANDLE_MAX) return `Use no máximo ${HANDLE_MAX} caracteres.`;
    return "";
};

/* ---------- CPF / CNPJ ---------- */

export const isValidCPF = (value) => {
    const cpf = digits(value);
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

    const check = (length) => {
        let sum = 0;
        for (let i = 0; i < length; i += 1) sum += Number(cpf[i]) * (length + 1 - i);
        const rest = (sum * 10) % 11;
        return rest === 10 ? 0 : rest;
    };

    return check(9) === Number(cpf[9]) && check(10) === Number(cpf[10]);
};

export const isValidCNPJ = (value) => {
    const cnpj = digits(value);
    if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;

    const check = (length) => {
        const weights = length === 12
            ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
            : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
        const sum = weights.reduce((total, weight, i) => total + Number(cnpj[i]) * weight, 0);
        const rest = sum % 11;
        return rest < 2 ? 0 : 11 - rest;
    };

    return check(12) === Number(cnpj[12]) && check(13) === Number(cnpj[13]);
};

export const documentProblem = (value) => {
    const doc = digits(value);
    if (!doc) return "Informe o CPF ou o CNPJ.";
    if (doc.length === 11) return isValidCPF(doc) ? "" : "CPF inválido. Confira os números.";
    if (doc.length === 14) return isValidCNPJ(doc) ? "" : "CNPJ inválido. Confira os números.";
    return "Digite os 11 números do CPF ou os 14 do CNPJ.";
};

export const formatDocument = (value) => {
    const d = digits(value).slice(0, 14);
    if (d.length <= 11) {
        return d
            .replace(/^(\d{3})(\d)/, "$1.$2")
            .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
            .replace(/\.(\d{3})(\d{1,2})$/, ".$1-$2");
    }
    return d
        .replace(/^(\d{2})(\d)/, "$1.$2")
        .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
        .replace(/\.(\d{3})(\d)/, ".$1/$2")
        .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};

/* ---------- contato ---------- */

export const emailProblem = (value) => {
    const email = String(value || "").trim();
    if (!email) return "Informe o e-mail de contato.";
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? "" : "E-mail inválido.";
};

export const phoneProblem = (value) => {
    const phone = digits(value);
    if (!phone) return "Informe o telefone ou WhatsApp.";
    return phone.length === 10 || phone.length === 11 ? "" : "Use DDD + número (10 ou 11 dígitos).";
};

export const formatPhone = (value) => {
    const d = digits(value).slice(0, 11);
    if (d.length <= 2) return d ? `(${d}` : "";
    if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
    if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

export const formatZip = (value) => {
    const d = digits(value).slice(0, 8);
    return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};

/* ---------- etapas ---------- */

/** Problemas por campo das etapas obrigatórias. */
export const stepProblems = (step, data) => {
    if (step === 0) {
        return {
            segment: data.segment ? "" : "Escolha o ramo da empresa.",
            name: nameProblem(data.name),
            handle: handleProblem(data.handle)
        };
    }
    if (step === 1) {
        return {
            document: documentProblem(data.document),
            email: emailProblem(data.email),
            phone: phoneProblem(data.phone)
        };
    }
    return {};
};

export const hasProblems = (problems) => Object.values(problems).some(Boolean);
