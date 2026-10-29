import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* =========================================================
   TUTORIAL COM DESTAQUE DE CAMPO

   Escurece a tela e recorta um "buraco" em volta do campo
   (box-shadow enorme no realce), com um balão explicando o
   que preencher. Próximo / Voltar / Pular tutorial; Esc pula.

   items: [{ target: "id-do-elemento", title, text }]
   Campo que não está na tela é pulado sozinho.
========================================================= */

const PAD = 8;

const CoachMarks = ({ items, onFinish, onSkip = onFinish }) => {

    const [index, setIndex] = useState(0);
    const [rect, setRect] = useState(null);
    const tipRef = useRef(null);

    const visible = items.filter((item) => document.getElementById(item.target));
    const current = visible[index];

    const measure = useCallback(() => {
        const element = current && document.getElementById(current.target);
        if (!element) {
            setRect(null);
            return;
        }
        const box = element.getBoundingClientRect();
        setRect({ top: box.top - PAD, left: box.left - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 });
    }, [current]);

    useLayoutEffect(() => {
        const element = current && document.getElementById(current.target);
        if (!element) return undefined;

        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        element.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });

        const timer = setTimeout(measure, reduce ? 0 : 320);
        measure();

        window.addEventListener("resize", measure);
        window.addEventListener("scroll", measure, true);

        return () => {
            clearTimeout(timer);
            window.removeEventListener("resize", measure);
            window.removeEventListener("scroll", measure, true);
        };
    }, [current, measure]);

    useEffect(() => {
        tipRef.current?.focus();
    }, [index]);

    useEffect(() => {
        const onKey = (event) => {
            if (event.key === "Escape") onSkip();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onSkip]);

    if (!current) return null;

    const isLast = index === visible.length - 1;

    /* Balão abaixo do campo; se não couber, acima. */
    const below = !rect || rect.top + rect.height + 190 < window.innerHeight;
    const tipStyle = rect
        ? {
            top: below ? rect.top + rect.height + 12 : Math.max(12, rect.top - 12),
            left: Math.min(Math.max(16, rect.left), window.innerWidth - 336),
            transform: below ? "none" : "translateY(-100%)"
        }
        : { top: "40%", left: 16 };

    return createPortal(
        <div className="ncw-coach" role="dialog" aria-modal="true" aria-label="Tutorial do cadastro">

            {rect
                ? <div className="ncw-coach__spot" style={rect} aria-hidden="true" />
                : <div className="ncw-coach__dim" aria-hidden="true" />}

            <div className="ncw-coach__tip" style={tipStyle} ref={tipRef} tabIndex={-1}>

                <span className="ncw-coach__count">{index + 1} de {visible.length}</span>

                <strong>{current.title}</strong>

                <p>{current.text}</p>

                <div className="ncw-coach__actions">

                    <button type="button" className="ncw-coach__skip" onClick={onSkip}>
                        Pular tutorial
                    </button>

                    <div>
                        {index > 0 && (
                            <button type="button" className="ncw-btn ncw-btn--ghost" onClick={() => setIndex(index - 1)}>
                                Voltar
                            </button>
                        )}
                        <button
                            type="button"
                            className="ncw-btn ncw-btn--primary"
                            onClick={() => (isLast ? onFinish() : setIndex(index + 1))}
                        >
                            {isLast ? "Entendi" : "Próximo"}
                        </button>
                    </div>

                </div>

            </div>

        </div>,
        document.body
    );
};

export default CoachMarks;
