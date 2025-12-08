const SUPABASE_URL = "https://whrugfiojjbxkzjvtgjs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_3qJoVWoF-Kfn1n2dAi0RgA_gqT-j5uN";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const START_YEAR = 2025, START_MONTH = 11;
const END_YEAR = 2026, END_MONTH = 11;

let currentYear = START_YEAR, currentMonth = START_MONTH;
let allEvents = [], nameColorMap = new Map();

const calendarGrid = document.getElementById("calendarGrid");
const currentMonthLabel = document.getElementById("currentMonthLabel");
const prevMonthBtn = document.getElementById("prevMonthBtn");
const nextMonthBtn = document.getElementById("nextMonthBtn");
const addEntryBtn = document.getElementById("addEntryBtn");
const tooltip = document.getElementById("tooltip");
const legendItems = document.getElementById("legendItems");

const entryModal = document.getElementById("entryModal");
const closeModalBtn = document.getElementById("closeModalBtn");
const entryForm = document.getElementById("entryForm");
const entryId = document.getElementById("entryId");
const entryDate = document.getElementById("entryDate");
const entryName = document.getElementById("entryName");
const entryTitle = document.getElementById("entryTitle");
const entryComment = document.getElementById("entryComment");
const entryColor = document.getElementById("entryColor");
const entryRecurrence = document.getElementById("entryRecurrence");
const entryRecurrenceUntil = document.getElementById("entryRecurrenceUntil");
const deleteEntryBtn = document.getElementById("deleteEntryBtn");

document.addEventListener("DOMContentLoaded", async () => {
  bindControls();
  await refreshData();
  renderMonth(currentYear, currentMonth);
});

function bindControls() {
  prevMonthBtn.onclick = () => { const p = prevMonth(currentYear, currentMonth); if (!isBeforeStart(p.y,p.m)){currentYear=p.y;currentMonth=p.m;renderMonth(currentYear,currentMonth);} };
  nextMonthBtn.onclick = () => { const n = nextMonth(currentYear, currentMonth); if (!isAfterEnd(n.y,n.m)){currentYear=n.y;currentMonth=n.m;renderMonth(currentYear,currentMonth);} };
  addEntryBtn.onclick = () => openModalForCreate();
  closeModalBtn.onclick = () => closeModal();
  entryForm.onsubmit = onSaveEntry;
  deleteEntryBtn.onclick = onDeleteEntry;
}

async function refreshData() {
  const { data: events } = await supabase.from("event_entries").select("*");
  allEvents = expandEvents(events || []);
  const { data: colors } = await supabase.from("name_colors").select("*");
  nameColorMap = new Map((colors||[]).map(c=>[c.name,c.color_hex]));
  renderLegend();
}

function renderMonth(year, month) {
  currentMonthLabel.textContent = monthLabel(year, month);
  calendarGrid.innerHTML = "";

  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month+1,0).getDate();
  const startWeekday = firstDay.getDay();

  const prevInfo = prevMonth(year, month);
  const daysInPrev = new Date(prevInfo.y, prevInfo.m+1,0).getDate();
  for (let i=startWeekday-1;i>=0;i--) {
    calendarGrid.appendChild(buildDayCell(prevInfo.y, prevInfo.m, daysInPrev-i,true));
  }
  for (let d=1;d<=daysInMonth;d++) {
    calendarGrid.appendChild(buildDayCell(year, month, d,false));
  }
  const totalCells = startWeekday+daysInMonth;
  const remainder = totalCells%7;
  if (remainder!==0) {
    const nextInfo = nextMonth(year, month);
    for (let i=1;i<=7-remainder;i++) {
      calendarGrid.appendChild(buildDayCell(nextInfo.y,nextInfo.m,i,true));
    }
  }
}

function buildDayCell(y,m,d,isOther) {
  const cell=document.createElement("div");
  cell.className="calendar-cell";
  if(isOther)cell.classList.add("other-month");
  const head=document.createElement("div");head.className="cell-header";
  const dateLabel=document.createElement("div");dateLabel.className="cell-date";dateLabel.textContent=d;
  const weekdayLabel=document.createElement("div");weekdayLabel.className="cell-weekday";weekdayLabel.textContent=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(y,m,d).getDay()];
  head.append(dateLabel,weekdayLabel);
  const body=document.createElement("div");body.className="cell-body";
  const dayStr=isoDate(y,m+1,d);
  allEvents.filter(ev=>ev.event_date===dayStr).forEach(ev=>{
    const entry=document.createElement("div");
