/**
 * Domain errors thrown by module services. Server actions translate them into
 * user-facing results; anything else is an unexpected error (logged, generic message).
 */
export class DomainError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ForbiddenError extends DomainError {
  constructor(readonly permission?: string) {
    super("You do not have permission to perform this action.", "FORBIDDEN");
  }
}

export class NotFoundError extends DomainError {
  constructor(entity: string) {
    super(`${entity} not found.`, "NOT_FOUND");
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message, "CONFLICT");
  }
}

export class RateLimitedError extends DomainError {
  constructor(readonly retryAfterSeconds: number) {
    super("Too many attempts. Please wait a moment and try again.", "RATE_LIMITED");
  }
}

/** Input that failed business validation; `fieldErrors` maps form field names to messages. */
export class ValidationError extends DomainError {
  constructor(
    message: string,
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message, "VALIDATION");
  }
}
