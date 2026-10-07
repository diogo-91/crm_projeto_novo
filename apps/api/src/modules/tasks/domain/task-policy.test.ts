import { expect, it } from 'vitest';
import { reminderDelay, targetFields, targetOf, taskScope } from './task-policy.js';
import type { ResourceContext } from '../../access-control/index.js';
const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
it('maps only the explicit primary target and deliberately clears other links', () => {
  expect(targetFields({ type: 'lead', id })).toEqual({
    contactId: null,
    leadId: id,
    opportunityId: null,
  });
  expect(targetOf(targetFields({ type: 'opportunity', id }))).toEqual({ type: 'opportunity', id });
  expect(targetOf(targetFields(null))).toBeNull();
});
it('task visibility intersects the action grant with independent target read grants', () => {
  const context: ResourceContext = {
    organizationId: id,
    membershipId: id,
    branches: [{ id, name: 'Branch', code: 'B' }],
    grants: [
      {
        id,
        roleId: id,
        code: 'SELLER',
        name: 'Seller',
        scope: 'OWN',
        branchIds: [],
        permissions: ['tasks.read'],
      },
    ],
  };
  const filter = taskScope(context);
  expect(filter.AND[0]).toMatchObject({ organizationId: id });
  expect(filter.AND[1]).toEqual({
    OR: [
      { contactId: null, leadId: null, opportunityId: null },
      { contact: { is: { organizationId: id, OR: [] } } },
      { lead: { is: { organizationId: id, OR: [] } } },
      { opportunity: { is: { organizationId: id, OR: [] } } },
    ],
  });
  expect(() => taskScope(context, 'tasks.complete')).toThrow();
});
it('retry delay is exponential and bounded rather than a tight retry loop', () => {
  expect([1, 2, 3, 4, 5, 20].map(reminderDelay)).toEqual([1000, 2000, 4000, 8000, 16000, 60000]);
});
