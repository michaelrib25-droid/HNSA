import { WEEKDAY_NAMES_SHORT, formatDateShort, parseTimeToMinutes, getMonday, weekdayIndexOf } from './dateUtils.js';
import { Store, kindIcon } from './store.js';
import { getHoliday } from './holidays.js';

const GRID_START_MIN = 9 * 60;
const GRID_END_MIN = 22 * 60;
const COMPRESSED_END_MIN = 13 * 60;
const SESSION_MINUTES = 90;
// 9-13 Uhr zaehlt nur mit diesem Bruchteil zur Gesamthoehe (selten genutzt, soll
// weniger Platz einnehmen); 13-22 Uhr zaehlt voll. Die Skala passt sich danach
// proportional an die tatsaechlich verfuegbare Hoehe an, egal wie gross der Bildschirm ist.
const COMPRESSION_RATIO = 0.35 / 0.9;
const COMPRESSED_WEIGHT = (COMPRESSED_END_MIN - GRID_START_MIN) * COMPRESSION_RATIO;

function weightAt(minutes) {
  if (minutes <= COMPRESSED_END_MIN) {
    return (minutes - GRID_START_MIN) * COMPRESSION_RATIO;
  }
  return COMPRESSED_WEIGHT + (minutes - COMPRESSED_END_MIN);
}

const TOTAL_WEIGHT = weightAt(GRID_END_MIN);

function minutesToFraction(minutes) {
  return weightAt(minutes) / TOTAL_WEIGHT;
}

function fractionToMinutes(fraction) {
  const w = fraction * TOTAL_WEIGHT;
  if (w <= COMPRESSED_WEIGHT) {
    return GRID_START_MIN + w / COMPRESSION_RATIO;
  }
  return COMPRESSED_END_MIN + (w - COMPRESSED_WEIGHT);
}

const SWIPE_THRESHOLD_PX = 50;

export function renderWeekGrid(container, weekDates, sessions, callbacks) {
  container.innerHTML = '';
  container.className = 'week-grid';

  let touchStart = null;
  let dragging = false;
  container.addEventListener('touchstart', (event) => {
    touchStart = { x: event.changedTouches[0].clientX, y: event.changedTouches[0].clientY };
    dragging = false;
  }, { passive: true });
  container.addEventListener('touchmove', (event) => {
    if (!touchStart) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    if (!dragging) {
      if (Math.abs(dy) > Math.abs(dx)) {
        touchStart = null; // eindeutig vertikales Scrollen - Drag abbrechen
        return;
      }
      if (Math.abs(dx) > 8) dragging = true;
    }
    if (dragging) {
      // gedaempft (0.6x), damit es wie Widerstand statt freiem Mitziehen wirkt
      const damped = Math.sign(dx) * Math.min(Math.abs(dx) * 0.6, 60);
      body.style.transform = `translateX(${damped}px)`;
    }
  }, { passive: true });
  container.addEventListener('touchend', (event) => {
    if (!touchStart) return;
    const dx = event.changedTouches[0].clientX - touchStart.x;
    const dy = event.changedTouches[0].clientY - touchStart.y;
    touchStart = null;
    if (dragging) {
      body.style.transition = 'transform 160ms ease-out';
      body.style.transform = '';
      setTimeout(() => { body.style.transition = ''; }, 170);
    }
    dragging = false;
    if (Math.abs(dx) >= SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
      callbacks.onSwipe(dx > 0 ? 'prev' : 'next');
    }
  }, { passive: true });

  if (sessions.length === 0) {
    const hint = document.createElement('p');
    hint.className = 'week-grid-hint';
    hint.textContent = 'Noch keine Termine. Tippe auf ein Zeitfeld, um loszulegen.';
    container.appendChild(hint);
  }

  const header = document.createElement('div');
  header.className = 'week-grid-header';

  const headerSpacer = document.createElement('div');
  headerSpacer.className = 'week-grid-time-spacer';
  header.appendChild(headerSpacer);

  weekDates.forEach((date, i) => {
    const dayBtn = document.createElement('button');
    dayBtn.className = 'week-grid-day-header';

    const holidayName = getHoliday(date);
    if (holidayName) dayBtn.classList.add('is-holiday');

    const weekday = document.createElement('span');
    weekday.className = 'week-grid-day-header-weekday';
    weekday.textContent = WEEKDAY_NAMES_SHORT[i];

    const dateLabel = document.createElement('span');
    dateLabel.className = 'week-grid-day-header-date';
    dateLabel.textContent = formatDateShort(date);

    dayBtn.appendChild(weekday);
    dayBtn.appendChild(dateLabel);

    if (holidayName) {
      const holidayLabel = document.createElement('span');
      holidayLabel.className = 'week-grid-day-header-holiday';
      holidayLabel.textContent = holidayName;
      dayBtn.appendChild(holidayLabel);
    }

    dayBtn.addEventListener('click', () => callbacks.onDayHeaderClick(i));
    header.appendChild(dayBtn);
  });
  container.appendChild(header);

  const body = document.createElement('div');
  body.className = 'week-grid-body';
  container.appendChild(body);

  // body ist jetzt im Live-DOM und hat durch flex:1 seine endgueltige Hoehe -
  // ab hier kann real gemessen statt mit festen Pixeln gerechnet werden.
  const bodyHeight = body.getBoundingClientRect().height;

  function minutesToY(minutes) {
    return minutesToFraction(minutes) * bodyHeight;
  }

  const firstHour = GRID_START_MIN / 60;
  const lastHour = GRID_END_MIN / 60;
  const timeAxis = document.createElement('div');
  timeAxis.className = 'week-grid-time-axis';
  for (let hour = firstHour; hour <= lastHour; hour++) {
    const label = document.createElement('div');
    label.className = 'week-grid-time-label';
    label.style.top = `${minutesToY(hour * 60)}px`;
    if (hour === firstHour) {
      label.style.transform = 'translateY(0)'; // oben buendig, ragt sonst in die Kopfzeile
    } else if (hour === lastHour) {
      label.style.transform = 'translateY(-100%)'; // unten buendig, ragt sonst unten raus
    }
    label.textContent = String(hour).padStart(2, '0');
    timeAxis.appendChild(label);
  }
  body.appendChild(timeAxis);

  for (let day = 0; day < 7; day++) {
    const column = document.createElement('div');
    column.className = 'week-grid-column';
    column.addEventListener('click', (event) => {
      const rect = column.getBoundingClientRect();
      const offsetY = event.clientY - rect.top;
      const fraction = Math.max(0, Math.min(1, offsetY / bodyHeight));
      const minutes = fractionToMinutes(fraction);
      callbacks.onEmptySlotClick(day, snapToQuarterHour(minutes));
    });
    body.appendChild(column);
  }

  sessions.forEach((session) => {
    const startMin = parseTimeToMinutes(session.time);
    const top = minutesToY(startMin);
    const height = minutesToY(startMin + SESSION_MINUTES) - top;

    const block = document.createElement('div');
    block.className = 'week-grid-block';
    block.dataset.sessionId = session.id;
    block.style.top = `${top}px`;
    block.style.height = `${height}px`;
    block.style.background = Store.colorForName(session.name);
    block.style.color = Store.textColorForName(session.name);
    block.textContent = `${session.name} ${session.time}${kindIcon(session.kind)}`;
    block.addEventListener('click', (event) => {
      event.stopPropagation();
      callbacks.onSessionClick(session);
    });

    body.children[session.weekday + 1].appendChild(block);
  });

  const now = new Date();
  if (getMonday(now).getTime() === weekDates[0].getTime()) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes >= GRID_START_MIN && nowMinutes <= GRID_END_MIN) {
      const nowLine = document.createElement('div');
      nowLine.className = 'week-grid-now-line';
      nowLine.style.top = `${minutesToY(nowMinutes)}px`;
      body.children[weekdayIndexOf(now) + 1].appendChild(nowLine);
    }
  }
}

function snapToQuarterHour(minutes) {
  return Math.round(minutes / 15) * 15;
}
