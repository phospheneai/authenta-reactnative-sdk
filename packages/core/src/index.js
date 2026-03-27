"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeJsonParse = exports.isVideo = exports.isImage = exports.getMimeType = exports.AuthentaClient = void 0;
var client_1 = require("./client");
Object.defineProperty(exports, "AuthentaClient", { enumerable: true, get: function () { return client_1.AuthentaClient; } });
__exportStar(require("./types"), exports);
__exportStar(require("./errors"), exports);
var helpers_1 = require("./utils/helpers");
Object.defineProperty(exports, "getMimeType", { enumerable: true, get: function () { return helpers_1.getMimeType; } });
Object.defineProperty(exports, "isImage", { enumerable: true, get: function () { return helpers_1.isImage; } });
Object.defineProperty(exports, "isVideo", { enumerable: true, get: function () { return helpers_1.isVideo; } });
Object.defineProperty(exports, "safeJsonParse", { enumerable: true, get: function () { return helpers_1.safeJsonParse; } });
