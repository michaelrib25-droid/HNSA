import { getISOWeekKey, eachDateInRange, parseTimeToMinutes, getISOWeekMonday, weekdayIndexOf } from './dateUtils.js';

const STORAGE_KEY = 'hnsa_schedule_v1';

function defaultData() {
  return { template: [], exceptions: {}, colors: {} };
}

function genId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

// Kategorische Palette fuer bis zu 8 Schueler, validiert auf CVD-Sicherheit und
// Kontrast gegen den dunklen Seitenhintergrund (#22223b) - siehe dataviz-Skill.
export const PALETTE = [
  '#3987e5', '#d95926', '#199e70', '#c98500',
  '#d55181', '#008300', '#9085e9', '#e66767'
];

function hashColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

function channelLuminance(c) {
  c = c / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

function contrastRatio(hexA, hexB) {
  const l1 = relativeLuminance(hexA);
  const l2 = relativeLuminance(hexB);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const DARK_TEXT = '#1a1a2e';
const LIGHT_TEXT = '#ffffff';

function bestTextColorFor(backgroundHex) {
  return contrastRatio(DARK_TEXT, backgroundHex) >= contrastRatio(LIGHT_TEXT, backgroundHex) ? DARK_TEXT : LIGHT_TEXT;
}

export function kindIcon(kind) {
  return kind === 'moved' ? ' ↔' : kind === 'extra' ? ' +' : '';
}

function isValidTemplateEntry(entry) {
  return !!entry
    && typeof entry.id === 'string'
    && typeof entry.name === 'string' && entry.name.trim().length > 0
    && Number.isInteger(entry.weekday) && entry.weekday >= 0 && entry.weekday <= 6
    && typeof entry.time === 'string' && /^\d{2}:\d{2}$/.test(entry.time);
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw);
    if (!parsed.template || !parsed.exceptions) return defaultData();
    if (!parsed.colors) parsed.colors = {};
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

  getTemplateEntries() {
    return this.data.template;
  },

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

  setColor(name, color) {
    this.data.colors[name] = color;
    save(this.data);
  },

  colorForName(name) {
    return this.data.colors[name] || hashColor(name);
  },

  textColorForName(name) {
    return bestTextColorFor(this.colorForName(name));
  },

  exportData() {
    return JSON.stringify(this.data, null, 2);
  },

  importData(json) {
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.template) || typeof parsed.exceptions !== 'object' || parsed.exceptions === null) {
      throw new Error('Ungültiges Format');
    }
    if (!parsed.template.every(isValidTemplateEntry)) {
      throw new Error('Ungültiges Format');
    }
    this.data = {
      template: parsed.template,
      exceptions: parsed.exceptions,
      colors: parsed.colors || {}
    };
    save(this.data);
  },

  resetWeek(weekKey) {
    delete this.data.exceptions[weekKey];
    save(this.data);
  },

  cancelRange(startDate, endDate, templateId) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);

    const weekKeys = new Set(eachDateInRange(start, end).map((d) => getISOWeekKey(d)));
    for (const weekKey of weekKeys) {
      const monday = getISOWeekMonday(weekKey);
      for (const session of this.getEffectiveWeek(weekKey)) {
        if (session.kind === 'extra') continue;
        if (templateId && session.id !== templateId) continue;
        const occurrence = new Date(monday);
        occurrence.setDate(monday.getDate() + session.weekday);
        if (occurrence >= start && occurrence <= end) {
          this._ensureWeek(weekKey);
          this.data.exceptions[weekKey][session.id] = { type: 'cancelled' };
        }
      }
    }
    save(this.data);
  },

  getUpcoming(limit = 5, from = new Date()) {
    const result = [];
    const fromMinutes = from.getHours() * 60 + from.getMinutes();
    const maxDays = 60;
    for (let i = 0; i < maxDays && result.length < limit; i++) {
      const day = new Date(from);
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() + i);
      const weekday = weekdayIndexOf(day);
      const weekKey = getISOWeekKey(day);
      const daySessions = this.getEffectiveWeek(weekKey)
        .filter((s) => s.weekday === weekday)
        .filter((s) => i > 0 || parseTimeToMinutes(s.time) >= fromMinutes)
        .sort((a, b) => a.time.localeCompare(b.time));
      for (const s of daySessions) {
        result.push({ ...s, date: new Date(day) });
        if (result.length >= limit) break;
      }
    }
    return result;
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
