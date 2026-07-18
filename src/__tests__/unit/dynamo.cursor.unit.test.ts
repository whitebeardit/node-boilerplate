import {
  decodeCursor,
  encodeCursor,
} from '../../infrastructure/db/dynamo/dynamo.cursor';
import { BadRequestError } from '../../domain/errors/bad-request.error';

describe('When we encode and decode a pagination cursor', () => {
  it('should round-trip the last evaluated key', () => {
    const lastEvaluatedKey = { id: 'user-42' };

    const cursor = encodeCursor(lastEvaluatedKey);

    expect(decodeCursor(cursor)).toEqual(lastEvaluatedKey);
  });

  it('should produce an opaque token without key attributes in clear text', () => {
    expect(encodeCursor({ id: 'user-42' })).not.toContain('user-42');
  });
});

describe('When we decode a malformed cursor', () => {
  it('should throw BadRequestError for a token that is not valid JSON', () => {
    expect(() => decodeCursor('not-a-valid-cursor')).toThrow(BadRequestError);
  });

  it('should throw BadRequestError for a token that is not an object', () => {
    const cursor = Buffer.from(JSON.stringify(['id'])).toString('base64url');

    expect(() => decodeCursor(cursor)).toThrow('Invalid pagination cursor');
  });
});
