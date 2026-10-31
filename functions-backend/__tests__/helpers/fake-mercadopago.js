/* =====================================================
   MERCADO PAGO FALSO (só para testes)

   Imita as rotas que o backend usa, com as mesmas regras que
   importam para os testes: token de quem chama decide de
   qual conta é o recurso (um vendedor não enxerga o
   pagamento do outro), X-Idempotency-Key repetida devolve o
   mesmo pagamento, refresh token revogado é invalid_grant.

   Nada sai da máquina: instala um fetch global.
===================================================== */

const DAY = 24 * 60 * 60 * 1000;

const createFakeMercadoPago = () => {

    const state = {
        /* access token → conta (user_id) */
        tokens: { SELLER_TOKEN: 999 },
        /* refresh token → conta */
        refreshTokens: { REFRESH_OK: 999 },
        /* code do OAuth → o que a troca devolve */
        codes: {},
        accounts: {
            999: { id: 999, nickname: "TKBARBEARIA", site_id: "MLB", tags: ["normal"], email: "dono@tk.com" }
        },
        payments: {},
        byIdempotency: {},
        preapprovals: {},
        invoices: {},
        refunds: [],
        calls: [],
        nextId: 7000,
        offline: false,
        rejectPayment: null,
        rejectPreapproval: null,
        refreshCount: 0
    };

    const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

    const issueTokens = (userId) => {
        state.refreshCount += 1;
        const access = `ACCESS_${userId}_${state.refreshCount}`;
        const refresh = `REFRESH_${userId}_${state.refreshCount}`;
        state.tokens[access] = userId;
        state.refreshTokens[refresh] = userId;
        return {
            access_token: access,
            token_type: "bearer",
            expires_in: 15552000,
            scope: "offline_access payments read write",
            user_id: userId,
            refresh_token: refresh,
            public_key: `APP_USR-pub-${userId}`,
            live_mode: true
        };
    };

    const fetch = async (url, init = {}) => {

        if (state.offline) throw new TypeError("fetch failed");

        const { pathname, searchParams } = new URL(url);
        const method = init.method || "GET";
        const body = init.body ? JSON.parse(init.body) : null;
        const headers = init.headers || {};
        const auth = headers.Authorization || "";

        state.calls.push({ method, pathname, body, auth, idempotency: headers["X-Idempotency-Key"] || null });

        /* ---------- OAuth ---------- */

        if (pathname === "/oauth/token" && method === "POST") {

            if (body.client_id !== "APP_ID" || body.client_secret !== "APP_SECRET") {
                return json(400, { error: "invalid_client", message: "invalid client" });
            }

            if (body.grant_type === "authorization_code") {
                const entry = state.codes[body.code];
                if (!entry) return json(400, { error: "invalid_grant", message: "invalid code" });
                delete state.codes[body.code];
                state.accounts[entry.userId] = { id: entry.userId, nickname: entry.nickname, site_id: "MLB", tags: entry.tags || ["normal"] };
                return json(200, issueTokens(entry.userId));
            }

            if (body.grant_type === "refresh_token") {
                const userId = state.refreshTokens[body.refresh_token];
                if (!userId) return json(400, { error: "invalid_grant", message: "invalid refresh_token" });
                return json(200, issueTokens(userId));
            }

            return json(400, { error: "unsupported_grant_type" });
        }

        /* ---------- tudo o mais exige token válido ---------- */

        const sellerId = state.tokens[auth.replace("Bearer ", "")];

        if (!sellerId) return json(401, { message: "invalid access token", error: "unauthorized", status: 401 });

        if (pathname === "/users/me") return json(200, state.accounts[sellerId]);

        /* ---------- pagamentos ---------- */

        if (pathname === "/v1/payments" && method === "POST") {

            if (state.rejectPayment) return json(state.rejectPayment.status || 400, { message: state.rejectPayment.message, cause: [] });

            const key = headers["X-Idempotency-Key"];
            if (key && state.byIdempotency[key]) return json(201, state.payments[state.byIdempotency[key]]);

            const id = String(state.nextId++);
            const pix = body.payment_method_id === "pix";

            state.payments[id] = {
                id: Number(id),
                collector_id: sellerId,
                status: pix ? "pending" : "approved",
                status_detail: pix ? "pending_waiting_transfer" : "accredited",
                transaction_amount: body.transaction_amount,
                currency_id: "BRL",
                payment_method_id: body.payment_method_id,
                external_reference: body.external_reference,
                date_approved: pix ? null : new Date().toISOString(),
                payer: body.payer,
                point_of_interaction: pix
                    ? { transaction_data: { qr_code: "000201PIX", qr_code_base64: "aGk=", ticket_url: "https://www.mercadopago.com.br/payments/x" } }
                    : undefined
            };

            if (key) state.byIdempotency[key] = id;

            return json(201, state.payments[id]);
        }

        const refund = pathname.match(/^\/v1\/payments\/([^/]+)\/refunds$/);

        if (refund) {
            state.refunds.push(refund[1]);
            return json(201, { id: `ref_${refund[1]}` });
        }

        const payment = pathname.match(/^\/v1\/payments\/([^/]+)$/);

        if (payment) {
            const item = state.payments[payment[1]];
            /* De outra conta: o token não enxerga. */
            if (!item || item.collector_id !== sellerId) return json(404, { message: "Payment not found" });
            return json(200, item);
        }

        /* ---------- assinaturas ---------- */

        if (pathname === "/preapproval/search") {
            return json(200, { results: Object.values(state.preapprovals).filter((item) => item.collector_id === sellerId), paging: { total: 0 } });
        }

        if (pathname === "/preapproval" && method === "POST") {

            if (state.rejectPreapproval) return json(400, { message: state.rejectPreapproval, cause: [] });

            const id = `pre_${state.nextId++}`;

            state.preapprovals[id] = {
                id,
                collector_id: sellerId,
                status: body.status,
                external_reference: body.external_reference,
                payer_email: body.payer_email,
                auto_recurring: body.auto_recurring,
                next_payment_date: body.auto_recurring.start_date || new Date(Date.now() + 30 * DAY).toISOString(),
                init_point: `https://www.mercadopago.com.br/subscriptions/checkout?preapproval_id=${id}`
            };

            return json(201, state.preapprovals[id]);
        }

        const pre = pathname.match(/^\/preapproval\/([^/]+)$/);

        if (pre) {
            const item = state.preapprovals[pre[1]];
            if (!item || item.collector_id !== sellerId) return json(404, { message: "not found" });
            if (method === "PUT") Object.assign(item, body);
            return json(200, item);
        }

        if (pathname === "/authorized_payments/search") {
            const id = searchParams.get("preapproval_id");
            return json(200, { results: Object.values(state.invoices).filter((item) => item.preapproval_id === id) });
        }

        const invoice = pathname.match(/^\/authorized_payments\/([^/]+)$/);

        if (invoice) return state.invoices[invoice[1]] ? json(200, state.invoices[invoice[1]]) : json(404, {});

        return json(404, { message: `rota falsa ausente: ${method} ${pathname}` });
    };

    return { state, fetch };
};

module.exports = { createFakeMercadoPago };
