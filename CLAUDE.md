# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

HNSA = **H**andy **N**achhilfe **S**tundenplan **A**pp. A local, offline-capable PWA for
a single Android phone that shows the weekly tutoring schedule for 7 students and lets
it be adjusted (cancellations, moves, one-off extra sessions) without destroying the
underlying recurring weekly structure. Single-user, no backend, no cloud sync. Vanilla
JS, no framework, no build step. German-language UI.

Full design spec: `docs/superpowers/specs/2026-10-14-hnsa-stundenplan-design.md`.

## Commands

- Run locally: `node server.js` — serves the app at `http://localhost:8000` (also
  reachable from a phone on the same network via the machine's LAN IP, for installed-PWA
  testing).
- No build step, no test suite, no linter. Testing is manual: load in a browser and/or
  on the phone as an installed PWA.

## Deployment

Hosted on GitHub Pages. Deploy = commit + push to `main`; Pages rebuilds automatically.

A `pre-commit` hook (`.git/hooks/pre-commit`, not tracked in the repo) auto-bumps
`CACHE_NAME` in `service-worker.js` on every commit: it hashes the content of the files
listed in `ASSETS` and rewrites `CACHE_NAME` to `hnsa-v<hash>` if it changed, staging the
file automatically. No manual bump is needed — just make sure the hook is present
locally (it's not version-controlled, so a fresh clone won't have it). Always push after
committing so Pages rebuilds and the phone PWA updates.

## Architecture

Single-page app rendered into one root container by `app.js`, which also owns week
navigation (◀/▶ arrows, "Heute" button) and wires up the edit dialogs.

Strict layering:
- `store.js` — the only module that touches `localStorage`, under key
  `hnsa_schedule_v1`. Has zero DOM knowledge; UI modules never read the storage format
  directly, only through the `Store` API.
- `dateUtils.js` — ISO calendar week calculation, German weekday/month names, date
  formatting.
- `weekGrid.js` — renders the week grid overview (7 columns × time axis).
- `dayDetail.js` — renders the day detail list view with the same edit actions as the
  grid, sized for easier tapping.

Data model — the core design decision to preserve when touching scheduling logic:
- `template`: the permanent recurring weekly structure (`{ id, name, weekday, time }`,
  weekday 0=Monday..6=Sunday; session duration is a global fixed 90 min, not stored per
  entry).
- `exceptions`: keyed by ISO week (`YYYY-Www`), each a map of `templateId` (or a
  generated `extra-<id>`) → `{ type: 'cancelled' }` / `{ type: 'moved', weekday, time }`
  / `{ type: 'extra', name, weekday, time }`. These are deviations for *that one week
  only* — nothing in `template` is ever implicitly changed by a per-week action.
- The schedule actually shown for a given week is never stored directly — it's computed
  at render time by `Store.getEffectiveWeek(weekKey)`, which overlays that week's
  exceptions onto `template` (skip if cancelled, substitute weekday/time if moved, then
  append any `extra` entries). Any new per-week behavior should extend this merge rather
  than writing resolved occurrences into storage.

Per-student colors: deterministic hash of the student's name into a fixed `PALETTE`
(`hashColor()`), but a user-set override is checked first via `Store.colorForName()` —
`data.colors[name]` takes precedence over the hash. Keep that precedence when touching
color logic so manual overrides aren't silently clobbered.

Overlapping appointments (e.g. two students moved to the same slot) are intentionally
unvalidated — both are simply rendered side by side in the same time slot; this is a
single-user app and conflict detection was explicitly scoped out.
