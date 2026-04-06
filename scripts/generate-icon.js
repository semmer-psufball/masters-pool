// Generates a simple Masters-themed app icon as an SVG, then we can convert
// Run with: node scripts/generate-icon.js

const fs = require('fs');
const path = require('path');

const svg = `<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" rx="224" fill="#1E3A2E"/>
  <rect x="40" y="40" width="944" height="944" rx="200" fill="#2D4A3E" stroke="#FFD700" stroke-width="3" stroke-opacity="0.2"/>
  <text x="512" y="420" text-anchor="middle" font-family="Georgia, serif" font-weight="bold" font-size="280" fill="#FFD700" letter-spacing="8">M</text>
  <text x="512" y="580" text-anchor="middle" font-family="Georgia, serif" font-size="80" fill="#C8B88A" letter-spacing="12">POOL</text>
  <line x1="340" y1="460" x2="684" y2="460" stroke="#D4729C" stroke-width="4" stroke-opacity="0.6"/>
  <text x="512" y="700" text-anchor="middle" font-family="Arial, sans-serif" font-size="52" fill="#C8B88A" letter-spacing="6">2026</text>
</svg>`;

const outPath = path.join(__dirname, '..', 'assets', 'icon.svg');
fs.writeFileSync(outPath, svg);
console.log('SVG icon written to assets/icon.svg');
console.log('');
console.log('To convert to PNG for the app, you can:');
console.log('1. Open assets/icon.svg in a browser');
console.log('2. Screenshot at 1024x1024');
console.log('3. Save as assets/icon.png');
console.log('');
console.log('Or we can use a simpler approach - just use the clubhouse image with an overlay.');
