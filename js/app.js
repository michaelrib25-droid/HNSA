import {
  getWeekDates,
  getISOWeekKey,
  formatWeekRange,
  formatMinutesToTime,
  formatDateISO,
  parseDateISO,
  weekdayIndexOf
} from './dateUtils.js';
import { Store, PALETTE } from './store.js';
import { renderWeekGrid } from './weekGrid.js';
import { renderDayDetail } from './dayDetail.js';
import { renderUpcoming } from './upcoming.js';

const appRoot = document.getElementById('app');

let referenceDate = new Date();
let view = 'upcoming'; // 'upcoming' | 'week' | 'day'
let selectedDayIndex = 0;
let weekNavDirection = null; // 'prev' | 'next' | null - fuer die Slide-Animation beim Wochenwechsel
let pendingReload = false; // true, wenn ein SW-Update auf das Schliessen eines offenen Dialogs wartet

function render() {
  appRoot.innerHTML = '';

  const weekDates = getWeekDates(referenceDate);
  const weekKey = getISOWeekKey(referenceDate);
  const sessions = Store.getEffectiveWeek(weekKey);

  const header = document.createElement('div');
  header.className = 'app-header';

  const tabs = document.createElement('div');
  tabs.className = 'app-header-tabs';

  const upcomingTab = document.createElement('button');
  upcomingTab.textContent = 'Als Nächstes';
  if (view === 'upcoming') upcomingTab.classList.add('active');
  upcomingTab.addEventListener('click', () => {
    view = 'upcoming';
    render();
  });

  const weekTab = document.createElement('button');
  weekTab.textContent = 'Woche';
  if (view === 'week' || view === 'day') weekTab.classList.add('active');
  weekTab.addEventListener('click', () => {
    view = 'week';
    render();
  });

  tabs.appendChild(upcomingTab);
  tabs.appendChild(weekTab);
  header.appendChild(tabs);

  const menuBtn = document.createElement('button');
  menuBtn.className = 'app-header-menu-btn';
  menuBtn.textContent = '⋮';
  menuBtn.addEventListener('click', () => showMainMenu());
  header.appendChild(menuBtn);

  appRoot.appendChild(header);

  if (view === 'week' || view === 'day') {
    const weekNav = document.createElement('div');
    weekNav.className = 'week-nav';

    const prevBtn = document.createElement('button');
    prevBtn.textContent = '◀';
    prevBtn.addEventListener('click', () => {
      weekNavDirection = 'prev';
      referenceDate = addDays(referenceDate, -7);
      render();
    });

    const label = document.createElement('span');
    label.className = 'week-nav-label';
    label.textContent = formatWeekRange(weekDates);

    const nextBtn = document.createElement('button');
    nextBtn.textContent = '▶';
    nextBtn.addEventListener('click', () => {
      weekNavDirection = 'next';
      referenceDate = addDays(referenceDate, 7);
      render();
    });

    const todayBtn = document.createElement('button');
    todayBtn.textContent = 'Heute';
    todayBtn.addEventListener('click', () => {
      referenceDate = new Date();
      render();
    });

    weekNav.appendChild(prevBtn);
    weekNav.appendChild(label);
    weekNav.appendChild(nextBtn);
    weekNav.appendChild(todayBtn);
    appRoot.appendChild(weekNav);
  }

  const viewContainer = document.createElement('div');
  appRoot.appendChild(viewContainer);

  if (view === 'upcoming') {
    renderUpcoming(viewContainer, Store.getUpcoming(5), {
      onSessionClick: (session) => {
        showActionMenu(getISOWeekKey(session.date), session, session.date);
      }
    });
  } else if (view === 'week') {
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
        showActionMenu(weekKey, session, weekDates[session.weekday]);
      },
      onSwipe: (direction) => {
        weekNavDirection = direction;
        referenceDate = addDays(referenceDate, direction === 'next' ? 7 : -7);
        render();
      }
    });
    if (weekNavDirection) {
      viewContainer.classList.add(weekNavDirection === 'next' ? 'week-grid-enter-next' : 'week-grid-enter-prev');
      weekNavDirection = null;
    }
  } else {
    weekNavDirection = null; // Slide-Animation ist nur fuer die Rasteransicht gedacht
    renderDayDetail(viewContainer, weekDates[selectedDayIndex], selectedDayIndex, sessions, {
      onBack: () => {
        view = 'week';
        render();
      },
      onAddClick: (dayIndex) => {
        showAddDialog(weekKey, dayIndex, '16:00');
      },
      onSessionClick: (session) => {
        showActionMenu(weekKey, session, weekDates[session.weekday]);
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
  nameInput.setAttribute('list', 'student-names');
  box.appendChild(nameInput);

  const datalist = document.createElement('datalist');
  datalist.id = 'student-names';
  [...new Set(Store.getTemplateEntries().map((e) => e.name))].forEach((studentName) => {
    const opt = document.createElement('option');
    opt.value = studentName;
    datalist.appendChild(opt);
  });
  box.appendChild(datalist);

  const timeInput = document.createElement('input');
  timeInput.type = 'time';
  timeInput.step = '900';
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

function showActionMenu(weekKey, session, occurrenceDate) {
  const overlay = createOverlay();
  const box = document.createElement('div');
  box.className = 'modal-box';

  const title = document.createElement('h3');
  title.textContent = `${session.name}, ${session.time}`;
  box.appendChild(title);

  if (session.kind !== 'extra') {
    addMenuButton(box, 'Nachholen …', () => {
      closeOverlay(overlay);
      showRescheduleDialog(weekKey, session, occurrenceDate);
    });
  }

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
  timeInput.step = '900';
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

function showRescheduleDialog(weekKey, session, occurrenceDate) {
  const overlay = createOverlay();
  const box = document.createElement('div');
  box.className = 'modal-box';

  const title = document.createElement('h3');
  title.textContent = `${session.name} nachholen`;
  box.appendChild(title);

  const dateInput = document.createElement('input');
  dateInput.type = 'date';
  dateInput.value = formatDateISO(occurrenceDate);
  box.appendChild(dateInput);

  const timeInput = document.createElement('input');
  timeInput.type = 'time';
  timeInput.step = '900';
  timeInput.value = session.time;
  box.appendChild(timeInput);

  const errorMsg = document.createElement('p');
  errorMsg.className = 'modal-error';
  errorMsg.textContent = 'Bitte ein Datum wählen.';
  errorMsg.style.display = 'none';
  box.appendChild(errorMsg);

  addMenuButton(box, 'Übernehmen', () => {
    if (!dateInput.value) {
      errorMsg.style.display = 'block';
      return;
    }
    const targetDate = parseDateISO(dateInput.value);
    const targetWeekKey = getISOWeekKey(targetDate);
    const targetWeekday = weekdayIndexOf(targetDate);
    Store.setCancelled(weekKey, session.id);
    Store.addExtraSession(targetWeekKey, session.name, targetWeekday, timeInput.value);
    closeOverlay(overlay);
    render();
  });
  addMenuButton(box, 'Abbrechen', () => closeOverlay(overlay));

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function showMainMenu() {
  const overlay = createOverlay();
  const box = document.createElement('div');
  box.className = 'modal-box';

  const title = document.createElement('h3');
  title.textContent = 'Mehr';
  box.appendChild(title);

  addMenuButton(box, 'Exportieren', () => {
    closeOverlay(overlay);
    exportData();
  });
  addMenuButton(box, 'Importieren …', () => {
    closeOverlay(overlay);
    triggerImport();
  });
  addMenuButton(box, 'Pause eintragen …', () => {
    closeOverlay(overlay);
    showVacationDialog();
  });
  if (view === 'week') {
    addMenuButton(box, 'Plan drucken / als PDF …', () => {
      closeOverlay(overlay);
      window.print();
    });
  }
  if (view === 'week' || view === 'day') {
    addMenuButton(box, 'Diese Woche zurücksetzen …', () => {
      closeOverlay(overlay);
      showResetWeekConfirm(getISOWeekKey(referenceDate), formatWeekRange(getWeekDates(referenceDate)));
    });
  }
  addMenuButton(box, 'Abbrechen', () => closeOverlay(overlay));

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function showResetWeekConfirm(weekKey, weekLabel) {
  const overlay = createOverlay();
  const box = document.createElement('div');
  box.className = 'modal-box';

  const title = document.createElement('h3');
  title.textContent = 'Woche zurücksetzen';
  box.appendChild(title);

  const warning = document.createElement('p');
  warning.textContent = `Alle Absagen, Verschiebungen und Extra-Termine für ${weekLabel} werden verworfen. Fortfahren?`;
  box.appendChild(warning);

  addMenuButton(box, 'Zurücksetzen', () => {
    Store.resetWeek(weekKey);
    closeOverlay(overlay);
    render();
  });
  addMenuButton(box, 'Abbrechen', () => closeOverlay(overlay));

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function exportData() {
  const json = Store.exportData();
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `hnsa-backup-${formatDateISO(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function triggerImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json';
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => showImportConfirm(reader.result);
    reader.readAsText(file);
  });
  input.click();
}

function showImportConfirm(json) {
  const overlay = createOverlay();
  const box = document.createElement('div');
  box.className = 'modal-box';

  const title = document.createElement('h3');
  title.textContent = 'Plan importieren';
  box.appendChild(title);

  const warning = document.createElement('p');
  warning.textContent = 'Ersetzt den kompletten aktuellen Plan. Fortfahren?';
  box.appendChild(warning);

  const errorMsg = document.createElement('p');
  errorMsg.className = 'modal-error';
  errorMsg.textContent = 'Die Datei konnte nicht gelesen werden.';
  errorMsg.style.display = 'none';
  box.appendChild(errorMsg);

  addMenuButton(box, 'Importieren', () => {
    try {
      Store.importData(json);
      render();
      closeOverlay(overlay);
    } catch (e) {
      errorMsg.style.display = 'block';
    }
  });
  addMenuButton(box, 'Abbrechen', () => closeOverlay(overlay));

  overlay.appendChild(box);
  document.body.appendChild(overlay);
}

function showVacationDialog() {
  const overlay = createOverlay();
  const box = document.createElement('div');
  box.className = 'modal-box';

  const title = document.createElement('h3');
  title.textContent = 'Pause eintragen';
  box.appendChild(title);

  const startInput = document.createElement('input');
  startInput.type = 'date';
  startInput.value = formatDateISO(new Date());
  box.appendChild(startInput);

  const endInput = document.createElement('input');
  endInput.type = 'date';
  endInput.value = formatDateISO(new Date());
  box.appendChild(endInput);

  const studentSelect = document.createElement('select');
  const allOpt = document.createElement('option');
  allOpt.value = '';
  allOpt.textContent = 'Alle Schüler';
  studentSelect.appendChild(allOpt);
  Store.getTemplateEntries().forEach((entry) => {
    const opt = document.createElement('option');
    opt.value = entry.id;
    opt.textContent = entry.name;
    studentSelect.appendChild(opt);
  });
  box.appendChild(studentSelect);

  const errorMsg = document.createElement('p');
  errorMsg.className = 'modal-error';
  errorMsg.textContent = 'Enddatum darf nicht vor dem Startdatum liegen.';
  errorMsg.style.display = 'none';
  box.appendChild(errorMsg);

  addMenuButton(box, 'Übernehmen', () => {
    const start = parseDateISO(startInput.value);
    const end = parseDateISO(endInput.value);
    if (end < start) {
      errorMsg.style.display = 'block';
      return;
    }
    Store.cancelRange(start, end, studentSelect.value || null);
    closeOverlay(overlay);
    render();
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
  if (pendingReload) {
    // Verzoegert pruefen: viele Aktionen schliessen einen Dialog nur, um sofort
    // den naechsten zu oeffnen (z. B. "Nachholen" -> Termindialog); erst wenn
    // nach diesem Tick wirklich kein Dialog mehr offen ist, wird neu geladen.
    setTimeout(() => {
      if (pendingReload && !document.querySelector('.modal-overlay')) {
        window.location.reload();
      }
    }, 0);
  }
}

// Scrollt ein fokussiertes Eingabefeld in einem Dialog in den sichtbaren Bereich,
// damit die Bildschirmtastatur auf dem Handy es nicht verdeckt.
document.addEventListener('focusin', (event) => {
  if (event.target.closest('.modal-box')) {
    setTimeout(() => event.target.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').then((registration) => {
      // Proactively re-check for a new version whenever the app regains focus,
      // since the browser's own update check only runs on navigation.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update();
      });
    });
  });

  // skipWaiting() on the new worker hands it control immediately; reload once
  // so the page actually runs the new assets instead of the ones already in memory.
  // Falls gerade ein Dialog offen ist (z. B. mitten in der Eingabe), wird der Reload
  // zurueckgestellt, bis der Dialog geschlossen wird (siehe closeOverlay).
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    if (document.querySelector('.modal-overlay')) {
      pendingReload = true;
      return;
    }
    reloaded = true;
    window.location.reload();
  });
}

render();
