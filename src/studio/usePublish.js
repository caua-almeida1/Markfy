import { useState } from "react";

import { useStudio } from "./StudioContext";
import { publishSite, saveDraft, unpublishSite } from "./data/studioApi";
import { useToast } from "../design-system/components";

/* Publicar e tirar do ar, com o mesmo retorno em todas as
   telas. O toast só sai depois que o banco confirmou. */
export const usePublish = () => {
    const { handle, user, company, draftPage, canEdit } = useStudio();
    const notify = useToast();
    const [busy, setBusy] = useState(null);

    const publish = async (page = draftPage) => {
        if (!canEdit || !page) return false;

        setBusy("publish");

        try {
            /* Garante que o rascunho salvo é exatamente o que
               foi publicado, antes de marcar a data. */
            await saveDraft(handle, page, user?.uid);
            await publishSite(handle, page, user?.uid, company?.name);
            notify("success", "Página publicada", "As mudanças já estão no ar.");
            return true;
        } catch (error) {
            console.error("Erro ao publicar:", error);
            notify("error", "Não foi possível publicar", "Verifique sua conexão e tente de novo. Seu rascunho continua salvo.");
            return false;
        } finally {
            setBusy(null);
        }
    };

    const unpublish = async () => {
        if (!canEdit) return false;

        setBusy("unpublish");

        try {
            await unpublishSite(handle);
            notify("success", "Página tirada do ar", "O link deixou de funcionar. O rascunho continua salvo.");
            return true;
        } catch (error) {
            notify("error", "Não foi possível tirar do ar", "Tente de novo em instantes.");
            return false;
        } finally {
            setBusy(null);
        }
    };

    return { publish, unpublish, busy };
};
