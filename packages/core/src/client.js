"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthentaClient = void 0;
const errors_1 = require("./errors");
const helpers_1 = require("./utils/helpers");
const TERMINAL_STATUSES = new Set(['PROCESSED', 'FAILED', 'ERROR']);
class AuthentaClient {
    constructor({ baseUrl = 'https://platform.authenta.ai', clientId, clientSecret, }) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.clientId = clientId;
        this.clientSecret = clientSecret;
    }
    // ─── Private helpers ───────────────────────────────────────────────────────
    get authHeaders() {
        return {
            'x-client-id': this.clientId,
            'x-client-secret': this.clientSecret,
            'Content-Type': 'application/json',
        };
    }
    async request(method, path, body, queryParams) {
        let url = `${this.baseUrl}${path}`;
        if (queryParams) {
            const qs = Object.entries(queryParams)
                .filter(([, v]) => v !== undefined && v !== null)
                .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
                .join('&');
            if (qs)
                url += `?${qs}`;
        }
        const response = await fetch(url, {
            method,
            headers: this.authHeaders,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        if (!response.ok) {
            await this.throwApiError(response);
        }
        const text = await response.text();
        if (!text.trim())
            return {};
        try {
            return JSON.parse(text);
        }
        catch (_a) {
            throw new errors_1.ValidationError('Expected JSON but received non-JSON response', undefined, response.status, { body: text.slice(0, 200) });
        }
    }
    async throwApiError(response) {
        var _a, _b, _c;
        const status = response.status;
        let data;
        try {
            data = await response.json();
        }
        catch (_d) {
            const text = await response.text().catch(() => '');
            if (status >= 500)
                throw new errors_1.ServerError(text || 'Server error', undefined, status);
            throw new errors_1.ValidationError(text || 'Client error', undefined, status);
        }
        const code = (_a = data === null || data === void 0 ? void 0 : data.code) !== null && _a !== void 0 ? _a : 'unknown';
        const message = (_c = (_b = data === null || data === void 0 ? void 0 : data.message) !== null && _b !== void 0 ? _b : response.statusText) !== null && _c !== void 0 ? _c : 'Unknown error';
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
    /** Fetch a local URI once — derives name, type, size, and blob for upload.
     *  In React Native uses XMLHttpRequest (fetch('file://...') fails on Android).
     *  In Node.js (tests) uses fs since XMLHttpRequest is not available. */
    resolveUri(uri) {
        var _a, _b;
        const name = (_b = (_a = uri.split('/').pop()) === null || _a === void 0 ? void 0 : _a.split('?')[0]) !== null && _b !== void 0 ? _b : 'file';
        const type = (0, helpers_1.getMimeType)(name);
        // Node.js environment — XMLHttpRequest does not exist
        if (typeof XMLHttpRequest === 'undefined') {
            // Use aliased require so Metro's static analyser does not try to bundle 'fs'
            const _require = require;
            const fs = _require('fs');
            const filePath = uri.replace(/^file:\/\//, '');
            const buffer = fs.readFileSync(filePath);
            const blob = new Blob([buffer], { type });
            return Promise.resolve({ name, type, size: buffer.byteLength, blob });
        }
        // React Native — use XHR
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.responseType = 'blob';
            xhr.onload = () => resolve({ name, type, size: xhr.response.size, blob: xhr.response });
            xhr.onerror = () => reject(new errors_1.AuthentaError(`Could not read file at URI: ${uri}`));
            xhr.open('GET', uri);
            xhr.send();
        });
    }
    async uploadToS3(uploadUrl, blob, contentType) {
        const putResponse = await fetch(uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': contentType },
            body: blob,
        });
        if (!putResponse.ok) {
            throw new errors_1.AuthentaError(`S3 upload failed: HTTP ${putResponse.status}`, undefined, putResponse.status);
        }
    }
    // ─── Core media CRUD ───────────────────────────────────────────────────────
    async createMedia(params) {
        return this.request('POST', '/api/media', params);
    }
    async getMedia(mid) {
        return this.request('GET', `/api/media/${mid}`);
    }
    async listMedia(params) {
        return this.request('GET', '/api/media', undefined, params);
    }
    async deleteMedia(mid) {
        await this.request('DELETE', `/api/media/${mid}`);
    }
    // ─── Upload (common for all models) ───────────────────────────────────────
    /**
     * Two-step upload: derives file info from the URI, creates a media record,
     * then PUTs the file blob to S3. Works for all model types.
     * Pass `fiOptions` only when modelType is "FI-1".
     */
    async upload(uri, modelType, fiOptions) {
        const { name, type, size, blob } = await this.resolveUri(uri);
        const payload = {
            name,
            contentType: type,
            size,
            modelType,
        };
        if (modelType.toUpperCase() === 'FI-1' && fiOptions) {
            const { isSingleFace = true, faceswapCheck = false, livenessCheck = false, faceSimilarityCheck = false, } = fiOptions;
            payload.metadata = { isSingleFace, faceswapCheck, livenessCheck, faceSimilarityCheck };
        }
        const media = await this.createMedia(payload);
        await this.uploadToS3(media.uploadUrl, blob, type);
        if (modelType.toUpperCase() === 'FI-1' && (fiOptions === null || fiOptions === void 0 ? void 0 : fiOptions.faceSimilarityCheck)) {
            if (!fiOptions.referenceImage) {
                throw new errors_1.ValidationError('referenceImage is required when faceSimilarityCheck is true');
            }
            if (!media.referenceUploadUrl) {
                throw new errors_1.AuthentaError('No referenceUploadUrl returned from server');
            }
            const { blob: refBlob, type: refType } = await this.resolveUri(fiOptions.referenceImage);
            await this.uploadToS3(media.referenceUploadUrl, refBlob, refType);
        }
        return media;
    }
    // ─── Polling ───────────────────────────────────────────────────────────────
    async pollResult(mid, { interval = 5000, timeout = 600000 } = {}) {
        const deadline = Date.now() + timeout;
        while (true) {
            const media = await this.getMedia(mid);
            if (TERMINAL_STATUSES.has(media.status.toUpperCase()))
                return media;
            if (Date.now() >= deadline) {
                throw new errors_1.AuthentaError(`Timed out waiting for media ${mid} — last status: ${media.status}`);
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
    }
    // ─── Result ────────────────────────────────────────────────────────────────
    async getResult(media) {
        if (!media.resultURL) {
            throw new errors_1.ValidationError('media has no resultURL — ensure processing is complete (status=PROCESSED)');
        }
        const response = await fetch(media.resultURL);
        if (!response.ok) {
            throw new errors_1.AuthentaError(`Failed to fetch resultURL: HTTP ${response.status}`, undefined, response.status);
        }
        return response.json();
    }
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
    async faceIntelligence(uri, modelType, { autoPolling = true, interval, timeout, isSingleFace = true, faceswapCheck = false, livenessCheck = false, faceSimilarityCheck = false, referenceImage, } = {}) {
        var _a;
        const isFI = modelType.toUpperCase() === 'FI-1';
        if (isFI) {
            const type = (0, helpers_1.getMimeType)((_a = uri.split('/').pop()) !== null && _a !== void 0 ? _a : '');
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
        const fiOptions = isFI
            ? { isSingleFace, faceswapCheck, livenessCheck, faceSimilarityCheck, referenceImage }
            : undefined;
        const meta = await this.upload(uri, modelType, fiOptions);
        if (!autoPolling)
            return meta;
        const media = await this.pollResult(meta.mid, { interval, timeout });
        const result = media.resultURL ? await this.getResult(media) : undefined;
        return Object.assign(Object.assign({}, media), { result });
    }
}
exports.AuthentaClient = AuthentaClient;
