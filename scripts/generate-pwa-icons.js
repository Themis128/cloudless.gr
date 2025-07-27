const fs = require('fs')
const path = require('path')

// Create PWA icons directory if it doesn't exist
const publicDir = path.join(__dirname, '..', 'public')
const iconsDir = path.join(publicDir, 'icons')

if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true })
}

// Create placeholder PWA icons
const iconSizes = [
  { size: 192, name: 'icon-192x192.png' },
  { size: 512, name: 'icon-512x512.png' },
  { size: 72, name: 'icon-72x72.png' },
  { size: 96, name: 'icon-96x96.png' },
  { size: 128, name: 'icon-128x128.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 384, name: 'icon-384x384.png' },
]

// Create a simple SVG-based icon content
const createIconSVG = size => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1976d2;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#42a5f5;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#grad)" rx="${size * 0.1}"/>
  <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="white" font-family="Arial, sans-serif" font-size="${size * 0.3}" font-weight="bold">C</text>
</svg>`

// Create placeholder files for each icon size
iconSizes.forEach(({ size, name }) => {
  const iconPath = path.join(publicDir, name)
  const svgContent = createIconSVG(size)

  // For now, we'll create SVG files as placeholders
  // In a real implementation, you'd convert these to PNG using a library like sharp
  fs.writeFileSync(iconPath.replace('.png', '.svg'), svgContent)
  console.log(`Created ${name.replace('.png', '.svg')}`)
})

// Create manifest.json
const manifest = {
  name: 'Cloudless - AI Pipeline Management',
  short_name: 'Cloudless',
  description: 'Create, manage, and execute AI processing pipelines',
  theme_color: '#1976d2',
  background_color: '#ffffff',
  display: 'standalone',
  orientation: 'portrait',
  scope: '/',
  start_url: '/',
  icons: iconSizes.map(({ size, name }) => ({
    src: `/${name.replace('.png', '.svg')}`,
    sizes: `${size}x${size}`,
    type: 'image/svg+xml',
  })),
}

fs.writeFileSync(
  path.join(publicDir, 'manifest.json'),
  JSON.stringify(manifest, null, 2)
)
console.log('Created manifest.json')

console.log('\nPWA icons generated successfully!')
console.log(
  'Note: These are SVG placeholders. For production, convert to PNG using a tool like sharp.'
)
