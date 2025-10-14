import React, { useState, useEffect } from 'react';
import './DashboardAdm.css';
import { Icon } from '@iconify/react';
import { getAuth } from "firebase/auth";
import { getDatabase, ref, get } from "firebase/database";

import MaleEmoji1 from "../../../img/MEMOJIS PACK/males/emoji (1).svg";
import MaleEmoji2 from "../../../img/MEMOJIS PACK/males/emoji (2).svg";
import MaleEmoji3 from "../../../img/MEMOJIS PACK/males/emoji (3).svg";
import MaleEmoji4 from "../../../img/MEMOJIS PACK/males/emoji (4).svg";
import MaleEmoji5 from "../../../img/MEMOJIS PACK/males/emoji (5).svg";

const Dashboard = ({ activeTab, setActiveTab }) => {
    const [showBalance, setShowBalance] = useState(false);  // Inicializa com 'false' para deixar o saldo oculto
    const [transitioning, setTransitioning] = useState(false);
    const [userName, setUserName] = useState("");

    const toggleVisibility = () => {
        setTransitioning(true);
        setTimeout(() => {
            setShowBalance(!showBalance);
            setTransitioning(false);
        }, 400);
    };

    const getGreeting = () => {
        const currentHour = new Date().getHours();
        if (currentHour < 12) {
            return 'Bom dia';
        } else if (currentHour < 18) {
            return 'Boa tarde';
        } else {
            return 'Boa noite';
        }
    };

    useEffect(() => {
        const auth = getAuth();
        const user = auth.currentUser;

        if (user) {
            const db = getDatabase();
            const userRef = ref(db, `users/${user.uid}`);
            get(userRef).then(snapshot => {
                if (snapshot.exists()) {
                    const data = snapshot.val();
                    setUserName(data.name || "Usuário");
                } else {
                    setUserName("Usuário");
                }
            }).catch(error => {
                console.error("Erro ao buscar nome:", error);
                setUserName("Usuário");
            });
        }
    }, []);

    // Exemplo de dados fictícios
    const admins = [
        { id: 1, name: 'Thales Silva', img: MaleEmoji1 },
        { id: 2, name: 'Maria Oliveira', img: MaleEmoji2 },
        { id: 3, name: 'Carlos Almeida', img: MaleEmoji3 },
        { id: 4, name: 'Ana Costa', img: MaleEmoji4 },
        { id: 5, name: 'Fernanda Ramos Ola ola ola', img: MaleEmoji5 },
    ];

    return (
        <div className="dashboard-page">
            <header className="dashboard-adm-header">
                <div className="dashboard-adm-header-content">
                    <div className="dashboard-adm-header-description">
                        <p>Olá, {userName}</p>
                        <h1>{getGreeting()}!</h1>
                    </div>

                    <div className="icon-container">
                        <Icon icon="ph:bell-bold" className="icon" />
                        <span className="notification-circle">9+</span>
                    </div>
                </div>
            </header>

            <div className="dashboard-content">
                <div className="dashboard-top-content">
                    <p>Saldo Estimado</p>
                    <div className="dashboard-top-content-wallet">
                        <h1
                            className={`wallet-balance ${transitioning ? 'hidden' : 'visible'}`}
                        >
                            {showBalance ? 'R$17.398,20' : '******'}
                        </h1>
                        <div className={`icon-container ${showBalance ? 'active' : ''}`}>
                            <span className="icon-background"></span>
                            <Icon
                                icon={showBalance ? 'mdi:eye' : 'mdi:eye-off'}
                                className="icon"
                                onClick={toggleVisibility}
                            />
                        </div>
                    </div>
                </div>

                <div className="dashboard-mid-content">
                    <div className="dashboard-mid-products">
                        <h1>Administradores</h1>
                        <div className="dashboard-products-list-content">
                            <button>
                                <Icon icon="mynaui:plus" className="icon" />
                            </button>
                            <div className="dashboard-admins-list">
                                {admins.map((admin) => (
                                    <div key={admin.id} className="dashboard-adm-item">
                                        <img src={admin.img} alt={`Imagem de ${admin.name}`} />
                                        <h1>{admin.name.length > 14 ? `${admin.name.slice(0, 14)}...` : admin.name}</h1>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className='dashboard-buttons-actions'>
                        <button><Icon icon="ph:hand-coins" className='icon' /> Transações</button>
                        <button onClick={() => setActiveTab("produtos", { openModal: true })}>
                            <Icon icon="tabler:user" className='icon' />
                            Novo Produto
                        </button>
                    </div>

                    <div className="dashboard-card-section">
                        <div className='dashboard-card-section-header'>
                            <h1>Pedidos</h1>
                            <p>Ver Mais</p>
                        </div>

                        <div className="dashboard-cards">
                            <div className="dashboard-card">
                                <h2>Pedro Henrique</h2>
                                <div className='dashboard-content-price-time'>
                                    <p className='dashboard-card-time'>21:30 - 22:00</p>
                                    <p className='dashboard-card-price'>R$45,00</p>
                                </div>
                            </div>
                            <div className="dashboard-card">
                                <h2>Pedro Henrique</h2>
                                <div className='dashboard-content-price-time'>
                                    <p className='dashboard-card-time'>21:30 - 22:00</p>
                                    <p className='dashboard-card-price'>R$45,00</p>
                                </div>
                            </div>
                            <div className="dashboard-card">
                                <h2>Pedro Henrique</h2>
                                <div className='dashboard-content-price-time'>
                                    <p className='dashboard-card-time'>21:30 - 22:00</p>
                                    <p className='dashboard-card-price'>R$45,00</p>
                                </div>
                            </div>
                            <div className="dashboard-card">
                                <h2>Pedro Henrique</h2>
                                <div className='dashboard-content-price-time'>
                                    <p className='dashboard-card-time'>21:30 - 22:00</p>
                                    <p className='dashboard-card-price'>R$45,00</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Dashboard;
