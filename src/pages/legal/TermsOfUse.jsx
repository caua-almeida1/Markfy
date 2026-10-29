import React from "react";

import LegalPage from "./LegalPage";


/* =========================================================
   TERMOS DE USO

   Descrevem o serviço como ele existe hoje: cadastro de
   empresa, catálogo de produtos e mensalidades, agenda por
   profissional, pagamento via Mercado Pago e a central do
   cliente.
========================================================= */


const UPDATED_AT = "22 de setembro de 2026";

const CONTACT_EMAIL = "markfy.suporte@gmail.com";

/* Trocar pelos dados registrais reais antes de publicar. */
const CONTROLLER_NAME = "[Razão social da Markfy]";
const CONTROLLER_DOC = "[CNPJ]";
const JURISDICTION = "[Comarca]";


const TermsOfUse = () => {

    const sections = [

        {
            id: "aceite",
            title: "Aceite destes termos",
            blocks: [
                {
                    text:
                        "Estes Termos regem o uso da Markfy, plataforma de " +
                        `agendamento online operada por ${CONTROLLER_NAME}, ` +
                        `CNPJ ${CONTROLLER_DOC}. Ao criar uma conta, cadastrar ` +
                        "uma empresa ou realizar um agendamento, você declara " +
                        "que leu, entendeu e concorda com o que está aqui."
                },
                {
                    text:
                        "Se você não concordar com algum ponto, não utilize a " +
                        "plataforma. O uso continuado após uma alteração " +
                        "destes Termos significa que você aceitou a nova versão."
                }
            ]
        },

        {
            id: "servico",
            title: "O que a Markfy faz",
            blocks: [
                {
                    text:
                        "A Markfy conecta empresas prestadoras de serviço aos " +
                        "seus clientes. Oferecemos a infraestrutura; quem " +
                        "presta o serviço agendado é sempre a empresa."
                },
                {
                    type: "list",
                    items: [
                        { term: "Para a empresa", text: "página pública, catálogo de produtos e planos de mensalidade, agenda por profissional, gestão de equipe e recebimento online." },
                        { term: "Para o cliente", text: "encontrar empresas, ver serviços e preços, escolher profissional e horário, pagar quando exigido e acompanhar suas reservas." }
                    ]
                },
                {
                    type: "callout",
                    icon: "solar:info-circle-linear",
                    title: "A Markfy não presta o serviço agendado",
                    text:
                        "Não somos parte da relação entre você e a empresa. " +
                        "Qualidade, execução, atraso, cancelamento e " +
                        "reembolso do atendimento são responsabilidade da " +
                        "empresa contratada."
                }
            ]
        },

        {
            id: "conta",
            title: "Conta e elegibilidade",
            blocks: [
                {
                    type: "list",
                    items: [
                        "Você precisa ter 18 anos ou mais, ou estar assistido pelos responsáveis legais, para criar conta.",
                        "As informações fornecidas devem ser verdadeiras, completas e atualizadas.",
                        "A senha é pessoal e intransferível. Você é responsável pelo que acontece na sua conta.",
                        "Avise imediatamente em caso de uso não autorizado da sua conta.",
                        "Cada empresa é responsável pelos administradores que convida e pelo nível de acesso que concede a eles."
                    ]
                }
            ]
        },

        {
            id: "empresa",
            title: "Obrigações da empresa cadastrada",
            blocks: [
                {
                    text:
                        "Ao publicar uma página na Markfy, a empresa se " +
                        "compromete a:"
                },
                {
                    type: "list",
                    items: [
                        "Informar corretamente serviços, preços, duração, formas de pagamento e regras de cancelamento.",
                        "Honrar os agendamentos confirmados na plataforma e comunicar o cliente em caso de imprevisto.",
                        "Manter as condições anunciadas nos planos de mensalidade, incluindo ciclo de cobrança, benefícios inclusos, período de teste, fidelidade e prazo de aviso para cancelamento.",
                        "Cumprir a legislação aplicável à sua atividade, inclusive licenças, tributos e obrigações trabalhistas.",
                        "Tratar os dados dos seus clientes conforme a LGPD, na condição de controladora desses dados.",
                        "Não publicar conteúdo ilegal, enganoso, ofensivo ou de terceiros sem autorização."
                    ]
                }
            ]
        },

        {
            id: "cliente",
            title: "Obrigações do cliente",
            blocks: [
                {
                    type: "list",
                    items: [
                        "Fornecer dados verdadeiros no agendamento, especialmente nome e telefone de contato.",
                        "Comparecer no horário reservado ou cancelar com a antecedência exigida pela empresa.",
                        "Respeitar as regras de cancelamento, reagendamento e pagamento antecipado definidas por cada empresa e exibidas na página do produto."
                    ]
                }
            ]
        },

        {
            id: "pagamentos",
            title: "Pagamentos e assinaturas",
            blocks: [
                {
                    text:
                        "Quando a empresa exige pagamento antecipado, a " +
                        "transação é processada pelo Mercado Pago. A Markfy " +
                        "não é instituição de pagamento, não retém o valor e " +
                        "não armazena dados de cartão."
                },
                {
                    type: "list",
                    items: [
                        { term: "Produtos avulsos", text: "cobrança única, no valor exibido no momento do agendamento." },
                        { term: "Planos de mensalidade", text: "cobrança recorrente no ciclo informado na página do plano (mensal, trimestral, semestral ou anual), com renovação automática quando indicado, feita pelo Mercado Pago no cartão de crédito ou na conta Mercado Pago que você autorizar. A cobrança só começa depois do seu aceite expresso, registrado com data e versão destes termos." },
                        { term: "Teste gratuito", text: "quando oferecido, a primeira cobrança só ocorre depois do período informado." },
                        { term: "Permanência mínima e aviso de cancelamento", text: "quando existirem, são definidos pela empresa e exibidos antes da contratação." },
                        { term: "Cancelamento", text: "pela aba Reservas, a qualquer momento e sem intermediários. As cobranças futuras param e os atendimentos continuam valendo até o fim do período já pago; horários marcados depois disso são desmarcados." },
                        { term: "Arrependimento", text: "em até 7 dias da contratação você pode desistir pela mesma tela e receber de volta o que foi cobrado nesse período (Código de Defesa do Consumidor, art. 49). Depois desse prazo, não há devolução proporcional do ciclo em andamento." },
                        { term: "Falha na cobrança", text: "o Mercado Pago tenta cobrar de novo automaticamente; se não conseguir, a assinatura é encerrada." }
                    ]
                },
                {
                    text:
                        "Reembolsos, estornos e disputas seguem as regras da " +
                        "empresa contratada, o Código de Defesa do Consumidor " +
                        "e as políticas do Mercado Pago."
                }
            ]
        },

        {
            id: "uso",
            title: "Uso aceitável",
            blocks: [
                {
                    text: "É proibido usar a Markfy para:"
                },
                {
                    type: "list",
                    items: [
                        "Praticar ou facilitar qualquer atividade ilegal.",
                        "Criar agendamentos falsos ou em nome de terceiros sem autorização.",
                        "Tentar acessar contas, dados ou áreas da plataforma sem permissão.",
                        "Sobrecarregar, sondar ou automatizar acesso à plataforma sem autorização expressa.",
                        "Copiar, reproduzir ou explorar a plataforma ou sua marca sem autorização.",
                        "Publicar conteúdo que viole direitos de terceiros."
                    ]
                }
            ]
        },

        {
            id: "conteudo",
            title: "Conteúdo e propriedade intelectual",
            blocks: [
                {
                    text:
                        "O código, a marca, o design e os elementos visuais da " +
                        "Markfy pertencem à Markfy e não podem ser usados sem " +
                        "autorização escrita."
                },
                {
                    text:
                        "O conteúdo que a empresa publica — textos, fotos, " +
                        "logo e descrições — continua pertencendo a ela. Ao " +
                        "publicá-lo, a empresa concede à Markfy uma licença " +
                        "não exclusiva e gratuita para exibi-lo na plataforma, " +
                        "pelo tempo em que o conteúdo estiver publicado, com a " +
                        "única finalidade de operar o serviço. A empresa " +
                        "declara ter os direitos sobre o que publica."
                }
            ]
        },

        {
            id: "disponibilidade",
            title: "Disponibilidade e limitação de responsabilidade",
            blocks: [
                {
                    text:
                        "Trabalhamos para manter a plataforma disponível, mas " +
                        "ela pode ficar indisponível por manutenção, falha de " +
                        "fornecedores ou eventos fora do nosso controle. Não " +
                        "garantimos operação ininterrupta ou livre de erros."
                },
                {
                    text:
                        "A Markfy não responde pela execução do serviço " +
                        "agendado, por prejuízos decorrentes de informações " +
                        "incorretas fornecidas por empresas ou clientes, nem " +
                        "por indisponibilidade de serviços de terceiros como " +
                        "Firebase e Mercado Pago. Nada aqui afasta direitos " +
                        "garantidos ao consumidor pela legislação brasileira."
                }
            ]
        },

        {
            id: "encerramento",
            title: "Suspensão e encerramento",
            blocks: [
                {
                    text:
                        "Você pode encerrar sua conta quando quiser. A empresa " +
                        "que encerrar a conta deve honrar os agendamentos e " +
                        "assinaturas já confirmados ou combinar com os clientes " +
                        "afetados."
                },
                {
                    text:
                        "Podemos suspender ou encerrar contas que violem estes " +
                        "Termos, que representem risco a outros usuários ou à " +
                        "plataforma, ou quando exigido por lei. Sempre que " +
                        "possível, avisaremos antes."
                }
            ]
        },

        {
            id: "alteracoes",
            title: "Alterações, lei aplicável e foro",
            blocks: [
                {
                    text:
                        "Podemos alterar estes Termos. A data de atualização " +
                        "no topo indica a versão vigente, e mudanças relevantes " +
                        "serão comunicadas na plataforma."
                },
                {
                    text:
                        "Estes Termos são regidos pelas leis brasileiras, " +
                        "incluindo o Marco Civil da Internet (Lei 12.965/2014), " +
                        "o Código de Defesa do Consumidor (Lei 8.078/1990) e a " +
                        "LGPD (Lei 13.709/2018). Fica eleito o foro da comarca " +
                        `de ${JURISDICTION}, sem prejuízo do direito do ` +
                        "consumidor de demandar no foro do seu domicílio."
                },
                {
                    text: `Dúvidas sobre estes Termos: ${CONTACT_EMAIL}.`
                }
            ]
        }

    ];


    return (

        <LegalPage
            eyebrow="Legal"
            title="Termos de Uso"
            subtitle={
                "As regras de uso da Markfy: o que oferecemos, o que " +
                "esperamos de você e o que cada parte responde."
            }
            updatedAt={UPDATED_AT}
            sections={sections}
            notice={{
                title: "Documento pendente de revisão jurídica",
                text:
                    "Os campos entre colchetes (razão social, CNPJ e comarca) " +
                    "precisam ser preenchidos, e o texto deve passar por " +
                    "revisão jurídica antes de valer como termo oficial."
            }}
        />

    );

};


export default TermsOfUse;
