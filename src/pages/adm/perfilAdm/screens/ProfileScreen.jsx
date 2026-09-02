import { useEffect, useRef, useState } from "react";
import { Icon } from "@iconify/react";

import {
    getAuth,
    onAuthStateChanged,
    updateProfile,
    EmailAuthProvider,
    reauthenticateWithCredential,
    updatePassword,
} from "firebase/auth";

import {
    getDatabase,
    get,
    ref,
    update,
} from "firebase/database";

import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL,
} from "firebase/storage";

import Toast from "../../../../components/toast/Toast";
import "./profileScreen.css";

const ProfileScreen = () => {

    const auth = getAuth();
    const db = getDatabase();
    const storage = getStorage();

    const fileInputRef = useRef(null);

    const [user, setUser] = useState(null);

    const [name, setName] = useState("");
    const [initialName, setInitialName] = useState("");

    const [photoPreview, setPhotoPreview] = useState("");
    const [photoFile, setPhotoFile] = useState(null);

    const [loadingProfile, setLoadingProfile] = useState(true);
    const [loadingPhoto, setLoadingPhoto] = useState(true);

    const [saving, setSaving] = useState(false);

    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState("success");
    const [toastTitle, setToastTitle] = useState("");
    const [toastMessage, setToastMessage] = useState("");

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);


    /*
     * ==========================================
     * TOAST
     * ==========================================
     */

    const openToast = (
        type,
        title,
        message,
    ) => {

        setToastType(type);
        setToastTitle(title);
        setToastMessage(message);
        setShowToast(true);

    };


    /*
     * ==========================================
     * CARREGAR PERFIL
     * ==========================================
     */

    useEffect(() => {

        const unsubscribe = onAuthStateChanged(
            auth,
            async (currentUser) => {

                setLoadingProfile(true);
                setLoadingPhoto(true);

                if (!currentUser) {

                    setUser(null);

                    setLoadingProfile(false);
                    setLoadingPhoto(false);

                    return;

                }

                setUser(currentUser);

                try {

                    /*
                     * ==============================
                     * DADOS DO USUÁRIO
                     * ==============================
                     */

                    const userSnapshot = await get(
                        ref(
                            db,
                            `users/${currentUser.uid}`,
                        ),
                    );

                    const userData =
                        userSnapshot.exists()
                            ? userSnapshot.val()
                            : {};

                    const currentName =
                        userData.name ||
                        currentUser.displayName ||
                        "";

                    setName(currentName);
                    setInitialName(currentName);


                    /*
                     * ==============================
                     * FOTO
                     * ==============================
                     */

                    const profileImageRef =
                        storageRef(
                            storage,
                            `users/${currentUser.uid}/profileImg`,
                        );

                    try {

                        const photoUrl =
                            await getDownloadURL(
                                profileImageRef,
                            );

                        setPhotoPreview(photoUrl);

                    } catch (photoError) {

                        if (
                            photoError.code ===
                            "storage/object-not-found"
                        ) {

                            setPhotoPreview("");

                        } else {

                            console.error(
                                "Erro ao carregar foto:",
                                photoError,
                            );

                            setPhotoPreview(
                                currentUser.photoURL || "",
                            );

                        }

                    } finally {

                        setLoadingPhoto(false);

                    }

                } catch (error) {

                    console.error(
                        "Erro ao carregar perfil:",
                        error,
                    );

                    const currentName =
                        currentUser.displayName || "";

                    setName(currentName);
                    setInitialName(currentName);

                    setPhotoPreview(
                        currentUser.photoURL || "",
                    );

                    setLoadingPhoto(false);

                } finally {

                    setLoadingProfile(false);

                }

            },
        );

        return () => unsubscribe();

    }, [auth, db, storage]);


    /*
     * ==========================================
     * SELECIONAR FOTO
     * ==========================================
     */

    const handlePhotoChange = (event) => {

        const file =
            event.target.files?.[0];

        if (!file) {
            return;
        }

        if (!file.type.startsWith("image/")) {

            openToast(
                "error",
                "Arquivo inválido",
                "Selecione uma imagem válida.",
            );

            return;

        }

        if (file.size > 10 * 1024 * 1024) {

            openToast(
                "error",
                "Imagem muito grande",
                "A imagem deve ter no máximo 10 MB.",
            );

            return;

        }

        setPhotoFile(file);

        /*
         * Preview imediato.
         */

        const previewUrl =
            URL.createObjectURL(file);

        setPhotoPreview(previewUrl);

    };


    /*
     * ==========================================
     * COMPRESSÃO DA IMAGEM
     * ==========================================
     */

    const compressImage = (
        file,
        maxWidth = 800,
        maxHeight = 800,
        quality = 0.75,
    ) => {

        return new Promise((resolve, reject) => {

            const image = new Image();
            const reader = new FileReader();

            reader.onload = (event) => {

                image.src =
                    event.target.result;

            };

            reader.onerror = () => {

                reject(
                    new Error(
                        "Não foi possível ler a imagem.",
                    ),
                );

            };

            image.onload = () => {

                let width = image.width;
                let height = image.height;

                const ratio = Math.min(
                    maxWidth / width,
                    maxHeight / height,
                    1,
                );

                width = Math.round(
                    width * ratio,
                );

                height = Math.round(
                    height * ratio,
                );

                const canvas =
                    document.createElement("canvas");

                canvas.width = width;
                canvas.height = height;

                const context =
                    canvas.getContext("2d");

                if (!context) {

                    reject(
                        new Error(
                            "Não foi possível processar a imagem.",
                        ),
                    );

                    return;

                }

                context.drawImage(
                    image,
                    0,
                    0,
                    width,
                    height,
                );

                canvas.toBlob(
                    (blob) => {

                        if (!blob) {

                            reject(
                                new Error(
                                    "Não foi possível comprimir a imagem.",
                                ),
                            );

                            return;

                        }

                        resolve(blob);

                    },
                    "image/jpeg",
                    quality,
                );

            };

            image.onerror = () => {

                reject(
                    new Error(
                        "Não foi possível carregar a imagem.",
                    ),
                );

            };

            reader.readAsDataURL(file);

        });

    };


    /*
     * ==========================================
     * INICIAL DO USUÁRIO
     * ==========================================
     */

    const getInitial = () => {

        return (
            name?.trim()?.charAt(0) ||
            user?.email?.trim()?.charAt(0) ||
            "U"
        ).toUpperCase();

    };


    /*
     * ==========================================
     * ALTERAÇÕES
     * ==========================================
     */
    const hasPasswordChanges =
        !!currentPassword ||
        !!newPassword ||
        !!confirmPassword;

    const hasChanges =
        name !== initialName ||
        !!photoFile ||
        hasPasswordChanges;

    /*
* ==========================================
* ALTERAR SENHA
* ==========================================
*/

    /*
     * ==========================================
     * SALVAR
     * ==========================================
     */

    /*
  * ==========================================
  * SALVAR
  * ==========================================
  */

    const handleSave = async () => {

        if (!user) {
            return;
        }

        if (!name.trim()) {

            openToast(
                "error",
                "Nome obrigatório",
                "Informe seu nome.",
            );

            return;
        }

        const hasPasswordChanges =
            !!currentPassword ||
            !!newPassword ||
            !!confirmPassword;

        /*
         * ==========================================
         * VALIDAR SENHA
         * ==========================================
         */

        if (hasPasswordChanges) {

            if (!currentPassword) {

                openToast(
                    "error",
                    "Senha atual obrigatória",
                    "Informe sua senha atual para alterar a senha.",
                );

                return;
            }

            if (!newPassword) {

                openToast(
                    "error",
                    "Nova senha obrigatória",
                    "Informe a nova senha.",
                );

                return;
            }

            if (!confirmPassword) {

                openToast(
                    "error",
                    "Confirmação obrigatória",
                    "Confirme sua nova senha.",
                );

                return;
            }

            if (newPassword.length < 8) {

                openToast(
                    "error",
                    "Senha muito curta",
                    "A nova senha deve possuir pelo menos 8 caracteres.",
                );

                return;
            }

            if (!/[A-Z]/.test(newPassword)) {

                openToast(
                    "error",
                    "Senha inválida",
                    "A nova senha deve possuir pelo menos uma letra maiúscula.",
                );

                return;
            }

            if (!/[a-z]/.test(newPassword)) {

                openToast(
                    "error",
                    "Senha inválida",
                    "A nova senha deve possuir pelo menos uma letra minúscula.",
                );

                return;
            }

            if (!/[0-9]/.test(newPassword)) {

                openToast(
                    "error",
                    "Senha inválida",
                    "A nova senha deve possuir pelo menos um número.",
                );

                return;
            }

            if (newPassword === currentPassword) {

                openToast(
                    "error",
                    "Senha inválida",
                    "A nova senha deve ser diferente da senha atual.",
                );

                return;
            }

            if (newPassword !== confirmPassword) {

                openToast(
                    "error",
                    "Senhas não coincidem",
                    "A confirmação da nova senha não corresponde à nova senha.",
                );

                return;
            }

        }


        try {

            setSaving(true);

            const cleanName =
                name.trim();

            let photoUrl =
                user.photoURL || "";


            /*
             * ==========================================
             * ALTERAR SENHA
             * ==========================================
             */

            if (hasPasswordChanges) {

                if (!user.email) {

                    openToast(
                        "error",
                        "Não foi possível alterar",
                        "Sua conta não possui um e-mail associado.",
                    );

                    return;
                }

                const credential =
                    EmailAuthProvider.credential(
                        user.email,
                        currentPassword,
                    );

                /*
                 * Reautenticar primeiro.
                 * Se a senha atual estiver errada,
                 * o erro será capturado abaixo.
                 */

                await reauthenticateWithCredential(
                    user,
                    credential,
                );

                /*
                 * Só altera a senha depois
                 * da autenticação ser confirmada.
                 */

                await updatePassword(
                    user,
                    newPassword,
                );

            }


            /*
             * ==========================================
             * UPLOAD DA FOTO
             * ==========================================
             */

            if (photoFile) {

                const profileImageRef =
                    storageRef(
                        storage,
                        `users/${user.uid}/profileImg`,
                    );

                const compressedImage =
                    await compressImage(
                        photoFile,
                    );

                await uploadBytes(
                    profileImageRef,
                    compressedImage,
                    {
                        contentType:
                            "image/jpeg",

                        cacheControl:
                            "public,max-age=31536000",
                    },
                );

                photoUrl =
                    await getDownloadURL(
                        profileImageRef,
                    );

            }


            /*
             * ==========================================
             * FIREBASE AUTHENTICATION
             * ==========================================
             */

            await updateProfile(
                user,
                {
                    displayName: cleanName,
                    photoURL: photoUrl,
                },
            );


            /*
             * ==========================================
             * REALTIME DATABASE
             * ==========================================
             */

            await update(
                ref(
                    db,
                    `users/${user.uid}`,
                ),
                {
                    name: cleanName,
                },
            );


            /*
             * ==========================================
             * ATUALIZAR ESTADO
             * ==========================================
             */

            setName(cleanName);
            setInitialName(cleanName);

            setPhotoFile(null);
            setPhotoPreview(photoUrl);

            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");


            /*
             * ==========================================
             * SUCESSO
             * ==========================================
             */

            openToast(
                "success",
                "Alterações salvas",
                hasPasswordChanges
                    ? "Seu perfil e sua senha foram atualizados com sucesso."
                    : "Seu perfil foi atualizado com sucesso.",
            );

        } catch (error) {

            console.error(
                "Erro ao salvar alterações:",
                error,
            );


            /*
             * ==========================================
             * ERROS DO FIREBASE
             * ==========================================
             */

            switch (error.code) {

                case "auth/invalid-credential":

                case "auth/wrong-password":

                    openToast(
                        "error",
                        "Senha atual incorreta",
                        "A senha atual informada não está correta.",
                    );

                    break;


                case "auth/too-many-requests":

                    openToast(
                        "error",
                        "Muitas tentativas",
                        "Por segurança, aguarde alguns minutos antes de tentar novamente.",
                    );

                    break;


                case "auth/requires-recent-login":

                    openToast(
                        "error",
                        "Verificação necessária",
                        "Por segurança, faça login novamente antes de alterar sua senha.",
                    );

                    break;


                case "auth/weak-password":

                    openToast(
                        "error",
                        "Senha fraca",
                        "A nova senha não atende aos requisitos de segurança.",
                    );

                    break;


                default:

                    openToast(
                        "error",
                        "Não foi possível salvar",
                        "Ocorreu um erro ao salvar as alterações. Tente novamente.",
                    );

                    break;

            }

        } finally {

            setSaving(false);

        }

    };


    /*
     * ==========================================
     * RENDER
     * ==========================================
     */

    return (

        <div className="company-screen profile-screen">

            {/* ================= FOTO ================= */}

            <div className="company-card profile-card">

                <div className="profile-photo-section">

                    <div className="profile-photo-wrapper">

                        {loadingPhoto ? (

                            <div
                                className="
                                    profile-photo
                                    profile-photo-skeleton
                                "
                            />

                        ) : photoPreview ? (

                            <img
                                src={photoPreview}
                                alt="Foto do perfil"
                                className="profile-photo"
                            />

                        ) : (

                            <div
                                className="
                                    profile-photo
                                    profile-photo-placeholder
                                "
                            >
                                {getInitial()}
                            </div>

                        )}

                        <button
                            type="button"
                            className="profile-photo-edit"
                            onClick={() =>
                                fileInputRef.current?.click()
                            }
                        >

                            <Icon
                                icon="solar:camera-outline"
                            />

                        </button>

                    </div>


                    <button
                        type="button"
                        className="profile-photo-button"
                        onClick={() =>
                            fileInputRef.current?.click()
                        }
                    >
                        Alterar foto
                    </button>


                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoChange}
                        hidden
                    />

                </div>

            </div>


            {/* ================= NOME ================= */}

            <div className="company-card">

                {loadingProfile ? (

                    <div className="profile-fields-skeleton">

                        <div className="profile-field-skeleton" />

                    </div>

                ) : (

                    <div className="company-input-group">

                        <Icon
                            icon="solar:user-outline"
                            className="company-input-icon"
                        />

                        <input
                            className="company-input"
                            type="text"
                            placeholder="Nome"
                            value={name}
                            onChange={(event) =>
                                setName(
                                    event.target.value,
                                )
                            }
                        />

                    </div>

                )}

            </div>

            {/* ================= SENHA ================= */}

            <div className="company-card profile-password-card">

                <div className="profile-password-fields">

                    {/* SENHA ATUAL */}

                    <div className="company-input-group">

                        <Icon
                            icon="solar:lock-outline"
                            className="company-input-icon"
                        />

                        <input
                            className="company-input"
                            type={showCurrentPassword ? "text" : "password"}
                            placeholder="Senha atual"
                            value={currentPassword}
                            onChange={(event) =>
                                setCurrentPassword(event.target.value)
                            }
                            autoComplete="current-password"
                        />

                        <button
                            type="button"
                            className="profile-password-toggle"
                            onClick={() =>
                                setShowCurrentPassword((value) => !value)
                            }
                            aria-label={
                                showCurrentPassword
                                    ? "Ocultar senha"
                                    : "Mostrar senha"
                            }
                        >
                            <Icon
                                icon={
                                    showCurrentPassword
                                        ? "solar:eye-closed-outline"
                                        : "solar:eye-outline"
                                }
                            />
                        </button>

                    </div>


                    {/* NOVA SENHA */}

                    <div className="company-input-group">

                        <Icon
                            icon="solar:lock-password-outline"
                            className="company-input-icon"
                        />

                        <input
                            className="company-input"
                            type={showNewPassword ? "text" : "password"}
                            placeholder="Nova senha"
                            value={newPassword}
                            onChange={(event) =>
                                setNewPassword(event.target.value)
                            }
                            autoComplete="new-password"
                        />

                        <button
                            type="button"
                            className="profile-password-toggle"
                            onClick={() =>
                                setShowNewPassword((value) => !value)
                            }
                            aria-label={
                                showNewPassword
                                    ? "Ocultar senha"
                                    : "Mostrar senha"
                            }
                        >
                            <Icon
                                icon={
                                    showNewPassword
                                        ? "solar:eye-closed-outline"
                                        : "solar:eye-outline"
                                }
                            />
                        </button>

                    </div>

                    <div className="company-input-group">

                        <Icon
                            icon="solar:shield-check-outline"
                            className="company-input-icon"
                        />

                        <input
                            className="company-input"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="Confirmar nova senha"
                            value={confirmPassword}
                            onChange={(event) =>
                                setConfirmPassword(event.target.value)
                            }
                            autoComplete="new-password"
                        />

                        <button
                            type="button"
                            className="profile-password-toggle"
                            onClick={() =>
                                setShowConfirmPassword((value) => !value)
                            }
                            aria-label={
                                showConfirmPassword
                                    ? "Ocultar senha"
                                    : "Mostrar senha"
                            }
                        >
                            <Icon
                                icon={
                                    showConfirmPassword
                                        ? "solar:eye-closed-outline"
                                        : "solar:eye-outline"
                                }
                            />
                        </button>

                    </div>


                    {/* REQUISITOS */}

                    <div className="profile-password-requirements">

                        <span>
                            A senha deve possuir:
                        </span>

                        <div className="profile-password-requirements-list">

                            <span className={
                                newPassword.length >= 8
                                    ? "valid"
                                    : ""
                            }>
                                <Icon icon={
                                    newPassword.length >= 8
                                        ? "solar:check-circle-outline"
                                        : "solar:circle-outline"
                                } />
                                8 caracteres
                            </span>

                            <span className={
                                /[A-Z]/.test(newPassword)
                                    ? "valid"
                                    : ""
                            }>
                                <Icon icon={
                                    /[A-Z]/.test(newPassword)
                                        ? "solar:check-circle-outline"
                                        : "solar:circle-outline"
                                } />
                                Uma letra maiúscula
                            </span>

                            <span className={
                                /[a-z]/.test(newPassword)
                                    ? "valid"
                                    : ""
                            }>
                                <Icon icon={
                                    /[a-z]/.test(newPassword)
                                        ? "solar:check-circle-outline"
                                        : "solar:circle-outline"
                                } />
                                Uma letra minúscula
                            </span>

                            <span className={
                                /[0-9]/.test(newPassword)
                                    ? "valid"
                                    : ""
                            }>
                                <Icon icon={
                                    /[0-9]/.test(newPassword)
                                        ? "solar:check-circle-outline"
                                        : "solar:circle-outline"
                                } />
                                Um número
                            </span>

                        </div>

                    </div>

                </div>

            </div>

            {/* ================= SALVAR ================= */}

            <button
                type="button"
                disabled={!hasChanges || saving}
                onClick={handleSave}
                className={`company-save ${!hasChanges || saving
                    ? "disabled"
                    : ""
                    }`}
            >

                {saving
                    ? "Salvando..."
                    : "Salvar alterações"}

            </button>


            {/* ================= TOAST ================= */}

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

export default ProfileScreen;