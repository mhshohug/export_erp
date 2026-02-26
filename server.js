/* =========================================================
   FACTORY ERP AI – FULL ADVANCED VERSION
   PART 1 – CORE ENGINE
========================================================= */

const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const SHEET_ID = "17AlSp8QqY3_YmW9bb1W-fMg9m7FFBxtYKXc2Cr9fq3A";

/* ===================== SHEET MAP ===================== */

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

function safeNum(val) {
  if (!val) return 0;
  return parseFloat(val.toString().replace(/,/g, "").trim()) || 0;
}

function normalizeSill(val) {
  if (!val) return "";
  return val.toString().replace(/[^0-9]/g, "");
}

function parseDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d;
}

function sameDate(d1, d2) {
  if (!d1 || !d2) return false;
  return (
    d1.getDate() === d2.getDate() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getFullYear() === d2.getFullYear()
  );
}

/* ===================== DATE KEYWORD ENGINE ===================== */

function getKeywordDate(input) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const lower = input.toLowerCase();

  if (lower.includes("today") || lower.includes("ajke") || lower.includes("aj"))
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
    const year = new Date().getFullYear();

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
   PART 1 END
   (DO NOT CLOSE ROUTE YET)
========================================================= */
         /* =========================================================
   PART 2 – FULL COMMAND ENGINE
========================================================= */

/* ===================== CORE SUM ENGINE ===================== */

const getSum = (sheet, targetDate = null) => {
  const rows = db[sheet].slice(1);

  return rows.reduce((total, row) => {

    if (!targetDate)
      return total + safeNum(row[6]);

    const rowDate = parseDate(row[0]);
    if (!rowDate) return total;

    if (sameDate(rowDate, targetDate))
      return total + safeNum(row[6]);

    return total;

  }, 0);
};

/* ===================== HELP ===================== */

if (cleanInput === "help") {
  return res.json({
    reply:
`🤖 FACTORY ERP AI – COMMAND LIST
━━━━━━━━━━━━━━━━━━━━
📊 cpb per day
📊 jigger per day
📊 napthol per day
📊 ex jigger per day

🎨 total dyeing
🏭 totall

📅 15 feb
📅 15 feb dyeing
📅 15 feb cpb
📅 today / ajke / kal

🔎 12345 (sill / lot)
👤 noor
👤 noor cpb`
  });
}

/* ===================== PER DAY ===================== */

const perDayMatch = question.match(/(cpb|jigger|ex-jigger|exjigger|napthol|singing|marcerise|bleach|folding)\s*per\s*day/);

if (perDayMatch) {

  let proc = perDayMatch[1]
    .replace("exjigger","ex_jigger")
    .replace("ex-jigger","ex_jigger");

  if (!GID_MAP[proc])
    return res.json({ reply: "Process বুঝতে পারিনি!" });

  const today = new Date();
  const month = today.getMonth();
  const year = today.getFullYear();

  let report = [];
  let grandTotal = 0;

  for (let d = 1; d <= today.getDate(); d++) {

    const target = new Date(year, month, d);
    const qty = getSum(proc, target);

    grandTotal += qty;
    report.push(`${d} : ${qty.toLocaleString()} yds`);
  }

  return res.json({
    reply:
`📊 ${proc.toUpperCase()} DAILY PRODUCTION
━━━━━━━━━━━━━━━━━━━━
${report.join("\n")}
━━━━━━━━━━━━━━━━━━━━
✅ TOTAL: ${grandTotal.toLocaleString()} yds`
  });
}

/* ===================== TOTAL DYEING ===================== */

if (cleanInput === "totaldyeing") {

  const c = getSum("cpb");
  const j = getSum("jigger");
  const ex = getSum("ex_jigger");
  const n = getSum("napthol");

  return res.json({
    reply:
`🎨 TOTAL DYEING (ALL TIME)
━━━━━━━━━━━━━━━━━━━━
CPB: ${c.toLocaleString()}
JIG: ${j.toLocaleString()}
EX: ${ex.toLocaleString()}
NAP: ${n.toLocaleString()}
━━━━━━━━━━━━━━━━━━━━
TOTAL: ${(c+j+ex+n).toLocaleString()}`
  });
}

/* ===================== FACTORY OVERALL ===================== */

if (cleanInput === "totall") {

  const s = getSum("singing");
  const m = getSum("marcerise");
  const b = getSum("bleach");
  const c = getSum("cpb");
  const j = getSum("jigger");
  const ex = getSum("ex_jigger");
  const n = getSum("napthol");
  const f = getSum("folding");

  return res.json({
    reply:
`🏭 FACTORY SUMMARY
━━━━━━━━━━━━━━━━━━━━
Singing: ${s.toLocaleString()}
Marc: ${m.toLocaleString()}
Bleach: ${b.toLocaleString()}

CPB: ${c.toLocaleString()}
JIG: ${j.toLocaleString()}
EX: ${ex.toLocaleString()}
NAP: ${n.toLocaleString()}

Folding: ${f.toLocaleString()}`
  });
}

/* ===================== DATE BASED ===================== */

const keywordDate = getKeywordDate(question);

if (keywordDate && !question.includes("per day")) {

  const s = getSum("singing", keywordDate);
  const m = getSum("marcerise", keywordDate);
  const b = getSum("bleach", keywordDate);
  const c = getSum("cpb", keywordDate);
  const j = getSum("jigger", keywordDate);
  const ex = getSum("ex_jigger", keywordDate);
  const n = getSum("napthol", keywordDate);
  const f = getSum("folding", keywordDate);

  if (question.includes("dyeing")) {

    return res.json({
      reply:
`📅 DYEING REPORT
━━━━━━━━━━━━━━━━━━━━
CPB: ${c.toLocaleString()}
JIG: ${j.toLocaleString()}
EX: ${ex.toLocaleString()}
NAP: ${n.toLocaleString()}
━━━━━━━━━━━━━━━━━━━━
TOTAL: ${(c+j+ex+n).toLocaleString()}`
    });

  }

  const grand = s+m+b+c+j+ex+n;

  return res.json({
    reply:
`📅 DAILY REPORT
━━━━━━━━━━━━━━━━━━━━
Singing: ${s.toLocaleString()}
Marc: ${m.toLocaleString()}
Bleach: ${b.toLocaleString()}

CPB: ${c.toLocaleString()}
JIG: ${j.toLocaleString()}
EX: ${ex.toLocaleString()}
NAP: ${n.toLocaleString()}

Folding: ${f.toLocaleString()}
━━━━━━━━━━━━━━━━━━━━
TOTAL: ${grand.toLocaleString()}`
  });
}
/* =========================================================
   PART 3 – ADVANCED SEARCH + SERVER START
========================================================= */

/* ===================== SILL / LOT SEARCH ===================== */

const numMatch = question.match(/(\d{3,})/);

if (numMatch) {

  const inputNumber = normalizeSill(numMatch[1]);

  const greyRows = db.grey.slice(1).filter(row =>
    normalizeSill(row[1]) === inputNumber ||
    normalizeSill(row[5]) === inputNumber
  );

  if (greyRows.length > 0) {

    let totalLot = 0;
    let totalDye = 0;

    const blocks = greyRows.slice(-10).map(row => {

      const sill = normalizeSill(row[1]);
      const party = row[2] || "N/A";
      const quality = row[3] || "N/A";
      const lot = safeNum(row[5]);

      const sumProcess = (proc) =>
        db[proc].slice(1).reduce((t, r) =>
          normalizeSill(r[1]) === sill ? t + safeNum(r[6]) : t
        , 0);

      const s = sumProcess("singing");
      const m = sumProcess("marcerise");
      const b = sumProcess("bleach");
      const c = sumProcess("cpb");
      const j = sumProcess("jigger");
      const ex = sumProcess("ex_jigger");
      const n = sumProcess("napthol");
      const f = sumProcess("folding");

      const dyeTotal = c+j+ex+n;
      const diff = lot - dyeTotal;

      totalLot += lot;
      totalDye += dyeTotal;

      return `
🆔 Sill: ${sill}
Party: ${party}
Quality: ${quality}
Lot: ${lot.toLocaleString()}

Singing: ${s.toLocaleString()}
Marc: ${m.toLocaleString()}
Bleach: ${b.toLocaleString()}

CPB: ${c.toLocaleString()}
JIG: ${j.toLocaleString()}
EX: ${ex.toLocaleString()}
NAP: ${n.toLocaleString()}

Folding: ${f.toLocaleString()}
Dye Total: ${dyeTotal.toLocaleString()}
Status: ${diff <= 0 ? "EXTRA" : "SHORT"} (${Math.abs(diff).toLocaleString()})
`;
    });

    return res.json({
      reply:
`📊 SILL / LOT REPORT
━━━━━━━━━━━━━━━━━━━━
${blocks.join("\n━━━━━━━━━━━━━━━━━━━━\n")}
━━━━━━━━━━━━━━━━━━━━
TOTAL LOT: ${totalLot.toLocaleString()}
TOTAL DYE: ${totalDye.toLocaleString()}`
    });
  }
}

/* ===================== PARTY + PROCESS ===================== */

const partyProcessMatch = question.match(/^([a-z0-9 .&_()-]+)\s+(cpb|jigger|exjigger|ex-jigger|napthol|singing|marcerise|bleach|folding)$/);

if (partyProcessMatch) {

  const partyName = partyProcessMatch[1];
  const process = partyProcessMatch[2]
    .replace("exjigger","ex_jigger")
    .replace("ex-jigger","ex_jigger");

  const partyRows = db.grey.slice(1).filter(row =>
    row[2] && row[2].toLowerCase().includes(partyName)
  );

  if (partyRows.length === 0)
    return res.json({ reply: "Party পাওয়া যায়নি" });

  let total = 0;
  let lines = [];

  for (const row of partyRows) {

    const sill = normalizeSill(row[1]);
    const quality = row[3] || "N/A";

    const qty = db[process].slice(1).reduce((t,r)=>
      normalizeSill(r[1]) === sill ? t + safeNum(r[6]) : t
    ,0);

    if (qty > 0) {
      total += qty;
      lines.push(`${sill} | ${quality} → ${qty.toLocaleString()} yds`);
    }
  }

  return res.json({
    reply:
`👤 PARTY PROCESS REPORT
Process: ${process.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━
${lines.join("\n")}
━━━━━━━━━━━━━━━━━━━━
TOTAL: ${total.toLocaleString()} yds`
  });
}

/* ===================== PARTY FULL SUMMARY ===================== */

const partyOnly = db.grey.slice(1).filter(row =>
  row[2] && row[2].toLowerCase().includes(question)
);

if (partyOnly.length > 0 && !question.includes(" ")) {

  let totalLot = 0;
  let totalDye = 0;

  const blocks = partyOnly.slice(-10).map(row => {

    const sill = normalizeSill(row[1]);
    const quality = row[3] || "N/A";
    const lot = safeNum(row[5]);

    const sumProc = (p)=>
      db[p].slice(1).reduce((t,r)=>
        normalizeSill(r[1])===sill ? t+safeNum(r[6]) : t
      ,0);

    const dye = sumProc("cpb")+sumProc("jigger")+sumProc("ex_jigger")+sumProc("napthol");

    totalLot += lot;
    totalDye += dye;

    return `${sill} | ${quality}
Lot: ${lot.toLocaleString()}
Dye: ${dye.toLocaleString()}`;
  });

  return res.json({
    reply:
`👤 PARTY SUMMARY
━━━━━━━━━━━━━━━━━━━━
${blocks.join("\n━━━━━━━━━━━━━━━━━━━━\n")}
━━━━━━━━━━━━━━━━━━━━
TOTAL LOT: ${totalLot.toLocaleString()}
TOTAL DYE: ${totalDye.toLocaleString()}`
  });
}

/* ===================== FALLBACK ===================== */

return res.json({
  reply: "Command বুঝতে পারিনি। help লিখে দেখো।"
});

}); // ROUTE CLOSE

/* ===================== SERVER START ===================== */

app.listen(PORT, () => {
  console.log("🚀 Factory ERP AI running on port " + PORT);
});
         
