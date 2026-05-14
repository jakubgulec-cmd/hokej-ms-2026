const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const srcSvg = path.join(__dirname, '..', 'public', 'icon-source.svg');
const outDir = path.join(__dirname, '..', 'public');

const sizes = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 32, name: 'favicon-32.png' },
];

async function main() {
  const svg = fs.readFileSync(srcSvg);

  for (const { size, name } of sizes) {
    // Vytvořit ikonu s pozadím (tmavé pozadí + ikona uprostřed)
    const padding = Math.round(size * 0.15);
    const inner = size - padding * 2;

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 15, g: 23, b: 42, alpha: 1 }, // slate-900
      },
    })
      .composite([
        {
          input: await sharp(svg).resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer(),
          top: padding,
          left: padding,
        },
      ])
      .png()
      .toFile(path.join(outDir, name));

    console.log(`✓ ${name} (${size}x${size})`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
