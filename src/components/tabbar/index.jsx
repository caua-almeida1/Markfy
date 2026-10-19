import React from "react";
import { Icon } from "@iconify/react";

/* Abas padrão da página de uma empresa. A central sem
   empresa na URL passa as suas próprias via `tabs`. */
export const DEFAULT_USER_TABS = [
    {
      id: "home",
      label: "Início",
      icon: "ri:home-line"
    },
    {
      id: "reservas",
      label: "Reservas",
      icon: "mingcute:calendar-line"
    },
    {
      id: "catalog",
      label: "Catálogo",
      icon: "gg:shopping-bag"
    },
    {
      id: "explorar",
      label: "Explorar",
      icon: "ic:outline-explore"
    },
    {
      id: "perfil",
      label: "Perfil",
      icon: "tabler:user"
    }
];

const TabBar = ({
  activeTab,
  setActiveTab,
  tabs = DEFAULT_USER_TABS
}) => {


  return (

    <div
      id="tabbar"
      className="site"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        display: "block"
      }}
    >

      <div className="container">

        <nav>

          <ul style={tabs.length < 5 ? { justifyContent: "center" } : undefined}>

            {tabs.map(
              (tab) => (

                <li
                  key={tab.id}
                  className={
                    activeTab === tab.id
                      ? "active"
                      : ""
                  }
                >

                  <button
                    type="button"
                    className="nav-button"
                    aria-current={activeTab === tab.id ? "page" : undefined}
                    onClick={() =>
                      setActiveTab(
                        tab.id
                      )
                    }
                  >

                    <span>
                      {tab.label}
                    </span>


                    <Icon
                      icon={
                        tab.icon
                      }
                      className="icon"
                    />

                  </button>

                </li>

              )
            )}

          </ul>

        </nav>

      </div>

    </div>

  );

};

export default TabBar;