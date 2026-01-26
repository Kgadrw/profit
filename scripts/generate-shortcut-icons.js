// Script to generate shortcut icons with white background
// Run with: node scripts/generate-shortcut-icons.js
// Requires: npm install canvas (or use browser version)

const fs = require('fs');
const path = require('path');

// For Node.js with canvas library
try {
  const { createCanvas, loadImage } = require('canvas');
  
  async function generateShortcutIcon() {
    const size = 96;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Draw white background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);
    
    try {
      // Load logo
      const logoPath = path.join(__dirname, '../public/logo.png');
      const logo = await loadImage(logoPath);
      
      // Calculate size to make logo smaller (60% of canvas)
      const logoSize = size * 0.6;
      const padding = (size - logoSize) / 2;
      
      // Draw logo centered
      ctx.drawImage(logo, padding, padding, logoSize, logoSize);
    } catch (error) {
      console.log('Logo not found, creating placeholder...');
      // Draw placeholder
      ctx.fillStyle = '#2563eb';
      ctx.font = 'bold 32px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('T', size / 2, size / 2);
    }
    
    // Save icon
    const outputPath = path.join(__dirname, '../public/icon-shortcut-96.png');
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);
    console.log(`✅ Generated icon: ${outputPath}`);
  }
  
  generateShortcutIcon().catch(console.error);
} catch (error) {
  console.log('Canvas library not installed. Using browser method instead.');
  console.log('Please use the HTML file at public/generate-shortcut-icon.html');
  console.log('Or install canvas: npm install canvas');
}
