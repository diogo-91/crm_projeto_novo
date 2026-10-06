import { PublicEndpoint } from '../../common/security.js';
import { Controller, Get, Inject, Res } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import type { SchemaObject } from '@nestjs/swagger';
import { healthResponseSchema } from '@crm/contracts';
import type { HealthResponse } from '@crm/contracts';
import { HealthService } from './health.service.js';
// OpenAPI presentation mapping: keys checked against the shared contract; enum values
// come from its Zod schemas. No casts between incompatible JSON Schema library types.
const dependencyProperties = {
  database: { type: 'string', enum: healthResponseSchema.shape.services.shape.database.options },
  redis: { type: 'string', enum: healthResponseSchema.shape.services.shape.redis.options },
} satisfies Record<keyof HealthResponse['services'], SchemaObject>;
const responseProperties = {
  status: { type: 'string', enum: healthResponseSchema.shape.status.options },
  services: {
    type: 'object',
    required: Object.keys(dependencyProperties),
    properties: dependencyProperties,
  },
} satisfies Record<keyof HealthResponse, SchemaObject>;
const responseSchema: SchemaObject = {
  type: 'object',
  required: Object.keys(responseProperties),
  properties: responseProperties,
};
@PublicEndpoint()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@Inject(HealthService) private readonly health: HealthService) {}
  @Get()
  @ApiOkResponse({ description: 'Dependencies available', schema: responseSchema })
  @ApiServiceUnavailableResponse({
    description: 'Required dependency unavailable',
    schema: responseSchema,
  })
  async status(@Res({ passthrough: true }) response: Response): Promise<HealthResponse> {
    const result = await this.health.readiness();
    response.status(result.status === 'ok' ? 200 : 503);
    return result;
  }
  @Get('live')
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['ok'] } },
      required: ['status'],
    },
  })
  live(): { status: 'ok' } {
    return { status: 'ok' };
  }
  @Get('ready')
  @ApiOkResponse({ description: 'Ready', schema: responseSchema })
  @ApiServiceUnavailableResponse({ description: 'Not ready', schema: responseSchema })
  readiness(@Res({ passthrough: true }) response: Response): Promise<HealthResponse> {
    return this.status(response);
  }
}
