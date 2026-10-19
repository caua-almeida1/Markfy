import React, { useEffect, useState } from "react";

import {
    getAuth,
    sendPasswordResetEmail,
    signOut,
    updateProfile
} from "firebase/auth";

import {
    getDatabase,
    ref,
    update
} from "firebase/database";

import {
    getDownloadURL,
    getStorage,
    ref as storageRef,
    uploadBytes
} from "firebase/storage";

import { useCompanyLogo } from "../../../../firebase/companyLogo";

import { Icon } from "@iconify/react";

import {
    useNavigate,
    useParams
} from "react-router-dom";

import { useConsent } from "../../../../contexts/consentContext/ConsentContext";
import { useTheme } from "../../../../theme/ThemeContext";

import Modal from "../../../../components/modal/Modal";
import Toast from "../../../../components/toast/Toast";

import QrLoginCard from "../../../../qr/QrLoginCard";
import { useProfileData } from "./useProfileData";

import "./Profile.css";


/* =========================================================
   PERFIL DO CLIENTE

   Quatro blocos, nesta ordem, porque é a ordem em que a
   pessoa precisa deles:

     1. quem ela é           — e o que ainda falta confirmar
     2. a empresa dela       — atalho para a central
     3. os agendamentos      — resumo + atalho para a aba
     4. preferências e saída

   O "Meus agendamentos" aqui é resumo, não lista: a lista
   já existe na aba Reservas, e duplicá-la seria manter duas
   telas com a mesma regra de cancelamento.
   ========================================================= */

const Profile = () => {

    const { handle } = useParams();

    const navigate = useNavigate();

    const { openPreferences } = useConsent();

    const { isDark, toggleTheme } = useTheme();

    const {
        user,
        profile,
        membership,
        bookings,
        loading
    } = useProfileData(handle);


    /* ---------------------------------------------------
       EDIÇÃO DO NOME
    --------------------------------------------------- */

    const [editingName, setEditingName] = useState(false);
    const [nameDraft, setNameDraft] = useState("");
    const [saving, setSaving] = useState(false);

    const [confirmingLogout, setConfirmingLogout] =
        useState(false);

    const [showQr, setShowQr] = useState(false);

    const [toast, setToast] = useState(null);


    const displayName =
        profile?.name ||
        user?.displayName ||
        "";

    const displayEmail =
        user?.email ||
        profile?.email ||
        "";

    const displayPhone =
        user?.phoneNumber ||
        profile?.phone ||
        "";

    const photo =
        profile?.profileImg ||
        user?.photoURL ||
        "";


    /*
     * A inicial de quem não tem foto.
     *
     * Um ícone genérico de "usuário" é igual para todo mundo
     * — não diz de quem é a conta. A letra do nome diz, e é
     * o que qualquer app faz nesse lugar.
     */
    const inicial =
        (displayName || displayEmail || displayPhone || "?")
            .trim()
            .charAt(0)
            .toUpperCase();


    /* A logo real da empresa, e não um ícone de loja igual
       para todas. */
    const companyLogo =
        useCompanyLogo(membership?.handle);


    /* ---------------------------------------------------
       TROCAR A FOTO
    --------------------------------------------------- */

    const [uploadingPhoto, setUploadingPhoto] =
        useState(false);


    const trocarFoto = async (event) => {

        const arquivo = event.target.files?.[0];

        /* Limpa o input para a mesma foto poder ser escolhida
           de novo depois de um erro. */
        event.target.value = "";

        if (!arquivo || !user) {
            return;
        }

        if (!arquivo.type.startsWith("image/")) {

            notify(
                "error",
                "Arquivo inválido",
                "Escolha uma imagem."
            );

            return;

        }

        /* 5 MB. Acima disso o upload demora o suficiente para
           a pessoa achar que travou. */
        if (arquivo.size > 5 * 1024 * 1024) {

            notify(
                "error",
                "Imagem muito grande",
                "Escolha uma imagem de até 5 MB."
            );

            return;

        }

        setUploadingPhoto(true);

        try {

            const destino = storageRef(
                getStorage(),
                `users/${user.uid}/profileImg`
            );

            await uploadBytes(destino, arquivo, {
                contentType: arquivo.type
            });

            const url = await getDownloadURL(destino);

            await update(
                ref(getDatabase(), `users/${user.uid}`),
                { profileImg: url }
            );

            await updateProfile(user, { photoURL: url });

            notify(
                "success",
                "Foto atualizada",
                "É assim que você aparece agora."
            );

        } catch (error) {

            console.error("Erro ao enviar a foto:", error);

            notify(
                "error",
                "Não deu para enviar",
                "Tente de novo em instantes."
            );

        } finally {

            setUploadingPhoto(false);

        }

    };


    useEffect(() => {

        setNameDraft(displayName);

    }, [displayName]);


    const notify = (type, title, message) =>
        setToast({ type, title, message });


    const saveName = async () => {

        const value = nameDraft.trim();

        if (!value || !user) {
            return;
        }

        setSaving(true);

        try {

            await update(
                ref(getDatabase(), `users/${user.uid}`),
                { name: value }
            );

            await updateProfile(
                user,
                { displayName: value }
            );

            setEditingName(false);

            notify(
                "success",
                "Nome atualizado",
                "É assim que a empresa vai te identificar."
            );

        } catch (error) {

            console.error("Erro ao salvar o nome:", error);

            notify(
                "error",
                "Não deu para salvar",
                "Tente de novo em instantes."
            );

        } finally {

            setSaving(false);

        }

    };


    const resetPassword = async () => {

        if (!displayEmail) {
            return;
        }

        try {

            await sendPasswordResetEmail(
                getAuth(),
                displayEmail
            );

            notify(
                "success",
                "E-mail enviado",
                `Enviamos o link de troca de senha para ${displayEmail}.`
            );

        } catch (error) {

            console.error("Erro ao enviar o e-mail:", error);

            notify(
                "error",
                "Não deu para enviar",
                "Tente de novo em instantes."
            );

        }

    };


    const logout = async () => {

        try {

            localStorage.removeItem("authUser");

            await signOut(getAuth());

            navigate("/login");

        } catch (error) {

            console.error("Erro ao sair:", error);

        }

    };


    const goToTab = (tab) => {

        const params = new URLSearchParams(
            window.location.search
        );

        params.set("tab", tab);
        params.delete("product");

        navigate(
            `${window.location.pathname}?${params.toString()}`
        );

    };


    /* ---------------------------------------------------
       CARREGANDO
    --------------------------------------------------- */

    if (loading) {

        return (
            <div className="profile-loading">
                <Icon icon="svg-spinners:ring-resize" />
                <span>Carregando seu perfil...</span>
            </div>
        );

    }


    /* ---------------------------------------------------
       VISITANTE
    --------------------------------------------------- */

    if (!user) {

        return (
            <div className="profile-guest">

                <div className="profile-guest-icon">
                    <Icon icon="solar:user-circle-outline" />
                </div>

                <h2>Entre na sua conta</h2>

                <p>
                    Com uma conta você acompanha seus agendamentos,
                    guarda seus dados para os próximos e recebe os
                    comprovantes de pagamento.
                </p>

                <button
                    type="button"
                    className="profile-button profile-button--primary"
                    onClick={() => navigate("/login")}
                >
                    Entrar
                </button>

            </div>
        );

    }


    /* ---------------------------------------------------
       O QUE FALTA CONFIRMAR

       Conta de telefone não tem e-mail, conta de e-mail não
       tem telefone. Em vez de fingir que está tudo certo, a
       tela diz o que falta e por que aquilo importa.
    --------------------------------------------------- */

    const pendencias = [

        !displayName && {
            id: "nome",
            icon: "solar:user-outline",
            label: "Adicione seu nome",
            hint: "É por ele que a empresa te identifica na agenda.",
            action: () => setEditingName(true)
        },

        !displayEmail && {
            id: "email",
            icon: "solar:letter-outline",
            label: "Adicione um e-mail",
            hint: "É para onde vão os comprovantes de pagamento.",
            action: () => navigate("/login")
        }

    ].filter(Boolean);


    return (
        <div className="profile">

            {/* =============================================
                QUEM É
            ============================================= */}

            <header className="profile-header">

                <label className="profile-avatar">

                    {photo ? (
                        <img src={photo} alt={displayName || "Você"} />
                    ) : (
                        <span className="profile-avatar-initial">
                            {inicial}
                        </span>
                    )}

                    {/* O input fica escondido atrás do rótulo:
                        a área toda do avatar vira o alvo, que é
                        maior e mais óbvio que um ícone solto. */}
                    <input
                        type="file"
                        accept="image/*"
                        onChange={trocarFoto}
                        disabled={uploadingPhoto}
                    />

                    <span className="profile-avatar-edit">
                        <Icon
                            icon={
                                uploadingPhoto
                                    ? "svg-spinners:ring-resize"
                                    : "solar:camera-outline"
                            }
                        />
                    </span>

                </label>

                <div className="profile-identity">

                    <h1>
                        {displayName || "Sem nome"}
                    </h1>

                    {displayEmail && (
                        <span>
                            <Icon icon="solar:letter-outline" />
                            {displayEmail}
                        </span>
                    )}

                    {displayPhone && (
                        <span>
                            <Icon icon="solar:phone-outline" />
                            {displayPhone}
                        </span>
                    )}

                </div>

            </header>


            {pendencias.length > 0 && (

                <section className="profile-pending">

                    {pendencias.map((item) => (

                        <button
                            key={item.id}
                            type="button"
                            className="profile-pending-item"
                            onClick={item.action}
                        >

                            <Icon icon={item.icon} />

                            <span>
                                <strong>{item.label}</strong>
                                <small>{item.hint}</small>
                            </span>

                            <Icon icon="solar:alt-arrow-right-outline" />

                        </button>

                    ))}

                </section>

            )}


            {/* =============================================
                EMPRESA

                Só para quem realmente administra uma: o
                cargo é relido da empresa a cada carregamento,
                então quem sai da equipe perde o botão.
            ============================================= */}

            {membership && (

                <section className="profile-section profile-company">

                    <div className="profile-company-main">

                        <div className="profile-company-icon">

                            {companyLogo ? (
                                <img
                                    src={companyLogo}
                                    alt={membership.companyName}
                                />
                            ) : (
                                <Icon icon="solar:shop-2-outline" />
                            )}

                        </div>

                        <div>

                            <span className="profile-section-eyebrow">
                                {membership.roleLabel}
                            </span>

                            <strong>
                                {membership.companyName}
                            </strong>

                        </div>

                    </div>

                    <button
                        type="button"
                        className="profile-button profile-button--primary"
                        onClick={() => navigate("/central-adm")}
                    >
                        <Icon icon="solar:widget-5-outline" />
                        Gerenciar minha empresa
                    </button>

                </section>

            )}


            {/* =============================================
                AGENDAMENTOS
            ============================================= */}

            <section className="profile-section">

                <h2 className="profile-section-title">
                    Meus agendamentos
                </h2>

                {bookings ? (

                    <>

                        <div className="profile-stats">

                            <div>
                                <strong>{bookings.ativos}</strong>
                                <span>Ativos</span>
                            </div>

                            <div>
                                <strong>{bookings.concluidos}</strong>
                                <span>Concluídos</span>
                            </div>

                            <div>
                                <strong>{bookings.total}</strong>
                                <span>Total</span>
                            </div>

                        </div>

                        <button
                            type="button"
                            className="profile-button profile-button--ghost"
                            onClick={() => goToTab("reservas")}
                        >
                            Ver todos
                            <Icon icon="solar:alt-arrow-right-outline" />
                        </button>

                    </>

                ) : (

                    <p className="profile-empty">
                        Seus agendamentos nesta empresa aparecem aqui.
                    </p>

                )}

            </section>


            {/* =============================================
                DADOS DA CONTA
            ============================================= */}

            <section className="profile-section">

                <h2 className="profile-section-title">
                    Dados da conta
                </h2>

                <div className="profile-row">

                    <div className="profile-row-text">
                        <span>Nome</span>

                        {editingName ? (

                            <input
                                type="text"
                                value={nameDraft}
                                maxLength={40}
                                autoFocus
                                onChange={(e) =>
                                    setNameDraft(e.target.value)
                                }
                            />

                        ) : (

                            <strong>
                                {displayName || "Não informado"}
                            </strong>

                        )}

                    </div>

                    {editingName ? (

                        <div className="profile-row-actions">

                            <button
                                type="button"
                                onClick={() => {
                                    setEditingName(false);
                                    setNameDraft(displayName);
                                }}
                            >
                                Cancelar
                            </button>

                            <button
                                type="button"
                                className="is-primary"
                                disabled={saving || !nameDraft.trim()}
                                onClick={saveName}
                            >
                                {saving ? "Salvando..." : "Salvar"}
                            </button>

                        </div>

                    ) : (

                        <button
                            type="button"
                            className="profile-row-edit"
                            onClick={() => setEditingName(true)}
                        >
                            <Icon icon="solar:pen-2-outline" />
                        </button>

                    )}

                </div>

                <div className="profile-row">

                    <div className="profile-row-text">
                        <span>E-mail</span>
                        <strong>
                            {displayEmail || "Não informado"}
                        </strong>
                    </div>

                </div>

                <div className="profile-row">

                    <div className="profile-row-text">
                        <span>Telefone</span>
                        <strong>
                            {displayPhone || "Não informado"}
                        </strong>
                    </div>

                </div>

                {displayEmail && (

                    <button
                        type="button"
                        className="profile-button profile-button--ghost"
                        onClick={resetPassword}
                    >
                        <Icon icon="solar:lock-password-outline" />
                        Trocar minha senha
                    </button>

                )}

            </section>


            {/* =============================================
                PREFERÊNCIAS E SESSÃO
            ============================================= */}

            <section className="profile-section">

                <h2 className="profile-section-title">
                    Preferências
                </h2>

                <button
                    type="button"
                    className="profile-link"
                    onClick={toggleTheme}
                >

                    <Icon
                        icon={
                            isDark
                                ? "solar:moon-outline"
                                : "solar:sun-outline"
                        }
                    />

                    <span>
                        Tema {isDark ? "escuro" : "claro"}
                    </span>

                    <Icon icon="solar:alt-arrow-right-outline" />

                </button>

                <button
                    type="button"
                    className="profile-link"
                    onClick={openPreferences}
                >
                    <Icon icon="solar:cookie-outline" />
                    <span>Preferências de cookies</span>
                    <Icon icon="solar:alt-arrow-right-outline" />
                </button>

                <button
                    type="button"
                    className="profile-link"
                    onClick={() => navigate("/termos")}
                >
                    <Icon icon="solar:document-text-outline" />
                    <span>Termos de uso</span>
                    <Icon icon="solar:alt-arrow-right-outline" />
                </button>

                <button
                    type="button"
                    className="profile-link"
                    onClick={() => navigate("/privacidade")}
                >
                    <Icon icon="solar:shield-check-outline" />
                    <span>Política de privacidade</span>
                    <Icon icon="solar:alt-arrow-right-outline" />
                </button>

                <button
                    type="button"
                    className="profile-link"
                    onClick={() => navigate("/home")}
                >
                    <Icon icon="solar:round-transfer-horizontal-outline" />
                    <span>Trocar de plataforma</span>
                    <Icon icon="solar:alt-arrow-right-outline" />
                </button>

                <button
                    type="button"
                    className="profile-link"
                    onClick={() => setShowQr((value) => !value)}
                    aria-expanded={showQr}
                >
                    <Icon icon="solar:qr-code-outline" />
                    <span>Entrar em outro aparelho</span>
                    <Icon icon={showQr ? "solar:alt-arrow-up-outline" : "solar:alt-arrow-down-outline"} />
                </button>

                {showQr && (
                    <div style={{ padding: "4px 0 12px" }}>
                        <QrLoginCard />
                    </div>
                )}

                <button
                    type="button"
                    className="profile-link is-danger"
                    onClick={() => setConfirmingLogout(true)}
                >
                    <Icon icon="solar:logout-3-outline" />
                    <span>Sair da conta</span>
                </button>

            </section>


            <Modal
                open={confirmingLogout}
                onClose={() => setConfirmingLogout(false)}
                overlayClassName="profile-logout-overlay"
                className="profile-logout-modal"
                label="Sair da conta"
            >

                <div className="profile-logout-icon">
                    <Icon icon="solar:logout-3-outline" />
                </div>

                <h2>Sair da conta?</h2>

                <p>
                    Seus agendamentos continuam salvos. Você pode
                    entrar de novo quando quiser.
                </p>

                <div className="profile-logout-actions">

                    <button
                        type="button"
                        onClick={() => setConfirmingLogout(false)}
                    >
                        Cancelar
                    </button>

                    <button
                        type="button"
                        className="is-danger"
                        onClick={logout}
                    >
                        Sair
                    </button>

                </div>

            </Modal>


            {toast && (

                <Toast
                    type={toast.type}
                    title={toast.title}
                    message={toast.message}
                    show
                    onClose={() => setToast(null)}
                />

            )}

        </div>
    );

};


export default Profile;
