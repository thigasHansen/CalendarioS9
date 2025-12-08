const SUPABASE_URL = "https://YOUR-PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR-ANON-KEY";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const START_YEAR = 2025, START_MONTH = 11;
const END_YEAR = 2026, END_MONTH = 11;

let currentYear = START_YEAR, currentMonth = START_MONTH;
let allEvents = [], nameColorMap = new Map();

document.addEventListener("DOMContentLoaded", async () => {
  bindControls();
  await refreshData();
  renderMonth(currentYear, currentMonth);
});

function bindControls() {
  document.getElementById("prevMonthBtn").onclick = () => {
    const p = prevMonth(currentYear, currentMonth);
    if (!isBeforeStart(p.y,p.m)){currentYear=p.y;currentMonth=p.m;renderMonth(currentYear,currentMonth);}
  };
  document.getElementById("nextMonthBtn").onclick = () => {
    const n = nextMonth(currentYear, currentMonth);
    if (!isAfterEnd(n.y,n.m)){currentYear=n.y;currentMonth=n.m;renderMonth(currentYear,currentMonth);}
  };
  document.getElementById("addEntryBtn").onclick = () => openModalForCreate();
  document.getElementById("closeModalBtn").onclick = () => closeModal();
  document.getElementById("entryForm").onsubmit = onSaveEntry;
  document.getElementById("deleteEntryBtn").onclick = onDeleteEntry;
}

async function refreshData() {
  const { data: events } = await supabase.from("event_entries").select("*");
  allEvents = expandEvents(events || []);
  const { data: colors } = await supabase.from("name_colors").select("*");
  nameColorMap = new Map((colors||[]).map(c=>[c.name,c.color_hex]));
  renderLegend();
}

function renderMonth(year, month) {
  document.getElementById("currentMonthLabel").textContent = monthLabel(year, month);
  const grid = document.getElementById("calendarGrid");
