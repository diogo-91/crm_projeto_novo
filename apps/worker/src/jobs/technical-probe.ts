import { technicalJobSchema } from '@crm/contracts';
import type { TechnicalJobResult } from '@crm/contracts';
export function processTechnicalProbe(data: unknown): TechnicalJobResult {
  const validated = technicalJobSchema.parse(data);
  return { status: 'ok', correlationId: validated.correlationId };
}
