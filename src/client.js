"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
exports.AuthentaClient = void 0;
var errors_1 = require("./errors");
var helpers_1 = require("./utils/helpers");
var TERMINAL_STATUSES = new Set(['PROCESSED', 'FAILED', 'ERROR']);
var AuthentaClient = /** @class */ (function () {
    function AuthentaClient(_a) {
        var _b = _a.baseUrl, baseUrl = _b === void 0 ? 'https://platform.authenta.ai' : _b, clientId = _a.clientId, clientSecret = _a.clientSecret;
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }
    Object.defineProperty(AuthentaClient.prototype, "authHeaders", {
        // ─── Private helpers ───────────────────────────────────────────────────────
        get: function () {
            return {
                'x-client-id': this.clientId,
                'x-client-secret': this.clientSecret,
                'Content-Type': 'application/json'
            };
        },
        enumerable: false,
        configurable: true
    });
    AuthentaClient.prototype.request = function (method, path, body, queryParams) {
        return __awaiter(this, void 0, void 0, function () {
            var url, qs, response, text;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        url = "".concat(this.baseUrl).concat(path);
                        if (queryParams) {
                            qs = Object.entries(queryParams)
                                .filter(function (_a) {
                                var v = _a[1];
                                return v !== undefined && v !== null;
                            })
                                .map(function (_a) {
                                var k = _a[0], v = _a[1];
                                return "".concat(encodeURIComponent(k), "=").concat(encodeURIComponent(String(v)));
                            })
                                .join('&');
                            if (qs)
                                url += "?".concat(qs);
                        }
                        return [4 /*yield*/, fetch(url, {
                                method: method,
                                headers: this.authHeaders,
                                body: body !== undefined ? JSON.stringify(body) : undefined
                            })];
                    case 1:
                        response = _a.sent();
                        if (!!response.ok) return [3 /*break*/, 3];
                        return [4 /*yield*/, this.throwApiError(response)];
                    case 2:
                        _a.sent();
                        _a.label = 3;
                    case 3: return [4 /*yield*/, response.text()];
                    case 4:
                        text = _a.sent();
                        if (!text.trim())
                            return [2 /*return*/, {}];
                        try {
                            return [2 /*return*/, JSON.parse(text)];
                        }
                        catch (_b) {
                            throw new errors_1.ValidationError('Expected JSON but received non-JSON response', undefined, response.status, { body: text.slice(0, 200) });
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    AuthentaClient.prototype.throwApiError = function (response) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function () {
            var status, data, _d, text, code, message;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        status = response.status;
                        _e.label = 1;
                    case 1:
                        _e.trys.push([1, 3, , 5]);
                        return [4 /*yield*/, response.json()];
                    case 2:
                        data = _e.sent();
                        return [3 /*break*/, 5];
                    case 3:
                        _d = _e.sent();
                        return [4 /*yield*/, response.text()["catch"](function () { return ''; })];
                    case 4:
                        text = _e.sent();
                        if (status >= 500)
                            throw new errors_1.ServerError(text || 'Server error', undefined, status);
                        throw new errors_1.ValidationError(text || 'Client error', undefined, status);
                    case 5:
                        code = (_a = data === null || data === void 0 ? void 0 : data.code) !== null && _a !== void 0 ? _a : 'unknown';
                        message = (_c = (_b = data === null || data === void 0 ? void 0 : data.message) !== null && _b !== void 0 ? _b : response.statusText) !== null && _c !== void 0 ? _c : 'Unknown error';
                        if (code === 'IAM001')
                            throw new errors_1.AuthenticationError(message, status, data);
                        if (code === 'IAM002')
                            throw new errors_1.AuthorizationError(message, status, data);
                        if (code === 'AA001')
                            throw new errors_1.QuotaExceededError(message, status, data);
                        if (code === 'U007')
                            throw new errors_1.InsufficientCreditsError(message, status, data);
                        if (status >= 500)
                            throw new errors_1.ServerError(message, code, status, data);
                        if (status >= 400)
                            throw new errors_1.ValidationError(message, code, status, data);
                        throw new errors_1.AuthentaError(message, code, status, data);
                }
            });
        });
    };
    /** Fetch a local URI once — derives name, type, size, and blob for upload.
     *  In React Native uses XMLHttpRequest (fetch('file://...') fails on Android).
     *  In Node.js (tests) uses fs since XMLHttpRequest is not available. */
    AuthentaClient.prototype.resolveUri = function (uri) {
        var _a, _b;
        var name = (_b = (_a = uri.split('/').pop()) === null || _a === void 0 ? void 0 : _a.split('?')[0]) !== null && _b !== void 0 ? _b : 'file';
        var type = (0, helpers_1.getMimeType)(name);
        // Node.js environment — XMLHttpRequest does not exist
        if (typeof XMLHttpRequest === 'undefined') {
            // Use aliased require so Metro's static analyser does not try to bundle 'fs'
            var _require = require;
            var fs = _require('fs');
            var filePath = uri.replace(/^file:\/\//, '');
            var buffer = fs.readFileSync(filePath);
            var blob = new Blob([buffer], { type: type });
            return Promise.resolve({ name: name, type: type, size: buffer.byteLength, blob: blob });
        }
        // React Native — use XHR
        return new Promise(function (resolve, reject) {
            var xhr = new XMLHttpRequest();
            xhr.responseType = 'blob';
            xhr.onload = function () { return resolve({ name: name, type: type, size: xhr.response.size, blob: xhr.response }); };
            xhr.onerror = function () { return reject(new errors_1.AuthentaError("Could not read file at URI: ".concat(uri))); };
            xhr.open('GET', uri);
            xhr.send();
        });
    };
    AuthentaClient.prototype.uploadToS3 = function (uploadUrl, blob, contentType) {
        return __awaiter(this, void 0, void 0, function () {
            var putResponse;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, fetch(uploadUrl, {
                            method: 'PUT',
                            headers: { 'Content-Type': contentType },
                            body: blob
                        })];
                    case 1:
                        putResponse = _a.sent();
                        if (!putResponse.ok) {
                            throw new errors_1.AuthentaError("S3 upload failed: HTTP ".concat(putResponse.status), undefined, putResponse.status);
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    // ─── Core media CRUD ───────────────────────────────────────────────────────
    AuthentaClient.prototype.createMedia = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('POST', '/api/media', params)];
            });
        });
    };
    AuthentaClient.prototype.getMedia = function (mid) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('GET', "/api/media/".concat(mid))];
            });
        });
    };
    AuthentaClient.prototype.listMedia = function (params) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.request('GET', '/api/media', undefined, params)];
            });
        });
    };
    AuthentaClient.prototype.deleteMedia = function (mid) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.request('DELETE', "/api/media/".concat(mid))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    // ─── Upload (common for all models) ───────────────────────────────────────
    /**
     * Two-step upload: derives file info from the URI, creates a media record,
     * then PUTs the file blob to S3. Works for all model types.
     * Pass `fiOptions` only when modelType is "FI-1".
     */
    AuthentaClient.prototype.upload = function (uri, modelType, fiOptions) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, name, type, size, blob, payload, _b, isSingleFace, _c, faceswapCheck, _d, livenessCheck, _e, faceSimilarityCheck, media, _f, refBlob, refType;
            return __generator(this, function (_g) {
                switch (_g.label) {
                    case 0: return [4 /*yield*/, this.resolveUri(uri)];
                    case 1:
                        _a = _g.sent(), name = _a.name, type = _a.type, size = _a.size, blob = _a.blob;
                        payload = {
                            name: name,
                            contentType: type,
                            size: size,
                            modelType: modelType
                        };
                        if (modelType.toUpperCase() === 'FI-1' && fiOptions) {
                            _b = fiOptions.isSingleFace, isSingleFace = _b === void 0 ? true : _b, _c = fiOptions.faceswapCheck, faceswapCheck = _c === void 0 ? false : _c, _d = fiOptions.livenessCheck, livenessCheck = _d === void 0 ? false : _d, _e = fiOptions.faceSimilarityCheck, faceSimilarityCheck = _e === void 0 ? false : _e;
                            payload.metadata = { isSingleFace: isSingleFace, faceswapCheck: faceswapCheck, livenessCheck: livenessCheck, faceSimilarityCheck: faceSimilarityCheck };
                        }
                        return [4 /*yield*/, this.createMedia(payload)];
                    case 2:
                        media = _g.sent();
                        return [4 /*yield*/, this.uploadToS3(media.uploadUrl, blob, type)];
                    case 3:
                        _g.sent();
                        if (!(modelType.toUpperCase() === 'FI-1' && (fiOptions === null || fiOptions === void 0 ? void 0 : fiOptions.faceSimilarityCheck))) return [3 /*break*/, 6];
                        if (!fiOptions.referenceImage) {
                            throw new errors_1.ValidationError('referenceImage is required when faceSimilarityCheck is true');
                        }
                        if (!media.referenceUploadUrl) {
                            throw new errors_1.AuthentaError('No referenceUploadUrl returned from server');
                        }
                        return [4 /*yield*/, this.resolveUri(fiOptions.referenceImage)];
                    case 4:
                        _f = _g.sent(), refBlob = _f.blob, refType = _f.type;
                        return [4 /*yield*/, this.uploadToS3(media.referenceUploadUrl, refBlob, refType)];
                    case 5:
                        _g.sent();
                        _g.label = 6;
                    case 6: return [2 /*return*/, media];
                }
            });
        });
    };
    // ─── Polling ───────────────────────────────────────────────────────────────
    AuthentaClient.prototype.waitForMedia = function (mid, _a) {
        var _b = _a === void 0 ? {} : _a, _c = _b.interval, interval = _c === void 0 ? 5000 : _c, _d = _b.timeout, timeout = _d === void 0 ? 600000 : _d;
        return __awaiter(this, void 0, void 0, function () {
            var deadline, media;
            return __generator(this, function (_e) {
                switch (_e.label) {
                    case 0:
                        deadline = Date.now() + timeout;
                        _e.label = 1;
                    case 1:
                        if (!true) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.getMedia(mid)];
                    case 2:
                        media = _e.sent();
                        if (TERMINAL_STATUSES.has(media.status.toUpperCase()))
                            return [2 /*return*/, media];
                        if (Date.now() >= deadline) {
                            throw new errors_1.AuthentaError("Timed out waiting for media ".concat(mid, " \u2014 last status: ").concat(media.status));
                        }
                        return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, interval); })];
                    case 3:
                        _e.sent();
                        return [3 /*break*/, 1];
                    case 4: return [2 /*return*/];
                }
            });
        });
    };
    // ─── Result ────────────────────────────────────────────────────────────────
    AuthentaClient.prototype.getResult = function (media) {
        return __awaiter(this, void 0, void 0, function () {
            var response;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!media.resultURL) {
                            throw new errors_1.ValidationError('media has no resultURL — ensure processing is complete (status=PROCESSED)');
                        }
                        return [4 /*yield*/, fetch(media.resultURL)];
                    case 1:
                        response = _a.sent();
                        if (!response.ok) {
                            throw new errors_1.AuthentaError("Failed to fetch resultURL: HTTP ".concat(response.status), undefined, response.status);
                        }
                        return [2 /*return*/, response.json()];
                }
            });
        });
    };
    // ─── High-level: one function for all models ──────────────────────────────
    /**
     * Upload a file URI and process it with the given model.
     * The SDK automatically derives the file name, type, and size from the URI.
     *
     * - For all models: uploads, polls until complete, and fetches the result.
     * - For FI-1: pass any face-check flags; unset flags default to false.
     * - Set `autoPolling: false` to return immediately after upload.
     *
     * @example DF-1 / AC-1
     *   const result = await client.faceIntelligence('file:///path/to/video.mp4', 'DF-1');
     *
     * @example FI-1 liveness
     *   const result = await client.faceIntelligence('file:///path/to/selfie.jpg', 'FI-1', { livenessCheck: true });
     *
     * @example FI-1 faceswap (video only)
     *   const result = await client.faceIntelligence('file:///path/to/video.mp4', 'FI-1', { faceswapCheck: true });
     *
     * @example FI-1 similarity
     *   const result = await client.faceIntelligence('file:///path/to/selfie.jpg', 'FI-1', {
     *     faceSimilarityCheck: true,
     *     referenceImage: 'file:///path/to/id-photo.jpg',
     *   });
     */
    AuthentaClient.prototype.faceIntelligence = function (uri, modelType, _a) {
        var _b;
        var _c = _a === void 0 ? {} : _a, _d = _c.autoPolling, autoPolling = _d === void 0 ? true : _d, interval = _c.interval, timeout = _c.timeout, _e = _c.isSingleFace, isSingleFace = _e === void 0 ? true : _e, _f = _c.faceswapCheck, faceswapCheck = _f === void 0 ? false : _f, _g = _c.livenessCheck, livenessCheck = _g === void 0 ? false : _g, _h = _c.faceSimilarityCheck, faceSimilarityCheck = _h === void 0 ? false : _h, referenceImage = _c.referenceImage;
        return __awaiter(this, void 0, void 0, function () {
            var isFI, type, fiOptions, meta, media, result, _j;
            return __generator(this, function (_k) {
                switch (_k.label) {
                    case 0:
                        isFI = modelType.toUpperCase() === 'FI-1';
                        if (isFI) {
                            type = (0, helpers_1.getMimeType)((_b = uri.split('/').pop()) !== null && _b !== void 0 ? _b : '');
                            if ((0, helpers_1.isImage)(type) && faceswapCheck) {
                                throw new errors_1.ValidationError('faceswapCheck cannot be true for image files');
                            }
                            if ((0, helpers_1.isVideo)(type) && faceSimilarityCheck) {
                                throw new errors_1.ValidationError('faceSimilarityCheck cannot be true for video files');
                            }
                            if (faceSimilarityCheck && !referenceImage) {
                                throw new errors_1.ValidationError('referenceImage is required when faceSimilarityCheck is true');
                            }
                        }
                        fiOptions = isFI
                            ? { isSingleFace: isSingleFace, faceswapCheck: faceswapCheck, livenessCheck: livenessCheck, faceSimilarityCheck: faceSimilarityCheck, referenceImage: referenceImage }
                            : undefined;
                        return [4 /*yield*/, this.upload(uri, modelType, fiOptions)];
                    case 1:
                        meta = _k.sent();
                        if (!autoPolling)
                            return [2 /*return*/, meta];
                        return [4 /*yield*/, this.waitForMedia(meta.mid, { interval: interval, timeout: timeout })];
                    case 2:
                        media = _k.sent();
                        if (!media.resultURL) return [3 /*break*/, 4];
                        return [4 /*yield*/, this.getResult(media)];
                    case 3:
                        _j = _k.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        _j = undefined;
                        _k.label = 5;
                    case 5:
                        result = _j;
                        return [2 /*return*/, __assign(__assign({}, media), { result: result })];
                }
            });
        });
    };
    return AuthentaClient;
}());
exports.AuthentaClient = AuthentaClient;
