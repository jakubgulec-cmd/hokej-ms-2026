import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="bg-slate-800 border-b border-slate-700 sticky top-0 z-50">
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-lg">
          <span>🏒</span>
          <span className="hidden sm:inline">Hokej MS 2026</span>
        </Link>

        <div className="flex items-center gap-1">
          <Link
            to="/"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              isActive('/') ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Zápasy
          </Link>
          <Link
            to="/leaderboard"
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
              isActive('/leaderboard') ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Leaderboard
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 hidden sm:inline truncate max-w-[120px]">
            {user?.email}
          </span>
          <button
            onClick={signOut}
            className="text-xs px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 transition"
          >
            Odhlásit
          </button>
        </div>
      </div>
    </nav>
  );
}
