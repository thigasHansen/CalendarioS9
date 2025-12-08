// --- Config: replace with your Supabase credentials ---
const SUPABASE_URL = "https://whrugfiojjbxkzjvtgjs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_3qJoVWoF-Kfn1n2dAi0RgA_gqT-j5uN";

const supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Auth UI ---
const authView = document.getElementById('auth-view');
const mainView = document.getElementById('main-view');
const authForm = document.getElementById('auth-form');
const emailEl = document.getElementById('email');
const passwordEl = document.getElementById('password');
const authError = document.getElementById('auth-error');
const signInBtn = document.getElementById('sign-in-btn');
const signUpBtn = document.getElementById('sign-up-btn');
const signOutBtn = document.getElementById('sign-out-btn');
const userEmail = document.getElementById('user-email');

let sessionUser = null;
let editingEvent = null; // holds event record when editing

async function checkSession() {
  const { data } = await supabase.auth.getSession();
  if (data.session?.user) {
    sessionUser = data.session.user;
    userEmail.textContent = sessionUser.email || '';
    authView.classList.add('hidden');
    mainView.classList.remove('hidden');
    initCalendar();
  } else {
    authView.classList.remove('hidden');
    mainView.classList.add('hidden');
  }
}

authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  authError.textContent = '';
  signInBtn.disabled = true;
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: emailEl.value.trim(),
      password: passwordEl.value.trim(),
    });
    if (error) throw error;
    await checkSession();
  } catch (err) {
    authError.textContent = err.message || 'Sign-in failed';
  } finally {
    signInBtn.disabled = false;
  }
});

signUpBtn.addEventListener('click', async () => {
  authError.textContent = '';
  try {
    const { error } = await supabase.auth.signUp({
      email: emailEl.value.trim(),
      password: passwordEl.value.trim(),
    });
    if (error) throw error;
    authError.textContent = 'Sign-up successful. Please sign in.';
  } catch (err) {
    authError.textContent = err.message || 'Sign-up failed';
  }
});

signOutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  sessionUser = null;
  authView.classList.remove('hidden');
  mainView.classList.add('hidden');
});

// --- Calendar state & UI ---
const yearSelect = document.getElementById('year-select');
const monthSelect = document.getElementById('month-select');
const daysGrid = document.getElementById('days-grid');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');

const years = [2025, 2026];
const months = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

let currentYear = years[0];
let currentMonthIndex = new Date().getMonth(); // default to current month

function populateSelectors() {
  yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
  monthSelect.innerHTML = months.map((m, i) => `<option value="${i}">${m}</option>`).join('');
  yearSelect.value = currentYear;
  monthSelect.value = currentMonthIndex;
}

yearSelect.addEventListener('change', () => {
  currentYear = parseInt(yearSelect.value, 10);
  renderCalendar();
});
monthSelect.addEventListener('change', () => {
  currentMonthIndex = parseInt(monthSelect.value, 10);
  renderCalendar();
});
prevMonthBtn.addEventListener('click', () => {
  currentMonthIndex--;
  if (currentMonthIndex < 0) {
    currentMonthIndex = 11;
    currentYear--;
  }
  yearSelect.value = currentYear;
  monthSelect.value = currentMonthIndex;
  renderCalendar();
});
nextMonthBtn.addEventListener('click', () => {
  currentMonthIndex++;
  if (currentMonthIndex > 11) {
    currentMonthIndex = 0;
    currentYear++;
  }
  yearSelect.value = currentYear;
  monthSelect.value = currentMonthIndex;
  renderCalendar();
});

function getMonthMatrix(year, monthIdx) {
  // returns array of 42 cells (6 weeks x 7 days), each either {date: Date, inMonth: boolean}
  const firstOfMonth = new Date(year, monthIdx, 1);
  const startDay = firstOfMonth.getDay(); // 0-6
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const prevMonthDays = new Date(year, monthIdx, 0).getDate();

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dayNum = i - startDay + 1;
    if (i < startDay) {
      const date = new Date(year, monthIdx - 1, prevMonthDays - (startDay - i - 1));
      cells.push({ date, inMonth: false });
    } else if (dayNum <= daysInMonth) {
      const date = new Date(year, monthIdx, dayNum);
      cells.push({ date, inMonth: true });
    } else {
      const date = new Date(year, monthIdx + 1, dayNum - daysInMonth);
      cells.push({ date, inMonth: false });
    }
  }
  return cells;
}

// --- Events data ---
let eventTypesByName = new Map(); // name -> { id, color }
let events = []; // raw events from DB (single + recurring templates)

async function loadEventTypes() {
  const { data, error } = await supabase
    .from('event_types')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  eventTypesByName = new Map(data.map(row => [row.name, row]));
}

async function loadEventsForYear(year) {
  // Load all events for the selected year range (including recurring templates)
  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  // Non-recurring events in year
  const { data: singles, error: err1 } = await supabase
    .from('events')
    .select('*')
    .is('recurrence_rule', null)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });

  if (err1) throw err1;

  // Recurring templates (load all, filter client-side by month)
  const { data: recurs, error: err2 } = await supabase
    .from('events')
    .select('*')
    .not('recurrence_rule', 'is', null)
    .order('created_at', { ascending: true });

  if (err2) throw err2;

  events = [...(singles || []), ...(recurs || [])];
}

function dateToISO(d) {
  return d.toISOString().slice(0, 10);
}

function expandRecurring(template, monthStart, monthEnd) {
  // Simple RRULE support: DAILY / WEEKLY with BYDAY / MONTHLY, INTERVAL, UNTIL/end_date
  // Parse RRULE string into map
  const rule = (template.recurrence_rule || '').split(';').reduce((acc, part) => {
    const [k, v] = part.split('=');
    if (k && v) acc[k.toUpperCase()] = v.toUpperCase();
    return acc;
  }, {});
  const freq = rule.FREQ || 'DAILY';
  const interval = parseInt(rule.INTERVAL || '1', 10);
  const untilStr = rule.UNTIL || null;
  const until = untilStr ? new Date(untilStr) : (template.end_date ? new Date(template.end_date) : null);

  const byday = rule.BYDAY ? rule.BYDAY.split(',') : null;

  const startDate = new Date(template.start_date);
  const occurrences = [];
  const cur = new Date(Math.max(startDate, monthStart));

  function isMatchWeekly(d) {
    if (!byday) return true;
    const map = ['SU','MO','TU','WE','TH','FR','SA'];
    return byday.includes(map[d.getDay()]);
  }

  while (cur <= monthEnd) {
    if (until && cur > until) break;

    if (freq === 'DAILY') {
      occurrences.push(new Date(cur));
      cur.setDate(cur.getDate() + interval);
    } else if (freq === 'WEEKLY') {
      // Add occurrences within the week according to BYDAY; advance by interval weeks
      // Find week start (Sunday)
      const weekStart = new Date(cur);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        if (d < monthStart || d > monthEnd) continue;
        if (d >= startDate && (!until || d <= until) && isMatchWeekly(d)) {
          occurrences.push(d);
        }
      }
      cur.setDate(cur.getDate() + interval * 7);
    } else if (freq === 'MONTHLY') {
      // Occurs every interval months on the same day-of-month as start_date
      const d = new Date(cur.getFullYear(), cur.getMonth(), startDate.getDate());
      if (d >= monthStart && d <= monthEnd) occurrences.push(d);
      cur.setMonth(cur.getMonth() + interval);
    } else {
      // Fallback: treat as DAILY
      occurrences.push(new Date(cur));
      cur.setDate(cur.getDate() + interval);
    }
  }

  return occurrences.map(d => ({
    id: template.id,
    user_id: template.user_id,
    event_type_id: template.event_type_id,
    date: dateToISO(d),
    note: template.note,
    recurrence_rule: template.recurrence_rule,
    start_date: template.start_date,
    end_date: template.end_date
  }));
}

function groupEventsByDay(year, monthIdx) {
  const monthStart = new Date(year, monthIdx, 1);
  const monthEnd = new Date(year, monthIdx + 1, 0);
  const days = {};

  events.forEach(ev => {
    if (ev.recurrence_rule) {
      expandRecurring(ev, monthStart, monthEnd).forEach(occ => {
        days[occ.date] ??= [];
        days[occ.date].push(occ);
      });
    } else if (ev.date) {
      const d = new Date(ev.date);
      if (d >= monthStart && d <= monthEnd) {
        const key = dateToISO(d);
        days[key] ??= [];
        days[key].push(ev);
      }
    }
  });

  // Sort by name then note
  Object.values(days).forEach(list => list.sort((a, b) => {
    const ta = getEventTypeById(a.event_type_id);
    const tb = getEventTypeById(b.event_type_id);
    const na = ta?.name || '';
    const nb = tb?.name || '';
    return na.localeCompare(nb) || (a.note || '').localeCompare(b.note || '');
  }));
  return days;
}

function getEventTypeById(id) {
  for (const et of eventTypesByName.values()) {
    if (et.id === id) return et;
  }
  return null;
}

function colorForName(name) {
  const existing = eventTypesByName.get(name);
  if (existing) return existing.color;
  // Deterministic hash -> HSL
  const hash = Array.from(name).reduce((acc, c) => ((acc << 5) - acc) + c.charCodeAt(0), 0);
  const hue = Math.abs(hash) % 360;
  const color = `hsl(${hue} 70% 50%)`;
  return color;
}

// --- Rendering ---
async function renderCalendar() {
  await Promise.all([loadEventTypes(), loadEventsForYear(currentYear)]);
  const matrix = getMonthMatrix(currentYear, currentMonthIndex);
  const grouped = groupEventsByDay(currentYear, currentMonthIndex);
  daysGrid.innerHTML = '';

  matrix.forEach(cell => {
    const iso = dateToISO(cell.date);
    const inMonthClass = cell.inMonth ? '' : 'muted';
    const dayDiv = document.createElement('div');
    dayDiv.className = 'day-cell';

    const head = document.createElement('div');
    head.className = 'day-header';

    const num = document.createElement('div');
    num.className = `day-number ${inMonthClass}`;
    num.textContent = cell.date.getDate();

    const addBtn = document.createElement('button');
    addBtn.className = 'add-btn';
    addBtn.textContent = '+ Add';
    addBtn.addEventListener('click', () => openEventModal({ date: iso }));

    head.appendChild(num);
    head.appendChild(addBtn);

    const list = document.createElement('div');
    list.className = 'events';

    const dayEvents = grouped[iso] || [];
    dayEvents.forEach(ev => {
      const et = getEventTypeById(ev.event_type_id);
      const pill = document.createElement('div');
      pill.className = 'event-pill';
      pill.style.borderLeftColor = et?.color || '#3b82f6';
      pill.addEventListener('click', () => openEventModal({ event: ev, date: iso }));

      const swatch = document.createElement('div');
      swatch.className = 'event-color-indicator';
      swatch.style.background = et?.color || '#3b82f6';

      const name = document.createElement('div');
      name.className = 'event-name';
      name.textContent = et?.name || 'Untitled';

      const note = document.createElement('div');
      note.className = 'muted';
      note.textContent = ev.note || '';

      pill.appendChild(swatch);
      pill.appendChild(name);
      if (ev.note) pill.appendChild(note);

      list.appendChild(pill);
    });

    dayDiv.appendChild(head);
    dayDiv.appendChild(list);
    daysGrid.appendChild(dayDiv);
  });
}

function initCalendar() {
  populateSelectors();
  currentYear = parseInt(yearSelect.value, 10);
  currentMonthIndex = parseInt(monthSelect.value, 10);
  renderCalendar();
}

// --- Modal logic ---
const modalBackdrop = document.getElementById('modal-backdrop');
const eventModal = document.getElementById('event-modal');
const eventForm = document.getElementById('event-form');
const eventModalTitle = document.getElementById('event-modal-title');
const eventName = document.getElementById('event-name');
const eventNote = document.getElementById('event-note');
const eventColor = document.getElementById('event-color');
const singlePane = document.getElementById('single-pane');
const recurringPane = document.getElementById('recurring-pane');
const tabs = Array.from(document.querySelectorAll('.tab'));
const singleDate = document.getElementById('single-date');
const recStart = document.getElementById('rec-start');
const recEnd = document.getElementById('rec-end');
const recFrequency = document.getElementById('rec-frequency');
const recWeeklyPane = document.getElementById('rec-weekly');
const recIntervalPane = document.getElementById('rec-interval');
const recIntervalInput = document.getElementById('rec-interval-input');
const recCustomPane = document.getElementById('rec-custom');
const rruleCustom = document.getElementById('rrule-custom');
const deleteEventBtn = document.getElementById('delete-event-btn');
const cancelEventBtn = document.getElementById('cancel-event-btn');
const eventError = document.getElementById('event-error');

tabs.forEach(tab => tab.addEventListener('click', () => {
  tabs.forEach(t => t.classList.remove('active'));
  tab.classList.add('active');
  if (tab.dataset.tab === 'single') {
    singlePane.classList.remove('hidden');
    recurringPane.classList.add('hidden');
  } else {
    singlePane.classList.add('hidden');
    recurringPane.classList.remove('hidden');
  }
}));

recFrequency.addEventListener('change', () => {
  const val = recFrequency.value;
  recWeeklyPane.classList.toggle('hidden', val !== 'WEEKLY');
  recCustomPane.classList.toggle('hidden', val !== 'CUSTOM');
  recIntervalPane.classList.toggle('hidden', val === 'CUSTOM');
});

function openEventModal({ date, event }) {
  eventError.textContent = '';
  editingEvent = event || null;
  eventModalTitle.textContent = editingEvent ? 'Edit event' : 'Add event';

  // Default panes
  const single = !editingEvent || !editingEvent.recurrence_rule;
  tabs.forEach(t => t.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${single ? 'single' : 'recurring'}"]`).classList.add('active');
  singlePane.classList.toggle('hidden', !single);
  recurringPane.classList.toggle('hidden', !!single);

  if (editingEvent) {
    const et = getEventTypeById(editingEvent.event_type_id);
    eventName.value = et?.name || '';
    eventNote.value = editingEvent.note || '';
    eventColor.value = toHexColor(et?.color || '#3b82f6');
    if (editingEvent.recurrence_rule) {
      recStart.value = editingEvent.start_date || '';
      recEnd.value = editingEvent.end_date || '';
      rruleCustom.value = editingEvent.recurrence_rule;
      recFrequency.value = inferFreq(editingEvent.recurrence_rule);
      recFrequency.dispatchEvent(new Event('change'));
    } else {
      singleDate.value = editingEvent.date || date;
    }
    deleteEventBtn.classList.remove('hidden');
  } else {
    eventName.value = '';
    eventNote.value = '';
    eventColor.value = toHexColor(colorForName(''));
    singleDate.value = date || '';
    recStart.value = date || '';
    recEnd.value = '';
    recFrequency.value = 'DAILY';
    recFrequency.dispatchEvent(new Event('change'));
    rruleCustom.value = '';
    deleteEventBtn.classList.add('hidden');
  }
  modalBackdrop.classList.remove('hidden');
  eventModal.classList.remove('hidden');
}

function closeEventModal() {
  modalBackdrop.classList.add('hidden');
  eventModal.classList.add('hidden');
  editingEvent = null;
}

cancelEventBtn.addEventListener('click', closeEventModal);
modalBackdrop.addEventListener('click', closeEventModal);

function toHexColor(c) {
  // Convert hsl(...) to hex fallback by rendering into canvas or naive mapping.
  // For simplicity, accept hex or hsl but return hex default.
  if (c.startsWith('#')) return c;
  return '#3b82f6';
}

function inferFreq(rrule) {
  const m = String(rrule || '').toUpperCase().match(/FREQ=(DAILY|WEEKLY|MONTHLY)/);
  return m ? m[1] : 'DAILY';
}

eventForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  eventError.textContent = '';
  const name = eventName.value.trim();
  if (!name) { eventError.textContent = 'Event name is required.'; return; }

  const color = eventColor.value;
  let et = eventTypesByName.get(name);
  try {
    if (!et) {
      // create event_type
      const { data, error } = await supabase
        .from('event_types')
        .insert([{ name, color, user_id: sessionUser.id }])
        .select()
        .single();
      if (error) throw error;
      et = data;
      eventTypesByName.set(name, et);
    } else if (et.color !== color) {
      // update color -> globally updates
      const { data, error } = await supabase
        .from('event_types')
        .update({ color })
        .eq('id', et.id)
        .select()
        .single();
      if (error) throw error;
      et = data;
      eventTypesByName.set(name, et);
    }

    if (editingEvent) {
      // update event
      if (editingEvent.recurrence_rule) {
        // recurring update
        const payload = {
          event_type_id: et.id,
          note: eventNote.value || null,
          recurrence_rule: buildRRULE(),
          start_date: recStart.value || null,
          end_date: recEnd.value || null
        };
        const { error } = await supabase
          .from('events')
          .update(payload)
          .eq('id', editingEvent.id);
        if (error) throw error;
      } else {
        // single update
        const payload = {
          event_type_id: et.id,
          note: eventNote.value || null,
          date: singleDate.value
        };
        const { error } = await supabase
          .from('events')
          .update(payload)
          .eq('id', editingEvent.id);
        if (error) throw error;
      }
    } else {
      // create event
      if (!isRecurringMode()) {
        if (!singleDate.value) { eventError.textContent = 'Date is required.'; return; }
        const { error } = await supabase
          .from('events')
          .insert([{
            user_id: sessionUser.id,
            event_type_id: et.id,
            date: singleDate.value,
            note: eventNote.value || null
          }]);
        if (error) throw error;
      } else {
        if (!recStart.value) { eventError.textContent = 'Start date is required.'; return; }
        const { error } = await supabase
          .from('events')
          .insert([{
            user_id: sessionUser.id,
            event_type_id: et.id,
            recurrence_rule: buildRRULE(),
            start_date: recStart.value,
            end_date: recEnd.value || null,
            note: eventNote.value || null
          }]);
        if (error) throw error;
      }
    }

    closeEventModal();
    await renderCalendar();
  } catch (err) {
    eventError.textContent = err.message || 'Save failed.';
  }
});

deleteEventBtn.addEventListener('click', async () => {
  if (!editingEvent) return;
  eventError.textContent = '';
  if (!confirm('Delete this event?')) return;
  try {
    const { error } = await supabase.from('events').delete().eq('id', editingEvent.id);
    if (error) throw error;
    closeEventModal();
    await renderCalendar();
  } catch (err) {
    eventError.textContent = err.message || 'Delete failed.';
  }
});

function isRecurringMode() {
  return document.querySelector('.tab.active')?.dataset.tab === 'recurring';
}

function buildRRULE() {
  const freq = recFrequency.value;
  if (freq === 'CUSTOM') {
    return rruleCustom.value.trim();
  }
  const parts = [`FREQ=${freq}`, `INTERVAL=${parseInt(recIntervalInput.value || '1', 10)}`];
  if (freq === 'WEEKLY') {
    const selected = Array.from(recWeeklyPane.querySelectorAll('input[type="checkbox"]:checked'))
      .map(el => el.value);
    if (selected.length) parts.push(`BYDAY=${selected.join(',')}`);
  }
  if (recEnd.value) parts.push(`UNTIL=${recEnd.value}`);
  return parts.join(';');
}

// --- Boot ---
checkSession();
