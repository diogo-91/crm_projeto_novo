import { z } from 'zod';
export const emailSchema = z.string().trim().toLowerCase().check(z.email()).max(254);
export const newPasswordSchema = z.string().min(12).max(128);
