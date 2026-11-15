# Developer notes

Plain JavaScript (ES modules), no framework, no build step. The browser does
everything; `server.js` only serves the files.

## Folder map

| Path | What it is |
|---|---|
| `index.html`, `css/app.css` | The form (UI). |
| `js/main.js`, `js/ui/*` | UI logic: sections, observations, photo uploads, preview/download. |
| `js/store.js` | Saves the draft + photos in the browser (IndexedDB). Export/import draft. |
| `js/images.js` | Shrinks photos on upload (longest side 1200 px, JPEG 75%). |
| `js/model.js` | Report data shape + pure helpers (areas, totals, dates, validation). |
| `js/presets.js` | **Dropdown lists**: room names, repeated issue descriptions, fittings. |
| `js/config.js` | **Fixed company text**: phone, email, cover text, severity guide, disclaimer, thank-you page. |
| `js/pdf/theme.js` | PDF colours, sizes and positions (measured from the original report). |
| `js/pdf/layout.js` | Pure page-flow maths for observation pages (testable). |
| `js/pdf/pages.js` | Draws each page type: cover, dimensions, water, rooms, disclaimer, thank you. |
| `js/pdf/generate.js` | Builds the full PDF. Runs in the browser and in Node. |
| `js/pdf/browser.js` | Browser entry: `buildPdfBlob(report, getImage, onProgress)`. |
| `assets/brand/` | Original logos and cover / thank-you backgrounds (taken from the Word file). |
| `assets/fonts/` | Instrument Sans (SIL Open Font License) — free look-alike for Aptos. |
| `vendor/jspdf.umd.min.js` | jsPDF 4.2.1 — the only runtime library (copied from `node_modules/jspdf/dist`). |
| `tests/` | Unit tests + the 66-page sample rebuilt from `tests/fixtures/sample-1702.json`. |

## Common changes

- **Add a common issue to the dropdown** → add a line to `OBSERVATION_PRESETS` in `js/presets.js`.
- **Phone / email / disclaimer wording** → `js/config.js`.
- **Colours, spacing, font sizes in the PDF** → `js/pdf/theme.js` (and `js/pdf/pages.js`).
- **Photo size / quality** → constants at the top of `js/images.js`.

## Page flow (same as the original report)

1. Cover
2. 01 Spaces & Dimensions (table continues on a new page if very long)
3. 01 Water Quality & Fittings + Severity guide
4. 02 One section per room: heading, space photos (2 per row), then observations.
   First page holds 2 observations after the space photos, later pages 3 each.
   Observation numbers restart at 01 for every room. 2+ photos in one observation
   are shown side by side / in a 2-column grid; more than 10 photos continue in a
   second block marked "(CONTD.)".
5. 03 Disclaimer
6. Thank you

Header (logo | project | unit no.) and footer (phone | email | page N) are drawn
on every page except the cover and the thank-you page, after all pages exist,
so page numbers are always right.

## Tests

```bash
npm install      # once, installs jsPDF for the Node tests
npm test         # unit tests: maths, page flow, full 66-page sample PDF
npm run test:pdf # writes tests/output/sample-1702.pdf (placeholder photos) to look at
```

`node tests/build-sample.js --fixture <report.json> --photos <folder> --out <file.pdf>`
builds any saved report JSON with real photos named `<photo id>.jpg`.

## Updating jsPDF

```bash
npm install --save-dev --save-exact jspdf@<version>
cp node_modules/jspdf/dist/jspdf.umd.min.js vendor/
npm test
```
