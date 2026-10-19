import React, { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";

import {
    MASTER_EMAIL,
    PRODUCTS,
    LICENSE_STATUS,
    ROLE_KINDS,
    getProduct
} from "./masterConfig";
import {
    FEATURES,
    LIMITS,
    PLAN_COLORS,
    buildCatalog,
    formatPrice
} from "../plans/planDefaults";
import {
    watchMasterSession,
    signInMaster,
    signOutMaster,
    describeMasterError,
    loadNetwork,
    loadStorageImages,
    loadCatalog,
    seedCatalog,
    savePlan,
    deletePlan,
    saveLicense
} from "./masterApi";

import "./master.css";

/* =========================================================
   MARKFY MASTER DEV

   Painel de controle do dono da plataforma. Identidade
   própria (obsidiana + âmbar) para nunca ser confundido com
   a Bookings (azul/claro) ou o Studio (rosa).

   Sem regras de "reduzir movimento": as animações valem
   para todo mundo, por escolha do projeto.
========================================================= */

const NOW = () => Date.now();

/* Pré-visualização do layout sem login, só em desenvolvimento. */
const MOCK_NETWORK = process.env.NODE_ENV === "development"
    ? (/[?&]mock/.test(window.location.search) ? require("./mockNetwork").MOCK_NETWORK : null)
    : null;
const MOCK = Boolean(MOCK_NETWORK);

/* Catálogo de planos vivo (planCatalog), compartilhado pelas telas. */
const CatalogContext = createContext([]);
const usePlans = () => useContext(CatalogContext);

const formatDate = (millis) =>
    millis
        ? new Date(millis).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        })
        : "—";

const toDateInput = (millis) =>
    millis ? new Date(millis).toISOString().slice(0, 10) : "";

const fromDateInput = (value) =>
    value ? new Date(`${value}T23:59:59`).getTime() : null;

const initialsOf = (name) =>
    String(name || "?")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "?";

const copyText = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        return false;
    }
};

const stateOf = (person) => {
    const license = person.license;
    return {
        product: license?.product || "none",
        plan: license?.plan || null,
        status: license?.status || "active",
        expired: Boolean(license?.expiresAt && license.expiresAt < NOW()),
        has: Boolean(license)
    };
};

const hostOf = (url) => url.replace(/^https?:\/\//, "");


/* =========================================================
   PEÇAS PEQUENAS
========================================================= */

const PhotosContext = createContext({});

/* Foto vinda do Storage (users/{uid}/profileImg); sem foto, iniciais. */
function Avatar({ name, color, size = 40, uid }) {
    const photo = useContext(PhotosContext)[uid];
    return (
        <span
            className={`mm-avatar ${photo ? "has-photo" : ""}`}
            style={{ width: size, height: size, "--c": color, fontSize: size * 0.36 }}
        >
            {photo
                ? <img src={photo} alt="" loading="lazy" referrerPolicy="no-referrer" />
                : initialsOf(name)}
        </span>
    );
}

/* Logo da empresa (Storage companys/{handle}/logo.png), recortada
   no centro como quadrado. Sem logo, iniciais. */
function CompanyLogo({ handle, name, size = 46 }) {
    const logo = useContext(PhotosContext)[`c:${handle}`];
    return (
        <span
            className={`mm-company__logo ${logo ? "has-photo" : ""}`}
            style={{ width: size, height: size, fontSize: size * 0.34 }}
        >
            {logo
                ? <img src={logo} alt="" loading="lazy" referrerPolicy="no-referrer" />
                : initialsOf(name)}
        </span>
    );
}

function Chip({ color, icon, children, solid }) {
    return (
        <span
            className={`mm-chip ${solid ? "is-solid" : ""}`}
            style={{ "--c": color }}
        >
            {icon && <Icon icon={icon} />}
            {children}
        </span>
    );
}

function ProductChip({ id, small }) {
    const product = getProduct(id);
    return (
        <span
            className={`mm-product ${small ? "is-small" : ""} mm-product--${product.id}`}
            style={{ "--c": product.color }}
        >
            <Icon icon={product.icon} />
            {product.short}
        </span>
    );
}

function PlanChip({ planId, expired, suspended }) {
    const plans = usePlans();
    const plan = planId
        ? plans.find((item) => item.id === planId) ||
            { id: planId, name: planId, tier: "removido", color: "#7b7f93" }
        : null;

    if (!plan) {
        return (
            <span className="mm-plan mm-plan--empty">
                <Icon icon="solar:close-circle-linear" />
                Sem plano
            </span>
        );
    }

    return (
        <span className="mm-plan" style={{ "--c": plan.color }}>
            <Icon icon={plan.bundle ? "solar:crown-star-bold" : "solar:ticket-bold"} />
            <b>{plan.name}</b>
            {plan.tier && <i>{plan.tier}</i>}
            {suspended && <em>suspensa</em>}
            {!suspended && expired && <em>vencida</em>}
        </span>
    );
}

function LinkPair({ url, label, color, onCopy, muted }) {
    return (
        <span className={`mm-link ${muted ? "is-muted" : ""}`} style={{ "--c": color }}>
            <a href={url} target="_blank" rel="noreferrer" title={url}>
                <Icon icon="solar:link-round-linear" />
                <span>
                    <b>{label}</b>
                    <small>{hostOf(url)}</small>
                </span>
            </a>
            <button type="button" title="Copiar link" onClick={() => onCopy(url)}>
                <Icon icon="solar:copy-linear" />
            </button>
        </span>
    );
}

function Kpi({ icon, label, value, hint, color, delay = 0 }) {
    return (
        <div className="mm-kpi" style={{ "--c": color, "--d": `${delay}ms` }}>
            <span className="mm-kpi__icon"><Icon icon={icon} /></span>
            <strong>{value}</strong>
            <span className="mm-kpi__label">{label}</span>
            {hint && <small>{hint}</small>}
        </div>
    );
}

function Meter({ rows, total }) {
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const id = requestAnimationFrame(() => setReady(true));
        return () => cancelAnimationFrame(id);
    }, []);

    return (
        <ul className="mm-meter">
            {rows.map((row) => {
                const pct = total ? Math.round((row.value / total) * 100) : 0;
                return (
                    <li key={row.id} style={{ "--c": row.color }}>
                        <div className="mm-meter__head">
                            <span>{row.icon && <Icon icon={row.icon} />}{row.label}</span>
                            <b>{row.value}<small>{pct}%</small></b>
                        </div>
                        <div className="mm-meter__track">
                            <i style={{ width: ready ? `${pct}%` : 0 }} />
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}


/* =========================================================
   PORTA DE ENTRADA
========================================================= */

function Gate({ onUnlocked }) {

    const [password, setPassword] = useState("");
    const [visible, setVisible] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [help, setHelp] = useState(false);

    const submit = async (event) => {
        event.preventDefault();
        if (busy || !password) return;

        setBusy(true);
        setError("");

        try {
            const user = await signInMaster(password);
            onUnlocked(user);
        } catch (err) {
            setError(describeMasterError(err));
            setPassword("");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="mm-gate">
            <div className="mm-gate__glow" aria-hidden="true" />
            <div className="mm-gate__grid" aria-hidden="true" />

            <form className="mm-gate__card" onSubmit={submit}>
                <div className="mm-gate__badge">
                    <img className="mm-logo" src="/markfy/logo.svg" alt="Markfy" />
                </div>

                <p className="mm-eyebrow">Markfy Master Dev</p>
                <h1>Área do dono</h1>
                <p className="mm-gate__lead">
                    Confirme que você é o master da plataforma para abrir o painel de controle.
                </p>

                <label className="mm-field">
                    <span>Conta master</span>
                    <div className="mm-input is-locked">
                        <Icon icon="solar:letter-bold" />
                        <input value={MASTER_EMAIL} readOnly tabIndex={-1} />
                        <Icon icon="solar:lock-bold" className="mm-input__end" />
                    </div>
                </label>

                <label className="mm-field">
                    <span>Senha</span>
                    <div className={`mm-input ${error ? "has-error" : ""}`}>
                        <Icon icon="solar:key-minimalistic-2-bold" />
                        <input
                            type={visible ? "text" : "password"}
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            placeholder="Senha da conta master"
                            autoComplete="current-password"
                            autoFocus
                        />
                        <button
                            type="button"
                            className="mm-input__btn"
                            onClick={() => setVisible((v) => !v)}
                            aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
                        >
                            <Icon icon={visible ? "solar:eye-closed-linear" : "solar:eye-linear"} />
                        </button>
                    </div>
                </label>

                {error && (
                    <p className="mm-error" role="alert">
                        <Icon icon="solar:danger-triangle-bold" /> {error}
                    </p>
                )}

                <button className="mm-btn mm-btn--gold mm-btn--block" disabled={busy || !password}>
                    {busy ? <span className="mm-spin" /> : <Icon icon="solar:lock-unlocked-bold" />}
                    {busy ? "Verificando…" : "Entrar no painel"}
                </button>

                <button type="button" className="mm-gate__help" onClick={() => setHelp((v) => !v)}>
                    <Icon icon="solar:question-circle-linear" />
                    Primeiro acesso?
                </button>

                {help && (
                    <ol className="mm-gate__steps">
                        <li>Abra o Firebase Console → <b>Authentication</b> → <b>Users</b>.</li>
                        <li>Clique em <b>Add user</b>.</li>
                        <li>Use o e-mail acima e a senha que você definiu.</li>
                        <li>Volte aqui e entre.</li>
                    </ol>
                )}
            </form>

            <p className="mm-gate__foot">Acesso restrito · tentativas são registradas pelo Firebase</p>
        </div>
    );
}


/* =========================================================
   EDITOR DE LICENÇA (de uma EMPRESA)

   O plano é da empresa, nunca da pessoa. Aqui a conta master
   libera, troca, suspende ou remove o plano de uma empresa.
   Plano em pacote (Pro, Premium…) libera Bookings e Studio;
   os demais liberam o produto escolhido.
========================================================= */

function LicenseEditor({ company, onSave }) {

    const plans = usePlans();
    const license = company.license;

    const [planId, setPlanId] = useState(license?.plan || null);
    const [product, setProduct] = useState(license?.product === "studio" ? "studio" : "bookings");
    const [status, setStatus] = useState(license?.status || "active");
    const [expires, setExpires] = useState(toDateInput(license?.expiresAt));
    const [note, setNote] = useState(license?.note || "");
    const [busy, setBusy] = useState(false);

    const plan = plans.find((item) => item.id === planId) || null;
    const finalProduct = plan?.bundle ? "both" : product;

    const dirty =
        planId !== (license?.plan || null) ||
        (planId && finalProduct !== (license?.product || "bookings")) ||
        status !== (license?.status || "active") ||
        expires !== toDateInput(license?.expiresAt) ||
        note !== (license?.note || "");

    const save = async (clear) => {
        setBusy(true);
        await onSave(
            company.handle,
            clear
                ? { plan: null }
                : { plan: planId, product: finalProduct, status, expiresAt: fromDateInput(expires), note }
        );
        if (clear) {
            setPlanId(null);
            setStatus("active");
            setExpires("");
            setNote("");
        }
        setBusy(false);
    };

    return (
        <div className="mm-license">

            {license?.source === "checkout" && (
                <p className="mm-muted"><Icon icon="solar:card-bold" /> Ativado por pagamento no Mercado Pago.</p>
            )}

            <p className="mm-label">Plano da empresa</p>
            <div className="mm-plans-pick">
                <button
                    type="button"
                    className={`mm-planpick is-none ${planId === null ? "is-on" : ""}`}
                    onClick={() => setPlanId(null)}
                >
                    <Icon icon="solar:close-circle-linear" />
                    <b>Sem plano</b>
                    <small>Painéis bloqueados</small>
                </button>

                {plans.map((item) => (
                    <button
                        key={item.id}
                        type="button"
                        className={`mm-planpick ${planId === item.id ? "is-on" : ""} ${item.active ? "" : "is-off"}`}
                        style={{ "--c": item.color }}
                        onClick={() => setPlanId(item.id)}
                    >
                        <Icon icon={item.bundle ? "solar:crown-star-bold" : "solar:ticket-bold"} />
                        <b>{item.name}</b>
                        <em>{item.tier}</em>
                        <small>{item.bundle ? "Bookings + Studio" : "Um produto"} · {formatPrice(item.price)}{item.active ? "" : " · oculto"}</small>
                    </button>
                ))}
            </div>

            {planId && !plan?.bundle && (
                <>
                    <p className="mm-label">Produto liberado</p>
                    <div className="mm-tiles">
                        {PRODUCTS.filter((item) => item.id === "bookings" || item.id === "studio").map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                className={`mm-tile ${product === item.id ? "is-on" : ""}`}
                                style={{ "--c": item.color }}
                                onClick={() => setProduct(item.id)}
                            >
                                <Icon icon={item.icon} />
                                <b>{item.label}</b>
                                <small>{item.hint}</small>
                            </button>
                        ))}
                    </div>
                </>
            )}

            {planId && plan?.bundle && (
                <p className="mm-muted"><Icon icon="solar:crown-star-bold" /> Este plano libera Bookings e Studio juntos.</p>
            )}

            {planId && (
                <>
                    <div className="mm-two">
                        <div>
                            <p className="mm-label">Situação</p>
                            <div className="mm-seg">
                                {LICENSE_STATUS.map((item) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        className={status === item.id ? "is-on" : ""}
                                        style={{ "--c": item.color }}
                                        onClick={() => setStatus(item.id)}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <label>
                            <p className="mm-label">Válido até <small>(vazio = sem vencimento)</small></p>
                            <input
                                type="date"
                                className="mm-plain-input"
                                value={expires}
                                onChange={(event) => setExpires(event.target.value)}
                            />
                        </label>
                    </div>

                    <label>
                        <p className="mm-label">Anotação interna</p>
                        <textarea
                            className="mm-plain-input"
                            rows={2}
                            maxLength={280}
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="Ex.: cortesia de lançamento, pagou por PIX…"
                        />
                    </label>
                </>
            )}

            {license?.updatedAt && (
                <p className="mm-muted">Última alteração em {formatDate(license.updatedAt)}</p>
            )}

            <div className="mm-license__foot">
                {license && (
                    <button className="mm-btn mm-btn--ghost-danger" disabled={busy} onClick={() => save(true)}>
                        <Icon icon="solar:trash-bin-minimalistic-linear" /> Remover plano
                    </button>
                )}
                <button className="mm-btn mm-btn--gold" disabled={busy || !dirty} onClick={() => save(false)}>
                    {busy ? <span className="mm-spin" /> : <Icon icon="solar:check-circle-bold" />}
                    {dirty ? "Salvar plano" : "Tudo salvo"}
                </button>
            </div>
        </div>
    );
}


/* =========================================================
   GAVETAS (pessoa e empresa)
========================================================= */

function DrawerShell({ label, onClose, head, children }) {

    useEffect(() => {
        const onKey = (event) => event.key === "Escape" && onClose();
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div className="mm-drawer-wrap">
            <button className="mm-drawer-scrim" aria-label="Fechar" onClick={onClose} />

            <aside className="mm-drawer" role="dialog" aria-label={label}>
                {head}
                <div className="mm-drawer__body">{children}</div>
            </aside>
        </div>
    );
}

function CompanyBlock({ company, onSave, onCopy, employee }) {

    return (
        <article className={`mm-company-mini ${employee ? "is-employee" : ""}`}>
            <div className="mm-company-mini__top">
                <b>{company.name}</b>
                {employee
                    ? <Chip color={ROLE_KINDS.employee.color}>trabalha aqui</Chip>
                    : <small>@{company.handle}</small>}
            </div>

            <div className="mm-company__access">
                <PlanChip
                    planId={company.license?.plan}
                    expired={Boolean(company.license?.expiresAt && company.license.expiresAt < NOW())}
                    suspended={company.license?.status === "suspended"}
                />
                {company.license && <ProductChip id={company.license.product} small />}
            </div>

            <div className="mm-links">
                <LinkPair url={company.links.bookings} label="Link Bookings" color={getProduct("bookings").color} onCopy={onCopy} />
                <LinkPair
                    url={company.links.studio}
                    label={
                        company.studio === "published"
                            ? "Link Studio"
                            : company.studio === "draft"
                                ? "Studio (rascunho)"
                                : "Studio (não criado)"
                    }
                    color={getProduct("studio").color}
                    muted={company.studio !== "published"}
                    onCopy={onCopy}
                />
            </div>

            <p className="mm-team-title">
                Funcionários ({company.team.filter((m) => m.role !== "master").length})
            </p>
            <ul className="mm-team">
                {company.team.map((member) => (
                    <li key={member.uid}>
                        <Avatar
                            uid={member.uid}
                            name={member.name}
                            color={member.role === "master" ? ROLE_KINDS.owner.color : ROLE_KINDS.employee.color}
                            size={28}
                        />
                        <span>
                            <b>{member.name}</b>
                            <small>{member.email}</small>
                        </span>
                        <em className={member.role === "master" ? "is-owner" : ""}>
                            {member.role === "master" ? "Admin" : "Profissional"}
                        </em>
                    </li>
                ))}
            </ul>

            <h3 className="mm-sub"><Icon icon="solar:ticket-bold" /> Acesso e plano</h3>
            <LicenseEditor key={company.handle + (company.license?.updatedAt || 0)} company={company} onSave={onSave} />
        </article>
    );
}

function PersonDrawer({ person, onClose, onSave, onCopy }) {

    const kind = ROLE_KINDS[person.kind];

    return (
        <DrawerShell
            label={`Detalhes de ${person.name}`}
            onClose={onClose}
            head={(
                <header className="mm-drawer__head" style={{ "--c": kind.color }}>
                    <Avatar uid={person.uid} name={person.name} color={kind.color} size={56} />
                    <div>
                        <h2>{person.name}</h2>
                        <p>{person.email || "sem e-mail"}</p>
                        <Chip color={kind.color} icon={kind.icon}>{kind.long}</Chip>
                    </div>
                    <button className="mm-icon-btn" onClick={onClose} aria-label="Fechar">
                        <Icon icon="solar:close-circle-bold" />
                    </button>
                </header>
            )}
        >
            <section className="mm-sec">
                <h3><Icon icon="solar:shop-2-bold" /> Empresa{person.ownedCompanies.length + person.workedCompanies.length > 1 ? "s" : ""}</h3>

                <p className="mm-muted">O plano é da empresa, não da pessoa. Quem administra a empresa herda o acesso dela.</p>

                {person.ownedCompanies.length === 0 && person.workedCompanies.length === 0 && (
                    <p className="mm-muted">Esta pessoa ainda não está em nenhuma empresa.</p>
                )}

                {person.ownedCompanies.map((company) => (
                    <CompanyBlock key={company.handle} company={company} onSave={onSave} onCopy={onCopy} />
                ))}

                {person.workedCompanies.map((company) => (
                    <CompanyBlock key={company.handle} company={company} onSave={onSave} onCopy={onCopy} employee />
                ))}
            </section>
        </DrawerShell>
    );
}

function CompanyDrawer({ company, onClose, onSave, onCopy }) {

    return (
        <DrawerShell
            label={`Plano de ${company.name}`}
            onClose={onClose}
            head={(
                <header className="mm-drawer__head" style={{ "--c": "#4160ff" }}>
                    <CompanyLogo handle={company.handle} name={company.name} size={56} />
                    <div>
                        <h2>{company.name}</h2>
                        <p>@{company.handle}</p>
                    </div>
                    <button className="mm-icon-btn" onClick={onClose} aria-label="Fechar">
                        <Icon icon="solar:close-circle-bold" />
                    </button>
                </header>
            )}
        >
            <section className="mm-sec">
                <CompanyBlock company={company} onSave={onSave} onCopy={onCopy} />
            </section>
        </DrawerShell>
    );
}


/* =========================================================
   VISÃO GERAL
========================================================= */

function Overview({ people, companies, onOpen, onGoPeople }) {

    const plans = usePlans();

    const stats = useMemo(() => {

        const byProduct = { none: 0, bookings: 0, studio: 0, both: 0 };
        const byPlan = { none: 0 };
        plans.forEach((plan) => { byPlan[plan.id] = 0; });

        let owners = 0, employees = 0, plain = 0;

        people.forEach((person) => {
            const s = stateOf(person);
            byProduct[s.product] += 1;
            byPlan[s.plan && s.plan in byPlan ? s.plan : "none"] += 1;

            if (person.kind === "owner") owners += 1;
            else if (person.kind === "employee") employees += 1;
            else plain += 1;
        });

        return {
            byProduct, byPlan, owners, employees, plain,
            published: companies.filter((c) => c.studio === "published").length,
            ownersWithout: people.filter(
                (p) => p.kind === "owner" && stateOf(p).product === "none"
            )
        };
    }, [people, companies, plans]);

    const latest = useMemo(
        () => [...people].filter((p) => p.license?.updatedAt)
            .sort((a, b) => b.license.updatedAt - a.license.updatedAt)
            .slice(0, 5),
        [people]
    );

    return (
        <div className="mm-stack">

            <div className="mm-kpis">
                <Kpi icon="solar:users-group-rounded-bold" label="Pessoas" value={people.length} hint="contas na plataforma" color="#ffb020" delay={0} />
                <Kpi icon="solar:crown-bold" label="Donos" value={stats.owners} hint="administram uma empresa" color={ROLE_KINDS.owner.color} delay={60} />
                <Kpi icon="solar:user-id-bold" label="Funcionários" value={stats.employees} hint="em equipes" color={ROLE_KINDS.employee.color} delay={120} />
                <Kpi icon="solar:shop-2-bold" label="Empresas" value={companies.length} hint={`${stats.published} com Studio no ar`} color="#fb7185" delay={180} />
            </div>

            <div className="mm-grid-2">

                <section className="mm-card">
                    <header className="mm-card__head">
                        <h3>Quem usa o quê</h3>
                        <span>acesso por produto</span>
                    </header>
                    <Meter
                        total={people.length}
                        rows={PRODUCTS.map((item) => ({
                            id: item.id, label: item.label, icon: item.icon,
                            color: item.color, value: stats.byProduct[item.id]
                        }))}
                    />
                </section>

                <section className="mm-card">
                    <header className="mm-card__head">
                        <h3>Distribuição de planos</h3>
                        <span>planos Markfy</span>
                    </header>
                    <Meter
                        total={people.length}
                        rows={[
                            ...plans.map((plan) => ({
                                id: plan.id, label: plan.tier ? `${plan.name} · ${plan.tier}` : plan.name, icon: plan.bundle ? "solar:crown-star-bold" : "solar:ticket-bold",
                                color: plan.color, value: stats.byPlan[plan.id]
                            })),
                            { id: "none", label: "Sem plano", icon: "solar:close-circle-linear", color: "#7b7f93", value: stats.byPlan.none }
                        ]}
                    />
                </section>
            </div>

            <div className="mm-grid-2">

                <section className="mm-card">
                    <header className="mm-card__head">
                        <h3>Donos sem acesso liberado</h3>
                        <span>{stats.ownersWithout.length} aguardando</span>
                    </header>

                    {stats.ownersWithout.length === 0 ? (
                        <p className="mm-empty-line">Todos os donos já têm acesso. 🎉</p>
                    ) : (
                        <ul className="mm-mini-list">
                            {stats.ownersWithout.slice(0, 6).map((person) => (
                                <li key={person.uid}>
                                    <Avatar uid={person.uid} name={person.name} color={ROLE_KINDS.owner.color} size={34} />
                                    <span>
                                        <b>{person.name}</b>
                                        <small>{person.ownedCompanies[0]?.name || person.email}</small>
                                    </span>
                                    <button className="mm-btn mm-btn--sm mm-btn--gold" onClick={() => onOpen(person.uid)}>
                                        Liberar
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}

                    {stats.ownersWithout.length > 6 && (
                        <button className="mm-link-btn" onClick={onGoPeople}>
                            Ver todos <Icon icon="solar:alt-arrow-right-linear" />
                        </button>
                    )}
                </section>

                <section className="mm-card">
                    <header className="mm-card__head">
                        <h3>Últimas alterações</h3>
                        <span>licenças</span>
                    </header>

                    {latest.length === 0 ? (
                        <p className="mm-empty-line">Nenhuma licença atribuída ainda.</p>
                    ) : (
                        <ul className="mm-mini-list">
                            {latest.map((person) => {
                                const s = stateOf(person);
                                return (
                                    <li key={person.uid}>
                                        <Avatar uid={person.uid} name={person.name} color={getProduct(s.product).color} size={34} />
                                        <span>
                                            <b>{person.name}</b>
                                            <small>{formatDate(person.license.updatedAt)}</small>
                                        </span>
                                        <ProductChip id={s.product} small />
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </section>
            </div>
        </div>
    );
}


/* =========================================================
   PESSOAS
========================================================= */

const KIND_FILTERS = [
    { id: "all", label: "Todos" },
    { id: "owner", label: "Donos" },
    { id: "employee", label: "Funcionários" },
    { id: "user", label: "Sem empresa" }
];

const SORTS = [
    { id: "name", label: "Nome (A–Z)" },
    { id: "recent", label: "Alterados recentemente" },
    { id: "company", label: "Empresa" }
];

function People({ people, filters, setFilters, onOpen, onBulk, onCopy, onExport }) {

    const plans = usePlans();

    const [selected, setSelected] = useState(() => new Set());
    const [bulkProduct, setBulkProduct] = useState("bookings");
    const [bulkPlan, setBulkPlan] = useState("__pick");

    const { query, kind, product, plan, sort } = filters;
    const patch = (next) => setFilters((old) => ({ ...old, ...next }));

    const rows = useMemo(() => {

        const q = query.trim().toLowerCase();

        const list = people.filter((person) => {
            const s = stateOf(person);

            if (kind !== "all" && person.kind !== kind) return false;
            if (product !== "all" && s.product !== product) return false;
            if (plan === "noplan" && s.plan) return false;
            if (plan !== "all" && plan !== "noplan" && s.plan !== plan) return false;

            if (!q) return true;

            const haystack = [
                person.name, person.email, person.uid,
                ...person.ownedCompanies.flatMap((c) => [c.name, c.handle]),
                ...person.workedCompanies.flatMap((c) => [c.name, c.handle])
            ].join(" ").toLowerCase();

            return haystack.includes(q);
        });

        if (sort === "recent") {
            list.sort((a, b) => (b.license?.updatedAt || 0) - (a.license?.updatedAt || 0));
        } else if (sort === "company") {
            const label = (p) => (p.ownedCompanies[0] || p.workedCompanies[0])?.name || "~";
            list.sort((a, b) => label(a).localeCompare(label(b), "pt-BR"));
        }

        return list;
    }, [people, query, kind, product, plan, sort]);

    const allOn = rows.length > 0 && rows.every((p) => selected.has(p.uid));

    const toggle = (uid) =>
        setSelected((old) => {
            const next = new Set(old);
            next.has(uid) ? next.delete(uid) : next.add(uid);
            return next;
        });

    const toggleAll = () =>
        setSelected(allOn ? new Set() : new Set(rows.map((p) => p.uid)));

    const applyBulk = async () => {
        await onBulk([...selected], { product: bulkProduct, plan: bulkPlan === "__remove" ? null : bulkPlan });
        setSelected(new Set());
    };

    return (
        <div className="mm-stack">

            <div className="mm-toolbar">
                <label className="mm-search">
                    <Icon icon="solar:magnifer-linear" />
                    <input
                        value={query}
                        onChange={(e) => patch({ query: e.target.value })}
                        placeholder="Buscar por nome, e-mail, empresa ou link…"
                    />
                    {query && (
                        <button type="button" onClick={() => patch({ query: "" })} aria-label="Limpar busca">
                            <Icon icon="solar:close-circle-bold" />
                        </button>
                    )}
                </label>

                <div className="mm-selects">
                    <select value={product} onChange={(e) => patch({ product: e.target.value })} aria-label="Filtrar por produto">
                        <option value="all">Todos os produtos</option>
                        {PRODUCTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>

                    <select value={plan} onChange={(e) => patch({ plan: e.target.value })} aria-label="Filtrar por plano">
                        <option value="all">Todos os planos</option>
                        <option value="noplan">Sem plano</option>
                        {plans.map((item) => <option key={item.id} value={item.id}>{item.name}{item.tier ? ` · ${item.tier}` : ""}</option>)}
                    </select>

                    <select value={sort} onChange={(e) => patch({ sort: e.target.value })} aria-label="Ordenar">
                        {SORTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>

                    <button className="mm-btn mm-btn--ghost" onClick={() => onExport(rows)} title="Baixar a lista filtrada em CSV">
                        <Icon icon="solar:download-minimalistic-bold" /> CSV
                    </button>
                </div>
            </div>

            <div className="mm-segs">
                {KIND_FILTERS.map((item) => {
                    const count = item.id === "all"
                        ? people.length
                        : people.filter((p) => p.kind === item.id).length;
                    return (
                        <button
                            key={item.id}
                            className={kind === item.id ? "is-on" : ""}
                            style={{ "--c": ROLE_KINDS[item.id]?.color || "#ffb020" }}
                            onClick={() => patch({ kind: item.id })}
                        >
                            {item.label} <b>{count}</b>
                        </button>
                    );
                })}
            </div>

            {selected.size > 0 && (
                <div className="mm-bulk">
                    <span><b>{selected.size}</b> selecionado{selected.size > 1 ? "s" : ""} · aplica às empresas que administram</span>
                    <select value={bulkPlan} onChange={(e) => setBulkPlan(e.target.value)} aria-label="Plano">
                        <option value="__pick" disabled>Escolha o plano…</option>
                        <option value="__remove">Remover plano</option>
                        {plans.map((item) => <option key={item.id} value={item.id}>{item.name}{item.tier ? ` · ${item.tier}` : ""}</option>)}
                    </select>
                    <select value={bulkProduct} onChange={(e) => setBulkProduct(e.target.value)} aria-label="Produto (planos de um produto só)">
                        {PRODUCTS.filter((item) => item.id === "bookings" || item.id === "studio").map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                    <button className="mm-btn mm-btn--gold mm-btn--sm" onClick={applyBulk} disabled={bulkPlan === "__pick"}>Aplicar</button>
                    <button className="mm-btn mm-btn--ghost mm-btn--sm" onClick={() => setSelected(new Set())}>Limpar</button>
                </div>
            )}

            <div className="mm-table" role="table">

                <div className="mm-row mm-row--head" role="row">
                    <label className="mm-check" aria-label="Selecionar todos">
                        <input type="checkbox" checked={allOn} onChange={toggleAll} />
                        <i />
                    </label>
                    <span>Pessoa</span>
                    <span>Tipo</span>
                    <span>Empresa e links</span>
                    <span>Acesso</span>
                    <span>Plano</span>
                    <span />
                </div>

                {rows.length === 0 && (
                    <div className="mm-empty">
                        <Icon icon="solar:ghost-bold" />
                        <b>Ninguém por aqui</b>
                        <p>Ajuste a busca ou os filtros.</p>
                    </div>
                )}

                {rows.map((person, index) => {
                    const kindInfo = ROLE_KINDS[person.kind];
                    const s = stateOf(person);
                    const company = person.ownedCompanies[0] || person.workedCompanies[0];

                    return (
                        <div
                            key={person.uid}
                            className={`mm-row ${selected.has(person.uid) ? "is-selected" : ""}`}
                            style={{ "--c": kindInfo.color, "--i": Math.min(index, 14) }}
                            role="row"
                        >
                            <label className="mm-check" data-label="">
                                <input
                                    type="checkbox"
                                    checked={selected.has(person.uid)}
                                    onChange={() => toggle(person.uid)}
                                    aria-label={`Selecionar ${person.name}`}
                                />
                                <i />
                            </label>

                            <button className="mm-who" onClick={() => onOpen(person.uid)}>
                                <Avatar uid={person.uid} name={person.name} color={kindInfo.color} />
                                <span>
                                    <b>{person.name}</b>
                                    <small>{person.email || "sem e-mail"}</small>
                                </span>
                            </button>

                            <span className="mm-cell" data-label="Tipo">
                                <Chip color={kindInfo.color} icon={kindInfo.icon}>{kindInfo.label}</Chip>
                            </span>

                            <span className="mm-cell mm-cell--company" data-label="Empresa">
                                {company ? (
                                    <>
                                        <b>{company.name}</b>
                                        {person.kind === "owner" ? (
                                            <span className="mm-links is-inline">
                                                <LinkPair url={company.links.bookings} label="Bookings" color={getProduct("bookings").color} onCopy={onCopy} />
                                                <LinkPair url={company.links.studio} label="Studio" color={getProduct("studio").color} muted={company.studio !== "published"} onCopy={onCopy} />
                                            </span>
                                        ) : (
                                            <small>funcionário</small>
                                        )}
                                        {person.kind === "owner" && (
                                            <small>{company.team.filter((m) => m.role !== "master").length} funcionário(s)
                                                {person.ownedCompanies.length > 1 && ` · +${person.ownedCompanies.length - 1} empresa(s)`}
                                            </small>
                                        )}
                                    </>
                                ) : (
                                    <small>—</small>
                                )}
                            </span>

                            <span className="mm-cell" data-label="Acesso">
                                <ProductChip id={s.product} />
                            </span>

                            <span className="mm-cell" data-label="Plano">
                                <PlanChip planId={s.plan} expired={s.expired} suspended={s.has && s.status === "suspended"} />
                            </span>

                            <button className="mm-row__go" onClick={() => onOpen(person.uid)} aria-label={`Abrir ${person.name}`}>
                                <Icon icon="solar:alt-arrow-right-linear" />
                            </button>
                        </div>
                    );
                })}
            </div>

            <p className="mm-count">{rows.length} de {people.length} pessoas</p>
        </div>
    );
}


/* =========================================================
   EMPRESAS
========================================================= */

function Companies({ companies, people, onOpen, onCopy, onManage, planFilter, clearPlanFilter }) {

    const [query, setQuery] = useState("");

    const byUid = useMemo(
        () => Object.fromEntries(people.map((p) => [p.uid, p])),
        [people]
    );

    const list = companies.filter((company) => {
        const q = query.trim().toLowerCase();

        if (planFilter === "noplan" && company.license?.plan) return false;
        if (planFilter && planFilter !== "noplan" && company.license?.plan !== planFilter) return false;

        return !q || `${company.name} ${company.handle}`.toLowerCase().includes(q);
    });

    const studioLabel = {
        published: { text: "Studio no ar", color: "#4ade80" },
        draft: { text: "Studio em rascunho", color: "#fbbf24" },
        none: { text: "Sem Studio", color: "#7b7f93" }
    };

    return (
        <div className="mm-stack">
            <label className="mm-search">
                <Icon icon="solar:magnifer-linear" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar empresa ou @handle…" />
            </label>

            {planFilter && (
                <button className="mm-btn mm-btn--ghost mm-btn--sm" style={{ alignSelf: "flex-start" }} onClick={clearPlanFilter}>
                    <Icon icon="solar:close-circle-bold" /> Filtro de plano: {planFilter === "noplan" ? "sem plano" : planFilter}
                </button>
            )}

            <div className="mm-company-grid">
                {list.map((company, index) => {
                    const owner = byUid[company.owners[0]?.uid];
                    const lic = company.license;
                    const label = studioLabel[company.studio];

                    return (
                        <article key={company.handle} className="mm-company" style={{ "--i": Math.min(index, 12) }}>
                            <header>
                                <CompanyLogo handle={company.handle} name={company.name} />
                                <div>
                                    <h3>{company.name}</h3>
                                    <small>@{company.handle}</small>
                                </div>
                                <Chip color={label.color}>{label.text}</Chip>
                            </header>

                            <div className="mm-links">
                                <LinkPair url={company.links.bookings} label="Link Bookings" color={getProduct("bookings").color} onCopy={onCopy} />
                                <LinkPair url={company.links.studio} label="Link Studio" color={getProduct("studio").color} muted={company.studio !== "published"} onCopy={onCopy} />
                            </div>

                            <div className="mm-company__owner">
                                <span>Dono</span>
                                {owner ? (
                                    <button onClick={() => onOpen(owner.uid)}>
                                        <Avatar uid={owner.uid} name={owner.name} color={ROLE_KINDS.owner.color} size={26} />
                                        {owner.name}
                                        <Icon icon="solar:alt-arrow-right-linear" />
                                    </button>
                                ) : <em>sem dono definido</em>}
                            </div>

                            <div className="mm-company__access">
                                <PlanChip
                                    planId={lic?.plan}
                                    expired={Boolean(lic?.expiresAt && lic.expiresAt < NOW())}
                                    suspended={lic?.status === "suspended"}
                                />
                                {lic && <ProductChip id={lic.product} small />}
                            </div>

                            <button className="mm-btn mm-btn--outline mm-btn--sm" style={{ "--c": "#4160ff" }} onClick={() => onManage(company.handle)}>
                                <Icon icon="solar:ticket-bold" /> Gerenciar plano
                            </button>

                            <p className="mm-team-title">Equipe ({company.team.length})</p>
                            <div className="mm-faces">
                                {company.team.slice(0, 8).map((member) => (
                                    <button
                                        key={member.uid}
                                        title={`${member.name} · ${member.role === "master" ? "Admin" : "Profissional"}`}
                                        onClick={() => onOpen(member.uid)}
                                    >
                                        <Avatar
                                            uid={member.uid}
                                            name={member.name}
                                            color={member.role === "master" ? ROLE_KINDS.owner.color : ROLE_KINDS.employee.color}
                                            size={32}
                                        />
                                    </button>
                                ))}
                                {company.team.length > 8 && <span className="mm-faces__more">+{company.team.length - 8}</span>}
                            </div>
                        </article>
                    );
                })}
            </div>

            {list.length === 0 && (
                <div className="mm-empty">
                    <Icon icon="solar:ghost-bold" />
                    <b>Nenhuma empresa encontrada</b>
                </div>
            )}
        </div>
    );
}


/* =========================================================
   PLANOS — CATÁLOGO EDITÁVEL

   Tudo que um plano oferece mora em planCatalog/{id} e é
   editado aqui: nome, preço, período, se inclui Bookings e
   Studio juntos, limites e recursos. As telas do site e o
   checkout leem esse mesmo catálogo.
========================================================= */

const slugify = (text) =>
    String(text || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 30);

const blankPlan = (order) => ({
    id: "",
    name: "",
    tier: "",
    tagline: "",
    price: 0,
    periodDays: 30,
    bundle: false,
    highlight: false,
    active: true,
    order,
    color: PLAN_COLORS[0],
    limits: {},
    features: {}
});

function PlanDrawer({ plan, isNew, usedBy, existingIds, onClose, onSave, onDelete }) {

    const [form, setForm] = useState(plan);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const patch = (next) => setForm((old) => ({ ...old, ...next }));

    const id = isNew ? slugify(form.name) : plan.id;

    const submit = async () => {

        if (!form.name.trim()) return setError("Dê um nome ao plano.");
        if (isNew && (!id || existingIds.includes(id))) return setError("Já existe um plano com esse nome.");
        if (!(Number(form.price) >= 0)) return setError("Preço inválido.");

        setError("");
        setBusy(true);
        await onSave(id, { ...form, price: Number(form.price) });
        setBusy(false);
        onClose();
    };

    const remove = async () => {
        setBusy(true);
        await onDelete(plan.id);
        setBusy(false);
        onClose();
    };

    return (
        <DrawerShell
            label={isNew ? "Novo plano" : `Editar ${plan.name}`}
            onClose={onClose}
            head={(
                <header className="mm-drawer__head" style={{ "--c": form.color }}>
                    <span className="mm-plancard__orb" style={{ "--c": form.color, margin: 0 }}>
                        <Icon icon={form.bundle ? "solar:crown-star-bold" : "solar:ticket-bold"} />
                    </span>
                    <div>
                        <h2>{isNew ? "Novo plano" : form.name || plan.id}</h2>
                        <p>{formatPrice(form.price)} a cada {form.periodDays} dias</p>
                    </div>
                    <button className="mm-icon-btn" onClick={onClose} aria-label="Fechar">
                        <Icon icon="solar:close-circle-bold" />
                    </button>
                </header>
            )}
        >
            <section className="mm-sec">
                <h3><Icon icon="solar:pen-bold" /> Identidade</h3>

                <div className="mm-two">
                    <label>
                        <p className="mm-label">Nome</p>
                        <input className="mm-plain-input" value={form.name} maxLength={40} onChange={(e) => patch({ name: e.target.value })} placeholder="Ex.: Pro" />
                    </label>
                    <label>
                        <p className="mm-label">Etiqueta do nível</p>
                        <input className="mm-plain-input" value={form.tier} maxLength={30} onChange={(e) => patch({ tier: e.target.value })} placeholder="Ex.: Nível 3" />
                    </label>
                </div>

                <label>
                    <p className="mm-label">Frase de apresentação</p>
                    <input className="mm-plain-input" value={form.tagline} maxLength={140} onChange={(e) => patch({ tagline: e.target.value })} placeholder="Uma linha que explica para quem é o plano" />
                </label>

                <div>
                    <p className="mm-label">Cor</p>
                    <div className="mm-swatches">
                        {PLAN_COLORS.map((color) => (
                            <button
                                key={color}
                                type="button"
                                className={form.color === color ? "is-on" : ""}
                                style={{ "--c": color }}
                                onClick={() => patch({ color })}
                                aria-label={`Cor ${color}`}
                            />
                        ))}
                        <input type="color" value={form.color} onChange={(e) => patch({ color: e.target.value })} aria-label="Outra cor" />
                    </div>
                </div>
            </section>

            <section className="mm-sec">
                <h3><Icon icon="solar:wallet-money-bold" /> Cobrança</h3>

                <div className="mm-two">
                    <label>
                        <p className="mm-label">Preço (R$)</p>
                        <input className="mm-plain-input" type="number" min="0" step="0.01" value={form.price} onChange={(e) => patch({ price: e.target.value })} />
                    </label>
                    <label>
                        <p className="mm-label">Período (dias)</p>
                        <input className="mm-plain-input" type="number" min="1" step="1" value={form.periodDays} onChange={(e) => patch({ periodDays: e.target.value })} />
                    </label>
                </div>

                <p className="mm-muted">
                    Cada pagamento libera o período acima. Preço abaixo de R$ 1,00 não pode ser vendido pelo checkout.
                </p>
            </section>

            <section className="mm-sec">
                <h3><Icon icon="solar:box-bold" /> Produtos incluídos</h3>

                <Toggle
                    checked={form.bundle}
                    onChange={(value) => patch({ bundle: value })}
                    title="Bookings + Studio juntos"
                    hint="Ligado: o plano libera os dois produtos. Desligado: a empresa escolhe um."
                />
            </section>

            <section className="mm-sec">
                <h3><Icon icon="solar:ruler-cross-pen-bold" /> Limites</h3>

                {LIMITS.map((limit) => {
                    const value = form.limits[limit.id];
                    const unlimited = value === null || value === undefined;

                    return (
                        <div key={limit.id} className="mm-limit">
                            <div>
                                <b>{limit.label}</b>
                                <small>{limit.hint}</small>
                            </div>
                            <input
                                className="mm-plain-input"
                                type="number"
                                min="0"
                                step="1"
                                disabled={unlimited}
                                value={unlimited ? "" : value}
                                placeholder="∞"
                                onChange={(e) => patch({ limits: { ...form.limits, [limit.id]: e.target.value } })}
                            />
                            <label className="mm-inline-check">
                                <input
                                    type="checkbox"
                                    checked={unlimited}
                                    onChange={(e) => patch({ limits: { ...form.limits, [limit.id]: e.target.checked ? null : 1 } })}
                                />
                                Ilimitado
                            </label>
                        </div>
                    );
                })}
            </section>

            <section className="mm-sec">
                <h3><Icon icon="solar:magic-stick-3-bold" /> Recursos</h3>

                {FEATURES.map((feature) => (
                    <Toggle
                        key={feature.id}
                        checked={form.features[feature.id] === true}
                        onChange={(value) => patch({ features: { ...form.features, [feature.id]: value } })}
                        title={feature.label}
                        hint={feature.hint}
                    />
                ))}
            </section>

            <section className="mm-sec">
                <h3><Icon icon="solar:eye-bold" /> Exibição</h3>

                <Toggle
                    checked={form.active}
                    onChange={(value) => patch({ active: value })}
                    title="Disponível para venda"
                    hint="Desligado: some da tela de planos e do checkout. Quem já tem continua com o plano."
                />
                <Toggle
                    checked={form.highlight}
                    onChange={(value) => patch({ highlight: value })}
                    title='Destaque "Mais completo"'
                    hint="Marca o cartão do plano na tela de planos."
                />

                <label>
                    <p className="mm-label">Ordem na tela</p>
                    <input className="mm-plain-input" type="number" min="1" step="1" value={form.order} onChange={(e) => patch({ order: e.target.value })} />
                </label>
            </section>

            {error && <p className="mm-error" role="alert"><Icon icon="solar:danger-triangle-bold" /> {error}</p>}

            <div className="mm-license__foot">
                {!isNew && (
                    <button
                        className="mm-btn mm-btn--ghost-danger"
                        disabled={busy || usedBy > 0}
                        title={usedBy > 0 ? `${usedBy} empresa(s) usam este plano` : "Excluir plano"}
                        onClick={remove}
                    >
                        <Icon icon="solar:trash-bin-minimalistic-linear" />
                        {usedBy > 0 ? `Em uso (${usedBy})` : "Excluir"}
                    </button>
                )}
                <button className="mm-btn mm-btn--gold" disabled={busy} onClick={submit}>
                    {busy ? <span className="mm-spin" /> : <Icon icon="solar:check-circle-bold" />}
                    {isNew ? "Criar plano" : "Salvar plano"}
                </button>
            </div>
        </DrawerShell>
    );
}

function Toggle({ checked, onChange, title, hint }) {
    return (
        <button type="button" className={`mm-toggle ${checked ? "is-on" : ""}`} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}>
            <span>
                <b>{title}</b>
                {hint && <small>{hint}</small>}
            </span>
            <i aria-hidden="true" />
        </button>
    );
}

function Plans({ companies, published, onFilter, onSavePlan, onDeletePlan, onSeed }) {

    const plans = usePlans();
    const [editing, setEditing] = useState(null);

    const usage = useMemo(() => {
        const out = { none: 0 };
        plans.forEach((plan) => { out[plan.id] = 0; });
        companies.forEach((company) => {
            const key = company.license?.plan;
            out[key && key in out ? key : "none"] += 1;
        });
        return out;
    }, [plans, companies]);

    return (
        <div className="mm-stack">

            {!published && (
                <div className="mm-warn">
                    <Icon icon="solar:danger-triangle-bold" />
                    <div>
                        <p><b>O catálogo ainda não foi publicado no banco.</b> O site mostra os valores padrão, mas o checkout só vende depois de publicar.</p>
                        <button className="mm-btn mm-btn--gold mm-btn--sm" style={{ marginTop: 10 }} onClick={onSeed}>
                            Publicar catálogo padrão
                        </button>
                    </div>
                </div>
            )}

            <div className="mm-plan-actions">
                <p className="mm-muted">Preços e limites iniciais são sugestões. Ajuste antes de abrir a cobrança.</p>
                <button className="mm-btn mm-btn--gold" onClick={() => setEditing({ isNew: true, plan: blankPlan(plans.length + 1) })}>
                    <Icon icon="solar:add-circle-bold" /> Novo plano
                </button>
            </div>

            <div className="mm-plan-grid">
                {plans.map((plan, index) => (
                    <article key={plan.id} className={`mm-plancard ${plan.active ? "" : "is-off"}`} style={{ "--c": plan.color, "--i": index }}>
                        <span className="mm-plancard__orb"><Icon icon={plan.bundle ? "solar:crown-star-bold" : "solar:ticket-bold"} /></span>
                        <p className="mm-plancard__tier">{plan.tier || "Plano"}{plan.active ? "" : " · oculto"}</p>
                        <h3>{plan.name}</h3>
                        <p className="mm-plancard__tag">{plan.tagline}</p>

                        <strong className="mm-plancard__count">{formatPrice(plan.price)}<small> /{plan.periodDays} dias</small></strong>

                        <div className="mm-plancard__split">
                            <span style={{ "--c": plan.bundle ? getProduct("both").color : getProduct("bookings").color }}>
                                {plan.bundle ? "Bookings + Studio" : "Um produto"}
                            </span>
                            <span>{usage[plan.id]} empresa{usage[plan.id] === 1 ? "" : "s"}</span>
                            {FEATURES.filter((f) => plan.features[f.id]).length > 0 && (
                                <span>{FEATURES.filter((f) => plan.features[f.id]).length}/{FEATURES.length} recursos</span>
                            )}
                        </div>

                        <div className="mm-plancard__btns">
                            <button className="mm-btn mm-btn--outline" onClick={() => setEditing({ isNew: false, plan })}>
                                <Icon icon="solar:pen-bold" /> Editar
                            </button>
                            <button className="mm-btn mm-btn--ghost" onClick={() => onFilter(plan.id)} aria-label={`Ver empresas no plano ${plan.name}`}>
                                <Icon icon="solar:alt-arrow-right-linear" />
                            </button>
                        </div>
                    </article>
                ))}

                <article className="mm-plancard" style={{ "--c": "#7b7f93", "--i": plans.length }}>
                    <span className="mm-plancard__orb"><Icon icon="solar:close-circle-linear" /></span>
                    <p className="mm-plancard__tier">Bloqueadas</p>
                    <h3>Sem plano</h3>
                    <p className="mm-plancard__tag">Empresas sem plano ativo não abrem o painel da Bookings nem do Studio.</p>
                    <strong className="mm-plancard__count">{usage.none}<small> empresa{usage.none === 1 ? "" : "s"}</small></strong>
                    <button className="mm-btn mm-btn--outline" onClick={() => onFilter("noplan")}>
                        Ver empresas <Icon icon="solar:alt-arrow-right-linear" />
                    </button>
                </article>
            </div>

            {editing && (
                <PlanDrawer
                    key={editing.plan.id || "new"}
                    plan={editing.plan}
                    isNew={editing.isNew}
                    usedBy={usage[editing.plan.id] || 0}
                    existingIds={plans.map((plan) => plan.id)}
                    onClose={() => setEditing(null)}
                    onSave={onSavePlan}
                    onDelete={onDeletePlan}
                />
            )}
        </div>
    );
}


/* =========================================================
   PAINEL
========================================================= */

const NAV = [
    { id: "overview", label: "Visão geral", icon: "solar:widget-5-bold" },
    { id: "people", label: "Pessoas", icon: "solar:users-group-rounded-bold" },
    { id: "companies", label: "Empresas", icon: "solar:shop-2-bold" },
    { id: "plans", label: "Planos", icon: "solar:cup-star-bold" }
];

const TITLES = {
    overview: ["Visão geral", "Como está a rede Markfy agora."],
    people: ["Pessoas", "Donos, funcionários e contas — com o acesso de cada um."],
    companies: ["Empresas", "Links, equipe, Studio e o plano de cada empresa."],
    plans: ["Planos Markfy", "Edite preços, limites e recursos. O que muda aqui vale no site."]
};

const DEFAULT_FILTERS = {
    query: "", kind: "all", product: "all", plan: "all", sort: "name"
};

function Dashboard({ user, mock }) {

    const [network, setNetwork] = useState({ people: [], companies: [], warnings: [] });
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState("overview");
    const [filters, setFilters] = useState(DEFAULT_FILTERS);
    const [openUid, setOpenUid] = useState(null);
    const [openHandle, setOpenHandle] = useState(null);
    const [companyPlanFilter, setCompanyPlanFilter] = useState(null);
    const [toast, setToast] = useState(null);
    const [photos, setPhotos] = useState({});

    const notify = useCallback((text, tone = "ok") => {
        setToast({ text, tone, id: Date.now() });
    }, []);

    useEffect(() => {
        if (!toast) return undefined;
        const id = setTimeout(() => setToast(null), 3400);
        return () => clearTimeout(id);
    }, [toast]);

    const refresh = useCallback(async () => {
        if (mock) {
            setNetwork(mock);
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            setNetwork(await loadNetwork());
        } catch (error) {
            notify("Falha ao carregar os dados.", "error");
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [notify, mock]);

    useEffect(() => { refresh(); }, [refresh]);

    useEffect(() => {
        let cancelled = false;
        const items = [
            ...network.people.map((p) => ({ key: p.uid, path: `users/${p.uid}/profileImg` })),
            ...network.companies.map((c) => ({ key: `c:${c.handle}`, path: `companys/${c.handle}/logo.png` }))
        ];
        if (!items.length || mock) return undefined;
        loadStorageImages(items, (batch) => {
            if (!cancelled) setPhotos((old) => ({ ...old, ...batch }));
        });
        return () => { cancelled = true; };
    }, [network.people.length, network.companies.length]); // eslint-disable-line react-hooks/exhaustive-deps

    const copy = useCallback(async (text) => {
        notify((await copyText(text)) ? "Link copiado" : "Não foi possível copiar", "ok");
    }, [notify]);

    /* ---- catálogo de planos ---- */

    const [catalog, setCatalog] = useState({ published: true, plans: [] });

    const reloadCatalog = useCallback(async () => {
        if (mock) {
            setCatalog({ published: true, plans: buildCatalog(null) });
            return;
        }
        try {
            const result = await loadCatalog();

            /* Primeiro acesso: publica o catálogo padrão sozinho, para o
               checkout já ter o que vender. */
            if (!result.published) {
                await seedCatalog();
                setCatalog(await loadCatalog());
                return;
            }

            setCatalog(result);
        } catch (error) {
            console.error(error);
            setCatalog({ published: false, plans: (await loadCatalog().catch(() => ({ plans: [] }))).plans });
        }
    }, [mock]);

    useEffect(() => { reloadCatalog(); }, [reloadCatalog]);

    const permissionMessage = (error, fallback) =>
        error?.code === "PERMISSION_DENIED" || /permission/i.test(error?.message || "")
            ? "Sem permissão no banco. Publique as regras de database.rules.proposta.json."
            : fallback;

    const handleSavePlan = useCallback(async (id, plan) => {
        try {
            await savePlan(id, plan);
            await reloadCatalog();
            notify("Plano salvo");
        } catch (error) {
            console.error(error);
            notify(permissionMessage(error, "Não foi possível salvar o plano."), "error");
        }
    }, [notify, reloadCatalog]);

    const handleDeletePlan = useCallback(async (id) => {
        try {
            await deletePlan(id);
            await reloadCatalog();
            notify("Plano excluído");
        } catch (error) {
            console.error(error);
            notify(permissionMessage(error, "Não foi possível excluir."), "error");
        }
    }, [notify, reloadCatalog]);

    const handleSeed = useCallback(async () => {
        try {
            await seedCatalog();
            await reloadCatalog();
            notify("Catálogo publicado");
        } catch (error) {
            console.error(error);
            notify(permissionMessage(error, "Não foi possível publicar."), "error");
        }
    }, [notify, reloadCatalog]);

    /* ---- licença da EMPRESA ---- */

    const updateCompanyLicense = useCallback((handle, license) => {
        setNetwork((old) => {

            const companies = old.companies.map((c) => c.handle === handle ? { ...c, license } : c);
            const byHandle = Object.fromEntries(companies.map((c) => [c.handle, c]));

            const people = old.people.map((person) => {
                const owned = person.ownedCompanies.map((c) => byHandle[c.handle] || c);
                const worked = person.workedCompanies.map((c) => byHandle[c.handle] || c);
                return {
                    ...person,
                    ownedCompanies: owned,
                    workedCompanies: worked,
                    license: (owned[0] || worked[0])?.license || null
                };
            });

            return { ...old, companies, people };
        });
    }, []);

    const toLicense = (saved) => saved && {
        plan: saved.plan, product: saved.product, status: saved.status,
        expiresAt: saved.expiresAt, note: saved.note, source: "master", updatedAt: saved.updatedAt
    };

    const handleSave = useCallback(async (handle, draft) => {
        try {
            const saved = await saveLicense(handle, draft);
            updateCompanyLicense(handle, toLicense(saved));
            notify(saved ? "Plano da empresa atualizado" : "Plano removido");
        } catch (error) {
            console.error(error);
            notify(permissionMessage(error, "Não foi possível salvar."), "error");
        }
    }, [notify, updateCompanyLicense]);

    /* Em lote: vale para as empresas que cada pessoa ADMINISTRA. */
    const handleBulk = useCallback(async (uids, draft) => {

        const handles = new Set();

        uids.forEach((uid) => {
            const person = network.people.find((p) => p.uid === uid);
            if (person) person.ownedCompanies.forEach((c) => handles.add(c.handle));
        });

        if (!handles.size) {
            notify("Ninguém selecionado administra uma empresa.", "error");
            return;
        }

        const plan = catalog.plans.find((item) => item.id === draft.plan);
        let done = 0;

        for (const handle of handles) {
            const company = network.companies.find((c) => c.handle === handle);
            try {
                const saved = await saveLicense(handle, draft.plan ? {
                    plan: draft.plan,
                    product: plan?.bundle ? "both" : draft.product,
                    status: company?.license?.status || "active",
                    expiresAt: company?.license?.expiresAt || null,
                    note: company?.license?.note || ""
                } : null);
                updateCompanyLicense(handle, toLicense(saved));
                done += 1;
            } catch (error) {
                console.error(error);
            }
        }

        notify(
            done === handles.size ? `${done} empresa(s) atualizada(s)` : `${done} de ${handles.size} atualizadas`,
            done === handles.size ? "ok" : "error"
        );
    }, [network, catalog.plans, notify, updateCompanyLicense]);

    const exportCsv = useCallback((rows) => {
        const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
        const lines = [
            ["Nome", "E-mail", "Tipo", "Empresa", "Link Bookings", "Link Studio", "Produto", "Plano", "Situação"],
            ...rows.map((p) => {
                const c = p.ownedCompanies[0] || p.workedCompanies[0];
                const s = stateOf(p);
                return [
                    p.name, p.email, ROLE_KINDS[p.kind].long, c?.name || "",
                    p.kind === "owner" ? c?.links.bookings : "",
                    p.kind === "owner" ? c?.links.studio : "",
                    getProduct(s.product).label, catalog.plans.find((item) => item.id === s.plan)?.name || "Sem plano",
                    s.has ? (s.status === "active" ? "Ativa" : "Suspensa") : "—"
                ];
            })
        ].map((line) => line.map(esc).join(";")).join("\n");

        const url = URL.createObjectURL(new Blob(["﻿" + lines], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "markfy-pessoas.csv";
        link.click();
        URL.revokeObjectURL(url);
    }, [catalog.plans]);

    const openPerson = network.people.find((p) => p.uid === openUid) || null;
    const openCompany = network.companies.find((c) => c.handle === openHandle) || null;

    const [title, subtitle] = TITLES[view];

    return (
        <PhotosContext.Provider value={photos}>
        <CatalogContext.Provider value={catalog.plans}>
        <div className="mm-app">

            <aside className="mm-side">
                <div className="mm-brand">
                    <span className="mm-brand__mark">
                        <img className="mm-logo" src="/markfy/logo.svg" alt="Markfy" />
                    </span>
                    <div>
                        <span className="mm-wordmark"><b>Markfy</b><span>Master</span></span>
                        <small>Dev · área do dono</small>
                    </div>
                </div>

                <div className="mm-nav" role="navigation" aria-label="Seções">
                    {NAV.map((item) => (
                        <button
                            key={item.id}
                            className={view === item.id ? "is-on" : ""}
                            onClick={() => setView(item.id)}
                        >
                            <Icon icon={item.icon} />
                            <span>{item.label}</span>
                        </button>
                    ))}
                </div>

                <div className="mm-side__foot">
                    <div className="mm-me">
                        <Avatar name="Master" color="#ffb020" size={34} />
                        <span>
                            <b>Conta master</b>
                            <small>{user.email}</small>
                        </span>
                    </div>
                    <button className="mm-btn mm-btn--ghost mm-btn--block" onClick={signOutMaster}>
                        <Icon icon="solar:logout-2-bold" /> Sair
                    </button>
                </div>
            </aside>

            <main className="mm-main">

                <header className="mm-top">
                    <div>
                        <p className="mm-eyebrow">Markfy Master Dev</p>
                        <h1 key={view}>{title}</h1>
                        <p className="mm-top__sub">{subtitle}</p>
                    </div>
                    <div className="mm-top__actions">
                        <button className="mm-btn mm-btn--ghost" onClick={refresh} disabled={loading}>
                            <Icon icon="solar:refresh-bold" className={loading ? "mm-rotate" : ""} /> Atualizar
                        </button>
                        <button className="mm-btn mm-btn--ghost mm-only-mobile" onClick={signOutMaster} aria-label="Sair">
                            <Icon icon="solar:logout-2-bold" />
                        </button>
                    </div>
                </header>

                {network.warnings.length > 0 && (
                    <div className="mm-warn">
                        <Icon icon="solar:danger-triangle-bold" />
                        <div>{network.warnings.map((w) => <p key={w}>{w}</p>)}</div>
                    </div>
                )}

                {loading ? (
                    <div className="mm-loading">
                        <div className="mm-skel" /><div className="mm-skel" /><div className="mm-skel" /><div className="mm-skel" />
                    </div>
                ) : (
                    <div className="mm-view" key={view}>
                        {view === "overview" && (
                            <Overview
                                people={network.people}
                                companies={network.companies}
                                onOpen={setOpenUid}
                                onGoPeople={() => {
                                    setFilters({ ...DEFAULT_FILTERS, kind: "owner", product: "none" });
                                    setView("people");
                                }}
                            />
                        )}

                        {view === "people" && (
                            <People
                                people={network.people}
                                filters={filters}
                                setFilters={setFilters}
                                onOpen={setOpenUid}
                                onBulk={handleBulk}
                                onCopy={copy}
                                onExport={exportCsv}
                            />
                        )}

                        {view === "companies" && (
                            <Companies
                                companies={network.companies}
                                people={network.people}
                                onOpen={setOpenUid}
                                onCopy={copy}
                                onManage={setOpenHandle}
                                planFilter={companyPlanFilter}
                                clearPlanFilter={() => setCompanyPlanFilter(null)}
                            />
                        )}

                        {view === "plans" && (
                            <Plans
                                companies={network.companies}
                                published={catalog.published}
                                onSavePlan={handleSavePlan}
                                onDeletePlan={handleDeletePlan}
                                onSeed={handleSeed}
                                onFilter={(plan) => {
                                    setCompanyPlanFilter(plan);
                                    setView("companies");
                                }}
                            />
                        )}
                    </div>
                )}
            </main>

            {/* Navegação inferior — só no celular. */}
            <div className="mm-tabbar" role="navigation" aria-label="Seções">
                {NAV.map((item) => (
                    <button key={item.id} className={view === item.id ? "is-on" : ""} onClick={() => setView(item.id)}>
                        <Icon icon={item.icon} />
                        <span>{item.label}</span>
                    </button>
                ))}
            </div>

            {openCompany && (
                <CompanyDrawer
                    key={openCompany.handle}
                    company={openCompany}
                    onClose={() => setOpenHandle(null)}
                    onSave={handleSave}
                    onCopy={copy}
                />
            )}

            {openPerson && (
                <PersonDrawer
                    key={openPerson.uid}
                    person={openPerson}
                    onClose={() => setOpenUid(null)}
                    onSave={handleSave}
                    onCopy={copy}
                />
            )}

            {toast && (
                <div key={toast.id} className={`mm-toast is-${toast.tone}`} role="status">
                    <Icon icon={toast.tone === "error" ? "solar:danger-triangle-bold" : "solar:check-circle-bold"} />
                    {toast.text}
                </div>
            )}
        </div>
        </CatalogContext.Provider>
        </PhotosContext.Provider>
    );
}


/* =========================================================
   RAIZ
========================================================= */

export default function MarkfyMasterDev() {

    const [user, setUser] = useState(null);
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        document.title = "Markfy Master Dev";

        const stop = watchMasterSession((master) => {
            setUser(master);
            setChecking(false);
        });

        return stop;
    }, []);

    return (
        <div className="mm-root">
            <div className="mm-ribbon">
                <span className="mm-ribbon__tag">Master</span>
                Ambiente restrito do dono da plataforma
            </div>

            {checking ? (
                <div className="mm-boot"><span className="mm-spin mm-spin--lg" /></div>
            ) : user ? (
                <Dashboard user={user} />
            ) : MOCK ? (
                <Dashboard user={{ email: MASTER_EMAIL }} mock={MOCK_NETWORK} />
            ) : (
                <Gate onUnlocked={setUser} />
            )}
        </div>
    );
}
