import React, { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";

import { useStudio } from "../StudioContext";
import { updateCompany } from "../data/studioApi";
import { formatHours } from "../data/companyBundle";
import { uploadCompanyLogo } from "../../firebase/companyLogo";
import { updateCompanyIndex } from "../../firebase/companiesIndex";
import { isValidPhoneBR, formatPhoneBR } from "../../utils/phoneBR";
import { Badge, Button, Field, Spinner, useToast } from "../../design-system/components";
import { PageHead } from "./shared";
import { useLicense } from "../../plans/LicenseContext";

/* =========================================================
   MINHA EMPRESA

   Os mesmos campos que a Markfy Bookings usa, gravados no
   mesmo lugar (companys/{handle}) e no mesmo formato — o
   que mudar aqui muda na Bookings, na página do Studio e
   no índice público de empresas.

   Endereço e horários têm validações e geocodificação
   próprias no painel da Bookings; aqui eles aparecem para
   conferência, com atalho para editar lá.
========================================================= */

const SOCIALS = [
    { id: "instagram", label: "Instagram", icon: "mdi:instagram", base: "https://instagram.com/" },
    { id: "facebook", label: "Facebook", icon: "mdi:facebook", base: "https://facebook.com/" },
    { id: "tiktok", label: "TikTok", icon: "ic:baseline-tiktok", base: "https://tiktok.com/@" },
    { id: "x", label: "X", icon: "prime:twitter", base: "https://x.com/" },
    { id: "youtube", label: "YouTube", icon: "mdi:youtube", base: "https://youtube.com/@" }
];

const ROLE_LABEL = {
    master: "Responsável",
    administrator: "Administrador",
    professional: "Profissional"
};

const Card = ({ id, title, description, children, footer }) => (
    <section className="std-panel std-card" id={id} aria-labelledby={`${id}-title`}>
        <div className="std-panel__head">
            <div>
                <h2 id={`${id}-title`}>{title}</h2>
                {description && <p>{description}</p>}
            </div>
        </div>
        {children}
        {footer && <div className="std-card__footer">{footer}</div>}
    </section>
);

const useForm = (initial) => {
    const [values, setValues] = useState(initial);
    const [base, setBase] = useState(initial);
    const key = JSON.stringify(initial);

    useEffect(() => {
        setValues(initial);
        setBase(initial);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    return {
        values,
        set: (field) => (event) => setValues((current) => ({ ...current, [field]: event.target.value })),
        setValue: (field, value) => setValues((current) => ({ ...current, [field]: value })),
        dirty: JSON.stringify(values) !== JSON.stringify(base),
        reset: () => setValues(base)
    };
};

const CompanySettings = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const notify = useToast();

    const { handle, company, companyState, bundle, reloadBundle, canEdit } = useStudio();
    const license = useLicense();

    const logoInput = useRef(null);
    const [logoBusy, setLogoBusy] = useState(false);
    const [saving, setSaving] = useState(null);

    const identity = useForm({ name: company?.name || "", description: company?.description || "" });
    const contact = useForm({ phone: company?.phone || "", email: company?.email || "" });
    const social = useForm(
        Object.fromEntries(SOCIALS.map((item) => [item.id, company?.socialMedia?.[item.id]?.handle || ""]))
    );

    useEffect(() => {
        if (!location.hash) return;
        const node = document.getElementById(location.hash.slice(1));
        if (node) setTimeout(() => node.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
    }, [location.hash]);

    const run = async (key, task, message) => {
        setSaving(key);
        try {
            await task();
            /* O UserCompanyContext escuta os campos da empresa
               e se atualiza sozinho; só os dados da página
               precisam ser relidos. */
            reloadBundle();
            notify("success", "Alterações salvas", message);
        } catch (error) {
            console.error(error);
            notify("error", "Não foi possível salvar", "Verifique sua conexão e tente de novo.");
        } finally {
            setSaving(null);
        }
    };

    const saveIdentity = () => {
        const name = identity.values.name.trim();
        if (name.length < 2) {
            notify("error", "Nome muito curto", "Use pelo menos 2 letras.");
            return;
        }
        run("identity", async () => {
            const description = identity.values.description.trim();
            await updateCompany(handle, { name, description });
            await updateCompanyIndex(handle, { name, description });
        }, "Nome e descrição atualizados na Markfy.");
    };

    const phoneError = contact.values.phone && !isValidPhoneBR(contact.values.phone) ? "Use DDD e número, como (11) 91234-5678." : null;
    const emailError = contact.values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.values.email) ? "E-mail inválido." : null;

    const saveContact = () => {
        if (phoneError || emailError) return;
        run("contact", () => updateCompany(handle, { phone: contact.values.phone.replace(/\D/g, ""), email: contact.values.email.trim() }), "O botão de WhatsApp da página usa este número.");
    };

    const saveSocial = () =>
        run("social", () =>
            updateCompany(handle, {
                socialMedia: Object.fromEntries(
                    SOCIALS.map((item) => {
                        const value = social.values[item.id].trim().replace(/^@/, "").replace(/^https?:\/\/[^/]+\/@?/i, "");
                        return [item.id, { handle: value, link: value ? `${item.base}${value}` : "" }];
                    })
                )
            }), "As redes aparecem na seção de contato da página.");

    const onLogo = (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;

        if (!file.type.startsWith("image/")) {
            notify("error", "Arquivo inválido", "Escolha uma imagem PNG, JPG ou WEBP.");
            return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
            setLogoBusy(true);
            try {
                const url = await uploadCompanyLogo(handle, reader.result);
                await updateCompany(handle, { logoPreview: null });
                await updateCompanyIndex(handle, { logoUrl: url });
                reloadBundle();
                notify("success", "Logotipo atualizado", "Ele já aparece na Bookings e na sua página.");
            } catch (error) {
                console.error(error);
                notify("error", "Não foi possível enviar o logotipo", "Tente outra imagem ou verifique a conexão.");
            } finally {
                setLogoBusy(false);
            }
        };
        reader.readAsDataURL(file);
    };

    const hours = formatHours(bundle?.businessHours);
    const members = companyState.members || [];

    return (
        <div className="std-page">
            <PageHead
                title="Minha empresa"
                description="Dados usados pela sua página, pela Markfy Bookings e pela busca de empresas. Atualize aqui uma vez e tudo acompanha."
            />

            <button type="button" className="std-plan-link" onClick={() => navigate("/studio/plano")}>
                <Icon icon="solar:cup-star-bold" aria-hidden="true" />
                <span>
                    <strong>{license.active && license.plan ? `Plano ${license.plan.name}` : "Sem plano ativo"}</strong>
                    <small>Gerenciar plano e assinatura</small>
                </span>
                <Icon icon="solar:alt-arrow-right-linear" aria-hidden="true" />
            </button>

            {!canEdit && <p className="std-hint">Seu acesso é de profissional: você pode ver estes dados, mas só o responsável altera.</p>}

            <fieldset className="std-fieldset" disabled={!canEdit}>
                <Card id="logo" title="Logotipo" description="Quadrado, de preferência com fundo. Aparece no topo da página e nos resultados da Markfy.">
                    <div className="std-logo">
                        <span className="std-logo__img">
                            {logoBusy ? <Spinner /> : bundle?.logo ? <img src={bundle.logo} alt="Logotipo atual" /> : <Icon icon="solar:gallery-add-linear" />}
                        </span>
                        <div className="std-logo__actions">
                            <Button variant="secondary" icon="solar:upload-linear" onClick={() => logoInput.current?.click()} loading={logoBusy}>
                                {bundle?.logo ? "Trocar logotipo" : "Enviar logotipo"}
                            </Button>
                            <p className="std-hint">PNG, JPG ou WEBP. Reduzimos o arquivo automaticamente.</p>
                        </div>
                        <input ref={logoInput} type="file" accept="image/*" hidden onChange={onLogo} />
                    </div>
                </Card>

                <Card
                    id="descricao"
                    title="Nome e descrição"
                    footer={identity.dirty && (
                        <>
                            <Button variant="ghost" onClick={identity.reset}>Descartar</Button>
                            <Button variant="primary" loading={saving === "identity"} onClick={saveIdentity}>Salvar</Button>
                        </>
                    )}
                >
                    <Field label="Nome da empresa" count={identity.values.name.length} max={60}>
                        <input className="mk-input" value={identity.values.name} maxLength={60} onChange={identity.set("name")} />
                    </Field>
                    <Field label="Descrição" count={identity.values.description.length} max={600} hint="Conte o que vocês fazem, para quem e onde. Usada na busca e no “Sobre” da página.">
                        <textarea className="mk-textarea" rows={5} maxLength={600} value={identity.values.description} onChange={identity.set("description")} />
                    </Field>
                    <p className="std-hint">Endereço público da empresa: @{handle}. Para mudar, use as configurações da empresa na Bookings.</p>
                </Card>

                <Card
                    id="contato"
                    title="Contato"
                    description="O telefone vira o botão de WhatsApp da página, a menos que a integração do WhatsApp esteja ativa na Bookings."
                    footer={contact.dirty && (
                        <>
                            <Button variant="ghost" onClick={contact.reset}>Descartar</Button>
                            <Button variant="primary" loading={saving === "contact"} disabled={!!phoneError || !!emailError} onClick={saveContact}>Salvar</Button>
                        </>
                    )}
                >
                    <div className="std-grid std-grid--2">
                        <Field label="Telefone ou WhatsApp" error={phoneError}>
                            <input
                                className="mk-input"
                                inputMode="tel"
                                value={contact.values.phone}
                                onChange={contact.set("phone")}
                                onBlur={() => !phoneError && contact.values.phone && contact.setValue("phone", formatPhoneBR(contact.values.phone))}
                                placeholder="(11) 91234-5678"
                            />
                        </Field>
                        <Field label="E-mail comercial" error={emailError}>
                            <input className="mk-input" type="email" value={contact.values.email} onChange={contact.set("email")} />
                        </Field>
                    </div>
                    {bundle?.whatsapp && <Badge tone="success">WhatsApp da página: {formatPhoneBR(bundle.whatsapp)}</Badge>}
                </Card>

                <Card
                    id="redes"
                    title="Redes sociais"
                    description="Só o nome de usuário, sem @. Aparecem na seção de contato e de redes da página."
                    footer={social.dirty && (
                        <>
                            <Button variant="ghost" onClick={social.reset}>Descartar</Button>
                            <Button variant="primary" loading={saving === "social"} onClick={saveSocial}>Salvar</Button>
                        </>
                    )}
                >
                    <div className="std-socials">
                        {SOCIALS.map((item) => (
                            <label key={item.id} className="std-social">
                                <Icon icon={item.icon} aria-hidden="true" />
                                <span className="mk-visually-hidden">{item.label}</span>
                                <span className="std-social__base">{item.base.replace(/^https:\/\//, "")}</span>
                                <input className="mk-input" value={social.values[item.id]} onChange={social.set(item.id)} placeholder="usuario" aria-label={item.label} />
                            </label>
                        ))}
                    </div>
                </Card>
            </fieldset>

            <div className="std-grid std-grid--2">
                <Card id="endereco" title="Endereço" description="Usado no mapa da página e na busca por proximidade.">
                    <p className="std-value">{bundle?.address || "Nenhum endereço cadastrado."}</p>
                    <Button variant="outline" size="sm" iconRight="solar:arrow-right-up-linear" onClick={() => navigate("/central-adm?tab=perfil&screen=settings-location")}>
                        {bundle?.address ? "Editar na Bookings" : "Cadastrar na Bookings"}
                    </Button>
                </Card>

                <Card id="horarios" title="Horário de funcionamento" description="O mesmo da agenda: a página mostra exatamente o que a Bookings usa.">
                    {bundle?.businessHours ? (
                        <ul className="std-hours">
                            {hours.map((day) => (
                                <li key={day.id}><span>{day.label}</span><span>{day.text}</span></li>
                            ))}
                        </ul>
                    ) : (
                        <p className="std-value">Nenhum horário definido.</p>
                    )}
                    <Button variant="outline" size="sm" iconRight="solar:arrow-right-up-linear" onClick={() => navigate("/central-adm?tab=perfil&screen=settings-hours")}>
                        Editar na Bookings
                    </Button>
                </Card>
            </div>

            <Card id="equipe" title="Equipe e permissões" description="Quem faz parte da empresa e o que cada um pode fazer no Studio.">
                <ul className="std-list">
                    {members.map((member) => (
                        <li key={member.uid}>
                            <div className="std-row">
                                <span className="std-row__icon" aria-hidden="true">{(member.name || "?").charAt(0).toUpperCase()}</span>
                                <span className="std-row__body">
                                    <span className="std-row__title">{member.name || member.email}</span>
                                    <span className="std-row__meta">{member.email}</span>
                                </span>
                                <span className="std-row__badges">
                                    <Badge tone={member.role === "professional" ? undefined : "info"}>{ROLE_LABEL[member.role] || "Membro"}</Badge>
                                </span>
                            </div>
                        </li>
                    ))}
                    {!members.length && <li className="std-hint">Carregando equipe…</li>}
                </ul>
                <div className="std-perms">
                    <div>
                        <strong>Responsável e administradores</strong>
                        <span>Editam a página, publicam, mudam dados da empresa e atendem contatos.</span>
                    </div>
                    <div>
                        <strong>Profissionais</strong>
                        <span>Veem a página, os agendamentos, os contatos e as métricas, sem alterar nada.</span>
                    </div>
                </div>
                <Button variant="outline" size="sm" iconRight="solar:arrow-right-up-linear" onClick={() => navigate("/central-adm")}>
                    Convidar ou remover membros na Bookings
                </Button>
            </Card>
        </div>
    );
};

export default CompanySettings;
