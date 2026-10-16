function easterSunday(year) {
  // Gauss'sche Osterformel
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function isSameDate(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const FIXED_HOLIDAYS = {
  '1-1': 'Neujahr',
  '1-6': 'Heilige Drei Könige',
  '5-1': 'Tag der Arbeit',
  '8-15': 'Mariä Himmelfahrt',
  '10-3': 'Tag der Deutschen Einheit',
  '11-1': 'Allerheiligen',
  '12-25': '1. Weihnachtstag',
  '12-26': '2. Weihnachtstag'
};

export function getHoliday(date) {
  const key = `${date.getMonth() + 1}-${date.getDate()}`;
  if (FIXED_HOLIDAYS[key]) return FIXED_HOLIDAYS[key];

  const easter = easterSunday(date.getFullYear());
  const movable = [
    { offset: -2, name: 'Karfreitag' },
    { offset: 1, name: 'Ostermontag' },
    { offset: 39, name: 'Christi Himmelfahrt' },
    { offset: 50, name: 'Pfingstmontag' },
    { offset: 60, name: 'Fronleichnam' }
  ];
  const hit = movable.find((m) => isSameDate(addDays(easter, m.offset), date));
  return hit ? hit.name : null;
}
