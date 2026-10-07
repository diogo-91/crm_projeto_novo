import type { contactSources } from '@crm/contracts';
export const sourceLabels: Record<(typeof contactSources)[number], string> = {
  MANUAL: 'Manual',
  WHATSAPP: 'WhatsApp',
  MARKETPLACE: 'Marketplace',
  WEBSITE: 'Site',
  REFERRAL: 'Indicação',
  OUTBOUND: 'Prospecção',
  PHONE: 'Telefone',
  IMPORT: 'Importação',
  OTHER: 'Outro',
};
