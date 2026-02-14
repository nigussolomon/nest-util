import { Inject, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';

type MinioClient = {
  bucketExists(bucketName: string): Promise<boolean>;
  makeBucket(bucketName: string, region?: string): Promise<void>;
  putObject(
    bucketName: string,
    objectName: string,
    stream: Readable,
    size: number,
    metaData?: Record<string, string>
  ): Promise<unknown>;
  getObject(bucketName: string, objectName: string): Promise<NodeJS.ReadableStream>;
  removeObject(bucketName: string, objectName: string): Promise<void>;
};
import { Repository } from 'typeorm';
import { FILE_MODULE_OPTIONS } from '../constants/file.constants';
import { StoredFileEntity } from '../entities/stored-file.entity';
import type { FileModuleOptions } from '../interfaces/file-module-options.interface';
import { GetFileResult, StoreFileInput } from '../interfaces/stored-file.interface';
import { FileEncryptionService } from './file-encryption.service';

@Injectable()
export class StoredFileService implements OnModuleInit {
  private readonly bucketName: string;
  private readonly client: MinioClient;
  private readonly region?: string;
  private readonly makeBucketIfMissing: boolean;

  constructor(
    @Inject(FILE_MODULE_OPTIONS) options: FileModuleOptions,
    @InjectRepository(StoredFileEntity)
    private readonly fileRepo: Repository<StoredFileEntity>,
    private readonly encryptionService: FileEncryptionService
  ) {
    this.bucketName = options.bucket.bucket;
    const minioRequire = eval('require') as NodeRequire;
    const { Client } = minioRequire('minio') as {
      Client: new (options: FileModuleOptions['minio']) => MinioClient;
    };
    this.client = new Client(options.minio);
    this.region = options.bucket.region;
    this.makeBucketIfMissing = options.bucket.makeBucketIfMissing ?? true;
  }

  async onModuleInit(): Promise<void> {
    const exists = await this.client.bucketExists(this.bucketName);

    if (!exists && this.makeBucketIfMissing) {
      await this.client.makeBucket(this.bucketName, this.region);
    }
  }

  async store(input: StoreFileInput): Promise<StoredFileEntity> {
    const objectKey = `${input.ownerType}/${input.ownerId}/${randomUUID()}`;
    const encryptedPayload = this.encryptionService.encrypt(input.buffer);

    await this.client.putObject(
      this.bucketName,
      objectKey,
      Readable.from(encryptedPayload.encrypted),
      encryptedPayload.encrypted.length,
      {
        'Content-Type': 'application/octet-stream',
      }
    );

    const entity = this.fileRepo.create({
      fileName: input.fileName,
      contentType: input.contentType,
      objectKey,
      size: input.buffer.length,
      encryptionAlgorithm: encryptedPayload.algorithm,
      encryptionKeyId: encryptedPayload.keyId,
      iv: encryptedPayload.iv,
      authTag: encryptedPayload.authTag,
      digest: encryptedPayload.digest,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      metadata: input.metadata,
    });

    return this.fileRepo.save(entity);
  }

  async getById(fileId: string): Promise<GetFileResult> {
    const file = await this.fileRepo.findOne({ where: { id: fileId } });

    if (!file) {
      throw new NotFoundException(`Stored file with id ${fileId} was not found`);
    }

    const encrypted = await this.readObject(file.objectKey);
    const decrypted = this.encryptionService.decrypt(encrypted, file.iv, file.authTag);

    const digest = this.encryptionService.getDigest(decrypted);
    if (digest !== file.digest) {
      throw new Error(`Integrity check failed for file ${file.id}`);
    }

    return {
      fileName: file.fileName,
      contentType: file.contentType,
      buffer: decrypted,
      ownerType: file.ownerType,
      ownerId: file.ownerId,
      metadata: file.metadata ?? {},
    };
  }

  async listByOwner(ownerType: string, ownerId: string): Promise<StoredFileEntity[]> {
    return this.fileRepo.find({
      where: { ownerType, ownerId },
      order: { createdAt: 'DESC' },
    });
  }

  async remove(fileId: string): Promise<void> {
    const file = await this.fileRepo.findOne({ where: { id: fileId } });

    if (!file) {
      throw new NotFoundException(`Stored file with id ${fileId} was not found`);
    }

    await this.client.removeObject(this.bucketName, file.objectKey);
    await this.fileRepo.delete({ id: fileId });
  }

  private async readObject(objectKey: string): Promise<Buffer> {
    const objectStream = await this.client.getObject(this.bucketName, objectKey);
    const chunks: Buffer[] = [];

    for await (const chunk of objectStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }
}
