import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Match {
  id: string;
  opponent: string;
  match_date: string;
  czech_goals: number | null;
  opponent_goals: number | null;
  live_czech_goals: number | null;
  live_opponent_goals: number | null;
  status: string;
}

interface Prediction {
  id: string;
  match_id: string;
  czech_goals: number;
  opponent_goals: number;
  points: number;
  locked: boolean;
}

const COUNTRY_CODE: Record<string, string> = {
  'Dánsko': 'dk',
  'Slovinsko': 'si',
  'Švédsko': 'se',
  'Itálie': 'it',
  'Slovensko': 'sk',
  'Norsko': 'no',
  'Kanada': 'ca',
  'Švédsko-test': 'se',
};

function Flag({ code }: { code: string }) {
  return (
    <span
      className={`fi fi-${code}`}
      style={{ width: 48, height: 32, display: 'inline-block', borderRadius: 4 }}
    />
  );
}

function getPointsLabel(pred: Prediction, match: Match) {
  const p = pred.points;
  const isExact = pred.czech_goals === match.czech_goals && pred.opponent_goals === match.opponent_goals;
  if (isExact) return { text: 'Přesný tip! +3 body', color: 'text-yellow-400' };
  if (p === 3) return { text: 'Správný výsledek + rozdíl +3 body', color: 'text-green-400' };
  if (p === 2) return { text: 'Správný výsledek +2 body', color: 'text-green-400' };
  if (p === 1) return { text: 'Správný rozdíl +1 bod', color: 'text-blue-400' };
  return { text: '0 bodů', color: 'text-slate-500' };
}

export default function Matches() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [inputs, setInputs] = useState<Record<string, { cz: string; opp: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const [{ data: matchData }, { data: predData }] = await Promise.all([
        supabase.from('matches').select('*').order('match_date', { ascending: true }),
        supabase.from('predictions').select('*').eq('user_id', user.id),
      ]);

      setMatches(matchData || []);

      const predMap: Record<string, Prediction> = {};
      predData?.forEach(p => { predMap[p.match_id] = p; });
      setPredictions(predMap);

      const initInputs: Record<string, { cz: string; opp: string }> = {};
      predData?.forEach(p => {
        initInputs[p.match_id] = { cz: String(p.czech_goals), opp: String(p.opponent_goals) };
      });
      setInputs(initInputs);

      setLoading(false);
    };

    load();

    const sub = supabase
      .channel('matches-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'matches' }, payload => {
        setMatches(prev => prev.map(m => m.id === payload.new.id ? payload.new as Match : m));
      })
      .subscribe();

    return () => { sub.unsubscribe(); };
  }, [user]);

  const isLocked = (matchDate: string) => new Date(matchDate) <= new Date();

  const handleSave = async (matchId: string) => {
    if (!user) return;
    const inp = inputs[matchId];
    if (!inp) return;

    const cz = parseInt(inp.cz);
    const opp = parseInt(inp.opp);

    if (isNaN(cz) || isNaN(opp) || cz < 0 || opp < 0) {
      alert('Zadej platné číslo (0 nebo více)');
      return;
    }

    setSaving(matchId);

    const existing = predictions[matchId];
    let error;

    if (existing) {
      ({ error } = await supabase
        .from('predictions')
        .update({ czech_goals: cz, opponent_goals: opp })
        .eq('id', existing.id));
    } else {
      const { data, error: insertError } = await supabase
        .from('predictions')
        .insert({ user_id: user.id, match_id: matchId, czech_goals: cz, opponent_goals: opp })
        .select()
        .single();
      error = insertError;
      if (!error && data) {
        setPredictions(prev => ({ ...prev, [matchId]: data }));
      }
    }

    if (!error && existing) {
      setPredictions(prev => ({ ...prev, [matchId]: { ...existing, czech_goals: cz, opponent_goals: opp } }));
    }

    setSaving(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-slate-400">Načítám zápasy...</div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Zápasy</h1>

      <div className="space-y-3">
        {matches.map(match => {
          const pred = predictions[match.id];
          const locked = isLocked(match.match_date);
          const finished = match.status === 'finished';
          const inp = inputs[match.id] || { cz: '', opp: '' };
          const date = new Date(match.match_date);
          const oppCode = COUNTRY_CODE[match.opponent] || 'un';

          return (
            <div
              key={match.id}
              className="bg-slate-800 border border-slate-700 rounded-xl p-5"
            >
              {/* Hlavička zápasu */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 flex-1">
                  <Flag code="cz" size={48} />
                  <span className="font-semibold text-sm">Česko</span>
                </div>

                <div className="flex flex-col items-center px-3">
                  <span className="text-slate-500 text-xs font-medium">vs</span>
                  <p className="text-xs text-slate-400 mt-1">
                    {date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })}
                  </p>
                  <p className="text-xs text-slate-400">
                    {date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="flex items-center gap-3 flex-1 justify-end">
                  <span className="font-semibold text-sm">{match.opponent}</span>
                  <Flag code={oppCode} size={48} />
                </div>
              </div>

              {/* Výsledek nebo input */}
              {match.status === 'ongoing' && match.live_czech_goals !== null && (
                <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-center mb-3">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    <span className="text-xs text-red-400 font-semibold tracking-widest uppercase">Live</span>
                  </div>
                  <p className="text-3xl font-bold tracking-widest">
                    {match.live_czech_goals} : {match.live_opponent_goals}
                  </p>
                </div>
              )}

              {finished ? (
                <div className="space-y-3">
                  <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                    <p className="text-xs text-slate-400 mb-1">Výsledek</p>
                    <p className="text-3xl font-bold tracking-widest">
                      {match.czech_goals} : {match.opponent_goals}
                    </p>
                  </div>
                  {pred && (
                    <div className="flex items-center justify-between bg-slate-700/30 rounded-lg px-4 py-3">
                      <div>
                        <p className="text-xs text-slate-400 mb-0.5">Tvůj tip</p>
                        <p className="font-semibold">{pred.czech_goals} : {pred.opponent_goals}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold text-lg ${getPointsLabel(pred, match).color}`}>
                          {getPointsLabel(pred, match).text}
                        </p>
                      </div>
                    </div>
                  )}
                  {!pred && (
                    <p className="text-sm text-slate-500 text-center">Tip jsi nevyplnil</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {locked && (
                    <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-900/20 border border-amber-800 rounded-lg px-3 py-2">
                      <span>🔒</span>
                      <span>Zápas začal — tipy jsou uzamčeny</span>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <label className="block text-xs text-slate-400 mb-1">Česko</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={inp.cz}
                        onChange={e => setInputs(prev => ({ ...prev, [match.id]: { ...inp, cz: e.target.value } }))}
                        disabled={locked}
                        placeholder="0"
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-center text-xl font-bold placeholder-slate-600 focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      />
                    </div>

                    <span className="text-slate-400 text-2xl font-light mt-5">:</span>

                    <div className="flex-1">
                      <label className="block text-xs text-slate-400 mb-1">{match.opponent}</label>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={inp.opp}
                        onChange={e => setInputs(prev => ({ ...prev, [match.id]: { ...inp, opp: e.target.value } }))}
                        disabled={locked}
                        placeholder="0"
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-center text-xl font-bold placeholder-slate-600 focus:outline-none focus:border-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition"
                      />
                    </div>

                    <div className="mt-5">
                      <button
                        onClick={() => handleSave(match.id)}
                        disabled={locked || saving === match.id}
                        className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition text-sm"
                      >
                        {saving === match.id ? '...' : pred ? 'Uložit' : 'Tipuj'}
                      </button>
                    </div>
                  </div>

                  {pred && !locked && (
                    <p className="text-xs text-slate-500">
                      Uložený tip: {pred.czech_goals}:{pred.opponent_goals}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
