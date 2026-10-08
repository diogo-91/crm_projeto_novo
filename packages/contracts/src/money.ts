import { z } from 'zod';
export const currencySchema = z.enum(['BRL', 'USD', 'EUR', 'GBP']);
export const amountSchema = z
  .string()
  .regex(/^\d{1,15}(\.\d{1,4})?$/, 'Informe valor positivo com até quatro casas decimais.');
export const unitPriceSchema = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,6})?$/, 'Informe um preço não negativo com até seis casas decimais.');
