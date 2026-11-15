import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createEmptyReport, createRoom, createObservation, createSpace, createPart,
  partArea, spaceArea, totalArea, fmt2, parseNum, formatDate, coverPropertyLine,
  roomSubtitle, observationLocation, pdfFileName, validateReport, collectImageIds, newId,
} from '../../js/model.js';

const sample = () => JSON.parse(readFileSync(new URL('../fixtures/sample-1702.json', import.meta.url), 'utf8'));

test('parseNum accepts blanks, commas and junk safely', () => {
  assert.equal(parseNum('12.5'), 12.5);
  assert.equal(parseNum(' 1,364.83 '), 1364.83);
  assert.ok(Number.isNaN(parseNum('')));
  assert.ok(Number.isNaN(parseNum('abc')));
  assert.ok(Number.isNaN(parseNum(null)));
});

test('area of a row is length x width rounded to 2 decimals', () => {
  assert.equal(partArea({ length: '21.19', width: '11.19', area: '' }), 237.12);
  assert.equal(partArea({ length: '5.71', width: '3.69', area: '' }), 21.07);
  assert.equal(partArea({ length: '3.3', width: '0.6', area: '' }), 1.98);
});

test('a manually typed area overrides the calculation', () => {
  assert.equal(partArea({ length: '5.71', width: '3.69', area: '21.06' }), 21.06);
});

test('missing length or width gives no area', () => {
  assert.ok(Number.isNaN(partArea({ length: '5', width: '', area: '' })));
  assert.equal(fmt2(NaN), '');
});

test('space area adds all its rows; total adds all spaces', () => {
  const s = createSpace('Living Room');
  s.parts = [createPart('37.86', '11.91'), createPart('5.71', '3.72'), createPart('', '')];
  assert.equal(spaceArea(s), 472.15);
  const report = sample();
  assert.equal(totalArea(report), 1364.86);
});

test('dates print like "11 November 2026"', () => {
  assert.equal(formatDate('2026-11-11'), '11 November 2026');
  assert.equal(formatDate('2026-01-07'), '07 January 2026');
  assert.equal(formatDate(''), '');
});

test('cover property line joins type and unit', () => {
  assert.equal(coverPropertyLine({ propertyType: '3 BHK', unitNo: 'T-10-1702' }), '3 BHK · T-10-1702');
  assert.equal(coverPropertyLine({ propertyType: '', unitNo: 'C-108' }), 'C-108');
});

test('room subtitles: preset wording, generic wording, manual override', () => {
  assert.equal(roomSubtitle({ name: 'Living Room', subtitle: '' }), 'Space images and defects recorded in the living area.');
  assert.equal(roomSubtitle({ name: 'Bedroom 2', subtitle: '' }), 'Space images and defects recorded in the bedroom 2.');
  assert.equal(roomSubtitle({ name: 'Terrace', subtitle: '' }), 'Space images and defects recorded in the terrace.');
  assert.equal(roomSubtitle({ name: 'Terrace', subtitle: 'Custom text.' }), 'Custom text.');
});

test('observation location defaults to the room name', () => {
  const room = createRoom('Kitchen');
  const obs = createObservation();
  assert.equal(observationLocation(room, obs), 'Kitchen');
  obs.location = 'Kitchen - sink area';
  assert.equal(observationLocation(room, obs), 'Kitchen - sink area');
});

test('PDF file name is safe for all operating systems', () => {
  assert.equal(pdfFileName({ projectName: 'My Home Sayuk', unitNo: 'T-10/1702' }), 'My Home Sayuk - T-10-1702 - Inspection Report.pdf');
  assert.equal(pdfFileName({ projectName: '', unitNo: '' }), 'Inspection Report.pdf');
});

test('validation lists what is missing, and the sample report is complete', () => {
  const empty = createEmptyReport();
  const room = createRoom('');
  room.observations.push(createObservation());
  empty.rooms.push(room);
  const problems = validateReport(empty);
  assert.ok(problems.some((p) => p.includes('Project name')));
  assert.ok(problems.some((p) => p.includes('Unit number')));
  assert.ok(problems.some((p) => p.includes('no description')));
  assert.ok(problems.some((p) => p.includes('no photo')));
  assert.deepEqual(validateReport(sample()), []);
});

test('collectImageIds finds water, space and observation photos', () => {
  const r = sample();
  const ids = collectImageIds(r);
  assert.equal(ids.length, 184);
  assert.equal(new Set(ids).size, 184);
});

test('newId values are unique', () => {
  const ids = new Set(Array.from({ length: 2000 }, () => newId('x')));
  assert.equal(ids.size, 2000);
});

test('a new report starts with today, default fittings and no rooms', () => {
  const r = createEmptyReport();
  assert.match(r.details.inspectionDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(r.water.fittings.length, 4);
  assert.equal(r.rooms.length, 0);
});
