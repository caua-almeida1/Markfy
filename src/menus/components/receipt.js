import { formatBRL } from "../engine/money.js";
import { describeLine } from "../engine/pricing.js";
import { PAYMENT_METHODS } from "../engine/orders.js";
import { entries } from "../engine/util.js";

/* =========================================================
   COMPROVANTES PARA IMPRESSÃO

   Abre uma janela só com o comprovante (largura de bobina
   de 80 mm) e chama a impressão do navegador — funciona com
   impressoras térmicas instaladas no computador. Não é cupom
   fiscal: o texto deixa isso explícito.
========================================================= */

const escape = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

const STYLE = `
*{box-sizing:border-box}body{margin:0;padding:12px;font:13px/1.4 "Courier New",monospace;color:#000;width:80mm}
h1{font-size:16px;margin:0 0 4px;text-align:center}p{margin:0}.c{text-align:center}.m{margin:8px 0}
table{width:100%;border-collapse:collapse}td{padding:2px 0;vertical-align:top}td.r{text-align:right;white-space:nowrap;padding-left:8px}
.s{color:#333;font-size:11px}.t td{font-weight:bold;font-size:14px;border-top:1px dashed #000;padding-top:4px}hr{border:0;border-top:1px dashed #000;margin:8px 0}
.x{text-decoration:line-through;color:#555}@media print{body{padding:0}}`;

export const openPrint = (title, body) => {
    const win = window.open("", "_blank", "width=420,height=640");
    if (!win) return false;
    win.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escape(title)}</title><style>${STYLE}</style></head><body>${body}<script>window.onload=function(){window.print();}</script></body></html>`);
    win.document.close();
    return true;
};

const lineRows = (items) =>
    items
        .map((item) => {
            const detail = describeLine(item);
            const cancelled = item.status === "cancelled";
            return `<tr class="${cancelled ? "x" : ""}"><td>${escape(item.qty)}× ${escape(item.name)}${detail ? `<br><span class="s">${escape(detail)}</span>` : ""}${item.notes ? `<br><span class="s">Obs.: ${escape(item.notes)}</span>` : ""}${item.person ? `<br><span class="s">${escape(item.person)}</span>` : ""}</td><td class="r">${cancelled ? "cancelado" : formatBRL((item.unitCents || 0) * (item.qty || 0))}</td></tr>`;
        })
        .join("");

export const printTab = ({ tab, companyName }) => {
    const totals = tab.totals || {};
    const items = entries(tab.items);
    const payments = entries(tab.payments);
    const body = `
<h1>${escape(companyName || "")}</h1>
<p class="c">${escape(tab.label || "Comanda")} · ${new Date().toLocaleString("pt-BR")}</p>
<p class="c s">Conferência de conta — não é documento fiscal</p><hr>
<table>${lineRows(items)}</table><hr>
<table>
<tr><td>Itens</td><td class="r">${formatBRL(totals.itemsCents)}</td></tr>
${totals.discountCents ? `<tr><td>Descontos</td><td class="r">-${formatBRL(totals.discountCents)}</td></tr>` : ""}
${totals.serviceCents ? `<tr><td>Taxa de serviço</td><td class="r">${formatBRL(totals.serviceCents)}</td></tr>` : ""}
<tr class="t"><td>Total</td><td class="r">${formatBRL(totals.totalCents)}</td></tr>
${payments.map((payment) => `<tr class="${payment.status === "refunded" ? "x" : ""}"><td>${escape(PAYMENT_METHODS[payment.method]?.label || payment.method)}${payment.person ? ` (${escape(payment.person)})` : ""}</td><td class="r">${formatBRL(payment.amountCents)}</td></tr>`).join("")}
${totals.paidCents ? `<tr><td>Saldo</td><td class="r">${formatBRL(totals.balanceCents)}</td></tr>` : ""}
</table>
${tab.guests ? `<p class="m s">${escape(tab.guests)} pessoa(s) · ${formatBRL(Math.ceil((totals.totalCents || 0) / tab.guests))} por pessoa</p>` : ""}
<hr><p class="c s">Obrigado pela preferência!</p>`;
    return openPrint(`Conta ${tab.label || ""}`, body);
};

export const printOrder = ({ order, companyName, kitchen = false }) => {
    const items = (order.items || []).filter((item) => !kitchen || item.status !== "cancelled");
    const body = `
<h1>${kitchen ? "COZINHA" : escape(companyName || "")}</h1>
<p class="c"><b>Pedido #${escape(order.code)}</b> · ${new Date(order.createdAt).toLocaleString("pt-BR")}</p>
<p class="c">${escape(order.tableLabel || order.customer?.name || "")} ${order.fulfillment?.mode === "delivery" ? "· ENTREGA" : order.fulfillment?.mode === "pickup" ? "· RETIRADA" : ""}</p><hr>
<table>${lineRows(items)}</table>
${order.notes ? `<hr><p><b>Obs.:</b> ${escape(order.notes)}</p>` : ""}
${!kitchen ? `<hr><table>
<tr><td>Itens</td><td class="r">${formatBRL(order.totals?.subtotalCents)}</td></tr>
${order.totals?.deliveryFeeCents ? `<tr><td>Entrega</td><td class="r">${formatBRL(order.totals.deliveryFeeCents)}</td></tr>` : ""}
<tr class="t"><td>Total</td><td class="r">${formatBRL(order.totals?.totalCents)}</td></tr></table>
${order.fulfillment?.address ? `<p class="m">${escape(order.fulfillment.address)}${order.fulfillment.zoneName ? ` (${escape(order.fulfillment.zoneName)})` : ""}</p>` : ""}
${order.customer?.phone ? `<p>Tel.: ${escape(order.customer.phone)}</p>` : ""}
<p class="m">Pagamento: ${escape(PAYMENT_METHODS[order.payment?.method]?.label || "—")} · ${order.payment?.status === "paid" ? "PAGO" : order.payment?.status === "tab" ? "na comanda" : "a receber"}</p>
<p class="c s">Não é documento fiscal</p>` : ""}`;
    return openPrint(`Pedido ${order.code}`, body);
};
