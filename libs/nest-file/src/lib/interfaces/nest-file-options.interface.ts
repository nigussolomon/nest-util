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

export interface PresignedUploadResult {
  uploadUrl: string;
  key: string;
  fileId: string;
}

export interface PresignedDownloadResult {
  downloadUrl: string;
}


