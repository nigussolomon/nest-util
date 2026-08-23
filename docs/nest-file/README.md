# nest-file

S3-compatible file management library with presigned URL uploads and TypeORM metadata tracking.

## Installation

```bash
pnpm add @nest-util/nest-file @nest-util/nest-error
```

Peer dependencies:

```bash
pnpm add @nestjs/common @nestjs/swagger @nestjs/typeorm class-validator typeorm
# Optional — for RBAC permissions
pnpm add @nest-util/nest-auth
```

`@nest-util/nest-error` is required. Register `LocalizationModule.forRoot(...)`
once for consistent error responses (see
[libs/nest-error/README.md](./../../libs/nest-error/README.md)).

## Quick Start

Register `NestFileModule.forRoot()` in your root module. Endpoints are available immediately — no controller class needed.

```typescript
import { NestFileModule } from '@nest-util/nest-file';

@Module({
  imports: [
    NestFileModule.forRoot({
      s3: {
        region: 'us-east-1',
        bucket: 'my-bucket',
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
        publicUrl: 'https://my-bucket.s3.amazonaws.com',
      },
      controller: {
        permissions: {
          upload: 'files.create',
          download: 'files.read',
          list: 'files.read',
          remove: 'files.delete',
        },
      },
    }),
  ],
})
export class AppModule {}
```

## Configuration

### Sync

```typescript
NestFileModule.forRoot({
  s3: {
    region: 'us-east-1',
    bucket: 'my-bucket',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    publicUrl: 'https://my-bucket.s3.amazonaws.com',
  },
  controller: {
    path: 'files',
    permissions: {
      upload: 'files.create',
      download: 'files.read',
      list: 'files.read',
      remove: 'files.delete',
    },
  },
})
```

### Async (from ConfigService)

```typescript
NestFileModule.forRootAsync({
  useFactory: (config: ConfigService) => ({
    s3: {
      region: config.getOrThrow('AWS_REGION'),
      bucket: config.getOrThrow('S3_BUCKET'),
      accessKeyId: config.getOrThrow('AWS_ACCESS_KEY_ID'),
      secretAccessKey: config.getOrThrow('AWS_SECRET_ACCESS_KEY'),
    },
  }),
  inject: [ConfigService],
})
```

### Options Reference

| Option | Type | Default | Description |
|---|---|---|---|
| `s3.region` | `string` | required | AWS region |
| `s3.bucket` | `string` | required | S3 bucket name |
| `s3.accessKeyId` | `string` | required | S3 access key |
| `s3.secretAccessKey` | `string` | required | S3 secret key |
| `s3.endpoint` | `string` | — | Custom endpoint (MinIO, DigitalOcean, etc.) |
| `s3.forcePathStyle` | `boolean` | `false` | Path-style URLs (required for MinIO) |
| `s3.publicUrl` | `string` | — | Public URL prefix for stored files |
| `upload.maxFileSize` | `number` | — | Max upload size in bytes |
| `upload.allowedMimeTypes` | `string[]` | — | Allowed MIME types (supports `image/*` wildcards) |
| `upload.pathPrefix` | `string` | `'uploads'` | S3 key prefix |
| `upload.presignedUrlExpiresIn` | `number` | `3600` | Presigned URL expiry in seconds |
| `controller.enable` | `boolean` | `true` | Auto-register controller |
| `controller.path` | `string` | `'files'` | Controller route path |
| `controller.permissions` | `object` | — | RBAC permissions per endpoint |

## Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/files/upload-url` | Request a presigned upload URL |
| `POST` | `/files/confirm` | Confirm upload and process the file |
| `GET` | `/files/:id/download` | Get a presigned download URL |
| `GET` | `/files` | List all files (paginated) |
| `GET` | `/files/mine` | Get current user's files (paginated) |
| `GET` | `/files/:id` | Get file metadata |
| `DELETE` | `/files/:id` | Delete a file from S3 |

## Upload Flow

1. **Request URL** — `POST /files/upload-url` with `{ fileName, mimeType, folder? }`
2. **Upload to S3** — `PUT` the file directly to the presigned URL
3. **Confirm** — `POST /files/confirm` with `{ fileId, key }` to finalize

`RequestUploadDto` accepts an optional `folder` field that overrides `upload.pathPrefix` for the S3 key (e.g. `avatars/1712345678901-photo.jpg`).

## Services

### FileService

Injectable service for programmatic file management:

```ts
// (dto: RequestUploadDto, userId: string) => Promise<PresignedUploadResult>
const { uploadUrl, key, fileId } = await fileService.requestUpload(dto, 'user-1');

// (dto: ConfirmUploadDto) => Promise<FileEntity>
const entity = await fileService.confirmUpload({ fileId, key });

// (fileId: string) => Promise<string>  — presigned download URL
const url = await fileService.getDownloadUrl(fileId);

// (fileId: string) => Promise<FileEntity>
const file = await fileService.getFile(fileId);

// (fileId: string) => Promise<boolean>
await fileService.deleteFile(fileId);

// ({ page?, limit?, orderBy?, orderDirection? }) => Promise<{ data, meta }>
const { data, meta } = await fileService.findAll({ page: 1, limit: 20 });

// (userId, query?) => Promise<{ data, meta }>  — user-scoped
const { data, meta } = await fileService.findMine('user-1', { page: 1 });
```

### S3Service

```ts
// Presigned PUT URL for direct client upload
const { uploadUrl, key } = await s3Service.generatePresignedUploadUrl({ key, contentType });

// Presigned GET URL
const url = await s3Service.generatePresignedDownloadUrl(key);

// Server-side buffer upload → { key, url }
const { key, url } = await s3Service.uploadBuffer(key, buffer, 'image/jpeg');

// Object lifecycle + checks
await s3Service.deleteObject(key);
const exists = await s3Service.objectExists(key);
const bucket = s3Service.getBucket();
const client = s3Service.getClient(); // raw S3Client
```

### Helpers

```ts
import {
  generateStoredName,      // sanitize + timestamp a filename
  generateS3Key,           // prefix + stored name → S3 key (default 'uploads/')
  isImageMime,             // true for 'image/*'
  getMimeTypeExtension,    // 'image/jpeg' → 'jpg' (fallback 'bin')
  IMAGE_MIME_PREFIXES,     // ['image/']
} from '@nest-util/nest-file';
```

### Result & Metadata Interfaces

```ts
interface PresignedUploadResult { uploadUrl: string; key: string; fileId: string; }
interface PresignedDownloadResult { downloadUrl: string; }
interface FileMetadata {
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
```

`NEST_FILE_OPTIONS` is the injection token for the resolved `NestFileOptions`.

### UpdateFileDto

`UpdateFileDto` accepts optional `description` and `tags` (comma-separated) fields for file metadata updates.

## FileEntity

| Column | Type | Description |
|---|---|---|
| `id` | `UUID` | Primary key |
| `originalName` | `string` | Original filename |
| `storedName` | `string` | Sanitized stored filename |
| `mimeType` | `string` | MIME type |
| `size` | `bigint` | File size in bytes |
| `bucket` | `string` | S3 bucket name |
| `key` | `string` | S3 object key |
| `url` | `string?` | Public URL |
| `userId` | `string` | Uploader user ID |
| `metadata` | `jsonb?` | Custom metadata |
| `createdAt` | `Date` | Creation timestamp |
| `updatedAt` | `Date` | Last update timestamp |

## Custom Controller

Disable the auto-registered controller and use `CreateFileController()` for custom routing:

```typescript
NestFileModule.forRoot({
  s3: { /* ... */ },
  controller: { enable: false },
});
```

```typescript
import { Controller } from '@nestjs/common';
import { CreateFileController } from '@nest-util/nest-file';

const FileBase = CreateFileController({
  permissions: {
    upload: 'files.create',
    download: 'files.read',
    list: 'files.read',
    remove: 'files.delete',
  },
});

@Controller('custom-files')
export class FilesController extends FileBase {
  constructor(override readonly fileService: FileService) {
    super(fileService);
  }
}
```

## Testing

Use the `@nest-util/nest-file/testing` entry point for mock factories and generated test suites.

### Generated Test Suites

```typescript
import { fileServiceTests } from '@nest-util/nest-file/testing';
import { FileService } from '@nest-util/nest-file';
import { FileEntity } from './file.entity';

describe('FileService', () => {
  fileServiceTests({
    serviceClass: FileService,
    entity: FileEntity,
    test: {
      requestUploadPayload: { fileName: 'photo.jpg', mimeType: 'image/jpeg' },
      confirmUploadPayload: { fileId: '00000000-0000-0000-0000-000000000001', key: 'uploads/photo.jpg' },
    },
  });
});
```

Config types: `FileServiceTestConfig` (`serviceClass`, `entity`, `options?`, `test?`) and `FileControllerTestConfig` (`controllerClass`, `serviceClass`, `entity`, `options?`, `test?`). A `FileTestContext` exposes `{ service, repository, s3Service }` mocks.

### Manual Setup with Mocks

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  FileService, FileEntity,
  createMockRepository, createMockS3Service,
} from '@nest-util/nest-file/testing';

const module: TestingModule = await Test.createTestingModule({
  providers: [
    FileService,
    { provide: getRepositoryToken(FileEntity), useValue: createMockRepository() },
    { provide: S3Service, useValue: createMockS3Service() },
  ],
}).compile();
```

## Building

Run `nx build nest-file` to build the library.

## Running unit tests

Run `nx test nest-file` to execute the unit tests via [Jest](https://jestjs.io).
