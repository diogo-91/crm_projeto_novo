import { it, expect } from 'vitest';
import { stageTransition } from './stage-transition.js';
it('winning sets a close timestamp without a loss reason', () => {
  const now = new Date();
  expect(stageTransition('WON', undefined, now)).toEqual({
    status: 'WON',
    closedAt: now,
    lostReason: null,
  });
});
it('losing requires a reason and records it with the close timestamp', () => {
  expect(() => stageTransition('LOST')).toThrow();
  const now = new Date();
  expect(stageTransition('LOST', ' Customer declined ', now)).toEqual({
    status: 'LOST',
    closedAt: now,
    lostReason: 'Customer declined',
  });
});
it('reopening clears prior close fields', () =>
  expect(stageTransition('OPEN')).toEqual({ status: 'OPEN', closedAt: null, lostReason: null }));
it.each(['OPEN', 'WON'] as const)('rejects a loss reason on %s', (kind) =>
  expect(() => stageTransition(kind, 'wrong')).toThrow(),
);
