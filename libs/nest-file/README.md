# @nest-util/nest-file

S3-compatible file management library for NestJS with presigned URL uploads, image processing, and metadata tracking via TypeORM.

## Installation

We recommend using **pnpm** as your package manager.

```bash
pnpm add @nest-util/nest-file sharp
```

Peer dependencies:

```bash
pnpm add @nestjs/common @nestjs/swagger @nestjs/typeorm class-validator typeorm
```

Optional — for RBAC permissions:

```bash
pnpm add @nest-util/nest-auth
```

## Features

- S3-compatible presigned URL uploads (AWS S3, MinIO, DigitalOcean Spaces, etc.)
- Secure client-side upload flow: request URL → upload directly → confirm
- Image processing pipeline (resize, compress, format conversion, EXIF stripping)
- Automatic thumbnail generation
- TypeORM-based file metadata tracking
- Auto-registered controller via `NestFileModule.forRoot()` (opt-in)
- Controller factory via `CreateFileController()` for custom routing
- Optional RBAC permissions integration with `@nest-util/nest-auth`
- Automatic Swagger documentation

## Quick Start

```typescript
import { NestFileModule } from '@nest-util/nest-file';

@Module({
  imports: [
    NestFileModule.forRoot({
      s3: {
        region: process.env.AWS_REGION!,
        bucket: process.env.S3_BUCKET!,
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

Endpoints are available immediately — no controller class needed.

## Configuration Options

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
| `imageProcessing.enabled` | `boolean` | `true` | Enable image processing |
| `imageProcessing.format` | `'webp' \| 'avif' \| 'jpeg' \| 'png'` | `'webp'` | Output format |
| `imageProcessing.quality` | `number` | `80` | Output quality (1-100) |
| `imageProcessing.maxWidth` | `number` | `2048` | Max output width |
| `imageProcessing.maxHeight` | `number` | `2048` | Max output height |
| `imageProcessing.stripExif` | `boolean` | `true` | Strip EXIF data |
| `thumbnails.enabled` | `boolean` | `true` | Enable thumbnail generation |
| `thumbnails.sizes` | `{ width, height, suffix }[]` | `[{150x150, 'thumb'}]` | Thumbnail sizes |
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
| `DELETE` | `/files/:id` | Delete a file and its thumbnail |

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
| `thumbnailUrl` | `string?` | Thumbnail URL |
| `width` | `number?` | Image width |
| `height` | `number?` | Image height |
| `compressedSize` | `bigint?` | Compressed size in bytes |
| `compressionRatio` | `number?` | Compression ratio (%) |
| `userId` | `string` | Uploader user ID |
| `metadata` | `jsonb?` | Custom metadata |
| `createdAt` | `Date` | Creation timestamp |
| `updatedAt` | `Date` | Last update timestamp |

## Custom Controller

If you need custom routing, disable the auto-registered controller and use `CreateFileController()`:

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

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  FileService, FileEntity,
  createMockRepository, createMockS3Service,
  createMockImageProcessor, createMockThumbnailService,
} from '@nest-util/nest-file/testing';

const module: TestingModule = await Test.createTestingModule({
  providers: [
    FileService,
    { provide: getRepositoryToken(FileEntity), useValue: createMockRepository() },
    { provide: S3Service, useValue: createMockS3Service() },
    { provide: ImageProcessorService, useValue: createMockImageProcessor() },
    { provide: ThumbnailService, useValue: createMockThumbnailService() },
  ],
}).compile();
```

## Building

Run `nx build nest-file` to build the library.

## Running unit tests

Run `nx test nest-file` to execute the unit tests via [Jest](https://jestjs.io).
