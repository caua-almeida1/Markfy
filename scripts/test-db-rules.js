/* =========================================================
   TESTES DAS REGRAS DO REALTIME DATABASE (emulador)

   Sem dependências: fala com o emulador pela API REST, com
   tokens não assinados (o emulador não confere assinatura).
   Dados 100% fictícios.

   Rodar (precisa de Java 21+ para o emulador):

       firebase emulators:exec --only database --project demo-markfy "node scripts/test-db-rules.js"

   O emulators:exec carrega database.rules.json do firebase.json
   e define FIREBASE_DATABASE_EMULATOR_HOST.
========================================================= */

const HOST = process.env.FIREBASE_DATABASE_EMULATOR_HOST || "127.0.0.1:9000";
const NS = process.env.RTDB_NAMESPACE || "demo-markfy-default-rtdb";

const b64 = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");

const tokenFor = (uid, email) => {
    const now = Math.floor(Date.now() / 1000);
    return `${b64({ alg: "none", typ: "JWT" })}.${b64({
        iss: "https://securetoken.google.com/demo-markfy",
        aud: "demo-markfy",
        auth_time: now,
        iat: now,
        exp: now + 3600,
        sub: uid,
        user_id: uid,
        email,
        email_verified: true,
        firebase: { sign_in_provider: "password", identities: {} }
    })}.`;
};

const as = {
    anon: null,
    owner: tokenFor("owner1", "owner@acme.test"),
    pro: tokenFor("pro1", "pro@acme.test"),
    customer: tokenFor("cust1", "cust@cliente.test"),
    invited: tokenFor("newpro", "novo@acme.test"),
    stranger: tokenFor("u9", "u9@x.test")
};

const call = async (method, path, who, body, query = "") => {
    const url = `http://${HOST}/${path}.json?ns=${NS}${query}`;
    const headers = { "Content-Type": "application/json" };
    if (who === "admin") headers.Authorization = "Bearer owner";
    else if (who) headers.Authorization = `Bearer ${who}`;
    const response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    return response.status;
};

const NOW = Date.now();

const SEED = {
    companys: {
        acme: {
            name: "Acme Barbearia",
            handle: "acme",
            document: "12345678000199",
            phone: "11999990000",
            email: "contato@acme.test",
            products: { p1: { name: "Corte", value: "R$ 30,00", relatedUsers: [{ id: "pro1" }] } },
            schedules: { s1: { clientId: "c1", userName: "Ana", professionalId: "pro1", day: "22/10/2026", hour: "10:00", status: "pending" } },
            members: { owner1: { role: "master" }, pro1: { role: "professional" } },
            paymentOrders: { o1: { status: "pending", userId: "cust1", amount: 30 } },
            subscriptions: {
                cust1_p1: { uid: "cust1", status: "authorized" },
                other_p1: { uid: "other", status: "authorized" }
            },
            integrations: { whatsapp: { pro1: { enabled: true, phone: "11999990000" } }, futuraChave: "segredo" },
            paymentSettings: { receiveBeforeBooking: false, mercadoPago: { enabled: true } }
        }
    },
    users: {
        owner1: { name: "Dona", email: "owner@acme.test", companyHandle: "acme" },
        pro1: { name: "João", description: "Barbeiro", email: "pro@acme.test", companyHandle: "acme" },
        cust1: { name: "Cliente", email: "cust@cliente.test" }
    },
    invites: {
        inv1: { companyHandle: "acme", role: "professional", invitedEmail: "novo@acme.test", status: "pending", inviterUid: "owner1", expiresAt: NOW + 86400000 }
    },
    companiesIndex: { acme: { name: "Acme Barbearia", handle: "acme" } },
    publicAccess: { acme: { bookings: true } }
};

const results = [];

const expect = async (label, promise, allowed) => {
    const status = await promise;
    const ok = allowed ? status === 200 : status === 401 || status === 403;
    results.push({ label, ok, status });
    console.log(`${ok ? "PASS" : "FAIL"}  [${status}] ${label}`);
};

const reseed = () => call("PUT", "", "admin", SEED);

(async () => {

    await reseed();

    /* ---------- leitura pública ---------- */
    await expect("anônimo NÃO lê companys/acme inteiro", call("GET", "companys/acme", as.anon), false);
    await expect("anônimo lê nome da empresa", call("GET", "companys/acme/name", as.anon), true);
    await expect("anônimo lê produtos", call("GET", "companys/acme/products", as.anon), true);
    await expect("anônimo NÃO lê membros (e-mail/telefone de quem entrou por pedido)", call("GET", "companys/acme/members", as.anon), false);
    await expect("profissional lê a própria entrada em members", call("GET", "companys/acme/members/pro1", as.pro), true);
    await expect("cliente NÃO lê a entrada de outro em members", call("GET", "companys/acme/members/pro1", as.customer), false);
    await expect("anônimo NÃO lê CPF/CNPJ", call("GET", "companys/acme/document", as.anon), false);
    await expect("anônimo NÃO lê a agenda", call("GET", "companys/acme/schedules", as.anon), false);
    await expect("anônimo NÃO lista pedidos de pagamento", call("GET", "companys/acme/paymentOrders", as.anon), false);
    /* Antes: qualquer pessoa com o id lia nome, recado e horário do cliente. */
    await expect("anônimo NÃO lê um pedido de pagamento pelo id", call("GET", "companys/acme/paymentOrders/o1", as.anon), false);
    await expect("quem pagou lê o próprio pedido", call("GET", "companys/acme/paymentOrders/o1", as.customer), true);
    await expect("outro cliente NÃO lê o pedido", call("GET", "companys/acme/paymentOrders/o1", as.stranger), false);
    await expect("a equipe lê o pedido", call("GET", "companys/acme/paymentOrders/o1", as.pro), true);
    await expect("anônimo lê WhatsApp público", call("GET", "companys/acme/integrations/whatsapp", as.anon), true);
    await expect("anônimo NÃO lê outras integrações", call("GET", "companys/acme/integrations", as.anon), false);
    await expect("anônimo lê receiveBeforeBooking", call("GET", "companys/acme/paymentSettings/receiveBeforeBooking", as.anon), true);
    await expect("anônimo NÃO lê paymentSettings inteiro", call("GET", "companys/acme/paymentSettings", as.anon), false);
    await expect("anônimo lê o índice público", call("GET", "companiesIndex", as.anon), true);

    /* ---------- membros ---------- */
    await expect("dona lê a empresa inteira", call("GET", "companys/acme", as.owner), true);
    await expect("profissional lê a agenda", call("GET", "companys/acme/schedules", as.pro), true);
    await expect("estranho NÃO lê a agenda", call("GET", "companys/acme/schedules", as.stranger), false);
    await expect("estranho NÃO grava o nome da empresa", call("PUT", "companys/acme/name", as.stranger, "Hack"), false);
    await expect("estranho NÃO grava agendamento direto", call("PUT", "companys/acme/schedules/x", as.stranger, { status: "pending" }), false);

    /* ---------- users ---------- */
    await expect("anônimo NÃO lê users/pro1", call("GET", "users/pro1", as.anon), false);
    await expect("anônimo lê users/pro1/name", call("GET", "users/pro1/name", as.anon), true);
    await expect("anônimo NÃO lê users/pro1/email", call("GET", "users/pro1/email", as.anon), false);
    await expect("colega (dona) lê users/pro1", call("GET", "users/pro1", as.owner), true);
    await expect("cliente NÃO lê users/pro1", call("GET", "users/pro1", as.customer), false);
    await expect("cliente lê o próprio users/cust1", call("GET", "users/cust1", as.customer), true);
    await expect("cliente NÃO grava hash de senha", call("PATCH", "users/cust1", as.customer, { password: "abc" }), false);
    await expect("ninguém consulta users por e-mail", call("GET", "users", as.customer, undefined, '&orderBy="email"&equalTo="pro@acme.test"'), false);

    /* ---------- escalada via companyHandle forjado ---------- */
    await call("PUT", "companys/evil", "admin", { name: "Evil", handle: "evil", members: { u9: { role: "master" } } });
    await expect("atacante aprova pedido falso na própria empresa (permitido, é membro)", call("PUT", "companys/evil/joinRequests/pro1", as.stranger, { status: "approved" }), true);
    await expect("atacante NÃO troca o companyHandle de outra pessoa", call("PUT", "users/pro1/companyHandle", as.stranger, "evil"), false);
    await expect("atacante inclui a vítima como membro da própria empresa", call("PUT", "companys/evil/members/pro1", as.stranger, { role: "professional" }), true);
    await expect("mesmo assim NÃO lê users/{vítima} (ela aponta para acme)", call("GET", "users/pro1", as.stranger), false);
    await expect("o próprio usuário grava o companyHandle", call("PUT", "users/cust1/companyHandle", as.customer, "acme"), true);
    await expect("membro da acme NÃO lê quem aponta para acme sem ser membro", call("GET", "users/cust1", as.owner), false);
    await reseed();

    /* ---------- assinaturas ---------- */
    await expect("assinante consulta as próprias assinaturas", call("GET", "companys/acme/subscriptions", as.customer, undefined, '&orderBy="uid"&equalTo="cust1"'), true);
    await expect("assinante NÃO consulta as de outro", call("GET", "companys/acme/subscriptions", as.customer, undefined, '&orderBy="uid"&equalTo="other"'), false);
    await expect("cliente consulta a própria assinatura que ainda não existe", call("GET", "companys/acme/subscriptions/cust1_p9", as.customer), true);
    await expect("cliente NÃO lê assinatura de outro pelo id", call("GET", "companys/acme/subscriptions/other_p1", as.customer), false);
    await expect("assinante NÃO lista todas", call("GET", "companys/acme/subscriptions", as.customer), false);
    /* Cancelar é pela subscriptionsApi: gravar a data direto pulava a fidelidade. */
    await expect("assinante NÃO agenda o próprio cancelamento direto no banco", call("PATCH", "companys/acme/subscriptions/cust1_p1", as.customer, { cancellationRequestedAt: NOW, cancelScheduledFor: NOW, updatedAt: NOW }), false);
    await expect("assinante NÃO muda o status", call("PUT", "companys/acme/subscriptions/cust1_p1/status", as.customer, "authorized"), false);
    /* Dinheiro só o backend grava: nem a própria equipe forja valor, status ou conexão. */
    await expect("dono NÃO marca pedido como pago direto no banco", call("PUT", "companys/acme/paymentOrders/o1/status", as.owner, "paid"), false);
    await expect("dono NÃO cria pedido de pagamento", call("PUT", "companys/acme/paymentOrders/o2", as.owner, { status: "paid", amount: 1 }), false);
    await expect("dono NÃO ativa assinatura direto no banco", call("PUT", "companys/acme/subscriptions/other_p1/status", as.owner, "authorized"), false);
    await expect("dono NÃO grava o espelho da conexão do Mercado Pago", call("PATCH", "companys/acme/paymentSettings/mercadoPago", as.owner, { connected: true }), false);
    await expect("dono NÃO grava histórico de assinatura", call("PUT", "companys/acme/subscriptionHistory/x", as.owner, { status: "cancelled" }), false);
    await expect("dono ainda liga \"cobrar antecipado em todos os serviços\"", call("PUT", "companys/acme/paymentSettings/receiveBeforeBooking", as.owner, true), true);

    /* ---------- convite por link ---------- */
    await expect("convidado NÃO vira master", call("PUT", "companys/acme/members/newpro", as.invited, { role: "master", inviteId: "inv1" }), false);
    await expect("outra conta NÃO usa o convite", call("PUT", "companys/acme/members/u9", as.stranger, { role: "professional", inviteId: "inv1" }), false);
    await expect("convidado entra com o papel do convite", call("PUT", "companys/acme/members/newpro", as.invited, { role: "professional", inviteId: "inv1", joinedAt: NOW }), true);
    await expect("convidado marca o convite como aceito", call("PATCH", "invites/inv1", as.invited, { status: "accepted", acceptedBy: "newpro", acceptedAt: NOW }), true);
    await reseed();
    await expect("convidado NÃO troca o papel do convite", call("PATCH", "invites/inv1", as.invited, { role: "master" }), false);
    await expect("estranho NÃO cria convite para a empresa", call("PUT", "invites/inv2", as.stranger, { companyHandle: "acme", role: "master", invitedEmail: "u9@x.test", status: "pending", inviterUid: "u9" }), false);
    await expect("dona cria convite", call("PUT", "invites/inv3", as.owner, { companyHandle: "acme", role: "professional", invitedEmail: "x@acme.test", status: "pending", inviterUid: "owner1" }), true);

    /* ---------- criação de empresa ---------- */
    await expect("criar empresa entrando como master", call("PUT", "companys/novaco", as.stranger, { name: "Nova", handle: "novaco", members: { u9: { role: "master" } } }), true);
    await expect("criar empresa SEM se incluir como membro", call("PUT", "companys/outra", as.stranger, { name: "Outra", handle: "outra" }), false);
    await expect("NÃO sobrescreve empresa existente", call("PUT", "companys/acme", as.stranger, { name: "x", members: { u9: { role: "master" } } }), false);

    /* ---------- índices ---------- */
    await expect("dona atualiza o índice", call("PATCH", "companiesIndex/acme", as.owner, { name: "Acme" }), true);
    await expect("índice recusa e-mail", call("PATCH", "companiesIndex/acme", as.owner, { email: "a@b.c" }), false);
    await expect("estranho NÃO grava o índice", call("PATCH", "companiesIndex/acme", as.stranger, { name: "x" }), false);
    await expect("dona registra o documento da empresa", call("PUT", "documentsIndex/12345678000199", as.owner, "acme"), true);
    await expect("estranho NÃO toma o documento", call("PUT", "documentsIndex/12345678000199", as.stranger, "novaco2"), false);

    /* ---------- nós só do backend ---------- */
    await expect("ninguém lê bookingLocks", call("GET", "bookingLocks", as.owner), false);
    await expect("ninguém grava bookingRate", call("PUT", "bookingRate/1", as.stranger, 1), false);
    await expect("profissional NÃO lê o token do Mercado Pago da empresa", call("GET", "mercadoPagoConnections/acme", as.pro), false);
    await expect("dona NÃO lê o token do Mercado Pago (só o backend)", call("GET", "mercadoPagoConnections/acme", as.owner), false);
    await expect("ninguém lê subscriptionsIndex", call("GET", "subscriptionsIndex", as.owner), false);
    await expect("ninguém grava subscriptionLocks", call("PUT", "subscriptionLocks/acme/x", as.customer, { at: NOW }), false);

    const failed = results.filter((item) => !item.ok);

    console.log(`\n${results.length - failed.length}/${results.length} cenários conferem.`);

    process.exit(failed.length ? 1 : 0);

})().catch((error) => {
    console.error(error);
    process.exit(1);
});
