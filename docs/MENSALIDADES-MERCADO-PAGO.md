# Mensalidades no Bookings — cobrança recorrente pelo Mercado Pago

Branch: `fix/auditoria-empresas-seguranca` · 24/10/2026 · nada publicado, nada commitado.

---

## 1. Decisão: Mercado Pago (InfinitePay fica de fora)

| | Mercado Pago | InfinitePay |
|---|---|---|
| API pública de assinatura | Sim (`/preapproval`): guarda a autorização e cobra sozinho a cada ciclo | Recorrência existe só **dentro do app** deles (planos + link de inscrição); não há API pública documentada para criar e acompanhar assinaturas por código |
| Já integrado no Markfy | Sim: cada empresa conecta a própria conta (OAuth); o dinheiro cai direto nela | Não |
| Cartão de crédito | Sim, digitado no Markfy (Card Payment Brick) | — |
| Conta do cliente | Sim: o cliente entra na conta Mercado Pago e paga com saldo ou cartão salvo | — |
| Tentativas automáticas quando a cobrança falha | Sim | — |

Usar as duas exigiria cada profissional ter conta nas duas e manter dois fluxos de cobrança, sem ganho para o cliente. Se a InfinitePay publicar uma API de recorrência, dá para somar como segunda opção no passo 3 do checkout.

---

## 2. Como funciona

```
Profissional                       Cliente                              Mercado Pago
────────────                       ───────                              ────────────
conecta a conta (OAuth) ─────────────────────────────────────────────▶ conta da empresa
cadastra produto "Plano de
mensalidade" (ciclo, sessões,
teste, fidelidade, aviso)
                                   escolhe horário e profissional
                                   1. Plano: confere o que contrata
                                   2. Autorização: aceita a cobrança
                                      recorrente + aviso LGPD
                                   3. Pagamento:
                                      a) cartão de crédito ──────────▶ preapproval "authorized"
                                      b) conta Mercado Pago ─────────▶ preapproval "pending"
                                         (vai ao site do MP, autoriza,      → pessoa autoriza lá
                                          volta em /assinatura/retorno)
                                   4. Pronto: assinatura ativa e o
                                      1º atendimento reservado
                                                                        cobra a cada ciclo,
                                                                        tenta de novo se recusar
mercadoPagoWebhook ◀──────────────────────────────────────────────────  avisa mudanças
subscriptionsDailySync (06:00) ── confere tudo de novo, executa cancelamentos agendados,
                                  apaga tentativas abandonadas (48 h)
```

- **Quem decide preço e regras é o backend**, lendo o produto. O navegador manda só as escolhas e o aceite.
- **O número do cartão nunca passa pelo Markfy**: o Brick do Mercado Pago gera um token de uso único.
- O espelho local fica em `companys/{handle}/subscriptions/{uid}_{productId}`; só o backend grava.
- O agendamento com a mensalidade continua sendo a `bookingsApi` de sempre, que confere se a assinatura está em dia, as sessões do ciclo e (se cancelada) se a data cabe no período pago.

---

## 3. Passo a passo — profissional

1. **Perfil → Formas de Pagamento → Cartões**: ative cartões e toque em **Conta Mercado Pago** para conectar.
2. Na mesma tela, toque em **Verificar assinaturas**. Se o Mercado Pago ainda não liberou, a tela explica o que fazer (validação de identidade / pedir a liberação ao suporte do MP).
3. **Produtos → Novo → Plano de mensalidade**: ciclo, sessões por ciclo (ou ilimitado), renovação automática, teste grátis, permanência mínima e aviso de cancelamento. A etapa mostra um checklist "Para o cliente conseguir assinar", com o estado da conexão do Mercado Pago.
4. **Pedidos → Assinaturas**: quem assina, quanto entra por ciclo, sessões usadas, próxima cobrança, estado (ativa, pagamento pendente, cancelada com acesso até X) e aviso quando um estorno de arrependimento precisa ser feito à mão.

## 4. Passo a passo — cliente

1. Na página do produto mensal: profissional, dia e horário do 1º atendimento. Sem conta, o app pede login e **volta para o mesmo produto** depois.
2. **Plano** — valor, ciclo, o que está incluso, primeiro atendimento e uma linha do tempo de quando cobra.
3. **Autorização** — o que exatamente está sendo autorizado (valor, frequência, 1ª cobrança, quem recebe, cancelamento, arrependimento), o aviso de dados (LGPD) e duas caixas obrigatórias.
4. **Pagamento** — *Cartão de crédito* (formulário do Mercado Pago, só crédito, à vista) ou *Conta Mercado Pago* (o e-mail precisa ser o da conta MP; vai para o site deles e volta sozinho).
5. **Pronto** — estado ao vivo: ativa, horário reservado (ou aviso para escolher outro se ele foi ocupado no meio-tempo), próxima cobrança, como cancelar.
6. **Reservas → Mensalidades** — sessões do ciclo, próxima cobrança, últimas cobranças (paga/recusada/agendada), **Marcar próximo atendimento**, **Cancelar assinatura**.

## 5. Cancelamento

| Situação | O que acontece |
|---|---|
| Comum | Mercado Pago para de cobrar na hora; os atendimentos valem até o fim do período já pago (`accessUntil`); horários marcados depois disso são desmarcados |
| Aviso prévio que passa da próxima cobrança | Cancelamento **agendado**: a próxima cobrança ainda acontece e a sincronização diária cancela na data |
| Permanência mínima | O cliente não cancela antes do prazo (a empresa pode). Conferido também no backend |
| Arrependimento (7 dias, CDC art. 49) | Cancela na hora, **estorna automaticamente** as cobranças desses dias e desmarca os horários. Se o estorno falhar, a empresa vê o aviso em Pedidos → Assinaturas |
| Cancelada no app do Mercado Pago ou por falta de pagamento | O webhook/sincronização percebe; quem estava em dia mantém o período pago |

---

## 6. LGPD e consumidor — o que foi feito

- **Aceite registrado** (art. 8º, §2º — o ônus da prova é do controlador): `consent = { version, acceptedAt, method, terms: {preço, ciclo, teste, fidelidade, aviso, 7 dias} }`, gravado pelo backend com os termos lidos do banco. Mudou o texto do checkout → mude `CONSENT_VERSION` em `functions-backend/subscriptions-core.js` **e** `src/utils/subscriptionRuntime.js` (um teste confere que são iguais).
- **Minimização** (art. 6º, III): nada de número/validade/CVV do cartão, nada de IP ou aparelho. Cobranças guardam só valor, data, situação e o id do pagamento. Respostas da API não devolvem e-mail.
- **Eliminação** (art. 16): tentativa pela conta MP não concluída em 48 h é cancelada lá e **apagada** aqui.
- **Histórico**: assinar de novo depois de cancelar arquiva a anterior em `companys/{handle}/subscriptionHistory` (prova do contrato e registro fiscal).
- **Acesso do titular** (art. 18): o cliente lê a própria assinatura inteira (aceite e cobranças); cancelamento sem intermediários.
- **Logs**: removidos logs que gravavam a resposta completa do Mercado Pago e pedidos com nome/telefone.
- **Segurança**: o token do Mercado Pago da empresa (`mercadoPagoConnections`) era legível por **qualquer membro**, inclusive profissional — agora só o backend. O cliente não grava mais direto na assinatura (antes dava para agendar o próprio cancelamento e pular a fidelidade).
- **Textos**: Política de Privacidade (dados, finalidades, base legal, retenção, compartilhamento) e Termos (cancelamento, arrependimento, falha na cobrança) atualizados. O texto antigo "valores cobrados não são estornados" contrariava o art. 49 do CDC.

Isto **não é parecer jurídico**; vale a revisão já pendente da Política e dos Termos.

---

## 7. O que estava quebrado

1. Mensalidade só funcionava se a empresa ligasse "pagamento antecipado": sem isso o botão tentava agendar e o backend recusava ("Assine o plano mensal") — **ninguém conseguia assinar**.
2. Depois de assinar com sucesso, a tela mostrava **"Pagamento em análise"** (o estado `authorized` não era tratado).
3. **"Cancelar assinatura" não abria nada**: o modal só existia na tela de carregando.
4. Cancelar **cortava o acesso na hora**, apesar do texto prometer acesso até o fim do ciclo.
5. Fidelidade só era conferida na tela; dava para gravar o cancelamento direto no banco.
6. O webhook marcava **"pagamento pendente"** quando o Mercado Pago só agendava a próxima cobrança (`scheduled`).
7. Não havia como pagar pela **conta Mercado Pago**.
8. Para achar de quem era uma cobrança, o webhook chamava a API do Mercado Pago **de todas as empresas**.
9. Sem webhook configurado, nada se atualizava (agora há sincronização diária e ao abrir as telas).
10. "Renovação automática" desligada era ignorada: cobrava para sempre.
11. Sem registro do aceite; texto de "sem estorno" contra o CDC.
12. Checkout: preços a partir de R$ 1.000 viravam R$ 0 (conversão do texto).
13. "Entre para assinar" mandava para o login e perdia o produto.

---

## 8. Configuração no Mercado Pago (uma vez, na aplicação da Markfy)

[Suas integrações](https://www.mercadopago.com.br/developers/panel/app) → aplicação da Markfy → **Webhooks**:

- URL (produção): `https://us-central1-markfy-96942.cloudfunctions.net/mercadoPagoWebhook`
- Eventos: **Pagamentos** e **Planos e assinaturas** (`subscription_preapproval`, `subscription_authorized_payment`).

Sem isso tudo funciona, só que as telas descobrem as mudanças ao serem abertas ou na sincronização das 06:00.

Cada empresa precisa ter **Assinaturas liberadas** na própria conta Mercado Pago (botão "Verificar assinaturas").

## 9. Publicação (nesta ordem)

1. `firebase deploy --only functions` — cria `subscriptionsApi` e `subscriptionsDailySync` (usa Cloud Scheduler; o projeto já é Blaze). O CLI vai perguntar se apaga `createMercadoPagoSubscription` e `cancelMercadoPagoSubscription`: **sim**, foram substituídas.
2. Frontend (merge → Vercel).
3. `firebase deploy --only database` — regras (seguir também a ordem da auditoria de 21/10).

## 10. Como testar com dinheiro de mentira

1. No painel do Mercado Pago, **Contas de teste**: crie um *vendedor* e um *comprador*.
2. Numa empresa de teste, conecte o **vendedor de teste** (OAuth) e toque em "Verificar assinaturas" (deve dizer "modo teste").
3. Assine com o **e-mail do comprador de teste** e um [cartão de teste](https://www.mercadopago.com.br/developers/pt/docs/checkout-bricks/additional-content/your-integrations/test/cards) do Mercado Pago (titular `APRO` aprova, `OTHE` recusa). Pela conta MP: entre com o comprador de teste.
4. Não use a mesma conta como recebedora e pagadora — o Mercado Pago recusa (a tela explica).

## 11. Testes automatizados

| Onde | O quê |
|---|---|
| `functions-backend/__tests__/subscriptions-core.test.js` | regras puras: plano, corpo da preapproval, aceite, cobranças, cancelamento, arrependimento |
| `functions-backend/__tests__/subscriptions-flow.test.js` | fluxo completo com banco em memória e Mercado Pago falso: cartão, conta MP, webhook, horário ocupado, cancelamento, fidelidade, estorno, sincronização diária, histórico |
| `src/components/subscription-checkout/__tests__` | checkout em 4 etapas (cartão, conta MP, link suspeito, erro da conta da empresa) |
| `src/utils/__tests__/subscriptionRuntime.test.js` | regras da tela = regras do backend |

`cd functions-backend && npm test` · `npm test`

## 12. Arquivos

- Backend: `functions-backend/subscriptions.js`, `subscriptions-core.js`; ajustes em `index.js` (webhook), `bookings.js`, `bookings-core.js`.
- Frontend: `src/components/subscription-checkout/*`, `src/pages/users/subscription-return/*`, `src/firebase/subscriptionsApi.js`, `src/utils/subscriptionRuntime.js`, `Checkout.jsx`, `ProductDetails.jsx`, `reservartions.jsx`, painel (`orders.jsx`, `dashboard.jsx`, `ProductCreationModal.jsx`, `CardConfigScreen.jsx`), Política e Termos.
- Regras: `database.rules.proposta.json` → `database.rules.json`; cenários novos em `scripts/test-db-rules.js`.
