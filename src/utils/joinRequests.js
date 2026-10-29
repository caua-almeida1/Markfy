import {
    get,
    getDatabase,
    onValue,
    ref,
    remove,
    set,
    update
} from "firebase/database";


/* =========================================================
   PEDIDOS DE ENTRADA EM UMA EMPRESA

   Alguém que já trabalha num negócio já cadastrado não cria
   empresa nenhuma: pede para entrar na que existe, e quem
   administra aprova.

   ONDE FICA
   ---------

       companys/{handle}/joinRequests/{uid}

   A chave é o uid de quem pediu, de propósito. Isso dá, de
   graça, "um pedido por pessoa por empresa": clicar duas
   vezes atualiza o mesmo nó em vez de encher a caixa do
   administrador com pedidos repetidos.

   E é por isso que quem pediu consegue acompanhar o próprio
   pedido sem ler a empresa inteira — ele sabe o caminho
   exato do nó dele.

   O QUE VAI JUNTO
   ---------------

   Nome e contato (e-mail ou telefone) ficam gravados no
   pedido. Sem isso o administrador vê uma lista de uids e
   não tem como saber quem é quem — e o contato é o que
   permite conferir antes de dar acesso à agenda da empresa.
   ========================================================= */


export const REQUEST_STATUS = {
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected"
};


const requestRef = (handle, uid) =>
    ref(
        getDatabase(),
        `companys/${handle}/joinRequests/${uid}`
    );


/**
 * Cria (ou refaz) o pedido de entrada.
 *
 * Devolve o pedido gravado.
 */
export const createJoinRequest = async ({
    handle,
    user,
    name,
    email,
    phone,
    message
}) => {

    if (!handle || !user?.uid) {
        throw new Error("Pedido sem empresa ou sem usuário.");
    }

    const pedido = {

        uid: user.uid,

        name:
            (name || user.displayName || "").trim(),

        email:
            (email || user.email || "").trim(),

        phone:
            (phone || user.phoneNumber || "").trim(),

        message:
            (message || "").trim(),

        status: REQUEST_STATUS.PENDING,

        createdAt: Date.now()

    };

    await set(
        requestRef(handle, user.uid),
        pedido
    );

    /*
     * Atalho no usuário.
     *
     * Sem ele, quem fecha a aba e volta depois não teria como
     * reencontrar o próprio pedido: precisaria varrer todas
     * as empresas procurando o próprio uid.
     */
    await update(
        ref(getDatabase(), `users/${user.uid}`),
        { pendingJoinHandle: handle }
    );

    return pedido;

};


/**
 * Acompanha um pedido em tempo real.
 *
 * É o que permite a tela de espera virar sozinha quando o
 * administrador aprova, sem a pessoa ficar recarregando.
 */
export const watchJoinRequest = (handle, uid, callback) =>
    onValue(
        requestRef(handle, uid),
        (snapshot) =>
            callback(snapshot.val() || null)
    );


/** Todos os pedidos de uma empresa, em tempo real. */
export const watchCompanyJoinRequests = (handle, callback) =>
    onValue(
        ref(
            getDatabase(),
            `companys/${handle}/joinRequests`
        ),
        (snapshot) => {

            const dados = snapshot.val() || {};

            const lista =
                Object.entries(dados)
                    .map(([uid, pedido]) => ({
                        ...pedido,
                        uid
                    }))
                    .sort(
                        (a, b) =>
                            (b.createdAt || 0) -
                            (a.createdAt || 0)
                    );

            callback(lista);

        }
    );


export const cancelJoinRequest = async (handle, uid) => {

    await remove(requestRef(handle, uid));

    await update(
        ref(getDatabase(), `users/${uid}`),
        { pendingJoinHandle: null }
    );

};


/**
 * Aprova o pedido e dá acesso à empresa.
 *
 * A ordem importa: membro primeiro, vínculo no usuário
 * depois, e só então o pedido some. Quem está esperando
 * acompanha `users/{uid}/companyHandle` — quando esse campo
 * aparece, o acesso já existe de verdade.
 *
 * O pedido é APAGADO no fim, não marcado como aprovado. Ele
 * já cumpriu o papel: o vínculo agora vive em members/, que
 * é a fonte da verdade. Guardar o pedido seria manter um
 * segundo registro da mesma coisa, que cresce para sempre e
 * ainda é lido toda vez que o painel abre a aba de pedidos.
 */
export const approveJoinRequest = async ({
    handle,
    request,
    role = "professional",
    displayName
}) => {

    const db = getDatabase();

    const nome =
        (displayName || request.name || "").trim();

    await set(
        ref(
            db,
            `companys/${handle}/members/${request.uid}`
        ),
        {
            uid: request.uid,
            name: nome,
            email: request.email || "",
            phone: request.phone || "",
            role,
            joinedAt: Date.now()
        }
    );

    /*
     * users/{uid} é de OUTRA pessoa: as regras só deixam o
     * próprio dono gravar ali (inclusive companyHandle — antes,
     * aprovar um pedido falso permitia trocar a empresa de
     * qualquer usuário e passar a ler o perfil dele). Quem
     * grava o vínculo agora é a própria pessoa, na tela de
     * espera, ao ver a entrada dela em members
     * (watchMyMembership). Esta gravação fica como tentativa
     * para o painel master; negada, não atrapalha a aprovação.
     */
    try {

        await update(
            ref(db, `users/${request.uid}`),
            {
                companyHandle: handle,
                pendingJoinHandle: null,
                ...(nome ? { name: nome } : {})
            }
        );

    } catch {

        /* esperado para quem não é o dono do perfil */

    }

    await remove(
        requestRef(handle, request.uid)
    );

};


export const rejectJoinRequest = async ({ handle, request }) => {

    await update(
        requestRef(handle, request.uid),
        {
            status: REQUEST_STATUS.REJECTED,
            reviewedAt: Date.now()
        }
    );

    await update(
        ref(getDatabase(), `users/${request.uid}`),
        { pendingJoinHandle: null }
    );

};


/**
 * Observa o vínculo do usuário com uma empresa.
 *
 * É o sinal de "você entrou". Antes a tela de espera olhava o
 * status do pedido, mas o pedido agora é apagado na aprovação
 * — e um nó que some não diz se foi aprovação ou desistência.
 * O vínculo diz.
 */
export const watchCompanyHandle = (uid, callback) =>
    onValue(
        ref(getDatabase(), `users/${uid}/companyHandle`),
        (snapshot) =>
            callback(
                snapshot.exists()
                    ? snapshot.val()
                    : null
            )
    );


/**
 * Observa a PRÓPRIA entrada em companys/{handle}/members.
 *
 * É o sinal de aprovação que a pessoa consegue ler (members é
 * privado; cada um lê só a sua entrada). Ao aparecer, quem
 * grava o vínculo em users/{uid} é a própria pessoa — o único
 * caminho que as regras aceitam.
 */
export const watchMyMembership = (handle, uid, callback) =>
    onValue(
        ref(getDatabase(), `companys/${handle}/members/${uid}`),
        (snapshot) => callback(snapshot.exists() ? snapshot.val() : null),
        () => callback(null)
    );

/** Grava o vínculo com a empresa no próprio perfil (depois da aprovação). */
export const linkMyCompany = (uid, handle) =>
    update(ref(getDatabase(), `users/${uid}`), {
        companyHandle: handle,
        pendingJoinHandle: null
    });


/** O handle da empresa cujo pedido está pendente, se houver. */
export const getPendingJoinHandle = async (uid) => {

    if (!uid) return null;

    const snapshot = await get(
        ref(
            getDatabase(),
            `users/${uid}/pendingJoinHandle`
        )
    );

    return snapshot.exists()
        ? snapshot.val()
        : null;

};
