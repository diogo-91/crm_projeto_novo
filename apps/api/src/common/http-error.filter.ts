import { ApplicationError } from './application-error.js';
import { Catch, HttpException } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import type { StructuredLogger } from '../modules/runtime/index.js';
const errorStatus = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  RATE_LIMITED: 429,
  AUTH_UNAVAILABLE: 503,
  INVALID_INPUT: 400,
  RESOURCE_CONFLICT: 409,
  RESOURCE_NOT_FOUND: 404,
  USER_NOT_FOUND: 404,
  USER_INACTIVE: 409,
  DUPLICATE_BRANCH: 400,
  INVALID_PRIMARY_BRANCH: 400,
  ORGANIZATION_NOT_FOUND: 404,
  ORGANIZATION_INACTIVE: 409,
  BRANCH_NOT_FOUND: 404,
  BRANCH_INACTIVE: 409,
} as const;
@Catch()
export class HttpErrorFilter implements ExceptionFilter {
  constructor(private readonly logger: StructuredLogger) {}
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof ApplicationError
        ? errorStatus[exception.code]
        : exception instanceof HttpException
          ? exception.getStatus()
          : 500;
    const requestId: unknown = response.locals['requestId'];
    if (status >= 500) this.logger.error('HTTP request failed');
    response
      .status(status)
      .type('application/problem+json')
      .json({
        type: 'about:blank',
        title: status >= 500 ? 'Internal Server Error' : 'Request failed',
        status,
        code:
          exception instanceof ApplicationError
            ? exception.code
            : status >= 500
              ? 'INTERNAL_ERROR'
              : `HTTP_${status}`,
        detail:
          exception instanceof ApplicationError
            ? exception.message
            : status >= 500
              ? 'The request could not be completed.'
              : 'Verify the requested resource and input.',
        ...(typeof requestId === 'string' ? { requestId } : {}),
      });
  }
}
