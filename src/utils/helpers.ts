// import { MimeType } from '../types';

export const getMimeType = (path: string): string => {
    const mimeTypes: { [key: string]: string } = {
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
    // Extract file extension
    const extension = path.substring(path.lastIndexOf('.')).toLowerCase();
    
    return mimeTypes[extension] || 'application/octet-stream';
}

/**
 * Check if file is an image
 */
export const isImage = (mimeType: string): boolean => {
  return mimeType.startsWith('image/');
};

/**
 * Check if file is a video
 */
export const isVideo = (mimeType: string): boolean => {
  return mimeType.startsWith('video/');
};

export const safeJsonParse = (jsonString: string): any => {
    try {
        return JSON.parse(jsonString);
    } catch (error) {
        console.error('JSON parsing error:', error);
        return null;
    }
};