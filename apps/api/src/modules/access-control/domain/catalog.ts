import { permissionCodes } from '@crm/contracts';
import type { PermissionCode } from '@crm/contracts';
export const catalog = permissionCodes.map((code) => ({
  code,
  description: code,
  domain: code === 'organizations.create' ? ('PLATFORM' as const) : ('ORGANIZATION' as const),
}));
const commercialRead: PermissionCode[] = [
  'contacts.read',
  'companies.read',
  'tags.read',
  'leads.read',
  'pipelines.read',
  'opportunities.read',
];
const commercialWrite: PermissionCode[] = [
  'contacts.create',
  'contacts.update',
  'companies.create',
  'companies.update',
  'leads.create',
  'leads.update',
  'leads.convert',
  'opportunities.create',
  'opportunities.update',
  'opportunities.move',
];
const read: PermissionCode[] = ['organizations.read', 'branches.read', 'users.read', 'roles.read'];
export const templates: { code: string; name: string; permissions: PermissionCode[] }[] = [
  {
    code: 'ADMIN',
    name: 'Administrador',
    permissions: permissionCodes.filter((code) => code !== 'organizations.create'),
  },
  {
    code: 'DIRECTOR',
    name: 'Diretor',
    permissions: [
      ...read,
      ...commercialRead,
      ...commercialWrite,
      'contacts.assign',
      'companies.assign',
      'leads.assign',
      'opportunities.assign',
      'pipelines.manage',
      'branches.manage',
      'users.manage',
    ],
  },
  {
    code: 'SALES_MANAGER',
    name: 'Gerente comercial',
    permissions: [
      ...read,
      ...commercialRead,
      ...commercialWrite,
      'contacts.assign',
      'companies.assign',
      'leads.assign',
      'opportunities.assign',
    ],
  },
  {
    code: 'SELLER',
    name: 'Vendedor',
    permissions: ['branches.read', 'users.read', ...commercialRead, ...commercialWrite],
  },
  {
    code: 'AFTER_SALES',
    name: 'Pós-venda',
    permissions: [
      'branches.read',
      'users.read',
      ...commercialRead,
      'contacts.update',
      'companies.update',
      'leads.update',
      'opportunities.update',
      'opportunities.move',
    ],
  },
  { code: 'VIEWER', name: 'Visualizador', permissions: [...read, ...commercialRead] },
];
