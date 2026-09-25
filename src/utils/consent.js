/* =========================================================
   CONSENTIMENTO DE COOKIES E ARMAZENAMENTO — LGPD

   Lei 13.709/2018:

   - Art. 7º, I e Art. 8º: o consentimento é a base legal
     para tudo que NÃO for necessário para executar o que o
     titular pediu. Por isso as categorias não essenciais
     nascem DESLIGADAS — nada de caixa pré-marcada.
   - Art. 8º, §4º: o consentimento é por finalidade
     específica. Daí as categorias serem separadas, e não um
     "aceito tudo" genérico.
   - Art. 8º, §5º: revogar tem que ser tão fácil quanto
     consentir — `resetConsent()` e o painel reaberto a
     qualquer momento pelo perfil/rodapé.
   - Art. 9º: o titular tem direito a saber a finalidade e a
     duração. A descrição de cada categoria vive aqui, junto
     do que de fato é gravado.
   - Art. 6º, III (necessidade): ao revogar, o que já foi
     gravado naquela categoria é APAGADO (`purgeCategory`),
     não apenas ignorado.

   IMPORTANTE:

   Este inventário lista só o que o Markfy realmente usa
   hoje (Firebase Auth, Realtime Database, Storage, Mercado
   Pago e preferências de interface). Nomes de cookies de
   Google Analytics, Meta, Hotjar e afins NÃO entram aqui
   porque o projeto não carrega nenhuma dessas ferramentas —
   declarar cookie que não existe é informação incorreta ao
   titular, o oposto do que a lei pede.
========================================================= */


export const CONSENT_COOKIE = "markfy_consent";

export const CONSENT_STORAGE_KEY = "markfy-consent";

/*
 * Subir a versão faz o banner reaparecer para todo mundo.
 * Use quando mudar finalidade, categoria ou ferramenta.
 */
export const CONSENT_VERSION = 1;

/*
 * 6 meses. Passado esse prazo o titular é consultado de
 * novo, em vez de carregar uma escolha antiga por anos.
 */
const CONSENT_MAX_AGE_DAYS = 180;


/* =========================================================
   CATEGORIAS
========================================================= */

export const CONSENT_CATEGORIES = [

    {
        id: "essential",
        required: true,
        label: "Essenciais",
        summary:
            "Necessários para o site funcionar. Não podem ser desativados.",
        description:
            "Mantêm você conectado, protegem o formulário contra " +
            "fraude e permitem concluir um agendamento ou pagamento " +
            "já iniciado. Sem eles, o Markfy não funciona.",
        items: [
            {
                name: "firebase:authUser:* / authUser",
                purpose: "Manter a sessão de quem fez login.",
                retention: "Até sair da conta."
            },
            {
                name: "markfy-client-id",
                purpose:
                    "Identificador anônimo criado só quando você inicia " +
                    "um agendamento, para você reencontrar suas reservas " +
                    "sem precisar criar conta.",
                retention: "12 meses."
            },
            {
                name: "markfy-pending-payment / markfy-last-agendamento",
                purpose:
                    "Retomar o pagamento e mostrar o comprovante ao " +
                    "voltar do Mercado Pago.",
                retention: "Até a conclusão do pagamento."
            },
            {
                name: "Cookies do Mercado Pago e do Google reCAPTCHA",
                purpose:
                    "Definidos por esses serviços durante o pagamento e " +
                    "a verificação por SMS, para prevenção a fraude.",
                retention: "Definida por cada serviço."
            },
            {
                name: "iconify*",
                purpose:
                    "Cache local dos ícones da interface, para a tela " +
                    "carregar mais rápido. Não identifica ninguém.",
                retention: "Até limpar os dados do navegador."
            },
            {
                name: CONSENT_COOKIE,
                purpose:
                    "Guardar esta sua escolha de cookies e a data dela.",
                retention: `${CONSENT_MAX_AGE_DAYS} dias.`
            }
        ]
    },

    {
        id: "preferences",
        required: false,
        label: "Preferências",
        summary:
            "Lembram como você gosta de usar a interface.",
        description:
            "Guardam ajustes da interface para você não refazer a " +
            "mesma escolha a cada visita. Recusar não bloqueia nada: " +
            "os ajustes só voltam ao padrão quando você recarrega.",
        items: [
            {
                name: "markfy_theme",
                purpose:
                    "Lembrar se você escolheu tema claro, escuro ou " +
                    "seguir o sistema. Só é gravado depois que você " +
                    "usa o botão de tema.",
                retention: "12 meses."
            }
        ]
    },

    {
        id: "analytics",
        required: false,
        label: "Estatísticas",
        summary:
            "Ajudam a entender como o site é usado, de forma agregada.",
        description:
            "Hoje o Markfy não carrega nenhuma ferramenta de " +
            "estatística de terceiros. A categoria fica aqui para que, " +
            "se isso mudar, nada seja ativado sem o seu aceite.",
        items: []
    },

    {
        id: "marketing",
        required: false,
        label: "Marketing",
        summary:
            "Usados para publicidade e medição de campanhas.",
        description:
            "Hoje o Markfy não exibe publicidade nem usa pixels de " +
            "rastreamento. A categoria fica aqui para que, se isso " +
            "mudar, nada seja ativado sem o seu aceite.",
        items: []
    }

];


export const OPTIONAL_CATEGORIES =
    CONSENT_CATEGORIES
        .filter((category) => !category.required)
        .map((category) => category.id);


/*
 * Chaves de armazenamento que pertencem a uma categoria não
 * essencial. Ao revogar, elas são apagadas de verdade.
 */
const CATEGORY_STORAGE_KEYS = {
    preferences: ["markfy-theme", "darkMode"],
    analytics: [],
    marketing: []
};


const allDenied = () => ({
    essential: true,
    preferences: false,
    analytics: false,
    marketing: false
});


const allGranted = () => ({
    essential: true,
    preferences: true,
    analytics: true,
    marketing: true
});


/* =========================================================
   PERSISTÊNCIA

   Cookie primário (sobrevive a subdomínios e é lido antes
   de qualquer script) com espelho em localStorage, para o
   caso de o navegador bloquear cookies.
========================================================= */

const isBrowser = () =>
    typeof window !== "undefined" &&
    typeof document !== "undefined";


const readCookie = (name) => {

    if (!isBrowser()) {
        return null;
    }

    const match =
        document.cookie.match(
            new RegExp(
                `(?:^|;\\s*)${name}=([^;]*)`
            )
        );

    return match
        ? decodeURIComponent(match[1])
        : null;

};


const writeCookie = (name, value, maxAgeDays) => {

    if (!isBrowser()) {
        return;
    }

    const secure =
        window.location.protocol === "https:"
            ? "; Secure"
            : "";

    /* SameSite=Lax: o cookie não viaja em requisição de
       terceiro, o que já é o suficiente aqui e evita ser
       usado para rastreamento entre sites. */
    document.cookie =
        `${name}=${encodeURIComponent(value)}` +
        `; path=/` +
        `; max-age=${maxAgeDays * 24 * 60 * 60}` +
        `; SameSite=Lax${secure}`;

};


const deleteCookie = (name) => {

    if (!isBrowser()) {
        return;
    }

    document.cookie =
        `${name}=; path=/; max-age=0; SameSite=Lax`;

};


const safeLocal = {

    get(key) {
        try {
            return window.localStorage.getItem(key);
        } catch (error) {
            return null;
        }
    },

    set(key, value) {
        try {
            window.localStorage.setItem(key, value);
        } catch (error) {
            /* Modo privado / storage bloqueado: o cookie
               continua sendo a fonte principal. */
        }
    },

    remove(key) {
        try {
            window.localStorage.removeItem(key);
        } catch (error) {
            /* idem */
        }
    }

};


const parseConsent = (raw) => {

    if (!raw) {
        return null;
    }

    try {

        const parsed = JSON.parse(raw);

        if (
            !parsed ||
            parsed.version !== CONSENT_VERSION ||
            !parsed.categories
        ) {
            return null;
        }

        const decidedAt = Date.parse(parsed.date);

        if (Number.isNaN(decidedAt)) {
            return null;
        }

        const expired =
            Date.now() - decidedAt >
            CONSENT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

        if (expired) {
            return null;
        }

        return {
            version: parsed.version,
            date: parsed.date,
            categories: {
                ...allDenied(),
                ...parsed.categories,
                /* Essenciais nunca dependem da escolha
                   gravada — são a base legal do Art. 7º, V
                   e IX, não consentimento. */
                essential: true
            }
        };

    } catch (error) {
        return null;
    }

};


/**
 * Escolha registrada, ou `null` quando o titular ainda não
 * decidiu (ou a escolha expirou / mudou de versão).
 */
export const readConsent = () => {

    if (!isBrowser()) {
        return null;
    }

    return (
        parseConsent(readCookie(CONSENT_COOKIE)) ||
        parseConsent(safeLocal.get(CONSENT_STORAGE_KEY))
    );

};


const listeners = new Set();


const notify = (consent) => {
    listeners.forEach((listener) => {
        try {
            listener(consent);
        } catch (error) {
            console.error(
                "Erro em listener de consentimento:",
                error
            );
        }
    });
};


/**
 * Avisa quando a escolha muda. Devolve a função de remoção.
 */
export const subscribeConsent = (listener) => {

    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };

};


/**
 * Apaga o que foi gravado sob uma categoria recusada.
 *
 * Revogar sem apagar deixaria o dado no dispositivo do
 * titular — contraria o princípio da necessidade
 * (Art. 6º, III) e o direito à eliminação (Art. 18, VI).
 */
export const purgeCategory = (categoryId) => {

    if (!isBrowser()) {
        return;
    }

    (CATEGORY_STORAGE_KEYS[categoryId] || [])
        .forEach((key) => {
            safeLocal.remove(key);
            deleteCookie(key);
        });

};


/**
 * Grava a escolha do titular e devolve o registro salvo.
 *
 * Guarda também data e versão: é o registro de consentimento
 * que o controlador precisa conseguir demonstrar (Art. 8º, §1º).
 */
export const saveConsent = (categories) => {

    const record = {
        version: CONSENT_VERSION,
        date: new Date().toISOString(),
        categories: {
            ...allDenied(),
            ...categories,
            essential: true
        }
    };

    const raw = JSON.stringify(record);

    writeCookie(
        CONSENT_COOKIE,
        raw,
        CONSENT_MAX_AGE_DAYS
    );

    safeLocal.set(CONSENT_STORAGE_KEY, raw);

    OPTIONAL_CATEGORIES.forEach((categoryId) => {
        if (!record.categories[categoryId]) {
            purgeCategory(categoryId);
        }
    });

    notify(record);

    return record;

};


export const acceptAllConsent = () =>
    saveConsent(allGranted());


export const rejectAllConsent = () =>
    saveConsent(allDenied());


/**
 * Revoga tudo: apaga o registro e os dados das categorias
 * não essenciais, e o banner volta a aparecer.
 */
export const resetConsent = () => {

    OPTIONAL_CATEGORIES.forEach(purgeCategory);

    deleteCookie(CONSENT_COOKIE);
    safeLocal.remove(CONSENT_STORAGE_KEY);

    notify(null);

};


/**
 * `true` só quando a categoria foi aceita. Sem decisão
 * registrada, o padrão é NÃO — o silêncio não é
 * consentimento (Art. 8º).
 */
export const hasConsent = (categoryId) => {

    if (categoryId === "essential") {
        return true;
    }

    const consent = readConsent();

    return Boolean(
        consent?.categories?.[categoryId]
    );

};


/* =========================================================
   ARMAZENAMENTO COM TRAVA

   Use no lugar de localStorage para qualquer coisa que NÃO
   seja essencial. Sem consentimento, a escrita simplesmente
   não acontece e a leitura devolve null — a tela segue
   funcionando com o valor padrão.
========================================================= */

export const consentStorage = {

    get(categoryId, key) {

        if (!isBrowser() || !hasConsent(categoryId)) {
            return null;
        }

        return safeLocal.get(key);

    },

    set(categoryId, key, value) {

        if (!isBrowser() || !hasConsent(categoryId)) {
            return false;
        }

        safeLocal.set(key, String(value));

        return true;

    },

    remove(key) {

        if (!isBrowser()) {
            return;
        }

        safeLocal.remove(key);

    }

};


/**
 * Executa `action` só se a categoria estiver consentida.
 * Serve para adiar carregamento de script de terceiro.
 */
export const withConsent = (categoryId, action) => {

    if (!hasConsent(categoryId)) {
        return undefined;
    }

    return action();

};
