import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
    getDatabase,
    ref,
    get,
    set,
    update,
    query,
    orderByChild,
    equalTo
} from "firebase/database";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import './Invite.css';
import { Icon } from '@iconify/react'

import Logo from '../../img/logo-markfy.png'

import { useNavigate } from "react-router-dom";

import { useUserCompany } from "../../contexts/companyContext/UserCompanyContext";
import Toast from "../../components/toast/Toast";

export default function Invite() {
    const navigate = useNavigate();
    const { refreshCompany } = useUserCompany();

    const { inviteId } = useParams();

    const [invite, setInvite] = useState(null);
    const [pageState, setPageState] = useState("loading");

    const getFirstName = (name) => {
        if (!name) return "";

        return name
            .trim()
            .split(" ")[0]
            .slice(0, 14);
    };

    const [toast, setToast] = useState({
        show: false,
        type: "info",
        title: "",
        message: ""
    });

    const showToast = (type, title, message) => {

        setToast({
            show: true,
            type,
            title,
            message
        });

    };

    const closeToast = () => {

        setToast(prev => ({
            ...prev,
            show: false
        }));

    };

    useEffect(() => {

        const loadInvite = async () => {

            try {

                const db = getDatabase();

                // =========================
                // Busca o convite
                // =========================

                const inviteRef = ref(db, `invites/${inviteId}`);

                const inviteSnap = await get(inviteRef);

                if (!inviteSnap.exists()) {

                    setPageState("invalid");

                    return;

                }

                const inviteData = inviteSnap.val();

                // =========================
                // Convite já aceito
                // =========================

                if (inviteData.status !== "pending") {

                    setPageState("expired");

                    return;

                }

                // =========================
                // Convite expirado
                // =========================

                if (
                    inviteData.expiresAt &&
                    Date.now() > inviteData.expiresAt
                ) {

                    await update(inviteRef, {

                        status: "expired"

                    });

                    setPageState("expired");

                    return;

                }

                // =========================
                // Empresa ainda existe?
                // =========================

                /*
                 * Só precisamos saber se a empresa existe.
                 *
                 * Ler companys/{handle} inteiro traria
                 * produtos, agendamentos e pedidos.
                 */

                const companyRef = ref(
                    db,
                    `companys/${inviteData.companyHandle}/name`
                );

                const companySnap = await get(companyRef);

                if (!companySnap.exists()) {

                    setPageState("invalid");

                    return;

                }

                /*
                 * =========================
                 * A conta já existe?
                 * =========================
                 *
                 * Consulta por e-mail em vez de baixar o nó
                 * "users" inteiro. Esta é uma rota pública:
                 * a leitura completa expunha nome e e-mail
                 * de toda a base.
                 *
                 * Requer .indexOn: ["email"] em "users".
                 *
                 * equalTo diferencia maiúsculas, então
                 * testamos também o e-mail como veio no
                 * convite, caso tenha sido gravado assim.
                 */

                const invitedEmail =
                    inviteData.invitedEmail;

                const lowercasedEmail =
                    invitedEmail.toLowerCase();

                const findUserByEmail = async (email) => {

                    const snapshot = await get(
                        query(
                            ref(db, "users"),
                            orderByChild("email"),
                            equalTo(email)
                        )
                    );

                    return snapshot.exists();

                };

                let accountExists =
                    await findUserByEmail(lowercasedEmail);

                if (
                    !accountExists &&
                    invitedEmail !== lowercasedEmail
                ) {

                    accountExists =
                        await findUserByEmail(invitedEmail);

                }

                setInvite({
                    ...inviteData,
                    accountExists
                });
            }

            catch (err) {

                console.error(err);

                setPageState("invalid");

            }

        };

        loadInvite();



    }, [inviteId]);

    useEffect(() => {

        if (!invite) return;

        const auth = getAuth();

        const unsubscribe = onAuthStateChanged(auth, (user) => {

            if (!user) {

                setPageState(
                    invite.accountExists
                        ? "login"
                        : "register"
                );

                return;

            }

            if (
                user.email?.toLowerCase() !==
                invite.invitedEmail.toLowerCase()
            ) {

                setPageState("wrong-account");
                return;

            }

            setPageState("ready");

        });

        return unsubscribe;

    }, [invite]);

    const redirectToLogin = () => {

        navigate(`/login?invite=${inviteId}`);

    };

    const redirectToRegister = () => {

        navigate(`/register?invite=${inviteId}`);

    };

    const goToPanel = async () => {

        await refreshCompany();

        navigate("/central-adm");

    };

    const renderLoading = () => {

        return (

            <div className="invite-state">
                <div className="invite-state-icon invite-state-icon--loading">
                    <div className="invite-spinner"></div>
                </div>
                <h2>Preparando seu convite</h2>
                <p>
                    Estamos verificando as informações do convite.
                </p>
            </div>

        );

    };

    const renderLogin = () => {
        return (
            <div className="invite-state">

                <button
                    className="invite-button"
                    onClick={redirectToLogin}
                >
                    Entrar
                </button>

            </div>
        );

    };

    const renderRegister = () => {

        return (

            <div className="invite-state">

                <button
                    className="invite-button"
                    onClick={redirectToRegister}
                >
                    Criar conta
                </button>

            </div>

        );

    };

    /*const renderWrongAccount = () => {

        return (

            <div className="invite-state">

                <div className="invite-state-icon invite-state-icon--warning">

                    <Icon icon="solar:user-cross-bold" />

                </div>

                <h2>Esta não é a conta correta</h2>

                <p>

                    Este convite foi enviado para

                </p>

                <div className="invite-email">

                    {invite?.invitedEmail}

                </div>

                <p className="invite-small-text">

                    Entre com este endereço de e-mail para aceitar o convite.

                </p>

                <button className="invite-button">

                    Trocar de conta

                </button>

            </div>

        );

    };*/

    const renderWrongAccount = () => {

        return (

            <div className="invite-state">

                <div className="invite-email">

                    {invite?.invitedEmail}

                </div>

                <button
                    className="invite-button"
                >
                    Trocar de conta
                </button>

            </div>

        );

    };

    const renderInvalid = () => {

        return (

            <div className="invite-state">

                <h2>Convite não encontrado</h2>

                <p>

                    Este link é inválido ou não existe mais.

                </p>

            </div>

        );

    };

    const renderExpired = () => {

        return (

            <div className="invite-state">

                <h2>Convite indisponível</h2>

                <p>
                    Este convite já foi utilizado ou expirou.
                </p>

            </div>

        );

    };

    const renderReady = () => {

        return (

            <div className="invite-state">

                <button
                    className="invite-button"
                    onClick={handleAcceptInvite}
                >
                    Aceitar convite
                </button>

            </div>

        );

    };

    const renderAccepting = () => {

        return (

            <div className="invite-state">

                <div className="invite-state-icon invite-state-icon--loading">

                    <div className="invite-spinner"></div>

                </div>

                <h2>Entrando na equipe...</h2>

                <p>

                    Estamos adicionando você à empresa.

                </p>

            </div>

        );

    };

    const renderSuccess = () => {

        return (

            <div className="invite-state">

                <div className="invite-state-icon invite-state-icon--success">
                    <Icon icon="solar:check-circle-linear" />
                </div>

                <button
                    className="invite-button"
                    onClick={goToPanel}
                >
                    Ir para o painel
                </button>

            </div>

        );

    };

    const renderAlreadyMember = () => {

        return (

            <div className="invite-state">

                <div className="invite-state-icon invite-state-icon--success">

                    <Icon icon="solar:users-group-rounded-bold" />

                </div>

                <h2>Você já faz parte da equipe</h2>

                <p>

                    Sua conta já estava vinculada a esta empresa.
                    O convite foi encerrado automaticamente e você já pode acessar o painel.

                </p>

                <button
                    className="invite-button"
                    onClick={goToPanel}
                >
                    Ir para o painel
                </button>

            </div>

        );

    };

    const renderContent = () => {

        switch (pageState) {

            case "loading":
                return renderLoading();

            case "login":
                return renderLogin();
            case "register":
                return renderRegister();
            case "wrong-account":
                return renderWrongAccount();

            case "invalid":
                return renderInvalid();

            case "expired":
                return renderExpired();

            case "ready":
                return renderReady();

            case "accepting":
                return renderAccepting();

            case "already-member":
                return renderAlreadyMember();

            case "success":
                return renderSuccess();

            default:
                return null;

        }

    };

    const handleAcceptInvite = async () => {
        setToast(prev => ({
            ...prev,
            show: false
        }));
        setPageState("accepting");

        try {

            const auth = getAuth();
            const user = auth.currentUser;

            if (!user) {

                showToast(
                    "warning",
                    "Login necessário",
                    "Entre na sua conta para aceitar este convite."
                );

                setPageState("login");

                return;
            }

            const db = getDatabase();

            const memberRef = ref(
                db,
                `companys/${invite.companyHandle}/members/${user.uid}`
            );

            const memberSnapshot = await get(memberRef);

            if (memberSnapshot.exists()) {

                await update(
                    ref(db, `invites/${inviteId}`),
                    {
                        status: "accepted",
                        acceptedAt: Date.now(),
                        acceptedBy: user.uid
                    }
                );

                showToast(
                    "info",
                    "Você já faz parte da equipe",
                    "Este convite foi encerrado automaticamente."
                );

                setPageState("already-member");

                return;
            }

            await set(
                ref(
                    db,
                    `companys/${invite.companyHandle}/members/${user.uid}`
                ),
                {
                    role: invite.role,
                    joinedAt: Date.now(),
                    invitedBy: invite.inviterUid
                }
            );

            // Atualiza o usuário
            await update(
                ref(db, `users/${user.uid}`),
                {
                    companyHandle: invite.companyHandle,
                    userType: "admin",
                    initial: false
                }
            );

            // Atualiza o convite
            await update(
                ref(db, `invites/${inviteId}`),
                {
                    status: "accepted",
                    acceptedAt: Date.now(),
                    acceptedBy: user.uid
                }
            );

            setPageState("success");

        } catch (error) {

            console.error(error);

            showToast(
                "error",
                "Não foi possível aceitar o convite",
                "Ocorreu um erro inesperado. Tente novamente em alguns instantes."
            );

            setPageState("ready");

        }
    };

    const getStatusInfo = () => {

        switch (pageState) {

            case "loading":
                return {
                    type: "info",
                    icon: "svg-spinners:ring-resize",
                    title: "Preparando seu convite..."
                };

            case "login":
                return {
                    type: "warning",
                    icon: "solar:login-3-bold",
                    title: "É necessário entrar na sua conta."
                };

            case "register":
                return {
                    type: "info",
                    icon: "solar:user-plus-bold",
                    title: "Crie sua conta para continuar."
                };

            case "wrong-account":
                return {
                    type: "error",
                    icon: "solar:user-cross-bold",
                    title: "Você entrou com a conta incorreta."
                };

            case "invalid":
                return {
                    type: "error",
                    icon: "solar:danger-triangle-bold",
                    title: "Este convite não é válido."
                };

            case "expired":
                return {
                    type: "warning",
                    icon: "solar:clock-circle-bold",
                    title: "Este convite expirou."
                };

            case "ready":
                return {
                    type: "success",
                    icon: "solar:check-circle-bold",
                    title: "Tudo pronto para aceitar o convite."
                };

            case "accepting":
                return {
                    type: "info",
                    icon: "svg-spinners:ring-resize",
                    title: "Entrando na equipe..."
                };

            case "already-member":
                return {
                    type: "info",
                    icon: "solar:users-group-rounded-bold",
                    title: "Você já faz parte desta empresa."
                };

            case "success":
                return {
                    type: "success",
                    icon: "solar:check-circle-bold",
                    title: "Agora você faz parte da equipe."
                };

            default:
                return {
                    type: "info",
                    icon: "solar:info-circle-bold",
                    title: ""
                };

        }

    };

    const status = getStatusInfo();

    return (
        <div className="invite-page">

            <main className="invite-card">

                <header className="invite-header">

                    <div className="invite-header-start">

                        <img
                            src={Logo}
                            alt="Markfy"
                            className="invite-header-logo"
                        />

                    </div>

                    <div className="invite-header-middle">

                        <p>

                            Convite para <strong>{invite?.companyName}</strong>

                        </p>

                    </div>

                    <button className="invite-header-menu">

                        <Icon icon="solar:menu-dots-bold" />

                    </button>

                </header>

                <section className="invite-content">

                    <div className="invite-content-header">

                        <div className={`invite-status invite-status--${status.type}`}>
                            <div className="invite-status-start">
                                <Icon
                                    icon={status.icon}
                                    className="invite-status-icon"
                                />
                            </div>

                            <div className="invite-status-middle">
                                {status.title}
                            </div>

                            <button className="invite-status-end">

                                <Icon icon="solar:question-circle-linear" />

                            </button>

                        </div>

                    </div>

                    <div className="invite-summary">

                        <div className="invite-summary-item">

                            <div className="invite-summary-start">

                                <Icon
                                    icon="solar:crown-linear"
                                    className="invite-summary-icon invite-summary-icon--owner"
                                />

                                <span>Convidado por</span>

                            </div>

                            <div className="invite-summary-end">

                                {invite?.inviterName}

                            </div>

                        </div>

                        <div className="invite-summary-item">

                            <div className="invite-summary-start">

                                <Icon
                                    icon="solar:user-linear"
                                    className="invite-summary-icon"
                                />

                                <span>Convidado</span>

                            </div>

                            <div className="invite-summary-end">

                                {invite?.invitedEmail}

                            </div>

                        </div>

                    </div>

                    <div className="invite-content-body">

                        {renderContent()}

                    </div>

                </section>

            </main>

            <Toast
                show={toast.show}
                type={toast.type}
                title={toast.title}
                message={toast.message}
                onClose={closeToast}
            />
        </div>
    );

}