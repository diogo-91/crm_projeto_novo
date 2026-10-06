import { expect, it } from 'vitest';
import { validateBranchSelection, requireActiveOrganization } from './membership-policy.js';
it('allows structural membership without branch grants or a primary branch', () => {
  expect(() => validateBranchSelection([])).not.toThrow();
});
it('requires distinct branches', () => {
  expect(() => validateBranchSelection(['branch', 'branch'])).toThrow('distinct');
});
it('requires primary branch to be among assigned branches', () => {
  expect(() => validateBranchSelection(['assigned'], 'unassigned')).toThrow('included');
});
it('accepts a primary branch among assigned branches', () => {
  expect(() => validateBranchSelection(['assigned'], 'assigned')).not.toThrow();
});
it('rejects missing and inactive organization write contexts', () => {
  expect(() => requireActiveOrganization(null)).toThrow('does not exist');
  expect(() => requireActiveOrganization({ active: false })).toThrow('Inactive');
  expect(() => requireActiveOrganization({ active: true })).not.toThrow();
});
