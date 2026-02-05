import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import {
  Repository,
  SelectQueryBuilder,
  DeleteResult,
  UpdateResult,
} from 'typeorm';
import { NestCrudService } from './nest-crud.service';
import { PaginationDto } from '../dtos/pagination.dto';
import { FilterDto } from '../dtos/filter.dto';

class MockEntity {
  id!: number;
  name!: string;
}

class MockResponseDto {
  id!: number;
  name!: string;
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

  beforeEach(async () => {
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
    } as unknown as jest.Mocked<SelectQueryBuilder<MockEntity>>;

    repository = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      findOneBy: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as jest.Mocked<Repository<MockEntity>>;

    const options = {
      repository,
      allowedFilters: ['name'] as const,
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

    service =
      module.get<
        NestCrudService<
          MockEntity,
          Partial<MockEntity>,
          Partial<MockEntity>,
          MockResponseDto
        >
      >(NestCrudService);
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
  });

  describe('findOne', () => {
    it('should return a transformed entity', async () => {
      const entity: MockEntity = { id: 1, name: 'test' };
      repository.findOneBy.mockResolvedValue(entity);

      const result = await service.findOne(1);

      expect(repository.findOneBy).toHaveBeenCalledWith({ id: 1 });
      expect(result).toEqual({ id: 1, name: 'test' });
    });

    it('should throw NotFoundException if entity does not exist', async () => {
      repository.findOneBy.mockResolvedValue(null);

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
      const entity: MockEntity = { id: 1, name: 'old' };
      const payload: Partial<MockEntity> = { name: 'updated' };
      const updatedEntity: MockEntity = { id: 1, name: 'updated' };

      repository.findOneBy
        .mockResolvedValueOnce(entity)
        .mockResolvedValueOnce(updatedEntity);
      repository.update.mockResolvedValue({ affected: 1 } as UpdateResult);

      const result = await service.update(1, payload);

      expect(repository.update).toHaveBeenCalledWith(1, payload);
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
      repository.delete.mockResolvedValue({ affected: 1 } as DeleteResult);

      const result = await service.remove(1);

      expect(repository.delete).toHaveBeenCalledWith(1);
      expect(result).toBe(true);
    });

    it('should throw NotFoundException if no rows affected', async () => {
      repository.delete.mockResolvedValue({ affected: 0 } as DeleteResult);

      await expect(service.remove(1)).rejects.toThrow(NotFoundException);
    });
  });
});
