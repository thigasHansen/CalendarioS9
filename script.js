// Storage keys
const STORAGE_EVENTS = "planner.events";
const STORAGE_COLORS = "planner.colors";

// State
let currentYear;
let currentMonth; // 0-11
let events = {};  // { "YYYY-MM-DD": [ {id, name, details} ] }
let colorMap = {}; // { "Event Name": "#RRGGBB" }

// Utilities
const formatDateKey = (y, m, d) =>
  `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

const monthName = (m) =>
  ["January","February","March","April","May","June","July","August","September","October","November","December"][m];

const loadStorage = () => {
  try {
    events = JSON.parse(localStorage.getItem(STORAGE_EVENTS)) || {};
    colorMap = JSON.parse(localStorage.getItem(STORAGE_COLORS)) || {};
  } catch (e) {
    events = {};
    colorMap = {};
  }
};

const saveEvents = () =>
  localStorage.setItem(STORAGE_EVENTS, JSON.stringify(events));

const saveColors = () =>
  localStorage.setItem(STORAGE_COLORS, JSON.stringify(colorMap));

const getColorForName = (name) => {
  if (colorMap[name]) return colorMap[name];
  // Assign deterministic fallback color from name hash
  const palette = [
    "#ef4444","#f59e0b","#22c55e","#10b981","#3b82f6","#8b5cf6","#ec4899","#14b8a6","#84cc16","#e11d48"
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) & 0xffffffff;
  }
  const color = palette[Math.abs(hash) % palette.length];
  colorMap[name] = color; // persist for consistency
  saveColors();
  return color;
};

// DOM refs
const yearSelect = document.getElementById("yearSelect");
const monthSelect = document.getElementById("monthSelect");
const todayBtn = document.getElementById("todayBtn");
const viewTitle = document.getElementById("viewTitle");
const grid = document.getElementById("grid");

// Modals
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

// Modal state
let modalDateKey = null;
let editingEventId = null;

// Init
function init() {
  loadStorage();

  // Populate year select (2025–2026)
  [2025, 2026].forEach((y) => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearSelect.appendChild(opt);
  });

  const today = new Date();
  const startYear = today.getFullYear() >= 2025 && today.getFullYear() <= 2026
    ? today.getFullYear() : 2025;

  currentYear = startYear;
  currentMonth = today.getFullYear() === startYear ? today.getMonth() : 0;

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
    if (now.getFullYear() < 2025) {
      currentYear = 2025; currentMonth = 0;
    } else if (now.getFullYear() > 2026) {
      currentYear = 2026; currentMonth = 11;
    } else {
      currentYear = now.getFullYear();
      currentMonth = now.getMonth();
    }
    yearSelect.value = currentYear;
    monthSelect.value = String(currentMonth);
    renderCalendar();
  });

  manageColorsBtn.addEventListener("click", openColorsModal);
  closeColorsBtn.addEventListener("click", closeColorsModal);
  addColorMapBtn.addEventListener("click", addOrUpdateColorMap);

  closeModalBtn.addEventListener("click", closeEventModal);
  eventForm.addEventListener("submit", onEventFormSubmit);
  deleteEventBtn.addEventListener("click", onDeleteEvent);

  renderCalendar();
}

function renderCalendar() {
  viewTitle.textContent = `${monthName(currentMonth)} ${currentYear}`;
  grid.innerHTML = "";

  const firstOfMonth = new Date(currentYear, currentMonth, 1);
  const startDay = firstOfMonth.getDay(); // 0-6 (Sun-Sat)
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // For leading days (previous month)
  const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

  const totalCells = 42; // 6 weeks x 7 days for consistent full grid
  for (let cell = 0; cell < totalCells; cell++) {
    const dayEl = document.createElement("div");
    dayEl.className = "day";

    let isOtherMonth = false;
    let dayNum;
    let cellDate;

    if (cell < startDay) {
      // previous month
      dayNum = prevMonthDays - startDay + cell + 1;
      isOtherMonth = true;
      cellDate = new Date(currentYear, currentMonth - 1, dayNum);
    } else if (cell >= startDay + daysInMonth) {
      // next month
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
    addBtn.title = "Add event";
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

    // Mark today
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

  // If editing, preload data
  if (eventId) {
    const list = events[dateKey] || [];
    const target = list.find((ev) => ev.id === eventId);
    if (target) {
      eventNameInput.value = target.name;
      eventDetailsInput.value = target.details || "";
      deleteEventBtn.style.display = "inline-block";
    }
  }

  // Set color preview (based on current name)
  updateEventColorPreview();

  // Populate existing events list for this day
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
    li.textContent = "No events yet.";
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

  // Live color preview when typing name
  eventNameInput.removeEventListener("input", updateEventColorPreview);
  eventNameInput.addEventListener("input", updateEventColorPreview);
}

function updateEventColorPreview() {
  const name = eventNameInput.value.trim();
  if (!name) {
    eventColorInput.value = "#2f80ed";
    return;
  }
  const color = colorMap[name] || getColorForName(name);
  eventColorInput.value = color;
}

function onEventFormSubmit(e) {
  e.preventDefault();
  const name = eventNameInput.value.trim();
  if (!name) return; // required

  const details = eventDetailsInput.value.trim();
  const dateKey = modalDateKey;

  const list = events[dateKey] || [];
  if (editingEventId) {
    // Update existing
    const idx = list.findIndex((ev) => ev.id === editingEventId);
    if (idx >= 0) {
      list[idx].name = name;
      list[idx].details = details;
    }
  } else {
    // Add new
    const id = cryptoRandomId();
    list.push({ id, name, details });
  }
  events[dateKey] = list;
  saveEvents();

  // Ensure color consistency exists
  getColorForName(name);

  renderCalendar();
  renderEventListForDay(dateKey);
  closeEventModal();
}

function onDeleteEvent() {
  if (!editingEventId || !modalDateKey) return;
  const list = events[modalDateKey] || [];
  const filtered = list.filter((ev) => ev.id !== editingEventId);
  events[modalDateKey] = filtered;
  saveEvents();
  renderCalendar();
  closeEventModal();
}

function cryptoRandomId() {
  // Fallback-friendly UID
  return (Date.now().toString(36) + Math.random().toString(36).slice(2, 8)).toUpperCase();
}

// Manage colors modal
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
    li.textContent = "No event color mappings yet.";
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
    colorInput.addEventListener("input", (e) => {
      colorMap[key] = e.target.value;
      swatch.style.background = e.target.value;
      saveColors();
      renderCalendar(); // apply globally
    });

    const actions = document.createElement("div");
    actions.className = "color-map-actions";

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn btn-danger";
    removeBtn.textContent = "Remove";
    removeBtn.addEventListener("click", () => {
      delete colorMap[key];
      saveColors();
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

function addOrUpdateColorMap() {
  const key = newEventKeyInput.value.trim();
  const color = newEventColorInput.value;
  if (!key) return;
  colorMap[key] = color;
  saveColors();
  newEventKeyInput.value = "";
  renderColorMapList();
  renderCalendar();
}

// Kick off
document.addEventListener("DOMContentLoaded", init);
