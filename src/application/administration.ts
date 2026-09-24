import { z } from 'zod';
import { idSchema } from '../domain/common.js';

const path = z.string().min(1).max(4096);
/** Internal local-administrator port. Never add these operations to command/tool schemas. */
export const administrationRequestSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('backup'), destination: path }),
  z.strictObject({ action: z.literal('export'), destination: path }),
  z.strictObject({ action: z.literal('exportRemovalLedger'), destination: path }),
  z.strictObject({ action: z.literal('removeFixtures'), recordIds: z.array(idSchema).min(1).max(64) }),
  z.strictObject({ action: z.literal('reapplyRemovalLedger'), ledger: path }),
  z.strictObject({ action: z.literal('import'), source: path, destination: path, ledger: path }),
  z.strictObject({ action: z.literal('restoreBackup'), source: path, destination: path, ledger: path, checksum: z.string().regex(/^[a-f0-9]{64}$/) }),
]);
export type AdministrationRequest = z.infer<typeof administrationRequestSchema>;
export const administrationResultSchema = z.strictObject({
  artifactId: z.string(), sourceStoreId: z.string(), schemaVersion: z.literal(5),
  ledgerVersion: z.number().int().nonnegative(), checksum: z.string().regex(/^[a-f0-9]{64}$/),
  completedAt: z.iso.datetime(), elapsedMs: z.number().nonnegative(), verified: z.literal(true),
});
export type AdministrationResult = z.infer<typeof administrationResultSchema>;
export interface AdministrativeStoragePort { administer(request: AdministrationRequest): Promise<AdministrationResult> }
