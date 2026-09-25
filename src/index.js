import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { BrowserRouter } from "react-router-dom";

/*
 * ============================================================
 * MEDIDOR DE CONSUMO DO REALTIME DATABASE (só em dev)
 * ============================================================
 *
 * Roda antes do render, que é antes de qualquer componente
 * montar e chamar ref()/onValue(), então o WebSocket é
 * envolvido antes do Firebase abrir a conexão.
 *
 * (Os imports acima são içados e avaliados antes desta
 * linha de qualquer jeito, mas nenhum deles abre soquete:
 * getDatabase() só cria o objeto, a conexão é preguiçosa.)
 *
 * require dentro de um if constante, e não import: assim o
 * webpack não inclui nada disso no build de produção.
 */
if (process.env.NODE_ENV === "development") {
  require("./devtools/installRtdbMeter");
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
