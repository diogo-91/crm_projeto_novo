import { expect, it } from 'vitest';
import { cn } from './utils';

it('preserves semantic font size and text color together', () => {
  expect(cn('text-caption', 'text-muted')).toBe('text-caption text-muted');
});

it('replaces conflicting semantic font sizes without removing the color', () => {
  expect(cn('text-body', 'text-caption', 'text-danger')).toBe('text-caption text-danger');
});
