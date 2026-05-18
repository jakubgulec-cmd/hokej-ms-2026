// Hluboký audit: porovnává hokej.cz vs DB vs co frontend vykreslí
const https = require('https');

const SUPABASE_URL = 'https://buvtlfrepkgutetmnghe.supabase.co';
const SUPABASE_KEY = 'sb_publishable_BlvLCue9HmFp8Cp8Ef076g_ev_8EmH4';

function get(url, headers = {}) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', ...headers } }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseHokej(html) {
  const block = (html.match(/<div class="row match-score">[\s\S]*?<div class="row banner-tipsport">/) || [''])[0];
  if (!block) return null;
  const homeScore = block.match(/<span class="home">(\d+)<\/span>/);
  const visitScore = block.match(/<span class="visiting">(\d+)<\/span>/);
  const homeName = block.match(/class="team-home"[\s\S]*?<h2 class="long">([^<]+)<\/h2>/);
  const visitName = block.match(/class="team-visiting"[\s\S]*?<h2 class="long">([^<]+)<\/h2>/);
  const status = block.match(/<span>(konec|přestávka|live|after so|after pen)<\/span>/i);
  if (!homeName || !visitName) return null;
  return {
    htmlHome: homeName[1].trim(),
    htmlVisit: visitName[1].trim(),
    htmlHomeScore: homeScore ? parseInt(homeScore[1]) : null,
    htmlVisitScore: visitScore ? parseInt(visitScore[1]) : null,
    status: status ? status[1].toLowerCase() : null,
  };
}

(async () => {
  // Stáhni VŠECHNY zápasy (i upcoming)
  const dbJson = await get(
    `${SUPABASE_URL}/rest/v1/matches?select=hokej_cz_id,home_team,home_code,away_team,away_code,home_goals,away_goals,live_home_goals,live_away_goals,status&order=match_date`,
    { apikey: SUPABASE_KEY }
  );
  const matches = JSON.parse(dbJson);

  console.log(`\n━━━ DETAILNÍ AUDIT ${matches.length} zápasů ━━━`);
  console.log(`Časy: ${new Date().toLocaleString('cs-CZ')}\n`);

  const problems = [];

  for (const m of matches) {
    // Skip zápasy ještě nezačaté
    if (m.status === 'upcoming') continue;

    const html = await get(`https://www.hokej.cz/zapas/${m.hokej_cz_id}`);
    const h = parseHokej(html);
    if (!h) {
      console.log(`⚠️  ${m.home_team} vs ${m.away_team}: HTML parse failed`);
      continue;
    }

    // === Co by uživatel viděl ve frontendu (data z DB) ===
    const feHomeScore = m.status === 'finished' ? m.home_goals : m.live_home_goals;
    const feAwayScore = m.status === 'finished' ? m.away_goals : m.live_away_goals;
    const feDisplay = `${m.home_team} ${feHomeScore} : ${feAwayScore} ${m.away_team}`;

    // === Co by mělo být podle hokej.cz (po správném mappingu) ===
    let expectedHome, expectedAway;
    if (h.htmlHome === m.home_team && h.htmlVisit === m.away_team) {
      expectedHome = h.htmlHomeScore;
      expectedAway = h.htmlVisitScore;
    } else if (h.htmlHome === m.away_team && h.htmlVisit === m.home_team) {
      expectedHome = h.htmlVisitScore;
      expectedAway = h.htmlHomeScore;
    } else {
      console.log(`❌ ${m.home_team} vs ${m.away_team}: team mismatch ${h.htmlHome}/${h.htmlVisit}`);
      problems.push({ match: m, reason: 'team_mismatch' });
      await new Promise(r => setTimeout(r, 350));
      continue;
    }

    const expectedDisplay = `${m.home_team} ${expectedHome} : ${expectedAway} ${m.away_team}`;
    const hokejRaw = `${h.htmlHome} ${h.htmlHomeScore} : ${h.htmlVisitScore} ${h.htmlVisit}`;

    const ok = feHomeScore === expectedHome && feAwayScore === expectedAway;

    if (ok) {
      console.log(`✅ ${m.home_team} vs ${m.away_team} [${m.status}]`);
      console.log(`   hokej.cz raw:  ${hokejRaw}`);
      console.log(`   DB → FE:       ${feDisplay}`);
    } else {
      console.log(`\n❌ ${m.home_team} vs ${m.away_team} [${m.status}]`);
      console.log(`   hokej.cz raw:    ${hokejRaw}`);
      console.log(`   Mělo by být:     ${expectedDisplay}`);
      console.log(`   Frontend ukáže:  ${feDisplay}`);
      console.log(`   ID: ${m.hokej_cz_id}`);
      problems.push({ match: m, expected: { home: expectedHome, away: expectedAway }, actual: { home: feHomeScore, away: feAwayScore } });
    }

    await new Promise(r => setTimeout(r, 350));
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`Problémů: ${problems.length}`);
  if (problems.length > 0) {
    console.log('\n=== SQL k opravě ===');
    problems.forEach(p => {
      if (p.reason !== 'team_mismatch' && p.match.status === 'finished') {
        console.log(`\n-- ${p.match.home_team} vs ${p.match.away_team}`);
        console.log(`UPDATE matches SET home_goals = ${p.expected.home}, away_goals = ${p.expected.away}`);
        console.log(`WHERE hokej_cz_id = ${p.match.hokej_cz_id};`);
      }
      if (p.reason !== 'team_mismatch' && p.match.status === 'ongoing') {
        console.log(`\n-- ${p.match.home_team} vs ${p.match.away_team} (LIVE)`);
        console.log(`UPDATE matches SET live_home_goals = ${p.expected.home}, live_away_goals = ${p.expected.away}`);
        console.log(`WHERE hokej_cz_id = ${p.match.hokej_cz_id};`);
      }
    });
  }
})();
