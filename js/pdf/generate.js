// Builds the whole report PDF. Works in the browser and in Node (tests):
// everything environment-specific (jsPDF, file loading, photos) is passed in.

import { Draw } from './draw.js';
import { FONT } from './theme.js';
import {
  drawCover, drawDimensions, drawWater, drawRoom, drawDisclaimer, drawThanks,
  drawHeader, drawFooter, makeMeasure,
} from './pages.js';
import { collectImageIds, formatDate } from '../model.js';
import { COMPANY } from '../config.js';

// Fixed artwork. Sizes are the pixel sizes of the files.
export const ASSET_FILES = {
  coverBg: { path: 'assets/brand/cover-bg.jpg', format: 'JPEG', w: 1500, h: 2000 },
  thanksBg: { path: 'assets/brand/thanks-bg.png', format: 'PNG', w: 1500, h: 2000 },
  logoCover: { path: 'assets/brand/logo-cover.png', format: 'PNG', w: 336, h: 72 },
  logoHeader: { path: 'assets/brand/logo-header.png', format: 'PNG', w: 202, h: 43 },
  logoThanks: { path: 'assets/brand/logo-thanks.png', format: 'PNG', w: 499, h: 116 },
};
export const FONT_FILES = {
  regular: 'assets/fonts/InstrumentSans-Regular.ttf',
  bold: 'assets/fonts/InstrumentSans-Bold.ttf',
};

export function bytesToBase64(bytes) {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/** loadFile(path) -> Promise<Uint8Array>. Returns everything generateReport needs. */
export async function loadAssets(loadFile) {
  const assets = {};
  await Promise.all(Object.entries(ASSET_FILES).map(async ([key, a]) => {
    assets[key] = { data: await loadFile(a.path), format: a.format, w: a.w, h: a.h };
  }));
  const [reg, bold] = await Promise.all([loadFile(FONT_FILES.regular), loadFile(FONT_FILES.bold)]);
  assets.fontRegular = bytesToBase64(reg);
  assets.fontBold = bytesToBase64(bold);
  return assets;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

/**
 * @param report  report JSON (see js/model.js)
 * @param opts.jsPDF     jsPDF constructor
 * @param opts.assets    result of loadAssets()
 * @param opts.getImage  id -> Promise<{ data: Uint8Array (JPEG), w, h }>
 * @param opts.onProgress (done, total) => void
 * @returns jsPDF document
 */
export async function generateReport(report, { jsPDF, assets, getImage, onProgress = () => {} }) {
  const ids = [...new Set(collectImageIds(report))];
  const total = ids.length + report.rooms.length + 2;
  let done = 0;
  const step = () => { done += 1; onProgress(done, total); };

  const images = new Map();
  for (const id of ids) {
    try {
      const img = await getImage(id);
      if (img && img.data && img.w && img.h) images.set(id, { data: img.data, w: img.w, h: img.h, format: 'JPEG' });
    } catch (err) {
      console.warn('Photo could not be loaded, a placeholder is used instead:', id, err);
    }
    step();
  }

  const doc = new jsPDF({ unit: 'pt', format: 'a4', compress: true, putOnlyUsedFonts: true });
  doc.addFileToVFS('InstrumentSans-Regular.ttf', assets.fontRegular);
  doc.addFont('InstrumentSans-Regular.ttf', FONT.family, 'normal');
  doc.addFileToVFS('InstrumentSans-Bold.ttf', assets.fontBold);
  doc.addFont('InstrumentSans-Bold.ttf', FONT.family, 'bold');

  const d = new Draw(doc);
  const ctx = { doc, d, report, assets, images, innerPages: [] };
  const measure = makeMeasure(d);

  drawCover(ctx);

  doc.addPage();
  ctx.innerPages.push(doc.getNumberOfPages());
  drawDimensions(ctx);

  doc.addPage();
  ctx.innerPages.push(doc.getNumberOfPages());
  drawWater(ctx);
  step();

  for (const room of report.rooms) {
    drawRoom(ctx, room, measure);
    step();
    await tick();
  }

  doc.addPage();
  ctx.innerPages.push(doc.getNumberOfPages());
  drawDisclaimer(ctx);

  doc.addPage();
  drawThanks(ctx);

  for (const p of ctx.innerPages) {
    doc.setPage(p);
    drawHeader(ctx);
    drawFooter(ctx, p);
  }
  doc.setPage(doc.getNumberOfPages());

  const det = report.details;
  doc.setProperties({
    title: `${det.projectName || ''} ${det.unitNo || ''} - Property Inspection Report`.trim(),
    subject: `Inspection date ${formatDate(det.inspectionDate)}`,
    author: COMPANY.name,
    creator: COMPANY.name,
  });
  step();
  return doc;
}
