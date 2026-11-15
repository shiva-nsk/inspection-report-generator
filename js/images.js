// Photo handling: resize in the browser, store as JPEG, thumbnails.

import { newId } from './model.js';
import { putImage, getImageRecord, queueImageDelete } from './store.js';
import { toast } from './ui/toast.js';
import { startProgress } from './ui/progress.js';

// Photos print at most ~4 inches wide, and a ~180-photo report must stay
// email-friendly (~15 MB), so keep them modest.
export const MAX_SIDE = 1200;      // longest side of the stored photo, in pixels
export const JPEG_QUALITY = 0.75;  // quality of the stored photo
const THUMB_SIDE = 320;            // small copy used for the on-screen thumbnails
const THUMB_QUALITY = 0.72;
const CONCURRENCY = 2;

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|bmp|heic|heif|avif|tiff?)$/i;

export function isImageFile(file) {
  return (file.type && file.type.startsWith('image/')) || IMAGE_EXT.test(file.name || '');
}

function isHeic(file) {
  return /hei[cf]/i.test(file.type || '') || /\.hei[cf]$/i.test(file.name || '');
}

/** Natural sort by file name, so IMG_2.jpg comes before IMG_10.jpg (= camera order). */
export function sortFiles(files) {
  return [...files].sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { numeric: true, sensitivity: 'base' }));
}

// ---------- decode / encode ----------

async function decode(source) {
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(source, { imageOrientation: 'from-image' });
      return { source: bmp, w: bmp.width, h: bmp.height, release: () => bmp.close() };
    } catch { /* fall back to <img> */ }
  }
  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new Error('Empty image');
    return { source: img, w: img.naturalWidth, h: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function fitSize(w, h, max) {
  const s = Math.min(1, max / Math.max(w, h));
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))];
}

function encodeJpeg(source, w, h, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; // transparent PNGs become white, not black
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      canvas.width = 0;
      canvas.height = 0;
      if (blob) resolve(blob); else reject(new Error('Could not encode JPEG'));
    }, 'image/jpeg', quality);
  });
}

/** Resize + store one file. Returns an ImageRef { id, w, h }. */
async function processFile(file) {
  let dec;
  try {
    dec = await decode(file);
  } catch (err) {
    const e = new Error('decode');
    e.reason = isHeic(file) ? 'heic' : 'decode';
    e.cause = err;
    throw e;
  }
  try {
    const [w, h] = fitSize(dec.w, dec.h, MAX_SIDE);
    const blob = await encodeJpeg(dec.source, w, h, JPEG_QUALITY);
    const [tw, th] = fitSize(dec.w, dec.h, THUMB_SIDE);
    const thumb = await encodeJpeg(dec.source, tw, th, THUMB_QUALITY);
    const id = newId('img');
    try {
      await putImage(id, { blob, w, h, thumb });
    } catch (err) {
      const e = new Error('storage');
      e.reason = 'storage';
      e.cause = err;
      throw e;
    }
    return { id, w, h };
  } finally {
    dec.release();
  }
}

/**
 * Resize and store many photos (2 at a time) with a progress panel.
 * Non-images are skipped with a message; unreadable photos are reported.
 * Returns ImageRefs in file-name order.
 */
export async function addImageFiles(fileList, { label = 'Adding photos' } = {}) {
  const files = sortFiles(fileList || []);
  const images = files.filter(isImageFile);
  const skipped = files.filter((f) => !isImageFile(f));
  if (skipped.length) {
    toast(`${skipped.length === 1 ? `"${skipped[0].name}" was` : `${skipped.length} files were`} skipped because ${skipped.length === 1 ? 'it is' : 'they are'} not a photo.`, { type: 'error' });
  }
  if (!images.length) return [];

  const progress = startProgress(label, images.length);
  const results = new Array(images.length).fill(null);
  const failed = { heic: [], decode: [], storage: [] };
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < images.length) {
      const i = next;
      next += 1;
      try {
        results[i] = await processFile(images[i]);
      } catch (err) {
        console.error(`Could not add photo "${images[i].name}"`, err.cause || err);
        (failed[err.reason] || failed.decode).push(images[i].name);
      }
      done += 1;
      progress.update(done);
    }
  };
  try {
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, images.length) }, worker));
  } finally {
    progress.end();
  }

  const names = (list) => (list.length <= 3 ? list.map((n) => `"${n}"`).join(', ') : `${list.slice(0, 3).map((n) => `"${n}"`).join(', ')} and ${list.length - 3} more`);
  if (failed.heic.length) {
    toast(`This photo format isn't supported, please export as JPG: ${names(failed.heic)}.`, { type: 'error', timeout: 12000 });
  }
  if (failed.decode.length) {
    toast(`Could not read ${failed.decode.length === 1 ? 'this photo' : 'these photos'}: ${names(failed.decode)}. Please try a JPG or PNG copy.`, { type: 'error', timeout: 12000 });
  }
  if (failed.storage.length) {
    toast(`Not enough storage space in this browser to add ${failed.storage.length === 1 ? 'a photo' : `${failed.storage.length} photos`}. Export a draft and remove unused photos, or free up disk space.`, { type: 'error', timeout: 12000 });
  }
  return results.filter(Boolean);
}

// ---------- thumbnails ----------

const thumbPromises = new Map(); // id -> Promise<objectURL>
const thumbUrls = new Map(); // id -> objectURL (resolved)

function limiter(n) {
  let active = 0;
  const queue = [];
  const pump = () => {
    if (active >= n || !queue.length) return;
    active += 1;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => { active -= 1; pump(); });
  };
  return (fn) => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); pump(); });
}
const thumbLimit = limiter(2);

async function loadThumbUrl(id) {
  const rec = await getImageRecord(id);
  if (!rec || !rec.blob) throw new Error(`Photo ${id} missing`);
  let thumb = rec.thumb;
  if (!thumb) {
    // e.g. imported drafts: make the small copy once and keep it
    thumb = await thumbLimit(async () => {
      const dec = await decode(rec.blob);
      try {
        const [tw, th] = fitSize(dec.w, dec.h, THUMB_SIDE);
        return await encodeJpeg(dec.source, tw, th, THUMB_QUALITY);
      } finally {
        dec.release();
      }
    }).catch(() => rec.blob);
    if (thumb !== rec.blob) putImage(id, { ...rec, thumb }).catch(() => {});
  }
  const url = URL.createObjectURL(thumb);
  thumbUrls.set(id, url);
  return url;
}

export function thumbUrl(id) {
  if (!thumbPromises.has(id)) {
    const p = loadThumbUrl(id);
    thumbPromises.set(id, p);
    p.catch(() => thumbPromises.delete(id));
  }
  return thumbPromises.get(id);
}

let observer = null;

function loadInto(img) {
  const id = img.dataset.imgId;
  thumbUrl(id).then((url) => {
    if (img.dataset.imgId === id) img.src = url;
  }).catch(() => {
    img.alt = 'Photo missing';
    const holder = img.closest('.thumb, .single-thumb');
    if (holder) holder.classList.add('thumb-missing');
  });
}

/** Set an <img>'s thumbnail when it scrolls near the screen. */
export function lazyThumb(img, id) {
  img.dataset.imgId = id;
  const ready = thumbUrls.get(id);
  if (ready) { img.src = ready; return; }
  if (typeof IntersectionObserver === 'undefined') { loadInto(img); return; }
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          observer.unobserve(e.target);
          loadInto(e.target);
        }
      }
    }, { rootMargin: '600px 0px' });
  }
  observer.observe(img);
}

export function unobserveThumbs(root) {
  if (!observer || !root) return;
  root.querySelectorAll('img[data-img-id]').forEach((img) => observer.unobserve(img));
}

/** Object URL of the full stored photo (caller must revoke it). */
export async function fullImageUrl(id) {
  const rec = await getImageRecord(id);
  if (!rec || !rec.blob) throw new Error(`Photo ${id} missing`);
  return URL.createObjectURL(rec.blob);
}

/** Drop the cached thumbnail URL of an image. */
export function forgetImage(id) {
  const url = thumbUrls.get(id);
  if (url) URL.revokeObjectURL(url);
  thumbUrls.delete(id);
  thumbPromises.delete(id);
}

export function forgetAllImages() {
  thumbUrls.forEach((url) => URL.revokeObjectURL(url));
  thumbUrls.clear();
  thumbPromises.clear();
}

/** Images removed from the report: free thumbnails and delete the blobs after the next save. */
export function discardImages(ids) {
  const list = ids.filter(Boolean);
  if (!list.length) return;
  list.forEach(forgetImage);
  queueImageDelete(list);
}
