// --------- CONFIG ---------
const supabase_URL = "https://whrugfiojjbxkzjvtgjs.supabase.co";
const supabase_ANON_KEY = "sb_publishable_3qJoVWoF-Kfn1n2dAi0RgA_gqT-j5uN";
const BASE_BUDGET = 2000000.00; // R$ 2.000.000,00

// Initialize supabaseClient (UMD global is `supabaseClient`)
const supabaseClient = supabase.createClient(supabase_URL, supabase_ANON_KEY);

// --------- STATE ---------
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedDate = null; // YYYY-MM-DD
let eventsCache = []; // All events loaded for current month
let nameColorMap = {}; // { name: color }

// --------- UTIL ---------
function formatBRL(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function pad(n) { return n.toString().padStart(2, "0"); }

function dateToISO(dateObj) {
  const y = dateObj.getFullYear();
  const m = pad(dateObj.getMonth() + 1);
  const d = pad(dateObj.getDate());
  return `${y}-${m}-${d}`;
}

function randomColorHex(nameSeed = "") {
  let hash = 0;
  for (let i = 0; i < nameSeed.length; i++) {
    hash = (hash << 5) - hash + nameSeed.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  const saturation = 65;
  const lightness = 55;
  function hslToHex(h, s, l) {
    s /= 100; l /= 100;
    const k = n => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    const rgb = [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
    return "#" + rgb.map(x => x.toString(16).padStart(2, "0")).join("");
  }
  return hslToHex(hue, saturation, lightness);
}

// --------- supabaseClient DATA ---------
async function loadNameColors() {
  const { data, error } = await supabaseClient.from("name_colors").select("*");
  if (error) {
    console.error("loadNameColors error", error);
    return;
  }
  nameColorMap = {};
  data.forEach(row => { nameColorMap[row.name] = row.color; });
}

async function upsertNameColor(name, color) {
  nameColorMap[name] = color;
  const { error } = await supabaseClient
    .from("name_colors")
    .upsert({ name, color });
  if (error) console.error("upsertNameColor error", error);
}

async function loadEventsForMonth(year, month) {
  const firstDayISO = `${year}-${pad(month + 1)}-01`;
  const lastDay = new Date(year, month + 1, 0);
  const lastDayISO = dateToISO(lastDay);

  const { data, error } = await supabaseClient
    .from("events")
    .select("*")
    .gte("date", firstDayISO)
    .lte("date", lastDayISO)
    .order("date", { ascending: true });

  if (error) {
    console.error("loadEventsForMonth error", error);
    eventsCache = [];
  } else {
    eventsCache = data || [];
  }
}

async function createEvent(evt) {
  const { data, error } = await supabaseClient
    .from("events")
    .insert(evt)
    .select()
    .single();
  if (error) {
    console.error("createEvent error", error);
    return null;
  }
  if (evt.name && evt.color) await upsertNameColor(evt.name, evt.color);
  return data;
}

async function updateEvent(id, updates) {
  const { data, error } = await supabaseClient
    .from("events")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    console.error("updateEvent error", error);
    return null;
  }
  if (updates.name && updates.color) await upsertNameColor(updates.name, updates.color);
  return data;
}

async function deleteEvent(id) {
  const { error } = await supabaseClient
    .from("events")
    .delete()
    .eq("id", id);
  if (error) console.error("deleteEvent error", error);
}

// --------- RENDER ---------
function renderMonthHeader(year, month) {
  const monthNames = [
    "Janeiro","Fevereiro","Março","Abril","Maio","Junho",
    "Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"
  ];
  document.getElementById("monthYear").textContent = `${monthNames[month]} ${year}`;
}

function renderCalendar(year, month) {
  const cal = document.getElementById("calendar");
  cal.innerHTML = "";
  const daysOfWeek = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];

  // Cabeçalhos
  daysOfWeek.forEach(d => {
    const hd = document.createElement("div");
    hd.className = "day-header";
    hd.textContent = d;
    cal.appendChild(hd);
  });

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0=Domingo
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < firstDayIndex; i++) {
    const empty = document.createElement("div");
    empty.className = "day-cell";
    empty.style.visibility = "hidden";
    cal.appendChild(empty);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    cell.className = "day-cell";
    const dateISO = `${year}-${pad(month + 1)}-${pad(d)}`;

    const num = document.createElement("div");
    num.className = "day-number";
    num.textContent = d;
    cell.appendChild(num);

    const evWrap = document.createElement("div");
    evWrap.className = "day-events";

    const dayEvents = eventsCache.filter(e => e.date === dateISO);
    dayEvents.forEach(e => {
      const pill = document.createElement("div");
      pill.className = "event-pill";
      const color = e.color || nameColorMap[e.name] || randomColorHex(e.name || "");
      pill.style.background = color;
      pill.textContent = e.name;
      evWrap.appendChild(pill);
    });

    cell.appendChild(evWrap);

    cell.addEventListener("click", () => {
      selectedDate = dateISO;
      renderSelectedDatePanel();
      openCreateModal(dateISO);
    });

    cal.appendChild(cell);
  }
}

function renderSelectedDatePanel() {
  const label = document.getElementById("selectedDateLabel");
  const list = document.getElementById("eventList");
  list.innerHTML = "";

  if (!selectedDate) {
    label.textContent = "Selecione uma data";
    return;
  }
  const d = new Date(selectedDate);
  label.textContent = d.toLocaleDateString("pt-BR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  const dayEvents = eventsCache.filter(e => e.date === selectedDate);
  if (dayEvents.length === 0) {
    const empty = document.createElement("div");
    empty.className = "event-item";
    empty.textContent = "Sem eventos para esta data.";
    list.appendChild(empty);
  } else {
    dayEvents.forEach(e => {
      const item = document.createElement("div");
      item.className = "event-item";

      const dot = document.createElement("div");
      dot.className = "event-color-dot";
      dot.style.background = e.color || nameColorMap[e.name] || randomColorHex(e.name || "");
      item.appendChild(dot);

      const info = document.createElement("div");
      const title = document.createElement("div");
      title.className = "event-name";
      title.textContent = e.name;
      const desc = document.createElement("div");
      desc.className = "event-desc";
      desc.textContent = e.description || "";
      info.appendChild(title);
      info.appendChild(desc);
      item.appendChild(info);

      const val = document.createElement("div");
      val.textContent = e.value ? formatBRL(Number(e.value)) : formatBRL(0);
      item.appendChild(val);

      const actions = document.createElement("div");
      actions.className = "event-actions";
      const editBtn = document.createElement("button");
      editBtn.textContent = "Editar";
      editBtn.addEventListener("click", () => openEditModal(e));
      const delBtn = document.createElement("button");
      delBtn.textContent = "Excluir";
      delBtn.className = "danger";
      delBtn.addEventListener("click", async () => {
        await deleteEvent(e.id);
        await refreshMonth();
        renderSelectedDatePanel();
        updateTodayBudget();
      });
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);
      item.appendChild(actions);

      list.appendChild(item);
    });
  }
}

function updateTodayBudget() {
  const todayISO = dateToISO(new Date());
  const todaysEvents = eventsCache.filter(e => e.date === todayISO);
  const spent = todaysEvents.reduce((sum, e) => sum + Number(e.value || 0), 0);
  const remaining = BASE_BUDGET - spent;
  document.getElementById("budgetValue").textContent = formatBRL(BASE_BUDGET);
  document.getElementById("spentValue").textContent = formatBRL(spent);
  document.getElementById("remainingValue").textContent = formatBRL(Math.max(remaining, 0));
}

// --------- MODAL ---------
const modalEl = document.getElementById("eventModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const newEventBtn = document.getElementById("newEventBtn");
const autoColorBtn = document.getElementById("autoColorBtn");
const eventForm = document.getElementById("eventForm");
const deleteEventBtn = document.getElementById("deleteEventBtn");

function openCreateModal(dateISO) {
  setModalData({
    id: "",
    name: "",
    description: "",
    date: dateISO || selectedDate || dateToISO(new Date()),
    value: "",
    color: ""
  });
  document.getElementById("modalTitle").textContent = "Novo evento";
  deleteEventBtn.classList.add("hidden");
  showModal();
}

function openEditModal(eventObj) {
  setModalData({
    id: eventObj.id,
    name: eventObj.name || "",
    description: eventObj.description || "",
    date: eventObj.date,
    value: eventObj.value || "",
    color: eventObj.color || nameColorMap[eventObj.name] || randomColorHex(eventObj.name || "")
  });
  document.getElementById("modalTitle").textContent = "Editar evento";
  deleteEventBtn.classList.remove("hidden");
  showModal();
}

function setModalData(data) {
  document.getElementById("eventId").value = data.id || "";
  document.getElementById("eventName").value = data.name || "";
  document.getElementById("eventDescription").value = data.description || "";
  document.getElementById("eventDate").value = data.date || dateToISO(new Date());
  document.getElementById("eventValue").value = data.value || "";
  document.getElementById("eventColor").value = data.color || "#b9c1cc";
}

function showModal() { modalEl.classList.remove("hidden"); }
function hideModal() { modalEl.classList.add("hidden"); }

closeModalBtn.addEventListener("click", hideModal);
newEventBtn.addEventListener("click", () => {
  if (!selectedDate) selectedDate = dateToISO(new Date());
  openCreateModal(selectedDate);
});

autoColorBtn.addEventListener("click", async () => {
  const name = document.getElementById("eventName").value.trim();
  if (!name) return;
  const color = nameColorMap[name] || randomColorHex(name);
  document.getElementById("eventColor").value = color;
});

deleteEventBtn.addEventListener("click", async () => {
  const id = document.getElementById("eventId").value;
  if (!id) return;
  await deleteEvent(id);
  hideModal();
  await refreshMonth();
  renderSelectedDatePanel();
  updateTodayBudget();
});

eventForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("eventId").value;
  const name = document.getElementById("eventName").value.trim();
  const description = document.getElementById("eventDescription").value.trim();
  const date = document.getElementById("eventDate").value;
  const value = parseFloat(document.getElementById("eventValue").value || "0");
  const color = document.getElementById("eventColor").value;

  const finalColor = color || nameColorMap[name] || randomColorHex(name);
  await upsertNameColor(name, finalColor);

  if (!name || !date) return;

  if (!id) {
    await createEvent({ name, description, date, value, color: finalColor });
  } else {
    await updateEvent(id, { name, description, date, value, color: finalColor });
  }

  hideModal();
  selectedDate = date;
  await refreshMonth();
  renderSelectedDatePanel();
  updateTodayBudget();
});

// --------- NAV ---------
document.getElementById("prevBtn").addEventListener("click", async () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  await refreshMonth();
});
document.getElementById("nextBtn").addEventListener("click", async () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  await refreshMonth();
});
document.getElementById("todayBtn").addEventListener("click", async () => {
  const today = new Date();
  currentYear = today.getFullYear();
  currentMonth = today.getMonth();
  selectedDate = dateToISO(today);
  await refreshMonth();
  renderSelectedDatePanel();
});

// --------- REFRESH ---------
async function refreshMonth() {
  renderMonthHeader(currentYear, currentMonth);
  await loadNameColors();
  await loadEventsForMonth(currentYear, currentMonth);
  renderCalendar(currentYear, currentMonth);
  updateTodayBudget();
}

// --------- INIT ---------
(async function init() {
  const today = new Date();
  selectedDate = dateToISO(today);
  await refreshMonth();
  renderSelectedDatePanel();
})();
