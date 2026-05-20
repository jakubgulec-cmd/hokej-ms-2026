import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface Standing {
  group_name: string;
  rank: number;
  team: string;
  team_code: string;
  games: number;
  wins: number;
  ot_wins: number;
  ot_losses: number;
  losses: number;
  score: string;
  points: number;
  shots_per_game: number;
  pp_pct: number;
  pk_pct: number;
  penalty_min: number;
}

function Flag({ code }: { code: string }) {
  return (
    <img
      src={`${process.env.PUBLIC_URL}/flags/${code}.png`}
      alt={code}
      style={{ width: 24, height: 16, objectFit: 'cover', borderRadius: 2, flexShrink: 0 }}
    />
  );
}

const COLS: { key: keyof Standing; label: string; title: string }[] = [
  { key: 'games', label: 'Zápasy', title: 'Zápasy' },
  { key: 'wins', label: 'Výhry', title: 'Výhry' },
  { key: 'ot_wins', label: 'Výhry v prodloužení', title: 'Výhry v prodloužení' },
  { key: 'ot_losses', label: 'Prohry v prodloužení', title: 'Prohry v prodloužení' },
  { key: 'losses', label: 'Prohry', title: 'Prohry' },
  { key: 'score', label: 'Skóre', title: 'Celkové skóre' },
  { key: 'points', label: 'Body', title: 'Body' },
  { key: 'shots_per_game', label: 'Střely', title: 'Průměr střel na branku za zápas' },
  { key: 'pp_pct', label: 'Proměněné přesilovky', title: 'Využití přesilovek [%]' },
  { key: 'pk_pct', label: 'Ubráněná oslabení', title: 'Ubráněná oslabení [%]' },
  { key: 'penalty_min', label: 'Trestné minuty', title: 'Trestné minuty' },
];

function GroupTable({ group, rows }: { group: string; rows: Standing[] }) {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-bold mb-3">Skupina {group}</h2>
      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-700/60 text-slate-400">
              <th className="px-2 py-2.5 text-left font-medium">#</th>
              <th className="px-2 py-2.5 text-left font-medium">Tým</th>
              {COLS.map(c => (
                <th key={c.key} className="px-2 py-2.5 text-center font-medium whitespace-nowrap" title={c.title}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {rows.map(r => {
              const isCzech = r.team_code === 'cz';
              return (
                <tr key={r.team} className={isCzech ? 'bg-blue-900/20' : 'hover:bg-slate-700/30'}>
                  <td className="px-2 py-2.5 text-slate-500">{r.rank}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-2">
                      <Flag code={r.team_code} />
                      <span className={`font-medium whitespace-nowrap ${isCzech ? 'text-blue-400' : ''}`}>
                        {r.team}
                      </span>
                    </div>
                  </td>
                  {COLS.map(c => (
                    <td
                      key={c.key}
                      className={`px-2 py-2.5 text-center whitespace-nowrap tabular-nums ${
                        c.key === 'points' ? 'font-bold' : 'text-slate-300'
                      }`}
                    >
                      {r[c.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Standings() {
  const [rows, setRows] = useState<Standing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('standings')
        .select('*')
        .order('group_name', { ascending: true })
        .order('rank', { ascending: true });
      setRows(data || []);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-slate-400">Načítám tabulku...</div>
      </div>
    );
  }

  const groupA = rows.filter(r => r.group_name === 'A');
  const groupB = rows.filter(r => r.group_name === 'B');

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-2">Tabulka skupin</h1>
      <p className="text-sm text-slate-400 mb-6">Aktualizuje se každý den ve 3:00. Zdroj: hokej.cz</p>

      {rows.length === 0 ? (
        <p className="text-center text-slate-500 py-12">Tabulka zatím není k dispozici</p>
      ) : (
        <>
          <GroupTable group="B" rows={groupB} />
          <GroupTable group="A" rows={groupA} />
        </>
      )}
    </div>
  );
}
