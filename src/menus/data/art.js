/* =========================================================
   ARTE GERADA PARA A DEMONSTRAÇÃO

   Ilustrações em SVG (data URI) no lugar de fotos: carregam
   na hora, funcionam sem internet e não usam imagem de
   terceiros. Só a demonstração usa; empresas reais enviam as
   próprias fotos.
========================================================= */

const svg = (markup) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;

export const foodArt = (emoji, from = "#ffb37a", to = "#d9480f") =>
    svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
<defs>
<radialGradient id="g" cx="35%" cy="30%" r="85%"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></radialGradient>
<radialGradient id="p" cx="50%" cy="45%" r="50%"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset=".72" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
</defs>
<rect width="400" height="300" fill="url(#g)"/>
<circle cx="80" cy="250" r="90" fill="#fff" opacity=".08"/>
<circle cx="350" cy="40" r="70" fill="#fff" opacity=".1"/>
<ellipse cx="200" cy="168" rx="122" ry="112" fill="url(#p)" opacity=".55"/>
<text x="200" y="196" font-size="132" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${emoji}</text>
</svg>`);

export const coverArt = () =>
    svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 600">
<defs>
<linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3b1d0f"/><stop offset=".55" stop-color="#8a3413"/><stop offset="1" stop-color="#e8590c"/></linearGradient>
<radialGradient id="l" cx="78%" cy="20%" r="60%"><stop offset="0" stop-color="#ffd8a8" stop-opacity=".55"/><stop offset="1" stop-color="#ffd8a8" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1600" height="600" fill="url(#g)"/>
<rect width="1600" height="600" fill="url(#l)"/>
<g opacity=".2" fill="#fff">
<circle cx="140" cy="480" r="160"/><circle cx="1480" cy="520" r="220"/><circle cx="1180" cy="80" r="60"/>
</g>
<g font-size="120" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif" opacity=".92">
<text x="980" y="420">🍕</text><text x="1180" y="330">🍷</text><text x="1340" y="470">🥗</text><text x="1060" y="230" font-size="90">🌿</text>
</g>
</svg>`);

export const logoArt = (letter = "A", color = "#d9480f") =>
    svg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" rx="52" fill="#fff8f1"/>
<circle cx="100" cy="100" r="74" fill="${color}"/>
<path d="M44 128 Q100 60 156 128" stroke="#ffd8a8" stroke-width="10" fill="none" stroke-linecap="round"/>
<text x="100" y="124" font-size="78" font-weight="800" text-anchor="middle" fill="#fff" font-family="Georgia, serif">${letter}</text>
</svg>`);
