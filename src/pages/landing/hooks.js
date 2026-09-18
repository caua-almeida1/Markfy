import { useEffect, useRef, useState } from "react";

/* =========================================================
   Preferência de movimento reduzido do sistema.
   Toda animação não essencial consulta este hook antes de
   rodar — o padrão é respeitar o usuário, não o efeito.
========================================================= */

export function useReducedMotion() {
    const [reduced, setReduced] = useState(() => {
        if (typeof window === "undefined") return false;

        return window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;
    });

    useEffect(() => {
        const query = window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        );

        const onChange = (event) => setReduced(event.matches);

        query.addEventListener("change", onChange);

        return () => query.removeEventListener("change", onChange);
    }, []);

    return reduced;
}

/* =========================================================
   Revela um elemento quando ele entra na viewport.
   Dispara uma vez e desconecta — não há custo de scroll
   contínuo, ao contrário de um listener global.
========================================================= */

export function useInView({ threshold = 0.2, rootMargin = "0px 0px -10% 0px" } = {}) {
    const ref = useRef(null);
    const [inView, setInView] = useState(false);

    useEffect(() => {
        const node = ref.current;

        if (!node) return;

        if (!("IntersectionObserver" in window)) {
            setInView(true);
            return;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setInView(true);
                    observer.disconnect();
                }
            },
            { threshold, rootMargin }
        );

        observer.observe(node);

        return () => observer.disconnect();
    }, [threshold, rootMargin]);

    return [ref, inView];
}

/* =========================================================
   Inclinação 3D seguindo o ponteiro.

   Escreve direto em CSS custom properties dentro de um
   rAF: nunca dispara layout, só compositing. Ignora
   dispositivos de toque (não há hover) e movimento
   reduzido.
========================================================= */

export function usePointerTilt({ max = 10, disabled = false } = {}) {
    const ref = useRef(null);

    useEffect(() => {
        const node = ref.current;

        if (!node || disabled) return;

        const finePointer = window.matchMedia("(pointer: fine)").matches;

        if (!finePointer) return;

        let frame = null;
        let targetX = 0;
        let targetY = 0;

        const render = () => {
            frame = null;

            node.style.setProperty("--tilt-x", `${targetY.toFixed(2)}deg`);
            node.style.setProperty("--tilt-y", `${targetX.toFixed(2)}deg`);
        };

        const schedule = () => {
            if (frame === null) {
                frame = requestAnimationFrame(render);
            }
        };

        const onPointerMove = (event) => {
            const rect = node.getBoundingClientRect();

            const px = (event.clientX - rect.left) / rect.width - 0.5;
            const py = (event.clientY - rect.top) / rect.height - 0.5;

            // Clamp mantém o elemento dentro da própria caixa.
            targetX = Math.max(-1, Math.min(1, px)) * max;
            targetY = Math.max(-1, Math.min(1, py)) * -max;

            schedule();
        };

        const onPointerLeave = () => {
            targetX = 0;
            targetY = 0;
            schedule();
        };

        node.addEventListener("pointermove", onPointerMove);
        node.addEventListener("pointerleave", onPointerLeave);

        return () => {
            node.removeEventListener("pointermove", onPointerMove);
            node.removeEventListener("pointerleave", onPointerLeave);

            if (frame !== null) cancelAnimationFrame(frame);
        };
    }, [max, disabled]);

    return ref;
}

/* =========================================================
   CENA PRESA (pin + scrub)

   Um trilho alto segura uma "stage" sticky de uma tela de
   altura. Enquanto o trilho passa pela viewport, a tela fica
   parada e o progresso 0 → 1 comanda a animação.

   O valor contínuo vai direto para a custom property --p, sem
   passar pelo React: rolar não re-renderiza nada. Só o índice
   do passo — que muda poucas vezes — vira estado.
========================================================= */

export function useScrollScene({ steps = 1, disabled = false } = {}) {
    const trackRef = useRef(null);
    const stageRef = useRef(null);

    const [step, setStep] = useState(0);

    useEffect(() => {
        const track = trackRef.current;
        const stage = stageRef.current;

        if (!track || !stage) return;

        if (disabled) {
            // Sem pin: a cena mostra o último passo, parada.
            stage.style.setProperty("--p", "1");
            setStep(steps - 1);
            return;
        }

        let frame = null;
        let lastStep = -1;

        const read = () => {
            frame = null;

            const rect = track.getBoundingClientRect();
            const travel = rect.height - window.innerHeight;

            const progress =
                travel > 0
                    ? Math.min(Math.max(-rect.top / travel, 0), 1)
                    : 0;

            stage.style.setProperty("--p", progress.toFixed(4));

            // Índice do passo ativo, com o último passo
            // ocupando a faixa final inteira.
            const index = Math.min(
                steps - 1,
                Math.floor(progress * steps)
            );

            if (index !== lastStep) {
                lastStep = index;
                setStep(index);
            }
        };

        const onScroll = () => {
            if (frame === null) frame = requestAnimationFrame(read);
        };

        read();

        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll);

        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", onScroll);

            if (frame !== null) cancelAnimationFrame(frame);
        };
    }, [steps, disabled]);

    return { trackRef, stageRef, step };
}

/* =========================================================
   Progresso de scroll da página (0 → 1), throttled por rAF.
========================================================= */

export function useScrollProgress() {
    const [progress, setProgress] = useState(0);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        let frame = null;

        const read = () => {
            frame = null;

            const top = window.scrollY;

            const height =
                document.documentElement.scrollHeight - window.innerHeight;

            setProgress(height > 0 ? Math.min(top / height, 1) : 0);
            setScrolled(top > 32);
        };

        const onScroll = () => {
            if (frame === null) frame = requestAnimationFrame(read);
        };

        read();

        window.addEventListener("scroll", onScroll, { passive: true });

        return () => {
            window.removeEventListener("scroll", onScroll);
            if (frame !== null) cancelAnimationFrame(frame);
        };
    }, []);

    return { progress, scrolled };
}
