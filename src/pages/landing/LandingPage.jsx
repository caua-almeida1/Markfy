import { useEffect, useState } from "react";
import { Icon } from "@iconify/react";

import "./landingPage.css";

const LandingPage = () => {
    const [scrollProgress, setScrollProgress] = useState(0);

    useEffect(() => {
        document.body.classList.add("landing-active");

        return () => {
            document.body.classList.remove("landing-active");
        };
    }, []);

    const handleSmoothScroll = (event, targetId) => {
        event.preventDefault();

        const target = document.getElementById(targetId);

        if (!target) return;

        const header = document.querySelector(".markfy-header");

        const headerHeight = header
            ? header.getBoundingClientRect().height + 25
            : 100;

        const targetPosition =
            target.getBoundingClientRect().top +
            window.scrollY -
            headerHeight;

        window.scrollTo({
            top: targetPosition,
            behavior: "smooth"
        });
    };

    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = window.scrollY;

            const documentHeight =
                document.documentElement.scrollHeight -
                window.innerHeight;

            if (documentHeight <= 0) {
                setScrollProgress(0);
                return;
            }

            const progress = Math.min(
                scrollTop / documentHeight,
                1
            );

            setScrollProgress(progress);

            const header =
                document.querySelector(".markfy-header");

            if (header) {
                if (scrollTop > 40) {
                    header.classList.add("is-scrolled");
                } else {
                    header.classList.remove("is-scrolled");
                }
            }
        };

        handleScroll();

        window.addEventListener(
            "scroll",
            handleScroll,
            { passive: true }
        );

        return () => {
            window.removeEventListener(
                "scroll",
                handleScroll
            );
        };
    }, []);

    return (
        <main className="markfy-landing">

            {/* =====================================================
                SCROLL PROGRESS
            ====================================================== */}

            <div
                className="markfy-scroll-progress"
                style={{
                    transform: `scaleX(${scrollProgress})`
                }}
            />


            {/* =====================================================
                HEADER
            ====================================================== */}

            <header className="markfy-header">

                <div className="markfy-header__inner">

                    <a
                        href="#hero"
                        className="markfy-logo"
                    >
                        <img
                            src="/markfy/logo.svg"
                            alt="Markfy"
                            className="markfy-logo__mark"
                        />

                        <span className="markfy-logo__name">
                            Markfy
                        </span>
                    </a>


                    <nav className="markfy-nav">

                        <a href="#plataforma">
                            Plataforma
                        </a>

                        <a href="#recursos">
                            Recursos
                        </a>

                        <a href="#experiencia">
                            Experiência
                        </a>

                        <a href="#sobre">
                            Sobre nós
                        </a>

                    </nav>


                    <div className="markfy-header__actions">

                        <button className="markfy-header__login">
                            Entrar
                        </button>

                        <button className="markfy-button markfy-button--small">
                            Criar minha empresa
                            <Icon icon="akar-icons:chevron-right-small" className="icon" />
                        </button>

                    </div>

                </div>

            </header>


            {/* =====================================================
                HERO
            ====================================================== */}

            <section
                id="hero"
                className="markfy-hero"
            >

                <div className="markfy-hero__background">
                    <div className="markfy-hero__glow" />
                    <div className="markfy-hero__grid" />
                </div>


                <div className="markfy-container">

                    <div className="markfy-hero__content">

                        <div className="markfy-eyebrow">

                            <span className="markfy-eyebrow__dot" />

                            Agendamento do seu jeito

                        </div>


                        <h1 className="markfy-hero__title">

                            Seu negócio.
                            <br />

                            <span>
                                Seu jeito.
                            </span>

                        </h1>


                        <p className="markfy-hero__description">

                            A Markfy é uma plataforma de agendamento
                            personalizável para empresas de todos os
                            tipos. Crie sua experiência, organize sua
                            equipe e deixe seus clientes agendarem
                            de forma simples.

                        </p>


                        <div className="markfy-hero__actions">

                            <button className="markfy-button markfy-button--primary">

                                Criar minha empresa

                                <Icon icon="solar:arrow-up-right-linear" />

                            </button>


                            <a
                                href="#plataforma"
                                className="markfy-button markfy-button--ghost"
                            >

                                Conhecer a Markfy

                                <Icon icon="solar:arrow-down-linear" />

                            </a>

                        </div>


                        <div className="markfy-hero__trust">

                            <div className="markfy-hero__avatars">

                                <div className="markfy-avatar">
                                    <img
                                        src="/markfy/landing/clients/client-01.jpg"
                                        alt="Cliente Markfy"
                                    />
                                </div>

                                <div className="markfy-avatar">
                                    <img
                                        src="/markfy/landing/clients/client-02.jpg"
                                        alt="Cliente Markfy"
                                    />
                                </div>

                                <div className="markfy-avatar">
                                    <img
                                        src="/markfy/landing/clients/client-03.jpg"
                                        alt="Cliente Markfy"
                                    />
                                </div>

                                <div className="markfy-avatar markfy-avatar--more">
                                    <span>+</span>
                                </div>

                            </div>

                            <p>
                                Barbearias, clínicas, salões,
                                estúdios e muito mais.
                            </p>

                        </div>

                    </div>


                    {/* =================================================
                        MOCKUP PRINCIPAL
                    ================================================== */}

                    <div className="markfy-hero__visual">

                        <div className="markfy-main-mockup">

                            <img
                                src="/markfy/landing/mockups/hero-user.webp"
                                alt="Dashboard da plataforma Markfy"
                                className="markfy-main-mockup__image"
                            />

                        </div>


                        {/* FLOATING CARD */}

                        <div className="markfy-floating-card markfy-floating-card--top">

                            <div className="markfy-floating-card__icon">

                                <Icon icon="solar:calendar-add-linear" />

                            </div>

                            <div>

                                <strong>
                                    Novo agendamento
                                </strong>

                                <span>
                                    Hoje às 14:30
                                </span>

                            </div>

                        </div>


                        <div className="markfy-floating-card markfy-floating-card--bottom">

                            <div className="markfy-floating-card__check">

                                <Icon icon="solar:check-circle-bold" />

                            </div>

                            <div>

                                <strong>
                                    Agendamento confirmado
                                </strong>

                                <span>
                                    Cliente notificado
                                </span>

                            </div>

                        </div>

                    </div>

                </div>


                {/* SCROLL */}

                <a
                    href="#plataforma"
                    className="markfy-scroll-indicator"
                >

                    <span>
                        Conheça a plataforma
                    </span>

                    <Icon icon="solar:arrow-down-linear" />

                </a>

            </section>


            {/* =====================================================
                COMPATIBILIDADE
            ====================================================== */}

            <section className="markfy-social-proof">

                <div className="markfy-container">

                    <p className="markfy-social-proof__title">

                        Uma plataforma que se adapta ao seu negócio

                    </p>


                    <div className="markfy-social-proof__logos">

                        <span>
                            BARBEARIAS
                        </span>

                        <span>
                            CLÍNICAS
                        </span>

                        <span>
                            SALÕES
                        </span>

                        <span>
                            ESTÚDIOS
                        </span>

                        <span>
                            MUITO MAIS
                        </span>

                    </div>

                </div>

            </section>


            {/* =====================================================
                PLATFORM
            ====================================================== */}

            <section
                id="plataforma"
                className="markfy-intro"
            >

                <div className="markfy-container">

                    <div className="markfy-section-heading">

                        <div className="markfy-eyebrow">

                            <span className="markfy-eyebrow__dot" />

                            A plataforma

                        </div>


                        <h2>

                            Um sistema que
                            <br />

                            <span>
                                acompanha você.
                            </span>

                        </h2>


                        <p>

                            A Markfy foi criada para ser simples
                            desde o primeiro acesso. Você configura
                            sua empresa, personaliza sua experiência
                            e começa a receber agendamentos sem
                            complicação.

                        </p>

                    </div>


                    {/* MOCKUP */}

                    <div className="markfy-large-mockup">

                        <img
                            src="/markfy/landing/mockups/dashboard-empresa.webp"
                            alt="Dashboard da empresa Markfy"
                            className="markfy-large-mockup__image"
                        />

                    </div>

                </div>

            </section>


            {/* =====================================================
                RESOURCES
            ====================================================== */}

            <section
                id="recursos"
                className="markfy-features"
            >

                <div className="markfy-container">

                    <div className="markfy-section-heading markfy-section-heading--center">

                        <div className="markfy-eyebrow">

                            <span className="markfy-eyebrow__dot" />

                            Recursos

                        </div>


                        <h2>

                            Tudo para deixar seu
                            <br />

                            <span>
                                atendimento mais simples.
                            </span>

                        </h2>

                    </div>


                    <div className="markfy-features__grid">


                        {/* =================================================
                            FEATURE 01
                        ================================================== */}

                        <article className="markfy-feature-card">

                            <div className="markfy-feature-card__number">
                                01
                            </div>


                            <div className="markfy-feature-card__icon">

                                <Icon icon="solar:palette-linear" />

                            </div>


                            <h3>
                                Personalização
                            </h3>


                            <p>

                                Crie uma experiência que tenha
                                a identidade do seu negócio.
                                A Markfy se adapta à sua empresa,
                                não o contrário.

                            </p>


                            <div className="markfy-feature-card__visual">

                                <div className="markfy-mini-placeholder">

                                    <Icon icon="solar:palette-linear" />

                                </div>

                            </div>

                        </article>


                        {/* =================================================
                            FEATURE 02
                        ================================================== */}

                        <article className="markfy-feature-card">

                            <div className="markfy-feature-card__number">
                                02
                            </div>


                            <div className="markfy-feature-card__icon">

                                <Icon icon="solar:users-group-rounded-linear" />

                            </div>


                            <h3>
                                Sua equipe
                            </h3>


                            <p>

                                Adicione pessoas da sua empresa
                                para ajudar na administração.
                                Defina diferentes níveis de acesso,
                                como Master e Administrador.

                            </p>


                            <div className="markfy-feature-card__visual">

                                <div className="markfy-mini-placeholder">

                                    <Icon icon="solar:users-group-rounded-linear" />

                                </div>

                            </div>

                        </article>


                        {/* =================================================
                            FEATURE 03
                        ================================================== */}

                        <article className="markfy-feature-card">

                            <div className="markfy-feature-card__number">
                                03
                            </div>


                            <div className="markfy-feature-card__icon">

                                <Icon icon="solar:calendar-add-linear" />

                            </div>


                            <h3>
                                Agendamentos
                            </h3>


                            <p>

                                Cadastre serviços, produtos, categorias,
                                duração, profissionais relacionados,
                                horários e muito mais.

                            </p>


                            <div className="markfy-feature-card__visual">

                                <div className="markfy-mini-placeholder">

                                    <Icon icon="solar:calendar-add-linear" />

                                </div>

                            </div>

                        </article>


                        {/* =================================================
                            FEATURE 04
                        ================================================== */}

                        <article className="markfy-feature-card">

                            <div className="markfy-feature-card__number">
                                04
                            </div>


                            <div className="markfy-feature-card__icon">

                                <Icon icon="solar:card-linear" />

                            </div>


                            <h3>
                                Pagamento antecipado
                            </h3>


                            <p>

                                Ofereça aos seus clientes a possibilidade
                                de realizar o pagamento antes do
                                atendimento, tornando o processo
                                ainda mais prático.

                            </p>


                            <div className="markfy-feature-card__visual">

                                <div className="markfy-mini-placeholder">

                                    <Icon icon="solar:card-linear" />

                                </div>

                            </div>

                        </article>


                    </div>

                </div>

            </section>


            {/* =====================================================
                EXPERIENCE
            ====================================================== */}

            <section
                id="experiencia"
                className="markfy-showcase"
            >

                <div className="markfy-container">

                    <div className="markfy-showcase__content">

                        <div className="markfy-eyebrow">

                            <span className="markfy-eyebrow__dot" />

                            Experiência simples

                        </div>


                        <h2>

                            Seu cliente já sabe
                            <br />

                            <span>
                                como usar.
                            </span>

                        </h2>


                        <p>

                            A Markfy foi pensada para ser intuitiva.
                            A interface utiliza padrões visuais
                            familiares às plataformas que as pessoas
                            já usam no dia a dia.

                        </p>


                        <ul className="markfy-check-list">

                            <li>

                                <Icon icon="solar:check-circle-bold" />

                                Interface intuitiva

                            </li>


                            <li>

                                <Icon icon="solar:check-circle-bold" />

                                Navegação simples

                            </li>


                            <li>

                                <Icon icon="solar:check-circle-bold" />

                                Experiência rápida

                            </li>


                            <li>

                                <Icon icon="solar:check-circle-bold" />

                                Design responsivo

                            </li>


                            <li>

                                <Icon icon="solar:check-circle-bold" />

                                Perfeito para celular e computador

                            </li>

                        </ul>


                        <button className="markfy-button markfy-button--primary">

                            Ver experiência

                            <Icon icon="solar:arrow-up-right-linear" />

                        </button>

                    </div>


                    <div className="markfy-showcase__visual">

                        <div className="markfy-showcase-mockup">

                            <div className="markfy-mockup-placeholder">

                                <Icon icon="solar:smartphone-2-linear" />

                                <span>
                                    Experiência do cliente
                                </span>

                                <small>
                                    Adicione aqui um mockup
                                    mobile da plataforma
                                </small>

                            </div>

                        </div>

                    </div>

                </div>

            </section>


            {/* =====================================================
                BLUE FEATURE SECTION
            ====================================================== */}

            <section className="markfy-blue-section">

                <div className="markfy-blue-section__background">

                    <div className="markfy-blue-section__grid" />

                </div>


                <div className="markfy-container">

                    <div className="markfy-blue-section__content">

                        <div className="markfy-eyebrow markfy-eyebrow--light">

                            <span className="markfy-eyebrow__dot" />

                            Sua empresa em um link

                        </div>


                        <h2>

                            Seu negócio pode
                            <br />

                            estar a um link
                            <br />

                            de distância.

                        </h2>


                        <p>

                            Depois de configurar sua empresa,
                            seus clientes podem acessar sua página
                            diretamente através de um endereço
                            personalizado.

                        </p>


                        <div className="markfy-link-example">

                            <span>
                                markfy.vercel.app/central-user/
                            </span>

                            <strong>
                                suaempresa
                            </strong>

                            <Icon icon="solar:copy-linear" />

                        </div>


                        <button className="markfy-button markfy-button--white">

                            Criar minha empresa

                            <Icon icon="solar:arrow-up-right-linear" className="icon" />

                        </button>

                    </div>


                    <div className="markfy-blue-section__visual">

                        <div className="markfy-blue-mockup">

                            <div className="markfy-mockup-placeholder">

                                <Icon icon="solar:link-linear" />

                                <span>
                                    Página pública da empresa
                                </span>

                                <small>
                                    Adicione aqui um mockup
                                    da página de agendamento
                                </small>

                            </div>

                        </div>

                    </div>

                </div>

            </section>


            {/* =====================================================
                BUSINESS SETUP
            ====================================================== */}

            <section className="markfy-results">

                <div className="markfy-container">

                    <div className="markfy-section-heading">

                        <div className="markfy-eyebrow">

                            <span className="markfy-eyebrow__dot" />

                            Configure do seu jeito

                        </div>


                        <h2>

                            Do primeiro clique
                            <br />

                            ao agendamento.

                        </h2>


                    </div>


                    <div className="markfy-results__grid">


                        <div className="markfy-result">

                            <strong>
                                01
                            </strong>

                            <span>
                                Crie sua empresa
                            </span>

                        </div>


                        <div className="markfy-result">

                            <strong>
                                02
                            </strong>

                            <span>
                                Personalize sua página
                            </span>

                        </div>


                        <div className="markfy-result">

                            <strong>
                                03
                            </strong>

                            <span>
                                Cadastre serviços e equipe
                            </span>

                        </div>


                        <div className="markfy-result">

                            <strong>
                                04
                            </strong>

                            <span>
                                Comece a receber agendamentos
                            </span>

                        </div>

                    </div>


                    {/* =================================================
                        TESTIMONIAL
                    ================================================== */}

                    <div className="markfy-testimonial">

                        <div className="markfy-testimonial__quote">

                            <Icon icon="solar:quote-up-square-linear" />

                        </div>


                        <blockquote>

                            "A Markfy foi criada para tornar o
                            agendamento simples para quem administra
                            e ainda mais simples para quem agenda."

                        </blockquote>


                        <div className="markfy-testimonial__author">

                            <div className="markfy-testimonial__avatar">
                                M
                            </div>


                            <div>

                                <strong>
                                    Markfy
                                </strong>

                                <span>
                                    Plataforma de agendamento
                                </span>

                            </div>

                        </div>

                    </div>

                </div>

            </section>


            {/* =====================================================
                ABOUT
            ====================================================== */}

            <section
                id="sobre"
                className="markfy-about"
            >

                <div className="markfy-container">

                    <div className="markfy-about__visual">

                        <div className="markfy-about__image">

                            <div className="markfy-mockup-placeholder">

                                <Icon icon="solar:calendar-search-linear" />

                                <span>
                                    A experiência Markfy
                                </span>

                                <small>
                                    Adicione uma composição
                                    visual da plataforma
                                </small>

                            </div>

                        </div>

                    </div>


                    <div className="markfy-about__content">

                        <div className="markfy-eyebrow">

                            <span className="markfy-eyebrow__dot" />

                            Sobre a Markfy

                        </div>


                        <h2>

                            Agendamento não precisa
                            <br />

                            ser
                            <span>
                                complicado.
                            </span>

                        </h2>


                        <p>

                            A Markfy nasceu com uma ideia simples:
                            criar uma plataforma de agendamento
                            que qualquer empresa consiga entender,
                            configurar e usar.

                        </p>


                        <p>

                            Seja uma barbearia, uma clínica,
                            um salão, um estúdio ou qualquer
                            outro negócio que trabalhe com horários,
                            a plataforma se adapta à sua realidade.

                        </p>


                        <p>

                            Tudo isso com uma interface intuitiva,
                            responsiva e pensada para funcionar
                            perfeitamente no celular e no computador.

                        </p>


                        <button className="markfy-text-button">

                            Conheça a Markfy

                            <Icon icon="solar:arrow-right-up-linear" />

                        </button>

                    </div>

                </div>

            </section>


            {/* =====================================================
                FINAL CTA
            ====================================================== */}

            <section className="markfy-final-cta">

                <div className="markfy-final-cta__background">

                    <div className="markfy-final-cta__glow" />

                    <div className="markfy-final-cta__grid" />

                </div>


                <div className="markfy-container">

                    <div className="markfy-final-cta__content">

                        <div className="markfy-eyebrow markfy-eyebrow--light">

                            <span className="markfy-eyebrow__dot" />

                            Comece agora

                        </div>


                        <h2>

                            Seu negócio está
                            <br />

                            pronto para
                            <span>
                                agendar.
                            </span>

                        </h2>


                        <p>

                            Crie sua empresa na Markfy,
                            personalize sua experiência e
                            comece a receber agendamentos
                            de uma forma simples.

                        </p>


                        <div className="markfy-final-cta__actions">

                            <button className="markfy-button markfy-button--white">

                                Criar minha empresa

                                <Icon icon="solar:arrow-up-right-linear" />

                            </button>


                            <button className="markfy-button markfy-button--outline-white">

                                Conhecer a plataforma

                                <Icon icon="solar:play-circle-linear" />

                            </button>

                        </div>

                    </div>

                </div>

            </section>


            {/* =====================================================
                FOOTER
            ====================================================== */}

            <footer className="markfy-footer">

                <div className="markfy-container">

                    <div className="markfy-footer__top">

                        <div className="markfy-footer__brand">

                            <a
                                href="#hero"
                                className="markfy-logo"
                            >

                                <span className="markfy-logo__mark">
                                    M
                                </span>

                                <span className="markfy-logo__name">
                                    markfy
                                </span>

                            </a>


                            <p>

                                Agendamento simples,
                                personalizável e do
                                seu jeito.

                            </p>

                        </div>


                        <div className="markfy-footer__links">

                            <div>

                                <strong>
                                    Plataforma
                                </strong>

                                <a href="#plataforma">
                                    A plataforma
                                </a>

                                <a href="#recursos">
                                    Recursos
                                </a>

                                <a href="#experiencia">
                                    Experiência
                                </a>

                            </div>


                            <div>

                                <strong>
                                    Empresa
                                </strong>

                                <a href="#sobre">
                                    Sobre nós
                                </a>

                                <a href="#">
                                    Contato
                                </a>

                                <a href="#">
                                    Suporte
                                </a>

                            </div>


                            <div>

                                <strong>
                                    Acesso
                                </strong>

                                <a href="#">
                                    Entrar
                                </a>

                                <a href="#">
                                    Criar empresa
                                </a>

                                <a href="#">
                                    Central do usuário
                                </a>

                            </div>

                        </div>

                    </div>


                    <div className="markfy-footer__bottom">

                        <span>
                            © 2026 Markfy. Todos os direitos reservados.
                        </span>


                        <div>

                            <a href="#">
                                Privacidade
                            </a>

                            <a href="#">
                                Termos
                            </a>

                        </div>

                    </div>

                </div>

            </footer>

        </main>
    );
};

export default LandingPage;