import { InjectionToken, ModuleMetadata } from '@nestjs/common';

export interface FileEncryptionOptions {
  algorithm?: 'aes-256-gcm';
  key: string;
}

export interface MinioBucketOptions {
  bucket: string;
  region?: string;
  makeBucketIfMissing?: boolean;
}

export interface MinioOptions {
  endPoint: string;
  port?: number;
  useSSL?: boolean;
  accessKey: string;
  secretKey: string;
}

export interface FileModuleOptions {
  minio: MinioOptions;
  bucket: MinioBucketOptions;
  encryption: FileEncryptionOptions;
}

export interface FileModuleOptionsFactory {
  createFileModuleOptions(): Promise<FileModuleOptions> | FileModuleOptions;
}

export interface FileModuleAsyncOptions
  extends Pick<ModuleMetadata, 'imports'> {
  useExisting?: new (...args: unknown[]) => FileModuleOptionsFactory;
  useClass?: new (...args: unknown[]) => FileModuleOptionsFactory;
  useFactory?: (...args: unknown[]) => Promise<FileModuleOptions> | FileModuleOptions;
  inject?: InjectionToken[];
}
