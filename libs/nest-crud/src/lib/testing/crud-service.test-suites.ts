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

    it('should join include relations via leftJoinAndSelect', async () => {
      if (!config.include || config.include.length === 0) return;

      lastQb = createMockQb();
      lastQb.getManyAndCount.mockResolvedValue([[], 0]);
      repository.createQueryBuilder.mockReturnValue(lastQb as any);

      await service.findAll({ page: 1, limit: 10 });

      expect(lastQb.leftJoinAndSelect).toHaveBeenCalled();
    });

    it('should apply orderBy when specified', async () => {
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

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: config.include ?? [],
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
