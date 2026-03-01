import React, { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { createApi, getApiError } from '../services/api';
import type { AuthResponse, User, WalletChallengeResponse } from '../types';

interface AuthContextValue {
  token: string;
  user: User | null;
  message: string;
  login: (email: string, password: string) => Promise<boolean>;
  loginWithWallet: () => Promise<boolean>;
  signup: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  clearMessage: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'arcsend_token';
const USER_KEY = 'arcsend_user';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string>(localStorage.getItem(TOKEN_KEY) || '');
  const [user, setUser] = useState<User | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  });
  const [message, setMessage] = useState('');

  function persistSession(response: AuthResponse) {
    setToken(response.token);
    setUser(response.user);
    localStorage.setItem(TOKEN_KEY, response.token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
  }

  async function login(email: string, password: string) {
    try {
      const response = await createApi().post<AuthResponse>('/auth/login', { email, password });
      persistSession(response.data);
      setMessage('Login successful');
      return true;
    } catch (error) {
      setMessage(getApiError(error, 'Login failed'));
      return false;
    }
  }

  async function signup(email: string, password: string) {
    try {
      const response = await createApi().post<AuthResponse>('/auth/signup', { email, password });
      persistSession(response.data);
      setMessage('Signup successful');
      return true;
    } catch (error) {
      setMessage(getApiError(error, 'Signup failed'));
      return false;
    }
  }

  async function loginWithWallet() {
    try {
      const ethereum = window.ethereum;
      if (!ethereum) {
        setMessage('MetaMask not detected. Please install MetaMask to continue.');
        return false;
      }

      const accounts = (await ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      const address = accounts?.[0];

      if (!address) {
        setMessage('No wallet account selected.');
        return false;
      }

      const challengeResponse = await createApi().post<WalletChallengeResponse>('/auth/wallet/challenge', {
        address
      });

      const signature = (await ethereum.request({
        method: 'personal_sign',
        params: [challengeResponse.data.message, address]
      })) as string;

      const verifyResponse = await createApi().post<AuthResponse>('/auth/wallet/verify', {
        address,
        message: challengeResponse.data.message,
        signature
      });

      persistSession(verifyResponse.data);
      setMessage('Wallet login successful');
      return true;
    } catch (error) {
      const rejectionCode = (error as { code?: number })?.code;
      if (rejectionCode === 4001) {
        setMessage('Wallet signature request was rejected.');
        return false;
      }

      setMessage(getApiError(error, 'Wallet login failed'));
      return false;
    }
  }

  function logout() {
    setToken('');
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setMessage('Logged out');
  }

  function clearMessage() {
    setMessage('');
  }

  const value = useMemo(
    () => ({ token, user, message, login, loginWithWallet, signup, logout, clearMessage }),
    [token, user, message]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
