"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeJsonParse = exports.isVideo = exports.isImage = exports.getMimeType = void 0;
const getMimeType = (path) => {
    const mimeTypes = {
        // Images
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.svg': 'image/svg+xml',
        // Videos
        '.mp4': 'video/mp4',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.mkv': 'video/x-matroska',
        '.webm': 'video/webm',
        '.flv': 'video/x-flv',
        '.wmv': 'video/x-ms-wmv',
        '.m4v': 'video/x-m4v',
        '.3gp': 'video/3gpp',
        // Audio
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.m4a': 'audio/mp4',
        '.aac': 'audio/aac',
        '.flac': 'audio/flac',
        '.ogg': 'audio/ogg',
    };
    const extension = path.substring(path.lastIndexOf('.')).toLowerCase();
    return mimeTypes[extension] || 'application/octet-stream';
};
exports.getMimeType = getMimeType;
const isImage = (mimeType) => {
    return mimeType.startsWith('image/');
};
exports.isImage = isImage;
const isVideo = (mimeType) => {
    return mimeType.startsWith('video/');
};
exports.isVideo = isVideo;
const safeJsonParse = (jsonString) => {
    try {
        return JSON.parse(jsonString);
    }
    catch (error) {
        console.error('JSON parsing error:', error);
        return null;
    }
};
exports.safeJsonParse = safeJsonParse;
