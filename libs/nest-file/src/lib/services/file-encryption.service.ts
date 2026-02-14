import { Inject, Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { FILE_MODULE_OPTIONS } from '../constants/file.constants';
import type { FileModuleOptions } from '../interfaces/file-module-options.interface';

export interface EncryptionPayload {
  encrypted: Buffer;
  iv: string;
  authTag: string;
  digest: string;
  algorithm: string;
  keyId: string;
}

@Injectable()
export class FileEncryptionService {
  private readonly algorithm: 'aes-256-gcm';
  private readonly key: Buffer;
  private readonly keyId: string;

  constructor(@Inject(FILE_MODULE_OPTIONS) options: FileModuleOptions) {
    this.algorithm = options.encryption.algorithm ?? 'aes-256-gcm';
    this.key = Buffer.from(options.encryption.key, 'base64');

    if (this.key.length !== 32) {
      throw new Error('File encryption key must be a base64-encoded 32-byte key');
    }

    this.keyId = createHash('sha256').update(this.key).digest('hex').slice(0, 16);
  }

  encrypt(buffer: Buffer): EncryptionPayload {
    const ivBuffer = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, this.key, ivBuffer);
    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: ivBuffer.toString('base64'),
      authTag: authTag.toString('base64'),
      digest: this.getDigest(buffer),
      algorithm: this.algorithm,
      keyId: this.keyId,
    };
  }

  decrypt(encrypted: Buffer, iv: string, authTag: string): Buffer {
    const decipher = createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));

    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
  }

  getDigest(buffer: Buffer): string {
    return createHash('sha256').update(buffer).digest('base64');
  }
}
