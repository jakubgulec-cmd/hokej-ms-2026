const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const MIN_WAIT_MINUTES = 95;

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      let data = '';
      res.on('data', chunk => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseResult(html, dbHomeTeam, dbAwayTeam) {
  // Izolovat jen match-score blok (aby se náhodou neparsoval jiný score na stránce)
  const blockMatch = html.match(/<div class="row match-score">[\s\S]*?<div class="row banner-tipsport">/);
  if (!blockMatch) {
    console.log(`   ⚠️  Nenalezen "row match-score" blok`);
    return null;
  }
  const block = blockMatch[0];

  const homeScoreMatch = block.match(/<span class="home">(\d+)<\/span>/);
  const visitScoreMatch = block.match(/<span class="visiting">(\d+)<\/span>/);
  const homeNameMatch = block.match(/class="team-home"[\s\S]*?<h2 class="long">([^<]+)<\/h2>/);
  const visitNameMatch = block.match(/class="team-visiting"[\s\S]*?<h2 class="long">([^<]+)<\/h2>/);
  const statusMatch = block.match(/<span>(konec|přestávka|live|after so|after pen)<\/span>/i);

  if (!homeScoreMatch || !visitScoreMatch) {
    console.log(`   ⚠️  Skóre neparsováno (zápas možná nezačal)`);
    return null;
  }
  if (!homeNameMatch || !visitNameMatch) {
    console.log(`   ⚠️  Jména týmů nenalezena`);
    return null;
  }

  const htmlHomeName = homeNameMatch[1].trim();
  const htmlVisitName = visitNameMatch[1].trim();
  const htmlHomeScore = parseInt(homeScoreMatch[1]);
  const htmlVisitScore = parseInt(visitScoreMatch[1]);

  console.log(`   HTML: ${htmlHomeName}=${htmlHomeScore} vs ${htmlVisitName}=${htmlVisitScore}`);
  console.log(`   DB:   ${dbHomeTeam} vs ${dbAwayTeam}`);

  let homeGoals, awayGoals;
  if (htmlHomeName === dbHomeTeam && htmlVisitName === dbAwayTeam) {
    homeGoals = htmlHomeScore;
    awayGoals = htmlVisitScore;
    console.log(`   ✓ Pořadí sedí: home=${homeGoals}, away=${awayGoals}`);
  } else if (htmlHomeName === dbAwayTeam && htmlVisitName === dbHomeTeam) {
    homeGoals = htmlVisitScore;
    awayGoals = htmlHomeScore;
    console.log(`   ⚠️  Prohozené pořadí, mapuji: home(${dbHomeTeam})=${homeGoals}, away(${dbAwayTeam})=${awayGoals}`);
  } else {
    console.log(`   ❌ Týmy neodpovídají! DB: ${dbHomeTeam}/${dbAwayTeam}, HTML: ${htmlHomeName}/${htmlVisitName}`);
    return null;
  }

  const statusText = statusMatch ? statusMatch[1].toLowerCase() : '';
  const isFinished = statusText === 'konec' || statusText === 'after so' || statusText === 'after pen';

  return { homeGoals, awayGoals, isFinished, statusText };
}

function calculatePoints(predH, predA, realH, realA) {
  // Přesný tip → +3
  if (predH === realH && predA === realA) return 3;

  let points = 0;

  // Správný rozdíl → +2
  if (Math.abs(predH - predA) === Math.abs(realH - realA)) points += 2;

  // Správný výsledek (home win / away win / draw) → +1
  const predResult = predH > predA ? 'H' : predH < predA ? 'A' : 'D';
  const realResult = realH > realA ? 'H' : realH < realA ? 'A' : 'D';
  if (predResult === realResult) points += 1;

  return points;
}

async function main() {
  const now = new Date();
  console.log(`\n🏒 Scraper started: ${now.toISOString()} (cs: ${now.toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' })})`);
  console.log(`   SUPABASE_URL: ${process.env.SUPABASE_URL ? 'OK' : 'MISSING'}`);
  console.log(`   SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? 'OK (' + process.env.SUPABASE_ANON_KEY.substring(0, 15) + '...)' : 'MISSING'}`);

  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, home_team, away_team, match_date, status, hokej_cz_id')
    .neq('status', 'finished');

  if (error) {
    console.error('❌ DB error:', JSON.stringify(error, null, 2));
    process.exit(1);
  }

  console.log(`📋 Načteno ${matches?.length || 0} nehotových zápasů`);

  if (!matches || matches.length === 0) {
    console.log('✅ Všechny zápasy jsou hotové.');
    process.exit(0);
  }

  let processed = 0;

  for (const match of matches) {
    const minutesElapsed = (now - new Date(match.match_date)) / 60000;
    const label = `${match.home_team} vs ${match.away_team}`;
    console.log(`\n[${label}] Uplynulo: ${minutesElapsed.toFixed(0)} min`);

    if (minutesElapsed < MIN_WAIT_MINUTES) {
      const waitLeft = (MIN_WAIT_MINUTES - minutesElapsed).toFixed(0);
      console.log(`⏳ Čeká se ještě ${waitLeft} min`);
      continue;
    }

    if (!match.hokej_cz_id) {
      console.log(`⚠️  Chybí hokej_cz_id`);
      continue;
    }

    try {
      const url = `https://www.hokej.cz/zapas/${match.hokej_cz_id}`;
      console.log(`🔍 Scrapuji: ${url}`);
      const html = await fetchUrl(url);
      const result = parseResult(html, match.home_team, match.away_team);

      if (!result) {
        console.log(`⚠️  Nepodařilo se naparsovat výsledek`);
        continue;
      }

      console.log(`📊 ${result.homeGoals}:${result.awayGoals} (${result.statusText || 'neznámý status'})`);

      if (!result.isFinished) {
        await supabase.from('matches').update({
          status: 'ongoing',
          live_home_goals: result.homeGoals,
          live_away_goals: result.awayGoals,
        }).eq('id', match.id);
        console.log(`🔴 LIVE ${result.homeGoals}:${result.awayGoals}`);
        continue;
      }

      // Zápas skončil
      const { error: updateError } = await supabase
        .from('matches')
        .update({
          home_goals: result.homeGoals,
          away_goals: result.awayGoals,
          status: 'finished',
          live_home_goals: null,
          live_away_goals: null,
        })
        .eq('id', match.id);

      if (updateError) { console.error('Update error:', updateError); continue; }
      console.log(`✅ Finální: ${result.homeGoals}:${result.awayGoals}`);

      // Vypočítej body pro všechny tipy
      const { data: preds } = await supabase
        .from('predictions')
        .select('id, home_goals, away_goals')
        .eq('match_id', match.id);

      if (preds && preds.length > 0) {
        for (const pred of preds) {
          const pts = calculatePoints(pred.home_goals, pred.away_goals, result.homeGoals, result.awayGoals);
          await supabase
            .from('predictions')
            .update({ points: pts, locked: true })
            .eq('id', pred.id);
        }
        console.log(`✅ Body vypočítány pro ${preds.length} tipů`);
      }

      processed++;
    } catch (err) {
      console.error(`❌ Chyba:`, err.message);
    }

    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n✅ Scraper dokončen, zpracováno: ${processed}`);
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
