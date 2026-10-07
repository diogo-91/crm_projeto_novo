'use client';
import type { ResourceTarget } from '@crm/contracts';
import Link from 'next/link';
import { targetHref } from './dates';
export function TaskTargetSummary({ target }: { target: ResourceTarget }) {
  return (
    <Link className="text-foreground underline" href={targetHref(target.type, target.id)}>
      Abrir{' '}
      {target.type === 'contact' ? 'cliente' : target.type === 'lead' ? 'lead' : 'oportunidade'}{' '}
      vinculado
    </Link>
  );
}
