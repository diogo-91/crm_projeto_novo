import { z } from 'zod';
import type { SchemaObject } from '@nestjs/swagger';
function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Invalid OpenAPI schema object');
  return Object.fromEntries(Object.entries(value));
}
const supported = new Set([
  'type',
  'properties',
  'required',
  'items',
  'additionalProperties',
  'nullable',
  'format',
  'pattern',
  'minLength',
  'maxLength',
  'minItems',
  'maxItems',
  'minimum',
  'maximum',
  'default',
  'description',
  'anyOf',
  'allOf',
  'enum',
]);
// Zod emits JSON Schema; convert its supported subset to Swagger's OpenAPI 3 types.
// Unsupported keywords fail documentation generation instead of silently drifting.
function convert(value: unknown): SchemaObject {
  const source = record(value);
  for (const key of Object.keys(source))
    if (!supported.has(key)) throw new Error(`Unsupported OpenAPI keyword: ${key}`);
  const schema: SchemaObject = {};
  if (typeof source['type'] === 'string') schema.type = source['type'];
  if (typeof source['format'] === 'string') schema.format = source['format'];
  if (typeof source['pattern'] === 'string') schema.pattern = source['pattern'];
  if (typeof source['description'] === 'string') schema.description = source['description'];
  if (typeof source['nullable'] === 'boolean') schema.nullable = source['nullable'];
  if (typeof source['minLength'] === 'number') schema.minLength = source['minLength'];
  if (typeof source['maxLength'] === 'number') schema.maxLength = source['maxLength'];
  if (typeof source['minItems'] === 'number') schema.minItems = source['minItems'];
  if (typeof source['maxItems'] === 'number') schema.maxItems = source['maxItems'];
  if (typeof source['minimum'] === 'number') schema.minimum = source['minimum'];
  if (typeof source['maximum'] === 'number') schema.maximum = source['maximum'];
  if ('default' in source) schema.default = source['default'];
  if (source['required'] !== undefined) {
    const required = source['required'];
    if (!Array.isArray(required) || !required.every((item: unknown) => typeof item === 'string'))
      throw new Error('Invalid required fields');
    schema.required = required;
  }
  if (source['enum'] !== undefined) {
    const values = source['enum'];
    if (
      !Array.isArray(values) ||
      !values.every(
        (item: unknown) =>
          typeof item === 'string' ||
          typeof item === 'number' ||
          typeof item === 'boolean' ||
          item === null,
      )
    )
      throw new Error('Invalid enum');
    schema.enum = values;
  }
  if (source['properties'] !== undefined)
    schema.properties = Object.fromEntries(
      Object.entries(record(source['properties'])).map(([key, item]) => [key, convert(item)]),
    );
  if (source['items'] !== undefined) schema.items = convert(source['items']);
  if (source['additionalProperties'] !== undefined)
    schema.additionalProperties =
      typeof source['additionalProperties'] === 'boolean'
        ? source['additionalProperties']
        : convert(source['additionalProperties']);
  for (const key of ['anyOf', 'allOf'] as const) {
    const items = source[key];
    if (items !== undefined) {
      if (!Array.isArray(items)) throw new Error('Invalid composed schema');
      schema[key] = items.map(convert);
    }
  }
  return schema;
}
export function openApiSchema(schema: z.ZodType, io: 'input' | 'output' = 'output'): SchemaObject {
  return convert(z.toJSONSchema(schema, { target: 'openapi-3.0', io }));
}
