import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { ApiConfig } from '@crm/config/server';
import { AppModule } from '../app.module.js';
import {
  RUNTIME_CONFIG,
  StructuredLogger,
  reportStartupFailure,
} from '../modules/runtime/index.js';
import { configureHttp } from './http.js';
async function bootstrap(): Promise<void> {
  let app: NestExpressApplication | undefined;
  try {
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      logger: false,
      abortOnError: false,
    });
    const config = app.get<ApiConfig>(RUNTIME_CONFIG);
    const logger = app.get(StructuredLogger);
    app.useLogger(logger);
    app.enableShutdownHooks([], { useProcessExit: true });
    configureHttp(app, config, logger);
    await app.listen(config.API_PORT, config.API_HOST);
    logger.info('API ready', 'bootstrap');
  } catch (error: unknown) {
    reportStartupFailure('api', error);
    if (app) await app.close();
  }
}
bootstrap().catch((error: unknown) => reportStartupFailure('api', error));
