# Inspection Report Generator

Makes the **Akshara Elite Home Inspections** property inspection report as a PDF.
You fill in a simple form, add photos, and click **Download PDF**.

Everything runs on your own computer. Nothing is uploaded to the internet.

---

## 1. One-time setup (about 5 minutes)

You only need **one free program: Node.js**.

1. Open **https://nodejs.org** in your browser.
2. Click the big **LTS** download button.
3. Open the downloaded file and click **Next / Continue** until it finishes.
4. That's it. You do **not** need to install anything else.

To check it worked: open **Terminal** (Mac) or **Command Prompt** (Windows), type
`node -v` and press Enter. You should see a version number like `v20.19.6`.

---

## 2. Start the app (every time)

### Easiest way — double-click

- **Mac:** double-click **`Start Report Generator.command`** in this folder.
  (The first time, Mac may say it is from an unknown developer: right-click the
  file → **Open** → **Open**.)
- **Windows:** double-click **`Start Report Generator.bat`** in this folder.

A black window opens and your browser opens the app automatically.
**Keep the black window open while you work.**

### Or with a command

Open Terminal / Command Prompt **in this folder** and type:

```
npm start
```

Then open **http://localhost:8080** in Chrome (or Edge).

### To stop

Close the black window, or press **Ctrl + C** in it.

> If you see "Port 8080 is busy", the app is probably already running —
> just open http://localhost:8080.

---

## 3. Make a report — step by step

The left side shows 5 steps. Work from top to bottom.

1. **Report details** — project name (e.g. *My Home Sayuk*), unit no.
   (e.g. *T-10-1702*), customer name, property type (e.g. *3 BHK*), inspection date.
2. **Spaces & Dimensions** — ceiling and door height, then **+ Add space** for
   each room with its length and width in feet. The area and the total are
   calculated for you. For an L-shaped room click **+ Add row (L×W)**.
   To use an exact area instead, type it in *Exact area*.
3. **Water & Fittings** — TDS and pH readings with their photos, and the
   brands (WC, Wash basin, Faucet, Electrical…). Add or remove rows as needed.
4. **Sections & Observations** — one section per room (click a name under
   *Quick add*, or **+ Add section**).
   - **Space images**: a few general photos of the room.
   - **Add observations from photos**: select all the defect photos of that room
     at once — one observation is created for each photo.
   - For each observation: pick the issue from the **Description** list (start
     typing, e.g. "grout", and choose), or type your own words.
     Choose **Major / Minor / Cosmetic**.
   - Need more photos in one observation? Click **+ Add photo** — they appear
     side by side in the PDF.
   - Arrows move things up/down; the copy button duplicates an observation.
5. **Preview & Generate** — shows a summary and anything that is missing.
   Click **Preview PDF** to look at it, then **Download PDF**.

There is no limit on the number of sections, observations or photos.

---

## 4. Your work is saved automatically

- Everything (text and photos) is saved **in this browser** as you type —
  you can close the browser and continue later. The top bar shows **Saved ✓**.
- **Export draft** saves the whole report (with photos) to one file — use it
  as a backup, or to move work to another computer. **Import draft** opens it.
- **New report** clears the current report. Export it first if you want to keep it.

> Use the same browser each time. Clearing the browser's history/site data
> also clears the saved draft — so export important drafts.

---

## 5. Common questions

**The photo would not add.** iPhone "HEIC" photos may not work. On iPhone go to
*Settings → Camera → Formats → Most Compatible* (photos are then saved as JPG),
or export the photos as JPG.

**The PDF is too big to email.** Photos are already reduced automatically.
A report with about 180 photos is usually 10–20 MB.

**I want to change the phone number, email or disclaimer text.**
Edit `js/config.js` (plain text — keep the quotes). Restart the app.

**I want more issues in the Description list.**
Add a line to `OBSERVATION_PRESETS` in `js/presets.js`. Restart the app.

---

For developers: see [docs/DEVELOPER.md](docs/DEVELOPER.md) (code layout, tests).
