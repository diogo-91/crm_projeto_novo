import { Writable } from 'node:stream';
import { expect, it } from 'vitest';
import { StructuredLogger } from './structured-logger.js';
it('emits structured fields and redacts database URLs', () => {
  const chunks: string[] = [];
  const destination = new Writable({
    write(chunk: Buffer, _encoding, callback) {
      chunks.push(chunk.toString());
      callback();
    },
  });
  const logger = new StructuredLogger('test', 'info', destination);
  logger.info('connection postgresql://user:private@localhost/crm failed', 'database', {
    requestId: 'request-1',
  });
  const combined = chunks.join('');
  const event: unknown = JSON.parse(combined);
  expect(event).toMatchObject({
    level: 'info',
    context: 'database',
    requestId: 'request-1',
    name: 'test',
  });
  expect(event).toHaveProperty('timestamp');
  expect(combined).not.toContain('private');
});
