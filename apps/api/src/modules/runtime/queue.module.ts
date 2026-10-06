import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Module } from '@nestjs/common';
import type { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, QueueEvents, Worker } from 'bullmq';
import type { RuntimeConfig } from '@crm/config/server';
import { technicalJobResultSchema } from '@crm/contracts';
import type { TechnicalJob, TechnicalJobResult } from '@crm/contracts';
import { RUNTIME_CONFIG } from './config.module.js';
import { redisConnectionOptions } from './redis.module.js';
import { StructuredLogger } from './structured-logger.js';
export const TECHNICAL_QUEUE_NAME = 'foundation-probe';
export function createTechnicalWorker(
  config: RuntimeConfig,
  handler: (data: unknown) => TechnicalJobResult,
): Worker<TechnicalJob, TechnicalJobResult> {
  return new Worker<TechnicalJob, TechnicalJobResult>(
    TECHNICAL_QUEUE_NAME,
    (job) => Promise.resolve(handler(job.data)),
    {
      connection: redisConnectionOptions(config, 'blocking'),
      concurrency: 1,
    },
  );
}
@Injectable()
export class TechnicalQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly queue: Queue<TechnicalJob, TechnicalJobResult>;
  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: RuntimeConfig,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {
    this.queue = new Queue<TechnicalJob, TechnicalJobResult>(TECHNICAL_QUEUE_NAME, {
      connection: redisConnectionOptions(config, 'request'),
    });
    this.queue.on('error', () => this.logger.error('technical queue connection error'));
  }
  async onModuleInit(): Promise<void> {
    await this.queue.waitUntilReady();
  }
  async probe(correlationId: string): Promise<TechnicalJobResult> {
    const events = new QueueEvents(TECHNICAL_QUEUE_NAME, {
      connection: redisConnectionOptions(this.config, 'blocking'),
    });
    events.on('error', () => this.logger.error('technical queue events connection error'));
    try {
      await events.waitUntilReady();
      const job = await this.queue.add(
        'probe',
        { correlationId },
        {
          jobId: randomUUID(),
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
      const result: unknown = await job.waitUntilFinished(events, 10000);
      return technicalJobResultSchema.parse(result);
    } finally {
      await events.close();
    }
  }
  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}
@Module({ providers: [TechnicalQueueService], exports: [TechnicalQueueService] })
export class QueueModule {}
