import type { ResourceContext } from '../../access-control/index.js';
import { commercialScope } from '../../access-control/index.js';
import type { PermissionCode, ResourceTarget } from '@crm/contracts';
export function targetFields(target: ResourceTarget | null | undefined) {
  return {
    contactId: target?.type === 'contact' ? target.id : null,
    leadId: target?.type === 'lead' ? target.id : null,
    opportunityId: target?.type === 'opportunity' ? target.id : null,
  };
}
export function targetOf(row: {
  contactId: string | null;
  leadId: string | null;
  opportunityId: string | null;
}): ResourceTarget | null {
  if (row.contactId) return { type: 'contact', id: row.contactId };
  if (row.leadId) return { type: 'lead', id: row.leadId };
  if (row.opportunityId) return { type: 'opportunity', id: row.opportunityId };
  return null;
}
export function taskScope(
  context: ResourceContext,
  permission: PermissionCode = 'tasks.read',
  required = true,
) {
  const targetScope = (code: PermissionCode) => commercialScope(context, code, false);
  return {
    AND: [
      commercialScope(context, permission, required),
      {
        OR: [
          { contactId: null, leadId: null, opportunityId: null },
          { contact: { is: targetScope('contacts.read') } },
          { lead: { is: targetScope('leads.read') } },
          { opportunity: { is: targetScope('opportunities.read') } },
        ],
      },
    ],
  };
}
export function reminderDelay(attempt: number) {
  return Math.min(60000, 1000 * 2 ** Math.max(0, attempt - 1));
}
