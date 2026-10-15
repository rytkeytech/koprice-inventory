// Generates the PWA / home-screen icons from the Koprice logo mark.
// Run with: npm run icons   (output goes to public/icons/)
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ORANGE = "#f59e0b";
const INK = "#12261a";

// Logo mark on a transparent background (circle fills the square).
function markSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <circle cx="32" cy="32" r="32" fill="${ORANGE}"/>
  <circle cx="32" cy="32" r="27" fill="none" stroke="${INK}" stroke-width="1.5"/>
  <text x="32" y="41" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="24" fill="${INK}">KP</text>
</svg>`;
}

// Maskable: full orange square; ring and "KP" kept inside the 80% safe zone,
// so Android can crop it to a circle, squircle or square.
function maskableSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="${ORANGE}"/>
  <circle cx="32" cy="32" r="21" fill="none" stroke="${INK}" stroke-width="1.2"/>
  <text x="32" y="38.5" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="18" fill="${INK}">KP</text>
</svg>`;
}

// Apple touch icon: iOS adds its own rounded corners and ignores transparency.
function appleSvg(size) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64">
  <rect width="64" height="64" fill="#f4f6f2"/>
  <g transform="translate(5 5) scale(0.84375)">
    <circle cx="32" cy="32" r="32" fill="${ORANGE}"/>
    <circle cx="32" cy="32" r="27" fill="none" stroke="${INK}" stroke-width="1.5"/>
    <text x="32" y="41" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="24" fill="${INK}">KP</text>
  </g>
</svg>`;
}

const outDir = fileURLToPath(new URL("../public/icons/", import.meta.url));
await mkdir(outDir, { recursive: true });

const icons = [
  { file: "icon-192.png", svg: markSvg(192) },
  { file: "icon-512.png", svg: markSvg(512) },
  { file: "icon-maskable-512.png", svg: maskableSvg(512) },
  { file: "apple-touch-icon.png", svg: appleSvg(180) },
];

for (const { file, svg } of icons) {
  await sharp(Buffer.from(svg)).png().toFile(`${outDir}${file}`);
  console.log(`Wrote public/icons/${file}`);
}
