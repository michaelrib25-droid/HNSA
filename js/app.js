import {
  getWeekDates,
  getISOWeekKey,
  formatWeekRange,
  formatMinutesToTime
} from './dateUtils.js';
import { Store, PALETTE } from './store.js';
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

  header.appendChild(prevBtn);
  header.appendChild(label);
  header.appendChild(nextBtn);
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

  addMenuButton(box, 'Farbe ändern', () => {
    closeOverlay(overlay);
    showColorDialog(session.name);
  });

  addMenuButton(box, 'Abbrechen', () => closeOverlay(overlay));

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function showColorDialog(name) {
  const overlay = createOverlay();
  const box = document.createElement('div');
  box.className = 'modal-box';

  const title = document.createElement('h3');
  title.textContent = `Farbe für ${name}`;
  box.appendChild(title);

  const grid = document.createElement('div');
  grid.className = 'color-grid';
  PALETTE.forEach((color) => {
    const swatch = document.createElement('button');
    swatch.className = 'color-swatch';
    swatch.style.background = color;
    swatch.addEventListener('click', () => {
      Store.setColor(name, color);
      closeOverlay(overlay);
      render();
    });
    grid.appendChild(swatch);
  });
  box.appendChild(grid);

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
