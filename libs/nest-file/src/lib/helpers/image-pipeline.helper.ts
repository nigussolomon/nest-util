import { ThumbnailSize } from '../interfaces/nest-file-options.interface';

export const DEFAULT_THUMBNAIL_SIZES: ThumbnailSize[] = [
  { width: 150, height: 150, suffix: 'thumb' },
];

export const IMAGE_MIME_PREFIXES = ['image/'];

export const isImageMime = (mimeType: string): boolean => {
  return IMAGE_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
};

export const getMimeTypeExtension = (mimeType: string): string => {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'application/pdf': 'pdf',
  };
  return map[mimeType] ?? 'bin';
};
