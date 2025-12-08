// Supabase client
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// TODO: Replace with your Supabase URL and anon key
const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_PUBLIC_ANON_KEY";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State
let currentYear;
let currentMonth;
let events = {};   // { "YYYY-MM-DD": [ {id, date, name, details, user_id} ] }
let colorMap = {}; // { "Event Name": "#RRGGBB" }
let sessionUser = null;

// Utilities
const monthName = (m) =>
  ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][m];
const formatDateKey = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const getColorForName = (name) => {
  if (colorMap[name]) return colorMap[name];
  const palette = ["#ef4444","#f59e0b","#22c55e","#10b981","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#84cc16","#e11d48"];
  let hash = 0; for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  const color = palette[Math.abs(hash) % palette.length];
  colorMap[name] = color;
  return color;
};

// DOM refs
const yearSelect = document.getElementById("yearSelect");
const monthSelect = document.getElementById("monthSelect");
const todayBtn = document.getElementById("todayBtn");
const viewTitle = document.getElementById("viewTitle");
const grid = document.getElementById("grid");
const signOutBtn = document.getElementById("signOutBtn");

const eventModal = document.getElementById("eventModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const eventForm = document.getElementById("eventForm");
const eventDateInput = document.getElementById("eventDate");
const eventNameInput = document.getElementById("eventName");
const eventDetailsInput = document.getElementById("eventDetails");
const eventColorInput = document.getElementById("eventColor");
const deleteEventBtn = document.getElementById("deleteEventBtn");
const eventListEl = document.getElementById("eventList");

const colorsModal = document.getElementById("colorsModal");
const manageColorsBtn = document.getElementById("manageColorsBtn");
const closeColorsBtn = document.getElementById("closeColorsBtn");
const colorMapList = document.getElementById("colorMapList");
const newEventKeyInput = document.getElementById("newEventKey");
const newEventColorInput = document.getElementById("newEventColor");
const addColorMapBtn = document.getElementById("addColorMapBtn");

const authModal = document.getElementById("authModal");
const authForm = document.getElementById("authForm");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const signInBtn = document.getElementById("signInBtn");
const signUpBtn = document.getElementById("signUpBtn");
const authError = document.getElementById("authError");

// Auth
async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession();
  sessionUser = session?.user || null;
  if (!sessionUser) {
    openAuthModal();
  } else {
    closeAuthModal();
  }
}
function openAuthModal() {
  authModal.classList.add("show");
  authModal.setAttribute("aria-hidden", "false");
}
function closeAuthModal() {
  authModal.classList.remove("show");
  authModal.setAttribute("aria-hidden", "true");
}
authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.style.display = "none";
  const email = authEmail.value.trim();
  const password = authPassword.value.trim();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    authError.textContent = error.message;
    authError.style.display = "block";
  } else {
    await postAuthLoad();
  }
});
signUpBtn.addEventListener("click", async () => {
  authError.style.display = "none";
  const email = authEmail.value.trim();
  const password = authPassword.value.trim();
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) {
    authError.textContent = error.message;
    authError.style.display = "block";
  } else {
    authError.textContent = "Conta criada. Verifique seu email para confirmar.";
    authError.style.display = "block";
  }
});
signOutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  sessionUser = null;
  openAuthModal();
});

// Data: events table CRUD
async function loadEvents() {
  if (!sessionUser) return {};
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("user_id", sessionUser.id);
  if (error) {
    console.error(error);
    return {};
  }
  return data.reduce((acc, ev) => {
    if (!acc[ev.date]) acc[ev.date] = [];
    acc[ev.date].push(ev);
    return acc;
  }, {});
}
async function addEventDB(ev) {
  const { error } = await supabase.from("events").insert([ev]);
  if (error) console.error(error);
}
async function updateEventDB(id, changes) {
  const { error } = await supabase.from("events").update(changes).eq("id", id);
  if (error) console.error(error);
}
async function deleteEventDB(id) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) console.error(error);
}

// Data: color map per user
async function loadColors() {
  if (!sessionUser) return {};
  const { data, error } = await supabase
    .from("event_colors")
    .select("*")
    .eq("user_id", sessionUser.id);
  if (error) { console.error(error); return {}; }
  return data.reduce((acc, row) => {
    acc[row.name] = row.color;
    return acc;
  }, {});
}
async function upsertColor(name, color) {
  const { error } = await supabase
    .from("event_colors")
    .upsert({ user_id: sessionUser.id, name, color }, { onConflict: "user_id,name" });
  if (error) console.error(error);
}
async function deleteColor(name) {
  const { error } = await supabase
    .from("event_colors")
    .delete()
    .eq("user_id", sessionUser.id)
    .eq("name", name);
  if (error) console.error(error);
}

// Init
document.addEventListener("DOMContentLoaded", init);
async function init() {
  // populate years
  [2025, 2026].forEach((y) => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearSelect.appendChild(opt);
  });

  const today = new Date();
  currentYear = (today.getFullYear() >= 2025 && today.getFullYear() <= 2026) ? today.getFullYear() : 2025;
  currentMonth = today.getMonth();
  yearSelect.value = currentYear;
  monthSelect.value = String(currentMonth);

  yearSelect.addEventListener("change", () => {
    currentYear = Number(yearSelect.value);
    renderCalendar();
  });
  monthSelect.addEventListener("change", () => {
    currentMonth = Number(monthSelect.value);
    renderCalendar();
  });
  todayBtn.addEventListener("click", () => {
    const now = new Date();
    currentYear = Math.min(2026, Math.max(2025, now.getFullYear()));
    currentMonth = now.getMonth();
    yearSelect.value = currentYear;
    monthSelect.value = String(currentMonth);
    renderCalendar();
  });

  manageColorsBtn.addEventListener("click", openColorsModal);
  closeColorsBtn.addEventListener("click", closeColorsModal);
  addColorMapBtn.addEventListener("click", async () => {
    const key = newEventKeyInput.value.trim();
    const color = newEventColorInput.value;
    if (!key) return;
    colorMap[key] = color;
    await upsertColor(key, color);
    newEventKeyInput.value = "";
    renderColorMapList();
    renderCalendar();
  });

  closeModalBtn.addEventListener("click", closeEventModal);
  eventForm.addEventListener("submit", onEventFormSubmit);
  deleteEventBtn.addEventListener("click", onDeleteEvent);

  await checkSession();
  if (sessionUser) await postAuthLoad();
}

async function postAuthLoad() {
  colorMap = await loadColors();
  events = await loadEvents();
  renderCalendar();
}

// Calendar
function renderCalendar() {
  viewTitle.textContent = `${monthName(currentMonth)} ${currentYear}`;
  grid.innerHTML = "";

  const firstOfMonth = new Date(currentYear, currentMonth, 1);
  const startDay = firstOfMonth.getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

  const totalCells = 42;
  for (let cell = 0; cell < totalCells; cell++) {
    const dayEl = document.createElement("div");
    dayEl.className = "day";

    let isOtherMonth = false;
    let dayNum;
    let cellDate;

    if (cell < startDay) {
      dayNum = prevMonthDays - startDay + cell + 1;
      isOtherMonth = true;
      cellDate = new Date(currentYear, currentMonth - 1, dayNum);
    } else if (cell >= startDay + daysInMonth) {
      dayNum = cell - (startDay + daysInMonth) + 1;
      isOtherMonth = true;
      cellDate = new Date(currentYear, currentMonth + 1, dayNum);
    } else {
      dayNum = cell - startDay + 1;
      cellDate = new Date(currentYear, currentMonth, dayNum);
    }

    const dateKey = formatDateKey(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate());

    const header = document.createElement("div");
    header.className = "day-header";
    const num = document.createElement("div");
    num.className = "day-num";
    num.textContent = dayNum;

    const addBtn = document.createElement("button");
    addBtn.className = "icon-btn";
    addBtn.textContent = "+";
    addBtn.title = "Adicionar evento";
    addBtn.addEventListener("click", () => openEventModal(dateKey));

    header.appendChild(num);
    header.appendChild(addBtn);

    const list = document.createElement("div");
    list.className = "event-list";

    const items = events[dateKey] || [];
    items.forEach((ev) => {
      const chip = document.createElement("div");
      chip.className = "event-chip";
      chip.addEventListener("click", () => openEventModal(dateKey, ev.id));

      const dot = document.createElement("span");
      dot.className = "event-dot";
      dot.style.background = getColorForName(ev.name);

      const nameEl = document.createElement("span");
      nameEl.className = "event-name";
      nameEl.textContent = ev.name;

      if (ev.details) {
        const det = document.createElement("span");
        det.className = "event-details";
        det.textContent = ev.details;
        chip.appendChild(dot);
        chip.appendChild(nameEl);
        chip.appendChild(det);
      } else {
        chip.appendChild(dot);
        chip.appendChild(nameEl);
      }

      list.appendChild(chip);
    });

    dayEl.appendChild(header);
    dayEl.appendChild(list);

    const today = new Date();
    if (
      cellDate.getFullYear() === today.getFullYear() &&
      cellDate.getMonth() === today.getMonth() &&
      cellDate.getDate() === today.getDate()
    ) {
      dayEl.classList.add("today");
    }
    if (isOtherMonth) dayEl.classList.add("other-month");

    grid.appendChild(dayEl);
  }
}

// Event modal
let modalDateKey = null;
let editingEventId = null;

function openEventModal(dateKey, eventId = null) {
  modalDateKey = dateKey;
  editingEventId = eventId;

  eventDateInput.value = dateKey;
  eventNameInput.value = "";
  eventDetailsInput.value = "";
  deleteEventBtn.style.display = "none";

  if (eventId) {
    const list = events[dateKey] || [];
    const target = list.find((ev) => ev.id === eventId);
    if (target) {
      eventNameInput.value = target.name;
      eventDetailsInput.value = target.details || "";
      deleteEventBtn.style.display = "inline-block";
    }
  }

  updateEventColorPreview();
  renderEventListForDay(dateKey);

  eventModal.classList.add("show");
  eventModal.setAttribute("aria-hidden", "false");
}
function closeEventModal() {
  eventModal.classList.remove("show");
  eventModal.setAttribute("aria-hidden", "true");
  modalDateKey = null;
  editingEventId = null;
}
function renderEventListForDay(dateKey) {
  eventListEl.innerHTML = "";
  const list = events[dateKey] || [];
  if (list.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Sem eventos.";
    li.style.color = "#94a3b8";
    eventListEl.appendChild(li);
    return;
  }
  list.forEach((ev) => {
    const li = document.createElement("li");
    li.className = "event-chip";
    li.addEventListener("click", () => openEventModal(dateKey, ev.id));

    const dot = document.createElement("span");
    dot.className = "event-dot";
    dot.style.background = getColorForName(ev.name);

    const nameEl = document.createElement("span");
    nameEl.className = "event-name";
    nameEl.textContent = ev.name;

    const det = document.createElement("span");
    det.className = "event-details";
    det.textContent = ev.details || "";

    li.appendChild(dot);
    li.appendChild(nameEl);
    if (ev.details) li.appendChild(det);
    eventListEl.appendChild(li);
  });

  eventNameInput.removeEventListener("input", updateEventColorPreview);
  eventNameInput.addEventListener("input", updateEventColorPreview);
}
function updateEventColorPreview() {
  const name = eventNameInput.value.trim();
  eventColorInput.value = name ? (colorMap[name] || getColorForName(name)) : "#2f80ed";
}

async function onEventFormSubmit(e) {
  e.preventDefault();
  if (!sessionUser) return;

  const name = eventNameInput.value.trim();
  if (!name) return;
  const details = eventDetailsInput.value.trim();
  const dateKey = modalDateKey;

  if (editingEventId) {
    const list = events[dateKey] || [];
    const idx = list.findIndex((ev) => ev.id === editingEventId);
    if (idx >= 0) {
      await updateEventDB(editingEventId, { name, details });
    }
  } else {
    await addEventDB({
      date: dateKey,
      name,
      details,
      user_id: sessionUser.id
    });
  }

  // Ensure color mapping exists
  const color = colorMap[name] || getColorForName(name);
  await upsertColor(name, color);

  events = await loadEvents();
  renderCalendar();
  renderEventListForDay(dateKey);
  closeEventModal();
}

async function onDeleteEvent() {
  if (!editingEventId) return;
  await deleteEventDB(editingEventId);
  events = await loadEvents();
  renderCalendar();
  closeEventModal();
}

// Colors modal
function openColorsModal() {
  renderColorMapList();
  colorsModal.classList.add("show");
  colorsModal.setAttribute("aria-hidden", "false");
}
function closeColorsModal() {
  colorsModal.classList.remove("show");
  colorsModal.setAttribute("aria-hidden", "true");
}
function renderColorMapList() {
  colorMapList.innerHTML = "";
  const keys = Object.keys(colorMap).sort((a, b) => a.localeCompare(b));
  if (keys.length === 0) {
    const li = document.createElement("li");
    li.textContent = "Nenhum mapeamento de cor ainda.";
    li.style.color = "#94a3b8";
    colorMapList.appendChild(li);
    return;
  }
  keys.forEach((key) => {
    const li = document.createElement("li");
    li.className = "color-map-item";

    const swatch = document.createElement("span");
    swatch.className = "color-swatch";
    swatch.style.background = colorMap[key];

    const name = document.createElement("span");
    name.textContent = key;

    const colorInput = document.createElement("input");
    colorInput.type = "color";
    colorInput.value = colorMap[key];
    colorInput.addEventListener("input", async (e) => {
      colorMap[key] = e.target.value;
      swatch.style.background = e.target.value;
      await upsertColor(key, e.target.value);
      renderCalendar(); // apply globally
    });

    const actions = document.createElement("div");
    actions.className = "color-map-actions";

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn btn-danger";
    removeBtn.textContent = "Remover";
    removeBtn.addEventListener("click", async () => {
      delete colorMap[key];
      await deleteColor(key);
      renderColorMapList();
      renderCalendar();
    });

    actions.appendChild(colorInput);
    actions.appendChild(removeBtn);

    li.appendChild(swatch);
    li.appendChild(name);
    li.appendChild(actions);

    colorMapList.appendChild(li);
  });
}
