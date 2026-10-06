'use client';
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import { parseWebEnvironment } from '@crm/config/web';
import type { PermissionCode } from '@crm/contracts';
import { ApiClient } from '@/lib/api-client';
import { SessionClient } from './session-client';
const Context = createContext<SessionClient | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session] = useState(
    () =>
      new SessionClient(
        new ApiClient(
          parseWebEnvironment({ NEXT_PUBLIC_API_URL: process.env['NEXT_PUBLIC_API_URL'] })
            .NEXT_PUBLIC_API_URL,
        ),
      ),
  );
  useEffect(() => {
    const channel = new BroadcastChannel('crm-session');
    // A channel does not receive its own messages; another instance in this tab would.
    const unsubscribe = session.subscribeEvents((event) => channel.postMessage(event));
    channel.onmessage = (message: MessageEvent<unknown>) => {
      if (message.data === 'changed' || message.data === 'logout') session.external(message.data);
    };
    const check = () => {
      if (document.visibilityState === 'visible') void session.check().catch(session.reportError);
    };
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    void session.restore().catch(session.reportError);
    return () => {
      unsubscribe();
      channel.close();
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, [session]);
  return <Context value={session}>{children}</Context>;
}
export function useAuth() {
  const session = useContext(Context);
  if (!session) throw new Error('AuthProvider is required');
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot,
  );
  return { session, state };
}
// Capability hint only: scopes and object authorization remain entirely in the API.
export function usePermission(permission: PermissionCode): boolean {
  const { state } = useAuth();
  return (
    state.status === 'authenticated' && Boolean(state.me.context?.permissions.includes(permission))
  );
}
export function Can({ permission, children }: { permission: PermissionCode; children: ReactNode }) {
  return usePermission(permission) ? children : null;
}
