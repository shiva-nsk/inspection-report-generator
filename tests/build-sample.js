// Builds a PDF from a saved report JSON, outside the browser.
//
//   node tests/build-sample.js [--fixture tests/fixtures/sample-1702.json]
//                              [--photos <folder with <id>.jpg files>]
//                              [--out tests/output/sample-1702.pdf]
//
// Without --photos every photo is replaced by a grey placeholder picture.

import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jsPDF } from 'jspdf';
import { generateReport, loadAssets } from '../js/pdf/generate.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function buildPdf({ report, photosDir = null }) {
  const assets = await loadAssets(async (p) => new Uint8Array(await readFile(join(ROOT, p))));
  const placeholders = {
    landscape: { data: new Uint8Array(await readFile(join(ROOT, 'tests/fixtures/placeholder-landscape.jpg'))), w: 800, h: 600 },
    portrait: { data: new Uint8Array(await readFile(join(ROOT, 'tests/fixtures/placeholder-portrait.jpg'))), w: 600, h: 800 },
  };
  const sizes = new Map();
  const remember = (ref) => { if (ref) sizes.set(ref.id, ref); };
  remember(report.water.tdsPhoto);
  remember(report.water.phPhoto);
  report.rooms.forEach((r) => {
    r.spaceImages.forEach(remember);
    r.observations.forEach((o) => o.photos.forEach(remember));
  });

  const getImage = async (id) => {
    const ref = sizes.get(id);
    if (photosDir) {
      const file = join(photosDir, `${id}.jpg`);
      try {
        await access(file);
        return { data: new Uint8Array(await readFile(file)), w: ref.w, h: ref.h };
      } catch { /* fall through to placeholder */ }
    }
    return ref && ref.h > ref.w ? placeholders.portrait : placeholders.landscape;
  };
  return generateReport(report, { jsPDF, assets, getImage });
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (name, def) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : def;
  };
  const fixture = resolve(opt('--fixture', join(ROOT, 'tests/fixtures/sample-1702.json')));
  const photosDir = opt('--photos', null);
  const out = resolve(opt('--out', join(ROOT, 'tests/output/sample-1702.pdf')));

  const report = JSON.parse(await readFile(fixture, 'utf8'));
  const t0 = Date.now();
  const doc = await buildPdf({ report, photosDir: photosDir && resolve(photosDir) });
  const bytes = Buffer.from(doc.output('arraybuffer'));
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, bytes);
  console.log(`Wrote ${out}`);
  console.log(`${doc.getNumberOfPages()} pages, ${(bytes.length / 1024 / 1024).toFixed(2)} MB, ${Date.now() - t0} ms`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
