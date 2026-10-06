import type { PipeTransform } from '@nestjs/common';
import type { z } from 'zod';
import { ApplicationError } from './application-error.js';
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: z.ZodType<T>) {}
  transform(value: unknown): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success)
      throw new ApplicationError(
        'INVALID_INPUT',
        'The request contains invalid or unexpected fields.',
      );
    return parsed.data;
  }
}
