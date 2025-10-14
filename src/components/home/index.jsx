// Home.jsx
import React from 'react';
import { useLocation } from 'react-router-dom';

import './home.css'; 

const Home = () => {
    const location = useLocation();
    const { name, email } = location.state || {};

    return (
        <div className='home_container'>
            <h1>Bem-vindo, {name}!</h1>
            <h1>Email: {email}</h1>
        </div>
    );
};

export default Home;
