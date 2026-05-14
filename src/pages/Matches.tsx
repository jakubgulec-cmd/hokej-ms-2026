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

function Flag({ code, size = 56 }: { code: string; size?: number }) {
  return (
    <img
      src={`${process.env.PUBLIC_URL}/flags/${code}.png`}
      alt={code}
      style={{
        width: size,
        height: Math.round(size * 0.67),
        objectFit: 'cover',
        borderRadius: 6,
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
      }}
    />
  );
}

function getPointsLabel(pred: Prediction, match: Match) {
  const p = pred.points;
  const isExact = pred.czech_goals === match.czech_goals && pred.opponent_goals === match.opponent_goals;
  if (isExact) return { text: 'Přesný tip', sub: '+3 body', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-700/50' };
  if (p === 3) return { text: 'Správný výsledek + rozdíl', sub: '+3 body', color: 'text-green-400', bg: 'bg-green-500/10 border-green-700/50' };
  if (p === 2) return { text: 'Správný výsledek', sub: '+2 body', color: 'text-green-400', bg: 'bg-green-500/10 border-green-700/50' };
  if (p === 1) return { text: 'Správný rozdíl', sub: '+1 bod', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-700/50' };
  return { text: 'Bez bodů', sub: '0 bodů', color: 'text-slate-500', bg: 'bg-slate-700/30 border-slate-700' };
}

function formatDate(date: Date) {
  const day = date.toLocaleDateString('cs-CZ', { weekday: 'short' });
  const dayCap = day.charAt(0).toUpperCase() + day.slice(1).replace('.', '');
  const rest = date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' });
  const time = date.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' });
  return `${dayCap} ${rest} • ${time}`;
}

export default function Matches() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [inputs, setInputs] = useState<Record<string, { cz: string; opp: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
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
    if (!inp || inp.cz === '' || inp.opp === '') {
      alert('Vyplň oba tipy');
      return;
    }

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
      if (!error) {
        setPredictions(prev => ({ ...prev, [matchId]: { ...existing, czech_goals: cz, opponent_goals: opp } }));
      }
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

    setSaving(null);
    if (!error) {
      setSavedFlash(matchId);
      setTimeout(() => setSavedFlash(null), 1500);
    } else {
      alert('Chyba při ukládání: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-slate-400">Načítám zápasy...</div>
      </div>
    );
  }

  // Sumarizace pro horní panel
  const upcomingCount = matches.filter(m => m.status === 'upcoming' && !isLocked(m.match_date)).length;
  const finishedCount = matches.filter(m => m.status === 'finished').length;
  const myPoints = Object.values(predictions).reduce((sum, p) => sum + (p.points || 0), 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Souhrn nahoře */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-3 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">K tipování</p>
          <p className="text-2xl font-bold">{upcomingCount}</p>
        </div>
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-3 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Odehráno</p>
          <p className="text-2xl font-bold">{finishedCount}</p>
        </div>
        <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg px-3 py-3 text-center">
          <p className="text-xs text-blue-300 uppercase tracking-wider mb-1">Tvé body</p>
          <p className="text-2xl font-bold text-blue-300">{myPoints}</p>
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-4">Zápasy MS</h1>

      <div className="space-y-4">
        {matches.map(match => {
          const pred = predictions[match.id];
          const locked = isLocked(match.match_date);
          const finished = match.status === 'finished';
          const live = match.status === 'ongoing' && match.live_czech_goals !== null;
          const inp = inputs[match.id] || { cz: '', opp: '' };
          const date = new Date(match.match_date);
          const oppCode = COUNTRY_CODE[match.opponent] || 'un';

          // Status badge
          let statusBadge = null;
          if (finished) {
            statusBadge = (
              <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Skončil</span>
            );
          } else if (live) {
            statusBadge = (
              <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-red-400">
                <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                Live
              </span>
            );
          } else if (locked) {
            statusBadge = (
              <span className="text-[10px] font-bold tracking-widest uppercase text-amber-400">Zamčeno</span>
            );
          }

          return (
            <div
              key={match.id}
              className={`bg-slate-800 border rounded-2xl overflow-hidden transition ${
                finished ? 'border-slate-700' : live ? 'border-red-800/60' : 'border-slate-700 hover:border-slate-600'
              }`}
            >
              {/* TOP BAR — datum vlevo, status vpravo */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/60 bg-slate-800/50">
                <p className="text-xs font-medium text-slate-400">
                  {formatDate(date)}
                </p>
                {statusBadge}
              </div>

              {/* TÝMY */}
              <div className="px-5 pt-5 pb-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Flag code="cz" size={52} />
                    <span className="font-bold text-base truncate">Česko</span>
                  </div>
                  <span className="text-slate-500 text-sm font-light px-2">vs</span>
                  <div className="flex items-center gap-3 flex-1 min-w-0 justify-end">
                    <span className="font-bold text-base truncate">{match.opponent}</span>
                    <Flag code={oppCode} size={52} />
                  </div>
                </div>
              </div>

              {/* OBSAH PODLE STAVU */}
              <div className="px-5 pb-5">
                {finished && (
                  <>
                    <div className="bg-slate-900/60 border border-slate-700/50 rounded-xl py-4 mb-3">
                      <p className="text-[10px] uppercase tracking-widest text-slate-500 text-center mb-1">Konečný výsledek</p>
                      <p className="text-4xl font-bold tracking-wider text-center">
                        {match.czech_goals} <span className="text-slate-500 font-light">:</span> {match.opponent_goals}
                      </p>
                    </div>
                    {pred ? (
                      <div className={`rounded-xl border px-4 py-3 ${getPointsLabel(pred, match).bg}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-0.5">Tvůj tip</p>
                            <p className="font-bold text-lg">{pred.czech_goals} : {pred.opponent_goals}</p>
                          </div>
                          <div className="text-right">
                            <p className={`text-xs font-medium ${getPointsLabel(pred, match).color}`}>
                              {getPointsLabel(pred, match).text}
                            </p>
                            <p className={`font-bold text-xl ${getPointsLabel(pred, match).color}`}>
                              {getPointsLabel(pred, match).sub}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 text-center py-2">Tip jsi nevyplnil</p>
                    )}
                  </>
                )}

                {live && (
                  <>
                    <div className="bg-red-950/40 border border-red-900/60 rounded-xl py-4 mb-3">
                      <p className="text-[10px] uppercase tracking-widest text-red-400 text-center mb-1 flex items-center justify-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                        Průběžné skóre
                      </p>
                      <p className="text-4xl font-bold tracking-wider text-center">
                        {match.live_czech_goals} <span className="text-slate-500 font-light">:</span> {match.live_opponent_goals}
                      </p>
                    </div>
                    {pred && (
                      <div className="bg-slate-700/30 border border-slate-700/50 rounded-xl px-4 py-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-400">Tvůj tip</span>
                          <span className="font-bold">{pred.czech_goals} : {pred.opponent_goals}</span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {!finished && !live && (
                  <div>
                    {locked && (
                      <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-950/30 border border-amber-900/50 rounded-lg px-3 py-2 mb-3">
                        <span>🔒</span>
                        <span>Tipy jsou uzamčeny — zápas už začal</span>
                      </div>
                    )}

                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={inp.cz}
                          onChange={e => setInputs(prev => ({ ...prev, [match.id]: { ...inp, cz: e.target.value } }))}
                          disabled={locked}
                          placeholder="—"
                          className="w-full bg-slate-900/60 border border-slate-700 hover:border-slate-600 rounded-xl px-3 py-3.5 text-white text-center text-2xl font-bold placeholder-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        />
                      </div>

                      <span className="text-slate-500 text-2xl font-light pb-3">:</span>

                      <div className="flex-1">
                        <input
                          type="number"
                          min="0"
                          max="20"
                          value={inp.opp}
                          onChange={e => setInputs(prev => ({ ...prev, [match.id]: { ...inp, opp: e.target.value } }))}
                          disabled={locked}
                          placeholder="—"
                          className="w-full bg-slate-900/60 border border-slate-700 hover:border-slate-600 rounded-xl px-3 py-3.5 text-white text-center text-2xl font-bold placeholder-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
                        />
                      </div>

                      <button
                        onClick={() => handleSave(match.id)}
                        disabled={locked || saving === match.id}
                        className={`px-5 py-3.5 font-semibold rounded-xl transition text-sm whitespace-nowrap ${
                          savedFlash === match.id
                            ? 'bg-green-600 text-white'
                            : 'bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white'
                        }`}
                      >
                        {savedFlash === match.id ? '✓ Uloženo' : saving === match.id ? '...' : pred ? 'Změnit tip' : 'Tipuj'}
                      </button>
                    </div>

                    {pred && (
                      <p className="text-xs text-slate-500 mt-2">
                        Aktuální tip: <span className="text-slate-300 font-medium">{pred.czech_goals} : {pred.opponent_goals}</span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
