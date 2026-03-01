import type { ReactNode } from 'react';
import { ArcSendProvider } from 'arcsend-sdk/react';
import { useAuth } from './AuthContext';
import { API_BASE } from '../services/api';

export function ArcSendSdkProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();

  return (
    <ArcSendProvider
      config={{
        baseUrl: API_BASE,
        getToken: () => token || undefined
      }}
    >
      {children}
    </ArcSendProvider>
  );
}
