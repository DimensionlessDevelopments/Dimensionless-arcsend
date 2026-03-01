import React, { type ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';

export default function ProtectedRoute({
  children,
  fallback
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  const { token } = useAuth();

  if (!token) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
