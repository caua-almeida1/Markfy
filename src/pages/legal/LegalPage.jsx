import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { usePageMeta } from "../../hooks/usePageMeta";
import { Icon } from "@iconify/react";

import "./legal.css";


/* =========================================================
   LAYOUT DAS PÁGINAS LEGAIS

   Estrutura compartilhada por /privacidade e /termos:
   cabeçalho, sumário navegável e as seções numeradas.

   O conteúdo vem em `sections`, cada uma com:

       { id, title, blocks: [...] }

   onde cada bloco é texto, lista, tabela ou destaque.
========================================================= */


const Block = ({ block }) => {

    if (block.type === "list") {

        return (
            <ul className="legal-list">
                {block.items.map((item, index) => (
                    <li key={index}>
                        {item.term && (
                            <strong>
                                {item.term}
                                {" — "}
                            </strong>
                        )}
                        {item.text || item}
                    </li>
                ))}
            </ul>
        );

    }

    if (block.type === "table") {

        return (
            <div className="legal-table-wrapper">
                <table className="legal-table">
                    <thead>
                        <tr>
                            {block.headers.map((header) => (
                                <th key={header}>
                                    {header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {block.rows.map((row, index) => (
                            <tr key={index}>
                                {row.map((cell, cellIndex) => (
                                    <td key={cellIndex}>
                                        {cell}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );

    }

    if (block.type === "callout") {

        return (
            <div className="legal-callout">
                <Icon icon={block.icon || "solar:info-circle-linear"} />
                <div>
                    {block.title && (
                        <strong>
                            {block.title}
                        </strong>
                    )}
                    <span>
                        {block.text}
                    </span>
                </div>
            </div>
        );

    }

    if (block.type === "action") {

        return (
            <button
                type="button"
                className="legal-action"
                onClick={block.onClick}
            >
                <Icon icon={block.icon || "mdi:cookie-outline"} />
                {block.label}
            </button>
        );

    }

    return (
        <p className="legal-paragraph">
            {block.text || block}
        </p>
    );

};


const LegalPage = ({
    eyebrow,
    title,
    subtitle,
    updatedAt,
    sections,
    notice
}) => {

    const navigate = useNavigate();

    const { pathname } = useLocation();

    usePageMeta({ title, description: subtitle, path: pathname });


    /* As telas do app travam html/body em height:100%.
       Estas páginas rolam livres, então liberamos enquanto
       elas estão montadas e devolvemos ao sair. */
    useEffect(() => {

        const root = document.documentElement;

        const previousRoot = root.style.height;
        const previousBody = document.body.style.height;
        const previousOverflow = document.body.style.overflowY;

        root.style.height = "auto";
        document.body.style.height = "auto";
        document.body.style.overflowY = "auto";

        window.scrollTo(0, 0);

        return () => {
            root.style.height = previousRoot;
            document.body.style.height = previousBody;
            document.body.style.overflowY = previousOverflow;
        };

    }, []);


    return (

        <main className="legal-page">

            {/* =================================================
                CABEÇALHO
            ================================================= */}

            <header className="legal-header">

                <button
                    type="button"
                    className="legal-back"
                    onClick={() => navigate(-1)}
                >
                    <Icon icon="humbleicons:arrow-left" />
                    Voltar
                </button>

                <span className="legal-eyebrow">
                    {eyebrow}
                </span>

                <h1>
                    {title}
                </h1>

                <p className="legal-subtitle">
                    {subtitle}
                </p>

                <span className="legal-updated">
                    <Icon icon="solar:calendar-outline" />
                    Última atualização: {updatedAt}
                </span>

            </header>


            {notice && (

                <div className="legal-notice">

                    <Icon icon="solar:danger-triangle-outline" />

                    <div>
                        <strong>
                            {notice.title}
                        </strong>
                        <span>
                            {notice.text}
                        </span>
                    </div>

                </div>

            )}


            {/* =================================================
                SUMÁRIO
            ================================================= */}

            <nav className="legal-toc" aria-label="Sumário">

                <span>
                    Nesta página
                </span>

                <ol>
                    {sections.map((section, index) => (
                        <li key={section.id}>
                            <a href={`#${section.id}`}>
                                <em>
                                    {String(index + 1).padStart(2, "0")}
                                </em>
                                {section.title}
                            </a>
                        </li>
                    ))}
                </ol>

            </nav>


            {/* =================================================
                SEÇÕES
            ================================================= */}

            <div className="legal-content">

                {sections.map((section, index) => (

                    <section
                        key={section.id}
                        id={section.id}
                        className="legal-section"
                    >

                        <h2>
                            <em>
                                {String(index + 1).padStart(2, "0")}
                            </em>
                            {section.title}
                        </h2>

                        {section.blocks.map((block, blockIndex) => (
                            <Block
                                key={blockIndex}
                                block={block}
                            />
                        ))}

                    </section>

                ))}

            </div>


            <footer className="legal-footer">

                <span>
                    © {new Date().getFullYear()} Markfy
                </span>

                <div>
                    <a href="/privacidade">
                        Privacidade
                    </a>
                    <a href="/termos">
                        Termos de uso
                    </a>
                </div>

            </footer>

        </main>

    );

};


export default LegalPage;
