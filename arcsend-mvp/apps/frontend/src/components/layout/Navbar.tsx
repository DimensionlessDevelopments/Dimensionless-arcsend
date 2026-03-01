import React from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function Navbar({
  onLaunchApp,
  isAuthenticated
}: {
  onLaunchApp: () => void;
  isAuthenticated: boolean;
}) {
  const { user, logout } = useAuth();
  const userLabel = user?.walletAddress
    ? `${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}`
    : user?.email;

  return (
    <header className="sticky top-0 z-20 border-b border-[#11275e] bg-[#06153f] text-slate-200">
      <div className="mx-auto flex h-20 w-full max-w-6xl items-center justify-between px-6">
        <div className="leading-tight">
          <p className="text-3xl font-semibold tracking-tight text-teal-300">ArcSend</p>
          <p className="text-[11px] text-slate-400">By Circle x DimensionlessDevelopments MVP</p>
        </div>

        <nav className="hidden items-center gap-8 text-[15px] text-slate-300 md:flex">
         <a href="#supported-liquidity-surface" className="transition hover:text-white">Chains</a>
          <a href="#arcsend-core-methods" className="transition hover:text-white">About</a>
          <a href="#faqs" className="transition hover:text-white">FAQs</a>
        
        </nav>

        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-slate-400 lg:block">{userLabel}</span>
          <button
            onClick={onLaunchApp}
            className="rounded-full border border-slate-500 bg-transparent px-6 py-2 text-sm font-medium hover:border-slate-300 hover:text-white"
          >
            Launch App
          </button>
          {isAuthenticated && (
            <button
              onClick={logout}
              className="rounded-full border border-[#1b356f] bg-[#0b1f53] px-4 py-2 text-sm text-slate-200 hover:bg-[#122a68]"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
