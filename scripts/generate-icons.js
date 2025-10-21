import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a simple SVG icon
const createIcon = (size) => {
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="#3b82f6"/>
    <rect x="${size * 0.1}" y="${size * 0.1}" width="${size * 0.8}" height="${size * 0.8}" fill="white" rx="${size * 0.1}"/>
    <rect x="${size * 0.2}" y="${size * 0.3}" width="${size * 0.6}" height="${size * 0.1}" fill="#3b82f6"/>
    <rect x="${size * 0.2}" y="${size * 0.5}" width="${size * 0.4}" height="${size * 0.1}" fill="#3b82f6"/>
    <rect x="${size * 0.2}" y="${size * 0.7}" width="${size * 0.5}" height="${size * 0.1}" fill="#3b82f6"/>
  </svg>`;
};

// Icon sizes needed for PWA
const iconSizes = [16, 32, 72, 96, 128, 144, 152, 192, 384, 512];

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, '../public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate SVG icons
iconSizes.forEach(size => {
  const svgContent = createIcon(size);
  const filename = `icon-${size}x${size}.svg`;
  fs.writeFileSync(path.join(iconsDir, filename), svgContent);
  console.log(`Generated ${filename}`);
});

console.log('PWA icons generated successfully!');
console.log('Note: For production, replace these SVG icons with proper PNG icons.');
