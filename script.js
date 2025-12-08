// Supabase client setup
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const supabaseUrl = "https://whrugfiojjbxkzjvtgjs.supabase.co";   // replace with your project URL
const supabaseKey = "sb_publishable_3qJoVWoF-Kfn1n2dAi0RgA_gqT-j5uN";              // replace with your anon key
const supabase = createClient(supabaseUrl, supabaseKey);

let currentYear;
let currentMonth;
let events = {};

const yearSelect = document.getElementById("yearSelect");
const monthSelect = document.getElementById("monthSelect");
const todayBtn = document.getElementById("todayBtn");
const viewTitle = document.getElementById("viewTitle");
const grid = document.getElementById("grid");

document.addEventListener("DOMContentLoaded", init);

async function init() {
  // Populate year dropdown
  [2025, 2026].forEach((y) => {
    const opt = document.createElement("option");
    opt.value = y;
    opt.textContent = y;
    yearSelect.appendChild(opt);
  });

  // Default to today
  const today = new Date();
  currentYear = (today.getFullYear() >= 2025 && today.getFullYear() <= 2026) ? today.getFullYear() : 2025;
  currentMonth = today.getMonth();

  yearSelect.value = currentYear;
  monthSelect.value = String(currentMonth);

  // Listeners
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

  // Try loading events from Supabase
  try {
    const { data, error } = await supabase.from("events").select("*");
    if (error) console.error("Supabase error:", error);
    else {
      events = data.reduce((acc, ev) => {
        if (!acc[ev.date]) acc[ev.date] = [];
        acc[ev.date].push(ev);
        return acc;
      }, {});
    }
  } catch (err) {
    console.error("Supabase connection failed:", err);
  }

  // Always render calendar even if events are empty
  renderCalendar();
}

function renderCalendar() {
  viewTitle.textContent = `${["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"][currentMonth]} ${currentYear}`;
  grid.innerHTML = "";

  const firstOfMonth = new Date(currentYear, currentMonth, 1);
  const startDay = firstOfMonth.getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const prevMonthDays = new Date(currentYear, currentMonth, 0).getDate();

  const totalCells = 42;
  for (let cell = 0; cell < totalCells; cell++) {
    const dayEl = document.createElement("div");
    dayEl.className = "day";

    let dayNum, cellDate;
    if (cell < startDay) {
      dayNum = prevMonthDays - startDay + cell + 1;
      cellDate = new Date(currentYear, currentMonth - 1, dayNum);
      dayEl.classList.add("other-month");
    } else if (cell >= startDay + daysInMonth) {
      dayNum = cell - (startDay + daysInMonth) + 1;
      cellDate = new Date(currentYear, currentMonth + 1, dayNum);
      dayEl.classList.add("other-month");
    } else {
      dayNum = cell - startDay + 1;
      cellDate = new Date(currentYear, currentMonth, dayNum);
    }

    const header = document.createElement("div");
    header.className = "day-header";
    header.textContent = dayNum;
    dayEl.appendChild(header);

    grid.appendChild(dayEl);
  }
}
