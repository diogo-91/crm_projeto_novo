import { Inject, Injectable } from '@nestjs/common';
import type { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, Worker, UnrecoverableError } from 'bullmq';
import type { WorkerConfig } from '@crm/config/server';
import { reminderJobSchema } from '@crm/contracts';
import type { ReminderJob } from '@crm/contracts';
import { RUNTIME_CONFIG, StructuredLogger, redisConnectionOptions } from '@crm/api/runtime';
import { TaskRemindersService, reminderDelay } from '@crm/api/task-reminders';
@Injectable()
export class ReminderWorkerService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue<ReminderJob> | undefined;
  private worker: Worker<ReminderJob> | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private tick: Promise<void> | undefined;
  private stopping = false;
  constructor(
    @Inject(RUNTIME_CONFIG) private readonly config: WorkerConfig,
    @Inject(TaskRemindersService) private readonly reminders: TaskRemindersService,
    @Inject(StructuredLogger) private readonly logger: StructuredLogger,
  ) {}
  async onModuleInit() {
    this.queue = new Queue<ReminderJob>('notifications', {
      connection: redisConnectionOptions(this.config, 'request'),
    });
    this.queue.on('error', () => this.logger.error('notification queue connection error'));
    this.worker = new Worker<ReminderJob>(
      'notifications',
      async (job) => {
        const parsed = reminderJobSchema.safeParse(job.data);
        if (!parsed.success) throw new UnrecoverableError('Invalid reminder job contract');
        const data = parsed.data;
        try {
          await this.reminders.process(data.reminderId);
        } catch (error: unknown) {
          try {
            await this.reminders.failure(data.reminderId);
          } catch (checkpointError: unknown) {
            throw new AggregateError(
              [error, checkpointError],
              'Reminder delivery and checkpoint failed',
              { cause: checkpointError },
            );
          }
          throw new Error('Reminder delivery failed', { cause: error });
        }
      },
      {
        connection: redisConnectionOptions(this.config, 'blocking'),
        concurrency: 4,
        settings: {
          backoffStrategy: (attempt) =>
            Math.min(60000, Math.round(reminderDelay(attempt) * (1 + Math.random() * 0.2))),
        },
      },
    );
    this.worker.on('error', () => this.logger.error('notification worker connection error'));
    this.worker.on('failed', (job) =>
      this.logger.warn(
        'reminder attempt failed',
        'reminders',
        job?.id ? { jobId: job.id, attemptCount: job.attemptsMade } : {},
      ),
    );
    this.worker.on('completed', (job) =>
      this.logger.info(
        'reminder job processed',
        'reminders',
        job.id
          ? {
              jobId: job.id,
              ...(job.processedOn !== undefined && job.finishedOn !== undefined
                ? { durationMs: job.finishedOn - job.processedOn }
                : {}),
            }
          : {},
      ),
    );
    this.worker.on('stalled', (jobId) =>
      this.logger.warn('reminder job stalled', 'reminders', { jobId }),
    );
    try {
      await this.queue.waitUntilReady();
      await this.worker.waitUntilReady();
      this.run();
    } catch (error: unknown) {
      await this.worker.close();
      await this.queue.close();
      throw error;
    }
  }
  private run() {
    this.tick = this.dispatch()
      .catch(() => this.logger.error('reminder reconciliation failed'))
      .finally(() => {
        if (!this.stopping) this.timer = setTimeout(() => this.run(), 15000);
      });
  }
  private async dispatch() {
    const queue = this.queue;
    if (!queue) throw new Error('Reminder queue missing');
    for (const claim of await this.reminders.claim()) {
      try {
        const existing = await queue.getJob(claim.id);
        if (existing) {
          const state = await existing.getState();
          if (state === 'completed' || state === 'failed') await existing.remove();
        }
        await queue.add(
          'task-reminder',
          { version: 1, reminderId: claim.id },
          {
            jobId: claim.id,
            attempts: 5,
            backoff: { type: 'reminder' },
            removeOnComplete: 100,
            removeOnFail: 1000,
          },
        );
        await this.reminders.dispatched(claim.id, claim.token);
      } catch (error: unknown) {
        await this.reminders.failure(claim.id, claim.token);
        this.logger.error('reminder dispatch failed');
        if (this.stopping) throw error;
      }
    }
    const metrics = await this.reminders.metrics();
    this.logger.info('reminder reconciliation', 'reminders', metrics);
  }
  async onModuleDestroy() {
    this.stopping = true;
    if (this.timer) clearTimeout(this.timer);
    await this.tick;
    await this.worker?.close();
    await this.queue?.close();
    this.logger.info('reminder worker drained', 'lifecycle');
  }
}
