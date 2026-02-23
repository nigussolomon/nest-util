import { Test, TestingModule } from '@nestjs/testing';
import { CrudInterface } from '../interfaces/crud.interface';
import {
  CreateNestedCrudController,
  IBaseController,
} from './nest-crud.controller';
import { PaginationDto } from '../dtos/pagination.dto';
import { FilterDto } from '../dtos/filter.dto';
import { NotFoundException } from '@nestjs/common';

class MockDto {}
class MockResponseDto {
  id!: number;
  name!: string;
}

const TestControllerBase = CreateNestedCrudController(
  MockDto,
  MockDto,
  MockResponseDto
);

describe('NestedCrudController Factory', () => {
  let controller: IBaseController<MockDto, MockDto, MockResponseDto>;
  let service: jest.Mocked<CrudInterface<MockDto, MockDto, MockResponseDto>>;

  beforeEach(async () => {
    service = {
      disabledEndpoints: [],
      findAll: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
      findAuditLogs: jest.fn(),
    };

    class TestController extends TestControllerBase {
      constructor() {
        super(service);
      }
    }

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestController],
    }).compile();

    controller = module.get<TestController>(TestController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call service.findAll with query params', async () => {
      const query: PaginationDto & FilterDto = {
        page: 1,
        limit: 10,
        filter: { name_cont: 'Nigu' },
      };

      const expectedResult: {
        data: MockResponseDto[];
        meta: { total: number };
      } = {
        data: [],
        meta: { total: 0 },
      };

      service.findAll.mockResolvedValue(expectedResult);

      const result = await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should handle pagination parameters correctly', async () => {
      const query: PaginationDto & FilterDto = { page: 5, limit: 100 };
      const expectedResult: MockResponseDto[] = [];

      service.findAll.mockResolvedValue({ data: expectedResult });

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 5,
          limit: 100,
        })
      );
    });

    it('should handle complex filter objects', async () => {
      const query: PaginationDto & FilterDto = {
        filter: {
          name_cont: 'Alice',
          isActive_eq: 'true',
        },
      };

      const expectedResult: MockResponseDto[] = [];
      service.findAll.mockResolvedValue({ data: expectedResult });

      await controller.findAll(query);

      expect(service.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          filter: {
            name_cont: 'Alice',
            isActive_eq: 'true',
          },
        })
      );
    });

    it('should work with no query parameters', async () => {
      const emptyQuery: PaginationDto & FilterDto = {};
      const expectedResult: MockResponseDto[] = [];
      service.findAll.mockResolvedValue({ data: expectedResult });

      await controller.findAll(emptyQuery);

      expect(service.findAll).toHaveBeenCalledWith({});
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with correct id', async () => {
      const id = 1;
      const expectedResult: MockResponseDto = { id, name: 'Test' };
      service.findOne.mockResolvedValue(expectedResult);

      const result = await controller.findOne(id);

      expect(service.findOne).toHaveBeenCalledWith(id);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('create', () => {
    it('should call service.create with dto', async () => {
      const dto: MockDto = { name: 'New Item' };
      const expectedResult: MockResponseDto = { id: 1, name: 'New Item' };
      service.create.mockResolvedValue(expectedResult);

      const result = await controller.create(dto);

      expect(service.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('update', () => {
    it('should call service.update with id and dto', async () => {
      const id = 1;
      const dto: MockDto = { name: 'Updated' };
      const expectedResult: MockResponseDto = { id, name: 'Updated' };
      service.update.mockResolvedValue(expectedResult);

      const result = await controller.update(id, dto);

      expect(service.update).toHaveBeenCalledWith(id, dto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('remove', () => {
    it('should call service.remove', async () => {
      const id = 1;
      service.remove.mockResolvedValue(true);

      const result = await controller.remove(id);

      expect(service.remove).toHaveBeenCalledWith(id);
      expect(result).toBe(true);
    });
  });

  describe('disabledEndpoints', () => {
    it('should block disabled endpoints', async () => {
      service.disabledEndpoints = ['create'];

      expect(() => controller.create({} as MockDto)).toThrow(NotFoundException);
      expect(service.create).not.toHaveBeenCalled();
    });
  });

  describe('findAuditLogs', () => {
    it('should call service.findAuditLogs with query params', async () => {
      const query = { page: 1, limit: 5, user_id: '1' };
      const expectedResult = { data: [], meta: { total: 0, page: 1, limit: 5 } };

      const findAuditLogsMock = service.findAuditLogs as jest.MockedFunction<
        NonNullable<typeof service.findAuditLogs>
      >;
      findAuditLogsMock.mockResolvedValue(expectedResult);

      const result = await controller.findAuditLogs?.(query);

      expect(service.findAuditLogs).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedResult);
    });

    it('should throw when audit logs endpoint is not available', () => {
      service.findAuditLogs = undefined;

      expect(() => controller.findAuditLogs?.({})).toThrow(NotFoundException);
    });
  });
});
