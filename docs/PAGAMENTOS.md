# Pagamentos no Bookings — pagamento antecipado e mensalidade

Branch: `fix/auditoria-empresas-seguranca` · 31/10/2026 · **nada publicado, nada commitado**.
Substitui as partes de configuração e teste de `MENSALIDADES-MERCADO-PAGO.md` (que segue valendo para LGPD, cancelamento e arrependimento).

---

## 1. Por que a mensalidade nunca funcionou

**Evidência (produção, só leitura, sem dado pessoal):**

| O que | Resultado |
|---|---|
| Logs da `createMercadoPagoSubscription` (versão antiga, 15/10) | 4 tentativas, todas `400 CC_VAL_433 Credit card validation has failed` |
| Logs da `subscriptionsApi` (versão nova, 25/10) | 1 tentativa, mesmo erro `CC_VAL_433` |
| `mercadoPagoConnections/*` | as 3 empresas conectadas (`markfy`, `tkbarbearia`, `neomarket`) são **contas reais**: `liveMode: true`, chave `APP_USR-` |
| Escopo do token | inclui `subs-recurring:pre-approval/read-write`: a conta **pode** criar assinaturas |
| `companys/*/subscriptions` e `subscriptionsIndex` | vazios: nenhuma assinatura chegou a existir |
| `companys/markfy/paymentOrders` | pagamento antecipado funciona: 3 aprovados (2 cartões, 1 Pix) com agendamento criado pelo webhook |

**Causa:** ao criar uma assinatura com cartão (`status: authorized`), o Mercado Pago faz uma **cobrança de valor mínimo** no cartão para validá-lo e devolve em seguida (documentado em *Assinaturas sem plano associado → pagamento autorizado*). `CC_VAL_433` é essa cobrança recusada. A requisição estava certa até ali: credencial, escopo e corpo aceitos. A validação falha quando:

1. o cartão é **de teste** e a conta que recebe é **real** (cartões de teste só funcionam entre usuários de teste);
2. quem paga é **o próprio dono** da conta que recebe (o Mercado Pago não deixa uma conta pagar a si mesma; o antifraude marca — os dois `cc_rejected_high_risk` de 20/09 em `paymentOrders` são esse caso);
3. o cartão é de débito/pré-pago, ou o antifraude recusa.

As três contas conectadas são reais, e o roteiro de teste da documentação anterior mandava usar cartões de teste. Não há limitação da API do Mercado Pago: com cartão real de outra pessoa, ou com vendedor e comprador **de teste**, a validação passa.

**O que impediu de descobrir isso em dois meses:**

- O botão "Verificar assinaturas" criava uma assinatura `pending` de R$ 10 (que **não valida cartão**) e respondia "pronta" — falso positivo — deixando assinaturas canceladas "Verificação Markfy" na conta do vendedor.
- O "modo teste" era deduzido do prefixo `TEST-` da chave; contas de teste conectadas por OAuth usam `APP_USR-` como as reais. A tela nunca dizia a verdade sobre o ambiente.
- A mensagem do erro não dizia a causa provável; a empresa não via recusa nenhuma.

**Defeitos que apareceriam logo depois de resolver o ambiente (corrigidos):**

| Defeito | Efeito |
|---|---|
| Teste grátis enviado como `free_trial` numa assinatura **sem plano** (só planos aceitam — tipo `PreApprovalRequest` do SDK oficial) | o teste era ignorado e o cliente **cobrado na hora** |
| Renovação do token registrava a resposta inteira do Mercado Pago no Cloud Logging | **access e refresh token em log** |
| Conectar usava "a primeira empresa do usuário" | quem é de duas empresas conectava a conta na **empresa errada** |
| Permissão aceitava `administrador`; o app grava `administrator` | administradores convidados **não conseguiam conectar** |
| Webhook sem verificação de assinatura e sempre `200`, mesmo com erro | aviso falso aceito; aviso real perdido sem reenvio |
| Pagamento antecipado cobrava `product.value` | **promoção e extras ignorados** (tela mostrava R$ 80, cobrava R$ 100) |
| Interruptor "Pagamento antecipado" do produto | gravado e **nunca lido** |
| Agendamento do pagamento antecipado criado só no webhook, sem trava de horário | cartão aprovado sem webhook = sem horário; dois pagamentos no mesmo horário |
| Pedido de pagamento legível por qualquer pessoa com o id | nome, recado e horário do cliente expostos |
| Lista de assinaturas do painel | assinatura pausada **sumia** (ninguém reativava) |

---

## 2. Como ficou

```
Navegador                         Backend (Cloud Functions)                 Mercado Pago
─────────                         ─────────────────────────                 ────────────
Configurações → Pagamentos ──▶ paymentsApi.connect (papel conferido) ──▶ /authorization (OAuth)
                               mercadoPagoOAuthCallback ◀─────────────── code + state
                               troca o code (client_secret só aqui), /users/me
                               tokens → mercadoPagoConnections/{handle} (fechado)
                               resumo → companys/{h}/paymentSettings/mercadoPago (sem token)

Produto: modalidade ──────────▶ type + settings.prepayment (bookingsApi aplica)

Cliente paga (antecipado) ────▶ createMercadoPagoPayment: valor no servidor,
                               horário conferido antes de cobrar ─────▶ POST /v1/payments
                               aprovado na hora → agenda (trava de horário)
                               Pix: tela pergunta a cada 10 s (orderStatus)

Cliente assina (mensalidade) ─▶ subscriptionsApi.create ──────────────▶ POST /preapproval
                               teste grátis = start_date                 valida cartão, cobra ~1 h
mercadoPagoWebhook ◀────────── x-signature (HMAC) ◀───────────────────── avisos
                               relê o recurso com o token da empresa e aplica de forma idempotente
subscriptionsDailySync 06:00 ── sincroniza assinaturas, confere pagamentos em aberto,
                               renova tokens que vencem em 30 dias, limpa OAuth abandonado
```

**Camada de provedor** (`functions-backend/payments/`):

| Arquivo | Papel |
|---|---|
| `providers.js` | contrato dos gateways e registro (só Mercado Pago) |
| `mercadopago.js` | tudo que é do Mercado Pago: endpoints, OAuth, `/users/me`, assinatura, cobrança, pagamento, webhook (validador oficial do SDK) → objetos normalizados |
| `connections.js` | tokens por empresa, renovação (7 dias antes; refresh novo é guardado), revogação → "reconectar", "Testar conexão" só leitura |
| `advance-payments.js` | pagamento antecipado: criar, confirmar (idempotente), aviso, tela de espera, conferência diária |
| `payments-api.js` | `paymentsApi` (connect, verify, disconnect, orderStatus) e as duas pontas do OAuth |

**Estados:**

| Pedido (`paymentOrders`) | Assinatura (`status`) | Pagamento da assinatura (`paymentStatus`) |
|---|---|---|
| `pending`, `in_process`, `approved`, `paid` (aprovado **e** agendado), `needs_attention` (aprovado sem horário, ou valor não confere), `rejected`, `cancelled`, `refunded`, `charged_back`, `error` | `pending`, `authorized`, `past_due`, `paused`, `cancelled` | `awaiting_authorization`, `trial`, `processing`, `paid`, `failed` |

"Autorizada" não é "paga": `paid` só com cobrança aprovada lida do gateway. Ser redirecionado para a página de sucesso não muda nada.

---

## 3. Configuração (uma vez)

**Mercado Pago → Suas integrações → aplicação da Markfy:**

1. **URLs de redirecionamento:** `https://us-central1-markfy-96942.cloudfunctions.net/mercadoPagoOAuthCallback` (já deve estar; precisa ser idêntica).
2. **Webhooks → Configurar notificações:** URL `https://us-central1-markfy-96942.cloudfunctions.net/mercadoPagoWebhook`; eventos **Pagamentos**, **Planos e assinaturas** (`subscription_preapproval`, `subscription_authorized_payment`) e, se quiser, **Vinculação de aplicações** (`mp-connect`). Salve e **revele a assinatura secreta**.

**Secrets do Firebase** (nunca no código nem no `.env` do frontend):

| Secret | O quê | Status |
|---|---|---|
| `MERCADOPAGO_CLIENT_ID` | Client ID da aplicação | já existe |
| `MERCADOPAGO_CLIENT_SECRET` | Client Secret da aplicação | já existe |
| `MERCADOPAGO_MARKFY_ACCESS_TOKEN` | conta da Markfy (planos e `saveMercadoPagoCard`) | já existe |
| `MERCADOPAGO_WEBHOOK_SECRET` | assinatura secreta dos webhooks | **novo** |

```bash
firebase functions:secrets:set MERCADOPAGO_WEBHOOK_SECRET --project markfy-96942
```

Frontend: nada novo. `REACT_APP_MERCADOPAGO_PUBLIC_KEY` não é usado no checkout (a chave pública vem da empresa conectada).

**Publicação (nesta ordem):**

1. `firebase functions:secrets:set MERCADOPAGO_WEBHOOK_SECRET` (sem ele o deploy das functions para).
2. `firebase deploy --only functions` — cria `paymentsApi`; as rotas antigas continuam respondendo no formato antigo, então o frontend publicado não quebra.
3. Frontend (merge → Vercel).
4. `firebase deploy --only database` — regras novas. **Nunca antes do passo 3.**

---

## 4. Uso

**Conectar:** Perfil → Configurações → **Pagamentos** → **Conectar Mercado Pago** → autorizar no Mercado Pago → volta sozinho com "Mercado Pago conectado". **Testar conexão** mostra a conta, se é de teste ou real e se assinaturas estão liberadas. Só administrador (`master`/`administrator`) conecta, testa ou desconecta.

**Produto com pagamento antecipado:** Produtos → Novo → **Pagamento antecipado** → nome, descrição, valor. O cliente paga com Pix ou cartão antes do horário; o horário só é reservado com o pagamento aprovado.

**Produto mensal:** Produtos → Novo → **Mensalidade** → primeira cobrança (na assinatura ou depois de X dias grátis) e atendimentos por mês; "Mais opções" tem renovação, fidelidade, aviso e ciclo. Depois nome, descrição e valor mensal.

**Acompanhar:** Pedidos → **Assinaturas**: situação da cobrança, últimas cobranças, próxima cobrança, **Pausar / Reativar / Cancelar**.

---

## 5. Como testar com dinheiro de mentira

1. Mercado Pago → Suas integrações → **Contas de teste**: crie um **vendedor** e um **comprador**.
2. Numa empresa de teste da Markfy, em janela anônima, **Conectar** e entrar com o **vendedor de teste**. **Testar conexão** deve dizer "Conta de TESTE".
3. Assinar/pagar logado como um cliente qualquer da Markfy, com o **e-mail do comprador de teste** e um cartão de teste (titular `APRO` aprova, `OTHE` recusa, `CONT` fica pendente).
4. A 1ª cobrança da mensalidade cai em até ~1 hora; Pedidos → Assinaturas deve sair de "1ª cobrança em processamento" para "Em dia".
5. Com conta **real**: cartão real de **outra pessoa**, valor baixo. Para devolver, o cliente cancela em Reservas → Mensalidades dentro de 7 dias (arrependimento): o estorno é automático. Cancelar pelo painel da empresa para a cobrança, mas não estorna.

---

## 6. Testes automatizados

| Onde | O quê |
|---|---|
| `functions-backend/__tests__/payments-flow.test.js` (21) | antecipado: valor com promoção + extras no servidor, aprovado na hora agenda, aviso repetido não duplica, Pix aprovado depois, valor adulterado, horário tomado, estorno, recusa da conta, Mercado Pago fora do ar, isolamento; produto com antecipado; webhook HMAC; teste grátis via `start_date`; pausar/reativar; OAuth (papéis, state de uso único, recusa, expirado); renovação/revogação de token; "Testar conexão" só leitura; desconectar |
| `functions-backend/__tests__/subscriptions-*.test.js` (48) | regras e fluxo completo da mensalidade (já existiam, adaptados) |
| `src/pages/adm/perfilAdm/screens/settings/payment/__tests__` (8) | tela de Pagamentos |
| `src/utils/__tests__/subscriptionRuntime.test.js` | tela calcula a situação do pagamento igual ao backend |
| `scripts/test-db-rules.js` (71 cenários) | regras do banco — **exige Java 21** (`npm run test:rules`) |

`cd functions-backend && npm test` · `npm test`

**Só um ambiente real do Mercado Pago confirma:** assinatura autorizada com cartão de teste (vendedor/comprador de teste), cobrança recorrente de verdade, webhook assinado chegando (inclusive para recursos de vendedores conectados por OAuth), `mp-connect`, `start_date` adiando a 1ª cobrança, pausa/reativação refletindo no gateway.

---

## 7. Asaas (segunda opção) — investigado, não implementado

A API de assinaturas do Asaas atende a mensalidade (`POST /v3/subscriptions` com cartão, cobranças a cada ciclo, webhook com token em `asaas-access-token`, sandbox com confirmação simulada). Mas **o Asaas não tem OAuth**. Para o dinheiro cair na conta de cada empresa:

- ou a empresa entrega a **própria chave de API** (credencial privada — vetado neste projeto);
- ou a Markfy vira **conta-pai (CNPJ)** e cria **subcontas** por API, com período de avaliação regulatória (até 10 subcontas, R$ 2.000 por subconta, até 60 dias) e o modelo BaaS habilitado pelo gerente de conta.

Como não há limitação comprovada do Mercado Pago, o Asaas ficou de fora. Para somar depois: um `payments/asaas.js` com o mesmo contrato de `providers.js`, registro em `PROVIDERS`, a escolha do gateway por empresa e o fluxo de subcontas.
