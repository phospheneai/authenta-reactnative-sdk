"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
exports.__esModule = true;
exports.ServerError = exports.ValidationError = exports.InsufficientCreditsError = exports.QuotaExceededError = exports.AuthorizationError = exports.AuthenticationError = exports.AuthentaError = void 0;
var AuthentaError = /** @class */ (function (_super) {
    __extends(AuthentaError, _super);
    function AuthentaError(message, code, statusCode, details) {
        var _this = _super.call(this, message) || this;
        _this.code = code;
        _this.statusCode = statusCode;
        _this.details = details;
        _this.name = 'AuthentaError';
        return _this;
    }
    return AuthentaError;
}(Error));
exports.AuthentaError = AuthentaError;
var AuthenticationError = /** @class */ (function (_super) {
    __extends(AuthenticationError, _super);
    function AuthenticationError(message, statusCode, details) {
        var _this = _super.call(this, message, 'IAM001', statusCode, details) || this;
        _this.name = 'AuthenticationError';
        return _this;
    }
    return AuthenticationError;
}(AuthentaError));
exports.AuthenticationError = AuthenticationError;
var AuthorizationError = /** @class */ (function (_super) {
    __extends(AuthorizationError, _super);
    function AuthorizationError(message, statusCode, details) {
        var _this = _super.call(this, message, 'IAM002', statusCode, details) || this;
        _this.name = 'AuthorizationError';
        return _this;
    }
    return AuthorizationError;
}(AuthentaError));
exports.AuthorizationError = AuthorizationError;
var QuotaExceededError = /** @class */ (function (_super) {
    __extends(QuotaExceededError, _super);
    function QuotaExceededError(message, statusCode, details) {
        var _this = _super.call(this, message, 'AA001', statusCode, details) || this;
        _this.name = 'QuotaExceededError';
        return _this;
    }
    return QuotaExceededError;
}(AuthentaError));
exports.QuotaExceededError = QuotaExceededError;
var InsufficientCreditsError = /** @class */ (function (_super) {
    __extends(InsufficientCreditsError, _super);
    function InsufficientCreditsError(message, statusCode, details) {
        var _this = _super.call(this, message, 'U007', statusCode, details) || this;
        _this.name = 'InsufficientCreditsError';
        return _this;
    }
    return InsufficientCreditsError;
}(AuthentaError));
exports.InsufficientCreditsError = InsufficientCreditsError;
var ValidationError = /** @class */ (function (_super) {
    __extends(ValidationError, _super);
    function ValidationError(message, code, statusCode, details) {
        var _this = _super.call(this, message, code, statusCode, details) || this;
        _this.name = 'ValidationError';
        return _this;
    }
    return ValidationError;
}(AuthentaError));
exports.ValidationError = ValidationError;
var ServerError = /** @class */ (function (_super) {
    __extends(ServerError, _super);
    function ServerError(message, code, statusCode, details) {
        var _this = _super.call(this, message, code, statusCode, details) || this;
        _this.name = 'ServerError';
        return _this;
    }
    return ServerError;
}(AuthentaError));
exports.ServerError = ServerError;
