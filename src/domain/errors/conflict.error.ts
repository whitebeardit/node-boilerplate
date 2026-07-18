import { DomainError } from './domain.error';

export class ConflictError extends DomainError {
  constructor(message = 'Resource already exists') {
    super(message, 409);
  }
}
