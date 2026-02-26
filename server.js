const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const SHEET_ID = "17AlSp8QqY3_YmW9bb1W-fMg9m7FFBxtYKXc2Cr9fq3A";

const GID_MAP = {
  grey:      "1069156463",
  singing:   "1204186084",
  marcerise: "883470384",
  bleach:    "1612554044",
  cpb:       "809334692",
  napthol:   "1825175747",
  jigger:    "392149567",
  ex_jigger: "843042263",
  folding:   "2051005815",
};

async function fetchSheet(gid) {
  try {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
    const { data } = await axios.get(url);
    return data.split(/\r?\n/).map(line => {
      return line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(cell =>
        cell.replace(/^"|"$/g, "").trim()
      );
    });
  } catch (err) {
    return [];
  }
}

function normalizeSill(value) {
  if (!value) return "";
  return value.toString().trim().replace(/[^0-9]/g, "");
}

/* ======== NEW SAFE HELPERS ======== */
function safeNum(val) {
  if (!val) return 0;
  return parseFloat(val.toString().replace(/,/g, "").trim()) || 0;
}

function cleanDate(val) {
  if (!val) return "";
  return val.toString().toLowerCase().replace(/\s+/g, "").replace(/-/g, "");
}
/* ================================== */

function getKeywordsDate(input) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const formatDate = (d) => `${d.getDate()}-${months[d.getMonth()]}`;

  if (input.includes("today") || input.includes("aj") || input.includes("ajke")) return formatDate(today);
  if (input.includes("kal") || input.includes("goto kal") || input.includes("yesterday")) return formatDate(yesterday);

  return null;
}

app.post("/ask", async (req, res) => {

  const rawInput = (req.body.question || "").trim().toLowerCase();
  const question = rawInput.replace(/\s+/g, ' ');
  const cleanInput = rawInput.replace(/\s+/g, '');

  const keys = Object.keys(GID_MAP);
  const results = await Promise.all(keys.map(k => fetchSheet(GID_MAP[k])));
  const db = {};
  keys.forEach((key, i) => { db[key] = results[i]; });

  const getSum = (sheetName, targetDate = null) => {
    const rows = db[sheetName].slice(1);
    const cleanTarget = targetDate ? cleanDate(targetDate) : null;

    return rows.reduce((total, row) => {
      const rowDate = cleanDate(row[0]);
      if (!cleanTarget || rowDate.includes(cleanTarget)) {
        return total + safeNum(row[6]);
      }
      return total;
    }, 0);
  };

  /* ================= HELP COMMAND ================= */
  if (cleanInput === "help") {
    return res.json({
      reply:
`🤖 FACTORY ERP AI – HELP MENU
━━━━━━━━━━━━━━━━━━━━━━━
📊 per day report:
• cpb per day
• jigger per day
• napthol per day

🎨 total dyeing
🏭 totall

📅 Date report:
• 15 feb
• 15 feb dyeing
• 15 feb cpb
• today / ajke / kal

🔎 Sill / Lot:
• 12345

👤 Party:
• noor
• noor cpb

Type any command to continue 🚀`
    });
  }
  /* ================================================= */

  // -------- PER DAY ----------
  const perDayMatch = question.match(/(cpb|jigger|ex-jigger|exjigger|napthol|singing|marcerise|bleach|folding)\s*per\s*day/i);

  if (perDayMatch) {

    let proc = perDayMatch[1]
      .replace("exjigger","ex_jigger")
      .replace("ex-jigger","ex_jigger");

    if (!GID_MAP[proc]) return res.json({ reply: "Process বুঝতে পারিনি!" });

    const today = new Date();
    const month = today.getMonth();
    const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const monthName = months[month];

    let report = [];
    let grandTotal = 0;

    for (let d = 1; d <= today.getDate(); d++) {
const qty = db[proc].slice(1).reduce((total,row)=>{

  const rawDate = row[0];
  const dObj = new Date(rawDate);

  if (!isNaN(dObj)) {
    if (dObj.getDate() === d && dObj.getMonth() === month) {
      return total + safeNum(row[6]);
    }
  }

  return total;

},0);
      
      grandTotal += qty;
      report.push(`${searchDate} : ${qty.toLocaleString()} yds`);
    }

    return res.json({
      reply:
`📊 ${proc.toUpperCase()} DAILY PRODUCTION (This Month)
━━━━━━━━━━━━━━━━━━━━━━━
${report.join("\n")}
━━━━━━━━━━━━━━━━━━━━━━━
✅ TOTAL: ${grandTotal.toLocaleString()} yds`
    });
  }

  /* ======= নিচের সব তোমার original logic same আছে ======= */

  // total dyeing
  if (cleanInput === "totaldyeing") {
    const cpb = getSum('cpb');
    const jigger = getSum('jigger');
    const exJ = getSum('ex_jigger');
    const nap = getSum('napthol');
    return res.json({
      reply: `🎨 **TOTAL DYEING SUMMARY (All Time)**\n━━━━━━━━━━━━━━━━━━━━━━━\n• CPB: ${cpb.toLocaleString()} yds\n• Jigger: ${jigger.toLocaleString()} yds\n• Ex-Jigger: ${exJ.toLocaleString()} yds\n• Napthol: ${nap.toLocaleString()} yds\n━━━━━━━━━━━━━━━━━━━━━━━\n🔥 **MOT JOGFOL: ${(cpb+jigger+exJ+nap).toLocaleString()} yds**`
    });
  }

  if (cleanInput === "totall") {
    const dyeingTotal = getSum('cpb') + getSum('jigger') + getSum('ex_jigger') + getSum('napthol');
    return res.json({
      reply: `🏭 **FACTORY OVERALL SUMMARY**\n━━━━━━━━━━━━━━━━━━━━━━━\n🔹 **Process:** Sing(${getSum('singing').toLocaleString()}), Marc(${getSum('marcerise').toLocaleString()}), Bleach(${getSum('bleach').toLocaleString()})\n🎨 **Dyeing:** CPB(${getSum('cpb').toLocaleString()}), JIG(${getSum('jigger').toLocaleString()}), EX-J(${getSum('ex_jigger').toLocaleString()}), NAP(${getSum('napthol').toLocaleString()})\n📍 **Dyeing Total: ${dyeingTotal.toLocaleString()} yds**\n🧺 **Folding: ${getSum('folding').toLocaleString()} yds**`
    });
  }

  return res.json({ reply: "ওস্তাদ, সিল নম্বর, তারিখ বা পার্টির নাম লিখে সার্চ দিন!" });

});

app.listen(PORT, () => console.log(`Server started on ${PORT}`));
