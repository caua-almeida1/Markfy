import React, { useEffect, useState } from "react";


import { Icon } from "@iconify/react";

import {
    cancelJoinRequest,
    linkMyCompany,
    REQUEST_STATUS,
    watchCompanyHandle,
    watchJoinRequest,
    watchMyMembership
} from "../../../utils/joinRequests";

import "./join-request-waiting.css";


/* =========================================================
   ESPERANDO APROVAÇÃO

   Quem pede para entrar numa empresa não tem o que fazer até
   alguém de lá aprovar. Sem uma tela dizendo isso, a pessoa
   fica no escuro achando que o clique não funcionou.

   A tela escuta o próprio pedido no banco. Quando o
   administrador aprova, ela navega sozinha para a central —
   sem recarregar, sem a pessoa precisar voltar depois para
   conferir.
   ========================================================= */

const JoinRequestWaiting = ({
    handle,
    uid,
    onCancel
}) => {

    const [request, setRequest] = useState(null);
    const [cancelling, setCancelling] = useState(false);


    /*
     * DOIS OBSERVADORES, DOIS SINAIS
     *
     * O pedido é apagado quando aprovado, então "sumiu" não
     * basta para decidir o que mostrar: pode ter sido
     * aprovação, recusa ou a própria pessoa cancelando.
     *
     * Quem responde "você entrou" é o vínculo em
     * users/{uid}/companyHandle, que é o que de fato dá
     * acesso. O pedido continua sendo observado só para o
     * caso da recusa, que o mantém no banco com o status.
     */

    useEffect(() => {

        if (!handle || !uid) {
            return undefined;
        }

        const pararDeOuvirPedido = watchJoinRequest(
            handle,
            uid,
            setRequest
        );

        const pararDeOuvirVinculo = watchCompanyHandle(
            uid,
            (vinculo) => {

                if (vinculo !== handle) {
                    return;
                }

                /*
                 * Carregamento completo, não navegação de SPA.
                 *
                 * O contexto da empresa resolve o vínculo uma
                 * vez, na montagem. Com `navigate` a central
                 * abria com o estado antigo — o de quem ainda
                 * não tinha empresa — e mostrava "nenhuma
                 * empresa encontrada" para alguém que acabara
                 * de ser aprovado.
                 */
                window.location.assign("/central-adm");

            }
        );

        /*
         * Aprovação = minha entrada apareceu em members. Quem
         * aprova não pode mais gravar no MEU users/{uid} (as
         * regras fecharam isso), então eu mesmo gravo o vínculo;
         * o observador acima vê o companyHandle e abre o painel.
         */
        const pararDeOuvirMembro = watchMyMembership(
            handle,
            uid,
            (membro) => {

                if (!membro) return;

                linkMyCompany(uid, handle).catch((error) => {
                    console.error("Não foi possível gravar o vínculo com a empresa:", error);
                });

            }
        );

        return () => {
            pararDeOuvirPedido();
            pararDeOuvirVinculo();
            pararDeOuvirMembro();
        };

    }, [handle, uid]);


    const cancelar = async () => {

        setCancelling(true);

        try {

            await cancelJoinRequest(handle, uid);

            onCancel?.();

        } catch (error) {

            console.error("Erro ao cancelar o pedido:", error);

            setCancelling(false);

        }

    };


    const recusado =
        request?.status === REQUEST_STATUS.REJECTED;


    return (
        <section className="join-waiting">

            <div
                className={`join-waiting-icon ${recusado ? "is-rejected" : ""
                    }`}
            >
                <Icon
                    icon={
                        recusado
                            ? "solar:close-circle-outline"
                            : "solar:hourglass-line-outline"
                    }
                />
            </div>

            {recusado ? (

                <>
                    <h1>Pedido não aprovado</h1>

                    <p>
                        A equipe de <strong>@{handle}</strong> não
                        aprovou seu acesso. Se foi engano, fale com
                        quem administra a empresa e peça de novo.
                    </p>

                    <button
                        type="button"
                        className="join-waiting-button is-primary"
                        onClick={onCancel}
                    >
                        Tentar outra empresa
                    </button>
                </>

            ) : (

                <>
                    <h1>Pedido enviado</h1>

                    <p>
                        Avisamos a equipe de <strong>@{handle}</strong>.
                        Assim que alguém aprovar, você entra
                        direto no painel — pode deixar esta tela
                        aberta.
                    </p>

                    <div className="join-waiting-status">

                        <Icon icon="svg-spinners:ring-resize" />

                        <span>Aguardando aprovação</span>

                    </div>

                    {request && (

                        <div className="join-waiting-card">

                            <span className="join-waiting-card-label">
                                Enviado como
                            </span>

                            <strong>
                                {request.name || "Sem nome"}
                            </strong>

                            {(request.email || request.phone) && (
                                <span className="join-waiting-card-contact">
                                    {request.email || request.phone}
                                </span>
                            )}

                        </div>

                    )}

                    <button
                        type="button"
                        className="join-waiting-button"
                        disabled={cancelling}
                        onClick={cancelar}
                    >
                        {cancelling
                            ? "Cancelando..."
                            : "Cancelar pedido"}
                    </button>
                </>

            )}

        </section>
    );

};


export default JoinRequestWaiting;
