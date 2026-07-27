import { Test, TestingModule } from '@nestjs/testing';
import { FileService } from '../services/file.service';
import { NEST_FILE_OPTIONS } from '../constants';
import { AUTH_PERMISSIONS_METADATA_KEY } from '../controllers/file.controller';
import {
  FileControllerTestConfig,
  createMockFileEntity,
} from './testing.interface';

export function fileControllerTests(config: FileControllerTestConfig): void {
  describe(config.controllerClass.name, () => {
    let controller: InstanceType<typeof config.controllerClass>;
    let fileService: jest.Mocked<FileService>;

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
      fileService = {
        requestUpload: jest.fn(),
        confirmUpload: jest.fn(),
        getDownloadUrl: jest.fn(),
        getFile: jest.fn(),
        deleteFile: jest.fn(),
        findAll: jest.fn(),
        findMine: jest.fn(),
      } as unknown as jest.Mocked<FileService>;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          { provide: FileService, useValue: fileService },
          { provide: NEST_FILE_OPTIONS, useValue: defaultOptions },
        ],
      }).compile();

      controller = module.get(config.controllerClass);
    });

    describe('requestUpload', () => {
      it('should call fileService.requestUpload', async () => {
        const dto = {
          fileName: config.test?.requestUploadPayload?.fileName ?? 'test.jpg',
          mimeType: config.test?.requestUploadPayload?.mimeType ?? 'image/jpeg',
          folder: config.test?.requestUploadPayload?.folder,
        };

        fileService.requestUpload.mockResolvedValue({
          uploadUrl: 'https://s3.example.com/upload',
          key: 'uploads/test.jpg',
          fileId: 'file-1',
        });

        const result = await controller.requestUpload(dto, { id: 'user-1' });

        expect(result).toHaveProperty('uploadUrl');
        expect(fileService.requestUpload).toHaveBeenCalledWith(dto, 'user-1');
      });
    });

    describe('confirmUpload', () => {
      it('should call fileService.confirmUpload', async () => {
        const fileEntity = createMockFileEntity();
        fileService.confirmUpload.mockResolvedValue(fileEntity);

        const dto = { fileId: fileEntity.id, key: fileEntity.key };

        const result = await controller.confirmUpload(dto);

        expect(result).toEqual(fileEntity);
        expect(fileService.confirmUpload).toHaveBeenCalledWith(dto);
      });
    });

    describe('download', () => {
      it('should return download URL', async () => {
        fileService.getDownloadUrl.mockResolvedValue(
          'https://s3.example.com/download'
        );

        const result = await controller.download('file-1');

        expect(result).toEqual({
          downloadUrl: 'https://s3.example.com/download',
        });
      });
    });

    describe('findOne', () => {
      it('should return file entity', async () => {
        const fileEntity = createMockFileEntity();
        fileService.getFile.mockResolvedValue(fileEntity);

        const result = await controller.findOne(fileEntity.id);

        expect(result).toEqual(fileEntity);
      });
    });

    describe('findAll', () => {
      it('should return paginated files', async () => {
        const files = [createMockFileEntity()];
        fileService.findAll.mockResolvedValue({
          data: files,
          meta: { total: 1, page: 1, limit: 10 },
        });

        const result = await controller.findAll(1, 10);

        expect(result.data).toEqual(files);
      });
    });

    describe('findMine', () => {
      it('should return user-scoped files', async () => {
        const files = [createMockFileEntity({ userId: 'user-1' })];
        fileService.findMine.mockResolvedValue({
          data: files,
          meta: { total: 1, page: 1, limit: 10 },
        });

        const result = await controller.findMine({ id: 'user-1' }, 1, 10);

        expect(result.data).toEqual(files);
        expect(fileService.findMine).toHaveBeenCalledWith('user-1', {
          page: 1,
          limit: 10,
        });
      });
    });

    describe('remove', () => {
      it('should delete file', async () => {
        fileService.deleteFile.mockResolvedValue(true);

        const result = await controller.remove('file-1');

        expect(result).toBe(true);
        expect(fileService.deleteFile).toHaveBeenCalledWith('file-1');
      });
    });

    describe('permissions', () => {
      it('should have permission metadata on handlers', () => {
        const uploadPerm = Reflect.getMetadata(
          AUTH_PERMISSIONS_METADATA_KEY,
          controller.requestUpload
        );
        const confirmPerm = Reflect.getMetadata(
          AUTH_PERMISSIONS_METADATA_KEY,
          controller.confirmUpload
        );
        const downloadPerm = Reflect.getMetadata(
          AUTH_PERMISSIONS_METADATA_KEY,
          controller.download
        );
        const findAllPerm = Reflect.getMetadata(
          AUTH_PERMISSIONS_METADATA_KEY,
          controller.findAll
        );
        const findMinePerm = Reflect.getMetadata(
          AUTH_PERMISSIONS_METADATA_KEY,
          controller.findMine
        );
        const findOnePerm = Reflect.getMetadata(
          AUTH_PERMISSIONS_METADATA_KEY,
          controller.findOne
        );
        const removePerm = Reflect.getMetadata(
          AUTH_PERMISSIONS_METADATA_KEY,
          controller.remove
        );

        // Permissions are set when CreateFileController is called with options
        // These will be undefined when no permissions are configured
        expect(uploadPerm).toBeDefined();
        expect(confirmPerm).toBeDefined();
        expect(downloadPerm).toBeDefined();
        expect(findAllPerm).toBeDefined();
        expect(findMinePerm).toBeDefined();
        expect(findOnePerm).toBeDefined();
        expect(removePerm).toBeDefined();
      });
    });
  });
}
