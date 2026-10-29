#!/usr/bin/env node

/*
============================================================
MIGRAR IMAGENS BASE64 DE PRODUTOS PARA O STORAGE
============================================================

Por que: produtos antigos guardam as fotos em base64 dentro
do Realtime Database (companys/{handle}/products/{id}/images).
Em 2026-10-21 um único produto tinha ~1,28 MB assim, e toda
tela que lia os produtos da empresa baixava esse peso de
novo — download do RTDB é cobrado por byte.

O app atual já lê as imagens do Storage primeiro
(src/utils/productImages.js) e só usa `images` do banco
quando a pasta do Storage está vazia.

O que o script faz, por produto com imagem base64:

  1. Se a pasta companys/{handle}/products/{id}/images do
     Storage estiver VAZIA, sobe cada base64 como
     image_{n}.{ext} (mesmo nome que o painel usa).
  2. Só depois que a pasta tiver arquivos, apaga o campo
     `images` do produto no banco. O campo `image` (URL) é
     mantido.

Nada é apagado se o upload falhar.

USO

    # mostra o que faria (padrão; não grava nada)
    node scripts/migrate-product-images.js

    # executa
    node scripts/migrate-product-images.js --commit

    # só uma empresa
    node scripts/migrate-product-images.js --handle tkbarbearia

CREDENCIAIS: as mesmas do backfill (Application Default
Credentials com acesso ao projeto):

    gcloud auth application-default login
    # ou
    export GOOGLE_APPLICATION_CREDENTIALS=/caminho/chave.json

RECOMENDADO antes de --commit: exportar um backup do banco
(Console > Realtime Database > Exportar JSON).
============================================================
*/

const path = require("path");

let admin;

try {
    admin = require("firebase-admin");
} catch {
    admin = require(path.join(__dirname, "..", "functions-backend", "node_modules", "firebase-admin"));
}

const PROJECT_ID = process.env.MARKFY_PROJECT_ID || "markfy-96942";
const DATABASE_URL = process.env.MARKFY_DATABASE_URL || "https://markfy-96942-default-rtdb.firebaseio.com";
const BUCKET = process.env.MARKFY_BUCKET || "markfy-96942.appspot.com";

const args = process.argv.slice(2);
const commit = args.includes("--commit");
const onlyHandle = args.includes("--handle") ? args[args.indexOf("--handle") + 1] : null;

const DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i;
const EXT = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

(async () => {

    admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: PROJECT_ID,
        databaseURL: DATABASE_URL,
        storageBucket: BUCKET
    });

    const db = admin.database();
    const bucket = admin.storage().bucket();

    console.log(`Modo: ${commit ? "COMMIT (vai gravar)" : "SIMULAÇÃO (nada será gravado)"}\n`);

    const handles = onlyHandle
        ? [onlyHandle]
        : Object.keys((await db.ref("companiesIndex").once("value")).val() || {})
            .concat(Object.keys((await db.ref("publicAccess").once("value")).val() || {}));

    let totalBytes = 0;
    let migrated = 0;

    for (const handle of [...new Set(handles)]) {

        /* Só os ids dos produtos (consulta rasa não existe no
           Admin SDK; o nó de produtos é lido uma vez por
           empresa, o que é aceitável num script manual). */
        const products = (await db.ref(`companys/${handle}/products`).once("value")).val() || {};

        for (const [productId, product] of Object.entries(products)) {

            const images = Array.isArray(product?.images)
                ? product.images
                : product?.images ? Object.values(product.images) : [];

            const base64 = images.filter((item) => typeof item === "string" && DATA_URL.test(item));

            if (!base64.length) continue;

            const bytes = base64.reduce((sum, item) => sum + item.length, 0);
            totalBytes += bytes;

            const folder = `companys/${handle}/products/${productId}/images/`;
            const [existing] = await bucket.getFiles({ prefix: folder, maxResults: 1 });

            console.log(`${handle}/${productId}: ${base64.length} imagem(ns) base64, ${kb(bytes)}; Storage ${existing.length ? "JÁ TEM arquivos" : "vazio"}`);

            if (!commit) continue;

            if (!existing.length) {
                for (const [index, item] of base64.entries()) {
                    const [, mime, data] = DATA_URL.exec(item);
                    const file = bucket.file(`${folder}image_${index}.${EXT[mime.toLowerCase()] || "jpg"}`);
                    await file.save(Buffer.from(data, "base64"), {
                        contentType: mime,
                        metadata: { cacheControl: "public, max-age=31536000" },
                        resumable: false
                    });
                }
            }

            const [after] = await bucket.getFiles({ prefix: folder, maxResults: 1 });

            if (!after.length) {
                console.warn(`  ! ${handle}/${productId}: pasta continua vazia, base64 mantido.`);
                continue;
            }

            await db.ref(`companys/${handle}/products/${productId}/images`).remove();
            migrated += 1;
            console.log("  ✓ migrado; campo images removido do banco.");
        }
    }

    console.log(`\nBase64 encontrado: ${kb(totalBytes)}.`);
    console.log(commit ? `Produtos migrados: ${migrated}.` : "Simulação: nada foi gravado. Rode com --commit para aplicar.");

    await admin.app().delete();

})().catch(async (error) => {
    console.error(error.message);
    process.exitCode = 1;
});
