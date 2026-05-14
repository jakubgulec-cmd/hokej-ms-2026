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
  const homeMatch = html.match(/class="team-home"[\s\S]*?<h2 class="long">([^<]+)<\/h2>/);
  const awayMatch = html.match(/class="team-visiting"[\s\S]*?<h2 class="long">([^<]+)<\/h2>/);
  return {
    home: homeMatch ? homeMatch[1].trim() : null,
    away: awayMatch ? awayMatch[1].trim() : null,
  };
}

const sql = fs.readFileSync(path.join(__dirname, '..', 'MIGRATION.sql'), 'utf-8');
const insertLines = [...sql.matchAll(/\('([^']+)',\s+'([a-z]{2})',\s+'([^']+)',\s+'([a-z]{2})',\s+'([^']+)',\s+'upcoming',\s+(\d{7}),\s+'([AB])'\)/g)];

console.log(`Checking ${insertLines.length} matches\n`);

const mismatches = [];

(async () => {
  for (let i = 0; i < insertLines.length; i++) {
    const m = insertLines[i];
    const [, dbHome, dbHomeCode, dbAway, dbAwayCode, dbDate, id, group] = m;
    const url = `https://www.hokej.cz/zapas/${id}`;
    process.stdout.write(`[${i + 1}/${insertLines.length}] ${dbHome} vs ${dbAway} (${id}) ... `);

    try {
      const html = await fetchUrl(url);
      const { home, away } = parseTeams(html);

      if (home === dbHome && away === dbAway) {
        console.log('OK');
      } else {
        console.log(`MISMATCH! DB: ${dbHome}/${dbAway}, Hokej: ${home}/${away}`);
        mismatches.push({ id, group, dbHome, dbHomeCode, dbAway, dbAwayCode, dbDate, realHome: home, realAway: away, index: i });
      }
    } catch (err) {
      console.log(`ERR ${err.message}`);
    }

    await new Promise(r => setTimeout(r, 350));
  }

  console.log(`\n\n━━━ ${mismatches.length} mismatches found ━━━`);
  if (mismatches.length > 0) {
    console.log('\nKorekce (pro update MIGRATION.sql):\n');
    mismatches.forEach(mm => {
      // Najdi country code z původního DB (prohodit)
      console.log(`-- ID ${mm.id} (sk. ${mm.group}): swap`);
      console.log(`-- BYLO: ('${mm.dbHome}', '${mm.dbHomeCode}', '${mm.dbAway}', '${mm.dbAwayCode}', '${mm.dbDate}', ...)`);
      console.log(`-- MÁ BÝT: ('${mm.realHome}', '${mm.dbAwayCode}', '${mm.realAway}', '${mm.dbHomeCode}', '${mm.dbDate}', ...)\n`);
    });

    // Ulož mismatches do JSON pro automatický fix
    fs.writeFileSync(path.join(__dirname, 'mismatches.json'), JSON.stringify(mismatches, null, 2));
    console.log('Saved to scripts/mismatches.json');
  }
})();
