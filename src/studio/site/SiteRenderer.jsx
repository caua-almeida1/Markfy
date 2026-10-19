import React, { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";

import { CHANNELS, SECTION_TYPES, resolveTheme } from "./schema";
import { formatHours, whatsappLink } from "../data/companyBundle";
import { submitLead, trackEvent } from "../data/studioApi";
import { markBookingSource } from "../../utils/bookingHistory";
import { formatDurationLabel } from "../../utils/combo";

import "./site.css";
import "./site-blocks.css";

/* =========================================================
   RENDERIZADOR DAS PÁGINAS DO STUDIO

   Um só componente para os três usos:

     mode="edit"     dentro do editor: clique seleciona a
                     seção, links não navegam, seções vazias
                     mostram o que falta preencher;
     mode="preview"  pré-visualização fiel, sem métricas;
     mode="public"   a página publicada, com métricas e
                     formulário de verdade.

   O layout responde ao CONTAINER (container queries), não à
   janela: por isso a prévia de 390px do editor é o layout
   de celular de verdade, sem iframe.
========================================================= */

const loadedFonts = new Set();

export const useSiteFonts = (fontKey) => {
    useEffect(() => {
        const { font } = resolveTheme({ font: fontKey });

        font.google.forEach((family) => {
            if (loadedFonts.has(family)) return;
            loadedFonts.add(family);

            const link = document.createElement("link");
            link.rel = "stylesheet";
            link.href = `https://fonts.googleapis.com/css2?family=${family}&display=swap`;
            document.head.appendChild(link);
        });
    }, [fontKey]);
};

const NAV_LABELS = {
    catalog: "Produtos",
    properties: "Imóveis",
    services: "Serviços",
    packages: "Pacotes",
    team: "Equipe",
    gallery: "Galeria",
    booking: "Agendar",
    channels: "Pedir",
    faq: "Dúvidas",
    contact: "Contato",
    form: "Contato"
};

const isHttp = (url) => /^https?:\/\//i.test(url || "");

const validChannels = (items = []) => items.filter((item) => CHANNELS[item.channel] && isHttp(item.url));

/* Seção sem conteúdo não aparece para o visitante. */
const isEmpty = (section, bundle) => {
    const { props } = section;

    switch (section.type) {
        case "about":
            return !props.text?.trim();
        case "services":
            return props.source === "manual" ? !props.items?.length : !bundle?.products?.length;
        case "team":
            return props.source === "manual" ? !props.items?.length : !bundle?.professionals?.length;
        case "gallery":
            return !props.images?.length;
        case "testimonials":
            return !props.items?.filter((item) => item.text?.trim()).length;
        case "faq":
            return !props.items?.filter((item) => item.q?.trim()).length;
        case "booking":
            return !bundle?.products?.length;
        case "social":
            return !bundle?.socials?.length && !props.links?.filter((link) => link.url).length;
        case "steps":
            return !props.items?.filter((item) => item.title?.trim()).length;
        case "packages":
            return !props.items?.filter((item) => item.name?.trim()).length;
        case "catalog":
            return !props.items?.filter((item) => item.name?.trim() && (props.showSold || !item.sold)).length;
        case "properties":
            return !props.items?.filter((item) => item.title?.trim()).length;
        case "channels":
            return !validChannels(props.items).length;
        default:
            return false;
    }
};

const EMPTY_HINTS = {
    about: "Escreva um texto sobre o negócio para esta seção aparecer.",
    services: "Nenhum serviço ainda. Cadastre na Markfy Bookings ou escreva aqui.",
    team: "Nenhum profissional encontrado. Adicione manualmente ou convide sua equipe.",
    gallery: "Adicione fotos para a galeria aparecer na página.",
    testimonials: "Adicione depoimentos reais. Sem eles, a seção fica escondida.",
    faq: "Adicione perguntas para esta seção aparecer.",
    booking: "Cadastre serviços na Markfy Bookings para receber agendamentos aqui.",
    social: "Cadastre suas redes em Minha empresa ou adicione links.",
    steps: "Descreva as etapas do seu atendimento.",
    packages: "Adicione pacotes ou planos com nome e preço.",
    catalog: "Adicione seus produtos com foto e preço para montar a vitrine.",
    properties: "Cadastre os imóveis com foto, preço e características.",
    channels: "Cole os links da sua loja no iFood, 99Food, Mercado Livre ou outros apps."
};

/* ---------------------------------------------------------
   AÇÕES
--------------------------------------------------------- */

const useActions = ({ bundle, mode, sections }) =>
    useMemo(() => {
        const handle = bundle?.handle;
        const isPublic = mode === "public";

        const anchorTo = (type) => {
            const target = sections.find((section) => section.type === type && !section.hidden);
            return target ? `#mks-${target.id}` : "#";
        };

        const booking = (productId) => ({
            href: handle ? `/central-user/${handle}${productId ? `?product=${productId}` : "?tab=home"}` : "#",
            onClick: () => {
                if (!isPublic) return;
                markBookingSource(handle, "studio");
                trackEvent(handle, "booking_click");
            }
        });

        const external = (url, event) => ({
            href: url,
            target: "_blank",
            rel: "noopener noreferrer",
            onClick: () => isPublic && trackEvent(handle, event)
        });

        const whatsapp = (message) => {
            const href = whatsappLink(bundle?.whatsapp, message || `Olá! Vim pela página da ${bundle?.name || "empresa"}.`);
            return href ? external(href, "whatsapp_click") : null;
        };

        const resolve = (button) => {
            if (!button?.label) return null;

            switch (button.action) {
                case "booking":
                    return booking();
                case "whatsapp":
                    return whatsapp();
                case "channel":
                    return isHttp(button.url) ? external(button.url, "channel_click") : null;
                case "anchor":
                    return { href: anchorTo(button.url || "form") };
                case "url":
                    return isHttp(button.url) ? external(button.url, "social_click") : null;
                default:
                    return null;
            }
        };

        return { resolve, booking, whatsapp, external, anchorTo, isPublic };
    }, [bundle, mode, sections]);

const ActionButton = ({ button, actions, variant = "solid", className = "" }) => {
    const resolved = actions.resolve(button);

    if (!resolved) return null;

    const channel = button.action === "channel" ? CHANNELS[button.channel] : null;

    return (
        <a className={`mks-btn mks-btn--${variant} ${className}`} {...resolved}>
            {button.action === "whatsapp" && <Icon icon="ic:baseline-whatsapp" aria-hidden="true" />}
            {channel && <Icon icon={channel.icon} aria-hidden="true" />}
            <span>{button.label}</span>
        </a>
    );
};

const SectionHead = ({ title, subtitle, center }) =>
    title || subtitle ? (
        <header className={`mks-head ${center ? "mks-head--center" : ""}`}>
            {title && <h2 className="mks-h2">{title}</h2>}
            {subtitle && <p className="mks-sub">{subtitle}</p>}
        </header>
    ) : null;

/* ---------------------------------------------------------
   SEÇÕES
--------------------------------------------------------- */

const Hero = ({ section, bundle, actions }) => {
    const { props, variant } = section;
    const center = variant === "center" || props.align === "center";

    return (
        <div className={`mks-hero mks-hero--${variant} ${center ? "is-center" : ""}`}>
            {variant === "cover" && props.image && (
                <div className="mks-hero__bg" aria-hidden="true">
                    <img src={props.image} alt="" />
                </div>
            )}

            <div className="mks-wrap mks-hero__inner">
                <div className="mks-hero__text">
                    {props.showLogo && bundle?.logo && (
                        <img className="mks-hero__logo" src={bundle.logo} alt={`Logotipo de ${bundle.name}`} />
                    )}
                    <h1 className="mks-h1">{props.title}</h1>
                    {props.subtitle && <p className="mks-lead">{props.subtitle}</p>}
                    <div className="mks-actions">
                        <ActionButton button={props.primary} actions={actions} />
                        <ActionButton button={props.secondary} actions={actions} variant="ghost" />
                    </div>
                </div>

                {(variant === "split" || variant === "arch") && (
                    <div className="mks-hero__media">
                        {props.image ? <img src={props.image} alt="" /> : <span className="mks-placeholder"><Icon icon="solar:gallery-linear" /></span>}
                    </div>
                )}
            </div>
        </div>
    );
};

const About = ({ section }) => {
    const { props, variant } = section;
    const highlights = (props.highlights || []).filter((item) => item.value || item.label);

    return (
        <div className={`mks-wrap mks-about mks-about--${variant} ${variant === "image" && props.image ? "has-image" : ""}`}>
            <div className="mks-about__text">
                <h2 className="mks-h2">{props.title}</h2>
                {String(props.text || "")
                    .split(/\n{2,}|\n/)
                    .filter((line) => line.trim())
                    .map((line, index) => (
                        <p key={index} className="mks-p">{line}</p>
                    ))}
                {highlights.length > 0 && (
                    <dl className="mks-highlights">
                        {highlights.map((item, index) => (
                            <div key={index}>
                                <dt>{item.value}</dt>
                                <dd>{item.label}</dd>
                            </div>
                        ))}
                    </dl>
                )}
            </div>
            {variant === "image" && props.image && (
                <div className="mks-about__media">
                    <img src={props.image} alt="" loading="lazy" />
                </div>
            )}
        </div>
    );
};

const Steps = ({ section }) => {
    const { props, variant } = section;
    const items = (props.items || []).filter((item) => item.title?.trim());

    return (
        <div className="mks-wrap">
            <SectionHead title={props.title} />
            <ol className={`mks-steps mks-steps--${variant}`}>
                {items.map((item, index) => (
                    <li key={index} className="mks-step">
                        <span className="mks-step__num" aria-hidden="true">{index + 1}</span>
                        <div>
                            <h3 className="mks-h3">{item.title}</h3>
                            {item.text && <p className="mks-sub">{item.text}</p>}
                        </div>
                    </li>
                ))}
            </ol>
        </div>
    );
};

const Services = ({ section, bundle, actions }) => {
    const { props, variant } = section;

    const items =
        props.source === "manual"
            ? (props.items || []).filter((item) => item.name)
            : (bundle?.products || []).slice(0, Number(props.limit) || 8).map((product) => ({
                id: product.id,
                name: product.name,
                price: product.price,
                originalPrice: product.originalPrice,
                duration: product.duration ? formatDurationLabel(product.duration) : "",
                description: product.description,
                image: product.image
            }));

    const canBook = props.source !== "manual" && props.bookingButtons;

    return (
        <div className="mks-wrap">
            <SectionHead title={props.title} subtitle={props.subtitle} />

            {variant === "menu" ? (
                <ul className="mks-menu">
                    {items.map((item, index) => (
                        <li key={item.id || index} className="mks-menu__item">
                            <div className="mks-menu__main">
                                <span className="mks-menu__name">{item.name}</span>
                                <span className="mks-menu__dots" aria-hidden="true" />
                                {props.showPrices && item.price && (
                                    <span className="mks-menu__price">
                                        {item.originalPrice && <s>{item.originalPrice}</s>}
                                        {item.price}
                                    </span>
                                )}
                            </div>
                            <div className="mks-menu__meta">
                                {props.showDuration && item.duration && <span>{item.duration}</span>}
                                {item.description && <span className="mks-menu__desc">{item.description}</span>}
                                {canBook && item.id && (
                                    <a className="mks-link" {...actions.booking(item.id)}>Agendar</a>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className="mks-cards">
                    {items.map((item, index) => (
                        <article key={item.id || index} className="mks-card">
                            {item.image && (
                                <div className="mks-card__media">
                                    <img src={item.image} alt="" loading="lazy" />
                                </div>
                            )}
                            <div className="mks-card__body">
                                <h3 className="mks-h3">{item.name}</h3>
                                {item.description && <p className="mks-card__desc">{item.description}</p>}
                                <div className="mks-card__foot">
                                    <span>
                                        {props.showPrices && item.price && <strong>{item.price}</strong>}
                                        {props.showDuration && item.duration && <small>{item.duration}</small>}
                                    </span>
                                    {canBook && item.id && (
                                        <a className="mks-btn mks-btn--small" {...actions.booking(item.id)}>Agendar</a>
                                    )}
                                </div>
                            </div>
                        </article>
                    ))}
                </div>
            )}
        </div>
    );
};

const Packages = ({ section, actions }) => {
    const { props, variant } = section;
    const items = (props.items || []).filter((item) => item.name?.trim());

    return (
        <div className="mks-wrap">
            <SectionHead title={props.title} subtitle={props.subtitle} />
            <div className={`mks-packages mks-packages--${variant}`}>
                {items.map((item, index) => {
                    const lines = String(item.includes || "").split("\n").map((line) => line.trim()).filter(Boolean);
                    const button = props.button?.action === "whatsapp"
                        ? actions.whatsapp(`Olá! Tenho interesse no pacote ${item.name}${item.price ? ` (${item.price})` : ""}.`)
                        : actions.resolve(props.button);

                    return (
                        <article key={index} className={`mks-package ${item.highlight ? "is-highlight" : ""}`}>
                            <header>
                                <h3 className="mks-h3">{item.name}</h3>
                                {item.price && <strong className="mks-package__price">{item.price}</strong>}
                            </header>
                            {lines.length > 0 && (
                                <ul>
                                    {lines.map((line, key) => (
                                        <li key={key}>
                                            <Icon icon="solar:check-circle-linear" aria-hidden="true" />
                                            {line}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {button && props.button?.label && (
                                <a className={`mks-btn ${item.highlight ? "" : "mks-btn--ghost"}`} {...button}>
                                    {props.button.label}
                                </a>
                            )}
                        </article>
                    );
                })}
            </div>
        </div>
    );
};

const CONDITION = { novo: "Novo", seminovo: "Seminovo", usado: "Usado" };

const Catalog = ({ section, actions }) => {
    const { props, variant } = section;
    const items = (props.items || []).filter((item) => item.name?.trim() && (props.showSold || !item.sold));

    const buy = (item) => {
        if (item.sold) return null;
        if (isHttp(item.link)) return actions.external(item.link, "channel_click");
        return actions.whatsapp(`Olá! Tenho interesse em: ${item.name}${item.price ? ` (${item.price})` : ""}.`);
    };

    if (variant === "list") {
        return (
            <div className="mks-wrap">
                <SectionHead title={props.title} subtitle={props.subtitle} />
                <ul className="mks-menu mks-menu--catalog">
                    {items.map((item, index) => {
                        const link = buy(item);
                        return (
                            <li key={index} className={`mks-menu__item ${item.sold ? "is-sold" : ""}`}>
                                <div className="mks-menu__main">
                                    {item.image && <img className="mks-menu__thumb" src={item.image} alt="" loading="lazy" />}
                                    <span className="mks-menu__name">{item.name}</span>
                                    <span className="mks-menu__dots" aria-hidden="true" />
                                    <span className="mks-menu__price">
                                        {item.oldPrice && <s>{item.oldPrice}</s>}
                                        {item.price}
                                    </span>
                                </div>
                                <div className="mks-menu__meta">
                                    {item.description && <span className="mks-menu__desc">{item.description}</span>}
                                    {item.sold ? (
                                        <span className="mks-tag mks-tag--sold">Esgotado</span>
                                    ) : (
                                        link && <a className="mks-link" {...link}>{props.buttonLabel || "Pedir"}</a>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ul>
            </div>
        );
    }

    return (
        <div className="mks-wrap">
            <SectionHead title={props.title} subtitle={props.subtitle} />
            <div className="mks-shop">
                {items.map((item, index) => {
                    const link = buy(item);
                    return (
                        <article key={index} className={`mks-product ${item.sold ? "is-sold" : ""}`}>
                            <div className="mks-product__media">
                                {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span className="mks-placeholder"><Icon icon="solar:bag-4-linear" /></span>}
                                <span className="mks-product__tags">
                                    {item.condition && CONDITION[item.condition] && <span className="mks-tag">{CONDITION[item.condition]}</span>}
                                    {item.oldPrice && !item.sold && <span className="mks-tag mks-tag--accent">Oferta</span>}
                                    {item.sold && <span className="mks-tag mks-tag--sold">Vendido</span>}
                                </span>
                            </div>
                            <div className="mks-product__body">
                                <h3 className="mks-product__name">{item.name}</h3>
                                {item.description && <p className="mks-card__desc">{item.description}</p>}
                                <div className="mks-product__foot">
                                    <span className="mks-product__price">
                                        {item.oldPrice && <s>{item.oldPrice}</s>}
                                        <strong>{item.price}</strong>
                                    </span>
                                    {link && (
                                        <a className="mks-btn mks-btn--small" {...link}>{props.buttonLabel || "Comprar"}</a>
                                    )}
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>
        </div>
    );
};

const PURPOSE = { venda: "Venda", aluguel: "Aluguel", temporada: "Temporada" };

const Properties = ({ section, actions }) => {
    const { props, variant } = section;
    const all = (props.items || []).filter((item) => item.title?.trim());
    const purposes = [...new Set(all.map((item) => item.purpose).filter(Boolean))];
    const [filter, setFilter] = useState("all");

    const items = filter === "all" ? all : all.filter((item) => item.purpose === filter);

    return (
        <div className="mks-wrap">
            <SectionHead title={props.title} subtitle={props.subtitle} />

            {purposes.length > 1 && (
                <div className="mks-filter" role="group" aria-label="Filtrar imóveis">
                    {["all", ...purposes].map((value) => (
                        <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>
                            {value === "all" ? "Todos" : PURPOSE[value]}
                        </button>
                    ))}
                </div>
            )}

            <div className={`mks-homes mks-homes--${variant}`}>
                {items.map((item, index) => {
                    const facts = [
                        item.bedrooms && { icon: "solar:bed-linear", text: `${item.bedrooms} ${item.bedrooms === "1" ? "quarto" : "quartos"}` },
                        item.bathrooms && { icon: "solar:bath-linear", text: `${item.bathrooms} ${item.bathrooms === "1" ? "banheiro" : "banheiros"}` },
                        item.area && { icon: "solar:ruler-angular-linear", text: `${item.area} m²` },
                        item.parking && { icon: "solar:wheel-linear", text: `${item.parking} ${item.parking === "1" ? "vaga" : "vagas"}` }
                    ].filter(Boolean);

                    const visit = actions.whatsapp(`Olá! Quero agendar uma visita: ${item.title}${item.place ? `, ${item.place}` : ""}.`);

                    return (
                        <article key={index} className="mks-home">
                            <div className="mks-home__media">
                                {item.image ? <img src={item.image} alt="" loading="lazy" /> : <span className="mks-placeholder"><Icon icon="solar:buildings-2-linear" /></span>}
                                {item.purpose && <span className="mks-tag mks-tag--solid">{PURPOSE[item.purpose]}</span>}
                            </div>
                            <div className="mks-home__body">
                                {item.price && <strong className="mks-home__price">{item.price}</strong>}
                                <h3 className="mks-h3">{item.title}</h3>
                                {item.place && (
                                    <span className="mks-home__place"><Icon icon="solar:map-point-linear" aria-hidden="true" />{item.place}</span>
                                )}
                                {facts.length > 0 && (
                                    <ul className="mks-home__facts">
                                        {facts.map((fact) => (
                                            <li key={fact.text}><Icon icon={fact.icon} aria-hidden="true" />{fact.text}</li>
                                        ))}
                                    </ul>
                                )}
                                <div className="mks-home__actions">
                                    {visit && <a className="mks-btn mks-btn--small" {...visit}>{props.buttonLabel || "Agendar visita"}</a>}
                                    {isHttp(item.link) && (
                                        <a className="mks-btn mks-btn--small mks-btn--ghost" {...actions.external(item.link, "channel_click")}>Ver anúncio</a>
                                    )}
                                </div>
                            </div>
                        </article>
                    );
                })}
            </div>
        </div>
    );
};

const Channels = ({ section, actions }) => {
    const { props, variant } = section;
    const items = validChannels(props.items);

    return (
        <div className={variant === "banner" ? "mks-channels-band" : ""}>
            <div className={`mks-wrap mks-channels mks-channels--${variant}`}>
                <SectionHead title={props.title} subtitle={props.subtitle} center={variant === "buttons"} />
                <ul className="mks-channels__list">
                    {items.map((item, index) => {
                        const channel = CHANNELS[item.channel];
                        return (
                            <li key={index}>
                                <a
                                    className="mks-channel"
                                    style={{ "--ch": channel.color, "--ch-ink": channel.ink || "#ffffff" }}
                                    {...actions.external(item.url, "channel_click")}
                                >
                                    <span className="mks-channel__icon"><Icon icon={channel.icon} aria-hidden="true" /></span>
                                    <span className="mks-channel__label">{item.label || channel.label}</span>
                                    <Icon icon="solar:arrow-right-up-linear" aria-hidden="true" />
                                </a>
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
};

const Team = ({ section, bundle }) => {
    const { props, variant } = section;

    const people =
        props.source === "manual"
            ? (props.items || []).filter((item) => item.name)
            : (bundle?.professionals || []).map((person) => ({ name: person.name, role: person.role, photo: person.photo }));

    return (
        <div className="mks-wrap">
            <SectionHead title={props.title} subtitle={props.subtitle} />
            <ul className={`mks-team mks-team--${variant}`}>
                {people.map((person, index) => (
                    <li key={index} className="mks-person">
                        <span className="mks-person__photo">
                            {person.photo ? <img src={person.photo} alt="" loading="lazy" /> : <span>{person.name.charAt(0)}</span>}
                        </span>
                        <span className="mks-person__text">
                            <strong>{person.name}</strong>
                            {person.role && <small>{person.role}</small>}
                        </span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const Gallery = ({ section }) => {
    const { props, variant } = section;
    const images = props.images || [];

    return (
        <div className={variant === "carousel" ? "mks-gallery-carousel" : "mks-wrap"}>
            <div className={variant === "carousel" ? "mks-wrap" : ""}>
                <SectionHead title={props.title} subtitle={props.subtitle} />
            </div>
            <div className={`mks-gallery mks-gallery--${variant}`}>
                {images.map((url, index) => (
                    <figure key={`${url}-${index}`} className="mks-gallery__item">
                        <img src={url} alt="" loading="lazy" />
                    </figure>
                ))}
            </div>
        </div>
    );
};

const Testimonials = ({ section }) => {
    const { props, variant } = section;
    const items = (props.items || []).filter((item) => item.text?.trim());
    const [index, setIndex] = useState(0);

    if (variant === "quote") {
        const item = items[index % Math.max(1, items.length)];

        return (
            <div className="mks-wrap mks-quote">
                <h2 className="mks-visually-hidden">{props.title}</h2>
                {item && (
                    <figure>
                        <blockquote className="mks-quote__text">“{item.text}”</blockquote>
                        <figcaption>
                            <strong>{item.name}</strong>
                            {item.detail && <span>{item.detail}</span>}
                        </figcaption>
                    </figure>
                )}
                {items.length > 1 && (
                    <div className="mks-quote__nav">
                        {items.map((_, dot) => (
                            <button
                                key={dot}
                                type="button"
                                aria-label={`Depoimento ${dot + 1}`}
                                aria-pressed={dot === index % items.length}
                                onClick={() => setIndex(dot)}
                            />
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="mks-wrap">
            <SectionHead title={props.title} />
            <div className="mks-testimonials">
                {items.map((item, key) => (
                    <figure key={key} className="mks-testimonial">
                        <blockquote>{item.text}</blockquote>
                        <figcaption>
                            <strong>{item.name}</strong>
                            {item.detail && <span>{item.detail}</span>}
                        </figcaption>
                    </figure>
                ))}
            </div>
        </div>
    );
};

const Faq = ({ section }) => {
    const items = (section.props.items || []).filter((item) => item.q?.trim());

    return (
        <div className="mks-wrap mks-faq">
            <SectionHead title={section.props.title} />
            <div className="mks-faq__list">
                {items.map((item, index) => (
                    <details key={index} className="mks-faq__item">
                        <summary>
                            <span>{item.q}</span>
                            <Icon icon="solar:add-circle-linear" aria-hidden="true" />
                        </summary>
                        <p>{item.a}</p>
                    </details>
                ))}
            </div>
        </div>
    );
};

const Hours = ({ bundle }) => {
    const hours = formatHours(bundle?.businessHours);
    const today = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"][new Date().getDay()];

    if (!bundle?.businessHours) return null;

    return (
        <ul className="mks-hours">
            {hours.map((day) => (
                <li key={day.id} className={day.id === today ? "is-today" : ""}>
                    <span>{day.label}</span>
                    <span>{day.text}</span>
                </li>
            ))}
        </ul>
    );
};

const Booking = ({ section, bundle, actions }) => {
    const { props, variant } = section;
    const products = (bundle?.products || []).slice(0, Number(props.limit) || 4);

    return (
        <div className={`mks-wrap mks-booking mks-booking--${variant}`}>
            <div className="mks-booking__intro">
                <h2 className="mks-h2">{props.title}</h2>
                {props.subtitle && <p className="mks-sub">{props.subtitle}</p>}
                <a className="mks-btn" {...actions.booking()}>
                    <Icon icon="solar:calendar-linear" aria-hidden="true" />
                    <span>{props.buttonLabel || "Ver horários"}</span>
                </a>
                {props.showHours && <Hours bundle={bundle} />}
            </div>
            <ul className="mks-booking__list">
                {products.map((product) => (
                    <li key={product.id}>
                        <a {...actions.booking(product.id)} className="mks-booking__item">
                            <span>
                                <strong>{product.name}</strong>
                                <small>
                                    {[product.duration ? formatDurationLabel(product.duration) : "", product.price].filter(Boolean).join(", ")}
                                </small>
                            </span>
                            <Icon icon="solar:arrow-right-linear" aria-hidden="true" />
                        </a>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const SocialLinks = ({ bundle, extra = [], actions }) => {
    const links = [
        ...(bundle?.socials || []).map((item) => ({ label: item.label, url: item.link, icon: item.icon })),
        ...extra.filter((item) => isHttp(item.url)).map((item) => ({ label: item.label || item.url, url: item.url, icon: "solar:link-linear" }))
    ];

    if (!links.length) return null;

    return (
        <ul className="mks-social">
            {links.map((link) => (
                <li key={link.url}>
                    <a {...actions.external(link.url, "social_click")}>
                        <Icon icon={link.icon} aria-hidden="true" />
                        <span>{link.label}</span>
                    </a>
                </li>
            ))}
        </ul>
    );
};

/* Rotas até o endereço: links públicos de cada app, sem
   chave de API. A 99 não tem link público de destino, por
   isso fica de fora daqui (dá para colocar o link da 99 na
   seção "Peça também por"). */
const directionLinks = (address) => {
    const q = encodeURIComponent(address);
    return [
        { id: "maps", label: "Google Maps", icon: "logos:google-maps", url: `https://www.google.com/maps/dir/?api=1&destination=${q}` },
        { id: "waze", label: "Waze", icon: "simple-icons:waze", url: `https://waze.com/ul?q=${q}&navigate=yes` },
        { id: "uber", label: "Uber", icon: "simple-icons:uber", url: `https://m.uber.com/ul/?action=setPickup&pickup=my_location&dropoff[formatted_address]=${q}` }
    ];
};

const Contact = ({ section, bundle, actions, mode, lite }) => {
    const { props, variant } = section;
    const wa = actions.whatsapp();

    return (
        <div className={`mks-wrap mks-contact mks-contact--${variant}`}>
            <div className="mks-contact__info">
                <h2 className="mks-h2">{props.title}</h2>
                <ul className="mks-contact__list">
                    {props.showAddress && bundle?.address && (
                        <li><Icon icon="solar:map-point-linear" /><span>{bundle.address}</span></li>
                    )}
                    {props.showPhone && wa && (
                        <li>
                            <Icon icon="ic:baseline-whatsapp" />
                            <a {...wa}>Conversar no WhatsApp</a>
                        </li>
                    )}
                    {props.showPhone && bundle?.phone && (
                        <li><Icon icon="solar:phone-linear" /><a href={`tel:${bundle.phone.replace(/[^\d+]/g, "")}`}>{bundle.phone}</a></li>
                    )}
                    {props.showEmail && bundle?.email && (
                        <li><Icon icon="solar:letter-linear" /><a href={`mailto:${bundle.email}`}>{bundle.email}</a></li>
                    )}
                </ul>
                {props.showDirections && bundle?.address && (
                    <div className="mks-routes" aria-label="Como chegar">
                        {directionLinks(bundle.address).map((link) => (
                            <a key={link.id} className="mks-route" {...actions.external(link.url, "channel_click")}>
                                <Icon icon={link.icon} aria-hidden="true" />
                                {link.label}
                            </a>
                        ))}
                    </div>
                )}
                {props.showHours && <Hours bundle={bundle} />}
                {props.showSocial && <SocialLinks bundle={bundle} actions={actions} />}
            </div>
            {variant === "map" && bundle?.address && lite && (
                <div className="mks-contact__map mks-contact__map--lite" aria-hidden="true">
                    <Icon icon="solar:map-point-wave-linear" />
                </div>
            )}
            {variant === "map" && bundle?.address && !lite && (
                <div className="mks-contact__map">
                    <iframe
                        title={`Mapa: ${bundle.address}`}
                        src={`https://maps.google.com/maps?q=${encodeURIComponent(bundle.address)}&z=15&output=embed`}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        style={mode === "edit" ? { pointerEvents: "none" } : undefined}
                    />
                </div>
            )}
        </div>
    );
};

const ContactForm = ({ section, bundle, mode }) => {
    const { props, variant } = section;
    const [values, setValues] = useState({ name: "", phone: "", email: "", message: "" });
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState("");

    const set = (key) => (event) => setValues((current) => ({ ...current, [key]: event.target.value }));

    const onSubmit = async (event) => {
        event.preventDefault();
        setError("");

        if (!values.name.trim()) {
            setError("Informe seu nome.");
            return;
        }

        if (!values.phone.trim() && !values.email.trim()) {
            setError("Deixe um telefone ou e-mail para a resposta chegar até você.");
            return;
        }

        if (mode !== "public") {
            setStatus("preview");
            return;
        }

        setStatus("sending");

        try {
            await submitLead(bundle.handle, values);
            trackEvent(bundle.handle, "lead");
            setStatus("sent");
        } catch {
            setStatus("idle");
            setError("Não foi possível enviar agora. Verifique a conexão e tente de novo.");
        }
    };

    return (
        <div className={`mks-wrap mks-form mks-form--${variant}`}>
            <div className="mks-form__intro">
                <h2 className="mks-h2">{props.title}</h2>
                {props.subtitle && <p className="mks-sub">{props.subtitle}</p>}
            </div>

            {status === "sent" ? (
                <div className="mks-form__done" role="status">
                    <Icon icon="solar:check-circle-linear" aria-hidden="true" />
                    <p>{props.successMessage}</p>
                </div>
            ) : (
                <form className="mks-form__fields" onSubmit={onSubmit} noValidate>
                    <label>
                        <span>Nome</span>
                        <input value={values.name} onChange={set("name")} autoComplete="name" maxLength={120} required />
                    </label>
                    {props.askPhone && (
                        <label>
                            <span>Telefone ou WhatsApp</span>
                            <input value={values.phone} onChange={set("phone")} autoComplete="tel" inputMode="tel" maxLength={40} />
                        </label>
                    )}
                    {props.askEmail && (
                        <label>
                            <span>E-mail</span>
                            <input type="email" value={values.email} onChange={set("email")} autoComplete="email" maxLength={160} />
                        </label>
                    )}
                    <label className="mks-form__wide">
                        <span>Mensagem</span>
                        <textarea rows={4} value={values.message} onChange={set("message")} maxLength={2000} />
                    </label>
                    {error && <p className="mks-form__error" role="alert">{error}</p>}
                    {status === "preview" && (
                        <p className="mks-form__note" role="status">
                            Na pré-visualização o envio não é gravado. Na página publicada, a mensagem chega em Contatos.
                        </p>
                    )}
                    <button type="submit" className="mks-btn" disabled={status === "sending"}>
                        {status === "sending" ? "Enviando…" : props.submitLabel || "Enviar"}
                    </button>
                    <p className="mks-form__legal">
                        Seus dados vão só para {bundle?.name || "a empresa"}, para responder esta mensagem.
                    </p>
                </form>
            )}
        </div>
    );
};

const Cta = ({ section, actions }) => {
    const { props, variant } = section;

    return (
        <div className={variant === "band" ? "mks-cta mks-cta--band" : "mks-wrap"}>
            <div className={variant === "band" ? "mks-wrap mks-cta__inner" : "mks-cta mks-cta--card"}>
                <div>
                    <h2 className="mks-h2">{props.title}</h2>
                    {props.text && <p className="mks-sub">{props.text}</p>}
                </div>
                <ActionButton button={props.button} actions={actions} variant={variant === "band" ? "inverse" : "solid"} />
            </div>
        </div>
    );
};

const Social = ({ section, bundle, actions }) => (
    <div className="mks-wrap mks-social-section">
        <SectionHead title={section.props.title} center />
        <SocialLinks bundle={bundle} extra={section.props.links || []} actions={actions} />
    </div>
);

const COMPONENTS = {
    hero: Hero,
    about: About,
    steps: Steps,
    services: Services,
    packages: Packages,
    team: Team,
    booking: Booking,
    catalog: Catalog,
    properties: Properties,
    channels: Channels,
    gallery: Gallery,
    testimonials: Testimonials,
    faq: Faq,
    contact: Contact,
    form: ContactForm,
    cta: Cta,
    social: Social
};

/* ---------------------------------------------------------
   PÁGINA
--------------------------------------------------------- */

const SiteRenderer = ({
    page,
    bundle,
    mode = "public",
    selectedId,
    onSelect,
    sectionActions,
    lite = false
}) => {
    const theme = resolveTheme(page?.theme);
    useSiteFonts(page?.theme?.font);

    const sections = page?.sections || [];
    const actions = useActions({ bundle, mode, sections });

    const style = {
        "--s-bg": theme.colors.background,
        "--s-surface": theme.colors.surface,
        "--s-text": theme.colors.text,
        "--s-muted": theme.colors.muted,
        "--s-accent": theme.colors.accent,
        "--s-on-accent": theme.colors.onAccent || "#ffffff",
        "--s-radius": theme.radius,
        "--s-head": theme.font.heading,
        "--s-body": theme.font.body,
        "--s-head-weight": theme.font.headingWeight,
        "--s-head-case": theme.font.headingCase,
        "--s-head-track": theme.font.headingTracking || "-0.025em",
        "--s-head-scale": theme.font.headingScale || 1
    };

    const visible = sections.filter((section) => {
        if (mode === "edit") return true;
        return !section.hidden && !isEmpty(section, bundle);
    });

    const navItems = [];
    visible.forEach((section) => {
        const label = NAV_LABELS[section.type];
        if (!label || section.hidden || navItems.some((item) => item.label === label)) return;
        navItems.push({ label, href: `#mks-${section.id}` });
    });

    const isEdit = mode === "edit";

    /* Botão do topo: agendar quando há serviços; senão, o
       primeiro canal de pedido; senão, WhatsApp. */
    const firstChannel = sections
        .filter((section) => section.type === "channels" && !section.hidden)
        .flatMap((section) => validChannels(section.props.items))[0];

    const whatsappTop = actions.whatsapp();

    const topAction = bundle?.products?.length
        ? { label: "Agendar", props: actions.booking() }
        : firstChannel
            ? { label: "Pedir", props: actions.external(firstChannel.url, "channel_click") }
            : whatsappTop
                ? { label: "Contato", props: whatsappTop }
                : null;

    /* No editor, links não saem da tela: o clique é para
       selecionar a seção. */
    const onEditClickCapture = (event) => {
        if (!isEdit) return;
        const interactive = event.target.closest("a, button[type='submit'], summary");
        if (interactive && !event.target.closest(".mks-edit-chip")) {
            event.preventDefault();
        }
    };

    return (
        <div className="mks-shell" style={style}>
            <div
                className={`mks ${isEdit ? "mks--edit" : ""}`}
                onClickCapture={onEditClickCapture}
            >
                {page?.settings?.showHeader !== false && (
                    <header className="mks-top">
                        <div className="mks-wrap mks-top__inner">
                            <a className="mks-top__brand" href="#top">
                                {bundle?.logo && <img src={bundle.logo} alt="" />}
                                <span>{bundle?.name}</span>
                            </a>
                            <div className="mks-top__nav" role="navigation" aria-label="Seções da página">
                                {navItems.slice(0, 4).map((item) => (
                                    <a key={item.href} href={item.href}>{item.label}</a>
                                ))}
                            </div>
                            {topAction && (
                                <a className="mks-btn mks-btn--small" {...topAction.props}>{topAction.label}</a>
                            )}
                        </div>
                    </header>
                )}

                <main id="top">
                    {visible.map((section) => {
                        const Component = COMPONENTS[section.type];
                        const empty = isEmpty(section, bundle);
                        const selected = selectedId === section.id;

                        return (
                            <section
                                key={section.id}
                                id={`mks-${section.id}`}
                                className={[
                                    "mks-section",
                                    `mks-section--${section.type}`,
                                    isEdit && "is-editable",
                                    isEdit && selected && "is-selected",
                                    isEdit && section.hidden && "is-hidden"
                                ].filter(Boolean).join(" ")}
                                onClick={isEdit ? () => onSelect?.(section.id) : undefined}
                                aria-label={SECTION_TYPES[section.type]?.label}
                                data-section-id={section.id}
                            >
                                {isEdit && (
                                    <span className="mks-edit-chip">
                                        <Icon icon={SECTION_TYPES[section.type]?.icon} aria-hidden="true" />
                                        {SECTION_TYPES[section.type]?.label}
                                        {section.hidden && " (oculta)"}
                                        {selected && sectionActions?.(section)}
                                    </span>
                                )}

                                {isEdit && empty ? (
                                    <div className="mks-wrap mks-empty-hint">
                                        <Icon icon={SECTION_TYPES[section.type]?.icon} aria-hidden="true" />
                                        <p>{EMPTY_HINTS[section.type]}</p>
                                    </div>
                                ) : (
                                    <Component section={section} bundle={bundle} actions={actions} mode={mode} lite={lite} />
                                )}
                            </section>
                        );
                    })}

                    {isEdit && !visible.length && (
                        <div className="mks-wrap mks-empty-hint mks-empty-hint--page">
                            <Icon icon="solar:add-square-linear" aria-hidden="true" />
                            <p>Sua página está vazia. Adicione uma seção pelo painel ao lado.</p>
                        </div>
                    )}
                </main>

                <footer className="mks-footer">
                    <div className="mks-wrap mks-footer__inner">
                        <span>© {new Date().getFullYear()} {bundle?.name}</span>
                        <a href="/home" target="_blank" rel="noopener noreferrer">Página criada com Markfy Studio</a>
                    </div>
                </footer>
            </div>

            {/* Fora do container: dentro dele, `position: fixed`
                ficaria preso à página (container queries criam
                bloco de contenção). No editor, quem desenha o
                botão é a moldura da prévia. */}
            {mode === "public" && page?.settings?.whatsappFloat && (
                <WhatsAppFloat bundle={bundle} track />
            )}
        </div>
    );
};

export const WhatsAppFloat = ({ bundle, track, className = "" }) =>
    bundle?.whatsapp ? (
        <a
            className={`mks-wa ${className}`}
            href={whatsappLink(bundle.whatsapp, `Olá! Vim pela página da ${bundle.name}.`)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Conversar no WhatsApp"
            onClick={(event) => {
                if (track) trackEvent(bundle.handle, "whatsapp_click");
                else event.preventDefault();
            }}
        >
            <Icon icon="ic:baseline-whatsapp" />
        </a>
    ) : null;

export default SiteRenderer;
