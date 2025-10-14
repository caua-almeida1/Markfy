import React from "react";
import { Icon } from "@iconify/react";

const TabBarAdm = ({ activeTab, setActiveTab }) => {
  return (
    <div id="tabbar-adm" className="site">
      <div className="container">
        <nav>
          <ul>
            <li
              className={activeTab === "home" ? "active" : ""}
              onClick={() => setActiveTab("home")}
            >
              <a href="#" id="home">
                <span>Início</span>
                <Icon icon="ri:home-line" className="icon" />
              </a>
            </li>
            <li
              className={activeTab === "pedidos" ? "active" : ""}
              onClick={() => setActiveTab("pedidos")}
            >
              <a href="#" id="pedidos">
                <span>Pedidos</span>
                <Icon icon="icon-park-outline:order" className="icon" />
              </a>
            </li>
            <li
              className={activeTab === "produtos" ? "active" : ""}
              onClick={() => setActiveTab("produtos")}
            >
              <a href="#" id="produtos">
                <span>Produtos</span>
                <Icon icon="gg:shopping-bag" className="icon" />
              </a>
            </li>
            <li
              className={activeTab === "horarios" ? "active" : ""}
              onClick={() => setActiveTab("horarios")}
            >
              <a href="#" id="schedules">
                <span>Agenda</span>
                <Icon icon="uil:schedule" className="icon" />
              </a>
            </li>
            <li
              className={activeTab === "perfil" ? "active" : ""}
              onClick={() => setActiveTab("perfil")}
            >
              <a href="#" id="perfil">
                <span>Perfil</span>
                <Icon icon="tabler:user" className="icon" />
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
};

export default TabBarAdm;
