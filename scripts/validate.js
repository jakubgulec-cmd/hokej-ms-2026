// ============================================================
// Validační suite pro Hokej MS 2026 Tipovačku
// Spusť: node scripts/validate.js
// ============================================================

const https = require('https');

let passed = 0;
let failed = 0;
const failures = [];

function assert(name, condition, expected, actual) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    failures.push({ name, expected, actual });
    console.log(`  ✗ ${name}  (expected: ${JSON.stringify(expected)}, got: ${JSON.stringify(actual)})`);
  }
}

function section(title) {
  console.log(`\n━━━ ${title} ━━━`);
}

// ============================================================
// 1. SCORING LOGIKA
// ============================================================
section('1) Scoring logika');

function calculatePoints(predH, predA, realH, realA) {
  if (predH === realH && predA === realA) return 3;
  let points = 0;
  if (Math.abs(predH - predA) === Math.abs(realH - realA)) points += 2;
  const predResult = predH > predA ? 'H' : predH < predA ? 'A' : 'D';
  const realResult = realH > realA ? 'H' : realH < realA ? 'A' : 'D';
  if (predResult === realResult) points += 1;
  return points;
}

// Přesný tip
const exact1 = calculatePoints(3, 2, 3, 2);
assert('Přesný tip 3:2 → 3 body', exact1 === 3, 3, exact1);

const exact2 = calculatePoints(0, 0, 0, 0);
assert('Přesný tip 0:0 (remíza) → 3 body', exact2 === 3, 3, exact2);

const exact3 = calculatePoints(5, 4, 5, 4);
assert('Přesný tip 5:4 → 3 body', exact3 === 3, 3, exact3);

// Správný výsledek + správný rozdíl (ne přesný)
const wd1 = calculatePoints(3, 1, 4, 2);
assert('Výsledek H + rozdíl 2 (3:1 vs 4:2) → 3 body', wd1 === 3, 3, wd1);

const wd2 = calculatePoints(1, 3, 2, 4);
assert('Výsledek A + rozdíl 2 (1:3 vs 2:4) → 3 body', wd2 === 3, 3, wd2);

const wd3 = calculatePoints(2, 2, 5, 5);
assert('Remíza + rozdíl 0 (2:2 vs 5:5) → 3 body', wd3 === 3, 3, wd3);

// Pouze správný výsledek (rozdíl jiný) → 1 bod
const winOnly1 = calculatePoints(5, 1, 3, 2);
assert('Pouze výsledek H (5:1 vs 3:2) → 1 bod', winOnly1 === 1, 1, winOnly1);

const winOnly2 = calculatePoints(0, 4, 1, 2);
assert('Pouze výsledek A (0:4 vs 1:2) → 1 bod', winOnly2 === 1, 1, winOnly2);

const drawOnly = calculatePoints(1, 1, 3, 3);
assert('Pouze remíza (1:1 vs 3:3) → 3 body (oba výsledek i rozdíl 0)', drawOnly === 3, 3, drawOnly);

// Pouze správný rozdíl (výsledek opačný) → 2 body
const diffOnly1 = calculatePoints(4, 2, 1, 3);
assert('Pouze rozdíl (4:2 vs 1:3, oba rozdíl 2, opačný winner) → 2 body', diffOnly1 === 2, 2, diffOnly1);

const diffOnly2 = calculatePoints(2, 5, 5, 2);
assert('Pouze rozdíl (2:5 vs 5:2, oba rozdíl 3, opačný winner) → 2 body', diffOnly2 === 2, 2, diffOnly2);

// 0 bodů
const zero1 = calculatePoints(5, 0, 1, 4);
assert('0 bodů (5:0 vs 1:4, vše špatně)', calculatePoints(5, 0, 1, 4) === 0, 0, zero1);

// Edge case z reálu (Švédsko-test)
const real1 = calculatePoints(3, 6, 2, 5);
assert('Reálný případ: tip 3:6, výsledek 2:5 → 3 body (A win + rozdíl 3)', real1 === 3, 3, real1);

// ============================================================
// 2. HTML PARSER (lokální test)
// ============================================================
section('2) HTML Parser');

function parseResult(html) {
  const homeMatch = html.match(/<span class="home">(\d+)<\/span>/);
  const visitMatch = html.match(/<span class="visiting">(\d+)<\/span>/);
  const statusMatch = html.match(/<span>(konec|přestávka|live|after so|after pen)<\/span>/i);
  if (!homeMatch || !visitMatch) return null;
  const homeGoals = parseInt(homeMatch[1]);
  const awayGoals = parseInt(visitMatch[1]);
  const statusText = statusMatch ? statusMatch[1].toLowerCase() : '';
  const isFinished = statusText === 'konec' || statusText === 'after so' || statusText === 'after pen';
  return { homeGoals, awayGoals, isFinished, statusText };
}

// Test 1: zápas skončil
const html1 = `
<div id="snippet-matchOverview-score">
  <div class="score">
    <span class="home">5</span>
    <span class="divide">:</span>
    <span class="visiting">2</span>
    <div>
      <span>konec</span>
      <span>3:0, 1:1, 1:1</span>
    </div>
  </div>
</div>`;
const r1 = parseResult(html1);
assert('Parse: skončený zápas 5:2', r1 && r1.homeGoals === 5 && r1.awayGoals === 2 && r1.isFinished === true, { home: 5, away: 2, finished: true }, r1);

// Test 2: zápas běží
const html2 = `<div id="snippet-matchOverview-score"><div class="score"><span class="home">2</span><span class="divide">:</span><span class="visiting">1</span><div><span>live</span></div></div></div>`;
const r2 = parseResult(html2);
assert('Parse: live zápas 2:1', r2 && r2.homeGoals === 2 && r2.awayGoals === 1 && r2.isFinished === false, { home: 2, away: 1, finished: false }, r2);

// Test 3: po samostatných nájezdech (so)
const html3 = `<div class="score"><span class="home">3</span><span class="visiting">2</span><div><span>after so</span></div></div>`;
const r3 = parseResult(html3);
assert('Parse: after so (samostatné nájezdy) → finished', r3 && r3.isFinished === true, { finished: true }, r3 && r3.isFinished);

// Test 4: prázdný HTML
const r4 = parseResult('<html></html>');
assert('Parse: prázdný HTML → null', r4 === null, null, r4);

// Test 5: zápas neexistuje (chybí divs)
const r5 = parseResult('<div>žádné skóre</div>');
assert('Parse: HTML bez skóre → null', r5 === null, null, r5);

// Test 6: 0:0
const html6 = `<span class="home">0</span><span class="visiting">0</span><div><span>konec</span></div>`;
const r6 = parseResult(html6);
assert('Parse: 0:0 (konec)', r6 && r6.homeGoals === 0 && r6.awayGoals === 0 && r6.isFinished === true, { home: 0, away: 0, finished: true }, r6);

// ============================================================
// 3. INTEGRATION TEST: scrape reálný zápas z hokej.cz
// ============================================================
section('3) Integration: scrape reálného zápasu z hokej.cz');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

async function testRealScrape() {
  // Testovací zápas: Švédsko 5:2 Česko (MS 2025, čtvrtfinále)
  const url = 'https://www.hokej.cz/zapas/2921730';
  console.log(`  → fetchuju ${url}`);
  try {
    const html = await fetchUrl(url);
    const result = parseResult(html);
    assert('Real scrape: vrátí výsledek', result !== null, 'object', result === null ? 'null' : 'object');
    if (result) {
      assert('Real scrape: home_goals = 5 (Švédsko)', result.homeGoals === 5, 5, result.homeGoals);
      assert('Real scrape: away_goals = 2 (Česko)', result.awayGoals === 2, 2, result.awayGoals);
      assert('Real scrape: status = konec', result.statusText === 'konec', 'konec', result.statusText);
      assert('Real scrape: isFinished = true', result.isFinished === true, true, result.isFinished);
    }
  } catch (err) {
    failed++;
    failures.push({ name: 'Real scrape', error: err.message });
    console.log(`  ✗ Real scrape FAILED: ${err.message}`);
  }
}

// ============================================================
// 4. END-TO-END SIMULACE: tipovač
// ============================================================
section('4) E2E simulace: kompletní scénář tipovače');

// Scénář: 3 uživatelé tipují 1 zápas (Česko vs Dánsko 4:2)
const realMatch = { home_goals: 4, away_goals: 2 };
const users = [
  { name: 'Alice', pred: { h: 4, a: 2 } }, // přesný → 3
  { name: 'Bob',   pred: { h: 5, a: 3 } }, // výsledek + rozdíl → 3
  { name: 'Carl',  pred: { h: 3, a: 1 } }, // výsledek + rozdíl → 3
  { name: 'Dana',  pred: { h: 2, a: 0 } }, // výsledek + rozdíl → 3
  { name: 'Eve',   pred: { h: 6, a: 5 } }, // jen výsledek (rozdíl 1 vs 2) → 2
  { name: 'Frank', pred: { h: 1, a: 1 } }, // remíza, ale skutečnost je H výhra → 0
  { name: 'Greg',  pred: { h: 0, a: 0 } }, // remíza vs H výhra → 0
  { name: 'Helen', pred: { h: 2, a: 4 } }, // opačný výsledek, ale rozdíl 2 → 1
];

const expected = {
  'Alice': 3, 'Bob': 3, 'Carl': 3, 'Dana': 3,
  'Eve': 1, 'Frank': 0, 'Greg': 0, 'Helen': 2,
};

for (const u of users) {
  const pts = calculatePoints(u.pred.h, u.pred.a, realMatch.home_goals, realMatch.away_goals);
  assert(`E2E: ${u.name} (${u.pred.h}:${u.pred.a} vs ${realMatch.home_goals}:${realMatch.away_goals}) → ${expected[u.name]} bodů`, pts === expected[u.name], expected[u.name], pts);
}

const totalExpected = Object.values(expected).reduce((a, b) => a + b, 0);
const totalActual = users.reduce((sum, u) => sum + calculatePoints(u.pred.h, u.pred.a, realMatch.home_goals, realMatch.away_goals), 0);
assert(`E2E: celkový součet bodů ${totalExpected}`, totalActual === totalExpected, totalExpected, totalActual);

// ============================================================
// SPUSTIT
// ============================================================
(async () => {
  await testRealScrape();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Prošlo: ${passed}`);
  console.log(`${failed > 0 ? '❌' : '✅'} Selhalo: ${failed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (failed > 0) {
    console.log('\nSelhání:');
    failures.forEach(f => console.log(`  - ${f.name}${f.error ? `: ${f.error}` : ''}`));
    process.exit(1);
  } else {
    console.log('\n🎉 Všechny testy prošly!');
    process.exit(0);
  }
})();
