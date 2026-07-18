/**
 * Base class for business errors. The HTTP status carried here is mapped to the
 * response by the global error handler in `interfaces/http/server.ts` — services
 * and controllers never translate errors to status codes themselves.
 */
export class DomainError extends Error {
  public readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
  }
}
