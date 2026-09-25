/*
============================================================
INSTALAÇÃO DO MEDIDOR
============================================================

Este módulo existe só para ser importado ANTES de tudo no
src/index.js.

O WebSocket precisa estar envolvido antes do Firebase abrir
a conexão, e os imports de um módulo ES rodam na ordem em
que aparecem.

Em produção não faz absolutamente nada.
============================================================
*/

import { installRtdbMeter } from "./rtdbMeter";

if (process.env.NODE_ENV === "development") {

    installRtdbMeter();

}
