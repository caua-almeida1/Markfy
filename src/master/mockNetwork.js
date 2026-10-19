/* Dados falsos SÓ para pré-visualizar o layout em desenvolvimento
   (/markfy-master-dev?mock). Nunca é carregado em produção. */

const link = (h) => ({
    bookings: `https://markfy.app/central-user/${h}`,
    catalog: `https://markfy.app/central-user/${h}/catalog`,
    studio: `https://markfy.app/s/${h}`
});

const mk = (handle, name, plan, product, studio) => ({
    handle, name, logo: "", createdAt: null, links: link(handle), studio,
    license: plan ? { plan, product, status: "active", expiresAt: Date.now() + 86400000 * 20, note: "", source: "master", updatedAt: Date.now() } : null,
    team: [], owners: []
});

const companies = [
    mk("alemaodocorte", "Alemão do Corte", "pro", "both", "published"),
    mk("studio-lia", "Studio Lia", "basic", "bookings", "none"),
    mk("pilates-sol", "Pilates Sol", null, "none", "draft")
];

const person = (uid, name, email, kind, owned, worked, license) => ({
    uid, name, email, phone: "", provider: "", userType: "", createdAt: null,
    companies: [], kind, ownedCompanies: owned, workedCompanies: worked, license
});

const people = [
    person("u1", "Cauã Gonçalves", "caua@exemplo.com", "owner", [companies[0]], [], companies[0].license),
    person("u2", "Henrique Gomes", "henrique@exemplo.com", "owner", [companies[1]], [], companies[1].license),
    person("u3", "Marina Alves", "marina@exemplo.com", "owner", [companies[2]], [], null),
    person("u4", "Diego Amaral", "diego@exemplo.com", "employee", [], [companies[0]], companies[0].license),
    person("u5", "Visitante Teste", "visita@exemplo.com", "user", [], [], null)
];

companies[0].team = [{ uid: "u1", role: "master", name: "Cauã Gonçalves", email: "caua@exemplo.com" }, { uid: "u4", role: "professional", name: "Diego Amaral", email: "diego@exemplo.com" }];
companies[1].team = [{ uid: "u2", role: "master", name: "Henrique Gomes", email: "henrique@exemplo.com" }];
companies[2].team = [{ uid: "u3", role: "master", name: "Marina Alves", email: "marina@exemplo.com" }];
companies.forEach((c) => { c.owners = c.team.filter((m) => m.role === "master"); });

export const MOCK_NETWORK = { people, companies, warnings: [] };
