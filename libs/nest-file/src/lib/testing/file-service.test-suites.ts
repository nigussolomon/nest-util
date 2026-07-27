import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FileEntity } from '../entities/file.entity';
import { FileService } from '../services/file.service';
import { S3Service } from '../services/s3.service';
import { ImageProcessorService } from '../services/image-processor.service';
import { ThumbnailService } from '../services/thumbnail.service';
import { NEST_FILE_OPTIONS } from '../constants';
import {
  FileServiceTestConfig,
  createMockFileEntity,
  createMockS3Service,
  createMockImageProcessor,
  createMockThumbnailService,
  createMockRepository,
} from './testing.interface';

export function fileServiceTests(config: FileServiceTestConfig): void {
  describe(config.serviceClass.name, () => {
    let service: FileService;
    let repository: ReturnType<typeof createMockRepository>;
    let s3Service: ReturnType<typeof createMockS3Service>;
    let imageProcessor: ReturnType<typeof createMockImageProcessor>;
    let thumbnailService: ReturnType<typeof createMockThumbnailService>;

    const defaultOptions = {
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
      ...config.options,
    };

    beforeEach(async () => {
      repository = createMockRepository();
      s3Service = createMockS3Service();
      imageProcessor = createMockImageProcessor();
      thumbnailService = createMockThumbnailService();

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          config.serviceClass,
          { provide: getRepositoryToken(FileEntity), useValue: repository },
          { provide: S3Service, useValue: s3Service },
          { provide: ImageProcessorService, useValue: imageProcessor },
          { provide: ThumbnailService, useValue: thumbnailService },
          { provide: NEST_FILE_OPTIONS, useValue: defaultOptions },
        ],
      }).compile();

      service = module.get<FileService>(config.serviceClass);
    });

    describe('requestUpload', () => {
      it('should generate presigned URL and create pending entity', async () => {
        const dto = {
          fileName: config.test?.requestUploadPayload?.fileName ?? 'test.jpg',
          mimeType: config.test?.requestUploadPayload?.mimeType ?? 'image/jpeg',
          folder: config.test?.requestUploadPayload?.folder,
        };

        const result = await service.requestUpload(dto, 'user-1');

        expect(result).toHaveProperty('uploadUrl');
        expect(result).toHaveProperty('key');
        expect(result).toHaveProperty('fileId');
        expect(s3Service.generatePresignedUploadUrl).toHaveBeenCalled();
        expect(repository.create).toHaveBeenCalled();
        expect(repository.save).toHaveBeenCalled();
      });
    });

    describe('confirmUpload', () => {
      it('should confirm upload and process image', async () => {
        const fileEntity = createMockFileEntity();
        repository.findOneBy.mockResolvedValue(fileEntity);
        s3Service.generatePresignedDownloadUrl.mockResolvedValue(
          'https://s3.example.com/download'
        );

        const dto = {
          fileId: fileEntity.id,
          key: fileEntity.key,
        };

        const result = await service.confirmUpload(dto);

        expect(result.url).toBeDefined();
        expect(s3Service.objectExists).toHaveBeenCalledWith(fileEntity.key);
        expect(repository.save).toHaveBeenCalled();
      });

      it('should throw NotFoundException for invalid fileId', async () => {
        repository.findOneBy.mockResolvedValue(null);

        await expect(
          service.confirmUpload({ fileId: 'invalid-id', key: 'test' })
        ).rejects.toThrow('File not found');
      });
    });

    describe('getDownloadUrl', () => {
      it('should return presigned download URL', async () => {
        const fileEntity = createMockFileEntity();
        repository.findOneBy.mockResolvedValue(fileEntity);

        const result = await service.getDownloadUrl(fileEntity.id);

        expect(result).toBe('https://s3.example.com/download-url');
        expect(s3Service.generatePresignedDownloadUrl).toHaveBeenCalledWith(
          fileEntity.key
        );
      });

      it('should throw NotFoundException for invalid id', async () => {
        repository.findOneBy.mockResolvedValue(null);

        await expect(service.getDownloadUrl('invalid-id')).rejects.toThrow(
          'File not found'
        );
      });
    });

    describe('getFile', () => {
      it('should return file entity', async () => {
        const fileEntity = createMockFileEntity();
        repository.findOneBy.mockResolvedValue(fileEntity);

        const result = await service.getFile(fileEntity.id);

        expect(result).toEqual(fileEntity);
      });

      it('should throw NotFoundException for invalid id', async () => {
        repository.findOneBy.mockResolvedValue(null);

        await expect(service.getFile('invalid-id')).rejects.toThrow(
          'File not found'
        );
      });
    });

    describe('deleteFile', () => {
      it('should delete file from S3 and database', async () => {
        const fileEntity = createMockFileEntity();
        repository.findOneBy.mockResolvedValue(fileEntity);

        const result = await service.deleteFile(fileEntity.id);

        expect(result).toBe(true);
        expect(s3Service.deleteObject).toHaveBeenCalledWith(fileEntity.key);
        expect(repository.remove).toHaveBeenCalled();
      });

      it('should throw NotFoundException for invalid id', async () => {
        repository.findOneBy.mockResolvedValue(null);

        await expect(service.deleteFile('invalid-id')).rejects.toThrow(
          'File not found'
        );
      });
    });

    describe('findAll', () => {
      it('should return paginated files', async () => {
        const files = [createMockFileEntity()];
        repository.findAndCount.mockResolvedValue([files, 1]);

        const result = await service.findAll({ page: 1, limit: 10 });

        expect(result.data).toEqual(files);
        expect(result.meta).toEqual({ total: 1, page: 1, limit: 10 });
      });
    });

    describe('findMine', () => {
      it('should return user-scoped files', async () => {
        const files = [createMockFileEntity({ userId: 'user-1' })];
        repository.findAndCount.mockResolvedValue([files, 1]);

        const result = await service.findMine('user-1', { page: 1, limit: 10 });

        expect(result.data).toEqual(files);
        expect(result.meta).toEqual({ total: 1, page: 1, limit: 10 });
      });
    });
  });
}
