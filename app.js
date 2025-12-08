const SUPABASE_URL = "https://whrugfiojjbxkzjvtgjs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_3qJoVWoF-Kfn1n2dAi0RgA_gqT-j5uN";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ====== Calendar bounds: Dec 2025 to Dec 2026 ======
const START_YEAR = 2025;
const START_MONTH = 11; // 0-based: 11 = December
const END_YEAR = 2026;
const END_MONTH = 11; // December

// State
let currentYear = START_YEAR;
let currentMonth = START_MONTH;
let allEvents = []; // fetched events in bound
let nameColorMap = new Map(); // name -> colorHex

// Elements
const calendarGrid = document.getElementById("calendarGrid");
const currentMonthLabel = document.getElementById("currentMonthLabel");
const prevMonthBtn = document.getElementById("prevMonthBtn");
const nextMonthBtn = document.getElementById("nextMonthBtn");
const addEntryBtn = document.getElementById("addEntryBtn");
const tooltip = document.getElementById("tooltip");
const legendItems = document.getElementById("legendItems");

const entryModal = document.getElementById("entryModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const modalTitle = document.getElementById("modalTitle");
const entryForm = document.getElementById("entryForm");
const entryId = document.getElementById("entryId");
const entryDate = document.getElementById("entryDate");
const entryName = document.getElementById("entryName");
const entryTitle = document.getElementById("entryTitle");
const entryComment = document.getElementById("entryComment");
const entryColor = document.getElementById("entryColor");
const saveEntryBtn = document.getElementById("saveEntryBtn");
const deleteEntryBtn = document.getElementById("deleteEntryBtn");

// Weekday labels
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ====== Init ======
document.addEventListener("DOMContentLoaded", async () => {
  boundControls();
  await refreshData();
  renderMonth(currentYear, currentMonth);
});

// ====== Controls ======
function boundControls() {
  prevMonthBtn.addEventListener("click", () => {
    const prev = prevMonth(currentYear, currentMonth);
    if (!isBeforeStart(prev.y, prev.m)) {
      currentYear = prev.y; currentMonth = prev.m;
      renderMonth(currentYear, currentMonth);
    }
  });
  nextMonthBtn.addEventListener("click", () => {
    const next = nextMonth(currentYear, currentMonth);
    if (!isAfterEnd(next.y, next.m)) {
      currentYear = next.y; currentMonth = next.m;
      renderMonth(currentYear, currentMonth);
    }
  });

  addEntryBtn.addEventListener("click", () => openModalForCreate());
  closeModalBtn.addEventListener("click", () => closeModal());

  // Form submission
  entryForm.addEventListener("submit", onSaveEntry);
  deleteEntryBtn.addEventListener("click", onDeleteEntry);

  // Tooltip hide on scroll or escape
  document.addEventListener("scroll", hideTooltip, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      hideTooltip();
      closeModal();
    }
  });
}

// ====== Data fetching / caching ======
async function refreshData() {
  // Fetch events in the bound period
  const startDate = `${START_YEAR}-12-01`;
  const endDate = `${END_YEAR}-12-31`;

  const { data: events, error: eventsErr } = await supabase
    .from("event_entries")
    .select("*")
    .gte("event_date", startDate)
    .lte("event_date", endDate)
    .order("event_date", { ascending: true });

  if (eventsErr) {
    console.error("Error fetching events:", eventsErr);
    alert("Error fetching events from Supabase. Check console.");
    return;
  }
  allEvents = events || [];

  // Fetch colors
  const { data: colors, error: colorsErr } = await supabase
    .from("name_colors")
    .select("*");

  if (colorsErr) {
    console.error("Error fetching colors:", colorsErr);
    alert("Error fetching colors from Supabase. Check console.");
    return;
  }

  nameColorMap = new Map();
  (colors || []).forEach(row => {
    nameColorMap.set(row.name, row.color_hex);
  });

  // For any name missing color, generate and upsert
  const namesMissing = uniqueNames(allEvents).filter(n => !nameColorMap.has(n));
  for (const nm of namesMissing) {
    const randomHex = randomColorHexForName(nm);
    const { data: upserted, error: upErr } = await supabase
      .from("name_colors")
      .insert({ name: nm, color_hex: randomHex })
      .select()
      .single();

    if (upErr) {
      console.error("Error upserting color:", nm, upErr);
    } else {
      nameColorMap.set(nm, upserted.color_hex);
    }
  }

  renderLegend();
}

// ====== Rendering ======
function renderMonth(year, month) {
  // Header label
  currentMonthLabel.textContent = monthLabel(year, month);

  // Build grid: weekday header row + days
  calendarGrid.innerHTML = "";

  const weekdayHeader = document.createElement("div");
  weekdayHeader.className = "weekday-header";
  WEEKDAYS.forEach(d => {
    const chip = document.createElement("div");
    chip.className = "weekday-chip";
    chip.textContent = d;
    weekdayHeader.appendChild(chip);
  });
  calendarGrid.appendChild(weekdayHeader);

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startWeekday = firstDay.getDay();

  // Leading blank cells for first week
  for (let i = 0; i < startWeekday; i++) {
    const blank = document.createElement("div");
    blank.className = "calendar-cell";
    calendarGrid.appendChild(blank);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    cell.className = "calendar-cell";

    const head = document.createElement("div");
    head.className = "cell-header";

    const dateLabel = document.createElement("div");
    dateLabel.className = "cell-date";
    dateLabel.textContent = day.toString();

    const weekdayLabel = document.createElement("div");
    weekdayLabel.className = "cell-weekday";
    weekdayLabel.textContent = WEEKDAYS[new Date(year, month, day).getDay()];

    head.appendChild(dateLabel);
    head.appendChild(weekdayLabel);

    const body = document.createElement("div");
    body.className = "cell-body";

    // Events for the day
    const dayStr = isoDate(year, month + 1, day);
    const dayEvents = allEvents.filter(e => e.event_date === dayStr);

    dayEvents.forEach(ev => {
      const entry = document.createElement("div");
      entry.className = "entry";
      const borderColor = getColorForName(ev.name);
      entry.style.borderLeftColor = borderColor;

      const dot = document.createElement("div");
      dot.className = "entry-color-dot";
      dot.style.backgroundColor = borderColor;

      const title = document.createElement("div");
      title.className = "entry-title";
      title.textContent = ev.title;

      entry.appendChild(dot);
      entry.appendChild(title);

      // Tooltip on hover (comment)
      entry.addEventListener("mouseenter", (e) => {
        if (ev.comment && ev.comment.trim().length > 0) {
          showTooltip(e.clientX, e.clientY, ev.comment);
        }
      });
      entry.addEventListener("mouseleave", hideTooltip);

      // Click to edit
      entry.addEventListener("click", () => openModalForEdit(ev));

      body.appendChild(entry);
    });

    cell.appendChild(head);
    cell.appendChild(body);
    calendarGrid.appendChild(cell);
  }

  // Trailing blanks to complete last week row (optional - for symmetry)
  const totalCells = startWeekday + daysInMonth;
  const remainder = totalCells % 7;
  if (remainder !== 0) {
    for (let i = 0; i < 7 - remainder; i++) {
      const blank = document.createElement("div");
      blank.className = "calendar-cell";
      calendarGrid.appendChild(blank);
    }
  }

  // Disable nav outside bounds
  prevMonthBtn.disabled = isBeforeStart(prevMonth(year, month).y, prevMonth(year, month).m);
  nextMonthBtn.disabled = isAfterEnd(nextMonth(year, month).y, nextMonth(year, month).m);
}

function renderLegend() {
  legendItems.innerHTML = "";
  const names = Array.from(nameColorMap.keys()).sort((a, b) => a.localeCompare(b));
  names.forEach(name => {
    const chip = document.createElement("div");
    chip.className = "legend-chip";

    const color = document.createElement("div");
    color.className = "legend-color";
    color.style.backgroundColor = nameColorMap.get(name);

    const label = document.createElement("div");
    label.textContent = name;

    chip.appendChild(color);
    chip.appendChild(label);
    legendItems.appendChild(chip);
  });
}

// ====== Tooltip ======
function showTooltip(x, y, text) {
  tooltip.textContent = text;
  tooltip.classList.remove("hidden");

  const pad = 10;
  const rect = tooltip.getBoundingClientRect();
  let tx = x + pad;
  let ty = y + pad;

  // If near right/bottom edge, adjust
  if (tx + rect.width > window.innerWidth - 10) tx = x - rect.width - pad;
  if (ty + rect.height > window.innerHeight - 10) ty = y - rect.height - pad;

  tooltip.style.left = `${tx}px`;
  tooltip.style.top = `${ty}px`;
}
function hideTooltip() {
  tooltip.classList.add("hidden");
  tooltip.style.left = "-9999px";
  tooltip.style.top = "-9999px";
}

// ====== Modal & CRUD ======
function openModalForCreate(dateStr) {
  modalTitle.textContent = "Add entry";
  entryId.value = "";
  // Default date: current visible month first day, or supplied
  const defaultDate = dateStr || isoDate(currentYear, currentMonth + 1, 1);
  entryDate.value = defaultDate;
  entryName.value = "";
  entryTitle.value = "";
  entryComment.value = "";

  // Default color: if name present later, we update; otherwise random
  entryColor.value = "#3b82f6"; // accent default

  deleteEntryBtn.style.display = "none";
  openModal();
}

function openModalForEdit(ev) {
  modalTitle.textContent = "Edit entry";
  entryId.value = ev.id;
  entryDate.value = ev.event_date;
  entryName.value = ev.name;
  entryTitle.value = ev.title;
  entryComment.value = ev.comment || "";

  const existingColor = getColorForName(ev.name);
  entryColor.value = existingColor;

  deleteEntryBtn.style.display = "inline-block";
  openModal();
}

function openModal() {
  entryModal.classList.remove("hidden");
}
function closeModal() {
  entryModal.classList.add("hidden");
}

async function onSaveEntry(e) {
  e.preventDefault();

  const id = entryId.value || null;
  const event_date = entryDate.value;
  const name = entryName.value.trim();
  const title = entryTitle.value.trim();
  const comment = entryComment.value.trim();
  const color_hex = entryColor.value;

  if (!event_date || !name || !title) {
    alert("Date, Name, and Title are required.");
    return;
  }

  // Upsert color for name (update for existing or insert new)
  await upsertNameColor(name, color_hex);

  if (id) {
    // Update event
    const { error } = await supabase
      .from("event_entries")
      .update({ event_date, name, title, comment })
      .eq("id", id);

    if (error) {
      console.error("Update error:", error);
      alert("Failed to update entry.");
      return;
    }
  } else {
    // Insert event
    const { error } = await supabase
      .from("event_entries")
      .insert({ event_date, name, title, comment });

    if (error) {
      console.error("Insert error:", error);
      alert("Failed to add entry.");
      return;
    }
  }

  await refreshData();
  renderMonth(currentYear, currentMonth);
  closeModal();
}

async function onDeleteEntry() {
  const id = entryId.value;
  if (!id) return;

  if (!confirm("Delete this entry?")) return;

  const { error } = await supabase
    .from("event_entries")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Delete error:", error);
    alert("Failed to delete entry.");
    return;
  }

  await refreshData();
  renderMonth(currentYear, currentMonth);
  closeModal();
}

// ====== Name color helpers ======
function getColorForName(name) {
  if (nameColorMap.has(name)) {
    return nameColorMap.get(name);
  }
  const hex = randomColorHexForName(name);
  nameColorMap.set(name, hex);
  return hex;
}

async function upsertNameColor(name, hex) {
  // Try update first; if not exist, insert
  if (nameColorMap.has(name) && nameColorMap.get(name) !== hex) {
    const { error } = await supabase
      .from("name_colors")
      .update({ color_hex: hex })
      .eq("name", name);

    if (error) {
      console.error("Error updating color:", error);
    } else {
      nameColorMap.set(name, hex);
    }
  } else if (!nameColorMap.has(name)) {
    const { data, error } = await supabase
      .from("name_colors")
      .insert({ name, color_hex: hex })
      .select()
      .single();

    if (error) {
      console.error("Error inserting color:", error);
    } else {
      nameColorMap.set(name, data.color_hex);
    }
  }
}

function randomColorHexForName(name) {
  // Stable pseudo-random based on name hash, in a nice palette range
  const h = hashString(name);
  // Generate color in HSL space, then convert to HEX
  const hue = h % 360;
  const sat = 60; // moderate saturation
  const light = 50; // middle lightness
  return hslToHex(hue, sat, light);
}

// ====== Utilities ======
function uniqueNames(events) {
  const set = new Set();
  events.forEach(e => set.add(e.name));
  return Array.from(set);
}

function monthLabel(year, monthIndex) {
  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  return `${monthNames[monthIndex]} ${year}`;
}

function isoDate(year, month, day) {
  // Ensure 2-digit month/day
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

function prevMonth(y, m) {
  if (m === 0) return { y: y - 1, m: 11 };
  return { y, m: m - 1 };
}
function nextMonth(y, m) {
  if (m === 11) return { y: y + 1, m: 0 };
  return { y, m: m + 1 };
}
function isBeforeStart(y, m) {
  return (y < START_YEAR) || (y === START_YEAR && m < START_MONTH);
}
function isAfterEnd(y, m) {
  return (y > END_YEAR) || (y === END_YEAR && m > END_MONTH);
}

// Simple string hash
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32bit int
  }
  return Math.abs(hash);
}

// HSL -> HEX
function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const c = (1 - Math.abs(2*l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c/2;
  let r=0, g=0, b=0;

  if (0 <= h && h < 60) { r=c; g=x; b=0; }
  else if (60 <= h && h < 120) { r=x; g=c; b=0; }
  else if (120 <= h && h < 180) { r=0; g=c; b=x; }
  else if (180 <= h && h < 240) { r=0; g=x; b=c; }
  else if (240 <= h && h < 300) { r=x; g=0; b=c; }
  else if (300 <= h && h < 360) { r=c; g=0; b=x; }

  r = Math.round((r + m) * 255);
  g = Math.round((g + m) * 255);
  b = Math.round((b + m) * 255);

  return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
}

// ====== Optional: quick add by clicking empty day cell ======
// Could be added later by attaching click listeners to cell.body for no-entry areas.

