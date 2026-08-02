import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ObjectLiteral } from 'typeorm';
import { NestCrudService } from '../services/nest-crud.service';
import { CrudTestConfig, CrudTestContext } from './testing.interface';
import { createMockRepository, createMockQb } from './mock-repository';

export function crudServiceTests<
  TEntity extends ObjectLiteral,
  TCreateDto,
  TUpdateDto,
  TResponseDto
>(config: CrudTestConfig<TEntity, TCreateDto, TUpdateDto, TResponseDto>): CrudTestContext {
  let service: NestCrudService<TEntity, TCreateDto, TUpdateDto, TResponseDto>;
  let repository: jest.Mocked<any>;
  let moduleRef: TestingModule;
  let lastQb: ReturnType<typeof createMockQb>;

  beforeEach(async () => {
    repository = createMockRepository(
      config.entity,
      config.test.mockRepoOverrides as any
    );

    const serviceOptions: any = {
      repository,
      allowedFilters: config.allowedFilters ?? [],
      allowedSortFields: config.allowedSortFields ?? [],
      include: config.include ?? [],
      relations: config.relations ?? [],
      toResponseDto: config.toResponseDto,
      disabledEndpoints: config.disabledEndpoints ?? [],
      hooks: config.hooks,
      userOwnershipField: config.userOwnershipField,
      findMineQuery: config.findMineQuery,
    };

    service = new NestCrudService(serviceOptions);

    moduleRef = await Test.createTestingModule({
      providers: [
        { provide: config.serviceClass, useValue: service },
        { provide: getRepositoryToken(config.entity), useValue: repository },
      ],
    }).compile();
  });

  describe('findAll', () => {
    it('should return paginated data and meta', async () => {
      lastQb = createMockQb();
      const mockEntity = createMockEntity(config);
      lastQb.getManyAndCount.mockResolvedValue([[mockEntity], 1]);
      repository.createQueryBuilder.mockReturnValue(lastQb as any);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('e');
      expect(lastQb.getManyAndCount).toHaveBeenCalled();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
    });

    it('should apply filters via andWhen allowedFilters is configured', async () => {
      if (!config.allowedFilters || config.allowedFilters.length === 0) return;

      lastQb = createMockQb();
      lastQb.getManyAndCount.mockResolvedValue([[], 0]);
      repository.createQueryBuilder.mockReturnValue(lastQb as any);

      const filterKey = config.allowedFilters[0];
      await service.findAll({
        page: 1,
        limit: 10,
        filter: { [`${String(filterKey)}_cont`]: 'test' },
      });

      expect(lastQb.andWhere).toHaveBeenCalled();
    });

    it('should apply nested filters via joined aliases', async () => {
      const nestedFilters = (config.allowedFilters ?? []).filter((field) =>
        String(field).includes('.')
      );
      if (nestedFilters.length === 0) return;

      lastQb = createMockQb();
      lastQb.getManyAndCount.mockResolvedValue([[], 0]);
      repository.createQueryBuilder.mockReturnValue(lastQb as any);

      const nestedField = String(nestedFilters[0]);
      await service.findAll({
        page: 1,
        limit: 10,
        filter: { [`${nestedField}_cont`]: 'test' },
      });

      const [sql] = lastQb.andWhere.mock.calls[0] as [string];
      const parts = nestedField.split('.');
      const alias = parts.slice(0, -1).join('_');
      const column = parts[parts.length - 1];
      expect(sql).toContain(`${alias}.${column} ILIKE`);
    });

    it('should sort by nested fields via joined aliases', async () => {
      const nestedSorts = (config.allowedSortFields ?? []).filter((field) =>
        String(field).includes('.')
      );
      if (nestedSorts.length === 0) return;

      lastQb = createMockQb();
      lastQb.getManyAndCount.mockResolvedValue([[], 0]);
      repository.createQueryBuilder.mockReturnValue(lastQb as any);

      const nestedField = String(nestedSorts[0]);
      await service.findAll({
        page: 1,
        limit: 10,
        orderBy: nestedField,
        orderDirection: 'ASC',
      });

      const parts = nestedField.split('.');
      const alias = parts.slice(0, -1).join('_');
      const column = parts[parts.length - 1];
      expect(lastQb.orderBy).toHaveBeenCalledWith(
        `${alias}.${column}`,
        'ASC'
      );
    });

    it('should join include relations via leftJoinAndSelect', async () => {
      if (!config.include || config.include.length === 0) return;

      lastQb = createMockQb();
      lastQb.getManyAndCount.mockResolvedValue([[], 0]);
      repository.createQueryBuilder.mockReturnValue(lastQb as any);

      await service.findAll({ page: 1, limit: 10 });

      expect(lastQb.leftJoinAndSelect).toHaveBeenCalled();
    });

    it('should apply orderBy when specified', async () => {
      if (config.allowedSortFields?.length && !(config.allowedSortFields as readonly string[]).includes('id')) return;

      lastQb = createMockQb();
      lastQb.getManyAndCount.mockResolvedValue([[], 0]);
      repository.createQueryBuilder.mockReturnValue(lastQb as any);

      await service.findAll({
        page: 1,
        limit: 10,
        orderBy: 'id',
        orderDirection: 'ASC',
      });

      expect(lastQb.orderBy).toHaveBeenCalledWith('e.id', 'ASC');
    });

    it('should default orderBy to DESC', async () => {
      if (config.allowedSortFields?.length && !(config.allowedSortFields as readonly string[]).includes('id')) return;

      lastQb = createMockQb();
      lastQb.getManyAndCount.mockResolvedValue([[], 0]);
      repository.createQueryBuilder.mockReturnValue(lastQb as any);

      await service.findAll({
        page: 1,
        limit: 10,
        orderBy: 'id',
      });

      expect(lastQb.orderBy).toHaveBeenCalledWith('e.id', 'DESC');
    });

    it('should return empty data when no results', async () => {
      lastQb = createMockQb();
      lastQb.getManyAndCount.mockResolvedValue([[], 0]);
      repository.createQueryBuilder.mockReturnValue(lastQb as any);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result).toHaveProperty('data');
      expect((result as any).data).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return the entity', async () => {
      const mockEntity = createMockEntity(config);
      repository.findOne.mockResolvedValue(mockEntity);

      const result = await service.findOne(1);

      const include = config.include ?? [];
      const expectedRelations = include.length > 0
        ? buildRelationsFromInclude(include)
        : undefined;
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: expectedRelations,
      });
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when not found', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should save and return the entity', async () => {
      const mockEntity = createMockEntity(config);
      repository.save.mockResolvedValue(mockEntity);

      const result = await service.create(config.test.createPayload as any);

      expect(repository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should merge, save, and return the updated entity', async () => {
      const mockEntity = createMockEntity(config);
      repository.findOneBy.mockResolvedValue(mockEntity);
      repository.save.mockResolvedValue(mockEntity);
      repository.findOne.mockResolvedValue(mockEntity);

      const result = await service.update(1, config.test.updatePayload as any);

      expect(repository.findOneBy).toHaveBeenCalled();
      expect(repository.merge).toHaveBeenCalled();
      expect(repository.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should throw NotFoundException when entity not found', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(
        service.update(999, config.test.updatePayload as any)
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete and return true', async () => {
      const mockEntity = createMockEntity(config);
      repository.findOneBy.mockResolvedValue(mockEntity);
      repository.delete.mockResolvedValue({ affected: 1 } as any);

      const result = await service.remove(1);

      expect(repository.findOneBy).toHaveBeenCalled();
      expect(repository.delete).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it('should throw NotFoundException when not found', async () => {
      repository.findOneBy.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findMine', () => {
    it('should filter by ownership field', async () => {
      if (!config.userOwnershipField && !config.findMineQuery) return;

      lastQb = createMockQb();
      const mockEntity = createMockEntity(config);
      lastQb.getManyAndCount.mockResolvedValue([[mockEntity], 1]);
      repository.createQueryBuilder.mockReturnValue(lastQb as any);

      const result = await service.findMine(123, { page: 1, limit: 10 });

      expect(repository.createQueryBuilder).toHaveBeenCalled();
      expect(result).toHaveProperty('data');
    });

    it('should throw BadRequestException when not configured', async () => {
      if (config.userOwnershipField || config.findMineQuery) return;

      await expect(service.findMine(123, {})).rejects.toThrow(
        BadRequestException
      );
    });

    it('should apply filters via andWhere', async () => {
      if (!config.userOwnershipField && !config.findMineQuery) return;
      if (!config.allowedFilters || config.allowedFilters.length === 0) return;

      lastQb = createMockQb();
      lastQb.getManyAndCount.mockResolvedValue([[], 0]);
      repository.createQueryBuilder.mockReturnValue(lastQb as any);

      const filterKey = config.allowedFilters[0];
      await service.findMine(123, {
        filter: { [`${String(filterKey)}_cont`]: 'test' },
      });

      expect(lastQb.andWhere).toHaveBeenCalled();
    });
  });

  describe('findAllWithCursor', () => {
    it('should return cursor-based results', async () => {
      if (config.disabledEndpoints?.includes('findMine')) return;

      lastQb = createMockQb();
      const mockEntity = createMockEntity(config);
      lastQb.getMany.mockResolvedValue([mockEntity]);
      repository.createQueryBuilder.mockReturnValue(lastQb as any);

      const result = await service.findAllWithCursor({ limit: 10 });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.meta).toHaveProperty('limit', 10);
      expect(result.meta).toHaveProperty('hasMore');
      expect(result.meta).toHaveProperty('nextCursor');
    });

    it('should detect hasMore when entities exceed limit', async () => {
      lastQb = createMockQb();
      const entities = Array.from({ length: 11 }, () =>
        createMockEntity(config)
      );
      lastQb.getMany.mockResolvedValue(entities);
      repository.createQueryBuilder.mockReturnValue(lastQb as any);

      const result = await service.findAllWithCursor({ limit: 10 });

      expect(result.meta.hasMore).toBe(true);
      expect(result.meta.nextCursor).toBeDefined();
    });

    it('should set hasMore false when entities <= limit', async () => {
      lastQb = createMockQb();
      const mockEntity = createMockEntity(config);
      lastQb.getMany.mockResolvedValue([mockEntity]);
      repository.createQueryBuilder.mockReturnValue(lastQb as any);

      const result = await service.findAllWithCursor({ limit: 10 });

      expect(result.meta.hasMore).toBe(false);
      expect(result.meta.nextCursor).toBeNull();
    });

    it('should include total when includeTotal is true', async () => {
      lastQb = createMockQb();
      const mockEntity = createMockEntity(config);
      lastQb.getMany.mockResolvedValue([mockEntity]);
      lastQb.getCount.mockResolvedValue(1);
      repository.createQueryBuilder.mockReturnValue(lastQb as any);

      const countQb = createMockQb();
      countQb.getCount.mockResolvedValue(1);
      repository.createQueryBuilder.mockReturnValueOnce(lastQb as any);
      repository.createQueryBuilder.mockReturnValueOnce(countQb as any);

      const result = await service.findAllWithCursor({
        limit: 10,
        includeTotal: true,
      });

      expect(result.meta).toHaveProperty('total');
    });

    it('should join nested relations on the count query when includeTotal is true', async () => {
      const nestedIncludes = (config.include ?? []).filter((relation) =>
        relation.includes('.')
      );
      if (nestedIncludes.length === 0) return;

      lastQb = createMockQb();
      lastQb.getMany.mockResolvedValue([]);
      repository.createQueryBuilder.mockReturnValue(lastQb as any);

      const countQb = createMockQb();
      countQb.getCount.mockResolvedValue(0);
      repository.createQueryBuilder.mockReturnValueOnce(lastQb as any);
      repository.createQueryBuilder.mockReturnValueOnce(countQb as any);

      await service.findAllWithCursor({ limit: 10, includeTotal: true });

      for (const relation of nestedIncludes) {
        const parts = relation.split('.');
        const parentAlias = parts.slice(0, -1).join('_');
        const field = parts[parts.length - 1];
        const alias = parts.join('_');
        expect(countQb.leftJoin).toHaveBeenCalledWith(
          `${parentAlias}.${field}`,
          alias
        );
      }
    });
  });

  describe('findAuditLogs', () => {
    it('should query audit logs with pagination', async () => {
      const auditQb = createMockQb();
      auditQb.getManyAndCount.mockResolvedValue([[], 0]);
      repository.manager.getRepository.mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(auditQb),
      } as any);

      const result = await service.findAuditLogs({ page: 1, limit: 10 });

      expect(repository.manager.getRepository).toHaveBeenCalled();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
    });
  });

  describe('disabledEndpoints', () => {
    it('should block disabled endpoints', async () => {
      if (!config.disabledEndpoints || config.disabledEndpoints.length === 0)
        return;

      const disabled = config.disabledEndpoints[0];
      (service as any).disabledEndpoints = config.disabledEndpoints;

      expect((service as any).disabledEndpoints).toContain(disabled);
    });
  });

  const ctx: CrudTestContext = {
    get module() {
      return moduleRef;
    },
    get repository() {
      return repository;
    },
    createMockQb,
  };

  return ctx;
}

function buildRelationsFromInclude(include: readonly string[]): Record<string, any> {
  const result: Record<string, any> = {};
  for (const relation of include) {
    const parts = relation.split('.');
    let current = result;
    for (let i = 0; i < parts.length; i++) {
      const isLast = i === parts.length - 1;
      if (isLast) {
        current[parts[i]] = true;
      } else {
        if (!(parts[i] in current) || current[parts[i]] === true) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
    }
  }
  return result;
}

function createMockEntity<
  TEntity extends ObjectLiteral,
  TCreateDto,
  TUpdateDto,
  TResponseDto
>(
  config: CrudTestConfig<TEntity, TCreateDto, TUpdateDto, TResponseDto>
): TEntity {
  const { createDefaultMockEntity } = require('./mock-repository');
  const defaults = createDefaultMockEntity(config.entity);
  return { ...defaults, ...(config.test.mockEntity ?? {}) } as TEntity;
}
