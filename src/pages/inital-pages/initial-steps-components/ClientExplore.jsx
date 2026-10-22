import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { Icon } from "@iconify/react";

import { useCompaniesIndex }
    from "../../../firebase/useCompaniesIndex";

import {
    CATEGORY_GROUPS,
    getCategoryLabel,
    getCompanyCategories
} from "../../../utils/companyCategories";

import CompanyInfoModal
    from "../../users/CompanyInfoModal/CompanyInfoModal";

import "./client-explore.css";


/* =========================================================
   SOU CLIENTE — EXPLORAR

   O outro caminho da configuração inicial ("tenho um
   negócio") abre um passo a passo, porque criar empresa é um
   processo. Aqui não há processo nenhum: quem é cliente só
   precisa achar o negócio e entrar.

   Então esta tela é uma vitrine, não um formulário. Grupo de
   categoria → empresas → entrar. O botão de informações abre
   o mesmo CompanyInfoModal que o app usa, para a pessoa
   conferir endereço e horário antes de escolher.

   Lê de `companiesIndex`, o índice público e leve — o nó
   `companys` traria produtos, agendamentos e pedidos de
   todas as empresas junto.
   ========================================================= */

const ClientExplore = () => {

    const navigate = useNavigate();

    /* Mesma lista (e mesmo critério de elegibilidade) do
       Explorar e da central do usuário. */
    const { companies, loading } = useCompaniesIndex();

    const [selectedGroup, setSelectedGroup] = useState(null);
    const [search, setSearch] = useState("");

    /* Empresa cujo modal de informações está aberto. */
    const [infoCompany, setInfoCompany] = useState(null);



    /* Quantas empresas cada grupo tem — um grupo vazio não
       vira um caminho sem saída. */
    const groups = useMemo(() => {

        return CATEGORY_GROUPS
            .map((group) => {

                const doGrupo = companies.filter(
                    (company) =>
                        getCompanyCategories(company).some(
                            (id) => group.categories.includes(id)
                        )
                );

                return {
                    ...group,
                    companies: doGrupo
                };

            })
            .filter((group) => group.companies.length > 0);

    }, [companies]);


    const visibleCompanies = useMemo(() => {

        const base = selectedGroup
            ? selectedGroup.companies
            : companies;

        const termo = search.trim().toLowerCase();

        if (!termo) {
            return base;
        }

        return base.filter(
            (company) =>
                (company.name || "")
                    .toLowerCase()
                    .includes(termo) ||
                (company.handle || "")
                    .toLowerCase()
                    .includes(termo)
        );

    }, [companies, selectedGroup, search]);


    const entrarNaEmpresa = (handle) =>
        navigate(`/central-user/${handle}`);


    return (
        <section className="client-explore">

            {/* INTRO */}

            <div className="client-explore-intro">

                <span className="client-explore-overline">
                    ENCONTRE UM NEGÓCIO
                </span>

                <h1>
                    O que você está procurando?
                </h1>

                <p>
                    Escolha uma categoria ou busque pelo nome.
                    Você pode ver os detalhes antes de entrar.
                </p>

            </div>


            {/* BUSCA */}

            <div className="client-explore-search">

                <Icon icon="solar:magnifer-outline" />

                <input
                    type="text"
                    placeholder="Buscar por nome ou @"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />

                {search && (
                    <button
                        type="button"
                        onClick={() => setSearch("")}
                        aria-label="Limpar busca"
                    >
                        <Icon icon="solar:close-circle-outline" />
                    </button>
                )}

            </div>


            {/* CARREGANDO */}

            {loading ? (

                <div className="client-explore-state">
                    <Icon icon="svg-spinners:ring-resize" />
                    <span>Carregando negócios...</span>
                </div>

            ) : companies.length === 0 ? (

                <div className="client-explore-state">
                    <Icon icon="solar:shop-outline" />
                    <strong>Nenhum negócio por aqui ainda</strong>
                    <span>
                        Assim que um negócio se cadastrar, ele
                        aparece nesta lista.
                    </span>
                </div>

            ) : (

                <>

                    {/* CATEGORIAS */}

                    {!search && (

                        <div className="client-explore-groups">

                            <button
                                type="button"
                                className={`client-explore-group ${!selectedGroup ? "is-active" : ""
                                    }`}
                                onClick={() => setSelectedGroup(null)}
                            >
                                <Icon icon="solar:widget-4-linear" />
                                <span>Todos</span>
                            </button>

                            {groups.map((group) => (

                                <button
                                    key={group.id}
                                    type="button"
                                    className={`client-explore-group ${selectedGroup?.id === group.id
                                        ? "is-active"
                                        : ""
                                        }`}
                                    onClick={() =>
                                        setSelectedGroup(
                                            selectedGroup?.id === group.id
                                                ? null
                                                : group
                                        )
                                    }
                                >
                                    <Icon icon={group.icon} />
                                    <span>{group.name}</span>
                                    <small>{group.companies.length}</small>
                                </button>

                            ))}

                        </div>

                    )}


                    {/* EMPRESAS */}

                    {visibleCompanies.length === 0 ? (

                        <div className="client-explore-state">
                            <Icon icon="solar:magnifer-outline" />
                            <strong>Nada encontrado</strong>
                            <span>
                                Tente outro nome ou volte para
                                "Todos".
                            </span>
                        </div>

                    ) : (

                        <div className="client-explore-list">

                            {visibleCompanies.map((company) => (

                                <article
                                    key={company.handle}
                                    className="client-explore-card"
                                >

                                    <div className="client-explore-card-logo">

                                        {company.logoUrl ? (
                                            <img
                                                src={company.logoUrl}
                                                alt={company.name || company.handle}
                                            />
                                        ) : (
                                            <Icon icon="solar:shop-2-bold" />
                                        )}

                                    </div>

                                    <div className="client-explore-card-text">

                                        <strong>
                                            {company.name || company.handle}
                                        </strong>

                                        <span className="client-explore-card-handle">
                                            @{company.handle}
                                        </span>

                                        {getCompanyCategories(company).length > 0 && (
                                            <span className="client-explore-card-tags">
                                                {getCompanyCategories(company)
                                                    .slice(0, 2)
                                                    .map(getCategoryLabel)
                                                    .join(" · ")}
                                            </span>
                                        )}

                                    </div>

                                    <div className="client-explore-card-actions">

                                        <button
                                            type="button"
                                            className="client-explore-info"
                                            onClick={() => setInfoCompany(company)}
                                            aria-label={`Informações de ${company.name || company.handle}`}
                                        >
                                            <Icon icon="solar:info-circle-outline" />
                                        </button>

                                        <button
                                            type="button"
                                            className="client-explore-enter"
                                            onClick={() =>
                                                entrarNaEmpresa(company.handle)
                                            }
                                        >
                                            Entrar
                                        </button>

                                    </div>

                                </article>

                            ))}

                        </div>

                    )}

                </>

            )}


            {/* INFORMAÇÕES — o mesmo modal do app */}

            <CompanyInfoModal
                isOpen={!!infoCompany}
                companyName={infoCompany?.name}
                companyHandle={infoCompany?.handle}
                companyLogo={infoCompany?.logoUrl}
                onClose={() => setInfoCompany(null)}
            />

        </section>
    );

};


export default ClientExplore;
