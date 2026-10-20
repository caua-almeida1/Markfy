/* =========================================================
   Copia o motor do Markfy Menus para o backend.

   Fonte única: src/menus/engine (ESM, sem dependências).
   Destino:     functions-backend/menus-engine (marcado como
                ESM por um package.json próprio; o index.js
                do backend carrega com require(), suportado
                pelo Node 22.12+/24).

   Roda sozinho antes do deploy das functions (predeploy no
   firebase.json) e pode ser chamado à mão:

       node scripts/sync-menus-engine.js

   Os testes (src/menus/engine/__tests__/sync.test.js) falham
   se a cópia estiver diferente da fonte.
========================================================= */

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const source = path.join(root, "src", "menus", "engine");
const target = path.join(root, "functions-backend", "menus-engine");

fs.mkdirSync(target, { recursive: true });

for (const file of fs.readdirSync(target)) {
    if (file.endsWith(".js")) fs.unlinkSync(path.join(target, file));
}

const files = fs.readdirSync(source).filter((file) => file.endsWith(".js"));

for (const file of files) {
    fs.copyFileSync(path.join(source, file), path.join(target, file));
}

fs.writeFileSync(
    path.join(target, "package.json"),
    JSON.stringify({ type: "module", private: true, description: "Cópia gerada de src/menus/engine. Não edite aqui." }, null, 2) + "\n"
);

console.log(`menus-engine: ${files.length} arquivos copiados para functions-backend/menus-engine`);
