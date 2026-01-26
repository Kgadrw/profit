// Simple script to create shortcut icon with white background
// This creates a basic icon - you may want to replace it with a designed version

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a simple SVG with white background and smaller logo
const svgContent = `
<svg width="96" height="96" xmlns="http://www.w3.org/2000/svg">
  <!-- White background -->
  <rect width="96" height="96" fill="#ffffff"/>
  
  <!-- Logo placeholder - you should replace this with your actual logo -->
  <!-- For now, this creates a blue circle with "T" -->
  <circle cx="48" cy="48" r="28" fill="#2563eb"/>
  <text x="48" y="58" font-family="Arial, sans-serif" font-size="36" font-weight="bold" fill="white" text-anchor="middle">T</text>
</svg>
`;

// Note: This creates an SVG. For PNG, you'll need to:
// 1. Use the HTML tool at public/generate-shortcut-icon.html
// 2. Or use an image editor to create icon-shortcut-96.png with:
//    - Size: 96x96 pixels
//    - White background (#ffffff)
//    - Your logo centered and smaller (about 60% of the size)

const outputPath = path.join(__dirname, '../public/icon-shortcut-96.svg');
fs.writeFileSync(outputPath, svgContent);
console.log('✅ Created SVG icon at:', outputPath);
console.log('⚠️  Note: For best results, create a PNG version using:');
console.log('   1. Open public/generate-shortcut-icon.html in browser');
console.log('   2. Click "Download Icon"');
console.log('   3. Save as icon-shortcut-96.png in public folder');
