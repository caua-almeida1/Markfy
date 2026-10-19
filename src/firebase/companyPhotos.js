import { useEffect, useState } from "react";
import { getDatabase, ref as dbRef, get } from "firebase/database";
import { getStorage, ref as storageRef, listAll, getDownloadURL } from "firebase/storage";

/* =========================================================
   FOTOS DA EMPRESA

   Mesma regra do CompanyInfoModal: quem manda é o Storage
   (companys/{handle}/photos/), porque a URL copiada no banco
   envelhece. O banco só entra como queda se a listagem
   falhar.

   Cache por handle: o feed da central do usuário e o Studio
   pedem as mesmas fotos várias vezes.
========================================================= */

const cache = new Map();

const fromDatabase = async (handle) => {
    try {
        const snapshot = await get(dbRef(getDatabase(), `companys/${handle}/photos`));
        const value = snapshot.val();
        const list = Array.isArray(value) ? value : Object.values(value || {});
        return list.filter((photo) => photo?.url).map((photo) => photo.url);
    } catch {
        return [];
    }
};

export const loadCompanyPhotos = (handle) => {
    if (!handle) return Promise.resolve([]);

    if (!cache.has(handle)) {
        const task = (async () => {
            try {
                const { items } = await listAll(storageRef(getStorage(), `companys/${handle}/photos`));

                const urls = await Promise.all(
                    items.map((item) => getDownloadURL(item).catch(() => null))
                );

                const list = urls.filter(Boolean);

                return list.length ? list : fromDatabase(handle);
            } catch {
                return fromDatabase(handle);
            }
        })();

        cache.set(handle, task);
    }

    return cache.get(handle);
};

/* `enabled` deixa a lista carregar só quando o card chega
   perto da tela (feed). */
export const useCompanyPhotos = (handle, enabled = true) => {
    const [photos, setPhotos] = useState(null);

    useEffect(() => {
        if (!handle || !enabled) return undefined;

        let cancelled = false;

        loadCompanyPhotos(handle).then((list) => {
            if (!cancelled) setPhotos(list);
        });

        return () => {
            cancelled = true;
        };
    }, [handle, enabled]);

    return photos;
};
