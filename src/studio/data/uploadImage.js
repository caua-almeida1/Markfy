import imageCompression from "browser-image-compression";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

/* =========================================================
   UPLOAD DE IMAGENS DO STUDIO

   Vai para companys/{handle}/studio/ — mesma raiz que as
   fotos e a logo da empresa já usam no Storage, então segue
   as mesmas regras de acesso.

   A imagem é reduzida no navegador antes de subir (até
   1920px, ~600 KB): página leve carrega rápido no celular.
========================================================= */

const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
const MAX_INPUT_MB = 15;

export const validateImage = (file) => {
    if (!file) return "Nenhum arquivo selecionado.";
    if (!ACCEPTED.includes(file.type) && !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)) {
        return "Use uma imagem JPG, PNG ou WEBP.";
    }
    if (file.size > MAX_INPUT_MB * 1024 * 1024) {
        return `A imagem passa de ${MAX_INPUT_MB} MB. Escolha uma menor.`;
    }
    return null;
};

export const uploadStudioImage = async (handle, file) => {
    const problem = validateImage(file);
    if (problem) throw new Error(problem);

    let blob = file;

    if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)) {
        const heic2any = (await import("heic2any")).default;
        blob = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.85 });
    }

    const compressed = await imageCompression(blob, {
        maxSizeMB: 0.6,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.82
    });

    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const fileRef = ref(getStorage(), `companys/${handle}/studio/${id}.jpg`);

    await uploadBytes(fileRef, compressed, { contentType: "image/jpeg", cacheControl: "public, max-age=31536000" });

    return getDownloadURL(fileRef);
};
