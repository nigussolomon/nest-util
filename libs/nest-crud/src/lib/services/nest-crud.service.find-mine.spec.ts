import { BadRequestException } from '@nestjs/common';
import { NestCrudService } from './nest-crud.service';
import { Repository } from 'typeorm';

describe('NestCrudService - findMine', () => {
  let repo: jest.Mocked<Repository<any>>;
  const mockEntity = { id: 1, name: 'Test', authorId: 123 };

  beforeEach(() => {
    repo = {
      find: jest.fn().mockResolvedValue([mockEntity]),
      findOne: jest.fn().mockResolvedValue(mockEntity),
      findOneBy: jest.fn().mockResolvedValue(mockEntity),
      save: jest.fn().mockResolvedValue(mockEntity),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn().mockReturnValue(mockEntity),
      merge: jest.fn(),
      createQueryBuilder: jest.fn(),
      metadata: {
        name: 'TestEntity',
        primaryColumns: [{ propertyPath: 'id', type: 'integer' }],
      },
      manager: {
        connection: {
          createQueryRunner: jest.fn(),
        },
      },
    } as any;
  });

  function createMockQb() {
    const qb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockEntity], 1]),
    };
    repo.createQueryBuilder.mockReturnValue(qb as any);
    return qb;
  }

  describe('with userOwnershipField', () => {
    it('should filter by ownership field', async () => {
      const service = new NestCrudService({
        repository: repo as any,
        userOwnershipField: 'authorId',
      });

      const qb = createMockQb();

      await service.findMine(123, {});

      expect(qb.where).toHaveBeenCalledWith('e.authorId = :userId', {
        userId: 123,
      });
    });

    it('should return data with pagination meta', async () => {
      const service = new NestCrudService({
        repository: repo as any,
        userOwnershipField: 'authorId',
      });

      createMockQb();

      const result = await service.findMine(123, { page: 1, limit: 10 });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.data).toEqual([mockEntity]);
    });
  });

  describe('with findMineQuery', () => {
    it('should use custom query builder function', async () => {
      const customQuery = jest.fn();
      const service = new NestCrudService({
        repository: repo as any,
        findMineQuery: customQuery,
      });

      createMockQb();

      await service.findMine(123, {});

      expect(customQuery).toHaveBeenCalled();
      expect(customQuery.mock.calls[0][1]).toBe(123);
    });
  });

  describe('not configured', () => {
    it('should throw BadRequestException', async () => {
      const service = new NestCrudService({
        repository: repo as any,
      });

      await expect(service.findMine(123, {})).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('with filters', () => {
    it('should apply filters to query', async () => {
      const service = new NestCrudService({
        repository: repo as any,
        userOwnershipField: 'authorId',
        allowedFilters: ['name'],
      });

      const qb = createMockQb();

      await service.findMine(123, {
        filter: { name_cont: 'test' },
      });

      expect(qb.andWhere).toHaveBeenCalled();
    });
  });

  describe('with relations', () => {
    it('should join relations', async () => {
      const service = new NestCrudService({
        repository: repo as any,
        userOwnershipField: 'authorId',
        include: ['author'],
      });

      const qb = createMockQb();

      await service.findMine(123, {});

      expect(qb.leftJoinAndSelect).toHaveBeenCalledWith(
        'e.author',
        'author'
      );
    });
  });
});
