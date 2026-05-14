import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Match {
  id: string;
  home_team: string;
  home_code: string;
  away_team: string;
  away_code: string;
  match_date: string;
  home_goals: number | null;
  away_goals: number | null;
  live_home_goals: number | null;
  live_away_goals: number | null;
  status: string;
  group: string | null;
}

interface Prediction {
  id: string;
  match_id: string;
  home_goals: number;
  away_goals: number;
  points: number;
  locked: boolean;
}

function Flag({ code, size = 52 }: { code: string; size?: number }) {
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
        flexShrink: 0,
      }}
    />
  );
}

function getPointsLabel(pred: Prediction, match: Match) {
  const p = pred.points;
  const isExact = pred.home_goals === match.home_goals && pred.away_goals === match.away_goals;
  if (isExact) return { text: 'Přesný tip', sub: '+3 body', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-700/50' };
  if (p === 3) return { text: 'Výsledek + rozdíl', sub: '+3 body', color: 'text-green-400', bg: 'bg-green-500/10 border-green-700/50' };
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

type FilterType = 'all' | 'cz' | 'upcoming' | 'finished';

export default function Matches() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [predictions, setPredictions] = useState<Record<string, Prediction>>({});
  const [inputs, setInputs] = useState<Record<string, { h: string; a: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('cz');

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

      const initInputs: Record<string, { h: string; a: string }> = {};
      predData?.forEach(p => {
        initInputs[p.match_id] = { h: String(p.home_goals), a: String(p.away_goals) };
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
    if (!inp || inp.h === '' || inp.a === '') {
      alert('Vyplň oba tipy');
      return;
    }

    const h = parseInt(inp.h);
    const a = parseInt(inp.a);

    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      alert('Zadej platné číslo (0 nebo více)');
      return;
    }

    if (h === a) {
      alert('V hokeji nemůže skončit zápas remízou — vždy jeden tým vyhraje (v prodloužení nebo nájezdech).');
      return;
    }

    setSaving(matchId);

    const existing = predictions[matchId];
    let error;

    if (existing) {
      ({ error } = await supabase
        .from('predictions')
        .update({ home_goals: h, away_goals: a })
        .eq('id', existing.id));
      if (!error) {
        setPredictions(prev => ({ ...prev, [matchId]: { ...existing, home_goals: h, away_goals: a } }));
      }
    } else {
      const { data, error: insertError } = await supabase
        .from('predictions')
        .insert({ user_id: user.id, match_id: matchId, home_goals: h, away_goals: a })
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

  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
      if (filter === 'cz') return m.home_code === 'cz' || m.away_code === 'cz';
      if (filter === 'upcoming') return m.status === 'upcoming' && !isLocked(m.match_date);
      if (filter === 'finished') return m.status === 'finished';
      return true;
    });
  }, [matches, filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-slate-400">Načítám zápasy...</div>
      </div>
    );
  }

  // Souhrn
  const tippableCount = matches.filter(m => m.status === 'upcoming' && !isLocked(m.match_date)).length;
  const finishedCount = matches.filter(m => m.status === 'finished').length;
  const myPoints = Object.values(predictions).reduce((sum, p) => sum + (p.points || 0), 0);

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Souhrn */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-3 text-center">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">K tipování</p>
          <p className="text-2xl font-bold">{tippableCount}</p>
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

      {/* Filtry */}
      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
        {[
          { id: 'cz' as FilterType, label: 'Česko' },
          { id: 'all' as FilterType, label: 'Vše' },
          { id: 'upcoming' as FilterType, label: 'K tipování' },
          { id: 'finished' as FilterType, label: 'Odehráno' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition whitespace-nowrap ${
              filter === f.id
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {filteredMatches.length === 0 && (
          <p className="text-center text-slate-500 py-12">Žádné zápasy v této kategorii</p>
        )}

        {filteredMatches.map(match => {
          const pred = predictions[match.id];
          const locked = isLocked(match.match_date);
          const finished = match.status === 'finished';
          const live = match.status === 'ongoing' && match.live_home_goals !== null;
          const inp = inputs[match.id] || { h: '', a: '' };
          const date = new Date(match.match_date);

          // Status badge
          let statusBadge = null;
          if (finished) {
            statusBadge = <span className="text-[10px] font-bold tracking-widest uppercase text-slate-500">Skončil</span>;
          } else if (live) {
            statusBadge = (
              <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-red-400">
                <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                Live
              </span>
            );
          } else if (locked) {
            statusBadge = <span className="text-[10px] font-bold tracking-widest uppercase text-amber-400">Zamčeno</span>;
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

              <div className="px-5 pt-5 pb-5">
                {/* Live alert NAHOŘE pro live zápasy */}
                {live && (
                  <div className="flex items-center justify-center gap-2 mb-3 text-[10px] uppercase tracking-widest text-red-400 font-bold">
                    <span className="inline-block w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                    Průběžné skóre
                  </div>
                )}

                {locked && !finished && !live && (
                  <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-950/30 border border-amber-900/50 rounded-lg px-3 py-2 mb-3">
                    <span>🔒</span>
                    <span>Tipy jsou uzamčeny — zápas už začal</span>
                  </div>
                )}

                {/* HLAVNÍ GRID: hlavičky / hodnoty / tlačítko */}
                <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start">
                  {/* Hlavička HOME (vlevo zarovnaná s inputem) */}
                  <div className="flex items-center gap-2 min-w-0">
                    <Flag code={match.home_code} size={48} />
                    <span className="font-bold text-sm truncate">{match.home_team}</span>
                  </div>

                  <div /> {/* mezera pro ":" */}

                  {/* Hlavička AWAY (vpravo zarovnaná s inputem) */}
                  <div className="flex items-center gap-2 min-w-0 justify-end">
                    <span className="font-bold text-sm truncate">{match.away_team}</span>
                    <Flag code={match.away_code} size={48} />
                  </div>

                  {/* HODNOTA HOME */}
                  {finished ? (
                    <div className="h-16 bg-slate-900/60 border border-slate-700/50 rounded-xl flex items-center justify-center">
                      <span className="text-3xl font-bold">{match.home_goals}</span>
                    </div>
                  ) : live ? (
                    <div className="h-16 bg-red-950/40 border border-red-900/60 rounded-xl flex items-center justify-center">
                      <span className="text-3xl font-bold">{match.live_home_goals}</span>
                    </div>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={inp.h}
                      onChange={e => setInputs(prev => ({ ...prev, [match.id]: { ...inp, h: e.target.value } }))}
                      disabled={locked}
                      placeholder="—"
                      className="h-16 w-full min-w-0 bg-slate-900/60 border border-slate-700 hover:border-slate-600 rounded-xl px-3 text-white text-center text-2xl font-bold placeholder-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    />
                  )}

                  {/* DVOJTEČKA — zarovnaná s inputy */}
                  <div className="h-16 flex items-center">
                    <span className="text-slate-500 text-2xl font-light">:</span>
                  </div>

                  {/* HODNOTA AWAY */}
                  {finished ? (
                    <div className="h-16 bg-slate-900/60 border border-slate-700/50 rounded-xl flex items-center justify-center">
                      <span className="text-3xl font-bold">{match.away_goals}</span>
                    </div>
                  ) : live ? (
                    <div className="h-16 bg-red-950/40 border border-red-900/60 rounded-xl flex items-center justify-center">
                      <span className="text-3xl font-bold">{match.live_away_goals}</span>
                    </div>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={inp.a}
                      onChange={e => setInputs(prev => ({ ...prev, [match.id]: { ...inp, a: e.target.value } }))}
                      disabled={locked}
                      placeholder="—"
                      className="h-16 w-full min-w-0 bg-slate-900/60 border border-slate-700 hover:border-slate-600 rounded-xl px-3 text-white text-center text-2xl font-bold placeholder-slate-700 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    />
                  )}

                  {/* TLAČÍTKO TIPUJ — pod prvním inputem, jen pro upcoming */}
                  {!finished && !live && (
                    <>
                      <button
                        onClick={() => handleSave(match.id)}
                        disabled={locked || saving === match.id}
                        className={`h-12 w-full font-semibold rounded-xl transition text-sm ${
                          savedFlash === match.id
                            ? 'bg-green-600 text-white'
                            : 'bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white'
                        }`}
                      >
                        {savedFlash === match.id ? '✓ Uloženo' : saving === match.id ? '...' : pred ? 'Změnit tip' : 'Tipuj'}
                      </button>
                      <div /> {/* prázdno pod dvojtečkou */}
                      <div /> {/* prázdno pod druhým inputem */}
                    </>
                  )}
                </div>

                {/* TVŮJ TIP — pro finished s body */}
                {finished && pred && (
                  <div className={`mt-3 rounded-xl border px-4 py-3 ${getPointsLabel(pred, match).bg}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-0.5">Tvůj tip</p>
                        <p className="font-bold text-lg">{pred.home_goals} : {pred.away_goals}</p>
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
                )}

                {finished && !pred && (
                  <p className="text-sm text-slate-500 text-center mt-3">Tip jsi nevyplnil</p>
                )}

                {/* TVŮJ TIP — pro live */}
                {live && pred && (
                  <div className="mt-3 bg-slate-700/30 border border-slate-700/50 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Tvůj tip</span>
                      <span className="font-bold">{pred.home_goals} : {pred.away_goals}</span>
                    </div>
                  </div>
                )}

                {/* Aktuální tip info pro upcoming */}
                {!finished && !live && pred && (
                  <p className="text-xs text-slate-500 mt-3">
                    Aktuální tip: <span className="text-slate-300 font-medium">{pred.home_goals} : {pred.away_goals}</span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
