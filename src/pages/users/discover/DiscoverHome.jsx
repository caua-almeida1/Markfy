import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Icon } from "@iconify/react";
import Fuse from "fuse.js";

import { useAuth } from "../../../contexts/authContext";
import { useCompaniesIndex } from "../../../firebase/useCompaniesIndex";
import { useCompanyLogos } from "../../../firebase/companyLogo";
import { useCompanyPhotos } from "../../../firebase/companyPhotos";
import {
    CATEGORY_GROUPS,
    getCategoryLabel,
    getCompanyCategories
} from "../../../utils/companyCategories";
import {
    getRecentCompanies,
    getSavedCompanies,
    toggleSavedCompany
} from "../../../utils/bookingHistory";

import CompanyInfoModal from "../CompanyInfoModal/CompanyInfoModal";
import { Button, Skeleton, copyText, cx, useToast, ToastProvider } from "../../../design-system/components";
import { useMyReservations } from "./useMyReservations";

import markfyLogo from "../../../img/logo-markfy.svg";

import "./discover.css";

/* =========================================================
   CENTRAL DO USUÁRIO SEM EMPRESA — VITRINE

   /central-user sem handle. É a primeira impressão da
   Markfy Bookings para quem chega sem um link de empresa:
   um feed de negócios reais, com busca, categorias em
   formato de "stories", reservas da pessoa e salvos.

   Tudo vem de dados reais (companiesIndex, fotos no
   Storage, agendamentos). Nenhum número é inventado.
========================================================= */

const PAGE_SIZE = 6;
const INTRO_KEY = "markfy:discover-intro-dismissed";

const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Bom dia";
    if (hour < 18) return "Boa tarde";
    return "Boa noite";
};

/* Ordem que muda uma vez por dia: todo mundo ganha vez no
   topo do feed, sem a lista pular a cada visita. */
const dailyRank = (handle) => {
    const seed = new Date().toISOString().slice(0, 10);
    const text = `${seed}:${handle}`;
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
        hash = (hash * 31 + text.charCodeAt(i)) | 0;
    }
    return hash;
};

const groupOf = (company) => {
    const categories = getCompanyCategories(company);
    return CATEGORY_GROUPS.find((group) =>
        group.categories.some((id) => categories.includes(id))
    );
};

const companyCity = (company) =>
    [company?.location?.city, company?.location?.state].filter(Boolean).join(" - ");

const companyCategoryLabel = (company) => {
    const first = getCompanyCategories(company)[0];
    return first ? getCategoryLabel(first) : "";
};

const formatDate = (date) =>
    date
        ? date.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })
        : "";

/* ---------------------------------------------------------
   AVATAR
--------------------------------------------------------- */

const Avatar = ({ logo, name, size = 40, ring }) => {
    const [broken, setBroken] = useState(false);

    return (
        <span
            className={cx("dsc-avatar", ring && "dsc-avatar--ring")}
            style={{ width: size, height: size }}
            aria-hidden="true"
        >
            {logo && !broken ? (
                <img src={logo} alt="" loading="lazy" onError={() => setBroken(true)} />
            ) : (
                <span>{(name || "M").charAt(0).toUpperCase()}</span>
            )}
        </span>
    );
};

/* ---------------------------------------------------------
   POST DO FEED
--------------------------------------------------------- */

const CompanyPost = ({ company, logo, saved, onToggleSave, onAbout, onOpen, onShare }) => {
    const reduce = useReducedMotion();

    const rootRef = useRef(null);
    const trackRef = useRef(null);

    const [near, setNear] = useState(false);
    const [slide, setSlide] = useState(0);
    const [burst, setBurst] = useState(0);
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        const node = rootRef.current;
        if (!node || near) return undefined;

        const observer = new IntersectionObserver(
            ([entry]) => entry.isIntersecting && setNear(true),
            { rootMargin: "600px 0px" }
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [near]);

    const photos = useCompanyPhotos(company.handle, near);
    const media = (photos || []).slice(0, 6);

    const onScroll = () => {
        const track = trackRef.current;
        if (!track) return;
        setSlide(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)));
    };

    const goTo = (index) => {
        const track = trackRef.current;
        if (!track) return;
        track.scrollTo({ left: index * track.clientWidth, behavior: reduce ? "auto" : "smooth" });
    };

    /* Dois toques na foto salvam, como em qualquer feed. */
    const onDoubleClick = () => {
        if (!saved) onToggleSave();
        setBurst((value) => value + 1);
    };

    const description = company.description || "";
    const long = description.length > 120;

    return (
        <article className="dsc-post" ref={rootRef} aria-label={company.name}>
            <header className="dsc-post__head">
                <button type="button" className="dsc-post__who" onClick={onOpen}>
                    <Avatar logo={logo} name={company.name} ring />
                    <span>
                        <strong>{company.name}</strong>
                        <small>
                            {[companyCategoryLabel(company), companyCity(company)].filter(Boolean).join(", ") ||
                                `@${company.handle}`}
                        </small>
                    </span>
                </button>

                <Button
                    variant="ghost"
                    size="sm"
                    icon="solar:info-circle-linear"
                    aria-label={`Sobre ${company.name}`}
                    onClick={onAbout}
                />
            </header>

            <div className="dsc-post__media" onDoubleClick={onDoubleClick}>
                {photos === null ? (
                    <Skeleton height="100%" radius={0} className="dsc-post__skeleton" />
                ) : media.length ? (
                    <div className="dsc-post__track" ref={trackRef} onScroll={onScroll}>
                        {media.map((url, index) => (
                            <img
                                key={url}
                                src={url}
                                alt={`Foto ${index + 1} de ${company.name}`}
                                loading="lazy"
                                draggable="false"
                            />
                        ))}
                    </div>
                ) : (
                    <div className="dsc-post__cover">
                        <Avatar logo={logo} name={company.name} size={88} />
                        <strong>{company.name}</strong>
                        <span>{companyCategoryLabel(company) || "Na Markfy Bookings"}</span>
                    </div>
                )}

                {media.length > 1 && (
                    <>
                        <span className="dsc-post__count">{slide + 1}/{media.length}</span>
                        {slide > 0 && (
                            <button type="button" className="dsc-post__nav dsc-post__nav--prev" aria-label="Foto anterior" onClick={() => goTo(slide - 1)}>
                                <Icon icon="solar:alt-arrow-left-linear" />
                            </button>
                        )}
                        {slide < media.length - 1 && (
                            <button type="button" className="dsc-post__nav dsc-post__nav--next" aria-label="Próxima foto" onClick={() => goTo(slide + 1)}>
                                <Icon icon="solar:alt-arrow-right-linear" />
                            </button>
                        )}
                    </>
                )}

                {media.length > 1 && (
                    <span className="dsc-post__dots" aria-hidden="true">
                        {media.map((url, index) => (
                            <i key={url} className={index === slide ? "is-on" : ""} />
                        ))}
                    </span>
                )}

                <AnimatePresence>
                    {burst > 0 && (
                        <motion.span
                            key={burst}
                            className="dsc-post__burst"
                            initial={{ scale: 0.3, opacity: 0 }}
                            animate={{ scale: [0.3, 1.15, 1], opacity: [0, 1, 1] }}
                            exit={{ scale: 1.3, opacity: 0 }}
                            transition={{ duration: 0.45 }}
                            onAnimationComplete={() => setTimeout(() => setBurst(0), 380)}
                            aria-hidden="true"
                        >
                            <Icon icon="solar:bookmark-bold" />
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>

            <div className="dsc-post__actions">
                <Button variant="primary" size="sm" onClick={onOpen} iconRight="solar:arrow-right-linear">
                    Ver serviços e agendar
                </Button>

                <span className="dsc-post__icons">
                    <motion.button
                        type="button"
                        className={cx("dsc-icon-btn", saved && "is-on")}
                        aria-pressed={saved}
                        aria-label={saved ? "Remover dos salvos" : "Salvar empresa"}
                        onClick={onToggleSave}
                        whileTap={{ scale: 0.82 }}
                    >
                        <Icon icon={saved ? "solar:bookmark-bold" : "solar:bookmark-linear"} />
                    </motion.button>
                    <motion.button
                        type="button"
                        className="dsc-icon-btn"
                        aria-label="Compartilhar"
                        onClick={onShare}
                        whileTap={{ scale: 0.82 }}
                    >
                        <Icon icon="solar:square-share-line-linear" />
                    </motion.button>
                </span>

            </div>

            {description && (
                <p className={cx("dsc-post__caption", expanded && "is-open")}>
                    <strong>{company.handle}</strong> {description}
                    {long && !expanded && (
                        <button type="button" onClick={() => setExpanded(true)}>mais</button>
                    )}
                </p>
            )}
        </article>
    );
};

/* ---------------------------------------------------------
   TELA
--------------------------------------------------------- */

const DiscoverHomeView = ({ onOpenTab }) => {
    const navigate = useNavigate();
    const notify = useToast();
    const reduce = useReducedMotion();

    const { currentUser } = useAuth();
    const { companies, loading } = useCompaniesIndex();
    const logos = useCompanyLogos(companies);
    const { reservations, loading: loadingReservations } = useMyReservations();

    const [term, setTerm] = useState("");
    const [group, setGroup] = useState("all");
    const [saved, setSaved] = useState(getSavedCompanies);
    const [visible, setVisible] = useState(PAGE_SIZE);
    const [about, setAbout] = useState(null);
    const [introOpen, setIntroOpen] = useState(() => {
        try {
            return localStorage.getItem(INTRO_KEY) !== "1";
        } catch {
            return true;
        }
    });

    const sentinelRef = useRef(null);

    const firstName = (currentUser?.displayName || "").split(" ")[0];

    const byHandle = useMemo(
        () => Object.fromEntries(companies.map((company) => [company.handle, company])),
        [companies]
    );

    const fuse = useMemo(
        () =>
            new Fuse(
                companies.map((company) => ({
                    ...company,
                    categoryText: getCompanyCategories(company).map(getCategoryLabel).join(" "),
                    cityText: companyCity(company)
                })),
                {
                    keys: [
                        { name: "name", weight: 0.5 },
                        { name: "categoryText", weight: 0.25 },
                        { name: "description", weight: 0.15 },
                        { name: "cityText", weight: 0.1 }
                    ],
                    threshold: 0.36,
                    ignoreLocation: true
                }
            ),
        [companies]
    );

    const results = useMemo(
        () => (term.trim() ? fuse.search(term.trim()).slice(0, 8).map((hit) => hit.item) : []),
        [fuse, term]
    );

    const groups = useMemo(
        () =>
            CATEGORY_GROUPS.map((item) => ({
                ...item,
                count: companies.filter((company) => groupOf(company)?.id === item.id).length
            })),
        [companies]
    );

    const feed = useMemo(() => {
        let list = [...companies].sort((a, b) => dailyRank(a.handle) - dailyRank(b.handle));

        if (group === "saved") list = saved.map((handle) => byHandle[handle]).filter(Boolean);
        else if (group !== "all") list = list.filter((company) => groupOf(company)?.id === group);

        return list;
    }, [companies, group, saved, byHandle]);

    const recent = useMemo(
        () => getRecentCompanies().map((handle) => byHandle[handle]).filter(Boolean).slice(0, 10),
        [byHandle]
    );

    const upcoming = reservations.filter((item) => item.upcoming).slice(0, 6);

    useEffect(() => setVisible(PAGE_SIZE), [group]);

    /* Rolagem contínua: carrega mais posts perto do fim. */
    useEffect(() => {
        const node = sentinelRef.current;
        if (!node) return undefined;

        const observer = new IntersectionObserver(
            ([entry]) => entry.isIntersecting && setVisible((value) => value + PAGE_SIZE),
            { rootMargin: "800px 0px" }
        );

        observer.observe(node);
        return () => observer.disconnect();
    }, [feed.length]);

    const openCompany = (handle) => navigate(`/central-user/${handle}?tab=home`);

    const onToggleSave = (handle) => {
        const nowSaved = toggleSavedCompany(handle);
        setSaved(getSavedCompanies());
        notify(
            "success",
            nowSaved ? "Empresa salva" : "Removida dos salvos",
            nowSaved ? "Encontre em Salvos, no topo do feed." : ""
        );
    };

    const onShare = async (company) => {
        const url = `${window.location.origin}/central-user/${company.handle}`;

        if (navigator.share) {
            try {
                await navigator.share({ title: company.name, text: company.description || company.name, url });
                return;
            } catch (error) {
                if (error?.name === "AbortError") return;
            }
        }

        const ok = await copyText(url);
        notify(ok ? "success" : "error", ok ? "Link copiado" : "Não foi possível copiar", ok ? url : "Copie o endereço pela barra do navegador.");
    };

    const dismissIntro = () => {
        setIntroOpen(false);
        try {
            localStorage.setItem(INTRO_KEY, "1");
        } catch {
            /* ignora */
        }
    };

    const reservationsBlock = (
        <section className="dsc-block" aria-labelledby="dsc-res-title">
            <div className="dsc-block__head">
                <h2 id="dsc-res-title">Suas próximas reservas</h2>
                <button type="button" className="dsc-link" onClick={() => onOpenTab?.("reservas")}>
                    Ver todas
                </button>
            </div>

            {loadingReservations ? (
                <Skeleton height={64} radius={16} />
            ) : upcoming.length ? (
                <div className="dsc-res-list">
                    {upcoming.map((item) => (
                        <button
                            type="button"
                            key={`${item.handle}-${item.id}`}
                            className="dsc-res"
                            onClick={() => navigate(`/central-user/${item.handle}?tab=reservas`)}
                        >
                            <Avatar logo={logos[item.handle]} name={item.companyName} size={40} />
                            <span className="dsc-res__text">
                                <strong>{item.productName || "Serviço"}</strong>
                                <small>{item.companyName}</small>
                            </span>
                            <span className="dsc-res__when">
                                <strong>{item.hour}</strong>
                                <small>{formatDate(item.date)}</small>
                            </span>
                        </button>
                    ))}
                </div>
            ) : (
                <p className="dsc-note">
                    Nada marcado por aqui. Quando você agendar em qualquer empresa da Markfy, a reserva
                    aparece nesta lista.
                </p>
            )}
        </section>
    );

    return (
        <div className="mk-root dsc">
            <header className="dsc-top">
                <span className="dsc-brand">
                    <img src={markfyLogo} alt="" />
                    <span>
                        Markfy <em>Bookings</em>
                    </span>
                </span>

                {currentUser ? (
                    <button type="button" className="dsc-me" onClick={() => onOpenTab?.("perfil")} aria-label="Abrir meu perfil">
                        <Avatar name={firstName || currentUser.email} size={36} />
                    </button>
                ) : (
                    <Button variant="outline" size="sm" onClick={() => navigate("/login?redirect=/central-user")}>
                        Entrar
                    </Button>
                )}
            </header>

            <div className="dsc-layout">
                <main className="dsc-main">
                    <section className="dsc-hello">
                        <h1 className="mk-title mk-title--lg">
                            {firstName ? `${greeting()}, ${firstName}` : "Encontre onde agendar"}
                        </h1>
                        <p className="mk-lead">
                            {loading
                                ? "Carregando empresas da Markfy Bookings…"
                                : `${companies.length} ${companies.length === 1 ? "empresa atende" : "empresas atendem"} com hora marcada pela Markfy. Busque pelo nome, serviço ou cidade.`}
                        </p>

                        <div className="dsc-search" role="search">
                            <span className="mk-input-group">
                                <Icon icon="solar:magnifer-linear" aria-hidden="true" />
                                <input
                                    className="mk-input"
                                    type="search"
                                    placeholder="Barbearia, pilates, nome da empresa…"
                                    value={term}
                                    onChange={(event) => setTerm(event.target.value)}
                                    aria-label="Buscar empresas"
                                    aria-controls="dsc-search-results"
                                />
                            </span>

                            <AnimatePresence>
                                {term.trim() && (
                                    <motion.div
                                        id="dsc-search-results"
                                        className="dsc-results"
                                        initial={{ opacity: 0, y: reduce ? 0 : -6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: reduce ? 0 : -6 }}
                                        transition={{ duration: 0.18 }}
                                    >
                                        {results.length ? (
                                            results.map((company) => (
                                                <button
                                                    type="button"
                                                    key={company.handle}
                                                    className="dsc-result"
                                                    onClick={() => openCompany(company.handle)}
                                                >
                                                    <Avatar logo={logos[company.handle]} name={company.name} size={38} />
                                                    <span>
                                                        <strong>{company.name}</strong>
                                                        <small>
                                                            {[companyCategoryLabel(company), companyCity(company)].filter(Boolean).join(", ") || `@${company.handle}`}
                                                        </small>
                                                    </span>
                                                    <Icon icon="solar:arrow-right-up-linear" aria-hidden="true" />
                                                </button>
                                            ))
                                        ) : (
                                            <p className="dsc-note">
                                                Nenhuma empresa encontrada para “{term.trim()}”. Tente o tipo de
                                                serviço, como “corte” ou “pilates”.
                                            </p>
                                        )}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </section>

                    <div className="dsc-stories" role="tablist" aria-label="Filtrar por categoria">
                        {[
                            { id: "all", name: "Tudo", icon: "solar:widget-5-linear", count: companies.length },
                            ...(saved.length ? [{ id: "saved", name: "Salvos", icon: "solar:bookmark-linear", count: saved.length }] : []),
                            ...groups
                        ].map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                role="tab"
                                aria-selected={group === item.id}
                                className={cx("dsc-story", group === item.id && "is-active", !item.count && "is-empty")}
                                onClick={() => setGroup(item.id)}
                            >
                                <span className="dsc-story__ring">
                                    <span className="dsc-story__bubble">
                                        <Icon icon={item.icon} />
                                    </span>
                                </span>
                                <span className="dsc-story__label">{item.name}</span>
                            </button>
                        ))}
                    </div>

                    <AnimatePresence initial={false}>
                        {introOpen && (
                            <motion.section
                                className="dsc-intro"
                                aria-label="Como funciona"
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                transition={{ duration: 0.3 }}
                            >
                                <div className="dsc-intro__inner">
                                    <div className="dsc-intro__head">
                                        <strong>Agendar pela Markfy leva menos de um minuto</strong>
                                        <Button variant="ghost" size="sm" icon="solar:close-circle-linear" aria-label="Dispensar" onClick={dismissIntro} />
                                    </div>
                                    <ol>
                                        <li>
                                            <Icon icon="solar:shop-2-linear" />
                                            <span><strong>Escolha a empresa</strong>pelo feed, pela busca ou pelas categorias.</span>
                                        </li>
                                        <li>
                                            <Icon icon="solar:calendar-linear" />
                                            <span><strong>Escolha serviço e horário</strong>com o profissional que preferir.</span>
                                        </li>
                                        <li>
                                            <Icon icon="solar:check-circle-linear" />
                                            <span><strong>Pronto</strong>a reserva aparece em Reservas, nesta tela.</span>
                                        </li>
                                    </ol>
                                </div>
                            </motion.section>
                        )}
                    </AnimatePresence>

                    <div className="dsc-only-mobile">{(upcoming.length > 0 || loadingReservations) && reservationsBlock}</div>

                    {recent.length > 0 && group === "all" && (
                        <section className="dsc-block" aria-labelledby="dsc-recent-title">
                            <div className="dsc-block__head">
                                <h2 id="dsc-recent-title">Você visitou</h2>
                            </div>
                            <div className="dsc-recent">
                                {recent.map((company) => (
                                    <button type="button" key={company.handle} className="dsc-recent__item" onClick={() => openCompany(company.handle)}>
                                        <Avatar logo={logos[company.handle]} name={company.name} size={56} />
                                        <span>{company.name}</span>
                                    </button>
                                ))}
                            </div>
                        </section>
                    )}

                    <section className="dsc-feed" aria-label="Empresas na Markfy Bookings" aria-busy={loading}>
                        {loading ? (
                            [0, 1].map((key) => (
                                <div key={key} className="dsc-post dsc-post--loading">
                                    <div className="dsc-post__head">
                                        <Skeleton width={40} height={40} radius={40} />
                                        <Skeleton width="40%" height={14} />
                                    </div>
                                    <Skeleton height={340} radius={0} />
                                </div>
                            ))
                        ) : feed.length ? (
                            feed.slice(0, visible).map((company) => (
                                <CompanyPost
                                    key={company.handle}
                                    company={company}
                                    logo={logos[company.handle]}
                                    saved={saved.includes(company.handle)}
                                    onToggleSave={() => onToggleSave(company.handle)}
                                    onAbout={() => setAbout(company)}
                                    onOpen={() => openCompany(company.handle)}
                                    onShare={() => onShare(company)}
                                />
                            ))
                        ) : (
                            <div className="dsc-empty">
                                <Icon icon="solar:shop-2-linear" />
                                <strong>
                                    {group === "saved" ? "Você ainda não salvou empresas" : "Nenhuma empresa nesta categoria ainda"}
                                </strong>
                                <p>
                                    {group === "saved"
                                        ? "Toque no marcador de um post, ou dê dois toques na foto, para salvar."
                                        : "Veja todas as empresas ou procure pelo nome."}
                                </p>
                                <Button variant="outline" size="sm" onClick={() => setGroup("all")}>Ver todas</Button>
                            </div>
                        )}
                        {!loading && visible < feed.length && <div ref={sentinelRef} className="dsc-sentinel" aria-hidden="true" />}
                        {!loading && feed.length > 0 && visible >= feed.length && (
                            <p className="dsc-end">Você viu todas as empresas desta lista.</p>
                        )}
                    </section>
                </main>

                <aside className="dsc-aside" aria-label="Seu espaço">
                    <div className="dsc-aside__inner">
                        {currentUser ? (
                            <button type="button" className="dsc-profile" onClick={() => onOpenTab?.("perfil")}>
                                <Avatar name={firstName || currentUser.email} size={48} />
                                <span>
                                    <strong>{currentUser.displayName || "Minha conta"}</strong>
                                    <small>{currentUser.email}</small>
                                </span>
                            </button>
                        ) : (
                            <div className="dsc-profile dsc-profile--guest">
                                <strong>Entre para ver suas reservas em qualquer aparelho</strong>
                                <Button variant="primary" size="sm" onClick={() => navigate("/login?redirect=/central-user")}>
                                    Entrar ou criar conta
                                </Button>
                            </div>
                        )}

                        {reservationsBlock}

                        <section className="dsc-block" aria-labelledby="dsc-cat-title">
                            <div className="dsc-block__head">
                                <h2 id="dsc-cat-title">Categorias</h2>
                            </div>
                            <ul className="dsc-cats">
                                {groups.map((item) => (
                                    <li key={item.id}>
                                        <button type="button" onClick={() => setGroup(item.id)} aria-pressed={group === item.id}>
                                            <Icon icon={item.icon} />
                                            <span>{item.name}</span>
                                            <small>{item.count}</small>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section className="dsc-biz">
                            <strong>Tem um negócio?</strong>
                            <p>Receba agendamentos pela Markfy e crie a página da sua empresa no Studio.</p>
                            <Button variant="outline" size="sm" onClick={() => navigate("/home/bookings")}>
                                Começar com meu negócio
                            </Button>
                        </section>
                    </div>
                </aside>
            </div>

            <CompanyInfoModal
                isOpen={Boolean(about)}
                companyName={about?.name || "Empresa"}
                companyHandle={about?.handle}
                companyLogo={about ? logos[about.handle] : null}
                onClose={() => setAbout(null)}
            />
        </div>
    );
};

const DiscoverHome = (props) => (
    <ToastProvider>
        <DiscoverHomeView {...props} />
    </ToastProvider>
);

export default DiscoverHome;
