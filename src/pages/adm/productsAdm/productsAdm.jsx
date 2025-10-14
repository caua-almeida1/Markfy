import React, { useState, useEffect, useRef } from "react";
import { getDatabase, ref, push, set, child, onValue, off, get, update } from "firebase/database";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAuth } from "firebase/auth";

import { Icon } from "@iconify/react";
import imageCompression from "browser-image-compression";

import Thumb1 from "../../../img/adm-content/image-not-found.svg";
import ThumbProduct from "../../../img/adm-content/file (63).png"

import ProductManagementSlider from "./components/ProductManagementModal"

import "./productsAdm.css";

const Products = ({ shouldOpenModal, setOpenProductsModal }) => {
    const [duration, setDuration] = useState(0);
    const [activeTab, setActiveTab] = useState("ativos");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(true);

    const [products, setProducts] = useState([]);
    const [isAddingProduct, setIsAddingProduct] = useState(false);

    const filteredProducts = products.filter((product) => product.status === activeTab);

    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isManagementModalOpen, setIsManagementModalOpen] = useState(false);

    useEffect(() => {
        if (shouldOpenModal) {
            const timer = setTimeout(() => {
                setIsModalOpen(true);
                setOpenProductsModal(false); // Reseta o estado após abrir
            }, 500); // 0.5s delay

            return () => clearTimeout(timer);
        }
    }, [shouldOpenModal, setOpenProductsModal]);

    const closeModal = () => {
        setIsClosing(true);
        setTimeout(() => {
            setIsClosing(false);
            setIsModalOpen(false);
        }, 400);
    };

    const [stepDirection, setStepDirection] = useState("next");

    const [isAnimating, setIsAnimating] = useState(false);

    // =============== FUNCIONALIDADE VIZUALIZAÇÃO DAS IMAGENS ==========
    const [isProductsGalleryOpen, setIsProductsGalleryOpen] = useState(false);
    const [currentGalleryImageIndex, setCurrentGalleryImageIndex] = useState(0);
    const [galleryImages, setGalleryImages] = useState([]);

    const openProductsGallery = (images, index = 0) => {
        setGalleryImages(images);
        setCurrentGalleryImageIndex(index);
        setIsProductsGalleryOpen(true);
    };

    const closeProductsGallery = () => {
        setIsProductsGalleryOpen(false);
    };

    const goToGalleryPrevImage = () => {
        setCurrentGalleryImageIndex(prev =>
            prev === 0 ? galleryImages.length - 1 : prev - 1
        );
    };

    const goToGalleryNextImage = () => {
        setCurrentGalleryImageIndex(prev =>
            prev === galleryImages.length - 1 ? 0 : prev + 1
        );
    };

    const nextStep = () => {
        if (step === 2) {
            // console.log("Tipo de Produto é:", productType);
        }

        if (step === 3) {
            // console.log("Imagens fornecidas:", productImages.filter(img => img !== null));
        }

        if (step === 4) {
            const name = document.getElementById('input1').value;
            const description = document.getElementById('input2').value;
            const duration = parseInt(document.getElementById('duration').value);

            setProductInfo({
                ...productInfo,
                name: productName,
                description: productDescription,
                price: productPrice,
                currency,
                duration
            });

            // console.log("Informações do produto:", {
            //     nomeDoProduto: name,
            //     descricaoDoProduto: description,
            //     precoDoProduto: {
            //         valor: productPrice,
            //         moeda: currency
            //     },
            //     duracaoDoProduto: `${Math.floor(duration / 60)}h ${duration % 60}m`
            // });
        }

        if (step === 5) {
            // Obtém os labels das categorias selecionadas
            const selectedCategories = selectedItems.map(id => {
                const category = [...defaultCategorys, ...customCategorys].find(c => c.id === id);
                return category ? category.label : null;
            }).filter(label => label !== null);

            // Atualiza o estado com as categorias
            setProductInfo(prev => ({
                ...prev,
                categories: selectedCategories
            }));

            // Exibe no console
            // console.log("Categorias selecionadas:", selectedCategories);
        }

        if (step === 6) {
            const fromValue = priceFrom.trim();
            const toValue = priceTo.trim();

            // Se ambos estiverem vazios, retorna null
            if (!fromValue && !toValue) {
                // console.log("Descontos/Promoções: null (nenhum valor fornecido)");
                setProductInfo(prev => ({
                    ...prev,
                    discount: null
                }));
            }
            // Se apenas um dos campos estiver preenchido, retorna null (inválido)
            else if (!fromValue || !toValue) {
                // console.log("Descontos/Promoções: null (campos incompletos)");
                setProductInfo(prev => ({
                    ...prev,
                    discount: null
                }));
            }
            // Se ambos estiverem preenchidos, calcula o desconto
            else {
                const discountPercentage = calculateDiscountPercentage(); // Nova função que retorna apenas a porcentagem
                // console.log(`Desconto de: ${fromValue}`)
                // console.log(`Desconto por: ${toValue}`)
                // console.log(`Desconto aplicado: ${discountPercentage}%`);

                setProductInfo(prev => ({
                    ...prev,
                    discount: discountPercentage // Armazena apenas a porcentagem
                }));
            }
        }

        if (step === 7) {
            // Obter informações detalhadas dos administradores selecionados
            const relatedUsers = members
                .filter(member => selectedAdmins.includes(member.id))
                .map(member => ({
                    id: member.id,
                    name: member.name,
                    role: capitalizeFirst(member.role)
                }));

            // Atualizar o estado com os usuários relacionados
            setProductInfo(prev => ({
                ...prev,
                relatedUsers: relatedUsers
            }));

            // Exibir no console
            // console.log("Usuários relacionados:", relatedUsers);
        }

        if (step < 8) {  // Aumente o limite para 8 se tiver mais steps
            setIsAnimating(true);
            setStepDirection("next");
            setTimeout(() => {
                setStep(prev => prev + 1);
                setIsAnimating(false);
            }, 400);
        }
    };

    const prevStep = () => {
        if (step > 1) {
            setIsAnimating(true);
            setStepDirection("prev");
            setTimeout(() => {
                setStep((prev) => prev - 1);
                setIsAnimating(false);
            }, 400);
        }
    };

    const [selectedButton, setSelectedButton] = useState(null);

    const handleButtonSelect = (buttonId) => {
        setSelectedButton((prevSelectedButton) =>
            prevSelectedButton === buttonId ? null : buttonId
        );
        // Atualiza o tipo de produto
        setProductType(buttonId === 1 ? 'individual' : 'package');
    };

    const [time, setTime] = useState({ hours: 0, minutes: 0 });
    const [isTimePickerOpen, setIsTimePickerOpen] = useState(false);

    const handleTimeChange = (type, value) => {
        setTime((prev) => ({
            ...prev,
            [type]: value,
        }));
    };

    useEffect(() => {
        if (isModalOpen) {
            document.body.classList.add("no-scroll");
        } else {
            document.body.classList.remove("no-scroll");
        }

        // Limpeza ao desmontar o componente
        return () => {
            document.body.classList.remove("no-scroll");
        };
    }, [isModalOpen]);

    // ======= FUNCIONALIDADE ADICIONAR CONTAINER PARA IMAGEM

    const [carouselItems, setCarouselItems] = useState([{ id: 1, image: null }]);
    const [isAddingItem, setIsAddingItem] = useState(false);
    const [newItemIndex, setNewItemIndex] = useState(null);
    const [removingItemIndex, setRemovingItemIndex] = useState(null);

    const handleAddItem = () => {
        const availableSlots = 5 - carouselItems.filter(item => item.image !== null).length;
        if (availableSlots <= 0) {
            alert("Você atingiu o limite máximo de 5 fotos.");
            return;
        }

        const newItems = [];
        for (let i = 0; i < availableSlots; i++) {
            const newId = carouselItems.length > 0 ? Math.max(...carouselItems.map(item => item.id)) + i + 1 : 1;
            newItems.push({ id: newId, image: null });
        }

        setCarouselItems(prev => [...prev, ...newItems]);
        setIsAddingItem(true);
        setNewItemIndex(carouselItems.length);
    };

    const handleRemoveItem = (index) => {
        setCarouselItems(prev => {
            const newItems = [...prev];
            newItems[index] = { ...newItems[index], image: null };

            // Remove itens vazios extras (mantendo sempre pelo menos 1 item vazio)
            const itemsWithImages = newItems.filter(item => item.image !== null);
            const emptyItems = newItems.filter(item => item.image === null);

            return [...itemsWithImages, ...emptyItems.slice(0, 1)];
        });

        setProductInfo(prev => ({
            ...prev,
            images: prev.images.filter((_, i) => i !== index)
        }));
    };

    useEffect(() => {
        if (isAddingItem && newItemIndex !== null) {
            // Desativa o estado de adição após a animação
            setTimeout(() => {
                setIsAddingItem(false);
                setNewItemIndex(null); // Reseta o índice do novo item
            }, 300); // Tempo da animação
        }
    }, [isAddingItem, newItemIndex]);

    useEffect(() => {
        const imagesExist = carouselItems.some(item => item.image !== null);
        setHasImages(imagesExist);

        // Atualiza productImages com as imagens atuais
        setProductImages(carouselItems.map(item => item.image || null));
    }, [carouselItems]);

    useEffect(() => {
        const images = carouselItems.map(item => item.image).filter(Boolean);
        setProductImages(images);
        setHasImages(images.length > 0);

        // Mantém o productInfo atualizado
        setProductInfo(prev => ({
            ...prev,
            images: images
        }));
    }, [carouselItems]);

    const handleImageUpload = (event, index) => {
        const files = Array.from(event.target.files);
        if (!files || files.length === 0) return;

        const existingImages = carouselItems.filter(item => item.image !== null).length;
        const availableSlots = 5 - existingImages;
        const filesToAdd = Math.min(files.length, availableSlots);

        if (filesToAdd <= 0) {
            alert("Você já atingiu o limite máximo de 5 fotos.");
            return;
        }

        setCarouselItems(prevItems => {
            const newItems = [...prevItems];
            let currentIndex = index;
            let addedCount = 0;

            // Processa cada arquivo
            files.slice(0, filesToAdd).forEach((file, i) => {
                const reader = new FileReader();

                reader.onload = (e) => {
                    const imageUrl = e.target.result;

                    // Encontra o próximo slot vazio (começando pelo índice clicado)
                    while (currentIndex < newItems.length && newItems[currentIndex].image !== null) {
                        currentIndex++;
                    }

                    // Se não encontrou slot vazio, adiciona novo item
                    if (currentIndex >= newItems.length || newItems[currentIndex].image !== null) {
                        const newId = Math.max(...newItems.map(item => item.id), 0) + 1;
                        newItems.push({ id: newId, image: imageUrl });
                    } else {
                        newItems[currentIndex] = { ...newItems[currentIndex], image: imageUrl };
                    }

                    addedCount++;

                    // Quando todas as imagens forem processadas, atualiza o estado
                    if (addedCount === filesToAdd) {
                        setCarouselItems([...newItems]);
                        setProductInfo(prev => ({
                            ...prev,
                            images: newItems.map(item => item.image).filter(img => img !== null)
                        }));
                    }
                };

                reader.readAsDataURL(file);
            });

            return newItems;
        });
    };

    useEffect(() => {
        if (!isProductsGalleryOpen) return;

        const handleTouchStart = (e) => {
            const touchStartX = e.changedTouches[0].screenX;
            const handleTouchEnd = (e) => {
                const touchEndX = e.changedTouches[0].screenX;
                if (touchStartX - touchEndX > 50) {
                    goToGalleryNextImage();
                } else if (touchEndX - touchStartX > 50) {
                    goToGalleryPrevImage();
                }
                document.removeEventListener('touchend', handleTouchEnd);
            };
            document.addEventListener('touchend', handleTouchEnd, { once: true });
        };

        document.addEventListener('touchstart', handleTouchStart);
        return () => {
            document.removeEventListener('touchstart', handleTouchStart);
        };
    }, [isProductsGalleryOpen, currentGalleryImageIndex]);

    // ============== QUARTO PASSO RANGE DURAÇÃO

    useEffect(() => {
        const rangeInput = document.getElementById('duration');
        if (rangeInput) {
            const handleDurationChange = () => {
                const duration = parseInt(rangeInput.value);
                setProductInfo(prev => ({ ...prev, duration }));
            };

            rangeInput.addEventListener('input', handleDurationChange);
            return () => rangeInput.removeEventListener('input', handleDurationChange);
        }
    }, [step]);

    useEffect(() => {
        const rangeInput = document.getElementById('duration');
        const rangeValue = document.getElementById('duration-value');
        const rangeTooltip = document.getElementById('range-tooltip');

        const formatTime = (minutes) => {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            if (hours === 0) {
                return `${mins}m`;
            } else {
                return `${hours}h ${mins}m`;
            }
        };

        const updateRangeStyle = () => {
            if (!rangeInput || !rangeValue || !rangeTooltip) return;

            // Usar o valor do estado duration em vez do valor do input
            const value = duration;
            const max = parseInt(rangeInput.max, 10);
            const percent = (value / max) * 100;

            // Atualiza o input range com o valor do estado
            rangeInput.value = value;

            // Atualiza o gradiente e o valor exibido
            rangeInput.style.setProperty('--range-percent', `${percent}%`);
            rangeValue.textContent = formatTime(value);

            // Atualiza o retângulo (tooltip)
            const thumbPosition = (value / max) * rangeInput.offsetWidth;
            rangeTooltip.textContent = formatTime(value);
            rangeTooltip.style.left = `${thumbPosition}px`;
        };

        if (rangeInput && rangeValue && rangeTooltip) {
            // Atualiza o range quando o componente monta ou quando duration muda
            updateRangeStyle();

            // Adiciona event listener para atualizar o estado quando o range é alterado
            const handleInputChange = (e) => {
                const newDuration = parseInt(e.target.value);
                setDuration(newDuration);
                setProductInfo(prev => ({ ...prev, duration: newDuration }));
            };

            rangeInput.addEventListener('input', handleInputChange);

            rangeInput.addEventListener('mousedown', () => {
                const rangeTooltip = document.getElementById('range-tooltip');
                if (rangeTooltip) rangeTooltip.style.opacity = '1';
            });

            rangeInput.addEventListener('mouseup', () => {
                const rangeTooltip = document.getElementById('range-tooltip');
                if (rangeTooltip) rangeTooltip.style.opacity = '0';
            });

            return () => {
                rangeInput.removeEventListener('input', handleInputChange);
            };
        }
    }, [duration, step]); // Adicione duration como dependência

    // =========== FORMATAÇÃO DE PREÇO INPUT 

    const [productPrice, setProductPrice] = useState(""); // Estado global para o preço do produto

    const [price, setPrice] = useState("");
    const [currency, setCurrency] = useState("BRL");

    const [priceFrom, setPriceFrom] = useState("");
    const [priceTo, setPriceTo] = useState(productPrice);

    const [currencyPromo, setCurrencyPromo] = useState("BRL");

    const formatPrice = (value, currency) => {
        const numericValue = parseFloat(value.replace(/\D/g, "")) / 100;
        if (isNaN(numericValue)) return "";

        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: currency,
            minimumFractionDigits: 2,
        }).format(numericValue);
    };

    const handlePriceChange = (e) => {
        const rawValue = e.target.value;
        const formattedValue = formatPrice(rawValue, currency);
        setPrice(formattedValue);
        setProductPrice(formattedValue);
        setProductInfo(prev => ({ ...prev, price: formattedValue }));
    };

    const handleCurrencyChange = (e) => {
        const newCurrency = e.target.value;
        setCurrency(newCurrency);
        setPrice(formatPrice(price, newCurrency));
        setProductPrice(formatPrice(price, newCurrency));
        setProductInfo(prev => ({ ...prev, currency: newCurrency }));
    };

    const handlePriceToChange = (e) => {
        const rawValue = e.target.value;
        const formattedValue = formatPrice(rawValue, currencyPromo);
        setPriceTo(formattedValue);
    };

    // ========== 5 PASSO CATEGORIAS
    const [selectedItems, setSelectedItems] = useState([]);
    const [isOtherSelected, setIsOtherSelected] = useState(false);
    const [isFading, setIsFading] = useState(false);
    const [newCategory, setNewCategory] = useState(""); // Estado para o valor do input

    // Categorias padrão
    const [defaultCategorys] = useState([
        { id: 1, icon: "fluent-emoji-flat:hair-pick", label: "Cabelo" },
        { id: 2, icon: "fluent-emoji-flat:pizza", label: "Comida" },
        { id: 3, icon: "twemoji:lipstick", label: "Beleza" },
        { id: 4, icon: "twemoji:red-heart", label: "Saúde" },
        { id: 5, icon: "noto-v1:railway-car", label: "Automotivo" },
        { id: 6, icon: "twemoji:party-popper", label: "Eventos" },
        { id: 7, icon: "fluent-color:phone-laptop-32", label: "Tecnologia" },
        { id: 8, icon: "fluent-color:headphones-48", label: "Consultoria" },
        { id: 9, icon: "basil:other-1-outline", label: "Outros" },
    ]);

    const [customCategorys, setCustomCategorys] = useState([]);

    const handleItemClick = (id) => {
        if (id === 9) {
            setIsFading(true);
            setTimeout(() => {
                setIsOtherSelected(true);
                setIsFading(false);
            }, 300);
            return;
        }

        setSelectedItems((prevSelected) =>
            prevSelected.includes(id)
                ? prevSelected.filter((itemId) => itemId !== id)
                : [...prevSelected, id]
        );
    };

    const handleCloseOther = () => {
        setIsFading(true);
        setTimeout(() => {
            setIsOtherSelected(false);
            setIsFading(false);
        }, 300);
    };

    const handleAddCategory = () => {
        if (newCategory.trim() === "") return;

        const newId = Math.max(...defaultCategorys.map((item) => item.id), ...customCategorys.map((item) => item.id)) + 1;

        const newCategoryItem = { id: newId, icon: "basil:other-1-outline", label: newCategory };

        setCustomCategorys((prevCustomCategorys) => [...prevCustomCategorys, newCategoryItem]);
        setSelectedItems((prevSelected) => [...prevSelected, newId]);
        setNewCategory("");

        // Atualiza o productInfo
        setProductInfo(prev => ({
            ...prev,
            categories: [...prev.categories, newCategory]
        }));
    };

    const handleRemoveCategory = (id) => {
        const removedCategory = [...defaultCategorys, ...customCategorys].find(c => c.id === id);

        setSelectedItems((prevSelected) => prevSelected.filter((itemId) => itemId !== id));

        if (removedCategory) {
            setProductInfo(prev => ({
                ...prev,
                categories: prev.categories.filter(cat => cat !== removedCategory.label)
            }));
        }
    };

    // ====== CALCULO DE DESCONTO
    const [isInputFilled, setIsInputFilled] = useState(false);


    const calculateDiscountPercentage = () => {
        const fromStr = priceFrom.replace(/[^\d,.-]/g, '');
        const toStr = priceTo.replace(/[^\d,.-]/g, '');

        const from = parseFloat(
            fromStr
                .replace(/\./g, '')
                .replace(',', '.')
        );

        const to = parseFloat(
            toStr
                .replace(/\./g, '')
                .replace(',', '.')
        );

        if (!isNaN(from) && !isNaN(to) && from > 0 && to > 0 && from > to) {
            return Math.round(((from - to) / from) * 100);
        }
        return null;
    };

    const calculateDiscount = () => {
        // Remove todos os caracteres não numéricos exceto pontos e vírgulas
        const fromStr = priceFrom.replace(/[^\d,.-]/g, '');
        const toStr = priceTo.replace(/[^\d,.-]/g, '');

        // Converte para número, tratando tanto . quanto , como separador decimal
        const from = parseFloat(
            fromStr
                .replace(/\./g, '')  // Remove pontos (separadores de milhar)
                .replace(',', '.')   // Substitui vírgula por ponto (separador decimal)
        );

        const to = parseFloat(
            toStr
                .replace(/\./g, '')  // Remove pontos (separadores de milhar)
                .replace(',', '.')   // Substitui vírgula por ponto (separador decimal)
        );

        if (!isNaN(from) && !isNaN(to) && from > 0 && to > 0 && from > to) {
            const discount = ((from - to) / from) * 100;
            return `Desconto de ${priceFrom} por ${priceTo} - ${Math.round(discount)}% de Desconto`;
        }
        return "";
    };

    const handlePriceFromChange = (e) => {
        const formattedValue = formatCurrency(e.target.value, currencyPromo);
        setPriceFrom(formattedValue);
    };

    const handleCurrencyPromoChange = (e) => {
        setCurrencyPromo(e.target.value);
    };

    const formatCurrency = (value, currency) => {
        if (!value) return '';

        const numericValue = value.replace(/\D/g, '');

        const numberValue = parseFloat(numericValue) / 100;

        if (isNaN(numberValue)) return '';

        if (currency === 'BRL') {
            return `R$ ${numberValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else if (currency === 'USD') {
            return `$ ${numberValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else if (currency === 'EUR') {
            return `€ ${numberValue.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else if (currency === 'GBP') {
            return `£ ${numberValue.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        } else if (currency === 'JPY') {
            return `¥ ${numberValue.toLocaleString('ja-JP', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
        }
        return numberValue.toFixed(2);
    };

    useEffect(() => {
        if (priceFrom || priceTo) {
            setIsInputFilled(true); // Se pelo menos um input estiver preenchido, muda para "Continuar"
        } else {
            setIsInputFilled(false); // Caso contrário, mantém como "Pular"
        }
    }, [priceFrom, priceTo]);


    useEffect(() => {
        if (step === 6) {
            // console.log("Valor do produto recuperado no step 6:", productPrice);
            setPriceTo(productPrice); // Preenche o campo "Por" com o valor do produto
        }
    }, [step, productPrice]);


    // ========== PASSO 7 CONFIGURAÇÕES ==========
    // CONFIG ANTECENDENCIA AGENDAMENTO
    const [isBookingAdvanceModalOpen, setIsBookingAdvanceModalOpen] = useState(false);
    const [bookingAdvanceDays, setBookingAdvanceDays] = useState("");
    const [bookingAdvanceHours, setBookingAdvanceHours] = useState("");
    const [bookingAdvanceMinutes, setBookingAdvanceMinutes] = useState("");

    const openBookingAdvanceModal = () => {
        setIsBookingAdvanceModalOpen(true);
    };

    const [isBookingAdvanceModalClosing, setIsBookingAdvanceModalClosing] = useState(false);
    const closeBookingAdvanceModal = () => {
        setIsBookingAdvanceModalClosing(true);
        setTimeout(() => {
            setIsBookingAdvanceModalOpen(false);
            setIsBookingAdvanceModalClosing(false);
        }, 300);
    };

    // CONFIG ANTECEDÊNCIA CANCELAMENTO
    const [isCancellationAdvanceModalOpen, setIsCancellationAdvanceModalOpen] = useState(false);
    const [cancellationAdvanceDays, setCancellationAdvanceDays] = useState("");
    const [cancellationAdvanceHours, setCancellationAdvanceHours] = useState("");
    const [cancellationAdvanceMinutes, setCancellationAdvanceMinutes] = useState("");

    // Função para normalizar os valores (converter excesso de minutos/horas)
    const normalizeTimeInput = (days, hours, minutes) => {
        let totalMinutes = (parseInt(days) || 0) * 1440 + (parseInt(hours) || 0) * 60 + (parseInt(minutes) || 0);

        // Recalcula dias, horas e minutos
        const newDays = Math.floor(totalMinutes / 1440);
        const remainingHours = Math.floor((totalMinutes % 1440) / 60);
        const remainingMinutes = totalMinutes % 60;

        return {
            days: newDays,
            hours: remainingHours,
            minutes: remainingMinutes
        };
    };

    const handleDaysChange = (e) => {
        const value = e.target.value;
        setBookingAdvanceDays(value);
    };

    const handleHoursChange = (e) => {
        let value = e.target.value;
        if (value > 23) {
            const normalized = normalizeTimeInput(0, value, 0);
            setBookingAdvanceDays(prev => (parseInt(prev) || 0) + normalized.days);
            setBookingAdvanceHours(normalized.hours);
        } else {
            setBookingAdvanceHours(value);
        }
    };

    const handleMinutesChange = (e) => {
        let value = e.target.value;
        if (value > 59) {
            const normalized = normalizeTimeInput(0, 0, value);
            setBookingAdvanceHours(prev => {
                const newHours = (parseInt(prev) || 0) + normalized.hours;
                if (newHours > 23) {
                    const hoursNormalized = normalizeTimeInput(0, newHours, 0);
                    setBookingAdvanceDays(prevDays => (parseInt(prevDays) || 0) + hoursNormalized.days);
                    return hoursNormalized.hours;
                }
                return newHours;
            });
            setBookingAdvanceMinutes(normalized.minutes);
        } else {
            setBookingAdvanceMinutes(value);
        }
    };

    const [isCancellationAdvanceModalClosing, setIsCancellationAdvanceModalClosing] = useState(false);

    const openCancellationAdvanceModal = () => {
        setIsCancellationAdvanceModalOpen(true);
    };

    const closeCancellationAdvanceModal = () => {
        setIsCancellationAdvanceModalClosing(true);
        setTimeout(() => {
            setIsCancellationAdvanceModalOpen(false);
            setIsCancellationAdvanceModalClosing(false);
        }, 300); // 300ms é a duração da animação de fadeOut
    };

    const handleCancellationDaysChange = (e) => {
        const value = e.target.value;
        setCancellationAdvanceDays(value);
    };

    const handleCancellationHoursChange = (e) => {
        let value = e.target.value;
        if (value > 23) {
            const normalized = normalizeTimeInput(0, value, 0);
            setCancellationAdvanceDays(prev => (parseInt(prev) || 0) + normalized.days);
            setCancellationAdvanceHours(normalized.hours);
        } else {
            setCancellationAdvanceHours(value);
        }
    };

    const handleCancellationMinutesChange = (e) => {
        let value = e.target.value;
        if (value > 59) {
            const normalized = normalizeTimeInput(0, 0, value);
            setCancellationAdvanceHours(prev => {
                const newHours = (parseInt(prev) || 0) + normalized.hours;
                if (newHours > 23) {
                    const hoursNormalized = normalizeTimeInput(0, newHours, 0);
                    setCancellationAdvanceDays(prevDays => (parseInt(prevDays) || 0) + hoursNormalized.days);
                    return hoursNormalized.hours;
                }
                return newHours;
            });
            setCancellationAdvanceMinutes(normalized.minutes);
        } else {
            setCancellationAdvanceMinutes(value);
        }
    };

    const [dynamicPriceValues, setDynamicPriceValues] = useState([]);

    // Estados para o modal de preço dinâmico
    const [isDynamicPriceModalOpen, setIsDynamicPriceModalOpen] = useState(false);
    const [isDynamicPriceModalClosing, setIsDynamicPriceModalClosing] = useState(false);
    const [selectedDay, setSelectedDay] = useState(null);
    const [timeSlots, setTimeSlots] = useState(Array(7).fill().map(() => []));

    // Funções de manipulação
    const handleTimeSlotChange = (dayIndex, slotIndex, field, value) => {
        setTimeSlots(prev => {
            const newSlots = [...prev];
            newSlots[dayIndex] = newSlots[dayIndex].map((slot, i) =>
                i === slotIndex ? { ...slot, [field]: value } : slot
            );
            return newSlots;
        });
    };

    const handleAddTimeSlot = (dayIndex) => {
        setTimeSlots(prev => {
            const newSlots = [...prev];
            newSlots[dayIndex] = [...newSlots[dayIndex], {
                startTime: '08:00',
                endTime: '17:00',
                price: ''
            }];
            return newSlots;
        });
    };

    const handleRemoveTimeSlot = (dayIndex, slotIndex) => {
        setTimeSlots(prev => {
            const newSlots = [...prev];
            newSlots[dayIndex] = newSlots[dayIndex].filter((_, i) => i !== slotIndex);
            return newSlots;
        });
    };

    const handleSaveDynamicPrices = () => {
        // Filtra os dias que têm horários válidos
        const dynamicPricing = timeSlots.map((slots, dayIndex) => {
            const dayName = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'][dayIndex];

            // Filtra apenas os slots que têm ambos os horários e preço preenchidos
            const validSlots = slots.filter(slot =>
                slot.startTime && slot.endTime && slot.price && !isNaN(parseFloat(slot.price))
            ).map(slot => ({
                startTime: slot.startTime,
                endTime: slot.endTime,
                price: parseFloat(slot.price)
            }));

            return {
                day: dayName,
                dayIndex,
                slots: validSlots
            };
        }).filter(day => day.slots.length > 0);

        setProductInfo(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                dynamicPricing
            }
        }));

        closeDynamicPriceModal();
    };

    const openDynamicPriceModal = () => {
        setIsDynamicPriceModalOpen(true);
        setSelectedDay(prev => prev === null ? 0 : prev);
    };

    const closeDynamicPriceModal = () => {
        setIsDynamicPriceModalClosing(true);
        setTimeout(() => {
            setIsDynamicPriceModalOpen(false);
            setIsDynamicPriceModalClosing(false);
        }, 300);
    };

    const [isExtraFeeModalOpen, setIsExtraFeeModalOpen] = useState(false);
    const [isExtraFeeModalClosing, setIsExtraFeeModalClosing] = useState(false);
    const [activeFeeTab, setActiveFeeTab] = useState('time');
    const [transitioningTab, setTransitioningTab] = useState(false);
    const [selectedFeeDay, setSelectedFeeDay] = useState(0);

    // Taxas por horário
    const [timeFees, setTimeFees] = useState([
        [], // Segunda
        [], // Terça
        [], // Quarta
        [], // Quinta
        [], // Sexta
        [], // Sábado
        []  // Domingo
    ]);

    // Taxas por serviço
    const [serviceFees, setServiceFees] = useState([]);

    // Funções para taxas por horário
    const handleTimeFeeChange = (dayIndex, feeIndex, field, value) => {
        const updatedFees = [...timeFees];
        updatedFees[dayIndex][feeIndex][field] = value;
        setTimeFees(updatedFees);
    };

    const handleAddTimeFee = (dayIndex) => {
        const updatedFees = [...timeFees];
        updatedFees[dayIndex].push({
            startTime: '18:00',
            endTime: '23:00',
            type: 'fixed',
            value: ''
        });
        setTimeFees(updatedFees);
    };

    const handleRemoveTimeFee = (dayIndex, feeIndex) => {
        const updatedFees = [...timeFees];
        updatedFees[dayIndex].splice(feeIndex, 1);
        setTimeFees(updatedFees);
    };

    // Funções para taxas por serviço
    const handleServiceFeeChange = (index, field, value) => {
        const updatedServices = [...serviceFees];
        updatedServices[index][field] = value;
        setServiceFees(updatedServices);
    };

    const handleAddServiceFee = () => {
        setServiceFees([...serviceFees, {
            name: '',
            type: 'fixed',
            value: ''
        }]);
    };

    const handleRemoveServiceFee = (index) => {
        const updatedServices = [...serviceFees];
        updatedServices.splice(index, 1);
        setServiceFees(updatedServices);
    };

    // Funções do modal
    const openExtraFeeModal = () => {
        setIsExtraFeeModalOpen(true);
        setSelectedFeeDay(0);
    };

    const closeExtraFeeModal = () => {
        setIsExtraFeeModalClosing(true);
        setTimeout(() => {
            setIsExtraFeeModalOpen(false);
            setIsExtraFeeModalClosing(false);
        }, 300);
    };

    const handleSaveExtraFees = () => {
        // console.log('Taxas por horário:', timeFees);
        // console.log('Taxas por serviço:', serviceFees);
        closeExtraFeeModal();
    };

    const handleTabChange = (tab) => {
        if (activeFeeTab !== tab && !transitioningTab) {
            setTransitioningTab(true);
            setTimeout(() => {
                setActiveFeeTab(tab);
                setTransitioningTab(false);
            }, 300); // Tempo igual à duração da transição
        }
    };

    const [isActive, setIsActive] = useState(false);

    const handleClick = () => {
        setIsActive(!isActive);
    };

    const [members, setMembers] = useState([]);

    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const auth = getAuth();
                const user = auth.currentUser;
                if (!user) return;

                const db = getDatabase();
                const companysRef = ref(db, "companys");

                const snapshot = await get(companysRef);
                if (!snapshot.exists()) return;

                const companies = snapshot.val();
                let companyKey = null;

                // Descobrir qual empresa o user pertence
                for (const [key, value] of Object.entries(companies)) {
                    if (value.members && value.members[user.uid]) {
                        companyKey = key;
                        break;
                    }
                }

                if (!companyKey) return;

                // Buscar os membros dessa empresa
                const membersRef = ref(db, `companys/${companyKey}/members`);
                const membersSnap = await get(membersRef);

                if (membersSnap.exists()) {
                    const membersData = membersSnap.val();

                    // Buscar info de cada user na tabela users
                    const usersRef = ref(db, "users");
                    const usersSnap = await get(usersRef);
                    const usersData = usersSnap.exists() ? usersSnap.val() : {};

                    const parsedMembers = Object.entries(membersData).map(([uid, info]) => {
                        const userInfo = usersData[uid] || {};
                        return {
                            id: uid,
                            name: userInfo.name || "Sem nome",
                            avatar: userInfo.avatar || null,
                            role: info.role || "Sem função",
                        };
                    });

                    setMembers(parsedMembers);
                }
            } catch (err) {
                console.error("Erro ao buscar membros:", err);
            }
        };

        fetchMembers();
    }, []);

    const [selectedAdmins, setSelectedAdmins] = useState([]);

    const admins = [
        { id: 1, name: "Thales", role: "Cabelereiro" },
        { id: 2, name: "Maria", role: "Manicure" },
        { id: 3, name: "Carlos", role: "Barbeiro" },
        { id: 4, name: "Ana", role: "Esteticista" }
    ];

    const handleAdminClick = (adminId) => {
        setSelectedAdmins(prev => {
            if (prev.includes(adminId)) {
                return prev.filter(id => id !== adminId); // Remove se já estiver selecionado
            } else {
                return [...prev, adminId]; // Adiciona se não estiver selecionado
            }
        });
    };

    // ======= CONFIRMAÇÃO DE CADASTRO DE PRODUTO MODAL =======
    const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
    const [isConfirmationModalClosing, setIsConfirmationModalClosing] = useState(false);
    const [isConfirmationModalOpening, setIsConfirmationModalOpening] = useState(false);

    const openConfirmationModal = () => {
        setIsConfirmationModalOpening(true);
        setIsConfirmationModalOpen(true);
        setTimeout(() => setIsConfirmationModalOpening(false), 300);
    };

    const closeConfirmationModal = () => {
        setIsConfirmationModalClosing(true);
        setTimeout(() => {
            setIsConfirmationModalOpen(false);
            setIsConfirmationModalClosing(false);
        }, 300);
    };

    const handleContinue = () => {
        openConfirmationModal(); // Abre o modal ao invés de prosseguir diretamente
    };

    const handleConfirmation = async () => {
        setIsAddingProduct(true);
        try {
            const discountPercentage = calculateDiscountPercentage();

            // Pega todas as imagens do carrossel
            const productImages = Array.isArray(carouselItems)
                ? carouselItems.map(item => item.image).filter(img => img !== null)
                : [];

            const productImage = productImages.length > 0 ? productImages[0] : Thumb1;

            const auth = getAuth();
            const user = auth.currentUser;
            if (!user) throw new Error("Usuário não autenticado");

            const db = getDatabase();
            const storage = getStorage();
            const companysRef = ref(db, "companys");

            // Buscar todas as empresas
            const snapshot = await get(companysRef);
            if (!snapshot.exists()) throw new Error("Nenhuma empresa encontrada");

            const companies = snapshot.val();
            let companyKey = null;

            // Percorrer empresas para encontrar qual o usuário pertence
            for (const [key, value] of Object.entries(companies)) {
                if (value.members && value.members[user.uid]) {
                    companyKey = key;
                    break;
                }
            }

            if (!companyKey) throw new Error("Usuário não pertence a nenhuma empresa");

            // Criar ID customizado para o produto
            const generateCustomId = (length = 12) => {
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
            };
            const customId = generateCustomId(12);

            // ===============================
            // 📷 Upload das imagens comprimidas
            // ===============================
            const uploadPromises = productImages.map(async (imageFile, index) => {
                // Se for base64, converter para File antes
                let file;
                if (typeof imageFile === "string" && imageFile.startsWith("data:")) {
                    const res = await fetch(imageFile);
                    const blob = await res.blob();
                    file = new File([blob], `image_${index}.jpg`, { type: "image/jpeg" });
                } else {
                    file = imageFile;
                }

                // Comprimir
                const compressedFile = await imageCompression(file, {
                    maxSizeMB: 0.3, // ~300kb
                    maxWidthOrHeight: 1280,
                    useWebWorker: true
                });

                // Caminho no storage
                const imgRef = storageRef(
                    storage,
                    `companys/${companyKey}/products/${customId}/images/${compressedFile.name}`
                );

                // Upload
                await uploadBytes(imgRef, compressedFile);

                // Pegar URL pública
                return await getDownloadURL(imgRef);
            });

            const uploadedImageUrls = await Promise.all(uploadPromises);

            // ===============================
            // 📝 Montar usuários relacionados
            // ===============================
            const relatedUsers = members
                .filter(member => selectedAdmins.includes(member.id))
                .map(member => ({
                    id: member.id,
                    role: capitalizeFirst(member.role)
                }));
            // ===============================
            // 📝 Salvar produto no Realtime
            // ===============================
            const newProduct = {
                name: productInfo.name,
                status: "ativos",
                value: productInfo.price,
                orders: 0,
                description: productInfo.description,
                duration: productInfo.duration,
                categories: productInfo.categories,
                discount: discountPercentage !== null ? `${discountPercentage}%` : null,
                relatedUsers: relatedUsers, // ✅ só selecionados, com role em caps
                image: uploadedImageUrls[0] || Thumb1,
                images: uploadedImageUrls,
                originalPrice: priceFrom,
                discountedPrice: priceTo,
                currency: currency,
                bookingAdvance: productInfo.bookingAdvance,
                cancellationAdvance: productInfo.cancellationAdvance,
                settings: {
                    privacy: isPrivate,
                    notifications: notificationsEnabled,
                    prepayment: prepaymentRequired,
                    rescheduling: reschedulingAllowed,
                    dynamicPricing: productInfo.settings.dynamicPricing,
                    extraFees: productInfo.settings.extraFees
                },
                createdAt: new Date().toISOString()
            };

            const productRef = ref(db, `companys/${companyKey}/products/${customId}`);
            await set(productRef, newProduct);

            console.log("Produto salvo em:", `companys/${companyKey}/products/${customId}`);

            closeConfirmationModal();
            resetAllStates();
            closeModal();
            alert('Produto criado com sucesso!');
        } catch (error) {
            console.error("Erro ao salvar produto:", error);
            alert('Erro ao criar produto. Por favor, tente novamente.');
        } finally {
            setIsAddingProduct(false);
        }
    };

    const resetAllStates = () => {
        setStep(1);
        setProductInfo({
            name: '',
            description: '',
            price: '',
            currency: 'BRL',
            duration: 0,
            categories: [],
            images: [],
            discountInfo: {
                priceFrom: '',
                priceTo: '',
                percentage: null,
                formattedText: ''
            },
            settings: {
                privacy: false,
                notifications: true,
                prepayment: false,
                rescheduling: true,
                dynamicPricing: [],
                extraFees: {
                    timeBased: [],
                    serviceBased: []
                }
            },
            bookingAdvance: {
                days: 0,
                hours: 0,
                minutes: 0
            },
            cancellationAdvance: {
                days: 0,
                hours: 0,
                minutes: 0
            },
            relatedUsers: []
        });
        setProductName('');
        setProductDescription('');
        setDuration(0);
        setPrice('');
        setProductPrice('');
        setPriceFrom('');
        setPriceTo('');
        setCurrency('BRL');
        setCurrencyPromo('BRL');
        setSelectedButton(null);
        setCarouselItems([{ id: 1, image: null }]);
        setProductImages([]);
        setHasImages(false);
        setSelectedItems([]);
        setSelectedAdmins([]);
        setIsOtherSelected(false);
        setNewCategory('');
        setIsPrivate(false);
        setNotificationsEnabled(true);
        setPrepaymentRequired(false);
        setReschedulingAllowed(true);
        setProductType(null);
        setBookingAdvanceDays("");
        setBookingAdvanceHours("");
        setBookingAdvanceMinutes("");
        setCancellationAdvanceDays("");
        setCancellationAdvanceHours("");
        setCancellationAdvanceMinutes("");
        setTimeSlots(Array(7).fill().map(() => []));
        setSelectedDay(null);
    };

    // ============== SAVE DE INFORMAÇÕES ===============
    const [productType, setProductType] = useState(null);

    const [productName, setProductName] = useState('');
    const [productDescription, setProductDescription] = useState('');

    const [productImages, setProductImages] = useState([]);
    const [hasImages, setHasImages] = useState(false);

    const [relatedUsers, setRelatedUsers] = useState([]);

    const [isPrivate, setIsPrivate] = useState(false);
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [prepaymentRequired, setPrepaymentRequired] = useState(false);
    const [reschedulingAllowed, setReschedulingAllowed] = useState(true);

    const saveCancellationAdvanceSettings = () => {
        setProductInfo(prev => ({
            ...prev,
            cancellationAdvance: {
                days: parseInt(cancellationAdvanceDays) || 0,
                hours: parseInt(cancellationAdvanceHours) || 0,
                minutes: parseInt(cancellationAdvanceMinutes) || 0
            }
        }));
        closeCancellationAdvanceModal();
    };

    const [productInfo, setProductInfo] = useState({
        name: '',
        description: '',
        price: '',
        currency: 'BRL',
        duration: 0,
        categories: [],
        images: [],
        discountInfo: {
            priceFrom: '',
            priceTo: '',
            percentage: null,
            formattedText: ''
        },
        settings: {
            privacy: false,
            notifications: true,
            prepayment: false,
            rescheduling: true,
            dynamicPricing: [],
            extraFees: {
                timeBased: [],
                serviceBased: []
            }
        },
        bookingAdvance: {
            days: 0,
            hours: 0,
            minutes: 0
        },
        cancellationAdvance: {
            days: 0,
            hours: 0,
            minutes: 0
        },
        relatedUsers: []
    });

    useEffect(() => {
        setProductInfo(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                privacy: isPrivate
            }
        }));
    }, [isPrivate]);

    useEffect(() => {
        setProductInfo(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                notifications: notificationsEnabled
            }
        }));
    }, [notificationsEnabled]);

    useEffect(() => {
        setProductInfo(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                prepayment: prepaymentRequired
            }
        }));
    }, [prepaymentRequired]);

    useEffect(() => {
        setProductInfo(prev => ({
            ...prev,
            settings: {
                ...prev.settings,
                rescheduling: reschedulingAllowed
            }
        }));
    }, [reschedulingAllowed]);

    const formatDuration = (duration) => {
        if (typeof duration === 'object' && duration.days !== undefined) {
            // Formata a partir do objeto bookingAdvance ou cancellationAdvance
            const { days, hours, minutes } = duration;
            let parts = [];
            if (days > 0) parts.push(`${days}d`);
            if (hours > 0) parts.push(`${hours}h`);
            if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
            return parts.join(" ");
        } else {
            // Formata a partir de minutos totais (mantendo compatibilidade)
            const totalMinutes = duration || 0;
            const days = Math.floor(totalMinutes / 1440);
            const remainingHours = Math.floor((totalMinutes % 1440) / 60);
            const remainingMinutes = totalMinutes % 60;

            let parts = [];
            if (days > 0) parts.push(`${days}d`);
            if (remainingHours > 0) parts.push(`${remainingHours}h`);
            if (remainingMinutes > 0 || parts.length === 0) parts.push(`${remainingMinutes}m`);
            return parts.join(" ");
        }
    };

    const capitalizeFirst = (str) => {
        if (!str) return "";
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    };

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                setLoading(true);

                const auth = getAuth();
                const user = auth.currentUser;
                if (!user) throw new Error("Usuário não autenticado");

                const db = getDatabase();
                const companysRef = ref(db, "companys");

                // Buscar todas as empresas
                const snapshot = await get(companysRef);
                if (!snapshot.exists()) throw new Error("Nenhuma empresa encontrada");

                const companies = snapshot.val();
                let companyKey = null;

                // Descobrir qual empresa o usuário pertence
                for (const [key, value] of Object.entries(companies)) {
                    if (value.members && value.members[user.uid]) {
                        companyKey = key;
                        break;
                    }
                }

                if (!companyKey) throw new Error("Usuário não pertence a nenhuma empresa");

                // Agora vamos ouvir os produtos dessa empresa
                const productsRef = ref(db, `companys/${companyKey}/products`);

                const unsubscribe = onValue(productsRef, (snapshot) => {
                    const data = snapshot.val();
                    if (data) {
                        const productsArray = Object.keys(data).map((key) => ({
                            id: key,
                            ...data[key],
                        }));
                        setProducts(productsArray);
                    } else {
                        setProducts([]);
                    }
                    setLoading(false);
                }, (error) => {
                    console.error("Erro ao buscar produtos:", error);
                    setLoading(false);
                });

                // Limpa o listener ao desmontar
                return () => off(productsRef, 'value', unsubscribe);
            } catch (error) {
                console.error("Erro ao carregar produtos:", error);
                setLoading(false);
            }
        };

        fetchProducts();
    }, []);


    return (
        <div className="adm_products-page">
            <header className="adm_products-header">
                <div className="header-content">
                    <h1>Meus Produtos</h1>
                    <div className="orders-header-tabs">
                        <button
                            className={activeTab === "ativos" ? "active" : ""}
                            onClick={() => setActiveTab("ativos")}
                        >
                            Ativos
                        </button>
                        <button
                            className={activeTab === "arquivados" ? "active" : ""}
                            onClick={() => setActiveTab("arquivados")}
                        >
                            Arquivados
                        </button>
                    </div>
                </div>
            </header>

            <div className="adm_products-new-product-content-actions">
                <button
                    className="adm_products-new-product-btn"
                    onClick={() => setIsModalOpen(true)}
                >
                    Cadastrar Novo Produto
                </button>
            </div>

            <div className="adm_products-list">{loading ? (
                <div className="adm_products-loading">
                    <p>Carregando produtos...</p>
                </div>
            ) : filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                    <div key={product.id} className="adm_products-card">
                        <div className="adm_products-card-top-info">
                            <div
                                className="adm_products-image-wrapper"
                                onClick={() => product.images?.length > 0 && openProductsGallery(product.images)}
                            >
                                <img
                                    src={product.image || Thumb1}
                                    alt={product.name}
                                    onError={(e) => e.target.src = Thumb1}
                                    className="adm_products-main-image"
                                />
                                {product.images?.length > 0 && (
                                    <div className="adm_products-image-hover">
                                        <Icon icon="mdi:image-multiple" className="adm_products-hover-icon" />
                                        <span>Ver {product.images.length} foto{product.images.length > 1 ? 's' : ''}</span>
                                    </div>
                                )}
                            </div>

                            <div className="adm_products-card-content">
                                <h2 className="adm_products-card-name" title={product.name}>
                                    {product.name}
                                </h2>
                                <p className="adm_products-card-description" title={product.description}>
                                    {product.description}
                                </p>
                            </div>
                        </div>

                        <div className="adm_products-card-bottom-info">
                            <div className="adm_products-card-bottom-info-content-item">
                                <p>Id Prod.</p>
                                <h1>#{product.id}</h1>
                            </div>
                            <div className="adm_products-card-bottom-info-content-item">
                                <p>Valor</p>
                                <h1>{product.value}</h1>
                            </div>
                            <div className="adm_products-card-bottom-info-content-item">
                                <p>Total de Pedidos</p>
                                <h1>{product.orders}</h1>
                            </div>
                        </div>

                        <div className="adm_products-card-actions">
                            <button className="adm_products-btn delete-btn">
                                Arquivar
                            </button>
                            <button
                                className="adm_products-btn edit-btn"
                                onClick={() => {
                                    setSelectedProduct(product);
                                    setIsManagementModalOpen(true);
                                }}
                            >
                                Gerenciar Produto
                            </button>
                        </div>
                    </div>
                ))
            ) : (
                <p>Nenhum produto encontrado, <span onClick={() => setIsModalOpen(true)}>crie um novo produto!</span> </p>
            )}
            </div>

            {isManagementModalOpen && selectedProduct && (
                <ProductManagementSlider
                    product={selectedProduct}
                    onClose={() => setIsManagementModalOpen(false)}
                    onSave={(updatedProduct) => {
                        setProducts(prev => prev.map(p =>
                            p.id === updatedProduct.id ? updatedProduct : p
                        ));
                    }}
                />
            )}

            {isProductsGalleryOpen && (
                <div className="adm_products-gallery-overlay" onClick={closeProductsGallery}>
                    <div className="adm_products-gallery-container" onClick={e => e.stopPropagation()}>
                        <button className="adm_products-gallery-close" onClick={closeProductsGallery}>
                            <Icon icon="mdi:close" />
                        </button>

                        <div className="adm_products-gallery-content">
                            <button
                                className="adm_products-gallery-arrow adm_products-gallery-prev"
                                onClick={goToGalleryPrevImage}
                            >
                                <Icon icon="mdi:chevron-left" />
                            </button>

                            <img
                                src={galleryImages[currentGalleryImageIndex]}
                                alt={`Produto ${currentGalleryImageIndex + 1}`}
                                className="adm_products-gallery-image"
                            />

                            <button
                                className="adm_products-gallery-arrow adm_products-gallery-next"
                                onClick={goToGalleryNextImage}
                            >
                                <Icon icon="mdi:chevron-right" />
                            </button>
                        </div>

                        <div className="adm_products-gallery-thumbnails">
                            {galleryImages.map((img, index) => (
                                <img
                                    key={index}
                                    src={img}
                                    alt={`Miniatura ${index + 1}`}
                                    className={`adm_products-gallery-thumb ${index === currentGalleryImageIndex ? 'is-active' : ''}`}
                                    onClick={() => setCurrentGalleryImageIndex(index)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {isModalOpen && (
                <div
                    className={`
            adm_products-modal-backdrop
            ${isClosing ? 'adm_products-modal-backdrop-closing' : ''}
            ${isModalOpen && !isClosing ? 'adm_products-modal-backdrop-active' : ''}
        `}
                    onClick={closeModal}
                >
                    <div
                        className={`adm_products-modal ${isClosing ? "closing" : ""}`}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {step === 1 && (
                            <div
                                className={`adm_products-modal-content first-step ${isAnimating
                                    ? stepDirection === "next"
                                        ? "slide-out-left"
                                        : "slide-out-right"
                                    : ""
                                    } ${!isAnimating
                                        ? stepDirection === "next"
                                            ? "slide-in-right"
                                            : "slide-in-left"
                                        : ""
                                    }`}
                            >
                                <img
                                    src={ThumbProduct}
                                    alt="Produto"
                                    className="adm_products-modal-thumb"
                                />
                                <h1>Cadastre um novo Produto!</h1>
                                <h2>Realize o passo a passo para a criação de um novo produto.</h2>

                                <div className="adm_products-modal-buttons">
                                    <button
                                        className="adm_products-modal-btn secondary-btn"
                                        onClick={closeModal}
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        className="adm_products-modal-btn primary-btn"
                                        onClick={nextStep}
                                    >
                                        Continuar
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 2 && (
                            <div
                                className={`adm_products-modal-content second-step ${isAnimating
                                    ? stepDirection === "next"
                                        ? "slide-out-left"
                                        : "slide-out-right"
                                    : ""
                                    } ${!isAnimating
                                        ? stepDirection === "next"
                                            ? "slide-in-right"
                                            : "slide-in-left"
                                        : ""
                                    }`}
                            >
                                <h2 className="adm_products-modal-content-title">Selecione um Tipo de Produto</h2>
                                <div className="circle-buttons">
                                    <div className="button-container">
                                        <button
                                            className={`circle-btn ${productType === 'individual' ? "selected" : ""}`}
                                            onClick={() => {
                                                handleButtonSelect(1);
                                                setProductType('individual');
                                            }}
                                        >
                                            <Icon icon="mdi:package-variant" className="product-icon" />
                                            {productType === 'individual' && (
                                                <span className="check-icon">
                                                    <Icon icon="fe:check" className="icon" />
                                                </span>
                                            )}
                                        </button>
                                        <h2 className="product-type-title">Produto Individual</h2>
                                    </div>

                                    <div className="button-container">
                                        <button
                                            className={`circle-btn ${productType === 'package' ? "selected" : ""}`}
                                            onClick={() => {
                                                handleButtonSelect(2);
                                                setProductType('package');
                                            }}
                                        >
                                            <Icon icon="mdi:package-variant-closed" className="product-icon" />
                                            {productType === 'package' && (
                                                <span className="check-icon">
                                                    <Icon icon="fe:check" className="icon" />
                                                </span>
                                            )}
                                        </button>
                                        <h2 className="product-type-title">Pacote de Produtos</h2>
                                    </div>
                                </div>

                                <div className="adm_products-modal-buttons">
                                    <button
                                        className="adm_products-modal-btn secondary-btn"
                                        onClick={prevStep}
                                    >
                                        Voltar
                                    </button>
                                    <button
                                        className={`adm_products-modal-btn primary-btn ${productType === null ? "disabled" : ""}`}
                                        onClick={nextStep}
                                        style={{
                                            cursor: productType === null ? "not-allowed" : "pointer",
                                            opacity: productType === null ? 0.5 : 1
                                        }}
                                        disabled={productType === null}
                                    >
                                        Continuar
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div
                                className={`adm_products-modal-content first-step ${isAnimating
                                    ? stepDirection === "next"
                                        ? "slide-out-left"
                                        : "slide-out-right"
                                    : ""
                                    } ${!isAnimating
                                        ? stepDirection === "next"
                                            ? "slide-in-right"
                                            : "slide-in-left"
                                        : ""
                                    }`}
                            >
                                <h2 className="adm_products-modal-content-title">Coleção de Fotos do Produto</h2>
                                <p className="adm_products-modal-content-subtitle">Adicione até 5 fotos ao catálogo de fotos do seu produto</p>

                                <div className="adm_products-modal-carousel-container">
                                    <div className="adm_products-modal-carousel">
                                        {carouselItems.map((item, index) => (
                                            item.image !== null ? (
                                                <div key={item.id} className="adm_products-modal-carousel-item" >
                                                    <input
                                                        id={`file-input-filled-${index}`}
                                                        type="file"
                                                        accept="image/*"
                                                        style={{ display: "none" }}
                                                        onChange={(e) => handleImageUpload(e, index)}
                                                        multiple
                                                    />
                                                    <img
                                                        src={item.image}
                                                        alt={`Imagem ${index}`}
                                                        className="adm_products-modal-carousel-image"
                                                    />
                                                    <div className="overlay-replace-image">Substituir</div>
                                                    <button
                                                        className="remove-item-button"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleRemoveItem(index);
                                                        }}
                                                    >
                                                        <Icon icon="lucide:trash" className="remove-item-icon" />
                                                    </button>
                                                </div>
                                            ) : null
                                        ))}
                                        {carouselItems.filter(item => item.image === null).length > 0 && (
                                            <div className="adm_products-modal-carousel-item" onClick={() => document.getElementById('file-input-empty').click()}>
                                                <input
                                                    id="file-input-empty"
                                                    type="file"
                                                    accept="image/*"
                                                    style={{ display: "none" }}
                                                    onChange={(e) => handleImageUpload(e, carouselItems.length)}
                                                    multiple
                                                />
                                                <div
                                                    className="adm_products-modal-carousel-item-content"

                                                >
                                                    <Icon icon="material-symbols:upload-rounded" className="adm_products-modal-carousel-icon" />
                                                    <span className="adm_products-modal-carousel-text">Adicionar Imagem</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="adm_products-modal-buttons">
                                    <button
                                        className="adm_products-modal-btn secondary-btn"
                                        onClick={prevStep}
                                    >
                                        Voltar
                                    </button>

                                    <button
                                        className="adm_products-modal-btn primary-btn"
                                        onClick={nextStep}
                                    >
                                        Continuar
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 4 && (
                            <div
                                className={`adm_products-modal-content first-step ${isAnimating
                                    ? stepDirection === "next"
                                        ? "slide-out-left"
                                        : "slide-out-right"
                                    : ""
                                    } ${!isAnimating
                                        ? stepDirection === "next"
                                            ? "slide-in-right"
                                            : "slide-in-left"
                                        : ""
                                    }`}
                            >
                                <h2 className="adm_products-modal-content-title">Informações do Produto</h2>

                                {/* Inputs com labels */}
                                <div className="adm_products-modal-input-group">
                                    <label htmlFor="input1">Nome do produto</label>
                                    <input
                                        type="text"
                                        id="input1"
                                        className="adm_products-modal-input"
                                        placeholder="Digite o nome do produto aqui..."
                                        value={productName}
                                        onChange={(e) => setProductName(e.target.value)}
                                    />
                                </div>

                                <div className="adm_products-modal-input-group">
                                    <label htmlFor="input2">Descrição do Produto</label>
                                    <input
                                        type="text"
                                        id="input2"
                                        className="adm_products-modal-input"
                                        placeholder="Digite a descrição do produto aqui..."
                                        value={productDescription}
                                        onChange={(e) => setProductDescription(e.target.value)}
                                    />
                                </div>

                                <div className="adm_products-modal-input-group">
                                    <label htmlFor="input3">Preço do Produto</label>
                                    <div className="adm_products-price-input-container">
                                        <input
                                            type="text"
                                            id="input3"
                                            className="adm_products-modal-input adm_products-price-input"
                                            placeholder="Digite o preço do produto aqui..."
                                            value={price}
                                            onChange={handlePriceChange}
                                        />
                                        <div className="adm_products-currency-wrapper">
                                            <select
                                                className="adm_products-currency-select"
                                                value={currency}
                                                onChange={handleCurrencyChange}
                                            >
                                                <option value="BRL">BRL</option>
                                                <option value="USD">USD</option>
                                                <option value="EUR">EUR</option>
                                                <option value="GBP">GBP</option>
                                                <option value="JPY">JPY</option>
                                            </select>
                                            <Icon icon="iconamoon:arrow-down-2-duotone" width="24" height="24" className="adm_products-currency-icon" />
                                        </div>
                                    </div>
                                </div>

                                <div className="adm_products-modal-input-group">
                                    <label htmlFor="duration">
                                        Duração do Serviço
                                        <span id="duration-value" className="adm_products-modal-range-value">0m</span>
                                    </label>
                                    <div className="adm_products-range-container">
                                        <input
                                            type="range"
                                            id="duration"
                                            className="adm_products-modal-range"
                                            min="0"
                                            max="300"
                                            defaultValue={duration}
                                        />
                                        <div id="range-tooltip" className="adm_products-range-tooltip">0m</div>
                                    </div>
                                </div>

                                <div className="adm_products-modal-buttons">
                                    <button
                                        className="adm_products-modal-btn secondary-btn"
                                        onClick={prevStep}
                                    >
                                        Voltar
                                    </button>

                                    <button
                                        className="adm_products-modal-btn primary-btn"
                                        onClick={nextStep}
                                    >
                                        Continuar
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 5 && (
                            <div
                                className={`adm_products-modal-content first-step ${isAnimating
                                    ? stepDirection === "next"
                                        ? "slide-out-left"
                                        : "slide-out-right"
                                    : ""
                                    } ${!isAnimating
                                        ? stepDirection === "next"
                                            ? "slide-in-right"
                                            : "slide-in-left"
                                        : ""
                                    }`}
                            >
                                <h2 className="adm_products-modal-content-title">Categoria do Produto</h2>
                                <p className="adm_products-modal-content-subtitle">Selecione as categorias do seu produto</p>

                                <div className={`adm_products-order-grid-container ${isOtherSelected ? "other-content-active" : ""} ${isFading ? "other-content-fade-out" : "other-content-fade-in"}`}>
                                    {isOtherSelected ? (
                                        <div className="adm_products-other-content">
                                            <button className="other-content-close-btn" onClick={handleCloseOther}>
                                                <Icon icon="tabler:arrow-left" className="icon" />
                                            </button>
                                            <div className="selected-categories-container">
                                                {selectedItems.map((id) => {
                                                    // Busca a categoria nas categorias padrão e personalizadas
                                                    const selectedCategory = defaultCategorys.find((item) => item.id === id) || customCategorys.find((item) => item.id === id);
                                                    return (
                                                        <div key={id} className="selected-category-item">
                                                            <button className="remove-category-btn" onClick={() => handleRemoveCategory(id)}>
                                                                <Icon icon="tabler:x" className="icon" />
                                                            </button>
                                                            {selectedCategory?.label}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            <div className="adm_products-modal-input-group">
                                                <label htmlFor="input1">Categoria</label>
                                                <div className="input-with-button-container">
                                                    <input
                                                        type="text"
                                                        id="input1"
                                                        className="adm_products-modal-input"
                                                        placeholder="Digite o nome da categoria aqui..."
                                                        value={newCategory}
                                                        onChange={(e) => setNewCategory(e.target.value)}
                                                    />
                                                    <button className="add-category-button" onClick={handleAddCategory}>
                                                        <Icon icon="material-symbols:add" className="icon" />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        // Renderiza apenas as categorias padrão no grid
                                        defaultCategorys.map((item) => (
                                            <div
                                                key={item.id}
                                                className={`adm_products-order-grid-item ${selectedItems.includes(item.id) ? "selected" : ""
                                                    }`}
                                                onClick={() => handleItemClick(item.id)}
                                            >
                                                <Icon icon={item.icon} className="icon" />
                                                <p>{item.label}</p>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="adm_products-modal-buttons">
                                    <button
                                        className="adm_products-modal-btn secondary-btn"
                                        onClick={prevStep}
                                    >
                                        Voltar
                                    </button>

                                    <button
                                        className="adm_products-modal-btn primary-btn"
                                        onClick={nextStep}
                                    >
                                        Continuar
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 6 && (
                            <div
                                className={`adm_products-modal-content first-step ${isAnimating
                                    ? stepDirection === "next"
                                        ? "slide-out-left"
                                        : "slide-out-right"
                                    : ""
                                    } ${!isAnimating
                                        ? stepDirection === "next"
                                            ? "slide-in-right"
                                            : "slide-in-left"
                                        : ""
                                    }`}
                            >
                                <h2 className="adm_products-modal-content-title">Descontos e Promoções</h2>
                                <p className="adm_products-modal-content-subtitle">Adicione descontos em seu produto para atrair mais visibilidade e engajamento.</p>

                                <div className="promotion-question-container">
                                    <div className="adm_products-modal-input-group">
                                        <label htmlFor="inputFrom">De</label>
                                        <div className="adm_products-price-input-container">
                                            <input
                                                type="text"
                                                id="inputFrom"
                                                className="adm_products-modal-input adm_products-price-input"
                                                placeholder="ex: R$150,00"
                                                value={priceFrom}
                                                onChange={handlePriceFromChange}
                                            />
                                            <div className="adm_products-currency-wrapper">
                                                <select
                                                    className="adm_products-currency-select"
                                                    value={currencyPromo}
                                                    onChange={handleCurrencyPromoChange}
                                                >
                                                    <option value="BRL">BRL</option>
                                                    <option value="USD">USD</option>
                                                    <option value="EUR">EUR</option>
                                                    <option value="GBP">GBP</option>
                                                    <option value="JPY">JPY</option>
                                                </select>
                                                <Icon icon="iconamoon:arrow-down-2-duotone" width="24" height="24" className="adm_products-currency-icon" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="adm_products-modal-input-group">
                                        <label htmlFor="inputTo">Por</label>
                                        <div className="adm_products-price-input-container">
                                            <input
                                                type="text"
                                                id="inputTo"
                                                className="adm_products-modal-input adm_products-price-input"
                                                placeholder="ex: R$50,00"
                                                value={priceTo}
                                                onChange={handlePriceToChange}
                                            />
                                            <div className="adm_products-currency-wrapper">
                                                <select
                                                    className="adm_products-currency-select"
                                                    value={currencyPromo}
                                                    onChange={(e) => setCurrencyPromo(e.target.value)}
                                                >
                                                    <option value="BRL">BRL</option>
                                                    <option value="USD">USD</option>
                                                    <option value="EUR">EUR</option>
                                                    <option value="GBP">GBP</option>
                                                    <option value="JPY">JPY</option>
                                                </select>
                                                <Icon icon="iconamoon:arrow-down-2-duotone" width="24" height="24" className="adm_products-currency-icon" />
                                            </div>
                                        </div>
                                    </div>

                                </div>

                                <div className="promotion-discount-message">
                                    {calculateDiscount()}
                                </div>

                                <div className="adm_products-modal-buttons">
                                    <button
                                        className="adm_products-modal-btn secondary-btn"
                                        onClick={prevStep}
                                    >
                                        Voltar
                                    </button>

                                    <button
                                        className="adm_products-modal-btn primary-btn"
                                        onClick={nextStep}
                                    >
                                        {isInputFilled ? "Continuar" : "Pular"} {/* Altera o texto do botão com base no estado */}
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 7 && (
                            <div
                                className={`adm_products-modal-content first-step ${isAnimating
                                    ? stepDirection === "next"
                                        ? "slide-out-left"
                                        : "slide-out-right"
                                    : ""
                                    } ${!isAnimating
                                        ? stepDirection === "next"
                                            ? "slide-in-right"
                                            : "slide-in-left"
                                        : ""
                                    }`}
                            >
                                <h2 className="adm_products-modal-content-title">Configurações</h2>
                                <p className="adm_products-modal-content-subtitle adm_products-modal-content-subtitle-config">Ajuste as configurações do seu produto.</p>

                                <h1 className="adm_admins-title">Relacionar Usuários</h1>
                                <div className="adm_admins-config-content">
                                    <div className="adm_admins-config-content-container">
                                        <div className="adm_admins-config-wrapper">
                                            <div className="add-admin-config-button">
                                                <Icon icon="mdi:plus" className="icon" />
                                            </div>
                                            <h1>Adicionar</h1>
                                            <p>Usuários</p>
                                        </div>
                                        {members.map(member => (
                                            <div
                                                key={member.id}
                                                className={`adm_admins-config-wrapper adm_admins-config-wrapper-circles-select-adm ${selectedAdmins.includes(member.id) ? 'active' : ''
                                                    }`}
                                                onClick={() => handleAdminClick(member.id)}
                                            >
                                                <div className="adm_admins-config-circle-container">
                                                    <div className="adm_admins-config-circle">
                                                        {member.avatar ? (
                                                            <img src={member.avatar} alt={member.name} className="adm_admins-avatar" />
                                                        ) : (
                                                            member.name.charAt(0)
                                                        )}
                                                    </div>
                                                    <div className={`selection-indicator ${selectedAdmins.includes(member.id) ? 'active' : ''}`}>
                                                        <Icon icon="material-symbols:check" className="icon" />
                                                    </div>
                                                </div>
                                                <div className="adm_admins-text-container">
                                                    <h1>{member.name}</h1>
                                                    <p>{capitalizeFirst(member.role)}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <h1 className="adm_admins-title">Configurações</h1>
                                <div className="adm_admins-config-carousel">
                                    <div className="adm_admins-config-carousel-container">
                                        <div className="adm_admins-config-wrapper">
                                            <div className="adm_admins-config-square">
                                                <div className="adm_admins-config-content">
                                                    <h1>Privacidade</h1>
                                                    <p>Deixe este produto privado</p>
                                                    <div class="adm_admin_config-toggle-switch">
                                                        <input
                                                            class="adm_admin_config-toggle-input"
                                                            type="checkbox"
                                                            id="adm_admin_config-private-toggle"
                                                            checked={isPrivate}
                                                            onChange={(e) => setIsPrivate(e.target.checked)}
                                                        />
                                                        <label class="adm_admin_config-toggle-label" for="adm_admin_config-private-toggle"></label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="adm_admins-config-wrapper">
                                            <div className="adm_admins-config-square">
                                                <div className="adm_admins-config-content">
                                                    <h1>Antecedência para Agendamento</h1>
                                                    <p>Mínimo de horas/dias antes do agendamento.</p>
                                                    <button className="adm_admins-config-time-button"
                                                        onClick={openBookingAdvanceModal}
                                                    >
                                                        Definir
                                                    </button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="adm_admins-config-wrapper">
                                            <div className="adm_admins-config-square">
                                                <div className="adm_admins-config-content">
                                                    <h1>Antecedência para Cancelamento</h1>
                                                    <p>Tempo limite para cancelar sem penalidade</p>
                                                    <button className="adm_admins-config-time-button" onClick={openCancellationAdvanceModal}>Definir</button>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="adm_admins-config-wrapper">
                                            <div className="adm_admins-config-square">
                                                <div className="adm_admins-config-content">
                                                    <h1>Notificações</h1>
                                                    <p>Avisos para clientes e administradores</p>
                                                    <div class="adm_admin_config-toggle-switch">
                                                        <input
                                                            class="adm_admin_config-toggle-input"
                                                            id="adm_admin_config-notification-toggle"
                                                            type="checkbox"
                                                            checked={notificationsEnabled}
                                                            onChange={(e) => setNotificationsEnabled(e.target.checked)}
                                                        />
                                                        <label class="adm_admin_config-toggle-label" for="adm_admin_config-notification-toggle"></label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="adm_admins-config-wrapper">
                                            <div className="adm_admins-config-square">
                                                <div className="adm_admins-config-content">
                                                    <h1>Preço Dinâmico</h1>
                                                    <p>Valores diferentes por horário/dia.</p>
                                                    <button
                                                        className="adm_admins-config-time-button"
                                                        onClick={openDynamicPriceModal}
                                                    >
                                                        Definir
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="adm_admins-config-wrapper">
                                            <div className="adm_admins-config-square">
                                                <div className="adm_admins-config-content">
                                                    <h1>Pagamento Antecipado</h1>
                                                    <p>Exige pagamento antes do agendamento.</p>
                                                    <div class="adm_admin_config-toggle-switch">
                                                        <input
                                                            class="adm_admin_config-toggle-input"
                                                            id="adm_admin_config-pay-toggle"
                                                            type="checkbox"
                                                            checked={prepaymentRequired}
                                                            onChange={(e) => setPrepaymentRequired(e.target.checked)}
                                                        />
                                                        <label class="adm_admin_config-toggle-label" for="adm_admin_config-pay-toggle"></label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="adm_admins-config-wrapper">
                                            <div className="adm_admins-config-square">
                                                <div className="adm_admins-config-content">
                                                    <h1>Reagendamento</h1>
                                                    <p>Permite alterar data/hora após confirmação.</p>
                                                    <div class="adm_admin_config-toggle-switch">
                                                        <input
                                                            class="adm_admin_config-toggle-input"
                                                            id="adm_admin_config-alt-date-toggle"
                                                            type="checkbox"
                                                            checked={reschedulingAllowed}
                                                            onChange={(e) => setReschedulingAllowed(e.target.checked)}
                                                        />
                                                        <label class="adm_admin_config-toggle-label" for="adm_admin_config-alt-date-toggle"></label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="adm_admins-config-wrapper">
                                            <div className="adm_admins-config-square">
                                                <div className="adm_admins-config-content">
                                                    <h1>Taxa Extra</h1>
                                                    <p>Cobrança adicional por horário ou tipo de serviço.</p>
                                                    <button
                                                        className="adm_admins-config-time-button"
                                                        onClick={openExtraFeeModal}
                                                    >
                                                        Definir
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="adm_products-modal-buttons">
                                    <button
                                        className="adm_products-modal-btn secondary-btn"
                                        onClick={prevStep}
                                    >
                                        Voltar
                                    </button>

                                    <button
                                        className="adm_products-modal-btn primary-btn"
                                        onClick={handleContinue}
                                    >
                                        Continuar
                                    </button>
                                </div>
                            </div>
                        )}

                        {isConfirmationModalOpen && (
                            <div className={`adm_confirmation-modal-overlay ${isConfirmationModalOpen ? 'active' : ''} ${isConfirmationModalClosing ? 'closing' : ''}`}>
                                <div className={`adm_confirmation-modal-content ${isConfirmationModalOpen && !isConfirmationModalClosing ? 'active' : ''} ${isConfirmationModalClosing ? 'closing' : ''}`}>
                                    <Icon icon="mingcute:question-line" className="icon" />
                                    <h2 className="adm_confirmation-modal-title">Confirmar Cadastro</h2>
                                    <p className="adm_confirmation-modal-message">Deseja cadastrar este produto com as configurações selecionadas?</p>

                                    <div className="adm_confirmation-modal-buttons">
                                        <button
                                            className="adm_confirmation-modal-btn secondary-btn"
                                            onClick={closeConfirmationModal}
                                        >
                                            Cancelar
                                        </button>
                                        <button
                                            className="adm_confirmation-modal-btn primary-btn"
                                            onClick={handleConfirmation}
                                        >
                                            Confirmar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {isBookingAdvanceModalOpen && (
                            <div className={`booking-advance-config-modal-overlay ${isBookingAdvanceModalClosing ? 'closing' : ''}`}>
                                <div className={`booking-advance-config-modal-content ${isBookingAdvanceModalClosing ? 'closing' : ''}`}>
                                    <div>
                                        <h2>Antecedência para Agendamento</h2>
                                        <p>Escolha o tempo mínimo necessário antes de reservar:</p>
                                    </div>

                                    <div className="booking-advance-config-time-input">
                                        <input
                                            type="number"
                                            min="0"
                                            placeholder="DD"
                                            className="booking-advance-config-input"
                                            value={bookingAdvanceDays}
                                            onChange={handleDaysChange}
                                        />
                                        :
                                        <input
                                            type="number"
                                            min="0"
                                            max="23"
                                            placeholder="HH"
                                            className="booking-advance-config-input"
                                            value={bookingAdvanceHours}
                                            onChange={handleHoursChange}
                                        />
                                        :
                                        <input
                                            type="number"
                                            min="0"
                                            max="59"
                                            placeholder="MM"
                                            className="booking-advance-config-input"
                                            value={bookingAdvanceMinutes}
                                            onChange={handleMinutesChange}
                                        />
                                    </div>
                                    <div className="booking-advance-config-modal-wrapper-buttons">
                                        <button
                                            className="booking-advance-config-modal-close"
                                            onClick={closeBookingAdvanceModal}
                                        >
                                            Fechar
                                        </button>
                                        <button
                                            className="booking-advance-config-modal-set"
                                            onClick={() => {
                                                // Normaliza os valores antes de salvar
                                                const normalized = normalizeTimeInput(
                                                    bookingAdvanceDays,
                                                    bookingAdvanceHours,
                                                    bookingAdvanceMinutes
                                                );

                                                setProductInfo(prev => ({
                                                    ...prev,
                                                    bookingAdvance: {
                                                        days: normalized.days,
                                                        hours: normalized.hours,
                                                        minutes: normalized.minutes
                                                    }
                                                }));
                                                closeBookingAdvanceModal();
                                            }}
                                        >
                                            Definir
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {isCancellationAdvanceModalOpen && (
                            <div className={`cancellation-advance-config-modal-overlay ${isCancellationAdvanceModalClosing ? 'closing' : ''}`}>
                                <div className={`cancellation-advance-config-modal-content ${isCancellationAdvanceModalClosing ? 'closing' : ''}`}>
                                    <div>
                                        <h2>Antecedência para Cancelamento</h2>
                                        <p>Escolha o tempo mínimo necessário antes de cancelar:</p>
                                    </div>

                                    <div className="cancellation-advance-config-time-input">
                                        <input
                                            type="number"
                                            min="0"
                                            max="365"
                                            placeholder="DD"
                                            className="cancellation-advance-config-input"
                                            value={cancellationAdvanceDays}
                                            onChange={handleCancellationDaysChange}
                                        />
                                        :
                                        <input
                                            type="number"
                                            min="0"
                                            max="23"
                                            placeholder="HH"
                                            className="cancellation-advance-config-input"
                                            value={cancellationAdvanceHours}
                                            onChange={handleCancellationHoursChange}
                                        />
                                        :
                                        <input
                                            type="number"
                                            min="0"
                                            max="59"
                                            placeholder="MM"
                                            className="cancellation-advance-config-input"
                                            value={cancellationAdvanceMinutes}
                                            onChange={handleCancellationMinutesChange}
                                        />
                                    </div>
                                    <div className="cancellation-advance-config-modal-wrapper-buttons">
                                        <button
                                            className="cancellation-advance-config-modal-close"
                                            onClick={closeCancellationAdvanceModal}
                                        >
                                            Fechar
                                        </button>
                                        <button
                                            className="cancellation-advance-config-modal-set"
                                            onClick={() => {
                                                // Normaliza os valores antes de salvar
                                                const normalized = normalizeTimeInput(
                                                    cancellationAdvanceDays,
                                                    cancellationAdvanceHours,
                                                    cancellationAdvanceMinutes
                                                );

                                                // Atualiza o productInfo com os valores normalizados
                                                setProductInfo(prev => ({
                                                    ...prev,
                                                    cancellationAdvance: {
                                                        days: normalized.days,
                                                        hours: normalized.hours,
                                                        minutes: normalized.minutes
                                                    }
                                                }));
                                                closeCancellationAdvanceModal();
                                            }}
                                        >
                                            Definir
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {isDynamicPriceModalOpen && (
                            <div className={`cancellation-advance-config-modal-overlay ${isDynamicPriceModalClosing ? 'closing' : ''}`}>
                                <div className={`cancellation-advance-config-modal-content dynamic-price-modal ${isDynamicPriceModalClosing ? 'closing' : ''}`}>
                                    <div>
                                        <h2>Preço Dinâmico</h2>
                                        <p>Defina valores diferentes por dia da semana:</p>
                                    </div>

                                    {/* Dias da semana */}
                                    <div className="days-of-week-container">
                                        {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map((day, index) => (
                                            <div
                                                key={index}
                                                className={`day-box ${selectedDay === index ? 'selected' : ''}`}
                                                onClick={() => setSelectedDay(index)}
                                            >
                                                {day}
                                            </div>
                                        ))}
                                    </div>

                                    {/* Configuração de horários para o dia selecionado */}
                                    {selectedDay !== null && (
                                        <div className="time-slots-container">
                                            <h3>Horários para {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'][selectedDay]}</h3>

                                            {timeSlots[selectedDay]?.map((slot, slotIndex) => (
                                                <div key={slotIndex} className="time-slot">
                                                    <input
                                                        type="time"
                                                        value={slot.startTime}
                                                        onChange={(e) => handleTimeSlotChange(selectedDay, slotIndex, 'startTime', e.target.value)}
                                                    />
                                                    <span>às</span>
                                                    <input
                                                        type="time"
                                                        value={slot.endTime}
                                                        onChange={(e) => handleTimeSlotChange(selectedDay, slotIndex, 'endTime', e.target.value)}
                                                    />
                                                    <input
                                                        type="number"
                                                        placeholder="Valor (R$)"
                                                        value={slot.price}
                                                        onChange={(e) => handleTimeSlotChange(selectedDay, slotIndex, 'price', e.target.value)}
                                                        min="0"
                                                        step="0.01"
                                                    />
                                                    <button
                                                        className="remove-slot"
                                                        onClick={() => handleRemoveTimeSlot(selectedDay, slotIndex)}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}

                                            <button
                                                className="add-time-slot"
                                                onClick={() => handleAddTimeSlot(selectedDay)}
                                            >
                                                + Adicionar horário
                                            </button>
                                        </div>
                                    )}

                                    <div className="cancellation-advance-config-modal-wrapper-buttons">
                                        <button
                                            className="cancellation-advance-config-modal-close"
                                            onClick={closeDynamicPriceModal}
                                        >
                                            Fechar
                                        </button>
                                        <button
                                            className="cancellation-advance-config-modal-set"
                                            onClick={handleSaveDynamicPrices}
                                        >
                                            Salvar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {isExtraFeeModalOpen && (
                            <div className={`cancellation-advance-config-modal-overlay ${isExtraFeeModalClosing ? 'closing' : ''}`}>
                                <div className={`cancellation-advance-config-modal-content extra-fee-modal ${isExtraFeeModalClosing ? 'closing' : ''}`}>
                                    <div>
                                        <h2>Taxa Extra</h2>
                                        <p>Defina cobranças adicionais por horário ou tipo de serviço:</p>
                                    </div>

                                    {/* Abas para selecionar o tipo de taxa */}
                                    <div className="fee-type-tabs">
                                        <button
                                            className={`tab-button ${activeFeeTab === 'time' ? 'active' : ''}`}
                                            onClick={() => setActiveFeeTab('time')}
                                        >
                                            Por Horário
                                        </button>
                                        <button
                                            className={`tab-button ${activeFeeTab === 'service' ? 'active' : ''}`}
                                            onClick={() => setActiveFeeTab('service')}
                                        >
                                            Por Serviço
                                        </button>
                                    </div>

                                    <div className={`tab-content ${activeFeeTab === 'time' ? 'active' : ''}`}>
                                        {activeFeeTab === 'time' && (
                                            <div className="time-based-fee">
                                                <div className="days-of-week-container">
                                                    {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'].map((day, index) => (
                                                        <div
                                                            key={index}
                                                            className={`day-box ${selectedFeeDay === index ? 'selected' : ''}`}
                                                            onClick={() => setSelectedFeeDay(index)}
                                                        >
                                                            {day}
                                                        </div>
                                                    ))}
                                                </div>

                                                {selectedFeeDay !== null && (
                                                    <div className="time-fee-container">
                                                        <h3>Taxas por horário - {['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'][selectedFeeDay]}</h3>

                                                        {timeFees[selectedFeeDay]?.map((fee, feeIndex) => (
                                                            <div key={feeIndex} className="fee-slot">
                                                                {/* Linha superior com inputs de tempo */}
                                                                <div className="fee-time-row">
                                                                    <input
                                                                        type="time"
                                                                        value={fee.startTime}
                                                                        onChange={(e) => handleTimeFeeChange(selectedFeeDay, feeIndex, 'startTime', e.target.value)}
                                                                        className="time-input"
                                                                    />
                                                                    <span className="time-separator">às</span>
                                                                    <input
                                                                        type="time"
                                                                        value={fee.endTime}
                                                                        onChange={(e) => handleTimeFeeChange(selectedFeeDay, feeIndex, 'endTime', e.target.value)}
                                                                        className="time-input"
                                                                    />
                                                                </div>

                                                                {/* Linha inferior com select e valor */}
                                                                <div className="fee-value-row">
                                                                    <select
                                                                        value={fee.type}
                                                                        onChange={(e) => handleTimeFeeChange(selectedFeeDay, feeIndex, 'type', e.target.value)}
                                                                        className="fee-type-select"
                                                                    >
                                                                        <option value="fixed">Valor Fixo</option>
                                                                        <option value="percentage">Porcentagem</option>
                                                                    </select>

                                                                    <input
                                                                        type="number"
                                                                        placeholder={fee.type === 'fixed' ? 'Valor (R$)' : '%'}
                                                                        value={fee.value}
                                                                        onChange={(e) => handleTimeFeeChange(selectedFeeDay, feeIndex, 'value', e.target.value)}
                                                                        className="fee-value-input"
                                                                    />

                                                                    <button
                                                                        className="remove-slot"
                                                                        onClick={() => handleRemoveTimeFee(selectedFeeDay, feeIndex)}
                                                                    >
                                                                        ×
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}

                                                        <button
                                                            className="add-time-slot"
                                                            onClick={() => handleAddTimeFee(selectedFeeDay)}
                                                        >
                                                            + Adicionar Taxa
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                    </div>

                                    <div className={`tab-content ${activeFeeTab === 'service' ? 'active' : ''}`}>

                                        {activeFeeTab === 'service' && (
                                            <div className="service-based-fee">
                                                <div className="service-fee-list">
                                                    {serviceFees.map((service, index) => (
                                                        <div key={index} className="service-fee-item">
                                                            <input
                                                                type="text"
                                                                placeholder="Nome do serviço"
                                                                value={service.name}
                                                                onChange={(e) => handleServiceFeeChange(index, 'name', e.target.value)}
                                                            />
                                                            <select
                                                                value={service.type}
                                                                onChange={(e) => handleServiceFeeChange(index, 'type', e.target.value)}
                                                            >
                                                                <option value="fixed">Valor Fixo</option>
                                                                <option value="percentage">Porcentagem</option>
                                                            </select>
                                                            <input
                                                                type="number"
                                                                placeholder={service.type === 'fixed' ? 'Valor (R$)' : '%'}
                                                                value={service.value}
                                                                onChange={(e) => handleServiceFeeChange(index, 'value', e.target.value)}
                                                            />
                                                            <button
                                                                className="remove-slot"
                                                                onClick={() => handleRemoveServiceFee(index)}
                                                            >
                                                                ×
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>

                                                <button
                                                    className="add-time-slot"
                                                    onClick={handleAddServiceFee}
                                                >
                                                    + Adicionar Serviço
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div className="cancellation-advance-config-modal-wrapper-buttons">
                                        <button
                                            className="cancellation-advance-config-modal-close"
                                            onClick={closeExtraFeeModal}
                                        >
                                            Fechar
                                        </button>
                                        <button
                                            className="cancellation-advance-config-modal-set"
                                            onClick={handleSaveExtraFees}
                                        >
                                            Salvar
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )
            }
        </div >
    );
};

export default Products;
