import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { getAuth } from "firebase/auth";
import { getDatabase, ref, get } from "firebase/database";

/* CSS antigo: só pelas classes do recortador de logo
   (ImageCropper). O assistente usa o prefixo ncw-. */
import "./create-company.css";
import "./new-company.css";

import ImageCropper from "./utils/components/ImageCropper";
import { saveDraftImage, getDraftImage } from "./utils/companyDraft";
import CoachMarks from "./CoachMarks";
import { COMPANY_SEGMENTS, getSegment, searchSegments } from "./companySegments";
import {
    digits,
    formatDocument,
    formatPhone,
    formatZip,
    hasProblems,
    normalizeHandle,
    stepProblems,
    suggestHandle
} from "./companyValidation";
import { COMPANY_CATEGORIES } from "../../../../utils/companyCategories";

/* =========================================================
   CADASTRO DE EMPRESA — ASSISTENTE

   4 etapas, duas obrigatórias:
     0  Seu negócio   ramo (preenche sugestões), nome e @
     1  Contato       CPF/CNPJ, e-mail e telefone
     2  Identidade    logo, descrição, categorias   (pode pular)
     3  Endereço      CEP preenche o resto          (pode pular)
   e então a revisão (/newcompany/previewcompany/:id).

   Rascunho salvo a cada mudança (localStorage + logo no
   IndexedDB) e restaurado ao recarregar. Tutorial com
   destaque de cada campo na primeira vez; pode ser pulado e
   reaberto pelo botão de ajuda.
========================================================= */

export const draftKeyFor = (sessionId) => `markfy_create_company_draft_${sessionId}`;

const TOUR_KEY = "markfy-newcompany-tour";

export const EMPTY_COMPANY = {
    segment: "",
    name: "",
    handle: "",
    handleEdited: false,
    document: "",
    email: "",
    phone: "",
    description: "",
    categories: [],
    location: { zipCode: "", street: "", number: "", neighborhood: "", city: "", state: "", country: "Brasil" }
};

const STEPS = [
    { id: "negocio", title: "Seu negócio", hint: "O básico para a empresa existir na Markfy.", required: true },
    { id: "contato", title: "Contato", hint: "Como clientes e a Markfy falam com você.", required: true },
    { id: "identidade", title: "Identidade", hint: "Logo e apresentação. Dá para fazer depois.", required: false },
    { id: "endereco", title: "Endereço", hint: "Ajuda clientes por perto a encontrar você.", required: false }
];

const TOUR = [
    [
        { target: "ncw-segments", title: "Escolha o ramo", text: "Preenchemos categorias e uma descrição inicial para você. Tudo continua editável." },
        { target: "ncw-field-name", title: "Nome da empresa", text: "É o nome que aparece para os clientes na página e no Explorar." },
        { target: "ncw-field-handle", title: "O @ da empresa", text: "Vira o endereço da sua página (…/central-user/seu-arroba). Sugerimos um a partir do nome." }
    ],
    [
        { target: "ncw-field-document", title: "CPF ou CNPJ", text: "Usado só para identificar a empresa. Não aparece para os clientes." },
        { target: "ncw-field-email", title: "E-mail de contato", text: "Preenchemos com o e-mail da sua conta; troque se quiser outro." },
        { target: "ncw-field-phone", title: "Telefone ou WhatsApp", text: "Com DDD. Os clientes podem usar para falar com você." }
    ],
    [
        { target: "ncw-field-logo", title: "Logo (opcional)", text: "Uma imagem quadrada fica melhor. Você ajusta o enquadramento antes de salvar." },
        { target: "ncw-field-description", title: "Descrição", text: "Já veio uma sugestão do seu ramo. Conte em uma ou duas frases o que você faz." },
        { target: "ncw-field-categories", title: "Categorias", text: "É por elas que clientes filtram no Explorar. Marque todas que combinam." }
    ],
    [
        { target: "ncw-field-zip", title: "CEP", text: "Digite o CEP e completamos rua, bairro, cidade e estado." },
        { target: "ncw-use-location", title: "Ou use sua localização", text: "Se estiver no local da empresa, preenchemos pelo GPS do aparelho." }
    ]
];

const readTour = () => {
    try {
        return JSON.parse(localStorage.getItem(TOUR_KEY)) || {};
    } catch {
        return {};
    }
};

const writeTour = (value) => {
    try {
        localStorage.setItem(TOUR_KEY, JSON.stringify(value));
    } catch {
        /* sem armazenamento: o tutorial só volta a aparecer */
    }
};

const Field = ({ id, label, required, error, hint, children }) => (
    <div className={`ncw-field ${error ? "has-error" : ""}`} id={`ncw-field-${id}`}>
        <label htmlFor={`ncw-${id}`}>
            {label}
            {required ? <span className="ncw-req" aria-hidden="true">*</span> : <span className="ncw-opt">opcional</span>}
        </label>
        {children}
        {error
            ? <p className="ncw-error" id={`ncw-${id}-error`} role="alert">{error}</p>
            : hint ? <p className="ncw-hint">{hint}</p> : null}
    </div>
);

const CreateCompany = () => {

    const navigate = useNavigate();
    const routerLocation = useLocation();

    const sessionId = routerLocation.pathname.split("/").pop();
    const draftKey = draftKeyFor(sessionId);

    const [step, setStep] = useState(0);
    const [data, setData] = useState(EMPTY_COMPANY);
    const [logo, setLogo] = useState(null);
    const [touched, setTouched] = useState({});
    const [showErrors, setShowErrors] = useState(false);
    const [handleStatus, setHandleStatus] = useState("idle");
    const [segmentSearch, setSegmentSearch] = useState("");
    const [autofillNote, setAutofillNote] = useState("");
    const [cropSource, setCropSource] = useState(null);
    const [zipStatus, setZipStatus] = useState("idle");
    const [locating, setLocating] = useState(false);
    const [tourOpen, setTourOpen] = useState(false);
    const restored = useRef(false);
    const [ready, setReady] = useState(false);

    /* ---------------- rascunho ---------------- */

    useEffect(() => {

        let cancelled = false;

        (async () => {
            try {
                const saved = JSON.parse(localStorage.getItem(draftKey) || "null");

                if (saved?.data && !cancelled) {
                    setData({ ...EMPTY_COMPANY, ...saved.data, location: { ...EMPTY_COMPANY.location, ...(saved.data.location || {}) } });
                    setStep(Number.isInteger(saved.step) ? saved.step : 0);
                } else if (!cancelled) {
                    const email = getAuth().currentUser?.email || "";
                    if (email) setData((current) => ({ ...current, email }));
                }

                const image = await getDraftImage(draftKey).catch(() => null);
                if (image && !cancelled) setLogo(image);
            } catch {
                /* rascunho corrompido: começa do zero */
            } finally {
                if (!cancelled) {
                    /* Voltou da revisão pelo "Editar": abre na etapa certa. */
                    const editStep = routerLocation.state?.editStep;
                    if (Number.isInteger(editStep)) setStep(editStep);
                    restored.current = true;
                    setReady(true);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftKey]);

    useEffect(() => {
        if (!restored.current) return undefined;
        const timer = setTimeout(() => {
            try {
                localStorage.setItem(draftKey, JSON.stringify({ step, data, savedAt: Date.now() }));
            } catch {
                /* sem espaço: segue sem rascunho */
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [draftKey, step, data]);

    useEffect(() => {
        if (!restored.current || !logo) return;
        saveDraftImage(draftKey, logo).catch(() => {});
    }, [draftKey, logo]);

    /* ---------------- tutorial ---------------- */

    useEffect(() => {
        if (!ready) return undefined;
        const tour = readTour();
        if (tour.skipped || tour[STEPS[step].id]) return undefined;
        const timer = setTimeout(() => setTourOpen(true), 350);
        return () => clearTimeout(timer);
    }, [step, ready]);

    const finishTour = useCallback((skipped) => {
        const tour = readTour();
        writeTour(skipped ? { ...tour, skipped: true } : { ...tour, [STEPS[step].id]: true });
        setTourOpen(false);
    }, [step]);

    /* ---------------- campos ---------------- */

    const set = (patch) => setData((current) => ({ ...current, ...patch }));
    const setLocationField = (patch) => setData((current) => ({ ...current, location: { ...current.location, ...patch } }));
    const touch = (field) => setTouched((current) => ({ ...current, [field]: true }));

    const problems = useMemo(() => stepProblems(step, data), [step, data]);

    const errorFor = (field) => {
        if (!(showErrors || touched[field])) return "";
        if (field === "handle" && !problems.handle) {
            if (handleStatus === "taken") return "Este @ já está em uso. Tente outro.";
        }
        return problems[field] || "";
    };

    const chooseSegment = (segment) => {
        setData((current) => {
            const previous = getSegment(current.segment);
            const keepCategories =
                current.categories.length &&
                (!previous || current.categories.join() !== previous.categories.join());
            const keepDescription =
                current.description.trim() &&
                (!previous || current.description !== previous.description);

            return {
                ...current,
                segment: segment.id,
                categories: keepCategories ? current.categories : segment.categories,
                description: keepDescription ? current.description : segment.description
            };
        });

        setAutofillNote(
            segment.categories.length || segment.description
                ? `Preenchemos categorias e descrição de ${segment.name}. Você edita na etapa Identidade.`
                : ""
        );
    };

    const changeName = (name) => {
        setData((current) => ({
            ...current,
            name,
            handle: current.handleEdited ? current.handle : suggestHandle(name)
        }));
    };

    /* @ disponível? (só o nome é público; ver regras do banco) */
    useEffect(() => {

        const handle = data.handle;

        if (step !== 0 || !handle || problems.handle) {
            setHandleStatus("idle");
            return undefined;
        }

        setHandleStatus("checking");

        let cancelled = false;

        const timer = setTimeout(async () => {
            try {
                const snapshot = await get(ref(getDatabase(), `companys/${handle}/name`));
                if (!cancelled) setHandleStatus(snapshot.exists() ? "taken" : "free");
            } catch {
                if (!cancelled) setHandleStatus("error");
            }
        }, 450);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [data.handle, step, problems.handle]);

    /* CEP → endereço (ViaCEP, gratuito) */
    useEffect(() => {

        const zip = digits(data.location.zipCode);

        if (zip.length !== 8) {
            setZipStatus("idle");
            return undefined;
        }

        let cancelled = false;
        setZipStatus("loading");

        fetch(`https://viacep.com.br/ws/${zip}/json/`)
            .then((response) => response.json())
            .then((result) => {
                if (cancelled) return;
                if (result?.erro) {
                    setZipStatus("notfound");
                    return;
                }
                setData((current) => ({
                    ...current,
                    location: {
                        ...current.location,
                        street: current.location.street || result.logradouro || "",
                        neighborhood: current.location.neighborhood || result.bairro || "",
                        city: result.localidade || current.location.city,
                        state: result.uf || current.location.state,
                        country: "Brasil"
                    }
                }));
                setZipStatus("ok");
            })
            .catch(() => !cancelled && setZipStatus("error"));

        return () => {
            cancelled = true;
        };
    }, [data.location.zipCode]);

    const useDeviceLocation = () => {

        if (!navigator.geolocation) return;

        setLocating(true);

        navigator.geolocation.getCurrentPosition(
            async ({ coords }) => {
                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}&zoom=18&addressdetails=1`,
                        { headers: { Accept: "application/json" } }
                    );
                    const address = (await response.json())?.address || {};
                    setLocationField({
                        street: address.road || address.pedestrian || "",
                        number: address.house_number || "",
                        neighborhood: address.neighbourhood || address.suburb || "",
                        city: address.city || address.town || address.village || "",
                        state: address.state || "",
                        zipCode: formatZip(address.postcode || ""),
                        country: address.country || "Brasil"
                    });
                } catch {
                    /* sem endereço: a pessoa digita */
                } finally {
                    setLocating(false);
                }
            },
            () => setLocating(false),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const pickLogo = (file) => {
        if (!file || !file.type.startsWith("image/")) return;
        const reader = new FileReader();
        reader.onload = () => setCropSource(reader.result);
        reader.readAsDataURL(file);
    };

    /* ---------------- navegação ---------------- */

    const canContinue =
        !hasProblems(problems) &&
        !(step === 0 && (handleStatus === "taken" || handleStatus === "checking"));

    const goReview = () =>
        navigate(`/newcompany/previewcompany/${sessionId}`, {
            state: { company: data, logo, draftKey }
        });

    const next = () => {
        if (!canContinue) {
            setShowErrors(true);
            const first = Object.keys(problems).find((field) => problems[field]);
            document.getElementById(`ncw-${first === "segment" ? "segment-search" : first}`)?.focus();
            return;
        }
        setShowErrors(false);
        if (step === STEPS.length - 1) goReview();
        else setStep(step + 1);
    };

    const skip = () => {
        setShowErrors(false);
        if (step === STEPS.length - 1) goReview();
        else setStep(step + 1);
    };

    const back = () => {
        setShowErrors(false);
        if (step === 0) navigate(-1);
        else setStep(step - 1);
    };

    const segments = searchSegments(segmentSearch);
    const current = STEPS[step];

    /* ---------------- render ---------------- */

    return (
        <main className="ncw">

            <header className="ncw-top">
                <button type="button" className="ncw-icon-btn" onClick={back} aria-label="Voltar">
                    <Icon icon="solar:alt-arrow-left-linear" />
                </button>

                <div className="ncw-progress" aria-label={`Etapa ${step + 1} de ${STEPS.length}`}>
                    {STEPS.map((item, index) => (
                        <span key={item.id} className={index < step ? "is-done" : index === step ? "is-current" : ""} />
                    ))}
                </div>

                <button type="button" className="ncw-icon-btn" onClick={() => setTourOpen(true)} aria-label="Ver o tutorial desta etapa">
                    <Icon icon="solar:question-circle-linear" />
                </button>
            </header>

            <section className="ncw-body" key={current.id}>

                <p className="ncw-eyebrow">Etapa {step + 1} de {STEPS.length}{current.required ? "" : " · opcional"}</p>
                <h1>{current.title}</h1>
                <p className="ncw-lead">{current.hint}</p>

                {step === 0 && (
                    <>
                        <div className={`ncw-field ${errorFor("segment") ? "has-error" : ""}`} id="ncw-segments">
                            <label htmlFor="ncw-segment-search">
                                Ramo da empresa <span className="ncw-req" aria-hidden="true">*</span>
                            </label>
                            <div className="ncw-search">
                                <Icon icon="solar:magnifer-linear" aria-hidden="true" />
                                <input
                                    id="ncw-segment-search"
                                    type="search"
                                    placeholder="Buscar ramo (ex.: barbearia)"
                                    value={segmentSearch}
                                    onChange={(event) => setSegmentSearch(event.target.value)}
                                />
                            </div>
                            <div className="ncw-segments" role="radiogroup" aria-label="Ramo da empresa">
                                {segments.map((segment) => (
                                    <button
                                        key={segment.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={data.segment === segment.id}
                                        className={`ncw-segment ${data.segment === segment.id ? "is-selected" : ""}`}
                                        onClick={() => chooseSegment(segment)}
                                    >
                                        <Icon icon={segment.icon} aria-hidden="true" />
                                        <span>{segment.name}</span>
                                    </button>
                                ))}
                                {!segments.length && <p className="ncw-hint">Nenhum ramo com esse nome. Escolha "Outro tipo de serviço".</p>}
                            </div>
                            {errorFor("segment") && <p className="ncw-error" role="alert">{errorFor("segment")}</p>}
                            {autofillNote && <p className="ncw-note" role="status"><Icon icon="solar:magic-stick-3-linear" aria-hidden="true" />{autofillNote}</p>}
                        </div>

                        <Field id="name" label="Nome da empresa" required error={errorFor("name")}>
                            <input
                                id="ncw-name"
                                value={data.name}
                                maxLength={40}
                                autoComplete="organization"
                                placeholder="Ex.: Barbearia do Zé"
                                aria-invalid={Boolean(errorFor("name"))}
                                onChange={(event) => changeName(event.target.value)}
                                onBlur={() => touch("name")}
                            />
                        </Field>

                        <Field
                            id="handle"
                            label="@ da empresa"
                            required
                            error={errorFor("handle")}
                            hint={
                                handleStatus === "checking" ? "Conferindo se está livre…"
                                    : handleStatus === "free" ? "Disponível ✓"
                                        : handleStatus === "error" ? "Não deu para conferir agora; conferimos de novo ao salvar."
                                            : "Letras minúsculas, números, - ou _. De 3 a 25 caracteres."
                            }
                        >
                            <div className={`ncw-prefix ${handleStatus === "free" ? "is-ok" : ""}`}>
                                <span aria-hidden="true">@</span>
                                <input
                                    id="ncw-handle"
                                    value={data.handle}
                                    maxLength={25}
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    aria-invalid={Boolean(errorFor("handle"))}
                                    onChange={(event) => set({ handle: normalizeHandle(event.target.value), handleEdited: true })}
                                    onBlur={() => touch("handle")}
                                />
                            </div>
                        </Field>
                    </>
                )}

                {step === 1 && (
                    <>
                        <Field id="document" label="CPF ou CNPJ" required error={errorFor("document")} hint="Não aparece para os clientes.">
                            <input
                                id="ncw-document"
                                inputMode="numeric"
                                value={formatDocument(data.document)}
                                placeholder="000.000.000-00"
                                aria-invalid={Boolean(errorFor("document"))}
                                onChange={(event) => set({ document: digits(event.target.value).slice(0, 14) })}
                                onBlur={() => touch("document")}
                            />
                        </Field>
                        <Field id="email" label="E-mail de contato" required error={errorFor("email")}>
                            <input
                                id="ncw-email"
                                type="email"
                                autoComplete="email"
                                value={data.email}
                                placeholder="contato@empresa.com"
                                aria-invalid={Boolean(errorFor("email"))}
                                onChange={(event) => set({ email: event.target.value.trim() })}
                                onBlur={() => touch("email")}
                            />
                        </Field>
                        <Field id="phone" label="Telefone ou WhatsApp" required error={errorFor("phone")}>
                            <input
                                id="ncw-phone"
                                type="tel"
                                inputMode="tel"
                                autoComplete="tel-national"
                                value={formatPhone(data.phone)}
                                placeholder="(11) 99999-9999"
                                aria-invalid={Boolean(errorFor("phone"))}
                                onChange={(event) => set({ phone: digits(event.target.value).slice(0, 11) })}
                                onBlur={() => touch("phone")}
                            />
                        </Field>
                    </>
                )}

                {step === 2 && (
                    <>
                        <div className="ncw-field" id="ncw-field-logo">
                            <span className="ncw-label">Logo <span className="ncw-opt">opcional</span></span>
                            <div className="ncw-logo">
                                <div className="ncw-logo__preview">
                                    {logo
                                        ? <img src={logo} alt="Logo escolhida" width="88" height="88" />
                                        : <Icon icon="solar:gallery-add-linear" aria-hidden="true" />}
                                </div>
                                <div className="ncw-logo__actions">
                                    <label className="ncw-btn ncw-btn--ghost">
                                        {logo ? "Trocar imagem" : "Escolher imagem"}
                                        <input
                                            type="file"
                                            accept="image/*,.heic,.heif"
                                            className="ncw-visually-hidden"
                                            onChange={(event) => {
                                                pickLogo(event.target.files?.[0]);
                                                event.target.value = "";
                                            }}
                                        />
                                    </label>
                                    {logo && (
                                        <button type="button" className="ncw-link" onClick={() => setLogo(null)}>Remover</button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <Field id="description" label="Descrição" hint={`${data.description.length}/300`}>
                            <textarea
                                id="ncw-description"
                                rows={3}
                                maxLength={300}
                                value={data.description}
                                placeholder="Conte em uma ou duas frases o que a empresa faz."
                                onChange={(event) => set({ description: event.target.value })}
                            />
                        </Field>

                        <div className="ncw-field" id="ncw-field-categories">
                            <span className="ncw-label">Categorias <span className="ncw-opt">opcional</span></span>
                            <div className="ncw-chips">
                                {COMPANY_CATEGORIES.map((category) => {
                                    const on = data.categories.includes(category.id);
                                    return (
                                        <button
                                            key={category.id}
                                            type="button"
                                            aria-pressed={on}
                                            className={`ncw-chip ${on ? "is-on" : ""}`}
                                            onClick={() =>
                                                set({
                                                    categories: on
                                                        ? data.categories.filter((id) => id !== category.id)
                                                        : [...data.categories, category.id]
                                                })
                                            }
                                        >
                                            {on && <Icon icon="solar:check-read-linear" aria-hidden="true" />}
                                            {category.name}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}

                {step === 3 && (
                    <>
                        <Field
                            id="zip"
                            label="CEP"
                            hint={
                                zipStatus === "loading" ? "Buscando endereço…"
                                    : zipStatus === "notfound" ? "CEP não encontrado. Preencha abaixo."
                                        : zipStatus === "error" ? "Não deu para buscar o CEP agora. Preencha abaixo."
                                            : zipStatus === "ok" ? "Endereço preenchido. Confira o número."
                                                : "Digite o CEP para preencher o resto."
                            }
                        >
                            <input
                                id="ncw-zip"
                                inputMode="numeric"
                                autoComplete="postal-code"
                                value={formatZip(data.location.zipCode)}
                                placeholder="00000-000"
                                onChange={(event) => setLocationField({ zipCode: formatZip(event.target.value) })}
                            />
                        </Field>

                        <button type="button" id="ncw-use-location" className="ncw-btn ncw-btn--ghost ncw-wide" onClick={useDeviceLocation} disabled={locating}>
                            <Icon icon={locating ? "svg-spinners:ring-resize" : "solar:map-point-linear"} aria-hidden="true" />
                            {locating ? "Buscando sua localização…" : "Usar minha localização atual"}
                        </button>

                        <div className="ncw-grid">
                            <Field id="street" label="Rua">
                                <input id="ncw-street" autoComplete="address-line1" value={data.location.street} onChange={(event) => setLocationField({ street: event.target.value })} />
                            </Field>
                            <Field id="number" label="Número">
                                <input id="ncw-number" value={data.location.number} onChange={(event) => setLocationField({ number: event.target.value })} />
                            </Field>
                            <Field id="neighborhood" label="Bairro">
                                <input id="ncw-neighborhood" value={data.location.neighborhood} onChange={(event) => setLocationField({ neighborhood: event.target.value })} />
                            </Field>
                            <Field id="city" label="Cidade">
                                <input id="ncw-city" autoComplete="address-level2" value={data.location.city} onChange={(event) => setLocationField({ city: event.target.value })} />
                            </Field>
                            <Field id="state" label="Estado (UF)">
                                <input id="ncw-state" maxLength={20} autoComplete="address-level1" value={data.location.state} onChange={(event) => setLocationField({ state: event.target.value })} />
                            </Field>
                        </div>
                    </>
                )}

            </section>

            <footer className="ncw-bottom">
                <button type="button" className="ncw-btn ncw-btn--ghost" onClick={back}>
                    {step === 0 ? "Cancelar" : "Voltar"}
                </button>
                <div className="ncw-bottom__right">
                    {!current.required && (
                        <button type="button" className="ncw-link" onClick={skip}>Pular por agora</button>
                    )}
                    <button type="button" className="ncw-btn ncw-btn--primary" onClick={next} aria-disabled={!canContinue}>
                        {step === STEPS.length - 1 ? "Revisar cadastro" : "Continuar"}
                        <Icon icon="solar:alt-arrow-right-linear" aria-hidden="true" />
                    </button>
                </div>
            </footer>

            <p className="ncw-saved" aria-live="polite">
                <Icon icon="solar:cloud-check-linear" aria-hidden="true" /> Rascunho salvo neste aparelho
            </p>

            {cropSource && (
                <div className="create-company-crop-modal ncw-crop" role="dialog" aria-modal="true" aria-label="Ajustar logo">
                    <div className="create-company-crop-modal-content">
                        <div className="create-company-crop-header">
                            <h2>Enquadre sua logo</h2>
                        </div>
                        <div className="create-company-crop-area">
                            <ImageCropper
                                imageSrc={cropSource}
                                closeModal={() => setCropSource(null)}
                                updateAvatar={(image) => {
                                    setLogo(image);
                                    setCropSource(null);
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {tourOpen && <CoachMarks key={step} items={TOUR[step]} onFinish={() => finishTour(false)} onSkip={() => finishTour(true)} />}

        </main>
    );
};

export { COMPANY_SEGMENTS };
export default CreateCompany;
