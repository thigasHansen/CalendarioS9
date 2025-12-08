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
const eventForm
