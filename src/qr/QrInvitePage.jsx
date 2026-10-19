import React, { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    createUserWithEmailAndPassword,
    getAuth,
    signOut,
    updateProfile
} from "firebase/auth";
import { getDatabase, ref, set } from "firebase/database";
import { Icon } from "@iconify/react";

import { useAuth } from "../contexts/authContext";
import { useUserCompany } from "../contexts/companyContext/UserCompanyContext";
import { descreverErroDeAuth } from "../firebase/auth";
import { callQr, ROLE_LABELS } from "./qrApi";
import { uploadProfilePhoto, validateProfilePhoto } from "./profilePhoto";
import markfyLogo from "../img/logo-markfy.svg";
import "./qr.css";

/* =========================================================
   ENTRAR NA EQUIPE POR QR CODE  —  /entrar-equipe/:inviteId

   A pessoa aponta a câmera e cai aqui. Se já tem conta, só
   confirma. Se não tem, preenche o essencial: nome, e-mail e
   senha, e (se quiser) uma foto — HEIC aceito, recortada no
   centro e muito comprimida, salva só no Storage em
   users/{uid}/profileImg.

   A função vem do convite (escolhida pelo administrador). Quem
   vincula a pessoa à empresa é o backend, que confere o
   convite, o plano e o limite da equipe.
========================================================= */

export default function QrInvitePage() {

    const { inviteId } = useParams();
    const navigate = useNavigate();

    const { currentUser } = useAuth();
    const { refreshCompany } = useUserCompany();

    const [invite, setInvite] = useState({ status: "loading" });
    const [form, setForm] = useState({ name: "", email: "", password: "" });
    const [photo, setPhoto] = useState(null);
    const [photoUrl, setPhotoUrl] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);
    const fileInput = useRef(null);

    useEffect(() => {

        let cancelled = false;

        callQr("getQrInvite", { inviteId }, { auth: false })
            .then((data) => {
                if (!cancelled) setInvite(data.valid ? { status: "valid", ...data } : { status: "invalid" });
            })
            .catch(() => {
                if (!cancelled) setInvite({ status: "invalid" });
            });

        return () => { cancelled = true; };
    }, [inviteId]);

    useEffect(() => () => {
        if (photoUrl) URL.revokeObjectURL(photoUrl);
    }, [photoUrl]);

    const patch = (next) => setForm((old) => ({ ...old, ...next }));

    const pickPhoto = (event) => {

        const file = event.target.files?.[0];

        event.target.value = "";

        if (!file) return;

        const problem = validateProfilePhoto(file);

        if (problem) {
            setError(problem);
            return;
        }

        setError("");
        setPhoto(file);

        /* HEIC não tem pré-visualização no navegador: mostra só o nome. */
        setPhotoUrl(/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name) ? "" : URL.createObjectURL(file));
    };

    const finish = async () => {

        await refreshCompany().catch(() => null);

        setDone(true);

        setTimeout(() => navigate("/home", { replace: true }), 1400);
    };

    const join = async () => {

        await callQr("joinCompanyByQr", { inviteId });

        await finish();
    };

    const submit = async (event) => {

        event.preventDefault();

        if (busy) return;

        const name = form.name.trim();
        const email = form.email.trim().toLowerCase();

        if (name.length < 2) return setError("Informe seu nome.");
        if (!/^\S+@\S+\.\S+$/.test(email)) return setError("Esse e-mail não parece válido.");
        if (form.password.length < 6) return setError("A senha precisa de pelo menos 6 caracteres.");

        setBusy(true);
        setError("");

        let created = null;

        try {

            const credential = await createUserWithEmailAndPassword(getAuth(), email, form.password);

            created = credential.user;

            await updateProfile(created, { displayName: name });

            /* Perfil básico. A senha NÃO é gravada em lugar nenhum:
               ela fica só no Firebase Authentication. */
            await set(ref(getDatabase(), `users/${created.uid}`), {
                uid: created.uid,
                name,
                email,
                provider: "markfy",
                userType: "admin",
                initial: false
            });

            /* A foto é opcional e nunca impede a entrada na equipe. */
            if (photo) {
                try {
                    await uploadProfilePhoto(created.uid, photo);
                } catch (photoError) {
                    console.warn("Foto de perfil não enviada:", photoError);
                }
            }

            await join();

        } catch (err) {

            if (created) {
                setError(`${err.message} Sua conta foi criada: entre com e-mail e senha e peça um novo convite.`);
            } else {
                setError(descreverErroDeAuth(err) || err.message);
            }

        } finally {
            setBusy(false);
        }
    };

    const joinLoggedIn = async () => {

        setBusy(true);
        setError("");

        try {
            await join();
        } catch (err) {
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    const role = ROLE_LABELS[invite.role] || "";

    return (
        <main className="qr-page">
            <div className="qr-page__card qr-page__card--wide">

                <img className="qr-page__logo" src={markfyLogo} alt="Markfy" />

                {invite.status === "loading" && <span className="qr-spin qr-spin--lg" />}

                {invite.status === "invalid" && (
                    <>
                        <span className="qr-ok is-bad"><Icon icon="solar:danger-triangle-bold" /></span>
                        <h1>Convite indisponível</h1>
                        <p>Este QR Code expirou ou já foi usado. Peça um novo a quem administra a empresa.</p>
                        <button type="button" className="qr-btn" onClick={() => navigate("/home")}>Ir para o início</button>
                    </>
                )}

                {done && (
                    <>
                        <span className="qr-ok"><Icon icon="solar:check-circle-bold" /></span>
                        <h1>Você entrou na equipe!</h1>
                        <p>{invite.companyName} · {role}</p>
                    </>
                )}

                {invite.status === "valid" && !done && (
                    <>
                        <span className="qr-badge"><Icon icon="solar:users-group-rounded-bold" /> Convite para a equipe</span>
                        <h1>{invite.companyName}</h1>
                        <p className="qr-page__role">Você vai entrar como <b>{role}</b>.</p>

                        {currentUser ? (
                            <div className="qr-form">
                                <p className="qr-note">Você está conectado como <b>{currentUser.email}</b>.</p>

                                {error && <p className="qr-note is-bad" role="alert"><Icon icon="solar:danger-triangle-bold" /> {error}</p>}

                                <button type="button" className="qr-btn" disabled={busy} onClick={joinLoggedIn}>
                                    {busy ? <span className="qr-spin" /> : <Icon icon="solar:check-circle-bold" />}
                                    Entrar na equipe
                                </button>

                                <button type="button" className="qr-link" onClick={() => signOut(getAuth())}>
                                    Usar outra conta
                                </button>
                            </div>
                        ) : (
                            <form className="qr-form" onSubmit={submit} noValidate>

                                <button
                                    type="button"
                                    className={`qr-photo ${photo ? "has-photo" : ""}`}
                                    onClick={() => fileInput.current?.click()}
                                    aria-label="Escolher foto de perfil"
                                >
                                    {photoUrl
                                        ? <img src={photoUrl} alt="" />
                                        : <Icon icon={photo ? "solar:gallery-check-bold" : "solar:camera-add-bold"} />}
                                    <span>{photo ? "Trocar foto" : "Adicionar foto (opcional)"}</span>
                                </button>

                                <input
                                    ref={fileInput}
                                    type="file"
                                    accept="image/*,.heic,.heif"
                                    hidden
                                    onChange={pickPhoto}
                                />

                                <label className="qr-input">
                                    <span>Nome</span>
                                    <input
                                        value={form.name}
                                        onChange={(e) => patch({ name: e.target.value })}
                                        autoComplete="name"
                                        placeholder="Seu nome completo"
                                    />
                                </label>

                                <label className="qr-input">
                                    <span>E-mail</span>
                                    <input
                                        type="email"
                                        value={form.email}
                                        onChange={(e) => patch({ email: e.target.value })}
                                        autoComplete="email"
                                        placeholder="voce@email.com"
                                    />
                                </label>

                                <label className="qr-input">
                                    <span>Senha</span>
                                    <div>
                                        <input
                                            type={showPassword ? "text" : "password"}
                                            value={form.password}
                                            onChange={(e) => patch({ password: e.target.value })}
                                            autoComplete="new-password"
                                            placeholder="Mínimo de 6 caracteres"
                                        />
                                        <button type="button" onClick={() => setShowPassword((v) => !v)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                                            <Icon icon={showPassword ? "solar:eye-closed-linear" : "solar:eye-linear"} />
                                        </button>
                                    </div>
                                </label>

                                {error && <p className="qr-note is-bad" role="alert"><Icon icon="solar:danger-triangle-bold" /> {error}</p>}

                                <button className="qr-btn" disabled={busy}>
                                    {busy ? <span className="qr-spin" /> : <Icon icon="solar:user-plus-bold" />}
                                    {busy ? "Criando sua conta…" : "Criar conta e entrar"}
                                </button>

                                <button type="button" className="qr-link" onClick={() => navigate(`/login?redirect=/entrar-equipe/${inviteId}`)}>
                                    Já tenho conta
                                </button>
                            </form>
                        )}
                    </>
                )}
            </div>
        </main>
    );
}
