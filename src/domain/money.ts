import { z } from 'zod';
import { validate } from './common.js';
import { DomainError } from './errors.js';

/** Exact signed-64-bit-compatible wire integers; no floating-point money. */
export const MAX_MINOR_UNITS = 9_223_372_036_854_775_807n;
export const minorUnitsSchema = z.string().regex(/^(0|[1-9][0-9]{0,18})$/)
  .refine(value => /^(0|[1-9][0-9]{0,18})$/.test(value) && BigInt(value) <= MAX_MINOR_UNITS);
export const moneySchema = z.strictObject({
  minorUnits: minorUnitsSchema,
  currency: z.literal('USD'),
  scale: z.literal(2),
  basis: z.enum(['observed', 'assumed']),
  includedExpenses: z.array(z.string().min(1).max(200)).max(20),
  excludedExpenses: z.array(z.string().min(1).max(200)).max(20),
});
export type Money = z.infer<typeof moneySchema>;
export function addMinorUnits(...values: string[]): string {
  let total = 0n;
  for (const value of values) {
    total += BigInt(validate(minorUnitsSchema, value));
    if (total > MAX_MINOR_UNITS) throw new DomainError('validation');
  }
  return total.toString();
}
export function remainingMinorUnits(cap: string, encumbered: string): string {
  const remaining = BigInt(validate(minorUnitsSchema, cap)) - BigInt(validate(minorUnitsSchema, encumbered));
  if (remaining < 0n) throw new DomainError('budget-exhausted');
  return remaining.toString();
}
