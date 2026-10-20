import React, { createContext, useContext, useEffect, useState } from "react";
import {
    getDatabase,
    ref,
    get,
    set,
    update,
    onValue
} from "firebase/database";
import { getAuth } from "firebase/auth";

import {
    isDataUrl,
    migrateLegacyLogo
} from "../../firebase/companyLogo";

const UserCompanyContext = createContext();

/*
============================================================
FILHOS PESADOS
============================================================

Nenhuma tela lê estes nós a partir do contexto: elas leem
direto de companys/{handle}/... quando precisam.

Manter esses filhos fora do contexto evita baixar megabytes
de produtos toda vez que um admin abre o painel.
============================================================
*/

const HEAVY_CHILDREN = [
    "products",
    "paymentOrders",
    "schedules"
];

/*
============================================================
LISTA RASA DE CHAVES
============================================================

Usa a REST API do Realtime Database com ?shallow=true para
baixar apenas as chaves de um nó, sem o conteúdo.

Devolve:

    array  -> chaves do nó ([] quando o nó não existe)
    null   -> a consulta falhou (quem chama decide o fallback)
============================================================
*/

const fetchShallowKeys = async (path, currentUser) => {

    const db = getDatabase();

    const databaseURL = db.app?.options?.databaseURL;

    if (!databaseURL) return null;

    try {

        const token = await currentUser.getIdToken();

        const url =
            `${databaseURL.replace(/\/+$/, "")}` +
            `/${path}.json?shallow=true&auth=${token}`;

        const response = await fetch(url);

        if (!response.ok) return null;

        const data = await response.json();

        return data ? Object.keys(data) : [];

    } catch (error) {

        console.warn(
            `Não foi possível listar as chaves de "${path}":`,
            error
        );

        return null;

    }

};

/*
============================================================
EMPRESA ESCOLHIDA NA SESSÃO
============================================================

Quem participa de mais de uma empresa escolhe uma ao entrar.
A escolha vive no sessionStorage: sobrevive a um F5, mas um
login novo pergunta de novo. O storage pode estar bloqueado
(aba anônima, preview), então toda leitura e escrita é
protegida — sem ele, a pessoa só escolhe de novo.
============================================================
*/

const SELECTED_COMPANY_KEY = "markfy:selected-company";

const readSelectedCompany = (uid) => {

    try {

        const saved = JSON.parse(
            sessionStorage.getItem(SELECTED_COMPANY_KEY) || "null"
        );

        return saved?.uid === uid ? saved.handle : null;

    } catch {

        return null;

    }

};

const writeSelectedCompany = (uid, handle) => {

    try {

        sessionStorage.setItem(
            SELECTED_COMPANY_KEY,
            JSON.stringify({ uid, handle })
        );

    } catch {
        /* Sem storage: a escolha vale só até recarregar. */
    }

};

const clearSelectedCompany = () => {

    try {

        sessionStorage.removeItem(SELECTED_COMPANY_KEY);

    } catch {
        /* Nada a limpar. */
    }

};

export const UserCompanyProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(true);

    const [members, setMembers] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(true);

    const [companyHandle, setCompanyHandle] = useState(null);

    /*
     * Todas as empresas em que a pessoa é membro:
     * [{ handle, name, role, roleLabel }].
     *
     * Com mais de uma, o painel só abre depois de ela
     * escolher qual quer administrar (needsCompanySelection).
     */

    const [companies, setCompanies] = useState([]);
    const [needsCompanySelection, setNeedsCompanySelection] = useState(false);

    /*
     * Campos leves do nó da empresa.
     *
     * null = a consulta rasa falhou, então o listener cai
     * para o nó inteiro.
     */

    const [companyFields, setCompanyFields] = useState(null);

    const clearCompany = () => {

        setCompany(null);
        setCompanyHandle(null);
        setCompanyFields(null);
        setMembers([]);

    };

    /*
     * ========================================================
     * BUSCA LARGA (SOMENTE CONTAS SEM ÍNDICE)
     * ========================================================
     *
     * Usada apenas quando users/{uid}/companies ainda não
     * existe. Devolve os handles candidatos obtidos com
     * consulta rasa — nunca o nó "companys" inteiro. Quem
     * chama confere a associação de cada um.
     * ========================================================
     */

    const listAllCompanyHandles = async (currentUser) => {

        let handles = await fetchShallowKeys(
            "companys",
            currentUser
        );

        if (!handles || !handles.length) {

            handles =
                await fetchShallowKeys(
                    "companiesIndex",
                    currentUser
                ) || [];

        }

        return handles;

    };

    /*
     * ========================================================
     * DESCOBRIR AS EMPRESAS DA PESSOA
     * ========================================================
     *
     * Candidatos: o índice users/{uid}/companies somado ao
     * users/{uid}/companyHandle. O companyHandle entra porque
     * convite, criação de empresa e aprovação de pedido
     * gravam só ele — assim uma empresa nova aparece mesmo
     * com um índice antigo.
     *
     * Cada candidato é conferido em
     * companys/{handle}/members/{uid}; quem saiu da empresa
     * some da lista. O índice é regravado quando muda, para
     * a próxima sessão já começar certa.
     * ========================================================
     */

    const resolveMemberships = async (currentUser) => {

        const db = getDatabase();

        const userPath = `users/${currentUser.uid}`;

        const [indexSnapshot, handleSnapshot] = await Promise.all([
            get(ref(db, `${userPath}/companies`)),
            get(ref(db, `${userPath}/companyHandle`))
        ]);

        const indexed =
            indexSnapshot.exists()
                ? Object.keys(indexSnapshot.val() || {})
                : null;

        let candidates = [
            ...(indexed || []),
            ...(handleSnapshot.exists() ? [handleSnapshot.val()] : [])
        ];

        /*
         * Conta sem índice: busca larga uma única vez.
         */

        if (indexed === null) {

            candidates = [
                ...candidates,
                ...await listAllCompanyHandles(currentUser)
            ];

        }

        candidates = [...new Set(candidates.filter(Boolean))];

        const checked = await Promise.all(
            candidates.map(async (handle) => {

                const [memberSnapshot, nameSnapshot] = await Promise.all([
                    get(ref(db, `companys/${handle}/members/${currentUser.uid}`)),
                    get(ref(db, `companys/${handle}/name`))
                ]);

                if (!memberSnapshot.exists()) return null;

                const role = memberSnapshot.val()?.role || null;

                return {
                    handle,
                    name: nameSnapshot.val() || handle,
                    role,
                    roleLabel:
                        role === "master"
                            ? "Administrador"
                            : "Profissional"
                };

            })
        );

        const memberships = checked
            .filter(Boolean)
            .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

        /*
         * Mantém o índice em dia. Falhar aqui não impede o
         * login: na próxima sessão a conferência roda de novo.
         */

        const nextIndex = memberships.map(m => m.handle).sort();

        const indexChanged =
            indexed === null ||
            nextIndex.join(",") !== [...indexed].sort().join(",");

        if (indexChanged) {

            try {

                await set(
                    ref(db, `${userPath}/companies`),
                    nextIndex.length
                        ? Object.fromEntries(nextIndex.map(h => [h, true]))
                        : null
                );

            } catch (error) {

                console.warn(
                    "Não foi possível gravar o índice de empresas do usuário:",
                    error
                );

            }

        }

        return memberships;

    };

    /*
     * ========================================================
     * CARREGAR A EMPRESA
     * ========================================================
     *
     * Lê apenas os campos leves, um a um.
     *
     * Ler companys/{handle} de uma vez traria products,
     * paymentOrders e schedules junto — megabytes que o
     * contexto não usa.
     * ========================================================
     */

    const loadCompanyData = async (currentUser, handle) => {

        const db = getDatabase();

        const keys = await fetchShallowKeys(
            `companys/${handle}`,
            currentUser
        );

        /*
         * A consulta rasa falhou: cai para o nó inteiro
         * para não deixar o app sem dados.
         */

        if (keys === null) {

            const companySnapshot = await get(
                ref(db, `companys/${handle}`)
            );

            if (!companySnapshot.exists()) {

                clearCompany();

                return;

            }

            setCompany({
                handle,
                ...companySnapshot.val()
            });

            setCompanyFields(null);
            setCompanyHandle(handle);

            return;

        }

        if (!keys.length) {

            clearCompany();

            return;

        }

        const fields = keys.filter(
            key => !HEAVY_CHILDREN.includes(key)
        );

        const snapshots = await Promise.all(
            fields.map(
                field => get(
                    ref(db, `companys/${handle}/${field}`)
                )
            )
        );

        const companyData = {};

        fields.forEach((field, index) => {

            if (snapshots[index].exists()) {

                companyData[field] = snapshots[index].val();

            }

        });

        setCompany({
            handle,
            ...companyData
        });

        setCompanyFields(fields);
        setCompanyHandle(handle);

    };

    /*
     * ========================================================
     * QUAL EMPRESA ABRIR
     * ========================================================
     *
     * Uma empresa só: abre direto.
     *
     * Mais de uma: abre a que a pessoa escolheu nesta sessão
     * do navegador. Sem escolha (login novo), o painel fica
     * parado na tela de seleção.
     * ========================================================
     */

    const loadCompany = async (currentUser) => {

        const memberships = await resolveMemberships(currentUser);

        setCompanies(memberships);

        let handle = null;

        if (memberships.length === 1) {

            handle = memberships[0].handle;

        } else if (memberships.length > 1) {

            const chosen = readSelectedCompany(currentUser.uid);

            if (memberships.some(m => m.handle === chosen)) {

                handle = chosen;

            }

        }

        setNeedsCompanySelection(
            memberships.length > 1 && !handle
        );

        if (!handle) {

            clearCompany();

            return;

        }

        await loadCompanyData(currentUser, handle);

    };

    const refreshCompany = async () => {
        const auth = getAuth();

        if (!auth.currentUser) return;

        await loadCompany(auth.currentUser);
    };

    /*
     * ========================================================
     * TROCAR DE EMPRESA
     * ========================================================
     *
     * Guarda a escolha na sessão, aponta
     * users/{uid}/companyHandle para ela (é a "empresa
     * atual" que o resto do app lê) e recarrega os dados.
     *
     * `loading` volta a true durante a troca: o painel
     * desmonta e cada aba relê pedidos e produtos da nova
     * empresa do zero, sem misturar com a anterior.
     * ========================================================
     */

    const selectCompany = async (handle) => {

        const currentUser = getAuth().currentUser;

        if (
            !currentUser ||
            !companies.some(m => m.handle === handle)
        ) {
            return;
        }

        writeSelectedCompany(currentUser.uid, handle);

        if (handle === companyHandle) {

            setNeedsCompanySelection(false);

            return;

        }

        setLoading(true);

        clearCompany();

        setNeedsCompanySelection(false);

        try {

            await update(
                ref(getDatabase(), `users/${currentUser.uid}`),
                { companyHandle: handle }
            );

        } catch (error) {

            console.warn(
                "Não foi possível gravar a empresa atual do usuário:",
                error
            );

        }

        try {

            await loadCompanyData(currentUser, handle);

        } catch (error) {

            console.error(
                "Erro ao carregar a empresa selecionada:",
                error
            );

            clearCompany();

            setNeedsCompanySelection(true);

        } finally {

            setLoading(false);

        }

    };

    useEffect(() => {
        const auth = getAuth();

        const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {

            if (!currentUser) {

                setUser(null);

                clearCompany();

                setCompanies([]);
                setNeedsCompanySelection(false);

                /* O próximo login começa pela tela de seleção. */
                clearSelectedCompany();

                setLoading(false);

                return;
            }

            setLoading(true);

            setUser(currentUser);

            try {

                await loadCompany(currentUser);

            } catch (error) {

                console.error(
                    "Erro ao carregar as empresas do usuário:",
                    error
                );

                clearCompany();

            }

            setLoading(false);
        });

        return () => unsubscribe();

    }, []);

    /*
     * ========================================================
     * LISTENER DA EMPRESA
     * ========================================================
     *
     * Escuta somente a própria empresa, nunca a raiz, e
     * somente os campos leves.
     *
     * Uma escrita em outra empresa não gera mais tráfego
     * aqui, e uma escrita em products também não.
     * ========================================================
     */

    useEffect(() => {

        if (!user || !companyHandle) return;

        const db = getDatabase();

        /*
         * Fallback: a consulta rasa falhou no loadCompany.
         */

        if (companyFields === null) {

            const companyRef = ref(
                db,
                `companys/${companyHandle}`
            );

            const unsubscribe = onValue(
                companyRef,
                (snapshot) => {

                    if (!snapshot.exists()) {

                        clearCompany();

                        return;

                    }

                    setCompany({
                        handle: companyHandle,
                        ...snapshot.val()
                    });

                }
            );

            return () => unsubscribe();

        }

        const unsubscribes = companyFields.map((field) => {

            const fieldRef = ref(
                db,
                `companys/${companyHandle}/${field}`
            );

            return onValue(
                fieldRef,
                (snapshot) => {

                    setCompany((previous) => {

                        /*
                         * O listener pode disparar depois de
                         * um logout ou de uma troca de empresa.
                         */

                        if (
                            !previous ||
                            previous.handle !== companyHandle
                        ) {
                            return previous;
                        }

                        const next = {
                            ...previous
                        };

                        if (snapshot.exists()) {

                            next[field] = snapshot.val();

                        } else {

                            delete next[field];

                        }

                        return next;

                    });

                }
            );

        });

        return () => {

            unsubscribes.forEach(
                unsubscribe => unsubscribe()
            );

        };

    }, [user, companyHandle, companyFields]);

    /*
    ============================================================
    MIGRAÇÃO DA LOGO LEGADA
    ============================================================

    Versões antigas da tela de marca gravavam a logo como
    base64 dentro de companys/{handle}/logoPreview — ~40 KB
    trafegados em toda leitura do nó da empresa, e sem logo
    na tela Explorar, porque o índice público só aceita URL.

    Aqui, com um membro autenticado (o único que tem
    permissão de escrita no nó), o base64 é enviado para
    companys/{handle}/logo.png, o índice passa a apontar
    para o arquivo e o campo é zerado.

    A ordem é proposital: o campo só é apagado depois do
    upload ter dado certo. Se falhar, o base64 continua lá e
    a migração é tentada de novo no próximo login.
    ============================================================
    */

    useEffect(() => {

        if (
            !user ||
            !companyHandle ||
            !isDataUrl(company?.logoPreview)
        ) {
            return;
        }

        let cancelled = false;

        migrateLegacyLogo(
            companyHandle,
            company.logoPreview
        ).then((url) => {

            if (cancelled || !url) {
                return;
            }

            /* Reflete a limpeza no estado local, para a tela
               não continuar exibindo o base64 recém-removido. */
            setCompany((previous) =>
                previous
                    ? { ...previous, logoPreview: null }
                    : previous
            );

        });

        return () => {
            cancelled = true;
        };

    }, [user, companyHandle, company?.logoPreview]);

    useEffect(() => {

        if (!companyHandle) return;

        const db = getDatabase();

        let cancelled = false;

        const membersRef = ref(
            db,
            `companys/${companyHandle}/members`
        );

        const unsubscribe = onValue(
            membersRef,
            async (snapshot) => {

                setLoadingMembers(true);

                const membersData = snapshot.val() || {};

                const loadedMembers = await Promise.all(

                    Object.entries(membersData).map(async ([uid, member]) => {

                        /* Perfil de outro membro pode ser negado pelas
                           regras (ou falhar sem rede). Um perfil que não
                           carrega não pode derrubar a equipe inteira:
                           mostra o membro com o que a empresa já tem. */
                        let profile = null;

                        try {
                            const userSnapshot = await get(
                                ref(db, `users/${uid}`)
                            );

                            if (!userSnapshot.exists()) return null;

                            profile = userSnapshot.val();
                        } catch {
                            profile = {
                                name: member.name || member.email || "Membro da equipe",
                                email: member.email || ""
                            };
                        }

                        return {
                            uid,

                            ...profile,

                            role: member.role,

                            roleLabel:
                                member.role === "master"
                                    ? "Administrador"
                                    : "Profissional"
                        };

                    })

                );

                /* Trocou de empresa enquanto os perfis
                   carregavam: descarta a equipe antiga. */
                if (cancelled) return;

                setMembers(
                    loadedMembers.filter(Boolean)
                );

                setLoadingMembers(false);

            },
            () => {
                if (cancelled) return;
                setMembers([]);
                setLoadingMembers(false);
            }
        );

        return () => {
            cancelled = true;
            unsubscribe();
        };

    }, [companyHandle]);

    return (
        <UserCompanyContext.Provider
            value={{
                user,
                company,
                companyHandle,
                members,
                loading,
                loadingMembers,
                refreshCompany,
                companies,
                needsCompanySelection,
                selectCompany
            }}
        >
            {children}
        </UserCompanyContext.Provider>
    );
};

export const useUserCompany = () => useContext(UserCompanyContext);
