import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import markfyLogo from "../../img/logo-markfy.svg";

import "./route-transition.css";

/* =========================================================
   TRANSIÇÃO ENTRE PRODUTOS

   Tela cheia entre a escolha e o destino. Não é um "loading"
   decorativo: ela espera uma tarefa de verdade (baixar o
   código do Studio, pré-carregar a lista de empresas) e só
   segura um tempo mínimo curto para a troca não piscar.

   `task` pode falhar: a navegação acontece do mesmo jeito,
   e o destino carrega o que faltar por conta própria.
========================================================= */

const MIN_DURATION = 650;

const RouteTransition = ({
    active,
    title,
    subtitle,
    tone = "bookings",
    task,
    onDone
}) => {
    const reduce = useReducedMotion();

    const [progress, setProgress] = useState(0);

    const doneRef = useRef(onDone);
    doneRef.current = onDone;

    useEffect(() => {
        if (!active) {
            setProgress(0);
            return undefined;
        }

        let cancelled = false;

        const started = performance.now();

        /* Avança devagar até 80% enquanto a tarefa roda; o
           resto só anda quando ela termina de fato. */
        setProgress(0.12);

        const ticker = setInterval(() => {
            setProgress((value) => Math.min(0.8, value + (0.8 - value) * 0.18));
        }, 120);

        Promise.resolve()
            .then(() => (task ? task() : null))
            .catch(() => null)
            .then(() => {
                const elapsed = performance.now() - started;
                const wait = Math.max(0, (reduce ? 0 : MIN_DURATION) - elapsed);

                setTimeout(() => {
                    if (cancelled) return;

                    clearInterval(ticker);
                    setProgress(1);

                    setTimeout(() => {
                        if (!cancelled) doneRef.current?.();
                    }, reduce ? 0 : 260);
                }, wait);
            });

        return () => {
            cancelled = true;
            clearInterval(ticker);
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [active]);

    return createPortal(
        <AnimatePresence>
            {active && (
                <motion.div
                    className={`mk-route-transition mk-route-transition--${tone}`}
                    role="status"
                    aria-live="polite"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: reduce ? 0 : 0.28 }}
                >
                    <motion.div
                        className="mk-route-transition__veil"
                        initial={{ clipPath: "circle(0% at 50% 50%)" }}
                        animate={{ clipPath: "circle(140% at 50% 50%)" }}
                        transition={{ duration: reduce ? 0 : 0.7, ease: [0.65, 0, 0.35, 1] }}
                    />

                    <div className="mk-route-transition__content">
                        <motion.div
                            className="mk-route-transition__mark"
                            initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
                            animate={{ scale: 1, opacity: 1, rotate: 0 }}
                            transition={{ delay: reduce ? 0 : 0.15, type: "spring", stiffness: 300, damping: 18 }}
                        >
                            <img src={markfyLogo} alt="" />
                            <span className="mk-route-transition__orbit" aria-hidden="true" />
                        </motion.div>

                        <motion.div
                            className="mk-route-transition__text"
                            initial={{ y: 12, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: reduce ? 0 : 0.25, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <strong>{title}</strong>
                            {subtitle && <span>{subtitle}</span>}
                        </motion.div>

                        <div
                            className="mk-route-transition__bar"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(progress * 100)}
                        >
                            <span style={{ transform: `scaleX(${progress})` }} />
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
};

export default RouteTransition;
