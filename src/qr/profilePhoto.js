import imageCompression from "browser-image-compression";
import { getStorage, ref, uploadBytes } from "firebase/storage";

/* =========================================================
   FOTO DE PERFIL

   Aceita JPG, PNG, WEBP e HEIC/HEIF (iPhone). A imagem é:
     1. convertida para JPEG, se for HEIC;
     2. recortada em quadrado NO CENTRO (512 px);
     3. comprimida com força (alvo ~60 KB).

   Vai só para o Storage, em users/{uid}/profileImg — o mesmo
   lugar de onde as outras telas já buscam a foto. Nada é
   gravado no Realtime Database.
========================================================= */

const MAX_INPUT_MB = 20;
const SIZE = 512;

const isHeic = (file) =>
    /heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);

export const validateProfilePhoto = (file) => {

    if (!file) return "Nenhum arquivo selecionado.";

    if (!/^image\//.test(file.type) && !isHeic(file)) {
        return "Use uma imagem JPG, PNG, WEBP ou HEIC.";
    }

    if (file.size > MAX_INPUT_MB * 1024 * 1024) {
        return `A foto passa de ${MAX_INPUT_MB} MB. Escolha uma menor.`;
    }

    return null;
};

const centerSquare = async (blob) => {

    const bitmap = await createImageBitmap(blob);

    const side = Math.min(bitmap.width, bitmap.height);
    const sx = (bitmap.width - side) / 2;
    const sy = (bitmap.height - side) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = SIZE;
    canvas.height = SIZE;

    canvas.getContext("2d").drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);

    bitmap.close?.();

    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (result) => (result ? resolve(result) : reject(new Error("Não foi possível processar a foto."))),
            "image/jpeg",
            0.7
        );
    });
};

/** Converte, recorta e comprime. Devolve um Blob JPEG leve. */
export const prepareProfilePhoto = async (file) => {

    const problem = validateProfilePhoto(file);
    if (problem) throw new Error(problem);

    let blob = file;

    if (isHeic(file)) {
        const heic2any = (await import("heic2any")).default;
        const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
        blob = Array.isArray(converted) ? converted[0] : converted;
    }

    const square = await centerSquare(blob);

    return imageCompression(square, {
        maxSizeMB: 0.06,
        maxWidthOrHeight: SIZE,
        useWebWorker: true,
        fileType: "image/jpeg",
        initialQuality: 0.6
    });
};

/** Sobe para users/{uid}/profileImg (só Storage). */
export const uploadProfilePhoto = async (uid, file) => {

    const blob = await prepareProfilePhoto(file);

    await uploadBytes(ref(getStorage(), `users/${uid}/profileImg`), blob, {
        contentType: "image/jpeg",
        cacheControl: "public,max-age=31536000"
    });
};
