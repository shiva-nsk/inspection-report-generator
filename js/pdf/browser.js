// Browser entry point used by the UI.

import { generateReport, loadAssets } from './generate.js';

let assetsPromise = null;

async function fetchBytes(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Could not load ${path} (${res.status})`);
  return new Uint8Array(await res.arrayBuffer());
}

function getAssets() {
  if (!assetsPromise) {
    assetsPromise = loadAssets(fetchBytes).catch((err) => {
      assetsPromise = null;
      throw err;
    });
  }
  return assetsPromise;
}

/**
 * @param report    report JSON
 * @param getImage  id -> Promise<{ data: Uint8Array, w, h }>
 * @param onProgress (done, total) => void
 * @returns Promise<Blob> (application/pdf)
 */
export async function buildPdfBlob(report, getImage, onProgress) {
  if (!window.jspdf || !window.jspdf.jsPDF) throw new Error('PDF library (vendor/jspdf.umd.min.js) is not loaded.');
  const assets = await getAssets();
  const doc = await generateReport(report, { jsPDF: window.jspdf.jsPDF, assets, getImage, onProgress });
  return doc.output('blob');
}
