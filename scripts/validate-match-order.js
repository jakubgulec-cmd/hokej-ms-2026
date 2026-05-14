// Ověří, že home/away pořadí v MIGRATION.sql odpovídá pořadí na hokej.cz
// (kritické — kdyby bylo špatně, scraper by ukládal skóre obráceně)

const fs = require('fs');
const path = require('path');
const https = require('https');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseTeams(html) {
  // Najde home team a away team v HTML
  const homeMatch = html.match(/class="team-home"[\s\S]*?<h2 class="long">([^<]+)<\/h2>/);
  const awayMatch = html.match(/class="team-visiting"[\s\S]*?<h2 class="long">([^<]+)<\/h2>/);
  return {
    home: homeMatch ? homeMatch[1].trim() : null,
    away: awayMatch ? awayMatch[1].trim() : null,
  };
}

const sql = fs.readFileSync(path.join(__dirname, '..', 'MIGRATION.sql'), 'utf-8');

// Parse INSERT řádky: ('Tým1', 'kód1', 'Tým2', 'kód2', '...', 'upcoming', ID, '...')
const insertLines = [...sql.matchAll(/\('([^']+)',\s+'[a-z]{2}',\s+'([^']+)',\s+'[a-z]{2}',\s+'[^']+',\s+'upcoming',\s+(\d{7})/g)];
console.log(`Parsed ${insertLines.length} matches from MIGRATION.sql\n`);

// Otestuj 5 náhodných zápasů
const sample = [
  insertLines[0],    // Švédsko vs Kanada
  insertLines[1],    // Česko vs Dánsko (Česko HOME)
  insertLines[4],    // Slovinsko vs Česko (Česko AWAY)
  insertLines[28],   // Začátek skupiny A
  insertLines[55],   // Poslední zápas skupiny A
];

let passed = 0;
let failed = 0;

(async () => {
  for (const match of sample) {
    const [, dbHome, dbAway, id] = match;
    const url = `https://www.hokej.cz/zapas/${id}`;
    console.log(`Checking ${dbHome} vs ${dbAway} (ID ${id})`);

    try {
      const html = await fetchUrl(url);
      const { home, away } = parseTeams(html);

      const homeOk = home === dbHome;
      const awayOk = away === dbAway;

      if (homeOk && awayOk) {
        console.log(`  ✓ DB matches hokej.cz: ${home} vs ${away}\n`);
        passed++;
      } else {
        console.log(`  ✗ MISMATCH:`);
        console.log(`    DB:        ${dbHome} (H) vs ${dbAway} (A)`);
        console.log(`    Hokej.cz:  ${home} (H) vs ${away} (A)\n`);
        failed++;
      }
    } catch (err) {
      console.log(`  ⚠️  Error fetching: ${err.message}\n`);
      failed++;
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Match: ${passed}`);
  console.log(`${failed > 0 ? '❌' : '✅'} Mismatch: ${failed}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(failed > 0 ? 1 : 0);
})();
