// End-to-end audit: porovná DB výsledky se skutečností na hokej.cz
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

function parseHokej(html, dbHome, dbAway) {
  const block = (html.match(/<div class="row match-score">[\s\S]*?<div class="row banner-tipsport">/) || [''])[0];
  const homeScore = block.match(/<span class="home">(\d+)<\/span>/);
  const visitScore = block.match(/<span class="visiting">(\d+)<\/span>/);
  const homeName = block.match(/class="team-home"[\s\S]*?<h2 class="long">([^<]+)<\/h2>/);
  const visitName = block.match(/class="team-visiting"[\s\S]*?<h2 class="long">([^<]+)<\/h2>/);
  const status = block.match(/<span>(konec|přestávka|live|after so|after pen)<\/span>/i);
  if (!homeScore || !visitScore || !homeName || !visitName) return null;

  const htmlHome = homeName[1].trim();
  const htmlVisit = visitName[1].trim();
  const htmlHomeScore = parseInt(homeScore[1]);
  const htmlVisitScore = parseInt(visitScore[1]);

  let mappedHome, mappedAway, mappingType;
  if (htmlHome === dbHome && htmlVisit === dbAway) {
    mappedHome = htmlHomeScore; mappedAway = htmlVisitScore;
    mappingType = 'direct';
  } else if (htmlHome === dbAway && htmlVisit === dbHome) {
    mappedHome = htmlVisitScore; mappedAway = htmlHomeScore;
    mappingType = 'swapped';
  } else {
    return { error: `Team mismatch! DB: ${dbHome}/${dbAway}, HTML: ${htmlHome}/${htmlVisit}` };
  }

  return {
    htmlHome, htmlVisit, htmlHomeScore, htmlVisitScore,
    mappedHome, mappedAway, mappingType,
    status: status ? status[1] : 'unknown',
  };
}

(async () => {
  // Stáhni všechny finished zápasy z DB
  const dbJson = await get(`${SUPABASE_URL}/rest/v1/matches?select=hokej_cz_id,home_team,away_team,home_goals,away_goals,status&status=eq.finished&order=match_date`, {
    apikey: SUPABASE_KEY,
  });
  const matches = JSON.parse(dbJson);

  console.log(`\n━━━ Auditing ${matches.length} finished matches ━━━\n`);

  let ok = 0, mismatch = 0;
  for (const m of matches) {
    const html = await get(`https://www.hokej.cz/zapas/${m.hokej_cz_id}`);
    const parsed = parseHokej(html, m.home_team, m.away_team);

    if (!parsed || parsed.error) {
      console.log(`❌ ${m.home_team} vs ${m.away_team}: ${parsed?.error || 'parse error'}`);
      mismatch++;
      continue;
    }

    const dbScore = `${m.home_goals}:${m.away_goals}`;
    const expectedScore = `${parsed.mappedHome}:${parsed.mappedAway}`;

    if (dbScore === expectedScore) {
      console.log(`✅ ${m.home_team} vs ${m.away_team}: ${dbScore} (${parsed.mappingType} mapping)`);
      ok++;
    } else {
      console.log(`❌ ${m.home_team} vs ${m.away_team}:`);
      console.log(`   DB ulozeno:      ${dbScore}`);
      console.log(`   Hokej.cz říká:   ${parsed.htmlHome}=${parsed.htmlHomeScore} vs ${parsed.htmlVisit}=${parsed.htmlVisitScore}`);
      console.log(`   Po mapování by mělo být: ${expectedScore} (${parsed.mappingType})`);
      mismatch++;
    }

    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Správně: ${ok}`);
  console.log(`${mismatch > 0 ? '❌' : '✅'} Nesoulad:  ${mismatch}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
})();
