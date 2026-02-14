import { Module } from '@nestjs/common';
import { NestFileModule } from '@nest-util/nest-file';
import { FileController } from './file.controller';

@Module({
  imports: [
    NestFileModule.forRoot({
      minio: {
        endPoint: process.env.MINIO_ENDPOINT ?? 'localhost',
        port: Number(process.env.MINIO_PORT ?? 9000),
        useSSL: (process.env.MINIO_USE_SSL ?? 'false') === 'true',
        accessKey: process.env.MINIO_ACCESS_KEY ?? 'minioadmin',
        secretKey: process.env.MINIO_SECRET_KEY ?? 'minioadmin',
      },
      bucket: {
        bucket: process.env.MINIO_BUCKET ?? 'demo-files',
        makeBucketIfMissing: true,
      },
      encryption: {
        key:
          process.env.FILE_ENCRYPTION_KEY_BASE64 ??
          'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=',
      },
    }),
  ],
  controllers: [FileController],
})
export class FileModule {}
