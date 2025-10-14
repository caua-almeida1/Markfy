import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { getDatabase, ref, onValue } from "firebase/database";
import { get } from "firebase/database";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from '@iconify/react';

import "./product-details.css";

import noprofessionalplaceholder from "../../../../img/product-details/not-professional.png";

const ProductDetails = ({ product, companyName, companyHandle, companyLogo, onClose, formatDuration }) => {
    const [productDetailsSelectedProfessionalId, setProductDetailsSelectedProfessionalId] = useState(null);
    const [relatedUsersWithInfo, setRelatedUsersWithInfo] = useState([]);
    const [showProfessionals, setShowProfessionals] = useState(false);

    const [showAllDays, setShowAllDays] = useState(false);
    const [availableTimes, setAvailableTimes] = useState([]);
    const [loadingTimes, setLoadingTimes] = useState(false);

    const [loadingProfessionals, setLoadingProfessionals] = useState(false);
    const [currentMonthIndex, setCurrentMonthIndex] = useState(0);

    const [selectedDay, setSelectedDay] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);

    const [isClosingTimes, setIsClosingTimes] = useState(false);

    useEffect(() => {
        const fetchUsersInfo = async () => {
            if (!product?.relatedUsers) return;

            try {
                const db = getDatabase();
                const usersRef = ref(db, "users");

                // Buscar snapshot de todos os usuários
                const usersSnap = await get(usersRef);
                const usersData = usersSnap.exists() ? usersSnap.val() : {};

                // Montar os dados completos
                const enrichedUsers = product.relatedUsers.map(relUser => {
                    const userInfo = usersData[relUser.id] || {};
                    return {
                        id: relUser.id,
                        role: relUser.role,
                        name: userInfo.name || "Sem nome",
                        avatar: userInfo.avatar || null
                    };
                });

                setRelatedUsersWithInfo(enrichedUsers);
            } catch (err) {
                console.error("Erro ao buscar informações dos usuários relacionados:", err);
            }
        };

        fetchUsersInfo();
    }, [product?.relatedUsers]);

    const groupedByMonth = availableTimes.reduce((acc, day) => {
        const [dd, mm, yyyy] = day.day.split("/");
        const dateObj = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
        const monthLabel = dateObj.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
        if (!acc[monthLabel]) acc[monthLabel] = [];
        acc[monthLabel].push(day);
        return acc;
    }, {});

    const months = Object.keys(groupedByMonth);

    useEffect(() => {
        const fetchAvailableTimes = async () => {
            if (!productDetailsSelectedProfessionalId) {
                setAvailableTimes([]);
                return;
            }

            setLoadingTimes(true);
            try {
                const db = getDatabase();
                const userRef = ref(db, `users/${productDetailsSelectedProfessionalId}`);
                const userSnap = await get(userRef);

                if (!userSnap.exists()) {
                    setAvailableTimes([]);
                    return;
                }

                const userData = userSnap.val();
                const scheduledTimes = userData.scheduledTimes || [];

                // 🔹 Montar calendário de 30 dias
                const today = new Date();
                const dates = [];

                for (let i = 0; i < 14; i++) {
                    const d = new Date(today);
                    d.setDate(today.getDate() + i);

                    const dd = String(d.getDate()).padStart(2, "0");
                    const mm = String(d.getMonth() + 1).padStart(2, "0");
                    const yyyy = d.getFullYear();
                    const dayStr = `${dd}/${mm}/${yyyy}`;

                    const label = d.toLocaleDateString("pt-BR", {
                        weekday: "long",
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                    });
                    // Capitalizar a primeira letra do dia da semana
                    const formattedDay = label.charAt(0).toUpperCase() + label.slice(1);
                    // Exemplo: horários fixos entre 9h e 18h (a cada 30 min)
                    const allSlots = [];
                    for (let h = 9; h <= 18; h++) {
                        allSlots.push(`${String(h).padStart(2, "0")}:00`);
                        allSlots.push(`${String(h).padStart(2, "0")}:30`);
                    }

                    // Filtrar os que já estão em scheduledTimes
                    const busy = scheduledTimes
                        .filter((t) => t.day === dayStr)
                        .map((t) => t.hour);

                    let freeSlots = allSlots.filter((s) => !busy.includes(s));

                    // 🔹 Se for o dia de hoje, remove horários que já passaram
                    const now = new Date();
                    const todayStr = now.toLocaleDateString("pt-BR");

                    if (dayStr === todayStr) {
                        freeSlots = freeSlots.filter((slot) => {
                            const [hour, minute] = slot.split(":").map(Number);
                            const slotTime = new Date();
                            slotTime.setHours(hour, minute, 0, 0);
                            return slotTime > now; // só deixa horários futuros
                        });
                    }

                    if (freeSlots.length > 0) {
                        dates.push({
                            day: dayStr,
                            label: formattedDay,
                            slots: freeSlots,
                        });
                    }
                }

                setAvailableTimes(dates);
            } catch (err) {
                console.error("Erro ao buscar horários disponíveis:", err);
            } finally {
                setLoadingTimes(false);
            }
        };

        fetchAvailableTimes();
    }, [productDetailsSelectedProfessionalId]);

    const productDetailsCapFirst = (s = "") =>
        s.length ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : "";

    const [imgLoaded, setImgLoaded] = useState(false);

    const [visible, setVisible] = useState(true);
    const [expanded, setExpanded] = useState(false);
    const maxLength = 100;
    const [selectedImage, setSelectedImage] = useState(0);

    const images = Array.isArray(product?.images)
        ? product.images.filter(Boolean)
        : product?.images
            ? [product.images]
            : [];

    const toggleExpanded = () => setExpanded(!expanded);

    const displayText = expanded
        ? product.description
        : product.description.length > maxLength
            ? product.description.slice(0, maxLength) + "..."
            : product.description;

    useEffect(() => {
        if (images.length > 0) {
            const img = new Image();
            img.src = images[0];
            img.onload = () => setImgLoaded(true);
        }
    }, [images]);

    useEffect(() => {
        if (!product) return;
        setVisible(true);
        setImgLoaded(false);
        setSelectedImage(0);
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = prev; };
    }, [product]);

    if (!product) return null;


    return createPortal(
        <AnimatePresence
            mode="wait"               // ✅ permite esperar o exit antes de desmontar
            onExitComplete={() => onClose?.()} // chama onClose só depois do exit
        >
            {visible && (
                <motion.div
                    className="product-details-overlay"
                    initial={{ opacity: 0 }}        // ✅ entrada volta a funcionar
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    <motion.div
                        key={product.id}              // ✅ força re-mount e animação a cada abertura
                        className="product-details-container"
                        initial={{ scale: 0.30, opacity: 0, borderRadius: "5rem" }}
                        animate={{ scale: 1, opacity: 1, }}
                        exit={{ scale: 0.30, opacity: 0, borderRadius: "5rem" }}
                        transition={{ duration: 0.25, ease: "easeOut" }}
                        role="dialog"
                        aria-modal="true"
                    >
                        <div className={`product-details-media ${showProfessionals ? "hidden" : ""}`}>

                            {!imgLoaded && <div className="product-details-skeleton" />}
                            <img
                                src={images[selectedImage] || ""}
                                alt={product.name}
                                className="product-details-image"
                                style={{ display: imgLoaded ? "block" : "none" }}
                                onLoad={() => setImgLoaded(true)}
                            />

                            {images.length > 0 && (
                                <div className="product-details-carousel" role="listbox" aria-label="Imagens do produto">
                                    <div
                                        className="carousel-blur-fallback"
                                        aria-hidden
                                        style={{ backgroundImage: `url(${images[selectedImage]})` }}
                                    />
                                    {images.map((img, index) => (
                                        <button
                                            type="button"
                                            key={index}
                                            className={`carousel-thumb ${index === selectedImage ? "active" : ""}`}
                                            onClick={() => {
                                                if (index !== selectedImage) {   // evita skeleton infinito
                                                    setImgLoaded(false);
                                                    setSelectedImage(index);
                                                }
                                            }}
                                            aria-pressed={index === selectedImage}
                                            aria-label={`Imagem ${index + 1}`}
                                        >
                                            <img src={img} alt="" />
                                        </button>
                                    ))}
                                </div>
                            )}

                            <div className="product-details-header">
                                <button className="product-details-back" onClick={() => setVisible(false)}>
                                    <Icon icon="humbleicons:arrow-left" className="icon" />
                                </button>

                                <button className="product-details-cart" onClick={() => alert("Adicionado ao carrinho!")}>
                                    <Icon icon="lucide:shopping-cart" className="icon" />
                                </button>
                            </div>
                        </div>

                        <div className={`product-details-body ${showProfessionals ? "fullscreen" : ""}`}>
                            <div className="product-details-content-scroll">

                                <div className="product-details-info">
                                    <AnimatePresence mode="wait">
                                        {loadingProfessionals ? (
                                            <motion.div
                                                key="loading"
                                                className="loading-container-product-details"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.3 }}
                                            >
                                                <div className="spinner-product-details" />
                                                <p>Carregando ...</p>
                                            </motion.div>
                                        ) : !showProfessionals ? (
                                            <motion.div
                                                key="info"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.3 }}
                                            >
                                                {/* --- BLOCO COMPLETO ORIGINAL --- */}
                                                {product.categories && product.categories.length > 0 && (
                                                    <div className="product-details-categories">
                                                        {(() => {
                                                            const limit = 3;
                                                            const cats = product.categories.slice(0, limit);
                                                            const extra = product.categories.length > limit;

                                                            return (
                                                                <span className="categories-text">
                                                                    {cats.join(" • ")}
                                                                    {extra && "..."}
                                                                </span>
                                                            );
                                                        })()}
                                                    </div>
                                                )}

                                                <h2 className="product-details-title">{product.name}</h2>
                                                <div className="product-details-company-info">
                                                    <div className="company-info-left">
                                                        {companyLogo && (
                                                            <div className="product-details-company-logo">
                                                                <img src={companyLogo} alt="Logo da Empresa" className="company-logo" />
                                                            </div>
                                                        )}
                                                        <span>
                                                            <h1>{companyName}</h1>
                                                            <p>@{companyHandle}</p>
                                                        </span>
                                                    </div>

                                                    <div className="product-details-company-actions">
                                                        <button className="product-details-email-button">
                                                            <Icon icon="mdi:email" width="24" height="24" />
                                                        </button>
                                                        <button className="product-details-whatsap-button">
                                                            <Icon icon="mage:whatsapp-filled" width="24" height="24" />
                                                        </button>
                                                    </div>
                                                </div>

                                                <h1>Descrição</h1>
                                                {product.description && (
                                                    <p className="product-details-description">
                                                        {displayText}{" "}
                                                        {product.description.length > maxLength && (
                                                            <span className="read-more-inline" onClick={toggleExpanded}>
                                                                {expanded ? " Ler menos" : " Ler mais"}
                                                            </span>
                                                        )}
                                                    </p>
                                                )}
                                            </motion.div>
                                        ) : (

                                            <motion.div
                                                key="profissionais"
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.3 }}
                                            >
                                                {/* --- BLOCO PROFISSIONAIS --- */}
                                                <div className="product-details-professional">
                                                    <div className="product-details-professional-header">
                                                        <h1>Escolha um profissional</h1>
                                                    </div>

                                                    {Array.isArray(relatedUsersWithInfo) && relatedUsersWithInfo.length > 0 ? (
                                                        <div className="product-details-professionals-list">
                                                            {relatedUsersWithInfo.map((user, index) => {
                                                                const id = user.id ?? index;
                                                                const isSelected = productDetailsSelectedProfessionalId === id;
                                                                const initial = (user.name && user.name.trim()[0]?.toUpperCase()) || "?";

                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        key={id}
                                                                        className={`professional-circle-card ${isSelected ? "selected" : ""}`}
                                                                        onClick={() => {
                                                                            setProductDetailsSelectedProfessionalId((prev) => {
                                                                                const newId = prev === id ? null : id;

                                                                                if (newId === null) {
                                                                                    setIsClosingTimes(true);

                                                                                    setTimeout(() => {
                                                                                        setSelectedDay(null);
                                                                                        setSelectedSlot(null);
                                                                                        setAvailableTimes([]);
                                                                                        setIsClosingTimes(false);
                                                                                    }, 300);
                                                                                }

                                                                                return newId;
                                                                            });
                                                                        }}

                                                                        aria-pressed={isSelected}
                                                                        role="option"
                                                                        aria-selected={isSelected}
                                                                        title={user.name}
                                                                    >
                                                                        <div className="professional-circle-wrap">
                                                                            {user.avatar ? (
                                                                                <img
                                                                                    src={user.avatar}
                                                                                    alt={user.name}
                                                                                    className="professional-circle-img"
                                                                                />
                                                                            ) : (
                                                                                <div className="professional-circle-fallback">{initial}</div>
                                                                            )}

                                                                            <span
                                                                                className={`professional-circle-check ${isSelected ? "selected" : ""}`}
                                                                            >
                                                                                <Icon icon="material-symbols:check-circle" />
                                                                            </span>
                                                                        </div>

                                                                        <span className="professional-circle-name">{user.name}</span>
                                                                    </button>
                                                                );
                                                            })}

                                                            {!productDetailsSelectedProfessionalId && (
                                                                <div className="no-professional-placeholder">
                                                                    <img
                                                                        src={noprofessionalplaceholder}
                                                                        alt="Selecione um profissional"
                                                                        className="no-professional-image"
                                                                    />
                                                                    <h3>Nenhum profissional selecionado</h3>
                                                                    <p>Escolha um profissional acima para visualizar os dias e horários disponíveis.</p>
                                                                </div>
                                                            )}

                                                            {productDetailsSelectedProfessionalId && !selectedDay && (
                                                                <div className="product-details-available-days">
                                                                    <h2 className="choose-day-title">Escolha um dia</h2>

                                                                    {months.length > 0 && (
                                                                        <div className="month-selector">
                                                                            <div className="month-header">
                                                                                <button
                                                                                    disabled={currentMonthIndex === 0}
                                                                                    onClick={() => setCurrentMonthIndex((i) => i - 1)}
                                                                                    className={`month-arrow ${currentMonthIndex === 0 ? "disabled" : ""}`}
                                                                                >
                                                                                    <Icon icon="humbleicons:arrow-left" />
                                                                                </button>

                                                                                <h3 className="month-title">{months[currentMonthIndex]}</h3>

                                                                                <button
                                                                                    disabled={currentMonthIndex === months.length - 1}
                                                                                    onClick={() => setCurrentMonthIndex((i) => i + 1)}
                                                                                    className={`month-arrow ${currentMonthIndex === months.length - 1 ? "disabled" : ""}`}
                                                                                >
                                                                                    <Icon icon="humbleicons:arrow-right" />
                                                                                </button>
                                                                            </div>

                                                                            <div
                                                                                className="days-scroll"
                                                                                onWheel={(e) => {
                                                                                    const el = e.currentTarget;
                                                                                    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                                                                                        el.scrollLeft += e.deltaY;
                                                                                        e.preventDefault();
                                                                                    }
                                                                                }}
                                                                                onMouseDown={(e) => {
                                                                                    const el = e.currentTarget;
                                                                                    el.isDragging = true;
                                                                                    el.startX = e.pageX + el.scrollLeft;
                                                                                }}
                                                                                onMouseMove={(e) => {
                                                                                    const el = e.currentTarget;
                                                                                    if (!el.isDragging) return;
                                                                                    el.scrollLeft = el.startX - e.pageX;
                                                                                }}
                                                                                onMouseUp={(e) => {
                                                                                    e.currentTarget.isDragging = false;
                                                                                }}
                                                                                onMouseLeave={(e) => {
                                                                                    e.currentTarget.isDragging = false;
                                                                                }}
                                                                            >
                                                                                {groupedByMonth[months[currentMonthIndex]].map((day) => {
                                                                                    const dateObj = new Date(day.day.split("/").reverse().join("-"));
                                                                                    const dayName = dateObj
                                                                                        .toLocaleDateString("pt-BR", { weekday: "short" })
                                                                                        .replace(".", "");
                                                                                    const dayNumber = dateObj.toLocaleDateString("pt-BR", { day: "2-digit" });

                                                                                    return (
                                                                                        <button
                                                                                            key={day.day}
                                                                                            className="day-button"
                                                                                            onClick={() => {
                                                                                                setSelectedDay({
                                                                                                    ...day,
                                                                                                    label: new Date(day.day.split("/").reverse().join("-")).toLocaleDateString("pt-BR", {
                                                                                                        weekday: "long",
                                                                                                        day: "2-digit",
                                                                                                        month: "2-digit",
                                                                                                        year: "numeric",
                                                                                                    }),
                                                                                                });
                                                                                            }}

                                                                                        >
                                                                                            <span className="day-name">{dayName}</span>
                                                                                            <span className="day-number">{dayNumber}</span>
                                                                                        </button>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}

                                                            <div
                                                                className={`product-details-available-times-wrapper ${selectedDay && !isClosingTimes ? "open" : isClosingTimes ? "closing" : ""
                                                                    }`}
                                                            >
                                                                {selectedDay && (
                                                                    <div className="product-details-available-times">
                                                                        <h2>Horários disponíveis em {selectedDay.label}</h2>
                                                                        <div
                                                                            className="slots-scroll"
                                                                            onWheel={(e) => {
                                                                                const el = e.currentTarget;
                                                                                if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                                                                                    el.scrollLeft += e.deltaY;
                                                                                    e.preventDefault();
                                                                                }
                                                                            }}
                                                                        >
                                                                            {selectedDay.slots.map((slot) => (
                                                                                <button
                                                                                    key={slot}
                                                                                    className={`slot-button ${selectedSlot === slot ? "selected" : ""}`}
                                                                                    onClick={() => setSelectedSlot(slot)}
                                                                                >
                                                                                    {slot}
                                                                                </button>
                                                                            ))}
                                                                        </div>

                                                                        <button className="back-to-days" onClick={() => setSelectedDay(null)}>
                                                                            Voltar para dias
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <p className="product-details-professional-empty">Informação não disponível.</p>
                                                    )}

                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </div>

                            {/* Footer fixo */}
                            <div className="product-details-footer">
                                <div className="product-details-footer-price">
                                    <p>Preço Total</p>
                                    <span>{product.value}</span>
                                </div>
                                <button
                                    className={`product-details-footer-cta ${showProfessionals &&
                                        !(productDetailsSelectedProfessionalId && selectedDay && selectedSlot)
                                        ? "disabled"
                                        : ""
                                        }`}
                                    disabled={
                                        showProfessionals &&
                                        !(productDetailsSelectedProfessionalId && selectedDay && selectedSlot)
                                    }
                                    onClick={() => {
                                        // 1. Primeira etapa → abre seleção de profissional
                                        if (!showProfessionals && !loadingProfessionals) {
                                            setLoadingProfessionals(true);
                                            setTimeout(() => {
                                                setLoadingProfessionals(false);
                                                setShowProfessionals(true);
                                            }, 1000);
                                            return;
                                        }

                                        // 2. Já na tela de profissionais, mas faltam seleções
                                        if (
                                            showProfessionals &&
                                            (!productDetailsSelectedProfessionalId || !selectedDay || !selectedSlot)
                                        ) {
                                            document
                                                .querySelector(".product-details-professionals-list")
                                                ?.scrollIntoView({ behavior: "smooth" });
                                            return;
                                        }

                                        // 3. Tudo pronto → confirmar agendamento
                                        if (
                                            showProfessionals &&
                                            productDetailsSelectedProfessionalId &&
                                            selectedDay &&
                                            selectedSlot
                                        ) {
                                            alert(
                                                `✅ Agendado com sucesso em ${selectedDay.label} às ${selectedSlot}`
                                            );
                                            onClose?.();
                                        }
                                    }}
                                >
                                    <Icon icon="ic:round-schedule-send" className="icon" />
                                    {showProfessionals ? "Prosseguir" : "Agendar Agora"}
                                </button>
                            </div>
                        </div>

                    </motion.div >
                </motion.div >
            )
            }
        </AnimatePresence >,
        document.body
    );
};

export default ProductDetails;
