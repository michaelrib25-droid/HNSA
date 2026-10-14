# HNSA Stundenplan – Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the HNSA PWA — a local, offline-capable weekly schedule overview for 7 tutoring students with a recurring template plus per-week exceptions (cancel/move/add-extra).

**Architecture:** Vanilla HTML/CSS/JS (ES modules), no build step, no framework. `store.js` owns all `localStorage` persistence and the template/exception merge logic; `dateUtils.js` owns date/week/time math; `weekGrid.js` and `dayDetail.js` are pure render functions; `app.js` holds the small amount of UI state (current week, current view) and wires navigation + dialogs to the store.

**Tech Stack:** Plain JavaScript (ES modules), HTML5, CSS3, a 40-line Node static file server for local testing (no npm dependencies), Service Worker for offline caching.

**Spec:** `docs/superpowers/specs/2026-10-14-hnsa-stundenplan-design.md`

## Global Constraints

- No build tools/frameworks — plain vanilla HTML/CSS/JS using native ES modules.
- Every session has a fixed duration of 90 minutes; duration is never stored per-session.
- All persistence is local only, via `localStorage` under the single key `hnsa_schedule_v1`.
- No automated test suite — the spec explicitly rejects one as disproportionate for a single-user offline app. Each task below is verified manually in the browser (desktop first, then phone) instead of with `assert`/test-runner code.
- Scope is strictly the schedule overview — no student notes, contacts, subjects, or payment tracking.

## Review Focus

- Empty template on first run (no students added yet) — the week grid must show a helpful hint instead of a blank or broken layout. Covered in Task 4.
- Week navigation across a year boundary (e.g. ISO week 52/53 of one year into week 1 of the next) — the ISO week key and displayed date range must stay correct. Covered in Task 2.
- Two sessions landing on the same day/time after a "move" (template moved onto a slot another student already occupies) — both must render as separate visible blocks, neither silently overwritten. Covered in Task 4.
- Reloading the page after making changes — template edits, cancellations, moves, and extra sessions must survive a full page reload (real `localStorage` persistence, not just in-memory state). Covered in Task 3.
- Submitting the "add session" dialog with an empty name — must not create a nameless/broken entry. Covered in Task 6.

---

## Task 1: Projekt-Grundgerüst

**Files:**
- Create: `index.html`
- Create: `manifest.json`
- Create: `service-worker.js` (placeholder asset list, finalized in Task 7)
- Create: `server.js`
- Create: `css/styles.css` (base reset only, extended in later tasks)
- Copy: `hello-world-pwa/icons/icon-192.png` → `icons/icon-192.png`
- Copy: `hello-world-pwa/icons/icon-512.png` → `icons/icon-512.png`

**Interfaces:**
- Produces: `#app` root `<div>` in `index.html` that `js/app.js` (Task 6) renders into.

- [ ] **Step 1: Create the icons directory and copy the existing icons**

```bash
mkdir -p "C:/Users/micha/desktop/HNSA/icons"
cp "C:/Users/micha/desktop/HNSA/hello-world-pwa/icons/icon-192.png" "C:/Users/micha/desktop/HNSA/icons/icon-192.png"
cp "C:/Users/micha/desktop/HNSA/hello-world-pwa/icons/icon-512.png" "C:/Users/micha/desktop/HNSA/icons/icon-512.png"
```

- [ ] **Step 2: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>HNSA Stundenplan</title>
<link rel="manifest" href="manifest.json" />
<meta name="theme-color" content="#1a1a2e" />
<link rel="icon" href="icons/icon-192.png" />
<link rel="stylesheet" href="css/styles.css" />
</head>
<body>
  <div id="app"></div>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 3: Create `manifest.json`**

```json
{
  "name": "HNSA Stundenplan",
  "short_name": "HNSA",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "background_color": "#1a1a2e",
  "theme_color": "#1a1a2e",
  "orientation": "portrait",
  "icons": [
    {
      "src": "icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
```

- [ ] **Step 4: Create a placeholder `service-worker.js`** (final asset list added in Task 7; this version just makes the app installable during development)

```js
const CACHE_NAME = 'hnsa-dev';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
```

- [ ] **Step 5: Create `server.js`** (identical pattern to `hello-world-pwa/server.js`)

```js
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = 8000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/manifest+json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);
  if (reqPath === '/') reqPath = '/index.html';
  const filePath = path.join(ROOT, reqPath);

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server laeuft auf Port ${PORT}`);
});
```

- [ ] **Step 6: Create `css/styles.css`** (base reset; grid/dialog/day-detail styles added in later tasks)

```css
:root {
  color-scheme: dark;
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  background: #1a1a2e;
  color: #f5f5f7;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  height: 100%;
}
#app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}
```

- [ ] **Step 7: Create an empty `js/app.js` so the page doesn't 404 on the module script, and verify the scaffold loads**

```js
document.getElementById('app').textContent = 'HNSA – Grundgerüst lädt.';
```

Start the server and check from the PC itself:

```bash
cd "C:/Users/micha/desktop/HNSA" && node server.js
```

In a second terminal:

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:8000/index.html
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:8000/manifest.json
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:8000/icons/icon-192.png
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:8000/js/app.js
```

Expected: all four return `HTTP 200`. Leave the server running in the background for the remaining tasks — the same instance serves every later task's new files without a restart.

---

## Task 2: `js/dateUtils.js` — Datums-/Wochen-/Zeitberechnungen

**Files:**
- Create: `js/dateUtils.js`

**Interfaces:**
- Produces: `WEEKDAY_NAMES_SHORT`, `WEEKDAY_NAMES_LONG` (arrays, index 0 = Montag), `getMonday(date)`, `getWeekDates(date)`, `getISOWeekKey(date)`, `formatDateShort(date)`, `formatWeekRange(weekDates)`, `parseTimeToMinutes(timeStr)`, `formatMinutesToTime(totalMinutes)` — consumed by `store.js`, `weekGrid.js`, `dayDetail.js`, `app.js` (Tasks 3–6).

- [ ] **Step 1: Write `js/dateUtils.js`**

```js
export const WEEKDAY_NAMES_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
export const WEEKDAY_NAMES_LONG = [
  'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'
];
export const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'
];

export function getMonday(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sonntag, 1 = Montag, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function getWeekDates(date) {
  const monday = getMonday(date);
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export function getISOWeekKey(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function formatDateShort(date) {
  return `${date.getDate()}. ${MONTH_NAMES_SHORT[date.getMonth()]}`;
}

export function formatWeekRange(weekDates) {
  const start = weekDates[0];
  const end = weekDates[6];
  const year = end.getFullYear();
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}.–${end.getDate()}. ${MONTH_NAMES_SHORT[end.getMonth()]} ${year}`;
  }
  return `${formatDateShort(start)} – ${formatDateShort(end)} ${year}`;
}

export function parseTimeToMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function formatMinutesToTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = Math.round(totalMinutes % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
```

- [ ] **Step 2: Manually verify in the browser console** (server from Task 1 still running)

Open `http://localhost:8000/index.html`, open DevTools console, run:

```js
const du = await import('./js/dateUtils.js');
du.getISOWeekKey(new Date(2024, 0, 1));          // Montag, 1.1.2024
du.getISOWeekKey(new Date(2025, 11, 29));        // Montag, 29.12.2025 -> ISO Woche 1 des Folgejahres
du.getWeekDates(new Date(2024, 0, 3)).map(d => d.getDate());
du.formatWeekRange(du.getWeekDates(new Date(2026, 9, 14)));
du.formatMinutesToTime(975);
```

Expected results:
- `"2024-W01"`
- `"2026-W01"` (year-boundary case — this is the Review Focus check for week math)
- `[1, 2, 3, 4, 5, 6, 7]`
- `"12.–18. Okt 2026"`
- `"16:15"`

If any value differs, fix `dateUtils.js` before moving on — every later task depends on this file being correct.

---

## Task 3: `js/store.js` — Datenhaltung, Vorlage/Ausnahmen, Farben

**Files:**
- Create: `js/store.js`

**Interfaces:**
- Consumes: nothing (only `localStorage`, a browser global).
- Produces: `colorForName(name)`, and the `Store` singleton with `Store.data`, `Store.addTemplateEntry(name, weekday, time)`, `Store.updateTemplateEntry(id, changes)`, `Store.removeTemplateEntry(id)`, `Store.setCancelled(weekKey, templateId)`, `Store.setMoved(weekKey, templateId, weekday, time)`, `Store.addExtraSession(weekKey, name, weekday, time)`, `Store.removeException(weekKey, exceptionId)`, `Store.getEffectiveWeek(weekKey)` — consumed by `app.js` (Task 6) and `weekGrid.js`/`dayDetail.js` (Tasks 4–5, via `colorForName` only).
- `getEffectiveWeek(weekKey)` returns an array of `{ id, name, weekday, time, kind }` where `kind` is `'template' | 'moved' | 'extra'`.

- [ ] **Step 1: Write `js/store.js`**

```js
const STORAGE_KEY = 'hnsa_schedule_v1';

function defaultData() {
  return { template: [], exceptions: {} };
}

function genId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const PALETTE = ['#e63946', '#f1a208', '#2a9d8f', '#457b9d', '#8338ec', '#ff6d00', '#06a77d'];

export function colorForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    if (!parsed.template || !parsed.exceptions) return defaultData();
    return parsed;
  } catch (e) {
    return defaultData();
  }
}

function save(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage nicht verfuegbar (z. B. privater Modus) - Daten bleiben nur im Speicher
  }
}

export const Store = {
  data: load(),

  addTemplateEntry(name, weekday, time) {
    const entry = { id: genId('s'), name, weekday, time };
    this.data.template.push(entry);
    save(this.data);
    return entry;
  },

  updateTemplateEntry(id, changes) {
    const entry = this.data.template.find((e) => e.id === id);
    if (!entry) return;
    Object.assign(entry, changes);
    save(this.data);
  },

  removeTemplateEntry(id) {
    this.data.template = this.data.template.filter((e) => e.id !== id);
    save(this.data);
  },

  setCancelled(weekKey, templateId) {
    this._ensureWeek(weekKey);
    this.data.exceptions[weekKey][templateId] = { type: 'cancelled' };
    save(this.data);
  },

  setMoved(weekKey, templateId, weekday, time) {
    this._ensureWeek(weekKey);
    this.data.exceptions[weekKey][templateId] = { type: 'moved', weekday, time };
    save(this.data);
  },

  addExtraSession(weekKey, name, weekday, time) {
    this._ensureWeek(weekKey);
    const id = genId('extra');
    this.data.exceptions[weekKey][id] = { type: 'extra', name, weekday, time };
    save(this.data);
    return id;
  },

  removeException(weekKey, exceptionId) {
    if (this.data.exceptions[weekKey]) {
      delete this.data.exceptions[weekKey][exceptionId];
      save(this.data);
    }
  },

  _ensureWeek(weekKey) {
    if (!this.data.exceptions[weekKey]) {
      this.data.exceptions[weekKey] = {};
    }
  },

  getEffectiveWeek(weekKey) {
    const weekExceptions = this.data.exceptions[weekKey] || {};
    const result = [];

    for (const entry of this.data.template) {
      const exception = weekExceptions[entry.id];
      if (exception && exception.type === 'cancelled') continue;
      if (exception && exception.type === 'moved') {
        result.push({
          id: entry.id, name: entry.name,
          weekday: exception.weekday, time: exception.time, kind: 'moved'
        });
        continue;
      }
      result.push({ id: entry.id, name: entry.name, weekday: entry.weekday, time: entry.time, kind: 'template' });
    }

    for (const [exId, exception] of Object.entries(weekExceptions)) {
      if (exception.type === 'extra') {
        result.push({ id: exId, name: exception.name, weekday: exception.weekday, time: exception.time, kind: 'extra' });
      }
    }

    return result;
  }
};
```

- [ ] **Step 2: Manually verify persistence and the template/exception merge in the browser console**

Open `http://localhost:8000/index.html`, DevTools console:

```js
const { Store } = await import('./js/store.js');
Store.addTemplateEntry('TestLisa', 1, '16:00');
Store.getEffectiveWeek('2099-W01');
```

Expected: an array containing `{ name: 'TestLisa', weekday: 1, time: '16:00', kind: 'template', id: 's-...' }`.

```js
Store.setCancelled('2099-W01', Store.data.template[0].id);
Store.getEffectiveWeek('2099-W01');
```

Expected: empty array (the one entry is cancelled for that week only).

```js
Store.getEffectiveWeek('2099-W02');
```

Expected: the entry is back (cancellation only applied to `2099-W01`).

**Reload the page** (this is the Review Focus persistence check), then in the console:

```js
const { Store } = await import('./js/store.js');
Store.data.template;
```

Expected: still contains `TestLisa` — confirms real `localStorage` persistence survives a reload, not just in-memory state.

- [ ] **Step 3: Clean up the test data** so it doesn't pollute the real schedule

```js
localStorage.removeItem('hnsa_schedule_v1');
```

Reload the page once more and confirm (via `Store.data`) that `template` is back to `[]`.

---

## Task 4: `js/weekGrid.js` — Wochenraster

**Files:**
- Create: `js/weekGrid.js`
- Modify: `css/styles.css` (append grid styles)

**Interfaces:**
- Consumes: `WEEKDAY_NAMES_SHORT`, `formatDateShort`, `parseTimeToMinutes` from `js/dateUtils.js` (Task 2); `colorForName` from `js/store.js` (Task 3).
- Produces: `renderWeekGrid(container, weekDates, sessions, callbacks)` where `callbacks = { onDayHeaderClick(dayIndex), onEmptySlotClick(dayIndex, minutes), onSessionClick(session) }` — consumed by `app.js` (Task 6).

- [ ] **Step 1: Write `js/weekGrid.js`**

```js
import { WEEKDAY_NAMES_SHORT, formatDateShort, parseTimeToMinutes } from './dateUtils.js';
import { colorForName } from './store.js';

const GRID_START_MIN = 8 * 60;
const GRID_END_MIN = 21 * 60;
const SESSION_MINUTES = 90;
const PX_PER_MIN = 0.9;

export function renderWeekGrid(container, weekDates, sessions, callbacks) {
  container.innerHTML = '';
  container.className = 'week-grid';

  if (sessions.length === 0) {
    const hint = document.createElement('p');
    hint.className = 'week-grid-hint';
    hint.textContent = 'Noch keine Termine. Tippe auf ein Zeitfeld, um loszulegen.';
    container.appendChild(hint);
  }

  const totalHeight = (GRID_END_MIN - GRID_START_MIN) * PX_PER_MIN;

  const header = document.createElement('div');
  header.className = 'week-grid-header';
  weekDates.forEach((date, i) => {
    const dayBtn = document.createElement('button');
    dayBtn.className = 'week-grid-day-header';
    dayBtn.textContent = `${WEEKDAY_NAMES_SHORT[i]} ${formatDateShort(date)}`;
    dayBtn.addEventListener('click', () => callbacks.onDayHeaderClick(i));
    header.appendChild(dayBtn);
  });
  container.appendChild(header);

  const body = document.createElement('div');
  body.className = 'week-grid-body';
  body.style.height = `${totalHeight}px`;

  for (let day = 0; day < 7; day++) {
    const column = document.createElement('div');
    column.className = 'week-grid-column';
    column.addEventListener('click', (event) => {
      const rect = column.getBoundingClientRect();
      const offsetY = event.clientY - rect.top;
      const minutes = GRID_START_MIN + offsetY / PX_PER_MIN;
      callbacks.onEmptySlotClick(day, snapToQuarterHour(minutes));
    });
    body.appendChild(column);
  }

  sessions.forEach((session) => {
    const startMin = parseTimeToMinutes(session.time);
    const top = (startMin - GRID_START_MIN) * PX_PER_MIN;
    const height = SESSION_MINUTES * PX_PER_MIN;

    const block = document.createElement('div');
    block.className = 'week-grid-block';
    block.style.top = `${top}px`;
    block.style.height = `${height}px`;
    block.style.background = colorForName(session.name);
    block.textContent = `${session.name} ${session.time}`;
    block.addEventListener('click', (event) => {
      event.stopPropagation();
      callbacks.onSessionClick(session);
    });

    body.children[session.weekday].appendChild(block);
  });

  container.appendChild(body);
}

function snapToQuarterHour(minutes) {
  return Math.round(minutes / 15) * 15;
}
```

- [ ] **Step 2: Append grid styles to `css/styles.css`**

```css
.week-grid-hint {
  text-align: center;
  color: #a0a0b0;
  padding: 16px;
  font-size: 0.9rem;
}
.week-grid {
  flex: 1;
  overflow-x: auto;
}
.week-grid-header {
  display: flex;
}
.week-grid-day-header {
  flex: 1;
  min-width: 42px;
  background: #22223b;
  color: #f5f5f7;
  border: none;
  border-bottom: 1px solid #333358;
  padding: 6px 2px;
  font-size: 0.65rem;
  text-align: center;
}
.week-grid-body {
  display: flex;
  position: relative;
}
.week-grid-column {
  flex: 1;
  min-width: 42px;
  position: relative;
  border-right: 1px solid #2a2a45;
}
.week-grid-block {
  position: absolute;
  left: 2px;
  right: 2px;
  border-radius: 6px;
  color: white;
  font-size: 0.6rem;
  line-height: 1.15;
  padding: 2px 3px;
  overflow: hidden;
  cursor: pointer;
}
```

- [ ] **Step 3: Manually verify rendering, including the two Review Focus cases, in the browser console**

Open `http://localhost:8000/index.html`, console:

```js
const { renderWeekGrid } = await import('./js/weekGrid.js');
const { getWeekDates } = await import('./js/dateUtils.js');

const weekDates = getWeekDates(new Date());
const sessions = [
  { id: 'a', name: 'Lisa', weekday: 1, time: '16:00', kind: 'template' },
  { id: 'b', name: 'Tom', weekday: 1, time: '16:00', kind: 'extra' } // same day/time as Lisa
];

const container = document.createElement('div');
document.body.appendChild(container);
renderWeekGrid(container, weekDates, sessions, {
  onDayHeaderClick: (d) => console.log('day header', d),
  onEmptySlotClick: (d, m) => console.log('empty slot', d, m),
  onSessionClick: (s) => console.log('session click', s)
});
```

Expected, inspected visually on the page: a 7-column grid appears below the (still-empty) app, with **two separate colored blocks both on the Tuesday column at the same vertical position** (Review Focus: overlapping sessions render as two blocks, neither is silently dropped). Click one block — the console logs `session click` with that session's data, not the other one's. Click an empty area of a different day column — the console logs `empty slot` with a day index and a time near where you clicked.

Also verify the empty-state hint: call `renderWeekGrid(container, weekDates, [], callbacks)` and confirm the "Noch keine Termine…" text appears (Review Focus: empty template on first run).

Remove the test container when done: `container.remove()`.

---

## Task 5: `js/dayDetail.js` — Tagesansicht

**Files:**
- Create: `js/dayDetail.js`
- Modify: `css/styles.css` (append day-detail styles)

**Interfaces:**
- Consumes: `WEEKDAY_NAMES_LONG`, `formatDateShort` from `js/dateUtils.js` (Task 2); `colorForName` from `js/store.js` (Task 3).
- Produces: `renderDayDetail(container, date, dayIndex, sessions, callbacks)` where `callbacks = { onBack(), onAddClick(dayIndex), onSessionClick(session) }` — consumed by `app.js` (Task 6). `sessions` is the full week's effective sessions; this function filters to `dayIndex` itself.

- [ ] **Step 1: Write `js/dayDetail.js`**

```js
import { WEEKDAY_NAMES_LONG, formatDateShort } from './dateUtils.js';
import { colorForName } from './store.js';

export function renderDayDetail(container, date, dayIndex, sessions, callbacks) {
  container.innerHTML = '';
  container.className = 'day-detail';

  const header = document.createElement('div');
  header.className = 'day-detail-header';

  const backBtn = document.createElement('button');
  backBtn.textContent = '← Woche';
  backBtn.addEventListener('click', () => callbacks.onBack());
  header.appendChild(backBtn);

  const title = document.createElement('h2');
  title.textContent = `${WEEKDAY_NAMES_LONG[dayIndex]}, ${formatDateShort(date)}`;
  header.appendChild(title);

  container.appendChild(header);

  const list = document.createElement('div');
  list.className = 'day-detail-list';

  const daySessions = sessions
    .filter((s) => s.weekday === dayIndex)
    .sort((a, b) => a.time.localeCompare(b.time));

  if (daySessions.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'day-detail-empty';
    empty.textContent = 'Keine Termine an diesem Tag.';
    list.appendChild(empty);
  }

  daySessions.forEach((session) => {
    const item = document.createElement('div');
    item.className = 'day-detail-item';
    item.style.borderLeftColor = colorForName(session.name);
    item.innerHTML = `<strong>${session.time}</strong> — ${session.name}`;
    item.addEventListener('click', () => callbacks.onSessionClick(session));
    list.appendChild(item);
  });

  container.appendChild(list);

  const addBtn = document.createElement('button');
  addBtn.className = 'day-detail-add-btn';
  addBtn.textContent = '+ Termin hinzufügen';
  addBtn.addEventListener('click', () => callbacks.onAddClick(dayIndex));
  container.appendChild(addBtn);
}
```

- [ ] **Step 2: Append day-detail styles to `css/styles.css`**

```css
.day-detail {
  flex: 1;
  padding: 12px;
}
.day-detail-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.day-detail-header button {
  background: #2d2d44;
  color: #f5f5f7;
  border: none;
  border-radius: 8px;
  padding: 8px 10px;
}
.day-detail-header h2 {
  margin: 0;
  font-size: 1.1rem;
}
.day-detail-item {
  background: #22223b;
  border-left: 4px solid #4f6df5;
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 8px;
  cursor: pointer;
}
.day-detail-empty {
  color: #a0a0b0;
}
.day-detail-add-btn {
  width: 100%;
  padding: 12px;
  margin-top: 12px;
  background: #4f6df5;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 1rem;
}
```

- [ ] **Step 3: Manually verify in the browser console**

```js
const { renderDayDetail } = await import('./js/dayDetail.js');
const sessions = [
  { id: 'a', name: 'Lisa', weekday: 1, time: '16:00', kind: 'template' },
  { id: 'b', name: 'Tom', weekday: 1, time: '18:00', kind: 'extra' },
  { id: 'c', name: 'Anna', weekday: 2, time: '16:00', kind: 'template' }
];
const container = document.createElement('div');
document.body.appendChild(container);
renderDayDetail(container, new Date(), 1, sessions, {
  onBack: () => console.log('back'),
  onAddClick: (d) => console.log('add', d),
  onSessionClick: (s) => console.log('click', s)
});
```

Expected: the page shows "Dienstag, …" with **two** items — Lisa 16:00 and Tom 18:00, sorted by time — and Anna (weekday 2, different day) is *not* shown. Click an item and confirm the console logs the matching session. Click "+ Termin hinzufügen" and confirm the console logs `add 1`. Remove the test container when done: `container.remove()`.

---

## Task 6: `js/app.js` — Integration, Navigation, Dialoge

**Files:**
- Create: `js/app.js` (overwrites the placeholder from Task 1)

**Interfaces:**
- Consumes: `getWeekDates`, `getISOWeekKey`, `formatWeekRange`, `formatMinutesToTime` from `js/dateUtils.js`; `Store` from `js/store.js`; `renderWeekGrid` from `js/weekGrid.js`; `renderDayDetail` from `js/dayDetail.js`.
- Produces: nothing consumed elsewhere — this is the top-level entry point registered from `index.html`.

- [ ] **Step 1: Write `js/app.js`**

```js
import {
  getWeekDates,
  getISOWeekKey,
  formatWeekRange,
  formatMinutesToTime
} from './dateUtils.js';
import { Store } from './store.js';
import { renderWeekGrid } from './weekGrid.js';
import { renderDayDetail } from './dayDetail.js';

const appRoot = document.getElementById('app');

let referenceDate = new Date();
let view = 'week'; // 'week' | 'day'
let selectedDayIndex = 0;

function render() {
  appRoot.innerHTML = '';

  const weekDates = getWeekDates(referenceDate);
  const weekKey = getISOWeekKey(referenceDate);
  const sessions = Store.getEffectiveWeek(weekKey);

  const header = document.createElement('div');
  header.className = 'app-header';

  const prevBtn = document.createElement('button');
  prevBtn.textContent = '◀';
  prevBtn.addEventListener('click', () => {
    referenceDate = addDays(referenceDate, -7);
    render();
  });

  const label = document.createElement('span');
  label.className = 'app-header-label';
  label.textContent = formatWeekRange(weekDates);

  const nextBtn = document.createElement('button');
  nextBtn.textContent = '▶';
  nextBtn.addEventListener('click', () => {
    referenceDate = addDays(referenceDate, 7);
    render();
  });

  const todayBtn = document.createElement('button');
  todayBtn.textContent = 'Heute';
  todayBtn.addEventListener('click', () => {
    referenceDate = new Date();
    view = 'week';
    render();
  });

  header.appendChild(prevBtn);
  header.appendChild(label);
  header.appendChild(nextBtn);
  header.appendChild(todayBtn);
  appRoot.appendChild(header);

  const viewContainer = document.createElement('div');
  appRoot.appendChild(viewContainer);

  if (view === 'week') {
    renderWeekGrid(viewContainer, weekDates, sessions, {
      onDayHeaderClick: (dayIndex) => {
        selectedDayIndex = dayIndex;
        view = 'day';
        render();
      },
      onEmptySlotClick: (dayIndex, minutes) => {
        showAddDialog(weekKey, dayIndex, formatMinutesToTime(minutes));
      },
      onSessionClick: (session) => {
        showActionMenu(weekKey, session);
      }
    });
  } else {
    renderDayDetail(viewContainer, weekDates[selectedDayIndex], selectedDayIndex, sessions, {
      onBack: () => {
        view = 'week';
        render();
      },
      onAddClick: (dayIndex) => {
        showAddDialog(weekKey, dayIndex, '16:00');
      },
      onSessionClick: (session) => {
        showActionMenu(weekKey, session);
      }
    });
  }
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function showAddDialog(weekKey, weekday, time) {
  const overlay = createOverlay();
  const box = document.createElement('div');
  box.className = 'modal-box';

  const title = document.createElement('h3');
  title.textContent = 'Neuer Termin';
  box.appendChild(title);

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.placeholder = 'Name';
  box.appendChild(nameInput);

  const timeInput = document.createElement('input');
  timeInput.type = 'time';
  timeInput.value = time;
  box.appendChild(timeInput);

  const errorMsg = document.createElement('p');
  errorMsg.className = 'modal-error';
  errorMsg.textContent = 'Bitte einen Namen eingeben.';
  errorMsg.style.display = 'none';
  box.appendChild(errorMsg);

  function requireName() {
    const name = nameInput.value.trim();
    if (!name) {
      errorMsg.style.display = 'block';
      return null;
    }
    return name;
  }

  addMenuButton(box, 'Einmalig (nur diese Woche)', () => {
    const name = requireName();
    if (!name) return;
    Store.addExtraSession(weekKey, name, weekday, timeInput.value);
    closeOverlay(overlay);
    render();
  });

  addMenuButton(box, 'Dauerhaft (jede Woche)', () => {
    const name = requireName();
    if (!name) return;
    Store.addTemplateEntry(name, weekday, timeInput.value);
    closeOverlay(overlay);
    render();
  });

  addMenuButton(box, 'Abbrechen', () => closeOverlay(overlay));

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function showActionMenu(weekKey, session) {
  const overlay = createOverlay();
  const box = document.createElement('div');
  box.className = 'modal-box';

  const title = document.createElement('h3');
  title.textContent = `${session.name}, ${session.time}`;
  box.appendChild(title);

  if (session.kind === 'extra') {
    addMenuButton(box, 'Verschieben', () => {
      closeOverlay(overlay);
      showMoveDialog(session, (newWeekday, newTime) => {
        Store.removeException(weekKey, session.id);
        Store.addExtraSession(weekKey, session.name, newWeekday, newTime);
        render();
      });
    });
    addMenuButton(box, 'Löschen', () => {
      Store.removeException(weekKey, session.id);
      closeOverlay(overlay);
      render();
    });
  } else {
    addMenuButton(box, 'Diese Woche absagen', () => {
      Store.setCancelled(weekKey, session.id);
      closeOverlay(overlay);
      render();
    });
    addMenuButton(box, 'Diese Woche verschieben', () => {
      closeOverlay(overlay);
      showMoveDialog(session, (newWeekday, newTime) => {
        Store.setMoved(weekKey, session.id, newWeekday, newTime);
        render();
      });
    });
    addMenuButton(box, 'Dauerhaft ändern', () => {
      closeOverlay(overlay);
      showMoveDialog(session, (newWeekday, newTime) => {
        Store.updateTemplateEntry(session.id, { weekday: newWeekday, time: newTime });
        render();
      });
    });
    addMenuButton(box, 'Komplett aus Plan löschen', () => {
      Store.removeTemplateEntry(session.id);
      closeOverlay(overlay);
      render();
    });
  }

  addMenuButton(box, 'Abbrechen', () => closeOverlay(overlay));

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function showMoveDialog(session, onConfirm) {
  const overlay = createOverlay();
  const box = document.createElement('div');
  box.className = 'modal-box';

  const title = document.createElement('h3');
  title.textContent = 'Neue Zeit wählen';
  box.appendChild(title);

  const dayLabels = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const daySelect = document.createElement('select');
  dayLabels.forEach((label, i) => {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = label;
    if (i === session.weekday) opt.selected = true;
    daySelect.appendChild(opt);
  });
  box.appendChild(daySelect);

  const timeInput = document.createElement('input');
  timeInput.type = 'time';
  timeInput.value = session.time;
  box.appendChild(timeInput);

  addMenuButton(box, 'Übernehmen', () => {
    onConfirm(Number(daySelect.value), timeInput.value);
    closeOverlay(overlay);
  });
  addMenuButton(box, 'Abbrechen', () => closeOverlay(overlay));

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function addMenuButton(container, label, onClick) {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  container.appendChild(btn);
}

function createOverlay() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) closeOverlay(overlay);
  });
  return overlay;
}

function closeOverlay(overlay) {
  overlay.remove();
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js');
  });
}

render();
```

- [ ] **Step 2: Append modal styles and header styles to `css/styles.css`**

```css
.app-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #22223b;
}
.app-header button {
  background: #2d2d44;
  color: #f5f5f7;
  border: none;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 0.9rem;
}
.app-header-label {
  flex: 1;
  text-align: center;
  font-size: 0.85rem;
  font-weight: 600;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}
.modal-box {
  background: #22223b;
  border-radius: 12px;
  padding: 20px;
  width: min(320px, 90vw);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.modal-box h3 {
  margin: 0 0 6px 0;
}
.modal-box input,
.modal-box select {
  padding: 10px;
  border-radius: 8px;
  border: 1px solid #44446a;
  background: #1a1a2e;
  color: #f5f5f7;
  font-size: 1rem;
}
.modal-box button {
  padding: 10px;
  border-radius: 8px;
  border: none;
  background: #2d2d44;
  color: #f5f5f7;
  font-size: 0.95rem;
}
.modal-error {
  color: #ff6b6b;
  font-size: 0.8rem;
  margin: 0;
}
```

- [ ] **Step 3: Manually verify the full app in the desktop browser** (reload `http://localhost:8000/index.html`)

1. The app loads with an empty week grid and the "Noch keine Termine…" hint.
2. Tap an empty area in the Monday column → the add dialog opens with the name field empty. Click "Dauerhaft (jede Woche)" **without typing a name** → the dialog stays open and shows "Bitte einen Namen eingeben." (Review Focus: empty name is rejected). Now type "Lisa", click "Dauerhaft (jede Woche)" → dialog closes, a block labeled "Lisa …" appears on Monday.
3. Click that block → action menu appears with "Diese Woche absagen / verschieben / Dauerhaft ändern / Komplett aus Plan löschen / Abbrechen". Click "Diese Woche absagen" → the block disappears from the current week.
4. Click "▶" to go to next week → the Lisa block is back (cancellation was week-scoped, Review Focus case).
5. Click "◀" twice, then "Heute" → returns to the current week.
6. Click a day header → day-detail view opens showing that day's sessions with a "← Woche" button and a "+ Termin hinzufügen" button; both work.
7. Reload the page → Lisa's recurring entry is still there (full persistence check).

Clean up test data once satisfied: open DevTools console and run `localStorage.removeItem('hnsa_schedule_v1')`, then reload.

---

## Task 7: Service Worker finalisieren & Offline-/Handy-Verifikation

**Files:**
- Modify: `service-worker.js` (replace the Task 1 placeholder with the real caching list)

**Interfaces:**
- Consumes: nothing new — this is the final asset manifest for everything built in Tasks 1–6.

- [ ] **Step 1: Replace `service-worker.js` with the real cache-first implementation**

```js
const CACHE_NAME = 'hnsa-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/styles.css',
  './js/app.js',
  './js/store.js',
  './js/dateUtils.js',
  './js/weekGrid.js',
  './js/dayDetail.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
```

- [ ] **Step 2: Verify the new service worker installs cleanly on desktop**

Reload `http://localhost:8000/index.html`. Open DevTools → Application → Service Workers: confirm a worker for `hnsa-v1` is "activated and running" (if an old `hnsa-dev` worker from Task 1 is listed, click "Unregister" on it first, then reload).

In DevTools → Application → Cache Storage, confirm `hnsa-v1` contains all 11 entries from `ASSETS`.

- [ ] **Step 3: Verify real offline behavior on desktop**

In DevTools → Network tab, switch the throttling dropdown to "Offline". Reload the page. Expected: the app still loads fully (grid, header, your saved students if any) — confirms the service worker serves from cache when the network is unreachable. Switch throttling back to "No throttling" afterward.

- [ ] **Step 4: Find the PC's LAN IP and confirm the server is reachable there**

```bash
# Windows PowerShell:
Get-NetRoute -DestinationPrefix '0.0.0.0/0' | Select-Object InterfaceAlias, NextHop
```

Use the IP on the same interface as the default gateway (e.g. `192.168.0.98`, as established for the hello-world prototype). Confirm the `node server.js` process from Task 1 is still running on port 8000.

- [ ] **Step 5: Install and test on the phone**

1. On the phone, same Wi-Fi as the PC, open Chrome and go to `http://<PC-LAN-IP>:8000`.
2. Confirm the HNSA app loads and behaves like the desktop verification in Task 6, Step 3.
3. Chrome menu → "App installieren" / "Zum Startbildschirm hinzufügen".
4. Open the installed app from the home screen icon, add a real student entry, then turn on **Flugmodus** and reopen the app from the icon — it must still show the data and remain usable (final offline confirmation on the actual target device).
5. Turn Flugmodus back off.

Once this step passes, the app is feature-complete per the spec and ready for the user's planned next step: initializing a Git repository and pushing to a new GitHub repo.
