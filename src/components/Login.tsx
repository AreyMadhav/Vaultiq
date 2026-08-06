import { useState } from 'react';
import { Lock, FolderOpen, ArrowRight, Loader2 } from 'lucide-react';
import { api } from '../api';

export function Login({ onLogin }: { onLogin: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestMode, setRequestMode] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!username) throw new Error('Enter username');
      await api.login(username, password);
      onLogin();
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  async function requestAccess(e: React.FormEvent) {
    e.preventDefault();
    setRequestMessage('');
    setRequestLoading(true);
    try {
      if (!username) throw new Error('Enter username');
      await api.requestAccess(username, password);
      setRequestMessage('Request submitted — wait for admin approval');
      setRequestMode(false);
    } catch (err: any) {
      setRequestMessage(err.message || 'Request failed');
    } finally {
      setRequestLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 relative overflow-hidden">
      {/* ambient background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(56,189,248,0.08),_transparent_60%)]" />
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-sky-500/10 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-sky-500/20 mb-4">
            <FolderOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-white tracking-tight">Private Cloud</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to access your private files</p>
        </div>

        <form onSubmit={submit} className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <label className="block text-sm font-medium text-slate-300 mb-2">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your username"
            className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pl-4 pr-4 py-3 text-white placeholder-slate-500 mb-4 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
          />

          <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              placeholder="Enter password"
              className="w-full bg-slate-800/60 border border-slate-700 rounded-xl pl-10 pr-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition"
            />
          </div>

          

          {error && (
            <p className="mt-3 text-sm text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading || !password || !username}
            className="mt-5 w-full bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-3 rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-sky-500/20"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Unlock
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
        <div className="mt-3 text-center">
          <button
            onClick={() => setRequestMode((s) => !s)}
            className="text-sm text-slate-400 hover:text-white underline"
          >
            Request access
          </button>
        </div>

        {requestMode && (
          <form onSubmit={requestAccess} className="mt-4 bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-4 shadow-2xl">
            <p className="text-sm text-slate-400 mb-2">Request an account — an admin will approve it from the server terminal.</p>
            <button type="submit" disabled={requestLoading || !username || !password} className="w-full bg-slate-700 text-white py-2 rounded-lg">
              {requestLoading ? 'Submitting…' : 'Submit request'}
            </button>
            {requestMessage && <p className="mt-2 text-xs text-slate-300">{requestMessage}</p>}
          </form>
        )}
        <p className="text-center text-xs text-slate-600 mt-4">
          Your files, served from your own machine.
        </p>
      </div>
    </div>
  );
}
