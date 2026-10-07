import { AsyncLocalStorage } from 'node:async_hooks';
export const requestMetadata = new AsyncLocalStorage<{
  requestId: string;
  correlationId: string;
}>();
