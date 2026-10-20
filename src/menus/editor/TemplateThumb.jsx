import React from "react";

/* Miniatura esquemática de um modelo: mostra a COMPOSIÇÃO
   (topo, navegação e produtos) com as cores do modelo — dá
   para comparar os 16 lado a lado sem renderizar 16 cardápios. */

export default function TemplateThumb({ template, design }) {
    const theme = design?.theme || template.theme;
    const layout = design?.layout || template.layout;
    const c = theme.colors;
    const r = Math.min(10, Math.round((theme.radius || 0) / 2));

    const header = (() => {
        switch (layout.header) {
            case "hero":
                return <><rect x="0" y="0" width="120" height="34" fill={c.primary} /><rect x="0" y="20" width="120" height="14" fill="#000" opacity=".25" /><rect x="8" y="22" width="44" height="5" rx="2" fill="#fff" /></>;
            case "split":
                return <><rect x="8" y="8" width="42" height="5" rx="2" fill={c.text} /><rect x="8" y="16" width="30" height="3" rx="1.5" fill={c.muted} /><rect x="62" y="5" width="50" height="26" rx={r} fill={c.primary} /></>;
            case "banner":
                return <><rect x="0" y="0" width="120" height="20" fill={c.primary} /><rect x="10" y="12" width="100" height="20" rx={r} fill={c.surface} stroke={c.border} /><circle cx="20" cy="22" r="5" fill={c.accent} /><rect x="30" y="19" width="40" height="5" rx="2" fill={c.text} /></>;
            case "centered":
                return <><circle cx="60" cy="11" r="6" fill={c.primary} /><rect x="36" y="20" width="48" height="5" rx="2" fill={c.text} /><rect x="48" y="28" width="24" height="1.5" fill={c.accent} /></>;
            case "board":
                return <><rect x="0" y="0" width="120" height="34" fill="#1f2421" /><rect x="14" y="5" width="92" height="24" rx="3" fill="none" stroke="#fff" strokeDasharray="3 2" opacity=".6" /><rect x="34" y="14" width="52" height="6" rx="2" fill={c.primary} /></>;
            default:
                return <><circle cx="12" cy="12" r="6" fill={c.primary} /><rect x="22" y="9" width="40" height="5" rx="2" fill={c.text} /><rect x="0" y="24" width="120" height="1" fill={c.border} /></>;
        }
    })();

    const nav = (() => {
        const y = 38;
        switch (layout.nav) {
            case "tabs":
                return <><rect x="8" y={y + 2} width="22" height="3" rx="1.5" fill={c.text} /><rect x="8" y={y + 7} width="22" height="1.5" fill={c.primary} /><rect x="36" y={y + 2} width="18" height="3" rx="1.5" fill={c.muted} /><rect x="60" y={y + 2} width="20" height="3" rx="1.5" fill={c.muted} /></>;
            case "sidebar":
                return <>{[0, 1, 2, 3].map((i) => <rect key={i} x="6" y={y + i * 9} width="22" height="6" rx="2" fill={i === 0 ? c.primary : c.surface} stroke={c.border} strokeWidth=".5" />)}</>;
            case "tiles":
                return <>{[0, 1, 2, 3].map((i) => <g key={i}><rect x={8 + i * 27} y={y} width="23" height="16" rx={r} fill={c.surface} stroke={c.border} strokeWidth=".6" /><circle cx={19.5 + i * 27} cy={y + 7} r="3.5" fill={c.secondary} /></g>)}</>;
            case "sections":
                return <><rect x="8" y={y + 2} width="30" height="4" rx="1.5" fill={c.text} /><rect x="42" y={y + 4} width="70" height="1" fill={c.border} /></>;
            default:
                return <>{[0, 1, 2, 3].map((i) => <rect key={i} x={8 + i * 25} y={y} width="21" height="8" rx="4" fill={i === 0 ? c.primary : c.surface} stroke={c.border} strokeWidth=".6" />)}</>;
        }
    })();

    const left = layout.nav === "sidebar" ? 34 : 8;
    const top = layout.nav === "tiles" ? 60 : 52;
    const width = 120 - left - 8;

    const products = (() => {
        switch (layout.products) {
            case "cards": {
                const cols = Math.min(3, Math.max(2, layout.columns || 2));
                const w = (width - (cols - 1) * 4) / cols;
                return [0, 1, 2].slice(0, cols).map((i) => <g key={i}><rect x={left + i * (w + 4)} y={top} width={w} height="34" rx={r} fill={c.surface} stroke={c.border} strokeWidth=".6" /><rect x={left + i * (w + 4)} y={top} width={w} height="18" rx={r} fill={c.secondary} /><rect x={left + 3 + i * (w + 4)} y={top + 22} width={w - 10} height="3" rx="1.5" fill={c.text} /></g>);
            }
            case "photo":
                return <><rect x={left} y={top} width={width} height="40" rx={r} fill={c.primary} opacity=".85" /><rect x={left + 6} y={top + 28} width="40" height="5" rx="2" fill="#fff" /></>;
            case "menu":
                return [0, 1, 2, 3].map((i) => <g key={i}><rect x={left} y={top + i * 10} width="34" height="3.5" rx="1.5" fill={c.text} /><line x1={left + 37} x2={left + width - 18} y1={top + 2 + i * 10} y2={top + 2 + i * 10} stroke={c.muted} strokeDasharray="1 2" /><rect x={left + width - 14} y={top + i * 10} width="14" height="3.5" rx="1.5" fill={c.text} /></g>);
            case "compact":
                return [0, 1, 2, 3, 4].map((i) => <g key={i}><rect x={left} y={top + i * 8} width={width} height="7" fill={i % 2 ? c.surface : c.background} /><rect x={left + 2} y={top + 2 + i * 8} width="30" height="3" rx="1.5" fill={c.text} /><rect x={left + width - 14} y={top + 2 + i * 8} width="12" height="3" rx="1.5" fill={c.text} /></g>);
            case "carousel":
                return [0, 1, 2, 3].map((i) => <g key={i}><rect x={left + i * 30} y={top} width="26" height="30" rx={r} fill={c.surface} stroke={c.border} strokeWidth=".6" /><rect x={left + i * 30} y={top} width="26" height="16" rx={r} fill={c.secondary} /></g>);
            case "buffet":
                return <><rect x={left} y={top} width={width} height="16" rx={r} fill={c.secondary} stroke={c.primary} /><rect x={left + 4} y={top + 6} width="34" height="4" rx="2" fill={c.text} /><rect x={left + width - 26} y={top + 4} width="22" height="8" rx="2" fill={c.primary} /><rect x={left} y={top + 20} width={width / 2 - 2} height="18" rx={r} fill={c.surface} stroke={c.border} strokeWidth=".6" /><rect x={left + width / 2 + 2} y={top + 20} width={width / 2 - 2} height="18" rx={r} fill={c.surface} stroke={c.border} strokeWidth=".6" /></>;
            default:
                return [0, 1, 2].map((i) => <g key={i}><rect x={left} y={top + i * 13} width={width} height="11" rx={Math.min(r, 4)} fill={c.surface} stroke={c.border} strokeWidth=".6" /><rect x={left + 3} y={top + 3 + i * 13} width="36" height="3" rx="1.5" fill={c.text} /><rect x={left + width - 11} y={top + 1.5 + i * 13} width="8" height="8" rx="2" fill={c.secondary} /></g>);
        }
    })();

    return (
        <svg viewBox="0 0 120 100" className="mne-thumb" role="img" aria-label={`Prévia do modelo ${template.name}`}>
            <rect width="120" height="100" fill={c.background} />
            {header}
            {nav}
            {products}
        </svg>
    );
}
