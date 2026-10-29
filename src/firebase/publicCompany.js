import {
    getDatabase,
    ref,
    get,
    onValue
} from "firebase/database";

/* =========================================================
   DADOS PÚBLICOS DA EMPRESA

   companys/{handle} inteiro NÃO é público: lá moram a agenda
   (nome e telefone de cada cliente), pedidos de pagamento,
   CPF/CNPJ e configurações internas. As regras do banco
   liberam ao público só os campos abaixo, um a um — então
   as páginas públicas leem campo a campo, nunca o nó.

   Isso também derruba o download: o nó inteiro de uma
   empresa chegava a 1,3 MB por causa de imagens antigas em
   base64 e da agenda; os campos do cabeçalho somam poucos KB.

   Se um campo novo precisar aparecer em página pública, ele
   tem de entrar aqui E em database.rules.proposta.json.
========================================================= */

export const PUBLIC_COMPANY_FIELDS = [
    "name",
    "handle",
    "description",
    "bio",
    "category",
    "categories",
    "logoPreview",
    "logoUrl",
    "location",
    "address",
    "endereco",
    "coordinates",
    "phone",
    "email",
    "socialMedia",
    "socials",
    "socialLinks",
    "businessHours",
    "amenities",
    "photos",
    "theme"
];

const readField = async (db, handle, field) => {
    try {
        const snapshot = await get(ref(db, `companys/${handle}/${field}`));
        return snapshot.val();
    } catch {
        /* Campo sem permissão ou fora do ar não derruba a página. */
        return null;
    }
};

/**
 * Lê os campos pedidos. Devolve null quando a empresa não
 * existe (sem nome).
 */
export const fetchPublicCompany = async (handle, fields = PUBLIC_COMPANY_FIELDS) => {

    if (!handle) return null;

    const db = getDatabase();

    const values = await Promise.all(
        fields.map((field) => readField(db, handle, field))
    );

    const company = {};

    fields.forEach((field, index) => {
        if (values[index] !== null && values[index] !== undefined) {
            company[field] = values[index];
        }
    });

    if (!company.name) return null;

    return { handle, ...company };
};

/**
 * Cabeçalho (lido uma vez) + produtos (em tempo real).
 *
 * Entrega o mesmo formato que o onValue de companys/{handle}
 * entregava — { name, handle, logoPreview, products, ... } —
 * ou null quando a empresa não existe. Os produtos seguem ao
 * vivo: preço ou status alterado no painel aparece sem
 * recarregar.
 */
export const watchPublicCompany = (handle, fields, onData, onError) => {

    const db = getDatabase();

    let cancelled = false;
    let base;
    let products;
    let productsReady = false;

    const emit = () => {
        if (cancelled || base === undefined || !productsReady) return;
        onData(base ? { ...base, products: products || {} } : null);
    };

    fetchPublicCompany(handle, fields)
        .then((company) => {
            base = company;
            if (!company) {
                if (!cancelled) onData(null);
                return;
            }
            emit();
        })
        .catch((error) => {
            if (!cancelled && onError) onError(error);
        });

    const stop = onValue(
        ref(db, `companys/${handle}/products`),
        (snapshot) => {
            products = snapshot.val();
            productsReady = true;
            emit();
        },
        (error) => {
            if (!cancelled && onError) onError(error);
        }
    );

    return () => {
        cancelled = true;
        stop();
    };
};

/** Nome e descrição pública de um profissional (users/{uid}/name|description). */
export const fetchProfessionalProfile = async (uid) => {

    const db = getDatabase();

    const [name, description] = await Promise.all([
        get(ref(db, `users/${uid}/name`)).then((s) => s.val()).catch(() => null),
        get(ref(db, `users/${uid}/description`)).then((s) => s.val()).catch(() => null)
    ]);

    return name || description ? { name: name || "", description: description || "" } : null;
};
