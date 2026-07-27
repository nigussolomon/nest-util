export interface NestFileOptions {
  s3: {
    endpoint?: string;
    region: string;
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    forcePathStyle?: boolean;
    publicUrl?: string;
  };
  upload?: {
    maxFileSize?: number;
    allowedMimeTypes?: string[];
    pathPrefix?: string;
    presignedUrlExpiresIn?: number;
  };
  imageProcessing?: {
    enabled?: boolean;
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    format?: 'webp' | 'avif' | 'jpeg' | 'png';
    stripExif?: boolean;
  };
  thumbnails?: {
    enabled?: boolean;
    sizes: ThumbnailSize[];
  };
  controller?: {
    enable?: boolean;
    path?: string;
    permissions?: {
      upload?: string;
      download?: string;
      list?: string;
      remove?: string;
    };
  };
}

export interface ThumbnailSize {
  width: number;
  height: number;
  suffix: string;
}

export interface PresignedUploadResult {
  uploadUrl: string;
  key: string;
  fileId: string;
}

export interface PresignedDownloadResult {
  downloadUrl: string;
}

export interface ImageProcessResult {
  buffer: Buffer;
  width: number;
  height: number;
  format: string;
  size: number;
}

export interface ThumbnailResult {
  suffix: string;
  buffer: Buffer;
  width: number;
  height: number;
}
