import { z } from 'zod';
import { DomainError } from './errors.js';

export const idSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/);
export const versionSchema = z.number().int().min(1).max(2_147_483_647);
export const expectedVersionSchema = z.number().int().min(0).max(2_147_483_646);
export const textSchema = z.string().trim().min(1).max(2_000);
export const shortTextSchema = z.string().trim().min(1).max(200);
export const timeSchema = z.iso.datetime({ offset: true });
export const referenceSchema = z.strictObject({ id: idSchema, version: versionSchema });
export const referencesSchema = z.array(referenceSchema).max(50).refine(
  values => new Set(values.map(value => `${value.id}:${value.version}`)).size === values.length,
);
export const recordFields = { id: idSchema, version: versionSchema, createdAt: timeSchema };
export type Reference = z.infer<typeof referenceSchema>;

export function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new DomainError('validation');
  return result.data;
}
export function nextVersion(current: number, expected: number): number {
  validate(expectedVersionSchema, expected);
  if (!Number.isInteger(current) || current < 0 || current > 2_147_483_646) throw new DomainError('validation');
  if (current !== expected) throw new DomainError('conflict');
  return current + 1;
}
