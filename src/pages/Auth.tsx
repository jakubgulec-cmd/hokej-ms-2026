import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const { signUp, signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password, username);
        setSuccessMsg('Registrace proběhla! Zkontroluj email a potvrď účet, pak se přihlaš.');
      } else {
        await signIn(email, password);
        navigate('/');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Nastala chyba';
      if (msg.includes('already registered')) setError('Tento email je již registrován.');
      else if (msg.includes('Invalid login')) setError('Špatný email nebo heslo.');
      else setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">🏒</div>
          <h1 className="text-3xl font-bold tracking-tight">Hokej MS 2026</h1>
          <p className="text-slate-400 mt-1">Unipi tipovačka zápasů</p>
        </div>

        <div className="bg-slate-800 rounded-xl border border-slate-700 p-8 shadow-2xl">
          <h2 className="text-xl font-semibold mb-6">
            {isSignUp ? 'Registrace' : 'Přihlášení'}
          </h2>

          {error && (
            <div className="bg-red-900/30 border border-red-700 text-red-400 text-sm p-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          {successMsg && (
            <div className="bg-green-900/30 border border-green-700 text-green-400 text-sm p-3 rounded-lg mb-4">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div>
                <label className="block text-sm text-slate-400 mb-1">Přezdívka</label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="honza_tipper"
                  required={isSignUp}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            )}

            <div>
              <label className="block text-sm text-slate-400 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="tvuj@email.cz"
                required
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-400 mb-1">Heslo</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition mt-2"
            >
              {loading ? 'Moment...' : isSignUp ? 'Registrovat se' : 'Přihlásit se'}
            </button>
          </form>

          <p className="text-center text-slate-400 text-sm mt-5">
            {isSignUp ? 'Už máš účet?' : 'Ještě nemáš účet?'}{' '}
            <button
              onClick={() => { setIsSignUp(!isSignUp); setError(''); setSuccessMsg(''); }}
              className="text-blue-400 hover:text-blue-300 transition"
            >
              {isSignUp ? 'Přihlásit se' : 'Registrovat se'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
