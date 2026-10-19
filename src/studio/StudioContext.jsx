import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

import { useAuth } from "../contexts/authContext";
import { useUserCompany } from "../contexts/companyContext/UserCompanyContext";
import { useCompanyBundle } from "./data/companyBundle";
import { watchDraft, watchPublished } from "./data/studioApi";
import { normalizePage } from "./site/schema";

/* =========================================================
   CONTEXTO DO STUDIO

   Junta o que todas as telas do Studio precisam: a empresa
   escolhida (do UserCompanyContext, que já isola os dados
   por empresa), o papel da pessoa nela, os dados vivos da
   empresa, o rascunho e a versão publicada.

   Permissões: dono/administrador editam e publicam;
   profissional só visualiza. É a mesma divisão de papéis
   que a Bookings já grava em companys/{handle}/members.
========================================================= */

const StudioContext = createContext(null);

export const StudioProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const companyState = useUserCompany();

    const { company, companies, companyHandle } = companyState;

    const handle = companyHandle || company?.handle || null;

    const membership = companies?.find((item) => item.handle === handle);
    const role = membership?.role || company?.members?.[currentUser?.uid]?.role || null;
    const canEdit = role !== "professional";

    const bundleState = useCompanyBundle(handle);

    const [draft, setDraft] = useState({ loading: true, data: null });
    const [published, setPublished] = useState({ loading: true, data: null });

    useEffect(() => {
        if (!handle) return undefined;

        setDraft({ loading: true, data: null });
        setPublished({ loading: true, data: null });

        const stopDraft = watchDraft(handle, (data) => setDraft({ loading: false, data }));
        const stopPublished = watchPublished(handle, (data) => setPublished({ loading: false, data }));

        return () => {
            stopDraft();
            stopPublished();
        };
    }, [handle]);

    const value = useMemo(() => {
        const draftPage = normalizePage(draft.data?.page);
        const publishedPage = normalizePage(published.data?.page);

        const publishedAt = published.data?.publishedAt || null;
        const updatedAt = draft.data?.updatedAt || null;

        let status = "none";
        if (publishedPage) {
            status = updatedAt && publishedAt && updatedAt > publishedAt + 1500 ? "changes" : "published";
        } else if (draftPage) {
            status = "draft";
        }

        return {
            user: currentUser,
            companyState,
            company,
            handle,
            role,
            canEdit,
            bundle: bundleState.bundle,
            bundleLoading: bundleState.loading,
            reloadBundle: bundleState.reload,
            draftLoading: draft.loading,
            draft: draft.data,
            draftPage,
            publishedLoading: published.loading,
            published: published.data,
            publishedPage,
            status,
            publicUrl: handle ? `${window.location.origin}/s/${handle}` : ""
        };
    }, [currentUser, companyState, company, handle, role, canEdit, bundleState, draft, published]);

    return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
};

export const useStudio = () => useContext(StudioContext);


export const STATUS_META = {
    none: { label: "Sem página", tone: undefined, text: "Você ainda não criou sua página." },
    draft: { label: "Rascunho", tone: "warning", text: "Sua página ainda não foi publicada." },
    published: { label: "Publicada", tone: "success", text: "Sua página está no ar." },
    changes: { label: "Alterações não publicadas", tone: "info", text: "A versão no ar é anterior às suas últimas edições." }
};
