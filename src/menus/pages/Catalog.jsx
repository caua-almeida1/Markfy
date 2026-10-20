import React, { useMemo, useState } from "react";
import { Icon } from "@iconify/react";

import { Badge, Button, ConfirmDialog, EmptyState, Field, Segmented, Sheet, Switch } from "../../design-system/components";
import { formatBRL } from "../engine/money.js";
import { fromPriceCents, GROUP_KINDS, hasVariablePrice, productAvailability } from "../engine/pricing.js";
import { useMenus } from "../MenusContext.jsx";
import { listCategories, listGroups, listMenus, listProducts } from "../data/selectors.js";
import { catalogApi, moveInList } from "../catalog/catalogApi.js";
import ProductEditor, { blankProduct, Thumb } from "../catalog/ProductEditor.jsx";
import GroupEditor, { blankGroup } from "../catalog/GroupEditor.jsx";
import { PageHead, Panel } from "../ui.jsx";

/* =========================================================
   CARDÁPIOS E PRODUTOS

   Empresa → Cardápios → Categorias → Produtos → Grupos de
   opções. A disponibilidade muda num toque, sem excluir
   nada. A ordem muda arrastando (mouse ou toque) ou pelos
   botões ↑ ↓ (teclado e leitor de tela).
========================================================= */

const normalize = (value) => String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/* Lista reordenável: arrastar com mouse/toque ou usar os botões. */
const useDragOrder = (ids, onCommit) => {
    const [dragging, setDragging] = useState(null);
    const [over, setOver] = useState(null);

    const props = (id) => ({
        draggable: true,
        onDragStart: (event) => {
            setDragging(id);
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", id);
        },
        onDragOver: (event) => {
            if (!dragging) return;
            event.preventDefault();
            if (over !== id) setOver(id);
        },
        onDragEnd: () => {
            setDragging(null);
            setOver(null);
        },
        onDrop: (event) => {
            event.preventDefault();
            if (dragging && dragging !== id) {
                onCommit(moveInList(ids, ids.indexOf(dragging), ids.indexOf(id)));
            }
            setDragging(null);
            setOver(null);
        },
        "data-dragging": dragging === id || undefined,
        "data-over": over === id && dragging !== id ? true : undefined
    });

    const move = (id, delta) => {
        const index = ids.indexOf(id);
        const target = index + delta;
        if (index < 0 || target < 0 || target >= ids.length) return;
        onCommit(moveInList(ids, index, target));
    };

    return { props, move };
};

const ProductRow = ({ product, groups, canEdit, canAvailability, onEdit, onDuplicate, onToggle, drag, first, last, onMove, settings }) => {
    const availability = productAvailability(product, { tz: settings.timezone });
    const price = hasVariablePrice(product, groups) ? `a partir de ${formatBRL(fromPriceCents(product, groups))}` : formatBRL(product.promoPriceCents && product.promoPriceCents < product.priceCents ? product.promoPriceCents : product.priceCents);

    return (
        <li className="mnu-prow" {...(canEdit ? drag : {})}>
            {canEdit && (
                <span className="mnu-grip" aria-hidden="true" title="Arraste para reordenar"><Icon icon="solar:hamburger-menu-linear" /></span>
            )}
            <Thumb src={product.image} name={product.name} />
            <button type="button" className="mnu-prow__main" onClick={onEdit}>
                <b>{product.name}</b>
                <small>
                    {price}
                    {(product.optionGroupIds || []).length > 0 && ` · ${(product.optionGroupIds || []).length} grupo(s) de opções`}
                    {product.sku ? ` · ${product.sku}` : ""}
                </small>
                <span className="mnu-prow__tags">
                    {product.published === false && <Badge>Rascunho</Badge>}
                    {product.soldOut && <Badge tone="danger">Esgotado (estoque)</Badge>}
                    {!availability.ok && product.available !== false && !product.soldOut && product.published !== false && <Badge tone="warning">{availability.reason.replace(/\.$/, "")}</Badge>}
                    {product.tags?.featured && <Badge tone="info" plain>Destaque</Badge>}
                    {!product.image && <Badge plain>Sem foto</Badge>}
                </span>
            </button>
            <span className="mnu-prow__side">
                <span className="mnu-avail">
                    <small>{product.available === false ? "Indisponível" : "Disponível"}</small>
                    <Switch checked={product.available !== false} onChange={onToggle} disabled={!canAvailability} label={`Disponibilidade de ${product.name}`} />
                </span>
                {canEdit && (
                    <span className="mnu-prow__actions">
                        <Button size="sm" variant="ghost" icon="solar:alt-arrow-up-linear" aria-label="Mover para cima" disabled={first} onClick={() => onMove(-1)} />
                        <Button size="sm" variant="ghost" icon="solar:alt-arrow-down-linear" aria-label="Mover para baixo" disabled={last} onClick={() => onMove(1)} />
                        <Button size="sm" variant="ghost" icon="solar:copy-linear" aria-label={`Duplicar ${product.name}`} onClick={onDuplicate} />
                    </span>
                )}
            </span>
        </li>
    );
};

const CategoryBlock = ({ category, products, groups, api, canEdit, canAvailability, onEditProduct, onNewProduct, onEditCategory, drag, first, last, onMove, settings }) => {
    const ids = products.map((product) => product.id);
    const order = useDragOrder(ids, (next) => api.reorder("products", next));

    return (
        <section className="mnu-cat" {...(canEdit ? drag : {})}>
            <header className="mnu-cat__head">
                {canEdit && <span className="mnu-grip" aria-hidden="true"><Icon icon="solar:hamburger-menu-linear" /></span>}
                <span className="mnu-cat__icon" aria-hidden="true">{category.icon || category.name.charAt(0)}</span>
                <div className="mnu-cat__title">
                    <h2>{category.name}</h2>
                    <small>{products.length} produto(s){category.active === false ? " · oculta no cardápio" : ""}</small>
                </div>
                {canEdit && (
                    <span className="mnu-row">
                        <Button size="sm" variant="ghost" icon="solar:alt-arrow-up-linear" aria-label="Mover categoria para cima" disabled={first} onClick={() => onMove(-1)} />
                        <Button size="sm" variant="ghost" icon="solar:alt-arrow-down-linear" aria-label="Mover categoria para baixo" disabled={last} onClick={() => onMove(1)} />
                        <Button size="sm" variant="ghost" icon="solar:pen-linear" onClick={onEditCategory}>Editar</Button>
                        <Button size="sm" variant="outline" icon="solar:add-circle-linear" onClick={onNewProduct}>Produto</Button>
                    </span>
                )}
            </header>
            {products.length ? (
                <ul className="mnu-plist">
                    {products.map((product, index) => (
                        <ProductRow
                            key={product.id}
                            product={product}
                            groups={groups}
                            settings={settings}
                            canEdit={canEdit}
                            canAvailability={canAvailability}
                            drag={order.props(product.id)}
                            first={index === 0}
                            last={index === products.length - 1}
                            onMove={(delta) => order.move(product.id, delta)}
                            onEdit={() => onEditProduct(product)}
                            onDuplicate={() => onEditProduct({ ...product, id: null, name: `${product.name} (cópia)` }, true)}
                            onToggle={(value) => api.setAvailable(product.id, value)}
                        />
                    ))}
                </ul>
            ) : (
                <p className="mnu-cat__empty">Nenhum produto ainda.{canEdit && " Use “Produto” para adicionar o primeiro."}</p>
            )}
        </section>
    );
};

export default function Catalog() {
    const { catalog, source, user, can, settings, notify } = useMenus();
    const api = useMemo(() => catalogApi(source, user), [source, user]);

    const canEdit = can("catalog.edit");
    const canAvailability = can("catalog.availability") || canEdit;

    const menus = listMenus(catalog);
    const [tab, setTab] = useState("products");
    const [menuId, setMenuId] = useState(null);
    const currentMenu = menus.find((menu) => menu.id === menuId) || menus[0] || null;
    const categories = listCategories(catalog, currentMenu?.id);
    const allCategories = listCategories(catalog).map((category) => ({ ...category, menuName: menus.length > 1 ? menus.find((menu) => menu.id === category.menuId)?.name : null }));
    const allProducts = listProducts(catalog);
    const groups = listGroups(catalog);
    const groupsMap = catalog.optionGroups || {};

    const [query, setQuery] = useState("");
    const [editing, setEditing] = useState(null);
    const [groupEditing, setGroupEditing] = useState(null);
    const [categoryEditing, setCategoryEditing] = useState(null);
    const [menuEditing, setMenuEditing] = useState(null);
    const [confirm, setConfirm] = useState(null);

    const catOrder = useDragOrder(categories.map((category) => category.id), (next) => api.reorder("categories", next));

    const filtered = (categoryId) =>
        listProducts(catalog, categoryId).filter((product) => !query || normalize(`${product.name} ${product.description} ${product.sku}`).includes(normalize(query)));

    const saveProduct = async (data) => {
        const id = editing.id || api.newId();
        const previous = editing.id ? catalog.products?.[editing.id] : null;
        const order = editing.id ? data.order ?? 0 : listProducts(catalog, data.categoryId).length;
        const { id: _drop, ...rest } = data;
        await api.saveProduct(id, { ...rest, order }, previous);
        notify("success", editing.id ? "Produto salvo" : "Produto criado", rest.name);
    };

    const ensureMenu = async () => {
        if (currentMenu) return currentMenu.id;
        const id = api.newId();
        await api.saveMenu(id, { name: "Cardápio principal", order: 0, active: true });
        setMenuId(id);
        return id;
    };

    const counts = {
        products: allProducts.length,
        unavailable: allProducts.filter((product) => product.available === false || product.soldOut).length
    };

    return (
        <div className="std-page">
            <PageHead
                title="Cardápios e produtos"
                description={`${counts.products} produto(s) em ${allCategories.length} categoria(s)${counts.unavailable ? ` · ${counts.unavailable} indisponível(is) agora` : ""}.`}
                actions={canEdit && (
                    <>
                        <Button icon="solar:folder-with-files-linear" onClick={async () => setCategoryEditing({ id: null, data: { name: "", description: "", icon: "", menuId: await ensureMenu(), active: true } })}>Nova categoria</Button>
                        <Button
                            variant="primary"
                            icon="solar:add-circle-linear"
                            disabled={!allCategories.length}
                            title={allCategories.length ? undefined : "Crie uma categoria primeiro"}
                            onClick={() => setEditing({ id: null, data: blankProduct(categories[0]?.id || allCategories[0]?.id) })}
                        >
                            Novo produto
                        </Button>
                    </>
                )}
            />

            <div className="mnu-toolbar">
                <Segmented
                    label="Seção"
                    value={tab}
                    onChange={setTab}
                    options={[
                        { value: "products", label: "Produtos", icon: "solar:document-text-linear" },
                        { value: "groups", label: "Adicionais e sabores", icon: "solar:layers-minimalistic-linear" },
                        { value: "menus", label: "Cardápios", icon: "solar:book-2-linear" }
                    ]}
                />
                {tab === "products" && (
                    <label className="mk-input-group mnu-search">
                        <Icon icon="solar:magnifer-linear" aria-hidden="true" />
                        <input className="mk-input" type="search" placeholder="Buscar produto ou código" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Buscar produto" />
                    </label>
                )}
            </div>

            {tab === "products" && (
                <>
                    {menus.length > 1 && (
                        <div className="mnu-chips" role="group" aria-label="Cardápio">
                            {menus.map((menu) => (
                                <button key={menu.id} type="button" className="mk-chip" aria-pressed={currentMenu?.id === menu.id} onClick={() => setMenuId(menu.id)}>
                                    {menu.name}
                                    {menu.active === false && <small> · oculto</small>}
                                </button>
                            ))}
                        </div>
                    )}

                    {!categories.length ? (
                        <Panel>
                            <EmptyState
                                icon="solar:folder-with-files-linear"
                                title="Comece pelas categorias"
                                action={canEdit && <Button variant="primary" onClick={async () => setCategoryEditing({ id: null, data: { name: "", icon: "", menuId: await ensureMenu(), active: true } })}>Criar a primeira categoria</Button>}
                            >
                                Categorias organizam o cardápio: Entradas, Pizzas, Bebidas, Sobremesas…
                            </EmptyState>
                        </Panel>
                    ) : (
                        <div className="mnu-cats">
                            {categories.map((category, index) => {
                                const products = filtered(category.id);
                                if (query && !products.length) return null;
                                return (
                                    <CategoryBlock
                                        key={category.id}
                                        category={category}
                                        products={products}
                                        groups={groupsMap}
                                        settings={settings}
                                        api={api}
                                        canEdit={canEdit && !query}
                                        canAvailability={canAvailability}
                                        drag={catOrder.props(category.id)}
                                        first={index === 0}
                                        last={index === categories.length - 1}
                                        onMove={(delta) => catOrder.move(category.id, delta)}
                                        onEditCategory={() => setCategoryEditing({ id: category.id, data: { ...category } })}
                                        onNewProduct={() => setEditing({ id: null, data: blankProduct(category.id) })}
                                        onEditProduct={(product, duplicate) => {
                                            const { id, ...data } = product;
                                            setEditing({ id: duplicate ? null : id, data });
                                        }}
                                    />
                                );
                            })}
                        </div>
                    )}
                </>
            )}

            {tab === "groups" && (
                <Panel
                    title="Adicionais, escolhas e sabores"
                    description="Crie uma vez e use em vários produtos. Ex.: Borda recheada, Ponto da carne, Adicionais do burger."
                    actions={canEdit && <Button size="sm" variant="primary" icon="solar:add-circle-linear" onClick={() => setGroupEditing({ id: null, data: blankGroup() })}>Novo grupo</Button>}
                >
                    {!groups.length && <EmptyState icon="solar:layers-minimalistic-linear" title="Nenhum grupo ainda">Grupos deixam o cliente personalizar o pedido com regras claras de mínimo, máximo e preço.</EmptyState>}
                    <ul className="std-list">
                        {groups.map((group) => {
                            const used = allProducts.filter((product) => (product.optionGroupIds || []).includes(group.id)).length;
                            return (
                                <li key={group.id}>
                                    <button type="button" className="std-row" onClick={() => setGroupEditing({ id: group.id, data: { ...group } })} disabled={!canEdit}>
                                        <span className="std-row__icon"><Icon icon={group.kind === "flavor" ? "solar:pizza-linear" : group.kind === "choice" ? "solar:list-check-linear" : "solar:add-square-linear"} /></span>
                                        <span className="std-row__body">
                                            <span className="std-row__title">{group.name}</span>
                                            <span className="std-row__meta">
                                                {GROUP_KINDS[group.kind] || "Adicionais"} · {(group.options || []).map((option) => option.name).slice(0, 5).join(", ")}{(group.options || []).length > 5 ? "…" : ""}
                                            </span>
                                        </span>
                                        <span className="std-row__aside">
                                            <strong>{used}</strong>
                                            produto(s)
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </Panel>
            )}

            {tab === "menus" && (
                <Panel
                    title="Cardápios"
                    description="Almoço, jantar, bebidas, eventos ou sazonais. O cliente alterna entre eles no topo do cardápio."
                    actions={canEdit && <Button size="sm" variant="primary" icon="solar:add-circle-linear" onClick={() => setMenuEditing({ id: null, data: { name: "", description: "", active: true, order: menus.length } })}>Novo cardápio</Button>}
                >
                    {!menus.length && <EmptyState icon="solar:book-2-linear" title="Nenhum cardápio ainda">Ao criar a primeira categoria, o cardápio principal é criado junto.</EmptyState>}
                    <ul className="std-list">
                        {menus.map((menu) => (
                            <li key={menu.id}>
                                <div className="std-row">
                                    <span className="std-row__icon"><Icon icon="solar:book-2-linear" /></span>
                                    <span className="std-row__body">
                                        <span className="std-row__title">{menu.name}</span>
                                        <span className="std-row__meta">{menu.description || "Sem descrição"} · {listCategories(catalog, menu.id).length} categoria(s)</span>
                                    </span>
                                    <span className="mnu-avail">
                                        <small>{menu.active === false ? "Oculto" : "Visível"}</small>
                                        <Switch checked={menu.active !== false} disabled={!canEdit} onChange={(value) => api.saveMenu(menu.id, { ...menu, id: undefined, active: value })} label={`Visibilidade de ${menu.name}`} />
                                    </span>
                                    {canEdit && <Button size="sm" variant="ghost" icon="solar:pen-linear" aria-label={`Editar ${menu.name}`} onClick={() => setMenuEditing({ id: menu.id, data: { ...menu } })} />}
                                </div>
                            </li>
                        ))}
                    </ul>
                </Panel>
            )}

            {editing && (
                <ProductEditor
                    key={editing.id || "new"}
                    open
                    product={editing.data}
                    productId={editing.id}
                    categories={allCategories}
                    groups={groups}
                    onClose={() => setEditing(null)}
                    onSave={saveProduct}
                    onManageGroups={() => {
                        setEditing(null);
                        setTab("groups");
                    }}
                    onDelete={() => setConfirm({
                        title: `Excluir “${editing.data.name}”?`,
                        message: "O produto sai do cardápio e do painel. Pedidos antigos continuam com o registro do que foi vendido. Prefere só esconder? Use “Disponível agora”.",
                        run: async () => {
                            await api.deleteProduct(editing.id, editing.data);
                            setEditing(null);
                            notify("success", "Produto excluído");
                        }
                    })}
                />
            )}

            {groupEditing && (
                <GroupEditor
                    key={groupEditing.id || "new-group"}
                    open
                    group={groupEditing.data}
                    groupId={groupEditing.id}
                    products={allProducts}
                    onClose={() => setGroupEditing(null)}
                    onSave={async (data) => {
                        const { id: _drop, ...rest } = data;
                        await api.saveGroup(groupEditing.id || api.newId(), rest);
                        notify("success", "Grupo salvo", rest.name);
                    }}
                    onDelete={() => setConfirm({
                        title: `Excluir o grupo “${groupEditing.data.name}”?`,
                        message: "Ele será desligado de todos os produtos que o usam.",
                        run: async () => {
                            await api.deleteGroup(groupEditing.id, allProducts);
                            setGroupEditing(null);
                        }
                    })}
                />
            )}

            <Sheet
                open={Boolean(categoryEditing)}
                onClose={() => setCategoryEditing(null)}
                side="center"
                title={categoryEditing?.id ? "Editar categoria" : "Nova categoria"}
                footer={categoryEditing && (
                    <>
                        {categoryEditing.id && (
                            <Button
                                variant="danger"
                                onClick={() => {
                                    const inside = listProducts(catalog, categoryEditing.id);
                                    setConfirm({
                                        title: `Excluir a categoria “${categoryEditing.data.name}”?`,
                                        message: inside.length
                                            ? `Ela tem ${inside.length} produto(s). Mova-os para outra categoria antes de excluir.`
                                            : "A categoria está vazia e pode ser excluída.",
                                        blocked: inside.length > 0,
                                        run: async () => {
                                            await api.deleteCategory(categoryEditing.id);
                                            setCategoryEditing(null);
                                        }
                                    });
                                }}
                            >
                                Excluir
                            </Button>
                        )}
                        <span style={{ flex: 1 }} />
                        <Button variant="ghost" onClick={() => setCategoryEditing(null)}>Cancelar</Button>
                        <Button
                            variant="primary"
                            disabled={!categoryEditing.data.name?.trim()}
                            onClick={async () => {
                                const { id, ...data } = categoryEditing.data;
                                const targetId = categoryEditing.id || api.newId();
                                await api.saveCategory(targetId, { ...data, name: data.name.trim().slice(0, 60), order: categoryEditing.id ? data.order ?? 0 : categories.length });
                                setCategoryEditing(null);
                            }}
                        >
                            Salvar
                        </Button>
                    </>
                )}
            >
                {categoryEditing && (
                    <div className="mnu-form">
                        <Field label="Nome">
                            <input className="mk-input" value={categoryEditing.data.name} maxLength={60} autoFocus onChange={(event) => setCategoryEditing({ ...categoryEditing, data: { ...categoryEditing.data, name: event.target.value } })} />
                        </Field>
                        <Field label="Descrição (opcional)">
                            <input className="mk-input" value={categoryEditing.data.description || ""} maxLength={140} onChange={(event) => setCategoryEditing({ ...categoryEditing, data: { ...categoryEditing.data, description: event.target.value } })} />
                        </Field>
                        <Field label="Ícone (emoji, opcional)" hint="Aparece nos modelos com blocos de categoria.">
                            <input className="mk-input" value={categoryEditing.data.icon || ""} maxLength={4} onChange={(event) => setCategoryEditing({ ...categoryEditing, data: { ...categoryEditing.data, icon: event.target.value } })} />
                        </Field>
                        {menus.length > 1 && (
                            <Field label="Cardápio">
                                <select className="mk-select" value={categoryEditing.data.menuId || ""} onChange={(event) => setCategoryEditing({ ...categoryEditing, data: { ...categoryEditing.data, menuId: event.target.value } })}>
                                    {menus.map((menu) => <option key={menu.id} value={menu.id}>{menu.name}</option>)}
                                </select>
                            </Field>
                        )}
                        <label className="mnu-check">
                            <input type="checkbox" checked={categoryEditing.data.active !== false} onChange={(event) => setCategoryEditing({ ...categoryEditing, data: { ...categoryEditing.data, active: event.target.checked } })} />
                            <span><b>Visível no cardápio</b></span>
                        </label>
                    </div>
                )}
            </Sheet>

            <Sheet
                open={Boolean(menuEditing)}
                onClose={() => setMenuEditing(null)}
                side="center"
                title={menuEditing?.id ? "Editar cardápio" : "Novo cardápio"}
                footer={menuEditing && (
                    <>
                        {menuEditing.id && (
                            <Button
                                variant="danger"
                                onClick={() => {
                                    const inside = listCategories(catalog, menuEditing.id);
                                    setConfirm({
                                        title: `Excluir o cardápio “${menuEditing.data.name}”?`,
                                        message: inside.length ? `Ele tem ${inside.length} categoria(s). Mova-as para outro cardápio antes de excluir.` : "O cardápio está vazio e pode ser excluído.",
                                        blocked: inside.length > 0,
                                        run: async () => {
                                            await api.deleteMenu(menuEditing.id);
                                            setMenuEditing(null);
                                        }
                                    });
                                }}
                            >
                                Excluir
                            </Button>
                        )}
                        <span style={{ flex: 1 }} />
                        <Button variant="ghost" onClick={() => setMenuEditing(null)}>Cancelar</Button>
                        <Button
                            variant="primary"
                            disabled={!menuEditing.data.name?.trim()}
                            onClick={async () => {
                                const { id, ...data } = menuEditing.data;
                                await api.saveMenu(menuEditing.id || api.newId(), { ...data, name: data.name.trim().slice(0, 60) });
                                setMenuEditing(null);
                            }}
                        >
                            Salvar
                        </Button>
                    </>
                )}
            >
                {menuEditing && (
                    <div className="mnu-form">
                        <Field label="Nome"><input className="mk-input" value={menuEditing.data.name} maxLength={60} autoFocus onChange={(event) => setMenuEditing({ ...menuEditing, data: { ...menuEditing.data, name: event.target.value } })} placeholder="Ex.: Almoço executivo" /></Field>
                        <Field label="Quando vale (texto para o cliente)"><input className="mk-input" value={menuEditing.data.description || ""} maxLength={80} onChange={(event) => setMenuEditing({ ...menuEditing, data: { ...menuEditing.data, description: event.target.value } })} placeholder="Ex.: Segunda a sexta, 11h às 15h" /></Field>
                    </div>
                )}
            </Sheet>

            <ConfirmDialog
                open={Boolean(confirm)}
                title={confirm?.title}
                message={confirm?.message}
                confirmLabel={confirm?.blocked ? "Entendi" : "Excluir"}
                tone={confirm?.blocked ? "primary" : "danger"}
                onClose={() => setConfirm(null)}
                onConfirm={async () => {
                    if (!confirm.blocked) await confirm.run();
                    setConfirm(null);
                }}
            />
        </div>
    );
}
