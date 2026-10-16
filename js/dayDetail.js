import { WEEKDAY_NAMES_LONG, formatDateShort } from './dateUtils.js';
import { Store, kindIcon } from './store.js';
import { getHoliday } from './holidays.js';

export function renderDayDetail(container, date, dayIndex, sessions, callbacks) {
  container.innerHTML = '';
  container.className = 'day-detail';

  const header = document.createElement('div');
  header.className = 'day-detail-header';

  const backBtn = document.createElement('button');
  backBtn.textContent = '← Woche';
  backBtn.addEventListener('click', () => callbacks.onBack());
  header.appendChild(backBtn);

  const holidayName = getHoliday(date);
  const title = document.createElement('h2');
  title.textContent = `${WEEKDAY_NAMES_LONG[dayIndex]}, ${formatDateShort(date)}${holidayName ? ` — ${holidayName}` : ''}`;
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
    item.dataset.sessionId = session.id;
    item.style.borderLeftColor = Store.colorForName(session.name);
    item.innerHTML = `<strong>${session.time}</strong> — ${session.name}${kindIcon(session.kind)}`;
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
