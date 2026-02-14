export interface StoreFileInput {
  fileName: string;
  contentType: string;
  buffer: Buffer;
  ownerType: string;
  ownerId: string;
  metadata?: Record<string, string>;
}

export interface GetFileResult {
  fileName: string;
  contentType: string;
  buffer: Buffer;
  ownerType: string;
  ownerId: string;
  metadata: Record<string, string>;
}
