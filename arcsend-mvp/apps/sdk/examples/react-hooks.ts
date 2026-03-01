import { useEffect, useMemo, useState } from 'react';
import ArcSendClient, { type SendRequest, type WalletBalance } from 'arcsend-sdk';

export function useArcSend(token?: string) {
  const client = useMemo(
    () =>
      new ArcSendClient({
        token,
        baseUrl: import.meta.env.VITE_API_URL || 'http://localhost:4001'
      }),
    [token]
  );

  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    void loadBalance();
  }, []);

  const loadBalance = async () => {
    if (!token) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await client.wallets.getBalance('arc-testnet');
      setBalance(result.data || null);
    } finally {
      setIsLoading(false);
    }
  };

  const send = async (params: SendRequest) => {
    setIsLoading(true);
    try {
      const { data } = await client.transfers.send(params);
      return data;
    } finally {
      setIsLoading(false);
      await loadBalance();
    }
  };

  return { balance, isLoading, send, refresh: loadBalance };
}
