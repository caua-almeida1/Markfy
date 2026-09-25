import { useEffect, useRef, useState } from "react";


/* =========================================================
   MONTAGEM COM SAÍDA ANIMADA — SEM AnimatePresence

   POR QUE ISTO EXISTE
   -------------------

   `AnimatePresence mode="wait"` mantém o componente que sai
   montado até a animação de saída terminar, e só então
   dispara `onExitComplete`. Quando essa animação não roda —
   aba em segundo plano, GPU ocupada, `prefers-reduced-motion`,
   ou a janela simplesmente não pintando — o callback nunca
   vem:

     - no modal de produto, `onExitComplete` era quem chamava
       `onClose()`: o modal ficava aberto para sempre;

     - na troca de abas, o conteúdo novo só monta depois da
       saída do antigo: a tela travava no componente anterior.

   Medi esse estado: as animações ficavam em
   `playState: "running"` com `currentTime: 0`, paradas.

   COMO ESTE HOOK RESOLVE
   ----------------------

   A saída é um `setTimeout`, não um evento de animação. O
   relógio corre independente de a animação ter pintado um
   quadro sequer, então o desmonte e o `onExited` acontecem
   sempre, na hora certa.

   O CSS anima por classe (.is-entering / .is-leaving); se
   não animar, o componente some do mesmo jeito — sem estado
   preso.

   USO
   ---

       const { rendered, leaving } = useExitTransition(
           visible,
           onClose
       );

       if (!rendered) return null;

       <div className={leaving ? "overlay is-leaving" : "overlay"}>
========================================================= */

export const useExitTransition = (
    open,
    onExited,
    duration = 260
) => {

    const [rendered, setRendered] = useState(open);

    const [leaving, setLeaving] = useState(false);


    /* Guardado em ref para o efeito não reagir à identidade
       da função, que muda a cada render de quem chama. */
    const onExitedRef = useRef(onExited);

    onExitedRef.current = onExited;


    /* Evita disparar a saída quando o componente já nasce
       fechado. */
    const wasOpenRef = useRef(open);


    useEffect(() => {

        if (open) {

            wasOpenRef.current = true;

            setRendered(true);
            setLeaving(false);

            return undefined;
        }

        if (!wasOpenRef.current) {
            return undefined;
        }

        setLeaving(true);

        const timer = setTimeout(() => {

            setLeaving(false);
            setRendered(false);

            onExitedRef.current?.();

        }, duration);

        return () => clearTimeout(timer);

    }, [open, duration]);


    return {
        rendered,
        leaving
    };

};


export default useExitTransition;
