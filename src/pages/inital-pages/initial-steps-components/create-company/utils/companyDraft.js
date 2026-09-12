const IMAGE_DB_NAME = 'markfy_company_drafts';
const IMAGE_STORE_NAME = 'images';

const openImageDB = () => {
    return new Promise((resolve, reject) => {

        const request = indexedDB.open(
            IMAGE_DB_NAME,
            1
        );

        request.onupgradeneeded = () => {

            const db = request.result;

            if (!db.objectStoreNames.contains(IMAGE_STORE_NAME)) {

                db.createObjectStore(
                    IMAGE_STORE_NAME
                );

            }

        };

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };

    });
};


export const saveDraftImage = async (
    draftKey,
    dataUrl
) => {

    if (!dataUrl) {
        return;
    }

    const db = await openImageDB();

    return new Promise((resolve, reject) => {

        const transaction =
            db.transaction(
                IMAGE_STORE_NAME,
                'readwrite'
            );

        const store =
            transaction.objectStore(
                IMAGE_STORE_NAME
            );

        store.put(
            dataUrl,
            draftKey
        );

        transaction.oncomplete = () => {

            db.close();

            resolve();

        };

        transaction.onerror = () => {

            db.close();

            reject(transaction.error);

        };

    });

};


export const getDraftImage = async (
    draftKey
) => {

    const db = await openImageDB();

    return new Promise((resolve, reject) => {

        const transaction =
            db.transaction(
                IMAGE_STORE_NAME,
                'readonly'
            );

        const store =
            transaction.objectStore(
                IMAGE_STORE_NAME
            );

        const request =
            store.get(draftKey);

        request.onsuccess = () => {

            db.close();

            resolve(
                request.result || null
            );

        };

        request.onerror = () => {

            db.close();

            reject(request.error);

        };

    });

};


export const removeDraftImage = async (
    draftKey
) => {

    const db = await openImageDB();

    return new Promise((resolve, reject) => {

        const transaction =
            db.transaction(
                IMAGE_STORE_NAME,
                'readwrite'
            );

        const store =
            transaction.objectStore(
                IMAGE_STORE_NAME
            );

        store.delete(draftKey);

        transaction.oncomplete = () => {

            db.close();

            resolve();

        };

        transaction.onerror = () => {

            db.close();

            reject(transaction.error);

        };

    });

};