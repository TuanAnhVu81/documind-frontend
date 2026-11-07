import { useSyncExternalStore } from 'react';
import { authManager } from './auth-manager';
export function useAuth() {
  const state = useSyncExternalStore(
    authManager.subscribe,
    authManager.getSnapshot,
    authManager.getSnapshot,
  );
  return {
    ...state,
    login: authManager.login.bind(authManager),
    register: authManager.register.bind(authManager),
    logout: authManager.logout.bind(authManager),
    refresh: authManager.refresh.bind(authManager),
    accessToken: authManager.accessToken.bind(authManager),
    trackStream: authManager.trackStream.bind(authManager),
  };
}
