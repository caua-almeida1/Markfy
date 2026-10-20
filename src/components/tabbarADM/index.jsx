import React from "react";
import { Icon } from "@iconify/react";

const TabBarAdm = ({ activeTab, setActiveTab }) => {
  const tabs = [
    { id: "home", label: "Início", icon: "ri:home-line" },
    { id: "pedidos", label: "Pedidos", icon: "icon-park-outline:order" },
    { id: "produtos", label: "Produtos", icon: "gg:shopping-bag" },
    { id: "horarios", label: "Agenda", icon: "uil:schedule" },
    { id: "perfil", label: "Perfil", icon: "tabler:user" },
  ];

  return (
    <div id="tabbar-adm" className="site">
      <div className="container">
        <nav className="mk-tabbar">
          <ul>
            {tabs.map((tab) => (
              <li
                key={tab.id}
                className={activeTab === tab.id ? "active" : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                <button type="button" className="nav-button">
                  <span>{tab.label}</span>
                  <Icon icon={tab.icon} className="icon" />
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
};

export default TabBarAdm;
