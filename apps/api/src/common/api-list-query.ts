import { applyDecorators } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';
import type { z } from 'zod';
import { openApiSchema } from './openapi-schema.js';
export function ApiListQuery(schema: z.ZodObject<Record<string, z.ZodType>>) {
  return applyDecorators(
    ...Object.entries(schema.shape).map(([name, value]) =>
      ApiQuery({ name, required: false, schema: openApiSchema(value, 'input') }),
    ),
  );
}
