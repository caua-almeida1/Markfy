/* Antes: o teste padrão do create-react-app ("learn react"),
   que nunca passou neste projeto. Agora: o que mudou na
   auditoria e pode ser testado sem Firebase. */

import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import NotFound from "./pages/not-found/NotFound";
import { sanitizePath } from "./analytics/analytics";

test("a página 404 explica o erro, oferece caminhos e pede noindex", () => {

    render(
        <MemoryRouter initialEntries={["/rota-que-nao-existe"]}>
            <NotFound />
        </MemoryRouter>
    );

    expect(screen.getByRole("heading", { name: /página não encontrada/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ir para o início/i })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: /encontrar empresas/i })).toHaveAttribute("href", "/central-user");
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    expect(document.title).toMatch(/Página não encontrada/);
});

test("o Analytics nunca recebe query string nem ids de convite/pedido", () => {

    expect(sanitizePath("/invite/-Nabc123XYZ")).toBe("/invite/:id");
    expect(sanitizePath("/entrar-equipe/abcDEF_123")).toBe("/entrar-equipe/:id");
    expect(sanitizePath("/newcompany/previewcompany/s-1")).toBe("/newcompany/previewcompany/:id");
    expect(sanitizePath("/m/pizzaria/pedido/o-99")).toBe("/m/pizzaria/pedido/:id");
    expect(sanitizePath("/checkout?email=a@b.c")).toBe("/checkout");
    expect(sanitizePath("/central-user/tkbarbearia")).toBe("/central-user/tkbarbearia");
});
