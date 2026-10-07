import { requestMetadata } from './request-metadata.js';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import type { RequestHandler } from 'express';
import type { StructuredLogger } from '../modules/runtime/index.js';
export function validCorrelationId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
}
export function requestContext(logger: StructuredLogger): RequestHandler {
  return (request, response, next) => {
    const requestId = randomUUID();
    const supplied = request.headers['x-correlation-id'];
    const correlationId = validCorrelationId(supplied) ? supplied : requestId;
    response.locals['requestId'] = requestId;
    response.locals['correlationId'] = correlationId;
    response.setHeader('X-Request-Id', requestId);
    response.setHeader('X-Correlation-Id', correlationId);
    const started = performance.now();
    response.once('finish', () =>
      logger.info('request completed', 'http', {
        requestId,
        correlationId,
        method: request.method,
        statusCode: response.statusCode,
        durationMs: Math.round(performance.now() - started),
      }),
    );
    requestMetadata.run({ requestId, correlationId }, next);
  };
}
