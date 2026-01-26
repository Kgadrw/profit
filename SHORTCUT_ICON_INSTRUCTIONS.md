# Shortcut Icon Generation Instructions

The shortcut icons need to be smaller with white backgrounds. Here's how to create them:

## Quick Method (Recommended)

1. Open `public/generate-shortcut-icon.html` in your browser
2. The page will automatically load your logo and create an icon with:
   - White background (#ffffff)
   - Smaller logo (60% of the icon size)
   - 96x96 pixels
3. Click "Download Icon" button
4. Save the file as `icon-shortcut-96.png` in the `public` folder

## Manual Method

If you prefer to create it manually:

1. Create a 96x96 pixel image
2. Fill with white background (#ffffff)
3. Add your logo centered, sized to about 57-58 pixels (60% of 96px)
4. Save as `icon-shortcut-96.png` in the `public` folder

## What Changed

- Updated `manifest.json` to use smaller 96x96 icons for shortcuts
- Icons now have white backgrounds instead of transparent
- Logo is smaller and centered on the white background

The icon file should be placed at: `public/icon-shortcut-96.png`
