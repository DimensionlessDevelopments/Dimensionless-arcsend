import React, { useCallback, useEffect, useState } from 'react';
import Dashboard from './components/Dashboard';
import Navbar from './components/layout/Navbar';
import { useAuth } from './contexts/AuthContext';
import { createApi, getApiError } from './services/api';
import { CHAINS, type Chain, type TransactionItem } from './types';

function DashboardPage() {
  const { token, message } = useAuth();
  const [showConsole, setShowConsole] = useState(false);
  const [launchTick, setLaunchTick] = useState(0);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [transferTick, setTransferTick] = useState(0);
  const [localMessage, setLocalMessage] = useState('');

  function handleLaunchApp() {
    setShowConsole(true);
    setLaunchTick((value) => value + 1);
  }

  const fetchHistory = useCallback(async () => {
    try {
      const response = await createApi(token).get<{ items: TransactionItem[] }>('/transfer/history');
      setTransactions(response.data.items || []);
    } catch {
      setTransactions([]);
    }
  }, [token]);

  const handleTransferSuccess = useCallback(async () => {
    await fetchHistory();
    setTransferTick((value) => value + 1);
  }, [fetchHistory]);

  useEffect(() => {
    void fetchHistory();
  }, [fetchHistory]);

  async function createWallet(chain: Chain) {
    try {
      await createApi(token).post('/wallet/create', { chain });
      setLocalMessage(`Wallet ready on ${chain}`);
    } catch (error) {
      setLocalMessage(getApiError(error, 'Wallet creation failed'));
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <Navbar onLaunchApp={handleLaunchApp} isAuthenticated={Boolean(token)} />
      <Dashboard
        token={token}
        chains={CHAINS}
        transactions={transactions}
        transferTick={transferTick}
        showConsole={showConsole}
        launchTick={launchTick}
        isAuthenticated={Boolean(token)}
        onLaunchApp={handleLaunchApp}
        onCreateWallet={createWallet}
        setTransactions={setTransactions}
        setMessage={setLocalMessage}
        onTransferSuccess={handleTransferSuccess}
      />
      {(message || localMessage) && (
        <p className="mx-auto mt-4 max-w-6xl rounded-md border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700">
          {localMessage || message}
        </p>
      )}
    </div>
  );
}

export default function App() {
  return <DashboardPage />;
}
