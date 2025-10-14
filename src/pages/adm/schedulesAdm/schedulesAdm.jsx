import React, { useState } from "react";
import { Icon } from '@iconify/react';

import "./schedulesAdm.css";

const SchedulesAdm = () => {

    return (
        <div className="schedules-container">
            <header className="schedules-header">
                <h1>Agenda</h1>
            </header>
            <div className="schedules-content">
                <div className="schedule-content-info-total">
                    <p>Total de Pedidos</p>
                    <h1>217874</h1>
                </div>

                <div className="schedule-content-days-months">
                    <div className="schedule-content-days-months-header">
                        <h1>Dezembro</h1>
                        <Icon icon="iconamoon:arrow-down-2-duotone" className="icon" />
                    </div>
                </div>
                <div className="schedules-list">
                </div>
            </div>


        </div>
    );
};

export default SchedulesAdm;
