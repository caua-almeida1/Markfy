import { useRef, useState, useEffect } from "react";
import ReactCrop, {
  centerCrop,
  convertToPixelCrop,
  makeAspectCrop,
} from "react-image-crop";
import setCanvasPreview from "../setCanvasPreview";
import { Icon } from "@iconify/react";

import heic2any from "heic2any";

const ASPECT_RATIO = 1;
const MIN_DIMENSION = 150;
const PROCESSING_DELAY = 700; // <--- ajuste esse valor (ms) para o "delay" desejado

const ImageCropper = ({ imageSrc, closeModal, updateAvatar }) => {
  const imgRef = useRef(null);
  const previewCanvasRef = useRef(null);
  const [imgSrc, setImgSrc] = useState("");
  const [crop, setCrop] = useState();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (imageSrc) setImgSrc(imageSrc);
  }, [imageSrc]);

  const onSelectFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      let imageFile = file;

      // Se for HEIC, converte para JPEG
      if (
        file.type === "image/heic" ||
        file.type === "image/heif" ||
        file.name.toLowerCase().endsWith(".heic")
      ) {
        const convertedBlob = await heic2any({
          blob: file,
          toType: "image/jpeg",
          quality: 0.9,
        });
        imageFile = new File(
          [convertedBlob],
          file.name.replace(/\.heic$/i, ".jpg"),
          { type: "image/jpeg" }
        );
      }

      const reader = new FileReader();
      reader.onload = () => {
        const imageUrl = reader.result?.toString() || "";
        setImgSrc(imageUrl);
      };
      reader.readAsDataURL(imageFile);
    } catch (err) {
      console.error("Erro ao converter HEIC:", err);
      setError("Não foi possível carregar a imagem. Tente outro formato.");
    }
  };

  const onImageLoad = (e) => {
    const image = e.currentTarget;
    const { naturalWidth: width, naturalHeight: height } = image;

    let cropSize;
    if (width > height) {
      cropSize = height * 0.9;
    } else {
      cropSize = width * 0.9;
    }

    const x = (width - cropSize) / 2;
    const y = (height - cropSize) / 2;

    const crop = {
      unit: "px",
      width: cropSize,
      height: cropSize,
      x,
      y,
    };

    const percentCrop = {
      unit: "%",
      width: (crop.width / width) * 100,
      height: (crop.height / height) * 100,
      x: (crop.x / width) * 100,
      y: (crop.y / height) * 100,
    };

    setCrop(percentCrop);
  };

  const handleSave = async () => {
    // validações básicas
    if (!imgRef.current || !crop) {
      setError("Selecione/corte a imagem antes de salvar.");
      return;
    }

    try {
      setError("");
      setLoading(true);

      // 1) garante que o browser terá chance de pintar o estado de loading
      await new Promise((resolve) => requestAnimationFrame(resolve));
      // (ou use: await new Promise(res => setTimeout(res, 0));)

      // 2) processamento do canvas (síncrono)
      setCanvasPreview(
        imgRef.current,
        previewCanvasRef.current,
        convertToPixelCrop(
          crop,
          imgRef.current.width,
          imgRef.current.height
        )
      );

      // 3) adiciona o delay que você pediu (simula processamento mais longo)
      await new Promise((resolve) => setTimeout(resolve, PROCESSING_DELAY));

      // 4) pega dataURL e atualiza avatar
      const dataUrl = previewCanvasRef.current.toDataURL();
      updateAvatar(dataUrl);

      // 5) fecha o modal (não precisamos setLoading(false) pois o componente será desmontado)
      closeModal();
    } catch (err) {
      console.error("Erro ao salvar imagem:", err);
      setError("Erro ao processar a imagem. Tente novamente.");
      setLoading(false); // só desliga se o modal não for fechado
    }
  };

  return (
    <div className="create-company-logo-cropper-container">
      {!imgSrc && (
        <label
          htmlFor="company-logo-upload"
          className="create-company-logo-dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) onSelectFile({ target: { files: [file] } });
          }}
        >
          <div className="create-company-logo-dropzone-inner">
            <div className="create-company-logo-dropzone-icon">
              <Icon icon="icon-park:upload-one" className="icon" />
            </div>
            <p className="create-company-logo-dropzone-text">
              Arraste sua logo ou a <span className="browse-text">adicione</span>
            </p>
            <p className="create-company-logo-dropzone-subtext">
              Arquivo com no máximo 10 MB
            </p>
          </div>
          <input
            id="company-logo-upload"
            type="file"
            accept="image/*"
            onChange={onSelectFile}
            className="create-company-logo-dropzone-input"
          />
        </label>
      )}

      {error && <p className="create-company-logo-cropper-error">{error}</p>}

      {imgSrc && (
        <div className="create-company-logo-cropper-area">
          <ReactCrop
            crop={crop}
            onChange={(_, percentCrop) => setCrop(percentCrop)}
            circularCrop
            keepSelection
            aspect={ASPECT_RATIO}
            minWidth={MIN_DIMENSION}
          >
            <img
              ref={imgRef}
              src={imgSrc}
              alt="Logo Preview"
              className="create-company-logo-cropper-image"
              onLoad={onImageLoad}
            />
          </ReactCrop>

          <button
            type="button"
            className="create-company-logo-cropper-confirm-btn"
            onClick={handleSave}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? (
              <>
                <Icon icon="eos-icons:loading" className="icon animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Icon icon="formkit:check" className="icon" />
                Recortar e salvar
              </>
            )}
          </button>
        </div>
      )}

      <canvas
        ref={previewCanvasRef}
        style={{ display: "none" }}
        width={150}
        height={150}
      />
    </div>
  );
};

export default ImageCropper;
