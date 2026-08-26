import { useState, useEffect } from "react";
import { useUserCompany } from "../../../../../contexts/companyContext/UserCompanyContext";
import { Icon } from "@iconify/react"
import Toast from "../../../../../components/toast/Toast";

import { getDatabase, ref, update, get} from "firebase/database";

const CompanyScreen = () => {

    const [showToast, setShowToast] = useState(false);
    const [toastType, setToastType] = useState("success");
    const [toastTitle, setToastTitle] = useState("");
    const [toastMessage, setToastMessage] = useState("");

    const { company } = useUserCompany();
    const MAX_DESCRIPTION = 300;

    const [form, setForm] = useState({
        name: "",
        handle: "",
        document: "",
        email: "",
        description: ""
    });

    useEffect(() => {

        if (!company) return;

        const data = {
            name: company.name || "",
            handle: company.handle || "",
            document: company.document || "",
            email: company.email || "",
            description: company.description || ""
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
        description: ""
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


            /*
             * ==========================================
             * BUSCAR TODAS AS EMPRESAS
             * ==========================================
             */

            const companiesSnapshot =
                await get(
                    ref(db, "companys"),
                );

            const companies =
                companiesSnapshot.exists()
                    ? companiesSnapshot.val()
                    : {};


            /*
             * ==========================================
             * VERIFICAR CONFLITOS
             * ==========================================
             */

            let handleAlreadyExists = false;
            let documentAlreadyExists = false;

            for (
                const [handle, companyData]
                of Object.entries(companies)
            ) {

                /*
                 * Ignora a própria empresa.
                 */

                const existingHandle =
                    String(handle)
                        .trim()
                        .replace(/^@+/, "")
                        .toLowerCase();

                if (
                    existingHandle === currentHandle
                ) {
                    continue;
                }


                /*
                 * ==============================
                 * HANDLE
                 * ==============================
                 */

                if (
                    existingHandle === newHandle
                ) {

                    handleAlreadyExists = true;

                    break;

                }


                /*
                 * ==============================
                 * DOCUMENTO
                 * ==============================
                 */

                const existingDocument =
                    String(
                        companyData?.document || "",
                    ).replace(/\D/g, "");

                if (
                    existingDocument &&
                    existingDocument === newDocument
                ) {

                    documentAlreadyExists = true;

                    break;

                }

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
                },
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

            </div>

            <button
                disabled={!canSave}
                onClick={handleSave}
                className={`company-save ${!canSave ? "disabled" : ""}`}
            >
                Salvar alterações
            </button>

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