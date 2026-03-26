export class AuthentaError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly statusCode?: number,
    public readonly details?: Record<string, any>,
  ) {
    super(message);
    this.name = 'AuthentaError';
  }
}

export class AuthenticationError extends AuthentaError {
  constructor(message: string, statusCode?: number, details?: Record<string, any>) {
    super(message, 'IAM001', statusCode, details);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AuthentaError {
  constructor(message: string, statusCode?: number, details?: Record<string, any>) {
    super(message, 'IAM002', statusCode, details);
    this.name = 'AuthorizationError';
  }
}

export class QuotaExceededError extends AuthentaError {
  constructor(message: string, statusCode?: number, details?: Record<string, any>) {
    super(message, 'AA001', statusCode, details);
    this.name = 'QuotaExceededError';
  }
}

export class InsufficientCreditsError extends AuthentaError {
  constructor(message: string, statusCode?: number, details?: Record<string, any>) {
    super(message, 'U007', statusCode, details);
    this.name = 'InsufficientCreditsError';
  }
}

export class ValidationError extends AuthentaError {
  constructor(message: string, code?: string, statusCode?: number, details?: Record<string, any>) {
    super(message, code, statusCode, details);
    this.name = 'ValidationError';
  }
}

export class ServerError extends AuthentaError {
  constructor(message: string, code?: string, statusCode?: number, details?: Record<string, any>) {
    super(message, code, statusCode, details);
    this.name = 'ServerError';
  }
}
