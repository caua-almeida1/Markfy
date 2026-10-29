import React from "react";
import { MemoryRouter } from "react-router-dom";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import SubscriptionCheckout from "../SubscriptionCheckout";
import { subscribe } from "../../../firebase/subscriptionsApi";
import { CONSENT_VERSION } from "../../../utils/subscriptionRuntime";

/* ---------- dublês: conta logada, Brick do cartão e backend ---------- */

jest.mock("firebase/auth", () => {
    const user = { uid: "ana", email: "ana@email.com", getIdToken: async () => "token" };
    return {
        getAuth: () => ({ currentUser: user }),
        onAuthStateChanged: (_auth, callback) => {
            callback(user);
            return () => {};
        }
    };
});

jest.mock("@mercadopago/sdk-react", () => ({
    initMercadoPago: jest.fn(),
    /* O Brick de verdade é um iframe do Mercado Pago; aqui um
       botão que entrega o mesmo formData que ele entregaria. */
    CardPayment: ({ onSubmit }) => (
        <button
            type="button"
            onClick={() => onSubmit({ token: "cardtoken123", payer: { email: "ana@email.com" } }).catch(() => {})}
        >
            enviar cartão
        </button>
    )
}));

jest.mock("@iconify/react", () => ({ Icon: () => null }));

jest.mock("../../../firebase/subscriptionsApi", () => ({
    subscribe: jest.fn(),
    rememberPendingSubscription: jest.fn()
}));

jest.mock("../../../utils/subscriptionRuntime", () => ({
    ...jest.requireActual("../../../utils/subscriptionRuntime"),
    watchSubscription: () => () => {}
}));


const CHECKOUT = {
    companyHandle: "tk",
    companyName: "Tk Barbearia",
    productId: "plano",
    productName: "Barba ilimitada",
    product: { images: [] },
    professionalId: "pro1",
    professionalName: "Rafa",
    day: "30/10/2026",
    dayLabel: "Sexta, 30 de outubro",
    hour: "10:00",
    userName: "Ana",
    notes: "",
    clientId: "c0ffee00-1234-4abc-9def-001122334455",
    payerEmail: "ana@email.com",
    subscriptionPlan: {
        billingCycle: "monthly",
        unlimitedSessions: false,
        sessionsPerCycle: 4,
        autoRenew: true,
        trialDays: 0,
        loyaltyMonths: 0,
        cancellationNoticeDays: 0,
        amount: 99.9
    }
};

const renderCheckout = () =>
    render(
        <MemoryRouter>
            <SubscriptionCheckout checkoutData={CHECKOUT} onExit={() => {}} />
        </MemoryRouter>
    );

/* Passa pelas etapas 1 e 2 (aceitando os dois termos). */
const goToPayment = () => {
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

    const next = screen.getByRole("button", { name: /concordo e continuar/i });
    expect(next).toBeDisabled();

    screen.getAllByRole("checkbox").forEach((box) => fireEvent.click(box));
    expect(next).not.toBeDisabled();

    fireEvent.click(next);
};

const originalLocation = window.location;

beforeEach(() => {
    subscribe.mockReset();
    window.scrollTo = jest.fn();
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ success: true, publicKey: "TEST-key" }) }));
    delete window.location;
    window.location = { ...originalLocation, assign: jest.fn() };
});

afterAll(() => {
    window.location = originalLocation;
});


describe("checkout da mensalidade", () => {

    it("cartão: envia só escolhas + aceite, e mostra a assinatura ativa com o horário reservado", async () => {

        subscribe.mockResolvedValue({
            id: "ana_plano",
            status: "authorized",
            price: 99.9,
            billingCycle: "monthly",
            productName: "Barba ilimitada",
            nextBillingAt: new Date("2026-11-24T12:00:00-03:00").getTime(),
            firstBooking: { status: "booked" }
        });

        renderCheckout();
        goToPayment();

        fireEvent.click(await screen.findByRole("button", { name: /enviar cartão/i }));

        expect(await screen.findByText("Assinatura ativa!")).toBeInTheDocument();
        expect(screen.getByText("Primeiro atendimento reservado")).toBeInTheDocument();

        expect(subscribe).toHaveBeenCalledWith({
            handle: "tk",
            productId: "plano",
            userName: "Ana",
            clientId: CHECKOUT.clientId,
            consent: { accepted: true, version: CONSENT_VERSION },
            booking: { professionalId: "pro1", day: "30/10/2026", hour: "10:00", dayLabel: "Sexta, 30 de outubro", notes: undefined },
            method: "card",
            cardTokenId: "cardtoken123",
            payerEmail: "ana@email.com"
        });

        /* Preço nunca vai do navegador. */
        expect(JSON.stringify(subscribe.mock.calls[0][0])).not.toMatch(/99/);
    });

    it("conta Mercado Pago: cria a assinatura e leva para o link do Mercado Pago", async () => {

        subscribe.mockResolvedValue({
            id: "ana_plano",
            status: "pending",
            redirectUrl: "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=abc"
        });

        renderCheckout();
        goToPayment();

        fireEvent.click(screen.getByRole("radio", { name: /conta mercado pago/i }));
        expect(screen.getByLabelText(/e-mail da sua conta mercado pago/i)).toHaveValue("ana@email.com");

        fireEvent.click(screen.getByRole("button", { name: /continuar no mercado pago/i }));

        await waitFor(() =>
            expect(window.location.assign).toHaveBeenCalledWith(
                "https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=abc"
            )
        );

        expect(subscribe.mock.calls[0][0].method).toBe("account");
    });

    it("não segue link que não seja do Mercado Pago", async () => {

        subscribe.mockResolvedValue({ id: "ana_plano", status: "pending", redirectUrl: "https://golpe.example.com/pagar" });

        renderCheckout();
        goToPayment();

        fireEvent.click(screen.getByRole("radio", { name: /conta mercado pago/i }));
        fireEvent.click(screen.getByRole("button", { name: /continuar no mercado pago/i }));

        expect(await screen.findByText(/não devolveu o link/i)).toBeInTheDocument();
        expect(window.location.assign).not.toHaveBeenCalled();
    });

    it("problema na conta da empresa aparece como problema da empresa, não do cartão", async () => {

        subscribe.mockRejectedValue(Object.assign(new Error("A conta Mercado Pago desta empresa ainda não pode receber assinaturas."), {
            code: "MERCADO_PAGO_SUBSCRIPTION_NOT_ENABLED",
            data: { ownerAction: true }
        }));

        renderCheckout();
        goToPayment();

        fireEvent.click(await screen.findByRole("button", { name: /enviar cartão/i }));

        expect(await screen.findByText("A empresa ainda não recebe mensalidades")).toBeInTheDocument();
        expect(screen.getByText(/não no seu cartão/i)).toBeInTheDocument();
    });
});
