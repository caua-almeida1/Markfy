import React, { useMemo, useState } from "react";
import { Icon } from "@iconify/react";

import { Button, Switch } from "../../design-system/components";
import { useMenus } from "../MenusContext.jsx";
import { catalogApi } from "../catalog/catalogApi.js";
import { listCategories, listMenus, listProducts } from "../data/selectors.js";

/* Categorias direto do editor: criar, esconder, reordenar e
   remover as vazias, vendo o efeito na prévia na hora. O
   cadastro completo de produtos fica em Cardápios e produtos. */

export default function CategoriesPanel() {
    const { catalog, source, user, can } = useMenus();
    const api = useMemo(() => catalogApi(source, user), [source, user]);
    const menus = listMenus(catalog);
    const [menuId, setMenuId] = useState(menus[0]?.id || null);
    const [name, setName] = useState("");
    const categories = listCategories(catalog, menuId || menus[0]?.id);
    const canEdit = can("catalog.edit");

    if (!canEdit) return <div className="mne-panel"><p className="mne-hint">Seu perfil não edita categorias.</p></div>;

    const add = async () => {
        let target = menuId || menus[0]?.id;
        if (!target) {
            target = api.newId();
            await api.saveMenu(target, { name: "Cardápio principal", order: 0, active: true });
            setMenuId(target);
        }
        await api.saveCategory(api.newId(), { name: name.trim().slice(0, 60), menuId: target, order: categories.length, active: true });
        setName("");
    };

    const move = (index, delta) => {
        const ids = categories.map((category) => category.id);
        const target = index + delta;
        if (target < 0 || target >= ids.length) return;
        [ids[index], ids[target]] = [ids[target], ids[index]];
        api.reorder("categories", ids);
    };

    return (
        <div className="mne-panel">
            {menus.length > 1 && (
                <select className="mk-select" value={menuId || ""} onChange={(event) => setMenuId(event.target.value)} aria-label="Cardápio">
                    {menus.map((menu) => <option key={menu.id} value={menu.id}>{menu.name}</option>)}
                </select>
            )}
            <form
                className="mnu-row"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (name.trim()) add();
                }}
            >
                <input className="mk-input" placeholder="Nova categoria (ex.: Porções)" value={name} maxLength={60} onChange={(event) => setName(event.target.value)} aria-label="Nome da nova categoria" />
                <Button type="submit" variant="primary" disabled={!name.trim()} icon="solar:add-circle-linear">Criar</Button>
            </form>
            <ul className="mne-cats">
                {categories.map((category, index) => {
                    const count = listProducts(catalog, category.id).length;
                    return (
                        <li key={category.id}>
                            <span className="mne-cats__name">
                                <b>{category.name}</b>
                                <small>{count} produto(s)</small>
                            </span>
                            <Button size="sm" variant="ghost" icon="solar:alt-arrow-up-linear" aria-label="Subir" disabled={index === 0} onClick={() => move(index, -1)} />
                            <Button size="sm" variant="ghost" icon="solar:alt-arrow-down-linear" aria-label="Descer" disabled={index === categories.length - 1} onClick={() => move(index, 1)} />
                            <Switch checked={category.active !== false} label={`Mostrar ${category.name}`} onChange={(value) => api.saveCategory(category.id, { ...category, id: undefined, active: value })} />
                            <Button
                                size="sm"
                                variant="ghost"
                                icon="solar:trash-bin-minimalistic-linear"
                                aria-label={count ? `${category.name} tem produtos e não pode ser removida aqui` : `Remover ${category.name}`}
                                title={count ? "Tem produtos: mova-os antes" : "Remover categoria vazia"}
                                disabled={count > 0}
                                onClick={() => api.deleteCategory(category.id)}
                            />
                        </li>
                    );
                })}
            </ul>
            <p className="mne-hint"><Icon icon="solar:info-circle-linear" aria-hidden="true" /> Categorias com produtos não são removidas daqui, para nada sumir sem querer.</p>
        </div>
    );
}
