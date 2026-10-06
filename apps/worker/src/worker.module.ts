import { Module } from '@nestjs/common';
import { RuntimeConfigModule, LoggingModule } from '@crm/api/runtime';
import { TechnicalWorkerService } from './jobs/technical-worker.service.js';
@Module({
  imports: [RuntimeConfigModule.forRoot('worker'), LoggingModule],
  providers: [TechnicalWorkerService],
})
export class WorkerModule {}
