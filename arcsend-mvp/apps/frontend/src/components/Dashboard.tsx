import { useEffect, useRef } from 'react';
import BridgingMethods from './BridgingMethods';
import ChainsSection from './ChainsSection';
import FAQSection from './FAQSection';
import Footer from './Footer';
import HeroSection from './HeroSection';
import Login from './auth/Login';
import BalanceCard from './wallet/BalanceCard';
import LiquiditySurfaceCard from './wallet/LiquiditySurfaceCard';
import PortfolioBalanceChart from './wallet/PortfolioBalanceChart';
import SendForm from './wallet/SendForm';
import TreasuryAutomationMonitorCard from './wallet/TreasuryAutomationMonitorCard';
import TreasuryRebalanceCard from './wallet/TreasuryRebalanceCard';
import TransactionList from './transactions/TransactionList';
import type { Chain, TransactionItem } from '../types';

export default function Dashboard({
  token,
  chains,
  transactions,
  transferTick,
  showConsole,
  launchTick,
  isAuthenticated,
  onLaunchApp,
  onCreateWallet,
  setTransactions,
  setMessage,
  onTransferSuccess
}: {
  token: string;
  chains: Chain[];
  transactions: TransactionItem[];
  transferTick: number;
  showConsole: boolean;
  launchTick: number;
  isAuthenticated: boolean;
  onLaunchApp: () => void;
  onCreateWallet: (chain: Chain) => Promise<void>;
  setTransactions: (value: TransactionItem[]) => void;
  setMessage: (value: string) => void;
  onTransferSuccess: () => Promise<void>;
}) {
  const consoleRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!showConsole || !consoleRef.current) {
      return;
    }

    requestAnimationFrame(() => {
      consoleRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [showConsole, launchTick]);

  return (
    <div>
      <HeroSection onLaunchApp={onLaunchApp} />
      <ChainsSection />
      <BridgingMethods />

      <section ref={consoleRef} className="bg-background px-6 pb-20">
        <div className="mx-auto max-w-6xl">
          {!showConsole && (
            <div className="rounded-2xl border border-border/50 bg-card p-8 text-center shadow-sm">
              <h2 className="font-display text-3xl font-bold text-foreground md:text-4xl">ArcSend Live Console</h2>
              <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">
                Click Launch App to create an account or login and start using cross-chain USDC transfers.
              </p>
              <button
                onClick={onLaunchApp}
                className="mt-6 rounded-full border border-primary/50 px-6 py-2 text-sm font-medium text-foreground transition hover:border-primary hover:text-primary"
              >
                Launch App
              </button>
            </div>
          )}

          {showConsole && !isAuthenticated && (
            <div className="rounded-2xl border border-border/50 bg-card p-2 shadow-sm">
              <Login embedded />
            </div>
          )}

          {showConsole && isAuthenticated && (
            <>
              <div className="mb-8 rounded-2xl border border-border/50 bg-card p-6">
                <h3 className="font-display text-xl font-semibold text-foreground">Wallet Setup</h3>
                <div className="mt-4 flex flex-wrap gap-3">
                  {chains.map((chain) => (
                    <button
                      key={chain}
                      onClick={() => void onCreateWallet(chain)}
                      className="rounded-full border border-border px-4 py-2 text-sm capitalize text-foreground transition hover:border-primary/60 hover:text-primary"
                    >
                      Init {chain} wallet
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <a
                    href="https://faucet.circle.com"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Circle Public Faucet
                  </a>
                  <a
                    href="https://console.circle.com/faucet"
                    target="_blank"
                    rel="noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Circle Console Faucet
                  </a>
                </div>
              </div>

              <h2 className="font-display mb-8 text-center text-3xl font-bold text-foreground md:text-4xl">
                ArcSend Live Console
              </h2>

              <div className="grid gap-6 md:grid-cols-2">
                <BalanceCard token={token} refreshTick={transferTick} />
                <PortfolioBalanceChart token={token} refreshTick={transferTick} />
              </div>

              <div className="mt-6">
                <LiquiditySurfaceCard token={token} refreshTick={transferTick} />
              </div>

              <div className="mt-6">
                <TreasuryRebalanceCard token={token} onExecuted={onTransferSuccess} />
              </div>

              <div className="mt-6">
                <TreasuryAutomationMonitorCard token={token} refreshTick={transferTick} />
              </div>

              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <SendForm token={token} onTransferSuccess={onTransferSuccess} />
                <TransactionList
                  token={token}
                  items={transactions}
                  setItems={setTransactions}
                  setMessage={setMessage}
                />
              </div>
            </>
          )}
        </div>
      </section>

      <FAQSection />
      <Footer />
    </div>
  );
}
