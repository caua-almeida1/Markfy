import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { auth } from '../../../firebase/firebase';
import { getDatabase, ref, onValue } from 'firebase/database';

import './business-form.css';

import debounce from 'lodash/debounce';
import Fuse from 'fuse.js';
import { v4 as uuidv4 } from 'uuid';

import { Icon } from '@iconify/react';

const BusinessForm = () => {
    const navigate = useNavigate();

    const [userName, setUserName] = useState('');
    const [companyAt, setCompanyAt] = useState('');

    const [companyList, setCompanyList] = useState([]);
    const [filteredCompanies, setFilteredCompanies] = useState([]);

    const [showSuggestions, setShowSuggestions] = useState(false);
    const [companyError, setCompanyError] = useState('');

    /*
     * Busca o nome do usuário
     */
    useEffect(() => {
        const currentUser = auth.currentUser;

        if (!currentUser) return;

        const db = getDatabase();
        const userRef = ref(
            db,
            `users/${currentUser.uid}/name`
        );

        const unsubscribe = onValue(userRef, (snapshot) => {
            if (!snapshot.exists()) return;

            const fullName = snapshot.val();
            const firstName =
                fullName?.split(' ')[0] || fullName;

            setUserName(firstName);
        });

        return () => unsubscribe();
    }, []);

    /*
     * Busca as empresas cadastradas
     */
    useEffect(() => {
        const db = getDatabase();
        const companiesRef = ref(db, 'companys');

        const unsubscribe = onValue(
            companiesRef,
            (snapshot) => {
                const data = snapshot.val();

                if (data) {
                    setCompanyList(Object.keys(data));
                } else {
                    setCompanyList([]);
                }
            }
        );

        return () => unsubscribe();
    }, []);

    /*
     * Busca empresas
     */
    const filterSuggestions = debounce((value) => {
        if (!value.trim()) {
            setFilteredCompanies([]);
            setShowSuggestions(false);
            return;
        }

        const fuse = new Fuse(
            companyList.map((company) =>
                company.replace(/[_\-]/g, ' ')
            ),
            {
                includeScore: true,
                threshold: 0.4,
            }
        );

        const result = fuse.search(value);

        const suggestions = result.map(
            (item) => item.item
        );

        setFilteredCompanies(
            suggestions.length > 0
                ? suggestions
                : ['Empresa não encontrada']
        );

        setShowSuggestions(true);
    }, 300);

    /*
     * Input
     */
    const handleInputChange = (event) => {
        const value = event.target.value.replace(/^@/, '');

        setCompanyAt(value);
        setCompanyError('');

        filterSuggestions(value);
    };

    /*
     * Seleciona sugestão
     */
    const handleSuggestionClick = (name) => {
        if (name === 'Empresa não encontrada') {
            return;
        }

        setCompanyAt(name);
        setCompanyError('');
        setShowSuggestions(false);
    };

    /*
     * Entrar em uma empresa
     */
    const handleJoinCompany = (event) => {
        event.preventDefault();

        if (!companyAt.trim()) {
            setCompanyError(
                'Digite o @ da empresa para continuar.'
            );

            return;
        }

        console.log(
            `Tentando entrar na empresa @${companyAt}`
        );
    };

    /*
     * Criar uma nova empresa
     */
    const handleCreateCompany = () => {
        const sessionId = uuidv4();

        navigate(`/newcompany/${sessionId}`);
    };

    return (
        <section className="business-form">

            {/* INTRO */}
            <div className="business-form-intro">

                <span className="business-form-overline">
                    DADOS DA EMPRESA
                </span>

                <h1>
                    Vamos encontrar sua empresa.
                </h1>

                <p>
                    Você já trabalha em uma empresa cadastrada
                    na Markfy ou deseja criar uma nova?
                </p>

            </div>


            {/* EMPRESA EXISTENTE */}
            <form
                className="business-form-existing"
                onSubmit={handleJoinCompany}
            >

                <div className="business-form-section-header">

                    <div className="business-form-section-icon">
                        <Icon icon="icon-park-outline:shop" />
                    </div>

                    <div>
                        <strong>
                            Já tenho uma empresa
                        </strong>

                        <span>
                            Informe o identificador da empresa.
                        </span>
                    </div>

                </div>


                <div className="business-form-input-area">

                    <label htmlFor="companyAt">
                        Identificador da empresa
                    </label>

                    <div
                        className={`business-form-input-wrapper ${companyError ? 'has-error' : ''
                            }`}
                    >

                        <span className="business-form-at">
                            @
                        </span>

                        <input
                            id="companyAt"
                            type="text"
                            name="companyAt"
                            value={companyAt}
                            onChange={handleInputChange}
                            placeholder="nome_da_empresa"
                            autoComplete="off"
                            spellCheck="false"
                        />

                        {companyAt && (
                            <button
                                type="button"
                                className="business-form-clear"
                                onClick={() => {
                                    setCompanyAt('');
                                    setFilteredCompanies([]);
                                    setShowSuggestions(false);
                                    setCompanyError('');
                                }}
                                aria-label="Limpar"
                            >
                                <Icon icon="material-symbols:close" />
                            </button>
                        )}

                    </div>


                    {/* SUGESTÕES */}
                    {showSuggestions && (
                        <div className="business-form-suggestions">

                            {filteredCompanies.map(
                                (name, index) => {

                                    const notFound =
                                        name ===
                                        'Empresa não encontrada';

                                    return (
                                        <button
                                            type="button"
                                            key={`${name}-${index}`}
                                            className={`business-form-suggestion ${notFound
                                                    ? 'not-found'
                                                    : ''
                                                }`}
                                            onClick={() =>
                                                handleSuggestionClick(name)
                                            }
                                            disabled={notFound}
                                        >
                                            <Icon
                                                icon={
                                                    notFound
                                                        ? 'solar:info-circle-linear'
                                                        : 'icon-park-outline:shop'
                                                }
                                            />

                                            <span>
                                                {notFound
                                                    ? name
                                                    : `@${name}`}
                                            </span>

                                            {!notFound && (
                                                <Icon
                                                    icon="solar:arrow-right-linear"
                                                />
                                            )}
                                        </button>
                                    );
                                }
                            )}

                        </div>
                    )}

                    {companyError && (
                        <span className="business-form-error">
                            <Icon icon="solar:danger-triangle-linear" />
                            {companyError}
                        </span>
                    )}

                </div>


                <button
                    type="submit"
                    className="business-form-primary"
                >
                    Entrar na empresa

                    <Icon icon="solar:arrow-right-linear" />
                </button>

            </form>


            {/* SEPARADOR */}
            <div className="business-form-divider">
                <span>ou</span>
            </div>


            {/* CRIAR EMPRESA */}
            <button
                type="button"
                className="business-form-create"
                onClick={handleCreateCompany}
            >

                <div className="business-form-create-icon">
                    <Icon icon="solar:add-circle-linear" />
                </div>

                <div className="business-form-create-content">

                    <strong>
                        Quero criar uma empresa
                    </strong>

                    <span>
                        Cadastre uma nova empresa na Markfy.
                    </span>

                </div>

                <Icon
                    icon="solar:arrow-right-linear"
                    className="business-form-create-arrow"
                />

            </button>

        </section>
    );
};

export default BusinessForm;