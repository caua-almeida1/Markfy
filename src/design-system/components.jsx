import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState
} from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Icon } from "@iconify/react";

import Toast from "../components/toast/Toast";

import "./tokens.css";
import "./primitives.css";

/* =========================================================
   COMPONENTES BASE DA REDE MARKFY

   Pequenos, sem estado global, e só com o que as telas
   novas realmente usam. O visual vem de primitives.css.
========================================================= */

export const cx = (...parts) => parts.filter(Boolean).join(" ");

export const Spinner = ({ className }) => (
    <span className={cx("mk-spinner", className)} aria-hidden="true" />
);

export const Button = React.forwardRef(({
    variant = "secondary",
    size,
    block,
    icon,
    iconRight,
    loading,
    className,
    children,
    as: Tag = "button",
    type,
    ...rest
}, refProp) => (
    <Tag
        ref={refProp}
        type={Tag === "button" ? (type || "button") : type}
        className={cx(
            "mk-btn",
            `mk-btn--${variant}`,
            size && `mk-btn--${size}`,
            block && "mk-btn--block",
            !children && icon && "mk-btn--icon",
            loading && "is-loading",
            className
        )}
        aria-busy={loading || undefined}
        {...rest}
    >
        {icon && <Icon icon={icon} aria-hidden="true" />}
        {children && <span>{children}</span>}
        {iconRight && <Icon icon={iconRight} aria-hidden="true" />}
        {loading && (
            <span className="mk-btn__spinner">
                <Spinner />
            </span>
        )}
    </Tag>
));

Button.displayName = "Button";

/* Campo com rótulo, dica, erro e contador. */
export const Field = ({
    label,
    hint,
    error,
    count,
    max,
    children,
    className
}) => {
    const id = useId();

    const child = React.Children.only(children);

    return (
        <div className={cx("mk-field", className)}>
            {label && (
                <label className="mk-field__label" htmlFor={id}>
                    <span>{label}</span>
                    {max ? (
                        <span className="mk-field__count">
                            {count || 0}/{max}
                        </span>
                    ) : null}
                </label>
            )}

            {React.cloneElement(child, {
                id,
                "aria-invalid": error ? "true" : undefined,
                "aria-describedby": hint || error ? `${id}-hint` : undefined
            })}

            {error ? (
                <p className="mk-field__error" id={`${id}-hint`}>{error}</p>
            ) : hint ? (
                <p className="mk-field__hint" id={`${id}-hint`}>{hint}</p>
            ) : null}
        </div>
    );
};

export const Switch = ({ checked, onChange, label, disabled }) => (
    <button
        type="button"
        role="switch"
        className="mk-switch"
        aria-checked={!!checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
    />
);

/*
 * Controle segmentado com o "polegar" deslizando entre as
 * opções (layoutId do framer). A animação mostra para onde
 * a escolha foi.
 */
export const Segmented = ({ options, value, onChange, label, size }) => {
    const layoutId = useId();

    return (
        <div
            className="mk-segmented"
            role="group"
            aria-label={label}
        >
            {options.map((option) => {
                const selected = option.value === value;

                return (
                    <button
                        key={option.value}
                        type="button"
                        className="mk-segmented__item"
                        aria-pressed={selected}
                        title={option.title || option.label}
                        aria-label={option.label || option.title}
                        onClick={() => onChange(option.value)}
                        style={size === "sm" ? { minHeight: 30 } : undefined}
                    >
                        {selected && (
                            <motion.span
                                layoutId={`seg-${layoutId}`}
                                className="mk-segmented__thumb"
                                transition={{ type: "spring", stiffness: 520, damping: 38 }}
                            />
                        )}
                        {option.icon && <Icon icon={option.icon} aria-hidden="true" />}
                        {!option.iconOnly && option.label}
                    </button>
                );
            })}
        </div>
    );
};

export const Badge = ({ tone, plain, children, className }) => (
    <span
        className={cx(
            "mk-badge",
            tone && `mk-badge--${tone}`,
            plain && "mk-badge--plain",
            className
        )}
    >
        {children}
    </span>
);

export const Skeleton = ({ width = "100%", height = 16, radius, className, style }) => (
    <span
        className={cx("mk-skeleton", className)}
        style={{ display: "block", width, height, borderRadius: radius, ...style }}
        aria-hidden="true"
    />
);

export const EmptyState = ({ icon = "solar:box-minimalistic-linear", title, children, action }) => (
    <div className="mk-empty">
        <span className="mk-empty__icon" aria-hidden="true">
            <Icon icon={icon} />
        </span>
        {title && <h3>{title}</h3>}
        {children && <p>{children}</p>}
        {action}
    </div>
);

/* =========================================================
   SHEET

   Painel lateral no desktop, folha inferior no celular.
   Fecha com Esc e clique fora, devolve o foco para quem
   abriu e trava o scroll do fundo enquanto está aberto.
========================================================= */

export const Sheet = ({
    open,
    onClose,
    title,
    description,
    side = "right",
    footer,
    children,
    labelledBy
}) => {
    const reduce = useReducedMotion();

    const panelRef = useRef(null);

    const isMobile = useMediaQuery("(max-width: 720px)");

    useEffect(() => {
        if (!open) return undefined;

        const previous = document.activeElement;

        const onKey = (event) => {
            if (event.key === "Escape") onClose?.();
        };

        window.addEventListener("keydown", onKey);

        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";

        requestAnimationFrame(() => {
            panelRef.current?.focus();
        });

        return () => {
            window.removeEventListener("keydown", onKey);
            document.body.style.overflow = overflow;
            if (previous && previous.focus) previous.focus();
        };
    }, [open, onClose]);

    const variants = isMobile
        ? { hidden: { y: "100%" }, shown: { y: 0 } }
        : side === "center"
            ? { hidden: { opacity: 0, scale: 0.96, x: "-50%", y: "-46%" }, shown: { opacity: 1, scale: 1, x: "-50%", y: "-50%" } }
            : { hidden: { x: 40, opacity: 0 }, shown: { x: 0, opacity: 1 } };

    return createPortal(
        <AnimatePresence>
            {open && (
                <div className="mk-root" key="sheet">
                    <motion.div
                        className="mk-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: reduce ? 0 : 0.2 }}
                        onClick={onClose}
                    />
                    <motion.div
                        ref={panelRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label={labelledBy ? undefined : title}
                        tabIndex={-1}
                        className={cx("mk-sheet", `mk-sheet--${side}`)}
                        initial="hidden"
                        animate="shown"
                        exit="hidden"
                        variants={variants}
                        transition={
                            reduce
                                ? { duration: 0 }
                                : { type: "spring", stiffness: 420, damping: 40 }
                        }
                        style={{ outline: "none" }}
                    >
                        <span className="mk-sheet__grabber" aria-hidden="true" />
                        {(title || description) && (
                            <div className="mk-sheet__header">
                                <div>
                                    {title && <h2>{title}</h2>}
                                    {description && <p>{description}</p>}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    icon="solar:close-circle-linear"
                                    aria-label="Fechar"
                                    onClick={onClose}
                                />
                            </div>
                        )}
                        <div className="mk-sheet__body">{children}</div>
                        {footer && <div className="mk-sheet__footer">{footer}</div>}
                    </motion.div>
                </div>
            )}
        </AnimatePresence>,
        document.body
    );
};

/* Confirmação para ações destrutivas. */
export const ConfirmDialog = ({
    open,
    title,
    message,
    confirmLabel = "Confirmar",
    tone = "danger",
    loading,
    onConfirm,
    onClose
}) => (
    <Sheet
        open={open}
        onClose={onClose}
        side="center"
        title={title}
        description={message}
        footer={(
            <>
                <Button variant="ghost" onClick={onClose}>Cancelar</Button>
                <Button
                    variant={tone === "danger" ? "danger" : "primary"}
                    loading={loading}
                    onClick={onConfirm}
                >
                    {confirmLabel}
                </Button>
            </>
        )}
    />
);

/* =========================================================
   TOASTS

   Reaproveita o <Toast> que o resto do app já usa; só
   tira de cada tela o trabalho de guardar o estado dele.
========================================================= */

const ToastContext = createContext({ notify: () => {} });

export const ToastProvider = ({ children }) => {
    const [toast, setToast] = useState({ show: false });

    const notify = useCallback((type, title, message) => {
        setToast({ show: false });
        requestAnimationFrame(() =>
            setToast({ show: true, type, title, message })
        );
    }, []);

    const value = useMemo(() => ({ notify }), [notify]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <Toast
                show={toast.show}
                type={toast.type}
                title={toast.title}
                message={toast.message}
                onClose={() => setToast((current) => ({ ...current, show: false }))}
            />
        </ToastContext.Provider>
    );
};

export const useToast = () => useContext(ToastContext).notify;

/* =========================================================
   HOOKS
========================================================= */

export const useMediaQuery = (query) => {
    const get = () =>
        typeof window !== "undefined" && window.matchMedia
            ? window.matchMedia(query).matches
            : false;

    const [matches, setMatches] = useState(get);

    useEffect(() => {
        if (!window.matchMedia) return undefined;

        const media = window.matchMedia(query);
        const onChange = () => setMatches(media.matches);

        onChange();
        media.addEventListener?.("change", onChange);

        return () => media.removeEventListener?.("change", onChange);
    }, [query]);

    return matches;
};

/* Classe no <body> enquanto a tela está montada. */
export const useBodyClass = (className) => {
    useEffect(() => {
        const list = className.split(" ").filter(Boolean);
        document.body.classList.add(...list);
        return () => document.body.classList.remove(...list);
    }, [className]);
};

/* Copia para a área de transferência com fallback. */
export const copyText = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        try {
            const area = document.createElement("textarea");
            area.value = text;
            area.style.position = "fixed";
            area.style.opacity = "0";
            document.body.appendChild(area);
            area.select();
            const ok = document.execCommand("copy");
            area.remove();
            return ok;
        } catch {
            return false;
        }
    }
};
