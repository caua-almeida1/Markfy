/* Carga da lista pública de empresas com o banco simulado.
   Os dados são fictícios; a forma imita o que existe em
   produção (índice com entrada só de logoUrl, por exemplo). */

import { loadPublicCompanyList, buildCompanyIndexEntry } from "../companiesIndex";

let mockTree = {};
let mockFailPaths = new Set();

jest.mock("firebase/database", () => ({
    getDatabase: () => ({ app: { options: { databaseURL: "https://example-rtdb.test" } } }),
    ref: (_db, path) => ({ path }),
    get: async ({ path }) => {
        if (mockFailPaths.has(path)) throw new Error("network");
        const value = path.split("/").reduce((node, key) => (node == null ? undefined : node[key]), mockTree);
        return { val: () => (value === undefined ? null : value), exists: () => value !== undefined && value !== null };
    },
    set: jest.fn(),
    update: jest.fn(),
    remove: jest.fn()
}));

beforeEach(() => {
    mockTree = {};
    mockFailPaths = new Set();
    global.fetch = jest.fn(async () => ({ ok: false, status: 401, json: async () => ({}) }));
});

test("entrada completa do índice volta como está", async () => {
    mockTree = { companiesIndex: { barbearia: { handle: "barbearia", name: "Barbearia X", categories: ["barbearia"] } } };

    const list = await loadPublicCompanyList();

    expect(list).toEqual([{ handle: "barbearia", name: "Barbearia X", categories: ["barbearia"] }]);
});

test("entrada só com logoUrl é completada pelos campos públicos (o caso de produção)", async () => {
    mockTree = {
        companiesIndex: { corte: { logoUrl: "https://storage.test/logo.png" } },
        companys: {
            corte: {
                name: "Corte Bom",
                description: "Cortes",
                category: "barbearia",
                document: "000",
                schedules: { s1: { userName: "Ana" } }
            }
        }
    };

    const [entry] = await loadPublicCompanyList();

    expect(entry.name).toBe("Corte Bom");
    expect(entry.handle).toBe("corte");
    expect(entry.logoUrl).toBe("https://storage.test/logo.png");
    expect(entry.categories).toEqual(["barbearia"]);
    /* Nada privado vaza para a lista pública. */
    expect(entry.document).toBeUndefined();
    expect(entry.schedules).toBeUndefined();
});

test("empresa elegível fora do índice entra pelos campos públicos (produção em 2026-10-21)", async () => {
    mockTree = {
        companiesIndex: { alemao: { logoUrl: "https://x" } },
        companys: {
            alemao: { name: "Alemão" },
            barbearia: { name: "Barbearia TK", categories: ["barbearia"], schedules: { s: { userName: "Ana" } } }
        }
    };

    const list = await loadPublicCompanyList({ handles: ["barbearia"] });

    expect(list.map((item) => item.handle).sort()).toEqual(["alemao", "barbearia"]);
    const tk = list.find((item) => item.handle === "barbearia");
    expect(tk.name).toBe("Barbearia TK");
    expect(tk.schedules).toBeUndefined();
});

test("entrada de handle inexistente (sem nome) sai da lista", async () => {
    mockTree = { companiesIndex: { fantasma: { logoUrl: "https://x" }, real: { name: "Real" } } };

    const list = await loadPublicCompanyList();

    expect(list.map((item) => item.handle)).toEqual(["real"]);
});

test("índice vazio e consulta rasa negada (não master) devolve lista vazia, sem quebrar", async () => {
    mockTree = { companys: { a: { name: "A" } } };

    await expect(loadPublicCompanyList({ authToken: "token" })).resolves.toEqual([]);
    expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining("companys.json?shallow=true"));
});

test("índice vazio para a conta master usa a consulta rasa", async () => {
    mockTree = { companys: { a: { name: "A", categories: { 0: "estetica" } } } };
    global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({ a: true }) }));

    const list = await loadPublicCompanyList({ authToken: "master" });

    expect(list).toHaveLength(1);
    expect(list[0].categories).toEqual(["estetica"]);
});

test("erro de rede no índice vira exceção (a tela mostra erro, não 'nenhuma empresa')", async () => {
    mockFailPaths.add("companiesIndex");

    await expect(loadPublicCompanyList()).rejects.toThrow("network");
});

test("o índice nunca recebe documento, e-mail ou telefone", () => {
    const entry = buildCompanyIndexEntry("x", {
        name: "X",
        document: "123",
        email: "a@b.c",
        phone: "11999999999",
        location: { city: "SP", cpf: "999" }
    });

    expect(entry.document).toBeUndefined();
    expect(entry.email).toBeUndefined();
    expect(entry.phone).toBeUndefined();
    expect(entry.location).toEqual({ city: "SP" });
});
