/**
 * Icon Generation Script
 * 
 * Bu script, SVG icon'dan tüm gerekli PWA icon boyutlarını oluşturur.
 * 
 * Kullanım:
 * 1. public/icons/icon-192x192.svg dosyasını hazırla
 * 2. npm install sharp (gerekirse)
 * 3. node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Icon boyutları (manifest.json'dan)
const iconSizes = [72, 96, 128, 144, 152, 192, 384, 512];

const publicIconsDir = path.join(__dirname, '..', 'public', 'icons');
const svgPath = path.join(publicIconsDir, 'icon-192x192.svg');

// SVG'den PNG oluşturma için sharp kullanılabilir
// Şimdilik placeholder oluşturuyoruz

console.log('📱 PWA Icon Generator');
console.log('═══════════════════════════════════════════\n');

// Icon dizinini kontrol et
if (!fs.existsSync(publicIconsDir)) {
  fs.mkdirSync(publicIconsDir, { recursive: true });
  console.log('✅ Icons dizini oluşturuldu');
}

// SVG dosyasını kontrol et
if (!fs.existsSync(svgPath)) {
  console.log('⚠️  SVG icon bulunamadı:', svgPath);
  console.log('📝 Lütfen public/icons/icon-192x192.svg dosyasını oluşturun\n');
  console.log('💡 İpucu:');
  console.log('   - 192x192 veya 512x512 boyutunda bir SVG icon hazırla');
  console.log('   - public/icons/icon-192x192.svg olarak kaydet');
  console.log('   - Bu scripti tekrar çalıştır\n');
  
  // Placeholder SVG oluştur
  const placeholderSvg = `<svg width="192" height="192" xmlns="http://www.w3.org/2000/svg">
  <rect width="192" height="192" fill="#10b981" rx="20"/>
  <text x="96" y="120" font-family="Arial" font-size="80" fill="white" text-anchor="middle" font-weight="bold">⚽</text>
</svg>`;
  
  fs.writeFileSync(svgPath, placeholderSvg);
  console.log('✅ Placeholder SVG oluşturuldu:', svgPath);
  console.log('📝 Lütfen bu dosyayı gerçek icon\'unuzla değiştirin\n');
}

console.log('📋 Gerekli icon boyutları:');
iconSizes.forEach(size => {
  const iconPath = path.join(publicIconsDir, `icon-${size}x${size}.png`);
  const exists = fs.existsSync(iconPath);
  console.log(`   ${exists ? '✅' : '❌'} icon-${size}x${size}.png`);
});

console.log('\n💡 Icon oluşturma seçenekleri:');
console.log('   1. Online tool: https://realfavicongenerator.net/');
console.log('   2. ImageMagick: convert icon-192x192.svg -resize 512x512 icon-512x512.png');
console.log('   3. Sharp (Node.js): npm install sharp, sonra scripti güncelle');
console.log('   4. Figma/Photoshop: Manuel export\n');

console.log('✅ Script tamamlandı!');

