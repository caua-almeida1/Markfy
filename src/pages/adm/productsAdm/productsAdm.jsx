import { useLicense } from "../../../plans/LicenseContext";
import React, {
    useContext,
    useState,
    useEffect,
    useRef
} from "react";
import {
    getDatabase,
    ref,
    push,
    set,
    child,
    onValue,
    off,
    get,
    update,
    remove
} from "firebase/database";

import {
    getStorage,
    ref as storageRef,
    uploadBytes,
    getDownloadURL,
    listAll
} from "firebase/storage";

import { getAuth } from "firebase/auth";

import { Icon } from "@iconify/react";
import imageCompression from "browser-image-compression";

import Thumb1 from "../../../img/adm-content/image-not-found.svg";

import { useUserCompany } from "../../../contexts/companyContext/UserCompanyContext";
import Toast from "../../../components/toast/Toast";
import ProductManagementSlider from "./components/ProductManagementModal"
import ProductCreationModal from "./components/ProductCreationModal";
import ComboBuilderModal from "./components/ComboBuilderModal";

import {
    buildComboItems,
    COMBO_TYPE,
    sumComboDuration
} from "../../../utils/combo";

import { loadProductImages } from "../../../utils/productImages";


import {
    buildMonthlyPlan,
    getPlanPriceSuffix,
    isSubscriptionProduct,
    normalizeMonthlyPlan
} from "../../../utils/subscription";

import "./productsAdm.css";
import Modal from "../../../components/modal/Modal";

const Products = ({ shouldOpenModal, setOpenProductsModal }) => {

    /* =====================================================
       COMBOS

       Um combo é um produto com `type: "combo"`: nasce no
       mesmo nó, aparece no mesmo catálogo e é agendado pelo
       mesmo fluxo. O que ele guarda a mais são os itens que
       o formam.
    ===================================================== */

    const [isComboModalOpen, setIsComboModalOpen] = useState(false);

    const [creatingCombo, setCreatingCombo] = useState(false);

    /* Imagens já resolvidas dos produtos, para o modal
       mostrar as miniaturas sem buscar de novo. */
    const [comboImages, setComboImages] = useState({});
    const { company, companyHandle } = useUserCompany();
    const [duration, setDuration] = useState(0);
    const [activeTab, setActiveTab] = useState("ativos");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(true);

    const [products, setProducts] = useState([]);
    const [isAddingProduct, setIsAddingProduct] = useState(false);

    /* Limite de itens do plano da empresa. Só os ativos contam;
       arquivar libera espaço. */
    const license = useLicense();

    const hasRoomForProduct = () => {

        const limit = license.limit("maxProducts");
        const activeCount = products.filter((item) => item.status === "ativos").length;

        if (activeCount >= limit) {

            alert(
                `O plano atual da empresa permite até ${limit} item(ns) ativos no catálogo. ` +
                "Arquive algum item ou peça ao administrador principal para mudar de plano em Perfil → Planos e Assinaturas."
            );

            return false;
        }

        return true;
    };

    const openCreation = () => {
        if (hasRoomForProduct()) setIsModalOpen(true);
    };

    /* =========================================================
       PESQUISA + FILTROS
    ========================================================= */

    const [searchTerm, setSearchTerm] = useState("");

    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [isSortOpen, setIsSortOpen] = useState(false);

    const [selectedCategory, setSelectedCategory] = useState("all");
    const [selectedSort, setSelectedSort] = useState("nameAsc");

    /* Tipo de oferta: "all" | "individual" | "monthly".
       Produtos antigos não têm `type`, então valem como
       individuais. */
    const [selectedType, setSelectedType] = useState("all");

    const [tempCategory, setTempCategory] = useState("all");
    const [tempSort, setTempSort] = useState("nameAsc");
    const [tempType, setTempType] = useState("all");

    const TYPE_OPTIONS = [
        {
            id: "all",
            label: "Todos",
            icon: "lucide:layers"
        },
        {
            id: "individual",
            label: "Produtos",
            icon: "mdi:package-variant"
        },
        {
            id: "monthly",
            label: "Mensalidades",
            icon: "solar:refresh-circle-linear"
        }
    ];

    const matchesSelectedType = (product, type) => {

        if (type === "all") {
            return true;
        }

        return type === "monthly"
            ? isSubscriptionProduct(product)
            : !isSubscriptionProduct(product);

    };

    const sortOptions = [
        {
            id: "nameAsc",
            label: "Nome (A-Z)"
        },
        {
            id: "nameDesc",
            label: "Nome (Z-A)"
        },
        {
            id: "priceAsc",
            label: "Menor preço"
        },
        {
            id: "priceDesc",
            label: "Maior preço"
        }
    ];

    /* =========================================================
        CATEGORIAS DISPONÍVEIS
    ========================================================= */

    const productCategories = [
        ...new Set(
            products
                .flatMap(product =>
                    Array.isArray(product.categories)
                        ? product.categories
                        : []
                )
                .filter(Boolean)
        )
    ];


    /* =========================================================
        CONTADOR DE FILTROS
    ========================================================= */

    const activeFiltersCount =
        (selectedCategory !== "all" ? 1 : 0) +
        (selectedType !== "all" ? 1 : 0);


    /* =========================================================
        PRODUTOS FILTRADOS
    ========================================================= */

    const filteredProducts = products
        .filter((product) => {

            /* =========================
               ABA
            ========================= */

            const matchesTab =
                product.status === activeTab;


            /* =========================
               PESQUISA
            ========================= */

            const normalizedSearch =
                searchTerm
                    .trim()
                    .toLowerCase();

            const matchesSearch =
                !normalizedSearch ||
                product.name
                    ?.toLowerCase()
                    .includes(normalizedSearch) ||
                product.description
                    ?.replace(/<[^>]*>/g, "")
                    .toLowerCase()
                    .includes(normalizedSearch) ||
                String(product.id)
                    .toLowerCase()
                    .includes(normalizedSearch) ||
                product.categories?.some(category =>
                    String(category)
                        .toLowerCase()
                        .includes(normalizedSearch)
                );


            /* =========================
               CATEGORIA
            ========================= */

            const matchesCategory =
                selectedCategory === "all" ||
                product.categories?.includes(
                    selectedCategory
                );


            /* =========================
               TIPO DE OFERTA
            ========================= */

            const matchesType =
                matchesSelectedType(
                    product,
                    selectedType
                );


            return (
                matchesTab &&
                matchesSearch &&
                matchesCategory &&
                matchesType
            );
        })
        .sort((a, b) => {

            /* Produtos avulsos vêm sempre antes das
               mensalidades, independente da ordenação
               escolhida — o foco da lista são eles. */
            const subscriptionOrder =
                Number(isSubscriptionProduct(a)) -
                Number(isSubscriptionProduct(b));

            if (subscriptionOrder !== 0) {
                return subscriptionOrder;
            }

            switch (selectedSort) {

                case "nameAsc":
                    return (
                        a.name || ""
                    ).localeCompare(
                        b.name || ""
                    );

                case "nameDesc":
                    return (
                        b.name || ""
                    ).localeCompare(
                        a.name || ""
                    );

                case "priceAsc":
                    return (
                        parseFloat(
                            String(a.value || "0")
                                .replace(/[^\d,.-]/g, "")
                                .replace(/\./g, "")
                                .replace(",", ".")
                        ) -
                        parseFloat(
                            String(b.value || "0")
                                .replace(/[^\d,.-]/g, "")
                                .replace(/\./g, "")
                                .replace(",", ".")
                        )
                    );

                case "priceDesc":
                    return (
                        parseFloat(
                            String(b.value || "0")
                                .replace(/[^\d,.-]/g, "")
                                .replace(/\./g, "")
                                .replace(",", ".")
                        ) -
                        parseFloat(
                            String(a.value || "0")
                                .replace(/[^\d,.-]/g, "")
                                .replace(/\./g, "")
                                .replace(",", ".")
                        )
                    );

                default:
                    return 0;
            }

        });

    const [selectedProduct, setSelectedProduct] = useState(null);
    const [isManagementModalOpen, setIsManagementModalOpen] = useState(false);

    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState("success");
    const [toastTitle, setToastTitle] = useState("");
    const [toastMessage, setToastMessage] = useState("");

    const formatProductDescription = (description) => {
        return {
            __html: description || ""
        };
    };

    const openToast = (type, title, message) => {
        setToastType(type);
        setToastTitle(title);
        setToastMessage(message);

        setShowToast(true);
    };

    useEffect(() => {
        if (shouldOpenModal) {
            const timer = setTimeout(() => {
                openCreation();
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

        if (step === 2.5) {
            setProductInfo(prev => ({
                ...prev,
                monthlyPlan: buildMonthlyPlan({
                    billingCycle,
                    unlimitedSessions,
                    sessionsPerCycle,
                    autoRenew,
                    trialDays,
                    loyaltyMonths,
                    cancellationNoticeDays:
                        subscriptionCancellationNoticeDays
                })
            }));
        }

        if (step === 3) {
            // console.log("Imagens fornecidas:", productImages.filter(img => img !== null));
        }

        if (step === 4) {

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

            const auth = getAuth();
            const currentUser = auth.currentUser;

            let relatedUsers = members
                .filter(member =>
                    selectedAdmins.includes(member.id)
                )
                .map(member => ({
                    id: member.id,
                    name: member.name,
                    role: capitalizeFirst(member.role)
                }));

            // =====================================================
            // SE NENHUM USUÁRIO FOI SELECIONADO
            // RELACIONA AUTOMATICAMENTE O USUÁRIO LOGADO
            // =====================================================

            if (
                relatedUsers.length === 0 &&
                currentUser
            ) {

                const loggedUser = members.find(
                    member =>
                        member.id === currentUser.uid
                );

                if (loggedUser) {

                    relatedUsers = [
                        {
                            id: loggedUser.id,
                            name: loggedUser.name,
                            role: capitalizeFirst(loggedUser.role)
                        }
                    ];

                } else {

                    // Fallback caso o usuário ainda não esteja
                    // carregado na lista de membros
                    relatedUsers = [
                        {
                            id: currentUser.uid,
                            name:
                                currentUser.displayName ||
                                currentUser.email ||
                                "Usuário",
                            role: "Administrador"
                        }
                    ];

                }
            }

            setProductInfo(prev => ({
                ...prev,
                relatedUsers
            }));
        }

        if (step < 8) {  // Aumente o limite para 8 se tiver mais steps
            setIsAnimating(true);
            setStepDirection("next");
            setTimeout(() => {
                setStep(prev => getNextStepValue(prev));
                setIsAnimating(false);
            }, 400);
        }
    };

    const prevStep = () => {
        if (step > 1) {
            setIsAnimating(true);
            setStepDirection("prev");
            setTimeout(() => {
                setStep((prev) => getPrevStepValue(prev));
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
        setProductType(buttonId === 1 ? 'individual' : 'monthly');
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

    /* =========================================================
       QUARTO PASSO — DURAÇÃO

       A duração é um estado controlado: o range e os campos
       de hora/minuto são só duas entradas para o mesmo
       número de minutos, ambos limitados ao mesmo teto.
    ========================================================= */

    const DURATION_MAX_MINUTES = 300;

    const handleDurationChange = (value) => {

        const parsed = parseInt(value, 10);

        const minutes =
            Number.isNaN(parsed)
                ? 0
                : Math.min(
                    Math.max(parsed, 0),
                    DURATION_MAX_MINUTES
                );

        setDuration(minutes);

        setProductInfo(prev => ({
            ...prev,
            duration: minutes
        }));

    };

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

    /* =========================================================
       BUSCAR IMAGENS DO PRODUTO NO FIREBASE STORAGE
    
       As imagens NÃO ficam no Realtime Database.
    
       Caminho:
    
       companys/{companyKey}/products/{productId}/images/
    
       Retorna somente URLs em memória para utilização na UI.
    ========================================================= */

    const getProductStorageImages = async (
        companyKey,
        productId
    ) => {

        try {

            if (!companyKey || !productId) {
                return [];
            }

            const storage = getStorage();

            const productImagesRef = storageRef(
                storage,
                `companys/${companyKey}/products/${productId}/images`
            );

            const result = await listAll(
                productImagesRef
            );

            if (!result.items.length) {
                return [];
            }

            /*
             * Ordena pelo nome:
             *
             * image_0.jpg
             * image_1.jpg
             * image_2.jpg
             *
             * Isso garante que a primeira imagem
             * seja sempre a principal.
             */

            const sortedItems = [...result.items].sort(
                (a, b) =>
                    a.name.localeCompare(
                        b.name,
                        undefined,
                        {
                            numeric: true,
                            sensitivity: "base"
                        }
                    )
            );

            const imageUrls =
                await Promise.all(
                    sortedItems.map(
                        async (item) => {

                            try {

                                return await getDownloadURL(
                                    item
                                );

                            } catch (error) {

                                console.error(
                                    `Erro ao obter URL da imagem ${item.name}:`,
                                    error
                                );

                                return null;

                            }

                        }
                    )
                );

            return imageUrls.filter(Boolean);

        } catch (error) {

            /*
             * Se o produto ainda não possui imagens
             * no Storage, simplesmente retorna vazio.
             */

            console.warn(
                `Não foi possível carregar imagens do produto ${productId}:`,
                error
            );

            return [];

        }

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

    /*
     * Resolve as imagens dos produtos ao abrir o modal.
     *
     * O combo copia UMA imagem de um dos produtos, e a
     * pessoa escolhe qual — para escolher, precisa ver.
     */
    useEffect(() => {

        if (!isComboModalOpen || !company?.handle) {
            return;
        }

        let cancelado = false;

        Promise.all(
            (products || []).map(async (product) => [
                product.id,
                await loadProductImages(company.handle, product.id)
            ])
        ).then((entradas) => {

            if (!cancelado) {
                setComboImages(Object.fromEntries(entradas));
            }

        });

        return () => {
            cancelado = true;
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isComboModalOpen, company?.handle]);


    /*
     * Cria o combo.
     *
     * A imagem escolhida é COPIADA para a pasta do combo no
     * Storage — buscando o arquivo e reenviando, porque o SDK
     * web não copia dentro do bucket. O RTDB não recebe
     * imagem nenhuma: lá fica só o produto, e é isso que
     * mantém o nó leve.
     */
    const handleCreateCombo = async ({
        produtos,
        name,
        description,
        includes,
        price,
        coverProductId
    }) => {

        const companyHandle = company?.handle;

        if (!companyHandle) {
            return;
        }

        setCreatingCombo(true);

        try {

            const db = getDatabase();

            const comboId =
                push(ref(db, `companys/${companyHandle}/products`)).key;

            /* ---------- IMAGEM ---------- */

            const origem =
                comboImages[coverProductId]?.[0] ||
                comboImages[produtos[0]?.id]?.[0] ||
                null;

            if (origem) {

                try {

                    const resposta = await fetch(origem);

                    if (resposta.ok) {

                        const blob = await resposta.blob();

                        await uploadBytes(
                            storageRef(
                                getStorage(),
                                `companys/${companyHandle}/products/${comboId}/images/image_0.jpg`
                            ),
                            blob,
                            { contentType: blob.type || "image/jpeg" }
                        );

                    }

                } catch (error) {

                    /*
                     * Ler do Storage pelo navegador depende de
                     * CORS. Sem isso o combo nasce sem imagem —
                     * o que é chato, mas não impede de vender.
                     * Falhar a criação inteira por causa da
                     * foto seria pior.
                     */
                    console.warn(
                        "Não foi possível copiar a imagem do combo:",
                        error
                    );

                }

            }

            /* ---------- PRODUTO ---------- */

            const primeiro = produtos[0] || {};

            await set(
                ref(db, `companys/${companyHandle}/products/${comboId}`),
                {
                    name,
                    status: "ativos",
                    type: COMBO_TYPE,
                    value: price,
                    orders: 0,
                    description: description || "",
                    duration: sumComboDuration(produtos),
                    categories: primeiro.categories || [],
                    currency: primeiro.currency || "BRL",

                    comboItems: buildComboItems(produtos),
                    includes: includes || "",

                    /* Herda as regras de agendamento do primeiro
                       item: um combo não tem antecedência
                       própria, e inventar zero aqui deixaria o
                       pacote sem as travas que os serviços têm. */
                    bookingAdvance: primeiro.bookingAdvance || {
                        days: 0, hours: 0, minutes: 0
                    },
                    cancellationAdvance: primeiro.cancellationAdvance || {
                        days: 0, hours: 0, minutes: 0
                    },

                    /* Quem atende o combo é quem atende o
                       primeiro serviço; o admin ajusta depois
                       em Gerenciar produto. */
                    relatedUsers: primeiro.relatedUsers || [],

                    createdAt: new Date().toISOString()
                }
            );

            setIsComboModalOpen(false);

            openToast(
                "success",
                "Combo criado",
                `${name} já está no catálogo.`
            );

        } catch (error) {

            console.error("Erro ao criar combo:", error);

            openToast(
                "error",
                "Não deu para criar",
                "Tente de novo em instantes."
            );

        } finally {

            setCreatingCombo(false);

        }

    };


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

                // O handle vem do contexto: não precisamos
                // varrer o nó "companys" para descobri-lo.
                const companyKey = companyHandle;

                if (!companyKey) return;

                const db = getDatabase();

                // Buscar os membros dessa empresa
                const membersRef = ref(db, `companys/${companyKey}/members`);
                const membersSnap = await get(membersRef);

                if (membersSnap.exists()) {
                    const membersData = membersSnap.val();

                    // Buscar apenas os uids necessários,
                    // nunca o nó "users" inteiro.
                    const entries = Object.entries(membersData);

                    const parsedMembers = await Promise.all(
                        entries.map(async ([uid, info]) => {
                            const userSnap = await get(
                                ref(db, `users/${uid}`)
                            );

                            const userInfo = userSnap.exists()
                                ? userSnap.val()
                                : {};

                            return {
                                id: uid,
                                name: userInfo.name || "Sem nome",
                                avatar: userInfo.avatar || null,
                                role: info.role || "Sem função",
                            };
                        })
                    );

                    setMembers(parsedMembers);
                }
            } catch (err) {
                console.error("Erro ao buscar membros:", err);
            }
        };

        fetchMembers();
    }, [companyHandle]);

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

        if (isAddingProduct) {
            return;
        }

        setIsAddingProduct(true);

        try {

            /* =========================================================
               EMPRESA
            ========================================================= */

            const companyHandle =
                company?.handle;

            if (!companyHandle) {

                throw new Error(
                    "Não foi possível identificar a empresa."
                );

            }


            /* =========================================================
               DESCONTO
            ========================================================= */

            const discountPercentage =
                calculateDiscountPercentage();


            /* =========================================================
               IMAGENS SELECIONADAS
            ========================================================= */

            const productImages =
                Array.isArray(carouselItems)
                    ? carouselItems
                        .map(item => item?.image)
                        .filter(Boolean)
                    : [];


            /* =========================================================
               ID DO PRODUTO
            ========================================================= */

            const generateCustomId = (
                length = 12
            ) => {

                const chars =
                    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

                return Array.from(
                    {
                        length
                    },
                    () =>
                        chars.charAt(
                            Math.floor(
                                Math.random() *
                                chars.length
                            )
                        )
                ).join("");

            };


            const customId =
                generateCustomId(12);


            /* =========================================================
               FIREBASE
            ========================================================= */

            const db =
                getDatabase();

            const storage =
                getStorage();


            /* =========================================================
               📷 UPLOAD DAS IMAGENS
               
               IMPORTANTE:
               
               As imagens NÃO serão salvas no RTDB.
               
               Elas serão salvas somente em:
               
               companys/{companyHandle}/products/{customId}/images/
               
               ========================================================= */

            const uploadedImages = [];


            for (
                let index = 0;
                index < productImages.length;
                index++
            ) {

                const imageFile =
                    productImages[index];


                let file;


                /* =====================================================
                   DATA URL
                ===================================================== */

                if (
                    typeof imageFile === "string" &&
                    imageFile.startsWith("data:")
                ) {

                    const response =
                        await fetch(
                            imageFile
                        );


                    const blob =
                        await response.blob();


                    file =
                        new File(
                            [
                                blob
                            ],
                            `image_${index}.jpg`,
                            {
                                type:
                                    blob.type ||
                                    "image/jpeg"
                            }
                        );

                }

                /* =====================================================
                   FILE
                ===================================================== */

                else if (
                    imageFile instanceof File
                ) {

                    file =
                        imageFile;

                }

                else {

                    console.warn(
                        "Imagem ignorada:",
                        imageFile
                    );

                    continue;
                }


                /* =====================================================
                   COMPRESSÃO
                ===================================================== */

                const compressedFile =
                    await imageCompression(
                        file,
                        {

                            maxSizeMB:
                                0.3,

                            maxWidthOrHeight:
                                1280,

                            useWebWorker:
                                true,

                            fileType:
                                "image/jpeg",

                            initialQuality:
                                0.82

                        }
                    );


                /* =====================================================
                   NOME PADRONIZADO
                ===================================================== */

                const fileName =
                    `image_${index}.jpg`;


                /* =====================================================
                   CAMINHO NO STORAGE
                ===================================================== */

                const imagePath =
                    `companys/${companyHandle}/products/${customId}/images/${fileName}`;


                const imageRef =
                    storageRef(
                        storage,
                        imagePath
                    );


                /* =====================================================
                   UPLOAD
                ===================================================== */

                await uploadBytes(
                    imageRef,
                    compressedFile,
                    {
                        contentType:
                            "image/jpeg"
                    }
                );


                /* =====================================================
                   URL
                   
                   A URL pode ser usada em memória/UI.
                   
                   NÃO será salva no produto do RTDB.
                   ===================================================== */

                const downloadUrl =
                    await getDownloadURL(
                        imageRef
                    );


                uploadedImages.push({

                    name:
                        fileName,

                    path:
                        imagePath,

                    url:
                        downloadUrl

                });

            }


            /* =========================================================
               👤 USUÁRIOS RELACIONADOS
            ========================================================= */

            const relatedUsers =
                members
                    .filter(
                        member =>
                            selectedAdmins.includes(
                                member.id
                            )
                    )
                    .map(
                        member => ({

                            id:
                                member.id,

                            role:
                                capitalizeFirst(
                                    member.role
                                )

                        })
                    );


            /* =========================================================
               📝 PRODUTO
               
               ATENÇÃO:
               
               NÃO existe:
               
               image
               images
               
               aqui.
               
               ========================================================= */

            const newProduct = {

                name:
                    productInfo.name,

                status:
                    "ativos",

                type:
                    productType || "individual",

                value:
                    productInfo.price,

                orders:
                    0,

                description:
                    productInfo.description,

                duration:
                    productInfo.duration,

                categories:
                    productInfo.categories,

                discount:
                    discountPercentage !== null
                        ? `${discountPercentage}%`
                        : null,

                relatedUsers,

                originalPrice:
                    priceFrom,

                discountedPrice:
                    priceTo,

                currency,

                bookingAdvance:
                    productInfo.bookingAdvance,

                cancellationAdvance:
                    productInfo.cancellationAdvance,

                /* O plano é remontado aqui a partir dos estados
                   do passo 2.5 (e não de productInfo.monthlyPlan)
                   para que o que foi digitado por último sempre
                   chegue ao banco, mesmo que o admin tenha voltado
                   e editado a assinatura sem avançar de novo. */
                monthlyPlan:
                    productType === "monthly"
                        ? buildMonthlyPlan({
                            billingCycle,
                            unlimitedSessions,
                            sessionsPerCycle,
                            autoRenew,
                            trialDays,
                            loyaltyMonths,
                            cancellationNoticeDays:
                                subscriptionCancellationNoticeDays,
                            price:
                                productInfo.price,
                            currency
                        })
                        : null,

                settings: {

                    privacy:
                        isPrivate,

                    notifications:
                        notificationsEnabled,

                    prepayment:
                        prepaymentRequired,

                    rescheduling:
                        reschedulingAllowed,

                    dynamicPricing:
                        productInfo.settings
                            .dynamicPricing,

                    extraFees:
                        productInfo.settings
                            .extraFees

                },

                createdAt:
                    new Date().toISOString()

            };


            /* =========================================================
               💾 SALVAR NO REALTIME DATABASE
               
               SOMENTE DADOS DO PRODUTO.
               
               IMAGENS FICAM NO STORAGE.
               ========================================================= */

            const productRef =
                ref(
                    db,
                    `companys/${companyHandle}/products/${customId}`
                );


            await set(
                productRef,
                newProduct
            );


            /* =========================================================
               LOG
            ========================================================= */

            console.log(
                "Produto salvo no Realtime Database:",
                `companys/${companyHandle}/products/${customId}`
            );


            console.log(
                "Imagens salvas no Firebase Storage:",
                uploadedImages
            );


            /* =========================================================
               FECHAR CONFIRMAÇÃO
            ========================================================= */

            closeConfirmationModal();


            /* =========================================================
               RESETAR FORMULÁRIO
            ========================================================= */

            resetAllStates();


            /* =========================================================
               FECHAR MODAL PRINCIPAL
            ========================================================= */

            closeModal();


            /* =========================================================
               TOAST
            ========================================================= */

            openToast(
                "success",
                "Produto criado",
                "O produto foi criado com sucesso."
            );


        } catch (error) {

            console.error(
                "Erro ao salvar produto:",
                error
            );


            openToast(
                "error",
                "Erro ao criar produto",
                error?.message ||
                "Não foi possível criar o produto. Tente novamente."
            );


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
            relatedUsers: [],
            monthlyPlan: null
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
        setBillingCycle('monthly');
        setUnlimitedSessions(true);
        setSessionsPerCycle('');
        setAutoRenew(true);
        setTrialDays('');
        setLoyaltyMonths('');
        setSubscriptionCancellationNoticeDays('');
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

    // ============== PASSO 2.5 — PLANO DE MENSALIDADE ===============

    const [billingCycle, setBillingCycle] = useState('monthly');
    const [unlimitedSessions, setUnlimitedSessions] = useState(true);
    const [sessionsPerCycle, setSessionsPerCycle] = useState('');
    const [autoRenew, setAutoRenew] = useState(true);
    const [trialDays, setTrialDays] = useState('');
    const [loyaltyMonths, setLoyaltyMonths] = useState('');
    const [subscriptionCancellationNoticeDays, setSubscriptionCancellationNoticeDays] = useState('');

    // Calcula o próximo/anterior step considerando o sub-passo
    // exclusivo do plano de mensalidade (2.5), que só existe
    // quando o produto selecionado no passo 2 é "monthly".
    const getNextStepValue = (current) => {
        if (current === 2 && productType === 'monthly') return 2.5;
        if (current === 2.5) return 3;
        return current + 1;
    };

    const getPrevStepValue = (current) => {
        if (current === 2.5) return 2;
        if (current === 3 && productType === 'monthly') return 2.5;
        return current - 1;
    };

    const [productName, setProductName] = useState('');
    const [productDescription, setProductDescription] = useState('');

    const DESCRIPTION_MAX_LENGTH = 2000;

    const [descriptionLength, setDescriptionLength] =
        useState(0);

    const descriptionEditorRef = useRef(null);

    const execDescriptionCommand = (
        command,
        value = null
    ) => {

        const editor =
            descriptionEditorRef.current;

        if (!editor) return;

        editor.focus();

        document.execCommand(
            command,
            false,
            value
        );

        const html =
            editor.innerHTML;

        const temp =
            document.createElement("div");

        temp.innerHTML = html;

        const text =
            temp.textContent ||
            temp.innerText ||
            "";

        if (
            text.length >
            DESCRIPTION_MAX_LENGTH
        ) {
            return;
        }

        setDescriptionLength(
            text.length
        );

        setProductDescription(
            html
        );
    };

    const handleDescriptionInput = (e) => {

        const editor = e.currentTarget;

        const html = editor.innerHTML;

        const temp =
            document.createElement("div");

        temp.innerHTML = html;

        const text =
            temp.textContent ||
            temp.innerText ||
            "";

        if (text.length > DESCRIPTION_MAX_LENGTH) {

            editor.innerHTML =
                productDescription;

            return;
        }

        setDescriptionLength(
            text.length
        );

        setProductDescription(
            html
        );
    };

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
        relatedUsers: [],
        monthlyPlan: null
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

    const removeExpiredArchivedProducts = async (
        productsData,
        companyKey,
        db
    ) => {

        const now = Date.now();

        // 30 dias em milissegundos
        const thirtyDays =
            30 * 24 * 60 * 60 * 1000;

        const expiredProducts =
            Object.entries(productsData).filter(
                ([productId, product]) => {

                    // Só verifica produtos arquivados
                    if (
                        product.status !== "arquivados"
                    ) {
                        return false;
                    }

                    // Produto antigo que não possui
                    // archivedAt não será removido
                    if (!product.archivedAt) {
                        return false;
                    }

                    const archivedAt =
                        new Date(
                            product.archivedAt
                        ).getTime();

                    // Data inválida
                    if (isNaN(archivedAt)) {
                        return false;
                    }

                    // Verifica se já passaram 30 dias
                    return (
                        now - archivedAt >= thirtyDays
                    );

                }
            );

        await Promise.all(

            expiredProducts.map(
                ([productId]) => {

                    const productRef = ref(
                        db,
                        `companys/${companyKey}/products/${productId}`
                    );

                    return remove(productRef);

                }
            )

        );

        return expiredProducts.length;

    };

    useEffect(() => {

        let unsubscribeProducts = null;
        let isMounted = true;

        const fetchProducts = async () => {

            try {

                setLoading(true);


                /* =====================================================
                   AUTENTICAÇÃO
                ===================================================== */

                const auth =
                    getAuth();

                const user =
                    auth.currentUser;


                if (!user) {

                    throw new Error(
                        "Usuário não autenticado"
                    );

                }


                /* =====================================================
                   FIREBASE
                ===================================================== */

                const db =
                    getDatabase();


                const storage =
                    getStorage();


                /* =====================================================
                   EMPRESA SELECIONADA

                   Vem do contexto. Antes a tela baixava todas as
                   empresas e usava a primeira em que a pessoa
                   era membro — quem participa de mais de uma
                   via sempre os produtos da mesma.
                ===================================================== */

                const companyKey =
                    companyHandle;


                if (!companyKey) {

                    throw new Error(
                        "Nenhuma empresa selecionada"
                    );

                }


                /* =====================================================
                   PRODUTOS
                ===================================================== */

                const productsRef =
                    ref(
                        db,
                        `companys/${companyKey}/products`
                    );


                /* =====================================================
                   LIMPEZA DOS ARQUIVADOS
                ===================================================== */

                const productsSnapshot =
                    await get(
                        productsRef
                    );


                if (
                    productsSnapshot.exists()
                ) {

                    const productsData =
                        productsSnapshot.val();


                    await removeExpiredArchivedProducts(
                        productsData,
                        companyKey,
                        db
                    );

                }


                /* =====================================================
                   ESCUTAR PRODUTOS
                ===================================================== */

                unsubscribeProducts =
                    onValue(
                        productsRef,
                        async (snapshot) => {

                            if (!isMounted) {
                                return;
                            }


                            const data =
                                snapshot.val();


                            if (!data) {

                                setProducts([]);

                                setLoading(false);

                                return;

                            }


                            /* =================================================
                               TRANSFORMAR RTDB EM ARRAY
                            ================================================= */

                            const productsArray =
                                Object.keys(data).map(
                                    (key) => ({

                                        id:
                                            key,

                                        ...data[key]

                                    })
                                );


                            /* =================================================
                               BUSCAR IMAGENS DO STORAGE
                               
                               IMPORTANTE:
                               
                               As imagens são carregadas paralelamente.
                               
                               Não são salvas no RTDB.
                            ================================================= */

                            const productsWithImages =
                                await Promise.all(

                                    productsArray.map(
                                        async (product) => {

                                            const storageImages =
                                                await getProductStorageImages(
                                                    companyKey,
                                                    product.id
                                                );


                                            return {

                                                ...product,

                                                /*
                                                 * Estas duas propriedades
                                                 * existem somente no estado
                                                 * React.
                                                 */

                                                storageImages,

                                                storageImage:
                                                    storageImages[0] ||
                                                    null

                                            };

                                        }
                                    )

                                );


                            if (!isMounted) {
                                return;
                            }


                            /* =================================================
                               ATUALIZAR LISTA
                            ================================================= */

                            setProducts(
                                productsWithImages
                            );


                            setLoading(
                                false
                            );

                        },

                        (error) => {

                            console.error(
                                "Erro ao buscar produtos:",
                                error
                            );


                            if (isMounted) {

                                setLoading(
                                    false
                                );

                            }

                        }
                    );


            } catch (error) {

                console.error(
                    "Erro ao carregar produtos:",
                    error
                );


                if (isMounted) {

                    setProducts([]);

                    setLoading(
                        false
                    );

                }

            }

        };


        fetchProducts();


        return () => {

            isMounted = false;


            if (unsubscribeProducts) {

                unsubscribeProducts();

            }

        };


        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [companyHandle]);

    const handleArchiveProduct = async (product) => {

        try {

            const db = getDatabase();

            const productRef = ref(
                db,
                `companys/${company.handle}/products/${product.id}`
            );

            const isArchiving = product.status === "ativos";

            if (isArchiving) {

                // ===============================
                // ARQUIVAR
                // ===============================

                await update(productRef, {

                    status: "arquivados",

                    // Começa a contar os 30 dias
                    // a partir do momento em que foi arquivado
                    archivedAt: new Date().toISOString()

                });

                openToast(
                    "success",
                    "Produto arquivado",
                    "O produto foi arquivado com sucesso."
                );

            } else {

                // ===============================
                // RESTAURAR
                // ===============================

                await update(productRef, {

                    status: "ativos",

                    // Remove a data de arquivamento
                    // porque o produto voltou a ficar ativo
                    archivedAt: null

                });

                openToast(
                    "success",
                    "Produto restaurado",
                    "O produto foi restaurado com sucesso."
                );

            }

        } catch (err) {

            console.error(
                "Erro ao alterar status do produto:",
                err
            );

            openToast(
                "error",
                "Erro",
                "Não foi possível alterar o status do produto."
            );

        }

    };

    const handleSaveProduct = async (updatedProduct) => {

        try {

            const db = getDatabase();

            await update(
                ref(
                    db,
                    `companys/${company.handle}/products/${updatedProduct.id}`
                ),
                updatedProduct
            );

            setIsManagementModalOpen(false);

            openToast(
                "success",
                "Produto atualizado",
                "As alterações foram salvas com sucesso."
            );

            return true;

        } catch (err) {

            openToast(
                "error",
                "Erro",
                "Não foi possível salvar o produto."
            );

            return false;

        }

    };

    return (
        <div className="adm_products-page">

            <header className="adm_products-header">

                <div className="adm_products-header-main">

                    {/* TÍTULO */}
                    <div className="adm_products-header-title">

                        <span className="adm_products-eyebrow">
                            Gestão
                        </span>

                        <h1>
                            Meus Produtos
                        </h1>

                        <p>
                            Cadastre, organize e gerencie todos os
                            produtos da sua empresa.
                        </p>

                    </div>


                    {/* RESUMO */}
                    <div className="adm_products-header-summary">

                        <div className="adm_products-summary-item">

                            <span>
                                Total
                            </span>

                            <strong>
                                {products.length}
                            </strong>

                        </div>


                        <div className="adm_products-summary-divider" />


                        <div className="adm_products-summary-item">

                            <span>
                                Ativos
                            </span>

                            <strong>
                                {
                                    products.filter(
                                        product => product.status === "ativos"
                                    ).length
                                }
                            </strong>

                        </div>


                        <div className="adm_products-summary-divider" />


                        <div className="adm_products-summary-item">

                            <span>
                                Arquivados
                            </span>

                            <strong>
                                {
                                    products.filter(
                                        product => product.status === "arquivados"
                                    ).length
                                }
                            </strong>

                        </div>

                    </div>

                </div>


                {/* STATUS */}
                <div className="adm_products-status-section">

                    <div className="adm_products-status-tabs">

                        <button
                            className={activeTab === "ativos" ? "active" : ""}
                            onClick={() => setActiveTab("ativos")}
                        >

                            <Icon icon="mdi:check-circle-outline" />

                            <span>
                                Ativos
                            </span>

                            <strong>
                                {
                                    products.filter(
                                        product => product.status === "ativos"
                                    ).length
                                }
                            </strong>

                        </button>


                        <button
                            className={activeTab === "arquivados" ? "active" : ""}
                            onClick={() => setActiveTab("arquivados")}
                        >

                            <Icon icon="mdi:archive-outline" />

                            <span>
                                Arquivados
                            </span>

                            <strong>
                                {
                                    products.filter(
                                        product => product.status === "arquivados"
                                    ).length
                                }
                            </strong>

                        </button>

                    </div>


                    {/* TIPO DE OFERTA */}

                    <div className="adm_products-type-tabs">

                        {TYPE_OPTIONS.map((option) => {

                            const count =
                                products.filter(
                                    (product) =>
                                        product.status === activeTab &&
                                        matchesSelectedType(
                                            product,
                                            option.id
                                        )
                                ).length;

                            return (

                                <button
                                    key={option.id}
                                    type="button"
                                    className={
                                        selectedType === option.id
                                            ? "active"
                                            : ""
                                    }
                                    onClick={() =>
                                        setSelectedType(option.id)
                                    }
                                >

                                    <Icon icon={option.icon} />

                                    <span>
                                        {option.label}
                                    </span>

                                    <b>
                                        {count}
                                    </b>

                                </button>

                            );

                        })}

                    </div>

                </div>


                {/* AVISO DOS ARQUIVADOS */}
                {activeTab === "arquivados" && (

                    <div className="adm_products-archived-info">

                        <Icon icon="mdi:information-outline" />

                        <span>
                            Produtos arquivados são excluídos
                            automaticamente após 30 dias.
                        </span>

                    </div>

                )}

                {/* =================================================
    TOOLBAR
================================================= */}

                <section className="adm_products-toolbar">

                    <div className="adm_products-search">

                        <Icon
                            icon="lucide:search"
                            className="adm_products-search-icon"
                        />

                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) =>
                                setSearchTerm(e.target.value)
                            }
                            placeholder="Pesquisar produto, categoria ou ID..."
                        />

                        {searchTerm && (
                            <button
                                type="button"
                                className="adm_products-search-clear"
                                onClick={() =>
                                    setSearchTerm("")
                                }
                            >
                                <Icon icon="lucide:x" />
                            </button>
                        )}

                    </div>


                    <div className="adm_products-toolbar-actions">

                        <button
                            type="button"
                            className={`adm_products-toolbar-button ${activeFiltersCount > 0
                                ? "has-filter"
                                : ""
                                }`}
                            onClick={() => {
                                setTempCategory(selectedCategory);
                                setTempType(selectedType);
                                setIsFilterOpen(true);
                            }}
                        >
                            <Icon icon="lucide:filter" />

                            <span>
                                Filtrar
                            </span>

                            {activeFiltersCount > 0 && (
                                <b>
                                    {activeFiltersCount}
                                </b>
                            )}
                        </button>


                        <button
                            type="button"
                            className="adm_products-toolbar-button"
                            onClick={() => {
                                setTempSort(selectedSort);
                                setIsSortOpen(true);
                            }}
                        >
                            <Icon icon="lucide:arrow-up-down" />

                            <span>
                                Ordenar
                            </span>
                        </button>

                    </div>

                </section>


                {/* =================================================
    RESULTADO DA PESQUISA
================================================= */}

                <div className="adm_products-list-header">

                    <div>

                        <span>
                            {filteredProducts.length}
                        </span>

                        <p>
                            {filteredProducts.length === 1
                                ? "produto encontrado"
                                : "produtos encontrados"}
                        </p>

                    </div>

                    <span className="adm_products-current-sort">

                        <Icon icon="lucide:arrow-up-down" />

                        Ordenado por

                        {" "}

                        <b>
                            {sortOptions.find(
                                option =>
                                    option.id === selectedSort
                            )?.label}
                        </b>

                    </span>

                </div>


                {/* =================================================
    FILTER CHIPS
================================================= */}

                {activeFiltersCount > 0 && (
                    <div className="adm_products-filter-chips">

                        {selectedType !== "all" && (
                            <button
                                type="button"
                                className="adm_products-filter-chip"
                                onClick={() =>
                                    setSelectedType("all")
                                }
                            >

                                <span>
                                    {
                                        TYPE_OPTIONS.find(
                                            option =>
                                                option.id === selectedType
                                        )?.label
                                    }
                                </span>

                                <Icon icon="lucide:x" />

                            </button>
                        )}

                        {selectedCategory !== "all" && (
                            <button
                                type="button"
                                className="adm_products-filter-chip"
                                onClick={() =>
                                    setSelectedCategory("all")
                                }
                            >

                                <span>
                                    {selectedCategory}
                                </span>

                                <Icon icon="lucide:x" />

                            </button>
                        )}

                    </div>
                )}

            </header>

            <div className="adm_products-new-product-content-actions">
                <button
                    className="adm_products-new-product-btn"
                    onClick={openCreation}
                >
                    Cadastrar Novo Produto
                </button>

                {/* Criar combo fica ao lado, e não dentro do
                    cadastro: não é um tipo de produto novo para
                    preencher do zero, é juntar o que já existe. */}
                <button
                    className="adm_products-combo-btn"
                    onClick={() => hasRoomForProduct() && setIsComboModalOpen(true)}
                >
                    <Icon icon="lucide:layers" />
                    Criar combo
                </button>
            </div>


            <ComboBuilderModal
                open={isComboModalOpen}
                onClose={() => setIsComboModalOpen(false)}
                products={products}
                getProductImages={(product) => comboImages[product?.id]}
                onCreate={handleCreateCombo}
                creating={creatingCombo}
            />

            <div className="adm_products-list">{loading ? (
                <div className="adm_products-loading">
                    <p>Carregando produtos...</p>
                </div>
            ) : filteredProducts.length > 0 ? (
                filteredProducts.map((product) => (
                    <div
                        key={product.id}
                        className={`adm_products-card ${isSubscriptionProduct(product)
                            ? "is-subscription"
                            : ""
                            }`}
                    >
                        <div className="adm_products-card-top-info">
                            <div
                                className="adm_products-image-wrapper"
                                onClick={() => {

                                    if (
                                        product.storageImages &&
                                        product.storageImages.length > 0
                                    ) {

                                        openProductsGallery(
                                            product.storageImages
                                        );

                                    }

                                }}
                            >

                                <img
                                    src={product.storageImage || Thumb1}
                                    alt={product.name || "Produto"}
                                    onError={(e) => {
                                        e.currentTarget.onerror = null;
                                        e.currentTarget.src = Thumb1;
                                    }}
                                    className="adm_products-main-image"
                                />

                                {/* =====================================================
        INDICADOR DE GALERIA
    ===================================================== */}

                                {product.storageImages?.length > 0 && (

                                    <div className="adm_products-image-hover">

                                        <Icon
                                            icon="mdi:image-multiple"
                                            className="adm_products-hover-icon"
                                        />

                                        <span>

                                            Ver{" "}

                                            {
                                                product.storageImages.length
                                            }

                                            {" "}

                                            foto
                                            {
                                                product.storageImages.length > 1
                                                    ? "s"
                                                    : ""
                                            }

                                        </span>

                                    </div>

                                )}

                            </div>

                            <div className="adm_products-card-content">

                                {isSubscriptionProduct(product) && (

                                    <span className="adm_products-card-subscription-tag">

                                        <Icon icon="solar:refresh-circle-linear" />

                                        Mensalidade

                                        {" • "}

                                        {
                                            normalizeMonthlyPlan(product)
                                                ?.billingCycleLabel
                                        }

                                    </span>

                                )}

                                <h2 className="adm_products-card-name" title={product.name}>
                                    {product.name}
                                </h2>
                                <div
                                    className="adm_products-card-description"
                                    title={product.description?.replace(/<[^>]*>/g, "")}
                                    dangerouslySetInnerHTML={formatProductDescription(product.description)}
                                />
                            </div>
                        </div>

                        <div className="adm_products-card-bottom-info">
                            <div className="adm_products-card-bottom-info-content-item">
                                <p>Id Prod.</p>
                                <h1>#{product.id}</h1>
                            </div>
                            <div className="adm_products-card-bottom-info-content-item">
                                <p>
                                    {isSubscriptionProduct(product)
                                        ? "Mensalidade"
                                        : "Valor"}
                                </p>
                                <h1>
                                    {product.value}

                                    {isSubscriptionProduct(product) && (
                                        <em className="adm_products-card-cycle">
                                            {getPlanPriceSuffix(
                                                normalizeMonthlyPlan(product)
                                            )}
                                        </em>
                                    )}
                                </h1>
                            </div>
                            <div className="adm_products-card-bottom-info-content-item">
                                <p>Total de Pedidos</p>
                                <h1>{product.orders}</h1>
                            </div>
                        </div>

                        <div className="adm_products-card-actions">
                            <button
                                className="adm_products-btn delete-btn"
                                onClick={() => handleArchiveProduct(product)}
                            >
                                {product.status === "ativos"
                                    ? "Arquivar"
                                    : "Restaurar"}
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
                <p>Nenhum produto encontrado, <span onClick={openCreation}>crie um novo produto!</span> </p>
            )}
            </div>

            <Modal
                open={isSortOpen}
                onClose={() =>
                            setIsSortOpen(false)}
                overlayClassName="adm_products-modal-overlay"
                className="adm_products-sort-modal"
            >

                            <div className="adm_products-modal-header">

                                <div>

                                    <span>
                                        Preferência
                                    </span>

                                    <h2>
                                        Ordenar produtos
                                    </h2>

                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setIsSortOpen(false)
                                    }
                                >
                                    <Icon
                                        icon="lucide:x"
                                    />
                                </button>

                            </div>


                            {/* OPÇÕES */}

                            <div className="adm_products-sort-options">

                                {sortOptions.map(
                                    (option) => (

                                        <button
                                            key={option.id}

                                            type="button"

                                            className={
                                                tempSort === option.id
                                                    ? "active"
                                                    : ""
                                            }

                                            onClick={() =>
                                                setTempSort(
                                                    option.id
                                                )
                                            }
                                        >

                                            <span>
                                                {option.label}
                                            </span>

                                            {tempSort === option.id && (
                                                <Icon
                                                    icon="lucide:check"
                                                />
                                            )}

                                        </button>

                                    )
                                )}

                            </div>


                            {/* FOOTER */}

                            <div className="adm_products-modal-footer">

                                <button
                                    type="button"
                                    className="adm_products-modal-secondary"
                                    onClick={() =>
                                        setTempSort("nameAsc")
                                    }
                                >
                                    Padrão
                                </button>

                                <button
                                    type="button"
                                    className="adm_products-modal-primary"
                                    onClick={() => {

                                        setSelectedSort(
                                            tempSort
                                        );

                                        setIsSortOpen(
                                            false
                                        );

                                    }}
                                >
                                    Aplicar
                                </button>

                            </div>

                        </Modal>

            <Modal
                open={isFilterOpen}
                onClose={() =>
                            setIsFilterOpen(false)}
                overlayClassName="adm_products-modal-overlay"
                className="adm_products-filter-modal"
            >

                            {/* HEADER */}

                            <div className="adm_products-modal-header">

                                <div>

                                    <span>
                                        Refinar resultados
                                    </span>

                                    <h2>
                                        Filtrar produtos
                                    </h2>

                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        setIsFilterOpen(false)
                                    }
                                >
                                    <Icon
                                        icon="lucide:x"
                                    />
                                </button>

                            </div>


                            {/* CONTENT */}

                            <div className="adm_products-filter-modal-content">

                                <section className="adm_products-filter-block">

                                    <div className="adm_products-filter-block-header">

                                        <h3>
                                            Tipo de oferta
                                        </h3>

                                        <span>
                                            Separe produtos avulsos de mensalidades
                                        </span>

                                    </div>


                                    <div className="adm_products-filter-selection-list">

                                        {TYPE_OPTIONS.map((option) => (

                                            <button
                                                key={option.id}
                                                type="button"

                                                className={
                                                    tempType === option.id
                                                        ? "active"
                                                        : ""
                                                }

                                                onClick={() =>
                                                    setTempType(option.id)
                                                }
                                            >

                                                <span>
                                                    <Icon
                                                        icon={option.icon}
                                                        className="adm_products-filter-option-icon"
                                                    />

                                                    {option.id === "all"
                                                        ? "Todos os tipos"
                                                        : option.label}
                                                </span>

                                                {tempType === option.id && (

                                                    <Icon
                                                        icon="lucide:check"
                                                    />

                                                )}

                                            </button>

                                        ))}

                                    </div>

                                </section>


                                <section className="adm_products-filter-block">

                                    <div className="adm_products-filter-block-header">

                                        <h3>
                                            Categoria
                                        </h3>

                                        <span>
                                            Selecione uma categoria
                                        </span>

                                    </div>


                                    <div className="adm_products-filter-selection-list">

                                        <button
                                            type="button"
                                            className={
                                                tempCategory === "all"
                                                    ? "active"
                                                    : ""
                                            }
                                            onClick={() =>
                                                setTempCategory("all")
                                            }
                                        >

                                            <span>
                                                Todas as categorias
                                            </span>

                                            {tempCategory === "all" && (

                                                <Icon
                                                    icon="lucide:check"
                                                />

                                            )}

                                        </button>


                                        {productCategories.map(
                                            (category) => (

                                                <button
                                                    key={category}
                                                    type="button"

                                                    className={
                                                        tempCategory === category
                                                            ? "active"
                                                            : ""
                                                    }

                                                    onClick={() =>
                                                        setTempCategory(
                                                            category
                                                        )
                                                    }
                                                >

                                                    <span>
                                                        {category}
                                                    </span>

                                                    {tempCategory === category && (

                                                        <Icon
                                                            icon="lucide:check"
                                                        />

                                                    )}

                                                </button>

                                            )
                                        )}

                                        {productCategories.length === 0 && (

                                            <p className="adm_products-filter-empty">
                                                Nenhuma categoria encontrada.
                                            </p>

                                        )}

                                    </div>

                                </section>

                            </div>


                            {/* FOOTER */}

                            <div className="adm_products-modal-footer">

                                <button
                                    type="button"
                                    className="adm_products-modal-secondary"
                                    onClick={() => {

                                        setTempCategory("all");
                                        setTempType("all");

                                        setSelectedCategory("all");
                                        setSelectedType("all");

                                    }}
                                >
                                    Limpar
                                </button>


                                <button
                                    type="button"
                                    className="adm_products-modal-primary"
                                    onClick={() => {

                                        setSelectedCategory(
                                            tempCategory
                                        );

                                        setSelectedType(
                                            tempType
                                        );

                                        setIsFilterOpen(
                                            false
                                        );

                                    }}
                                >
                                    Aplicar filtros
                                </button>

                            </div>

                        </Modal>

            {isManagementModalOpen && selectedProduct && (
                <ProductManagementSlider
                    product={selectedProduct}
                    onClose={() => setIsManagementModalOpen(false)}
                    onSave={handleSaveProduct}
                />
            )}

            {isProductsGalleryOpen && (

                <div
                    className="adm_products-gallery-overlay"
                    onClick={closeProductsGallery}
                >

                    <div
                        className="adm_products-gallery-container"
                        onClick={(e) =>
                            e.stopPropagation()
                        }
                    >

                        <button
                            className="adm_products-gallery-close"
                            onClick={closeProductsGallery}
                        >
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
                                src={
                                    galleryImages[
                                    currentGalleryImageIndex
                                    ]
                                }

                                alt={
                                    `Produto ${currentGalleryImageIndex + 1
                                    }`
                                }

                                className="adm_products-gallery-image"

                                onError={(e) => {

                                    e.currentTarget.onerror =
                                        null;

                                    e.currentTarget.src =
                                        Thumb1;

                                }}
                            />


                            <button
                                className="adm_products-gallery-arrow adm_products-gallery-next"
                                onClick={goToGalleryNextImage}
                            >
                                <Icon icon="mdi:chevron-right" />
                            </button>

                        </div>


                        <div className="adm_products-gallery-thumbnails">

                            {galleryImages.map(
                                (img, index) => (

                                    <img
                                        key={index}

                                        src={img}

                                        alt={
                                            `Miniatura ${index + 1
                                            }`
                                        }

                                        className={`
                                adm_products-gallery-thumb
                                ${index ===
                                                currentGalleryImageIndex
                                                ? "is-active"
                                                : ""
                                            }
                            `}

                                        onClick={() =>
                                            setCurrentGalleryImageIndex(
                                                index
                                            )
                                        }

                                        onError={(e) => {

                                            e.currentTarget.onerror =
                                                null;

                                            e.currentTarget.src =
                                                Thumb1;

                                        }}

                                    />

                                )
                            )}

                        </div>

                    </div>

                </div>

            )}

            <ProductCreationModal
                isOpen={isModalOpen}
                isClosing={isClosing}
                closeModal={closeModal}
                wizard={{
                    DESCRIPTION_MAX_LENGTH,
                    DURATION_MAX_MINUTES,
                    activeFeeTab,
                    autoRenew,
                    billingCycle,
                    bookingAdvanceDays,
                    bookingAdvanceHours,
                    bookingAdvanceMinutes,
                    calculateDiscount,
                    cancellationAdvanceDays,
                    cancellationAdvanceHours,
                    cancellationAdvanceMinutes,
                    capitalizeFirst,
                    carouselItems,
                    closeBookingAdvanceModal,
                    closeCancellationAdvanceModal,
                    closeConfirmationModal,
                    closeDynamicPriceModal,
                    closeExtraFeeModal,
                    currency,
                    currencyPromo,
                    customCategorys,
                    defaultCategorys,
                    descriptionEditorRef,
                    descriptionLength,
                    duration,
                    execDescriptionCommand,
                    handleAddCategory,
                    handleAddServiceFee,
                    handleAddTimeFee,
                    handleAddTimeSlot,
                    handleAdminClick,
                    handleButtonSelect,
                    handleCancellationDaysChange,
                    handleCancellationHoursChange,
                    handleCancellationMinutesChange,
                    handleCloseOther,
                    handleConfirmation,
                    handleContinue,
                    handleCurrencyChange,
                    handleCurrencyPromoChange,
                    handleDaysChange,
                    handleDescriptionInput,
                    handleDurationChange,
                    handleHoursChange,
                    handleImageUpload,
                    handleItemClick,
                    handleMinutesChange,
                    handlePriceChange,
                    handlePriceFromChange,
                    handlePriceToChange,
                    handleRemoveCategory,
                    handleRemoveItem,
                    handleRemoveServiceFee,
                    handleRemoveTimeFee,
                    handleRemoveTimeSlot,
                    handleSaveDynamicPrices,
                    handleSaveExtraFees,
                    handleServiceFeeChange,
                    handleTimeFeeChange,
                    handleTimeSlotChange,
                    isAddingProduct,
                    isAnimating,
                    isBookingAdvanceModalClosing,
                    isBookingAdvanceModalOpen,
                    isCancellationAdvanceModalClosing,
                    isCancellationAdvanceModalOpen,
                    isConfirmationModalClosing,
                    isConfirmationModalOpen,
                    isDynamicPriceModalClosing,
                    isDynamicPriceModalOpen,
                    isExtraFeeModalClosing,
                    isExtraFeeModalOpen,
                    isFading,
                    isInputFilled,
                    isOtherSelected,
                    isPrivate,
                    loyaltyMonths,
                    members,
                    newCategory,
                    nextStep,
                    normalizeTimeInput,
                    notificationsEnabled,
                    openBookingAdvanceModal,
                    openCancellationAdvanceModal,
                    openDynamicPriceModal,
                    openExtraFeeModal,
                    prepaymentRequired,
                    prevStep,
                    price,
                    priceFrom,
                    priceTo,
                    productName,
                    productType,
                    reschedulingAllowed,
                    selectedAdmins,
                    selectedDay,
                    selectedFeeDay,
                    selectedItems,
                    serviceFees,
                    sessionsPerCycle,
                    setActiveFeeTab,
                    setAutoRenew,
                    setBillingCycle,
                    setCurrencyPromo,
                    setIsPrivate,
                    setLoyaltyMonths,
                    setNewCategory,
                    setNotificationsEnabled,
                    setPrepaymentRequired,
                    setProductInfo,
                    setProductName,
                    setProductType,
                    setReschedulingAllowed,
                    setSelectedDay,
                    setSelectedFeeDay,
                    setSessionsPerCycle,
                    setSubscriptionCancellationNoticeDays,
                    setTrialDays,
                    setUnlimitedSessions,
                    step,
                    stepDirection,
                    subscriptionCancellationNoticeDays,
                    timeFees,
                    timeSlots,
                    trialDays,
                    unlimitedSessions,
                }}
            />
            <Toast
                show={showToast}
                type={toastType}
                title={toastTitle}
                message={toastMessage}
                onClose={() => setShowToast(false)}
            />
        </div >
    );
};

export default Products;
