import React, { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";

import { normalizeDesign } from "../engine/design.js";
import { byOrder, entries } from "../engine/util.js";
import { formatBRL } from "../engine/money.js";
import { dayLabel, DAY_IDS, DAY_LABELS, isOpenAt, nextOpeningLabel, scheduleLabel } from "../engine/hours.js";
import { enabledFulfillments } from "../engine/orders.js";
import {
    effectivePriceCents,
    fromPriceCents,
    groupsOf,
    hasPromo,
    hasVariablePrice,
    productAvailability,
    sizesOf
} from "../engine/pricing.js";
import { ensureFonts, fontStack } from "./fonts.js";
import { useCart } from "./useCart.js";
import ProductSheet from "./ProductSheet.jsx";
import CartSheet from "./CartSheet.jsx";

import "./menu-renderer.css";

/* =========================================================
   CARDÁPIO PÚBLICO — RENDERIZADOR

   Um componente só para três lugares:
     mode="public"   /m/{endereço} (cliente final)
     mode="preview"  editor visual (pedido desligado)
     mode="demo"     demonstração (pedido vai para a memória)

   O layout responde à LARGURA DO PRÓPRIO CARDÁPIO (container
   queries), não da janela: a prévia de celular dentro do editor
   se comporta exatamente como um celular.

   Tudo o que aparece vem do que a empresa cadastrou: nenhum
   preço riscado, selo ou promoção é inventado aqui.
========================================================= */

export const DIET_TAGS = {
    vegetarian: { label: "Vegetariano", icon: "mdi:leaf" },
    vegan: { label: "Vegano", icon: "mdi:sprout" },
    gluten_free: { label: "Sem glúten", icon: "mdi:barley-off" },
    lactose_free: { label: "Sem lactose", icon: "mdi:cup-off-outline" },
    spicy: { label: "Picante", icon: "mdi:chili-mild" }
};

const normalizeText = (value) =>
    String(value || "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase();

const SHADOW = {
    none: "none",
    soft: "0 1px 2px rgba(0,0,0,.05), 0 8px 24px rgba(0,0,0,.06)",
    lift: "0 2px 4px rgba(0,0,0,.06), 0 18px 40px rgba(0,0,0,.12)"
};

const GAP = { compact: 10, cozy: 16, airy: 24 };

/** Cor de texto legível sobre uma cor de fundo. */
const contrastOn = (hex) => {
    const value = String(hex || "").replace("#", "");
    if (value.length !== 6) return "#ffffff";
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(value.slice(i, i + 2), 16) / 255);
    const lum = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    const L = 0.2126 * lum(r) + 0.7152 * lum(g) + 0.0722 * lum(b);
    return L > 0.45 ? "#111111" : "#ffffff";
};

export const themeVars = (design) => {
    const { colors, fonts } = design.theme;
    return {
        /* Controles nativos (rádio, caixa, rolagem) seguem o fundo do
           modelo, não o tema claro/escuro do aparelho. */
        colorScheme: contrastOn(colors.background) === "#111111" ? "light" : "dark",
        "--m-primary": colors.primary,
        "--m-secondary": colors.secondary,
        "--m-accent": colors.accent,
        "--m-bg": colors.background,
        "--m-surface": colors.surface,
        "--m-text": colors.text,
        "--m-muted": colors.muted,
        "--m-border": colors.border,
        "--m-on-primary": colors.buttonText || contrastOn(colors.primary),
        "--m-font-h": fontStack(fonts.heading),
        "--m-font-b": fontStack(fonts.body),
        "--m-h-weight": design.theme.headingWeight,
        "--m-size": `${design.theme.bodySize}px`,
        "--m-lh": design.theme.lineHeight,
        "--m-case": design.theme.headingCase === "upper" ? "uppercase" : "none",
        "--m-track": design.theme.headingCase === "upper" ? "0.04em" : "-0.01em",
        "--m-radius": `${design.theme.radius}px`,
        "--m-radius-sm": `${Math.round(design.theme.radius * 0.6)}px`,
        "--m-shadow": SHADOW[design.theme.shadow] || "none",
        "--m-gap": `${GAP[design.theme.density] || 16}px`,
        "--m-width": `${design.theme.contentWidth}px`,
        "--m-dur": design.theme.motion === "none" ? "0ms" : design.theme.motion === "lively" ? "320ms" : "200ms",
        "--m-ratio": design.layout.imageRatio,
        "--m-cols": design.layout.columns
    };
};

/* Elemento que rola o cardápio (janela no público, moldura na prévia). */
const scrollParent = (node) => {
    let current = node?.parentElement;
    while (current && current !== document.body) {
        const style = getComputedStyle(current);
        if (/(auto|scroll)/.test(style.overflowY) && current.scrollHeight > current.clientHeight) return current;
        current = current.parentElement;
    }
    return null;
};

/* ---------- PEÇAS ---------- */

const Price = ({ product, groups, className = "" }) => {
    const variable = hasVariablePrice(product, groups);
    const promo = hasPromo(product);
    const value = variable ? fromPriceCents(product, groups) : effectivePriceCents(product);

    if (!value && !variable) return null;

    return (
        <span className={`mnr-price ${className}`}>
            {variable && <small>a partir de</small>}
            {promo && <s aria-label="Preço normal">{formatBRL(product.priceCents)}</s>}
            <b>{formatBRL(value)}</b>
            {product.unitLabel && <small>/{product.unitLabel}</small>}
        </span>
    );
};

const Badges = ({ product, content }) => {
    const tags = product.tags || {};
    const diet = (Array.isArray(product.dietTags) ? product.dietTags : []).filter((id) => DIET_TAGS[id]);
    if (!tags.featured && !tags.new && !tags.bestseller && !diet.length && !(content.showPrepTime && product.prepMinutes)) return null;

    return (
        <span className="mnr-badges">
            {tags.featured && <span className="mnr-badge is-strong">Destaque</span>}
            {tags.new && <span className="mnr-badge is-accent">Novidade</span>}
            {tags.bestseller && <span className="mnr-badge">Mais pedido</span>}
            {diet.map((id) => (
                <span key={id} className="mnr-badge is-diet" title={DIET_TAGS[id].label}>
                    <Icon icon={DIET_TAGS[id].icon} aria-hidden="true" />
                    {DIET_TAGS[id].label}
                </span>
            ))}
            {content.showPrepTime && product.prepMinutes ? (
                <span className="mnr-badge is-plain"><Icon icon="solar:clock-circle-linear" aria-hidden="true" /> ~{product.prepMinutes} min</span>
            ) : null}
        </span>
    );
};

const Unavailable = ({ availability, product }) =>
    availability.ok ? null : (
        <span className="mnr-unavailable">
            {availability.reason === "Disponível em outro horário." && product.schedule
                ? `Disponível ${scheduleLabel(product.schedule)}`
                : availability.reason.replace(/\.$/, "")}
        </span>
    );

const AddButton = ({ onClick, label, disabled }) => (
    <button
        type="button"
        className="mnr-add"
        onClick={(event) => {
            event.stopPropagation();
            onClick();
        }}
        disabled={disabled}
        aria-label={label}
    >
        <Icon icon="solar:add-circle-bold" aria-hidden="true" />
    </button>
);

const ProductItem = ({ product, layout, groups, content, canOrder, onOpen, onQuickAdd, availability }) => {
    const showImage = content.showImages && product.image && layout !== "menu";
    const off = !availability.ok;
    const needsChoice = sizesOf(product).length > 0 || groupsOf(product, groups).some((group) => Number(group.min) > 0);
    const orderable = canOrder && product.orderable !== false && !off;

    const add = () => (needsChoice ? onOpen(product) : onQuickAdd(product));

    if (layout === "menu") {
        const sizes = sizesOf(product);
        return (
            <li className={`mnr-menuitem ${off ? "is-off" : ""}`}>
                <button type="button" className="mnr-menuitem__hit" onClick={() => onOpen(product)}>
                    <span className="mnr-menuitem__line">
                        <span className="mnr-menuitem__name">{product.name}</span>
                        <span className="mnr-menuitem__dots" aria-hidden="true" />
                        {sizes.length > 1 ? (
                            <span className="mnr-menuitem__sizes">
                                {sizes.map((size) => (
                                    <span key={size.id}><small>{size.name.split(" ")[0]}</small> {formatBRL(size.priceCents)}</span>
                                ))}
                            </span>
                        ) : (
                            <Price product={product} groups={groups} />
                        )}
                    </span>
                    {content.showDescriptions && product.description && <span className="mnr-menuitem__desc">{product.description}</span>}
                    <Badges product={product} content={content} />
                    <Unavailable availability={availability} product={product} />
                </button>
            </li>
        );
    }

    return (
        <li className={`mnr-item mnr-item--${layout} ${off ? "is-off" : ""} ${showImage ? "has-image" : "no-image"}`}>
            <button type="button" className="mnr-item__hit" onClick={() => onOpen(product)} aria-label={`${product.name}, ver detalhes`} />
            {showImage && (
                <span className="mnr-item__media">
                    <img src={product.image} alt="" loading="lazy" />
                </span>
            )}
            <span className="mnr-item__body">
                <span className="mnr-item__name">{product.name}</span>
                {content.showDescriptions && product.description && layout !== "compact" && (
                    <span className="mnr-item__desc">{product.description}</span>
                )}
                {layout !== "photo" && <Badges product={product} content={content} />}
                <span className="mnr-item__foot">
                    <Price product={product} groups={groups} />
                    <Unavailable availability={availability} product={product} />
                </span>
            </span>
            {orderable && <AddButton onClick={add} label={`Adicionar ${product.name}`} />}
        </li>
    );
};

const ProductGroup = ({ products, layout, ...rest }) => {
    if (layout === "buffet") {
        const byWeight = products.filter((product) => product.unitLabel);
        const others = products.filter((product) => !product.unitLabel);
        return (
            <>
                {byWeight.length > 0 && (
                    <ul className="mnr-buffet">
                        {byWeight.map((product) => (
                            <li key={product.id} className="mnr-buffet__item">
                                <button type="button" onClick={() => rest.onOpen(product)}>
                                    <span className="mnr-buffet__name">{product.name}</span>
                                    {rest.content.showDescriptions && product.description && <span className="mnr-buffet__desc">{product.description}</span>}
                                    <span className="mnr-buffet__price">
                                        <b>{formatBRL(effectivePriceCents(product))}</b>
                                        <small>por {product.unitLabel}</small>
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
                {others.length > 0 && (
                    <ul className="mnr-grid mnr-grid--cards">
                        {others.map((product) => (
                            <ProductItem key={product.id} product={product} layout="cards" availability={rest.availabilityOf(product)} {...rest} />
                        ))}
                    </ul>
                )}
            </>
        );
    }

    const listLayout = layout === "carousel" ? "cards" : layout;

    return (
        <ul className={`mnr-grid mnr-grid--${layout}`}>
            {products.map((product) => (
                <ProductItem key={product.id} product={product} layout={listLayout} availability={rest.availabilityOf(product)} {...rest} />
            ))}
        </ul>
    );
};

/* ---------- TOPO ---------- */

const InfoChips = ({ status, settings, content, onHours, onShare, deliveryText }) => (
    <div className="mnr-info">
        <button type="button" className={`mnr-status ${status.open ? "is-open" : "is-closed"}`} onClick={onHours}>
            <span className="mnr-status__dot" aria-hidden="true" />
            {status.open ? "Aberto agora" : `Fechado${status.next ? ` · abre ${status.next}` : ""}`}
            {content.showHours && <Icon icon="solar:alt-arrow-down-linear" aria-hidden="true" />}
        </button>
        {deliveryText && <span className="mnr-chip"><Icon icon="solar:scooter-linear" aria-hidden="true" /> {deliveryText}</span>}
        {content.showAddress && settings.address?.text && (
            <a className="mnr-chip" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address.text)}`} target="_blank" rel="noopener noreferrer">
                <Icon icon="solar:map-point-linear" aria-hidden="true" /> {settings.address.text}
            </a>
        )}
        {content.showShare && (
            <button type="button" className="mnr-chip" onClick={onShare}>
                <Icon icon="solar:share-linear" aria-hidden="true" /> Compartilhar
            </button>
        )}
    </div>
);

const Header = ({ design, settings, status, onHours, onShare, deliveryText }) => {
    const { header } = design.layout;
    const { images, content } = design;
    const name = content.heroTitle || settings.profile?.name || "Seu restaurante";
    const tagline = content.tagline || "";
    const description = settings.profile?.description || "";
    const logo = images.logo;

    const info = <InfoChips status={status} settings={settings} content={content} onHours={onHours} onShare={onShare} deliveryText={deliveryText} />;

    const Logo = ({ size }) =>
        logo ? <img className={`mnr-logo mnr-logo--${size}`} src={logo} alt={`Logo de ${name}`} /> : <span className={`mnr-logo mnr-logo--${size} is-letter`} aria-hidden="true">{name.charAt(0)}</span>;

    if (header === "hero") {
        return (
            <header className="mnr-head mnr-head--hero" style={images.cover ? { "--cover": `url("${images.cover}")` } : undefined}>
                <div className="mnr-head__shade" />
                <div className="mnr-wrap mnr-head__inner">
                    <Logo size="md" />
                    <h1 className="mnr-title">{name}</h1>
                    {tagline && <p className="mnr-tagline">{tagline}</p>}
                    {content.heroSubtitle && <p className="mnr-sub">{content.heroSubtitle}</p>}
                    {info}
                </div>
            </header>
        );
    }

    if (header === "split") {
        return (
            <header className="mnr-head mnr-head--split">
                <div className="mnr-wrap mnr-split">
                    <div className="mnr-split__text">
                        <Logo size="md" />
                        <h1 className="mnr-title">{name}</h1>
                        {tagline && <p className="mnr-tagline">{tagline}</p>}
                        {description && <p className="mnr-sub">{description}</p>}
                        {info}
                    </div>
                    <div className="mnr-split__media" style={images.cover ? { backgroundImage: `url("${images.cover}")` } : undefined} aria-hidden="true" />
                </div>
            </header>
        );
    }

    if (header === "banner") {
        return (
            <header className="mnr-head mnr-head--banner">
                <div className="mnr-banner" style={images.cover ? { backgroundImage: `url("${images.cover}")` } : undefined} aria-hidden="true" />
                <div className="mnr-wrap">
                    <div className="mnr-banner__card">
                        <Logo size="lg" />
                        <div>
                            <h1 className="mnr-title">{name}</h1>
                            {tagline && <p className="mnr-tagline">{tagline}</p>}
                        </div>
                        {info}
                    </div>
                </div>
            </header>
        );
    }

    if (header === "centered") {
        return (
            <header className="mnr-head mnr-head--centered">
                <div className="mnr-wrap mnr-centered">
                    <Logo size="lg" />
                    <h1 className="mnr-title">{name}</h1>
                    <span className="mnr-ornament" aria-hidden="true"><i /><Icon icon="mdi:silverware-fork-knife" /><i /></span>
                    {tagline && <p className="mnr-tagline">{tagline}</p>}
                    {info}
                </div>
            </header>
        );
    }

    if (header === "board") {
        return (
            <header className="mnr-head mnr-head--board">
                <div className="mnr-wrap mnr-board">
                    <div className="mnr-board__frame">
                        <Logo size="md" />
                        <h1 className="mnr-title">{name}</h1>
                        {tagline && <p className="mnr-board__hand">{tagline}</p>}
                    </div>
                    {info}
                </div>
            </header>
        );
    }

    return (
        <header className="mnr-head mnr-head--compact">
            <div className="mnr-wrap mnr-compact">
                <Logo size="sm" />
                <div className="mnr-compact__text">
                    <h1 className="mnr-title">{name}</h1>
                    {tagline && <p className="mnr-tagline">{tagline}</p>}
                </div>
            </div>
            <div className="mnr-wrap">{info}</div>
        </header>
    );
};

/* ---------- PRINCIPAL ---------- */

export default function MenuRenderer({
    design: rawDesign,
    settings = {},
    catalog = {},
    floor = {},
    features = {},
    mode = "public",
    handle,
    tableId = null,
    actions = {},
    initialMenuId = null,
    trackingLink = null
}) {
    const design = useMemo(() => normalizeDesign(rawDesign), [rawDesign]);
    const { layout, content } = design;

    useEffect(() => {
        ensureFonts([design.theme.fonts.heading, design.theme.fonts.body, ...(design.layout.header === "board" ? ["Caveat"] : [])]);
    }, [design.theme.fonts.heading, design.theme.fonts.body, design.layout.header]);

    const rootRef = useRef(null);
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 30000);
        return () => clearInterval(id);
    }, []);

    const tz = settings.timezone || "America/Sao_Paulo";

    const menus = useMemo(() => entries(catalog.menus).filter((menu) => menu.active !== false).sort(byOrder), [catalog.menus]);
    const [menuId, setMenuId] = useState(initialMenuId);
    const currentMenu = menus.find((menu) => menu.id === menuId) || menus[0] || null;

    const categories = useMemo(
        () =>
            entries(catalog.categories)
                .filter((category) => category.active !== false && (!currentMenu || category.menuId === currentMenu.id || (!category.menuId && menus.length <= 1)))
                .sort(byOrder),
        [catalog.categories, currentMenu, menus.length]
    );

    const products = useMemo(() => entries(catalog.products).filter((product) => product.published !== false && product.name), [catalog.products]);
    const groups = catalog.optionGroups || {};

    const [search, setSearch] = useState("");
    const [diet, setDiet] = useState(null);

    const productsOf = (categoryId) =>
        products
            .filter((product) => product.categoryId === categoryId)
            .filter((product) => !diet || (Array.isArray(product.dietTags) && product.dietTags.includes(diet)))
            .filter((product) => !search || normalizeText(`${product.name} ${product.description}`).includes(normalizeText(search)))
            .sort(byOrder);

    const sections = categories.map((category) => ({ ...category, products: productsOf(category.id) })).filter((section) => section.products.length || (!search && !diet));

    const usedDiets = Object.keys(DIET_TAGS).filter((id) => products.some((product) => Array.isArray(product.dietTags) && product.dietTags.includes(id)));

    const featured = content.showFeatured && !search && !diet
        ? products.filter((product) => product.tags?.featured && categories.some((category) => category.id === product.categoryId)).sort(byOrder)
        : [];

    const hours = isOpenAt(settings.hours, now, tz);
    const status = { open: hours.open, next: hours.open ? "" : nextOpeningLabel(settings.hours, now, tz) };

    const table = tableId ? floor.tables?.[tableId] : null;
    const orderingAllowed = settings.mode === "ordering" && features.menusOrdering !== false;
    const fulfillments = enabledFulfillments(settings);
    const canOrder = mode !== "preview"
        ? orderingAllowed && (table ? Boolean(settings.tables?.qrOrdering && features.menusTables !== false) : fulfillments.some((item) => item !== "dine_in"))
        : orderingAllowed;

    const delivery = settings.fulfillment?.delivery;
    const deliveryText = delivery?.enabled && orderingAllowed
        ? [delivery.etaMinutes ? `${delivery.etaMinutes} min` : null, delivery.zones?.length ? "taxa por região" : delivery.feeCents ? `entrega ${formatBRL(delivery.feeCents)}` : "entrega grátis"].filter(Boolean).join(" · ")
        : "";

    const cart = useCart({ storageKey: mode === "public" && handle ? `markfy:menus:cart:${handle}` : null, catalog, now, tz });

    const [selected, setSelected] = useState(null);
    const [cartOpen, setCartOpen] = useState(false);
    const [hoursOpen, setHoursOpen] = useState(false);
    const [flash, setFlash] = useState("");
    const [activeCat, setActiveCat] = useState(null);
    const [tabCat, setTabCat] = useState(null);

    const availabilityOf = (product) => productAvailability(product, { now, tz });

    const showFlash = (text) => {
        setFlash(text);
        window.clearTimeout(showFlash.timer);
        showFlash.timer = window.setTimeout(() => setFlash(""), 2200);
    };

    const quickAdd = (product) => {
        cart.add({ productId: product.id, qty: 1, options: {} });
        showFlash(`${product.name} adicionado`);
    };

    const share = async () => {
        const url = window.location.href.split("?")[0];
        try {
            if (navigator.share) {
                await navigator.share({ title: settings.profile?.name || "Cardápio", url });
                return;
            }
            await navigator.clipboard.writeText(url);
            showFlash("Link copiado");
        } catch {
            /* compartilhamento cancelado */
        }
    };

    /* Categoria ativa enquanto rola (botões e lista lateral). */
    useEffect(() => {
        if (!rootRef.current || layout.nav === "tabs") return undefined;
        const root = scrollParent(rootRef.current);
        const nodes = rootRef.current.querySelectorAll("[data-mnr-section]");
        if (!nodes.length || typeof IntersectionObserver === "undefined") return undefined;

        const observer = new IntersectionObserver(
            (list) => {
                const visible = list.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
                if (visible[0]) setActiveCat(visible[0].target.getAttribute("data-mnr-section"));
            },
            { root, rootMargin: "-30% 0px -60% 0px" }
        );
        nodes.forEach((node) => observer.observe(node));
        return () => observer.disconnect();
    }, [layout.nav, sections.length, currentMenu?.id, search, diet]);

    const goTo = (id) => {
        if (layout.nav === "tabs") {
            setTabCat(id);
            return;
        }
        const node = rootRef.current?.querySelector(`[data-mnr-section="${id}"]`);
        node?.scrollIntoView({ behavior: design.theme.motion === "none" ? "auto" : "smooth", block: "start" });
    };

    const shownSections = layout.nav === "tabs" && !search && !diet
        ? sections.filter((section) => section.id === (tabCat && sections.some((s) => s.id === tabCat) ? tabCat : sections[0]?.id))
        : sections;

    const searchBox = content.showSearch && layout.search !== "hidden" ? (
        <label className="mnr-search">
            <Icon icon="solar:magnifer-linear" aria-hidden="true" />
            <span className="mnr-visually-hidden">Buscar no cardápio</span>
            <input type="search" value={search} placeholder="Buscar no cardápio" onChange={(event) => setSearch(event.target.value)} />
            {search && (
                <button type="button" onClick={() => setSearch("")} aria-label="Limpar busca">
                    <Icon icon="solar:close-circle-bold" />
                </button>
            )}
        </label>
    ) : null;

    const navItems = sections.map((section) => ({ id: section.id, name: section.name, icon: section.icon, count: section.products.length }));
    const currentNav = layout.nav === "tabs" ? (tabCat && sections.some((s) => s.id === tabCat) ? tabCat : sections[0]?.id) : activeCat || sections[0]?.id;

    /* A categoria ativa acompanha a rolagem da página: o chip dela
       desliza para dentro da barra (só a barra rola, a página não). */
    const navScrollRef = useRef(null);
    const [navAtEnd, setNavAtEnd] = useState(false);

    useEffect(() => {
        const bar = navScrollRef.current;
        const chip = bar?.querySelector(".is-on");
        if (!bar || !chip) return;
        const left = chip.offsetLeft - bar.offsetLeft;
        const right = left + chip.offsetWidth;
        if (left < bar.scrollLeft || right > bar.scrollLeft + bar.clientWidth) {
            bar.scrollTo({ left: Math.max(0, left - 16), behavior: design.theme.motion === "none" ? "auto" : "smooth" });
        }
    }, [currentNav, design.theme.motion]);

    const updateNavEnd = () => {
        const bar = navScrollRef.current;
        if (bar) setNavAtEnd(bar.scrollLeft + bar.clientWidth >= bar.scrollWidth - 4);
    };

    useEffect(updateNavEnd, [navItems.length]);

    const nav = (
        <>
            {layout.nav === "tiles" && !search && !diet && navItems.length > 0 && (
                <div className="mnr-wrap">
                    <ul className="mnr-tiles">
                        {navItems.map((item) => (
                            <li key={item.id}>
                                <button type="button" onClick={() => goTo(item.id)}>
                                    <span className="mnr-tiles__icon" aria-hidden="true">{item.icon || item.name.charAt(0)}</span>
                                    <b>{item.name}</b>
                                    <small>{item.count} {item.count === 1 ? "item" : "itens"}</small>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {layout.nav === "sections" ? (
                navItems.length > 1 && !search && (
                    <div className="mnr-wrap mnr-jump">
                        <label>
                            <span>Ir para</span>
                            <select value="" onChange={(event) => event.target.value && goTo(event.target.value)}>
                                <option value="">Escolha uma categoria</option>
                                {navItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                        </label>
                    </div>
                )
            ) : layout.nav !== "sidebar" ? (
                <nav className={`mnr-nav mnr-nav--${layout.nav === "tiles" ? "chips" : layout.nav}`} aria-label="Categorias">
                    <div className="mnr-wrap mnr-nav__inner">
                        {layout.search === "nav" && searchBox}
                        <div
                            ref={navScrollRef}
                            className={`mnr-nav__scroll${navAtEnd ? " is-end" : ""}`}
                            role={layout.nav === "tabs" ? "tablist" : undefined}
                            onScroll={updateNavEnd}
                        >
                            {navItems.map((item) => (
                                <button
                                    key={item.id}
                                    type="button"
                                    role={layout.nav === "tabs" ? "tab" : undefined}
                                    aria-selected={layout.nav === "tabs" ? currentNav === item.id : undefined}
                                    aria-current={layout.nav !== "tabs" && currentNav === item.id ? "true" : undefined}
                                    className={currentNav === item.id ? "is-on" : ""}
                                    onClick={() => goTo(item.id)}
                                >
                                    {item.name}
                                </button>
                            ))}
                        </div>
                    </div>
                </nav>
            ) : null}
        </>
    );

    const sectionList = (
        <div className="mnr-sections">
            {(search || diet) && (
                <p className="mnr-results" role="status">
                    {sections.reduce((sum, section) => sum + section.products.length, 0)} resultado(s)
                    {search && <> para “{search}”</>}
                </p>
            )}

            {featured.length > 0 && (
                <section className="mnr-section mnr-featured" aria-labelledby="mnr-featured-title">
                    <h2 id="mnr-featured-title" className="mnr-section__title">Destaques</h2>
                    <ProductGroup
                        products={featured}
                        layout="carousel"
                        groups={groups}
                        content={content}
                        canOrder={canOrder}
                        onOpen={setSelected}
                        onQuickAdd={quickAdd}
                        availabilityOf={availabilityOf}
                    />
                </section>
            )}

            {shownSections.map((section) => (
                <section key={section.id} className="mnr-section" data-mnr-section={section.id} aria-labelledby={`mnr-sec-${section.id}`}>
                    <div className="mnr-section__head">
                        <h2 id={`mnr-sec-${section.id}`} className="mnr-section__title">
                            {layout.nav === "tiles" && section.icon && <span aria-hidden="true">{section.icon} </span>}
                            {section.name}
                        </h2>
                        {section.description && <p>{section.description}</p>}
                    </div>
                    {section.products.length ? (
                        <ProductGroup
                            products={section.products}
                            layout={layout.products}
                            groups={groups}
                            content={content}
                            canOrder={canOrder}
                            onOpen={setSelected}
                            onQuickAdd={quickAdd}
                            availabilityOf={availabilityOf}
                        />
                    ) : (
                        <p className="mnr-empty">Nenhum produto nesta categoria ainda.</p>
                    )}
                </section>
            ))}

            {!sections.length && (
                <div className="mnr-empty mnr-empty--big">
                    <Icon icon="solar:document-text-linear" aria-hidden="true" />
                    {search || diet ? "Nada encontrado. Tente outra busca." : "O cardápio ainda está sendo preparado."}
                </div>
            )}
        </div>
    );

    const whatsapp = String(settings.contact?.whatsapp || "").replace(/\D/g, "");
    const external = Object.entries(settings.externalLinks || {}).filter(([, url]) => /^https:\/\//.test(String(url || "")));
    const EXTERNAL_LABELS = { ifood: "iFood", ninetyNine: "99Food", keeta: "Keeta", rappi: "Rappi", other: "Outro canal" };

    return (
        <div ref={rootRef} className={`mnr mnr--${mode} mnr--nav-${layout.nav} mnr--p-${layout.products} mnr--cols-${layout.columns} mnr--motion-${design.theme.motion}`} style={themeVars(design)}>
            {content.notice && <div className="mnr-notice" role="note">{content.notice}</div>}

            <Header design={design} settings={settings} status={status} onHours={() => content.showHours && setHoursOpen(true)} onShare={share} deliveryText={deliveryText} />

            {table && (
                <div className="mnr-wrap">
                    <div className="mnr-table">
                        <span><Icon icon="solar:armchair-2-bold" aria-hidden="true" /> Você está na <b>{table.label}</b></span>
                        {settings.tables?.qrCalls && features.menusTables !== false && actions.call && (
                            <span className="mnr-table__actions">
                                <button type="button" onClick={() => actions.call("waiter").then(() => showFlash("Garçom chamado")).catch((error) => showFlash(error.message))}>
                                    <Icon icon="solar:hand-shake-linear" aria-hidden="true" /> Chamar garçom
                                </button>
                                <button type="button" onClick={() => actions.call("bill").then(() => showFlash("Conta solicitada")).catch((error) => showFlash(error.message))}>
                                    <Icon icon="solar:bill-list-linear" aria-hidden="true" /> Pedir a conta
                                </button>
                            </span>
                        )}
                    </div>
                </div>
            )}

            {menus.length > 1 && (
                <div className="mnr-wrap mnr-menus" role="tablist" aria-label="Cardápios">
                    {menus.map((menu) => (
                        <button
                            key={menu.id}
                            type="button"
                            role="tab"
                            aria-selected={currentMenu?.id === menu.id}
                            className={currentMenu?.id === menu.id ? "is-on" : ""}
                            onClick={() => {
                                setMenuId(menu.id);
                                setTabCat(null);
                            }}
                        >
                            <b>{menu.name}</b>
                            {menu.description && <small>{menu.description}</small>}
                        </button>
                    ))}
                </div>
            )}

            {(layout.search === "top" || (layout.search === "nav" && layout.nav === "sidebar") || usedDiets.length > 0) && (
                <div className="mnr-wrap mnr-tools">
                    {(layout.search === "top" || (layout.search === "nav" && layout.nav === "sidebar")) && searchBox}
                    {usedDiets.length > 0 && (
                        <div className="mnr-filters" role="group" aria-label="Filtros">
                            {usedDiets.map((id) => (
                                <button key={id} type="button" aria-pressed={diet === id} onClick={() => setDiet(diet === id ? null : id)}>
                                    <Icon icon={DIET_TAGS[id].icon} aria-hidden="true" /> {DIET_TAGS[id].label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {nav}

            <main className="mnr-main">
                {layout.nav === "sidebar" ? (
                    <div className="mnr-wrap mnr-sidebar">
                        <nav className="mnr-sidebar__nav" aria-label="Categorias">
                            {navItems.map((item) => (
                                <button key={item.id} type="button" className={currentNav === item.id ? "is-on" : ""} aria-current={currentNav === item.id ? "true" : undefined} onClick={() => goTo(item.id)}>
                                    {item.name}
                                    <small>{item.count}</small>
                                </button>
                            ))}
                        </nav>
                        {sectionList}
                    </div>
                ) : (
                    <div className="mnr-wrap">{sectionList}</div>
                )}
            </main>

            <footer className="mnr-foot">
                <div className="mnr-wrap mnr-foot__grid">
                    <div>
                        <h2 className="mnr-foot__title">{settings.profile?.name || "Sobre"}</h2>
                        {settings.profile?.description && <p>{settings.profile.description}</p>}
                        {content.showAddress && settings.address?.text && <p><Icon icon="solar:map-point-linear" aria-hidden="true" /> {settings.address.text}</p>}
                    </div>
                    {content.showHours && settings.hours && (
                        <div>
                            <h3 className="mnr-foot__title">Horários</h3>
                            <dl className="mnr-hours">
                                {DAY_IDS.map((id) => (
                                    <React.Fragment key={id}>
                                        <dt>{DAY_LABELS[id]}</dt>
                                        <dd>{dayLabel(settings.hours[id])}</dd>
                                    </React.Fragment>
                                ))}
                            </dl>
                        </div>
                    )}
                    <div className="mnr-foot__links">
                        {content.showWhatsApp && whatsapp && (
                            <a className="mnr-btn" href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
                                <Icon icon="mdi:whatsapp" aria-hidden="true" /> Falar no WhatsApp
                            </a>
                        )}
                        {settings.contact?.phone && (
                            <a className="mnr-link" href={`tel:${String(settings.contact.phone).replace(/[^\d+]/g, "")}`}>
                                <Icon icon="solar:phone-linear" aria-hidden="true" /> {settings.contact.phone}
                            </a>
                        )}
                        {content.showSocials && settings.contact?.instagram && (
                            <a className="mnr-link" href={`https://instagram.com/${String(settings.contact.instagram).replace(/^@/, "")}`} target="_blank" rel="noopener noreferrer">
                                <Icon icon="mdi:instagram" aria-hidden="true" /> @{String(settings.contact.instagram).replace(/^@/, "")}
                            </a>
                        )}
                        {external.map(([id, url]) => (
                            <a key={id} className="mnr-link" href={url} target="_blank" rel="noopener noreferrer">
                                <Icon icon="solar:link-round-angle-linear" aria-hidden="true" /> Peça também pelo {EXTERNAL_LABELS[id] || "outro canal"}
                            </a>
                        ))}
                    </div>
                </div>
                {content.footerNote && <p className="mnr-wrap mnr-foot__note">{content.footerNote}</p>}
                <p className="mnr-wrap mnr-foot__credit">Cardápio digital feito com Markfy Menus</p>
            </footer>

            {canOrder && cart.count > 0 && (
                <div className="mnr-cartbar">
                    <button type="button" className="mnr-cartbar__btn" onClick={() => setCartOpen(true)}>
                        <span className="mnr-cartbar__count">{cart.count}</span>
                        <span>{content.cartLabel}</span>
                        <b>{formatBRL(cart.quote.subtotalCents)}</b>
                    </button>
                </div>
            )}

            {flash && <div className="mnr-flash" role="status">{flash}</div>}

            {selected && (
                <ProductSheet
                    product={selected}
                    groups={groups}
                    content={content}
                    canOrder={canOrder && selected.orderable !== false}
                    now={now}
                    tz={tz}
                    onClose={() => setSelected(null)}
                    onAdd={(selection) => {
                        cart.add(selection);
                        setSelected(null);
                        showFlash(`${selected.name} adicionado`);
                    }}
                />
            )}

            {cartOpen && (
                <CartSheet
                    cart={cart}
                    settings={settings}
                    design={design}
                    features={features}
                    mode={mode}
                    table={table ? { id: tableId, label: table.label } : null}
                    status={status}
                    actions={actions}
                    trackingLink={trackingLink}
                    onClose={() => setCartOpen(false)}
                />
            )}

            {hoursOpen && (
                <div className="mnr-sheet" role="dialog" aria-modal="true" aria-label="Horários de funcionamento">
                    <button type="button" className="mnr-sheet__veil" onClick={() => setHoursOpen(false)} aria-label="Fechar" />
                    <div className="mnr-sheet__panel mnr-sheet__panel--small">
                        <div className="mnr-sheet__head">
                            <h2>Horários</h2>
                            <button type="button" className="mnr-icon" onClick={() => setHoursOpen(false)} aria-label="Fechar"><Icon icon="solar:close-circle-linear" /></button>
                        </div>
                        <div className="mnr-sheet__body">
                            {!hours.configured && <p className="mnr-muted">O estabelecimento ainda não informou os horários.</p>}
                            <dl className="mnr-hours">
                                {DAY_IDS.map((id) => (
                                    <React.Fragment key={id}>
                                        <dt>{DAY_LABELS[id]}</dt>
                                        <dd>{dayLabel(settings.hours?.[id])}</dd>
                                    </React.Fragment>
                                ))}
                            </dl>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
