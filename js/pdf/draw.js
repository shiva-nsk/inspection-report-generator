// Small drawing helpers on top of jsPDF.

import { FONT } from './theme.js';

// JPEG photos are embedded as-is; PNG artwork must be deflated or it is
// stored as raw pixels (megabytes per image).
function compressionFor(img) {
  return img.format === 'PNG' ? 'FAST' : 'NONE';
}

export class Draw {
  constructor(doc) {
    this.doc = doc;
  }

  font(size, bold = false) {
    this.doc.setFont(FONT.family, bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
  }

  /** Visible width of a string (letter spacing between characters only). */
  width(str, size, { bold = false, track = 0 } = {}) {
    if (!str) return 0;
    this.font(size, bold);
    return this.doc.getStringUnitWidth(str) * size + track * (str.length - 1);
  }

  /**
   * Draw one line of text at baseline y.
   * opts: size, bold, color, track (letter spacing), align: left|center|right
   */
  text(str, x, y, { size = 9, bold = false, color = '#000000', track = 0, align = 'left' } = {}) {
    if (str === null || str === undefined || str === '') return 0;
    const s = String(str);
    const w = this.width(s, size, { bold, track });
    let left = x;
    if (align === 'center') left = x - w / 2;
    else if (align === 'right') left = x - w;
    this.font(size, bold);
    this.doc.setTextColor(color);
    const options = { baseline: 'alphabetic' };
    if (track) options.charSpace = track;
    this.doc.text(s, left, y, options);
    return w;
  }

  /** Same as text() but shrinks letter spacing, then size, until it fits maxW. */
  fitText(str, x, y, maxW, opts = {}) {
    const o = { size: 9, track: 0, ...opts };
    let { size, track } = o;
    while (this.width(str, size, { bold: o.bold, track }) > maxW && track > 0.4) track -= 0.2;
    while (this.width(str, size, { bold: o.bold, track }) > maxW && size > 4) size -= 0.25;
    return this.text(str, x, y, { ...o, size, track });
  }

  /** Word-wrap to lines that fit maxW. */
  wrap(str, maxW, size, bold = false) {
    const s = String(str || '').replace(/\r\n?/g, '\n').trim();
    if (!s) return [];
    this.font(size, bold);
    return this.doc.splitTextToSize(s, maxW);
  }

  rect(x, y, w, h, color) {
    this.doc.setFillColor(color);
    this.doc.rect(x, y, w, h, 'F');
  }

  circle(cx, cy, r, color) {
    this.doc.setFillColor(color);
    this.doc.circle(cx, cy, r, 'F');
  }

  /** Draw an image stretched exactly into the box. */
  image(img, x, y, w, h, alias) {
    this.doc.addImage(img.data, img.format || 'JPEG', x, y, w, h, alias, compressionFor(img));
  }

  /** Draw an image filling the box (cropped, like CSS object-fit: cover). */
  imageCover(img, box, alias) {
    const scale = Math.max(box.w / img.w, box.h / img.h);
    const w = img.w * scale;
    const h = img.h * scale;
    const x = box.x + (box.w - w) / 2;
    const y = box.y + (box.h - h) / 2;
    const doc = this.doc;
    doc.saveGraphicsState();
    doc.rect(box.x, box.y, box.w, box.h, null);
    doc.clip();
    doc.discardPath();
    doc.addImage(img.data, img.format || 'JPEG', x, y, w, h, alias, compressionFor(img));
    doc.restoreGraphicsState();
  }

  /** Draw an image fitting inside the box keeping its aspect ratio, centred. */
  imageContain(img, box, alias) {
    const scale = Math.min(box.w / img.w, box.h / img.h);
    const w = img.w * scale;
    const h = img.h * scale;
    this.image(img, box.x + (box.w - w) / 2, box.y + (box.h - h) / 2, w, h, alias);
  }
}
