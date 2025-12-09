// --------- CONFIG ---------
const SUPABASE_URL = "https://whrugfiojjbxkzjvtgjs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_3qJoVWoF-Kfn1n2dAi0RgA_gqT-j5uN";
const BASE_BUDGET = 2000000.00; // R$ 2.000.000,00

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --------- STATE ---------
let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth();
let selectedDate = dateToISO(new Date()); // default to today
let eventsCache = [];
let nameColorMap = {};

// --------- UTIL ---------
function pad(n) { return n.toString().padStart(2, "0"); }
function dateToISO(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function parseISODateLocal(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d); // local date, no UTC shift
}
function formatBRL(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// --------- SUPABASE DATA ---------
async function loadEventsForMonth(year, month) {
  const firstDayISO = `${year}-${pad(month+1)}-01`;
  const lastDayISO = dateToISO(new Date(year, month+1, 0));
  const { data, error } = await supabaseClient
    .from("events")
    .select("*")
    .gte("date", firstDayISO)
    .lte("date", lastDayISO);
  if (error) {
    console.warn("Supabase error:", error);
    eventsCache = [];
  } else {
    eventsCache = data || [];
  }
}

// --------- RENDER ---------
function renderMonthHeader(year, month) {
  const months = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
  document.getElementById("monthYear").textContent = `${months[month]} ${year}`;
}

function renderCalendar(year, month) {
  const cal = document.getElementById("calendar");
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

  for (let i=0; i<firstDayIndex; i++) {
    const empty = document.createElement("div");
    empty.className = "day-cell";
    empty.style.visibility = "hidden";
    cal.appendChild(empty);
  }

  for (let d=1; d<=daysInMonth; d++) {
    const cell = document.createElement("div");
    cell.className = "day-cell";
    const dateISO = `${year}-${pad(month+1)}-${pad(d)}`;

    const num = document.createElement("div");
    num.className = "day-number";
    num.textContent = d;
    cell.appendChild(num);

    const evWrap = document.createElement("div");
    evWrap.className = "day-events";
    eventsCache.filter(e=>e.date===dateISO).forEach(e=>{
      const pill = document.createElement("div");
      pill.className = "event-pill";
      pill.textContent = e.name;
      evWrap.appendChild(pill);
    });
    cell.appendChild(evWrap);

    cell.addEventListener("click", ()=>{
      selectedDate = dateISO;
      renderSelectedDatePanel();
      updateBudgetFor(dateISO);
      renderCalendar(currentYear,currentMonth); // redraw highlights
    });

    const todayISO = dateToISO(new Date());
    if (dateISO === todayISO) cell.classList.add("today");
    if (selectedDate && dateISO === selectedDate) cell.classList.add("selected");

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

  const d = parseISODateLocal(selectedDate); // ✅ local parse
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
    item.textContent = `${e.name} - ${formatBRL(Number(e.value||0))}`;
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

// --------- REFRESH ---------
async function refreshMonth() {
  renderMonthHeader(currentYear, currentMonth);
  renderCalendar(currentYear, currentMonth);
  await loadEventsForMonth(currentYear, currentMonth);
  renderCalendar(currentYear, currentMonth);
  if (selectedDate) updateBudgetFor(selectedDate);
}

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
});
