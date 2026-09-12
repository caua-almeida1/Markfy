import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";

import { getDatabase, ref, update } from "firebase/database";

import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "firebase/storage";

import heic2any from "heic2any";

import { useUserCompany } from "../../../../../contexts/companyContext/UserCompanyContext";
import Toast from "../../../../../components/toast/Toast";

const MAX_PHOTOS = 12;

const PHOTO_CATEGORIES = [
    {
        id: "facade",
        name: "Fachada",
        description: "Mostre a fachada e entrada do local."
    },
    {
        id: "interior",
        name: "Interior",
        description: "Mostre o ambiente interno da empresa."
    },
    {
        id: "services",
        name: "Serviços",
        description: "Mostre seus serviços e atendimentos."
    },
    {
        id: "other",
        name: "Outros",
        description: "Adicione outras fotos importantes."
    }
];

const BrandingScreen = () => {

    const { company } = useUserCompany();

    const [logo, setLogo] = useState("");
    const [initialLogo, setInitialLogo] = useState("");

    const [photos, setPhotos] = useState([]);
    const [initialPhotos, setInitialPhotos] = useState([]);

    const [selectedCategory, setSelectedCategory] = useState("facade");

    const filteredPhotos = photos.filter(
        photo => photo.category === selectedCategory
    );

    const [uploadingPhotos, setUploadingPhotos] = useState(false);
    const [removingPhoto, setRemovingPhoto] = useState(null);

    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState("success");
    const [toastTitle, setToastTitle] = useState("");
    const [toastMessage, setToastMessage] = useState("");

    useEffect(() => {

        if (!company) return;

        const currentLogo = company.logoPreview || "";

        setLogo(currentLogo);
        setInitialLogo(currentLogo);

        const currentPhotos = Array.isArray(company.photos)
            ? company.photos
            : company.photos
                ? Object.entries(company.photos).map(([id, photo]) => ({
                    id,
                    ...photo
                }))
                : [];

        setPhotos(currentPhotos);
        setInitialPhotos(currentPhotos);

    }, [company]);

    const openToast = (type, title, message) => {

        setToastType(type);
        setToastTitle(title);
        setToastMessage(message);
        setShowToast(true);

    };

    /*
    ============================================================
    LOGO
    ============================================================
    */

    const handleLogoChange = (e) => {

        const file = e.target.files?.[0];

        if (!file) return;

        if (!file.type.startsWith("image/")) {

            openToast(
                "error",
                "Arquivo inválido",
                "Selecione uma imagem para utilizar como logo."
            );

            return;

        }

        const reader = new FileReader();

        reader.onload = () => {

            setLogo(reader.result);

        };

        reader.readAsDataURL(file);

    };

    /*
    ============================================================
    COMPRESSÃO
    ============================================================
    */

    const convertHeic = async (file) => {

        const extension = file.name
            .split(".")
            .pop()
            ?.toLowerCase();

        const isHeic =
            extension === "heic" ||
            extension === "heif" ||
            file.type === "image/heic" ||
            file.type === "image/heif";

        if (!isHeic) {
            return file;
        }

        const converted = await heic2any({
            blob: file,
            toType: "image/jpeg",
            quality: 0.82
        });

        const blob = Array.isArray(converted)
            ? converted[0]
            : converted;

        const newName = file.name
            .replace(/\.(heic|heif)$/i, "")
            .concat(".jpg");

        return new File(
            [blob],
            newName,
            {
                type: "image/jpeg"
            }
        );

    };

    const compressImage = async (file) => {

        const convertedFile = await convertHeic(file);

        return new Promise((resolve, reject) => {

            const reader = new FileReader();

            reader.onload = () => {

                const img = new Image();

                img.onload = () => {

                    const MAX_WIDTH = 1600;
                    const MAX_HEIGHT = 1600;

                    let width = img.width;
                    let height = img.height;

                    if (
                        width > MAX_WIDTH ||
                        height > MAX_HEIGHT
                    ) {

                        const ratio = Math.min(
                            MAX_WIDTH / width,
                            MAX_HEIGHT / height
                        );

                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);

                    }

                    const canvas =
                        document.createElement("canvas");

                    canvas.width = width;
                    canvas.height = height;

                    const context =
                        canvas.getContext("2d");

                    context.drawImage(
                        img,
                        0,
                        0,
                        width,
                        height
                    );

                    canvas.toBlob(
                        (blob) => {

                            if (!blob) {

                                reject(
                                    new Error(
                                        "Não foi possível comprimir a imagem."
                                    )
                                );

                                return;

                            }

                            const compressedFile =
                                new File(
                                    [
                                        blob
                                    ],
                                    convertedFile.name.replace(
                                        /\.[^/.]+$/,
                                        ".jpg"
                                    ),
                                    {
                                        type: "image/jpeg"
                                    }
                                );

                            resolve(
                                compressedFile
                            );

                        },
                        "image/jpeg",
                        0.78
                    );

                };

                img.onerror = () => {

                    reject(
                        new Error(
                            "Não foi possível processar a imagem."
                        )
                    );

                };

                img.src = reader.result;

            };

            reader.onerror = () => {

                reject(
                    new Error(
                        "Não foi possível ler a imagem."
                    )
                );

            };

            reader.readAsDataURL(convertedFile);

        });

    };

    /*
    ============================================================
    FOTOS
    ============================================================
    */

    const handlePhotosChange = async (e) => {

        const files = Array.from(
            e.target.files || []
        );

        e.target.value = "";

        if (!files.length) return;

        if (!company?.handle) {

            openToast(
                "error",
                "Empresa não encontrada",
                "Não foi possível identificar a empresa."
            );

            return;

        }

        if (
            photos.length + files.length >
            MAX_PHOTOS
        ) {

            openToast(
                "error",
                "Limite de fotos",
                `Você pode adicionar no máximo ${MAX_PHOTOS} fotos.`
            );

            return;

        }

        try {

            setUploadingPhotos(true);

            const storage =
                getStorage();

            const uploadedPhotos = [];

            for (const originalFile of files) {

                if (
                    !originalFile.type.startsWith("image/") &&
                    !/\\.(heic|heif)$/i.test(
                        originalFile.name
                    )
                ) {

                    openToast(
                        "error",
                        "Arquivo inválido",
                        `${originalFile.name} não é uma imagem válida.`
                    );

                    continue;

                }

                const compressedFile =
                    await compressImage(
                        originalFile
                    );

                const photoId =
                    `${Date.now()}-${Math.random()
                        .toString(36)
                        .slice(2, 9)}`;

                const path =
                    `companys/${company.handle}/photos/${photoId}.jpg`;

                const fileRef =
                    storageRef(
                        storage,
                        path
                    );

                await uploadBytes(
                    fileRef,
                    compressedFile,
                    {
                        contentType: "image/jpeg"
                    }
                );

                const downloadURL =
                    await getDownloadURL(
                        fileRef
                    );

                uploadedPhotos.push({
                    id: photoId,
                    url: downloadURL,
                    category: selectedCategory,
                    name: compressedFile.name,
                    path
                });

            }

            if (!uploadedPhotos.length) {
                return;
            }

            const updatedPhotos = [
                ...photos,
                ...uploadedPhotos
            ];

            setPhotos(updatedPhotos);

            const photosObject =
                updatedPhotos.reduce(
                    (acc, photo) => {
                        acc[photo.id] = photo;
                        return acc;
                    },
                    {}
                );

            const db =
                getDatabase();

            await update(
                ref(
                    db,
                    `companys/${company.handle}`
                ),
                {
                    photos: photosObject
                }
            );

            setInitialPhotos(
                JSON.parse(
                    JSON.stringify(
                        updatedPhotos
                    )
                )
            );

            openToast(
                "success",
                "Fotos adicionadas",
                "As fotos do local foram adicionadas com sucesso."
            );

        } catch (error) {

            console.error(
                "Erro ao adicionar fotos:",
                error
            );

            openToast(
                "error",
                "Erro ao adicionar",
                "Não foi possível processar ou salvar as fotos."
            );

        } finally {

            setUploadingPhotos(false);

        }

    };

    /*
    ============================================================
    REMOVER FOTO
    ============================================================
    */

    const handleRemovePhoto = async (photo) => {

        if (
            !company?.handle ||
            !photo?.id
        ) {
            return;
        }

        try {

            setRemovingPhoto(
                photo.id
            );

            if (photo.path) {

                try {

                    const storage =
                        getStorage();

                    const fileRef =
                        storageRef(
                            storage,
                            photo.path
                        );

                    await deleteObject(
                        fileRef
                    );

                } catch (storageError) {

                    console.warn(
                        "Foto não encontrada no Storage:",
                        storageError
                    );

                }

            }

            const updatedPhotos =
                photos.filter(
                    item =>
                        item.id !== photo.id
                );

            setPhotos(
                updatedPhotos
            );

            const photosObject =
                updatedPhotos.reduce(
                    (acc, item) => {

                        acc[item.id] =
                            item;

                        return acc;

                    },
                    {}
                );

            const db =
                getDatabase();

            await update(
                ref(
                    db,
                    `companys/${company.handle}`
                ),
                {
                    photos:
                        Object.keys(photosObject).length
                            ? photosObject
                            : null
                }
            );

            setInitialPhotos(
                JSON.parse(
                    JSON.stringify(
                        updatedPhotos
                    )
                )
            );

            openToast(
                "success",
                "Foto removida",
                "A foto foi removida com sucesso."
            );

        } catch (error) {

            console.error(
                "Erro ao remover foto:",
                error
            );

            openToast(
                "error",
                "Erro ao remover",
                "Não foi possível remover a foto."
            );

        } finally {

            setRemovingPhoto(
                null
            );

        }

    };

    /*
    ============================================================
    SALVAR LOGO
    ============================================================
    */

    const hasLogoChanges =
        logo !== initialLogo;

    const hasPhotoChanges =
        JSON.stringify(photos) !==
        JSON.stringify(initialPhotos);

    const hasChanges =
        hasLogoChanges ||
        hasPhotoChanges;

    const handleSave = async () => {

        if (!company?.handle) {

            openToast(
                "error",
                "Empresa não encontrada",
                "Não foi possível identificar a empresa."
            );

            return;

        }

        if (
            hasLogoChanges &&
            !logo
        ) {

            openToast(
                "error",
                "Logo não encontrada",
                "Selecione uma logo antes de salvar."
            );

            return;

        }

        try {

            const db =
                getDatabase();

            const updates = {};

            if (hasLogoChanges) {

                updates.logoPreview =
                    logo;

            }

            if (
                hasPhotoChanges &&
                photos.length
            ) {

                updates.photos =
                    photos.reduce(
                        (acc, photo) => {

                            acc[photo.id] =
                                photo;

                            return acc;

                        },
                        {}
                    );

            }

            await update(
                ref(
                    db,
                    `companys/${company.handle}`
                ),
                updates
            );

            setInitialLogo(
                logo
            );

            setInitialPhotos(
                JSON.parse(
                    JSON.stringify(
                        photos
                    )
                )
            );

            openToast(
                "success",
                "Sucesso",
                "A identidade visual foi atualizada."
            );

        } catch (error) {

            console.error(
                error
            );

            openToast(
                "error",
                "Erro ao salvar",
                "Não foi possível atualizar a identidade visual."
            );

        }

    };

    return (

        <div className="company-screen">

            {/* ==================================================
                LOGO
            ================================================== */}

            <div className="company-card">

                <div className="branding-input-group">

                    <Icon
                        icon="solar:gallery-add-outline"
                        className="company-input-icon"
                    />

                    <div className="branding-logo-content">

                        <div className="branding-logo-preview">

                            {logo ? (

                                <img
                                    src={logo}
                                    alt="Logo da empresa"
                                    className="branding-logo-image"
                                />

                            ) : (

                                <div className="branding-logo-placeholder">
                                    Untitled
                                </div>

                            )}

                        </div>

                        <div className="branding-logo-details">

                            <span className="branding-logo-title">
                                Logo da empresa
                            </span>

                            <span className="branding-logo-description">
                                Adicione a identidade visual da sua empresa.
                            </span>

                        </div>

                    </div>

                    <label className="branding-logo-button">

                        <Icon
                            icon="solar:upload-outline"
                        />

                        <span>
                            Alterar
                        </span>

                        <input
                            type="file"
                            accept="image/*,.heic,.heif"
                            onChange={handleLogoChange}
                        />

                    </label>

                </div>

            </div>

            {/* ==================================================
                FOTOS DO LOCAL
            ================================================== */}

            <div className="branding-section-header">

                <div>

                    <h3>
                        Fotos do local
                    </h3>

                    <p>
                        Mostre aos clientes sua empresa, ambiente e serviços.
                    </p>

                </div>

                <span className="branding-photo-count">
                    {photos.length}/{MAX_PHOTOS}
                </span>

            </div>

            <div className="company-card branding-photos-card">

                <div className="branding-photo-category">

                    <div className="branding-photo-category-label">

                        <Icon
                            icon="solar:tag-outline"
                        />

                        <span>
                            Categoria
                        </span>

                    </div>

                    <div className="branding-category-list">

                        {PHOTO_CATEGORIES.map(
                            category => (

                                <button
                                    key={category.id}
                                    type="button"
                                    className={`branding-category-button ${selectedCategory === category.id
                                        ? "active"
                                        : ""
                                        }`}
                                    onClick={() =>
                                        setSelectedCategory(
                                            category.id
                                        )
                                    }
                                >

                                    {category.name}

                                </button>

                            )
                        )}

                    </div>

                </div>

                {filteredPhotos.length > 0 && (

                    <div className="branding-photos-grid">

                        {filteredPhotos.map(
                            photo => {

                                const category =
                                    PHOTO_CATEGORIES.find(
                                        item =>
                                            item.id ===
                                            photo.category
                                    );

                                return (

                                    <div
                                        key={photo.id}
                                        className="branding-photo-item"
                                    >

                                        <img
                                            src={photo.url}
                                            alt={
                                                category?.name ||
                                                "Foto do local"
                                            }
                                        />

                                        <div className="branding-photo-overlay">

                                            <span>
                                                {category?.name || "Foto"}
                                            </span>

                                            <button
                                                type="button"
                                                disabled={
                                                    removingPhoto ===
                                                    photo.id
                                                }
                                                onClick={() =>
                                                    handleRemovePhoto(
                                                        photo
                                                    )
                                                }
                                            >

                                                <Icon
                                                    icon={
                                                        removingPhoto ===
                                                            photo.id
                                                            ? "svg-spinners:ring-resize"
                                                            : "solar:trash-bin-trash-outline"
                                                    }
                                                />

                                            </button>

                                        </div>

                                    </div>

                                );

                            }
                        )}

                    </div>

                )}

                {photos.length <
                    MAX_PHOTOS && (

                        <label
                            className={`branding-photo-upload ${uploadingPhotos
                                ? "loading"
                                : ""
                                }`}
                        >

                            <Icon
                                icon={
                                    uploadingPhotos
                                        ? "svg-spinners:ring-resize"
                                        : "solar:gallery-add-outline"
                                }
                            />

                            <div>

                                <strong>
                                    {uploadingPhotos
                                        ? "Processando fotos..."
                                        : "Adicionar fotos"}
                                </strong>

                                <span>
                                    JPG, PNG, WEBP ou HEIC
                                </span>

                            </div>

                            {!uploadingPhotos && (

                                <input
                                    type="file"
                                    multiple
                                    accept="image/*,.heic,.heif"
                                    onChange={
                                        handlePhotosChange
                                    }
                                />

                            )}

                        </label>

                    )}

                <div className="branding-photo-info">

                    <Icon
                        icon="solar:info-circle-outline"
                    />

                    <span>
                        As imagens são redimensionadas e comprimidas
                        automaticamente antes de serem enviadas.
                    </span>

                </div>

            </div>

            <button
                disabled={!hasChanges}
                onClick={handleSave}
                className={`company-save ${!hasChanges
                    ? "disabled"
                    : ""
                    }`}
            >
                Salvar alterações
            </button>

            <Toast
                show={showToast}
                type={toastType}
                title={toastTitle}
                message={toastMessage}
                onClose={() =>
                    setShowToast(false)
                }
            />

        </div>

    );

};

export default BrandingScreen;