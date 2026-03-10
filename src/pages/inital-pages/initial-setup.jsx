import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import './initial-setup.css';

import Logo from '../../img/logo-markfy.svg'; // Adjust the path as necessary

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
            setError('Usuário não encontrado no Realtime Database.');
          }
        })
        .catch((err) => {
          console.error('Erro ao buscar nome do Firebase:', err);
          setError('Erro ao buscar nome do usuário.');
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

  const [showUserConfirmModal, setShowUserConfirmModal] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const closeModal = () => {
    setIsClosing(true);

    setTimeout(() => {
      setShowUserConfirmModal(false);
      setIsClosing(false);
    }, 200);
  };

  const handleSelectRole = (role) => {
    if (selectedRole === role) {
      setSelectedRole(null); // desmarca se já estiver selecionado
    } else {
      setSelectedRole(role); // seleciona novo
    }
  };

  const handleContinue = () => {
    if (selectedRole) {
      setShowUserConfirmModal(true);
    }
  };


  const proceedNext = () => {
    if (selectedRole === 'admin') {
      setShowBusinessForm(true); // Mostra o formulário sem mudar a rota
    } else {
      // Se for cliente, você pode redirecionar ou mostrar algo diferente
      console.log('Cliente comum selecionado');
    }
  };

  const confirmUserRole = () => {
    setShowUserConfirmModal(false);
    proceedNext();
  };

  const cancelUserRole = () => {
    setShowUserConfirmModal(false);
  };

  const [showBusinessForm, setShowBusinessForm] = useState(false);

  return (
    <div className="initial-setup-wrapper">
      <div className="initial-setup-container">
        {!showBusinessForm ? (

          <div className="initial-setup-box">
            <img src={Logo} className='setup-logo' />
            <h1>
              Olá {name}, seja bem-vindo à Markfy!
            </h1>
            <p>Antes de começar, como você deseja utilizar a Markfy?</p>

            <div className="setup-options">
              <div
                className={`setup-card ${selectedRole === 'user' ? 'selected' : ''}`}
                onClick={() => handleSelectRole('user')}
              >
                <div className='setup-card-content-left'>
                  <Icon
                    icon="mi:user"
                    className={`setup-icon ${selectedRole === 'user' ? 'selected-icon' : ''}`}
                  />
                  <span className="setup-label">Sou Cliente</span>
                </div>
                <Icon
                  icon="material-symbols:check"
                  className={`setup-check-icon ${selectedRole === 'user' ? 'selected-check' : ''}`}
                />
              </div>

              <div
                className={`setup-card ${selectedRole === 'admin' ? 'selected' : ''}`}
                onClick={() => handleSelectRole('admin')}
              >
                <div className='setup-card-content-left'>
                  <Icon
                    icon="icon-park-outline:shop"
                    className={`setup-icon ${selectedRole === 'admin' ? 'selected-icon' : ''}`}
                  />
                  <span className="setup-label">Tenho um Negócio</span>
                </div>
                <Icon
                  icon="material-symbols:check"
                  className={`setup-check-icon ${selectedRole === 'admin' ? 'selected-check' : ''}`}
                />
              </div>
            </div>

            <button
              className="setup-button setup-button-continue"
              disabled={loading || !selectedRole}
              onClick={handleContinue}
            >
              Continuar
            </button>

            <button
              className="setup-button setup-button-return"
              onClick={() => {
                if (window.history.length > 2) {
                  navigate(-1);
                } else {
                  navigate('/');
                }
              }}>
              Voltar
            </button>
          </div>
        ) : (
          <BusinessForm userId={id} />
        )}
      </div>
      {showUserConfirmModal && (
        <div className={`setup-confirmation-modal-overlay ${isClosing ? 'closing' : ''}`}>
          <div className={`setup-confirmation-modal-box ${isClosing ? 'closing' : ''}`}>
            <Icon icon="ix:question" className='icon' />
            <h2>Confirmar escolha</h2>
            <p>
              Você tem certeza que deseja vincular sua conta como um{' '}
              <strong>{selectedRole === 'user' ? 'Usuário Comum' : 'Administrador de Negócio'}</strong>?
            </p>
            <div className="setup-confirmation-modal-actions">
              <button
                className="setup-confirmation-modal-button cancel"
                onClick={closeModal}
              >
                Cancelar
              </button>

              <button
                className="setup-confirmation-modal-button initial-setup-confirmation-confirm"
                onClick={confirmUserRole}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div >
  );

};

export default InitialSetup;
