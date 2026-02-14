# nest-file

`@nest-util/nest-file` is a NestJS file package that stores encrypted binary content in MinIO and file metadata/ownership in Postgres using TypeORM.

## Install

```bash
pnpm add https://github.com/nigussolomon/nest-util/releases/download/latest/nest-util-nest-file-0.0.1.tgz
pnpm add minio
```

## What it provides

- `NestFileModule` dynamic module (`forRoot`, `forRootAsync`)
- `StoredFileEntity` TypeORM entity (`stored_files`)
- `StoredFileService` for upload/read/list/remove operations
- AES-256-GCM encryption/decryption and SHA-256 integrity checks
- Generic owner attachment model: `ownerType` + `ownerId`

## Configure module

```ts
import { NestFileModule } from '@nest-util/nest-file';

NestFileModule.forRoot({
  minio: {
    endPoint: process.env.MINIO_ENDPOINT!,
    port: Number(process.env.MINIO_PORT ?? 9000),
    useSSL: false,
    accessKey: process.env.MINIO_ACCESS_KEY!,
    secretKey: process.env.MINIO_SECRET_KEY!,
  },
  bucket: {
    bucket: process.env.MINIO_BUCKET ?? 'secure-files',
    region: 'us-east-1',
    makeBucketIfMissing: true,
  },
  encryption: {
    // base64 encoded 32-byte key
    key: process.env.FILE_ENCRYPTION_KEY!,
  },
});
```

## Add entity to TypeORM

```ts
TypeOrmModule.forRoot({
  // ...
  entities: [StoredFileEntity],
});
```

## Usage example

```ts
@Injectable()
export class UserDocumentsService {
  constructor(private readonly files: StoredFileService) {}

  async uploadForUser(userId: string, file: Express.Multer.File) {
    return this.files.store({
      fileName: file.originalname,
      contentType: file.mimetype,
      buffer: file.buffer,
      ownerType: 'user',
      ownerId: userId,
      metadata: { purpose: 'kyc' },
    });
  }

  async listUserFiles(userId: string) {
    return this.files.listByOwner('user', userId);
  }
}
```

## Runtime requirements

- MinIO/S3-compatible object storage endpoint reachable from your API.
- `FILE_ENCRYPTION_KEY` must be a base64-encoded 32-byte key.
- Create a migration for `stored_files` in production.
