const https = require('https');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);

const STANDINGS_URL = 'https://www.hokej.cz/reprezentace/table/mistrovstvi-sveta-v-hokeji/15';

const COUNTRY_CODE = {
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

// Vyparsuje jednu tabulku z HTML
function parseTable(tableHtml) {
  const rows = [];
  const tbody = (tableHtml.match(/<tbody>([\s\S]*?)<\/tbody>/) || [])[1] || '';
  const trMatches = tbody.match(/<tr>[\s\S]*?<\/tr>/g) || [];

  for (const tr of trMatches) {
    // Vytáhni text z každého <td>
    const tds = [...tr.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(m =>
      m[1].replace(/<[^>]+>/g, '').trim()
    );
    if (tds.length < 21) continue;

    // Indexy sloupců (viz HTML struktura hokej.cz)
    const team = tds[1];
    rows.push({
      rank: parseInt(tds[0]),
      team,
      team_code: COUNTRY_CODE[team] || 'un',
      games: parseInt(tds[2]),       // Z
      wins: parseInt(tds[3]),        // V
      ot_wins: parseInt(tds[4]),     // VP
      ot_losses: parseInt(tds[5]),   // PP
      losses: parseInt(tds[6]),      // P
      score: tds[7],                 // Skóre "16:4"
      points: parseInt(tds[8]),      // B
      shots_per_game: parseFloat(tds[9]),  // SB
      pp_pct: parseFloat(tds[13]),   // VPř (využití přesilovek %)
      pk_pct: parseFloat(tds[16]),   // UOs (ubráněná oslabení %)
      penalty_min: parseInt(tds[20]),// T
    });
  }
  return rows;
}

async function main() {
  console.log(`\n📊 Standings scraper: ${new Date().toLocaleString('cs-CZ')}`);

  const html = await fetchUrl(STANDINGS_URL);

  // Rozdělit HTML na sekce podle <h2>MS 2026 – sk. X</h2>
  const groups = [];
  const sectionRegex = /<h2>MS 2026 – sk\. ([AB])<\/h2>\s*(<table class="table-soupiska">[\s\S]*?<\/table>)/g;
  let m;
  while ((m = sectionRegex.exec(html)) !== null) {
    groups.push({ group: m[1], table: m[2] });
  }

  if (groups.length === 0) {
    console.error('❌ Nenalezeny tabulky skupin');
    process.exit(1);
  }

  const allRows = [];
  for (const g of groups) {
    const rows = parseTable(g.table).map(r => ({ ...r, group_name: g.group }));
    console.log(`   Skupina ${g.group}: ${rows.length} týmů`);
    allRows.push(...rows);
  }

  if (allRows.length === 0) {
    console.error('❌ Žádné řádky neparsovány');
    process.exit(1);
  }

  // Smaž staré a vlož nové (upsert podle group+team)
  const { error: delError } = await supabase.from('standings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  if (delError) { console.error('Delete error:', delError); }

  const { error: insError } = await supabase.from('standings').insert(
    allRows.map(r => ({
      group_name: r.group_name, rank: r.rank, team: r.team, team_code: r.team_code,
      games: r.games, wins: r.wins, ot_wins: r.ot_wins, ot_losses: r.ot_losses,
      losses: r.losses, score: r.score, points: r.points,
      shots_per_game: r.shots_per_game, pp_pct: r.pp_pct, pk_pct: r.pk_pct,
      penalty_min: r.penalty_min,
    }))
  );

  if (insError) { console.error('Insert error:', insError); process.exit(1); }

  console.log(`✅ Uloženo ${allRows.length} řádků`);
  process.exit(0);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
