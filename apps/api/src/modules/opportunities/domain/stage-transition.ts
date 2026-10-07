import { ApplicationError } from '../../../common/application-error.js';
export function stageTransition(kind: 'OPEN' | 'WON' | 'LOST', reason?: string, now = new Date()) {
  if (kind === 'LOST' && !reason?.trim())
    throw new ApplicationError('INVALID_INPUT', 'Loss reason required.');
  if (kind !== 'LOST' && reason !== undefined)
    throw new ApplicationError('INVALID_INPUT', 'Reason applies only to lost opportunities.');
  return {
    status: kind,
    closedAt: kind === 'OPEN' ? null : now,
    lostReason: kind === 'LOST' ? (reason?.trim() ?? null) : null,
  };
}
