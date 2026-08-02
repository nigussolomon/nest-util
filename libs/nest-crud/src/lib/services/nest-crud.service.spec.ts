import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Repository, SelectQueryBuilder, DeleteResult } from 'typeorm';
import { NestCrudService } from './nest-crud.service';
import { PaginationDto } from '../dtos/pagination.dto';
import { FilterDto } from '../dtos/filter.dto';
import { AuditLogEntity } from '../entities/audit-log.entity';

class MockEntity {
  id!: number;
  name!: string;
}

class MockResponseDto {
  id!: number;
  name!: string;
}

/** Helper that builds a NestCrudService with the given include list. */
function buildServiceWithIncludes(
  repo: jest.Mocked<Repository<MockEntity>>,
  include: string[]
) {
  return new NestCrudService<
    MockEntity,
    Partial<MockEntity>,
    Partial<MockEntity>,
    MockResponseDto
  >({
    repository: repo,
    allowedFilters: ['name'] as const,
    include,
    relations: [],
    toResponseDto: (entity: MockEntity | MockEntity[]) => {
      if (Array.isArray(entity)) {
        return entity.map((e) => ({ id: e.id, name: e.name }));
      }
      return { id: entity.id, name: entity.name };
    },
  });
}

/** Helper that builds a NestCrudService supporting nested filter/sort paths. */
function buildServiceWithNestedOptions(
  repo: jest.Mocked<Repository<MockEntity>>,
  options: { include?: string[]; allowedFilters?: string[]; allowedSortFields?: string[] }
) {
  return new NestCrudService<
    MockEntity,
    Partial<MockEntity>,
    Partial<MockEntity>,
    MockResponseDto
  >({
    repository: repo,
    allowedFilters: options.allowedFilters ?? ['name'],
    allowedSortFields: options.allowedSortFields ?? [],
    include: options.include ?? [],
    relations: [],
    toResponseDto: (entity: MockEntity | MockEntity[]) => {
      if (Array.isArray(entity)) {
        return entity.map((e) => ({ id: e.id, name: e.name }));
      }
      return { id: entity.id, name: entity.name };
    },
  });
}

describe('NestCrudService', () => {
  let service: NestCrudService<
    MockEntity,
    Partial<MockEntity>,
    Partial<MockEntity>,
    MockResponseDto
  >;
  let repository: jest.Mocked<Repository<MockEntity>>;
  let queryBuilder: jest.Mocked<SelectQueryBuilder<MockEntity>>;
  let auditQueryBuilder: jest.Mocked<SelectQueryBuilder<AuditLogEntity>>;

  beforeEach(async () => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
      getManyAndCount: jest.fn(),
    } as unknown as jest.Mocked<SelectQueryBuilder<MockEntity>>;

    auditQueryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    } as unknown as jest.Mocked<SelectQueryBuilder<AuditLogEntity>>;

    const auditRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(auditQueryBuilder),
    };

    repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      merge: jest.fn((entity, partialEntity) =>
        Object.assign(entity, partialEntity)
      ),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      metadata: {
        name: 'MockEntity',
        primaryColumns: [{ type: () => Number }],
      },
      manager: {
        getRepository: jest.fn().mockReturnValue(auditRepo),
      },
    } as unknown as jest.Mocked<Repository<MockEntity>>;

    const options = {
      repository,
      allowedFilters: ['name'] as const,
      include: [],
      relations: [],
      toResponseDto: (entity: MockEntity | MockEntity[]) => {
        if (Array.isArray(entity)) {
          return entity.map((e) => ({ id: e.id, name: e.name }));
        }
        return { id: entity.id, name: entity.name };
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: NestCrudService,
          useValue: new NestCrudService<
            MockEntity,
            Partial<MockEntity>,
            Partial<MockEntity>,
            MockResponseDto
          >(options),
        },
      ],
    }).compile();

    service = module.get(NestCrudService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findAll', () => {
    it('should return paginated data and meta', async () => {
      const query: PaginationDto & FilterDto = {
        page: 1,
        limit: 10,
        filter: { name_cont: 'test' },
      };

      const entities: MockEntity[] = [{ id: 1, name: 'test' }];
      const total = 1;

      queryBuilder.getManyAndCount.mockResolvedValue([entities, total]);

      const result = await service.findAll(query);

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('e');
      expect(queryBuilder.getManyAndCount).toHaveBeenCalled();
      expect(result).toEqual({
        data: [{ id: 1, name: 'test' }],
        meta: expect.objectContaining({
          total,
          page: 1,
          limit: 10,
        }),
      });
    });

    it('should call leftJoinAndSelect for a simple (top-level) include relation', async () => {
      const svc = buildServiceWithIncludes(repository, ['tags']);
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await svc.findAll({ page: 1, limit: 10 });

      // Simple relation: leftJoinAndSelect(`e.tags`, `tags`)
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'e.tags',
        'tags'
      );
    });

    it('should call leftJoinAndSelect with parent alias for a nested include relation', async () => {
      // 'author.profile' → parent alias 'author', field 'profile', alias 'author_profile'
      const svc = buildServiceWithIncludes(repository, [
        'author',
        'author.profile',
      ]);
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await svc.findAll({ page: 1, limit: 10 });

      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'e.author',
        'author'
      );
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'author.profile',
        'author_profile'
      );
    });

    it('should call leftJoinAndSelect with correct alias for deeply nested relations', async () => {
      // 'a.b.c' → parent alias 'a_b', field 'c', alias 'a_b_c'
      const svc = buildServiceWithIncludes(repository, ['a', 'a.b', 'a.b.c']);
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await svc.findAll({ page: 1, limit: 10 });

      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('e.a', 'a');
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith('a.b', 'a_b');
      expect(queryBuilder.leftJoinAndSelect).toHaveBeenCalledWith(
        'a_b.c',
        'a_b_c'
      );
    });

    it('should not call leftJoinAndSelect when include is empty', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({ page: 1, limit: 10 });

      expect(queryBuilder.leftJoinAndSelect).not.toHaveBeenCalled();
    });

    it('should filter by a nested field when its join prefix is included', async () => {
      const svc = buildServiceWithNestedOptions(repository, {
        include: ['author'],
        allowedFilters: ['name', 'author.name'],
      });
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await svc.findAll({
        page: 1,
        limit: 10,
        filter: { 'author.name_cont': 'John' },
      });

      const [sql, params] = queryBuilder.andWhere.mock.calls[0] as [
        string,
        Record<string, unknown>
      ];
      expect(sql).toContain('author.name ILIKE :filter_0');
      expect(params).toMatchObject({ filter_0: '%John%' });
    });

    it('should skip a nested filter whose join prefix is not included', async () => {
      const svc = buildServiceWithNestedOptions(repository, {
        include: [],
        allowedFilters: ['name', 'author.name'],
      });
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await svc.findAll({
        page: 1,
        limit: 10,
        filter: { 'author.name_cont': 'John', name_eq: 'Alice' },
      });

      const [sql] = queryBuilder.andWhere.mock.calls[0] as [string];
      expect(sql).toContain('e.name = :filter_0');
      expect(sql).not.toContain('author');
    });

    it('should skip a nested filter that is not whitelisted', async () => {
      const svc = buildServiceWithNestedOptions(repository, {
        include: ['author'],
        allowedFilters: ['name'],
      });
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await svc.findAll({
        page: 1,
        limit: 10,
        filter: { 'author.name_cont': 'John' },
      });

      expect(queryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('should sort by a nested field when its join prefix is included', async () => {
      const svc = buildServiceWithNestedOptions(repository, {
        include: ['author'],
        allowedSortFields: ['name', 'author.name'],
      });
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await svc.findAll({
        page: 1,
        limit: 10,
        orderBy: 'author.name',
        orderDirection: 'ASC',
      });

      expect(queryBuilder.orderBy).toHaveBeenCalledWith('author.name', 'ASC');
    });

    it('should skip sorting by a nested field whose join prefix is not included', async () => {
      const svc = buildServiceWithNestedOptions(repository, {
        include: [],
        allowedSortFields: ['name', 'author.name'],
      });
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await svc.findAll({
        page: 1,
        limit: 10,
        orderBy: 'author.name',
      });

      expect(queryBuilder.orderBy).not.toHaveBeenCalled();
    });

    it('should support OR groups while preserving default AND behavior', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({
        page: 1,
        limit: 10,
        filter: {
          name_cont: 'ni',
          or: [{ name_eq: 'Alice' }, { name_eq: 'Bob' }],
        },
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledTimes(1);

      const [sql, params] = queryBuilder.andWhere.mock.calls[0] as [
        string,
        Record<string, unknown>
      ];

      expect(sql).toContain('AND');
      expect(sql).toContain('OR');
      expect(sql).toContain('e.name ILIKE :filter_0');
      expect(sql).toContain('e.name = :filter_1');
      expect(sql).toContain('e.name = :filter_2');
      expect(params).toMatchObject({
        filter_0: '%ni%',
        filter_1: 'Alice',
        filter_2: 'Bob',
      });
    });

    it('should support advanced operators in and filters', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({
        page: 1,
        limit: 10,
        filter: {
          and: [{ name_ne: 'Eve' }, { name_in: 'Alice,Bob' }],
        },
      });

      const [sql, params] = queryBuilder.andWhere.mock.calls[0] as [
        string,
        Record<string, unknown>
      ];

      expect(sql).toContain('!=');
      expect(sql).toContain('AND');
      expect(sql).toContain('e.name != :filter_0');
      expect(sql).toContain('e.name IN (:...filter_1)');
      expect(params).toMatchObject({
        filter_0: 'Eve',
        filter_1: ['Alice', 'Bob'],
      });
    });

    it('should ignore invalid isnull and empty in values', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({
        page: 1,
        limit: 10,
        filter: {
          name_isnull: 'maybe',
          name_in: '',
        },
      });

      expect(queryBuilder.andWhere).not.toHaveBeenCalled();
    });

    it('should ignore unsafe and disallowed fields', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({
        page: 1,
        limit: 10,
        filter: {
          '1name_eq': 'bad',
          id_eq: 42,
          name_eq: 'allowed',
        },
      });

      const [sql, params] = queryBuilder.andWhere.mock.calls[0] as [
        string,
        Record<string, unknown>
      ];

      expect(sql).toContain('e.name = :filter_0');
      expect(sql).not.toContain('id');
      expect(params).toMatchObject({
        filter_0: 'allowed',
      });
    });

    it('should not call orderBy when orderBy is not specified', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({
        page: 1,
        limit: 10,
      });

      expect(queryBuilder.orderBy).not.toHaveBeenCalled();
    });

    it('should apply orderBy with DESC direction by default', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({
        page: 1,
        limit: 10,
        orderBy: 'createdAt',
      });

      expect(queryBuilder.orderBy).toHaveBeenCalledWith('e.createdAt', 'DESC');
    });

    it('should apply orderBy with ASC direction when specified', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await service.findAll({
        page: 1,
        limit: 10,
        orderBy: 'name',
        orderDirection: 'ASC',
      });

      expect(queryBuilder.orderBy).toHaveBeenCalledWith('e.name', 'ASC');
    });

    it('should respect allowedSortFields when specified', async () => {
      const serviceWithSortFields = new NestCrudService<
        MockEntity,
        Partial<MockEntity>,
        Partial<MockEntity>,
        MockResponseDto
      >({
        repository,
        allowedFilters: ['name'] as const,
        allowedSortFields: ['name'] as const,
        include: [],
        relations: [],
        toResponseDto: (entity: MockEntity | MockEntity[]) => {
          if (Array.isArray(entity)) {
            return entity.map((e) => ({ id: e.id, name: e.name }));
          }
          return { id: entity.id, name: entity.name };
        },
      });

      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await serviceWithSortFields.findAll({
        page: 1,
        limit: 10,
        orderBy: 'name',
        orderDirection: 'ASC',
      });

      expect(queryBuilder.orderBy).toHaveBeenCalledWith('e.name', 'ASC');
    });

    it('should not apply orderBy when field is not in allowedSortFields', async () => {
      const serviceWithSortFields = new NestCrudService<
        MockEntity,
        Partial<MockEntity>,
        Partial<MockEntity>,
        MockResponseDto
      >({
        repository,
        allowedFilters: ['name'] as const,
        allowedSortFields: ['name'] as const,
        include: [],
        relations: [],
        toResponseDto: (entity: MockEntity | MockEntity[]) => {
          if (Array.isArray(entity)) {
            return entity.map((e) => ({ id: e.id, name: e.name }));
          }
          return { id: entity.id, name: entity.name };
        },
      });

      queryBuilder.getManyAndCount.mockResolvedValue([[], 0]);

      await serviceWithSortFields.findAll({
        page: 1,
        limit: 10,
        orderBy: 'id',
        orderDirection: 'ASC',
      });

      expect(queryBuilder.orderBy).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a transformed entity', async () => {
      const entity: MockEntity = { id: 1, name: 'test' };
      repository.findOne.mockResolvedValue(entity);

      const result = await service.findOne(1);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: undefined,
      });

      expect(result).toEqual({ id: 1, name: 'test' });
    });

    it('should forward the include list as relations to findOne', async () => {
      const svc = buildServiceWithIncludes(repository, [
        'author',
        'author.profile',
      ]);
      const entity: MockEntity = { id: 2, name: 'with-relations' };
      repository.findOne.mockResolvedValue(entity);

      const result = await svc.findOne(2);

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 2 },
        relations: { author: { profile: true } },
      });
      expect(result).toEqual({ id: 2, name: 'with-relations' });
    });

    it('should throw NotFoundException if entity does not exist', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should save and return transformed entity', async () => {
      const payload: Partial<MockEntity> = { name: 'new' };
      const savedEntity: MockEntity = { id: 1, name: 'new' };

      repository.save.mockResolvedValue(savedEntity);

      const result = await service.create(payload);

      expect(repository.save).toHaveBeenCalledWith(payload);
      expect(result).toEqual({ id: 1, name: 'new' });
    });
  });

  describe('update', () => {
    it('should update and return transformed entity', async () => {
      const existing: MockEntity = { id: 1, name: 'old' };
      const updated: MockEntity = { id: 1, name: 'updated' };
      const payload: Partial<MockEntity> = { name: 'updated' };

      repository.findOneBy.mockResolvedValue(existing);
      repository.save.mockResolvedValue(updated);
      repository.findOne.mockResolvedValue(updated);

      const result = await service.update(1, payload);

      expect(repository.merge).toHaveBeenCalledWith(existing, payload);
      expect(repository.save).toHaveBeenCalledWith(existing);
      expect(result).toEqual({ id: 1, name: 'updated' });
    });

    it('should throw NotFoundException if entity to update is missing', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.update(1, { name: 'fail' })).rejects.toThrow(
        NotFoundException
      );
    });
  });

  describe('remove', () => {
    it('should delete entity and return true', async () => {
      repository.findOneBy.mockResolvedValue({ id: 1 } as any);
      repository.delete.mockResolvedValue({ affected: 1 } as DeleteResult);

      const result = await service.remove(1);

      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(repository.delete).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it('should throw NotFoundException if entity not found', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.remove(1)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAuditLogs', () => {
    it('should list audit logs by entity name with pagination', async () => {
      auditQueryBuilder.getManyAndCount.mockResolvedValue([
        [{ id: '1' } as AuditLogEntity],
        1,
      ]);

      const result = await service.findAuditLogs({ page: 2, limit: 10 });

      expect(repository.manager.getRepository).toHaveBeenCalledWith(
        AuditLogEntity
      );
      expect(auditQueryBuilder.where).toHaveBeenCalledWith(
        'auditLog.entity = :entity',
        { entity: 'MockEntity' }
      );
      expect(auditQueryBuilder.skip).toHaveBeenCalledWith(10);
      expect(auditQueryBuilder.take).toHaveBeenCalledWith(10);
      expect(result).toEqual({
        data: [{ id: '1' }],
        meta: {
          total: 1,
          page: 2,
          limit: 10,
          totalPages: 1,
        },
      });
    });
  });
});
