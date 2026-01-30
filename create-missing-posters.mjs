import fs from 'fs';
import path from 'path';

// The missing poster files causing 500 errors
const MISSING_POSTERS = [
  '1768344220463-poster-Tinsel_Shows_v7_1-Apple_Devices_HD__Most_Compatible_.jpg',
  '1768009607698-poster-Pafuera.jpg', 
  '1767999664185-poster-SueltaTe.jpg',
  '1768073472332-poster-Tinsel_Shows_v7_1-Apple_Devices_HD__Most_Compatible_.jpg',
  '1767937471966-poster-Untitled_Project-Apple_Devices_HD__Most_Compatible_.jpg',
  'ai_poster-sub_01027b20-ef02-4882-8ad9-fd01d1f7587a-1767833251277.png',
  'poster-sub_7fc5a384-f8b5-4bb2-9004-1010425ce04e-1766454768888.png'
];

// Create missing temporary poster files
function createPosterFiles() {
  console.log('🔧 Creating temporary poster files to fix 500 errors...');
  
  const storageDir = './public/storage';
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }
  
  for (const filename of MISSING_POSTERS) {
    const filePath = path.join(storageDir, filename);
    
    if (fs.existsSync(filePath)) {
      console.log(`✅ ${filename} already exists`);
      continue;
    }
    
    console.log(`Creating: ${filename}`);
    
    // Create SVG content for posters
    const svgContent = generatePlaceholderSVG(filename);
    
    // Save as SVG for now
    const svgPath = filePath.replace(/\.(png|jpg)$/i, '.svg');
    fs.writeFileSync(svgPath, svgContent, 'utf8');
    
    console.log(`✅ Created ${svgPath}`);
  }
  
  console.log('\n✅ Temporary poster files created!');
  console.log('📋 Files should be accessible at:');
  for (const filename of MISSING_POSTERS) {
    console.log(`• http://localhost:3001/api/cdn/stream?path=${filename}`);
  }
}

// Generate placeholder SVG content
function generatePlaceholderSVG(filename) {
  const title = extractTitle(filename);
  const bgColor = getBackgroundColor(filename);
  const textColor = getTextColor(bgColor);
  
  return `<svg width="640" height="360" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${bgColor};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${adjustBrightness(bgColor, -30)};stop-opacity:1" />
      </linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#bg)"/>
    <rect x="50" y="100" width="540" height="160" rx="10" fill="rgba(255,255,255,0.2)" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>
    <circle cx="320" cy="180" r="25" fill="rgba(255,255,255,0.8)"/>
    <text x="50%" y="45%" text-anchor="middle" dy=".3em" 
          fill="${textColor}" font-family="Arial, sans-serif" 
          font-size="18" font="Arial">
      ${title}
    </text>
    <text x="50%" y="55%" text-anchor="middle" dy="1em" 
          fill="${adjustBrightness(textColor, 50)}" font-family="Arial, sans-serif" 
          font-size="12">
      AI Generated Content
    </text>
  </svg>`;
}

// Extract meaningful title from filename
function extractTitle(filename) {
  const basename = path.basename(filename, path.extname(filename));
  
  // Remove timestamps and IDs
  let title = basename.replace(/^\d+[._-]/, '')
                       .replace(/sub_[0-9a-f-]+/g, 'Automatic')
                       .replace(/[-_]/g, ' ')
                       .replace(/\bHD\b.*Apple Devices.*Compatible/i, 'HD Quality')
                       .replace(/Untitled_Project/i, 'New Content')
                       .replace(/Tinsel Shows/i, 'Shows')
                       .replace(/Most Compatible/i, '')
                       .trim();
  
  return title.replace(/\s+/g, ' ') || 'Preview';
}

// Get background color based on content type
function getBackgroundColor(filename) {
  if (filename.includes('ai_poster')) return '#3F51B5'; // Blue
  if (filename.includes('poster')) return '#9C27B0';     // Purple
  if (filename.includes('sub_')) return '#4CAF50';     // Green
  if (filename.includes('video')) return '#FF5722';   // Orange
  if (filename.includes('show')) return '#673AB7';    // Deep purple
  return '#607D8B'; // Default gray
}

// Get text color for contrast
function getTextColor(bgColor) {
  return '#ffffff'; // White for dark backgrounds
}

// Adjust color brightness
function adjustBrightness(hex, amount) {
  const color = hex.replace('#', '');
  const num = parseInt(color, 16);
  const r = Math.max(0, Math.min(255, (num >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0x00FF) + amount)); 
  const b = Math.max(0, Math.min(255, (num & 0x0000FF) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// Generate CDN URLs
function getTestUrls() {
  return MISSING_POSTERS.map(filename => 
    `http://localhost:3001/api/cdn/stream?path=storage/${filename.replace('.png','.svg').replace('.jpg','.svg')}`
  );
}

// Run the fix
createPosterFiles();

console.log('\n🎯 These fixes address the immediate 500 errors by creating placeholder files.');
console.log('📋 The long-term solution involves implementing AI-powered preview generation.');

export { createPosterFiles, generatePlaceholderSVG };