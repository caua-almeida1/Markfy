# Auditoria Markfy — 21/10/2026

Branch: `fix/auditoria-empresas-seguranca` (nada foi publicado em produção, nada foi commitado).
Projeto Firebase ativo: `markfy-96942`. Frontend em produção: **https://markfy.vercel.app** (Vercel).

---

## 0. Mapa da arquitetura (confirmado no código)

| Camada | O que é |
|---|---|
| Frontend | **Uma** SPA React 18 (create-react-app), roteada por `src/App.js`. Bookings, Studio e Menus **não** são apps separados: Bookings = `/central-user`, `/central-adm`, `/newcompany`; Studio = `/studio/*` e `/s/:handle`; Menus = `/menus/*` e `/m/:slug` (lazy chunks). |
| Banco | **Realtime Database** (`markfy-96942-default-rtdb`). Firestore era inicializado mas **nunca usado** (removido). |
| Arquivos | Firebase Storage (`companys/{handle}/…`, `users/{uid}/profileImg`). |
| Auth | Firebase Auth (e-mail/senha, Google, telefone/SMS). |
| Backend | Cloud Functions v2 em `functions-backend/` (codebase `backend`, Node 24): Mercado Pago (OAuth, pagamentos, assinaturas, webhooks), planos, QR Code, `menusApi`. `firebase-functions/` é um template vazio (não usado). |
| Pagamentos | Mercado Pago (conta da empresa via OAuth + conta da Markfy para planos). |
| Hospedagem | Vercel (`markfy.vercel.app`). O Firebase Hosting (`markfy-96942.web.app`) ainda serve uma **cópia antiga (março/2026)** do app. |
| Planos | `planCatalog`, `licenses/{handle}` (privado) e `publicAccess/{handle}` (espelho público mínimo, só master/backend gravam). |

---

## 1. Empresas sumiram (Bookings, `central-user`, `explore`) — RESOLVIDO no código

### Causa raiz (com evidência)
1. **Regras publicadas em 20/10** (commit `1.0.3.0.4` ligou `database.rules.json` ao `firebase.json`). Confirmei que as regras em produção são **idênticas** a esse arquivo (`firebase database:get /.settings/rules`).
2. Nessas regras, `companys` (nó pai) só é legível pela conta master.
3. Dados reais em produção (consultas rasas, só chaves): `companys` tem **3** empresas; `companiesIndex` tem **1** entrada (`alemaodocorte`) e ela só tem `logoUrl` — sem `name` (gravada pela migração de logo em `companyLogo.js`).
4. Explore/central descartavam entradas sem nome → índice “vazio” → fallback `companys.json?shallow=true` → **negado** pelas regras novas → lista vazia, sem erro na tela. Reproduzi isso no build original: “Nenhuma empresa nesta categoria ainda”.

### Correção
- `src/firebase/companiesIndex.js` → `loadPublicCompanyList()`: entradas incompletas são completadas pelos **campos públicos** da empresa; empresas **elegíveis em `publicAccess`** que faltam no índice também entram. Erro de rede vira erro (não “zero empresas”).
- `src/firebase/useCompaniesIndex.js`: fonte única para Explorar, central e “Sou cliente” (`ClientExplore`); cache de 5 min e **nunca** de lista vazia; `reload()`.
- `Explore.jsx`: usa a mesma fonte e o mesmo critério de elegibilidade (antes listava empresas sem plano que abriam “Empresa indisponível”); estado de **erro com “Tentar de novo”** separado de “nenhuma empresa”.
- `UserCompanyContext.jsx` → `repairCompanyIndex()`: quando alguém da equipe abre o painel, a entrada do índice é reparada (sem apagar `logoUrl`).
- `scripts/backfill-companies-index.js` (já existia): agora preserva `logoUrl` e não imprime CPF/CNPJ.

**Verificado no navegador, contra o banco de produção, sem alterar dados:** a central passou a mostrar “2 empresas atendem com hora marcada” (Tk Barbearia, Markfy); o Explorar lista as duas.

### Outras regressões causadas pelas regras de 20/10 (todas corrigidas no código)
| Fluxo | O que quebrava | Correção |
|---|---|---|
| **Agendamento pelo cliente** | lia `users/{profissional}` (horários) e gravava em `companys/{h}/products` e `schedules` → tudo negado | Nova Cloud Function `bookingsApi` (abaixo) |
| Nomes dos profissionais | `users/{id}` negado | lê só `users/{id}/name` (regra pública só desse campo) |
| **Cadastro de conta** | consulta `users` por e-mail (negada) derrubava todo cadastro com “Email ou senha incorreta” | consulta removida; duplicidade vem do Firebase Auth (`auth/email-already-in-use`) com mensagem clara |
| **Criação de empresa** | grava a empresa e depois `members/{uid}`; a 2ª gravação era negada | membro master vai na **mesma** gravação |
| Checagem de @ disponível | lia `companys/{handle}` inteiro (negado; erro engolido → todo @ “livre”) | lê `companys/{handle}/name` |
| Convite por link | convidado grava `members/{uid}` (negado) e consulta `users` por e-mail | regra valida o convite (empresa, papel, e-mail, validade); consulta tolerante |
| Convite → “Criar conta” | navegava para `/register`, rota inexistente → caía na landing | rota `/register` (alias do login, que abre em modo cadastro) |
| Minhas reservas / cancelar | liam a **agenda inteira** da empresa | `bookingsApi` (`mine`, `cancel`) |

---

## 2. Segurança (achados e o que foi feito)

| # | Gravidade | Achado (evidência) | Status |
|---|---|---|---|
| S1 | **Crítica** | **Storage totalmente aberto** em produção: `allow read, write: if true` (lido via MCP). Qualquer pessoa sem login apaga/troca logos, fotos e imagens de produto e sobe arquivos de qualquer tipo/tamanho (custo). | `storage.rules` novo (validado: “No errors”) + `firebase.json`. **Não publicado.** |
| S2 | **Crítica** | `companys/{handle}` legível por qualquer pessoa: **CPF/CNPJ**, agenda com **nome/telefone dos clientes**, pedidos de pagamento, configurações. O handle é público (está na URL). | Regras reescritas: nó inteiro só para membros; público lê **campo a campo** (lista em `src/firebase/publicCompany.js`). Validadas no servidor (dry-run). **Não publicadas.** |
| S3 | **Alta** | Cadastro gravava **SHA-256 sem sal da senha** em `users/{uid}/password` (nunca lido). Com o banco aberto antes de 20/10, era baixável. | Gravação removida; login Google descarta o hash legado; regra bloqueia novo valor. Limpeza dos hashes existentes = pendente (apaga dados, precisa de autorização). |
| S3b | **Alta** | **Escalada via `companyHandle` forjado** (pré-existente + agravada pela primeira versão das regras novas): um membro da empresa A gravava `joinRequests/{vítima} = approved` na própria empresa e, com isso, `users/{vítima}/companyHandle = A` — trocando a empresa da vítima e (pela regra de colegas) lendo o `users/{vítima}` inteiro. Além disso, `members` público expunha e-mail e telefone gravados na aprovação de pedidos. | `companyHandle` só o próprio usuário grava; leitura entre colegas exige que alvo e leitor sejam membros da empresa que o **alvo** escolheu; `members` privado (cada um lê só a própria entrada). A tela de espera agora detecta a aprovação pela própria entrada em `members` e grava o vínculo ela mesma; o Studio público monta a equipe pelos profissionais dos serviços. Cenários de ataque no teste de regras. |
| S4 | Alta | Qualquer conta logada sobrescrevia qualquer `invites/{id}` (podia trocar o papel para master) e `documentsIndex/{doc}`. | Regras: só membros da empresa; convidado só muda status. |
| S5 | Alta | Agendamento era 100% confiado ao navegador (preço, conflito, pagamento antecipado, mensalidade — dava para pular a cobrança gravando direto). | `bookingsApi` valida tudo no servidor, com trava contra dois clientes no mesmo horário. |
| S6 | Média | Funções em produção **sem código no repositório**: `testMercadoPago`, `findUserCompany`, `saveCompanyCard` (endpoints HTTP públicos não auditáveis). | Recomendo removê-las (`firebase functions:delete …`) — precisa de autorização. |
| S7 | Média | Source maps publicados (código-fonte completo visível). | `GENERATE_SOURCEMAP=false` no build. |
| S8 | Média | `/test-sms` (página de teste) em produção, pública. | Só existe em `npm start`. |
| S9 | Média | Verificação de e-mail do cadastro gera o código **no navegador** (`Math.random`) e compara no cliente — burlável. | Não alterado (mexe no fluxo de cadastro). Recomendo `sendEmailVerification` do Firebase Auth. |
| S10 | Média | `findUserCompany` logava dados de membros no Cloud Logging a cada chamada. | Reescrita sem logs de dados pessoais. |
| S11 | Média | Membro de qualquer papel pode gravar qualquer coisa da empresa (ex.: profissional mudar o próprio papel, aprovar pedidos, incluir membros). Pré-existente; o `.write` do nó da empresa vale em cascata e regras mais fundas não conseguem restringir. | Não alterado (exige mapear todas as telas do painel). Recomendado como próxima etapa. |
| S12 | Baixa | Storage não consegue checar “é membro” (regras do Storage não leem o RTDB). | Documentado; próximo passo: *custom claims* por empresa. |
| S13 | Baixa | `markfy-96942.web.app` serve app antigo (março) que ainda conversa com o mesmo banco. | Recomendo desativar o site ou redirecionar para a Vercel. |

**Nunca considere que as regras protegem o backend:** o Admin SDK ignora as regras; toda autorização da `bookingsApi` está no código (`functions-backend/bookings.js`).

### Nova Cloud Function `bookingsApi` (`functions-backend/bookings.js` + `bookings-core.js`)
- Ações: `availability` (só dia/hora/duração, sem dados de cliente), `create`, `mine`, `cancel`.
- `create` confere: plano ativo (`publicAccess`), produto ativo, profissional que atende o serviço, data válida/futura, antecedência mínima, 30 min entre agendamentos do mesmo aparelho/conta, **pagamento antecipado** (recusa se a empresa exige), mensalidade da própria conta e sessões do ciclo, conflito de horário com **trava por profissional/dia**. Preço, duração e nomes vêm do banco. Mesmo formato de registro e de id de antes (o painel não muda).
- Disponibilidade agora vem dos agendamentos ativos (antes vinha de `users/{id}/scheduledTimes`, que **nunca liberava horário cancelado**).
- Freio por IP com buckets de 1 min que se apagam sozinhos.

---

## 3. Custo do Firebase — causas encontradas

Métricas de faturamento **não foram consultadas** (sem acesso ao Billing). As evidências abaixo são tamanhos reais dos nós (medidos em bytes, sem ler conteúdo pessoal) e leitura do código.

| Serviço | Evidência | Causa | Correção | Como medir depois |
|---|---|---|---|---|
| RTDB download | `companys/tkbarbearia` = **1.310.038 bytes**, dos quais `products` = 1.303.793; um único produto (`LGfVU66by7oK`) tem **2 imagens base64 = 1,28 MB** | toda tela que lia a empresa baixava 1,3 MB | `scripts/migrate-product-images.js` (simulação por padrão; sobe para o Storage e só então remove o base64). **Pendente de autorização.** | Console RTDB → Uso → Download; rodar o script sem `--commit` mostra o total |
| RTDB download | Home e Catálogo usavam `onValue(companys/{handle})` (empresa inteira: agenda + pedidos + produtos), refeito a cada troca de aba | listener no nó pai | lê só cabeçalho + `products` (`watchPublicCompany`) | idem |
| RTDB download (Functions) | `mercadoPagoWebhook`, sincronização de assinaturas e `findUserCompany` faziam `db.ref("companys").once("value")` = todas as empresas inteiras **por chamada** | varredura completa | consulta rasa + só o filho necessário (`loadCompaniesChildren`), com fallback | Logs da função + Download do RTDB nos dias de pagamento |
| RTDB | `ProductDetails`, Reservas, Perfil liam a agenda inteira | leitura ampla | `bookingsApi` com consultas indexadas (`.indexOn` novo em `schedules`) | — |
| Functions | `menusRate` cresce sem limpeza (1 chave por minuto por IP) | sem TTL | não alterado (anotado) | tamanho do nó |

Observação honesta: para a Tk Barbearia, a maior economia **depende da migração das imagens**; sem ela, `products` continua com 1,3 MB.

---

## 4. Performance

| Item | Antes | Depois (build medido) |
|---|---|---|
| JS principal (gzip) | **875,9 KB** | **317 KB** (−64%) |
| CSS principal (gzip) | 145,7 KB | 63 KB |
| Source maps públicos | sim | não |

- Painel, criação de empresa, checkout, convites, QR e planos viram *chunks* sob demanda. O CSS global que morava no painel (`body`, `select`) foi para `src/index.css` — **conferi no navegador que fundo, padding e fontes ficaram idênticos** ao build original em `/home` e `/central-user`.
- `@mui/material` + emotion e o SDK do Firestore saíram do bundle (só eram usados pela página de teste / nunca usados).
- 7 `@import` de Google Fonts → 1 requisição com `preconnect` (o peso 650 da Poppins nem existe).
- Busca do Catálogo e do Explorar com `useDeferredValue` (digitação não trava). A busca filtra em memória os produtos de **uma** empresa; a lentidão percebida vinha do download (seção 3).
- Estados novos: carregando/erro/“sem horários” na escolha de horário (antes ficava em branco).

---

## 5. SEO e descoberta

Feito:
- `public/index.html`: título/descrição reais, `lang="pt-BR"`, canonical, Open Graph/Twitter com **imagem 1200×630** (`public/og-markfy.png`, 27 KB), JSON-LD `Organization` + `WebSite` + `SoftwareApplication` (só fatos visíveis; sem preço, avaliação, endereço ou CNPJ). Validei o JSON.
- Resumo em HTML puro dentro do `#root` para quem não executa JavaScript (mesmo conteúdo da landing; oculto antes do primeiro paint quando há JS).
- `favicon.ico` era o **logo do React** → trocado pelo da Markfy; ícones 192/512/180 corretos no manifest.
- `usePageMeta`: título/descrição/canonical por página; `noindex` em login, painel, checkout, convites etc.
- **404 de verdade** (`src/pages/not-found`) em vez de mostrar a landing em qualquer URL.
- `robots.txt` (comentado, com orientação sobre GPTBot/Google-Extended vs. busca), `sitemap.xml` gerado no build a partir de `publicAccess`/`companiesIndex` (hoje: 9 URLs, incluindo `/central-user/markfy`, `/central-user/tkbarbearia`, `/s/tkbarbearia`), `llms.txt` (opcional, não é requisito).
- Zoom liberado no viewport (acessibilidade).

Limitações e alertas:
- **`markfy.app` é de outra empresa** (“privacy-first markdown reviewer”). Telas mostravam “markfy.app/…” como endereço do cliente — corrigido para o domínio real (`src/config/site.js`). O nome “Markfy” disputa busca com esse produto; um domínio próprio ajudaria.
- SPA: o Google executa JS e lê os metadados por rota; prévias de link de **empresas** (WhatsApp/Instagram) continuam mostrando os metadados da página inicial. Solução de menor custo: pré-renderização/edge function só para `/central-user/:handle` e `/s/:handle`.
- Status HTTP 404: na Vercel a SPA responde 200 para qualquer rota; a página 404 tem `noindex` (o Google trata como excluída). HTTP 404 real exige reescritas por rota no `vercel.json` (não fiz para não arriscar rotas válidas).
- Open Graph melhora a **apresentação** do link; não é fator direto de ranking.

### Google Search Console (passo a passo)
1. https://search.google.com/search-console → **Adicionar propriedade** → *Prefixo do URL* → `https://markfy.vercel.app/` (subdomínio da Vercel não permite verificação por DNS).
2. Verificação por **tag HTML**: o Console mostra `<meta name="google-site-verification" …>`; cole no `<head>` de `public/index.html` e publique. Não declarei a verificação como feita.
3. **Sitemaps** → enviar `sitemap.xml`.
4. **Inspeção de URL** → `/`, `/central-user`, `/central-user/<handle>` → “Solicitar indexação”.
5. Acompanhar **Páginas** (indexadas/excluídas) e **Experiência** (Core Web Vitals).

---

## 6. Analytics (GA4) e cookies

- Já existia um consentimento bom (categorias desligadas por padrão, revogação apaga o que foi gravado). Não havia nenhum analytics.
- `src/analytics/analytics.js`: GA4 **só carrega** com `REACT_APP_GA_MEASUREMENT_ID` definido **e** aceite de “Estatísticas”. Revogar para o envio e apaga `_ga*`. Sem Signals/anúncios. `page_view` sem query string e com ids trocados por `:id`; parâmetros por lista branca (nunca nome, e-mail, telefone, termo digitado ou dados de agendamento). Uma propriedade para a rede toda (o domínio é um só), com `markfy_product` = bookings/studio/menus/markfy para segmentar.
- Eventos ligados: `page_view`, `login`, `sign_up`, `company_created`, `booking_completed`.
- Com o ID definido, o inventário do aviso de cookies passa a descrever o GA4 e a versão do consentimento sobe (todos são consultados de novo).
- O `firebase.js` já tem um `measurementId` (propriedade GA4 ligada ao projeto). **Não ativei**: é decisão sua definir o ID na Vercel.

## 7. Cabeçalhos de segurança (`vercel.json`)
`X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy` e **CSP em modo Report-Only** (não bloqueia nada; mostra violações no console). Depois de navegar pelo app sem violações, troque para `Content-Security-Policy`. Cache longo e imutável para `/static/*`. HSTS a Vercel já envia.

## 8. Rodapé, contato, WhatsApp
- Rodapé da landing: colunas Produtos e Contato (e-mail oficial já publicado nos termos), ano automático.
- WhatsApp: **não existe número oficial no projeto** → o botão só aparece com `REACT_APP_WHATSAPP_NUMBER` (DDI+DDD+número). Não inventei número.

## 9. Destaque por plano (Fase 11)
- `publicAccessFor` (motor compartilhado, sincronizado com o backend) agora marca `featured` para planos **pro/premium ativos**. Só master/backend gravam `publicAccess`: a empresa não consegue se promover.
- `src/utils/companyEligibility.js`: elegível = Bookings ativo e não vencido (plano superior não salva empresa vencida/suspensa); ordem = destaque → perfil mais completo → nome. Ninguém é escondido; o selo “Destaque” aparece com explicação. Dentro da página de uma empresa, nada de concorrentes.
- Entradas atuais de `publicAccess` ainda não têm `featured` (aparece quando a licença for regravada pela Master Dev ou por pagamento).
- **Decisão comercial pendente**: confirmar que destaque faz parte dos benefícios Pro/Premium antes de divulgar.

---

## 10. Testes

| Teste | Resultado |
|---|---|
| Jest (frontend) | **7/7 suítes, 72 testes passando**. Antes: 1 suíte falhando (teste padrão do CRA) — substituída por testes reais (404, Analytics). |
| Novos: `companiesIndex.test.js` | índice completo, entrada só com logoUrl (caso real), elegível fora do índice, handle inexistente, índice vazio (não master / master), erro de rede, índice sem dados pessoais |
| Novos: `companyEligibility.test.js` | empresa ativa/vencida/suspensa/sem registro, destaque sem esconder, `featured` forjado ignorado, `publicAccessFor` |
| `node --test` (backend, `bookings-core`) | **14/14**: datas, preço, conflito, ocupados sem dados pessoais, dono, cancelamento/antecedência, 30 min, sessões do ciclo |
| Regras RTDB (sintaxe) | **válidas no servidor** (`firebase deploy --only database --dry-run`) |
| Regras Storage (sintaxe) | **válidas** (validador do Firebase) |
| Regras RTDB (lógica) | `scripts/test-db-rules.js` com 58 cenários (inclui o ataque do S3b) **pronto, NÃO executado**: o emulador exige Java 21 e a máquina tem Java 8. Rodar: `npm run test:rules` |
| Build de produção | OK |
| Navegador (build servido localmente, banco de produção, só leitura) | landing, `/home`, `/central-user`, Explorar, `/central-user/tkbarbearia`, `/privacidade`, 404: metadados certos, visual idêntico ao original, sem erros de console |

Não testado: fluxos logados (painel, criação de empresa, convite, pagamento) e agendamento ponta a ponta — exigem a `bookingsApi` publicada e contas de teste.

---

## 11. Ordem de publicação (IMPORTANTE)

As peças dependem umas das outras. Publicar fora de ordem quebra o site.

1. **Functions** — `bookingsApi` e as leituras parciais: `firebase deploy --only functions` (o CLI vai perguntar sobre apagar `testMercadoPago`, `findUserCompany`, `saveCompanyCard`, que não existem no código).
2. **Frontend** — merge na `main` → Vercel. *Funciona com as regras atuais.*
3. **Regras do RTDB** — `firebase deploy --only database`. **Nunca antes do passo 2**: o frontend antigo lê `companys/{handle}` inteiro e as páginas públicas parariam.
4. **Regras do Storage** — `firebase deploy --only storage`.
5. Dados (opcionais, com backup antes): `node scripts/backfill-companies-index.js` (simulação) → `--commit`; `node scripts/migrate-product-images.js` (simulação) → `--commit`.

Recuperação: as regras publicadas hoje estão salvas no git (`main`); `firebase deploy --only database` a partir da `main` restaura.

---

## 12. Não feito nesta rodada (e por quê)

- **Fase 10 – novo assistente de criação de empresa**: `CreateCompany.jsx` tem 2.519 linhas. Corrigi o que impedia criar empresa (gravação atômica, checagem do @). O redesenho (etapas, categorias centralizadas, rascunho) merece uma tarefa própria, com testes do fluxo logado.
- **Fase 12 – templates** e **Fase 13 – revisão de Studio e Menus**: não iniciadas.
- Otimização de imagens não referenciadas (`public/markfy/landing/clients/client-01.jpg` 3,5 MB, `hero-user.webp` 921 KB, mockups de 2 MB em `src/img`): **não são carregadas pelo app**; não apaguei sem confirmar que não há links externos.
- Ícones via API do Iconify (centenas de requisições em runtime): recomendo empacotar offline.
- Exclusão de conta pelo titular (LGPD, Art. 18): não existe no app; hoje só por e-mail.
- Política de Privacidade e Termos têm campos entre colchetes (razão social, CNPJ, endereço) e aviso de “pendente de revisão jurídica”. Isto **não é parecer jurídico**.

## 13. O que preciso de você

| Pendência | Tipo |
|---|---|
| Autorizar e executar a publicação (seção 11) | aprovação |
| Autorizar o backfill do índice e a migração das imagens base64 | aprovação (escrita em produção) |
| Autorizar remoção dos hashes de senha legados e das 3 funções órfãs | aprovação (exclusão) |
| Instalar Java 21 (ex.: Temurin) para rodar `npm run test:rules` | permissão de instalação |
| `REACT_APP_GA_MEASUREMENT_ID`, `REACT_APP_WHATSAPP_NUMBER`, domínio próprio (`REACT_APP_SITE_URL`) | configuração |
| Desativar/redirecionar `markfy-96942.web.app` | decisão |
| Confirmar destaque como benefício Pro/Premium | decisão comercial |
