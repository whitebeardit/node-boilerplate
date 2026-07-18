import { BadRequestError } from '../../../domain/errors/bad-request.error';
import { IParamsCreateUser } from '../../../domain/user/interfaces/user.service.interface';

export interface IUserNewPayload {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
}

const REQUIRED_STRING_FIELDS = ['id', 'name', 'email'] as const;

/**
 * Validates the USER.NEW message body against the asyncapi.yaml contract.
 * Throws BadRequestError — a non-retryable failure: redelivering a malformed
 * message can never make it valid.
 */
export function parseUserNewPayload(
  body: string | undefined,
): IParamsCreateUser {
  if (!body) {
    throw new BadRequestError('USER.NEW message has no body');
  }

  let payload: Partial<IUserNewPayload>;
  try {
    payload = JSON.parse(body);
  } catch {
    throw new BadRequestError('USER.NEW message body is not valid JSON');
  }

  for (const field of REQUIRED_STRING_FIELDS) {
    if (typeof payload[field] !== 'string' || payload[field] === '') {
      throw new BadRequestError(
        `USER.NEW payload is missing required field: ${field}`,
      );
    }
  }

  const createdAt = payload.createdAt
    ? new Date(payload.createdAt)
    : new Date();
  if (Number.isNaN(createdAt.getTime())) {
    throw new BadRequestError('USER.NEW payload has an invalid createdAt');
  }

  return {
    id: payload.id as string,
    name: payload.name as string,
    email: payload.email as string,
    createdAt,
  };
}
