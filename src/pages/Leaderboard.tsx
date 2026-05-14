import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Row {
  id: string;
  username: string;
  total_points: number;
  matches_predicted: number;
}

const MEDALS = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data } = await supabase
      .from('user_leaderboard')
      .select('*')
      .order('total_points', { ascending: false });
    setRows(data || []);
    setLoading(false);
  };

  useEffect(() => {
    load();

    const sub = supabase
      .channel('predictions-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, () => {
        load();
      })
      .subscribe();

    return () => { sub.unsubscribe(); };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-slate-400">Načítám tabulku...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Výsledky a pravidla</h1>

      <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-700/60 text-slate-400 text-sm">
              <th className="px-5 py-3 text-left font-medium">#</th>
              <th className="px-5 py-3 text-left font-medium">Jméno</th>
              <th className="px-5 py-3 text-right font-medium">Tipy</th>
              <th className="px-5 py-3 text-right font-medium">Body</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {rows.map((row, idx) => {
              const isMe = user?.id === row.id;
              return (
                <tr
                  key={row.id}
                  className={`transition ${isMe ? 'bg-blue-900/20' : 'hover:bg-slate-700/30'}`}
                >
                  <td className="px-5 py-4 text-lg">
                    {idx < 3 ? MEDALS[idx] : <span className="text-slate-500 text-sm">#{idx + 1}</span>}
                  </td>
                  <td className="px-5 py-4">
                    <span className={isMe ? 'text-blue-400 font-semibold' : ''}>{row.username}</span>
                    {isMe && <span className="text-xs text-slate-500 ml-2">(ty)</span>}
                  </td>
                  <td className="px-5 py-4 text-right text-slate-400 text-sm">
                    {row.matches_predicted}
                  </td>
                  <td className="px-5 py-4 text-right font-bold text-lg">
                    {row.total_points}
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-10 text-center text-slate-500">
                  Zatím žádné tipy
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-6 bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-400 mb-3">Bodování</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Přesný tip (např. 4:2 → 4:2)</span>
            <span className="text-yellow-400 font-bold">+3 body</span>
          </div>
          <div className="flex justify-between">
            <span>Správný výsledek (výhra / prohra)</span>
            <span className="text-green-400 font-bold">+2 body</span>
          </div>
          <div className="flex justify-between">
            <span>Správný rozdíl (např. 4:2 → 6:4)</span>
            <span className="text-blue-400 font-bold">+1 bod</span>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          V hokeji vždy jeden tým vyhraje (případně v prodloužení nebo nájezdech) — pravidla počítají s finálním výsledkem zápasu.
        </p>
      </div>
    </div>
  );
}
