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
    super(message, 'INVALID_API_KEY', statusCode, details);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AuthentaError {
  constructor(message: string, statusCode?: number, details?: Record<string, any>) {
    super(message, 'FORBIDDEN', statusCode, details);
    this.name = 'AuthorizationError';
  }
}

export class InsufficientBalanceError extends AuthentaError {
  constructor(message: string, statusCode?: number, details?: Record<string, any>) {
    super(message, 'INSUFFICIENT_BALANCE', statusCode, details);
    this.name = 'InsufficientBalanceError';
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
