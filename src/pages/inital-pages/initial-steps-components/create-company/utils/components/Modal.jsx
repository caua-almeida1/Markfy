import React, { useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";
import { Icon } from "@iconify/react";
import ImageCropper from "./ImageCropper";

const ANIMATION_MS = 300; // <- deve corresponder ao CSS (--modal-transition-duration)

const Modal = ({ updateAvatar, closeModal, selectedImage }) => {
  const [visible, setVisible] = useState(false);
  const timeoutRef = useRef(null);

  useEffect(() => {
    // entrada: ativa a classe .show no próximo tick
    const t = setTimeout(() => setVisible(true), 10);
    return () => {
      clearTimeout(t);
      clearTimeout(timeoutRef.current);
    };
  }, []);

  // Fecha com animação: tira a classe .show, espera a duração e então chama closeModal
  const handleRequestClose = () => {
    if (!visible) return; // evita chamadas repetidas
    setVisible(false);
    timeoutRef.current = setTimeout(() => {
      closeModal();
    }, ANIMATION_MS + 20); // +20ms safety
  };

  // fecha com ESC
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") handleRequestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible]);

  // clique no backdrop (fora do modal)
  const onBackdropMouseDown = (e) => {
    if (e.target === e.currentTarget) handleRequestClose();
  };

  return ReactDOM.createPortal(
    <div
      className={`create-company-logo-modal-backdrop ${visible ? "show" : ""}`}
      onMouseDown={onBackdropMouseDown}
      aria-hidden={!visible}
    >
      <div className="create-company-logo-modal" role="dialog" aria-modal="true">
        <button
          type="button"
          className="create-company-logo-modal-close"
          onClick={handleRequestClose} // usa o fechamento animado
        >
          <Icon icon="mingcute:close-fill" />
        </button>

        <div className="create-company-logo-modal-content">
          <ImageCropper
            imageSrc={selectedImage}
            updateAvatar={updateAvatar}
            closeModal={handleRequestClose} // passa a função animada para o cropper também
          />
        </div>
      </div>
    </div>,
    document.getElementById("modal-root")
  );
};

export default Modal;
