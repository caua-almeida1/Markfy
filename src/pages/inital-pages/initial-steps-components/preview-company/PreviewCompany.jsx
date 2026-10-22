import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import { getAuth } from "firebase/auth";
import { getDatabase, ref, get, set, update, serverTimestamp } from "firebase/database";

import "../create-company/new-company.css";

import { useUserCompany } from "../../../../contexts/companyContext/UserCompanyContext";
import { removeDraftImage, getDraftImage } from "../create-company/utils/companyDraft";
import { draftKeyFor, EMPTY_COMPANY } from "../create-company/CreateCompany";
import { getSegment } from "../create-company/companySegments";
import { formatDocument, formatPhone, stepProblems, hasProblems } from "../create-company/companyValidation";
import { syncCompanyIndex, setDocumentOwner, updateCompanyIndex } from "../../../../firebase/companiesIndex";
import { uploadCompanyLogo } from "../../../../firebase/companyLogo";
import { getCategoryLabel } from "../../../../utils/companyCategories";
import { trackEvent } from "../../../../analytics/analytics";

/* =========================================================
   REVISAR E CONFIRMAR O CADASTRO

   POR QUE DEMORAVA ~1 MINUTO
   O cadastro antigo fazia tudo em fila, cada passo esperando
   o anterior, sem limite de tempo: comprimir e subir a logo,
   gravar a empresa, gravar o membro de novo, índice público,
   índice de documento, usuário, rascunho. Qualquer passo lento
   (rede do celular, upload) segurava a tela inteira.

   Agora:
     1. confere o @ de novo (outra pessoa pode ter pegado);
     2. grava a empresa numa gravação só (com o dono e as
        categorias — que antes eram coletadas e NÃO salvas);
     3. vínculo do usuário, índices e logo rodam em PARALELO,
        cada um com limite de tempo; o que falhar não impede a
        empresa de existir (o painel repara o índice depois);
     4. o rascunho é limpo sem segurar a tela.
========================================================= */

const withTimeout = (promise, ms, label) =>
    Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}: tempo esgotado`)), ms))
    ]);

const PHASES = {
    checking: "Conferindo o @…",
    saving: "Criando a empresa…",
    finishing: "Finalizando…"
};

const readDraft = (draftKey) => {
    try {
        return JSON.parse(localStorage.getItem(draftKey) || "null")?.data || null;
    } catch {
        return null;
    }
};

const Row = ({ label, value, empty = "Não informado" }) => (
    <div className="ncr-row">
        <dt>{label}</dt>
        <dd className={value ? "" : "is-empty"}>{value || empty}</dd>
    </div>
);

/* Confete: peças geradas uma vez, com cor, ângulo e atraso
   próprios; a animação é só CSS (sem dependência). */
const CONFETTI = Array.from({ length: 28 }, (_, index) => ({
    angle: (index / 28) * 360 + (index % 3) * 7,
    distance: 90 + (index % 5) * 22,
    delay: (index % 7) * 40,
    color: ["#3d67fa", "#12b76a", "#f5b014", "#f04ea0", "#8b5cf6", "#22c3e6"][index % 6],
    shape: index % 3
}));

function SuccessModal({ company, segment, onPlans, onClose }) {

    const url = `${window.location.origin}/central-user/${company.handle}`;
    const shortUrl = url.replace(/^https?:\/\//, "");
    const [copied, setCopied] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const dialogRef = useRef(null);

    useEffect(() => {
        dialogRef.current?.focus();
        const onKey = (event) => event.key === "Escape" && onClose?.();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            /* sem área de transferência */
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const share = async () => {
        try {
            await navigator.share({ title: company.name, text: `Agende com ${company.name} pela Markfy`, url });
        } catch {
            /* cancelado */
        }
    };

    const whatsapp = `https://wa.me/?text=${encodeURIComponent(`Agende comigo pela Markfy: ${url}`)}`;
    const canShare = typeof navigator.share === "function";

    return (
        <div className="ncs" role="dialog" aria-modal="true" aria-labelledby="ncs-title">
            <div className="ncs__card" ref={dialogRef} tabIndex={-1}>

                {onClose && (
                    <button type="button" className="ncs__close" onClick={onClose} aria-label="Fechar">
                        <Icon icon="solar:close-circle-linear" />
                    </button>
                )}

                <div className="ncs__hero" aria-hidden="true">
                    <div className="ncs__confetti">
                        {CONFETTI.map((piece, index) => (
                            <i
                                key={index}
                                className={`ncs__piece ncs__piece--${piece.shape}`}
                                style={{
                                    "--a": `${piece.angle}deg`,
                                    "--d": `${piece.distance}px`,
                                    "--delay": `${piece.delay}ms`,
                                    "--c": piece.color
                                }}
                            />
                        ))}
                    </div>
                    <span className="ncs__ring" />
                    <span className="ncs__ring ncs__ring--2" />
                    <div className="ncs__badge">
                        <svg viewBox="0 0 52 52" className="ncs__check">
                            <circle cx="26" cy="26" r="24" />
                            <path d="M15 27 l7 7 l15 -16" />
                        </svg>
                    </div>
                </div>

                <h2 id="ncs-title">Empresa criada!</h2>
                <p className="ncs__lead">
                    <strong>{company.name}</strong> já tem uma página na Markfy. Compartilhe o link com seus clientes.
                </p>

                <div className="ncs__link">
                    <span className="ncs__link-icon" aria-hidden="true"><Icon icon="solar:link-round-angle-bold" /></span>
                    <span className="ncs__link-text" title={url}>{shortUrl}</span>
                    <button type="button" className={`ncs__copy ${copied ? "is-done" : ""}`} onClick={copy}>
                        <Icon icon={copied ? "solar:check-read-linear" : "solar:copy-linear"} aria-hidden="true" />
                        {copied ? "Copiado" : "Copiar"}
                    </button>
                </div>

                <ul className="ncs__list">
                    {canShare && (
                        <li>
                            <button type="button" onClick={share}>
                                <Icon icon="solar:share-linear" aria-hidden="true" />
                                <span>Compartilhar link</span>
                                <Icon icon="solar:alt-arrow-right-linear" className="ncs__chev" aria-hidden="true" />
                            </button>
                        </li>
                    )}
                    <li>
                        <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                            <Icon icon="ic:baseline-whatsapp" aria-hidden="true" />
                            <span>Enviar no WhatsApp</span>
                            <Icon icon="solar:alt-arrow-right-linear" className="ncs__chev" aria-hidden="true" />
                        </a>
                    </li>
                </ul>

                <div className="ncs__next">
                    <span className="ncs__next-tag">Próximo passo</span>
                    <p>
                        Escolha um plano para a página começar a receber agendamentos
                        {segment?.services?.length ? <> e cadastre serviços como <b>{segment.services.slice(0, 2).join(" e ")}</b></> : null}.
                    </p>
                </div>

                <button
                    type="button"
                    className="ncs__primary"
                    disabled={leaving}
                    onClick={async () => {
                        setLeaving(true);
                        await onPlans();
                    }}
                >
                    {leaving ? <Icon icon="svg-spinners:ring-resize" aria-hidden="true" /> : null}
                    {leaving ? "Abrindo…" : "Escolher meu plano"}
                </button>

                <a className="ncs__secondary" href={url} target="_blank" rel="noopener noreferrer">
                    Ver minha página
                </a>

            </div>
        </div>
    );
}

export default function PreviewCompany() {

    const routerLocation = useLocation();
    const navigate = useNavigate();
    const { refreshCompany } = useUserCompany();

    const sessionId = routerLocation.pathname.split("/").pop();
    const draftKey = routerLocation.state?.draftKey || draftKeyFor(sessionId);

    /* Recarregar a página perdia o state do router e mostrava
       "dados não encontrados": agora vem do rascunho. */
    const [company] = useState(() => routerLocation.state?.company || readDraft(draftKey));
    const [logo, setLogo] = useState(routerLocation.state?.logo || null);
    const [phase, setPhase] = useState(null);
    const [error, setError] = useState("");
    const [done, setDone] = useState(false);
    const busy = useRef(false);

    useEffect(() => {
        if (!logo) getDraftImage(draftKey).then((image) => image && setLogo(image)).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftKey]);

    const data = useMemo(() => ({ ...EMPTY_COMPANY, ...(company || {}) }), [company]);
    const segment = getSegment(data.segment);
    const missing = hasProblems(stepProblems(0, data)) || hasProblems(stepProblems(1, data));

    const edit = (editStep) => navigate(`/newcompany/${sessionId}`, { state: { editStep } });

    const register = async () => {

        if (busy.current || missing) return;
        busy.current = true;
        setError("");

        try {
            const user = getAuth().currentUser;
            if (!user) throw new Error("login");

            const db = getDatabase();
            const handle = data.handle;

            setPhase("checking");
            const taken = await withTimeout(get(ref(db, `companys/${handle}/name`)), 10000, "checagem");
            if (taken.exists()) throw new Error("taken");

            const location = { ...EMPTY_COMPANY.location, ...data.location };
            const categories = data.categories.length ? data.categories : null;

            setPhase("saving");
            await withTimeout(
                set(ref(db, `companys/${handle}`), {
                    name: data.name.trim(),
                    handle,
                    document: data.document,
                    email: data.email,
                    phone: data.phone,
                    description: data.description.trim(),
                    categories,
                    category: categories ? categories[0] : null,
                    segment: data.segment || null,
                    location,
                    logoPreview: null,
                    createdAt: serverTimestamp(),
                    members: { [user.uid]: { role: "master" } }
                }),
                20000,
                "empresa"
            );

            setPhase("finishing");

            const linkUser = withTimeout(
                update(ref(db, `users/${user.uid}`), {
                    userType: "admin",
                    initial: false,
                    companyHandle: handle,
                    [`companies/${handle}`]: true
                }),
                10000,
                "usuário"
            );

            const indexes = withTimeout(
                Promise.all([
                    syncCompanyIndex(handle, { handle, name: data.name.trim(), description: data.description.trim(), categories, location }),
                    setDocumentOwner(data.document, handle)
                ]),
                10000,
                "índices"
            );

            const logoUpload = logo
                ? withTimeout(
                    uploadCompanyLogo(handle, logo).then((url) => url && updateCompanyIndex(handle, { logoUrl: url })),
                    20000,
                    "logo"
                )
                : Promise.resolve();

            const [userResult, , logoResult] = await Promise.allSettled([linkUser, indexes, logoUpload]);

            if (userResult.status === "rejected") console.warn("Vínculo do usuário:", userResult.reason?.message);
            if (logoResult.status === "rejected") console.warn("Logo:", logoResult.reason?.message);

            trackEvent("company_created", { company_handle: handle });

            try {
                localStorage.removeItem(draftKey);
            } catch {
                /* ignora */
            }
            removeDraftImage(draftKey).catch(() => {});

            setDone(true);

        } catch (failure) {

            const message = failure?.message || "";

            setError(
                message === "taken" ? "Este @ acabou de ser usado por outra empresa. Volte e escolha outro."
                    : message === "login" ? "Sua sessão expirou. Entre de novo para concluir."
                        : /PERMISSION_DENIED|permission/i.test(message) ? "Não foi possível criar com este @. Escolha outro."
                            : /tempo esgotado|network|offline/i.test(message) ? "A conexão está lenta e o cadastro não terminou. Tente de novo."
                                : "Não foi possível cadastrar a empresa. Tente de novo."
            );

        } finally {
            setPhase(null);
            busy.current = false;
        }
    };

    const goToPlans = async () => {
        /* Não deixa a atualização do contexto prender a tela. */
        await withTimeout(refreshCompany(), 6000, "contexto").catch(() => {});
        navigate("/planos");
    };

    if (!company) {
        return (
            <main className="ncw ncr">
                <section className="ncw-body">
                    <h1>Não encontramos o cadastro</h1>
                    <p className="ncw-lead">O rascunho deste aparelho expirou ou já foi concluído.</p>
                    <button type="button" className="ncw-btn ncw-btn--primary" onClick={() => navigate("/initial-setup")}>
                        Começar de novo
                    </button>
                </section>
            </main>
        );
    }

    const address = [
        [data.location.street, data.location.number].filter(Boolean).join(", "),
        data.location.neighborhood,
        [data.location.city, data.location.state].filter(Boolean).join(" - ")
    ].filter(Boolean).join(" · ");

    return (
        <main className="ncw ncr">

            <header className="ncw-top">
                <button type="button" className="ncw-icon-btn" onClick={() => edit(3)} aria-label="Voltar e editar">
                    <Icon icon="solar:alt-arrow-left-linear" />
                </button>
                <div className="ncw-progress" aria-hidden="true">
                    <span className="is-done" /><span className="is-done" /><span className="is-done" /><span className="is-current" />
                </div>
                <span className="ncw-icon-btn ncw-icon-btn--placeholder" aria-hidden="true" />
            </header>

            <section className="ncw-body">

                <p className="ncw-eyebrow">Último passo</p>
                <h1>Confira antes de criar</h1>
                <p className="ncw-lead">Tudo pode ser alterado depois no painel, menos o @.</p>

                <div className="ncr-hero">
                    <div className="ncr-hero__logo">
                        {logo
                            ? <img src={logo} alt={`Logo de ${data.name}`} width="72" height="72" />
                            : <span aria-hidden="true">{data.name.slice(0, 1).toUpperCase() || "?"}</span>}
                    </div>
                    <div>
                        <h2>{data.name || "Sem nome"}</h2>
                        <p className="ncr-handle">@{data.handle}</p>
                        {segment && <span className="ncr-badge"><Icon icon={segment.icon} aria-hidden="true" />{segment.name}</span>}
                    </div>
                </div>

                <section className="ncr-card">
                    <header><h3>Seu negócio</h3><button type="button" className="ncw-link" onClick={() => edit(0)}>Editar</button></header>
                    <dl>
                        <Row label="Ramo" value={segment?.name} />
                        <Row label="Nome" value={data.name} />
                        <Row label="Página" value={data.handle ? `/central-user/${data.handle}` : ""} />
                    </dl>
                </section>

                <section className="ncr-card">
                    <header><h3>Contato</h3><button type="button" className="ncw-link" onClick={() => edit(1)}>Editar</button></header>
                    <dl>
                        <Row label="CPF/CNPJ" value={formatDocument(data.document)} />
                        <Row label="E-mail" value={data.email} />
                        <Row label="Telefone" value={formatPhone(data.phone)} />
                    </dl>
                </section>

                <section className="ncr-card">
                    <header><h3>Identidade</h3><button type="button" className="ncw-link" onClick={() => edit(2)}>Editar</button></header>
                    <dl>
                        <Row label="Descrição" value={data.description} />
                        <Row label="Categorias" value={data.categories.map(getCategoryLabel).join(", ")} empty="Nenhuma (não aparece nos filtros do Explorar)" />
                        <Row label="Logo" value={logo ? "Escolhida" : ""} empty="Sem logo (mostramos a inicial)" />
                    </dl>
                </section>

                <section className="ncr-card">
                    <header><h3>Endereço</h3><button type="button" className="ncw-link" onClick={() => edit(3)}>Editar</button></header>
                    <dl>
                        <Row label="Endereço" value={address} empty="Não informado (não aparece em “Perto de você”)" />
                        <Row label="CEP" value={data.location.zipCode} />
                    </dl>
                </section>

                {missing && (
                    <p className="ncw-error" role="alert">Faltam dados obrigatórios. Use “Editar” em Seu negócio ou Contato.</p>
                )}

                {error && <p className="ncw-error ncr-error" role="alert">{error}</p>}

            </section>

            <footer className="ncw-bottom">
                <button type="button" className="ncw-btn ncw-btn--ghost" onClick={() => edit(0)} disabled={Boolean(phase)}>
                    Voltar e editar
                </button>
                <button type="button" className="ncw-btn ncw-btn--primary" onClick={register} disabled={Boolean(phase) || missing} aria-busy={Boolean(phase)}>
                    {phase
                        ? <><Icon icon="svg-spinners:ring-resize" aria-hidden="true" />{PHASES[phase]}</>
                        : <>Criar empresa <Icon icon="solar:check-circle-linear" aria-hidden="true" /></>}
                </button>
            </footer>

            {done && <SuccessModal company={data} segment={segment} onPlans={goToPlans} onClose={() => navigate("/home")} />}

        </main>
    );
}
