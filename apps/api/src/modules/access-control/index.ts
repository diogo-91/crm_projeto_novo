export { AccessControlModule } from './access-control.module.js';
export { AccessControlService } from './application/access-control.service.js';
export { AccessBootstrapGateway } from './infrastructure/access-bootstrap.gateway.js';
export type { TenantContext, Grant } from './domain/access-policy.js';
export { permits, orgPermission, collectionScope } from './domain/access-policy.js';
