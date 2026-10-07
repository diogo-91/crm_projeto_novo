import { createHash } from 'node:crypto';
import type { ConvertLead } from '@crm/contracts';
export function conversionIntent(input: ConvertLead) {
  return createHash('sha256')
    .update(
      JSON.stringify({
        pipelineId: input.pipelineId,
        stageId: input.stageId,
        name: input.opportunityName ?? null,
        amount: input.amount
          .replace(/^0+(?=\d)/, '')
          .replace(/(\.\d*?)0+$/, '$1')
          .replace(/\.$/, ''),
        currency: input.currency,
        contactId: input.contactId === undefined ? 'preserve' : input.contactId,
        companyId: input.companyId === undefined ? 'preserve' : input.companyId,
        createContact: input.createContact,
        createCompany: input.createCompany,
      }),
    )
    .digest('hex');
}
