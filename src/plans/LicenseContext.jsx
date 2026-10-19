import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getDatabase, onValue, ref } from "firebase/database";

import { useUserCompany } from "../contexts/companyContext/UserCompanyContext";
import {
    buildCatalog,
    licenseState,
    normalizePlan,
    productAllows,
    DEFAULT_PLANS
} from "./planDefaults";

/* =========================================================
   LICENÇA DA EMPRESA

   Lê, em tempo real:
     planCatalog              o que cada plano oferece
     licenses/{companyHandle} o plano da empresa aberta

   e entrega regras prontas para as telas:

     hasProduct("bookings" | "studio")
     can("onlinePayments")      recurso do plano
     limit("maxMembers")        número ou Infinity
     isOwner                    administrador principal?

   FALHA FECHADO: enquanto a licença não carregou, ou se a
   leitura falhar, nada é liberado. Quem decide de verdade é
   o banco (regras em database.rules.proposta.json) e o
   backend; este contexto só evita mostrar o que o banco
   recusaria.
========================================================= */

const LicenseContext = createContext(null);

export const LicenseProvider = ({ children }) => {

    const { companyHandle, companies } = useUserCompany() || {};

    const [catalogRaw, setCatalogRaw] = useState(undefined);
    const [licenseRaw, setLicenseRaw] = useState({ handle: null, value: undefined, error: false });

    /* ---- catálogo ---- */

    useEffect(() => {
        const stop = onValue(
            ref(getDatabase(), "planCatalog"),
            (snapshot) => setCatalogRaw(snapshot.val() || null),
            () => setCatalogRaw(null)
        );
        return stop;
    }, []);

    /* ---- licença da empresa aberta ---- */

    useEffect(() => {

        if (!companyHandle) {
            setLicenseRaw({ handle: null, value: undefined, error: false });
            return undefined;
        }

        setLicenseRaw({ handle: companyHandle, value: undefined, error: false });

        const stop = onValue(
            ref(getDatabase(), `licenses/${companyHandle}`),
            (snapshot) => setLicenseRaw({ handle: companyHandle, value: snapshot.val() || null, error: false }),
            () => setLicenseRaw({ handle: companyHandle, value: null, error: true })
        );

        return stop;
    }, [companyHandle]);

    const value = useMemo(() => {

        const catalog = buildCatalog(catalogRaw);

        /* O valor só vale se for da empresa que está aberta agora. */
        const fresh = licenseRaw.handle === companyHandle;
        const loading = Boolean(companyHandle) && (!fresh || licenseRaw.value === undefined || catalogRaw === undefined);

        const license = fresh ? licenseRaw.value || null : null;
        const state = licenseState(license);

        const plan = license?.plan
            ? (catalog.find((item) => item.id === license.plan) ||
                (DEFAULT_PLANS[license.plan] ? normalizePlan(license.plan, DEFAULT_PLANS[license.plan]) : null))
            : null;

        const active = state === "active";
        const product = active ? license.product || null : null;

        const membership = companies?.find((item) => item.handle === companyHandle);

        return {
            loading,
            error: fresh && licenseRaw.error,
            handle: companyHandle || null,
            catalog,
            catalogPublished: Boolean(catalogRaw),
            license,
            state,
            active,
            plan,
            product,
            isOwner: membership?.role === "master",

            hasProduct: (wanted) => active && productAllows(product, wanted),

            can: (feature) => active && plan?.features?.[feature] === true,

            /* Sem licença ativa, o limite é 0: nada novo se cria. */
            limit: (key) => {
                if (!active || !plan) return 0;
                const raw = plan.limits?.[key];
                return raw === null || raw === undefined ? Infinity : raw;
            }
        };
    }, [catalogRaw, licenseRaw, companyHandle, companies]);

    return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
};

export const useLicense = () => {
    const value = useContext(LicenseContext);

    if (!value) {
        throw new Error("useLicense precisa estar dentro de <LicenseProvider>.");
    }

    return value;
};

/** Catálogo sem precisar de empresa (tela de planos, criação). */
export const usePlanCatalog = () => {
    const [raw, setRaw] = useState(undefined);

    useEffect(() => {
        const stop = onValue(
            ref(getDatabase(), "planCatalog"),
            (snapshot) => setRaw(snapshot.val() || null),
            () => setRaw(null)
        );
        return stop;
    }, []);

    return useMemo(
        () => ({ loading: raw === undefined, published: Boolean(raw), catalog: buildCatalog(raw) }),
        [raw]
    );
};
