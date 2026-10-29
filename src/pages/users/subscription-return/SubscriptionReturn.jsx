import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Icon } from "@iconify/react";
import { getAuth, onAuthStateChanged } from "firebase/auth";

import SubscriptionResult from "../../../components/subscription-checkout/SubscriptionResult";
import { SubscriptionStepper } from "../../../components/subscription-checkout/SubscriptionCheckout";
import {
    forgetPendingSubscription,
    readPendingSubscription,
    syncSubscription
} from "../../../firebase/subscriptionsApi";
import {
    buildSubscriptionId,
    watchMySubscriptions,
    watchSubscription
} from "../../../utils/subscriptionRuntime";

import "../checkout/Checkout.css";
import "../../../components/subscription-checkout/subscription-checkout.css";


/* =========================================================
   VOLTA DO MERCADO PAGO

   Quem assina pela conta Mercado Pago sai do Markfy, autoriza
   lá e volta para cá (back_url da preapproval, com
   ?empresa={handle}). Esta tela:

     1. descobre qual assinatura conferir (o que o checkout
        guardou no aparelho; senão, a mais recente da conta
        nesta empresa);
     2. pede ao backend para ler o estado no Mercado Pago
        (não depende do webhook ter chegado);
     3. escuta o banco: se o webhook chegar depois, a tela
        vira sozinha.

   A URL não carrega nada que identifique a pessoa — só a
   empresa.
========================================================= */

/* Segundos até cada nova conferência enquanto está pendente. */
const RETRY_DELAYS = [4, 10, 20, 40];

const SubscriptionReturn = () => {

    const navigate = useNavigate();
    const [params] = useSearchParams();

    const pending = readPendingSubscription();

    const handle =
        (params.get("empresa") || pending?.handle || "").replace(/[^a-z0-9._-]/gi, "");

    const [user, setUser] = useState(null);
    const [authReady, setAuthReady] = useState(false);

    const [subscriptionId, setSubscriptionId] = useState(
        pending?.handle === handle ? pending.subscriptionId : null
    );

    const [subscription, setSubscription] = useState(null);
    const [loaded, setLoaded] = useState(false);
    const [syncing, setSyncing] = useState(false);

    useEffect(() =>
        onAuthStateChanged(getAuth(), (current) => {
            setUser(current);
            setAuthReady(true);
        }), []);


    /* Sem nada guardado (outro aparelho, aba anônima): a
       assinatura mais recente desta conta nesta empresa. */
    useEffect(() => {

        if (!user || !handle || subscriptionId) return undefined;

        return watchMySubscriptions(handle, user.uid, (mine) => {
            if (mine[0]) setSubscriptionId(mine[0].id);
            else setLoaded(true);
        });

    }, [user, handle, subscriptionId]);


    /* O guardado no aparelho precisa ser desta conta. */
    useEffect(() => {

        if (!user || !subscriptionId || !pending?.productId) return;

        if (subscriptionId !== buildSubscriptionId(user.uid, pending.productId)) {
            setSubscriptionId(null);
        }

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, subscriptionId]);


    useEffect(() => {

        if (!handle || !subscriptionId || !user) return undefined;

        return watchSubscription(handle, subscriptionId, (value) => {
            setSubscription(value);
            setLoaded(true);
        });

    }, [handle, subscriptionId, user]);


    const sync = useCallback(async () => {

        if (!handle || !subscriptionId) return;

        setSyncing(true);

        try {
            await syncSubscription(handle, subscriptionId);
        } catch (error) {
            console.warn("Não foi possível conferir a assinatura:", error?.code || error?.message);
        } finally {
            setSyncing(false);
        }

    }, [handle, subscriptionId]);


    /* Confere na chegada e mais algumas vezes enquanto estiver
       pendente — a autorização no Mercado Pago pode levar
       alguns segundos para aparecer. */
    const status = subscription?.status;
    const attempt = useRef(0);

    useEffect(() => {

        if (!subscriptionId || !user) return undefined;

        if (attempt.current === 0) {
            attempt.current = 1;
            sync();
            return undefined;
        }

        if (status !== "pending" || attempt.current > RETRY_DELAYS.length) return undefined;

        const timer = setTimeout(() => {
            attempt.current += 1;
            sync();
        }, RETRY_DELAYS[attempt.current - 1] * 1000);

        return () => clearTimeout(timer);

    }, [subscriptionId, user, status, sync, syncing]);


    /* Concluída: o atalho guardado no aparelho não serve mais. */
    useEffect(() => {
        if (status && status !== "pending") forgetPendingSubscription();
    }, [status]);


    const done = status === "authorized" || status === "past_due";

    return (
        <main className="checkout-page">

            <header className="checkout-header">

                <button
                    type="button"
                    className="checkout-back"
                    onClick={() => navigate(handle ? `/central-user/${handle}` : "/central-user")}
                    aria-label="Voltar para a empresa"
                >
                    <Icon icon="solar:arrow-left-outline" />
                </button>

                <div className="checkout-header-brand">
                    <strong>Markfy</strong>
                    <span>Assinatura</span>
                </div>

                <div className="checkout-header-processor">
                    <Icon icon="solar:shield-check-bold" />
                    <span>
                        Pagamento processado por
                        <strong>Mercado Pago</strong>
                    </span>
                </div>

            </header>

            <section className="subcheck">

                <SubscriptionStepper current={done ? "done" : "payment"} />

                <div className="subcheck-card subcheck-card--narrow mkf-fade-enter">

                    {authReady && !user ? (

                        <div className="subcheck-result">
                            <div className="subcheck-result-icon is-pending">
                                <Icon icon="solar:shield-user-outline" />
                            </div>
                            <h2>Entre para ver sua assinatura</h2>
                            <p>Use a mesma conta Markfy com que você começou a assinar.</p>
                            <div className="subcheck-actions">
                                <button
                                    type="button"
                                    className="subcheck-button subcheck-button--primary"
                                    onClick={() =>
                                        navigate(`/login?redirect=${encodeURIComponent(`/assinatura/retorno?empresa=${handle}`)}`)
                                    }
                                >
                                    Entrar
                                </button>
                            </div>
                        </div>

                    ) : (

                        <SubscriptionResult
                            subscription={subscription}
                            loading={!loaded}
                            companyHandle={handle}
                            productId={subscription?.productId || pending?.productId}
                            productName={subscription?.productName || pending?.productName}
                            booking={pending?.booking || subscription?.firstBooking?.request || null}
                            onSync={sync}
                            syncing={syncing}
                        />

                    )}

                </div>

            </section>

        </main>
    );
};


export default SubscriptionReturn;
