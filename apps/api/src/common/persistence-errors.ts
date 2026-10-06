import { Prisma } from '@crm/database';
import { ApplicationError } from './application-error.js';
export async function persist<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      switch (error.code) {
        case 'P2002':
          throw new ApplicationError(
            'RESOURCE_CONFLICT',
            'A record with this unique identifier already exists.',
          );
        case 'P2003':
        case 'P2025':
          throw new ApplicationError(
            'RESOURCE_NOT_FOUND',
            'A required related resource does not exist.',
          );
        case 'P2000':
        case 'P2004':
          throw new ApplicationError(
            'INVALID_INPUT',
            'The data violates a persistence constraint.',
          );
      }
    }
    throw error;
  }
}
