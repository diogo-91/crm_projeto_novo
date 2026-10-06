import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import {
  StructuredLogger,
  TechnicalQueueService,
  reportStartupFailure,
} from '../modules/runtime/index.js';
async function probe(): Promise<void> {
  const app = await NestFactory.create(AppModule, { logger: false, abortOnError: false });
  try {
    await app.init();
    const logger = app.get(StructuredLogger);
    app.useLogger(logger);
    const result = await app.get(TechnicalQueueService).probe(randomUUID());
    logger.info('queue probe completed', 'probe', { correlationId: result.correlationId });
  } finally {
    await app.close();
  }
}
probe().catch((error: unknown) => reportStartupFailure('probe', error));
