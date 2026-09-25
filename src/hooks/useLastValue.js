import { useRef } from "react";


/* =========================================================
   ÚLTIMO VALOR NÃO NULO

   Para modal que recebe o conteúdo por state — o membro
   selecionado, o pedido aberto — e fecha zerando esse
   state.

   O Modal só sai do DOM depois da animação de saída, mas o
   state já virou null no primeiro quadro. Sem isso o painel
   passa a animação inteira vazio, ou pior, o JSX tenta ler
   um campo de null e quebra a tela (os filhos de um
   componente são montados mesmo quando ele não mostra nada).

   Guardando o último valor, o conteúdo continua na tela
   enquanto o modal sai.

       const pedido = useLastValue(pedidoAberto);

       <Modal open={!!pedidoAberto}>
           {pedido && <p>#{pedido.id}</p>}
       </Modal>
========================================================= */

export const useLastValue = (value) => {

    const lastRef = useRef(value ?? null);

    if (value !== null && value !== undefined) {
        lastRef.current = value;
    }

    return lastRef.current;

};


export default useLastValue;
