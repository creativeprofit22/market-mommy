export type ErrorCode =
  | 'validation' | 'unauthorized' | 'conflict' | 'not-found' | 'policy-denied'
  | 'unavailable' | 'budget-exhausted' | 'storage-failure' | 'reconciliation-required';

const messages: Record<ErrorCode, string> = {
  validation: 'Check the request fields and limits.',
  unauthorized: 'This entry point does not have permission for that action.',
  conflict: 'Saved state or request identity differs. Reload before retrying.',
  'not-found': 'The selected record is not available.',
  'policy-denied': 'This action is not allowed by the local fixture policy.',
  unavailable: 'This capability is not implemented in the fixture foundation.',
  'budget-exhausted': 'The remaining allowance cannot cover this action.',
  'storage-failure': 'The save was not confirmed. Do not repeat external work.',
  'reconciliation-required': 'Previous completion or billing must be reconciled first.',
};

/** Only fixed messages cross transport boundaries; never serialize cause/input. */
export class DomainError extends Error {
  constructor(readonly code: ErrorCode) {
    super(messages[code]);
    this.name = 'DomainError';
  }
}
export function safeError(error: unknown): { code: ErrorCode; message: string } {
  const code = error instanceof DomainError ? error.code : 'storage-failure';
  return { code, message: messages[code] };
}
