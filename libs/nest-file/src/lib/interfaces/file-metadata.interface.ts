export interface FileMetadata {
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  bucket: string;
  key: string;
  url: string;
  thumbnailUrl?: string;
  width?: number;
  height?: number;
  compressedSize?: number;
  compressionRatio?: number;
  userId: string;
  metadata?: Record<string, unknown>;
}
