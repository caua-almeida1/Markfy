/* =========================================================
   Gera database.rules.json a partir de database.rules.proposta.json.

   A proposta tem chaves "_comentario" (listas de texto) para
   explicar cada nó; o Realtime Database não aceita listas nas
   regras, então elas saem aqui. Roda sozinho antes do deploy
   do banco (predeploy no firebase.json):

       firebase deploy --only database
========================================================= */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "database.rules.proposta.json");
const target = path.join(root, "database.rules.json");

const strip = (node) => {
    if (!node || typeof node !== "object" || Array.isArray(node)) return node;
    const out = {};
    for (const [key, value] of Object.entries(node)) {
        if (key.startsWith("_")) continue;
        out[key] = strip(value);
    }
    return out;
};

const rules = strip(JSON.parse(fs.readFileSync(source, "utf8")));
fs.writeFileSync(target, JSON.stringify(rules, null, 2) + "\n");

console.log("database.rules.json gerado a partir de database.rules.proposta.json");
