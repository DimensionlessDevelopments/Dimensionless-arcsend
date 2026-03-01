'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { ArcSendClient, type ArcSendConfig } from '../client';

export interface ArcSendContextValue {
  client: ArcSendClient;
}

const ArcSendContext = createContext<ArcSendContextValue | null>(null);

export interface ArcSendProviderProps {
  config: ArcSendConfig;
  children: ReactNode;
}

export function ArcSendProvider({ config, children }: ArcSendProviderProps) {
  const stableConfig = useMemo(
    () => ({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      token: config.token,
      getToken: config.getToken
    }),
    [config.apiKey, config.baseUrl, config.timeout, config.token, config.getToken]
  );

  const client = useMemo(() => new ArcSendClient(stableConfig), [stableConfig]);
  const contextValue = useMemo<ArcSendContextValue>(() => ({ client }), [client]);

  return <ArcSendContext.Provider value={contextValue}>{children}</ArcSendContext.Provider>;
}

export function useArcSend(): ArcSendContextValue {
  const context = useContext(ArcSendContext);
  if (!context) {
    throw new Error('useArcSend must be used within ArcSendProvider');
  }

  return context;
}
