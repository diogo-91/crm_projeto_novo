import type { ApiConfig } from '@crm/config/server';
import type { CookieOptions, Request } from 'express';
export function refreshCookieName(config: ApiConfig) {
  return config.NODE_ENV === 'production' ? '__Host-crm-refresh' : 'crm_refresh';
}
export function readRefreshCookie(request: Request, config: ApiConfig): string | undefined {
  const values = (request.headers.cookie ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${refreshCookieName(config)}=`));
  return values.length === 1 ? values[0]?.slice(refreshCookieName(config).length + 1) : undefined;
}

export function refreshCookieOptions(config: ApiConfig): CookieOptions {
  return { httpOnly: true, secure: config.NODE_ENV === 'production', sameSite: 'lax', path: '/' };
}
