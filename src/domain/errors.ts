export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class DuplicateInteractionError extends AppError {
  constructor(public readonly existingInteractionId: string) {
    super('DUPLICATE_INTERACTION', 'An interaction with this eventId already exists.', 409);
  }
}

export class NotFoundError extends AppError {
  constructor() {
    super('INTERACTION_NOT_FOUND', 'Interaction not found.', 404);
  }
}

export class DatabaseUnavailableError extends AppError {
  constructor() {
    super('DATABASE_UNAVAILABLE', 'Database is temporarily unavailable.', 503);
  }
}
