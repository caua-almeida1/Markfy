import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import PaymentsScreen from "../PaymentsScreen";
import {
    disconnectPaymentAccount,
    startMercadoPagoConnection,
    verifyPaymentConnection
} from "../../../../../../../firebase/paymentsApi";
import { useUserCompany } from "../../../../../../../contexts/companyContext/UserCompanyContext";

/* ---------- dublês: empresa do contexto, plano e backend ---------- */

jest.mock("@iconify/react", () => ({ Icon: () => null }));

jest.mock("firebase/auth", () => ({ getAuth: () => ({ currentUser: null }) }));

jest.mock("firebase/database", () => ({
    getDatabase: () => ({}),
    ref: () => ({}),
    update: jest.fn(async () => {})
}));

jest.mock("../../../../../../../plans/LicenseContext", () => ({
    useLicense: () => ({ can: () => true })
}));

jest.mock("../../../../../../../contexts/companyContext/UserCompanyContext", () => ({
    useUserCompany: jest.fn()
}));

jest.mock("../../../../../../../firebase/paymentsApi", () => ({
    ...jest.requireActual("../../../../../../../firebase/paymentsApi"),
    startMercadoPagoConnection: jest.fn(),
    verifyPaymentConnection: jest.fn(),
    disconnectPaymentAccount: jest.fn()
}));


const withCompany = (mercadoPago = {}, { role = "master", settings = {} } = {}) =>
    useUserCompany.mockReturnValue({
        company: { handle: "tk", paymentSettings: { ...settings, mercadoPago } },
        companies: [{ handle: "tk", role }]
    });

const CONNECTED = {
    connected: true,
    status: "active",
    environment: "production",
    accountLabel: "TKBARBEARIA",
    connectedAt: new Date("2026-09-11T12:00:00-03:00").getTime()
};

let assign;

beforeEach(() => {
    jest.clearAllMocks();
    assign = jest.fn();
    delete window.location;
    window.location = { assign, origin: "http://localhost:3000" };
    window.confirm = jest.fn(() => true);
});


describe("Configurações → Pagamentos", () => {

    it("sem conta: mostra 'Não conectado' e o botão leva ao Mercado Pago pela empresa certa", async () => {

        withCompany({});

        startMercadoPagoConnection.mockResolvedValue({
            authorizationUrl: "https://auth.mercadopago.com/authorization?client_id=1&state=abc"
        });

        render(<PaymentsScreen />);

        expect(screen.getByText("Não conectado")).toBeInTheDocument();
        expect(screen.getAllByText("Conecte a conta")).toHaveLength(2);

        fireEvent.click(screen.getByRole("button", { name: /Conectar Mercado Pago/ }));

        await waitFor(() => expect(assign).toHaveBeenCalledWith(
            "https://auth.mercadopago.com/authorization?client_id=1&state=abc"
        ));

        expect(startMercadoPagoConnection).toHaveBeenCalledWith("tk");
    });

    it("não segue um link que não seja do Mercado Pago", async () => {

        withCompany({});

        startMercadoPagoConnection.mockResolvedValue({ authorizationUrl: "https://evil.example/login" });

        render(<PaymentsScreen />);

        fireEvent.click(screen.getByRole("button", { name: /Conectar Mercado Pago/ }));

        expect(await screen.findByText("Não foi possível abrir o Mercado Pago")).toBeInTheDocument();
        expect(assign).not.toHaveBeenCalled();
    });

    it("conectado: mostra a conta e o ambiente, modalidades disponíveis e o resultado do teste", async () => {

        withCompany(CONNECTED);

        verifyPaymentConnection.mockResolvedValue({
            ok: true, environment: "production", accountLabel: "TKBARBEARIA",
            payments: true, subscriptions: true, problem: null, at: Date.now()
        });

        render(<PaymentsScreen />);

        expect(screen.getByText("Conectado")).toBeInTheDocument();
        expect(screen.getByText(/Conta TKBARBEARIA · Produção/)).toBeInTheDocument();
        expect(screen.getAllByText("Disponível")).toHaveLength(2);

        fireEvent.click(screen.getByRole("button", { name: /Testar conexão/ }));

        expect(await screen.findByText("Assinaturas (mensalidade) liberadas")).toBeInTheDocument();
        expect(screen.getByText(/Cartões de teste do Mercado Pago são sempre recusados aqui/)).toBeInTheDocument();
        expect(verifyPaymentConnection).toHaveBeenCalledWith("tk");
    });

    it("desconectar pede confirmação; com assinaturas abertas, pede de novo antes de forçar", async () => {

        withCompany(CONNECTED);

        const blocked = Object.assign(new Error("Há 2 assinaturas abertas nesta conta."), { code: "has_open_subscriptions" });

        disconnectPaymentAccount
            .mockRejectedValueOnce(blocked)
            .mockResolvedValueOnce({ disconnected: true });

        render(<PaymentsScreen />);

        fireEvent.click(screen.getByRole("button", { name: /Desconectar/ }));
        fireEvent.click(screen.getByRole("button", { name: /^Desconectar$/ }));

        expect(await screen.findByText("Há 2 assinaturas abertas nesta conta.")).toBeInTheDocument();
        expect(disconnectPaymentAccount).toHaveBeenLastCalledWith("tk", { confirm: false });

        fireEvent.click(screen.getByRole("button", { name: /Desconectar mesmo assim/ }));

        expect(await screen.findByText("Conta desconectada")).toBeInTheDocument();
        expect(disconnectPaymentAccount).toHaveBeenLastCalledWith("tk", { confirm: true });
    });

    it("token revogado: pede para reconectar", () => {

        withCompany({ connected: false, status: "reconnect_required" });

        render(<PaymentsScreen />);

        expect(screen.getByText("Reconectar")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Reconectar Mercado Pago/ })).toBeInTheDocument();
    });

    it("profissional vê o status, mas não conecta nem desconecta", () => {

        withCompany(CONNECTED, { role: "professional" });

        render(<PaymentsScreen />);

        expect(screen.getByText("Conectado")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Testar conexão/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Desconectar/ })).not.toBeInTheDocument();
        expect(screen.getByText(/Só o administrador da empresa/)).toBeInTheDocument();
        expect(screen.getByRole("switch", { name: /Cobrar antecipado/ })).toBeDisabled();
    });

    it("volta do Mercado Pago explicada e a última recusa do cartão com o que fazer", () => {

        withCompany({
            ...CONNECTED,
            lastFailure: { kind: "subscription", code: "CARD_NOT_VALIDATED", at: Date.now() }
        });

        render(<PaymentsScreen returnStatus="denied" />);

        expect(screen.getByText("Conexão cancelada")).toBeInTheDocument();
        expect(screen.getByText("Uma assinatura foi recusada na validação do cartão")).toBeInTheDocument();
        expect(screen.getByText(/o cartão é de teste e a conta conectada é real/)).toBeInTheDocument();
    });

    it("regra geral ligada sem conta conectada avisa que os agendamentos online param", () => {

        withCompany({}, { settings: { receiveBeforeBooking: true } });

        render(<PaymentsScreen />);

        expect(screen.getByRole("switch", { name: /Cobrar antecipado/ })).toHaveAttribute("aria-checked", "true");
        expect(screen.getByText(/serviços com pagamento antecipado não aceitam agendamentos online/)).toBeInTheDocument();
    });
});
