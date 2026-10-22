import { useCallback, useEffect, useState } from "react";
import { getAuth } from "firebase/auth";

import { loadPublicCompanyList } from "./companiesIndex";
import { fetchPublicAccessMap } from "../plans/publicAccess";
import { rankCompanies } from "../utils/companyEligibility";

/* =========================================================
   LISTA PÚBLICA DE EMPRESAS (com cache de módulo)

   Fonte única do Explorar e da central do usuário:
   companiesIndex, com entradas incompletas completadas pelos
   campos públicos da empresa (ver loadPublicCompanyList).

   Só entram empresas elegíveis (publicAccess: plano ativo
   com Bookings) — as mesmas que a página da empresa aceita
   abrir. Antes, o Explorar listava todas e o clique levava a
   "Empresa indisponível".

   Cache por 5 minutos e só de lista não vazia: um "zero"
   causado por falha não fica preso pela sessão inteira.
========================================================= */

const TTL_MS = 5 * 60 * 1000;

let cache = null;
let cachedAt = 0;
let inflight = null;

const fresh = () => cache && Date.now() - cachedAt < TTL_MS;

const load = async () => {

    let authToken = null;

    try {
        authToken = await getAuth().currentUser?.getIdToken();
    } catch {
        authToken = null;
    }

    const access = await fetchPublicAccessMap();

    /* Quem é elegível vem de publicAccess (só master e backend
       gravam). O índice dá os dados do card; elegível fora do
       índice é montado pelos campos públicos da empresa. */
    const list = await loadPublicCompanyList({
        authToken,
        handles: Object.keys(access)
    });

    /* Filtra os elegíveis e ordena (destaque, perfil
       completo, nome) — regra em utils/companyEligibility. */
    return rankCompanies(list, access);
};

export const prefetchCompaniesIndex = ({ force = false } = {}) => {

    if (!force && fresh()) return Promise.resolve(cache);

    if (!inflight) {
        inflight = load()
            .then((list) => {
                if (list.length) {
                    cache = list;
                    cachedAt = Date.now();
                }
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
        loading: !fresh(),
        error: null
    }));

    const run = useCallback((force) => {

        let cancelled = false;

        setState((current) => ({ ...current, loading: true, error: null }));

        prefetchCompaniesIndex({ force })
            .then((companies) => {
                if (!cancelled) setState({ companies, loading: false, error: null });
            })
            .catch((error) => {
                console.error("Erro ao carregar empresas:", error);
                if (!cancelled) setState({ companies: cache || [], loading: false, error });
            });

        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        if (fresh()) return undefined;
        return run(false);
    }, [run]);

    const reload = useCallback(() => {
        run(true);
    }, [run]);

    return { ...state, reload };
};
