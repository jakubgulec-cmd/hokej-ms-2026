export default function Rules() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Pravidla</h1>

      <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Bodování</h2>
        <div className="space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span>Přesný tip (např. 4:2 → 4:2)</span>
            <span className="text-yellow-400 font-bold whitespace-nowrap">+3 body</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Správný rozdíl (např. 4:2 → 6:4)</span>
            <span className="text-blue-400 font-bold whitespace-nowrap">+2 body</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Správný výsledek (výhra / prohra)</span>
            <span className="text-green-400 font-bold whitespace-nowrap">+1 bod</span>
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-5 leading-relaxed">
          V hokeji vždy jeden tým vyhraje (případně v prodloužení nebo nájezdech) — pravidla počítají s finálním výsledkem zápasu.
        </p>
      </div>
    </div>
  );
}
