import {
    documentProblem,
    formatDocument,
    formatPhone,
    handleProblem,
    hasProblems,
    isValidCNPJ,
    isValidCPF,
    normalizeHandle,
    phoneProblem,
    stepProblems,
    suggestHandle
} from "../companyValidation";
import { COMPANY_SEGMENTS, searchSegments } from "../companySegments";
import { COMPANY_CATEGORIES } from "../../../../../utils/companyCategories";

test("CPF e CNPJ válidos e inválidos", () => {
    expect(isValidCPF("529.982.247-25")).toBe(true);
    expect(isValidCPF("111.111.111-11")).toBe(false);
    expect(isValidCPF("529.982.247-24")).toBe(false);
    expect(isValidCNPJ("11.222.333/0001-81")).toBe(true);
    expect(isValidCNPJ("11.222.333/0001-80")).toBe(false);
    expect(documentProblem("")).toMatch(/Informe/);
    expect(documentProblem("123")).toMatch(/11 números/);
    expect(documentProblem("52998224725")).toBe("");
});

test("@ sugerido a partir do nome e regras do @", () => {
    expect(suggestHandle("Barbearia do Zé & Cia!")).toBe("barbeariadozeecia");
    expect(normalizeHandle("@Minha Loja")).toBe("minhaloja");
    expect(handleProblem("ab")).toMatch(/pelo menos 3/);
    expect(handleProblem("tem espaço")).toMatch(/letras minúsculas/);
    expect(handleProblem("ok_nome-1")).toBe("");
});

test("máscaras de documento e telefone", () => {
    expect(formatDocument("52998224725")).toBe("529.982.247-25");
    expect(formatDocument("11222333000181")).toBe("11.222.333/0001-81");
    expect(formatPhone("11987654321")).toBe("(11) 98765-4321");
    expect(phoneProblem("1198765")).toMatch(/DDD/);
});

test("etapas obrigatórias: negócio e contato", () => {
    expect(hasProblems(stepProblems(0, { segment: "", name: "", handle: "" }))).toBe(true);
    expect(hasProblems(stepProblems(0, { segment: "barbearia", name: "Zé", handle: "barbeariaze" }))).toBe(false);
    expect(hasProblems(stepProblems(1, { document: "52998224725", email: "a@b.co", phone: "11987654321" }))).toBe(false);
    /* Identidade e endereço podem ser pulados. */
    expect(hasProblems(stepProblems(2, {}))).toBe(false);
    expect(hasProblems(stepProblems(3, {}))).toBe(false);
});

test("segmentos só usam categorias que existem e a busca ignora acento", () => {
    const ids = new Set(COMPANY_CATEGORIES.map((category) => category.id));
    COMPANY_SEGMENTS.forEach((segment) => segment.categories.forEach((id) => expect(ids.has(id)).toBe(true)));
    expect(searchSegments("estetica").map((segment) => segment.id)).toEqual(["estetica"]);
    expect(searchSegments("").length).toBe(COMPANY_SEGMENTS.length);
});
