import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FileEntity } from '../../entities/file.entity';
import { FileService } from '../../services/file.service';
import { S3Service } from '../../services/s3.service';
import { ImageProcessorService } from '../../services/image-processor.service';
import { ThumbnailService } from '../../services/thumbnail.service';
import { NEST_FILE_OPTIONS } from '../../constants';

global.fetch = jest.fn().mockResolvedValue({
  arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
});

describe('FileServiceTestSuites', () => {
  let service: FileService;
  let repository: any;
  let s3Service: any;
  let imageProcessor: any;
  let thumbnailService: any;

  const mockOptions = {
    s3: {
      region: 'us-east-1',
      bucket: 'test-bucket',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
    },
    upload: {
      pathPrefix: 'uploads',
    },
    imageProcessing: {
      enabled: true,
    },
    thumbnails: {
      enabled: true,
      sizes: [{ width: 150, height: 150, suffix: 'thumb' }],
    },
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn().mockImplementation((dto) => ({
        id: '00000000-0000-0000-0000-000000000001',
        originalName: 'test.jpg',
        storedName: '1234567890-test.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        bucket: 'test-bucket',
        key: 'uploads/1234567890-test.jpg',
        url: '',
        userId: 'user-1',
        ...dto,
      })),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
      findOneBy: jest.fn(),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      remove: jest.fn(),
    };

    s3Service = {
      generatePresignedUploadUrl: jest.fn().mockResolvedValue({
        uploadUrl: 'https://s3.example.com/upload',
        key: 'uploads/test.jpg',
      }),
      generatePresignedDownloadUrl: jest.fn().mockResolvedValue(
        'https://s3.example.com/download'
      ),
      uploadBuffer: jest.fn().mockResolvedValue({
        key: 'uploads/test.jpg',
        url: 'https://s3.example.com/uploads/test.jpg',
      }),
      deleteObject: jest.fn(),
      objectExists: jest.fn().mockResolvedValue(true),
      getBucket: jest.fn().mockReturnValue('test-bucket'),
    };

    imageProcessor = {
      processImage: jest.fn().mockResolvedValue({
        buffer: Buffer.from('processed'),
        width: 800,
        height: 600,
        format: 'webp',
        size: 512,
      }),
      isProcessingEnabled: jest.fn().mockReturnValue(true),
    };

    thumbnailService = {
      generateThumbnails: jest.fn().mockResolvedValue([
        {
          suffix: 'thumb',
          buffer: Buffer.from('thumbnail'),
          width: 150,
          height: 150,
        },
      ]),
      isThumbnailEnabled: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileService,
        { provide: getRepositoryToken(FileEntity), useValue: repository },
        { provide: S3Service, useValue: s3Service },
        { provide: ImageProcessorService, useValue: imageProcessor },
        { provide: ThumbnailService, useValue: thumbnailService },
        { provide: NEST_FILE_OPTIONS, useValue: mockOptions },
      ],
    }).compile();

    service = module.get<FileService>(FileService);
  });

  describe('requestUpload', () => {
    it('should generate presigned URL', async () => {
      const result = await service.requestUpload(
        { fileName: 'test.jpg', mimeType: 'image/jpeg' },
        'user-1'
      );

      expect(result).toHaveProperty('uploadUrl');
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('fileId');
      expect(s3Service.generatePresignedUploadUrl).toHaveBeenCalled();
    });
  });

  describe('confirmUpload', () => {
    it('should confirm upload', async () => {
      repository.findOneBy.mockResolvedValue({
        id: '00000000-0000-0000-0000-000000000001',
        originalName: 'test.jpg',
        storedName: '1234567890-test.jpg',
        mimeType: 'image/jpeg',
        size: 1024,
        bucket: 'test-bucket',
        key: 'uploads/1234567890-test.jpg',
        url: '',
        userId: 'user-1',
      });

      const result = await service.confirmUpload({
        fileId: '00000000-0000-0000-0000-000000000001',
        key: 'uploads/1234567890-test.jpg',
      });

      expect(result.url).toBeDefined();
      expect(s3Service.objectExists).toHaveBeenCalled();
    });
  });

  describe('getDownloadUrl', () => {
    it('should return download URL', async () => {
      repository.findOneBy.mockResolvedValue({
        id: 'file-1',
        key: 'uploads/test.jpg',
      });

      const result = await service.getDownloadUrl('file-1');

      expect(result).toBe('https://s3.example.com/download');
    });
  });

  describe('deleteFile', () => {
    it('should delete file', async () => {
      repository.findOneBy.mockResolvedValue({
        id: 'file-1',
        key: 'uploads/test.jpg',
      });

      const result = await service.deleteFile('file-1');

      expect(result).toBe(true);
      expect(s3Service.deleteObject).toHaveBeenCalledWith('uploads/test.jpg');
      expect(repository.remove).toHaveBeenCalled();
    });
  });
});
