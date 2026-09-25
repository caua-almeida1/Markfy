import React, { createContext, useContext, useEffect, useState } from "react";
import {
    getDatabase,
    ref,
    get,
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

export const UserCompanyProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [company, setCompany] = useState(null);
    const [loading, setLoading] = useState(true);

    const [members, setMembers] = useState([]);
    const [loadingMembers, setLoadingMembers] = useState(true);

    const [companyHandle, setCompanyHandle] = useState(null);

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
     * BUSCA LARGA (SOMENTE CONTAS ANTIGAS)
     * ========================================================
     *
     * Usada apenas quando users/{uid}/companyHandle não existe.
     *
     * Percorre os handles obtidos com consulta rasa e lê
     * somente companys/{handle}/members/{uid}, nunca o nó
     * "companys" inteiro.
     * ========================================================
     */

    const findCompanyHandleByMembership = async (currentUser) => {

        const db = getDatabase();

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

        for (const handle of handles) {

            const memberSnapshot = await get(
                ref(
                    db,
                    `companys/${handle}/members/${currentUser.uid}`
                )
            );

            if (memberSnapshot.exists()) {

                return handle;

            }

        }

        return null;

    };

    /*
     * ========================================================
     * DESCOBRIR O HANDLE
     * ========================================================
     *
     * Nunca lê o nó da empresa inteiro: só confere a
     * associação em companys/{handle}/members/{uid}.
     * ========================================================
     */

    const resolveCompanyHandle = async (currentUser) => {

        const db = getDatabase();

        /*
         * CAMINHO RÁPIDO: o handle já está no usuário.
         */

        const handleSnapshot = await get(
            ref(
                db,
                `users/${currentUser.uid}/companyHandle`
            )
        );

        if (handleSnapshot.exists()) {

            const handle = handleSnapshot.val();

            const memberSnapshot = await get(
                ref(
                    db,
                    `companys/${handle}/members/${currentUser.uid}`
                )
            );

            /*
             * Se o usuário não é mais membro, o handle está
             * desatualizado e caímos na busca larga.
             */

            if (memberSnapshot.exists()) {

                return handle;

            }

        }

        /*
         * BUSCA LARGA (SOMENTE CONTAS ANTIGAS)
         */

        const foundHandle =
            await findCompanyHandleByMembership(currentUser);

        if (!foundHandle) return null;

        /*
         * Grava o handle no usuário para que as próximas
         * sessões usem o caminho rápido.
         */

        try {

            await update(
                ref(db, `users/${currentUser.uid}`),
                {
                    companyHandle: foundHandle
                }
            );

        } catch (error) {

            console.warn(
                "Não foi possível gravar o companyHandle do usuário:",
                error
            );

        }

        return foundHandle;

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

    const loadCompany = async (currentUser) => {

        const db = getDatabase();

        const handle = await resolveCompanyHandle(currentUser);

        if (!handle) {

            clearCompany();

            return;

        }

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

    const refreshCompany = async () => {
        const auth = getAuth();

        if (!auth.currentUser) return;

        await loadCompany(auth.currentUser);
    };

    useEffect(() => {
        const auth = getAuth();

        const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {

            if (!currentUser) {

                setUser(null);

                clearCompany();

                setLoading(false);

                return;
            }

            setUser(currentUser);

            await loadCompany(currentUser);

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

                        const userSnapshot = await get(
                            ref(db, `users/${uid}`)
                        );

                        if (!userSnapshot.exists()) return null;

                        return {
                            uid,

                            ...userSnapshot.val(),

                            role: member.role,

                            roleLabel:
                                member.role === "master"
                                    ? "Administrador"
                                    : "Profissional"
                        };

                    })

                );

                setMembers(
                    loadedMembers.filter(Boolean)
                );

                setLoadingMembers(false);

            }
        );

        return () => unsubscribe();

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
                refreshCompany
            }}
        >
            {children}
        </UserCompanyContext.Provider>
    );
};

export const useUserCompany = () => useContext(UserCompanyContext);
