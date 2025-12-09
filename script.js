// --------- CONFIG ---------
const SUPABASE_URL = "https://whrugfiojjbxkzjvtgjs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_3qJoVWoF-Kfn1n2dAi0RgA_gqT-j5uN";
const BASE_BUDGET = 2000000.00; // R$ 2.000.000,00

// Supabase client (global from UMD script)
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --------- STATE ---------
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedDate = dateToISO(new Date()); // default to today
let eventsCache = [];

// --------- UTIL ---------
function pad(n) { return n.toString().padStart(2, "0"); }
function dateToISO(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function parseISODateLocal(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d); // local date, avoids UTC shift
}
function formatBRL(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function nameToColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return hslToHex(hue, 65, 55);
}
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const rgb = [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
  return "#" + rgb.map(x => x.toString(16).padStart(2, "0")).join("");
}

// --------- DATA ---------
async function loadEventsForMonth(year, month) {
  const firstDayISO = `${year}-${pad(month+1)}-01`;
  const lastDayISO = dateToISO(new Date(year, month+1, 0));
  const { data, error } = await supabaseClient
    .from("events")
    .select("*")
    .gte("date", firstDayISO)
    .lte("date", lastDayISO)
    .order("date", { ascending: true });
  if (error) {
    console.warn("Supabase error:", error);
    eventsCache = [];
  } else {
    eventsCache = data || [];
  }
}
async function createEvent(evt) {
  const { error } = await supabaseClient.from("events").insert(evt);
  if (error) console.warn("createEvent error:", error);
}
async function updateEvent(id, updates) {
  const { error } = await supabaseClient.from("events").update(updates).eq("id", id);
  if (error) console.warn("updateEvent error:", error);
}
async function deleteEvent(id) {
  const { error } = await supabaseClient.from("events").delete().eq("id", id);
  if (error) console.warn("deleteEvent error:", error);
}

// --------- RENDER ---------
function renderMonthHeader(year, month) {
  const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  const el = document.getElementById("monthYear");
  if (el) el.textContent = `${months[month]} ${year}`;
}

function renderCalendar(year, month) {
  const cal = document.getElementById("calendar");
  if (!cal) return;
  cal.innerHTML = "";

  const daysOfWeek = ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"];
  daysOfWeek.forEach(d => {
    const hd = document.createElement("div");
    hd.className = "day-header";
    hd.textContent = d;
    cal.appendChild(hd);
  });

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  for (let i = 0; i < firstDayIndex; i++) {
    const empty = document.createElement("div");
    empty.className = "day-cell";
    empty.style.visibility = "hidden";
    cal.appendChild(empty);
  }

  const todayISO = dateToISO(new Date());

  for (let d = 1; d <= daysInMonth; d++) {
    const cell = document.createElement("div");
    cell.className = "day-cell";
    const dateISO = `${year}-${pad(month+1)}-${pad(d)}`;

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
      pill.textContent = e.name;
      evWrap.appendChild(pill);
    });
    cell.appendChild(evWrap);

    // Select date and redraw highlights
    cell.addEventListener("click", () => {
      selectedDate = dateISO;
      renderSelectedDatePanel();
      updateBudgetFor(dateISO);
      renderCalendar(currentYear, currentMonth);
    });

    // Highlights
    if (dateISO === todayISO) cell.classList.add("today");
    if (selectedDate && dateISO === selectedDate) cell.classList.add("selected");

    cal.appendChild(cell);
  }
}

function renderSelectedDatePanel() {
  const label = document.getElementById("selectedDateLabel");
  const list = document.getElementById("eventList");
  if (!label || !list) return;

  list.innerHTML = "";

  if (!selectedDate) {
    label.textContent = "Selecione uma data";
    return;
  }

  const d = parseISODateLocal(selectedDate);
  label.textContent = d.toLocaleDateString("pt-BR", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  const dayEvents = eventsCache.filter(e => e.date === selectedDate);
  if (dayEvents.length === 0) {
    const empty = document.createElement("div");
    empty.className = "event-item";
    empty.textContent = "Sem eventos para esta data.";
    list.appendChild(empty);
    return;
  }

  dayEvents.forEach(e => {
    const item = document.createElement("div");
    item.className = "event-item";

    const dot = document.createElement("div");
    dot.className = "event-color-dot";
    dot.style.background = e.color || "#b9c1cc";
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
    val.textContent = formatBRL(Number(e.value || 0));
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
      updateBudgetFor(selectedDate);
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);
    item.appendChild(actions);

    list.appendChild(item);
  });
}

function updateBudgetFor(dateISO) {
  const dayEvents = eventsCache.filter(e => e.date === dateISO);
  const spent = dayEvents.reduce((sum, e) => sum + Number(e.value || 0), 0);
  const remaining = BASE_BUDGET - spent;

  document.getElementById("budgetValue").textContent = formatBRL(BASE_BUDGET);
  document.getElementById("spentValue").textContent = formatBRL(spent);
  document.getElementById("remainingValue").textContent = formatBRL(Math.max(remaining, 0));
}

// --------- MODAL ---------
function setModalData(data) {
  document.getElementById("eventId").value = data.id || "";
  document.getElementById("eventName").value = data.name || "";
  document.getElementById("eventDescription").value = data.description || "";
  document.getElementById("eventDate").value = data.date || dateToISO(new Date());
  document.getElementById("eventValue").value = data.value || "";
  document.getElementById("eventColor").value = data.color || "#b9c1cc";
}
function showModal() {
  document.getElementById("eventModal").classList.remove("hidden");
}
function hideModal() {
  document.getElementById("eventModal").classList.add("hidden");
}
function openCreateModal(dateISO) {
  setModalData({
    id: "",
    name: "",
    description: "",
    date: dateISO || dateToISO(new Date()),
    value: "",
    color: ""
  });
  document.getElementById("modalTitle").textContent = "Novo evento";
  document.getElementById("deleteEventBtn").classList.add("hidden");
  showModal();
}
function openEditModal(eventObj) {
  setModalData({
    id: eventObj.id,
    name: eventObj.name || "",
    description: eventObj.description || "",
    date: eventObj.date,
    value: eventObj.value || "",
    color: eventObj.color || "#b9c1cc"
  });
  document.getElementById("modalTitle").textContent = "Editar evento";
  document.getElementById("deleteEventBtn").classList.remove("hidden");
  showModal();
}

// --------- EVENT LISTENERS ---------
document.getElementById("newEventBtn").addEventListener("click", () => {
  if (!selectedDate) selectedDate = dateToISO(new Date());
  openCreateModal(selectedDate);
});
document.getElementById("closeModalBtn").addEventListener("click", hideModal);
document.getElementById("deleteEventBtn").addEventListener("click", async () => {
  const id = document.getElementById("eventId").value;
  if (!id) return;
  await deleteEvent(id);
  hideModal();
  await refreshMonth();
  renderSelectedDatePanel();
  updateBudgetFor(selectedDate);
});
document.getElementById("autoColorBtn").addEventListener("click", () => {
  const name = document.getElementById("eventName").value.trim();
  if (!name) return;
  document.getElementById("eventColor").value = nameToColor(name);
});
document.getElementById("eventForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = document.getElementById("eventId").value;
  const name = document.getElementById("eventName").value.trim();
  const description = document.getElementById("eventDescription").value.trim();
  const date = document.getElementById("eventDate").value;
  const value = parseFloat(document.getElementById("eventValue").value || "0");
  const color = document.getElementById("eventColor").value || nameToColor(name);

  if (!name || !date) return;

  if (!id) {
    await createEvent({ name, description, date, value, color });
  } else {
    await updateEvent(id, { name, description, date, value, color });
  }

  hideModal();
  selectedDate = date;
  await refreshMonth();
  renderSelectedDatePanel();
  updateBudgetFor(selectedDate);
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
  updateBudgetFor(selectedDate);
});

// --------- INIT ---------
document.addEventListener("DOMContentLoaded", async () => {
  renderMonthHeader(currentYear, currentMonth);
  renderCalendar(currentYear, currentMonth);
  renderSelectedDatePanel();
  updateBudgetFor(selectedDate);

  await loadEventsForMonth(currentYear, currentMonth);
  renderCalendar(currentYear, currentMonth);
  renderSelectedDatePanel();
  updateBudgetFor(selectedDate);

// --------- REFRESH ---------
async function refreshMonth() {
  renderMonthHeader(currentYear, currentMonth);
  renderCalendar(currentYear, currentMonth);
  await loadEventsForMonth(currentYear, currentMonth);
  renderCalendar(currentYear, currentMonth);
  if (selectedDate) {
    updateBudgetFor(selectedDate);
  } else {
    selectedDate = dateToISO(new Date());
    updateBudgetFor(selectedDate);
    renderCalendar(currentYear, currentMonth);
  }
}
  )();
