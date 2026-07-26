import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ObjectLiteral } from 'typeorm';
import { CrudInterface } from '../interfaces/crud.interface';
import {
  AUTH_PERMISSIONS_METADATA_KEY,
  IBaseController,
} from '../controllers/nest-crud.controller';
import { CrudControllerTestConfig, CrudTestContext } from './testing.interface';
import { createMockQb } from './mock-repository';

export function crudControllerTests<
  TEntity extends ObjectLiteral,
  TCreateDto,
  TUpdateDto,
  TResponseDto
>(
  config: CrudControllerTestConfig<TEntity, TCreateDto, TUpdateDto, TResponseDto>
): CrudTestContext {
  let controller: IBaseController<TCreateDto, TUpdateDto, TResponseDto>;
  let service: jest.Mocked<CrudInterface<TCreateDto, TUpdateDto, TResponseDto>>;
  let ControllerBase: ReturnType<typeof config.controllerFactory>;
  let moduleRef: TestingModule;

  beforeEach(async () => {
    service = {
      disabledEndpoints: [],
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findAuditLogs: jest.fn(),
      findMine: jest.fn(),
    } as any;

    ControllerBase = config.controllerFactory();

    class TestController extends ControllerBase {
      constructor() {
        super(service);
      }
    }

    moduleRef = await Test.createTestingModule({
      controllers: [TestController],
    }).compile();

    controller = moduleRef.get(TestController) as IBaseController<TCreateDto, TUpdateDto, TResponseDto>;
  });

  describe('findAll', () => {
    it('should call service.findAll with query params', async () => {
      const query: any = { page: 1, limit: 10 };
      const expected = { data: [], meta: { total: 0 } };
      service.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(expected);
    });

    it('should handle pagination parameters', async () => {
      const query: any = { page: 5, limit: 100 };
      service.findAll.mockResolvedValue({ data: [] });

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 5, limit: 100 })
      );
    });

    it('should handle complex filter objects', async () => {
      const query: any = {
        filter: { name_cont: 'Alice', isActive_eq: 'true' },
      };
      service.findAll.mockResolvedValue({ data: [] });

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: { name_cont: 'Alice', isActive_eq: 'true' },
        })
      );
    });

    it('should work with no query parameters', async () => {
      service.findAll.mockResolvedValue({ data: [] });

      await controller.findAll({});

      expect(service.findAll).toHaveBeenCalledWith({});
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with correct id', async () => {
      const expectedResult = { id: 1, name: 'Test' } as any;
      service.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(1);

      expect(service.findOne).toHaveBeenCalledWith(1);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('create', () => {
    it('should call service.create with dto', async () => {
      const dto = config.test.createPayload as any;
      const expectedResult = { id: 1 } as any;
      service.create.mockResolvedValue(expectedResult);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('update', () => {
    it('should call service.update with id and dto', async () => {
      const dto = config.test.updatePayload as any;
      const expectedResult = { id: 1 } as any;
      service.update.mockResolvedValue(expectedResult);

      const result = await controller.update(1, dto);

      expect(service.update).toHaveBeenCalledWith(1, dto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('remove', () => {
    it('should call service.remove', async () => {
      service.remove.mockResolvedValue(true);

      const result = await controller.remove(1);

      expect(service.remove).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });
  });

  describe('findMine', () => {
    it('should call service.findMine with user id', async () => {
      const query: any = { page: 1, limit: 10 };
      const expected = { data: [] };
      (service.findMine as jest.Mock).mockResolvedValue(expected);

      const mockUser = { id: 42 };
      const result = await (controller as any).findMine(mockUser, query);

      expect(service.findMine).toHaveBeenCalledWith(42, query);
      expect(result).toEqual(expected);
    });
  });

  describe('disabledEndpoints', () => {
    it('should block disabled endpoints', async () => {
      service.disabledEndpoints = ['create'] as any;

      expect(() => controller.create({} as TCreateDto)).toThrow(
        NotFoundException
      );
      expect(service.create).not.toHaveBeenCalled();
    });
  });

  describe('findAuditLogs', () => {
    it('should call service.findAuditLogs with query params', async () => {
      const query = { page: 1, limit: 5, user_id: '1' };
      const expected = { data: [], meta: { total: 0, page: 1, limit: 5 } };
      (service.findAuditLogs as jest.Mock).mockResolvedValue(expected);

      const result = await controller.findAuditLogs?.(query as any);

      expect(service.findAuditLogs).toHaveBeenCalledWith(query);
      expect(result).toEqual(expected);
    });

    it('should throw when audit logs endpoint is not available', () => {
      service.findAuditLogs = undefined as any;

      expect(() => controller.findAuditLogs?.({} as any)).toThrow(
        NotFoundException
      );
    });
  });

  describe('permissions', () => {
    it('should attach auth permission metadata to configured handlers', () => {
      if (!config.permissions) return;

      const PermissionedBase = config.controllerFactory();
      class PermissionedCtrl extends PermissionedBase {
        constructor() {
          super(service);
        }
      }

      for (const [endpoint, permission] of Object.entries(config.permissions)) {
        const method = PermissionedCtrl.prototype[endpoint];
        if (!method) continue;

        const metadata = Reflect.getMetadata(
          AUTH_PERMISSIONS_METADATA_KEY,
          method
        );

        const expected = Array.isArray(permission)
          ? permission
          : [permission];
        expect(metadata).toEqual(expected);
      }
    });
  });

  const ctx: CrudTestContext = {
    get module() {
      return moduleRef;
    },
    repository: null as any,
    createMockQb,
  };

  return ctx;
}
