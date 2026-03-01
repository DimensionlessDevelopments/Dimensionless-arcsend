import React, { useState, type FormEvent } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function Login({ embedded = false }: { embedded?: boolean }) {
  const { login, loginWithWallet, signup, message, clearMessage } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessage();
    setIsLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await signup(email, password);
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function onWalletLogin() {
    clearMessage();
    setIsLoading(true);
    try {
      await loginWithWallet();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={embedded ? 'flex items-center justify-center px-6 py-10' : 'flex min-h-screen items-center justify-center bg-[#04143a] px-6 py-10'}>
      <div className="w-full max-w-md rounded-2xl bg-[#04143a] p-8 text-slate-100 shadow-2xl">
        <h2 className="text-2xl font-semibold">{mode === 'login' ? 'Welcome to ArcSend' : 'Create your ArcSend account'}</h2>
        <p className="mt-2 text-sm text-slate-300">
          {mode === 'login'
            ? 'Sign in to manage cross-chain USDC from one dashboard.'
            : 'Get started with chain-abstracted USDC flows in minutes.'}
        </p>

        <form onSubmit={onSubmit} className="mt-6 grid gap-3">
          <label htmlFor="email" className="text-sm font-medium text-slate-300">Email Address</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            placeholder="you@example.com"
            className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-teal-400"
          />

          <label htmlFor="password" className="mt-2 text-sm font-medium text-slate-300">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            placeholder="••••••••"
            className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-slate-100 outline-none focus:border-teal-400"
          />

          <button
            type="submit"
            disabled={isLoading}
            className="mt-3 rounded-lg bg-teal-500 px-4 py-2 font-medium text-slate-900 hover:bg-teal-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading
              ? mode === 'login'
                ? 'Signing in...'
                : 'Creating account...'
              : mode === 'login'
                ? 'Continue'
                : 'Create account'}
          </button>

          <button
            type="button"
            onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
            disabled={isLoading}
            className="rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {mode === 'login' ? 'Need an account? Sign up' : 'Already have an account? Login'}
          </button>

          <div className="my-1 flex items-center gap-3 text-xs text-slate-500">
            <span className="h-px flex-1 bg-slate-700" />
            <span>OR</span>
            <span className="h-px flex-1 bg-slate-700" />
          </div>

          <button
            type="button"
            onClick={onWalletLogin}
            disabled={isLoading}
            className="rounded-lg border border-teal-500/60 px-4 py-2 text-sm font-medium text-teal-200 hover:bg-teal-500/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Connecting wallet...' : 'Connect MetaMask'}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-400">By continuing, you agree to use this demo responsibly.</p>
        {message && <p className="mt-2 text-sm text-slate-300">{message}</p>}

        </div>
    </div>
  );
}
