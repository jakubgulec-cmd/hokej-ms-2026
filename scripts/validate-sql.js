// Validace MIGRATION.sql
const fs = require('fs');
const path = require('path');

const sql = fs.readFileSync(path.join(__dirname, '..', 'MIGRATION.sql'), 'utf-8');

let passed = 0;
let failed = 0;

function assert(name, condition, detail = '') {
  if (condition) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`); }
}

console.log('━━━ SQL Migration validation ━━━');

// 1. Obsahuje DELETE před DROP COLUMN
const deleteBeforeDrop = sql.indexOf('DELETE FROM predictions') < sql.indexOf('DROP COLUMN') &&
                        sql.indexOf('DELETE FROM matches') < sql.indexOf('DROP COLUMN');
assert('DELETE je před DROP COLUMN', deleteBeforeDrop);

// 2. ADD COLUMN je před DROP COLUMN
const addBeforeDrop = sql.indexOf('ADD COLUMN home_team') < sql.indexOf('DROP COLUMN opponent');
assert('ADD nové sloupce je před DROP starých', addBeforeDrop);

// 3. RENAME je až po DROP starých
const renameAfterDrop = sql.indexOf('RENAME COLUMN home_goals_pred') > sql.indexOf('DROP COLUMN czech_goals');
assert('RENAME je až po DROP starých sloupců', renameAfterDrop);

// 4. NOT NULL až po RENAME
const notNullAfterRename = sql.indexOf('ALTER COLUMN home_goals SET NOT NULL') > sql.indexOf('RENAME COLUMN home_goals_pred');
assert('SET NOT NULL je až po RENAME', notNullAfterRename);

// 5. INSERT po všech ALTERech
const insertAfterAlter = sql.lastIndexOf('ALTER TABLE') < sql.indexOf('INSERT INTO matches');
assert('INSERT je až po všech ALTER', insertAfterAlter);

// 6. Spočti zápasy
const insertMatches = sql.match(/\('[^']+',\s+'[a-z]{2}',\s+'[^']+',\s+'[a-z]{2}',/g) || [];
assert(`Počet zápasů = 56 (28 sk. A + 28 sk. B)`, insertMatches.length === 56, `nalezeno ${insertMatches.length}`);

// 7. Žádné duplicitní hokej_cz_id
const ids = [...sql.matchAll(/, (\d{7}), '[AB]'\)/g)].map(m => m[1]);
const uniqueIds = new Set(ids);
assert(`hokej_cz_id jsou unikátní (${ids.length} → ${uniqueIds.size})`, ids.length === uniqueIds.size);

// 8. Datumy mají správný formát
const dateMatches = sql.match(/'\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\+\d{2}'/g) || [];
assert(`Datumy mají správný formát (${dateMatches.length} datumů)`, dateMatches.length === 56);

// 9. Všechny datumy jsou v roce 2026 v květnu (15-26)
const dateOk = dateMatches.every(d => /^'2026-05-(1[5-9]|2[0-6])/.test(d));
assert('Všechny datumy jsou 2026-05-15 až 2026-05-26', dateOk);

// 10. Country kódy jsou validní (2 znaky lowercase)
const codes = [...sql.matchAll(/'([a-z]{2})'/g)].map(m => m[1]);
const uniqueCodes = [...new Set(codes)];
const validCodes = ['cz', 'dk', 'si', 'se', 'it', 'sk', 'no', 'ca', 'us', 'fi', 'de', 'ch', 'lv', 'hu', 'at', 'gb'];
const allValid = uniqueCodes.every(c => validCodes.includes(c));
assert(`Country kódy validní (${uniqueCodes.length} kódů)`, allValid, uniqueCodes.filter(c => !validCodes.includes(c)).join(','));

// 11. Group má jen 'A' nebo 'B'
const groups = [...sql.matchAll(/, '([AB])'\)[,;]/g)].map(m => m[1]);
const groupsOk = groups.every(g => g === 'A' || g === 'B');
assert(`Skupina je jen A nebo B (${groups.length})`, groupsOk);

// 12. Skupina A a B obě mají 28 zápasů
const groupA = groups.filter(g => g === 'A').length;
const groupB = groups.filter(g => g === 'B').length;
assert(`Skupina A: 28 zápasů (${groupA})`, groupA === 28);
assert(`Skupina B: 28 zápasů (${groupB})`, groupB === 28);

// 13. České zápasy: Česko se musí v každém zápase vyskytovat 7krát
const czechMatches = (sql.match(/'Česko',\s+'cz'/g) || []).length + (sql.match(/'Česko',\s+'cz'/g) || []).length;
// počet zápasů s "Česko" (jako home nebo away)
const lines = sql.split('\n');
const czechMatchLines = lines.filter(l => l.includes("'Česko'") && l.includes('upcoming'));
assert(`Česko hraje 7x (počet zápasů s Českem)`, czechMatchLines.length === 7, `nalezeno ${czechMatchLines.length}`);

// 14. Existují flag soubory pro všechny country codes
const flagsDir = path.join(__dirname, '..', 'public', 'flags');
const missingFlags = uniqueCodes.filter(code => !fs.existsSync(path.join(flagsDir, `${code}.png`)));
assert(`Všechny vlajky existují ve public/flags/`, missingFlags.length === 0, missingFlags.join(','));

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`✅ Prošlo: ${passed}`);
console.log(`${failed > 0 ? '❌' : '✅'} Selhalo: ${failed}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
process.exit(failed > 0 ? 1 : 0);
