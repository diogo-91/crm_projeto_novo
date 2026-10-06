export * from './button';
export * from './input';
export * from './card';
export * from './badge';
export * from './feedback';
export * from './tooltip';
export * from './dialog';
export * from './dropdown-menu';
export * from './select';
export * from './command';
export * from './toast';
export * from './table';
export * from './pagination';
export * from './utils';
import type { ReactNode } from 'react';
export function TechnicalStatus({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="mt-3 text-muted">
      {children}
    </p>
  );
}
