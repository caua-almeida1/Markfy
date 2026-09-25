import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

import { useExitTransition } from "../../hooks/useExitTransition";

import "./modal.css";


/* =========================================================
   MODAL COMUM

   Substitui o par AnimatePresence + motion.div que cada
   tela repetia à mão.

   POR QUE NÃO USA framer-motion
   -----------------------------

   O AnimatePresence só desmonta depois que a animação de
   saída avisa que terminou. Quando ela não roda — aba em
   segundo plano, GPU ocupada, movimento reduzido — o aviso
   nunca chega e o modal fica preso aberto.

   Aqui a saída é por tempo (useExitTransition) e a animação
   é CSS. Se a animação não rodar, o modal fecha do mesmo
   jeito: o fechamento não depende dela.

   O QUE O COMPONENTE RESOLVE, E ANTES ERA COPIADO EM CADA TELA
   ------------------------------------------------------------

   - portal no <body>, para o modal não herdar transform,
     overflow ou z-index de quem o abriu;
   - Esc fecha;
   - clique no fundo fecha (e o clique no painel não vaza);
   - trava o scroll da página enquanto aberto, contando
     quantos modais estão abertos — modal sobre modal não
     destrava o fundo ao fechar só o de cima;
   - devolve o foco para quem abriu;
   - papéis de acessibilidade (role, aria-modal, aria-label).

   USO
   ---

       <Modal
           open={mostrar}
           onClose={() => setMostrar(false)}
           overlayClassName="orders-modal-overlay"
           className="orders-modal"
           label="Detalhes do pedido"
       >
           ...conteúdo...
       </Modal>

   As classes continuam sendo as de cada tela, então o
   visual de cada modal não muda — só o motor da animação.
========================================================= */


/*
 * Contador global de modais abertos.
 *
 * Sem ele, fechar um modal aberto por cima de outro
 * devolveria o scroll da página com o de baixo ainda
 * aberto.
 */
let openCount = 0;

let previousOverflow = "";


/*
 * Empilhamento.
 *
 * O modal vai para o <body> via portal, então quem decide
 * quem fica por cima é o z-index — não a árvore de quem
 * abriu. Dois problemas apareciam por causa disso:
 *
 *   - navbar, tab bar e a folha de detalhes do produto
 *     usavam 99999+ e cobriam o modal;
 *   - dois modais abertos ao mesmo tempo empatavam no mesmo
 *     z-index e a ordem caía para a ordem do DOM, que é a
 *     ordem de montagem — o de cima podia ficar embaixo.
 *
 * A base fica acima de qualquer barra do app, e cada modal
 * que abre pega o próximo número. Como vai em style inline,
 * ganha de qualquer z-index de CSS que as telas antigas
 * ainda declarem nas suas classes de overlay.
 */
const BASE_Z_INDEX = 500000;

let zCounter = 0;


const lockScroll = () => {

    if (openCount === 0) {
        previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
    }

    openCount += 1;

};


const unlockScroll = () => {

    openCount = Math.max(0, openCount - 1);

    if (openCount === 0) {

        /*
         * Devolve o valor que havia antes — mas nunca
         * "hidden".
         *
         * `previousOverflow` é global do módulo. Se um modal
         * abriu enquanto o body já estava travado por outro
         * caminho, era "hidden" que ficava guardado, e o
         * destravar do último modal reescrevia "hidden" no
         * body. A trava então atravessava a navegação: o
         * checkout abria sem scroll, sem nenhum modal na
         * tela, e só recarregando a página voltava.
         */
        document.body.style.overflow =
            previousOverflow === "hidden"
                ? ""
                : previousOverflow;

        previousOverflow = "";

    }

};


/*
 * Destrava incondicional, para quem chega numa tela nova e
 * precisa garantir que a página rola.
 */
export const releaseScrollLock = () => {

    openCount = 0;
    previousOverflow = "";

    document.body.style.overflow = "";

};


export const Modal = ({
    open,
    onClose,

    children,

    /* Classe do fundo escurecido. */
    overlayClassName = "",

    /* Classe do painel branco. */
    className = "",

    /* Rótulo para leitores de tela. */
    label,

    /* "center" (padrão) ou "sheet", que sobe de baixo. */
    variant = "center",

    /* Esc e clique no fundo fecham. Desligue em fluxos que
       não podem ser interrompidos, como um pagamento em
       andamento. */
    dismissible = true,

    /* Precisa bater com a duração da animação no CSS. */
    duration = 220
}) => {

    const { rendered, leaving } =
        useExitTransition(open, undefined, duration);

    const restoreFocusRef = useRef(null);

    const panelRef = useRef(null);

    /* Pega um número na fila ao abrir e devolve ao fechar,
       para o modal manter a mesma camada durante a saída. */
    const zIndexRef = useRef(null);

    if (rendered && zIndexRef.current === null) {

        zCounter += 1;

        zIndexRef.current = BASE_Z_INDEX + zCounter;

    } else if (!rendered && zIndexRef.current !== null) {

        zIndexRef.current = null;

    }


    /* Trava o scroll e guarda o foco de quem abriu. */
    useEffect(() => {

        if (!rendered) {
            return undefined;
        }

        restoreFocusRef.current =
            document.activeElement;

        lockScroll();

        return () => {

            unlockScroll();

            const target = restoreFocusRef.current;

            if (target && typeof target.focus === "function") {
                target.focus();
            }

        };

    }, [rendered]);


    /* Esc fecha. */
    useEffect(() => {

        if (!rendered || !dismissible) {
            return undefined;
        }

        const handleKeyDown = (event) => {

            if (event.key === "Escape") {
                event.stopPropagation();
                onClose?.();
            }

        };

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };

    }, [rendered, dismissible, onClose]);


    /* Foco inicial no painel, para o leitor de tela entrar
       no modal e o Esc funcionar sem precisar clicar. */
    useEffect(() => {

        if (!rendered || leaving) {
            return;
        }

        panelRef.current?.focus({ preventScroll: true });

    }, [rendered, leaving]);


    if (!rendered) {
        return null;
    }


    const state = leaving
        ? "leaving"
        : "entering";


    return createPortal(

        <div
            className={`mkf-modal-overlay ${overlayClassName}`}
            data-state={state}
            style={{ zIndex: zIndexRef.current }}
            onClick={() => {

                if (dismissible) {
                    onClose?.();
                }

            }}
        >

            <div
                ref={panelRef}
                className={`mkf-modal-panel mkf-modal-panel--${variant} ${className}`}
                data-state={state}
                role="dialog"
                aria-modal="true"
                aria-label={label}
                tabIndex={-1}
                onClick={(event) => event.stopPropagation()}
            >

                {children}

            </div>

        </div>,

        document.body

    );

};


export default Modal;
