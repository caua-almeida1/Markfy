import React, { useLayoutEffect, useRef, useState } from "react";

import { cx } from "../../design-system/components";

/* =========================================================
   MOLDURA DE PRÉVIA (celular, tablet, computador)

   A largura simulada é a de verdade (390 / 820 / 1280 px) e
   a moldura é reduzida por escala para caber na tela. O
   transform faz a moldura virar o "bloco de contenção" dos
   elementos fixos do cardápio (sacola, janelas de produto),
   então eles ficam dentro da prévia em vez de cobrir o painel.
========================================================= */

export const DEVICES = {
    mobile: { label: "Celular", icon: "solar:smartphone-linear", width: 390, height: 780 },
    tablet: { label: "Tablet", icon: "solar:tablet-linear", width: 820, height: 1080 },
    desktop: { label: "Computador", icon: "solar:monitor-linear", width: 1280, height: 800 }
};

export default function Frame({ device = "mobile", children, className, fit = "contain" }) {
    const areaRef = useRef(null);
    const [size, setSize] = useState({ w: 0, h: 0 });

    useLayoutEffect(() => {
        const node = areaRef.current;
        if (!node) return undefined;
        const update = () => setSize({ w: node.clientWidth, h: node.clientHeight });
        update();
        const observer = new ResizeObserver(update);
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    const spec = DEVICES[device] || DEVICES.mobile;
    const pad = size.w < 520 ? 8 : 24;
    const availableW = Math.max(200, size.w - pad * 2);
    const availableH = Math.max(300, size.h - pad * 2);

    const scale = fit === "width"
        ? Math.min(1, availableW / spec.width)
        : Math.min(1, availableW / spec.width, availableH / spec.height);

    /* Tablet e computador numa área estreita: a escala é limitada
       pela largura e a moldura viraria uma faixa baixa. A altura
       simulada cresce até ocupar o espaço livre (celular mantém
       a proporção de aparelho). */
    const fill = fit === "width" || device !== "mobile";
    const height = fill ? Math.max(spec.height, Math.floor(availableH / scale)) : spec.height;

    return (
        <div ref={areaRef} className={cx("mne-canvas", className)} style={{ padding: pad }}>
            {size.w > 0 && (
                <div className={cx("mne-frame", `mne-frame--${device}`)} style={{ width: spec.width * scale, height: height * scale }}>
                    <div className="mne-frame__viewport" style={{ width: spec.width, height, transform: `scale(${scale})` }}>
                        <div className="mne-frame__scroll">{children}</div>
                    </div>
                </div>
            )}
        </div>
    );
}
