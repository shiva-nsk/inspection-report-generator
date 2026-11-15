// Photo widgets: thumbnail strip (many photos), single photo, drop zones, viewer.

import { h, icon, iconButton } from './dom.js';
import { addImageFiles, discardImages, lazyThumb, unobserveThumbs, fullImageUrl } from '../images.js';
import { openDialog } from './modal.js';
import { toast } from './toast.js';

// ---------- drag & drop ----------

function hasFiles(e) {
  const types = e.dataTransfer && e.dataTransfer.types;
  return !!types && Array.from(types).includes('Files');
}

function clearDropHighlights(except) {
  document.querySelectorAll('.drop-over').forEach((z) => { if (z !== except) z.classList.remove('drop-over'); });
}

/** Makes el accept dropped image files. The innermost zone wins. */
export function makeDropZone(el, onFiles) {
  el.classList.add('drop-zone');
  const over = (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    clearDropHighlights(el);
    el.classList.add('drop-over');
  };
  el.addEventListener('dragenter', over);
  el.addEventListener('dragover', over);
  el.addEventListener('dragleave', (e) => {
    if (!el.contains(e.relatedTarget)) el.classList.remove('drop-over');
  });
  el.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.stopPropagation();
    clearDropHighlights(null);
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length) onFiles(files);
  });
}

/** Stop the browser from opening a photo dropped outside a drop zone. */
export function installGlobalDropGuard() {
  window.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'none';
  });
  window.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    clearDropHighlights(null);
  });
  window.addEventListener('dragend', () => clearDropHighlights(null));
}

// ---------- viewer ----------

export async function showPhoto(ref, caption) {
  let url;
  try {
    url = await fullImageUrl(ref.id);
  } catch {
    toast('This photo could not be found.', { type: 'error' });
    return;
  }
  const img = h('img', { src: url, alt: caption || 'Photo', class: 'viewer-img' });
  await openDialog({
    title: caption || 'Photo',
    body: [img, h('p', { class: 'hint' }, `${ref.w} × ${ref.h} pixels`)],
    buttons: [{ label: 'Close', value: 'ok', kind: 'primary', autofocus: true }],
    className: 'dialog-viewer',
  });
  URL.revokeObjectURL(url);
}

// ---------- file picker button ----------

/** A <label> styled as a button that wraps a real (visually hidden) file input. */
export function fileButton({ label, className = 'btn', multiple = true, iconName = 'plus', onFiles, ariaLabel }) {
  const input = h('input', {
    type: 'file',
    accept: 'image/*',
    multiple,
    class: 'sr-only',
    'aria-label': ariaLabel || label,
  });
  input.addEventListener('change', () => {
    const files = Array.from(input.files || []);
    input.value = '';
    if (files.length) onFiles(files);
  });
  return h('label', { class: `file-btn ${className}`.trim() }, input, iconName ? icon(iconName) : null, h('span', {}, label));
}

/** Remove photo(s) with an Undo option; blobs are deleted when the message expires. */
export function removeWithUndo(message, ids, restore) {
  toast(message, {
    action: { label: 'Undo', run: restore },
    onExpire: () => discardImages(ids),
  });
}

// ---------- strip of many photos ----------

/**
 * photoStrip({ list: () => ImageRef[] (mutable array), onChange, label, addLabel, emptyText, compact, caption })
 * The returned element has .refresh().
 */
export function photoStrip({ list, onChange, label, addLabel = 'Add photos', emptyText = '', compact = false, caption = () => label }) {
  const el = h('div', { class: `strip${compact ? ' strip-compact' : ''}` });
  const thumbs = h('ul', { class: 'strip-thumbs', 'aria-label': label });
  const empty = emptyText ? h('p', { class: 'strip-empty' }, emptyText) : null;
  const add = fileButton({
    label: addLabel,
    className: 'strip-add',
    ariaLabel: `${addLabel} (${label})`,
    onFiles: (files) => addFiles(files),
  });

  async function addFiles(files) {
    const refs = await addImageFiles(files);
    if (!refs.length) return;
    list().push(...refs);
    refresh();
    onChange();
  }

  function remove(i) {
    const arr = list();
    const [ref] = arr.splice(i, 1);
    if (!ref) return;
    refresh();
    onChange();
    const btns = thumbs.querySelectorAll('.thumb-remove');
    (btns[Math.min(i, btns.length - 1)] || add.querySelector('input')).focus();
    removeWithUndo('Photo removed.', [ref.id], () => {
      const a = list();
      a.splice(Math.min(i, a.length), 0, ref);
      refresh();
      onChange();
    });
  }

  function move(i, d) {
    const arr = list();
    const j = i + d;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    refresh();
    onChange();
    const item = thumbs.children[j];
    const btn = item && (item.querySelector(d < 0 ? '.thumb-left' : '.thumb-right') || item.querySelector('.thumb-view'));
    if (btn) btn.focus();
  }

  function refresh() {
    unobserveThumbs(thumbs);
    const arr = list();
    thumbs.replaceChildren(...arr.map((ref, i) => {
      const img = h('img', { alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' });
      lazyThumb(img, ref.id);
      const n = arr.length;
      return h('li', { class: 'thumb' },
        h('button', {
          type: 'button',
          class: 'thumb-view',
          'aria-label': `View photo ${i + 1} of ${n}`,
          title: 'Click to view larger',
          onclick: () => showPhoto(ref, `${caption()} – photo ${i + 1} of ${n}`),
        }, img),
        iconButton('x', `Remove photo ${i + 1}`, () => remove(i), 'thumb-remove'),
        n > 1 ? h('div', { class: 'thumb-move' },
          iconButton('left', `Move photo ${i + 1} left`, () => move(i, -1), 'thumb-left'),
          iconButton('right', `Move photo ${i + 1} right`, () => move(i, 1), 'thumb-right')) : null);
    }), h('li', { class: 'thumb-add-slot' }, add));
    const kids = thumbs.querySelectorAll('.thumb-left, .thumb-right');
    kids.forEach((b) => {
      const li = b.closest('.thumb');
      const idx = Array.prototype.indexOf.call(thumbs.children, li);
      if ((b.classList.contains('thumb-left') && idx === 0) || (b.classList.contains('thumb-right') && idx === arr.length - 1)) b.disabled = true;
    });
    if (empty) empty.hidden = arr.length > 0;
    el.classList.toggle('is-empty', arr.length === 0);
  }

  el.append(thumbs);
  if (empty) el.append(empty);
  makeDropZone(el, addFiles);
  refresh();
  el.refresh = refresh;
  return el;
}

// ---------- single photo (TDS / pH) ----------

/** singlePhoto({ get: () => ImageRef|null, set: (ref|null) => void, label }) */
export function singlePhoto({ get, set, label }) {
  const el = h('div', { class: 'single-photo' });

  async function addFiles(files) {
    const refs = await addImageFiles(files.slice(0, 1));
    if (!refs.length) return;
    const old = get();
    set(refs[0]);
    if (old) discardImages([old.id]);
    refresh();
    if (files.length > 1) toast('Only one photo is used here – the first one was added.');
  }

  function refresh() {
    unobserveThumbs(el);
    const ref = get();
    let thumb;
    if (ref) {
      const img = h('img', { alt: '', loading: 'lazy', decoding: 'async' });
      lazyThumb(img, ref.id);
      thumb = h('button', { type: 'button', class: 'single-thumb', 'aria-label': `View ${label}`, title: 'Click to view larger', onclick: () => showPhoto(ref, label) }, img);
    } else {
      thumb = h('div', { class: 'single-thumb single-empty' }, icon('image'), h('span', {}, 'No photo'));
    }
    const pick = fileButton({
      label: ref ? 'Replace photo' : 'Add photo',
      className: 'btn btn-small',
      multiple: false,
      iconName: ref ? 'image' : 'plus',
      ariaLabel: `${ref ? 'Replace' : 'Add'} ${label}`,
      onFiles: addFiles,
    });
    const remove = ref ? h('button', {
      type: 'button',
      class: 'btn btn-small btn-ghost-danger',
      onclick: () => {
        const old = get();
        set(null);
        refresh();
        removeWithUndo(`${label} removed.`, [old.id], () => { set(old); refresh(); });
      },
    }, icon('trash'), 'Remove') : null;
    el.replaceChildren(thumb, h('div', { class: 'single-actions' }, pick, remove, h('p', { class: 'hint' }, 'or drop a photo here')));
  }

  makeDropZone(el, addFiles);
  refresh();
  el.refresh = refresh;
  return el;
}
