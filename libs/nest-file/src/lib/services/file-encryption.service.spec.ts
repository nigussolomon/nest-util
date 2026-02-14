import { Test } from '@nestjs/testing';
import { FILE_MODULE_OPTIONS } from '../constants/file.constants';
import { FileEncryptionService } from './file-encryption.service';

describe('FileEncryptionService', () => {
  it('encrypts and decrypts payloads', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        FileEncryptionService,
        {
          provide: FILE_MODULE_OPTIONS,
          useValue: {
            minio: {
              endPoint: 'localhost',
              accessKey: 'minio',
              secretKey: 'minio123',
            },
            bucket: { bucket: 'files' },
            encryption: {
              key: Buffer.from('12345678901234567890123456789012').toString('base64'),
            },
          },
        },
      ],
    }).compile();

    const service = moduleRef.get(FileEncryptionService);
    const source = Buffer.from('top-secret-file-content');

    const encrypted = service.encrypt(source);
    const decrypted = service.decrypt(encrypted.encrypted, encrypted.iv, encrypted.authTag);

    expect(decrypted.toString()).toBe(source.toString());
    expect(encrypted.digest).toBe(service.getDigest(source));
  });
});
