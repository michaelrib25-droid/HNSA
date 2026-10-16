import { WEEKDAY_NAMES_SHORT, formatDateShort } from './dateUtils.js';
import { Store, kindIcon } from './store.js';

export function renderUpcoming(container, sessions, callbacks) {
  container.innerHTML = '';
  container.className = 'upcoming-view';

  const list = document.createElement('div');
  list.className = 'upcoming-list';

  if (sessions.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'upcoming-empty';
    empty.textContent = 'Keine anstehenden Termine.';
    list.appendChild(empty);
  }

  sessions.forEach((session) => {
    const item = document.createElement('div');
    item.className = 'upcoming-item';
    item.style.borderLeftColor = Store.colorForName(session.name);

    const when = document.createElement('div');
    when.className = 'upcoming-item-when';
    when.textContent = `${WEEKDAY_NAMES_SHORT[session.weekday]}, ${formatDateShort(session.date)} · ${session.time}`;

    const name = document.createElement('div');
    name.className = 'upcoming-item-name';
    name.textContent = `${session.name}${kindIcon(session.kind)}`;

    item.appendChild(when);
    item.appendChild(name);
    item.addEventListener('click', () => callbacks.onSessionClick(session));
    list.appendChild(item);
  });

  container.appendChild(list);
}
