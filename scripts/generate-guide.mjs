// Builds the user guide PDF from scripts/guide-content.mjs.
// Run with: npm run guide   (writes public/guides/koprice-user-guide.pdf)
//
// Fonts: Outfit (the app's font, from @fontsource/outfit) for headings and
// Arial (Windows) for body text, because Outfit has no cedi sign (₵).
import { createWriteStream, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import PDFDocument from "pdfkit";
import { APP_URL, sections, support } from "./guide-content.mjs";

const require = createRequire(import.meta.url);
const outfit = (weight) => require.resolve(`@fontsource/outfit/files/outfit-latin-${weight}-normal.woff`);
const ARIAL = "C:/Windows/Fonts/arial.ttf";
const ARIAL_BOLD = "C:/Windows/Fonts/arialbd.ttf";
if (!existsSync(ARIAL) || !existsSync(ARIAL_BOLD)) {
  throw new Error("Arial not found. Run this on Windows, or change ARIAL paths to a font that has the ₵ sign.");
}

const C = {
  brand: "#166534",
  brandDark: "#14532d",
  accent: "#f59e0b",
  ink: "#12261a",
  muted: "#4a6352",
  line: "#e3e8e1",
  bg: "#f4f6f2",
  successBg: "#e8f3ec",
  warning: "#9a5b00",
  warningBg: "#fdf1dc",
  danger: "#b91c1c",
  dangerBg: "#fbeaea",
};

const outDir = fileURLToPath(new URL("../public/guides/", import.meta.url));
await mkdir(outDir, { recursive: true });
const outFile = `${outDir}koprice-user-guide.pdf`;

const doc = new PDFDocument({
  size: "A4",
  margins: { top: 60, bottom: 72, left: 56, right: 56 },
  bufferPages: true,
  info: { Title: "Koprice Enterprise – User Guide", Author: "RYT KEY TECH", Subject: "How to use the Koprice inventory and sales app" },
});
doc.pipe(createWriteStream(outFile));

doc.registerFont("H", outfit(700));
doc.registerFont("H8", outfit(800));
doc.registerFont("B", ARIAL);
doc.registerFont("BB", ARIAL_BOLD);

const LEFT = doc.page.margins.left;
const WIDTH = doc.page.width - doc.page.margins.left - doc.page.margins.right;
const bottomLimit = () => doc.page.height - doc.page.margins.bottom;

/** Start a new page if the next block doesn't fit. */
function ensure(height) {
  if (doc.y + height > bottomLimit()) doc.addPage();
}

function drawLogoMark(x, y, size) {
  const r = size / 2;
  doc.save();
  doc.circle(x + r, y + r, r).fill(C.accent);
  doc.lineWidth(size * 0.025).circle(x + r, y + r, r * 0.84).stroke(C.ink);
  doc.fillColor(C.ink).font("H8").fontSize(size * 0.38);
  const w = doc.widthOfString("KP");
  doc.text("KP", x + r - w / 2, y + r - size * 0.23, { lineBreak: false });
  doc.restore();
}

// ---------------------------------------------------------------- cover
doc.rect(0, 0, doc.page.width, doc.page.height).fill(C.bg);
doc.rect(0, 0, doc.page.width, 300).fill(C.brand);
drawLogoMark(LEFT, 90, 96);
doc.fillColor("#ffffff").font("H8").fontSize(34).text("Koprice", LEFT + 116, 108, { lineBreak: false });
doc.font("H").fontSize(12).fillColor("#d9efe0").text("E N T E R P R I S E", LEFT + 118, 152, { lineBreak: false });
doc.fillColor("#ffffff").font("H8").fontSize(40).text("User guide", LEFT, 216);

doc.fillColor(C.ink).font("H").fontSize(18).text("Inventory and sales app", LEFT, 340);
doc.font("B").fontSize(12).fillColor(C.muted).text("For the owner and the shop attendants", LEFT, 368);

doc.roundedRect(LEFT, 420, WIDTH, 92, 14).fill("#ffffff");
doc.fillColor(C.muted).font("B").fontSize(11).text("Open the app at", LEFT + 22, 440);
doc.fillColor(C.brand).font("H8").fontSize(26).text(APP_URL, LEFT + 22, 458);

doc.fillColor(C.muted).font("B").fontSize(10).text(
  `Prepared by ${support.name} · ${support.phone} · ${support.email}`,
  LEFT,
  doc.page.height - 110,
  { width: WIDTH },
);
doc.text(
  `Version ${new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "Africa/Accra" })}`,
  LEFT,
  doc.page.height - 94,
  { width: WIDTH },
);

// ---------------------------------------------------------------- contents (numbers filled in at the end)
doc.addPage();
const contentsPage = doc.bufferedPageRange().count - 1;
doc.fillColor(C.brand).font("H8").fontSize(26).text("Contents", LEFT, doc.page.margins.top);
doc.moveDown(0.8);
const contentsRows = [];
sections.forEach((s, i) => {
  const y = doc.y;
  doc.fillColor(C.ink).font("H").fontSize(13).text(`${i + 1}.  ${s.title}`, LEFT, y, { lineBreak: false });
  doc.fillColor(C.muted).font("B").fontSize(10).text(s.who, LEFT + 290, y + 2, { lineBreak: false });
  contentsRows.push(y);
  doc.y = y + 30;
  doc.moveTo(LEFT, doc.y - 8).lineTo(LEFT + WIDTH, doc.y - 8).lineWidth(0.5).stroke(C.line);
});

// ---------------------------------------------------------------- blocks
function h2(text) {
  ensure(60);
  doc.moveDown(0.6);
  doc.fillColor(C.brand).font("H").fontSize(15).text(text, LEFT, doc.y, { width: WIDTH });
  doc.moveDown(0.3);
}

function paragraph(text) {
  doc.font("B").fontSize(11);
  ensure(doc.heightOfString(text, { width: WIDTH, lineGap: 3 }) + 6);
  doc.fillColor(C.ink).text(text, LEFT, doc.y, { width: WIDTH, lineGap: 3 });
  doc.moveDown(0.5);
}

function steps(items) {
  items.forEach((item, i) => {
    doc.font("B").fontSize(11);
    const h = doc.heightOfString(item, { width: WIDTH - 34, lineGap: 3 });
    ensure(Math.max(h, 22) + 8);
    const y = doc.y;
    doc.circle(LEFT + 11, y + 7, 11).fill(C.brand);
    doc.fillColor("#ffffff").font("H").fontSize(11);
    const n = String(i + 1);
    doc.text(n, LEFT + 11 - doc.widthOfString(n) / 2, y + 1, { lineBreak: false });
    doc.fillColor(C.ink).font("B").fontSize(11).text(item, LEFT + 34, y, { width: WIDTH - 34, lineGap: 3 });
    doc.y = Math.max(doc.y, y + 22) + 6;
  });
  doc.moveDown(0.3);
}

function bullets(items) {
  items.forEach((item) => {
    doc.font("B").fontSize(11);
    const h = doc.heightOfString(item, { width: WIDTH - 22, lineGap: 3 });
    ensure(h + 6);
    const y = doc.y;
    doc.circle(LEFT + 5, y + 6.5, 3.2).fill(C.accent);
    // "Cash: type the money…" -> bold "Cash:" then normal text.
    const label = item.match(/^([^:]{2,40}): /);
    if (label) {
      doc.fillColor(C.ink).font("BB").fontSize(11).text(`${label[1]}: `, LEFT + 20, y, { width: WIDTH - 20, lineGap: 3, continued: true });
      doc.font("B").text(item.slice(label[0].length), { width: WIDTH - 20, lineGap: 3 });
    } else {
      doc.fillColor(C.ink).font("B").fontSize(11).text(item, LEFT + 20, y, { width: WIDTH - 20, lineGap: 3 });
    }
    doc.y += 5;
  });
  doc.moveDown(0.3);
}

function callout(kind, text) {
  const style = {
    tip: { label: "Tip", fill: C.successBg, bar: C.brand, color: C.brandDark },
    warn: { label: "Important", fill: C.warningBg, bar: C.accent, color: C.warning },
    rule: { label: "Shop rule", fill: C.dangerBg, bar: C.danger, color: C.danger },
  }[kind];
  const pad = 14;
  doc.font("B").fontSize(11);
  const textH = doc.heightOfString(text, { width: WIDTH - pad * 2 - 6, lineGap: 3 });
  const boxH = textH + pad * 2 + 16;
  ensure(boxH + 10);
  doc.moveDown(0.2);
  const y = doc.y;
  doc.save();
  doc.roundedRect(LEFT, y, WIDTH, boxH, 10).clip();
  doc.rect(LEFT, y, WIDTH, boxH).fill(style.fill);
  doc.rect(LEFT, y, 5, boxH).fill(style.bar);
  doc.restore();
  doc.fillColor(style.color).font("H").fontSize(11).text(style.label.toUpperCase(), LEFT + pad + 6, y + pad - 2, { characterSpacing: 1 });
  doc.fillColor(C.ink).font("B").fontSize(11).text(text, LEFT + pad + 6, y + pad + 14, { width: WIDTH - pad * 2 - 6, lineGap: 3 });
  doc.y = y + boxH + 12;
}

function table(rows) {
  const widths = [80, 80, WIDTH - 160];
  rows.forEach((row, r) => {
    doc.font(r === 0 ? "BB" : "B").fontSize(10.5);
    const h = Math.max(...row.map((cell, c) => doc.heightOfString(cell, { width: widths[c] - 16, lineGap: 2 }))) + 16;
    ensure(h);
    const y = doc.y;
    doc.rect(LEFT, y, WIDTH, h).fill(r === 0 ? C.brand : r % 2 ? "#ffffff" : C.bg);
    let x = LEFT;
    row.forEach((cell, c) => {
      doc.fillColor(r === 0 ? "#ffffff" : c === 0 ? C.brand : C.ink)
        .font(r === 0 || c === 0 ? "BB" : "B")
        .fontSize(10.5)
        .text(cell, x + 8, y + 8, { width: widths[c] - 16, lineGap: 2 });
      x += widths[c];
    });
    doc.y = y + h;
  });
  doc.rect(LEFT, doc.y - rows.length, WIDTH, 0).stroke(C.line);
  doc.moveDown(0.8);
}

// ---------------------------------------------------------------- sections
const sectionPages = [];
sections.forEach((section, i) => {
  doc.addPage();
  sectionPages.push(doc.bufferedPageRange().count - 1);
  const top = doc.page.margins.top;
  doc.fillColor(C.accent).font("H8").fontSize(13).text(String(i + 1).padStart(2, "0"), LEFT, top, { lineBreak: false });
  doc.fillColor(C.brand).font("H8").fontSize(26).text(section.title, LEFT, top + 16, { width: WIDTH });
  const chipText = `For: ${section.who}`;
  doc.font("H").fontSize(10);
  const chipW = doc.widthOfString(chipText) + 20;
  const chipY = doc.y + 6;
  doc.roundedRect(LEFT, chipY, chipW, 20, 10).fill(C.successBg);
  doc.fillColor(C.brand).text(chipText, LEFT + 10, chipY + 5, { lineBreak: false });
  doc.y = chipY + 34;

  for (const block of section.blocks) {
    if (block.h2) h2(block.h2);
    else if (block.p) paragraph(block.p);
    else if (block.steps) steps(block.steps);
    else if (block.bullets) bullets(block.bullets);
    else if (block.tip) callout("tip", block.tip);
    else if (block.warn) callout("warn", block.warn);
    else if (block.rule) callout("rule", block.rule);
    else if (block.table) table(block.table);
  }
});

// Help box at the end of the last section.
ensure(110);
doc.moveDown(1);
const helpY = doc.y;
doc.roundedRect(LEFT, helpY, WIDTH, 84, 12).fill(C.brand);
doc.fillColor("#ffffff").font("H").fontSize(14).text("Need help?", LEFT + 18, helpY + 16);
doc.font("B").fontSize(11).text(`${support.name}  ·  ${support.phone}  ·  ${support.email}`, LEFT + 18, helpY + 40, { width: WIDTH - 36 });

// ---------------------------------------------------------------- contents page numbers + footers
const pageCount = doc.bufferedPageRange().count;
doc.switchToPage(contentsPage);
contentsRows.forEach((y, i) => {
  const label = String(sectionPages[i] + 1);
  doc.fillColor(C.brand).font("H").fontSize(13);
  doc.text(label, LEFT + WIDTH - doc.widthOfString(label), y, { lineBreak: false });
});

for (let i = 1; i < pageCount; i++) {
  doc.switchToPage(i);
  const savedBottom = doc.page.margins.bottom;
  doc.page.margins.bottom = 0; // allow writing in the footer area without adding a page
  const y = doc.page.height - 44;
  doc.moveTo(LEFT, y - 10).lineTo(LEFT + WIDTH, y - 10).lineWidth(0.5).stroke(C.line);
  doc.fillColor(C.muted).font("B").fontSize(9).text(`Koprice Enterprise · User guide · ${APP_URL}`, LEFT, y, { lineBreak: false });
  const n = `${i + 1} / ${pageCount}`;
  doc.text(n, LEFT + WIDTH - doc.widthOfString(n), y, { lineBreak: false });
  doc.page.margins.bottom = savedBottom;
}

doc.end();
console.log(`Wrote public/guides/koprice-user-guide.pdf (${pageCount} pages)`);
