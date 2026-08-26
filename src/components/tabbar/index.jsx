import React from "react";
import { Icon } from "@iconify/react";

const TabBar = ({ activeTab, setActiveTab }) => {

  const tabs = [
    { id: "home", label: "Início", icon: "ri:home-line" },
    { id: "reservas", label: "Reservas", icon: "mingcute:calendar-line" },
    { id: "produtos", label: "Produtos", icon: "gg:shopping-bag" },
    { id: "carrinho", label: "Carrinho", icon: "humbleicons:cart" },
    { id: "perfil", label: "Perfil", icon: "tabler:user" },
  ];

  return (
    <div
      id="tabbar"
      className="site"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        display: "block"
      }}
    >
      <div className="container">
        <nav>
          <ul>

            {tabs.map((tab) => (
              <li
                key={tab.id}
                className={activeTab === tab.id ? "active" : ""}
                onClick={() => setActiveTab(tab.id)}
              >
                <button
                  type="button"
                  className="nav-button"
                  onClick={() => setActiveTab(tab.id)}
                >
                  <span>{tab.label}</span>

                  <Icon
                    icon={tab.icon}
                    className="icon"
                  />
                </button>

              </li>
            ))}

          </ul>
        </nav>
      </div>
    </div>
  );
};

export default TabBar;