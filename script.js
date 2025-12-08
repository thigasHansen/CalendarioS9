// Supabase client setup
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const supabaseUrl = "https://whrugfiojjbxkzjvtgjs.supabase.co";   // replace with your project URL
const supabaseKey = "sb_publishable_3qJoVWoF-Kfn1n2dAi0RgA_gqT-j5uN";              // replace with your anon key
const supabase = createClient(supabaseUrl, supabaseKey);

// State
let currentYear;
let currentMonth;
let events = {};   // { "YYYY-MM-DD": [ {id, name, details, recurrence} ] }
let colorMap = {}; // { "Event Name": "#RRGGBB" }

// Utilities
const formatDateKey = (y, m, d) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const monthName = (m) =>
  ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][m];

const getColorForName = (name) => {
  if (colorMap[name]) return colorMap[name];
  const palette = ["#ef4444","#f59e0b","#22c55e","#10b981","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#84cc16","#e11d48"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  const color = palette[Math.abs(hash) % palette.length];
  colorMap[name] = color;
  return color;
};

// Supabase CRUD
async function loadEvents() {
  const { data, error } = await supabase.from("events").select("*");
  if (error) { console.error(error); return {}; }
  return data.reduce((acc, ev) => {
    if (!acc[ev.date]) acc[ev.date] = [];
    acc[ev.date].push(ev);
    return acc;
  }, {});
}

async function addEvent(ev) {
  const { error } = await supabase.from("events").insert([ev]);
  if (error) console.error(error);
}

async function updateEvent(id, changes) {
  const { error } = await supabase.from("events").update(changes).eq("id", id);
  if (error) console.error(error);
}

async function deleteEvent(id) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) console.error(error);
}

// DOM refs
const yearSelect = document.getElementById("yearSelect");
const monthSelect = document.getElementById("monthSelect");
const todayBtn = document.getElementById("todayBtn");
const viewTitle = document.getElementById("viewTitle");
const grid = document.getElementById("grid");

const eventModal = document.getElementById("eventModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const eventForm = document.getElementById("eventForm");
const eventDateInput = document.getElementById("eventDate");
const eventNameInput = document.getElementById("eventName");
const eventDetailsInput = document.getElementById("eventDetails");
const eventColorInput = document.getElementById("eventColor");
const deleteEventBtn = document.getElementById("deleteEventBtn");
const eventListEl = document.getElementById("eventList");

const eventRecurrenceSelect = document.getElementById("eventRecurrence");
const eventIntervalInput = document.getElementById("eventInterval");
const eventUntilInput = document.getElementById("eventUntil");

// Modal state
let modalDateKey = null;
let editingEventId = null;

// Init
async function init() {
  // Populate year select (2025–2026)
  [2025, 2026].forEach((y) => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearSelect.appendChild(opt);
  });

  const today = new Date();
  currentYear = today.getFullYear() >= 2025 && today.getFullYear() <= 2026
    ? today.getFullYear() : 2025;
  currentMonth = today.getMonth();

  yearSelect.value = currentYear;
  monthSelect.value = String(currentMonth);

  // Attach listeners
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
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();
    yearSelect.value = currentYear;
    monthSelect.value = String(currentMonth);
    renderCalendar();
  });

  closeModalBtn.addEventListener("click", closeEventModal);
  eventForm.addEventListener("submit", onEventFormSubmit);
  deleteEventBtn.addEventListener("click", onDeleteEvent);

  // Load events from Supabase before rendering
  events = await loadEvents();
  renderCalendar();
}

// Calendar rendering
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

// Event modal functions
function openEventModal(dateKey, eventId = null) {
  modalDateKey = dateKey;
  editingEventId = eventId;

  eventDateInput.value = dateKey;
  eventNameInput.value = "";
  eventDetailsInput.value = "";
  deleteEventBtn.style.display = "none";
  eventRecurrenceSelect.value = "";
  eventIntervalInput.value = "1";
