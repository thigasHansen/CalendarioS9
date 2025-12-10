// script.js
(function () {
  const DAILY_LIMIT = 2000000.00; // Brazilian style display handled separately
  const START_MONTH = new Date(2025, 11, 1); // Dec 2025 (month is 0-based)
  const END_MONTH = new Date(2026, 11, 1);   // Dec 2026

  const client = window.supabaseClient;

  const els = {
    monthTitle: document.getElementById('monthTitle'),
    prevMonthBtn: document.getElementById('prevMonthBtn'),
    nextMonthBtn: document.getElementById('nextMonthBtn'),
    weekdayHeader: document.getElementById('weekdayHeader'),
    calendarGrid: document.getElementById('calendarGrid'),
    newEventBtn: document.getElementById('newEventBtn'),
    eventModal: document.getElementById('eventModal'),
    eventForm: document.getElementById('eventForm'),
    eventId: document.getElementById('eventId'),
    eventName: document.getElementById('eventName'),
    eventValue: document.getElementById('eventValue'),
    eventColor: document.getElementById('eventColor'),
    eventDescription: document.getElementById('eventDescription'),
    cancelEventBtn: document.getElementById('cancelEventBtn'),
    saveEventBtn: document.getElementById('saveEventBtn'),
    modalTitle: document.getElementById('modalTitle'),
    eventListTitle: document.getElementById('eventListTitle'),
    eventList: document.getElementById('eventList'),
    dailyLimit: document.getElementById('dailyLimit'),
    dailyTotal: document.getElementById('dailyTotal'),
    dailyRemaining: document.getElementById('dailyRemaining'),
    confirmDeleteModal: document.getElementById('confirmDeleteModal'),
    confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
    cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
  };

  // State
  let currentMonth = new Date(START_MONTH);
  const today = new Date();
  let selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let pendingDeleteId = null;
  let eventsCache = new Map(); // key: ISO date string, value: array of events

  // Intl helpers (Brazil)
  const fmtCurrency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' });
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
  }

  function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  }

  function toISODate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  // Color hashing: consistent color per name
  function colorFromName(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash;
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue} 70% 50%)`; // vibrant
  }

  function parseBRL(input) {
    // Accept "1.234.567,89" or "1234567,89" or "1234567.89"
    const normalized = input.replace(/\./g, '').replace(',', '.');
    const n = Number(normalized);
    if (Number.isNaN(n)) return null;
    return n;
  }

  function renderWeekHeader() {
    els.weekdayHeader.innerHTML = '';
    weekDays.forEach(d => {
      const div = document.createElement('div');
      div.textContent = d;
      els.weekdayHeader.appendChild(div);
    });
  }

  function inRangeMonth(date) {
    const t = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    return t >= START_MONTH.getTime() && t <= END_MONTH.getTime();
  }

  async function loadMonthEvents(date) {
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const last = new Date(date.getFullYear(), date.getMonth()+1, 0);
    const fromISO = toISODate(first);
    const toISO = toISODate(last);

    const { data, error } = await client
      .from('events')
      .select('*')
      .gte('event_date', fromISO)
      .lte('event_date', toISO)
      .order('event_date', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading events', error);
      return;
    }
    eventsCache.clear();
    data.forEach(ev => {
      const key = ev.event_date;
      if (!eventsCache.has(key)) eventsCache.set(key, []);
      eventsCache.get(key).push(ev);
    });
  }

  function renderMonth(date) {
    const month = date.getMonth();
    const year = date.getFullYear();
    const title = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date);
    els.monthTitle.textContent = title.charAt(0).toUpperCase() + title.slice(1);

    els.calendarGrid.innerHTML = '';

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startWeekDay = (firstDay.getDay()); // 0=Sun

    // Fill prev month blanks
    for (let i = 0; i < startWeekDay; i++) {
      const blank = document.createElement('div');
      blank.className = 'day-cell';
      els.calendarGrid.appendChild(blank);
    }

    // Days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const cellDate = new Date(year, month, d);
      const cell = document.createElement('div');
      cell.className = 'day-cell';
      const isToday = isSameDay(cellDate, today);
      const isSelected = isSameDay(cellDate, selectedDate);
      if (isToday) cell.classList.add('today');
      if (isSelected) cell.classList.add('selected');

      const dateLabel = document.createElement('div');
      dateLabel.className = 'date';
      dateLabel.textContent = d;

      const eventsWrap = document.createElement('div');
      eventsWrap.className = 'day-events';

      const iso = toISODate(cellDate);
      const events = eventsCache.get(iso) || [];
      events.forEach(ev => {
        const pill = document.createElement('div');
        pill.className = 'event-pill';
        const leftColor = ev.color ? ev.color : colorFromName(ev.name);
        pill.style.borderLeftColor = leftColor;

        const name = document.createElement('span');
        name.className = 'name';
        name.textContent = ev.name;

        const value = document.createElement('span');
        value.className = 'value';
        value.textContent = fmtCurrency.format(Number(ev.value));

        pill.appendChild(name);
        pill.appendChild(value);

        pill.addEventListener('click', () => {
          // Toggle in the side list; also show description there.
          showEventDetails(ev);
        });

        eventsWrap.appendChild(pill);
      });

      cell.appendChild(dateLabel);
      cell.appendChild(eventsWrap);

      cell.addEventListener('click', () => {
        selectedDate = cellDate;
        updateSelectedHighlight();
        renderSideList();
        updateBudgetPanel();
      });

      els.calendarGrid.appendChild(cell);
    }

    renderSideList();
    updateBudgetPanel();
  }

  function updateSelectedHighlight() {
    const cells = els.calendarGrid.querySelectorAll('.day-cell');
    cells.forEach((cell, idx) => {
      cell.classList.remove('selected');
    });
    // Re-apply selected by recomputing render; simpler approach:
    renderMonth(currentMonth);
  }

  function renderSideList() {
    const iso = toISODate(selectedDate);
    const events = eventsCache.get(iso) || [];
    els.eventListTitle.textContent = `Eventos de ${fmtDate.format(selectedDate)}`;
    els.eventList.innerHTML = '';

    events.forEach(ev => {
      const item = document.createElement('div');
      item.className = 'event-item';

      const header = document.createElement('div');
      header.className = 'header';
      const left = document.createElement('div');
      left.innerHTML = `<strong>${ev.name}</strong> <span class="meta">${fmtCurrency.format(Number(ev.value))}</span>`;
      const right = document.createElement('div');
      right.className = 'actions';

      const editBtn = document.createElement('button');
      editBtn.textContent = 'Editar';
      editBtn.addEventListener('click', () => openEditModal(ev));

      const delBtn = document.createElement('button');
      delBtn.textContent = 'Excluir';
      delBtn.className = 'danger';
      delBtn.addEventListener('click', () => {
        pendingDeleteId = ev.id;
        els.confirmDeleteModal.showModal();
      });

      right.appendChild(editBtn);
      right.appendChild(delBtn);

      header.appendChild(left);
      header.appendChild(right);

      item.appendChild(header);

      if (ev.description && ev.description.trim().length > 0) {
        const desc = document.createElement('div');
        desc.className = 'desc';
        desc.textContent = ev.description;
        // Hidden until clicked
        desc.style.display = 'none';

        // Clicking anywhere on item toggles description
        item.addEventListener('click', (e) => {
          // Avoid toggling when clicking buttons
          if (e.target === editBtn || e.target === delBtn) return;
          desc.style.display = (desc.style.display === 'none') ? 'block' : 'none';
        });

        item.appendChild(desc);
      }

      // Left color bar consistency
      item.style.borderLeft = `6px solid ${ev.color ? ev.color : colorFromName(ev.name)}`;

      els.eventList.appendChild(item);
    });
  }

  function updateBudgetPanel() {
    const iso = toISODate(selectedDate);
    const events = eventsCache.get(iso) || [];
    const total = events.reduce((sum, ev) => sum + Number(ev.value), 0);
    const remaining = Math.max(0, DAILY_LIMIT - total);

    els.dailyLimit.textContent = fmtCurrency.format(DAILY_LIMIT);
    els.dailyTotal.textContent = fmtCurrency.format(total);
    els.dailyRemaining.textContent = fmtCurrency.format(remaining);
    els.dailyRemaining.style.color = remaining === 0 ? 'var(--danger)' : 'var(--text)';
  }

  function openNewModal() {
    els.modalTitle.textContent = `Novo evento para ${fmtDate.format(selectedDate)}`;
    els.eventId.value = '';
    els.eventName.value = '';
    els.eventValue.value = '';
    els.eventColor.value = '#3b82f6';
    els.eventDescription.value = '';
    els.eventModal.showModal();
  }

  function openEditModal(ev) {
    els.modalTitle.textContent = `Editar evento (${fmtDate.format(new Date(ev.event_date))})`;
    els.eventId.value = ev.id;
    els.eventName.value = ev.name;
    els.eventValue.value = Number(ev.value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    els.eventColor.value = ev.color ? ev.color : '#3b82f6';
    els.eventDescription.value = ev.description || '';
    els.eventModal.showModal();
  }

  function showEventDetails(ev) {
    // Focus side list item logic handled; optional scrolling could be added.
    renderSideList();
  }

  async function saveEvent() {
    const id = els.eventId.value;
    const name = els.eventName.value.trim();
    const valueRaw = els.eventValue.value.trim();
    const value = parseBRL(valueRaw);
    const color = els.eventColor.value || null;
    const description = els.eventDescription.value.trim();

    if (!name) { alert('Nome é obrigatório'); return; }
    if (value === null) { alert('Valor inválido'); return; }
    if (value < 0) { alert('Valor deve ser positivo'); return; }

    const payload = {
    name,
    value,
    description: description.length ? description : null,
    color: color,
    event_date: toISODate(selectedDate),
  };

    if (!id) {
      // Insert for selected date
      payload.event_date = toISODate(selectedDate);
      const { data, error } = await client.from('events').insert(payload).select('*').single();
      if (error) { alert('Erro ao salvar evento'); console.error(error); return; }
    } else {
      // Update existing
      const { data, error } = await client.from('events').update(payload).eq('id', id).select('*').single();
      if (error) { alert('Erro ao atualizar evento'); console.error(error); return; }
    }

    els.eventModal.close();
    await loadMonthEvents(currentMonth);
    renderMonth(currentMonth);
  }

  async function deleteEvent() {
    if (!pendingDeleteId) { els.confirmDeleteModal.close(); return; }
    const { error } = await client.from('events').delete().eq('id', pendingDeleteId);
    if (error) { alert('Erro ao excluir evento'); console.error(error); }
    pendingDeleteId = null;
    els.confirmDeleteModal.close();
    await loadMonthEvents(currentMonth);
    renderMonth(currentMonth);
  }

  function clampMonthNav() {
    const prevCandidate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    const nextCandidate = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);

    els.prevMonthBtn.disabled = !inRangeMonth(prevCandidate);
    els.nextMonthBtn.disabled = !inRangeMonth(nextCandidate);
  }

  async function gotoMonth(date) {
    currentMonth = new Date(date.getFullYear(), date.getMonth(), 1);
    // If selected date falls outside currentMonth, keep selected date as is; events panel still shows selected date values.
    clampMonthNav();
    await loadMonthEvents(currentMonth);
    renderMonth(currentMonth);
  }

  // Events
  els.prevMonthBtn.addEventListener('click', () => {
    const prev = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    if (inRangeMonth(prev)) gotoMonth(prev);
  });
  els.nextMonthBtn.addEventListener('click', () => {
    const next = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
    if (inRangeMonth(next)) gotoMonth(next);
  });

  els.newEventBtn.addEventListener('click', () => {
    openNewModal();
  });

  els.cancelEventBtn.addEventListener('click', () => {
    els.eventModal.close();
  });

  els.eventForm.addEventListener('submit', (e) => {
    e.preventDefault();
    saveEvent();
  });

  els.confirmDeleteBtn.addEventListener('click', deleteEvent);
  els.cancelDeleteBtn.addEventListener('click', () => els.confirmDeleteModal.close());

  // Initial render
  renderWeekHeader();
  (async function init() {
    // Start at December 2025, select today (even if not in Dec 2025)
    await gotoMonth(START_MONTH);
    // Ensure selected date is visible and highlighted in the month currently displayed
    renderMonth(currentMonth);
  })();
})();
