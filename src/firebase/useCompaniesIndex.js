import { useEffect, useState } from "react";
import { getDatabase, ref, get } from "firebase/database";
import { getAuth } from "firebase/auth";

import { fetchCompaniesFromSource } from "./companiesIndex";
import { fetchOpenHandles } from "../plans/publicAccess";

/* =========================================================
   LISTA PÚBLICA DE EMPRESAS (com cache de módulo)

   Mesma fonte da tela Explorar: companiesIndex, e o
   fallback por companys/ quando o índice ainda está vazio.

   A leitura é feita uma vez por sessão e compartilhada: a
   transição da Home pré-carrega, e a central do usuário já
   abre com as empresas na mão.
========================================================= */

let cache = null;
let inflight = null;

const loadAll = async () => {
    const snapshot = await get(ref(getDatabase(), "companiesIndex"));

    const data = snapshot.val();

    /* Índice incompleto (entradas sem nome) conta como
       vazio, igual à tela Explorar: melhor montar a lista
       pela fonte do que mostrar zero empresas. */
    const indexed = Object.entries(data || {})
        .map(([handle, entry]) => ({ ...entry, handle: entry?.handle || handle }))
        .filter((entry) => entry?.name);

    if (indexed.length) {
        return indexed;
    }

    let token = null;

    try {
        token = await getAuth().currentUser?.getIdToken();
    } catch {
        token = null;
    }

    return fetchCompaniesFromSource(token);
};

/* Só empresas com plano ativo aparecem para os clientes. */
const load = async () => {

    const [list, open] = await Promise.all([loadAll(), fetchOpenHandles()]);

    return list.filter((entry) => open.has(entry.handle));
};

export const prefetchCompaniesIndex = () => {
    if (cache) return Promise.resolve(cache);

    if (!inflight) {
        inflight = load()
            .then((list) => {
                cache = list;
                return list;
            })
            .finally(() => {
                inflight = null;
            });
    }

    return inflight;
};

export const useCompaniesIndex = () => {
    const [state, setState] = useState(() => ({
        companies: cache || [],
        loading: !cache,
        error: null
    }));

    useEffect(() => {
        if (cache) return undefined;

        let cancelled = false;

        prefetchCompaniesIndex()
            .then((companies) => {
                if (!cancelled) setState({ companies, loading: false, error: null });
            })
            .catch((error) => {
                if (!cancelled) setState({ companies: [], loading: false, error });
            });

        return () => {
            cancelled = true;
        };
    }, []);

    return state;
};
