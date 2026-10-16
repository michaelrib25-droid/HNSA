import { getISOWeekKey, weekdayIndexOf, eachDateInRange, parseTimeToMinutes } from './dateUtils.js';

const STORAGE_KEY = 'hnsa_schedule_v1';

function defaultData() {
  return { template: [], exceptions: {}, colors: {} };
}

function genId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export const PALETTE = [
  '#e63946', '#f3722c', '#f1a208', '#588157', '#2a9d8f',
  '#43aa8b', '#277da1', '#4361ee', '#3a0ca3', '#7209b7',
  '#b5179e', '#f72585', '#ff6d00', '#457b9d', '#9d4edd'
];

function hashColor(name) {
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

  exportData() {
    return JSON.stringify(this.data, null, 2);
  },

  importData(json) {
    const parsed = JSON.parse(json);
    if (!parsed || !Array.isArray(parsed.template) || typeof parsed.exceptions !== 'object') {
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
    const entries = templateId
      ? this.data.template.filter((e) => e.id === templateId)
      : this.data.template;
    for (const date of eachDateInRange(startDate, endDate)) {
      const weekday = weekdayIndexOf(date);
      const weekKey = getISOWeekKey(date);
      for (const entry of entries) {
        if (entry.weekday === weekday) {
          this.setCancelled(weekKey, entry.id);
        }
      }
    }
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
