import { Type } from '@nestjs/common';
import { ObjectLiteral, Repository } from 'typeorm';
import { MockQueryBuilder } from './testing.interface';

export function createMockQb(): MockQueryBuilder {
  const qb: MockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getMany: jest.fn().mockResolvedValue([]),
    getOne: jest.fn().mockResolvedValue(null),
    getCount: jest.fn().mockResolvedValue(0),
    getRawOne: jest.fn().mockResolvedValue({}),
  };
  return qb;
}

export function createMockRepository<TEntity extends ObjectLiteral>(
  entity: Type<TEntity>,
  overrides?: Partial<jest.Mocked<Repository<TEntity>>>
): jest.Mocked<Repository<TEntity>> {
  const mockEntity = createDefaultMockEntity(entity);
  const auditQb = createMockQb();

  const repo = {
    createQueryBuilder: jest.fn().mockReturnValue(createMockQb()),
    findOne: jest.fn().mockResolvedValue(mockEntity),
    findOneBy: jest.fn().mockResolvedValue(mockEntity),
    merge: jest.fn((e: any, p: any) => Object.assign(e, p)),
    save: jest.fn().mockImplementation((e: any) => Promise.resolve(e)),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    find: jest.fn().mockResolvedValue([mockEntity]),
    metadata: {
      name: entity.name,
      tableName: entity.name.toLowerCase(),
      primaryColumns: [{ propertyPath: 'id', type: () => Number }],
    },
    manager: {
      getRepository: jest.fn().mockReturnValue({
        createQueryBuilder: jest.fn().mockReturnValue(auditQb),
      }),
      connection: {
        createQueryRunner: jest.fn().mockReturnValue({
          startTransaction: jest.fn(),
          commitTransaction: jest.fn(),
          rollbackTransaction: jest.fn(),
          release: jest.fn(),
        }),
      },
    },
    ...overrides,
  } as unknown as jest.Mocked<Repository<TEntity>>;

  return repo;
}

export function createDefaultMockEntity<TEntity extends ObjectLiteral>(
  entity: Type<TEntity>
): TEntity {
  try {
    const { getMetadata } = require('typeorm');
    const metadata = getMetadata(entity);
    const instance = {} as TEntity;

    for (const col of metadata.columns) {
      const type = col.type;
      const name = col.propertyPath;

      if (col.isPrimary) {
        if (type === 'uuid') {
          (instance as any)[name] = '00000000-0000-0000-0000-000000000001';
        } else {
          (instance as any)[name] = 1;
        }
      } else if (type === String || type === 'varchar' || type === 'text') {
        (instance as any)[name] = `mock_${name}`;
      } else if (type === Number || type === 'int' || type === 'integer') {
        (instance as any)[name] = 0;
      } else if (type === Boolean || type === 'boolean') {
        (instance as any)[name] = true;
      } else if (
        type === Date ||
        type === 'timestamp' ||
        type === 'datetime'
      ) {
        (instance as any)[name] = new Date('2024-01-01T00:00:00.000Z');
      } else if (type === 'json' || type === 'jsonb') {
        (instance as any)[name] = {};
      } else {
        (instance as any)[name] = null;
      }
    }

    return instance;
  } catch {
    return { id: 1 } as unknown as TEntity;
  }
}
