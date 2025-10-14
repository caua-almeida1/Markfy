import React, { useState } from 'react';
import { Icon } from '@iconify/react';

const TabBar = () => {
  const [activeTab, setActiveTab] = useState('home');

  const toggleActiveTab = (tabId) => {
    setActiveTab(tabId);
  };

  return (
    <div id="page" className="site">
      <div className="container">
        <nav>
          <ul>
            <li
              className={activeTab === 'home' ? 'active' : ''}
              onClick={() => toggleActiveTab('home')}
            >
              <a href="#" id="home">
                <span>Início</span>
                <Icon icon="ri:home-line" className="icon" />
              </a>
            </li>
            <li
              className={activeTab === 'reservas' ? 'active' : ''}
              onClick={() => toggleActiveTab('reservas')}
            >
              <a href="#" id="reservas">
                <span>Reservas</span>
                <Icon icon="mingcute:calendar-line" className="icon" />
              </a>
            </li>
            <li
              className={activeTab === 'conversas' ? 'active' : ''}
              onClick={() => toggleActiveTab('conversas')}
            >
              <a href="#" id="conversas">
                <span>Produtos</span>
                <Icon icon="gg:shopping-bag" className="icon"/>
              </a>
            </li>
            <li
              className={activeTab === 'carrinho' ? 'active' : ''}
              onClick={() => toggleActiveTab('carrinho')}
            >
              <a href="#" id="carrinho">
                <span>Carrinho</span>
                <Icon icon="humbleicons:cart" className="icon" />
              </a>
            </li>
            <li
              className={activeTab === 'perfil' ? 'active' : ''}
              onClick={() => toggleActiveTab('perfil')}
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

export default TabBar;
