import type { ReactNode } from 'react';
export function TechnicalStatus({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="mt-3 text-slate-600">
      {children}
    </p>
  );
}
