import PlansView from "../../../../plans/PlansView";

/* Planos e assinatura da EMPRESA. Só o administrador principal
   consegue assinar ou trocar; os demais veem o plano atual. */

export default function SubscriptionScreen() {
    return (
        <div style={{ padding: "8px 16px 32px" }}>
            <PlansView variant="embedded" />
        </div>
    );
}
