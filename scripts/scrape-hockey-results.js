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

function calculatePoints(predH, predA, realH, realA) {
  // Přesný tip → +3
  if (predH === realH && predA === realA) return 3;

  let points = 0;

  // Správný výsledek (home win / away win / draw) → +2
  const predResult = predH > predA ? 'H' : predH < predA ? 'A' : 'D';
  const realResult = realH > realA ? 'H' : realH < realA ? 'A' : 'D';
  if (predResult === realResult) points += 2;

  // Správný rozdíl → +1
  if (Math.abs(predH - predA) === Math.abs(realH - realA)) points += 1;

  return points;
}

async function main() {
  console.log(`\n🏒 Scraper started: ${new Date().toLocaleString('cs-CZ')}`);

  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, home_team, away_team, match_date, status, hokej_cz_id')
    .neq('status', 'finished');

  if (error) { console.error('DB error:', error); process.exit(1); }
  if (!matches || matches.length === 0) {
    console.log('✅ Všechny zápasy jsou hotové.');
    process.exit(0);
  }

  const now = new Date();
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
      const result = parseResult(html);

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
