import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { auth } from '../../../firebase/firebase';
import { get, getDatabase, ref, onValue } from 'firebase/database';

import { fetchCompanyHandles } from '../../../firebase/companiesIndex';

import {
    createJoinRequest,
    getPendingJoinHandle,
    REQUEST_STATUS
} from '../../../utils/joinRequests';

import JoinRequestWaiting from './JoinRequestWaiting';

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

    const [joining, setJoining] = useState(false);

    /* Handle da empresa cujo pedido está pendente. Enquanto
       tiver valor, a tela mostra a espera em vez do formulário. */
    const [pendingHandle, setPendingHandle] = useState(null);

    const [checkingPending, setCheckingPending] = useState(true);


    /*
     * Pedido em aberto de uma sessão anterior.
     *
     * Quem pediu, fechou a aba e voltou depois precisa cair de
     * volta na tela de espera — e não num formulário que o
     * convida a pedir de novo.
     */
    useEffect(() => {

        let cancelado = false;

        const verificar = async () => {

            const currentUser = auth.currentUser;

            if (!currentUser) {
                if (!cancelado) setCheckingPending(false);
                return;
            }

            try {

                const handle =
                    await getPendingJoinHandle(currentUser.uid);

                if (cancelado) return;

                if (handle) {

                    /* Confirma que o pedido ainda está de pé: um
                       pedido recusado e removido deixaria a
                       pessoa presa numa espera que não existe. */
                    const snapshot = await get(
                        ref(
                            getDatabase(),
                            `companys/${handle}/joinRequests/${currentUser.uid}`
                        )
                    );

                    const pedido = snapshot.val();

                    if (
                        pedido &&
                        pedido.status !== REQUEST_STATUS.REJECTED
                    ) {
                        setPendingHandle(handle);
                    }

                }

            } catch (error) {

                console.error(
                    'Erro ao verificar pedido pendente:',
                    error
                );

            } finally {

                if (!cancelado) setCheckingPending(false);

            }

        };

        verificar();

        return () => {
            cancelado = true;
        };

    }, []);

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
     *
     * Usa o índice leve: só precisamos dos handles para
     * montar as sugestões. Escutar 'companys' baixava
     * produtos, agendamentos e pedidos de todas elas.
     */
    useEffect(() => {
        const db = getDatabase();
        const companiesRef = ref(db, 'companiesIndex');

        let cancelado = false;

        /*
         * Índice vazio não quer dizer "não há empresas".
         *
         * companiesIndex só ganha entrada quando uma empresa é
         * criada ou editada depois que o índice passou a
         * existir. As empresas antigas nunca entraram nele —
         * e como a busca lia só o índice, ela não achava
         * NENHUMA empresa e respondia "Empresa não encontrada"
         * para todo mundo, inclusive para @ que existem.
         *
         * A queda é a mesma das outras telas: listar os
         * handles direto de companys/, com leitura rasa (só as
         * chaves, sem baixar produtos e agendamentos junto).
         */
        const listarDaFonte = async () => {

            let token = null;

            try {

                token =
                    await auth.currentUser?.getIdToken();

            } catch {

                token = null;

            }

            const handles =
                await fetchCompanyHandles(token);

            if (!cancelado) {
                setCompanyList(handles);
            }

        };

        const unsubscribe = onValue(
            companiesRef,
            (snapshot) => {

                if (cancelado) return;

                const data = snapshot.val();

                const handles = data
                    ? Object.keys(data)
                    : [];

                if (handles.length === 0) {
                    listarDaFonte();
                    return;
                }

                setCompanyList(handles);

            },
            () => {

                /* Sem permissão de leitura no índice: cai para
                   a fonte do mesmo jeito. */
                listarDaFonte();

            }
        );

        return () => {
            cancelado = true;
            unsubscribe();
        };
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

        /*
         * Busca pelo handle, mas comparando também a versão
         * "legível" dele.
         *
         * A versão antiga trocava _ e - por espaço ANTES de
         * buscar e devolvia esse texto como sugestão. Quem
         * clicasse numa empresa chamada "corte_fino" recebia
         * "corte fino" no campo — um handle que não existe, e
         * o pedido de entrada era recusado logo depois.
         *
         * Agora o handle original viaja junto e é ele que
         * volta para o campo.
         */
        const fuse = new Fuse(
            companyList.map((handle) => ({
                handle,
                busca: handle.replace(/[_\-]/g, ' ')
            })),
            {
                keys: ['handle', 'busca'],
                includeScore: true,
                threshold: 0.4
            }
        );

        const result = fuse.search(value);

        const suggestions = result.map(
            (item) => item.item.handle
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
    const handleJoinCompany = async (event) => {
        event.preventDefault();

        const handle = companyAt.trim().replace(/^@/, '');

        if (!handle) {
            setCompanyError(
                'Digite o @ da empresa para continuar.'
            );

            return;
        }

        const currentUser = auth.currentUser;

        if (!currentUser) {
            setCompanyError(
                'Sua sessão expirou. Entre de novo para continuar.'
            );

            return;
        }

        setJoining(true);
        setCompanyError('');

        try {

            const db = getDatabase();

            /*
             * A empresa precisa existir.
             *
             * Sem esta checagem o pedido seria gravado num
             * caminho inventado — ninguém do outro lado veria
             * nada, e a pessoa ficaria esperando para sempre
             * uma aprovação que não tem quem dar.
             *
             * A checagem é em companys/{handle}/name, e não em
             * companiesIndex: o índice só recebe entrada
             * quando a empresa é criada ou editada, então as
             * empresas antigas não estão nele. Validar pelo
             * índice recusava empresas que existem — inclusive
             * as que a tela de explorar mostra.
             */
            const existe = await get(
                ref(db, `companys/${handle}/name`)
            );

            if (!existe.exists()) {

                setCompanyError(
                    'Não encontramos uma empresa com esse @. Confira com quem administra.'
                );

                return;

            }

            /* Já é da equipe: entra direto, sem pedir nada. */
            const jaMembro = await get(
                ref(
                    db,
                    `companys/${handle}/members/${currentUser.uid}`
                )
            );

            if (jaMembro.exists()) {

                navigate('/central-adm');

                return;

            }

            const perfil = await get(
                ref(db, `users/${currentUser.uid}`)
            );

            const dados = perfil.val() || {};

            await createJoinRequest({
                handle,
                user: currentUser,
                name: dados.name,
                email: dados.email,
                phone: dados.phone
            });

            setPendingHandle(handle);

        } catch (error) {

            console.error('Erro ao pedir entrada:', error);

            setCompanyError(
                'Não foi possível enviar o pedido. Tente de novo.'
            );

        } finally {

            setJoining(false);

        }
    };

    /*
     * Criar uma nova empresa
     */
    const handleCreateCompany = () => {
        const sessionId = uuidv4();

        navigate(`/newcompany/${sessionId}`);
    };

    if (checkingPending) {

        return (
            <section className="business-form business-form--loading">
                <Icon icon="svg-spinners:ring-resize" />
                <span>Carregando...</span>
            </section>
        );

    }

    if (pendingHandle) {

        return (
            <JoinRequestWaiting
                handle={pendingHandle}
                uid={auth.currentUser?.uid}
                onCancel={() => {
                    setPendingHandle(null);
                    setCompanyAt('');
                }}
            />
        );

    }

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
                    disabled={joining}
                >
                    {joining
                        ? 'Enviando pedido...'
                        : 'Entrar na empresa'}

                    <Icon
                        icon={
                            joining
                                ? 'svg-spinners:90-ring-with-bg'
                                : 'solar:arrow-right-linear'
                        }
                    />
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