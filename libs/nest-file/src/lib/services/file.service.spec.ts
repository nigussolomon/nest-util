import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { FileService } from './file.service';
import { S3Service } from './s3.service';
import { FileEntity } from '../entities/file.entity';
import { NEST_FILE_OPTIONS } from '../constants';

describe('FileService', () => {
  let service: FileService;
  let repository: any;
  let s3Service: any;

  const mockFileEntity = (): FileEntity => {
    const entity = new FileEntity();
    entity.id = '00000000-0000-0000-0000-000000000001';
    entity.originalName = 'test.jpg';
    entity.storedName = '1234567890-test.jpg';
    entity.mimeType = 'image/jpeg';
    entity.size = 1024;
    entity.bucket = 'test-bucket';
    entity.key = 'uploads/1234567890-test.jpg';
    entity.url = '';
    entity.userId = 'user-1';
    entity.createdAt = new Date();
    entity.updatedAt = new Date();
    return entity;
  };

  const mockOptions = {
    s3: {
      region: 'us-east-1',
      bucket: 'test-bucket',
      accessKeyId: 'test-key',
      secretAccessKey: 'test-secret',
      publicUrl: 'https://test-bucket.s3.amazonaws.com',
    },
    upload: {
      pathPrefix: 'uploads',
      allowedMimeTypes: ['image/*', 'application/pdf'],
    },
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn().mockImplementation((dto) => ({
        ...mockFileEntity(),
        ...dto,
      })),
      save: jest.fn().mockImplementation((entity) =>
        Promise.resolve({ ...mockFileEntity(), ...entity })
      ),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FileService,
        { provide: getRepositoryToken(FileEntity), useValue: repository },
        { provide: S3Service, useValue: s3Service },
        { provide: NEST_FILE_OPTIONS, useValue: mockOptions },
      ],
    }).compile();

    service = module.get<FileService>(FileService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestUpload', () => {
    it('should generate presigned URL and create entity', async () => {
      const dto = { fileName: 'test.jpg', mimeType: 'image/jpeg' };

      const result = await service.requestUpload(dto, 'user-1');

      expect(result).toHaveProperty('uploadUrl');
      expect(result).toHaveProperty('key');
      expect(result).toHaveProperty('fileId');
      expect(s3Service.generatePresignedUploadUrl).toHaveBeenCalled();
      expect(repository.create).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
    });

    it('should reject disallowed MIME types', async () => {
      const dto = { fileName: 'test.exe', mimeType: 'application/x-executable' };

      await expect(service.requestUpload(dto, 'user-1')).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('confirmUpload', () => {
    it('should confirm upload and process image', async () => {
      const entity = mockFileEntity();
      repository.findOneBy.mockResolvedValue(entity);

      const result = await service.confirmUpload({
        fileId: entity.id,
        key: entity.key,
      });

      expect(result.url).toBeDefined();
      expect(s3Service.objectExists).toHaveBeenCalledWith(entity.key);
      expect(repository.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException for invalid fileId', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(
        service.confirmUpload({ fileId: 'invalid', key: 'test' })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if file not in S3', async () => {
      const entity = mockFileEntity();
      repository.findOneBy.mockResolvedValue(entity);
      s3Service.objectExists.mockResolvedValue(false);

      await expect(
        service.confirmUpload({ fileId: entity.id, key: entity.key })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getDownloadUrl', () => {
    it('should return presigned download URL', async () => {
      const entity = mockFileEntity();
      repository.findOneBy.mockResolvedValue(entity);

      const result = await service.getDownloadUrl(entity.id);

      expect(result).toBe('https://s3.example.com/download');
    });

    it('should throw NotFoundException for invalid id', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.getDownloadUrl('invalid')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('getFile', () => {
    it('should return file entity', async () => {
      const entity = mockFileEntity();
      repository.findOneBy.mockResolvedValue(entity);

      const result = await service.getFile(entity.id);

      expect(result).toEqual(entity);
    });

    it('should throw NotFoundException for invalid id', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.getFile('invalid')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('deleteFile', () => {
    it('should delete file from S3 and database', async () => {
      const entity = mockFileEntity();
      repository.findOneBy.mockResolvedValue(entity);

      const result = await service.deleteFile(entity.id);

      expect(result).toBe(true);
      expect(s3Service.deleteObject).toHaveBeenCalledWith(entity.key);
      expect(repository.remove).toHaveBeenCalled();
    });

    it('should throw NotFoundException for invalid id', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.deleteFile('invalid')).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('findAll', () => {
    it('should return paginated files', async () => {
      const files = [mockFileEntity()];
      repository.findAndCount.mockResolvedValue([files, 1]);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(files);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 10 });
    });
  });

  describe('findMine', () => {
    it('should return user-scoped files', async () => {
      const files = [mockFileEntity()];
      repository.findAndCount.mockResolvedValue([files, 1]);

      const result = await service.findMine('user-1', { page: 1, limit: 10 });

      expect(result.data).toEqual(files);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 10 });
    });
  });
});
