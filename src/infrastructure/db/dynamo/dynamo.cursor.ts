import { BadRequestError } from '../../../domain/errors/bad-request.error';

/**
 * Pagination cursors are the DynamoDB ExclusiveStartKey encoded as an opaque
 * base64url token, so key attributes never leak into the API surface. A
 * malformed token is a client error (400), not a server one.
 */
export function encodeCursor(lastEvaluatedKey: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(lastEvaluatedKey)).toString('base64url');
}

export function decodeCursor(cursor: string): Record<string, unknown> {
  try {
    const decoded: unknown = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    );
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      Array.isArray(decoded)
    ) {
      throw new Error('Cursor is not an object');
    }
    return decoded as Record<string, unknown>;
  } catch {
    throw new BadRequestError('Invalid pagination cursor');
  }
}
