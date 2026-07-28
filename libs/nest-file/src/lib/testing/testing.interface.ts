import type { Repository } from 'typeorm';
import { FileEntity } from '../entities/file.entity';
import { S3Service } from '../services/s3.service';
import { FileService } from '../services/file.service';
import type { NestFileOptions } from '../interfaces/nest-file-options.interface';

export interface FileServiceTestConfig {
  serviceClass: new (...args: any[]) => FileService;
  entity: new (...args: any[]) => FileEntity;
  options?: Partial<NestFileOptions>;
  test?: {
    requestUploadPayload?: {
      fileName?: string;
      mimeType?: string;
      folder?: string;
    };
    confirmUploadPayload?: {
      fileId?: string;
      key?: string;
    };
  };
}

export interface FileControllerTestConfig {
  controllerClass: new (...args: any[]) => any;
  serviceClass: new (...args: any[]) => FileService;
  entity: new (...args: any[]) => FileEntity;
  options?: Partial<NestFileOptions>;
  test?: {
    requestUploadPayload?: {
      fileName?: string;
      mimeType?: string;
      folder?: string;
    };
  };
}

export interface FileTestContext {
  service: FileService;
  repository: jest.Mocked<Repository<FileEntity>>;
  s3Service: jest.Mocked<S3Service>;
}

export function createMockFileEntity(overrides?: Partial<FileEntity>): FileEntity {
  const entity = new FileEntity();
  entity.id = '00000000-0000-0000-0000-000000000001';
  entity.originalName = 'test-file.jpg';
  entity.storedName = '1234567890-test-file.jpg';
  entity.mimeType = 'image/jpeg';
  entity.size = 1024;
  entity.bucket = 'test-bucket';
  entity.key = 'uploads/1234567890-test-file.jpg';
  entity.url = 'https://test-bucket.s3.amazonaws.com/uploads/1234567890-test-file.jpg';
  entity.userId = 'user-1';
  entity.metadata = undefined;
  entity.createdAt = new Date();
  entity.updatedAt = new Date();

  if (overrides) {
    Object.assign(entity, overrides);
  }

  return entity;
}

export function createMockS3Service(): jest.Mocked<S3Service> {
  return {
    generatePresignedUploadUrl: jest.fn().mockResolvedValue({
      uploadUrl: 'https://s3.example.com/upload-url',
      key: 'uploads/test-file.jpg',
    }),
    generatePresignedDownloadUrl: jest.fn().mockResolvedValue(
      'https://s3.example.com/download-url'
    ),
    uploadBuffer: jest.fn().mockResolvedValue({
      key: 'uploads/test-file.jpg',
      url: 'https://s3.example.com/uploads/test-file.jpg',
    }),
    deleteObject: jest.fn().mockResolvedValue(undefined),
    objectExists: jest.fn().mockResolvedValue(true),
    getClient: jest.fn(),
    getBucket: jest.fn().mockReturnValue('test-bucket'),
  } as unknown as jest.Mocked<S3Service>;
}

export function createMockRepository(): jest.Mocked<Repository<FileEntity>> {
  return {
    find: jest.fn().mockResolvedValue([]),
    findAndCount: jest.fn().mockResolvedValue([[], 0]),
    findOne: jest.fn().mockResolvedValue(null),
    findOneBy: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockImplementation((entity) =>
      Promise.resolve({ ...createMockFileEntity(), ...entity })
    ),
    remove: jest.fn().mockResolvedValue(undefined),
    create: jest.fn().mockImplementation((entity) => ({
      ...createMockFileEntity(),
      ...entity,
    })),
    count: jest.fn().mockResolvedValue(0),
    createQueryBuilder: jest.fn(),
    metadata: {
      name: 'FileEntity',
      columns: [],
    },
  } as unknown as jest.Mocked<Repository<FileEntity>>;
}
