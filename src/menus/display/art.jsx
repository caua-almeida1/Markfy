import React, { useId } from "react";

/* =========================================================
   MONITOR DE RETIRADA — ARTES

   Ilustrações desenhadas à mão em SVG (sem imagem externa:
   carregam na hora em qualquer TV e nunca ficam pixeladas).
   Cores vêm das variáveis do modelo, então a arte acompanha
   a cor do cardápio quando ela estiver ligada.

   Cada modelo tem:
     Badge  ícone pequeno ao lado do título do "Pronto"
     Scene  decoração de fundo (cantos, bordas, mascote)
========================================================= */

/* ---------- MARKFY ---------- */

const Bell = ({ className }) => {
    const id = `mdb-bell-${useId().replace(/:/g, "")}`;
    return (
    <svg className={className} viewBox="0 0 120 120" aria-hidden="true">
        <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ffb27a" />
                <stop offset="1" style={{ stopColor: "var(--d-accent)" }} />
            </linearGradient>
        </defs>
        <g className="mdb-ring-waves" fill="none" strokeWidth="5" strokeLinecap="round" style={{ stroke: "var(--d-accent)" }}>
            <path d="M20 40 Q12 54 20 68" opacity="0.6" />
            <path d="M8 32 Q-2 54 8 76" opacity="0.3" />
            <path d="M100 40 Q108 54 100 68" opacity="0.6" />
            <path d="M112 32 Q122 54 112 76" opacity="0.3" />
        </g>
        <g className="mdb-swing">
            <circle cx="60" cy="18" r="7" fill={`url(#${id})`} />
            <path d="M60 22c-20 0-32 15-32 36v18l-8 10v4h80v-4l-8-10V58c0-21-12-36-32-36z" fill={`url(#${id})`} />
            <path d="M40 56c0-12 7-21 18-23" fill="none" stroke="#fff" strokeOpacity="0.55" strokeWidth="5" strokeLinecap="round" />
            <ellipse cx="60" cy="98" rx="11" ry="9" style={{ fill: "var(--d-accent)" }} />
        </g>
    </svg>
    );
};

const MarkfyScene = () => (
    <>
        <div className="mdb-orb mdb-orb--a" />
        <div className="mdb-orb mdb-orb--b" />
        <svg className="mdb-art mdb-art--arcs" viewBox="0 0 400 400" aria-hidden="true">
            {[60, 110, 160, 210, 260].map((r, i) => (
                <circle key={r} cx="0" cy="400" r={r} fill="none" strokeOpacity={0.22 - i * 0.035} strokeWidth="2" style={{ stroke: "var(--d-accent)" }} />
            ))}
        </svg>
    </>
);

/* ---------- DOCE FESTA ---------- */

const IceCream = ({ className }) => (
    <svg className={className} viewBox="0 0 220 300" aria-hidden="true">
        {/* casquinha */}
        <path d="M58 150 L110 292 L162 150 Z" fill="#f2b36a" />
        <g stroke="#d68a3c" strokeWidth="4" strokeLinecap="round">
            <path d="M70 160 L130 240" /><path d="M95 156 L146 222" /><path d="M120 155 L156 200" />
            <path d="M150 160 L90 240" /><path d="M125 156 L74 222" /><path d="M100 155 L64 200" />
        </g>
        {/* bolas */}
        <circle cx="78" cy="132" r="42" fill="#ffd1e0" />
        <circle cx="142" cy="132" r="42" fill="#c9f0ff" />
        <circle cx="110" cy="92" r="52" fill="#fff6e8" />
        {/* calda */}
        <path d="M62 120 q12 18 22 0 q10 22 22 2 q10 26 22 0 q12 20 22 0 q10 16 20 -4 l-2 -20 h-104 z" fill="#ff5d73" opacity="0.92" />
        {/* cereja */}
        <path d="M112 40 q6 -22 24 -30" fill="none" stroke="#3a7d3a" strokeWidth="4" strokeLinecap="round" />
        <circle cx="110" cy="44" r="13" fill="#e8202a" />
        <circle cx="105" cy="39" r="4" fill="#fff" opacity="0.8" />
        {/* rostinho */}
        <g className="mdb-blink">
            <ellipse cx="94" cy="94" rx="6" ry="8" fill="#3a1416" />
            <ellipse cx="126" cy="94" rx="6" ry="8" fill="#3a1416" />
            <circle cx="96" cy="91" r="2.2" fill="#fff" />
            <circle cx="128" cy="91" r="2.2" fill="#fff" />
        </g>
        <path d="M100 108 q10 12 20 0" fill="none" stroke="#3a1416" strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="82" cy="108" rx="8" ry="5" fill="#ff8fa3" opacity="0.7" />
        <ellipse cx="138" cy="108" rx="8" ry="5" fill="#ff8fa3" opacity="0.7" />
    </svg>
);

/* Só nas margens livres (faixa de cima, laterais, pé da tela):
   nunca atrás de texto. */
const SPRINKLES = [
    [760, 8, 20, "#ffd23f"], [1020, 14, -30, "#7ee0ff"], [1250, 6, 45, "#ffffff"], [560, 16, -10, "#7ee0ff"],
    [8, 300, 60, "#7ee0ff"], [14, 520, -20, "#ffffff"], [6, 760, 30, "#ffd23f"], [1884, 340, -45, "#ffffff"],
    [1880, 640, 15, "#7ee0ff"], [1886, 860, 70, "#ffd23f"], [300, 1062, -60, "#7ee0ff"], [1180, 1064, 20, "#ffd23f"]
];

const FestaScene = () => (
    <>
        <svg className="mdb-art mdb-art--sprinkles" viewBox="0 0 1920 1080" preserveAspectRatio="none" aria-hidden="true">
            {SPRINKLES.map(([x, y, r, c], i) => (
                <rect key={i} x={x} y={y} width="34" height="11" rx="5.5" fill={c} transform={`rotate(${r} ${x + 17} ${y + 5})`} opacity="0.9" />
            ))}
            {[[900, 20], [1400, 16], [24, 980], [1896, 180]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9" fill="#ffd23f" opacity="0.8" />)}
        </svg>
        <IceCream className="mdb-art mdb-art--mascot" />
    </>
);

/* ---------- LANCHONETE ---------- */

const Burger = ({ className }) => (
    <svg className={className} viewBox="0 0 200 170" aria-hidden="true">
        <path d="M18 74 C18 26 182 26 182 74 Z" fill="#f2a33a" />
        <path d="M18 74 C18 26 182 26 182 74 Z" fill="none" stroke="#d9832a" strokeWidth="4" />
        {[[60, 46], [90, 38], [122, 42], [150, 54], [74, 60], [108, 58], [136, 66], [46, 64]].map(([x, y], i) => (
            <ellipse key={i} cx={x} cy={y} rx="5" ry="3" fill="#fff4dc" transform={`rotate(${i * 23} ${x} ${y})`} />
        ))}
        <path d="M10 82 q15 -12 30 0 t30 0 t30 0 t30 0 t30 0 t30 0 v10 h-180 z" fill="#5cb85c" />
        <path d="M14 92 h172 l-12 16 l-10 -6 l-12 10 l-10 -8 l-118 0 z" fill="#ffc72c" />
        <rect x="16" y="100" width="168" height="26" rx="13" fill="#6b3418" />
        <path d="M20 132 h160 q0 26 -30 26 h-100 q-30 0 -30 -26 z" fill="#e8962f" />
    </svg>
);

const Fries = ({ className }) => (
    <svg className={className} viewBox="0 0 140 180" aria-hidden="true">
        {[[30, 18, -8], [48, 6, -3], [66, 0, 2], [84, 8, 6], [100, 20, 10], [40, 28, -5], [92, 30, 8]].map(([x, y, r], i) => (
            <rect key={i} x={x} y={y} width="14" height="90" rx="4" fill="#ffd23f" stroke="#e6a817" strokeWidth="2" transform={`rotate(${r} ${x + 7} ${y + 45})`} />
        ))}
        <path d="M18 70 h104 l-12 104 h-80 z" style={{ fill: "var(--d-prep-head)" }} />
        <path d="M44 100 q26 22 52 0" fill="none" stroke="#ffd23f" strokeWidth="6" strokeLinecap="round" />
    </svg>
);

const FastScene = () => (
    <>
        <svg className="mdb-art mdb-art--stripes" viewBox="0 0 1920 60" preserveAspectRatio="none" aria-hidden="true">
            <rect width="1920" height="30" style={{ fill: "var(--d-prep-head)" }} />
            <rect y="30" width="1920" height="30" style={{ fill: "var(--d-ready-head)" }} />
        </svg>
        <Burger className="mdb-art mdb-art--burger" />
        <Fries className="mdb-art mdb-art--fries" />
    </>
);

/* ---------- BISTRÔ ---------- */

const Cloche = ({ className }) => (
    <svg className={className} viewBox="0 0 160 110" aria-hidden="true" fill="none" strokeWidth="2.5" strokeLinecap="round" style={{ stroke: "var(--d-accent)" }}>
        <circle cx="80" cy="16" r="6" />
        <path d="M80 22 v6" />
        <path d="M22 86 C22 46 50 28 80 28 C110 28 138 46 138 86" />
        <path d="M40 70 C44 54 56 44 70 40" strokeOpacity="0.6" />
        <path d="M8 90 H152" />
        <path d="M30 98 H130" strokeOpacity="0.5" />
    </svg>
);

const Flourish = ({ className }) => (
    <svg className={className} viewBox="0 0 300 24" aria-hidden="true" fill="none" strokeWidth="1.6" strokeLinecap="round" style={{ stroke: "var(--d-accent)" }}>
        <path d="M0 12 H118" />
        <path d="M182 12 H300" />
        <path d="M150 2 L160 12 L150 22 L140 12 Z" style={{ fill: "var(--d-accent)" }} />
        <path d="M118 12 q8 -10 18 0 q-10 10 -18 0" />
        <path d="M182 12 q-8 -10 -18 0 q10 10 18 0" />
    </svg>
);

const BistroScene = () => (
    <>
        <div className="mdb-frame" />
        <svg className="mdb-art mdb-art--corner mdb-art--corner-tl" viewBox="0 0 120 120" aria-hidden="true" fill="none" strokeWidth="1.6" style={{ stroke: "var(--d-accent)" }}>
            <path d="M10 110 V30 Q10 10 30 10 H110" />
            <path d="M24 96 V40 Q24 24 40 24 H96" strokeOpacity="0.5" />
            <circle cx="10" cy="10" r="4" style={{ fill: "var(--d-accent)" }} />
        </svg>
        <svg className="mdb-art mdb-art--corner mdb-art--corner-br" viewBox="0 0 120 120" aria-hidden="true" fill="none" strokeWidth="1.6" style={{ stroke: "var(--d-accent)" }}>
            <path d="M10 110 V30 Q10 10 30 10 H110" />
            <path d="M24 96 V40 Q24 24 40 24 H96" strokeOpacity="0.5" />
            <circle cx="10" cy="10" r="4" style={{ fill: "var(--d-accent)" }} />
        </svg>
    </>
);

/* ---------- BRASA ---------- */

const Cutlery = ({ className }) => (
    <svg className={className} viewBox="0 0 120 120" aria-hidden="true" style={{ fill: "var(--d-accent)" }}>
        <g transform="rotate(-35 60 60)">
            <rect x="56" y="40" width="8" height="74" rx="4" />
            <path d="M48 8 v30 q0 10 12 10 q12 0 12 -10 v-30 h-5 v26 h-4 v-26 h-6 v26 h-4 v-26 z" />
        </g>
        <g transform="rotate(35 60 60)">
            <rect x="56" y="52" width="8" height="62" rx="4" />
            <path d="M56 6 q16 6 16 30 q0 14 -8 18 h-8 z" />
        </g>
    </svg>
);

/* Chamas estreitas e irregulares (altura e inclinação variam),
   cada uma com um miolo amarelo. */
const FLAMES = Array.from({ length: 30 }, (_, i) => {
    const x = i * 66 + (i % 2) * 14;
    const h = [92, 128, 76, 140, 104, 84, 120][i % 7];
    const lean = [-10, 6, -4, 12, -8, 4, 0][i % 7];
    return { x, h, lean, i };
});

const flamePath = (x, h, lean, w) =>
    `M${x - w} 160 C${x - w - 6} ${160 - h * 0.45} ${x - w * 0.2 + lean * 0.3} ${160 - h * 0.7} ${x + lean} ${160 - h} ` +
    `C${x + w * 0.4 + lean * 0.5} ${160 - h * 0.62} ${x + w + 8} ${160 - h * 0.4} ${x + w} 160 Z`;

const BrasaScene = () => {
    const id = `mdb-flame-${useId().replace(/:/g, "")}`;
    return (
    <>
        <div className="mdb-planks" />
        <svg className="mdb-art mdb-art--flames" viewBox="0 0 1920 160" preserveAspectRatio="none" aria-hidden="true">
            <defs>
                <linearGradient id={id} x1="0" y1="1" x2="0" y2="0">
                    <stop offset="0" stopColor="#ff3b2f" />
                    <stop offset="0.55" stopColor="#ff8a1f" />
                    <stop offset="1" stopColor="#ffd25e" stopOpacity="0" />
                </linearGradient>
            </defs>
            {FLAMES.map(({ x, h, lean, i }) => (
                <g key={x} className={`mdb-flame mdb-flame--${i % 3}`}>
                    <path d={flamePath(x, h, lean, 26)} fill={`url(#${id})`} />
                    <path d={flamePath(x + lean * 0.2, h * 0.5, lean * 0.5, 11)} fill="#ffe08a" opacity="0.85" />
                </g>
            ))}
        </svg>
        <div className="mdb-embers" />
    </>
    );
};

/* ---------- CAFETERIA ---------- */

const Cup = ({ className }) => (
    <svg className={className} viewBox="0 0 200 200" aria-hidden="true" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" style={{ stroke: "var(--d-ink)" }}>
        <g className="mdb-steam" strokeOpacity="0.55">
            <path d="M74 60 q-12 -14 0 -28 q12 -14 0 -28" />
            <path d="M100 56 q-12 -14 0 -28 q12 -14 0 -28" />
            <path d="M126 60 q-12 -14 0 -28 q12 -14 0 -28" />
        </g>
        <path d="M40 80 h120 v40 q0 48 -60 48 q-60 0 -60 -48 z" style={{ fill: "var(--d-panel)" }} />
        <path d="M160 92 h10 q22 0 22 20 q0 20 -24 22 h-12" />
        <path d="M20 180 h160" />
        <path d="M58 104 q42 14 84 0" strokeOpacity="0.7" style={{ stroke: "var(--d-accent)" }} />
    </svg>
);

const Bean = ({ x, y, r }) => (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
        <ellipse rx="22" ry="15" style={{ fill: "var(--d-accent)" }} />
        <path d="M-16 2 q16 -10 32 0" fill="none" strokeWidth="3" strokeLinecap="round" style={{ stroke: "var(--d-bg)" }} />
    </g>
);

const CafeScene = () => (
    <>
        <div className="mdb-paper" />
        <svg className="mdb-art mdb-art--beans" viewBox="0 0 1920 1080" preserveAspectRatio="none" aria-hidden="true">
            {/* nas margens laterais, longe de qualquer texto */}
            <Bean x={28} y={520} r={70} />
            <Bean x={26} y={580} r={110} />
            <Bean x={1892} y={420} r={-60} />
            <Bean x={1894} y={480} r={-100} />
        </svg>
    </>
);

/* ---------- MAPA ---------- */

export const DISPLAY_ART = {
    markfy: { Scene: MarkfyScene, Badge: Bell },
    festa: { Scene: FestaScene, Badge: null },
    fast: { Scene: FastScene, Badge: null },
    bistro: { Scene: BistroScene, Badge: Cloche, Divider: Flourish },
    brasa: { Scene: BrasaScene, Badge: Cutlery },
    cafe: { Scene: CafeScene, Badge: Cup },
    classico: { Scene: null, Badge: null }
};
