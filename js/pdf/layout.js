// Pure layout maths for the observation pages (no drawing).
// Kept separate so it can be unit-tested in Node.

import { OBS } from './theme.js';
import { pad2 } from '../model.js';

/**
 * Rectangles for n photos inside a photo area.
 * 1 photo: fills the area. 2: side by side. 3+: 2-column grid; an odd last
 * photo spans the full width.
 */
export function photoGrid(n, x, y, w, h) {
  if (n <= 0) return [];
  if (n === 1) return [{ x, y, w, h }];
  const gap = OBS.gridGap;
  const colW = (w - gap) / 2;
  if (n === 2) return [{ x, y, w: colW, h }, { x: x + colW + gap, y, w: colW, h }];
  const rows = Math.ceil(n / 2);
  const rowH = (h - gap * (rows - 1)) / rows;
  const rects = [];
  for (let i = 0; i < n; i += 1) {
    const r = Math.floor(i / 2);
    const c = i % 2;
    const last = i === n - 1 && n % 2 === 1;
    rects.push({
      x: last ? x : x + c * (colW + gap),
      y: y + r * (rowH + gap),
      w: last ? w : colW,
      h: rowH,
    });
  }
  return rects;
}

/** Height of the photo area for n photos. */
export function photoAreaHeight(n) {
  if (n <= 2) return OBS.photoH;
  const rows = Math.ceil(n / 2);
  return Math.max(OBS.photoH, rows * OBS.gridRowH + (rows - 1) * OBS.gridGap);
}

/**
 * Vertical positions inside the observation card, relative to block top.
 * descLines / locLines: number of wrapped lines.
 */
export function cardMetrics(descLines, locLines = 1) {
  const d = Math.max(1, descLines);
  const l = Math.max(1, locLines);
  const numberBase = 31.4;
  const descBase = numberBase + 19.3;
  const lastDescBase = descBase + (d - 1) * OBS.descLine;
  const rule = lastDescBase + 6;
  const locLabelBase = rule + 15.6;
  const locBase = locLabelBase + 12.5;
  const lastLocBase = locBase + (l - 1) * OBS.locLine;
  const sevLabelBase = lastLocBase + 18;
  const badgeTop = sevLabelBase + 4.6;
  const badgeH = 9.2;
  const height = badgeTop + badgeH + 16;
  return { numberBase, descBase, rule, locLabelBase, locBase, sevLabelBase, badgeTop, badgeH, height };
}

/**
 * Split a room's observations into drawable blocks.
 * measure: { descLines(text) -> string[], locLines(text) -> string[] }
 */
export function observationBlocks(room, measure, locationOf) {
  const blocks = [];
  room.observations.forEach((obs, i) => {
    const number = i + 1;
    const desc = measure.descLines(obs.description || '');
    const loc = measure.locLines(locationOf(room, obs));
    const card = cardMetrics(desc.length, loc.length);
    const photos = obs.photos || [];
    const chunks = [];
    for (let k = 0; k < Math.max(1, photos.length); k += OBS.maxPhotosPerBlock) {
      chunks.push(photos.slice(k, k + OBS.maxPhotosPerBlock));
    }
    chunks.forEach((chunk, ci) => {
      blocks.push({
        type: 'obs',
        number,
        obs,
        photos: chunk,
        continued: ci > 0,
        desc,
        loc,
        card,
        height: Math.max(photoAreaHeight(chunk.length), card.height),
      });
    });
  });
  return blocks;
}

/** "03 – 05", "18", or "" */
export function rangeLabel(numbers) {
  const uniq = [...new Set(numbers)].sort((a, b) => a - b);
  if (!uniq.length) return '';
  if (uniq.length === 1) return pad2(uniq[0]);
  return `${pad2(uniq[0])} – ${pad2(uniq[uniq.length - 1])}`;
}

/**
 * Lay out one room over as many pages as needed.
 * Returns [{ first, label, items: [{ type:'space', images, y, h } | { ...block, y }] }]
 */
export function paginateRoom(room, measure, locationOf) {
  const pages = [];
  const hasSpace = room.spaceImages.length > 0;
  let page = { first: true, items: [] };
  pages.push(page);
  let y = hasSpace ? OBS.spaceTop : HEADING_END + OBS.afterHeadingGap;
  let prev = null; // type of the previous item on this page

  const newPage = () => {
    page = { first: false, items: [] };
    pages.push(page);
    y = OBS.contentTop;
    prev = null;
  };

  // Space images: rows of two.
  for (let i = 0; i < room.spaceImages.length; i += 2) {
    const h = OBS.spaceRowH;
    let top = prev ? y + OBS.spaceGap : y;
    if (top + h > OBS.bottom && prev) { newPage(); top = y; }
    page.items.push({ type: 'space', images: room.spaceImages.slice(i, i + 2), y: top, h });
    y = top + h;
    prev = 'space';
  }

  for (const block of observationBlocks(room, measure, locationOf)) {
    const gap = prev === 'space' ? OBS.afterSpaceGap : prev ? OBS.blockGap : 0;
    let top = y + gap;
    if (top + block.height > OBS.bottom && prev) { newPage(); top = y; }
    page.items.push({ ...block, y: top });
    y = top + block.height;
    prev = 'obs';
  }

  for (const p of pages) {
    const nums = p.items.filter((it) => it.type === 'obs').map((it) => it.number);
    p.label = nums.length ? `OBSERVATIONS ${rangeLabel(nums)}` : 'SPACE IMAGES';
  }
  return pages;
}

// Bottom of the heading block (subtitle baseline) on a room's first page.
export const HEADING_END = 138.4;
