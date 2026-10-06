import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { StructuredLogger, reportStartupFailure } from '@crm/api/runtime';
import { WorkerModule } from '../worker.module.js';
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: false,
    abortOnError: false,
  });
  app.useLogger(app.get(StructuredLogger));
  app.enableShutdownHooks([], { useProcessExit: true });
  app.get(StructuredLogger).info('worker ready', 'bootstrap');
}
bootstrap().catch((error: unknown) => reportStartupFailure('worker', error));
