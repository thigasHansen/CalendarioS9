// script.js
(function () {
  const DAILY_LIMIT = 2000000.00;
  const START_MONTH = new Date(2025, 11, 1); // Dec 2025
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
    // Auth
    openLoginBtn: document.getElementById('openLoginBtn'),
    logoutBtn: document.getElementById('logoutBtn'),
    loginModal: document.getElementById('loginModal'),
    loginForm: document.getElementById('loginForm'),
    loginUsername: document.getElementById('loginUsername'),
    loginPassword: document.getElementById('loginPassword'),
    cancelLoginBtn: document.getElementById('cancelLoginBtn'),
  };

  // State
  let currentMonth = new Date(START_MONTH);
  const today = new Date();
  let selectedDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let pendingDeleteId = null;
  let eventsCache = new Map();
  let userId = null;

  const fmtCurrency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const fmtDate = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' });
  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
  }

  function toISODate(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function colorFromName(name) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
      hash = hash & hash;
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue} 70% 50%)`;
  }

  function parseBRL(input) {
    const normalized = input.replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
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
      .order('event_date', { ascending: true });

    if (error) {
      console.error('Erro ao carregar eventos', error);
      return;
    }
    eventsCache.clear();
    data.forEach(ev => {
      const key = ev.event_date;
      if (!eventsCache.has(key)) eventsCache.set(key, []);
      eventsCache.get(key).push(ev);
    });
  }

  // ... calendar rendering functions (renderMonth, renderSideList, updateBudgetPanel, etc.)
  // Keep your existing implementations here

  async function saveEvent() {
    const id = els.eventId.value;
    const name = els.eventName.value.trim();
    const valueRaw = els.eventValue.value.trim();
    const value = parseBRL(valueRaw);
    const color = els.eventColor.value || null;
    const description = els.eventDescription.value.trim();

    if (!userId) { alert('Entre para salvar eventos.'); return; }
    if (!name) { alert('Nome é obrigatório'); return; }
    if (value === null) { alert('Valor inválido'); return; }
    if (value < 0) { alert('Valor deve ser positivo'); return; }

    const payload = {
      name,
      value,
      description: description.length ? description : null,
      color: color,
      user_id: userId,
      event_date: toISODate(selectedDate),
    };

    if (!id) {
      const { error } = await client.from('events').insert(payload);
      if (error) { alert('Erro ao salvar evento'); console.error(error); return; }
    } else {
      const { error } = await client.from('events').update(payload).eq('id', id).eq('user_id', userId);
      if (error) { alert('Erro ao atualizar evento'); console.error(error); return; }
    }

    els.eventModal.close();
    await loadMonthEvents(currentMonth);
    renderMonth(currentMonth);
  }

  async function deleteEvent() {
    if (!pendingDeleteId) { els.confirmDeleteModal.close(); return; }
    const { error } = await client.from('events').delete().eq('id', pendingDeleteId).eq('user_id', userId);
    if (error) { alert('Erro ao excluir evento'); console.error(error); }
    pendingDeleteId = null;
    els.confirmDeleteModal.close();
    await loadMonthEvents(currentMonth);
    renderMonth(currentMonth);
  }

  // Auth UI logic
  async function refreshAuthUI() {
    const { data: { session } } = await client.auth.getSession();
    userId = session?.user?.id || null;

    els.logoutBtn.style.display = userId ? 'inline-block' : 'none';
    els.newEventBtn.disabled = !userId;
  }

  // Login modal events
  els.openLoginBtn.addEventListener('click', () => els.loginModal.showModal());
  els.cancelLoginBtn.addEventListener('click', () => els.loginModal.close());

  els.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = els.loginUsername.value.trim();
    const password = els.loginPassword.value;

    const { data, error } = await client
      .from('usernames')
      .select('email')
      .eq('username', username)
      .single();

    if (error || !data) {
      alert('Usuário não encontrado');
      console.error(error);
      return;
    }

    const { error: loginError } = await client.auth.signInWithPassword({
      email: data.email,
      password,
    });

    if (loginError) {
      alert('Erro ao entrar');
      console.error(loginError);
    } else {
      els.loginModal.close();
      await refreshAuthUI();
      await loadMonthEvents(currentMonth);
      renderMonth(currentMonth);
    }
  });

  els.logoutBtn.addEventListener('click', async () => {
    await client.auth.signOut();
    userId = null;
    await refreshAuthUI();
    await loadMonthEvents(currentMonth);
    renderMonth(currentMonth);
  });

  // Initial render
  renderWeekHeader();
  (async function init() {
    await refreshAuthUI();
    await loadMonthEvents(START_MONTH);
    renderMonth(currentMonth);
  })();
})();
