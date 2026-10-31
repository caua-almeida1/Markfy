import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { getDatabase, ref, update } from "firebase/database";

import { useUserCompany } from "../../../../../../contexts/companyContext/UserCompanyContext";
import { useLicense } from "../../../../../../plans/LicenseContext";
import {
    CHECK_PROBLEMS,
    CONNECT_RETURN_MESSAGES,
    FAILURE_HINTS,
    disconnectPaymentAccount,
    startMercadoPagoConnection,
    verifyPaymentConnection
} from "../../../../../../firebase/paymentsApi";

import "../../PaymentScreen.css";
import "./PaymentsScreen.css";


/* =========================================================
   CONFIGURAÇÕES → PAGAMENTOS

   Uma tela só, no lugar de Formas de Pagamento → Cartões /
   Pix (que tinham interruptores que nada liam):

     1. Conta de recebimento: conectar, testar, reconectar,
        desconectar. O status vem do backend
        (paymentSettings/mercadoPago, sem token nenhum).
     2. O que os clientes podem usar: pagamento antecipado e
        mensalidade ficam disponíveis sozinhos com a conta
        conectada.
     3. "Cobrar antecipado em todos os serviços" (o antigo
        "Receber antes do agendamento"). Desligado, cada
        serviço escolhe na criação do produto.

   Só o administrador mexe; o resto da equipe vê o status.
========================================================= */

const MANAGER_ROLES = ["master", "administrator", "administrador"];

const ENVIRONMENT_LABELS = {
    production: "Produção · cobranças reais",
    test: "Teste · nenhuma cobrança é real"
};

const formatDate = (ms) =>
    ms ? new Date(ms).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" }) : "";


const PaymentsScreen = ({ returnStatus = null }) => {

    const license = useLicense();

    const { company, companies } = useUserCompany() || {};

    const handle = company?.handle;
    const settings = company?.paymentSettings || {};
    const mercadoPago = settings.mercadoPago || {};

    const role = (companies || []).find((item) => item.handle === handle)?.role || null;
    const canManage = MANAGER_ROLES.includes(role);

    const connected = mercadoPago.connected === true;
    const needsReconnect = mercadoPago.status === "reconnect_required";
    const everConnected = connected || needsReconnect;

    const [busy, setBusy] = useState(null);
    const [banner, setBanner] = useState(null);
    const [check, setCheck] = useState(null);
    const [confirmDisconnect, setConfirmDisconnect] = useState(null);
    const [savingAll, setSavingAll] = useState(false);

    /* Voltou do Mercado Pago (?mercadoPago=connected|error). */
    useEffect(() => {
        if (!returnStatus) return;
        const message = CONNECT_RETURN_MESSAGES[returnStatus] || CONNECT_RETURN_MESSAGES.default;
        setBanner(message);
    }, [returnStatus]);

    const lastCheck = check || mercadoPago.lastCheck || null;
    const environment = mercadoPago.environment || lastCheck?.environment || null;
    const failure = mercadoPago.lastFailure && FAILURE_HINTS[mercadoPago.lastFailure.code]
        ? { ...FAILURE_HINTS[mercadoPago.lastFailure.code], at: mercadoPago.lastFailure.at }
        : null;

    const fail = (error, title) =>
        setBanner({
            tone: "danger",
            title,
            message: error?.message || "Tente de novo em instantes."
        });


    /* ---------------- AÇÕES ---------------- */

    const connect = async () => {

        if (!handle || busy) return;

        if (!license.can("onlinePayments")) {
            setBanner({
                tone: "warning",
                title: "Pagamentos online não estão no seu plano",
                message: "O administrador principal pode mudar de plano em Perfil → Planos e Assinaturas."
            });
            return;
        }

        setBusy("connect");
        setBanner(null);

        try {

            const { authorizationUrl } = await startMercadoPagoConnection(handle);

            if (!/^https:\/\/auth\.mercadopago\.com(\.br)?\//.test(authorizationUrl || "")) {
                throw new Error("O Mercado Pago não devolveu o link de autorização.");
            }

            window.location.assign(authorizationUrl);

        } catch (error) {
            fail(error, "Não foi possível abrir o Mercado Pago");
            setBusy(null);
        }
    };

    const verify = async () => {

        if (!handle || busy) return;

        setBusy("verify");
        setBanner(null);

        try {
            setCheck(await verifyPaymentConnection(handle));
        } catch (error) {
            fail(error, "Não foi possível testar agora");
        } finally {
            setBusy(null);
        }
    };

    const disconnect = async (force = false) => {

        if (!handle || busy) return;

        setBusy("disconnect");

        try {

            await disconnectPaymentAccount(handle, { confirm: force });

            setConfirmDisconnect(null);
            setCheck(null);
            setBanner({
                tone: "success",
                title: "Conta desconectada",
                message: "Os clientes não pagam mais online até você conectar uma conta de novo."
            });

        } catch (error) {

            if (error?.code === "has_open_subscriptions") {
                setConfirmDisconnect({ step: "subscriptions", message: error.message });
            } else {
                fail(error, "Não foi possível desconectar");
            }

        } finally {
            setBusy(null);
        }
    };

    const toggleAll = async () => {

        if (!handle || savingAll || !canManage) return;

        setSavingAll(true);

        try {
            await update(ref(getDatabase(), `companys/${handle}/paymentSettings`), {
                receiveBeforeBooking: settings.receiveBeforeBooking !== true
            });
        } catch (error) {
            fail(error, "Não foi possível salvar");
        } finally {
            setSavingAll(false);
        }
    };


    /* ---------------- PEDAÇOS ---------------- */

    const statusLine = connected
        ? [mercadoPago.accountLabel ? `Conta ${mercadoPago.accountLabel}` : "Conta conectada", ENVIRONMENT_LABELS[environment]]
            .filter(Boolean)
            .join(" · ")
        : needsReconnect
            ? "O acesso da Markfy expirou ou foi removido no Mercado Pago."
            : "Conecte a conta que vai receber os pagamentos.";

    const modality = (title, description, icon) => (
        <div className="payment-method pay-modality">
            <div className="payment-method-left">
                <div className={`payment-method-icon ${connected ? "payment-method-icon-connected" : ""}`}>
                    <Icon icon={icon} />
                </div>
                <div className="payment-method-content">
                    <h3>{title}</h3>
                    <p>{description}</p>
                </div>
            </div>
            <span className={`pay-pill ${connected ? "is-on" : "is-off"}`}>
                {connected ? "Disponível" : "Conecte a conta"}
            </span>
        </div>
    );

    return (

        <div className="payment-screen pay-screen">

            <div className="payment-info">
                <div className="payment-info-icon">
                    <Icon icon="solar:wallet-money-outline" />
                </div>
                <div className="payment-info-content">
                    <h3>Pagamentos</h3>
                    <p>
                        Receba dos seus clientes pelo Mercado Pago. O dinheiro cai direto na
                        sua conta; a Markfy não guarda dados de cartão.
                    </p>
                </div>
            </div>

            {banner && (
                <div className={`pay-banner is-${banner.tone}`} role={banner.tone === "danger" ? "alert" : "status"}>
                    <Icon
                        icon={banner.tone === "success" ? "solar:check-circle-bold" : "solar:danger-circle-outline"}
                    />
                    <div>
                        <strong>{banner.title}</strong>
                        <span>{banner.message}</span>
                    </div>
                    <button type="button" className="pay-banner-close" aria-label="Fechar aviso" onClick={() => setBanner(null)}>
                        <Icon icon="solar:close-circle-linear" />
                    </button>
                </div>
            )}


            {/* ============ 1. CONTA DE RECEBIMENTO ============ */}

            <section className="payment-section" aria-labelledby="pay-account-title">

                <h3 className="payment-section-title" id="pay-account-title">Conta de recebimento</h3>

                <div className="payment-methods-card pay-account">

                    <div className="pay-account-head">

                        <div className={`payment-method-icon ${connected ? "payment-method-icon-connected" : ""}`}>
                            <Icon icon={connected ? "solar:check-circle-outline" : "solar:wallet-outline"} />
                        </div>

                        <div className="pay-account-text">
                            <h3>Mercado Pago</h3>
                            <p>{statusLine}</p>
                        </div>

                        <span className={`pay-pill ${connected ? "is-on" : needsReconnect ? "is-danger" : "is-off"}`}>
                            {connected ? "Conectado" : needsReconnect ? "Reconectar" : "Não conectado"}
                        </span>

                    </div>

                    {connected && mercadoPago.connectedAt && (
                        <p className="pay-account-meta">Conectado em {formatDate(mercadoPago.connectedAt)}.</p>
                    )}

                    {canManage ? (

                        <div className="pay-actions">

                            {!connected && (
                                <button
                                    type="button"
                                    className="pay-button pay-button--primary"
                                    disabled={Boolean(busy)}
                                    onClick={connect}
                                >
                                    {busy === "connect"
                                        ? <Icon icon="svg-spinners:ring-resize" />
                                        : <Icon icon="solar:link-round-angle-outline" />}
                                    <span>{needsReconnect ? "Reconectar Mercado Pago" : "Conectar Mercado Pago"}</span>
                                </button>
                            )}

                            {connected && (
                                <button
                                    type="button"
                                    className="pay-button"
                                    disabled={Boolean(busy)}
                                    onClick={verify}
                                >
                                    {busy === "verify"
                                        ? <Icon icon="svg-spinners:ring-resize" />
                                        : <Icon icon="solar:shield-check-outline" />}
                                    <span>Testar conexão</span>
                                </button>
                            )}

                            {everConnected && !confirmDisconnect && (
                                <button
                                    type="button"
                                    className="pay-button pay-button--ghost"
                                    disabled={Boolean(busy)}
                                    onClick={() => setConfirmDisconnect({ step: "ask" })}
                                >
                                    <Icon icon="solar:link-broken-outline" />
                                    <span>Desconectar</span>
                                </button>
                            )}

                        </div>

                    ) : (

                        <p className="pay-account-meta">
                            Só o administrador da empresa conecta ou troca a conta de recebimento.
                        </p>
                    )}

                    {confirmDisconnect && (
                        <div className="pay-confirm" role="alertdialog" aria-label="Confirmar desconexão">
                            <p>
                                {confirmDisconnect.step === "subscriptions"
                                    ? confirmDisconnect.message
                                    : "Desconectar a conta? Os clientes deixam de pagar online e os serviços com pagamento antecipado não aceitam novos agendamentos até você conectar de novo."}
                            </p>
                            <div className="pay-actions">
                                <button
                                    type="button"
                                    className="pay-button pay-button--ghost"
                                    disabled={busy === "disconnect"}
                                    onClick={() => setConfirmDisconnect(null)}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    className="pay-button pay-button--danger"
                                    disabled={busy === "disconnect"}
                                    onClick={() => disconnect(confirmDisconnect.step === "subscriptions")}
                                >
                                    {busy === "disconnect" && <Icon icon="svg-spinners:ring-resize" />}
                                    <span>{confirmDisconnect.step === "subscriptions" ? "Desconectar mesmo assim" : "Desconectar"}</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {lastCheck && connected && (
                        <ul className="pay-checklist" aria-label="Resultado do teste">
                            <li className={lastCheck.payments ? "is-ok" : "is-bad"}>
                                <Icon icon={lastCheck.payments ? "solar:check-circle-bold" : "solar:close-circle-bold"} />
                                <span>Conta respondendo{lastCheck.accountLabel ? ` (${lastCheck.accountLabel})` : ""}</span>
                            </li>
                            <li className={lastCheck.subscriptions ? "is-ok" : "is-bad"}>
                                <Icon icon={lastCheck.subscriptions ? "solar:check-circle-bold" : "solar:close-circle-bold"} />
                                <span>Assinaturas (mensalidade) liberadas</span>
                            </li>
                            {lastCheck.environment && (
                                <li className="is-info">
                                    <Icon icon="solar:info-circle-bold" />
                                    <span>
                                        {lastCheck.environment === "test"
                                            ? "Conta de TESTE: use um comprador de teste e cartões de teste. Nada é cobrado de verdade."
                                            : "Conta REAL: as cobranças são de verdade. Cartões de teste do Mercado Pago são sempre recusados aqui."}
                                    </span>
                                </li>
                            )}
                            {lastCheck.problem && (
                                <li className="is-bad">
                                    <Icon icon="solar:danger-circle-bold" />
                                    <span>{CHECK_PROBLEMS[lastCheck.problem] || "O Mercado Pago não confirmou a conexão."}</span>
                                </li>
                            )}
                            {lastCheck.at && (
                                <li className="pay-checklist-at">Testado em {formatDate(lastCheck.at)}</li>
                            )}
                        </ul>
                    )}

                </div>

            </section>


            {failure && (
                <div className="pay-banner is-warning" role="status">
                    <Icon icon="solar:danger-triangle-outline" />
                    <div>
                        <strong>{failure.title}</strong>
                        <span>{failure.message}</span>
                        {failure.at && <small>Última vez: {formatDate(failure.at)}</small>}
                    </div>
                </div>
            )}


            {/* ============ 2. O QUE O CLIENTE PODE USAR ============ */}

            <section className="payment-section" aria-labelledby="pay-modalities-title">

                <h3 className="payment-section-title" id="pay-modalities-title">O que seus clientes podem usar</h3>

                <div className="payment-methods-card">
                    {modality(
                        "Pagamento antecipado",
                        "O cliente paga uma vez, com Pix ou cartão, antes do atendimento.",
                        "solar:card-send-outline"
                    )}
                    {modality(
                        "Mensalidade",
                        "O cliente assina e paga todo mês, sozinho, no cartão de crédito ou na conta Mercado Pago.",
                        "solar:refresh-circle-outline"
                    )}
                </div>

                <p className="pay-footnote">
                    Você escolhe a modalidade de cada serviço em Produtos → Novo.
                </p>

            </section>


            {/* ============ 3. TODOS OS SERVIÇOS ============ */}

            <section className="payment-section" aria-labelledby="pay-all-title">

                <h3 className="payment-section-title" id="pay-all-title">Regra geral</h3>

                <div className="payment-methods-card">
                    <div className="payment-config-toggle">
                        <div className="payment-config-toggle-left">
                            <div className="payment-method-icon">
                                <Icon icon="solar:lock-keyhole-minimalistic-outline" />
                            </div>
                            <div>
                                <h3>Cobrar antecipado em todos os serviços</h3>
                                <p>
                                    {settings.receiveBeforeBooking === true
                                        ? "Ligado: todo serviço avulso exige pagamento antes de confirmar o horário."
                                        : "Desligado: cada serviço segue o que foi escolhido na criação."}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            className={`toggle-switch ${settings.receiveBeforeBooking === true ? "active" : ""}`}
                            disabled={!canManage || savingAll}
                            onClick={toggleAll}
                            role="switch"
                            aria-checked={settings.receiveBeforeBooking === true}
                            aria-label="Cobrar antecipado em todos os serviços"
                        >
                            <span className="toggle-circle" />
                        </button>
                    </div>
                </div>

                {settings.receiveBeforeBooking === true && !connected && (
                    <p className="pay-footnote is-danger">
                        Sem conta conectada, serviços com pagamento antecipado não aceitam agendamentos online.
                    </p>
                )}

            </section>


            {/* ============ COMO TESTAR ============ */}

            <details className="pay-howto">
                <summary>
                    <Icon icon="solar:test-tube-outline" />
                    <span>Como testar sem dinheiro de verdade</span>
                </summary>
                <ol>
                    <li>No painel do Mercado Pago (Suas integrações → Contas de teste), crie um <strong>vendedor</strong> e um <strong>comprador</strong> de teste.</li>
                    <li>Numa empresa de teste da Markfy, toque em <strong>Conectar</strong> e entre com o <strong>vendedor de teste</strong>. O teste de conexão deve dizer "Conta de TESTE".</li>
                    <li>Assine ou pague com o <strong>e-mail do comprador de teste</strong> e um cartão de teste (titular <code>APRO</code> aprova, <code>OTHE</code> recusa).</li>
                    <li>Numa conta real, cartões de teste são sempre recusados, e o dono da conta não consegue pagar a si mesmo.</li>
                </ol>
            </details>

        </div>
    );
};

export default PaymentsScreen;
