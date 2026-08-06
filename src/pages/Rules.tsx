export default function Rules() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-6">Pravidla</h1>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Bodování — základní skupina</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span>Přesný tip (např. 4:2 → 4:2)</span>
            <span className="text-yellow-300 font-bold whitespace-nowrap">+3 body</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Správný výsledek + správný rozdíl<br /><span className="text-xs text-slate-400">(např. tip 4:2 → reálně 3:1)</span></span>
            <span className="text-sky-300 font-bold whitespace-nowrap">+2 body</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Pouze správný výsledek (výhra / prohra)</span>
            <span className="text-green-300 font-bold whitespace-nowrap">+1 bod</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Špatný výsledek</span>
            <span className="text-slate-400 font-bold whitespace-nowrap">0 bodů</span>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-5 leading-relaxed">
          V hokeji vždy jeden tým vyhraje (případně v prodloužení nebo nájezdech) — pravidla počítají s finálním výsledkem zápasu.
          Bod za rozdíl se započítá <strong>jen pokud trefíš správný výsledek</strong> — pokud měl podle tebe vyhrát opačný tým, dostaneš 0 bodů i v případě stejného rozdílu.
        </p>
      </div>

      <div className="bg-slate-900 border border-amber-400/30 rounded-2xl p-5 mt-4">
        <h2 className="text-sm font-semibold text-amber-300 uppercase tracking-wider mb-1">🏆 Playoff — zvýšené body</h2>
        <p className="text-xs text-slate-400 mb-4">Čtvrtfinále, semifinále, zápas o bronz, finále</p>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span>Přesný tip</span>
            <span className="text-yellow-300 font-bold whitespace-nowrap">+9 bodů</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Správný výsledek + správný rozdíl</span>
            <span className="text-sky-300 font-bold whitespace-nowrap">+4 body</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Pouze správný výsledek</span>
            <span className="text-green-300 font-bold whitespace-nowrap">+1 bod</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Špatný výsledek</span>
            <span className="text-slate-400 font-bold whitespace-nowrap">0 bodů</span>
          </div>
        </div>
      </div>
    </div>
  );
}
