import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NEST_FILE_OPTIONS } from '../constants';
import type { NestFileOptions } from '../interfaces/nest-file-options.interface';

@Injectable()
export class S3Service {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl?: string;
  private readonly logger = new Logger(S3Service.name);

  constructor(
    @Inject(NEST_FILE_OPTIONS) private readonly options: NestFileOptions
  ) {
    this.bucket = options.s3.bucket;
    this.publicUrl = options.s3.publicUrl;

    this.client = new S3Client({
      region: options.s3.region,
      endpoint: options.s3.endpoint,
      forcePathStyle: options.s3.forcePathStyle ?? false,
      credentials: {
        accessKeyId: options.s3.accessKeyId,
        secretAccessKey: options.s3.secretAccessKey,
      },
    });
  }

  async generatePresignedUploadUrl(params: {
    key: string;
    contentType: string;
    expiresIn?: number;
  }): Promise<{ uploadUrl: string; key: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: params.key,
      ContentType: params.contentType,
    });

    const expiresIn =
      params.expiresIn ??
      this.options.upload?.presignedUrlExpiresIn ??
      3600;

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn,
    });

    return { uploadUrl, key: params.key };
  }

  async generatePresignedDownloadUrl(
    key: string,
    expiresIn?: number
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const expires =
      expiresIn ??
      this.options.upload?.presignedUrlExpiresIn ??
      3600;

    return getSignedUrl(this.client, command, { expiresIn: expires });
  }

  async uploadBuffer(
    key: string,
    buffer: Buffer,
    contentType: string
  ): Promise<{ key: string; url: string }> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.client.send(command);

    const url = this.publicUrl
      ? `${this.publicUrl.replace(/\/$/, '')}/${key}`
      : key;

    return { key, url };
  }

  async deleteObject(key: string): Promise<void> {
    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.client.send(command);
    this.logger.log(`Deleted object: ${key}`);
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  getClient(): S3Client {
    return this.client;
  }

  getBucket(): string {
    return this.bucket;
  }
}
