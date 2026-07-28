export interface FileMetadata {
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  bucket: string;
  key: string;
  url: string;
  userId: string;
  metadata?: Record<string, unknown>;
}
