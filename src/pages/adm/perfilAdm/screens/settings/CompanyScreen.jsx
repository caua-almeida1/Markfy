import { useState, useEffect } from "react";
import { useUserCompany } from "../../../../../contexts/companyContext/UserCompanyContext";
import { Icon } from "@iconify/react"
import Toast from "../../../../../components/toast/Toast";

import { getDatabase, ref, update, get } from "firebase/database";

import {
    updateCompanyIndex,
    getDocumentOwner,
    setDocumentOwner
} from "../../../../../firebase/companiesIndex";


const COMPANY_CATEGORIES = [
    { id: 'barbearia', name: 'Barbearia', icon: 'solar:scissors-outline' },
    { id: 'salao-beleza', name: 'Salão de beleza', icon: 'solar:mirror-outline' },
    { id: 'cabeleireiro', name: 'Cabeleireiro', icon: 'solar:scissors-outline' },
    { id: 'manicure-pedicure', name: 'Manicure e pedicure', icon: 'solar:hand-stars-outline' },
    { id: 'sobrancelhas', name: 'Design de sobrancelhas', icon: 'solar:eye-outline' },
    { id: 'cilios', name: 'Extensão de cílios', icon: 'solar:eye-scan-outline' },
    { id: 'maquiagem', name: 'Maquiagem', icon: 'solar:palette-outline' },
    { id: 'tatuagem', name: 'Estúdio de tatuagem', icon: 'solar:pen-new-square-outline' },
    { id: 'fotografia', name: 'Estúdio de fotografia', icon: 'solar:camera-outline' },
    { id: 'estetica', name: 'Clínica de estética', icon: 'solar:heart-pulse-outline' },
    { id: 'massoterapia', name: 'Massoterapia', icon: 'solar:hand-heart-outline' },
    { id: 'spa', name: 'Spa e bem-estar', icon: 'solar:leaf-outline' },
    { id: 'odontologia', name: 'Clínica odontológica', icon: 'solar:medical-kit-outline' },
    { id: 'medicina', name: 'Consultório médico', icon: 'solar:stethoscope-outline' },
    { id: 'fisioterapia', name: 'Fisioterapia', icon: 'solar:health-outline' },
    { id: 'nutricao', name: 'Nutrição', icon: 'solar:chef-hat-outline' },
    { id: 'psicologia', name: 'Psicologia', icon: 'solar:brain-outline' },
    { id: 'personal-trainer', name: 'Personal trainer', icon: 'solar:running-outline' },
    { id: 'academia', name: 'Academia', icon: 'solar:dumbbell-outline' },
    { id: 'pilates', name: 'Pilates', icon: 'solar:body-outline' },
    { id: 'yoga', name: 'Yoga', icon: 'solar:meditation-outline' },
    { id: 'pet-shop', name: 'Pet shop', icon: 'solar:cat-outline' },
    { id: 'banho-tosa', name: 'Banho e tosa', icon: 'solar:scissors-square-outline' },
    { id: 'eventos', name: 'Fotografia e eventos', icon: 'solar:gallery-outline' },
    { id: 'design', name: 'Agência de design', icon: 'solar:pen-2-outline' },
    { id: 'marketing', name: 'Marketing e publicidade', icon: 'solar:graph-up-outline' },
    { id: 'tecnologia', name: 'Tecnologia e desenvolvimento', icon: 'solar:code-outline' },
    { id: 'consultoria', name: 'Consultoria', icon: 'solar:case-outline' },
    { id: 'educacao', name: 'Educação e cursos', icon: 'solar:book-2-outline' },
    { id: 'automotivo', name: 'Serviços automotivos', icon: 'solar:wheel-outline' }
];

const CompanyScreen = () => {

    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState("success");
    const [toastTitle, setToastTitle] = useState("");
    const [toastMessage, setToastMessage] = useState("");

    const { company } = useUserCompany();
    const MAX_DESCRIPTION = 300;
    const [showCategoriesModal, setShowCategoriesModal] = useState(false);

    const [form, setForm] = useState({
        name: "",
        handle: "",
        document: "",
        email: "",
        description: "",
        categories: []
    });

    useEffect(() => {

        if (!company) return;

        const data = {
            name: company.name || "",
            handle: company.handle || "",
            document: company.document || "",
            email: company.email || "",
            description: company.description || "",
            categories: Array.isArray(company.categories)
                ? company.categories
                : company.category
                    ? [company.category]
                    : []
        };

        setForm(data);
        setInitialForm(data);

    }, [company]);

    const openToast = (type, title, message) => {

        setToastType(type);
        setToastTitle(title);
        setToastMessage(message);
        setShowToast(true);

    };

    const handleChange = (e) => {

        let { name, value } = e.target;

        if (name === "document") {

            value = value.replace(/\D/g, "");

            if (value.length > 14) {
                value = value.slice(0, 14);
            }

        }

        setForm(prev => ({
            ...prev,
            [name]: value
        }));

    };

    const [initialForm, setInitialForm] = useState({
        name: "",
        handle: "",
        document: "",
        email: "",
        description: "",
        categories: []
    });

    const isValidCpfOrCnpj = (value) => {

        const numbers = value.replace(/\D/g, "");

        const isRepeated = (str) => /^(\d)\1+$/.test(str);

        const validateCPF = (cpf) => {

            if (cpf.length !== 11 || isRepeated(cpf)) return false;

            let sum = 0;

            for (let i = 0; i < 9; i++) {
                sum += Number(cpf[i]) * (10 - i);
            }

            let digit = (sum * 10) % 11;

            if (digit === 10) digit = 0;

            if (digit !== Number(cpf[9])) return false;

            sum = 0;

            for (let i = 0; i < 10; i++) {
                sum += Number(cpf[i]) * (11 - i);
            }

            digit = (sum * 10) % 11;

            if (digit === 10) digit = 0;

            return digit === Number(cpf[10]);

        };

        const validateCNPJ = (cnpj) => {

            if (cnpj.length !== 14 || isRepeated(cnpj)) return false;

            const calc = (length) => {

                let size = length - 7;

                let sum = 0;

                let pos = length - 7;

                for (let i = length; i >= 1; i--) {

                    sum += Number(cnpj[length - i]) * pos--;

                    if (pos < 2) pos = 9;

                }

                const result = sum % 11 < 2 ? 0 : 11 - sum % 11;

                return result;

            };

            return calc(12) === Number(cnpj[12]) &&
                calc(13) === Number(cnpj[13]);

        };

        return validateCPF(numbers) || validateCNPJ(numbers);

    };
    const hasChanges =
        JSON.stringify(form) !== JSON.stringify(initialForm);

    const canSave = hasChanges;

    const handleCategoryToggle = (categoryId) => {

        setForm(prev => {

            const categories = Array.isArray(prev.categories)
                ? prev.categories
                : [];

            if (categories.includes(categoryId)) {

                return {
                    ...prev,
                    categories: categories.filter(
                        id => id !== categoryId
                    )
                };

            }

            if (categories.length >= 3) {
                return prev;
            }

            return {
                ...prev,
                categories: [
                    ...categories,
                    categoryId
                ]
            };

        });

    };

    const handleSave = async () => {

        if (!form.name.trim()) {
            return openToast(
                "error",
                "Nome obrigatório",
                "Informe o nome da empresa."
            );
        }

        if (!form.handle.trim()) {
            return openToast(
                "error",
                "Handle obrigatório",
                "Informe o @ da empresa."
            );
        }

        if (!form.email.trim()) {
            return openToast(
                "error",
                "E-mail obrigatório",
                "Informe um e-mail válido."
            );
        }

        if (!isValidCpfOrCnpj(form.document)) {
            return openToast(
                "error",
                "Documento inválido",
                "Informe um CPF ou CNPJ válido."
            );
        }

        try {

            const db = getDatabase();

            /*
             * ==========================================
             * NORMALIZAÇÃO
             * ==========================================
             */

            const currentHandle =
                company.handle
                    .trim()
                    .toLowerCase();

            const newHandle =
                form.handle
                    .trim()
                    .replace(/^@+/, "")
                    .toLowerCase();

            const newDocument =
                form.document.replace(/\D/g, "");

            const currentDocument =
                String(company.document || "")
                    .replace(/\D/g, "");
            /*
             * ==========================================
             * VERIFICAR CONFLITOS
             * ==========================================
             *
             * Consultas pontuais nos índices.
             *
             * Ler o nó "companys" inteiro aqui baixava
             * produtos, agendamentos e pedidos de todas
             * as empresas só para comparar dois campos.
             * ==========================================
             */

            let handleAlreadyExists = false;
            let documentAlreadyExists = false;


            /*
             * ==============================
             * HANDLE
             * ==============================
             */

            if (newHandle !== currentHandle) {

                const handleSnapshot =
                    await get(
                        ref(db, `companiesIndex/${newHandle}`),
                    );

                handleAlreadyExists =
                    handleSnapshot.exists();

            }


            /*
             * ==============================
             * DOCUMENTO
             * ==============================
             */

            if (
                !handleAlreadyExists &&
                newDocument &&
                newDocument !== currentDocument
            ) {

                const documentOwner =
                    await getDocumentOwner(newDocument);

                documentAlreadyExists =
                    Boolean(documentOwner) &&
                    String(documentOwner)
                        .trim()
                        .replace(/^@+/, "")
                        .toLowerCase() !== currentHandle;

            }


            /*
             * ==========================================
             * HANDLE DUPLICADO
             * ==========================================
             */

            if (handleAlreadyExists) {

                return openToast(
                    "error",
                    "Handle já utilizado",
                    "Este @ já está sendo utilizado por outra empresa."
                );

            }


            /*
             * ==========================================
             * DOCUMENTO DUPLICADO
             * ==========================================
             */

            if (documentAlreadyExists) {

                return openToast(
                    "error",
                    "Documento já cadastrado",
                    "Este CPF ou CNPJ já está cadastrado em outra empresa."
                );

            }


            /*
             * ==========================================
             * SALVAR
             * ==========================================
             */

            await update(
                ref(
                    db,
                    `companys/${company.handle}`,
                ),
                {
                    name:
                        form.name.trim(),

                    handle:
                        newHandle,

                    document:
                        newDocument,

                    email:
                        form.email.trim(),

                    description:
                        form.description.trim(),

                    categories:
                        Array.isArray(form.categories)
                            ? form.categories
                            : [],
                },
            );


            /*
             * ==========================================
             * ÍNDICES
             * ==========================================
             *
             * O índice público não recebe document, email
             * nem phone.
             * ==========================================
             */

            const categories =
                Array.isArray(form.categories)
                    ? form.categories
                    : [];

            await updateCompanyIndex(
                company.handle,
                {

                    handle:
                        newHandle,

                    name:
                        form.name.trim(),

                    description:
                        form.description.trim(),

                    category:
                        categories[0] || null,

                    categories:
                        categories.length
                            ? categories
                            : null,

                },
            );


            await setDocumentOwner(
                newDocument,
                company.handle,
                currentDocument,
            );


            /*
             * ==========================================
             * ATUALIZAR ESTADO
             * ==========================================
             */

            const updatedForm = {

                ...form,

                handle: newHandle,
                document: newDocument,

            };

            setForm(updatedForm);
            setInitialForm(updatedForm);


            /*
             * ==========================================
             * SUCESSO
             * ==========================================
             */

            openToast(
                "success",
                "Sucesso",
                "Alterações salvas com sucesso."
            );

        } catch (err) {

            console.error(
                "Erro ao salvar empresa:",
                err,
            );

            openToast(
                "error",
                "Erro",
                "Não foi possível salvar as alterações."
            );

        }

    };

    return (

        <div className="company-screen">

            <div className="company-card">

                <div className="company-input-group">

                    <Icon
                        icon="solar:buildings-2-outline"
                        className="company-input-icon"
                    />

                    <input
                        className="company-input"
                        type="text"
                        name="name"
                        placeholder="Nome da empresa"
                        value={form.name}
                        onChange={handleChange}
                    />

                </div>

                <div className="company-input-group">

                    <Icon
                        icon="lucide:at-sign"
                        className="company-input-icon"
                    />

                    <input
                        className="company-input"
                        type="text"
                        name="handle"
                        placeholder="@empresa"
                        value={form.handle}
                        onChange={handleChange}
                    />

                </div>

                <div className="company-input-group">

                    <Icon
                        icon="solar:document-text-outline"
                        className="company-input-icon"
                    />

                    <input
                        className="company-input"
                        type="text"
                        name="document"
                        placeholder="Documento"
                        value={form.document}
                        onChange={handleChange}
                    />

                </div>

                <div className="company-input-group">

                    <Icon
                        icon="solar:letter-outline"
                        className="company-input-icon"
                    />

                    <input
                        className="company-input"
                        type="email"
                        name="email"
                        placeholder="E-mail"
                        value={form.email}
                        onChange={handleChange}
                    />

                </div>

                <div className="company-input-group textarea">

                    <Icon
                        icon="solar:document-add-outline"
                        className="company-input-icon"
                    />

                    <textarea
                        className="company-textarea"
                        name="description"
                        maxLength={MAX_DESCRIPTION}
                        placeholder="Descrição"
                        value={form.description}
                        onChange={handleChange}
                    />
                    <div className="company-counter">

                        {form.description.length}/{MAX_DESCRIPTION}

                    </div>
                </div>
                {/* ================= CATEGORIAS ================= */}

                <div className="company-categories">

                    <div className="company-categories-header">

                        <div className="company-categories-title">

                            <div className="company-categories-icon">
                                <Icon icon="solar:widget-5-outline" />
                            </div>

                            <div className="company-categories-info">

                                <strong>
                                    Categorias
                                </strong>

                                <span>
                                    Até 3 categorias
                                </span>

                            </div>

                        </div>

                        <button
                            type="button"
                            className="company-categories-edit"
                            onClick={() => setShowCategoriesModal(true)}
                        >
                            <Icon icon="solar:pen-outline" />
                            Alterar
                        </button>

                    </div>


                    <div className="company-categories-list">

                        {form.categories?.length > 0 ? (

                            form.categories.map(categoryId => {

                                const category =
                                    COMPANY_CATEGORIES.find(
                                        item => item.id === categoryId
                                    );

                                if (!category) return null;

                                return (
                                    <div
                                        key={category.id}
                                        className="company-category-tag"
                                    >
                                        <Icon icon={category.icon} />

                                        <span>
                                            {category.name}
                                        </span>
                                    </div>
                                );

                            })

                        ) : (

                            <span className="company-category-empty">
                                Nenhuma categoria selecionada
                            </span>

                        )}

                    </div>

                </div>
            </div>

            <button
                disabled={!canSave}
                onClick={handleSave}
                className={`company-save ${!canSave ? "disabled" : ""}`}
            >
                Salvar alterações
            </button>

            {/* ================= MODAL CATEGORIAS ================= */}

            {showCategoriesModal && (

                <div className="company-category-modal">

                    <div
                        className="company-category-modal-backdrop"
                        onClick={() => setShowCategoriesModal(false)}
                    />

                    <div className="company-category-modal-content">

                        <div className="company-category-modal-header">

                            <div className="company-category-modal-header-content">

                                <small>
                                    CATEGORIAS
                                </small>

                                <h2>
                                    Categorias da empresa
                                </h2>

                                <p>
                                    Selecione até 3 categorias.
                                </p>

                            </div>

                            <button
                                type="button"
                                className="company-category-modal-close"
                                onClick={() => setShowCategoriesModal(false)}
                            >
                                <Icon icon="solar:close-circle-outline" />
                            </button>

                        </div>


                        <div className="company-category-modal-counter">

                            <strong>
                                {form.categories?.length || 0}/3 selecionadas
                            </strong>

                            <span>
                                Escolha as que melhor representam seu negócio.
                            </span>

                        </div>


                        <div className="company-category-modal-grid">

                            {COMPANY_CATEGORIES.map(category => {

                                const isSelected =
                                    form.categories?.includes(category.id);

                                return (

                                    <button
                                        key={category.id}
                                        type="button"
                                        className={`company-category-option ${isSelected ? "selected" : ""
                                            }`}
                                        onClick={() =>
                                            handleCategoryToggle(category.id)
                                        }
                                    >

                                        <div className="company-category-option-icon">

                                            <Icon icon={category.icon} />

                                        </div>

                                        <span>
                                            {category.name}
                                        </span>

                                        {isSelected && (

                                            <div className="company-category-option-check">

                                                <Icon
                                                    icon="solar:check-circle-bold"
                                                />

                                            </div>

                                        )}

                                    </button>

                                );

                            })}

                        </div>


                        <div className="company-category-modal-footer">

                            <button
                                type="button"
                                className="company-category-modal-confirm"
                                onClick={() => setShowCategoriesModal(false)}
                            >
                                Concluir
                            </button>

                        </div>

                    </div>

                </div>

            )}
            <Toast

                show={showToast}

                type={toastType}

                title={toastTitle}

                message={toastMessage}

                onClose={() => setShowToast(false)}

            />
        </div>
    );

};

export default CompanyScreen;