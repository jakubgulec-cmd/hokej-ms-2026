import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Row {
  match_id: string;
  home_team: string;
  home_code: string;
  away_team: string;
  away_code: string;
  home_goals: number | null;
  away_goals: number | null;
  live_home_goals: number | null;
  live_away_goals: number | null;
  match_date: string;
  status: string;
  user_id: string;
  username: string;
  pred_home: number;
  pred_away: number;
  points: number;
}

interface MatchGroup {
  match_id: string;
  home_team: string;
  home_code: string;
  away_team: string;
  away_code: string;
  home_goals: number | null;
  away_goals: number | null;
  live_home_goals: number | null;
  live_away_goals: number | null;
  match_date: string;
  status: string;
  tips: { user_id: string; username: string; pred_home: number; pred_away: number; points: number }[];
}

function Flag({ code, size = 28 }: { code: string; size?: number }) {
  return (
    <img
      src={`${process.env.PUBLIC_URL}/flags/${code}.png`}
      alt={code}
      style={{ width: size, height: Math.round(size * 0.67), objectFit: 'cover', borderRadius: 3, flexShrink: 0 }}
    />
  );
}

function pointsBadge(points: number) {
  if (points === 3) return { text: '+3', color: 'text-yellow-400' };
  if (points === 2) return { text: '+2', color: 'text-blue-400' };
  if (points === 1) return { text: '+1', color: 'text-green-400' };
  return { text: '0', color: 'text-slate-600' };
}

function formatDate(date: Date) {
  const d = date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' });
  const t = date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  return `${d} • ${t}`;
}

export default function Predictions() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<MatchGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('match_predictions')
        .select('*');

      const rows = (data || []) as Row[];

      // Seskup podle zápasu
      const map = new Map<string, MatchGroup>();
      rows.forEach(r => {
        if (!map.has(r.match_id)) {
          map.set(r.match_id, {
            match_id: r.match_id,
            home_team: r.home_team, home_code: r.home_code,
            away_team: r.away_team, away_code: r.away_code,
            home_goals: r.home_goals, away_goals: r.away_goals,
            live_home_goals: r.live_home_goals, live_away_goals: r.live_away_goals,
            match_date: r.match_date, status: r.status,
            tips: [],
          });
        }
        map.get(r.match_id)!.tips.push({
          user_id: r.user_id, username: r.username,
          pred_home: r.pred_home, pred_away: r.pred_away, points: r.points,
        });
      });

      // Seřaď zápasy podle data (nejnovější první) a tipy podle bodů
      const sorted = Array.from(map.values()).sort(
        (a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime()
      );
      sorted.forEach(g => g.tips.sort((a, b) => b.points - a.points));

      setGroups(sorted);
      setLoading(false);
    };

    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-slate-400">Načítám tipy...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-2">Tipy hráčů</h1>
      <p className="text-sm text-slate-400 mb-6">Porovnání tipů všech hráčů. Tipy se odkryjí až po začátku zápasu.</p>

      {groups.length === 0 && (
        <p className="text-center text-slate-500 py-12">Zatím žádné začaté zápasy s tipy</p>
      )}

      <div className="space-y-4">
        {groups.map(g => {
          const finished = g.status === 'finished';
          const live = g.status === 'ongoing' && g.live_home_goals !== null;
          const score = finished
            ? `${g.home_goals} : ${g.away_goals}`
            : live
            ? `${g.live_home_goals} : ${g.live_away_goals}`
            : '– : –';

          return (
            <div key={g.match_id} className="bg-slate-800 border border-slate-700 rounded-2xl overflow-hidden">
              {/* Hlavička zápasu */}
              <div className="px-4 py-3 border-b border-slate-700/60 bg-slate-800/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">{formatDate(new Date(g.match_date))}</span>
                  {live && (
                    <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-red-400">
                      <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />Live
                    </span>
                  )}
                  {finished && <span className="text-[10px] font-bold uppercase text-slate-500">Skončil</span>}
                </div>
                <div className="flex items-center justify-center gap-3 mt-2">
                  <div className="flex items-center gap-2 flex-1 justify-end min-w-0">
                    <span className="font-semibold text-sm truncate">{g.home_team}</span>
                    <Flag code={g.home_code} />
                  </div>
                  <span className="font-bold text-lg px-2 whitespace-nowrap">{score}</span>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Flag code={g.away_code} />
                    <span className="font-semibold text-sm truncate">{g.away_team}</span>
                  </div>
                </div>
              </div>

              {/* Seznam tipů */}
              <div className="divide-y divide-slate-700/50">
                {g.tips.map(t => {
                  const isMe = user?.id === t.user_id;
                  const badge = pointsBadge(t.points);
                  return (
                    <div
                      key={t.user_id}
                      className={`flex items-center justify-between px-4 py-2.5 ${isMe ? 'bg-blue-900/20' : ''}`}
                    >
                      <span className={`text-sm ${isMe ? 'text-blue-400 font-semibold' : 'text-slate-300'}`}>
                        {t.username}{isMe && <span className="text-xs text-slate-500 ml-1">(ty)</span>}
                      </span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-slate-400 tabular-nums">
                          {t.pred_home}:{t.pred_away}
                        </span>
                        {finished && (
                          <span className={`text-sm font-bold w-8 text-right ${badge.color}`}>
                            {badge.text}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {g.tips.length === 0 && (
                  <p className="text-center text-xs text-slate-500 py-3">Nikdo netipoval</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
