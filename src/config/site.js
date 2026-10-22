/* =========================================================
   DADOS PÚBLICOS DO SITE

   Um lugar só para URL, nome e contatos oficiais. Valores
   sensíveis a ambiente vêm de variáveis REACT_APP_* (Vercel →
   Settings → Environment Variables).

   ATENÇÃO: markfy.app NÃO é da Markfy (é outro produto, um
   revisor de markdown). Telas antigas mostravam
   "markfy.app/..." como se fosse o endereço do cliente; o
   endereço exibido agora sai daqui.
========================================================= */

export const SITE_URL = (
    process.env.REACT_APP_SITE_URL || "https://markfy.vercel.app"
).replace(/\/+$/, "");

export const SITE_HOST = SITE_URL.replace(/^https?:\/\//, "");

export const SITE_NAME = "Markfy";

export const DEFAULT_TITLE =
    "Markfy — agendamento online, site e cardápio digital para pequenos negócios";

export const DEFAULT_DESCRIPTION =
    "Plataforma brasileira para negócios de serviço e alimentação: agenda online com página pública (Bookings), site da empresa (Studio) e cardápio digital com pedidos (Menus).";

/* Imagem de compartilhamento (1200×630) em public/. */
export const OG_IMAGE = `${SITE_URL}/og-markfy.png`;

/* E-mail oficial já publicado na Política de Privacidade e nos Termos. */
export const CONTACT_EMAIL = "markfy.suporte@gmail.com";

/* WhatsApp oficial, só com dígitos e DDI (ex.: 5511999999999).
   Sem número configurado, o botão de WhatsApp não aparece —
   nunca usar um número inventado. */
export const WHATSAPP_NUMBER = (process.env.REACT_APP_WHATSAPP_NUMBER || "").replace(/\D/g, "");

export const whatsappUrl = (message = "") =>
    WHATSAPP_NUMBER
        ? `https://wa.me/${WHATSAPP_NUMBER}${message ? `?text=${encodeURIComponent(message)}` : ""}`
        : null;
