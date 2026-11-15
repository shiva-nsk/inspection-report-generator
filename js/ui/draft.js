// New report / Export draft / Import draft.

import { app, emit } from './app.js';
import { createEmptyReport, collectImageIds, pdfFileName, todayIso } from '../model.js';
import { replaceAll, exportDraftBlob, base64ToBlob } from '../store.js';
import { forgetAllImages } from '../images.js';
import { normalizeReport, stripMissingImages } from './normalize.js';
import { confirmDialog, messageDialog } from './modal.js';
import { startProgress } from './progress.js';
import { toast } from './toast.js';
import { saveBlob, plural } from './dom.js';
import { showPanel } from './nav.js';

const FORMAT = 'inspection-report-draft';
const VERSION = 1;
let working = false;

function reportLabel(report) {
  const d = report.details;
  return [d.projectName, d.unitNo].map((s) => (s || '').trim()).filter(Boolean).join(' · ') || 'Untitled report';
}

function hasContent(report) {
  const d = report.details;
  return !!(d.projectName.trim() || d.unitNo.trim() || d.customerName.trim()
    || report.rooms.length || report.dimensions.spaces.length || collectImageIds(report).length);
}

export async function newReport() {
  if (working) return;
  if (hasContent(app.report)) {
    const ok = await confirmDialog({
      title: 'Start a new report?',
      message: `This clears “${reportLabel(app.report)}” and all its photos from this browser. If you want to keep a copy, click Cancel and use “Export draft” first.`,
      confirmLabel: 'Clear and start new',
      danger: true,
    });
    if (!ok) return;
  }
  working = true;
  try {
    const report = createEmptyReport();
    await replaceAll(report, {});
    forgetAllImages();
    app.report = report;
    app.revision += 1;
    emit('reload');
    showPanel('details', { focusHeading: true });
    toast('New report started.', { type: 'success' });
  } catch (err) {
    console.error(err);
    toast('Could not clear the saved report. Please reload the page and try again.', { type: 'error' });
  } finally {
    working = false;
  }
}

export async function exportDraft() {
  if (working) return;
  working = true;
  const ids = [...new Set(collectImageIds(app.report))];
  const progress = startProgress('Preparing draft file', ids.length);
  try {
    const { blob, missing } = await exportDraftBlob(app.report, ids, (done) => progress.update(done));
    const name = `${pdfFileName(app.report.details).replace(/\.pdf$/i, '')} - draft ${todayIso()}.json`;
    saveBlob(blob, name);
    toast(`Draft saved as “${name}” (${plural(ids.length - missing, 'photo')}). Keep this file to continue later or on another computer.`, { type: 'success', timeout: 8000 });
    if (missing) toast(`${plural(missing, 'photo')} could not be found and ${missing === 1 ? 'was' : 'were'} left out.`, { type: 'error' });
  } catch (err) {
    console.error('Export failed', err);
    toast('Sorry, the draft could not be exported. Please try again.', { type: 'error' });
  } finally {
    progress.end();
    working = false;
  }
}

export async function importDraft(file) {
  if (working || !file) return;
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch (err) {
    console.error(err);
    await messageDialog('Not a draft file', `“${file.name}” could not be read. Please choose a draft file (.json) that was saved with “Export draft”.`);
    return;
  }
  if (!data || typeof data !== 'object' || data.format !== FORMAT || !data.report || typeof data.report !== 'object') {
    await messageDialog('Not a draft file', `“${file.name}” is not an inspection report draft. Please choose a file that was saved with “Export draft”.`);
    return;
  }
  if (Number(data.version) > VERSION) {
    await messageDialog('Newer draft', 'This draft was saved by a newer version of the app. Please update the app and try again.');
    return;
  }

  const report = normalizeReport(data.report);
  const images = data.images && typeof data.images === 'object' ? data.images : {};
  const wanted = [...new Set(collectImageIds(report))];
  const available = new Set(wanted.filter((id) => images[id] && typeof images[id].data === 'string'));

  const message = [`Replace the current report with “${reportLabel(report)}” from “${file.name}”?`];
  message.push(`It has ${plural(report.rooms.length, 'section')}, ${plural(report.rooms.reduce((n, r) => n + r.observations.length, 0), 'observation')} and ${plural(available.size, 'photo')}.`);
  if (hasContent(app.report)) message.push(`The current report (“${reportLabel(app.report)}”) will be replaced. Export it first if you want to keep it.`);
  const ok = await confirmDialog({ title: 'Import draft?', message: message.join(' '), confirmLabel: 'Replace and import', danger: hasContent(app.report) });
  if (!ok) return;

  working = true;
  const progress = startProgress('Importing photos', available.size);
  try {
    const records = {};
    let bad = 0;
    for (const id of available) {
      const img = images[id];
      try {
        records[id] = { blob: base64ToBlob(img.data, 'image/jpeg'), w: Number(img.w) || 0, h: Number(img.h) || 0 };
      } catch {
        bad += 1;
        available.delete(id);
      }
    }
    const missing = stripMissingImages(report, available);
    await replaceAll(report, records, (done) => progress.update(done));
    forgetAllImages();
    app.report = report;
    app.revision += 1;
    emit('reload');
    showPanel('details', { focusHeading: true });
    toast(`Draft “${reportLabel(report)}” imported.`, { type: 'success' });
    if (missing || bad) toast(`${plural(missing, 'photo')} in the draft could not be read and ${missing === 1 ? 'was' : 'were'} left out.`, { type: 'error' });
  } catch (err) {
    console.error('Import failed', err);
    toast('Sorry, the draft could not be imported (the browser may be out of storage space). Your previous report may have been cleared – try importing again.', { type: 'error', timeout: 12000 });
  } finally {
    progress.end();
    working = false;
  }
}
