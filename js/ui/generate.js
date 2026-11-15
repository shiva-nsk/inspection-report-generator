// Step 5: checks, preview and download of the PDF.

import { app, on, reportStats } from './app.js';
import { validateReport, pdfFileName, pad2 } from '../model.js';
import { getImage } from '../store.js';
import { h, icon, saveBlob, plural, debounce } from './dom.js';
import { goTo, currentPanel, showPanel } from './nav.js';
import { startProgress } from './progress.js';
import { toast } from './toast.js';

let busy = false;
let cached = null; // { revision, blob }
let previewUrl = null;
let checksEl = null;
let statsEl = null;
let statusEl = null;
let frameWrap = null;
let frame = null;
let frameRevision = -1;

export function renderGenerate(panel) {
  checksEl = h('div', { class: 'checks' });
  statsEl = h('div', { class: 'stats' });
  statusEl = h('div', { class: 'gen-status', role: 'status' });
  frame = h('iframe', { class: 'pdf-frame', title: 'PDF preview' });
  frameWrap = h('div', { class: 'pdf-frame-wrap', hidden: true },
    h('div', { class: 'pdf-frame-head' },
      h('span', { class: 'pdf-frame-title' }, 'Preview'),
      h('span', { class: 'pdf-frame-stale', hidden: true }, 'You changed the report after this preview – click “Preview PDF” again to update it.')),
    frame);

  panel.replaceChildren(
    h('div', { class: 'panel-head' },
      h('h2', { tabindex: '-1' }, 'Preview & Generate'),
      h('p', { class: 'panel-intro' }, 'Check the report, look at a preview, then download the PDF to send to your customer.')),
    h('div', { class: 'card' }, h('h3', { class: 'card-title' }, 'Summary'), statsEl),
    h('div', { class: 'card' }, h('h3', { class: 'card-title' }, 'Checks'), checksEl),
    h('div', { class: 'card gen-actions' },
      h('div', { class: 'gen-buttons' },
        h('button', { type: 'button', class: 'btn btn-lg', 'data-pdf-btn': '', onclick: () => previewPdf() }, icon('eye'), 'Preview PDF'),
        h('button', { type: 'button', class: 'btn btn-primary btn-lg', 'data-pdf-btn': '', onclick: () => downloadPdf() }, icon('download'), 'Download PDF')),
      statusEl,
      h('p', { class: 'hint' }, 'Creating the PDF can take a few seconds for a report with many photos. Your work is saved in this browser automatically.')),
    frameWrap,
    h('div', { class: 'panel-foot' },
      h('button', { type: 'button', class: 'btn', 'data-goto': 'sections' }, icon('left'), 'Back'),
      h('span')),
  );
  frameRevision = -1;
  if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
  refreshChecks();
  setBusy(busy);
}

// ---------- checks ----------

/** Pairs each validateReport() message with where to fix it (same order as model.js). */
function locateProblems(report) {
  const map = new Map();
  const add = (text, loc) => {
    if (!map.has(text)) map.set(text, []);
    map.get(text).push(loc);
  };
  const q = (s) => CSS.escape(s);
  add('Project name is empty.', { panel: 'details', selector: '#f-projectName' });
  add('Unit number is empty.', { panel: 'details', selector: '#f-unitNo' });
  add('Customer name is empty.', { panel: 'details', selector: '#f-customerName' });
  add('Inspection date is empty.', { panel: 'details', selector: '#f-inspectionDate' });
  report.dimensions.spaces.forEach((s, i) => {
    add(`Dimensions: space #${i + 1} has no name.`, { panel: 'dimensions', selector: `[data-space-id="${q(s.id)}"] .space-name` });
    s.parts.forEach((p) => {
      const field = String(p.length).trim() ? '.part-width' : '.part-length';
      add(`Dimensions: "${s.name || `space #${i + 1}`}" has a row with missing length/width.`, { panel: 'dimensions', selector: `[data-part-id="${q(p.id)}"] ${field}` });
    });
  });
  report.rooms.forEach((r, i) => {
    const rn = r.name.trim() || `section #${i + 1}`;
    add(`Section #${i + 1} has no name.`, { panel: 'sections', roomId: r.id, selector: `[data-room-id="${q(r.id)}"] .room-name`, block: 'start' });
    r.observations.forEach((o, j) => {
      add(`${rn}: observation ${pad2(j + 1)} has no description.`, { panel: 'sections', roomId: r.id, selector: `#desc-${q(o.id)}` });
      add(`${rn}: observation ${pad2(j + 1)} has no photo.`, { panel: 'sections', roomId: r.id, selector: `[data-obs-id="${q(o.id)}"] .strip-add input` });
    });
  });
  return map;
}

function refreshChecks() {
  if (!checksEl || !app.report) return;
  const report = app.report;
  const t = reportStats(report);
  statsEl.replaceChildren(
    stat(t.sections, 'Sections'),
    stat(t.observations, 'Observations'),
    stat(t.photos, 'Photos'),
    stat(t.major, 'Major', 'major'),
    stat(t.minor, 'Minor', 'minor'),
    stat(t.cosmetic, 'Cosmetic', 'cosmetic'),
  );

  const problems = validateReport(report);
  if (!problems.length) {
    checksEl.replaceChildren(h('p', { class: 'check-ok' }, icon('check'), 'Everything looks complete. You’re ready to create the PDF.'));
  } else {
    const locs = locateProblems(report);
    const MAX = 60;
    const items = problems.slice(0, MAX).map((text) => {
      const loc = (locs.get(text) || []).shift();
      return h('li', {}, loc
        ? h('button', { type: 'button', class: 'link check-link', onclick: () => goTo(loc), title: 'Go to this field' }, text)
        : text);
    });
    if (problems.length > MAX) items.push(h('li', { class: 'muted' }, `…and ${problems.length - MAX} more.`));
    checksEl.replaceChildren(
      h('p', { class: 'check-warn' }, icon('alert'), `${plural(problems.length, 'thing')} to check. You can still create the PDF – these are only reminders. Click one to go to it.`),
      h('ul', { class: 'check-list' }, items),
    );
  }
  const stale = frameWrap && frameWrap.querySelector('.pdf-frame-stale');
  if (stale) stale.hidden = frameRevision === -1 || frameRevision === app.revision;
}

function stat(n, label, sev) {
  return h('div', { class: `stat${sev ? ` stat-${sev}` : ''}` }, h('span', { class: 'stat-num' }, String(n)), h('span', { class: 'stat-label' }, label));
}

const refreshSoon = debounce(() => { if (currentPanel() === 'generate') refreshChecks(); }, 300);
on('change', refreshSoon);
on('panel', (key) => { if (key === 'generate') refreshChecks(); });

// ---------- generating ----------

function setBusy(value) {
  busy = value;
  document.querySelectorAll('[data-pdf-btn]').forEach((b) => {
    b.disabled = value;
    b.setAttribute('aria-busy', String(value));
  });
  document.body.classList.toggle('is-generating', value);
}

function setStatus(text, type = '') {
  if (!statusEl) return;
  statusEl.className = `gen-status${type ? ` gen-status-${type}` : ''}`;
  const kids = [];
  if (text && type === 'busy') kids.push(h('span', { class: 'spinner', 'aria-hidden': 'true' }));
  if (text) kids.push(h('span', {}, text));
  statusEl.replaceChildren(...kids);
}

async function makePdf() {
  if (cached && cached.revision === app.revision) return cached.blob;
  let mod;
  try {
    mod = await import('../pdf/browser.js');
  } catch (err) {
    console.error('Could not load the PDF engine (js/pdf/browser.js)', err);
    throw Object.assign(new Error('engine'), { friendly: 'The PDF engine could not be loaded. Please reload the page and try again.' });
  }
  const revision = app.revision;
  const snapshot = structuredClone(app.report);
  const progress = startProgress('Creating PDF', 0);
  setStatus('Creating PDF…', 'busy');
  try {
    const blob = await mod.buildPdfBlob(snapshot, getImage, (done, total) => {
      progress.update(done, total);
      setStatus(total ? `Creating PDF… ${done}/${total}` : 'Creating PDF…', 'busy');
    });
    if (!(blob instanceof Blob)) throw new Error('buildPdfBlob did not return a Blob');
    cached = { revision, blob };
    return blob;
  } finally {
    progress.end();
  }
}

async function run(action) {
  if (busy) return;
  setBusy(true);
  try {
    const blob = await makePdf();
    await action(blob);
  } catch (err) {
    console.error('PDF generation failed', err);
    const msg = err.friendly || (/missing/i.test(err.message || '')
      ? 'Sorry, the PDF could not be created because a photo is missing. Try removing and re-adding the affected photo.'
      : 'Sorry, the PDF could not be created. Please try again. If it keeps happening, export a draft and send it to support.');
    setStatus(msg, 'error');
    toast(msg, { type: 'error' });
  } finally {
    setBusy(false);
  }
}

export function previewPdf() {
  if (currentPanel() !== 'generate') showPanel('generate');
  return run(async (blob) => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(blob);
    frame.src = previewUrl;
    frameRevision = cached ? cached.revision : app.revision;
    frameWrap.hidden = false;
    frameWrap.querySelector('.pdf-frame-stale').hidden = true;
    setStatus(`Preview ready (${formatSize(blob.size)}).`, 'ok');
    frameWrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

export function downloadPdf() {
  return run(async (blob) => {
    const name = pdfFileName(app.report.details);
    saveBlob(blob, name);
    setStatus(`Downloaded “${name}” (${formatSize(blob.size)}).`, 'ok');
    toast(`PDF downloaded: ${name}`, { type: 'success' });
  });
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

on('reload', () => { cached = null; });
