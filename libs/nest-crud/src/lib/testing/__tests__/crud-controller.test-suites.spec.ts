import {
  CreateNestedCrudController,
} from '../../controllers/nest-crud.controller';
import { crudControllerTests } from '../crud-controller.test-suites';

class TestDto {
  name!: string;
}

class TestResponseDto {
  id!: number;
  name!: string;
}

const TestControllerBase = CreateNestedCrudController(
  TestDto,
  TestDto,
  TestResponseDto
);

describe('crudControllerTests', () => {
  crudControllerTests({
    controllerFactory: () => TestControllerBase,
    serviceClass: class {},
    entity: class { id!: number; name!: string; },
    createDto: TestDto,
    updateDto: TestDto,
    responseDto: TestResponseDto,
    test: {
      createPayload: { name: 'New Item' },
      updatePayload: { name: 'Updated' },
    },
  });
});

describe('crudControllerTests with permissions', () => {
  const allPermissions = {
    findAll: 'items.read',
    findOne: 'items.read',
    create: ['items.create', 'items.write'],
    update: 'items.update',
    remove: 'items.delete',
    findAuditLogs: 'items.audit',
    findMine: 'items.read',
  };
  const PermissionedBase = CreateNestedCrudController(
    TestDto,
    TestDto,
    TestResponseDto,
    {
      permissions: allPermissions,
    }
  );

  crudControllerTests({
    controllerFactory: () => PermissionedBase,
    serviceClass: class {},
    entity: class { id!: number; name!: string; },
    createDto: TestDto,
    updateDto: TestDto,
    responseDto: TestResponseDto,
    permissions: allPermissions,
    test: {
      createPayload: { name: 'New Item' },
      updatePayload: { name: 'Updated' },
    },
  });
});

describe('crudControllerTests with findMine', () => {
  const FindMineBase = CreateNestedCrudController(
    TestDto,
    TestDto,
    TestResponseDto,
    { enableFindMine: true }
  );

  crudControllerTests({
    controllerFactory: () => FindMineBase,
    serviceClass: class {},
    entity: class { id!: number; name!: string; },
    createDto: TestDto,
    updateDto: TestDto,
    responseDto: TestResponseDto,
    test: {
      createPayload: { name: 'New Item' },
      updatePayload: { name: 'Updated' },
    },
  });
});
