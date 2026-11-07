import { useEffect, type ReactNode } from 'react';
import { authManager } from './auth-manager';
export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    authManager.start();
  }, []);
  return children;
}
