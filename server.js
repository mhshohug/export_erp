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

// তারিখ কনভার্ট করার জন্য নতুন হেল্পার (Today, Yesterday লজিকের জন্য)
function getKeywordsDate(input) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  
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
    return rows.reduce((total, row) => {
      const rowDate = (row[0] || "").toLowerCase().replace(/[-\s]/g, '');
      const cleanTarget = targetDate ? targetDate.replace(/[-\s]/g, '') : null;
      if (!targetDate || rowDate.includes(cleanTarget)) {
        return total + (parseFloat(row[6]?.replace(/,/g, "")) || 0);
      }
      return total;
    }, 0);
  };
// --- PER DAY PRODUCTION (ALL SECTION) ---
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

    const searchDate = `${d}-${monthName}`;

    const qty = db[proc].slice(1).reduce((total,row)=>{
      const rowDate = (row[0]||"").toLowerCase().replace(/[-\s]/g,'');
      if(rowDate.includes(searchDate.replace(/[-\s]/g,'')))
        return total+(parseFloat(row[6]?.replace(/,/g,''))||0);
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
  // --- কেইস ১: "total dyeing" ---
  if (cleanInput === "totaldyeing") {
    const cpb = getSum('cpb');
    const jigger = getSum('jigger');
    const exJ = getSum('ex_jigger');
    const nap = getSum('napthol');
    return res.json({
      reply: `🎨 **TOTAL DYEING SUMMARY (All Time)**\n━━━━━━━━━━━━━━━━━━━━━━━\n• CPB: ${cpb.toLocaleString()} yds\n• Jigger: ${jigger.toLocaleString()} yds\n• Ex-Jigger: ${exJ.toLocaleString()} yds\n• Napthol: ${nap.toLocaleString()} yds\n━━━━━━━━━━━━━━━━━━━━━━━\n🔥 **MOT JOGFOL: ${(cpb+jigger+exJ+nap).toLocaleString()} yds**`
    });
  }

  // --- কেইস ২: "totall" ---
  if (cleanInput === "totall") {
    const dyeingTotal = getSum('cpb') + getSum('jigger') + getSum('ex_jigger') + getSum('napthol');
    return res.json({
      reply: `🏭 **FACTORY OVERALL SUMMARY**\n━━━━━━━━━━━━━━━━━━━━━━━\n🔹 **Process:** Sing(${getSum('singing').toLocaleString()}), Marc(${getSum('marcerise').toLocaleString()}), Bleach(${getSum('bleach').toLocaleString()})\n🎨 **Dyeing:** CPB(${getSum('cpb').toLocaleString()}), JIG(${getSum('jigger').toLocaleString()}), EX-J(${getSum('ex_jigger').toLocaleString()}), NAP(${getSum('napthol').toLocaleString()})\n📍 **Dyeing Total: ${dyeingTotal.toLocaleString()} yds**\n🧺 **Folding: ${getSum('folding').toLocaleString()} yds**`
    });
  }

  // --- কেইস ৩: তারিখ অনুযায়ী সব সেকশনের রিপোর্ট (যেমন: "15 feb", "Today", "Ajke") ---
  const dateMatch = question.match(/(\d{1,2}[-\s][a-z]{3})/) || [null, getKeywordsDate(question)];
  const searchDate = dateMatch[1];

  if (searchDate && !question.includes("dyeing") && !Object.keys(GID_MAP).some(p => cleanInput.includes(p.replace('_','')))) {
    const s = getSum('singing', searchDate);
    const m = getSum('marcerise', searchDate);
    const b = getSum('bleach', searchDate);
    const c = getSum('cpb', searchDate);
    const j = getSum('jigger', searchDate);
    const ex = getSum('ex_jigger', searchDate);
    const n = getSum('napthol', searchDate);
    const f = getSum('folding', searchDate);
    const grandTotal = s + m + b + c + j + ex + n;

    return res.json({
      reply: `📅 **OVERALL REPORT: ${searchDate.toUpperCase()}**\n━━━━━━━━━━━━━━━━━━━━━━━\n🔹 **Process Section:**\n• Singing: ${s.toLocaleString()}\n• Marc: ${m.toLocaleString()}\n• Bleach: ${b.toLocaleString()}\n\n🎨 **Dyeing Section:**\n• CPB: ${c.toLocaleString()}\n• Jigger: ${j.toLocaleString()}\n• Ex-Jigger: ${ex.toLocaleString()}\n• Napthol: ${n.toLocaleString()}\n\n🧺 **Folding: ${f.toLocaleString()}**\n━━━━━━━━━━━━━━━━━━━━━━━\n✅ **GRAND TOTAL: ${grandTotal.toLocaleString()} yds**`
    });
  }

  // --- কেইস ৪: তারিখ অনুযায়ী ডাইয়িং ---
  if (searchDate && question.includes("dyeing")) {
    const c = getSum('cpb', searchDate);
    const j = getSum('jigger', searchDate);
    const ex = getSum('ex_jigger', searchDate);
    const n = getSum('napthol', searchDate);
    return res.json({
      reply: `📅 **DYEING REPORT: ${searchDate.toUpperCase()}**\n━━━━━━━━━━━━━━━━━━━━━━━\nCPB: ${c.toLocaleString()}\nJIG: ${j.toLocaleString()}\nEX-J: ${ex.toLocaleString()}\nNAP: ${n.toLocaleString()}\n━━━━━━━━━━━━━━━━━━━━━━━\n✅ **TOTAL: ${(c+j+ex+n).toLocaleString()} yds**`
    });
  }

  // --- কেইস ৫: তারিখ + প্রসেস (ডেইলি রিপোর্ট) ---
  const requestedProcess = keys.filter(k => k !== 'grey').sort((a, b) => b.length - a.length).find(p => cleanInput.includes(p.replace('_', '')));
  if (searchDate && requestedProcess) {
    const dailyRows = db[requestedProcess].slice(1).filter(row => row[0].toLowerCase().replace(/[-\s]/g, '').includes(searchDate.replace(/[-\s]/g, '')));
    if (dailyRows.length > 0) {
      const combined = dailyRows.reduce((acc, row) => {
        const sill = normalizeSill(row[1]);
        const qty = parseFloat(row[6]?.replace(/,/g, "")) || 0;
        if (!acc[sill]) acc[sill] = { sill, party: db.grey.slice(1).find(g => normalizeSill(g[1]) === sill)?.[2] || "N/A", qty: 0 };
        acc[sill].qty += qty;
        return acc;
      }, {});
      let list = Object.values(combined).map(i => `🔹 **${i.sill}** | ${i.party} → ${i.qty.toLocaleString()} yds`).join("\n");
      return res.json({ reply: `📅 **REPORT: ${searchDate.toUpperCase()}**\n⚙️ **PROC: ${requestedProcess.toUpperCase()}**\n━━━━━━\n${list}\n━━━━━━\n**Total: ${dailyRows.reduce((t, r) => t + (parseFloat(r[6]?.replace(/,/g, "")) || 0), 0).toLocaleString()} yds**` });
    }
  }

  // --- কেইস ৬: SILL OR LOT REPORT (সিল বা লট নম্বর দিয়ে সার্চ) ---
  const sillLotMatch = question.match(/(\d{3,})/);
  if (sillLotMatch) {
    const inputNumber = normalizeSill(sillLotMatch[1]);
    
    // সিল অথবা লট নম্বর দিয়ে ম্যাচ করা
    const matchingRows = db.grey.slice(1).filter(row => 
      normalizeSill(row[1]) === inputNumber || normalizeSill(row[4]) === inputNumber
    );

    if (matchingRows.length > 0) {
      let totalLotSize = 0;
      let totalDyeingSize = 0;
      
      // ১০টির বেশি হলে শেষের ১০টি দেখাবে
      const limitedRows = matchingRows.slice(-10);

      const reportBlocks = limitedRows.map(greyRow => {
        const sill = normalizeSill(greyRow[1]);
        const lotNo = normalizeSill(greyRow[4]);
        const party = greyRow[2] || "N/A";
        const quality = greyRow[3] || "N/A";
        const lotQty = parseFloat(greyRow[5]?.replace(/,/g, "")) || 0;
        
        const sumSill = (s) => db[s].slice(1).reduce((t, r) => 
          normalizeSill(r[1]) === sill ? t + (parseFloat(r[6]?.replace(/,/g, "")) || 0) : t, 0
        );

        const s = sumSill('singing');
        const m = sumSill('marcerise');
        const b = sumSill('bleach');
        const c = sumSill('cpb');
        const j = sumSill('jigger');
        const ex = sumSill('ex_jigger');
        const n = sumSill('napthol');
        const f = sumSill('folding');

        const dyeingTotal = c + j + ex + n;
        const diff = lotQty - dyeingTotal;
        
        totalLotSize += lotQty;
        totalDyeingSize += dyeingTotal;

        return `🆔 **Sill No: ${sill}** (Lot: ${lotNo})
━━━━━━━━━━━━━━━━━━━━━━━━
👤 **Party** : ${party}
📄 **Quality** : ${quality}
📦 **Lot Size** : ${lotQty.toLocaleString()} yds

⚙️ **Pre-Process Section:**
• Singing    : ${s.toLocaleString()} yds
• Mercerize  : ${m.toLocaleString()} yds
• Bleaching  : ${b.toLocaleString()} yds

🎨 **Dyeing Section:**
• CPB        : ${c.toLocaleString()} yds
• Jigger     : ${j.toLocaleString()} yds
• Ex-Jigger  : ${ex.toLocaleString()} yds
• Napthol    : ${n.toLocaleString()} yds

🧺 **Finishing:**
• Folding    : ${f.toLocaleString()} yds
📍 **Total Dyeing: ${dyeingTotal.toLocaleString()} yds**
⚠️ **Status: ${diff <= 0 ? "🟢 EXTRA" : "🔴 SHORT"} (${Math.abs(diff).toLocaleString()} yds)**`;
      });

      let finalReply = `🤖 📊 **DETAILED PRODUCTION REPORT: ${inputNumber}**\n\n`;
      finalReply += reportBlocks.join("\n\n---\n\n");
      
      if (matchingRows.length > 1) {
        finalReply += `\n\n━━━━━━━━━━━━━━━━━━━━━━━━
✅ **OVERALL SUMMARY (${matchingRows.length} Sills)**
📦 **Total Lot    :** ${totalLotSize.toLocaleString()} yds
🎨 **Total Dyeing :** ${totalDyeingSize.toLocaleString()} yds
━━━━━━━━━━━━━━━━━━━━━━━━`;
      }

      return res.json({ reply: finalReply });
    }
  }


// --- PARTY + PROCESS SEARCH (noor cpb) ---
  const partyProcessMatch = question.match(/^([a-z0-9 .&_()-]+)[-\s](cpb|jigger|exjigger|ex-jigger|napthol|singing|marcerise|bleach|folding)$/i);

  if (partyProcessMatch) {
    let partyName = partyProcessMatch[1].trim().toLowerCase();
    let process = partyProcessMatch[2].replace("exjigger","ex_jigger").replace("ex-jigger","ex_jigger");

    if (!GID_MAP[process]) return res.json({ reply: "Process চিনতে পারিনি!" });

    const partyRows = db.grey.slice(1).filter(row =>
      row[2] && row[2].toLowerCase().includes(partyName)
    );

    if (partyRows.length === 0)
      return res.json({ reply: `❌ ${partyName.toUpperCase()} নামে কোন Party পাওয়া যায়নি` });

    let report = [];
    let grandTotal = 0;

    for (const greyRow of partyRows) {
      const sill = normalizeSill(greyRow[1]);
      const quality = greyRow[3] || "N/A";
      const lot = parseFloat(greyRow[5]?.replace(/,/g, "")) || 0;

      const qty = db[process].slice(1).reduce((t, r) =>
        normalizeSill(r[1]) === sill ? t + (parseFloat(r[6]?.replace(/,/g, "")) || 0) : t
      , 0);

      if (qty > 0) {
        grandTotal += qty;
        report.push(`🔹 **${sill}** | ${quality} | Lot:${lot.toLocaleString()} → ${qty.toLocaleString()} yds`);
      }
    }

    if (report.length === 0)
      return res.json({ reply: `⚠️ ${partyName.toUpperCase()} এর কোন কাপড় এখনো ${process.toUpperCase()} হয়নি` });

    return res.json({
      reply:
`👤 PARTY PROCESS REPORT
Party: ${partyName.toUpperCase()}
Process: ${process.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━
${report.join("\n")}
━━━━━━━━━━━━━━━━━━━━━━━
✅ TOTAL: ${grandTotal.toLocaleString()} yds`
    });
  }


  // --- ONLY PARTY FULL SUMMARY (noor লিখলেই) ---
  const onlyPartyMatch = db.grey.slice(1).filter(row =>
    row[2] && row[2].toLowerCase().includes(question)
  );

  if (onlyPartyMatch.length > 0 && !question.includes(" ")) {
onlyPartyMatch.splice(0, onlyPartyMatch.length - 14);
    let report = [];
    let grandLot = 0;
    let grandDye = 0;

    for (const greyRow of onlyPartyMatch) {

      const sill = normalizeSill(greyRow[1]);
      const quality = greyRow[3] || "N/A";
      const lot = parseFloat(greyRow[5]?.replace(/,/g, "")) || 0;

      const sum = (s) => db[s].slice(1).reduce((t,r)=>
        normalizeSill(r[1])===sill ? t+(parseFloat(r[6]?.replace(/,/g,""))||0):t,0);

      const dyeTotal = sum('cpb')+sum('jigger')+sum('ex_jigger')+sum('napthol');
      const fold = sum('folding');
      const diff = lot-dyeTotal;

      grandLot += lot;
      grandDye += dyeTotal;

      report.push(
`🔹 ${sill} | ${quality}
Lot:${lot.toLocaleString()}
Dye:${dyeTotal.toLocaleString()} | Fold:${fold.toLocaleString()} | ${diff<=0?"EXTRA":"SHORT"}:${Math.abs(diff).toLocaleString()}`
      );
    }

    return res.json({
      reply:
`👤 PARTY FULL REPORT
${onlyPartyMatch[0][2]}
━━━━━━━━━━━━━━━━━━━━━━━
${report.join("\n\n")}
━━━━━━━━━━━━━━━━━━━━━━━
📦 TOTAL LOT: ${grandLot.toLocaleString()}
🎨 TOTAL DYEING: ${grandDye.toLocaleString()}`
    });
  }
  // --- কেইস ৭: PARTY SEARCH ---
  const partyRows = db.grey.slice(1).filter(row => row[2] && row[2].toLowerCase().includes(question));
  if (partyRows.length > 0) {
    let partyList = partyRows.slice(-10).reverse().map(row => `🔸 **Sill: ${normalizeSill(row[1])}** | Lot: ${row[5]}`).join("\n");
    return res.json({ reply: `👤 **Party Report: ${question.toUpperCase()}**\n━━━━━━━━━━━━━━━━━━━━━━━\n${partyList}` });
  }

  return res.json({ reply: "ওস্তাদ, সিল নম্বর, তারিখ বা পার্টির নাম লিখে সার্চ দিন!" });
});

app.listen(PORT, () => console.log(`Server started on ${PORT}`));
