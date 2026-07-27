import { CreateFileController, AUTH_PERMISSIONS_METADATA_KEY } from './file.controller';

describe('FileController', () => {
  let controller: any;
  let fileService: any;

  const mockFileEntity = () => ({
    id: '00000000-0000-0000-0000-000000000001',
    originalName: 'test.jpg',
    storedName: '1234567890-test.jpg',
    mimeType: 'image/jpeg',
    size: 1024,
    bucket: 'test-bucket',
    key: 'uploads/1234567890-test.jpg',
    url: 'https://test-bucket.s3.amazonaws.com/uploads/1234567890-test.jpg',
    userId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    fileService = {
      requestUpload: jest.fn(),
      confirmUpload: jest.fn(),
      getDownloadUrl: jest.fn(),
      getFile: jest.fn(),
      deleteFile: jest.fn(),
      findAll: jest.fn(),
      findMine: jest.fn(),
    };

    const ControllerClass = CreateFileController();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    controller = new (ControllerClass as any)(fileService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('requestUpload', () => {
    it('should call fileService.requestUpload', async () => {
      const dto = { fileName: 'test.jpg', mimeType: 'image/jpeg' };
      const user = { id: 'user-1' };
      const expected = {
        uploadUrl: 'https://s3.example.com/upload',
        key: 'uploads/test.jpg',
        fileId: 'file-1',
      };

      fileService.requestUpload.mockResolvedValue(expected);

      const result = await controller.requestUpload(dto, user);

      expect(result).toEqual(expected);
      expect(fileService.requestUpload).toHaveBeenCalledWith(dto, 'user-1');
    });
  });

  describe('confirmUpload', () => {
    it('should call fileService.confirmUpload', async () => {
      const dto = { fileId: 'file-1', key: 'uploads/test.jpg' };
      const expected = mockFileEntity();

      fileService.confirmUpload.mockResolvedValue(expected);

      const result = await controller.confirmUpload(dto);

      expect(result).toEqual(expected);
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
      const expected = mockFileEntity();
      fileService.getFile.mockResolvedValue(expected);

      const result = await controller.findOne(expected.id);

      expect(result).toEqual(expected);
    });
  });

  describe('findAll', () => {
    it('should return paginated files', async () => {
      const files = [mockFileEntity()];
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
      const files = [mockFileEntity()];
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
    it('should not have permission metadata when not configured', () => {
      const uploadPerm = Reflect.getMetadata(
        AUTH_PERMISSIONS_METADATA_KEY,
        controller.requestUpload
      );

      expect(uploadPerm).toBeUndefined();
    });

    it('should have permission metadata when configured', () => {
      const ControllerWithPerms = CreateFileController({
        permissions: {
          upload: 'files.create',
          download: 'files.read',
          list: 'files.read',
          remove: 'files.delete',
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ctrl = new (ControllerWithPerms as any)(fileService);

      expect(
        Reflect.getMetadata(AUTH_PERMISSIONS_METADATA_KEY, ctrl.requestUpload)
      ).toEqual(['files.create']);
      expect(
        Reflect.getMetadata(AUTH_PERMISSIONS_METADATA_KEY, ctrl.confirmUpload)
      ).toEqual(['files.create']);
      expect(
        Reflect.getMetadata(AUTH_PERMISSIONS_METADATA_KEY, ctrl.download)
      ).toEqual(['files.read']);
      expect(
        Reflect.getMetadata(AUTH_PERMISSIONS_METADATA_KEY, ctrl.findAll)
      ).toEqual(['files.read']);
      expect(
        Reflect.getMetadata(AUTH_PERMISSIONS_METADATA_KEY, ctrl.findMine)
      ).toEqual(['files.read']);
      expect(
        Reflect.getMetadata(AUTH_PERMISSIONS_METADATA_KEY, ctrl.findOne)
      ).toEqual(['files.read']);
      expect(
        Reflect.getMetadata(AUTH_PERMISSIONS_METADATA_KEY, ctrl.remove)
      ).toEqual(['files.delete']);
    });
  });
});
