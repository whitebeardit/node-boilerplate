import { DomainError } from './domain.error';

export class BadRequestError extends DomainError {
  constructor(message = 'Bad request') {
    super(message, 400);
  }
}
