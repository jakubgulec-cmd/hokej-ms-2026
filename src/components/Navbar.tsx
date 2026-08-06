import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { signOut } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { to: '/', label: 'Zápasy' },
    { to: '/leaderboard', label: 'Výsledky' },
    { to: '/tipy', label: 'Tipy' },
    { to: '/tabulka', label: 'Tabulka' },
    { to: '/pravidla', label: 'Pravidla' },
  ];

  return (
    <nav className="bg-slate-950/80 backdrop-blur-lg border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-2">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg shrink-0 text-white">
          <span>🏒</span>
          <span className="hidden sm:inline">Hokej MS 2026</span>
        </Link>

        <div className="flex items-center gap-1 overflow-x-auto">
          {navItems.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition whitespace-nowrap ${
                isActive(item.to)
                  ? 'bg-sky-400/15 text-sky-300'
                  : 'text-slate-300 hover:text-white hover:bg-white/5'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>

        <button
          onClick={signOut}
          className="text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-200 transition shrink-0"
        >
          Odhlásit
        </button>
      </div>
    </nav>
  );
}
