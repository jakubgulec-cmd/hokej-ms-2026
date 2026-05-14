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

  // Zjisti jestli je Česko domácí nebo hostující tým
  const homeTeamMatch = html.match(/class="team-home"[\s\S]*?<h2 class="long">(.*?)<\/h2>/);
  const homeTeamName = homeTeamMatch ? homeTeamMatch[1].trim().toLowerCase() : '';
  const czechIsHome = homeTeamName.includes('česk') || homeTeamName.includes('czech');

  const homeScore = parseInt(homeMatch[1]);
  const visitScore = parseInt(visitMatch[1]);

  const czechGoals = czechIsHome ? homeScore : visitScore;
  const oppGoals = czechIsHome ? visitScore : homeScore;

  const statusText = statusMatch ? statusMatch[1].toLowerCase() : '';
  const isFinished = statusText === 'konec' || statusText === 'after so' || statusText === 'after pen';

  return { czechGoals, oppGoals, isFinished, statusText };
}

function calculatePoints(predCz, predOpp, realCz, realOpp) {
  // Přesný tip → +3
  if (predCz === realCz && predOpp === realOpp) return 3;

  let points = 0;

  // Správný výsledek zápasu → +2
  const predResult = predCz > predOpp ? 'W' : predCz < predOpp ? 'L' : 'D';
  const realResult = realCz > realOpp ? 'W' : realCz < realOpp ? 'L' : 'D';
  if (predResult === realResult) points += 2;

  // Správný rozdíl → +1
  if (Math.abs(predCz - predOpp) === Math.abs(realCz - realOpp)) points += 1;

  return points;
}

async function main() {
  console.log(`\n🏒 Scraper started: ${new Date().toLocaleString('cs-CZ')}`);

  // Načti zápasy které ještě nejsou hotové
  const { data: matches, error } = await supabase
    .from('matches')
    .select('id, opponent, match_date, status, hokej_cz_id')
    .neq('status', 'finished');

  if (error) { console.error('DB error:', error); process.exit(1); }
  if (!matches || matches.length === 0) {
    console.log('✅ Všechny zápasy jsou hotové.');
    process.exit(0);
  }

  const now = new Date();

  for (const match of matches) {
    const minutesElapsed = (now - new Date(match.match_date)) / 60000;
    console.log(`\n[${match.opponent}] Uplynulo: ${minutesElapsed.toFixed(0)} min`);

    if (minutesElapsed < MIN_WAIT_MINUTES) {
      const waitLeft = (MIN_WAIT_MINUTES - minutesElapsed).toFixed(0);
      console.log(`⏳ Čeká se ještě ${waitLeft} min`);
      continue;
    }

    if (!match.hokej_cz_id) {
      console.log(`⚠️  Chybí hokej_cz_id pro ${match.opponent}`);
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

      console.log(`📊 ${result.czechGoals}:${result.oppGoals} (${result.statusText || 'neznámý status'})`);

      const newStatus = result.isFinished ? 'finished' : 'ongoing';

      // Updatni zápas
      const { error: updateError } = await supabase
        .from('matches')
        .update({ czech_goals: result.czechGoals, opponent_goals: result.oppGoals, status: newStatus })
        .eq('id', match.id);

      if (updateError) { console.error('Update error:', updateError); continue; }

      // Pokud je zápas hotový, vypočítej body pro všechny tipy
      if (result.isFinished) {
        const { data: preds } = await supabase
          .from('predictions')
          .select('id, czech_goals, opponent_goals')
          .eq('match_id', match.id);

        if (preds && preds.length > 0) {
          for (const pred of preds) {
            const pts = calculatePoints(pred.czech_goals, pred.opponent_goals, result.czechGoals, result.oppGoals);
            await supabase
              .from('predictions')
              .update({ points: pts, locked: true })
              .eq('id', pred.id);
          }
          console.log(`✅ Body vypočítány pro ${preds.length} tipů`);
        }
      }

    } catch (err) {
      console.error(`❌ Chyba při scrapování ${match.opponent}:`, err.message);
    }

    // Rate limit mezi requesty
    await new Promise(r => setTimeout(r, 1000));
  }

  console.log(`\n✅ Scraper dokončen: ${new Date().toLocaleString('cs-CZ')}`);
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
