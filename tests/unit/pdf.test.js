// End-to-end PDF generation in Node: rebuilds the original 66-page sample
// report from tests/fixtures/sample-1702.json and checks every page.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Draw } from '../../js/pdf/draw.js';
import { buildPdf } from '../build-sample.js';
import { createEmptyReport, createRoom, createObservation } from '../../js/model.js';

const sample = () => JSON.parse(readFileSync(new URL('../fixtures/sample-1702.json', import.meta.url), 'utf8'));

/** Build a PDF while recording every piece of text drawn, per page. */
async function buildAndRecord(report) {
  const pages = new Map();
  const original = Draw.prototype.text;
  Draw.prototype.text = function record(str, x, y, opts) {
    if (str !== null && str !== undefined && str !== '') {
      const page = this.doc.getCurrentPageInfo().pageNumber;
      if (!pages.has(page)) pages.set(page, []);
      pages.get(page).push(String(str));
    }
    return original.call(this, str, x, y, opts);
  };
  try {
    const doc = await buildPdf({ report });
    return { doc, pages };
  } finally {
    Draw.prototype.text = original;
  }
}

test('sample report: 66 pages, same as the original', async () => {
  const { doc } = await buildAndRecord(sample());
  assert.equal(doc.getNumberOfPages(), 66);
});

test('every inner page has the right header and page number; cover and last page have none', async () => {
  const { doc, pages } = await buildAndRecord(sample());
  const n = doc.getNumberOfPages();
  for (let p = 2; p < n; p += 1) {
    const t = pages.get(p) || [];
    assert.ok(t.includes('MY HOME SAYUK'), `page ${p} project name`);
    assert.ok(t.includes('UNIT NO. T-10-1702'), `page ${p} unit number`);
    assert.ok(t.includes(`PAGE  ${p}`), `page ${p} page number`);
    assert.equal(t.filter((s) => s.startsWith('PAGE  ')).length, 1, `page ${p} has one page number`);
  }
  assert.ok(!(pages.get(1) || []).some((s) => s.startsWith('PAGE')), 'cover has no footer');
  assert.ok(!(pages.get(n) || []).some((s) => s.startsWith('PAGE')), 'thank-you page has no footer');
});

test('page order: cover, dimensions, water, rooms, disclaimer, thank you', async () => {
  const { doc, pages } = await buildAndRecord(sample());
  const n = doc.getNumberOfPages();
  assert.ok(pages.get(1).includes('My Home Sayuk'));
  assert.ok(pages.get(1).includes('11 November 2026'));
  assert.ok(pages.get(1).includes('1364.86 sq ft'));
  assert.ok(pages.get(2).includes('Spaces & Dimensions'));
  assert.ok(pages.get(3).includes('Water Quality & Fittings'));
  assert.ok(pages.get(4).includes('Living Room'));
  assert.ok(pages.get(n - 1).includes('Disclaimer'));
  assert.ok(pages.get(n).includes('Thank you'));
});

test('each room starts on its own page with a heading, and all 162 observations are numbered', async () => {
  const report = sample();
  const { pages } = await buildAndRecord(report);
  const all = [...pages.values()].flat();
  for (const room of report.rooms) {
    const titlePages = [...pages.entries()].filter(([, t]) => t.includes(room.name) && t.includes('OBSERVATIONS') && t.includes('02'));
    assert.ok(titlePages.length >= 1, `${room.name} heading`);
  }
  const obsLabels = all.filter((s) => s === 'OBSERVATION').length;
  assert.equal(obsLabels, 162);
});

test('an empty report still produces a valid 5-page PDF', async () => {
  const { doc } = await buildAndRecord(createEmptyReport());
  assert.equal(doc.getNumberOfPages(), 5);
  const bytes = doc.output('arraybuffer');
  assert.ok(bytes.byteLength > 10000);
  assert.equal(new TextDecoder().decode(new Uint8Array(bytes).slice(0, 5)), '%PDF-');
});

test('missing photos and multi-photo observations do not break generation', async () => {
  const report = createEmptyReport();
  report.details.projectName = 'Test Project';
  report.details.unitNo = 'A-1';
  const room = createRoom('Kitchen');
  const o1 = createObservation([{ id: 'nope', w: 100, h: 100 }]);
  o1.description = 'Missing photo still renders';
  const o2 = createObservation(Array.from({ length: 4 }, (_, i) => ({ id: `ph${i}`, w: 800, h: 600 })));
  o2.description = 'Four photos side by side';
  o2.severity = 'major';
  const o3 = createObservation([]);
  o3.description = 'No photo at all';
  o3.severity = 'cosmetic';
  room.observations.push(o1, o2, o3);
  report.rooms.push(room);
  const { doc, pages } = await buildAndRecord(report);
  const n = doc.getNumberOfPages();
  assert.equal(n, 7); // the 4-photo block is taller, so the 3rd observation moves to a new page
  const t = [4, 5].flatMap((p) => pages.get(p));
  assert.ok(t.includes('MAJOR') && t.includes('MINOR') && t.includes('COSMETIC'));
  assert.ok(t.includes('01') && t.includes('02') && t.includes('03'));
  assert.ok(pages.get(5).includes('OBSERVATIONS 03'));
});

test('a photo that fails to load is replaced by a placeholder instead of failing', async () => {
  const { jsPDF } = await import('jspdf');
  const { generateReport, loadAssets } = await import('../../js/pdf/generate.js');
  const assets = await loadAssets(async (p) => new Uint8Array(readFileSync(new URL(`../../${p}`, import.meta.url))));
  const report = createEmptyReport();
  const room = createRoom('Balcony');
  const o = createObservation([{ id: 'broken', w: 800, h: 600 }]);
  o.description = 'Photo storage error';
  room.observations.push(o);
  report.rooms.push(room);
  const warn = console.warn;
  console.warn = () => {};
  try {
    const progress = [];
    const doc = await generateReport(report, {
      jsPDF, assets, getImage: async () => { throw new Error('disk error'); }, onProgress: (d, t) => progress.push([d, t]),
    });
    assert.equal(doc.getNumberOfPages(), 6);
    assert.deepEqual(progress.at(-1), [progress.at(-1)[1], progress.at(-1)[1]], 'progress reaches 100%');
  } finally {
    console.warn = warn;
  }
});
