import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import type { WorkerConfig } from '@crm/config/server';
import { RUNTIME_CONFIG, StructuredLogger, createTechnicalWorker } from '@crm/api/runtime';
import { processTechnicalProbe } from './technical-probe.js';
@Injectable()
export class TechnicalWorkerService implements OnModuleInit, OnModuleDestroy {
  private worker: ReturnType<typeof createTechnicalWorker> | undefined;
  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: WorkerConfig,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}
  async onModuleInit(): Promise<void> {
    this.worker = createTechnicalWorker(this.config, processTechnicalProbe);
    this.worker.on('error', () => this.logger.error('worker connection error'));
    this.worker.on('failed', (job) =>
      this.logger.info('technical job failed', 'jobs', job?.id ? { jobId: job.id } : {}),
    );
    this.worker.on('completed', (job) =>
      this.logger.info('technical job completed', 'jobs', {
        ...(job.id ? { jobId: job.id } : {}),
        correlationId: job.data.correlationId,
      }),
    );
    try {
      await this.worker.waitUntilReady();
    } catch (error: unknown) {
      await this.worker?.close();
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    this.logger.info('worker drained', 'lifecycle');
  }
}
