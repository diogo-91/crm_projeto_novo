import type { LeadResponse, OpportunityResponse } from '@crm/contracts';
export const leadLabels: Record<LeadResponse['status'], string> = {
  NEW: 'Novo',
  QUALIFIED: 'Qualificado',
  DISQUALIFIED: 'Desqualificado',
  CONVERTED: 'Convertido',
};
export const dealLabels: Record<OpportunityResponse['status'], string> = {
  OPEN: 'Aberta',
  WON: 'Ganha',
  LOST: 'Perdida',
};
