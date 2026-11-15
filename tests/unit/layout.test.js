import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rangeLabel, photoGrid, photoAreaHeight, paginateRoom, cardMetrics } from '../../js/pdf/layout.js';
import { OBS } from '../../js/pdf/theme.js';
import { observationLocation } from '../../js/model.js';

// Fake text measurer: ~26 characters per line.
const measure = {
  descLines: (t) => (t ? t.match(/.{1,26}(\s|$)/g).map((s) => s.trim()) : ['']),
  locLines: (t) => [t || ''],
};

const img = (i) => ({ id: `img${i}`, w: 800, h: 600 });

function room({ space = 2, obs = 0, photosPer = 1, desc = 'Grouting gap observed on floor tiles' } = {}) {
  let n = 0;
  return {
    id: 'r1',
    name: 'Living Room',
    subtitle: '',
    spaceImages: Array.from({ length: space }, () => img(n++)),
    observations: Array.from({ length: obs }, (_, i) => ({
      id: `o${i}`,
      description: desc,
      location: '',
      severity: 'minor',
      photos: Array.from({ length: photosPer }, () => img(n++)),
    })),
  };
}

const paginate = (r) => paginateRoom(r, measure, observationLocation);

test('range labels', () => {
  assert.equal(rangeLabel([3, 4, 5]), '03 – 05');
  assert.equal(rangeLabel([18]), '18');
  assert.equal(rangeLabel([12, 12]), '12');
  assert.equal(rangeLabel([]), '');
});

test('photo grid: 1 fills, 2 side by side, odd last photo spans full width', () => {
  assert.deepEqual(photoGrid(1, 0, 0, 300, 186), [{ x: 0, y: 0, w: 300, h: 186 }]);
  const two = photoGrid(2, 0, 0, 300, 186);
  assert.equal(two.length, 2);
  assert.equal(two[0].h, 186);
  assert.ok(two[0].x + two[0].w <= two[1].x);
  const three = photoGrid(3, 0, 0, 300, photoAreaHeight(3));
  assert.equal(three[2].w, 300);
  assert.ok(three[2].y > three[0].y);
  assert.deepEqual(photoGrid(0, 0, 0, 300, 186), []);
});

test('photo grid rectangles never overlap and stay inside the area', () => {
  for (let n = 1; n <= 10; n += 1) {
    const h = photoAreaHeight(n);
    const rects = photoGrid(n, 10, 20, 300, h);
    assert.equal(rects.length, n);
    for (const r of rects) {
      assert.ok(r.x >= 10 - 1e-6 && r.x + r.w <= 310 + 1e-6, `x in range n=${n}`);
      assert.ok(r.y >= 20 - 1e-6 && r.y + r.h <= 20 + h + 1e-6, `y in range n=${n}`);
    }
    for (let i = 0; i < n; i += 1) {
      for (let j = i + 1; j < n; j += 1) {
        const a = rects[i];
        const b = rects[j];
        const overlap = a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;
        assert.ok(!overlap, `photos ${i} and ${j} overlap for n=${n}`);
      }
    }
  }
});

test('same page flow as the original: 2 observations on the first page, then 3 per page', () => {
  const pages = paginate(room({ space: 2, obs: 30 }));
  assert.equal(pages.length, 11); // Living Room in the sample: pages 4-14
  assert.equal(pages[0].items.filter((i) => i.type === 'space').length, 1);
  assert.equal(pages[0].items.filter((i) => i.type === 'obs').length, 2);
  for (const p of pages.slice(1, -1)) assert.equal(p.items.length, 3);
  assert.equal(pages[1].label, 'OBSERVATIONS 03 – 05');
  assert.equal(pages[10].label, 'OBSERVATIONS 30');
});

test('every item stays between the header and the footer', () => {
  const pages = paginate(room({ space: 5, obs: 17, photosPer: 3 }));
  for (const p of pages) {
    for (const it of p.items) {
      const h = it.type === 'space' ? it.h : it.height;
      assert.ok(it.y >= OBS.contentTop - 1e-6, 'below header');
      assert.ok(it.y + h <= OBS.bottom + 1e-6, `above footer (${it.y + h})`);
    }
  }
});

test('observation numbers are 1..n in order, each exactly once', () => {
  const pages = paginate(room({ space: 3, obs: 23 }));
  const nums = pages.flatMap((p) => p.items.filter((i) => i.type === 'obs').map((i) => i.number));
  assert.deepEqual(nums, Array.from({ length: 23 }, (_, i) => i + 1));
});

test('a room without space images fits 3 observations on its first page', () => {
  const pages = paginate(room({ space: 0, obs: 3 }));
  assert.equal(pages.length, 1);
  assert.equal(pages[0].items.length, 3);
});

test('many space images flow onto extra pages before the observations', () => {
  const pages = paginate(room({ space: 9, obs: 2 }));
  const spaceRows = pages.flatMap((p) => p.items.filter((i) => i.type === 'space'));
  assert.equal(spaceRows.length, 5);
  assert.equal(spaceRows[4].images.length, 1);
  assert.ok(pages.length >= 2);
  assert.equal(pages[1].label.startsWith('SPACE IMAGES') || pages[1].label.startsWith('OBSERVATIONS'), true);
});

test('an observation with very many photos is split into continued blocks', () => {
  const pages = paginate(room({ space: 0, obs: 1, photosPer: 23 }));
  const blocks = pages.flatMap((p) => p.items);
  assert.equal(blocks.length, 3);
  assert.deepEqual(blocks.map((b) => b.photos.length), [10, 10, 3]);
  assert.deepEqual(blocks.map((b) => b.continued), [false, true, true]);
  assert.ok(blocks.every((b) => b.number === 1));
});

test('long descriptions make the card taller instead of overflowing', () => {
  const long = 'Water seepage observed near the window frame bottom corner with stains spreading on the adjacent painted wall surface';
  const pages = paginate(room({ space: 0, obs: 1, desc: long }));
  const block = pages[0].items[0];
  assert.ok(block.desc.length >= 4);
  assert.ok(block.height >= block.card.height);
  assert.ok(cardMetrics(1).height < cardMetrics(6).height);
});

test('an empty room still produces its heading page', () => {
  const pages = paginate(room({ space: 0, obs: 0 }));
  assert.equal(pages.length, 1);
  assert.equal(pages[0].items.length, 0);
});
