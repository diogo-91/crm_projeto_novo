import { ApplicationError } from '../../../common/application-error.js';
export type CalculationLine = { quantity: string; unitPrice: string; discountPercent: string };
function scaled(value: string, scale: number): bigint {
  const [integer = '', fraction = ''] = value.split('.');
  if (!/^\d+(\.\d+)?$/.test(value) || fraction.length > scale)
    throw new ApplicationError('INVALID_INPUT', 'Invalid decimal precision.');
  return BigInt(integer + fraction.padEnd(scale, '0'));
}
function rounded(value: bigint, divisor: bigint): bigint {
  return (value + divisor / 2n) / divisor;
}
function money(cents: bigint): string {
  if (cents < 0n || cents > 99999999999999999n)
    throw new ApplicationError('INVALID_INPUT', 'Quote amount exceeds supported limits.');
  return `${cents / 100n}.${(cents % 100n).toString().padStart(2, '0')}`;
}
export function calculateQuote(input: CalculationLine[]) {
  if (input.length < 1 || input.length > 100)
    throw new ApplicationError('INVALID_INPUT', 'Quote requires 1 to 100 items.');
  let subtotal = 0n,
    discount = 0n,
    total = 0n;
  const items = input.map((line) => {
    const quantity = scaled(line.quantity, 6),
      price = scaled(line.unitPrice, 6),
      percent = scaled(line.discountPercent, 2);
    if (
      quantity <= 0n ||
      quantity >= 1000000000000000000n ||
      price >= 1000000000000000000n ||
      percent > 10000n
    )
      throw new ApplicationError('INVALID_INPUT', 'Invalid quantity, price or discount.');
    const gross = rounded(quantity * price, 10000000000n);
    const reduction = rounded(gross * percent, 10000n);
    const net = gross - reduction;
    subtotal += gross;
    discount += reduction;
    total += net;
    return { subtotal: money(gross), discount: money(reduction), total: money(net) };
  });
  return { items, subtotal: money(subtotal), discount: money(discount), total: money(total) };
}
