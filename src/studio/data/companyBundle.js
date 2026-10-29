import { useCallback, useEffect, useState } from "react";
import { getDatabase, ref, get } from "firebase/database";
import { getStorage, ref as storageRef, getDownloadURL } from "firebase/storage";

import { loadCompanyLogo } from "../../firebase/companyLogo";
import { fetchProfessionalProfile } from "../../firebase/publicCompany";
import { loadCompanyPhotos } from "../../firebase/companyPhotos";
import { loadProductImages } from "../../utils/productImages";
import { toE164BR, formatPhoneBR } from "../../utils/phoneBR";
import { getEffectivePriceLabel } from "../../utils/price";

/* =========================================================
   DADOS VIVOS DA EMPRESA PARA O STUDIO

   O que a página do Studio mostra e que já existe na
   Markfy: nome, logo, endereço, horários, redes, serviços,
   profissionais e fotos. Lido campo a campo (nunca o nó
   inteiro, que traz agendamentos e pedidos), com cache por
   empresa: dashboard, editor e página pública compartilham.

   A página publicada guarda só o conteúdo escrito no
   editor; estes dados são relidos a cada visita, então um
   preço alterado na Bookings aparece no site sem publicar
   de novo.
========================================================= */

const FIELDS = [
    "name",
    "description",
    "logoPreview",
    "location",
    "phone",
    "email",
    "socialMedia",
    "businessHours",
    /* Só o WhatsApp: é o único pedaço público de integrations. */
    "integrations/whatsapp",
    "categories"
];

const SOCIAL_META = {
    instagram: { label: "Instagram", icon: "mdi:instagram", base: "https://instagram.com/" },
    facebook: { label: "Facebook", icon: "mdi:facebook", base: "https://facebook.com/" },
    tiktok: { label: "TikTok", icon: "ic:baseline-tiktok", base: "https://tiktok.com/@" },
    x: { label: "X", icon: "prime:twitter", base: "https://x.com/" },
    youtube: { label: "YouTube", icon: "mdi:youtube", base: "https://youtube.com/@" }
};

export const stripHtml = (value) => {
    if (!value) return "";
    const div = document.createElement("div");
    div.innerHTML = String(value);
    return (div.textContent || "").replace(/\s+\n/g, "\n").trim();
};

const pickWhatsapp = (company) => {
    const integrations = company?.integrations?.whatsapp || {};
    const enabled = Object.values(integrations).find((item) => item?.enabled && item?.phone);
    return toE164BR(enabled?.phone || company?.phone || "");
};

const loadProfessionals = async (handle, members) => {
    const entries = Object.entries(members || {}).slice(0, 16);
    const storage = getStorage();

    const list = await Promise.all(
        entries.map(async ([uid, member]) => {
            const [user, photo] = await Promise.all([
                /* Só nome e descrição: users/{uid} inteiro é privado. */
                fetchProfessionalProfile(uid).catch(() => null),
                getDownloadURL(storageRef(storage, `users/${uid}/profileImg`)).catch(() => null)
            ]);

            const name = user?.name || member?.name;
            if (!name) return null;

            return {
                id: uid,
                name,
                role: member?.role === "master" ? "Responsável" : "Profissional",
                description: user?.description || "",
                photo
            };
        })
    );

    return list.filter(Boolean);
};

const loadBundle = async (handle) => {
    const db = getDatabase();

    const values = await Promise.all(
        FIELDS.map((field) =>
            get(ref(db, `companys/${handle}/${field}`))
                .then((snapshot) => snapshot.val())
                .catch(() => null)
        )
    );

    const company = Object.fromEntries(FIELDS.map((field, index) => [field, values[index]]));

    company.integrations = { whatsapp: company["integrations/whatsapp"] || null };

    if (!company.name) {
        return null;
    }

    const [productsSnap, membersSnap, logo, photos] = await Promise.all([
        get(ref(db, `companys/${handle}/products`)).catch(() => null),
        get(ref(db, `companys/${handle}/members`)).catch(() => null),
        loadCompanyLogo(handle),
        loadCompanyPhotos(handle)
    ]);

    const rawProducts = productsSnap?.val() || {};

    /*
     * Equipe: members é privado (guarda e-mail e telefone de
     * quem entrou por pedido), então só a própria equipe o lê.
     * Na página pública, a equipe são os profissionais ligados
     * aos serviços (relatedUsers), que já são públicos.
     */
    const team = membersSnap?.val() || Object.fromEntries(
        Object.values(rawProducts)
            .filter((product) => product?.status !== "arquivados")
            .flatMap((product) =>
                Array.isArray(product?.relatedUsers)
                    ? product.relatedUsers
                    : Object.values(product?.relatedUsers || {})
            )
            .filter((item) => item && typeof item.id === "string")
            .map((item) => [item.id, { role: item.role === "master" ? "master" : "professional" }])
    );

    const products = Object.entries(rawProducts)
        .map(([id, product]) => ({ id, ...product }))
        .filter((product) => product?.name && product.status !== "arquivados")
        .sort((a, b) => (Number(b.orders) || 0) - (Number(a.orders) || 0))
        .map((product) => ({
            id: product.id,
            name: product.name,
            price: getEffectivePriceLabel(product) || product.value || "",
            originalPrice: product.originalPrice && product.originalPrice !== product.value ? product.originalPrice : "",
            duration: Number(product.duration) || 0,
            description: stripHtml(product.description),
            categories: Array.isArray(product.categories) ? product.categories : [],
            image: null
        }));

    /* Imagens dos serviços e fotos da equipe em paralelo:
       são idas ao Storage independentes. */
    const [, professionals] = await Promise.all([
        Promise.all(
            products.slice(0, 24).map(async (product) => {
                const images = await loadProductImages(handle, product.id).catch(() => []);
                product.image = images?.[0] || null;
            })
        ),
        loadProfessionals(handle, team)
    ]);

    const whatsapp = pickWhatsapp(company);

    const socials = Object.entries(company.socialMedia || {})
        .map(([id, value]) => {
            const meta = SOCIAL_META[id];
            if (!meta) return null;
            const link = value?.link || (value?.handle ? `${meta.base}${value.handle}` : "");
            if (!link) return null;
            return { id, ...meta, handle: value?.handle || "", link };
        })
        .filter(Boolean);

    const location = company.location || null;

    const address = location
        ? [
            [location.street, location.number].filter(Boolean).join(", "),
            location.neighborhood,
            [location.city, location.state].filter(Boolean).join(" - ")
        ].filter(Boolean).join(", ")
        : "";

    return {
        handle,
        name: company.name,
        description: stripHtml(company.description),
        logo: logo || (typeof company.logoPreview === "string" && company.logoPreview.startsWith("http") ? company.logoPreview : null),
        email: company.email || "",
        phone: company.phone ? formatPhoneBR(company.phone) : "",
        whatsapp,
        location,
        address,
        businessHours: company.businessHours || null,
        categories: Array.isArray(company.categories) ? company.categories : [],
        socials,
        products,
        professionals,
        photos: photos || []
    };
};

const cache = new Map();

export const loadCompanyBundle = (handle, { fresh = false } = {}) => {
    if (!handle) return Promise.resolve(null);

    if (fresh || !cache.has(handle)) {
        cache.set(
            handle,
            loadBundle(handle).catch((error) => {
                cache.delete(handle);
                throw error;
            })
        );
    }

    return cache.get(handle);
};

export const useCompanyBundle = (handle) => {
    const [state, setState] = useState({ bundle: null, loading: !!handle, error: null });

    const load = useCallback(
        (fresh) => {
            if (!handle) return;

            setState((current) => ({ ...current, loading: true }));

            loadCompanyBundle(handle, { fresh })
                .then((bundle) => setState({ bundle, loading: false, error: null }))
                .catch((error) => setState({ bundle: null, loading: false, error }));
        },
        [handle]
    );

    useEffect(() => {
        load(false);
    }, [load]);

    return { ...state, reload: () => load(true) };
};

/* ---------- HORÁRIOS ---------- */

export const WEEK = [
    { id: "monday", label: "Segunda" },
    { id: "tuesday", label: "Terça" },
    { id: "wednesday", label: "Quarta" },
    { id: "thursday", label: "Quinta" },
    { id: "friday", label: "Sexta" },
    { id: "saturday", label: "Sábado" },
    { id: "sunday", label: "Domingo" }
];

export const formatHours = (businessHours) =>
    WEEK.map((day) => {
        const value = businessHours?.[day.id];
        return {
            ...day,
            open: !!value?.enabled && value?.open && value?.close,
            text: value?.enabled && value?.open && value?.close ? `${value.open} às ${value.close}` : "Fechado"
        };
    });

export const whatsappLink = (e164, message) =>
    e164
        ? `https://wa.me/${e164.replace(/\D/g, "")}${message ? `?text=${encodeURIComponent(message)}` : ""}`
        : "";
