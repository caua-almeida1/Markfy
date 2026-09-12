import React, {
    useEffect,
    useMemo,
    useState
} from "react";

import {
    getAuth,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signOut,
    updateProfile
} from "firebase/auth";

import {
    getDatabase,
    onValue,
    ref,
    update
} from "firebase/database";

import {
    motion,
    AnimatePresence
} from "framer-motion";

import {
    Icon
} from "@iconify/react";

import {
    useNavigate
} from "react-router-dom";

import "./Profile.css";


const Profile = () => {

    const auth = getAuth();

    const navigate = useNavigate();


    /*
    ============================================================
    AUTH
    ============================================================
    */

    const [
        user,
        setUser
    ] = useState(
        auth.currentUser || null
    );


    const [
        authLoading,
        setAuthLoading
    ] = useState(true);


    /*
    ============================================================
    USUÁRIO
    ============================================================
    */

    const [
        userData,
        setUserData
    ] = useState(null);


    const [
        userName,
        setUserName
    ] = useState("");


    const [
        userEmail,
        setUserEmail
    ] = useState("");


    const [
        userPhoto,
        setUserPhoto
    ] = useState("");


    const [
        userCreatedAt,
        setUserCreatedAt
    ] = useState(null);


    /*
    ============================================================
    EMPRESAS
    ============================================================
    */

    const [
        companyMap,
        setCompanyMap
    ] = useState({});


    /*
    ============================================================
    RESERVAS
    ============================================================
    */

    const [
        reservations,
        setReservations
    ] = useState([]);


    const [
        reservationsLoading,
        setReservationsLoading
    ] = useState(false);


    /*
    ============================================================
    UI
    ============================================================
    */

    const [
        activeModal,
        setActiveModal
    ] = useState(null);


    const [
        selectedReservation,
        setSelectedReservation
    ] = useState(null);


    const [
        selectedCompany,
        setSelectedCompany
    ] = useState(null);


    /*
    ============================================================
    EDIÇÃO DO PERFIL
    ============================================================
    */

    const [
        editName,
        setEditName
    ] = useState("");


    const [
        savingProfile,
        setSavingProfile
    ] = useState(false);


    /*
    ============================================================
    SEGURANÇA
    ============================================================
    */

    const [
        sendingPasswordReset,
        setSendingPasswordReset
    ] = useState(false);


    const [
        passwordResetSent,
        setPasswordResetSent
    ] = useState(false);


    /*
    ============================================================
    LOGOUT
    ============================================================
    */

    const [
        loggingOut,
        setLoggingOut
    ] = useState(false);


    /*
    ============================================================
    FEEDBACK
    ============================================================
    */

    const [
        feedback,
        setFeedback
    ] = useState(null);


    /*
    ============================================================
    AUTH LISTENER
    ============================================================
    */

    useEffect(() => {

        const unsubscribe =
            onAuthStateChanged(
                auth,
                currentUser => {

                    setUser(
                        currentUser
                    );


                    if (currentUser) {

                        setUserName(
                            currentUser.displayName ||
                            ""
                        );

                        setUserEmail(
                            currentUser.email ||
                            ""
                        );

                        setUserPhoto(
                            currentUser.photoURL ||
                            ""
                        );

                    } else {

                        setUserName("");
                        setUserEmail("");
                        setUserPhoto("");
                        setUserData(null);
                        setReservations([]);

                    }


                    setAuthLoading(
                        false
                    );

                }
            );


        return () =>
            unsubscribe();

    }, []);


    /*
    ============================================================
    CARREGAR DADOS DO USUÁRIO
    ============================================================
    */

    useEffect(() => {

        if (!user?.uid) {

            return;

        }


        const database =
            getDatabase();


        const userRef =
            ref(
                database,
                `users/${user.uid}`
            );


        const unsubscribe =
            onValue(
                userRef,
                snapshot => {

                    if (
                        snapshot.exists()
                    ) {

                        const data =
                            snapshot.val();


                        setUserData(
                            data
                        );


                        setUserName(
                            data.name ||
                            user?.displayName ||
                            ""
                        );


                        setUserEmail(
                            data.email ||
                            user?.email ||
                            ""
                        );


                        setUserPhoto(
                            data.photoURL ||
                            user?.photoURL ||
                            ""
                        );


                        setUserCreatedAt(
                            data.createdAt ||
                            data.created_at ||
                            null
                        );

                    } else {

                        setUserName(
                            user?.displayName ||
                            ""
                        );


                        setUserEmail(
                            user?.email ||
                            ""
                        );


                        setUserPhoto(
                            user?.photoURL ||
                            ""
                        );


                        setUserCreatedAt(
                            user?.metadata?.creationTime ||
                            null
                        );

                    }

                },
                error => {

                    console.error(
                        "Erro ao carregar dados do usuário:",
                        error
                    );

                }
            );


        return () =>
            unsubscribe();

    }, [user]);


    /*
    ============================================================
    CARREGAR EMPRESAS
    ============================================================
    */

    useEffect(() => {

        if (!user) {

            setCompanyMap({});

            return;

        }


        const database =
            getDatabase();


        const companiesRef =
            ref(
                database,
                "companys"
            );


        const unsubscribe =
            onValue(
                companiesRef,
                snapshot => {

                    if (
                        !snapshot.exists()
                    ) {

                        setCompanyMap({});

                        return;

                    }


                    const data =
                        snapshot.val();


                    const map = {};


                    Object.entries(
                        data
                    ).forEach(
                        ([handle, company]) => {

                            map[handle] = {
                                handle,
                                ...company
                            };

                        }
                    );


                    setCompanyMap(
                        map
                    );

                },
                error => {

                    console.error(
                        "Erro ao carregar empresas:",
                        error
                    );

                }
            );


        return () =>
            unsubscribe();

    }, [user]);


    /*
    ============================================================
    CARREGAR RESERVAS
    ============================================================
    */

    useEffect(() => {

        if (!user?.uid) {

            setReservations([]);
            setReservationsLoading(false);

            return;

        }


        setReservationsLoading(
            true
        );


        const database =
            getDatabase();


        const companiesRef =
            ref(
                database,
                "companys"
            );


        const unsubscribe =
            onValue(
                companiesRef,
                snapshot => {

                    if (
                        !snapshot.exists()
                    ) {

                        setReservations([]);
                        setReservationsLoading(false);

                        return;

                    }


                    const companies =
                        snapshot.val();


                    const userReservations = [];


                    Object.entries(
                        companies
                    ).forEach(
                        ([companyHandle, company]) => {

                            const schedules =
                                company?.schedules ||
                                {};


                            const products =
                                company?.products ||
                                {};


                            Object.entries(
                                schedules
                            ).forEach(
                                ([scheduleId, schedule]) => {

                                    if (
                                        schedule?.userId !==
                                        user.uid
                                    ) {

                                        return;

                                    }


                                    const product =
                                        products[
                                        schedule?.productId
                                        ] || {};


                                    userReservations.push({

                                        id:
                                            scheduleId,

                                        companyHandle,

                                        companyName:
                                            company?.name ||
                                            companyHandle,

                                        companyLogo:
                                            company?.logoPreview ||
                                            company?.logo ||
                                            "",

                                        companyDescription:
                                            company?.description ||
                                            "",

                                        productId:
                                            schedule?.productId ||
                                            "",

                                        productName:
                                            schedule?.productName ||
                                            product?.name ||
                                            "Serviço",

                                        productDescription:
                                            schedule?.productDescription ||
                                            product?.description ||
                                            "",

                                        productValue:
                                            schedule?.productPrice ??
                                            product?.value ??
                                            "—",

                                        productImage:
                                            product?.images?.[0] ||
                                            product?.image ||
                                            "",

                                        day:
                                            schedule?.day ||
                                            "",

                                        hour:
                                            schedule?.hour ||
                                            "",

                                        status:
                                            schedule?.status ||
                                            "pending",

                                        createdAt:
                                            schedule?.createdAt ||
                                            null,

                                        raw:
                                            schedule

                                    });

                                }
                            );

                        }
                    );


                    setReservations(
                        userReservations
                    );


                    setReservationsLoading(
                        false
                    );

                },
                error => {

                    console.error(
                        "Erro ao carregar reservas:",
                        error
                    );


                    setReservations([]);


                    setReservationsLoading(
                        false
                    );

                }
            );


        return () =>
            unsubscribe();

    }, [user]);


    /*
    ============================================================
    ESC
    ============================================================
    */

    useEffect(() => {

        const handleKeyDown =
            event => {

                if (
                    event.key === "Escape"
                ) {

                    setActiveModal(null);
                    setSelectedReservation(null);
                    setSelectedCompany(null);

                }

            };


        document.addEventListener(
            "keydown",
            handleKeyDown
        );


        return () =>
            document.removeEventListener(
                "keydown",
                handleKeyDown
            );

    }, []);


    /*
    ============================================================
    FEEDBACK
    ============================================================
    */

    useEffect(() => {

        if (!feedback) {
            return;
        }


        const timeout =
            setTimeout(
                () => {

                    setFeedback(
                        null
                    );

                },
                3200
            );


        return () =>
            clearTimeout(
                timeout
            );

    }, [feedback]);


    /*
    ============================================================
    UTILITÁRIOS
    ============================================================
    */

    const showFeedback = (
        type,
        title,
        message
    ) => {

        setFeedback({
            type,
            title,
            message
        });

    };


    const formatDate = (
        value
    ) => {

        if (!value) {

            return "—";

        }


        const date =
            new Date(
                value
            );


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return "—";

        }


        return date.toLocaleDateString(
            "pt-BR",
            {
                day: "2-digit",
                month: "long",
                year: "numeric"
            }
        );

    };


    const formatShortDate = (
        value
    ) => {

        if (!value) {
            return "—";
        }


        const parts =
            value
                .split("/")
                .map(Number);


        if (
            parts.length !== 3
        ) {

            return value;

        }


        const [
            day,
            month,
            year
        ] = parts;


        const date =
            new Date(
                year,
                month - 1,
                day
            );


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return value;

        }


        return date.toLocaleDateString(
            "pt-BR",
            {
                day: "2-digit",
                month: "short"
            }
        );

    };


    const getReservationDate = (
        reservation
    ) => {

        if (
            !reservation?.day
        ) {

            return null;

        }


        const parts =
            reservation.day
                .split("/")
                .map(Number);


        if (
            parts.length !== 3 ||
            parts.some(
                Number.isNaN
            )
        ) {

            return null;

        }


        const [
            day,
            month,
            year
        ] = parts;


        const [
            hour = 0,
            minute = 0
        ] =
            (
                reservation.hour ||
                "00:00"
            )
                .split(":")
                .map(Number);


        const date =
            new Date(
                year,
                month - 1,
                day,
                hour,
                minute
            );


        if (
            Number.isNaN(
                date.getTime()
            )
        ) {

            return null;

        }


        return date;

    };


    const getReservationStatus = (
        status
    ) => {

        switch (
        status
        ) {

            case "completed":

                return {
                    label: "Concluído",
                    icon: "lucide:check-circle-2",
                    className: "profile-status--completed"
                };


            case "cancelados":
            case "cancelled":
            case "canceled":

                return {
                    label: "Cancelado",
                    icon: "lucide:x-circle",
                    className: "profile-status--cancelled"
                };


            case "pending":

                return {
                    label: "Pendente",
                    icon: "lucide:clock-3",
                    className: "profile-status--pending"
                };


            default:

                return {
                    label: "Agendado",
                    icon: "lucide:calendar-check-2",
                    className: "profile-status--scheduled"
                };

        }

    };


    /*
    ============================================================
    INICIAL
    ============================================================
    */

    const userInitial =
        useMemo(() => {

            const cleanName =
                userName?.trim();


            if (
                cleanName
            ) {

                return cleanName
                    .charAt(0)
                    .toUpperCase();

            }


            return (
                userEmail
                    ?.charAt(0)
                    ?.toUpperCase() ||
                "U"
            );

        }, [
            userName,
            userEmail
        ]);


    /*
    ============================================================
    DATA DE CADASTRO
    ============================================================
    */

    const memberSince =
        useMemo(() => {

            if (
                userCreatedAt
            ) {

                return formatDate(
                    userCreatedAt
                );

            }


            if (
                user?.metadata?.creationTime
            ) {

                return formatDate(
                    user.metadata.creationTime
                );

            }


            return "Recentemente";

        }, [
            userCreatedAt,
            user
        ]);


    /*
    ============================================================
    RESERVAS NORMALIZADAS
    ============================================================
    */

    const normalizedReservations =
        useMemo(() => {

            return [
                ...reservations
            ].sort(
                (a, b) => {

                    const dateA =
                        getReservationDate(
                            a
                        );


                    const dateB =
                        getReservationDate(
                            b
                        );


                    if (
                        !dateA &&
                        !dateB
                    ) {

                        return 0;

                    }


                    if (!dateA) {
                        return 1;
                    }


                    if (!dateB) {
                        return -1;
                    }


                    return (
                        dateB.getTime() -
                        dateA.getTime()
                    );

                }
            );

        }, [
            reservations
        ]);


    /*
    ============================================================
    PRÓXIMAS RESERVAS
    ============================================================
    */

    const upcomingReservations =
        useMemo(() => {

            const now =
                new Date();


            return reservations
                .filter(
                    reservation => {

                        const date =
                            getReservationDate(
                                reservation
                            );


                        if (!date) {
                            return false;
                        }


                        return (
                            date >= now &&
                            ![
                                "cancelados",
                                "cancelled",
                                "canceled",
                                "completed"
                            ].includes(
                                reservation.status
                            )
                        );

                    }
                )
                .sort(
                    (a, b) => {

                        const dateA =
                            getReservationDate(
                                a
                            );

                        const dateB =
                            getReservationDate(
                                b
                            );


                        if (!dateA) {
                            return 1;
                        }


                        if (!dateB) {
                            return -1;
                        }


                        return (
                            dateA.getTime() -
                            dateB.getTime()
                        );

                    }
                );

        }, [
            reservations
        ]);


    /*
    ============================================================
    ÚLTIMA RESERVA
    ============================================================
    */

    const latestReservations =
        useMemo(() => {

            return normalizedReservations
                .slice(
                    0,
                    5
                );

        }, [
            normalizedReservations
        ]);


    /*
    ============================================================
    EMPRESAS VISITADAS
    ============================================================
    */

    const visitedCompanies =
        useMemo(() => {

            const handles =
                new Set();


            reservations.forEach(
                reservation => {

                    if (
                        reservation.companyHandle
                    ) {

                        handles.add(
                            reservation.companyHandle
                        );

                    }

                }
            );


            return Array.from(
                handles
            )
                .map(
                    handle =>
                        companyMap[
                        handle
                        ] || {
                            handle,
                            name:
                                handle
                        }
                );

        }, [
            reservations,
            companyMap
        ]);


    /*
    ============================================================
    RESERVA EM DESTAQUE
    ============================================================
    */

    const nextReservation =
        upcomingReservations[0] ||
        null;


    /*
    ============================================================
    NAVEGAÇÃO
    ============================================================
    */

    const goToTab = (
        tab
    ) => {

        window.dispatchEvent(
            new CustomEvent(
                `markfy:go-to-${tab}`
            )
        );

    };


    const openReservations = () => {

        goToTab(
            "reservations"
        );

    };


    const openCatalog = () => {

        goToTab(
            "catalog"
        );

    };


    const openExplore = () => {

        goToTab(
            "explore"
        );

    };


    const openCompany = (
        company
    ) => {

        if (
            !company?.handle
        ) {

            return;

        }


        navigate(
            `/central-user/${company.handle}`
        );

    };


    /*
    ============================================================
    ABRIR RESERVA
    ============================================================
    */

    const openReservationDetails = (
        reservation
    ) => {

        if (
            !reservation
        ) {

            return;

        }


        setSelectedReservation(
            reservation
        );


        setActiveModal(
            "reservation"
        );

    };


    /*
    ============================================================
    EDITAR PERFIL
    ============================================================
    */

    const openEditProfile = () => {

        setEditName(
            userName
        );


        setActiveModal(
            "edit-profile"
        );

    };


    /*
    ============================================================
    SALVAR PERFIL
    ============================================================
    */

    const handleSaveProfile =
        async () => {

            if (!user) {
                return;
            }


            const cleanName =
                editName.trim();


            if (
                !cleanName
            ) {

                showFeedback(
                    "error",
                    "Nome inválido",
                    "Informe um nome para continuar."
                );

                return;

            }


            if (
                cleanName.length < 2
            ) {

                showFeedback(
                    "error",
                    "Nome muito curto",
                    "Digite pelo menos 2 caracteres."
                );

                return;

            }


            setSavingProfile(
                true
            );


            try {

                await updateProfile(
                    user,
                    {
                        displayName:
                            cleanName
                    }
                );


                const database =
                    getDatabase();


                await update(
                    ref(
                        database,
                        `users/${user.uid}`
                    ),
                    {
                        name:
                            cleanName
                    }
                );


                setUserName(
                    cleanName
                );


                setActiveModal(
                    null
                );


                showFeedback(
                    "success",
                    "Perfil atualizado",
                    "Seu nome foi atualizado com sucesso."
                );

            } catch (error) {

                console.error(
                    "Erro ao atualizar perfil:",
                    error
                );


                showFeedback(
                    "error",
                    "Não foi possível salvar",
                    "Tente novamente em alguns instantes."
                );

            } finally {

                setSavingProfile(
                    false
                );

            }

        };


    /*
    ============================================================
    REDEFINIR SENHA
    ============================================================
    */

    const handlePasswordReset =
        async () => {

            if (
                !user?.email
            ) {

                return;

            }


            setSendingPasswordReset(
                true
            );


            setPasswordResetSent(
                false
            );


            try {

                await sendPasswordResetEmail(
                    auth,
                    user.email
                );


                setPasswordResetSent(
                    true
                );


                showFeedback(
                    "success",
                    "E-mail enviado",
                    "Enviamos as instruções para redefinir sua senha."
                );

            } catch (error) {

                console.error(
                    "Erro ao enviar redefinição de senha:",
                    error
                );


                showFeedback(
                    "error",
                    "Não foi possível enviar",
                    "Tente novamente em alguns instantes."
                );

            } finally {

                setSendingPasswordReset(
                    false
                );

            }

        };


    /*
    ============================================================
    COPIAR UID
    ============================================================
    */

    const handleCopyUid =
        async () => {

            if (
                !user?.uid
            ) {

                return;

            }


            try {

                await navigator.clipboard.writeText(
                    user.uid
                );


                showFeedback(
                    "success",
                    "ID copiado",
                    "O identificador da sua conta foi copiado."
                );

            } catch (error) {

                console.error(
                    "Erro ao copiar UID:",
                    error
                );


                showFeedback(
                    "error",
                    "Não foi possível copiar",
                    "Copie o identificador manualmente."
                );

            }

        };


    /*
    ============================================================
    COMPARTILHAR MARKFY
    ============================================================
    */

    const handleShareMarkfy =
        async () => {

            const url =
                window.location.origin;


            const shareData = {

                title:
                    "Markfy",

                text:
                    "Encontre empresas, serviços e faça seus agendamentos pela Markfy.",

                url

            };


            try {

                if (
                    navigator.share
                ) {

                    await navigator.share(
                        shareData
                    );

                    return;

                }


                await navigator.clipboard.writeText(
                    url
                );


                showFeedback(
                    "success",
                    "Link copiado",
                    "O endereço da Markfy foi copiado para você compartilhar."
                );

            } catch (error) {

                if (
                    error?.name ===
                    "AbortError"
                ) {

                    return;

                }


                console.error(
                    "Erro ao compartilhar:",
                    error
                );


                showFeedback(
                    "error",
                    "Não foi possível compartilhar",
                    "Tente novamente."
                );

            }

        };


    /*
    ============================================================
    LOGOUT
    ============================================================
    */

    const handleLogout =
        async () => {

            setLoggingOut(
                true
            );


            try {

                localStorage.removeItem(
                    "authUser"
                );


                await signOut(
                    auth
                );


                setActiveModal(
                    null
                );


                navigate(
                    "/Login"
                );

            } catch (error) {

                console.error(
                    "Erro ao sair da conta:",
                    error
                );


                showFeedback(
                    "error",
                    "Não foi possível sair",
                    "Tente novamente em alguns instantes."
                );

            } finally {

                setLoggingOut(
                    false
                );

            }

        };


    /*
    ============================================================
    FECHAR MODAL
    ============================================================
    */

    const closeModal = () => {

        setActiveModal(
            null
        );

        setSelectedReservation(
            null
        );

        setSelectedCompany(
            null
        );

        setPasswordResetSent(
            false
        );

    };


    /*
    ============================================================
    LOADING AUTH
    ============================================================
    */

    if (
        authLoading
    ) {

        return (

            <div className="profile-page">

                <header className="profile-header">

                    <div className="profile-header-inner">

                        <div className="profile-header-brand">

                            <div className="profile-header-brand-mark">

                                <Icon
                                    icon="solar:user-circle-outline"
                                />

                            </div>

                            <div>

                                <span>
                                    MARKFY
                                </span>

                                <strong>
                                    Seu perfil
                                </strong>

                            </div>

                        </div>

                    </div>

                </header>


                <main className="profile-content">

                    <div className="profile-loading">

                        <div className="profile-loading-avatar" />

                        <div className="profile-loading-line profile-loading-line--large" />

                        <div className="profile-loading-line" />

                        <div className="profile-loading-grid">

                            <div />
                            <div />
                            <div />

                        </div>

                    </div>

                </main>

            </div>

        );

    }


    /*
    ============================================================
    VISITANTE
    ============================================================
    */

    if (!user) {

        return (

            <div className="profile-page">

                <header className="profile-header">

                    <div className="profile-header-inner">

                        <div className="profile-header-brand">

                            <div className="profile-header-brand-mark">

                                <Icon
                                    icon="solar:user-circle-outline"
                                />

                            </div>

                            <div>

                                <span>
                                    MARKFY
                                </span>

                                <strong>
                                    Seu perfil
                                </strong>

                            </div>

                        </div>

                    </div>

                </header>


                <main className="profile-content profile-guest-content">

                    <section className="profile-guest-card">

                        <div className="profile-guest-icon">

                            <Icon
                                icon="solar:user-circle-outline"
                            />

                        </div>


                        <span className="profile-eyebrow">
                            SUA CONTA
                        </span>


                        <h1>
                            Entre na sua conta
                        </h1>


                        <p>
                            Acesse suas reservas, acompanhe
                            seus agendamentos e tenha tudo
                            da sua experiência Markfy em um só lugar.
                        </p>


                        <button
                            type="button"
                            className="profile-guest-primary"
                            onClick={() =>
                                navigate("/Login")
                            }
                        >

                            <Icon
                                icon="solar:login-2-outline"
                            />

                            Entrar na Markfy

                        </button>


                        <button
                            type="button"
                            className="profile-guest-secondary"
                            onClick={() =>
                                navigate("/Login")
                            }
                        >

                            Criar minha conta

                            <Icon
                                icon="humbleicons:arrow-right"
                            />

                        </button>

                    </section>


                    <section className="profile-guest-benefits">

                        <div>

                            <div className="profile-guest-benefit-icon">

                                <Icon
                                    icon="solar:calendar-outline"
                                />

                            </div>

                            <div>

                                <strong>
                                    Suas reservas
                                </strong>

                                <span>
                                    Acompanhe seus próximos atendimentos.
                                </span>

                            </div>

                        </div>


                        <div>

                            <div className="profile-guest-benefit-icon">

                                <Icon
                                    icon="solar:history-outline"
                                />

                            </div>

                            <div>

                                <strong>
                                    Seu histórico
                                </strong>

                                <span>
                                    Consulte seus agendamentos anteriores.
                                </span>

                            </div>

                        </div>


                        <div>

                            <div className="profile-guest-benefit-icon">

                                <Icon
                                    icon="solar:compass-outline"
                                />

                            </div>

                            <div>

                                <strong>
                                    Explore a Markfy
                                </strong>

                                <span>
                                    Descubra empresas e novos serviços.
                                </span>

                            </div>

                        </div>

                    </section>


                    <button
                        type="button"
                        className="profile-guest-explore"
                        onClick={
                            openExplore
                        }
                    >

                        <div>

                            <Icon
                                icon="solar:compass-outline"
                            />

                            <span>
                                Continuar explorando sem conta
                            </span>

                        </div>


                        <Icon
                            icon="humbleicons:arrow-right"
                        />

                    </button>

                </main>

            </div>

        );

    }


    /*
    ============================================================
    RENDER LOGADO
    ============================================================
    */

    return (

        <div className="profile-page">

            {/* ==================================================
                HEADER
            ================================================== */}

            <header className="profile-header">

                <div className="profile-header-inner">

                    <div className="profile-header-brand">

                        <div className="profile-header-brand-mark">

                            <Icon
                                icon="solar:user-circle-outline"
                            />

                        </div>

                        <div>

                            <span>
                                MARKFY
                            </span>

                            <strong>
                                Seu perfil
                            </strong>

                        </div>

                    </div>


                    <button
                        type="button"
                        className="profile-header-notification"
                        onClick={() =>
                            setActiveModal(
                                "notifications"
                            )
                        }
                        aria-label="Abrir notificações"
                    >

                        <Icon
                            icon="solar:bell-outline"
                        />


                        {upcomingReservations.length > 0 && (

                            <span className="profile-notification-dot" />

                        )}

                    </button>

                </div>

            </header>


            {/* ==================================================
                CONTEÚDO
                ================================================== */}

            <main className="profile-content">

                {/* ==================================================
                    HERO
                    ================================================== */}

                <section className="profile-hero">

                    <div className="profile-hero-main">

                        <div className="profile-avatar">

                            {userPhoto ? (

                                <img
                                    src={userPhoto}
                                    alt={
                                        userName ||
                                        "Usuário"
                                    }
                                    onError={event => {

                                        event.currentTarget.style.display =
                                            "none";

                                    }}
                                />

                            ) : (

                                <span>
                                    {userInitial}
                                </span>

                            )}

                        </div>


                        <div className="profile-hero-info">

                            <span className="profile-eyebrow">
                                PERFIL MARKFY
                            </span>


                            <h1>
                                {userName ||
                                    "Olá"}
                            </h1>


                            <p>
                                {userEmail}
                            </p>


                            <div className="profile-account-status">

                                <span>

                                    <Icon
                                        icon="lucide:badge-check"
                                    />

                                    Conta ativa

                                </span>


                                <span>
                                    Desde {memberSince}
                                </span>

                            </div>

                        </div>

                    </div>


                    <button
                        type="button"
                        className="profile-edit-button"
                        onClick={
                            openEditProfile
                        }
                    >

                        <Icon
                            icon="lucide:pencil"
                        />

                        Editar perfil

                    </button>

                </section>


                {/* ==================================================
                    RESUMO
                    ================================================== */}

                <section className="profile-summary">

                    <button
                        type="button"
                        className="profile-summary-card"
                        onClick={
                            openReservations
                        }
                    >

                        <div className="profile-summary-icon">

                            <Icon
                                icon="solar:calendar-outline"
                            />

                        </div>


                        <div>

                            <strong>
                                {reservations.length}
                            </strong>

                            <span>
                                reservas
                            </span>

                        </div>

                    </button>


                    <button
                        type="button"
                        className="profile-summary-card"
                        onClick={
                            openReservations
                        }
                    >

                        <div className="profile-summary-icon">

                            <Icon
                                icon="solar:calendar-mark-outline"
                            />

                        </div>


                        <div>

                            <strong>
                                {upcomingReservations.length}
                            </strong>

                            <span>
                                próximas
                            </span>

                        </div>

                    </button>


                    <button
                        type="button"
                        className="profile-summary-card"
                        onClick={() =>
                            document
                                .getElementById(
                                    "profile-companies"
                                )
                                ?.scrollIntoView({
                                    behavior: "smooth",
                                    block: "center"
                                })
                        }
                    >

                        <div className="profile-summary-icon">

                            <Icon
                                icon="solar:shop-outline"
                            />

                        </div>


                        <div>

                            <strong>
                                {visitedCompanies.length}
                            </strong>

                            <span>
                                empresas
                            </span>

                        </div>

                    </button>

                </section>


                {/* ==================================================
                    PRÓXIMA RESERVA
                    ================================================== */}

                <section className="profile-section">

                    <div className="profile-section-heading">

                        <div>

                            <span>
                                SUA AGENDA
                            </span>


                            <h2>
                                Próximo atendimento
                            </h2>

                        </div>


                        {upcomingReservations.length > 0 && (

                            <button
                                type="button"
                                className="profile-see-all"
                                onClick={
                                    openReservations
                                }
                            >

                                Ver reservas

                                <Icon
                                    icon="humbleicons:arrow-right"
                                />

                            </button>

                        )}

                    </div>


                    {reservationsLoading ? (

                        <div className="profile-inline-loading">

                            <Icon
                                icon="lucide:loader-2"
                            />

                            Carregando sua agenda...

                        </div>

                    ) : nextReservation ? (

                        <button
                            type="button"
                            className="profile-next-reservation"
                            onClick={() =>
                                openReservationDetails(
                                    nextReservation
                                )
                            }
                        >

                            <div className="profile-next-date">

                                <span>
                                    {formatShortDate(
                                        nextReservation.day
                                    )}
                                </span>


                                <strong>
                                    {nextReservation.hour ||
                                        "—"}
                                </strong>

                            </div>


                            <div className="profile-next-divider" />


                            <div className="profile-next-content">

                                <span className="profile-card-overline">
                                    PRÓXIMO ATENDIMENTO
                                </span>


                                <strong>
                                    {nextReservation.productName}
                                </strong>


                                <p>
                                    {nextReservation.companyName}
                                </p>


                                <span
                                    className={`profile-status ${getReservationStatus(
                                        nextReservation.status
                                    ).className
                                        }`}
                                >

                                    <Icon
                                        icon={
                                            getReservationStatus(
                                                nextReservation.status
                                            ).icon
                                        }
                                    />

                                    {
                                        getReservationStatus(
                                            nextReservation.status
                                        ).label
                                    }

                                </span>

                            </div>


                            <Icon
                                icon="humbleicons:arrow-right"
                                className="profile-next-arrow"
                            />

                        </button>

                    ) : (

                        <div className="profile-empty-card">

                            <div className="profile-empty-icon">

                                <Icon
                                    icon="solar:calendar-add-outline"
                                />

                            </div>


                            <div>

                                <strong>
                                    Nenhum atendimento agendado
                                </strong>


                                <span>
                                    Encontre um serviço e marque seu próximo atendimento.
                                </span>

                            </div>


                            <button
                                type="button"
                                onClick={
                                    openExplore
                                }
                            >

                                Encontrar serviços

                                <Icon
                                    icon="humbleicons:arrow-right"
                                />

                            </button>

                        </div>

                    )}

                </section>


                {/* ==================================================
                    HISTÓRICO
                    ================================================== */}

                <section className="profile-section">

                    <div className="profile-section-heading">

                        <div>

                            <span>
                                SEU HISTÓRICO
                            </span>


                            <h2>
                                Atividade recente
                            </h2>

                        </div>


                        {reservations.length > 5 && (

                            <button
                                type="button"
                                className="profile-see-all"
                                onClick={
                                    openReservations
                                }
                            >

                                Ver todas

                                <Icon
                                    icon="humbleicons:arrow-right"
                                />

                            </button>

                        )}

                    </div>


                    {latestReservations.length > 0 ? (

                        <div className="profile-history-list">

                            {latestReservations.map(
                                reservation => {

                                    const status =
                                        getReservationStatus(
                                            reservation.status
                                        );


                                    return (

                                        <button
                                            type="button"
                                            key={
                                                reservation.id
                                            }
                                            className="profile-history-item"
                                            onClick={() =>
                                                openReservationDetails(
                                                    reservation
                                                )
                                            }
                                        >

                                            <div className="profile-history-image">

                                                {reservation.productImage ? (

                                                    <img
                                                        src={
                                                            reservation.productImage
                                                        }
                                                        alt={
                                                            reservation.productName
                                                        }
                                                    />

                                                ) : (

                                                    <Icon
                                                        icon="solar:calendar-outline"
                                                    />

                                                )}

                                            </div>


                                            <div className="profile-history-info">

                                                <span>
                                                    {
                                                        reservation.companyName
                                                    }
                                                </span>


                                                <strong>
                                                    {
                                                        reservation.productName
                                                    }
                                                </strong>


                                                <small>

                                                    {
                                                        reservation.day ||
                                                        "Data não informada"
                                                    }

                                                    {" • "}

                                                    {
                                                        reservation.hour ||
                                                        "Horário não informado"
                                                    }

                                                </small>

                                            </div>


                                            <div className="profile-history-side">

                                                <strong>
                                                    {
                                                        reservation.productValue
                                                    }
                                                </strong>


                                                <span
                                                    className={`profile-status ${status.className}`}
                                                >

                                                    <Icon
                                                        icon={
                                                            status.icon
                                                        }
                                                    />

                                                    {status.label}

                                                </span>

                                            </div>


                                            <Icon
                                                icon="lucide:chevron-right"
                                                className="profile-history-arrow"
                                            />

                                        </button>

                                    );

                                }
                            )}

                        </div>

                    ) : (

                        <div className="profile-empty-card">

                            <div className="profile-empty-icon">

                                <Icon
                                    icon="solar:history-outline"
                                />

                            </div>


                            <div>

                                <strong>
                                    Seu histórico está vazio
                                </strong>


                                <span>
                                    Quando você fizer uma reserva, ela aparecerá aqui.
                                </span>

                            </div>


                            <button
                                type="button"
                                onClick={
                                    openExplore
                                }
                            >

                                Explorar

                                <Icon
                                    icon="humbleicons:arrow-right"
                                />

                            </button>

                        </div>

                    )}

                </section>


                {/* ==================================================
                    EMPRESAS
                    ================================================== */}

                <section
                    id="profile-companies"
                    className="profile-section"
                >

                    <div className="profile-section-heading">

                        <div>

                            <span>
                                SUAS EXPERIÊNCIAS
                            </span>


                            <h2>
                                Empresas visitadas
                            </h2>

                        </div>

                    </div>


                    {visitedCompanies.length > 0 ? (

                        <div className="profile-companies-list">

                            {visitedCompanies
                                .slice(0, 5)
                                .map(
                                    company => (

                                        <button
                                            type="button"
                                            key={
                                                company.handle
                                            }
                                            className="profile-company-item"
                                            onClick={() =>
                                                openCompany(
                                                    company
                                                )
                                            }
                                        >

                                            <div className="profile-company-logo">

                                                {company.logoPreview ? (

                                                    <img
                                                        src={
                                                            company.logoPreview
                                                        }
                                                        alt={
                                                            company.name ||
                                                            company.handle
                                                        }
                                                    />

                                                ) : (

                                                    <Icon
                                                        icon="solar:shop-2-outline"
                                                    />

                                                )}

                                            </div>


                                            <div className="profile-company-info">

                                                <strong>
                                                    {
                                                        company.name ||
                                                        company.handle
                                                    }
                                                </strong>


                                                <span>
                                                    {
                                                        company.description ||
                                                        "Empresa na Markfy"
                                                    }
                                                </span>

                                            </div>


                                            <Icon
                                                icon="lucide:chevron-right"
                                                className="profile-company-arrow"
                                            />

                                        </button>

                                    )
                                )}

                        </div>

                    ) : (

                        <div className="profile-discover-card">

                            <div className="profile-discover-icon">

                                <Icon
                                    icon="solar:compass-outline"
                                />

                            </div>


                            <div>

                                <span>
                                    EXPLORE
                                </span>


                                <strong>
                                    Você ainda não visitou nenhuma empresa
                                </strong>


                                <p>
                                    Explore empresas e encontre um serviço
                                    que combine com você.
                                </p>

                            </div>


                            <button
                                type="button"
                                onClick={
                                    openExplore
                                }
                            >

                                Explorar

                                <Icon
                                    icon="humbleicons:arrow-right"
                                />

                            </button>

                        </div>

                    )}

                </section>


                {/* ==================================================
                    CONTA
                    ================================================== */}

                <section className="profile-section">

                    <div className="profile-section-heading">

                        <div>

                            <span>
                                SUA CONTA
                            </span>


                            <h2>
                                Configurações
                            </h2>

                        </div>

                    </div>


                    <div className="profile-settings-card">

                        {/* DADOS */}

                        <button
                            type="button"
                            className="profile-setting-item"
                            onClick={
                                openEditProfile
                            }
                        >

                            <div className="profile-setting-icon">

                                <Icon
                                    icon="solar:user-outline"
                                />

                            </div>


                            <div className="profile-setting-content">

                                <strong>
                                    Dados pessoais
                                </strong>


                                <span>
                                    Nome e informações da sua conta
                                </span>

                            </div>


                            <Icon
                                icon="lucide:chevron-right"
                                className="profile-setting-arrow"
                            />

                        </button>


                        <div className="profile-setting-divider" />


                        {/* NOTIFICAÇÕES */}

                        <button
                            type="button"
                            className="profile-setting-item"
                            onClick={() =>
                                setActiveModal(
                                    "notifications"
                                )
                            }
                        >

                            <div className="profile-setting-icon">

                                <Icon
                                    icon="solar:bell-outline"
                                />

                            </div>


                            <div className="profile-setting-content">

                                <strong>
                                    Notificações
                                </strong>


                                <span>
                                    Seus próximos atendimentos e lembretes
                                </span>

                            </div>


                            <Icon
                                icon="lucide:chevron-right"
                                className="profile-setting-arrow"
                            />

                        </button>


                        <div className="profile-setting-divider" />


                        {/* SEGURANÇA */}

                        <button
                            type="button"
                            className="profile-setting-item"
                            onClick={() =>
                                setActiveModal(
                                    "security"
                                )
                            }
                        >

                            <div className="profile-setting-icon">

                                <Icon
                                    icon="solar:shield-check-outline"
                                />

                            </div>


                            <div className="profile-setting-content">

                                <strong>
                                    Segurança da conta
                                </strong>


                                <span>
                                    Senha, e-mail e identificação
                                </span>

                            </div>


                            <Icon
                                icon="lucide:chevron-right"
                                className="profile-setting-arrow"
                            />

                        </button>

                    </div>

                </section>


                {/* ==================================================
                    COMPARTILHAR
                    ================================================== */}

                <button
                    type="button"
                    className="profile-share-card"
                    onClick={
                        handleShareMarkfy
                    }
                >

                    <div className="profile-share-icon">

                        <Icon
                            icon="solar:share-outline"
                        />

                    </div>


                    <div>

                        <strong>
                            Compartilhar Markfy
                        </strong>


                        <span>
                            Mostre a Markfy para alguém.
                        </span>

                    </div>


                    <Icon
                        icon="lucide:arrow-up-right"
                    />

                </button>


                {/* ==================================================
                    LOGOUT
                    ================================================== */}

                <button
                    type="button"
                    className="profile-logout-button"
                    onClick={() =>
                        setActiveModal(
                            "logout"
                        )
                    }
                >

                    <Icon
                        icon="lucide:log-out"
                    />

                    Sair da conta

                </button>


                {/* ==================================================
                    FOOTER
                    ================================================== */}

                <footer className="profile-footer">

                    <span>
                        Markfy
                    </span>


                    <span>
                        Sua experiência, simplificada.
                    </span>

                </footer>

            </main>


            {/* ====================================================
                MODAL — EDITAR PERFIL
            ==================================================== */}

            <AnimatePresence>

                {activeModal === "edit-profile" && (

                    <motion.div
                        className="profile-modal-overlay"
                        initial={{
                            opacity: 0
                        }}
                        animate={{
                            opacity: 1
                        }}
                        exit={{
                            opacity: 0
                        }}
                        onClick={
                            closeModal
                        }
                    >

                        <motion.div
                            className="profile-modal"
                            initial={{
                                opacity: 0,
                                y: 24,
                                scale: 0.97
                            }}
                            animate={{
                                opacity: 1,
                                y: 0,
                                scale: 1
                            }}
                            exit={{
                                opacity: 0,
                                y: 18,
                                scale: 0.98
                            }}
                            transition={{
                                duration: 0.25,
                                ease: [
                                    0.22,
                                    1,
                                    0.36,
                                    1
                                ]
                            }}
                            onClick={event =>
                                event.stopPropagation()
                            }
                        >

                            <div className="profile-modal-header">

                                <div>

                                    <span>
                                        SUA CONTA
                                    </span>


                                    <h2>
                                        Dados pessoais
                                    </h2>


                                    <p>
                                        Atualize as informações
                                        utilizadas no seu perfil.
                                    </p>

                                </div>


                                <button
                                    type="button"
                                    onClick={
                                        closeModal
                                    }
                                    aria-label="Fechar"
                                >

                                    <Icon
                                        icon="lucide:x"
                                    />

                                </button>

                            </div>


                            <div className="profile-edit-avatar">

                                {userPhoto ? (

                                    <img
                                        src={
                                            userPhoto
                                        }
                                        alt={
                                            userName ||
                                            "Usuário"
                                        }
                                    />

                                ) : (

                                    <span>
                                        {userInitial}
                                    </span>

                                )}

                            </div>


                            <div className="profile-form">

                                <label>

                                    <span>
                                        Nome
                                    </span>


                                    <input
                                        type="text"
                                        value={
                                            editName
                                        }
                                        onChange={event =>
                                            setEditName(
                                                event.target.value
                                            )
                                        }
                                        placeholder="Digite seu nome"
                                        maxLength={80}
                                        autoFocus
                                    />

                                </label>


                                <label>

                                    <span>
                                        E-mail
                                    </span>


                                    <input
                                        type="email"
                                        value={
                                            userEmail
                                        }
                                        disabled
                                    />


                                    <small>
                                        O e-mail está vinculado à
                                        autenticação da sua conta.
                                    </small>

                                </label>


                                <div className="profile-form-info">

                                    <Icon
                                        icon="lucide:info"
                                    />


                                    <span>
                                        Seu nome será atualizado
                                        tanto no Firebase Authentication
                                        quanto no seu perfil Markfy.
                                    </span>

                                </div>

                            </div>


                            <div className="profile-modal-actions">

                                <button
                                    type="button"
                                    onClick={
                                        closeModal
                                    }
                                    disabled={
                                        savingProfile
                                    }
                                >

                                    Cancelar

                                </button>


                                <button
                                    type="button"
                                    className="profile-modal-primary"
                                    onClick={
                                        handleSaveProfile
                                    }
                                    disabled={
                                        savingProfile ||
                                        !editName.trim()
                                    }
                                >

                                    {savingProfile ? (

                                        <>
                                            <Icon
                                                icon="lucide:loader-2"
                                            />

                                            Salvando...

                                        </>

                                    ) : (

                                        <>
                                            <Icon
                                                icon="lucide:check"
                                            />

                                            Salvar alterações

                                        </>

                                    )}

                                </button>

                            </div>

                        </motion.div>

                    </motion.div>

                )}

            </AnimatePresence>


            {/* ====================================================
                MODAL — RESERVA
            ==================================================== */}

            <AnimatePresence>

                {activeModal === "reservation" &&
                    selectedReservation && (

                        <motion.div
                            className="profile-modal-overlay"
                            initial={{
                                opacity: 0
                            }}
                            animate={{
                                opacity: 1
                            }}
                            exit={{
                                opacity: 0
                            }}
                            onClick={
                                closeModal
                            }
                        >

                            <motion.div
                                className="profile-reservation-modal"
                                initial={{
                                    opacity: 0,
                                    y: 30,
                                    scale: 0.97
                                }}
                                animate={{
                                    opacity: 1,
                                    y: 0,
                                    scale: 1
                                }}
                                exit={{
                                    opacity: 0,
                                    y: 20,
                                    scale: 0.98
                                }}
                                transition={{
                                    duration: 0.25,
                                    ease: [
                                        0.22,
                                        1,
                                        0.36,
                                        1
                                    ]
                                }}
                                onClick={event =>
                                    event.stopPropagation()
                                }
                            >

                                <div className="profile-modal-header">

                                    <div>

                                        <span>
                                            RESERVA
                                        </span>


                                        <h2>
                                            Detalhes do atendimento
                                        </h2>

                                    </div>


                                    <button
                                        type="button"
                                        onClick={
                                            closeModal
                                        }
                                        aria-label="Fechar"
                                    >

                                        <Icon
                                            icon="lucide:x"
                                        />

                                    </button>

                                </div>


                                <div className="profile-reservation-hero">

                                    <div className="profile-reservation-image">

                                        {selectedReservation.productImage ? (

                                            <img
                                                src={
                                                    selectedReservation.productImage
                                                }
                                                alt={
                                                    selectedReservation.productName
                                                }
                                            />

                                        ) : (

                                            <Icon
                                                icon="solar:calendar-outline"
                                            />

                                        )}

                                    </div>


                                    <div>

                                        <span>
                                            {
                                                selectedReservation.companyName
                                            }
                                        </span>


                                        <h3>
                                            {
                                                selectedReservation.productName
                                            }
                                        </h3>


                                        <span
                                            className={`profile-status ${getReservationStatus(
                                                selectedReservation.status
                                            ).className
                                                }`}
                                        >

                                            <Icon
                                                icon={
                                                    getReservationStatus(
                                                        selectedReservation.status
                                                    ).icon
                                                }
                                            />

                                            {
                                                getReservationStatus(
                                                    selectedReservation.status
                                                ).label
                                            }

                                        </span>

                                    </div>

                                </div>


                                <div className="profile-reservation-details">

                                    <div>

                                        <span>
                                            DATA
                                        </span>


                                        <strong>
                                            {
                                                selectedReservation.day ||
                                                "Não informada"
                                            }
                                        </strong>

                                    </div>


                                    <div>

                                        <span>
                                            HORÁRIO
                                        </span>


                                        <strong>
                                            {
                                                selectedReservation.hour ||
                                                "Não informado"
                                            }
                                        </strong>

                                    </div>


                                    <div>

                                        <span>
                                            SERVIÇO
                                        </span>


                                        <strong>
                                            {
                                                selectedReservation.productName
                                            }
                                        </strong>

                                    </div>


                                    <div>

                                        <span>
                                            VALOR
                                        </span>


                                        <strong>
                                            {
                                                selectedReservation.productValue
                                            }
                                        </strong>

                                    </div>

                                </div>


                                {selectedReservation.productDescription && (

                                    <div className="profile-reservation-description">

                                        <span>
                                            SOBRE O SERVIÇO
                                        </span>


                                        <p>
                                            {
                                                selectedReservation.productDescription
                                            }
                                        </p>

                                    </div>

                                )}


                                <div className="profile-reservation-company">

                                    <div className="profile-company-logo">

                                        {selectedReservation.companyLogo ? (

                                            <img
                                                src={
                                                    selectedReservation.companyLogo
                                                }
                                                alt={
                                                    selectedReservation.companyName
                                                }
                                            />

                                        ) : (

                                            <Icon
                                                icon="solar:shop-2-outline"
                                            />

                                        )}

                                    </div>


                                    <div>

                                        <span>
                                            EMPRESA
                                        </span>


                                        <strong>
                                            {
                                                selectedReservation.companyName
                                            }
                                        </strong>

                                    </div>


                                    <button
                                        type="button"
                                        onClick={() => {

                                            const company =
                                                companyMap[
                                                selectedReservation.companyHandle
                                                ] || {
                                                    handle:
                                                        selectedReservation.companyHandle,
                                                    name:
                                                        selectedReservation.companyName
                                                };


                                            closeModal();


                                            openCompany(
                                                company
                                            );

                                        }}
                                    >

                                        Ver empresa

                                        <Icon
                                            icon="lucide:arrow-up-right"
                                        />

                                    </button>

                                </div>


                                <div className="profile-modal-actions">

                                    <button
                                        type="button"
                                        onClick={
                                            closeModal
                                        }
                                    >

                                        Fechar

                                    </button>


                                    <button
                                        type="button"
                                        className="profile-modal-primary"
                                        onClick={() => {

                                            closeModal();

                                            openReservations();

                                        }}
                                    >

                                        <Icon
                                            icon="solar:calendar-outline"
                                        />

                                        Ver minhas reservas

                                    </button>

                                </div>

                            </motion.div>

                        </motion.div>

                    )}

            </AnimatePresence>


            {/* ====================================================
                MODAL — NOTIFICAÇÕES
            ==================================================== */}

            <AnimatePresence>

                {activeModal === "notifications" && (

                    <motion.div
                        className="profile-sheet-overlay"
                        initial={{
                            opacity: 0
                        }}
                        animate={{
                            opacity: 1
                        }}
                        exit={{
                            opacity: 0
                        }}
                        onClick={
                            closeModal
                        }
                    >

                        <motion.div
                            className="profile-sheet"
                            initial={{
                                opacity: 0,
                                y: 30
                            }}
                            animate={{
                                opacity: 1,
                                y: 0
                            }}
                            exit={{
                                opacity: 0,
                                y: 30
                            }}
                            transition={{
                                duration: 0.25,
                                ease: [
                                    0.22,
                                    1,
                                    0.36,
                                    1
                                ]
                            }}
                            onClick={event =>
                                event.stopPropagation()
                            }
                        >

                            <div className="profile-sheet-header">

                                <div>

                                    <span>
                                        SUA AGENDA
                                    </span>


                                    <h2>
                                        Notificações
                                    </h2>


                                    <p>
                                        Acompanhe os próximos
                                        compromissos da sua conta.
                                    </p>

                                </div>


                                <button
                                    type="button"
                                    onClick={
                                        closeModal
                                    }
                                    aria-label="Fechar"
                                >

                                    <Icon
                                        icon="lucide:x"
                                    />

                                </button>

                            </div>


                            <div className="profile-notification-list">

                                {upcomingReservations.length > 0 ? (

                                    upcomingReservations
                                        .slice(
                                            0,
                                            5
                                        )
                                        .map(
                                            reservation => {

                                                const status =
                                                    getReservationStatus(
                                                        reservation.status
                                                    );


                                                return (

                                                    <button
                                                        type="button"
                                                        key={
                                                            reservation.id
                                                        }
                                                        className="profile-notification-item"
                                                        onClick={() =>
                                                            openReservationDetails(
                                                                reservation
                                                            )
                                                        }
                                                    >

                                                        <div className="profile-notification-icon">

                                                            <Icon
                                                                icon={
                                                                    status.icon
                                                                }
                                                            />

                                                        </div>


                                                        <div>

                                                            <strong>
                                                                {
                                                                    reservation.productName
                                                                }
                                                            </strong>


                                                            <span>
                                                                {
                                                                    reservation.companyName
                                                                }
                                                            </span>


                                                            <small>

                                                                {
                                                                    reservation.day ||
                                                                    "Data não informada"
                                                                }

                                                                {" • "}

                                                                {
                                                                    reservation.hour ||
                                                                    "Horário não informado"
                                                                }

                                                            </small>

                                                        </div>


                                                        <Icon
                                                            icon="lucide:chevron-right"
                                                        />

                                                    </button>

                                                );

                                            }
                                        )

                                ) : (

                                    <div className="profile-sheet-empty">

                                        <div>

                                            <Icon
                                                icon="solar:bell-off-outline"
                                            />

                                        </div>


                                        <strong>
                                            Nenhum lembrete no momento
                                        </strong>


                                        <span>
                                            Quando você tiver um próximo
                                            atendimento, ele aparecerá aqui.
                                        </span>


                                        <button
                                            type="button"
                                            onClick={() => {

                                                closeModal();

                                                openExplore();

                                            }}
                                        >

                                            Encontrar um serviço

                                            <Icon
                                                icon="humbleicons:arrow-right"
                                            />

                                        </button>

                                    </div>

                                )}

                            </div>

                        </motion.div>

                    </motion.div>

                )}

            </AnimatePresence>


            {/* ====================================================
                MODAL — SEGURANÇA
            ==================================================== */}

            <AnimatePresence>

                {activeModal === "security" && (

                    <motion.div
                        className="profile-sheet-overlay"
                        initial={{
                            opacity: 0
                        }}
                        animate={{
                            opacity: 1
                        }}
                        exit={{
                            opacity: 0
                        }}
                        onClick={
                            closeModal
                        }
                    >

                        <motion.div
                            className="profile-sheet"
                            initial={{
                                opacity: 0,
                                y: 30
                            }}
                            animate={{
                                opacity: 1,
                                y: 0
                            }}
                            exit={{
                                opacity: 0,
                                y: 30
                            }}
                            transition={{
                                duration: 0.25,
                                ease: [
                                    0.22,
                                    1,
                                    0.36,
                                    1
                                ]
                            }}
                            onClick={event =>
                                event.stopPropagation()
                            }
                        >

                            <div className="profile-sheet-header">

                                <div>

                                    <span>
                                        SUA CONTA
                                    </span>


                                    <h2>
                                        Segurança
                                    </h2>


                                    <p>
                                        Gerencie informações importantes
                                        para manter sua conta protegida.
                                    </p>

                                </div>


                                <button
                                    type="button"
                                    onClick={
                                        closeModal
                                    }
                                    aria-label="Fechar"
                                >

                                    <Icon
                                        icon="lucide:x"
                                    />

                                </button>

                            </div>


                            <div className="profile-security-list">

                                <div className="profile-security-card">

                                    <div className="profile-security-icon">

                                        <Icon
                                            icon="solar:shield-check-outline"
                                        />

                                    </div>


                                    <div>

                                        <strong>
                                            Conta autenticada
                                        </strong>


                                        <span>
                                            Sua conta está conectada
                                            ao Firebase Authentication.
                                        </span>

                                    </div>


                                    <Icon
                                        icon="lucide:check"
                                        className="profile-security-check"
                                    />

                                </div>


                                <div className="profile-security-card">

                                    <div className="profile-security-icon">

                                        <Icon
                                            icon="solar:letter-outline"
                                        />

                                    </div>


                                    <div>

                                        <strong>
                                            E-mail
                                        </strong>


                                        <span>
                                            {userEmail ||
                                                "Não informado"}
                                        </span>

                                    </div>

                                </div>


                                <div className="profile-security-card">

                                    <div className="profile-security-icon">

                                        <Icon
                                            icon="solar:lock-password-outline"
                                        />

                                    </div>


                                    <div>

                                        <strong>
                                            Senha
                                        </strong>


                                        <span>
                                            Redefina sua senha
                                            através do seu e-mail.
                                        </span>

                                    </div>


                                    <button
                                        type="button"
                                        onClick={
                                            handlePasswordReset
                                        }
                                        disabled={
                                            sendingPasswordReset ||
                                            passwordResetSent
                                        }
                                    >

                                        {passwordResetSent
                                            ? "Enviado"
                                            : sendingPasswordReset
                                                ? "Enviando..."
                                                : "Redefinir"
                                        }

                                    </button>

                                </div>


                                <button
                                    type="button"
                                    className="profile-security-id"
                                    onClick={
                                        handleCopyUid
                                    }
                                >

                                    <div className="profile-security-icon">

                                        <Icon
                                            icon="solar:key-outline"
                                        />

                                    </div>


                                    <div>

                                        <strong>
                                            ID da conta
                                        </strong>


                                        <span>
                                            {user.uid}
                                        </span>

                                    </div>


                                    <Icon
                                        icon="solar:copy-outline"
                                    />

                                </button>

                            </div>


                            {passwordResetSent && (

                                <div className="profile-security-success">

                                    <Icon
                                        icon="lucide:check-circle-2"
                                    />


                                    <div>

                                        <strong>
                                            E-mail enviado
                                        </strong>


                                        <span>
                                            Verifique sua caixa de entrada
                                            para continuar a redefinição.
                                        </span>

                                    </div>

                                </div>

                            )}

                        </motion.div>

                    </motion.div>

                )}

            </AnimatePresence>


            {/* ====================================================
                MODAL — LOGOUT
            ==================================================== */}

            <AnimatePresence>

                {activeModal === "logout" && (

                    <motion.div
                        className="profile-modal-overlay"
                        initial={{
                            opacity: 0
                        }}
                        animate={{
                            opacity: 1
                        }}
                        exit={{
                            opacity: 0
                        }}
                        onClick={
                            closeModal
                        }
                    >

                        <motion.div
                            className="profile-logout-modal"
                            initial={{
                                opacity: 0,
                                y: 20,
                                scale: 0.96
                            }}
                            animate={{
                                opacity: 1,
                                y: 0,
                                scale: 1
                            }}
                            exit={{
                                opacity: 0,
                                y: 10,
                                scale: 0.97
                            }}
                            transition={{
                                duration: 0.22
                            }}
                            onClick={event =>
                                event.stopPropagation()
                            }
                        >

                            <div className="profile-logout-icon">

                                <Icon
                                    icon="lucide:log-out"
                                />

                            </div>


                            <div className="profile-logout-content">

                                <span>
                                    SUA CONTA
                                </span>


                                <h2>
                                    Sair da Markfy?
                                </h2>


                                <p>
                                    Sua sessão será encerrada
                                    neste dispositivo. Você poderá
                                    entrar novamente quando quiser.
                                </p>

                            </div>


                            <div className="profile-logout-actions">

                                <button
                                    type="button"
                                    disabled={
                                        loggingOut
                                    }
                                    onClick={
                                        closeModal
                                    }
                                >

                                    Cancelar

                                </button>


                                <button
                                    type="button"
                                    className="profile-logout-confirm"
                                    disabled={
                                        loggingOut
                                    }
                                    onClick={
                                        handleLogout
                                    }
                                >

                                    {loggingOut ? (

                                        <>
                                            <Icon
                                                icon="lucide:loader-2"
                                            />

                                            Saindo...

                                        </>

                                    ) : (

                                        <>
                                            <Icon
                                                icon="lucide:log-out"
                                            />

                                            Sair da conta

                                        </>

                                    )}

                                </button>

                            </div>

                        </motion.div>

                    </motion.div>

                )}

            </AnimatePresence>


            {/* ====================================================
                FEEDBACK
            ==================================================== */}

            <AnimatePresence>

                {feedback && (

                    <motion.div
                        className={`profile-feedback profile-feedback--${feedback.type}`}
                        initial={{
                            opacity: 0,
                            y: 12,
                            scale: 0.97
                        }}
                        animate={{
                            opacity: 1,
                            y: 0,
                            scale: 1
                        }}
                        exit={{
                            opacity: 0,
                            y: 8,
                            scale: 0.98
                        }}
                    >

                        <div className="profile-feedback-icon">

                            <Icon
                                icon={
                                    feedback.type === "success"
                                        ? "lucide:check-circle-2"
                                        : "lucide:alert-circle"
                                }
                            />

                        </div>


                        <div>

                            <strong>
                                {feedback.title}
                            </strong>


                            <span>
                                {feedback.message}
                            </span>

                        </div>


                        <button
                            type="button"
                            onClick={() =>
                                setFeedback(
                                    null
                                )
                            }
                            aria-label="Fechar aviso"
                        >

                            <Icon
                                icon="lucide:x"
                            />

                        </button>

                    </motion.div>

                )}

            </AnimatePresence>

        </div>

    );

};


export default Profile;