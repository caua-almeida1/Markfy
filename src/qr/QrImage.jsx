import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

/* QR Code desenhado no próprio navegador (nada é enviado a
   serviços externos). Fundo branco fixo: leitores de câmera
   precisam do contraste, mesmo no tema escuro. */

export default function QrImage({ value, size = 220 }) {

    const [src, setSrc] = useState("");

    useEffect(() => {

        let cancelled = false;

        if (!value) {
            setSrc("");
            return undefined;
        }

        QRCode.toDataURL(value, {
            width: size * 2,
            margin: 1,
            errorCorrectionLevel: "M",
            color: { dark: "#0b0d1a", light: "#ffffff" }
        }).then((url) => {
            if (!cancelled) setSrc(url);
        }).catch(() => {
            if (!cancelled) setSrc("");
        });

        return () => { cancelled = true; };
    }, [value, size]);

    return (
        <span className="qr-frame" style={{ width: size, height: size }}>
            {src && <img src={src} alt="QR Code" width={size} height={size} />}
        </span>
    );
}
