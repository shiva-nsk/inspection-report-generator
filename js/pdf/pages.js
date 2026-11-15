// One function per page type. Coordinates come from the original report.

import { COLORS, PAGE, TRACK, MARGIN, HEADER, FOOTER, HEADING, OBS } from './theme.js';
import { paginateRoom, photoGrid, photoAreaHeight } from './layout.js';
import { COMPANY, COVER, SEVERITY_GUIDE, THANK_YOU, DISCLAIMER } from '../config.js';
import {
  formatDate, coverPropertyLine, totalArea, partArea, fmt2, pad2,
  roomSubtitle, observationLocation,
} from '../model.js';

const SEVERITY_COLOR = { major: COLORS.major, minor: COLORS.minor, cosmetic: COLORS.cosmetic };
const SEVERITY_LABEL = { major: 'MAJOR', minor: 'MINOR', cosmetic: 'COSMETIC' };

// Same frame the original uses for the cover artwork (3:4 artwork on A4).
const ART_FRAME = { x: 28.3, y: 61, w: 539.4, h: 720 };

// ---------------------------------------------------------------- shared

export function drawHeader(ctx) {
  const { d, report, assets } = ctx;
  const { y, h } = HEADER;
  d.rect(MARGIN.left, y, HEADER.logoCellRight - MARGIN.left, h, COLORS.blue);
  d.rect(HEADER.logoCellRight + 0.6, y, MARGIN.right - 0.7 - HEADER.logoCellRight - 0.6, h, COLORS.blue);
  const L = HEADER.logo;
  d.image(assets.logoHeader, L.x, L.y, L.w, L.h, 'logo-header');
  const opts = { size: HEADER.fontSize, color: COLORS.white, track: TRACK, align: 'center' };
  const project = (report.details.projectName || '').toUpperCase();
  const unit = `UNIT NO. ${(report.details.unitNo || '').toUpperCase()}`;
  d.fitText(project, HEADER.projectCenter, HEADER.textBaseline, 180, opts);
  d.fitText(unit, HEADER.unitCenter, HEADER.textBaseline, 136, opts);
}

export function drawFooter(ctx, pageNo) {
  const { d } = ctx;
  d.rect(MARGIN.left + 0.1, FOOTER.y, MARGIN.right - 0.7 - MARGIN.left, FOOTER.h, COLORS.blue);
  const base = FOOTER.baseline;
  d.text(COMPANY.phone.replace(/\s+/g, ' '), FOOTER.phoneX, base, { size: 6.96, color: COLORS.white, track: TRACK });
  d.text(COMPANY.email, FOOTER.emailCenter, base, { size: 7.56, color: COLORS.white, align: 'center' });
  d.text(`PAGE  ${pageNo}`, FOOTER.pageX, base, { size: 6.96, color: COLORS.white, track: TRACK });
}

/** "01  PROPERTY OVERVIEW" + big title + optional subtitle. */
function drawHeading(ctx, number, kicker, title, subtitle) {
  const { d } = ctx;
  d.text(number, MARGIN.left - 0.5, HEADING.kickerBaseline, { size: 6.96, bold: true, color: COLORS.blue, track: 1 });
  d.text(kicker, HEADING.kickerLabelX, HEADING.kickerBaseline, { size: 6.96, color: COLORS.blue, track: TRACK });
  d.fitText(title, MARGIN.left - 0.5, HEADING.titleBaseline, MARGIN.right - MARGIN.left, { size: HEADING.titleSize, color: COLORS.ink });
  if (subtitle) {
    d.text(subtitle, MARGIN.left - 0.5, HEADING.subtitleBaseline, { size: 9, color: COLORS.muted });
  }
}

function placeholder(d, box, label = 'No photo') {
  d.rect(box.x, box.y, box.w, box.h, COLORS.placeholder);
  d.text(label, box.x + box.w / 2, box.y + box.h / 2 + 3, { size: 8, color: COLORS.faint, align: 'center', track: 1 });
}

function photo(ctx, ref, box) {
  const img = ref && ctx.images.get(ref.id);
  if (!img) { placeholder(ctx.d, box); return; }
  ctx.d.imageCover(img, box, ref.id);
}

// ---------------------------------------------------------------- cover

export function drawCover(ctx) {
  const { d, report, assets } = ctx;
  const det = report.details;
  d.image(assets.coverBg, ART_FRAME.x, ART_FRAME.y, ART_FRAME.w, ART_FRAME.h, 'cover-bg');
  d.image(assets.logoCover, 34, 75, 167, 35.8, 'logo-cover');

  const x = 56.4;
  d.text(COVER.kicker, x, 540.9, { size: 8.04, color: COLORS.coverSoft, track: 3.1 });
  d.fitText(det.projectName || '', x, 587.2, 480, { size: 36, color: COLORS.white });
  d.fitText(`Unit No. ${det.unitNo || ''}`, x, 614, 480, { size: 15.96, color: COLORS.coverSofter });
  d.text(COVER.tagline, x, 638.7, { size: 9.48, color: COLORS.coverSoft });

  d.rect(56.6, 666.8, 482, 0.5, COLORS.coverRule);

  const cols = [
    { x: 57, label: 'CUSTOMER', value: det.customerName },
    { x: 177.5, label: 'PROPERTY', value: coverPropertyLine(det) },
    { x: 298.1, label: 'INSPECTION DATE', value: formatDate(det.inspectionDate) },
    { x: 418.9, label: 'TOTAL AREA', value: `${fmt2(totalArea(report))} sq ft` },
  ];
  for (const c of cols) {
    d.text(c.label, c.x, 683.9, { size: 6.96, color: COLORS.coverSoft, track: TRACK });
    d.wrap(c.value || '', 112, 9.48).slice(0, 3).forEach((line, i) => {
      d.text(line, c.x, 697.8 + i * 11.5, { size: 9.48, color: COLORS.white });
    });
  }
}

// ---------------------------------------------------------------- 01 dimensions

export function drawDimensions(ctx) {
  const { d, doc, report } = ctx;
  const dim = report.dimensions;
  drawHeading(ctx, '01', 'PROPERTY OVERVIEW', 'Spaces & Dimensions', 'Measured carpet dimensions for each space in the unit.');

  // stat cards
  const total = totalArea(report);
  const stats = [
    { x: 57.4, label: 'TOTAL AREA', value: fmt2(total), unit: 'sq ft' },
    { x: 222.2, label: 'CEILING HEIGHT', value: dim.ceilingHeight, unit: 'ft' },
    { x: 387.0, label: 'DOOR HEIGHT', value: dim.doorHeight, unit: 'ft' },
  ];
  for (const s of stats) {
    d.rect(s.x, 161.7, 153, 62, COLORS.card);
    d.text(s.label, s.x + 13.2, 180.3, { size: 6.96, color: COLORS.muted, track: TRACK });
    const value = String(s.value || '').trim() || '–';
    const w = d.text(value, s.x + 13.2, 205.9, { size: 20.04, color: COLORS.ink });
    d.text(s.unit, s.x + 13.2 + w + 2.5, 205.9, { size: 8.04, color: COLORS.muted });
  }

  // table
  const colR = { length: 336.6, width: 436.8, area: 539.3 };
  const tableHeader = (top) => {
    const base = top + 6;
    d.text('SPACE', 57.4, base, { size: 6.96, color: COLORS.muted, track: TRACK });
    d.text('LENGTH (FT)', colR.length, base, { size: 6.96, color: COLORS.muted, track: TRACK, align: 'right' });
    d.text('WIDTH (FT)', colR.width, base, { size: 6.96, color: COLORS.muted, track: TRACK, align: 'right' });
    d.text('AREA (SQ FT)', colR.area, base, { size: 6.96, color: COLORS.muted, track: TRACK, align: 'right' });
    d.rect(MARGIN.left, top + 12.3, MARGIN.right - MARGIN.left, 0.7, COLORS.ink);
    return top + 13;
  };

  let y = tableHeader(256);
  const LIMIT = OBS.bottom - 40;
  dim.spaces.forEach((space, i) => {
    const parts = space.parts.length ? space.parts : [{ length: '', width: '', area: '' }];
    const nameLines = d.wrap(space.name || '', 200, 8.52);
    const lines = Math.max(parts.length, nameLines.length);
    const rowH = 33 + (lines - 1) * 14.4;
    if (y + rowH > LIMIT) {
      doc.addPage();
      ctx.innerPages.push(doc.getNumberOfPages());
      y = tableHeader(OBS.contentTop);
    }
    const base = y + 12.3;
    nameLines.forEach((ln, k) => d.text(ln, 57.4, base + k * 14.4, { size: 8.52, color: COLORS.ink }));
    parts.forEach((p, k) => {
      const by = base + k * 14.4;
      d.text(String(p.length || '').trim(), colR.length, by, { size: 8.52, color: COLORS.text, align: 'right' });
      d.text(String(p.width || '').trim(), colR.width, by, { size: 8.52, color: COLORS.text, align: 'right' });
      d.text(fmt2(partArea(p)), colR.area, by, { size: 8.52, color: COLORS.text, align: 'right' });
    });
    y += rowH;
    if (i < dim.spaces.length - 1) d.rect(MARGIN.left, y, MARGIN.right - MARGIN.left, 0.5, COLORS.rule);
  });

  d.rect(MARGIN.left, y, MARGIN.right - MARGIN.left, 0.5, COLORS.ink);
  d.text('TOTAL AREA', 57.4, y + 17.2, { size: 6.96, bold: true, color: COLORS.ink, track: TRACK });
  d.text(fmt2(total), colR.area, y + 18, { size: 12, color: COLORS.ink, align: 'right' });
}

// ---------------------------------------------------------------- 01 water & fittings

export function drawWater(ctx) {
  const { d, doc, report } = ctx;
  const w = report.water;
  drawHeading(ctx, '01', 'PROPERTY OVERVIEW', 'Water Quality & Fittings', 'On-site water test readings and the brands of installed fittings.');

  const hasPhoto = Boolean(w.tdsPhoto || w.phPhoto);
  const photoH = hasPhoto ? 151 : 0;
  const top = 161.7;
  const cards = [
    { x: 57.4, label: 'TDS', value: w.tds, unit: 'ppm', note: w.tdsNote, photo: w.tdsPhoto },
    { x: 304.4, label: 'PH LEVEL', value: w.ph, unit: 'pH', note: w.phNote, photo: w.phPhoto },
  ];
  const cardW = 235.5;
  const noteLines = cards.map((c) => d.wrap(c.note || '', cardW - 27, 8.04));
  const maxNote = Math.max(1, ...noteLines.map((l) => l.length));
  const cardH = photoH + 17.7 + 25.3 + 15.9 + (maxNote - 1) * 9.7 + 17;
  cards.forEach((c, i) => {
    d.rect(c.x, top, cardW, cardH, COLORS.card);
    if (hasPhoto) {
      const box = { x: c.x, y: top, w: cardW, h: photoH };
      if (c.photo) photo(ctx, c.photo, box); else placeholder(d, box);
    }
    const tx = c.x + 13.3;
    const lb = top + photoH + 17.7;
    d.text(c.label, tx, lb, { size: 6.96, color: COLORS.muted, track: TRACK });
    const value = String(c.value || '').trim() || '–';
    const vw = d.text(value, tx, lb + 25.3, { size: 21.96, color: COLORS.ink });
    d.text(c.unit, tx + vw + 3, lb + 25.3, { size: 8.04, color: COLORS.muted });
    noteLines[i].forEach((ln, k) => d.text(ln, tx, lb + 41.2 + k * 9.7, { size: 8.04, color: COLORS.muted }));
  });

  // fittings
  let y = top + cardH + 21.7;
  const fittings = w.fittings.filter((f) => (f.item || '').trim() || (f.brand || '').trim());
  const LIMIT = OBS.bottom - 10;
  const sectionTitle = (title, base) => {
    d.text(title, MARGIN.left - 0.5, base, { size: 7.56, bold: true, color: COLORS.ink, track: TRACK });
    d.rect(MARGIN.left - 1.7, base + 8.1, MARGIN.right - MARGIN.left + 2.5, 0.7, COLORS.ink);
    return base + 8.1;
  };
  if (fittings.length) {
    let base = sectionTitle('FITTINGS & BRANDS', y) + 22.6;
    let sep = base;
    for (const f of fittings) {
      if (base + 9.2 > LIMIT) {
        doc.addPage();
        ctx.innerPages.push(doc.getNumberOfPages());
        base = sectionTitle('FITTINGS & BRANDS', OBS.contentTop) + 22.6;
      }
      d.text(f.item || '', 57.4, base, { size: 9, color: COLORS.text });
      d.text((f.brand || '').trim() || 'NA', 539.6, base, { size: 9.96, color: COLORS.ink, align: 'right' });
      sep = base + 9.2;
      d.rect(MARGIN.left - 1.7, sep, MARGIN.right - MARGIN.left + 2.5, 0.5, COLORS.rule);
      base = sep + 14.1;
    }
    y = sep + 31.8;
  }

  // severity guide
  const descLines = SEVERITY_GUIDE.map((s) => d.wrap(s.text, 158, 8.04));
  const guideH = 8.7 + 1.4 + 21.9 + 11.6 + Math.max(...descLines.map((l) => l.length)) * 9.7;
  if (y + 8 + guideH > LIMIT) {
    doc.addPage();
    ctx.innerPages.push(doc.getNumberOfPages());
    y = OBS.contentTop;
  }
  const rule = sectionTitle('SEVERITY GUIDE', y);
  const colX = [56.5, 221.3, 386.0];
  SEVERITY_GUIDE.forEach((s, i) => {
    const x = colX[i];
    const color = SEVERITY_COLOR[s.key];
    const barY = rule + 8.7;
    d.rect(x, barY, 152.6, 1.4, color);
    const base = barY + 21.9;
    d.circle(x + 4.6, base - 2.9, 3.4, color);
    d.text(s.label, x + 13.1, base, { size: 7.56, bold: true, color, track: TRACK });
    descLines[i].forEach((ln, k) => d.text(ln, x + 0.5, base + 11.6 + k * 9.7, { size: 8.04, color: COLORS.muted }));
  });
}

// ---------------------------------------------------------------- 02 observations

export function makeMeasure(d) {
  return {
    descLines: (t) => {
      const lines = d.wrap(t, OBS.textW, OBS.descSize);
      return lines.length ? lines : [''];
    },
    locLines: (t) => {
      const lines = d.wrap(t, OBS.textW, OBS.locSize);
      return lines.length ? lines : [''];
    },
  };
}

function drawObservationBlock(ctx, room, item) {
  const { d } = ctx;
  const top = item.y;
  const h = item.height;
  const c = item.card;

  // photos
  const areaH = h;
  const n = item.photos.length;
  if (!n) {
    placeholder(d, { x: OBS.photoX, y: top, w: OBS.photoW, h: areaH });
  } else {
    const rects = photoGrid(n, OBS.photoX, top, OBS.photoW, Math.max(areaH, photoAreaHeight(n)));
    item.photos.forEach((ref, i) => photo(ctx, ref, rects[i]));
  }

  // card
  d.rect(OBS.cardX, top, OBS.cardRight - OBS.cardX, h, COLORS.card);
  const x = OBS.textX;
  const numW = d.text(pad2(item.number), x, top + c.numberBase, { size: 20.04, color: COLORS.blue });
  d.text(item.continued ? 'OBSERVATION (CONTD.)' : 'OBSERVATION', x + Math.max(numW + 6, 30.2), top + c.numberBase,
    { size: 6.96, color: COLORS.faint, track: TRACK });
  item.desc.forEach((ln, k) => d.text(ln, x, top + c.descBase + k * OBS.descLine, { size: OBS.descSize, color: COLORS.ink }));
  d.rect(OBS.ruleX, top + c.rule, OBS.ruleRight - OBS.ruleX, 0.5, COLORS.cardRule);
  d.text('LOCATION', x, top + c.locLabelBase, { size: 6.96, color: COLORS.faint, track: TRACK });
  item.loc.forEach((ln, k) => d.text(ln, x, top + c.locBase + k * OBS.locLine, { size: OBS.locSize, color: COLORS.text }));
  d.text('SEVERITY', x, top + c.sevLabelBase, { size: 6.96, color: COLORS.faint, track: TRACK });

  const sev = SEVERITY_COLOR[item.obs.severity] ? item.obs.severity : 'minor';
  const label = SEVERITY_LABEL[sev];
  const tw = d.width(label, 7.56, { bold: true, track: TRACK });
  const padX = 7;
  d.rect(x, top + c.badgeTop, tw + padX * 2, c.badgeH, SEVERITY_COLOR[sev]);
  d.text(label, x + padX, top + c.badgeTop + 7.0, { size: 7.56, bold: true, color: COLORS.white, track: TRACK });
}

export function drawRoom(ctx, room, measure) {
  const { d, doc } = ctx;
  const pages = paginateRoom(room, measure, observationLocation);
  const name = (room.name || '').trim() || 'Untitled section';
  pages.forEach((page) => {
    doc.addPage();
    ctx.innerPages.push(doc.getNumberOfPages());
    if (page.first) {
      drawHeading(ctx, '02', 'OBSERVATIONS', name, roomSubtitle({ ...room, name }));
      if (room.spaceImages.length) {
        d.text('SPACE IMAGES', MARGIN.left - 0.5, OBS.spaceLabelBaseline, { size: 7.56, bold: true, color: COLORS.ink, track: TRACK });
      }
    } else {
      const w = d.text(name.toUpperCase(), MARGIN.left - 0.5, 82.8, { size: 6.96, bold: true, color: COLORS.ink, track: TRACK });
      d.text(page.label, MARGIN.left - 0.5 + w + 18, 82.8, { size: 6.96, color: COLORS.muted, track: TRACK });
    }
    for (const item of page.items) {
      if (item.type === 'space') {
        const gap = 10;
        const colW = (MARGIN.right - 0.2 - (MARGIN.left + 0.5) - gap) / 2;
        item.images.forEach((ref, i) => {
          photo(ctx, ref, { x: MARGIN.left + 0.5 + i * (colW + gap), y: item.y, w: colW, h: item.h });
        });
      } else {
        drawObservationBlock(ctx, room, item);
      }
    }
  });
}

// ---------------------------------------------------------------- 03 disclaimer

export function drawDisclaimer(ctx) {
  const { d } = ctx;
  drawHeading(ctx, '03', 'TERMS', 'Disclaimer', '');
  const cols = [{ x: 56.4, w: 236 }, { x: 309.7, w: 230 }];
  const split = Math.ceil(DISCLAIMER.length / 2);
  const size = 8.04;
  const lh = 11.25;
  [DISCLAIMER.slice(0, split), DISCLAIMER.slice(split)].forEach((sections, ci) => {
    const { x, w } = cols[ci];
    let base = 136;
    sections.forEach((sec, si) => {
      const idx = ci * split + si + 1;
      d.text(pad2(idx), x, base, { size: 6.75, bold: true, color: COLORS.blue });
      const tl = wrapTracked(d, sec.title, w - 21, 6.96, TRACK);
      tl.forEach((ln, k) => d.text(ln, x + 21, base + k * 9, { size: 6.96, bold: true, color: COLORS.ink, track: TRACK }));
      base += (tl.length - 1) * 9 + 13.4;
      sec.body.forEach((para, pi) => {
        if (typeof para === 'string') {
          d.wrap(para, w, size).forEach((ln) => { d.text(ln, x, base, { size, color: COLORS.text }); base += lh; });
        } else {
          para.bullets.forEach((b) => {
            d.wrap(b, w - 14.2, size).forEach((ln, k) => {
              if (k === 0) d.text('–', x + 1, base, { size, color: COLORS.blue });
              d.text(ln, x + 14.2, base, { size, color: COLORS.text });
              base += lh;
            });
          });
        }
        if (pi < sec.body.length - 1) base += 4;
      });
      base += 19;
    });
  });
}

function wrapTracked(d, text, maxW, size, track) {
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for (const word of words) {
    const next = cur ? `${cur} ${word}` : word;
    if (cur && d.width(next, size, { bold: true, track }) > maxW) {
      lines.push(cur);
      cur = word;
    } else {
      cur = next;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------- thank you

export function drawThanks(ctx) {
  const { d, assets } = ctx;
  const F = ART_FRAME;
  d.image(assets.thanksBg, F.x, F.y, F.w, F.h, 'thanks-bg');
  const cx = F.x + F.w / 2;
  const top = F.y;
  const lw = 254;
  const lh = lw * (assets.logoThanks.h / assets.logoThanks.w);
  d.image(assets.logoThanks, cx - lw / 2, top + 177, lw, lh, 'logo-thanks');
  d.text(THANK_YOU.title, cx, top + 347.7, { size: 39.96, color: COLORS.white, align: 'center' });
  d.text(THANK_YOU.line, cx, top + 378.4, { size: 9.96, color: COLORS.coverSofter, align: 'center' });

  // INSPECT · VERIFY · INFORM
  const parts = [];
  THANK_YOU.motto.forEach((word, i) => {
    if (i) parts.push('·');
    parts.push(word);
  });
  const track = 3.4;
  const gap = 30;
  const widths = parts.map((p) => d.width(p, 8.04, { track }));
  const totalW = widths.reduce((a, b) => a + b, 0) + gap * (parts.length - 1);
  let x = cx - totalW / 2;
  parts.forEach((p, i) => {
    d.text(p, x, top + 423.6, { size: 8.04, color: COLORS.coverSoft, track });
    x += widths[i] + gap;
  });

  d.text(THANK_YOU.contactLabel, cx, top + 612.9, { size: 6.96, color: COLORS.coverSoft, track: TRACK, align: 'center' });
  d.text(COMPANY.phone, cx, top + 633.7, { size: 12.96, color: COLORS.white, align: 'center' });
  d.text(COMPANY.email, cx, top + 650, { size: 9, color: COLORS.coverSofter, align: 'center' });
}

export { PAGE };
