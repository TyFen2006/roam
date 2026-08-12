import sharp from 'sharp';
import fs from 'fs';

// Sunrise app icon — standalone SVG (gradients + trail glow, full-bleed square)
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 120 120">
  <defs>
    <linearGradient id="g-sun" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f7c25a"/><stop offset="0.34" stop-color="#f0813c"/>
      <stop offset="0.66" stop-color="#c23a63"/><stop offset="1" stop-color="#2a1852"/>
    </linearGradient>
    <radialGradient id="g-suncore" cx="50%" cy="50%" r="50%">
      <stop offset="0" stop-color="#fff4d6"/>
      <stop offset="0.5" stop-color="#ffdd96" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#ffdd96" stop-opacity="0"/>
    </radialGradient>
    <filter id="tglow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="3.4" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>
  <rect width="120" height="120" fill="url(#g-sun)"/>
  <circle cx="60" cy="50" r="34" fill="url(#g-suncore)"/>
  <path d="M0 96 Q26 84 52 92 Q80 100 120 88 L120 120 L0 120 Z" fill="#241a52" opacity="0.92"/>
  <path d="M0 107 Q34 97 66 105 Q92 111 120 104 L120 120 L0 120 Z" fill="#150e38"/>
  <path d="M42 118 C48 96 34 86 54 78 C70 71 60 62 60 52" fill="none" stroke="#fff6e2" stroke-width="6" stroke-linecap="round" filter="url(#tglow)"/>
  <circle cx="60" cy="50" r="13" fill="#fff3cf"/>
</svg>`;

fs.mkdirSync('public', { recursive: true });
const buf = Buffer.from(svg);
const targets = [
  ['public/icon-512.png', 512],
  ['public/icon-192.png', 192],
  ['public/apple-touch-icon.png', 180],
];
for (const [file, size] of targets) {
  await sharp(buf).resize(size, size).png().toFile(file);
  console.log('wrote', file);
}
const b64 = fs.readFileSync('public/icon-512.png').toString('base64');
fs.writeFileSync('src/appIcon.js', `// AUTO-GENERATED — Sunrise app icon (512px PNG data URI)\nexport const APP_ICON = "data:image/png;base64,${b64}";\n`);
console.log('wrote src/appIcon.js —', b64.length, 'base64 chars');
