import { useState } from "react";
import { Icon } from "@iconify/react";
import PencilIcon from "./PencilIcon";
import Modal from "./Modal";

const Profile = ({ selectedImage, setSelectedImage }) => {
  const [modalOpen, setModalOpen] = useState(false);

  const updateAvatar = (imgSrc) => {
    setSelectedImage(imgSrc);
    setModalOpen(false);
  };

  const openModal = () => setModalOpen(true);

  return (
    <div>
      <div className="create-company-logo-wrapper relative w-32 h-32">
        {selectedImage ? (
          <div
            className="create-company-logo-image-content"
            onClick={openModal}create-company-logo-modal-backdrop
          >
            <img
              src={selectedImage}
              alt="Avatar"
              className="w-full h-full object-cover rounded-full"
            />
            <div className="create-company-overlay">
              <Icon icon="mdi:image-edit" color="white" width="32" height="32" />
            </div>
          </div>
        ) : (
          <label>
            <button
              className="file-upload-label"
              type="button"
              onClick={openModal}
            >
              Adicione Sua Logo
              <PencilIcon />
            </button>
          </label>
        )}
      </div>

      {modalOpen && (
        <Modal
          updateAvatar={updateAvatar}
          closeModal={() => setModalOpen(false)}
        />
      )}
    </div>
  );
};

export default Profile;
