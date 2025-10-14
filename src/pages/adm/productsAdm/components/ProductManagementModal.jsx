// ProductManagementSlider.jsx
import React, { useState, useEffect, useRef } from "react";
import { Icon } from "@iconify/react";
import { isMobile } from "react-device-detect";

const ProductManagementSlider = ({ product, onClose, onSave }) => {
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [editedProduct, setEditedProduct] = useState(() => {
    const defaultSettings = {
      privacy: false,
      notifications: true,
      prepayment: false,
      rescheduling: true,
      dynamicPricing: [],
      extraFees: {
        timeBased: [],
        serviceBased: []
      }
    };

    return {
      ...product,
      settings: {
        ...defaultSettings,
        ...product.settings
      },
      bookingAdvance: product.bookingAdvance || {
        days: 0,
        hours: 0,
        minutes: 0
      },
      cancellationAdvance: product.cancellationAdvance || {
        days: 0,
        hours: 0,
        minutes: 0
      }
    };
  });

  const [activeTab, setActiveTab] = useState("info");
  const [startY, setStartY] = useState(null);
  const [currentY, setCurrentY] = useState(null);
  const [showDragHandle, setShowDragHandle] = useState(false);

  const sliderRef = useRef(null);
  const dragHandleRef = useRef(null);

  const [carouselItems, setCarouselItems] = useState(
    Array.isArray(product?.images)
      ? product.images.map((img, index) => ({ id: index + 1, image: img }))
      : []
  );
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemIndex, setNewItemIndex] = useState(null);
  const [removingItemIndex, setRemovingItemIndex] = useState(null);

  const handleAddItem = () => {
    if (carouselItems.length >= 5) {
      alert("Você atingiu o limite máximo de 5 fotos.");
      return;
    }

    setIsAddingItem(true);
    const newId = carouselItems.length > 0 ? Math.max(...carouselItems.map(item => item.id)) + 1 : 1;
    setCarouselItems(prev => [...prev, { id: newId, image: null }]);
    setNewItemIndex(carouselItems.length);
  };

  const handleRemoveItem = (index) => {
    setRemovingItemIndex(index);
    setTimeout(() => {
      setCarouselItems(prev => prev.filter((_, i) => i !== index));
      setRemovingItemIndex(null);
    }, 300);
  };

  const handleImageUpload = (event, index) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target.result;

        // Atualiza o carouselItems
        setCarouselItems(prev =>
          prev.map((item, i) =>
            i === index ? { ...item, image: imageUrl } : item
          )
        );

        // Atualiza o editedProduct
        setEditedProduct(prev => {
          const newImages = [...prev.images];
          newImages[index] = imageUrl;
          return {
            ...prev,
            images: newImages.filter(img => img !== null)
          };
        });
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (isAddingItem && newItemIndex !== null) {
      setTimeout(() => {
        setIsAddingItem(false);
        setNewItemIndex(null);
      }, 300);
    }
  }, [isAddingItem, newItemIndex]);


  useEffect(() => {
    // Bloqueia o scroll quando o modal abre
    document.body.style.overflow = 'hidden';
    setEditedProduct({ ...product });
    setShowDragHandle(isMobile);

    // Libera o scroll quando o componente é desmontado
    return () => {
      document.body.style.overflow = '';
    };
  }, [product]);

  useEffect(() => {
    setEditedProduct({ ...product });
    setShowDragHandle(isMobile);
  }, [product]);

  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsVisible(true);
      setIsLoading(false);
    }, 100); // Tempo de loading inicial

    document.body.style.overflow = 'hidden';
    setShowDragHandle(isMobile);

    return () => {
      clearTimeout(timer);
      document.body.style.overflow = '';
    };
  }, [product]);

  const handleClose = () => {
    setIsVisible(false); // Começa a esconder o overlay
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 300); // Tempo deve coincidir com a duração da animação
  };

  const handleSave = () => {
    const productToSave = {
      ...editedProduct,
      images: carouselItems.map(item => item.image).filter(img => img !== null)
    };
    onSave(productToSave);
    handleClose();
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedProduct(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleStatusChange = (newStatus) => {
    setEditedProduct(prev => ({
      ...prev,
      status: newStatus
    }));
  };

  const formatDuration = (minutes) => {
    if (!minutes) return "0m";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const handleTouchStart = (e) => {
    if (!showDragHandle) return;

    // Verifica se o toque começou no drag handle
    const touchTarget = e.target;
    if (!dragHandleRef.current || !dragHandleRef.current.contains(touchTarget)) {
      return;
    }

    setStartY(e.touches[0].clientY);
    setCurrentY(e.touches[0].clientY);
  };

  const handleTouchMove = (e) => {
    if (!showDragHandle || !startY) return;

    const newY = e.touches[0].clientY;
    setCurrentY(newY);

    const deltaY = newY - startY;
    if (deltaY > 0) { // Só permite arrastar para baixo
      e.currentTarget.style.transform = `translateY(${deltaY}px)`;
    }
  };


  const handleTouchEnd = () => {
    if (!showDragHandle || !startY || !currentY) return;

    const distance = currentY - startY;
    if (distance > 100) {
      handleClose();
    } else {
      // Reset position if not dragged enough
      document.querySelector('.pms-slider').style.transform = 'translateY(0)';
    }

    setStartY(null);
    setCurrentY(null);
  };

  // 
  const [isLoading, setIsLoading] = useState(true);
  const [tabChanging, setTabChanging] = useState(false);

  const changeTab = (tab) => {
    if (tab !== activeTab) {
      setIsLoading(true);
      setActiveTab(tab);

      // Simula tempo de carregamento ao trocar de aba
      setTimeout(() => {
        setIsLoading(false);
      }, 500);
    }
  };

  const renderSkeleton = () => {
    switch (activeTab) {
      case "info":
        return (
          <div className="pms-content">
            <div className="pms-section">
              <div className="pms-skeleton pms-skeleton-header"></div>

              <div className="pms-skeleton pms-skeleton-text"></div>
              <div className="pms-skeleton pms-skeleton-input"></div>

              <div className="pms-skeleton pms-skeleton-text"></div>
              <div className="pms-skeleton pms-skeleton-textarea"></div>

              <div className="pms-skeleton pms-skeleton-text"></div>
              <div className="pms-status-btns">
                <div className="pms-skeleton pms-skeleton-button"></div>
                <div className="pms-skeleton pms-skeleton-button"></div>
              </div>
            </div>

            <div className="pms-section">
              <div className="pms-skeleton pms-skeleton-header"></div>

              <div className="pms-skeleton pms-skeleton-text"></div>
              <div className="pms-skeleton pms-skeleton-input"></div>

              <div className="pms-skeleton pms-skeleton-text"></div>
              <div className="pms-skeleton pms-skeleton-input"></div>
            </div>

            <div className="pms-section">
              <div className="pms-skeleton pms-skeleton-header"></div>
              <div className="pms-categories">
                <div className="pms-skeleton pms-skeleton-button" style={{ width: '80px' }}></div>
                <div className="pms-skeleton pms-skeleton-button" style={{ width: '100px' }}></div>
              </div>
            </div>
          </div>
        );
      case "images":
        return (
          <div className="pms-content">
            <div className="pms-skeleton pms-skeleton-header"></div>
            <div className="pms-images-grid">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="pms-image-item">
                  <div className="pms-skeleton pms-skeleton-image"></div>
                </div>
              ))}
            </div>
            <div className="pms-skeleton pms-skeleton-button"></div>
            <div className="pms-skeleton pms-skeleton-text-sm" style={{ marginTop: '8px' }}></div>
          </div>
        );
      case "settings":
        return (
          <div className="pms-content">
            <div className="pms-section">
              <div className="pms-skeleton pms-skeleton-header"></div>

              {[...Array(4)].map((_, i) => (
                <div key={i} className="pms-setting-item">
                  <div className="pms-skeleton pms-skeleton-text" style={{ width: '70%' }}></div>
                  <div className="pms-skeleton pms-skeleton-text-sm"></div>
                  <div className="pms-skeleton pms-skeleton-button" style={{ width: '60px', height: '20px' }}></div>
                </div>
              ))}
            </div>

            <div className="pms-section">
              <div className="pms-skeleton pms-skeleton-header"></div>
              <div className="pms-users-list">
                {[...Array(2)].map((_, i) => (
                  <div key={i} className="pms-user-item">
                    <div className="pms-skeleton pms-skeleton-avatar"></div>
                    <div style={{ flex: 1 }}>
                      <div className="pms-skeleton pms-skeleton-text" style={{ width: '60%' }}></div>
                      <div className="pms-skeleton pms-skeleton-text-sm" style={{ width: '40%' }}></div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pms-skeleton pms-skeleton-button"></div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`pms-overlay ${isVisible ? 'visible' : ''}`} onClick={handleClose}>
      <div
        ref={sliderRef}
        className={`pms-slider ${isClosing ? "closing" : ""}`}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {showDragHandle && (
          <div ref={dragHandleRef} className="pms-drag-handle">
            <div className="pms-drag-indicator" />
          </div>
        )}

        <div className="pms-header">
          <h2>Gerenciar Produto</h2>
          <p>ID: #{product.id}</p>
        </div>

        <div className="pms-tabs">
          <button
            className={`pms-tab-btn ${activeTab === "info" ? "active" : ""}`}
            onClick={() => changeTab("info")}
          >
            Informações
          </button>
          <button
            className={`pms-tab-btn ${activeTab === "images" ? "active" : ""}`}
            onClick={() => changeTab("images")}
          >
            Imagens
          </button>
          <button
            className={`pms-tab-btn ${activeTab === "settings" ? "active" : ""}`}
            onClick={() => changeTab("settings")}
          >
            Configurações
          </button>
        </div>

        <div className="pms-content-container">
          {isLoading ? renderSkeleton() : (
            <>
              {activeTab === "info" && (
                <div className="pms-content">
                  <div className="pms-section">
                    <h3 className="pms-section-title">Informações Básicas</h3>

                    <div className="adm_products-modal-input-group">
                      <label htmlFor="input1">Nome do produto</label>
                      <input
                        type="text"
                        name="name"
                        value={editedProduct.name}
                        onChange={handleInputChange}
                        className="adm_products-modal-input"
                      />
                    </div>

                    <div className="adm_products-modal-input-group">
                      <label htmlFor="input1">Descrição</label>
                      <textarea
                        name="description"
                        value={editedProduct.description}
                        onChange={handleInputChange}
                        className="adm_products-modal-input"
                      />
                    </div>

                    <div className="pms-form-group">
                      <label className="pms-label">Status</label>
                      <div className="pms-status-btns">
                        <button
                          className={`pms-status-btn ${editedProduct.status === "ativos" ? "active" : ""}`}
                          onClick={() => handleStatusChange("ativos")}
                        >
                          Ativo
                        </button>
                        <button
                          className={`pms-status-btn ${editedProduct.status === "arquivados" ? "active" : ""}`}
                          onClick={() => handleStatusChange("arquivados")}
                        >
                          Arquivado
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pms-section">
                    <h3 className="pms-section-title">Detalhes do Produto</h3>

                    <div className="adm_products-modal-input-group">
                      <label htmlFor="input1">Preço</label>
                      <input
                        type="text"
                        name="value"
                        value={editedProduct.value}
                        onChange={handleInputChange}
                        className="adm_products-modal-input"
                      />
                    </div>

                    <div className="adm_products-modal-input-group">
                      <label className="pms-label">Duração</label>

                      <div className="adm_products-modal-input">
                        {formatDuration(editedProduct.duration)}
                      </div>
                    </div>

                    {editedProduct.discount && (
                      <div className="adm_products-modal-input-group">
                        <label htmlFor="input1">Desconto</label>
                        <div className="adm_products-modal-input">
                          {editedProduct.discount}
                          {editedProduct.originalPrice && editedProduct.discountedPrice && (
                            <span className="pms-discount-value">
                              ({editedProduct.originalPrice} → {editedProduct.discountedPrice})
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pms-section">
                    <h3 className="pms-section-title">Categorias</h3>
                    {editedProduct.categories?.length > 0 ? (
                      <div className="pms-categories">
                        {editedProduct.categories.map((category, index) => (
                          <span key={index} className="pms-category-tag">
                            {category}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p>Nenhuma categoria definida</p>
                    )}
                  </div>
                </div>
              )}

              {activeTab === "images" && (
                <div className="pms-content">
                  <h3 className="pms-section-title">Imagens do Produto</h3>

                  <div className="pms-images-grid">
                    {carouselItems.map((item, index) => (
                      <div
                        key={item.id}
                        className={`pms-image-item ${isAddingItem && index === newItemIndex ? "scale-up-item" : ""} ${index === removingItemIndex ? "scale-down-item" : ""}`}
                        onClick={() => document.getElementById(`file-input-${index}`).click()}
                      >
                        <input
                          id={`file-input-${index}`}
                          type="file"
                          accept="image/*"
                          style={{ display: "none" }}
                          onChange={(e) => handleImageUpload(e, index)}
                        />
                        {item.image ? (
                          <>
                            <img src={item.image} alt={`Produto ${index + 1}`} className="pms-image" />
                            <button
                              className="pms-remove-image"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveItem(index);
                              }}
                            >
                              <Icon icon="mdi:trash" />
                            </button>
                          </>
                        ) : (
                          <div className="pms-image-placeholder">
                            <Icon icon="material-symbols:upload-rounded" />
                            <span>Adicionar Imagem</span>
                          </div>
                        )}
                      </div>
                    ))}

                    {carouselItems.length < 5 && (
                      <div className="pms-image-item add-button" onClick={handleAddItem}>
                        <Icon icon="mdi:plus" />
                      </div>
                    )}
                  </div>

                  <div className="pms-add-images-info">
                    <p>Máximo de 5 imagens</p>
                  </div>
                </div>
              )}

              {activeTab === "settings" && (
                <div className="pms-content">
                  <div className="pms-section">
                    <h3 className="pms-section-title">Configurações de Privacidade</h3>

                    <div className="pms-setting-item pms-toggle-container">
                      <div>
                        <label className="pms-label">Produto Privado</label>
                        <p>Deixe este produto visível apenas para usuários administradores</p>
                      </div>
                      <label className="pms-toggle">
                        <input
                          type="checkbox"
                          checked={editedProduct.settings?.privacy || false}
                          onChange={(e) => setEditedProduct(prev => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              privacy: e.target.checked
                            }
                          }))}
                        />
                        <span className="pms-toggle-slider"></span>
                      </label>
                    </div>

                    <div className="pms-setting-item pms-toggle-container">
                      <div>
                        <label className="pms-label">Notificações</label>
                        <p>Enviar avisos para clientes e administradores</p>
                      </div>
                      <label className="pms-toggle">
                        <input
                          type="checkbox"
                          checked={editedProduct.settings?.notifications ?? true}
                          onChange={(e) => setEditedProduct(prev => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              notifications: e.target.checked
                            }
                          }))}
                        />
                        <span className="pms-toggle-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="pms-section">
                    <h3 className="pms-section-title">Configurações de Agendamento</h3>

                    <div className="pms-setting-item">
                      <label className="pms-label">Antecedência para agendamento</label>
                      <div className="pms-setting-value">
                        {editedProduct.bookingAdvance ?
                          `${editedProduct.bookingAdvance.days}d ${editedProduct.bookingAdvance.hours}h ${editedProduct.bookingAdvance.minutes}m` :
                          "Não definido"}
                      </div>
                      <button className="pms-edit-setting">
                        Editar
                      </button>
                    </div>

                    <div className="pms-setting-item">
                      <label className="pms-label">Antecedência para cancelamento</label>
                      <div className="pms-setting-value">
                        {editedProduct.cancellationAdvance ?
                          `${editedProduct.cancellationAdvance.days}d ${editedProduct.cancellationAdvance.hours}h ${editedProduct.cancellationAdvance.minutes}m` :
                          "Não definido"}
                      </div>
                      <button className="pms-edit-setting">
                        Editar
                      </button>
                    </div>

                    <div className="pms-setting-item pms-toggle-container">
                      <div>
                        <label className="pms-label">Pagamento antecipado</label>
                        <p>Exige pagamento antes do agendamento</p>
                      </div>
                      <label className="pms-toggle">
                        <input
                          type="checkbox"
                          checked={editedProduct.settings?.prepayment || false}
                          onChange={(e) => setEditedProduct(prev => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              prepayment: e.target.checked
                            }
                          }))}
                        />
                        <span className="pms-toggle-slider"></span>
                      </label>
                    </div>

                    <div className="pms-setting-item pms-toggle-container">
                      <div>
                        <label className="pms-label">Permitir reagendamento</label>
                        <p>Permite alterar data/hora após confirmação</p>
                      </div>
                      <label className="pms-toggle">
                        <input
                          type="checkbox"
                          checked={editedProduct.settings?.rescheduling ?? true}
                          onChange={(e) => setEditedProduct(prev => ({
                            ...prev,
                            settings: {
                              ...prev.settings,
                              rescheduling: e.target.checked
                            }
                          }))}
                        />
                        <span className="pms-toggle-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div className="pms-section">
                    <h3 className="pms-section-title">Configurações Avançadas</h3>

                    <div className="pms-setting-item">
                      <label className="pms-label">Preço Dinâmico</label>
                      <div className="pms-setting-value">
                      </div>
                      <button className="pms-edit-setting">
                        Editar
                      </button>
                    </div>

                    <div className="pms-setting-item">
                      <label className="pms-label">Taxas Extras</label>
                      <div className="pms-setting-value">

                      </div>
                      <button className="pms-edit-setting">
                        Editar
                      </button>
                    </div>
                  </div>

                  <div className="pms-section">
                    <h3 className="pms-section-title">Usuários Relacionados</h3>

                    {editedProduct.relatedUsers?.length > 0 ? (
                      <div className="pms-users-list">
                        {editedProduct.relatedUsers.map((user, index) => (
                          <div key={index} className="pms-user-item">
                            <div className="pms-user-avatar">{user.name.charAt(0)}</div>
                            <div className="pms-user-info">
                              <h4>{user.name}</h4>
                              <p>{user.role}</p>
                            </div>
                            <button className="pms-remove-user">
                              <Icon icon="mdi:trash" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p>Nenhum usuário relacionado</p>
                    )}

                    <button className="pms-add-user">
                      <Icon icon="mdi:plus" />
                      Adicionar Usuário
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="pms-actions">
          <button className="pms-cancel" onClick={handleClose}>
            Desfazer Alterações
          </button>
          <button className="pms-save" onClick={handleSave}>
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductManagementSlider;