/* =====================================================
   CONEXÃO DA EMPRESA COM O GATEWAY (OAUTH)

   Dois lugares, de propósito:

     mercadoPagoConnections/{handle}
        tokens. Só o backend lê e grava (regras: fechado
        para todo mundo). Nunca vai para o navegador nem
        para log.

     companys/{handle}/paymentSettings/mercadoPago
        o que a equipe precisa ver: conectado ou não, qual
        conta, ambiente (produção/teste), última verificação
        e última recusa. Nenhum token.

   RENOVAÇÃO

   O access token dura 180 dias, e cada renovação devolve um
   refresh token novo, que precisa ser guardado. A conexão
   renova sozinha 7 dias antes de vencer (em qualquer
   chamada e na rotina diária) e, se o Mercado Pago recusar
   a renovação — vendedor revogou o acesso, invalid_grant —,
   marca "reconectar" em vez de seguir tentando com um token
   morto. A tela de Pagamentos mostra isso para a empresa.

   ISOLAMENTO

   Uma empresa só alcança o próprio nó: tudo é endereçado
   pelo handle, e quem pode conectar, verificar ou
   desconectar é conferido em payments-api.js (membro da
   empresa com papel de administrador).
===================================================== */

const DAY_MS = 24 * 60 * 60 * 1000;

const REFRESH_BEFORE_MS = 7 * DAY_MS;

class ConnectionError extends Error {
    constructor(code, message) {
        super(message || code);
        this.code = code;
    }
}

module.exports = ({ db, provider, credentials }) => {

    const secretRef = (handle) => db().ref(`mercadoPagoConnections/${handle}`);
    const publicRef = (handle) => db().ref(`companys/${handle}/paymentSettings/mercadoPago`);

    const load = async (handle) => {

        const connection = (await secretRef(handle).once("value")).val();

        return connection && connection.connected && connection.accessToken ? connection : null;
    };

    const isUsable = (connection) =>
        Boolean(connection && connection.connected && connection.accessToken && connection.status !== "reconnect_required");

    const environmentOf = (connection) =>
        connection.environment || (connection.liveMode === false ? "test" : "production");

    /** O que a equipe vê. Sem token, sem e-mail. */
    const publicSummary = (connection, now = Date.now()) => ({
        provider: provider.id,
        connected: isUsable(connection),
        status: connection.status || "active",
        environment: environmentOf(connection),
        accountLabel: connection.accountNickname || null,
        mercadoPagoUserId: connection.mercadoPagoUserId !== undefined ? connection.mercadoPagoUserId : null,
        connectedAt: connection.connectedAt || null,
        updatedAt: now
    });

    const appCredentials = () => {

        const { clientId, clientSecret } = credentials() || {};

        if (!clientId || !clientSecret) {
            throw new ConnectionError("credentials_missing", "MERCADOPAGO_CLIENT_ID/SECRET não configurados.");
        }

        return { clientId, clientSecret };
    };


    /* -------------------------------------------------
       GRAVAR / MARCAR
    ------------------------------------------------- */

    const save = async (handle, { tokens, account, uid, now = Date.now() }) => {

        const connection = {
            provider: provider.id,
            connected: true,
            status: "active",
            mercadoPagoUserId: tokens.userId,
            publicKey: tokens.publicKey,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
            expiresAt: tokens.expiresAt,
            scope: tokens.scope,
            liveMode: tokens.liveMode,
            environment: (account && account.environment) || (tokens.liveMode ? "production" : "test"),
            accountNickname: (account && account.nickname) || null,
            accountSiteId: (account && account.siteId) || null,
            connectedAt: now,
            connectedBy: uid || null,
            updatedAt: now
        };

        await secretRef(handle).set(connection);

        /* set (e não update): reconectar limpa a recusa e a
           verificação da conta anterior. */
        await publicRef(handle).set(publicSummary(connection, now));

        return connection;
    };

    const markReconnect = async (handle, code, now = Date.now()) => {

        await secretRef(handle).update({ status: "reconnect_required", lastError: { code, at: now }, updatedAt: now });

        await publicRef(handle).update({
            connected: false,
            status: "reconnect_required",
            problem: { code, at: now },
            updatedAt: now
        });
    };

    /** Resultado do "Testar conexão" (sem dado pessoal). */
    const recordCheck = (handle, check) =>
        publicRef(handle).update({ lastCheck: check, updatedAt: Date.now() });

    /** Última recusa de cobrança (só o código), para a tela de Pagamentos explicar. */
    const recordFailure = (handle, { kind, code }, now = Date.now()) =>
        publicRef(handle).update({ lastFailure: { kind, code, at: now } }).catch(() => {});

    /**
     * Apaga os tokens desta empresa. O Mercado Pago continua
     * cobrando as assinaturas já autorizadas (elas vivem na
     * conta do vendedor) — por isso payments-api pede
     * confirmação quando ainda há assinaturas abertas.
     */
    const disconnect = async (handle, uid, now = Date.now()) => {

        const previous = (await secretRef(handle).once("value")).val();

        await secretRef(handle).remove();

        await publicRef(handle).set({
            provider: provider.id,
            connected: false,
            status: "disconnected",
            disconnectedAt: now,
            disconnectedBy: uid || null,
            previousAccount: previous
                ? {
                    mercadoPagoUserId: previous.mercadoPagoUserId !== undefined ? previous.mercadoPagoUserId : null,
                    accountLabel: previous.accountNickname || null
                }
                : null,
            updatedAt: now
        });
    };


    /* -------------------------------------------------
       RENOVAR
    ------------------------------------------------- */

    const refresh = async (handle, connection, now = Date.now()) => {

        if (!connection.refreshToken) {
            await markReconnect(handle, "no_refresh_token", now);
            throw new ConnectionError("reconnect_required");
        }

        const { clientId, clientSecret } = appCredentials();

        const result = await provider.refreshTokens({ clientId, clientSecret, refreshToken: connection.refreshToken, now });

        if (!result.ok) {

            if (result.revoked) {

                /* Duas renovações ao mesmo tempo: se a outra já
                   gravou um refresh token novo, o "revogado" era
                   só o token antigo. */
                const latest = await load(handle);

                if (latest && latest.refreshToken && latest.refreshToken !== connection.refreshToken && isUsable(latest)) {
                    return latest;
                }

                await markReconnect(handle, "refresh_revoked", now);
                throw new ConnectionError("reconnect_required");
            }

            throw new ConnectionError(
                "refresh_failed",
                `Renovação do token do Mercado Pago falhou (HTTP ${result.status || "sem resposta"}).`
            );
        }

        const patch = {
            accessToken: result.tokens.accessToken,
            refreshToken: result.tokens.refreshToken || connection.refreshToken,
            expiresIn: result.tokens.expiresIn,
            expiresAt: result.tokens.expiresAt,
            publicKey: result.tokens.publicKey || connection.publicKey || null,
            status: "active",
            lastError: null,
            lastRefreshAt: now,
            updatedAt: now
        };

        await secretRef(handle).update(patch);

        return { ...connection, ...patch };
    };

    const expiringSoon = (connection, now = Date.now()) =>
        Boolean(connection.refreshToken) &&
        Number(connection.expiresAt) > 0 &&
        Number(connection.expiresAt) < now + REFRESH_BEFORE_MS;

    /**
     * Chama o gateway com o token da empresa: renova antes se
     * está para vencer e, se o token for recusado, renova uma
     * vez e tenta de novo.
     */
    const withSeller = async (handle, call, { connection = null } = {}) => {

        let current = connection || await load(handle);

        if (!current) throw new ConnectionError("not_connected");
        if (current.status === "reconnect_required") throw new ConnectionError("reconnect_required");

        if (expiringSoon(current)) {
            current = await refresh(handle, current).catch((error) => {
                if (error.code === "reconnect_required") throw error;
                return current;
            });
        }

        let result = await call(current.accessToken, current);

        if (provider.credentialRefused(result)) {

            current = await refresh(handle, current);
            result = await call(current.accessToken, current);

            if (provider.credentialRefused(result)) {
                await markReconnect(handle, "token_refused");
                throw new ConnectionError("reconnect_required");
            }
        }

        return result;
    };


    /* -------------------------------------------------
       QUEM É QUEM
    ------------------------------------------------- */

    /** Empresas ligadas à conta `sellerId` do gateway (pode haver mais de uma). */
    const handlesForSeller = async (sellerId) => {

        if (!sellerId) return [];

        const found = new Set();

        for (const value of [Number(sellerId), String(sellerId)]) {

            if (typeof value === "number" && !Number.isFinite(value)) continue;

            const matches = (await db()
                .ref("mercadoPagoConnections")
                .orderByChild("mercadoPagoUserId")
                .equalTo(value)
                .once("value")).val() || {};

            Object.keys(matches).forEach((handle) => found.add(handle));
        }

        return [...found];
    };

    const connectedHandles = async () => {

        const all = (await db().ref("mercadoPagoConnections").once("value")).val() || {};

        return Object.keys(all).filter((handle) => isUsable(all[handle]));
    };


    /* -------------------------------------------------
       VERIFICAR (botão "Testar conexão")

       Só leitura: conta conectada (/users/me) e acesso à API
       de assinaturas. Nada de criar cobrança ou assinatura de
       mentira na conta do vendedor.
    ------------------------------------------------- */

    const verify = async (handle, now = Date.now()) => {

        let account = null;
        let subscriptionsOk = false;
        let problem = null;

        try {

            const me = await withSeller(handle, async (token) => {
                const result = await provider.getAccount(token);
                account = result.ok ? result.account : null;
                return result;
            });

            if (!me.ok) problem = me.network ? "network" : "account_unreachable";

            if (account) {
                const probe = await withSeller(handle, (token) => provider.probeSubscriptions(token));
                subscriptionsOk = probe.ok;
                if (!probe.ok && !problem) problem = probe.network ? "network" : "subscriptions_unreachable";
            }

        } catch (error) {
            if (!(error instanceof ConnectionError)) throw error;
            problem = error.code;
        }

        if (account) {
            await secretRef(handle).update({
                environment: account.environment,
                accountNickname: account.nickname,
                accountSiteId: account.siteId,
                updatedAt: now
            });
        }

        const connection = await load(handle);

        const check = {
            ok: Boolean(account) && subscriptionsOk,
            at: now,
            environment: account ? account.environment : (connection ? environmentOf(connection) : null),
            accountLabel: account ? account.nickname : null,
            payments: Boolean(account),
            subscriptions: subscriptionsOk,
            problem
        };

        if (connection) {
            await publicRef(handle).update({ ...publicSummary(connection, now), lastCheck: check });
        }

        return check;
    };


    /* -------------------------------------------------
       ROTINA DIÁRIA: renova quem vence nos próximos 30 dias
    ------------------------------------------------- */

    const refreshExpiring = async ({ withinMs = 30 * DAY_MS, now = Date.now() } = {}) => {

        const all = (await db().ref("mercadoPagoConnections").once("value")).val() || {};
        const summary = { refreshed: 0, reconnect: 0, errors: 0 };

        for (const [handle, connection] of Object.entries(all)) {

            if (!isUsable(connection) || !connection.refreshToken) continue;
            if (!(Number(connection.expiresAt) > 0 && Number(connection.expiresAt) < now + withinMs)) continue;

            try {
                await refresh(handle, connection, now);
                summary.refreshed += 1;
            } catch (error) {
                if (error.code === "reconnect_required") summary.reconnect += 1;
                else summary.errors += 1;
                console.error("payments: renovação do token falhou", handle, error.code || error.message);
            }
        }

        return summary;
    };


    return {
        load,
        isUsable,
        publicSummary,
        save,
        markReconnect,
        recordCheck,
        recordFailure,
        disconnect,
        refresh,
        withSeller,
        handlesForSeller,
        connectedHandles,
        verify,
        refreshExpiring
    };
};

module.exports.ConnectionError = ConnectionError;
module.exports.REFRESH_BEFORE_MS = REFRESH_BEFORE_MS;
