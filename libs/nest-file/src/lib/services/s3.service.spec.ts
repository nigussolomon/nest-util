import { Test, TestingModule } from '@nestjs/testing';
import { S3Service } from './s3.service';
import { NEST_FILE_OPTIONS } from '../constants';

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn(),
  })),
  PutObjectCommand: jest.fn(),
  DeleteObjectCommand: jest.fn(),
  HeadObjectCommand: jest.fn(),
  GetObjectCommand: jest.fn(),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/signed-url'),
}));

describe('S3Service', () => {
  let service: S3Service;

  const mockOptions = {
    s3: {
      region: 'us-east-1',
      bucket: 'test-bucket',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      publicUrl: 'https://test-bucket.s3.amazonaws.com',
    },
    upload: {
      presignedUrlExpiresIn: 3600,
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        S3Service,
        { provide: NEST_FILE_OPTIONS, useValue: mockOptions },
      ],
    }).compile();

    service = module.get<S3Service>(S3Service);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generatePresignedUploadUrl', () => {
    it('should generate presigned upload URL', async () => {
      const result = await service.generatePresignedUploadUrl({
        key: 'uploads/test.jpg',
        contentType: 'image/jpeg',
      });

      expect(result).toHaveProperty('uploadUrl');
      expect(result).toHaveProperty('key');
      expect(result.key).toBe('uploads/test.jpg');
    });
  });

  describe('generatePresignedDownloadUrl', () => {
    it('should generate presigned download URL', async () => {
      const result = await service.generatePresignedDownloadUrl('uploads/test.jpg');

      expect(result).toBe('https://s3.example.com/signed-url');
    });
  });

  describe('uploadBuffer', () => {
    it('should upload buffer and return key and url', async () => {
      const buffer = Buffer.from('test');

      const result = await service.uploadBuffer(
        'uploads/test.jpg',
        buffer,
        'image/jpeg'
      );

      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('url');
      expect(result.key).toBe('uploads/test.jpg');
      expect(result.url).toContain('uploads/test.jpg');
    });
  });

  describe('deleteObject', () => {
    it('should delete object without error', async () => {
      await expect(
        service.deleteObject('uploads/test.jpg')
      ).resolves.toBeUndefined();
    });
  });

  describe('objectExists', () => {
    it('should return true if object exists', async () => {
      const result = await service.objectExists('uploads/test.jpg');
      expect(result).toBe(true);
    });
  });

  describe('getBucket', () => {
    it('should return bucket name', () => {
      expect(service.getBucket()).toBe('test-bucket');
    });
  });
});
