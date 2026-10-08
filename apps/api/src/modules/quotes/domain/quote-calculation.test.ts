import { it, expect } from 'vitest';
import { calculateQuote } from './quote-calculation.js';
it('rounds half-up per line then sums, instead of rounding only the aggregate', () => {
  const result = calculateQuote([
    { quantity: '1', unitPrice: '0.005000', discountPercent: '0' },
    { quantity: '1', unitPrice: '0.005000', discountPercent: '0' },
  ]);
  expect(result.total).toBe('0.02');
});
it('rounds discount on the rounded line gross and subtracts exactly', () => {
  expect(
    calculateQuote([{ quantity: '1', unitPrice: '0.015', discountPercent: '50' }]),
  ).toMatchObject({ subtotal: '0.02', discount: '0.01', total: '0.01' });
});
it('multiplies six-place quantity and price without float loss', () => {
  expect(
    calculateQuote([{ quantity: '1.234567', unitPrice: '123.123456', discountPercent: '12.34' }]),
  ).toMatchObject({ subtotal: '152.00', discount: '18.76', total: '133.24' });
});
it('preserves large integers beyond safe number range', () => {
  expect(
    calculateQuote([{ quantity: '999', unitPrice: '999999999999.999999', discountPercent: '0' }])
      .total,
  ).toBe('999000000000000.00');
});
it.each(['0', '100'])('accepts discount boundary %s', (discountPercent) => {
  const result = calculateQuote([{ quantity: '2', unitPrice: '10', discountPercent }]);
  expect(result.total).toBe(discountPercent === '100' ? '0.00' : '20.00');
});
it.each([
  { quantity: '0', unitPrice: '1', discountPercent: '0' },
  { quantity: '-1', unitPrice: '1', discountPercent: '0' },
  { quantity: '1', unitPrice: '-1', discountPercent: '0' },
  { quantity: '1.2.3', unitPrice: '1', discountPercent: '0' },
  { quantity: '1.', unitPrice: '1', discountPercent: '0' },
  { quantity: '1', unitPrice: '1.0000001', discountPercent: '0' },
  { quantity: '1', unitPrice: '1', discountPercent: '100.01' },
  { quantity: '1', unitPrice: '1', discountPercent: '1.001' },
  { quantity: '999999999999', unitPrice: '999999999999', discountPercent: '0' },
])('rejects invalid precision, signs, discount or overflow: %j', (line) => {
  expect(() => calculateQuote([line])).toThrow();
});
it('rejects overflow after summing valid individual lines', () => {
  expect(() =>
    calculateQuote(
      Array.from({ length: 2 }, () => ({
        quantity: '900',
        unitPrice: '999999999999',
        discountPercent: '0',
      })),
    ),
  ).toThrow();
});
it('rejects empty and excessive item collections', () => {
  expect(() => calculateQuote([])).toThrow();
  expect(() =>
    calculateQuote(
      Array.from({ length: 101 }, () => ({ quantity: '1', unitPrice: '1', discountPercent: '0' })),
    ),
  ).toThrow();
});
