import { Global, Inject, Injectable, Module } from '@nestjs/common';
import type { OnApplicationShutdown } from '@nestjs/common';
import type { RuntimeConfig, SeedConfig } from '@crm/config/server';
import { RUNTIME_CONFIG } from './config.module.js';
import { StructuredLogger } from './structured-logger.js';
@Injectable()
class ShutdownReporter implements OnApplicationShutdown {
  constructor(@Inject(StructuredLogger) private readonly logger: StructuredLogger) {}
  onApplicationShutdown(signal?: string): void {
    this.logger.info('shutdown complete', 'lifecycle', signal ? { signal } : {});
  }
}
@Global()
@Module({
  providers: [
    {
      provide: StructuredLogger,
      inject: [RUNTIME_CONFIG],
      useFactory: (config: RuntimeConfig | SeedConfig) =>
        new StructuredLogger(config.role, config.LOG_LEVEL),
    },
    ShutdownReporter,
  ],
  exports: [StructuredLogger],
})
export class LoggingModule {}
