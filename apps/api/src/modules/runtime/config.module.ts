import { Global, Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { parseApiEnvironment, parseWorkerEnvironment } from '@crm/config/server';
export const RUNTIME_CONFIG = Symbol('RUNTIME_CONFIG');
@Global()
@Module({})
export class RuntimeConfigModule {
  static forRoot(role: 'api' | 'worker'): DynamicModule {
    return {
      module: RuntimeConfigModule,
      providers: [
        {
          provide: RUNTIME_CONFIG,
          useFactory: () =>
            role === 'api' ? parseApiEnvironment(process.env) : parseWorkerEnvironment(process.env),
        },
      ],
      exports: [RUNTIME_CONFIG],
    };
  }
}
