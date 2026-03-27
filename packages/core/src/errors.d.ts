export declare class AuthentaError extends Error {
    readonly code?: string | undefined;
    readonly statusCode?: number | undefined;
    readonly details?: Record<string, any> | undefined;
    constructor(message: string, code?: string | undefined, statusCode?: number | undefined, details?: Record<string, any> | undefined);
}
export declare class AuthenticationError extends AuthentaError {
    constructor(message: string, statusCode?: number, details?: Record<string, any>);
}
export declare class AuthorizationError extends AuthentaError {
    constructor(message: string, statusCode?: number, details?: Record<string, any>);
}
export declare class QuotaExceededError extends AuthentaError {
    constructor(message: string, statusCode?: number, details?: Record<string, any>);
}
export declare class InsufficientCreditsError extends AuthentaError {
    constructor(message: string, statusCode?: number, details?: Record<string, any>);
}
export declare class ValidationError extends AuthentaError {
    constructor(message: string, code?: string, statusCode?: number, details?: Record<string, any>);
}
export declare class ServerError extends AuthentaError {
    constructor(message: string, code?: string, statusCode?: number, details?: Record<string, any>);
}
