// App start-up: load the saved draft, render every step, wire the top bar.

import { createEmptyReport, collectImageIds, coverPropertyLine } from './model.js';
import { ROOM_PRESETS, FITTING_PRESETS } from './presets.js';
import * as store from './store.js';
import { app, on } from './ui/app.js';
import { h } from './ui/dom.js';
import { normalizeReport, stripMissingImages } from './ui/normalize.js';
import { renderNav, showPanel, initialPanel, panelEl } from './ui/nav.js';
import { renderDetails } from './ui/details.js';
import { renderDimensions } from './ui/dimensions.js';
import { renderWater } from './ui/water.js';
import { renderSections } from './ui/sections.js';
import { renderGenerate, previewPdf, downloadPdf } from './ui/generate.js';
import { newReport, exportDraft, importDraft } from './ui/draft.js';
import { installGlobalDropGuard } from './ui/photos.js';
import { toast } from './ui/toast.js';
import { plural } from './ui/dom.js';

const PROPERTY_TYPES = ['1 BHK', '2 BHK', '3 BHK', '4 BHK', 'Villa'];

function fillDatalist(id, values) {
  const dl = document.getElementById(id);
  if (dl) dl.replaceChildren(...values.map((v) => h('option', { value: v })));
}

function renderAll() {
  renderDetails(panelEl('details'));
  renderDimensions(panelEl('dimensions'));
  renderWater(panelEl('water'));
  renderSections(panelEl('sections'));
  renderGenerate(panelEl('generate'));
  updateReportName();
}

// ---------- top bar ----------

function updateReportName() {
  const d = app.report.details;
  const name = [d.projectName, d.unitNo].map((s) => (s || '').trim()).filter(Boolean).join(' · ');
  const el = document.getElementById('report-name');
  if (el) {
    el.textContent = name || 'Untitled report';
    el.title = [name, coverPropertyLine(d), d.customerName].filter(Boolean).join(' – ') || 'Untitled report';
  }
  document.title = name ? `${name} – Inspection Report` : 'Inspection Report Generator';
}

function initSaveStatus() {
  const el = document.getElementById('save-status');
  const set = (text, cls, title = '') => {
    el.textContent = text;
    el.className = `save-status ${cls}`;
    el.title = title;
  };
  if (!store.isPersistent()) {
    set('Not saved', 'is-error', 'This browser does not allow saving. Use “Export draft” to keep your work.');
  } else {
    set('Saved ✓', 'is-saved', 'Your work is saved in this browser automatically.');
  }
  let lastError = 0;
  store.onSaveStatus((status, err) => {
    if (!store.isPersistent()) return;
    if (status === 'saving') set('Saving…', 'is-saving');
    else if (status === 'saved') set('Saved ✓', 'is-saved', 'Your work is saved in this browser automatically.');
    else if (status === 'error') {
      set('Not saved!', 'is-error', 'Saving failed. Export a draft to keep a copy of your work.');
      if (Date.now() - lastError > 30000) {
        lastError = Date.now();
        const full = err && (err.name === 'QuotaExceededError' || /quota/i.test(err.message || ''));
        toast(full
          ? 'The browser is out of storage space, so your latest changes are not saved. Use “Export draft” now to keep a copy.'
          : 'Your latest changes could not be saved. Use “Export draft” now to keep a copy.', { type: 'error', timeout: 12000 });
      }
    }
  });
}

function initTopbar() {
  document.getElementById('btn-new').addEventListener('click', () => newReport());
  document.getElementById('btn-export').addEventListener('click', () => exportDraft());
  const importInput = document.getElementById('input-import');
  importInput.addEventListener('change', () => {
    const file = importInput.files && importInput.files[0];
    importInput.value = '';
    if (file) importDraft(file);
  });
  document.getElementById('btn-preview').addEventListener('click', () => previewPdf());
  document.getElementById('btn-download').addEventListener('click', () => downloadPdf());
}

// ---------- start ----------

/** Delete stored photos the report no longer uses; drop references to photos that are gone. */
async function reconcileImages() {
  if (!store.isPersistent()) return;
  let stored;
  try {
    stored = new Set(await store.listImageIds());
  } catch (err) {
    console.warn('Could not list stored photos', err);
    return;
  }
  const referenced = new Set(collectImageIds(app.report));
  const orphans = [...stored].filter((id) => !referenced.has(id));
  if (orphans.length) store.deleteImages(orphans).catch((e) => console.warn('Photo cleanup failed', e));
  const missing = [...referenced].filter((id) => !stored.has(id));
  if (missing.length) {
    stripMissingImages(app.report, stored);
    store.scheduleSave(app.report);
    toast(`${plural(missing.length, 'photo')} could not be found in this browser and ${missing.length === 1 ? 'was' : 'were'} removed from the report.`, { type: 'error', timeout: 10000 });
  }
}

function warnOtherTabs() {
  if (typeof BroadcastChannel === 'undefined') return;
  const ch = new BroadcastChannel('inspection-report');
  let warned = false;
  ch.onmessage = (e) => {
    if (e.data === 'hello') ch.postMessage('here');
    if ((e.data === 'here' || e.data === 'hello') && !warned) {
      warned = true;
      toast('This app is also open in another tab. Please use only one tab, otherwise changes can overwrite each other.', { type: 'error', timeout: 15000 });
    }
  };
  ch.postMessage('hello');
}

async function boot() {
  fillDatalist('dl-rooms', ROOM_PRESETS.map((r) => r.name));
  fillDatalist('dl-fittings', FITTING_PRESETS);
  fillDatalist('dl-proptypes', PROPERTY_TYPES);
  installGlobalDropGuard();

  const persistent = await store.init();
  let raw = null;
  if (persistent) {
    try {
      raw = await store.loadReport();
    } catch (err) {
      console.error('Could not load the saved report', err);
      toast('The saved report could not be loaded. Starting a new one.', { type: 'error' });
    }
  } else {
    toast('This browser does not allow saving (private window?). Your work will be lost when you close the tab – use “Export draft” to keep it.', { type: 'error', timeout: 15000 });
  }
  app.report = raw ? normalizeReport(raw) : createEmptyReport();
  await reconcileImages();

  renderNav(document.getElementById('sidenav'));
  renderAll();
  initSaveStatus();
  initTopbar();
  showPanel(initialPanel());

  on('details', updateReportName);
  on('reload', renderAll);

  // save straight away when the tab is hidden or closed
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') store.flushSave(); });
  window.addEventListener('pagehide', () => { store.flushSave(); });
  window.addEventListener('beforeunload', () => { if (store.hasPendingSave()) store.flushSave(); });

  store.requestPersistence();
  warnOtherTabs();
  document.body.classList.remove('is-loading');
}

boot().catch((err) => {
  console.error('Start-up failed', err);
  const main = document.getElementById('main');
  if (main) {
    main.replaceChildren(h('div', { class: 'card fatal' },
      h('h2', {}, 'Something went wrong while starting'),
      h('p', {}, 'Please reload the page. If this keeps happening, try another browser (Chrome or Edge).')));
  }
  document.body.classList.remove('is-loading');
});
