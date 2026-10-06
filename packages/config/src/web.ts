import { z } from 'zod';
const schema = z.object({
  NEXT_PUBLIC_API_URL: z
    .url()
    .pipe(z.string().refine((value) => ['http:', 'https:'].includes(new URL(value).protocol))),
});
export function parseWebEnvironment(input: Readonly<Record<string, unknown>>) {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error('Invalid environment configuration: NEXT_PUBLIC_API_URL');
  return result.data;
}
