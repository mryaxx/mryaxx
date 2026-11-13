import { BRANDS } from './seed.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const CAR = `<g fill="none" stroke="#fff" stroke-width="10" stroke-linejoin="round" stroke-linecap="round" opacity=".92">
  <path d="M120 700 L150 610 Q175 545 245 535 L380 520 Q440 450 520 440 L700 440 Q780 445 850 520 L930 540 Q990 560 990 640 L990 700 Z"/>
  <path d="M410 520 L500 465 L640 462 L640 520 Z M670 462 L760 468 L820 520 L670 520 Z" fill="#ffffff22"/>
  <circle cx="300" cy="705" r="70" fill="#0008"/><circle cx="300" cy="705" r="30"/>
  <circle cx="820" cy="705" r="70" fill="#0008"/><circle cx="820" cy="705" r="30"/>
</g>`;
const PART = `<g fill="none" stroke="#fff" stroke-width="12" opacity=".92"><circle cx="555" cy="600" r="170"/><circle cx="555" cy="600" r="60"/>
${Array.from({ length: 10 }, (_, i) => { const a = (i * Math.PI) / 5; return `<line x1="${555 + Math.cos(a) * 170}" y1="${600 + Math.sin(a) * 170}" x2="${555 + Math.cos(a) * 230}" y2="${600 + Math.sin(a) * 230}"/>`; }).join('')}</g>`;
const ROBOT = `<g fill="none" stroke="#fff" stroke-width="12" stroke-linejoin="round" opacity=".92"><rect x="420" y="380" width="270" height="200" rx="40"/>
<circle cx="500" cy="480" r="25" fill="#fff"/><circle cx="610" cy="480" r="25" fill="#fff"/><line x1="555" y1="380" x2="555" y2="320"/><circle cx="555" cy="305" r="18"/>
<rect x="440" y="600" width="230" height="200" rx="30"/><line x1="440" y1="650" x2="360" y2="760"/><line x1="670" y1="650" x2="750" y2="760"/></g>`;
const TECH = `<g fill="none" stroke="#fff" stroke-width="12" stroke-linejoin="round" opacity=".92"><rect x="400" y="400" width="300" height="420" rx="40"/>
<rect x="510" y="360" width="80" height="40" rx="10"/><path d="M570 470 L500 620 L560 620 L530 750 L620 580 L560 580 Z" fill="#fff"/></g>`;

const CAT_COLORS = { parts: '#475569', robotics: '#0e7490', 'automotive-tech': '#15803d' };

export function posterSvg(listing) {
  const brand = BRANDS.find((b) => b.slug === listing.brand);
  const base = listing.category === 'cars' ? brand?.color ?? '#334155' : CAT_COLORS[listing.category] ?? '#334155';
  const art = { cars: CAR, parts: PART, robotics: ROBOT, 'automotive-tech': TECH }[listing.category] ?? CAR;
  const label = listing.category === 'cars' ? brand?.name ?? '' : listing.category.replace('-', ' ').toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1110 1920" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${base}"/><stop offset="1" stop-color="#0b0b0f"/></linearGradient>
<radialGradient id="h" cx=".5" cy=".38" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="1110" height="1920" fill="url(#g)"/><rect width="1110" height="1920" fill="url(#h)"/>
<text x="555" y="640" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-weight="800" font-size="120" fill="#fff" opacity=".18" letter-spacing="8">${esc(label)}</text>
<g transform="translate(0 320)">${art}</g>
<ellipse cx="555" cy="1110" rx="420" ry="30" fill="#000" opacity=".35"/>
</svg>`;
}
