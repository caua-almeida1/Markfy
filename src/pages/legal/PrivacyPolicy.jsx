import React from "react";

import LegalPage from "./LegalPage";
import { useConsent } from "../../contexts/consentContext/ConsentContext";

import { CONSENT_CATEGORIES } from "../../utils/consent";


/* =========================================================
   POLÍTICA DE PRIVACIDADE — LGPD (Lei 13.709/2018)

   O conteúdo descreve o que a aplicação REALMENTE faz:
   Firebase Authentication, Realtime Database, Storage,
   Mercado Pago, ViaCEP/Nominatim e as preferências de
   interface. Nada de ferramenta que o projeto não usa.

   Os campos entre colchetes precisam ser preenchidos com
   os dados registrais antes de publicar — estão marcados
   em PENDENCIAS abaixo e no aviso do topo da página.
========================================================= */


const UPDATED_AT = "22 de setembro de 2026";

const CONTACT_EMAIL = "markfy.suporte@gmail.com";

/* Trocar pelos dados registrais reais antes de publicar. */
const CONTROLLER_NAME = "[Razão social da Markfy]";
const CONTROLLER_DOC = "[CNPJ]";
const CONTROLLER_ADDRESS = "[Endereço completo]";
const DPO_NAME = "[Nome do encarregado]";


const buildCookieRows = () =>
    CONSENT_CATEGORIES.flatMap((category) =>
        category.items.map((item) => [
            item.name,
            category.label,
            item.purpose,
            item.retention
        ])
    );


const PrivacyPolicy = () => {

    const { openPreferences } = useConsent();


    const sections = [

        {
            id: "controlador",
            title: "Quem é o controlador dos seus dados",
            blocks: [
                {
                    text:
                        "A Markfy é uma plataforma de agendamento online. " +
                        "Esta política explica quais dados pessoais tratamos, " +
                        "por que tratamos e quais são os seus direitos, nos " +
                        "termos da Lei Geral de Proteção de Dados (Lei " +
                        "13.709/2018)."
                },
                {
                    type: "list",
                    items: [
                        { term: "Controlador", text: `${CONTROLLER_NAME}, inscrita no CNPJ ${CONTROLLER_DOC}` },
                        { term: "Endereço", text: CONTROLLER_ADDRESS },
                        { term: "Encarregado (DPO)", text: `${DPO_NAME} — ${CONTACT_EMAIL}` },
                        { term: "Contato para privacidade", text: CONTACT_EMAIL }
                    ]
                },
                {
                    type: "callout",
                    icon: "solar:users-group-rounded-outline",
                    title: "Dois tipos de usuário, papéis diferentes",
                    text:
                        "Quando uma empresa usa a Markfy para atender seus " +
                        "clientes, a empresa é a controladora dos dados dos " +
                        "agendamentos dela, e a Markfy atua como operadora " +
                        "(Art. 5º, VII). Para os dados da própria conta da " +
                        "empresa e da plataforma, a Markfy é a controladora."
                }
            ]
        },

        {
            id: "dados",
            title: "Quais dados coletamos",
            blocks: [
                {
                    text:
                        "Coletamos apenas o necessário para a plataforma " +
                        "funcionar. Não pedimos dados sensíveis (Art. 5º, II) " +
                        "e não tratamos dados de crianças e adolescentes de " +
                        "forma intencional."
                },
                {
                    type: "list",
                    items: [
                        { term: "Conta da empresa", text: "nome, e-mail, senha (armazenada apenas pelo Firebase Authentication, nunca por nós em texto), telefone e foto de perfil." },
                        { term: "Dados da empresa", text: "nome fantasia, descrição, logo, categorias, endereço comercial, horários, formas de pagamento e CPF/CNPJ do responsável." },
                        { term: "Equipe", text: "nome, e-mail e função dos administradores convidados." },
                        { term: "Cliente que agenda", text: "nome, telefone e, quando houver login, e-mail. Um identificador anônimo é gerado no seu dispositivo para você reencontrar suas reservas sem criar conta." },
                        { term: "Agendamentos", text: "serviço escolhido, profissional, data, horário, valor e status." },
                        { term: "Pagamentos", text: "status, valor e identificadores da transação. Os dados do cartão são digitados direto no ambiente do Mercado Pago e nunca passam pelos nossos servidores." },
                        { term: "Mensalidades (cobrança recorrente)", text: "nome, e-mail do pagador, forma de pagamento escolhida (cartão ou conta Mercado Pago), histórico das cobranças (valor, data e situação) e o registro do seu aceite: data, versão do texto e condições do plano que você autorizou. Não guardamos número, validade nem código do cartão, nem seu endereço IP." },
                        { term: "Localização aproximada", text: "somente se você ativar a busca por empresas próximas, e apenas durante a consulta. Não guardamos sua localização." }
                    ]
                }
            ]
        },

        {
            id: "finalidades",
            title: "Por que tratamos e com qual base legal",
            blocks: [
                {
                    text:
                        "Todo tratamento tem uma finalidade específica e uma " +
                        "base legal do Art. 7º da LGPD:"
                },
                {
                    type: "table",
                    headers: ["Finalidade", "Base legal"],
                    rows: [
                        ["Criar e manter sua conta, autenticar o acesso", "Execução de contrato (Art. 7º, V)"],
                        ["Registrar, confirmar e exibir agendamentos", "Execução de contrato (Art. 7º, V)"],
                        ["Processar pagamentos pelo Mercado Pago", "Execução de contrato (Art. 7º, V)"],
                        ["Cobrar a mensalidade a cada ciclo e liberar os atendimentos do plano", "Execução de contrato (Art. 7º, V)"],
                        ["Guardar a prova de que você autorizou a cobrança recorrente", "Exercício regular de direitos (Art. 7º, VI) e Art. 8º, §2º"],
                        ["Verificar telefone por SMS e prevenir fraude", "Legítimo interesse e prevenção à fraude (Art. 7º, IX e X)"],
                        ["Emitir notas, guardar registros fiscais e contábeis", "Cumprimento de obrigação legal (Art. 7º, II)"],
                        ["Responder a suporte e resolver disputas", "Legítimo interesse (Art. 7º, IX)"],
                        ["Lembrar preferências de interface (tema)", "Consentimento (Art. 7º, I)"],
                        ["Estatísticas e marketing, caso venham a existir", "Consentimento (Art. 7º, I)"]
                    ]
                },
                {
                    type: "callout",
                    icon: "solar:shield-check-outline",
                    title: "Nada de decisão automatizada",
                    text:
                        "Não usamos seus dados para criar perfis nem para " +
                        "tomar decisões automatizadas que afetem seus " +
                        "interesses (Art. 20)."
                }
            ]
        },

        {
            id: "compartilhamento",
            title: "Com quem compartilhamos",
            blocks: [
                {
                    text:
                        "Não vendemos seus dados. Compartilhamos apenas com " +
                        "os operadores necessários para o serviço funcionar, " +
                        "e só o que cada um precisa:"
                },
                {
                    type: "table",
                    headers: ["Serviço", "Para quê", "Dados envolvidos"],
                    rows: [
                        ["Google Firebase", "Autenticação, banco de dados, armazenamento de imagens e envio de SMS", "Conta, empresa, agendamentos e imagens"],
                        ["Mercado Pago", "Processamento de pagamentos e das cobranças recorrentes das mensalidades", "Valor, identificação do pedido, e-mail do pagador (nas mensalidades) e dados que você informa no checkout deles"],
                        ["ViaCEP e serviço de geocodificação", "Converter CEP e endereço em coordenadas na busca por proximidade", "Apenas o CEP ou endereço consultado"],
                        ["Empresa que você agendou", "Prestar o atendimento contratado", "Nome, telefone e dados do agendamento"]
                    ]
                },
                {
                    text:
                        "Também podemos compartilhar dados quando houver " +
                        "obrigação legal, ordem judicial ou requisição de " +
                        "autoridade competente (Art. 7º, II e VI)."
                }
            ]
        },

        {
            id: "transferencia",
            title: "Transferência internacional",
            blocks: [
                {
                    text:
                        "O Firebase (Google) e o Mercado Pago podem processar " +
                        "e armazenar dados em servidores fora do Brasil. Essa " +
                        "transferência ocorre nos termos do Art. 33 da LGPD, " +
                        "amparada nas cláusulas contratuais e nas garantias " +
                        "de proteção oferecidas por esses fornecedores, e " +
                        "apenas na medida necessária para executar o serviço."
                }
            ]
        },

        {
            id: "cookies",
            title: "Cookies e armazenamento no seu dispositivo",
            blocks: [
                {
                    text:
                        "Usamos cookies e armazenamento local. Os essenciais " +
                        "não podem ser desligados porque sem eles a plataforma " +
                        "não funciona. Todo o resto depende do seu " +
                        "consentimento, que começa desligado e pode ser " +
                        "revogado quando você quiser."
                },
                {
                    type: "table",
                    headers: ["Nome", "Categoria", "Finalidade", "Retenção"],
                    rows: buildCookieRows()
                },
                {
                    type: "callout",
                    icon: "mdi:cookie-outline",
                    title: "Ao recusar, o dado é apagado",
                    text:
                        "Se você desligar uma finalidade, o que já tinha sido " +
                        "guardado nela é removido do seu dispositivo, e não " +
                        "apenas ignorado."
                },
                {
                    type: "action",
                    icon: "mdi:cookie-outline",
                    label: "Gerenciar preferências de cookies",
                    onClick: openPreferences
                }
            ]
        },

        {
            id: "retencao",
            title: "Por quanto tempo guardamos",
            blocks: [
                {
                    type: "list",
                    items: [
                        { term: "Dados da conta", text: "enquanto a conta existir." },
                        { term: "Agendamentos", text: "enquanto a conta da empresa existir, para histórico e comprovação do atendimento." },
                        { term: "Registros de pagamento", text: "pelo prazo exigido pela legislação fiscal." },
                        { term: "Mensalidades", text: "enquanto a assinatura existir e, depois de encerrada, pelo prazo fiscal e para comprovar a contratação. Uma tentativa de assinatura não concluída é apagada em até 48 horas." },
                        { term: "Escolha de cookies", text: "180 dias, depois perguntamos de novo." },
                        { term: "Produtos arquivados", text: "excluídos automaticamente após 30 dias." }
                    ]
                },
                {
                    text:
                        "Encerrado o prazo ou a finalidade, os dados são " +
                        "eliminados ou anonimizados, salvo quando a guarda " +
                        "for obrigatória por lei ou necessária para exercício " +
                        "de direitos em processo (Art. 16)."
                }
            ]
        },

        {
            id: "direitos",
            title: "Seus direitos",
            blocks: [
                {
                    text:
                        "O Art. 18 da LGPD garante a você, a qualquer momento " +
                        "e gratuitamente:"
                },
                {
                    type: "list",
                    items: [
                        "Confirmar se tratamos dados seus e acessá-los",
                        "Corrigir dados incompletos, inexatos ou desatualizados",
                        "Pedir anonimização, bloqueio ou eliminação de dados desnecessários ou tratados fora da lei",
                        "Pedir a portabilidade a outro fornecedor",
                        "Eliminar dados tratados com base no seu consentimento",
                        "Saber com quais entidades compartilhamos seus dados",
                        "Ser informado sobre a possibilidade de não consentir e o que acontece se não consentir",
                        "Revogar o consentimento a qualquer momento",
                        "Opor-se a tratamento feito em desacordo com a lei"
                    ]
                },
                {
                    text:
                        `Para exercer qualquer um deles, escreva para ${CONTACT_EMAIL}. ` +
                        "Respondemos em até 15 dias. Podemos pedir informações " +
                        "adicionais para confirmar sua identidade antes de " +
                        "atender ao pedido — é uma medida de segurança, não " +
                        "um obstáculo. Você também pode peticionar à ANPD " +
                        "(Art. 18, §1º)."
                }
            ]
        },

        {
            id: "seguranca",
            title: "Segurança",
            blocks: [
                {
                    text:
                        "Adotamos medidas técnicas e administrativas para " +
                        "proteger seus dados (Art. 46): tráfego criptografado " +
                        "por HTTPS, autenticação gerenciada pelo Firebase, " +
                        "regras de acesso por usuário no banco de dados, " +
                        "verificação por SMS e segregação do pagamento, que " +
                        "acontece no ambiente do Mercado Pago."
                },
                {
                    text:
                        "Nenhum sistema é totalmente imune. Se ocorrer um " +
                        "incidente de segurança com risco relevante a você, " +
                        "comunicaremos você e a ANPD, como exige o Art. 48."
                }
            ]
        },

        {
            id: "alteracoes",
            title: "Mudanças nesta política",
            blocks: [
                {
                    text:
                        "Podemos atualizar esta política. Mudanças relevantes " +
                        "serão avisadas na plataforma, e quando envolverem " +
                        "finalidades que dependem de consentimento, pediremos " +
                        "sua autorização de novo — o aviso de cookies " +
                        "reaparece automaticamente nesse caso."
                },
                {
                    text:
                        `Dúvidas sobre privacidade: ${CONTACT_EMAIL}.`
                }
            ]
        }

    ];


    return (

        <LegalPage
            eyebrow="Privacidade"
            title="Política de Privacidade"
            subtitle={
                "Como a Markfy trata seus dados pessoais, por que trata " +
                "e o que você pode exigir a respeito disso."
            }
            updatedAt={UPDATED_AT}
            sections={sections}
            notice={{
                title: "Documento pendente de revisão jurídica",
                text:
                    "Os campos entre colchetes (razão social, CNPJ, endereço " +
                    "e encarregado) precisam ser preenchidos, e o texto deve " +
                    "passar por revisão jurídica antes de valer como política " +
                    "oficial."
            }}
        />

    );

};


export default PrivacyPolicy;
