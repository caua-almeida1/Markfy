import React from "react";

import PlansView from "../../plans/PlansView";
import { PageHead } from "./shared";

/* Plano e assinatura da empresa, dentro do Studio. Só o
   administrador principal assina ou troca; os demais veem o
   plano atual. */

const Plan = () => (
    <div className="std-page">
        <PageHead
            title="Plano e assinatura"
            description="O plano vale para a empresa toda, nos dois produtos: Bookings e Studio."
        />
        <PlansView variant="embedded" />
    </div>
);

export default Plan;
