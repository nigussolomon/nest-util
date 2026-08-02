import { NestCrudService } from '../../services/nest-crud.service';
import { crudServiceTests } from '../crud-service.test-suites';

class TestEntity {
  id!: number;
  name!: string;
  email!: string;
}

class TestCreateDto {
  name!: string;
  email!: string;
}

class TestUpdateDto {
  name?: string;
  email?: string;
}

class TestResponseDto {
  id!: number;
  name!: string;
}

describe('crudServiceTests', () => {
  crudServiceTests({
    serviceClass: NestCrudService,
    entity: TestEntity,
    createDto: TestCreateDto,
    updateDto: TestUpdateDto,
    responseDto: TestResponseDto,
    allowedFilters: ['name'] as const,
    toResponseDto: (entity: any) => {
      if (Array.isArray(entity)) {
        return entity.map((e) => ({ id: e.id, name: e.name }));
      }
      return { id: entity.id, name: entity.name };
    },
    test: {
      createPayload: { name: 'Alice', email: 'alice@test.com' },
      updatePayload: { name: 'Updated' },
      mockEntity: { id: 1, name: 'Test', email: 'test@test.com' },
    },
  });
});

describe('crudServiceTests with findMine', () => {
  crudServiceTests({
    serviceClass: NestCrudService,
    entity: TestEntity,
    allowedFilters: ['name'] as const,
    userOwnershipField: 'name' as any,
    test: {
      createPayload: { name: 'Alice', email: 'alice@test.com' },
      updatePayload: { name: 'Updated' },
      mockEntity: { id: 1, name: 'Alice', email: 'alice@test.com' },
    },
  });
});

describe('crudServiceTests with disabledEndpoints', () => {
  crudServiceTests({
    serviceClass: NestCrudService,
    entity: TestEntity,
    disabledEndpoints: ['findAuditLogs'] as const,
    test: {
      createPayload: { name: 'Alice', email: 'alice@test.com' },
      updatePayload: { name: 'Updated' },
    },
  });
});

describe('crudServiceTests with nested filters and sorting', () => {
  crudServiceTests({
    serviceClass: NestCrudService,
    entity: TestEntity,
    allowedFilters: ['name', 'author.name'] as const,
    allowedSortFields: ['id', 'author.name'] as const,
    include: ['author', 'author.profile'],
    test: {
      createPayload: { name: 'Alice', email: 'alice@test.com' },
      updatePayload: { name: 'Updated' },
      mockEntity: { id: 1, name: 'Alice', email: 'alice@test.com' },
    },
  });
});
