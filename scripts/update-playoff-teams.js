const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const TEAM_CODES = {
  'Kanada': 'ca', 'Slovensko': 'sk', 'Česko': 'cz', 'Norsko': 'no',
  'Švédsko': 'se', 'Slovinsko': 'si', 'Dánsko': 'dk', 'Itálie': 'it',
  'Finsko': 'fi', 'Švýcarsko': 'ch', 'Rakousko': 'at', 'Maďarsko': 'hu',
  'USA': 'us', 'Lotyšsko': 'lv', 'Německo': 'de', 'Velká Británie': 'gb',
};

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', c => (data += c));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// Vyparsuje jména týmů ze stránky zápasu (funguje pro nadcházející i hotové zápasy)
function parseTeamsFromMatchPage(html) {
  // Zkusit nejdřív v bloku match-score (průběh/konec zápasu)
  const scoreBlock = (html.match(/<div class="row match-score">[\s\S]*?<div class="row banner-tipsport">/) || [''])[0];

  if (scoreBlock) {
    const hm = scoreBlock.match(/class="team-home"[\s\S]*?<h2 class="long">([^<]+)<\/h2>/);
    const vm = scoreBlock.match(/class="team-visiting"[\s\S]*?<h2 class="long">([^<]+)<\/h2>/);
    if (hm && vm) {
      const h = hm[1].trim(), v = vm[1].trim();
      if (TEAM_CODES[h] && TEAM_CODES[v]) {
        return { home: { team: h, code: TEAM_CODES[h] }, away: { team: v, code: TEAM_CODES[v] } };
      }
    }
  }

  // Záloha pro nadcházející zápasy — prohledat celé HTML
  const hm = html.match(/class="team-home"[\s\S]*?<h2 class="long">([^<]+)<\/h2>/);
  const vm = html.match(/class="team-visiting"[\s\S]*?<h2 class="long">([^<]+)<\/h2>/);
  if (hm && vm) {
    const h = hm[1].trim(), v = vm[1].trim();
    if (TEAM_CODES[h] && TEAM_CODES[v]) {
      return { home: { team: h, code: TEAM_CODES[h] }, away: { team: v, code: TEAM_CODES[v] } };
    }
  }

  return null;
}

async function main() {
  console.log(`\n🏆 Playoff Team Updater: ${new Date().toISOString()}`);

  // Načti SF / bronze / final zápasy kde aspoň jeden tým je TBD
  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, home_team, home_code, away_team, away_code, hokej_cz_id, round')
    .in('round', ['SF', 'bronze', 'final'])
    .or('home_team.eq.TBD,away_team.eq.TBD');

  if (error) { console.error('DB error:', error); process.exit(1); }

  if (!matches || matches.length === 0) {
    console.log('✅ Žádné TBD playoff zápasy');
    process.exit(0);
  }

  console.log(`📋 TBD zápasů k aktualizaci: ${matches.length}`);
  let updated = 0;

  for (const match of matches) {
    if (!match.hokej_cz_id) continue;

    const roundLabel = { SF: 'Semifinále', bronze: 'Bronz', final: 'Finále' }[match.round] || match.round;
    const url = `https://www.hokej.cz/zapas/${match.hokej_cz_id}`;
    console.log(`\n🔍 ${roundLabel} (${match.hokej_cz_id}): ${url}`);

    try {
      const html = await fetchUrl(url);
      const teams = parseTeamsFromMatchPage(html);

      if (!teams) {
        console.log(`⏳ Týmy zatím nejsou vypublikovány na hokej.cz`);
        continue;
      }

      // Zkontrolovat, jestli je potřeba update
      if (match.home_team === teams.home.team && match.away_team === teams.away.team) {
        console.log(`✓ Již aktualizováno: ${teams.home.team} vs ${teams.away.team}`);
        continue;
      }

      console.log(`🔄 Aktualizuji: ${teams.home.team} vs ${teams.away.team}`);

      const { error: updateError } = await supabase
        .from('matches')
        .update({
          home_team: teams.home.team,
          home_code: teams.home.code,
          away_team: teams.away.team,
          away_code: teams.away.code,
        })
        .eq('id', match.id);

      if (updateError) {
        console.error(`❌ Update error:`, updateError);
      } else {
        console.log(`✅ Aktualizováno: ${teams.home.team} vs ${teams.away.team}`);
        updated++;
      }
    } catch (err) {
      console.error(`❌ Chyba při zpracování ${match.hokej_cz_id}:`, err.message);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n✅ Playoff updater dokončen, aktualizováno: ${updated} zápasů`);
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
