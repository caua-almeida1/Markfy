import React, { useEffect } from 'react';
import MarkfyLogo from "../../../../img/logo-markfy.png";
import "./splashscreen.css";

const SplashScreen = ({ onAnimationComplete }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onAnimationComplete();
        }, 3000); 

        return () => clearTimeout(timer);
    }, [onAnimationComplete]);

    return (
        <div className="splash-container">
            <img
                src={MarkfyLogo}
                alt="Markfy Logo"
                className="splash-logo"
            />
            <h1 className="splash-title">Markfy</h1>
            <p className="splash-subtitle">Sua plataforma de agendamento inteligente</p>
        </div>
    );
};

export default SplashScreen;