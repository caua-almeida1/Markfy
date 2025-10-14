import React, { useState } from "react";
import { Icon } from "@iconify/react";

import Thumb1 from "../../../img/1.jpg"

import "./orders.css";

const Orders = () => {
    const [activeTab, setActiveTab] = useState("ativos");

    const orders = [
        { id: 1, name: "Corte de Cabelo", status: "ativos", date: "2024-12-21" },
        { id: 4, name: "Corte de Cabelo", status: "ativos", date: "2024-12-21" },
        { id: 2, name: "Pedido 2", status: "completos", date: "2024-12-19" },
        { id: 3, name: "Pedido 3", status: "cancelados", date: "2024-12-15" },
        { id: 5, name: "Pedido 3", status: "cancelados", date: "2024-12-15" },
        { id: 6, name: "Pedido 3", status: "cancelados", date: "2024-12-15" },
        { id: 7, name: "Pedido 3", status: "cancelados", date: "2024-12-15" },

    ];

    const filteredOrders = orders.filter((order) => order.status === activeTab);

    return (
        <div className="orders-page">
            <header className="orders-header">
                <div className="header-content">
                    <h1>Pedidos</h1>
                    <div className="orders-header-tabs">
                        <button
                            className={activeTab === "ativos" ? "active" : ""}
                            onClick={() => setActiveTab("ativos")}
                        >
                            Ativos
                        </button>
                        <button
                            className={activeTab === "completos" ? "active" : ""}
                            onClick={() => setActiveTab("completos")}
                        >
                            Completos
                        </button>
                        <button
                            className={activeTab === "cancelados" ? "active" : ""}
                            onClick={() => setActiveTab("cancelados")}
                        >
                            Cancelados
                        </button>
                    </div>
                </div>
            </header>

            <div className="orders-content">
                {filteredOrders.length > 0 ? (
                    filteredOrders.map((order) => (
                        <div className="order-card" key={order.id}>
                            <div className="order-card-header">
                                <img src={Thumb1} />
                                <div className="order-card-infos-product">
                                    <div className="order-card-product-name-status">
                                        <h3>{order.name} </h3>
                                        <Icon icon="tabler:dots" className="icon" />
                                    </div>
                                    <div className="order-info-description">
                                        <div className="order-info-description-line-flex">
                                            <div className="order-description-item">
                                                <Icon icon="tabler:clock-hour-4-filled" className="icon" />
                                                08:00 - 08:30
                                            </div>
                                            <div className="order-description-item">
                                                <Icon icon="lets-icons:date-fill" className="icon" />
                                                24/08/24
                                            </div>
                                        </div>
                                        <div className="order-description-item">
                                            <Icon icon="eos-icons:master" className="icon" />
                                            Thales Silva
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="order-card-body">
                            </div>
                            <div className="order-card-footer">
                                <button className="order-cancel-button">Cancelar</button>
                                <button className="order-view-button">Gerenciar Pedido</button>
                            </div>
                        </div>
                    ))
                ) : (
                    <p>Nenhum pedido encontrado para esta aba.</p>
                )}
            </div>
        </div>
    );
};

export default Orders;
