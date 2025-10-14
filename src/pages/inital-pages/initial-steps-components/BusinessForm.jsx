import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../../firebase/firebase';
import { getDatabase, ref, onValue } from 'firebase/database';
import './business-form.css';
import debounce from 'lodash/debounce';
import Fuse from 'fuse.js';
import { v4 as uuidv4 } from 'uuid';

import Logo from '../../../img/logo-markfy.svg';

const BusinessForm = () => {
    const [userId, setUserId] = useState(null);
    const [userName, setUserName] = useState('');
    const [companyAt, setCompanyAt] = useState('');
    const [companyList, setCompanyList] = useState([]);
    const [filteredCompanies, setFilteredCompanies] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [companyError, setCompanyError] = useState('');

    useEffect(() => {
        const currentUser = auth.currentUser;
        if (currentUser) {
            const uid = currentUser.uid;
            setUserId(uid);

            const db = getDatabase();
            const userRef = ref(db, `users/${uid}/name`);
            onValue(userRef, (snapshot) => {
                const fullName = snapshot.val();
                const firstName = fullName?.split(' ')[0] || fullName;
                setUserName(firstName);
            });
        }
    }, []);

    useEffect(() => {
        const db = getDatabase();
        const companiesRef = ref(db, 'companys'); // ← aqui troca para "companys"

        onValue(companiesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const names = Object.keys(data); // aqui pega as chaves que são os @nomes
                setCompanyList(names);
            } else {
                setCompanyList([]);
            }
        });
    }, []);

    const handleInputChange = (e) => {
        const value = e.target.value.replace(/^@/, '');
        setCompanyAt(value);
        filterSuggestions(value);
    };

    const filterSuggestions = debounce((value) => {
        if (value.trim() === '') {
            setFilteredCompanies([]);
            setShowSuggestions(false);
            return;
        }

        const fuse = new Fuse(companyList.map(c => c.replace(/[_\-]/g, ' ')), {
            includeScore: true,
            threshold: 0.4,
        });

        const result = fuse.search(value);

        const suggestions = result.map(res => res.item);

        setFilteredCompanies(suggestions.length > 0 ? suggestions : ['Empresa não encontrada']);
        setShowSuggestions(true);
    }, 300);

    const handleSuggestionClick = (name) => {
        if (name !== 'Empresa não encontrada') {
            setCompanyAt(name);
        }
        setShowSuggestions(false);
    };

    const handleJoinCompany = (e) => {
        e.preventDefault();
        console.log(`Tentando entrar na empresa @${companyAt}`);
    };

    const navigate = useNavigate();

    const handleCreateCompany = () => {
        const sessionId = uuidv4(); // Gera algo como 688f5328-14a4-800e-9f1c-d3fcfcda702d
        navigate(`/newcompany/${sessionId}`);
    };



    return (
        <div className="business-form-wrapper">
            <div className="business-form-container">
                <div className="business-form-box">
                    <img src={Logo} className='setup-logo' />
                    <h2>Olá {userName || '...'}</h2>
                    <p>Você já pertence a uma empresa? Digite o <strong>@</strong> dela aqui embaixo:</p>

                    <div className="company-at-input-wrapper">
                        <span className="company-at-prefix">@</span>
                        <input
                            type="text"
                            name="companyAt"
                            className="company-at-input"
                            placeholder="nome_da_empresa"
                            value={companyAt}
                            onChange={handleInputChange}
                            autoComplete="off"
                            required
                        />
                        {showSuggestions && (
                            <ul className={`company-suggestions ${showSuggestions ? 'show' : ''}`}>
                                {filteredCompanies.map((name, index) => (
                                    <li
                                        key={index}
                                        className={`suggestion-item ${name === 'Empresa não encontrada' ? 'not-found' : ''}`}
                                        onClick={() => handleSuggestionClick(name)}
                                    >
                                        {name === 'Empresa não encontrada' ? name : `@${name}`}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <button onClick={handleJoinCompany} className="business-form-join-btn">
                        Entrar na Empresa
                    </button>

                    <div className="business-form-separator">ou</div>

                    <button onClick={handleCreateCompany} className="business-form-create-btn">
                        Crie Sua Empresa
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BusinessForm;
