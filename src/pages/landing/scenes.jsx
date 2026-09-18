import { Icon } from "@iconify/react";

import { useScrollScene, useReducedMotion } from "./hooks";

/* =========================================================
   CENAS PRESAS

   As três seguem a mesma mecânica: um trilho alto prende
   uma tela de 100vh e o progresso do scroll comanda a
   animação. A profundidade (Z) é o que carrega a
   progressão nas três, para conversarem com a agenda 3D
   do hero em vez de parecerem truques diferentes.
========================================================= */


/* ---------------------------------------------------------
   1. PLATAFORMA — o baralho

   Quatro cartas empilhadas em perspectiva. O scroll traz
   uma de cada vez para a frente; a que passa sobe e sai.
--------------------------------------------------------- */

const FEATURES = [
    {
        icon: "solar:palette-round-linear",
        title: "Sua identidade, não um template",
        body: "Logo, cores e descrição da empresa. A página que o cliente abre parece sua, porque é sua.",
        aside: "Personalização"
    },
    {
        icon: "solar:calendar-mark-linear",
        title: "Serviços do jeito que você trabalha",
        body: "Duração real, preço, categoria e profissionais habilitados. Se o seu corte leva 40 minutos, a agenda reserva 40 minutos.",
        aside: "Serviços"
    },
    {
        icon: "solar:users-group-rounded-linear",
        title: "Sua equipe junto",
        body: "Convide administradores por e-mail e defina o que cada pessoa pode ver e alterar.",
        aside: "Equipe"
    },
    {
        icon: "solar:wallet-money-linear",
        title: "Pagamento antes do horário",
        body: "Receba por Pix ou cartão no ato da reserva e reduza o cliente que marca e não aparece.",
        aside: "Pagamentos"
    }
];

export const PlatformDeck = () => {
    const reduced = useReducedMotion();

    const { trackRef, stageRef, step } = useScrollScene({
        steps: FEATURES.length,
        disabled: reduced
    });

    return (
        <section
            id="plataforma"
            className="mk-track mk-track--deck"
            ref={trackRef}
            data-reduced={reduced ? "true" : undefined}
        >
            <div className="mk-pin" ref={stageRef}>
                <div className="mk-shell mk-deck__shell">

                    <div className="mk-deck__copy">
                        <h2>
                            Configure uma vez.
                            <br />
                            Ela cuida do resto.
                        </h2>

                        <div className="mk-deck__texts">
                            {FEATURES.map((feature, index) => (
                                <div
                                    key={feature.title}
                                    className={
                                        "mk-deck__text" +
                                        (index === step ? " is-active" : "")
                                    }
                                >
                                    <h3>{feature.title}</h3>
                                    <p>{feature.body}</p>
                                </div>
                            ))}
                        </div>

                        <ol className="mk-deck__ticks" aria-hidden="true">
                            {FEATURES.map((feature, index) => (
                                <li
                                    key={feature.aside}
                                    className={index <= step ? "is-done" : ""}
                                >
                                    <span />
                                    {feature.aside}
                                </li>
                            ))}
                        </ol>
                    </div>

                    <div className="mk-deck" aria-hidden="true">
                        {FEATURES.map((feature, index) => (
                            <article
                                key={feature.title}
                                className="mk-deck__card"
                                style={{ "--i": index }}
                            >
                                <Icon icon={feature.icon} className="mk-deck__icon" />
                                <h4>{feature.title}</h4>
                                <p>{feature.body}</p>
                                <span className="mk-deck__tag">{feature.aside}</span>
                            </article>
                        ))}
                    </div>

                </div>
            </div>
        </section>
    );
};


/* ---------------------------------------------------------
   2. O LINK — o fluxo de agendamento

   O celular fica preso e o scroll percorre o caminho real
   que o cliente faz: abre a página, escolhe serviço,
   escolhe profissional, escolhe horário, confirma.
--------------------------------------------------------- */

const FLOW = [
    {
        label: "Seu link abre assim",
        body: "O cliente entra pelo endereço da sua empresa e vê o que você oferece — sem app, sem cadastro, sem espera."
    },
    {
        label: "Escolhe o serviço",
        body: "Cada serviço com preço e duração reais. A agenda reserva exatamente o tempo que o atendimento leva."
    },
    {
        label: "Escolhe com quem",
        body: "Se o cliente tem preferência por um profissional, ele escolhe. Só aparecem quem faz aquele serviço."
    },
    {
        label: "Escolhe o horário",
        body: "Só os horários realmente livres daquele profissional, já descontando intervalos e a duração do serviço."
    },
    {
        label: "Pronto",
        body: "O agendamento cai na sua agenda na hora. Você não respondeu uma mensagem sequer."
    }
];

const SERVICES = [
    { name: "Corte feminino", price: "R$ 90", time: "45 min" },
    { name: "Escova + hidratação", price: "R$ 120", time: "1h" },
    { name: "Coloração", price: "R$ 240", time: "2h" }
];

const TEAM = [
    { initials: "VM", name: "Vera M." },
    { initials: "JL", name: "Júlia L." },
    { initials: "RS", name: "Rafa S." }
];

const TIMES = ["11:45", "14:15", "15:30", "17:00"];

export const BookingFlow = () => {
    const reduced = useReducedMotion();

    const { trackRef, stageRef, step } = useScrollScene({
        steps: FLOW.length,
        disabled: reduced
    });

    return (
        <section
            id="recursos"
            className="mk-track mk-track--flow"
            ref={trackRef}
            data-reduced={reduced ? "true" : undefined}
        >
            <div className="mk-pin" ref={stageRef}>
                <div className="mk-shell mk-flow__shell">

                    <div className="mk-flow__copy">
                        <h2>
                            Seu negócio inteiro
                            <br />
                            cabe em um link.
                        </h2>

                        <div className="mk-flow__url">
                            <Icon icon="solar:link-round-angle-linear" aria-hidden="true" />
                            <span>
                                markfy.app/<strong>sua-empresa</strong>
                            </span>
                        </div>

                        <div className="mk-flow__texts">
                            {FLOW.map((entry, index) => (
                                <div
                                    key={entry.label}
                                    className={
                                        "mk-flow__text" +
                                        (index === step ? " is-active" : "")
                                    }
                                >
                                    <h3>{entry.label}</h3>
                                    <p>{entry.body}</p>
                                </div>
                            ))}
                        </div>

                        <div className="mk-flow__dots" aria-hidden="true">
                            {FLOW.map((entry, index) => (
                                <span
                                    key={entry.label}
                                    className={index <= step ? "is-on" : ""}
                                />
                            ))}
                        </div>
                    </div>

                    <div className="mk-flow__device" aria-hidden="true">
                        <div className="mk-phone" data-step={step}>
                            <div className="mk-phone__screen">

                                <header className="mk-phone__head">
                                    <span className="mk-phone__logo">SE</span>
                                    <div>
                                        <strong>Sua-Empresa</strong>
                                        <small>Aberto até 19h</small>
                                    </div>
                                </header>

                                {/* Serviços */}
                                <section className="mk-phone__block mk-phone__block--services">
                                    <p className="mk-phone__label">Serviços</p>

                                    <ul>
                                        {SERVICES.map((service, index) => (
                                            <li
                                                key={service.name}
                                                className={
                                                    step >= 1 && index === 1
                                                        ? "is-picked"
                                                        : ""
                                                }
                                            >
                                                <span>
                                                    {service.name}
                                                    <small>{service.time}</small>
                                                </span>
                                                <b>{service.price}</b>
                                            </li>
                                        ))}
                                    </ul>
                                </section>

                                {/* Profissionais */}
                                <section className="mk-phone__block mk-phone__block--team">
                                    <p className="mk-phone__label">Profissional</p>

                                    <ul>
                                        {TEAM.map((member, index) => (
                                            <li
                                                key={member.initials}
                                                className={
                                                    step >= 2 && index === 0
                                                        ? "is-picked"
                                                        : ""
                                                }
                                            >
                                                <span className="mk-phone__avatar">
                                                    {member.initials}
                                                </span>
                                                {member.name}
                                            </li>
                                        ))}
                                    </ul>
                                </section>

                                {/* Horários */}
                                <section className="mk-phone__block mk-phone__block--times">
                                    <p className="mk-phone__label">Horário</p>

                                    <div>
                                        {TIMES.map((time, index) => (
                                            <span
                                                key={time}
                                                className={
                                                    step >= 3 && index === 1
                                                        ? "is-picked"
                                                        : ""
                                                }
                                            >
                                                {time}
                                            </span>
                                        ))}
                                    </div>
                                </section>

                                <div className="mk-phone__cta">
                                    {step >= 4 ? "Agendado" : "Confirmar horário"}
                                </div>

                                {/* Confirmação final */}
                                <div className="mk-phone__done">
                                    <Icon icon="solar:check-circle-bold" />
                                    <strong>Agendado</strong>
                                    <small>Quinta, 14 · 14:15 · Vera M.</small>
                                </div>

                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
};


/* ---------------------------------------------------------
   3. COMO COMEÇAR — o trilho

   Aqui a numeração vale: é sequência de verdade. Os quatro
   passos avançam na horizontal e a linha de progresso
   preenche junto.
--------------------------------------------------------- */

const STEPS = [
    {
        title: "Crie sua empresa",
        body: "Nome, documento e contato. Leva menos de um minuto e você já tem um endereço próprio.",
        icon: "solar:buildings-2-linear"
    },
    {
        title: "Personalize a página",
        body: "Logo, cores, descrição e horário de funcionamento. A página fica com a cara do seu negócio.",
        icon: "solar:magic-stick-3-linear"
    },
    {
        title: "Cadastre serviços e equipe",
        body: "Duração, preço, profissionais e categorias. Convide administradores com níveis de acesso.",
        icon: "solar:clipboard-list-linear"
    },
    {
        title: "Receba agendamentos",
        body: "Compartilhe o link. Seus clientes escolhem horário e profissional sozinhos.",
        icon: "solar:bell-bing-linear"
    }
];

export const StepsRail = () => {
    const reduced = useReducedMotion();

    const { trackRef, stageRef, step } = useScrollScene({
        steps: STEPS.length,
        disabled: reduced
    });

    return (
        <section
            id="comecar"
            className="mk-track mk-track--rail"
            ref={trackRef}
            data-reduced={reduced ? "true" : undefined}
        >
            <div className="mk-pin" ref={stageRef}>

                <div className="mk-shell mk-rail__head">
                    <h2>Do cadastro ao primeiro agendamento</h2>
                    <p>
                        Quatro etapas, na ordem. Você pode parar e voltar
                        depois — nada se perde.
                    </p>
                </div>

                <div className="mk-rail__line" aria-hidden="true">
                    <span />
                </div>

                <ol className="mk-rail">
                    {STEPS.map((entry, index) => (
                        <li
                            key={entry.title}
                            className={
                                "mk-rail__item" +
                                (index === step ? " is-active" : "") +
                                (index < step ? " is-past" : "")
                            }
                            style={{ "--i": index }}
                        >
                            <span className="mk-rail__num">{index + 1}</span>

                            <Icon icon={entry.icon} className="mk-rail__icon" />

                            <h3>{entry.title}</h3>
                            <p>{entry.body}</p>
                        </li>
                    ))}
                </ol>

            </div>
        </section>
    );
};
