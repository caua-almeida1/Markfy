import {
    isBookingsOpen,
    profileCompleteness,
    rankCompanies
} from "../companyEligibility";

import { publicAccessFor } from "../../menus/engine/licensing";

const NOW = new Date("2026-10-21T12:00:00-03:00").getTime();

const company = (handle, extra = {}) => ({ handle, name: handle.toUpperCase(), ...extra });

describe("elegibilidade de empresas nas áreas públicas", () => {

    test("só aparece quem tem Bookings ativo e não vencido", () => {
        expect(isBookingsOpen({ bookings: true }, NOW)).toBe(true);
        expect(isBookingsOpen({ bookings: true, expiresAt: NOW + 1 }, NOW)).toBe(true);
        expect(isBookingsOpen({ bookings: true, expiresAt: NOW - 1 }, NOW)).toBe(false);
        expect(isBookingsOpen({ bookings: false, featured: true }, NOW)).toBe(false);
        expect(isBookingsOpen(undefined, NOW)).toBe(false);
    });

    test("plano superior não faz aparecer empresa inativa ou vencida", () => {
        const access = {
            vencida: { bookings: true, featured: true, expiresAt: NOW - 1000 },
            sem_bookings: { bookings: false, featured: true },
            ativa: { bookings: true }
        };

        const list = rankCompanies(
            [company("vencida"), company("sem_bookings"), company("ativa"), company("sem_registro")],
            access,
            NOW
        );

        expect(list.map((item) => item.handle)).toEqual(["ativa"]);
    });

    test("destaque vem primeiro, sem esconder os demais", () => {
        const access = {
            basica: { bookings: true },
            pro: { bookings: true, featured: true },
            completa: { bookings: true }
        };

        const list = rankCompanies(
            [
                company("basica"),
                company("completa", { description: "Corte", categories: ["barbearia"], logoUrl: "https://x", location: { city: "SP" } }),
                company("pro")
            ],
            access,
            NOW
        );

        expect(list.map((item) => item.handle)).toEqual(["pro", "completa", "basica"]);
        expect(list[0].featured).toBe(true);
        expect(list[1].featured).toBe(false);
    });

    test("featured vindo do navegador é ignorado quando há publicAccess", () => {
        const list = rankCompanies(
            [company("a", { featured: true }), company("b")],
            { a: { bookings: true }, b: { bookings: true } },
            NOW
        );

        expect(list.every((item) => item.featured === false)).toBe(true);
    });

    test("completude conta logo, descrição, categoria e endereço", () => {
        expect(profileCompleteness({})).toBe(0);
        expect(profileCompleteness({ description: "<p> </p>" })).toBe(0);
        expect(profileCompleteness({ description: "Oi", category: "x", logoUrl: "u", location: { street: "R" } })).toBe(4);
    });

    test("publicAccessFor marca destaque só para Pro/Premium ativos", () => {
        expect(publicAccessFor({ plan: "pro", product: "both", status: "active" }, NOW).featured).toBe(true);
        expect(publicAccessFor({ plan: "premium", product: "all", status: "active" }, NOW).featured).toBe(true);
        expect(publicAccessFor({ plan: "basic", product: "bookings", status: "active" }, NOW).featured).toBe(false);
        expect(publicAccessFor({ plan: "pro", product: "both", status: "suspended" }, NOW).featured).toBe(false);
        expect(publicAccessFor({ plan: "pro", product: "both", status: "active", expiresAt: NOW - 1 }, NOW).featured).toBe(false);
        expect(publicAccessFor(null, NOW).featured).toBe(false);
    });
});
