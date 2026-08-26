import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import "./Toast.css";

const Toast = ({
    show,
    type,
    title,
    message,
    onClose
}) => {

    const [shouldRender, setShouldRender] = useState(show);
    const [isClosing, setIsClosing] = useState(false);

    const icon =
        type === "success"
            ? "mdi:check-circle"
            : type === "error"
                ? "mdi:close-circle"
                : "mdi:information";

    useEffect(() => {

        if (show) {

            setShouldRender(true);
            setIsClosing(false);

            const timer = setTimeout(() => {
                setIsClosing(true);

                setTimeout(() => {
                    onClose();
                }, 300);

            }, 3500);

            return () => clearTimeout(timer);

        } else if (shouldRender) {

            setIsClosing(true);

            const timer = setTimeout(() => {
                setShouldRender(false);
            }, 300);

            return () => clearTimeout(timer);

        }

    }, [show]);

    if (!shouldRender) return null;

    return (

        <div className={`toast toast--${type} ${isClosing ? "toast-out" : ""}`}>

            <div className="toast__icon">
                <Icon icon={icon} />
            </div>

            <div className="toast-success__content">
                <h4>{title}</h4>
                <p>{message}</p>
            </div>

        </div>

    );

};

export default Toast;