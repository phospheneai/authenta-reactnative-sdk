"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerError = exports.ValidationError = exports.InsufficientCreditsError = exports.QuotaExceededError = exports.AuthorizationError = exports.AuthenticationError = exports.AuthentaError = void 0;
class AuthentaError extends Error {
    constructor(message, code, statusCode, details) {
        super(message);
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.name = 'AuthentaError';
    }
}
exports.AuthentaError = AuthentaError;
class AuthenticationError extends AuthentaError {
    constructor(message, statusCode, details) {
        super(message, 'IAM001', statusCode, details);
        this.name = 'AuthenticationError';
    }
}
exports.AuthenticationError = AuthenticationError;
class AuthorizationError extends AuthentaError {
    constructor(message, statusCode, details) {
        super(message, 'IAM002', statusCode, details);
        this.name = 'AuthorizationError';
    }
}
exports.AuthorizationError = AuthorizationError;
class QuotaExceededError extends AuthentaError {
    constructor(message, statusCode, details) {
        super(message, 'AA001', statusCode, details);
        this.name = 'QuotaExceededError';
    }
}
exports.QuotaExceededError = QuotaExceededError;
class InsufficientCreditsError extends AuthentaError {
    constructor(message, statusCode, details) {
        super(message, 'U007', statusCode, details);
        this.name = 'InsufficientCreditsError';
    }
}
exports.InsufficientCreditsError = InsufficientCreditsError;
class ValidationError extends AuthentaError {
    constructor(message, code, statusCode, details) {
        super(message, code, statusCode, details);
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class ServerError extends AuthentaError {
    constructor(message, code, statusCode, details) {
        super(message, code, statusCode, details);
        this.name = 'ServerError';
    }
}
exports.ServerError = ServerError;
