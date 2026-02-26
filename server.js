/* =========================================================
   🏭 FACTORY ERP AI – ENTERPRISE EDITION
   PART 1 – CORE ENGINE + SAFE UTILITIES
========================================================= */

const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

/* ===================== GOOGLE SHEET CONFIG ===================== */

const SHEET_ID = "17AlSp8QqY3_YmW9bb1W-fMg9m7FFBxtYKXc2Cr9fq3A";

const GID_MAP = {
  grey: "1069156463",
  singing: "1204186084",
  marcerise: "883470384",
  bleach: "1612554044",
  cpb: "809334692",
  napthol: "1825175747",
  jigger: "392149567",
  ex_jigger: "843042263",
  folding: "2051005815",
};

/* ===================== SAFE UTILITIES ===================== */

function safeNumber(val) {
  if (!val) return 0;
  return parseFloat(val.toString().replace(/,/g, "").trim()) || 0;
}

function normalizeSill(val) {
  if (!val) return "";
  return val.toString().replace(/[^0-9]/g, "");
}

/* ===================== DATE ENGINE ===================== */

function parseSheetDate(raw) {
  if (!raw) return null;

  const d = new Date(raw);
  if (!isNaN(d.getTime())) return d;

  return null;
}

function sameDate(d1, d2) {
  if (!d1 || !d2) return false;

  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  );
}

function getKeywordDate(input) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const lower = input.toLowerCase();

  if (lower.includes("today") || lower.includes("aj") || lower.includes("ajke"))
    return today;

  if (lower.includes("yesterday") || lower.includes("kal"))
    return yesterday;

  const match = lower.match(/(\d{1,2})\s*(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/);

  if (match) {
    const months = {
      jan:0,feb:1,mar:2,apr:3,may:4,jun:5,
      jul:6,aug:7,sep:8,oct:9,nov:10,dec:11
    };

    const day = parseInt(match[1]);
    const month = months[match[2]];
    const year = today.getFullYear();

    return new Date(year, month, day);
  }

  return null;
}

/* ===================== SHEET FETCHER ===================== */

async function fetchSheet(gid) {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
    const { data } = await axios.get(url);

    return data.split(/\r?\n/).map(line =>
      line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
          .map(cell => cell.replace(/^"|"$/g, "").trim())
    );

  } catch (err) {
    console.log("Sheet Load Error:", err.message);
    return [];
  }
}

/* ===================== SERVER ROUTE START ===================== */

app.post("/ask", async (req, res) => {

  const rawInput = (req.body.question || "").trim();
  const question = rawInput.toLowerCase();
  const cleanInput = question.replace(/\s+/g, "");

  const keys = Object.keys(GID_MAP);

  const results = await Promise.all(
    keys.map(k => fetchSheet(GID_MAP[k]))
  );

  const db = {};
  keys.forEach((k, i) => db[k] = results[i]);

/* =========================================================
   PART 1 END – ROUTE STILL OPEN
   DO NOT CLOSE ROUTE
========================================================= */
         /* =========================================================
   PART 2 – CALCULATION ENGINE
========================================================= */

/* ===================== UNIVERSAL SUM ===================== */

function getProcessSum(sheetName, targetDate = null) {

  const rows = db[sheetName].slice(1);

  return rows.reduce((total, row) => {

    if (!targetDate)
      return total + safeNumber(row[6]);

    const rowDate = parseSheetDate(row[0]);
    if (!rowDate) return total;

    if (sameDate(rowDate, targetDate))
      return total + safeNumber(row[6]);

    return total;

  }, 0);
}

/* ===================== PER DAY ENGINE ===================== */

function getMonthlyPerDay(sheetName) {

  const today = new Date();
  const month = today.getMonth();
  const year = today.getFullYear();

  let days = [];
  let grandTotal = 0;
  let highest = 0;
  let lowest = null;

  for (let d = 1; d <= today.getDate(); d++) {

    const target = new Date(year, month, d);
    const qty = getProcessSum(sheetName, target);

    days.push({
      day: d,
      qty
    });

    grandTotal += qty;

    if (qty > highest) highest = qty;
    if (lowest === null || qty < lowest) lowest = qty;
  }

  return {
    days,
    total: grandTotal,
    highest,
    lowest
  };
}

/* ===================== FACTORY TOTAL ===================== */

function getFactoryTotals() {

  const s = getProcessSum("singing");
  const m = getProcessSum("marcerise");
  const b = getProcessSum("bleach");

  const c = getProcessSum("cpb");
  const j = getProcessSum("jigger");
  const ex = getProcessSum("ex_jigger");
  const n = getProcessSum("napthol");

  const f = getProcessSum("folding");

  return {
    process: { s, m, b },
    dyeing: { c, j, ex, n },
    folding: f,
    dyeTotal: c + j + ex + n
  };
}

/* ===================== DATE WISE REPORT ===================== */

function getDateReport(targetDate) {

  const s = getProcessSum("singing", targetDate);
  const m = getProcessSum("marcerise", targetDate);
  const b = getProcessSum("bleach", targetDate);

  const c = getProcessSum("cpb", targetDate);
  const j = getProcessSum("jigger", targetDate);
  const ex = getProcessSum("ex_jigger", targetDate);
  const n = getProcessSum("napthol", targetDate);

  const f = getProcessSum("folding", targetDate);

  return {
    process: { s, m, b },
    dyeing: { c, j, ex, n },
    folding: f,
    total: s + m + b + c + j + ex + n
  };
}

/* ===================== PARTY AGGREGATION ===================== */

function getPartyFullSummary(partyName) {

  const greyRows = db.grey.slice(1).filter(row =>
    row[2] && row[2].toLowerCase().includes(partyName)
  );

  if (greyRows.length === 0) return null;

  let reports = [];

  greyRows.slice(-15).forEach(row => {

    const sill = normalizeSill(row[1]);
    const quality = row[3] || "N/A";
    const lot = safeNumber(row[5]);

    const sumProc = (proc) =>
      db[proc].slice(1).reduce((t,r)=>
        normalizeSill(r[1]) === sill ? t + safeNumber(r[6]) : t
      ,0);

    const dyeTotal =
      sumProc("cpb") +
      sumProc("jigger") +
      sumProc("ex_jigger") +
      sumProc("napthol");

    reports.push({
      party: row[2],
      sill,
      quality,
      lot,
      dyeTotal
    });
  });

  return reports;
}

/* ===================== SILL FULL REPORT ===================== */

function getSillReport(inputNumber) {

  const greyRows = db.grey.slice(1).filter(row =>
    normalizeSill(row[1]) === inputNumber ||
    normalizeSill(row[5]) === inputNumber
  );

  if (greyRows.length === 0) return null;

  return greyRows.map(row => {

    const sill = normalizeSill(row[1]);
    const party = row[2] || "N/A";
    const quality = row[3] || "N/A";
    const lot = safeNumber(row[5]);

    const sumProc = (proc) =>
      db[proc].slice(1).reduce((t,r)=>
        normalizeSill(r[1]) === sill ? t + safeNumber(r[6]) : t
      ,0);

    const s = sumProc("singing");
    const m = sumProc("marcerise");
    const b = sumProc("bleach");
    const c = sumProc("cpb");
    const j = sumProc("jigger");
    const ex = sumProc("ex_jigger");
    const n = sumProc("napthol");
    const f = sumProc("folding");

    const dyeTotal = c + j + ex + n;
    const diff = lot - dyeTotal;

    return {
      party,
      sill,
      quality,
      lot,
      process: { s, m, b },
      dyeing: { c, j, ex, n },
      folding: f,
      dyeTotal,
      diff
    };

  });
}

/* =========================================================
   PART 2 END – ROUTE STILL OPEN
========================================================= */
         /* =========================================================
   PART 3 – PREMIUM FORMATTER + COMMAND CONTROLLER
========================================================= */

/* ===================== FORMATTERS ===================== */

function formatPerDay(proc, data) {

  const today = new Date();
  const monthName = today.toLocaleString("default", { month: "long" });
  const year = today.getFullYear();

  const lines = data.days.map(d =>
    `${String(d.day).padStart(2,"0")} ${monthName.slice(0,3)} : ${d.qty.toLocaleString()} yds`
  );

  return `
📊 ═══════════════════════════
        ${proc.toUpperCase()} DAILY PRODUCTION
═══════════════════════════
📅 Month: ${monthName} ${year}
───────────────────────────
${lines.join("\n")}
───────────────────────────
📈 HIGHEST DAY : ${data.highest.toLocaleString()} yds
📉 LOWEST DAY  : ${data.lowest.toLocaleString()} yds
═══════════════════════════
📊 MONTH TOTAL : ${data.total.toLocaleString()} yds
═══════════════════════════
`;
}

function formatFactorySummary(data) {

  return `
🏭 ═══════════════════════════
          FACTORY SUMMARY
═══════════════════════════

⚙️ PROCESS SECTION
───────────────────────────
Singing     : ${data.process.s.toLocaleString()}
Mercerise   : ${data.process.m.toLocaleString()}
Bleach      : ${data.process.b.toLocaleString()}

🎨 DYEING SECTION
───────────────────────────
CPB         : ${data.dyeing.c.toLocaleString()}
Jigger      : ${data.dyeing.j.toLocaleString()}
Ex-Jigger   : ${data.dyeing.ex.toLocaleString()}
Napthol     : ${data.dyeing.n.toLocaleString()}

🧺 FINISHING
───────────────────────────
Folding     : ${data.folding.toLocaleString()}

═══════════════════════════
📊 TOTAL DYEING : ${data.dyeTotal.toLocaleString()} yds
═══════════════════════════
`;
}

function formatDateReport(data) {

  return `
  // TOTAL DYEING ONLY
if (cleanInput === "totaldyeing" || cleanInput === "total dyeing") {

  const c = getProcessSum("cpb");
  const j = getProcessSum("jigger");
  const ex = getProcessSum("ex_jigger");
  const n = getProcessSum("napthol");

  return res.json({
    reply: `
🎨 ═══════════════════════════
        TOTAL DYEING SUMMARY
═══════════════════════════
CPB        : ${c.toLocaleString()}
Jigger     : ${j.toLocaleString()}
Ex-Jigger  : ${ex.toLocaleString()}
Napthol    : ${n.toLocaleString()}
═══════════════════════════
TOTAL      : ${(c+j+ex+n).toLocaleString()} yds
═══════════════════════════
`
  });
}
📅 ═══════════════════════════
        DAILY PRODUCTION REPORT
═══════════════════════════

⚙️ PROCESS SECTION
───────────────────────────
Singing     : ${data.process.s.toLocaleString()}
Mercerise   : ${data.process.m.toLocaleString()}
Bleach      : ${data.process.b.toLocaleString()}

🎨 DYEING SECTION
───────────────────────────
CPB         : ${data.dyeing.c.toLocaleString()}
Jigger      : ${data.dyeing.j.toLocaleString()}
Ex-Jigger   : ${data.dyeing.ex.toLocaleString()}
Napthol     : ${data.dyeing.n.toLocaleString()}

🧺 FINISHING
───────────────────────────
Folding     : ${data.folding.toLocaleString()}

═══════════════════════════
📊 GRAND TOTAL : ${data.total.toLocaleString()} yds
═══════════════════════════
`;
}

function formatPartySummary(reports) {

  const blocks = reports.map(r => `
🆔 SILL : ${r.sill}
Quality : ${r.quality}
Lot     : ${r.lot.toLocaleString()}
Dye     : ${r.dyeTotal.toLocaleString()}
Status  : ${r.lot - r.dyeTotal <= 0 ? "🟢 EXTRA" : "🔴 SHORT"}
`).join("\n───────────────────────────\n");

  return `
👤 ═══════════════════════════
            PARTY SUMMARY
═══════════════════════════
${blocks}
═══════════════════════════
`;
}

function formatSillReport(reports) {

  const blocks = reports.map(r => `
🆔 SILL : ${r.sill}
Party   : ${r.party}
Quality : ${r.quality}
Lot     : ${r.lot.toLocaleString()}

⚙️ PROCESS
Singing     : ${r.process.s.toLocaleString()}
Mercerise   : ${r.process.m.toLocaleString()}
Bleach      : ${r.process.b.toLocaleString()}

🎨 DYEING
CPB         : ${r.dyeing.c.toLocaleString()}
Jigger      : ${r.dyeing.j.toLocaleString()}
Ex-Jigger   : ${r.dyeing.ex.toLocaleString()}
Napthol     : ${r.dyeing.n.toLocaleString()}

🧺 Folding  : ${r.folding.toLocaleString()}
Total Dye   : ${r.dyeTotal.toLocaleString()}
Status      : ${r.diff <= 0 ? "🟢 EXTRA" : "🔴 SHORT"}
`).join("\n═══════════════════════════\n");

  return `
📊 ═══════════════════════════
        SILL PRODUCTION REPORT
═══════════════════════════
${blocks}
═══════════════════════════
`;
}

/* ===================== HELP ===================== */

if (cleanInput === "help") {
  return res.json({
    reply:
`🤖 ERP COMMAND LIST
━━━━━━━━━━━━━━━━━━━━
cpb per day
jigger per day
napthol per day
total dyeing
totall
15 feb
15 feb dyeing
12345
noor
noor cpb`
  });
}

/* ===================== COMMAND CONTROLLER ===================== */

// PER DAY
const perDayMatch = question.match(/(cpb|jigger|ex-jigger|exjigger|napthol|singing|marcerise|bleach|folding)\s*per\s*day/);
if (perDayMatch) {

  const proc = perDayMatch[1]
    .replace("exjigger","ex_jigger")
    .replace("ex-jigger","ex_jigger");

  const data = getMonthlyPerDay(proc);

  return res.json({
    reply: formatPerDay(proc, data)
  });
}

// FACTORY SUMMARY
if (cleanInput === "totall") {
  const data = getFactoryTotals();
  return res.json({
    reply: formatFactorySummary(data)
  });
}

// DATE + PROCESS DETAILED
const dateObj = getKeywordDate(question);
const procMatch = question.match(/(cpb|jigger|exjigger|ex-jigger|napthol|singing|marcerise|bleach|folding)/);

if (dateObj && procMatch) {

  const proc = procMatch[1]
    .replace("exjigger","ex_jigger")
    .replace("ex-jigger","ex_jigger");

  const rows = db[proc].slice(1).filter(row => {
    const rowDate = parseSheetDate(row[0]);
    return rowDate && sameDate(rowDate, dateObj);
  });

  if (rows.length === 0)
    return res.json({ reply: "এই দিনে production হয়নি।" });

  const combined = {};

  rows.forEach(row => {

    const sill = normalizeSill(row[1]);
    const qty = safeNumber(row[6]);

    if (!combined[sill]) {

      const greyRow = db.grey.slice(1)
        .find(g => normalizeSill(g[1]) === sill);

      combined[sill] = {
        party: greyRow?.[2] || "N/A",
        qty: 0
      };
    }

    combined[sill].qty += qty;
  });

  const list = Object.entries(combined)
    .map(([sill, data]) =>
      `🆔 ${sill} | ${data.party} → ${data.qty.toLocaleString()} yds`
    ).join("\n");

  const total = rows.reduce((t,r)=> t + safeNumber(r[6]), 0);

  return res.json({
    reply: `
📅 ${dateObj.toDateString()}
⚙ PROCESS: ${proc.toUpperCase()}
───────────────────────────
${list}
───────────────────────────
TOTAL : ${total.toLocaleString()} yds
`
  });
}
   // DATE BASED
const keywordDate = getKeywordDate(question);
if (keywordDate) {

  const data = getDateReport(keywordDate);
  return res.json({
    reply: formatDateReport(data)
  });
}

// SILL SEARCH
const numMatch = question.match(/(\d{3,})/);
if (numMatch) {

  const reports = getSillReport(normalizeSill(numMatch[1]));
  if (reports)
    return res.json({ reply: formatSillReport(reports) });
}

   // PARTY + PROCESS
const partyProcessMatch = question.match(/^(.+)\s+(cpb|jigger|exjigger|ex-jigger|napthol|singing|marcerise|bleach|folding)$/);

if (partyProcessMatch) {

  const partyName = partyProcessMatch[1].trim();
  const proc = partyProcessMatch[2]
    .replace("exjigger","ex_jigger")
    .replace("ex-jigger","ex_jigger");

  const greyRows = db.grey.slice(1).filter(row =>
    row[2] && row[2].toLowerCase().includes(partyName)
  );

  if (greyRows.length === 0)
    return res.json({ reply: "Party পাওয়া যায়নি।" });

  let total = 0;
  let lines = [];

  greyRows.forEach(row => {

    const sill = normalizeSill(row[1]);

    const qty = db[proc].slice(1).reduce((t,r)=>
      normalizeSill(r[1]) === sill ? t + safeNumber(r[6]) : t
    ,0);

    if (qty > 0) {
      total += qty;
      lines.push(`🆔 ${sill} → ${qty.toLocaleString()} yds`);
    }
  });

  return res.json({
    reply: `
👤 Party: ${partyName.toUpperCase()}
⚙ Process: ${proc.toUpperCase()}
───────────────────────────
${lines.join("\n")}
───────────────────────────
TOTAL: ${total.toLocaleString()} yds
`
  });
}
// PARTY SEARCH
const partyReports = getPartyFullSummary(question);
if (partyReports)
  return res.json({ reply: formatPartySummary(partyReports) });

/* ===================== FALLBACK ===================== */

return res.json({
  reply: "Command বুঝতে পারিনি। help লিখে দেখো।"
});

}); // ROUTE CLOSE

/* ===================== SERVER START ===================== */

app.listen(PORT, () => {
  console.log("🚀 Factory ERP AI – Enterprise Edition running on port " + PORT);
});
