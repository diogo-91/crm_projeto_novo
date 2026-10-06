export type ApplicationErrorCode =
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'RATE_LIMITED'
  | 'AUTH_UNAVAILABLE'
  | 'INVALID_INPUT'
  | 'RESOURCE_CONFLICT'
  | 'RESOURCE_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'USER_INACTIVE'
  | 'DUPLICATE_BRANCH'
  | 'INVALID_PRIMARY_BRANCH'
  | 'ORGANIZATION_NOT_FOUND'
  | 'ORGANIZATION_INACTIVE'
  | 'BRANCH_NOT_FOUND'
  | 'BRANCH_INACTIVE';
export class ApplicationError extends Error {
  constructor(
    readonly code: ApplicationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApplicationError';
  }
}
