import { publicAccessFor } from "../menus/engine/licensing.js";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
    getAuth,
    setPersistence,
    browserSessionPersistence,
    signInWithEmailAndPassword,
    updatePassword,
    signOut,
    onAuthStateChanged
} from "firebase/auth";
import {
    getDatabase,
    ref,
    get,
    set,
    remove,
    serverTimestamp
} from "firebase/database";

import { getStorage, ref as storageRef, getDownloadURL } from "firebase/storage";
import { app as mainApp } from "../firebase/firebase";
import { getMasterAccount } from "./masterConfig";
import { DEFAULT_PLANS, buildCatalog, serializePlan } from "../plans/planDefaults";

/* =========================================================
   MARKFY MASTER DEV — DADOS

   O painel roda num SEGUNDO app do Firebase ("markfy-master").
   Assim a sessão master é independente da sessão normal do
   site: entrar aqui não desloga quem estiver usando a
   Bookings na outra aba, e a sessão morre ao fechar a aba
   (persistência de sessão, não de disco).

   Leituras: users, companys (nome + equipe), studioSites e
   studioDrafts. Escrita: só licenses/{uid}.

   A licença fica em licenses/{uid}, e NÃO dentro de users/{uid},
   de propósito: users/{uid} é gravável pela própria pessoa, e
   ela poderia se dar um plano. licenses/ só aceita escrita da
   conta master (ver database.rules.proposta.json).
========================================================= */

const MASTER_APP_NAME = "markfy-master";

const masterApp = () =>
    getApps().some((candidate) => candidate.name === MASTER_APP_NAME)
        ? getApp(MASTER_APP_NAME)
        : initializeApp(mainApp.options, MASTER_APP_NAME);

const masterAuth = () => getAuth(masterApp());
const masterDb = () => getDatabase(masterApp());

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

const isMasterUser = (user) => Boolean(getMasterAccount(user?.email));


/* ---------- SESSÃO ---------- */

export const watchMasterSession = (callback) =>
    onAuthStateChanged(masterAuth(), (user) => {
        callback(isMasterUser(user) ? user : null);
    });

export const signInMaster = async (email, password) => {

    const auth = masterAuth();

    /* E-mail fora da lista nem chega ao Firebase. */
    if (!getMasterAccount(email)) {
        throw Object.assign(new Error("not-master"), { code: "master/not-master" });
    }

    await setPersistence(auth, browserSessionPersistence);

    const { user } = await signInWithEmailAndPassword(
        auth,
        normalizeEmail(email),
        password
    );

    if (!isMasterUser(user)) {
        await signOut(auth);
        throw Object.assign(new Error("not-master"), { code: "master/not-master" });
    }

    return user;
};

export const signOutMaster = () => signOut(masterAuth());

/* ---------- TROCA DA SENHA PROVISÓRIA ----------

   Contas com forcePasswordChange só abrem o painel depois de
   trocar a senha. A troca fica registrada em masterProfiles/{uid};
   sem esse registro (ou se a leitura falhar) o painel não abre. */

export const needsPasswordChange = async (user) => {

    if (!getMasterAccount(user?.email)?.forcePasswordChange) return false;

    try {
        const snapshot = await get(ref(masterDb(), `masterProfiles/${user.uid}/passwordChangedAt`));
        return !snapshot.exists();
    } catch {
        return true;
    }
};

export const changeMasterPassword = async (email, currentPassword, newPassword) => {

    /* Reautentica com a senha atual: confirma que é a própria pessoa. */
    const { user } = await signInWithEmailAndPassword(masterAuth(), normalizeEmail(email), currentPassword);

    if (!isMasterUser(user)) {
        await signOut(masterAuth());
        throw Object.assign(new Error("not-master"), { code: "master/not-master" });
    }

    if (newPassword === currentPassword) {
        throw Object.assign(new Error("same-password"), { code: "master/same-password" });
    }

    await updatePassword(user, newPassword);

    await set(ref(masterDb(), `masterProfiles/${user.uid}`), {
        email: normalizeEmail(user.email),
        passwordChangedAt: serverTimestamp()
    });
};

export const describeMasterError = (error) => {

    switch (error?.code) {

        case "auth/invalid-credential":
        case "auth/wrong-password":
            return "Senha incorreta.";

        case "auth/user-not-found":
            return "A conta master ainda não existe no Firebase Authentication. Crie-a no console (veja o passo a passo ao lado).";

        case "auth/weak-password":
            return "A nova senha é fraca demais. Use pelo menos 8 caracteres.";

        case "master/same-password":
            return "A nova senha precisa ser diferente da provisória.";

        case "auth/too-many-requests":
            return "Muitas tentativas. Espere alguns minutos.";

        case "auth/network-request-failed":
            return "Sem conexão. Verifique sua internet.";

        case "auth/unauthorized-domain":
            return "Este endereço não está autorizado no Firebase (Authentication → Domínios autorizados).";

        case "master/not-master":
            return "Esta conta não tem permissão de master.";

        default:
            return "Não foi possível entrar. Tente de novo.";
    }
};


/* ---------- LEITURA ---------- */

const shallowKeys = async (path) => {

    const user = masterAuth().currentUser;
    const databaseURL = masterApp().options?.databaseURL;

    if (!user || !databaseURL) return null;

    try {

        const token = await user.getIdToken();

        const response = await fetch(
            `${databaseURL.replace(/\/+$/, "")}/${path}.json?shallow=true&auth=${token}`
        );

        if (!response.ok) return null;

        const data = await response.json();

        return data ? Object.keys(data) : [];

    } catch {

        return null;
    }
};

/* Executa `worker` em lotes, para não abrir centenas de
   leituras de uma vez quando houver muitas empresas. */
const inBatches = async (items, size, worker) => {

    const results = [];

    for (let index = 0; index < items.length; index += size) {

        const slice = items.slice(index, index + size);

        results.push(...await Promise.all(slice.map(worker)));
    }

    return results;
};

const readValue = async (path) => {

    try {

        const snapshot = await get(ref(masterDb(), path));

        return snapshot.exists() ? snapshot.val() : null;

    } catch {

        return null;
    }
};

const toMillis = (value) => {

    const number = Number(value);

    return Number.isFinite(number) && number > 0 ? number : null;
};

const normalizeLicense = (raw) =>
    raw && raw.plan
        ? {
            plan: raw.plan,
            product: raw.product || "bookings",
            status: raw.status || "active",
            expiresAt: toMillis(raw.expiresAt),
            note: raw.note || "",
            source: raw.source || "master",
            updatedAt: toMillis(raw.updatedAt)
        }
        : null;

/**
 * Carrega a rede inteira e devolve já cruzada:
 *
 *   people     [{ uid, name, email, kind, companies[], license, ... }]
 *   companies  [{ handle, name, owners[], team[], links, studio }]
 *   warnings   avisos de leituras que falharam
 */
export const loadNetwork = async () => {

    const warnings = [];
    const origin = window.location.origin;

    /* ---- usuários ---- */

    let usersRaw = null;

    try {
        usersRaw = (await get(ref(masterDb(), "users"))).val();
    } catch (error) {
        warnings.push(
            "Não foi possível ler os usuários (regras do banco?): " +
            (error?.message || error)
        );
    }

    usersRaw = usersRaw || {};

    /* ---- empresas ---- */

    let handles = await shallowKeys("companys");

    if (handles === null) {
        handles = await shallowKeys("companiesIndex");
        warnings.push("Lista de empresas obtida pelo índice público.");
    }

    handles = handles || [];

    const [publishedKeys, draftKeys, licensesRaw] = await Promise.all([
        shallowKeys("studioSites"),
        shallowKeys("studioDrafts"),
        readValue("licenses")
    ]);

    const published = new Set(publishedKeys || []);
    const drafts = new Set(draftKeys || []);

    const companiesRaw = await inBatches(handles, 20, async (handle) => {

        const [name, members, createdAt, logo] = await Promise.all([
            readValue(`companys/${handle}/name`),
            readValue(`companys/${handle}/members`),
            readValue(`companys/${handle}/createdAt`),
            readValue(`companiesIndex/${handle}/logo`)
        ]);

        return { handle, name, members: members || {}, createdAt, logo };
    });

    /* ---- cruzamento ---- */

    const peopleByUid = {};

    Object.entries(usersRaw).forEach(([uid, data]) => {

        peopleByUid[uid] = {
            uid,
            name: data?.name || data?.displayName || "(sem nome)",
            email: data?.email || "",
            phone: data?.phone || data?.phoneNumber || "",
            provider: data?.provider || "",
            userType: data?.userType || "",
            createdAt: toMillis(data?.createdAt),
            companies: []
        };
    });

    const companies = companiesRaw.map((company) => {

        const team = Object.entries(company.members).map(([uid, member]) => {

            const role = member?.role === "master" ? "master" : "professional";

            if (!peopleByUid[uid]) {
                peopleByUid[uid] = {
                    uid,
                    name: "(perfil removido)",
                    email: "",
                    phone: "",
                    provider: "",
                    userType: "",
                    createdAt: null,
                    companies: [],
                    orphan: true
                };
            }

            peopleByUid[uid].companies.push({
                handle: company.handle,
                name: company.name || company.handle,
                role
            });

            return { uid, role };
        });

        return {
            handle: company.handle,
            name: company.name || company.handle,
            logo: typeof company.logo === "string" ? company.logo : "",
            createdAt: toMillis(company.createdAt),
            team,
            links: {
                bookings: `${origin}/central-user/${company.handle}`,
                catalog: `${origin}/central-user/${company.handle}/catalog`,
                studio: `${origin}/s/${company.handle}`
            },
            license: normalizeLicense(licensesRaw?.[company.handle]),
            studio: published.has(company.handle)
                ? "published"
                : drafts.has(company.handle)
                    ? "draft"
                    : "none"
        };
    });

    const companiesByHandle = Object.fromEntries(
        companies.map((company) => [company.handle, company])
    );

    const people = Object.values(peopleByUid).map((person) => {

        const owns = person.companies.filter((c) => c.role === "master");
        const works = person.companies.filter((c) => c.role !== "master");

        const kind = owns.length ? "owner" : works.length ? "employee" : "user";

        /* O plano é da EMPRESA: a pessoa mostra o da empresa
           principal dela (a que administra, senão onde trabalha). */
        const primary = owns.length
            ? companiesByHandle[owns[0].handle]
            : works.length
                ? companiesByHandle[works[0].handle]
                : null;

        return {
            ...person,
            kind,
            ownedCompanies: owns.map((c) => companiesByHandle[c.handle]).filter(Boolean),
            workedCompanies: works.map((c) => companiesByHandle[c.handle]).filter(Boolean),
            license: primary?.license || null
        };
    });

    /* Equipe com nome/e-mail resolvidos, para a tela de empresas. */
    companies.forEach((company) => {

        company.team = company.team.map((member) => ({
            ...member,
            name: peopleByUid[member.uid]?.name || "(perfil removido)",
            email: peopleByUid[member.uid]?.email || ""
        }));

        company.owners = company.team.filter((member) => member.role === "master");
    });

    people.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    companies.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

    return { people, companies, warnings };
};


/* ---------- ESCRITA ---------- */

/**
 * Grava (ou remove) a licença de uma EMPRESA em licenses/{handle}.
 * Sem plano, o registro é apagado e a empresa volta a ficar bloqueada.
 */
export const saveLicense = async (handle, license) => {

    const target = ref(masterDb(), `licenses/${handle}`);

    const publicTarget = ref(masterDb(), `publicAccess/${handle}`);

    if (!license || !license.plan) {
        await Promise.all([remove(target), remove(publicTarget)]);
        return null;
    }

    const payload = {
        plan: license.plan,
        product: license.product || "bookings",
        status: license.status || "active",
        expiresAt: license.expiresAt || null,
        note: (license.note || "").slice(0, 280),
        source: "master",
        updatedAt: serverTimestamp(),
        updatedBy: masterAuth().currentUser?.uid || null
    };

    await set(target, payload);

    /* Espelho público mínimo: só diz o que a empresa pode
       receber de clientes (mesma regra do backend). */
    await set(publicTarget, publicAccessFor(payload));

    return { ...payload, updatedAt: Date.now() };
};


/* ---------- CATÁLOGO DE PLANOS ---------- */

export const loadCatalog = async () => {

    const raw = await readValue("planCatalog");

    return { published: Boolean(raw), plans: buildCatalog(raw) };
};

/** Publica o catálogo padrão quando ainda não existe nada no banco. */
export const seedCatalog = async () => {

    const entries = Object.entries(DEFAULT_PLANS);

    await Promise.all(entries.map(([id, plan]) =>
        set(ref(masterDb(), `planCatalog/${id}`), serializePlan(buildCatalog({ [id]: plan })[0]))
    ));
};

export const savePlan = (id, plan) =>
    set(ref(masterDb(), `planCatalog/${id}`), serializePlan(plan));

export const deletePlan = (id) =>
    remove(ref(masterDb(), `planCatalog/${id}`));

/* ---------- IMAGENS DO STORAGE ----------

   Foto de perfil:  users/{uid}/profileImg
   Logo da empresa: companys/{handle}/logo.png

   Quem não tem arquivo dá "object-not-found" e simplesmente fica
   de fora (a tela mostra iniciais). Chama `onBatch` a cada lote
   para as imagens irem aparecendo sem travar a tela. */

export const loadStorageImages = async (items, onBatch) => {

    const storage = getStorage(masterApp());

    for (let index = 0; index < items.length; index += 10) {

        const slice = items.slice(index, index + 10);
        const batch = {};

        await Promise.all(slice.map(async ({ key, path }) => {
            try {
                batch[key] = await getDownloadURL(storageRef(storage, path));
            } catch {
                /* sem imagem */
            }
        }));

        onBatch(batch);
    }
};
