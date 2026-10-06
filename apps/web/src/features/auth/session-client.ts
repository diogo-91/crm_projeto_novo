import { authResponseSchema, meResponseSchema } from '@crm/contracts';
import type { AuthResponse, MeResponse, Login } from '@crm/contracts';
import type { z } from 'zod';
import type { ApiClient } from '@/lib/api-client';
import { ApiError } from '@/lib/api-client';
export type AuthState =
  | { status: 'loading' | 'switching'; me: null; error: null }
  | { status: 'anonymous'; me: null; error: ApiError | null }
  | { status: 'error'; me: null; error: ApiError }
  | { status: 'authenticated'; me: MeResponse; error: null };
const initial: AuthState = { status: 'loading', me: null, error: null };
type Serialize = <T>(work: () => Promise<T>) => Promise<T>;
export type SessionEvent = 'changed' | 'logout';
function serializeBrowser<T>(work: () => Promise<T>): Promise<T> {
  if (!navigator.locks) return Promise.reject(new ApiError(503, 'UNSUPPORTED_BROWSER'));
  return navigator.locks.request('crm-auth-cookie', work);
}
// Only this owner reads/writes in-memory access credentials. No persistent token/cache.
export class SessionClient {
  private state: AuthState = initial;
  private token: string | null = null;
  private expiresAt = 0;
  private revision = 0;
  private epoch = 0;
  private requests = new AbortController();
  private flight: Promise<void> | null = null;
  private mutation: Promise<void> = Promise.resolve();
  private listeners = new Set<() => void>();
  private eventListeners = new Set<(event: SessionEvent) => void>();
  constructor(
    private readonly api: ApiClient,
    private readonly serialize: Serialize = serializeBrowser,
  ) {}
  subscribeEvents(listener: (event: SessionEvent) => void) {
    this.eventListeners.add(listener);
    return () => {
      this.eventListeners.delete(listener);
    };
  }
  private publish(event: SessionEvent) {
    this.eventListeners.forEach((listener) => listener(event));
  }
  getSnapshot = () => this.state;
  getServerSnapshot = () => initial;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private set(state: AuthState) {
    this.state = state;
    this.listeners.forEach((listener) => listener());
  }
  private clear() {
    this.epoch += 1;
    this.revision += 1;
    this.requests.abort();
    this.requests = new AbortController();
    this.token = null;
    this.expiresAt = 0;
  }
  private accept(auth: AuthResponse, epoch: number) {
    if (epoch !== this.epoch) throw new ApiError(409, 'STALE_CONTEXT');
    if (
      this.state.status === 'authenticated' &&
      (this.state.me.user.id !== auth.user.id ||
        this.state.me.context?.membershipId !== auth.context?.membershipId)
    )
      this.clear();
    this.token = auth.accessToken;
    this.expiresAt = Date.now() + auth.expiresIn * 1000;
    this.revision += 1;
    const { user, memberships, context } = auth;
    this.set({ status: 'authenticated', me: { user, memberships, context }, error: null });
  }
  reportError = (error: unknown) => {
    if (this.state.error !== error) this.failed(error);
  };
  private failed(error: unknown) {
    this.clear();
    const failure = error instanceof ApiError ? error : new ApiError(500, 'UNEXPECTED');
    this.set(
      failure.status === 401
        ? { status: 'anonymous', me: null, error: failure }
        : { status: 'error', me: null, error: failure },
    );
  }
  // A failed mutation does not poison the serialization chain; its caller still receives the error.
  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const task = this.mutation.then(work);
    this.mutation = task.then(
      () => undefined,
      () => undefined,
    );
    return task;
  }
  restore(): Promise<void> {
    if (this.flight) return this.flight;
    const epoch = this.epoch;
    const task = this.exclusive(() =>
      this.serialize(async () => {
        if (epoch !== this.epoch) return;
        try {
          this.accept(
            await this.api.parsed('auth/refresh', authResponseSchema, {
              method: 'POST',
              body: '{}',
            }),
            epoch,
          );
        } catch (error) {
          if (epoch !== this.epoch) return;
          this.failed(error);
          throw error;
        }
      }),
    );
    this.flight = task;
    const complete = () => {
      if (this.flight === task) this.flight = null;
    };
    void task.then(complete, complete);
    return task;
  }
  async login(input: Login): Promise<void> {
    return this.exclusive(() =>
      this.serialize(async () => {
        this.clear();
        const epoch = this.epoch;
        this.set({ status: 'loading', me: null, error: null });
        try {
          this.accept(
            await this.api.parsed('auth/login', authResponseSchema, {
              method: 'POST',
              body: JSON.stringify(input),
            }),
            epoch,
          );
          this.publish('changed');
        } catch (error) {
          this.failed(error);
          throw error;
        }
      }),
    );
  }
  async selectOrganization(organizationId: string): Promise<void> {
    if (this.token && Date.now() >= this.expiresAt) await this.restore();
    return this.exclusive(() =>
      this.serialize(async () => {
        const token = this.token;
        if (!token) throw new ApiError(401, 'UNAUTHENTICATED');
        this.clear();
        const epoch = this.epoch;
        this.set({ status: 'switching', me: null, error: null });
        try {
          this.accept(
            await this.api.parsed('auth/context', authResponseSchema, {
              method: 'POST',
              body: JSON.stringify({ organizationId }),
              headers: { Authorization: `Bearer ${token}` },
            }),
            epoch,
          );
          this.publish('changed');
        } catch (error) {
          this.failed(error);
          throw error;
        }
      }),
    );
  }
  async logout(): Promise<void> {
    return this.exclusive(() =>
      this.serialize(async () => {
        this.clear();
        this.set({ status: 'loading', me: null, error: null });
        try {
          await this.api.send('auth/logout', { method: 'POST', body: '{}' });
          this.set({ status: 'anonymous', me: null, error: null });
          this.publish('logout');
        } catch (error) {
          this.failed(error);
          throw error;
        }
      }),
    );
  }
  external(event: SessionEvent) {
    this.clear();
    this.set(event === 'logout' ? { status: 'anonymous', me: null, error: null } : initial);
    // Next restoration must follow any earlier refresh, never share its obsolete response.
    if (event === 'changed')
      void this.mutation
        .then(() => this.restore())
        .catch((error) => {
          if (this.state.status === 'loading') this.failed(error);
        });
  }
  async request<Schema extends z.ZodType>(
    path: string,
    schema: Schema,
    init: RequestInit = {},
  ): Promise<z.output<Schema>> {
    if (!this.token || Date.now() >= this.expiresAt) await this.restore();
    const epoch = this.epoch;
    const revision = this.revision;
    const run = async () => {
      if (epoch !== this.epoch || !this.token) throw new ApiError(409, 'STALE_CONTEXT');
      const headers = new Headers(init.headers);
      headers.set('Authorization', `Bearer ${this.token}`);
      const value = await this.api.parsed(path, schema, {
        ...init,
        signal: AbortSignal.any([this.requests.signal, ...(init.signal ? [init.signal] : [])]),
        headers,
      });
      if (epoch !== this.epoch) throw new ApiError(409, 'STALE_CONTEXT');
      return value;
    };
    try {
      return await run();
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401 || epoch !== this.epoch) throw error;
      if (revision === this.revision) await this.restore();
      try {
        return await run();
      } catch (retryError) {
        if (retryError instanceof ApiError && retryError.status === 401 && epoch === this.epoch)
          this.failed(retryError);
        throw retryError;
      }
    }
  }
  async check(): Promise<void> {
    if (this.state.status !== 'authenticated') return;
    const epoch = this.epoch;
    try {
      const me = await this.request('auth/me', meResponseSchema);
      if (epoch === this.epoch) this.set({ status: 'authenticated', me, error: null });
    } catch (error) {
      if (epoch !== this.epoch) return;
      this.failed(error);
      throw error;
    }
  }
}
