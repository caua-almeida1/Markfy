import React, { useEffect, useRef, useState } from "react";

import SiteRenderer from "./SiteRenderer";

/* Miniatura viva da página: renderiza em 1280px (layout
   de desktop) e reduz por escala para caber no espaço. */
const SitePreviewThumb = ({ page, bundle, width = 1280 }) => {
    const boxRef = useRef(null);
    const [scale, setScale] = useState(0.3);

    useEffect(() => {
        const node = boxRef.current;
        if (!node) return undefined;

        const update = () => setScale(node.clientWidth / width);
        update();

        const observer = new ResizeObserver(update);
        observer.observe(node);
        return () => observer.disconnect();
    }, [width]);

    return (
        <div className="std-thumb" ref={boxRef} inert="">
            <div className="std-thumb__page" style={{ width, transform: `scale(${scale})` }}>
                <SiteRenderer page={page} bundle={bundle} mode="preview" lite />
            </div>
        </div>
    );
};

export default SitePreviewThumb;
