import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './initial-setup.css';

import Logo from '../../img/logo-markfy.svg';

import { getDatabase, ref, get } from 'firebase/database';
import { Icon } from '@iconify/react';

import { signOut } from 'firebase/auth';
import { auth } from '../../firebase/firebase';

import BusinessForm from './initial-steps-components/BusinessForm';

const InitialSetup = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const { name: initialName, email, id } = location.state || {};

  const [name, setName] = useState(
    initialName ? initialName.split(' ')[0] : ''
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRole, setSelectedRole] = useState(null);
  const [showBusinessForm, setShowBusinessForm] = useState(false);

  useEffect(() => {
    if (!initialName && id) {
      setLoading(true);

      const db = getDatabase();
      const userRef = ref(db, `users/${id}/name`);

      get(userRef)
        .then((snapshot) => {
          if (snapshot.exists()) {
            const fullName = snapshot.val();
            const firstName = fullName?.split(' ')[0] || fullName;

            setName(firstName);
          } else {
            setError('Não foi possível encontrar seus dados.');
          }
        })
        .catch((err) => {
          console.error('Erro ao buscar nome do Firebase:', err);
          setError('Não foi possível carregar seus dados.');
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [initialName, id]);

  useEffect(() => {
    if (!initialName && !id) {
      navigate('/');
    }
  }, [initialName, id, navigate]);

  const handleSelectRole = (role) => {
    setSelectedRole(role);
    setError('');
  };

  const handleContinue = () => {
    if (!selectedRole || loading) return;

    if (selectedRole === 'admin') {
      setShowBusinessForm(true);
      return;
    }

    // Fluxo do cliente
    console.log('Cliente comum selecionado');
  };

  const handleBack = () => {
    if (showBusinessForm) {
      setShowBusinessForm(false);
      return;
    }

    if (window.history.length > 2) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch (err) {
      console.error('Erro ao sair:', err);
    }
  };

  if (showBusinessForm) {
    return (
      <main className="initial-setup-wrapper">
        <header className="initial-setup-header">
          <img
            src={Logo}
            alt="Markfy"
            className="initial-setup-logo"
          />

          <button
            type="button"
            className="initial-setup-exit"
            onClick={handleSignOut}
          >
            <span>Sair</span>
            <Icon icon="solar:logout-2-linear" />
          </button>
        </header>

        <div className="initial-setup-business">
          <button
            type="button"
            className="initial-setup-business-back"
            onClick={handleBack}
          >
            <Icon icon="solar:arrow-left-linear" />
            Voltar
          </button>

          <BusinessForm userId={id} />
        </div>
      </main>
    );
  }

  return (
    <main className="initial-setup-wrapper">

      {/* HEADER */}
      <header className="initial-setup-header">

        <img
          src={Logo}
          alt="Markfy"
          className="initial-setup-logo"
        />

        <div className="initial-setup-header-right">

          {email && (
            <span className="initial-setup-email">
              {email}
            </span>
          )}

          <button
            type="button"
            className="initial-setup-exit"
            onClick={handleSignOut}
            aria-label="Sair da conta"
          >
            <span>Sair</span>
            <Icon icon="solar:logout-2-linear" />
          </button>

        </div>

      </header>


      {/* CONTENT */}
      <section className="initial-setup-content">

        {/* PROGRESS */}
        <div className="initial-setup-progress">

          <div className="initial-setup-progress-item active">
            <span>01</span>
            <p>Perfil</p>
          </div>

          <div className="initial-setup-progress-line" />

          <div className="initial-setup-progress-item">
            <span>02</span>
            <p>Negócio</p>
          </div>

          <div className="initial-setup-progress-line" />

          <div className="initial-setup-progress-item">
            <span>03</span>
            <p>Finalização</p>
          </div>

        </div>


        {/* INTRO */}
        <div className="initial-setup-intro">

          <span className="initial-setup-overline">
            CONFIGURAÇÃO INICIAL
          </span>

          <h1>
            Olá, {name || 'seja bem-vindo'}.
          </h1>

          <p>
            Como você pretende utilizar a Markfy?
          </p>

        </div>


        {/* ROLE SELECTOR */}
        <div className="initial-setup-roles">

          <button
            type="button"
            className={`initial-setup-role ${selectedRole === 'user' ? 'selected' : ''
              }`}
            onClick={() => handleSelectRole('user')}
          >

            <div className="initial-setup-role-icon">
              <Icon icon="mi:user" />
            </div>

            <div className="initial-setup-role-text">
              <strong>Sou cliente</strong>

              <span>
                Quero encontrar e utilizar negócios.
              </span>
            </div>

            <div className="initial-setup-role-indicator">
              {selectedRole === 'user' && (
                <Icon icon="material-symbols:check" />
              )}
            </div>

          </button>


          <button
            type="button"
            className={`initial-setup-role ${selectedRole === 'admin' ? 'selected' : ''
              }`}
            onClick={() => handleSelectRole('admin')}
          >

            <div className="initial-setup-role-icon">
              <Icon icon="icon-park-outline:shop" />
            </div>

            <div className="initial-setup-role-text">
              <strong>Tenho um negócio</strong>

              <span>
                Quero cadastrar e administrar meu negócio.
              </span>
            </div>

            <div className="initial-setup-role-indicator">
              {selectedRole === 'admin' && (
                <Icon icon="material-symbols:check" />
              )}
            </div>

          </button>

        </div>


        {/* ERROR */}
        {error && (
          <div className="initial-setup-error">
            <Icon icon="solar:danger-triangle-linear" />
            <span>{error}</span>
          </div>
        )}


        {/* FOOTER */}
        <div className="initial-setup-footer">

          <button
            type="button"
            className="initial-setup-back"
            onClick={handleBack}
          >
            <Icon icon="solar:arrow-left-linear" />
            Voltar
          </button>

          <button
            type="button"
            className="initial-setup-continue"
            disabled={!selectedRole || loading}
            onClick={handleContinue}
          >
            <span>Continuar</span>

            <Icon icon="solar:arrow-right-linear" />
          </button>

        </div>

      </section>

    </main>
  );
};

export default InitialSetup;